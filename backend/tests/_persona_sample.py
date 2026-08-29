"""Manual persona sampler: short prompt per representative bot, prints reply head."""
import json, requests, sys
sys.path.insert(0, "/app/backend/tests")
from conftest import API, USER

tok = requests.post(f"{API}/auth/login", json=USER, timeout=30).json()["token"]
bots = requests.get(f"{API}/bots?limit=1000", timeout=60).json()
by_slug = {b["slug"]: b for b in bots}

wanted_kw = ["book", "coding", "python", "data", "agri", "farm", "cannabis", "hemp",
             "movie", "screen", "research", "time-machine"]
picks = []
for kw in wanted_kw:
    for b in bots:
        if kw in b["slug"] and b["slug"] not in [p["slug"] for p in picks]:
            picks.append(b)
            break

for b in picks:
    r = requests.post(f"{API}/chat/stream", stream=True, timeout=180,
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"bot_slug": b["slug"],
                            "message": "In ONE short sentence state your role and domain."})
    txt, err = "", ""
    for line in r.iter_lines(decode_unicode=True):
        if line and line.startswith("data: "):
            e = json.loads(line[6:])
            if e.get("type") == "delta":
                txt += e["content"]
            if e.get("type") == "error":
                err = e["content"]
    print(f"\n### {b['name']} [{b['suite_slug']}] ({b['slug']})")
    print("ERR:", err) if err else None
    print("  ->", " ".join(txt.split())[:260])
