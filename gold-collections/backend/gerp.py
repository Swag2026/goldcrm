"""GERP external API client + Gold/Silver KPI logic (Dashboards KPI PDF)."""
import random
from typing import Optional
import threading
import time
from datetime import date

import requests
from fastapi import HTTPException

import config

_tokens: dict = {}  # company key -> {"value", "exp"}
_lock = threading.Lock()


def _get_token(co: dict, force: bool = False) -> str:
    with _lock:
        t = _tokens.get(co["key"])
        if not force and t and time.time() < t["exp"] - 60:
            return t["value"]
        if not co["base"] or not co["username"] or not co["password"]:
            raise HTTPException(500, f"{co['name']}: GERP base/username/password set nahi hain")
        r = requests.post(f"{co['base']}/auth/token", json={"username": co["username"], "password": co["password"]}, timeout=30)
        if not r.ok:
            raise HTTPException(502, f"{co['name']}: GERP auth failed ({r.status_code})")
        j = r.json()
        _tokens[co["key"]] = {"value": j["token"], "exp": time.time() + int(j.get("expires_in", 3600))}
        return j["token"]


def _post(co: dict, path: str, payload: dict, timeout: int = 180) -> dict:
    r = None
    for attempt in (0, 1):
        tok = _get_token(co, force=attempt == 1)
        r = requests.post(f"{co['base']}{path}", json=payload, timeout=timeout,
                          headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        if r.status_code == 401 and attempt == 0:
            continue
        break
    if not r.ok:
        raise HTTPException(502, f"{co['name']}: GERP error {r.status_code}: {r.text[:200]}")
    j = r.json()
    if j.get("status") != "ok":
        raise HTTPException(400, f"{co['name']}: GERP: {j}")
    return j


# ------------------------------------------------------------------ customers
def customer_balances(co: dict, to_date: date) -> list:
    if co["mock"]:
        return mock_customers(to_date, co["index"])
    return _post(co, "/customer-balances", {"branches": co["branches"], "to_date": to_date.isoformat()}, timeout=60)["data"]


# ------------------------------------------------------------------ KPI
GOLD_CODES = {
    "sales_cash": "311110001", "sales_due": "311120001", "sales_internal": "331110001",
    "returns_cash": "311110002", "returns_due": "311120002",
    "purchase_cash": "321110001", "purchase_due": "321120001", "purchase_internal": "331110002",
    "preturns_cash": "321110002", "preturns_due": "321120002",
}
SILVER_CODES = {"sales": "311110006", "purchase": "321110003"}


def account_rows(co: dict, branches: list, from_date: str, to_date: str) -> list:
    if co["mock"]:
        k = 1 + 0.6 * co["index"]
        return [{**r, "amount": r["amount"] * k, "silver": r["silver"] * k, "all_in_24": r["all_in_24"] * k} for r in MOCK_ACCOUNT_ROWS]
    payload = {
        "branches": branches, "from_date": from_date, "to_date": to_date,
        "account_types": ["general"], "price_of_gold": 0, "price_of_silver": 0,
        "convert": co["convert"], "currency": co["currency"],
        "rate_type": "gram", "show_data_with_zero": "yes",
    }
    return _post(co, "/summary-of-all-accounts", payload)["data"]["all_data"]


def _metric(lookup, code, col, missing):
    row = lookup.get(code)
    if row is None:
        missing.add(code)
        return 0.0
    try:
        return abs(float(row.get(col) or 0))
    except (TypeError, ValueError):
        return 0.0


def _gold_kpi(lookup, col, opening, missing):
    parts = {k: _metric(lookup, c, col, missing) for k, c in GOLD_CODES.items()}
    ns = parts["sales_cash"] + parts["sales_due"] + parts["sales_internal"] - (parts["returns_cash"] + parts["returns_due"])
    np_ = parts["purchase_cash"] + parts["purchase_due"] + parts["purchase_internal"] - (parts["preturns_cash"] + parts["preturns_due"])
    cur = ns - np_
    return {**parts, "net_sales": ns, "net_purchase": np_, "current": cur, "opening": opening, "net_profit": cur - opening}


def kpi(co, branches, from_date, to_date, open_grams=0.0, open_cash=0.0, open_silver=0.0) -> dict:
    rows = account_rows(co, branches, from_date, to_date)
    lookup = {str(r.get("account_code")): r for r in rows}
    missing: set = set()
    silver_sales = _metric(lookup, SILVER_CODES["sales"], "silver", missing)
    silver_purchase = _metric(lookup, SILVER_CODES["purchase"], "silver", missing)
    cur_s = silver_sales - silver_purchase
    return {
        "gold_grams": _gold_kpi(lookup, "all_in_24", open_grams, missing),
        "gold_cash": _gold_kpi(lookup, "amount", open_cash, missing),
        "silver": {"sales": silver_sales, "purchase": silver_purchase, "current": cur_s,
                   "opening": open_silver, "net_profit": cur_s - open_silver},
        "missing_codes": sorted(missing),
        "params": {"from_date": from_date, "to_date": to_date, "branches": branches},
        "mock": co["mock"],
        "company": co["key"],
    }


# ------------------------------------------------------------------ mock data (sirf test / demo)
def _r(code, name, amount, silver, all_in_24):
    return {"account_code": code, "account_name": name, "amount": amount, "silver": silver, "all_in_24": all_in_24}


MOCK_ACCOUNT_ROWS = [
    _r("311110001", "Gold Cash Sales", -9905778.69, 0.0, 16423.865),
    _r("311110002", "Cash Sales Returns", 58647.82, -1000.0, -68.17),
    _r("311110006", "silver Sales", -51614300.02, 3775000.02, 0.0),
    _r("311120001", "Credit sales", -68568404.65, 0.0, 116020.74),
    _r("311120002", "Credit Sales Return", 342125.70, -15000.0, -218.70),
    _r("321110001", "Gold Cash Purchases", 4445955.02, 0.0, -7751.17625),
    _r("321110003", "Silver Purchases", 40110905.03, -3218000.02, 0.0),
    _r("321120001", "gold Credit Purchases", 66614118.17, 0.0, -112836.5),
    _r("321120002", "Credit Purchases Retrun", -14029.40, 0.0, 0.0),
]

_CORES = ["بداية العبور", "النقيب الرائدة", "الركن الثمين", "بصمة الذهب الحديث", "جولد برايس الذهبية", "الذهب الصافي",
          "فور ناين", "كنوز الوادي", "سما الذهب", "الألماس العالمي", "عالم بن شيهون", "روزميت", "نجد للسبائك", "وردة الصحراء",
          "الفارس", "جواهر الصحراء", "البحر الأحمر", "تاج القيراط", "الصقر", "الواحة", "خليج اللؤلؤ", "الأفق الذهبي",
          "دار الرياض", "نخبة الجوهرة", "لؤلؤة الشرق", "برج الذهب", "الأصالة", "الدانة", "ريم العرب", "نور الماس",
          "السلطان للمجوهرات", "الحرمين", "قصر الذهب", "الخليج الذهبي", "المها", "ضياء الجوهرة", "الياقوت", "الزمرد", "الفجر", "مرجان"]
_KINDS = ["شركة {} للذهب والمجوهرات", "شركة {} التجارية", "مؤسسة {} التجارية", "شركة {} المحدودة", "مصنع {} للتصنيع", "شركة {} للتجارة"]
_BRACKETS = ["( معرض سواج جولد )", "(purest gold)", "( الفرع الرئيسي )", "", "", "", "(الركن اليافعي)", "رقم 2", "شركة شخص واحد", ""]


def _fake_name(i: int, shift: int = 0) -> str:
    i = i + shift * 7
    core = _CORES[(i - 1) % len(_CORES)]
    name = _KINDS[(i * 7) % len(_KINDS)].format(core)
    br = _BRACKETS[(i * 3) % len(_BRACKETS)]
    return f"{name} {br}".strip()


def mock_customers(to_date=None, idx: int = 0) -> list:
    """Deterministic demo data (asli customers nahi). Purani to_date => chhote cumulative amounts."""
    rnd = random.Random(42 + idx)
    back = max((config.today() - to_date).days, 0) if to_date else 0
    f_hist = max(1 - back * 0.004, 0.2)
    out = []
    for i in range(1, 41):
        nm = _fake_name(i, idx)
        active = rnd.random() < 0.7
        cash = round(rnd.uniform(-150_000, 2_800_000), 2) if active else 0.0
        gold = round(rnd.uniform(-1200, 4500), 4) if active else 0.0
        silver = float(round(rnd.uniform(-20_000, 120_000), -3)) if active and rnd.random() < 0.4 else 0.0

        def split(bal):
            base = abs(bal) * rnd.uniform(1.2, 3.0)
            return round(base + max(bal, 0), 4), round(base + max(-bal, 0), 4)

        cd, cc = split(cash); gd, gc = split(gold); sd, sc = split(silver)
        cd, cc, gd, gc, sd, sc = (round(v * f_hist, 4) for v in (cd, cc, gd, gc, sd, sc))
        out.append({
            "id": 1000 + i, "customer_code": f"1121{i:04d}", "customer_name": nm,
            "customer_name_ar": nm, "account_id": 500 + i,
            "cash_debit": cd, "cash_credit": cc, "cash_balance": round(cd - cc, 4),
            "gold_debit": gd, "gold_credit": gc, "gold_balance": round(gd - gc, 4),
            "silver_debit": sd, "silver_credit": sc, "silver_balance": round(sd - sc, 4),
        })
    return out


# ------------------------------------------------------------------ statement
# GERP statement (PDF) ke columns: SAR, 24/22/21/18 carat, silver. `summary-of-all-accounts` (customers) har account ke liye
# opening + period{debit,credit,net} carat-wise deta hai. Line-by-line entries (invoice/receipt) API mein nahi hain.
STATEMENT_ROWS = [("sar", "amount"), ("c24", "carat_24"), ("c22", "carat_22"), ("c21", "carat_21"), ("c18", "carat_18"),
                  ("gold24", "all_in_24"), ("silver", "silver")]


def _f(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def customer_account_row(co: dict, code: str, from_date: date, to_date: date) -> Optional[dict]:
    """summary-of-all-accounts ki us customer ki row (opening/period ke saath) ya None."""
    if co["mock"]:
        return _mock_account_row(co, code, from_date, to_date)
    payload = {
        "branches": co["branches"], "from_date": from_date.isoformat(), "to_date": to_date.isoformat(),
        "account_types": ["customers"], "price_of_gold": 0, "price_of_silver": 0,
        "convert": co["convert"], "currency": co["currency"], "rate_type": "gram", "show_data_with_zero": "yes",
    }
    rows = _post(co, "/summary-of-all-accounts", payload)["data"]["all_data"]
    return next((r for r in rows if str(r.get("account_code")) == str(code)), None)


def _row_to_lines(row: Optional[dict]) -> list:
    out = []
    for key, col in STATEMENT_ROWS:
        opening = _f((row or {}).get("opening", {}).get(col))
        p = (row or {}).get("period", {}).get(col) or {}
        if isinstance(p, dict):
            debit, credit = _f(p.get("debit")), _f(p.get("credit"))
            net = _f(p.get("net")) if p.get("net") is not None else debit - credit
        else:
            debit = credit = 0.0
            net = _f(p)
        out.append({"key": key, "opening": round(opening, 4), "debit": round(debit, 4), "credit": round(credit, 4),
                    "closing": round(opening + net, 4)})
    return out


def customer_statement(co: dict, code: str, name: str, name_ar: str, from_date: date, to_date: date) -> dict:
    """Period statement: opening -> period debit/credit -> closing (SAR + carat-wise gold + silver)."""
    row = customer_account_row(co, code, from_date, to_date)
    lines = _row_to_lines(row)
    by = {l["key"]: l for l in lines}
    out = {
        "customer": {"code": code, "name": name, "name_ar": name_ar},
        "from_date": from_date.isoformat(), "to_date": to_date.isoformat(),
        "rows": lines,
        "metals": {"cash": {k: by["sar"][k] for k in ("opening", "debit", "credit", "closing")},
                   "gold": {k: by["gold24"][k] for k in ("opening", "debit", "credit", "closing")},
                   "silver": {k: by["silver"][k] for k in ("opening", "debit", "credit", "closing")}},
        "found": row is not None,
    }
    # GERP ke customer-balances (to_date) se closing match check
    try:
        cb = next((r for r in customer_balances(co, to_date) if str(r.get("customer_code")) == str(code)), None)
        if cb is not None:
            diff = {"cash": abs(out["metals"]["cash"]["closing"] - _f(cb.get("cash_balance"))),
                    "gold": abs(out["metals"]["gold"]["closing"] - _f(cb.get("gold_balance"))),
                    "silver": abs(out["metals"]["silver"]["closing"] - _f(cb.get("silver_balance")))}
            out["reconciled"] = diff["cash"] < 1 and diff["gold"] < 0.01 and diff["silver"] < 1
    except Exception:  # noqa: BLE001 - check optional hai
        pass
    return out


def _mock_account_row(co: dict, code: str, from_date: date, to_date: date) -> Optional[dict]:
    """Demo: cumulative balances ke difference se opening/period, gold ko carats mein baanta (24K-equivalent sahi rehta hai)."""
    from datetime import timedelta
    close = next((r for r in mock_customers(to_date, co["index"]) if str(r["customer_code"]) == str(code)), None)
    if close is None:
        return None
    open_ = next((r for r in mock_customers(from_date - timedelta(days=1), co["index"]) if str(r["customer_code"]) == str(code)), {})
    split = {"carat_24": 0.30, "carat_22": 0.0, "carat_21": 0.40, "carat_18": 0.30}
    factor = {"carat_24": 1.0, "carat_22": 24 / 22, "carat_21": 24 / 21, "carat_18": 24 / 18}  # 24K-eq -> carat grams

    def per(metal, close_k, open_k):
        d = _f(close.get(f"{metal}_{close_k}")) - _f(open_.get(f"{metal}_{open_k}"))
        return d

    opening, period = {}, {}
    for col, metal in (("amount", "cash"), ("silver", "silver")):
        ob = _f(open_.get(f"{metal}_debit")) - _f(open_.get(f"{metal}_credit"))
        deb, cre = per(metal, "debit", "debit"), per(metal, "credit", "credit")
        opening[col] = ob
        period[col] = {"debit": deb, "credit": cre, "net": deb - cre}
    g_ob = _f(open_.get("gold_debit")) - _f(open_.get("gold_credit"))
    g_deb, g_cre = per("gold", "debit", "debit"), per("gold", "credit", "credit")
    opening["all_in_24"] = g_ob
    period["all_in_24"] = {"debit": g_deb, "credit": g_cre, "net": g_deb - g_cre}
    for col, share in split.items():
        k = share * factor[col]
        opening[col] = g_ob * k
        period[col] = {"debit": g_deb * k, "credit": g_cre * k, "net": (g_deb - g_cre) * k}
    return {"account_code": code, "opening": opening, "period": period}


# ------------------------------------------------------------------ ledger (line-by-line)
# Format GERP web `statement-of-accounts` response se liya gaya:
# {"status":"ok","data":{"data":[{date, voucher_no, note_type_name(_ar), remark_english, debit, credit, balance,
#   debit_18.., credit_18.., balance_18.. (21/22/24/silver/platinum/palladium)}], "debit_total", "credit_total", "balance_total",
#   "debit_total24".., "cash_balance": "5,655,108.82", "gold_balance": "-13,000.00", ...}}
METAL_KEYS = ("18", "21", "22", "24", "silver", "platinum", "palladium")
_TOTAL_SUFFIX = {"18": "18", "21": "21", "22": "22", "24": "24", "silver": "Silver", "platinum": "Platinum", "palladium": "Palladium"}


def _money(v) -> float:
    if isinstance(v, str):
        v = v.replace(",", "").strip()
    return _f(v)


def normalize_ledger(raw: dict) -> dict:
    d = raw.get("data") if isinstance(raw, dict) else None
    body = d if isinstance(d, dict) else {"data": d or []}
    lines = []
    for r in body.get("data") or []:
        lines.append({
            "index": r.get("index"), "date": r.get("date"), "voucher_no": r.get("voucher_no") or "",
            "type": r.get("note_type_name") or "", "type_ar": (r.get("note_type_name_ar") or "").strip(),
            "type_id": r.get("note_type_id"),
            "remarks": (r.get("remark_english") or r.get("remark") or "").strip(),
            "debit": _f(r.get("debit")), "credit": _f(r.get("credit")), "balance": _f(r.get("balance")),
            "metals": {k: {"debit": _f(r.get(f"debit_{k}")), "credit": _f(r.get(f"credit_{k}")), "balance": _f(r.get(f"balance_{k}"))}
                       for k in METAL_KEYS},
        })
    totals = {"cash": {
        "debit": _f(body["debit_total"]) if "debit_total" in body else round(sum(l["debit"] for l in lines), 4),
        "credit": _f(body["credit_total"]) if "credit_total" in body else round(sum(l["credit"] for l in lines), 4),
        "balance": _f(body["balance_total"]) if "balance_total" in body else (lines[-1]["balance"] if lines else 0.0)}}
    for k in METAL_KEYS:
        s = _TOTAL_SUFFIX[k]
        totals[k] = {
            "debit": _f(body[f"debit_total{s}"]) if f"debit_total{s}" in body else round(sum(l["metals"][k]["debit"] for l in lines), 4),
            "credit": _f(body[f"credit_total{s}"]) if f"credit_total{s}" in body else round(sum(l["metals"][k]["credit"] for l in lines), 4),
            "balance": _f(body[f"balance_total{s}"]) if f"balance_total{s}" in body else (lines[-1]["metals"][k]["balance"] if lines else 0.0)}
    active = [k for k in METAL_KEYS if any(abs(totals[k][x]) > 1e-9 for x in ("debit", "credit", "balance"))
              or any(abs(l["metals"][k][x]) > 1e-9 for l in lines for x in ("debit", "credit"))]
    seen, types = set(), []
    for l in lines:
        if l["type"] and l["type"] not in seen:
            seen.add(l["type"]); types.append({"name": l["type"], "name_ar": l["type_ar"]})
    closing = {"cash": _money(body["cash_balance"]) if "cash_balance" in body else totals["cash"]["balance"],
               "gold": _money(body["gold_balance"]) if "gold_balance" in body else totals["24"]["balance"],
               "silver": _money(body["silver_balance"]) if "silver_balance" in body else totals["silver"]["balance"]}
    return {"lines": lines, "totals": totals, "active_metals": active, "types": types, "closing": closing}


def customer_ledger(co: dict, code: str, from_date: date, to_date: date) -> dict:
    if co["mock"]:
        raw = _mock_ledger(co, code, from_date, to_date)
    else:
        path = co.get("ledger_path") or "/account-statement"
        payload = {"branches": co["branches"], "account_code": str(code), "from_date": from_date.isoformat(),
                   "to_date": to_date.isoformat(), "currency": co["currency"], "convert": co["convert"], "with_opening": True}
        tok = _get_token(co)
        r = requests.post(f"{co['base']}{path}", json=payload, timeout=120,
                          headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        if r.status_code == 401:
            r = requests.post(f"{co['base']}{path}", json=payload, timeout=120,
                              headers={"Authorization": f"Bearer {_get_token(co, force=True)}", "Content-Type": "application/json"})
        if r.status_code in (404, 405):
            raise HTTPException(501, "Ledger endpoint GERP API mein abhi available nahi hai (GERP developer se maango)")
        if not r.ok:
            raise HTTPException(502, f"{co['name']}: GERP ledger error {r.status_code}: {r.text[:200]}")
        raw = r.json()
        if raw.get("status") not in (None, "ok"):
            raise HTTPException(400, f"{co['name']}: GERP: {str(raw)[:200]}")
    return normalize_ledger(raw)


def _mock_ledger(co: dict, code: str, from_date: date, to_date: date) -> dict:
    """Demo ledger: customer ke closing balance par khatam hone wali synthetic lines (asli data nahi)."""
    from datetime import timedelta
    close = next((r for r in mock_customers(to_date, co["index"]) if str(r["customer_code"]) == str(code)), None)
    if close is None:
        return {"data": {"data": []}}
    rnd = random.Random(int(str(code)[-6:] or 1) + co["index"] * 7)
    span = max((to_date - from_date).days, 1)
    kinds = [("CREDIT SALES", "مبيعات آجلة", "d"), ("CASH RECEIPT", "سند قبض", "c"), ("METAL PAYMENTS", "صرف معادن", "dm"),
             ("METAL RECEIPTS", "قبض المعادن", "cm"), ("JV ENTRY", "قيد يومية", "d"), ("CASH PAYMENT", "سند صرف", "d")]
    target_cash = _f(close["cash_debit"]) - _f(close["cash_credit"])
    target_gold = _f(close["gold_debit"]) - _f(close["gold_credit"])
    n = 22
    rows, cash_bal, gold_bal = [], 0.0, 0.0
    days = sorted(rnd.randrange(span + 1) for _ in range(n))
    for i, off in enumerate(days, 1):
        name, name_ar, kind = rnd.choice(kinds)
        last = i == n
        debit = credit = g_deb = g_cre = 0.0
        if kind == "d":
            debit = round(rnd.uniform(20_000, 900_000), 2)
        elif kind == "c":
            credit = round(rnd.uniform(20_000, 900_000), 2)
        elif kind == "dm":
            g_deb = round(rnd.uniform(50, 900), 2)
        else:
            g_cre = round(rnd.uniform(50, 900), 2)
        if last:  # closing se match
            need_c = target_cash - cash_bal
            need_g = target_gold - gold_bal
            debit, credit = (round(need_c, 2), 0.0) if need_c >= 0 else (0.0, round(-need_c, 2))
            g_deb, g_cre = (round(need_g, 4), 0.0) if need_g >= 0 else (0.0, round(-need_g, 4))
            name, name_ar = "JV ENTRY", "قيد يومية"
        cash_bal += debit - credit
        gold_bal += g_deb - g_cre
        row = {"index": i, "date": (from_date + timedelta(days=off)).isoformat(), "voucher_no": f"{name.split()[0][:2]}126SJ{rnd.randrange(100000):06d}",
               "note_type_id": 100 + i % 9, "note_type_name": name, "note_type_name_ar": name_ar,
               "remark_english": "demo " + name.lower(), "debit": debit, "credit": credit, "balance": round(cash_bal, 2)}
        for k in METAL_KEYS:
            row.update({f"debit_{k}": 0, f"credit_{k}": 0, f"balance_{k}": 0})
        row.update({"debit_24": g_deb, "credit_24": g_cre, "balance_24": round(gold_bal, 4)})
        rows.append(row)
    return {"status": "ok", "data": {"data": rows, "cash_balance": f"{cash_bal:,.2f}", "gold_balance": f"{gold_bal:,.2f}", "silver_balance": "0.00"}}
