import threading
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import config
import gerp
from db import CompanySnapshot, Customer, CustomerSnapshot, Followup, Meta, User

METALS = ("cash", "gold", "silver")
_sync_locks: dict = defaultdict(threading.Lock)


# ------------------------------------------------------------------ meta helpers
def meta_get(db: Session, key: str, default: str = "") -> str:
    m = db.get(Meta, key)
    return m.value if m else default


def meta_set(db: Session, key: str, value: str):
    m = db.get(Meta, key)
    if m:
        m.value = value
    else:
        db.add(Meta(key=key, value=value))


def get_co(key) -> dict:
    co = config.company(key)
    if co is None:
        raise HTTPException(404, f"Company not found: {key}")
    return co


def company_customers(db: Session, company: str) -> list:
    return list(db.scalars(select(Customer).where(Customer.company == company)))


def _company_cids(company: str):
    return select(Customer.id).where(Customer.company == company)


def sync_status(db: Session, company: str) -> dict:
    return {
        "company": company,
        "last_sync": meta_get(db, f"last_sync:{company}") or None,
        "last_error": meta_get(db, f"last_error:{company}") or None,
        "mock": config.MOCK,
        "ttl_seconds": config.SYNC_TTL_SECONDS,
        "branches": get_co(company)["branches"],
    }


# ------------------------------------------------------------------ sync
def _f(v) -> float:
    try:
        return round(float(v or 0), 4)
    except (TypeError, ValueError):
        return 0.0


def totals(customers) -> dict:
    t = {}
    for m in METALS:
        eps = config.EPS[m]
        bals = [getattr(c, f"{m}_balance") for c in customers]
        t[f"{m}_receivable"] = sum(b for b in bals if b > eps)
        t[f"{m}_payable"] = -sum(b for b in bals if b < -eps)
    t["debtors"] = sum(1 for c in customers if any(getattr(c, f"{m}_balance") > config.EPS[m] for m in METALS))
    return t


def sync_customers(db: Session, company: str, force: bool = False, raise_errors: bool = True) -> dict:
    """GERP se balances le kar customers table update karta hai (workflow fields untouched). Per company."""
    co = get_co(company)
    with _sync_locks[company]:
        last = meta_get(db, f"last_sync:{company}")
        if not force and last:
            age = (config.now() - datetime.fromisoformat(last)).total_seconds()
            if age < config.SYNC_TTL_SECONDS:
                return {"synced": False, **sync_status(db, company)}
        try:
            rows = gerp.customer_balances(co, config.today())
        except Exception as e:  # noqa: BLE001
            msg = e.detail if isinstance(e, HTTPException) else str(e)
            meta_set(db, f"last_error:{company}", f"{config.now().isoformat(timespec='seconds')} {msg}")
            db.commit()
            if raise_errors:
                raise
            return {"synced": False, **sync_status(db, company)}

        ts = config.now()
        existing = {c.id: c for c in db.scalars(select(Customer).where(Customer.company == company))}
        seen = set()
        for r in rows:
            cid = co["offset"] + int(r["id"])
            seen.add(cid)
            c = existing.get(cid)
            if c is None:
                c = Customer(id=cid, company=company)
                db.add(c)
                existing[cid] = c
            c.code = str(r.get("customer_code") or "")
            c.name = r.get("customer_name") or ""
            c.name_ar = r.get("customer_name_ar") or ""
            c.account_id = r.get("account_id")
            for m in METALS:
                for part in ("debit", "credit", "balance"):
                    setattr(c, f"{m}_{part}", _f(r.get(f"{m}_{part}")))
            c.synced_at = ts

        # Jo customer ab GERP ki list mein nahi aata uska purana balance totals bigaadta rahega: zero kar do
        # (workflow data/history safe rehti hai).
        for cid, c in existing.items():
            if cid not in seen and any(getattr(c, f"{m}_{p}") for m in METALS for p in ("debit", "credit", "balance")):
                for m in METALS:
                    for p in ("debit", "credit", "balance"):
                        setattr(c, f"{m}_{p}", 0.0)
        db.flush()

        # Aaj ka per-customer snapshot (din mein kai sync hon to aakhri wala rehta hai)
        today = config.today()
        todays = {s.customer_id: s for s in db.scalars(select(CustomerSnapshot).where(CustomerSnapshot.day == today))}
        for cid, c in existing.items():
            s = todays.get(cid)
            if s is None:
                s = CustomerSnapshot(customer_id=cid, day=today)
                db.add(s)
            s.cash_balance, s.gold_balance, s.silver_balance = c.cash_balance, c.gold_balance, c.silver_balance

        t = totals(list(existing.values()))
        snap = db.get(CompanySnapshot, (company, config.today()))
        if snap is None:
            snap = CompanySnapshot(company=company, day=config.today())
            db.add(snap)
        for k, v in t.items():
            setattr(snap, k, v)
        meta_set(db, f"last_sync:{company}", ts.isoformat(timespec="seconds"))
        meta_set(db, f"last_error:{company}", "")
        db.commit()
        return {"synced": True, "customers": len(rows), **sync_status(db, company)}


# ------------------------------------------------------------------ followup lookups
def latest_followups(db: Session) -> dict:
    sub = select(func.max(Followup.id)).group_by(Followup.customer_id)
    rows = db.scalars(select(Followup).where(Followup.id.in_(sub))).all()
    return {f.customer_id: f for f in rows}


def pending_promises(db: Session) -> dict:
    rows = db.scalars(
        select(Followup).where(Followup.promise_status == "pending", Followup.promise_date.is_not(None))
        .order_by(Followup.promise_date.asc())
    ).all()
    out = {}
    for f in rows:
        out.setdefault(f.customer_id, f)  # sabse nazdeek wali promise
    return out


def promise_dict(f: Optional[Followup]):
    if not f:
        return None
    return {"id": f.id, "date": f.promise_date.isoformat(), "gold": f.promise_gold, "cash": f.promise_cash,
            "silver": f.promise_silver, "overdue": f.promise_date < config.today()}


def followup_dict(f: Followup) -> dict:
    return {
        "id": f.id, "customer_id": f.customer_id, "user_id": f.user_id,
        "user_name": f.user.name if f.user else "",
        "kind": f.kind, "outcome": f.outcome, "note": f.note,
        "next_followup_date": f.next_followup_date.isoformat() if f.next_followup_date else None,
        "promise_date": f.promise_date.isoformat() if f.promise_date else None,
        "promise_gold": f.promise_gold, "promise_cash": f.promise_cash, "promise_silver": f.promise_silver,
        "promise_status": f.promise_status,
        "created_at": f.created_at.isoformat(timespec="seconds"),
    }


def prev_snapshot(db: Session, company: str):
    """(din, {customer_id: (cash, gold, silver)}) pichhle snapshot din ka (is company ka); din None => abhi purani history nahi."""
    scope = CustomerSnapshot.customer_id.in_(_company_cids(company))
    day = db.scalar(select(func.max(CustomerSnapshot.day)).where(CustomerSnapshot.day < config.today(), scope))
    if not day:
        return None, {}
    rows = db.execute(select(CustomerSnapshot.customer_id, CustomerSnapshot.cash_balance,
                             CustomerSnapshot.gold_balance, CustomerSnapshot.silver_balance)
                      .where(CustomerSnapshot.day == day, scope)).all()
    return day, {r[0]: (r[1], r[2], r[3]) for r in rows}


def _delta(c: Customer, prev) -> Optional[dict]:
    if not prev or prev[0] is None:
        return None
    base = prev[1].get(c.id, (0.0, 0.0, 0.0))  # pehle nahi tha => naya customer, base 0
    return {"cash": round(c.cash_balance - base[0], 4), "gold": round(c.gold_balance - base[1], 4),
            "silver": round(c.silver_balance - base[2], 4)}


def customer_dict(c: Customer, last: Optional[Followup] = None, promise: Optional[Followup] = None,
                  users: Optional[dict] = None, detail: bool = False, prev=None) -> dict:
    d = {
        "id": c.id, "company": c.company, "code": c.code, "name": c.name, "name_ar": c.name_ar,
        "cash_balance": c.cash_balance, "gold_balance": c.gold_balance, "silver_balance": c.silver_balance,
        "assigned_to": c.assigned_to,
        "assigned_name": (users or {}).get(c.assigned_to) if c.assigned_to else None,
        "status": c.status,
        "last_followup_at": last.created_at.isoformat(timespec="seconds") if last else None,
        "last_followup_kind": last.kind if last else None,
        "next_followup_date": last.next_followup_date.isoformat() if last and last.next_followup_date else None,
        "promise": promise_dict(promise),
        "synced_at": c.synced_at.isoformat(timespec="seconds") if c.synced_at else None,
        "delta": _delta(c, prev),
    }
    if detail:
        for m in METALS:
            d[f"{m}_debit"] = getattr(c, f"{m}_debit")
            d[f"{m}_credit"] = getattr(c, f"{m}_credit")
        d["notes"] = c.notes
        d["account_id"] = c.account_id
    return d


def user_names(db: Session) -> dict:
    return {u.id: u.name for u in db.scalars(select(User))}


def customer_history(db: Session, cid: int, days: int = 60) -> list:
    rows = db.scalars(select(CustomerSnapshot).where(CustomerSnapshot.customer_id == cid)
                      .order_by(CustomerSnapshot.day.desc()).limit(days)).all()[::-1]
    return [{"day": r.day.isoformat(), "gold": r.gold_balance, "cash": r.cash_balance, "silver": r.silver_balance}
            for r in rows]


# ------------------------------------------------------------------ filtering
def has_balance(c: Customer) -> bool:
    return any(abs(getattr(c, f"{m}_balance")) > config.EPS[m] for m in METALS)


def is_debtor(c: Customer, metal: Optional[str] = None) -> bool:
    ms = (metal,) if metal else METALS
    return any(getattr(c, f"{m}_balance") > config.EPS[m] for m in ms)


def apply_filters(customers, q: str, flt: str, assigned: str, status: str, me_id: int):
    out = []
    ql = q.strip().lower()
    for c in customers:
        if ql and ql not in f"{c.code} {c.name} {c.name_ar}".lower():
            continue
        if flt == "with_balance" and not has_balance(c):
            continue
        if flt == "gold_debtors" and not is_debtor(c, "gold"):
            continue
        if flt == "cash_debtors" and not is_debtor(c, "cash"):
            continue
        if flt == "silver_debtors" and not is_debtor(c, "silver"):
            continue
        if flt == "we_owe" and not any(getattr(c, f"{m}_balance") < -config.EPS[m] for m in METALS):
            continue
        if assigned == "me" and c.assigned_to != me_id:
            continue
        if assigned == "unassigned" and c.assigned_to is not None:
            continue
        if assigned.isdigit() and c.assigned_to != int(assigned):
            continue
        if status and c.status != status:
            continue
        out.append(c)
    return out


SORTS = {"gold": "gold_balance", "cash": "cash_balance", "silver": "silver_balance"}


def sort_customers(rows: list, sort: str, desc: bool) -> list:
    if sort in SORTS:
        key = lambda d: d[SORTS[sort]]  # noqa: E731
    elif sort == "name":
        key = lambda d: (d["name"] or d["name_ar"] or "").lower()  # noqa: E731
    elif sort == "last_followup":
        key = lambda d: d["last_followup_at"] or ""  # noqa: E731
    else:
        key = lambda d: d["gold_balance"]  # noqa: E731
    return sorted(rows, key=key, reverse=desc)


# ------------------------------------------------------------------ overview / my day
def _brief(c: Customer, **extra) -> dict:
    return {"id": c.id, "name": c.name or c.name_ar, "name_ar": c.name_ar or c.name,
            "gold_balance": c.gold_balance, "cash_balance": c.cash_balance, "silver_balance": c.silver_balance, **extra}


def overview(db: Session, company: str) -> dict:
    customers = company_customers(db, company)
    t = totals(customers)
    today = config.today()
    lasts = latest_followups(db)
    promises = pending_promises(db)
    users = user_names(db)
    prev_day, prev_map = prev_snapshot(db, company)
    cmap = {c.id: c for c in customers}

    def top(metal, n=8):
        eps = config.EPS[metal]
        rows = sorted((c for c in customers if getattr(c, f"{metal}_balance") > eps),
                      key=lambda c: getattr(c, f"{metal}_balance"), reverse=True)[:n]
        return [{"id": c.id, "name": c.name or c.name_ar, "name_ar": c.name_ar or c.name,
                 "value": getattr(c, f"{metal}_balance")} for c in rows]

    # ---- total receivable kal (pichhle snapshot din) se kitna badla
    prev_snap = db.scalars(select(CompanySnapshot).where(CompanySnapshot.company == company, CompanySnapshot.day < today)
                           .order_by(CompanySnapshot.day.desc()).limit(1)).first()
    changes = None
    if prev_snap:
        changes = {"since": prev_snap.day.isoformat(), "debtors": t["debtors"] - prev_snap.debtors}
        for m in METALS:
            changes[f"{m}_receivable"] = t[f"{m}_receivable"] - getattr(prev_snap, f"{m}_receivable")

    # ---- paid down (balance ghata) / increased + movers, per customer
    paid_down = {m: 0.0 for m in METALS}
    increased = {m: 0.0 for m in METALS}
    movers = {m: {"down": [], "up": []} for m in ("gold", "cash")}
    if prev_day:
        deltas = {m: [] for m in movers}
        for c in customers:
            base = prev_map.get(c.id, (0.0, 0.0, 0.0))
            for i, m in enumerate(METALS):
                cur, b = getattr(c, f"{m}_balance"), base[i]
                change = max(cur, 0) - max(b, 0)
                if change < -config.EPS[m]:
                    paid_down[m] += -change
                elif change > config.EPS[m]:
                    increased[m] += change
                if m in deltas and abs(cur - b) > config.EPS[m]:
                    deltas[m].append((cur - b, c))
        for m, rows in deltas.items():
            rows.sort(key=lambda x: x[0])
            movers[m]["down"] = [_brief(c, delta=d) for d, c in rows if d < 0][:5]
            movers[m]["up"] = [_brief(c, delta=d) for d, c in reversed(rows) if d > 0][:5]

    # ---- needs attention
    fu_due = []
    for cid, f in lasts.items():
        c = cmap.get(cid)
        if c and f.next_followup_date and f.next_followup_date <= today:
            fu_due.append(_brief(c, days=(today - f.next_followup_date).days))
    fu_due.sort(key=lambda d: -d["days"])

    prom_due = []
    for cid, p in promises.items():
        c = cmap.get(cid)
        if c and p.promise_date <= today:
            prom_due.append(_brief(c, days=(today - p.promise_date).days, promise_id=p.id,
                                   p_gold=p.promise_gold, p_cash=p.promise_cash, p_silver=p.promise_silver))
    prom_due.sort(key=lambda d: -d["days"])

    neglected_all = []
    for c in customers:
        if c.status != "active" or not is_debtor(c):
            continue
        f = lasts.get(c.id)
        if f and f.next_followup_date and f.next_followup_date > today:
            continue  # follow-up already scheduled
        days = (today - f.created_at.date()).days if f else None
        if days is None or days >= 14:
            neglected_all.append(_brief(c, days=days))
    neglected_all.sort(key=lambda d: (-d["gold_balance"], -d["cash_balance"]))

    unassigned_all = sorted((_brief(c) for c in customers if is_debtor(c) and c.assigned_to is None),
                            key=lambda d: -d["gold_balance"])

    # ---- collector board
    since7 = datetime.combine(today - timedelta(days=6), datetime.min.time())
    since30 = datetime.combine(today - timedelta(days=30), datetime.min.time())
    in_co = Followup.customer_id.in_(_company_cids(company))
    recent = db.scalars(select(Followup).where(Followup.created_at >= since30, in_co)).all()
    board = []
    for uid, uname in users.items():
        mine = [c for c in customers if c.assigned_to == uid]
        debtors = [c for c in mine if is_debtor(c)]
        board.append({
            "id": uid, "name": uname,
            "assigned": len(mine), "debtors": len(debtors),
            "gold_out": sum(max(c.gold_balance, 0) for c in mine),
            "cash_out": sum(max(c.cash_balance, 0) for c in mine),
            "followups_7d": sum(1 for f in recent if f.user_id == uid and f.created_at >= since7),
            "overdue": sum(1 for c in mine if lasts.get(c.id) and lasts[c.id].next_followup_date
                           and lasts[c.id].next_followup_date <= today),
            "promises_pending": sum(1 for c in mine if c.id in promises),
            "kept_30d": sum(1 for f in recent if f.user_id == uid and f.promise_status == "kept"),
            "broken_30d": sum(1 for f in recent if f.user_id == uid and f.promise_status == "broken"),
        })
    board = [b for b in board if b["assigned"] or b["followups_7d"] or b["kept_30d"] or b["broken_30d"]]
    board.sort(key=lambda b: -b["gold_out"])

    # ---- activity feed + chart
    feed = []
    for f in db.scalars(select(Followup).where(in_co).order_by(Followup.id.desc()).limit(10)):
        c = cmap.get(f.customer_id)
        feed.append({"id": f.id, "customer_id": f.customer_id,
                     "name": (c.name or c.name_ar) if c else "", "name_ar": (c.name_ar or c.name) if c else "",
                     "user_name": f.user.name if f.user else "", "kind": f.kind, "outcome": f.outcome,
                     "has_promise": bool(f.promise_date), "created_at": f.created_at.isoformat(timespec="seconds")})
    since = today - timedelta(days=13)
    act = defaultdict(int)
    for f in db.scalars(select(Followup).where(Followup.created_at >= datetime.combine(since, datetime.min.time()), in_co)):
        act[f.created_at.date().isoformat()] += 1
    activity = [{"day": (since + timedelta(days=i)).isoformat(),
                 "count": act.get((since + timedelta(days=i)).isoformat(), 0)} for i in range(14)]

    kept = sum(1 for f in recent if f.promise_status == "kept")
    broken = sum(1 for f in recent if f.promise_status == "broken")

    # ---- concentration (gold): top 5 vs baaki
    gold_top = top("gold", 5)
    gold_total = t["gold_receivable"]
    others = max(gold_total - sum(r["value"] for r in gold_top), 0)
    share = [*gold_top, *([{"id": 0, "name": "Others", "name_ar": "أخرى", "value": others}] if others > 0 else [])]

    debtor_cs = [c for c in customers if is_debtor(c)]
    snaps = db.scalars(select(CompanySnapshot).where(CompanySnapshot.company == company)
                         .order_by(CompanySnapshot.day.desc()).limit(30)).all()[::-1]
    return {
        "company": company,
        "totals": t,
        "changes": changes,
        "customers_total": len(customers),
        "customers_with_balance": sum(1 for c in customers if has_balance(c)),
        "unassigned_debtors": len(unassigned_all),
        "followups_due": len(fu_due),
        "promises_pending": len(promises),
        "promises_overdue": sum(1 for f in promises.values() if f.promise_date < today),
        "promises_kept_30d": kept,
        "promises_broken_30d": broken,
        "prev_day": prev_day.isoformat() if prev_day else None,
        "paid_down": paid_down,
        "increased": increased,
        "movers": movers,
        "attention": {
            "followups": fu_due[:6], "promises": prom_due[:6],
            "neglected": neglected_all[:6], "neglected_total": len(neglected_all),
            "unassigned": unassigned_all[:6],
        },
        "board": board,
        "feed": feed,
        "gold_share": share,
        "gold_top5_pct": (sum(r["value"] for r in gold_top) / gold_total * 100) if gold_total else 0,
        "status_breakdown": {s: sum(1 for c in debtor_cs if c.status == s) for s in ("active", "hold", "legal")},
        "top_gold": top("gold"),
        "top_cash": top("cash"),
        "trend": [{"day": s.day.isoformat(), "gold_receivable": s.gold_receivable, "cash_receivable": s.cash_receivable,
                   "silver_receivable": s.silver_receivable, "debtors": s.debtors} for s in snaps],
        "activity": activity,
    }


def my_day(db: Session, user: User, scope: str, company: str) -> dict:
    today = config.today()
    users = user_names(db)
    customers = {c.id: c for c in company_customers(db, company)}
    lasts = latest_followups(db)
    promises = pending_promises(db)
    mine_only = scope == "mine"

    def visible(c):
        return c is not None and (not mine_only or c.assigned_to == user.id)

    followups, promise_list = [], []
    for cid, f in lasts.items():
        c = customers.get(cid)
        if visible(c) and f.next_followup_date and f.next_followup_date <= today:
            d = customer_dict(c, f, promises.get(cid), users)
            d["days_overdue"] = (today - f.next_followup_date).days
            followups.append(d)
    for cid, p in promises.items():
        c = customers.get(cid)
        if visible(c) and p.promise_date <= today + timedelta(days=7):
            d = customer_dict(c, lasts.get(cid), p, users)
            d["days_overdue"] = (today - p.promise_date).days
            promise_list.append(d)
    followups.sort(key=lambda d: -d["days_overdue"])
    promise_list.sort(key=lambda d: -d["days_overdue"])

    unassigned = [customer_dict(c, lasts.get(c.id), promises.get(c.id), users) for c in customers.values()
                  if is_debtor(c) and c.assigned_to is None]
    unassigned.sort(key=lambda d: -d["gold_balance"])
    return {"followups": followups, "promises": promise_list, "unassigned_debtors": unassigned[:20], "scope": scope}
