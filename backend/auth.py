"""Authentication: bcrypt hashing, JWT, current-user dependency, Google exchange."""
import os
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"
ACCESS_DAYS = 14


def get_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, get_secret(), algorithm=JWT_ALGORITHM)


def _token_from_request(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")


async def get_current_user(request: Request):
    from server import db
    token = _token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token.")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_admin_user(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def optional_user(request: Request):
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def exchange_google_session(session_id: str) -> dict:
    """Emergent-managed Google auth: exchange session_id for profile."""
    url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google authentication failed")
    return r.json()


def new_user_doc(email: str, name: str, password: str = None, role: str = "user", picture: str = None):
    return {
        "id": str(uuid.uuid4()),
        "email": email.lower().strip(),
        "name": name or email.split("@")[0],
        "password_hash": hash_password(password) if password else None,
        "role": role,
        "picture": picture,
        "auth_provider": "google" if password is None else "password",
        "memory_enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
