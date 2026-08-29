"""Seed suites + bots from the importer catalog into MongoDB (idempotent)."""
import os
import json
import uuid
from datetime import datetime, timezone

CATALOG = "/app/backend/seed_data/catalog.json"


async def seed_catalog(db):
    existing = await db.bots.count_documents({})
    if existing > 0:
        return {"seeded": False, "bots": existing}

    with open(CATALOG) as f:
        cat = json.load(f)

    now = datetime.now(timezone.utc).isoformat()

    # suites
    for s in cat["suites"]:
        await db.suites.update_one(
            {"slug": s["slug"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "slug": s["slug"],
                "name": s["name"],
                "icon": s["icon"],
                "description": s["description"],
                "bot_count": s["bot_count"],
                "sort_order": s["sort_order"],
                "featured": s["featured"],
                "created_at": now,
            }},
            upsert=True,
        )

    # bots
    docs = []
    for b in cat["bots"]:
        docs.append({
            "id": str(uuid.uuid4()),
            "name": b["name"],
            "slug": b["slug"],
            "description": b["description"],
            "suite_slug": b["suite_slug"],
            "suite_label": b["suite_label"],
            "icon": b["icon"],
            "system_instructions": b["system_instructions"],
            "source_document": b["source_document"],
            "capabilities": b["capabilities"],
            "tags": b["tags"],
            "status": b["status"],
            "featured": b["featured"],
            "sort_order": b["sort_order"],
            "version_count": b["version_count"],
            "versions": b["versions"],
            "default_model": "claude-sonnet-4-6",
            "usage_count": 0,
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        await db.bots.insert_many(docs)

    return {"seeded": True, "bots": len(docs), "suites": len(cat["suites"])}
