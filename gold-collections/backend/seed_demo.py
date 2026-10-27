"""Demo data: 14 din ki history, follow-ups, promises, 2 collectors. SIRF mock mode (GERP_MOCK=1) mein chalta hai.

    GERP_MOCK=1 DATABASE_URL=sqlite:///./demo.db ADMIN_PASSWORD=admin12345 python3 seed_demo.py
"""
import random
import sys
from datetime import datetime, timedelta

import config

if not config.MOCK:
    sys.exit("seed_demo.py sirf GERP_MOCK=1 ke saath chalta hai (asli database ko kabhi mat chhuo)")

import services as svc  # noqa: E402
from db import CompanySnapshot, CustomerSnapshot, Followup, SessionLocal, User, init_db  # noqa: E402
from security import hash_password  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402

rnd = random.Random(7)
init_db()
db = SessionLocal()

# --- users
admin = db.scalar(select(User).where(User.username == config.ADMIN_USERNAME))
if admin is None:
    admin = User(username=config.ADMIN_USERNAME, name="Admin", role="admin", password_hash=hash_password(config.ADMIN_PASSWORD or "admin12345"))
    db.add(admin)
collectors = []
for uname, name in (("ali", "Ali Khan"), ("sara", "Sara"), ("omar", "Omar")):
    u = db.scalar(select(User).where(User.username == uname))
    if u is None:
        u = User(username=uname, name=name, role="collector", password_hash=hash_password(f"{uname}-pass-123"))
        db.add(u)
    collectors.append(u)
db.commit()

# --- har company: mock sync + saaf history
svc_cos = [c["key"] for c in config.COMPANIES]
db.execute(delete(Followup))
db.commit()
today = config.today()
DAYS = 14
total_debtors = 0
KINDS = ["call", "whatsapp", "visit", "call", "call"]
NOTES = ["Asked to wait until the shipment clears.", "Phone off, will retry tomorrow.", "Visited the shop, owner not in.",
         "Agreed to settle part of the balance.", "Disputes the last invoice, sending statement.", "Promised transfer this week.",
         "Reminder sent, customer acknowledged.", "Requested a statement of account."]

for ckey in svc_cos:
    svc.sync_customers(db, ckey, force=True)
    customers = svc.company_customers(db, ckey)
    # sync ne aaj ka snapshot bana diya: is company ka saara snapshot saaf karke demo history daalo
    db.execute(delete(CustomerSnapshot).where(CustomerSnapshot.customer_id.in_([c.id for c in customers])))
    db.execute(delete(CompanySnapshot).where(CompanySnapshot.company == ckey))
    db.commit()
    debtors = sorted([c for c in customers if svc.is_debtor(c)], key=lambda c: -c.gold_balance)
    total_debtors += len(debtors)
    for i, c in enumerate(debtors):
        c.assigned_to = None if i % 4 == 3 else collectors[i % 3].id
    for c in debtors[5:7]:
        c.status = "hold"
    if len(debtors) > 3:
        debtors[3].status = "legal"
    db.commit()

    state = {c.id: [c.cash_balance, c.gold_balance, c.silver_balance] for c in customers}
    hist = {}
    for off in range(0, DAYS + 1):
        hist[off] = {cid: tuple(v) for cid, v in state.items()}
        for cid, v in state.items():
            r = rnd.random()
            f = rnd.uniform(1.05, 1.35) if r < 0.22 else rnd.uniform(0.7, 0.95) if r < 0.34 else 1.0
            for i in range(3):
                v[i] = v[i] * f if abs(v[i]) > 1 else v[i]
    for off in range(DAYS, -1, -1):
        day = today - timedelta(days=off)
        tot = {"cash_receivable": 0, "cash_payable": 0, "gold_receivable": 0, "gold_payable": 0,
               "silver_receivable": 0, "silver_payable": 0, "debtors": 0}
        for cid, (cash, gold, silver) in hist[off].items():
            db.add(CustomerSnapshot(customer_id=cid, day=day, cash_balance=cash, gold_balance=gold, silver_balance=silver))
            for m, b in (("cash", cash), ("gold", gold), ("silver", silver)):
                if b > config.EPS[m]:
                    tot[f"{m}_receivable"] += b
                elif b < -config.EPS[m]:
                    tot[f"{m}_payable"] += -b
            if cash > 0.5 or gold > 0.001 or silver > 0.5:
                tot["debtors"] += 1
        db.add(CompanySnapshot(company=ckey, day=day, **tot))
    db.commit()
    for c in debtors[:20]:
        owner = db.get(User, c.assigned_to) if c.assigned_to else admin
        n = rnd.randint(1, 4)
        for k in range(n):
            off = rnd.randint(0, 12)
            created = datetime.combine(today - timedelta(days=off), datetime.min.time()) + timedelta(hours=rnd.randint(8, 17), minutes=rnd.randint(0, 59))
            promised = rnd.random() < 0.35
            pdate = today + timedelta(days=rnd.randint(-6, 6)) if promised else None
            status = None
            if promised:
                status = "pending" if pdate >= today or rnd.random() < 0.4 else rnd.choice(["kept", "broken", "kept"])
            nxt = (today + timedelta(days=rnd.randint(-5, 5))) if (k == n - 1 and rnd.random() < 0.7) else None
            db.add(Followup(
                customer_id=c.id, user_id=owner.id, kind=rnd.choice(KINDS),
                outcome="promised" if promised else rnd.choice(["reached", "no_answer", "refused", "other"]),
                note=rnd.choice(NOTES), next_followup_date=nxt, promise_date=pdate,
                promise_gold=round(rnd.uniform(20, 300), 2) if promised and rnd.random() < 0.6 else None,
                promise_cash=round(rnd.uniform(20_000, 400_000), 0) if promised else None,
                promise_status=status, created_at=created))
    db.commit()
print(f"Demo ready: companies {svc_cos}, {total_debtors} debtors, history {DAYS} din. Logins: admin / ali / sara / omar (ali-pass-123 ...)")
