import asyncio
import sys
sys.path.insert(0, "/app/backend")
from database import db


async def main():
    r1 = await db.bots.delete_many({"name": {"$regex": "^TEST IT4", "$options": "i"}})
    r2 = await db.import_jobs.delete_many({"filename": {"$regex": "^TEST_", "$options": "i"}})
    r3 = await db.users.delete_many({"email": {"$regex": "^test_it4_", "$options": "i"}})
    print("deleted bots", r1.deleted_count, "jobs", r2.deleted_count, "users", r3.deleted_count)
    print("active:", await db.bots.count_documents({"status": "active"}), "total:", await db.bots.count_documents({}))
    print("residual TEST bots:", [b["name"] async for b in db.bots.find({"name": {"$regex": "TEST", "$options": "i"}}, {"_id": 0, "name": 1})])


asyncio.run(main())
