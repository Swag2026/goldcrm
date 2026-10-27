import os
import secrets
from datetime import datetime
from zoneinfo import ZoneInfo


def env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


GERP_BASE = env("GERP_BASE", "https://swag.gerpsystems.com/external").rstrip("/")
GERP_USERNAME = env("GERP_USERNAME")
GERP_PASSWORD = env("GERP_PASSWORD")
GERP_BRANCHES = [int(x) for x in env("GERP_BRANCHES", "1,2").split(",") if x.strip()]
GERP_CONVERT = int(env("GERP_CONVERT", "2"))
GERP_CURRENCY = int(env("GERP_CURRENCY", "1"))
MOCK = env("GERP_MOCK") == "1"

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
