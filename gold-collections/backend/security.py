import hashlib
import hmac
import secrets
import time
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import config
from db import User, get_db

_ITER = 200_000
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITER)
    return f"pbkdf2${_ITER}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, it, salt, h = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(dk.hex(), h)
    except Exception:
        return False


def create_token(user: User) -> str:
    exp = config.now() + timedelta(hours=config.TOKEN_HOURS)
    return jwt.encode({"sub": str(user.id), "role": user.role, "exp": exp}, config.SECRET_KEY, algorithm="HS256")


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(401, "Login required")
    try:
        payload = jwt.decode(creds.credentials, config.SECRET_KEY, algorithms=["HS256"])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(401, "Session expired, please log in again")
    user = db.get(User, uid)
    if not user or not user.active:
        raise HTTPException(401, "User disabled")
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin only")
    return user


# ---- simple in-memory login throttle ----
_fails: dict = {}
MAX_FAILS, WINDOW = 6, 300


def throttle_check(key: str):
    now = time.time()
    hits = [t for t in _fails.get(key, []) if now - t < WINDOW]
    _fails[key] = hits
    if len(hits) >= MAX_FAILS:
        raise HTTPException(429, "Too many attempts, try again in a few minutes")


def throttle_fail(key: str):
    _fails.setdefault(key, []).append(time.time())


def throttle_clear(key: str):
    _fails.pop(key, None)
