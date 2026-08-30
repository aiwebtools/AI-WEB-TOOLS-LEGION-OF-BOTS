"""Iteration 4 — regression after code-quality refactor (circular import fix,
temp-dir try/finally cleanup, defensive var inits). Non-LLM-budget-dependent checks."""
import base64
import glob
import io
import json
import os
import uuid
import zipfile

import pytest
import requests

from conftest import API, USER  # noqa: F401


# ---------------------------------------------------------------- auth module (database.py extraction)
class TestAuthRegression:
    def test_backend_boots_and_bots_served(self, anon_client):
        r = anon_client.get(f"{API}/bots", timeout=60)
        assert r.status_code == 200, r.text[:300]
        bots = r.json()
        assert len(bots) == 150, len(bots)
        slugs = [b["slug"] for b in bots]
        assert len(set(slugs)) == 150
        assert all(b["status"] == "active" for b in bots)

    def test_login_admin_and_user(self, admin_auth, user_auth):
        assert admin_auth["user"]["role"] == "admin"
        assert admin_auth["user"]["email"] == "admin@legion.ai"
        assert isinstance(admin_auth["token"], str) and len(admin_auth["token"]) > 20
        assert user_auth["user"]["email"] == "testuser@legion.ai"
        assert user_auth["user"].get("role") in (None, "user")

    def test_auth_me_with_bearer(self, user_client, admin_client):
        r = user_client.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["email"] == "testuser@legion.ai"
        assert "password_hash" not in r.json() and "_id" not in r.json()
        ra = admin_client.get(f"{API}/auth/me", timeout=30)
        assert ra.status_code == 200 and ra.json()["role"] == "admin"

    def test_me_without_token_401(self, anon_client):
        assert anon_client.get(f"{API}/auth/me", timeout=30).status_code == 401

    def test_me_invalid_token_401(self, anon_client):
        r = anon_client.get(f"{API}/auth/me", headers={"Authorization": "Bearer bogus.token.here"}, timeout=30)
        assert r.status_code == 401

    def test_wrong_password_rejected(self, anon_client):
        r = anon_client.post(f"{API}/auth/login", json={"email": USER["email"], "password": "wrong-pass"}, timeout=30)
        assert r.status_code in (400, 401), r.status_code

    def test_register_new_user_then_me(self, anon_client):
        email = f"TEST_it4_{uuid.uuid4().hex[:8]}@example.com"
        r = anon_client.post(f"{API}/auth/register",
                             json={"email": email, "password": "It4Pass2026!", "name": "TEST it4"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        tok = r.json()["token"]
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert me.status_code == 200 and me.json()["email"] == email.lower()
        # duplicate register rejected
        dup = anon_client.post(f"{API}/auth/register",
                               json={"email": email, "password": "It4Pass2026!", "name": "TEST it4"}, timeout=30)
        assert dup.status_code in (400, 409), dup.status_code

    @pytest.mark.parametrize("path", ["/admin/overview", "/admin/bots", "/admin/import"])
    def test_non_admin_403(self, user_client, path):
        r = user_client.get(f"{API}{path}", timeout=30)
        assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_admin_routes_work_for_admin(self, admin_client):
        ov = admin_client.get(f"{API}/admin/overview", timeout=60)
        assert ov.status_code == 200, ov.text[:300]
        d = ov.json()
        assert d.get("active_bots") == 150, d
        bl = admin_client.get(f"{API}/admin/bots", timeout=60)
        assert bl.status_code == 200 and len(bl.json()) >= 200
        assert all("_id" not in b for b in bl.json())
        ih = admin_client.get(f"{API}/admin/import", timeout=60)
        assert ih.status_code == 200 and isinstance(ih.json(), list)


# ---------------------------------------------------------------- core flows
class TestCoreFlows:
    def test_suites_sum_to_150(self, anon_client):
        r = anon_client.get(f"{API}/suites", timeout=60)
        assert r.status_code == 200
        suites = r.json()
        assert sum(s["bot_count"] for s in suites) == 150, [(s["label"], s["bot_count"]) for s in suites]

    def test_suite_filter_and_search(self, anon_client):
        suites = anon_client.get(f"{API}/suites", timeout=60).json()
        s = suites[0]
        r = anon_client.get(f"{API}/bots", params={"suite": s["slug"]}, timeout=60)
        assert r.status_code == 200 and len(r.json()) == s["bot_count"]
        sr = anon_client.get(f"{API}/bots", params={"q": "time"}, timeout=60)
        assert sr.status_code == 200 and len(sr.json()) > 0
        assert all("time" in json.dumps(b).lower() for b in sr.json())

    def test_bot_detail_and_404(self, anon_client):
        slug = anon_client.get(f"{API}/bots", timeout=60).json()[0]["slug"]
        r = anon_client.get(f"{API}/bots/{slug}", timeout=30)
        assert r.status_code == 200 and r.json()["slug"] == slug
        assert 1 <= len(r.json().get("suggested_prompts") or []) <= 8
        assert anon_client.get(f"{API}/bots/no-such-bot-xyz", timeout=30).status_code == 404

    def test_dashboard(self, user_client):
        r = user_client.get(f"{API}/dashboard", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("conversations", "favorite_bots", "recent_bots", "suites", "featured_bots", "stats"):
            assert k in d, list(d.keys())
        assert d["stats"]["total_bots"] == 150, d["stats"]

    def test_favorites_add_remove(self, user_client, anon_client):
        slug = anon_client.get(f"{API}/bots", timeout=60).json()[3]["slug"]
        bot = anon_client.get(f"{API}/bots/{slug}", timeout=30).json()
        add = user_client.post(f"{API}/favorites/{bot['id']}", timeout=30)
        assert add.status_code == 200, add.text[:300]
        favs = user_client.get(f"{API}/favorites", timeout=30).json()
        assert any(f["id"] == bot["id"] for f in favs)
        rem = user_client.delete(f"{API}/favorites/{bot['id']}", timeout=30)
        assert rem.status_code == 200
        favs2 = user_client.get(f"{API}/favorites", timeout=30).json()
        assert not any(f["id"] == bot["id"] for f in favs2)

    def test_recent(self, user_client):
        r = user_client.get(f"{API}/recent", timeout=30)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_memory_add_remove_toggle(self, user_client):
        m = user_client.post(f"{API}/memory", json={"content": "TEST_it4 remembers python"}, timeout=30)
        assert m.status_code == 200, m.text[:300]
        mid = m.json()["id"]
        lst = user_client.get(f"{API}/memory", timeout=30).json()
        assert any(x["id"] == mid for x in lst["memories"]), lst
        t = user_client.patch(f"{API}/profile", json={"memory_enabled": False}, timeout=30)
        assert t.status_code == 200 and t.json()["memory_enabled"] is False
        assert user_client.get(f"{API}/memory", timeout=30).json()["enabled"] is False
        t2 = user_client.patch(f"{API}/profile", json={"memory_enabled": True}, timeout=30)
        assert t2.status_code == 200 and t2.json()["memory_enabled"] is True
        d = user_client.delete(f"{API}/memory/{mid}", timeout=30)
        assert d.status_code == 200
        after = user_client.get(f"{API}/memory", timeout=30).json()
        assert not any(x["id"] == mid for x in after["memories"])


# ---------------------------------------------------------------- python tool
class TestPythonTool:
    def test_python_tool_42(self, user_client):
        r = user_client.post(f"{API}/tools/python", json={"code": "print(6*7)"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("success") is True, d
        assert "42" in d.get("stdout", "") + d.get("output", "")


# ---------------------------------------------------------------- conversations
class TestConversations:
    def test_list_rename_delete_existing(self, user_client):
        lst = user_client.get(f"{API}/conversations", timeout=30)
        assert lst.status_code == 200, lst.text[:300]
        convs = lst.json()
        assert all("_id" not in c for c in convs)
        if not convs:
            pytest.skip("no existing conversations (chat creation blocked by LLM budget)")
        cid = convs[0]["id"]
        ren = user_client.patch(f"{API}/conversations/{cid}", json={"title": "TEST_it4 renamed"}, timeout=30)
        assert ren.status_code == 200, ren.text[:300]
        got = user_client.get(f"{API}/conversations/{cid}", timeout=30)
        assert got.status_code == 200
        body = got.json()
        title = body["conversation"]["title"] if "conversation" in body else body["title"]
        assert title == "TEST_it4 renamed", body
        dl = user_client.delete(f"{API}/conversations/{cid}", timeout=30)
        assert dl.status_code == 200
        assert user_client.get(f"{API}/conversations/{cid}", timeout=30).status_code == 404

    def test_other_user_cannot_read_conversation(self, user_client, admin_client):
        convs = admin_client.get(f"{API}/conversations", timeout=30).json()
        if not convs:
            pytest.skip("admin has no conversations")
        r = user_client.get(f"{API}/conversations/{convs[0]['id']}", timeout=30)
        assert r.status_code == 404, r.status_code


# ---------------------------------------------------------------- temp dir cleanup (try/finally)
def _sse_events(token, payload, timeout=120):
    evs = []
    with requests.post(f"{API}/chat/stream", json=payload,
                       headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                       stream=True, timeout=timeout) as r:
        assert r.status_code == 200, r.text[:300]
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                evs.append(json.loads(line[6:]))
    return evs


class TestTempDirCleanup:
    def test_chat_with_csv_attachment_cleans_tmp(self, user_auth, anon_client):
        bots = anon_client.get(f"{API}/bots", timeout=60).json()
        target = None
        for b in bots:
            det = anon_client.get(f"{API}/bots/{b['slug']}", timeout=30).json()
            if det.get("capabilities", {}).get("files"):
                target = det
                break
        assert target, "no files-capable bot found"
        csv = base64.b64encode(b"name,score\nalice,10\nbob,20\n").decode()
        before = set(glob.glob("/tmp/legion_up_*"))
        evs = _sse_events(user_auth["token"], {
            "bot_slug": target["slug"],
            "message": "In under 12 words, list the columns in the attached CSV.",
            "files": [{"name": "TEST_it4.csv", "mime": "text/csv", "data": csv}],
        })
        after = set(glob.glob("/tmp/legion_up_*"))
        assert after <= before, f"leaked temp dirs: {after - before}"
        assert any(e["type"] == "start" for e in evs), evs[:2]
        errs = [e for e in evs if e["type"] == "error"]
        if errs:
            pytest.fail(f"LLM error during attachment chat: {errs[0]['content'][:200]}")
        text = "".join(e.get("content", "") for e in evs if e["type"] == "delta")
        assert "score" in text.lower() or "name" in text.lower(), text[:300]

    def test_chat_without_attachment(self, user_auth, anon_client):
        slug = anon_client.get(f"{API}/bots", timeout=60).json()[0]["slug"]
        evs = _sse_events(user_auth["token"], {"bot_slug": slug, "message": "Reply with just: PONG"})
        errs = [e for e in evs if e["type"] == "error"]
        if errs:
            pytest.fail(f"LLM error: {errs[0]['content'][:200]}")
        text = "".join(e.get("content", "") for e in evs if e["type"] == "delta")
        assert text.strip(), evs
        assert any(e["type"] == "done" for e in evs)


# ---------------------------------------------------------------- import manager
def _zip_bytes(docs):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, text in docs.items():
            z.writestr(name, text)
    return buf.getvalue()


class TestImportManager:
    def test_preview_publish_duplicate_and_history(self, admin_client, admin_auth):
        tag = uuid.uuid4().hex[:6].upper()
        docs = {
            f"TEST_it4_alpha_{tag}.txt": f"You are TEST IT4 Alpha {tag}, an expert QA regression assistant. " + (f"Alpha {tag} unique body. " * 40),
            f"TEST_it4_beta_{tag}.txt": f"You are TEST IT4 Beta {tag}, an expert QA regression reviewer. " + (f"Beta {tag} unique body. " * 40),
        }
        z = _zip_bytes(docs)
        hdr = {"Authorization": f"Bearer {admin_auth['token']}"}
        r = requests.post(f"{API}/admin/import", headers=hdr,
                          files={"file": ("TEST_it4.zip", z, "application/zip")}, timeout=180)
        assert r.status_code == 200, r.text[:400]
        prev = r.json()
        job_id = prev["job_id"]
        assert prev["new_count"] >= 1, prev
        assert isinstance(prev["detected_bots"], list) and len(prev["detected_bots"]) >= 1

        pub = requests.post(f"{API}/admin/import/{job_id}/publish", headers=hdr, timeout=180)
        assert pub.status_code == 200, pub.text[:400]
        added = pub.json()["added"]
        assert added >= 1, pub.json()

        # active count unchanged
        ov = admin_client.get(f"{API}/admin/overview", timeout=60).json()
        assert ov["active_bots"] == 150, ov

        # duplicate re-import detected
        r2 = requests.post(f"{API}/admin/import", headers=hdr,
                           files={"file": ("TEST_it4.zip", z, "application/zip")}, timeout=180)
        assert r2.status_code == 200, r2.text[:400]
        assert r2.json()["duplicate_count"] >= 1, r2.json()
        job2 = r2.json()["job_id"]
        pub2 = requests.post(f"{API}/admin/import/{job2}/publish", headers=hdr, timeout=180)
        assert pub2.status_code == 200 and pub2.json()["added"] == 0, pub2.json()

        hist = admin_client.get(f"{API}/admin/import", timeout=60)
        assert hist.status_code == 200
        ids = [h["id"] for h in hist.json()]
        assert job_id in ids and job2 in ids
        assert all("catalog" not in h and "_id" not in h for h in hist.json())

    def test_import_rejects_non_zip(self, admin_auth):
        hdr = {"Authorization": f"Bearer {admin_auth['token']}"}
        r = requests.post(f"{API}/admin/import", headers=hdr,
                          files={"file": ("TEST_it4.txt", b"not a zip", "text/plain")}, timeout=60)
        assert r.status_code in (400, 415, 422), r.status_code


@pytest.fixture(scope="module", autouse=True)
def cleanup(request):
    yield
    os.environ.setdefault("PYTHONPATH", "/app/backend")
