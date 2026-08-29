"""Iteration 3: verify dedup_v3 fix — unique instructions, clean descriptions,
bot-specific prompts, migration flags, plus fast regressions."""
import json
import hashlib

import pytest
import requests
from dotenv import dotenv_values

from conftest import API


BAD_DESC_MARKERS = [
    "FINAL AWESOME PERFECT INSTRUCTIONS",
    "Original Version (no compiler)",
    "OPERATIONAL INSTRUCTIONS ===",
    "PLATFORM COMPATIBILITY NOTE",
]


@pytest.fixture(scope="module")
def all_bots():
    r = requests.get(f"{API}/bots?limit=1000", timeout=60)
    assert r.status_code == 200
    bots = r.json()
    assert len(bots) == 150, f"expected 150 active bots, got {len(bots)}"
    return bots


# ---------------------------------------------------------------- CRITICAL FIX
class TestDedupV3:
    def test_migration_flags_present(self):
        from pymongo import MongoClient
        env = dotenv_values("/app/backend/.env")
        cl = MongoClient(env["MONGO_URL"])
        try:
            metas = list(cl[env["DB_NAME"]].meta.find({}, {"_id": 0}))
            keys = {m.get("key") for m in metas}
            assert "enrich_v2" in keys, metas
            assert "dedup_v3" in keys, metas
        finally:
            cl.close()

    def test_active_150_total_210(self, admin_client):
        r = admin_client.get(f"{API}/admin/bots?limit=1000", timeout=90)
        assert r.status_code == 200
        bots = r.json()
        active = [b for b in bots if b["status"] == "active"]
        assert len(active) == 150, f"active={len(active)}"
        assert len(bots) == 210, f"total={len(bots)}"

    def test_all_active_instructions_unique(self, admin_client, all_bots):
        hashes, dupes, short = {}, [], []
        for b in all_bots:
            r = admin_client.get(f"{API}/admin/bots/{b['id']}", timeout=30)
            assert r.status_code == 200, f"{b['slug']} -> {r.status_code}"
            si = (r.json().get("system_instructions") or "").strip()
            if len(si) < 50:
                short.append((b["slug"], len(si)))
                continue
            h = hashlib.sha256(si.encode()).hexdigest()
            if h in hashes:
                dupes.append((b["slug"], hashes[h]))
            else:
                hashes[h] = b["slug"]
        assert not short, short[:10]
        assert not dupes, f"duplicate instruction bots: {dupes[:10]}"
        assert len(hashes) == 150

    def test_suite_counts_sum_to_150(self):
        r = requests.get(f"{API}/suites", timeout=30)
        assert r.status_code == 200
        suites = r.json()
        assert sum(s["bot_count"] for s in suites) == 150, [(s["slug"], s["bot_count"]) for s in suites]
        for s in suites:
            listed = requests.get(f"{API}/bots?suite={s['slug']}&limit=1000", timeout=60).json()
            assert len(listed) == s["bot_count"], (s["slug"], len(listed), s["bot_count"])


# ---------------------------------------------------------------- MINOR FIX 1
class TestDescriptionsClean:
    def test_no_doc_headers_in_any_description(self, all_bots):
        bad = []
        for b in all_bots:
            d = b.get("description") or ""
            if not d.strip():
                bad.append((b["slug"], "empty"))
                continue
            for marker in BAD_DESC_MARKERS:
                if marker.lower() in d.lower():
                    bad.append((b["slug"], marker))
            # raw date headers like 3/25/24 at start
            if d[:20].count("/") >= 2:
                bad.append((b["slug"], f"date header: {d[:40]}"))
        assert not bad, bad[:10]

    def test_spot_check_detail_descriptions(self, all_bots):
        slugs = [b["slug"] for b in all_bots[:5]]
        if any(b["slug"] == "book-writer" for b in all_bots):
            slugs.append("book-writer")
        bad = []
        for slug in slugs:
            r = requests.get(f"{API}/bots/{slug}", timeout=30)
            assert r.status_code == 200, slug
            d = r.json()["description"]
            if any(m.lower() in d.lower() for m in BAD_DESC_MARKERS):
                bad.append((slug, d[:120]))
        assert not bad, bad


# ---------------------------------------------------------------- MINOR FIX 2
class TestPromptsBotSpecific:
    def test_prompt_sets_unique_and_named(self, all_bots):
        sets, missing_name = set(), []
        for b in all_bots:
            ps = b.get("suggested_prompts") or []
            assert 1 <= len(ps) <= 8, (b["slug"], ps)
            sets.add(tuple(ps))
            if not any(b["name"].lower() in p.lower() for p in ps):
                missing_name.append(b["slug"])
        assert len(sets) >= 140, f"only {len(sets)} distinct prompt sets across 150 bots"
        assert not missing_name, f"prompts without bot name: {missing_name[:10]}"


# ---------------------------------------------------------------- regression
class TestRegressionFast:
    def test_auth_me_admin_and_user(self, admin_client, user_client):
        a = admin_client.get(f"{API}/auth/me", timeout=30)
        u = user_client.get(f"{API}/auth/me", timeout=30)
        assert a.status_code == 200 and a.json()["role"] == "admin", a.text[:200]
        assert u.status_code == 200 and u.json()["role"] != "admin", u.text[:200]

    def test_bad_password_rejected(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@legion.ai", "password": "wrong-pass"}, timeout=30)
        assert r.status_code in (400, 401, 429), r.status_code

    def test_admin_routes_forbidden_for_user(self, user_client):
        for path in ("/admin/bots", "/admin/overview", "/admin/import"):
            r = user_client.get(f"{API}{path}", timeout=30)
            assert r.status_code == 403, (path, r.status_code)

    def test_bots_search_and_filter(self):
        r = requests.get(f"{API}/bots?q=book&limit=100", timeout=30)
        assert r.status_code == 200
        res = r.json()
        assert res, "search for 'book' returned nothing"
        assert all("book" in json.dumps(b).lower() for b in res)

    def test_password_hash_format(self):
        from pymongo import MongoClient
        env = dotenv_values("/app/backend/.env")
        cl = MongoClient(env["MONGO_URL"])
        try:
            u = cl[env["DB_NAME"]].users.find_one({"email": "admin@legion.ai"})
            assert u, "admin user missing"
            h = u.get("password_hash") or u.get("password") or ""
            assert h.startswith("$2b$") or h.startswith("$2a$"), h[:10]
        finally:
            cl.close()
