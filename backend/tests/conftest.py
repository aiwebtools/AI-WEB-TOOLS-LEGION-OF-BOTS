import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@legion.ai", "password": "LegionAdmin2026!"}
USER = {"email": "testuser@legion.ai", "password": "TestUser2026!"}


def _login_or_register(creds, name="Test User"):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code == 200:
        return r.json()
    r2 = requests.post(f"{API}/auth/register", json={**creds, "name": name}, timeout=30)
    if r2.status_code != 200:
        pytest.fail(f"Cannot login/register {creds['email']}: {r.status_code} {r.text[:200]} / {r2.status_code} {r2.text[:200]}")
    return r2.json()


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def user_auth():
    return _login_or_register(USER)


@pytest.fixture(scope="session")
def admin_auth():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed: {r.status_code} {r.text[:300]}")
    return r.json()


@pytest.fixture(scope="session")
def user_client(user_auth):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {user_auth['token']}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_client(admin_auth):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_auth['token']}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
