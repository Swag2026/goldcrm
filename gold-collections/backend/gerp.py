"""GERP external API client + Gold/Silver KPI logic (Dashboards KPI PDF)."""
import random
import threading
import time
from datetime import date

import requests
from fastapi import HTTPException

import config

_token = {"value": None, "exp": 0.0}
_lock = threading.Lock()


def _get_token(force: bool = False) -> str:
    with _lock:
        if not force and _token["value"] and time.time() < _token["exp"] - 60:
            return _token["value"]
        if not config.GERP_USERNAME or not config.GERP_PASSWORD:
            raise HTTPException(500, "GERP_USERNAME / GERP_PASSWORD set nahi hain")
        r = requests.post(f"{config.GERP_BASE}/auth/token",
                          json={"username": config.GERP_USERNAME, "password": config.GERP_PASSWORD}, timeout=30)
        if not r.ok:
            raise HTTPException(502, f"GERP auth failed ({r.status_code})")
        j = r.json()
        _token["value"] = j["token"]
        _token["exp"] = time.time() + int(j.get("expires_in", 3600))
        return _token["value"]


def _post(path: str, payload: dict, timeout: int = 180) -> dict:
    r = None
    for attempt in (0, 1):
        tok = _get_token(force=attempt == 1)
        r = requests.post(f"{config.GERP_BASE}{path}", json=payload, timeout=timeout,
                          headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        if r.status_code == 401 and attempt == 0:
            continue
        break
    if not r.ok:
        raise HTTPException(502, f"GERP error {r.status_code}: {r.text[:200]}")
    j = r.json()
    if j.get("status") != "ok":
        raise HTTPException(400, f"GERP: {j}")
    return j


# ------------------------------------------------------------------ customers
def customer_balances(branches: list, to_date: date) -> list:
    if config.MOCK:
        return mock_customers()
    return _post("/customer-balances", {"branches": branches, "to_date": to_date.isoformat()})["data"]


# ------------------------------------------------------------------ KPI
GOLD_CODES = {
    "sales_cash": "311110001", "sales_due": "311120001", "sales_internal": "331110001",
    "returns_cash": "311110002", "returns_due": "311120002",
    "purchase_cash": "321110001", "purchase_due": "321120001", "purchase_internal": "331110002",
    "preturns_cash": "321110002", "preturns_due": "321120002",
}
SILVER_CODES = {"sales": "311110006", "purchase": "321110003"}


def account_rows(branches: list, from_date: str, to_date: str) -> list:
    if config.MOCK:
        return MOCK_ACCOUNT_ROWS
    payload = {
        "branches": branches, "from_date": from_date, "to_date": to_date,
        "account_types": ["general"], "price_of_gold": 0, "price_of_silver": 0,
        "convert": config.GERP_CONVERT, "currency": config.GERP_CURRENCY,
        "rate_type": "gram", "show_data_with_zero": "yes",
    }
    return _post("/summary-of-all-accounts", payload)["data"]["all_data"]


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


def kpi(branches, from_date, to_date, open_grams=0.0, open_cash=0.0, open_silver=0.0) -> dict:
    rows = account_rows(branches, from_date, to_date)
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
        "mock": config.MOCK,
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

_FAKE = [
    ("Al Noor Jewellery", "مجوهرات النور"), ("Golden Horizon Trading", "شركة الأفق الذهبي التجارية"),
    ("Riyadh Gold House", "دار الرياض للذهب"), ("Pearl Bay Co.", "شركة خليج اللؤلؤ"),
    ("Najd Bullion", "سبائك نجد"), ("Desert Rose Gold", "ذهب وردة الصحراء"),
    ("Al Faris Gems", "الفارس للأحجار الكريمة"), ("Sahara Jewels", "جواهر الصحراء"),
    ("Red Sea Gold", "ذهب البحر الأحمر"), ("Crown Karat Est.", "مؤسسة تاج القيراط"),
    ("Falcon Gold Trading", "الصقر للتجارة بالذهب"), ("Oasis Jewellers", "مجوهرات الواحة"),
]


def mock_customers() -> list:
    """Deterministic demo data (asli customers nahi)."""
    rnd = random.Random(42)
    out = []
    for i in range(1, 41):
        en, ar = _FAKE[(i - 1) % len(_FAKE)]
        tag = f" {i:02d}"
        active = rnd.random() < 0.7
        cash = round(rnd.uniform(-150_000, 2_800_000), 2) if active else 0.0
        gold = round(rnd.uniform(-1200, 4500), 4) if active else 0.0
        silver = float(round(rnd.uniform(-20_000, 120_000), -3)) if active and rnd.random() < 0.4 else 0.0

        def split(bal):
            base = abs(bal) * rnd.uniform(1.2, 3.0)
            return round(base + max(bal, 0), 4), round(base + max(-bal, 0), 4)

        cd, cc = split(cash); gd, gc = split(gold); sd, sc = split(silver)
        out.append({
            "id": 1000 + i, "customer_code": f"1121{i:04d}", "customer_name": en + tag,
            "customer_name_ar": ar + tag, "account_id": 500 + i,
            "cash_debit": cd, "cash_credit": cc, "cash_balance": round(cd - cc, 4),
            "gold_debit": gd, "gold_credit": gc, "gold_balance": round(gd - gc, 4),
            "silver_debit": sd, "silver_credit": sc, "silver_balance": round(sd - sc, 4),
        })
    return out
