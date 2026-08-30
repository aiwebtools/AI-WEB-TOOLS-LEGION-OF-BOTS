import asyncio, os, sys
sys.path.insert(0, "/app/backend")
from database import db


async def main():
    for slug in ["college-degree-8", "data-analysis-and-report-added-protection-for-was-made-all-a"]:
        b = await db.bots.find_one({"slug": slug}, {"_id": 0, "name": 1, "suggested_prompts": 1, "status": 1})
        print(slug, "->", b)
    print("active:", await db.bots.count_documents({"status": "active"}), "total:", await db.bots.count_documents({}))
    print("meta:", [m async for m in db.meta.find({}, {"_id": 0})])
    print("test bots:", [b["name"] async for b in db.bots.find({"name": {"$regex": "^Test", "$options": "i"}}, {"_id": 0, "name": 1})])
    print("import jobs TEST:", await db.import_jobs.count_documents({"filename": {"$regex": "^TEST_"}}))


asyncio.run(main())
