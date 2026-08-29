import hashlib, json, re
from collections import defaultdict
from dotenv import dotenv_values
from pymongo import MongoClient

env = dotenv_values("/app/backend/.env")
cl = MongoClient(env["MONGO_URL"])
db = cl[env["DB_NAME"]]

print("meta docs:", list(db.meta.find({}, {"_id": 0})))
bots = list(db.bots.find({"status": "active"}, {"_id": 0}))
print("active:", len(bots), "total:", db.bots.count_documents({}))

groups = defaultdict(list)
for b in bots:
    h = hashlib.sha256((b.get("system_instructions") or "").strip().encode()).hexdigest()
    groups[h].append(b["name"])
dup = {h: v for h, v in groups.items() if len(v) > 1}
print("\nDUPLICATE INSTRUCTION GROUPS:", len(dup), "bots involved:", sum(len(v) for v in dup.values()))
for h, v in list(dup.items()):
    print("  -", v)

print("\nUGLY NAMES (lowercase-only / >45 chars / typo-ish / trailing 'you are'):")
for b in bots:
    n = b["name"]
    if len(n) > 42 or re.search(r"\b(operationa|alegraic|alegerbra|you are|added protection|was made)\b", n, re.I) or n == n.lower():
        print(f"  [{len(n):>3}] {n}   (slug={b['slug']})")

print("\nSuggested prompt set uniqueness:")
sets = defaultdict(int)
for b in bots:
    sets[tuple(b.get("suggested_prompts", []))] += 1
print(" distinct prompt sets:", len(sets), "| largest group:", max(sets.values()))
cl.close()
