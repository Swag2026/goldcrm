import os
import secrets
from datetime import datetime
from zoneinfo import ZoneInfo


def env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


import json

MOCK = env("GERP_MOCK") == "1"
GERP_CONVERT = int(env("GERP_CONVERT", "2"))
GERP_CURRENCY = int(env("GERP_CURRENCY", "1"))


def _load_companies() -> list:
    """Companies (alag GERP databases). JSON env GERP_COMPANIES:
    [{"key":"swag","name":"SWAG","base":"https://swag.gerpsystems.com/external","username":"external","password":"...","branches":[1,2]},
     {"key":"laroche","name":"LAROUCHE","base":"https://laroche.gerpsystems.com/external","username":"external","password":"...","branches":[1]}]
    Order BADLO MAT (naye sirf end mein jodo): customer id offset = index * 1_000_000 (ya explicit "offset")."""
    raw = env("GERP_COMPANIES").strip()
    if raw:
        items = json.loads(raw)
    elif MOCK:
        items = [{"key": "swag", "name": "SWAG", "branches": [1, 2]}, {"key": "laroche", "name": "LAROUCHE", "branches": [1]}]
    else:  # purana single-company setup (backward compatible)
        items = [{"key": "swag", "name": "SWAG", "base": env("GERP_BASE", "https://swag.gerpsystems.com/external"),
                  "username": env("GERP_USERNAME"), "password": env("GERP_PASSWORD"),
                  "branches": [int(x) for x in env("GERP_BRANCHES", "1,2").split(",") if x.strip()]}]
    out = []
    for i, it in enumerate(items):
        key = str(it["key"]).strip().lower()
        if any(c["key"] == key for c in out):
            raise ValueError(f"duplicate company key: {key}")
        out.append({
            "key": key, "name": it.get("name") or key.upper(), "index": i,
            "offset": int(it.get("offset", i * 1_000_000)),
            "base": str(it.get("base", "")).rstrip("/"),
            "username": it.get("username", ""), "password": it.get("password", ""),
            "branches": [int(x) for x in it.get("branches", [1])],
            "convert": int(it.get("convert", GERP_CONVERT)), "currency": int(it.get("currency", GERP_CURRENCY)),
            "mock": MOCK,
        })
    return out


COMPANIES = _load_companies()
DEFAULT_COMPANY = COMPANIES[0]["key"]


def company(key=None):
    key = (key or DEFAULT_COMPANY).strip().lower()
    return next((c for c in COMPANIES if c["key"] == key), None)


SYNC_TTL_SECONDS = int(env("SYNC_TTL_SECONDS", "600"))

DATABASE_URL = env("DATABASE_URL", "sqlite:///./gold.db")
# SQLAlchemy 2.1+ "postgresql://" ko psycopg3 maanta hai; hum psycopg2 install karte hain, isliye driver explicit
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

SECRET_KEY = env("SECRET_KEY") or secrets.token_urlsafe(48)  # random => tokens reset on restart
SECRET_KEY_IS_RANDOM = not env("SECRET_KEY")
TOKEN_HOURS = int(env("TOKEN_HOURS", "12"))

ADMIN_USERNAME = env("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = env("ADMIN_PASSWORD")  # khali => random password log mein print hota hai

CORS_ORIGINS = [o.strip() for o in env("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
TIMEZONE = ZoneInfo(env("APP_TZ", "Asia/Riyadh"))

# Balance tolerances (isse chhota = zero maana jata hai)
EPS = {"cash": 0.5, "gold": 0.001, "silver": 0.5}


def now() -> datetime:
    return datetime.now(TIMEZONE).replace(tzinfo=None)


def today():
    return now().date()
