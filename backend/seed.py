"""Seed suites + bots from the importer catalog into MongoDB (idempotent)."""
import os
import json
import uuid
from datetime import datetime, timezone
import enrich

CATALOG = "/app/backend/seed_data/catalog.json"


async def seed_catalog(db):
    existing = await db.bots.count_documents({})
    if existing > 0:
        return {"seeded": False, "bots": existing}

    with open(CATALOG) as f:
        cat = json.load(f)

    now = datetime.now(timezone.utc).isoformat()

    for s in cat["suites"]:
        await db.suites.update_one(
            {"slug": s["slug"]},
            {"$set": {
                "id": str(uuid.uuid4()), "slug": s["slug"], "name": s["name"],
                "icon": s["icon"], "description": s["description"],
                "bot_count": s["bot_count"], "sort_order": s["sort_order"],
                "featured": s["featured"], "created_at": now,
            }},
            upsert=True,
        )

    docs = []
    for b in cat["bots"]:
        docs.append({
            "id": str(uuid.uuid4()), "name": b["name"], "slug": b["slug"],
            "description": b["description"], "suite_slug": b["suite_slug"],
            "suite_label": b["suite_label"], "icon": b["icon"],
            "system_instructions": b["system_instructions"],
            "source_document": b["source_document"], "capabilities": b["capabilities"],
            "suggested_prompts": b.get("suggested_prompts", []),
            "tags": b["tags"], "status": b["status"], "featured": b["featured"],
            "sort_order": b["sort_order"], "version_count": b["version_count"],
            "versions": b["versions"], "default_model": "claude-sonnet-4-6",
            "usage_count": 0, "created_at": now, "updated_at": now,
        })
    if docs:
        await db.bots.insert_many(docs)

    return {"seeded": True, "bots": len(docs), "suites": len(cat["suites"])}


async def migrate_bots(db):
    """Idempotent: polish names, add suggested_prompts, resolve name collisions."""
    flag = await db.meta.find_one({"key": "enrich_v2"})
    if flag:
        return {"migrated": False}
    bots = await db.bots.find({}, {"_id": 0, "id": 1, "name": 1, "suite_slug": 1, "capabilities": 1, "suggested_prompts": 1, "version_count": 1}).to_list(10000)
    # polish names first
    for b in bots:
        b["_new"] = enrich.polish_name(b["name"])
    # resolve collisions among polished names
    seen = {}
    for b in sorted(bots, key=lambda x: -x.get("version_count", 1)):
        key = b["_new"].lower()
        if key in seen:
            seen[key] += 1
            b["_new"] = f"{b['_new']} (v{seen[key]})"
        else:
            seen[key] = 1
    for b in bots:
        upd = {"name": b["_new"]}
        if not b.get("suggested_prompts"):
            upd["suggested_prompts"] = enrich.suggest_prompts(b.get("suite_slug", "specialized"), b.get("capabilities"))
        await db.bots.update_one({"id": b["id"]}, {"$set": upd})
    await db.meta.insert_one({"key": "enrich_v2", "at": datetime.now(timezone.utc).isoformat()})
    return {"migrated": True, "bots": len(bots)}


async def migrate_dedup_v3(db, target_active=150):
    """Dedup active bots by instruction content-hash; clean descriptions; bot-specific prompts.
    Keeps exactly target_active unique active bots by demoting duplicates and promoting unique
    library bots to backfill. Idempotent via meta flag dedup_v3."""
    import hashlib
    if await db.meta.find_one({"key": "dedup_v3"}):
        return {"migrated": False}
    bots = await db.bots.find({}, {"_id": 0, "id": 1, "name": 1, "status": 1, "system_instructions": 1,
                                   "version_count": 1, "suite_slug": 1, "capabilities": 1}).to_list(100000)

    def h(b):
        return hashlib.sha256((b.get("system_instructions") or "").strip().encode()).hexdigest()

    def richness(b):
        return (b.get("version_count", 1), len(b.get("system_instructions") or ""))

    seen = set()
    active_final = []
    # pass 1: keep richest unique among currently-active
    for b in sorted([x for x in bots if x["status"] == "active"], key=richness, reverse=True):
        hh = h(b)
        if hh in seen:
            b["_status"] = "library"
        else:
            seen.add(hh); b["_status"] = "active"; active_final.append(b)
    # pass 2: backfill from library with unique hashes
    if len(active_final) < target_active:
        for b in sorted([x for x in bots if x["status"] != "active"], key=richness, reverse=True):
            if len(active_final) >= target_active:
                break
            hh = h(b)
            if hh in seen:
                continue
            seen.add(hh); b["_status"] = "active"; active_final.append(b)
    # apply updates
    order = 0
    for b in bots:
        new_status = b.get("_status", "library")
        desc = enrich.clean_description(b.get("system_instructions", ""), b.get("name", ""))
        prompts = enrich.personalize_prompts(b.get("name", "Bot"), b.get("suite_slug", "specialized"), b.get("capabilities"))
        upd = {"status": new_status, "description": desc, "suggested_prompts": prompts}
        if new_status == "active":
            upd["sort_order"] = order; order += 1
        await db.bots.update_one({"id": b["id"]}, {"$set": upd})
    # refresh suite counts
    for s in await db.suites.find({}, {"_id": 0, "slug": 1}).to_list(500):
        cnt = await db.bots.count_documents({"suite_slug": s["slug"], "status": "active"})
        await db.suites.update_one({"slug": s["slug"]}, {"$set": {"bot_count": cnt}})
    await db.meta.insert_one({"key": "dedup_v3", "at": datetime.now(timezone.utc).isoformat()})
    return {"migrated": True, "active": len(active_final)}


async def migrate_names_v4(db):
    """Re-polish rough bot names + resolve name collisions. Idempotent (names_v4 flag)."""
    if await db.meta.find_one({"key": "names_v4"}):
        return {"migrated": False}
    bots = await db.bots.find({}, {"_id": 0, "id": 1, "name": 1, "version_count": 1, "status": 1}).to_list(100000)
    for b in bots:
        b["_new"] = enrich.polish_name(b["name"])
    seen = {}
    changed = 0
    for b in sorted(bots, key=lambda x: (x["status"] != "active", -x.get("version_count", 1))):
        key = b["_new"].lower()
        if key in seen:
            seen[key] += 1
            b["_new"] = f"{b['_new']} {seen[key]}"
        else:
            seen[key] = 1
        if b["_new"] != b["name"]:
            await db.bots.update_one({"id": b["id"]}, {"$set": {"name": b["_new"]}})
            changed += 1
    await db.meta.insert_one({"key": "names_v4", "at": datetime.now(timezone.utc).isoformat()})
    return {"migrated": True, "renamed": changed}
