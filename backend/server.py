from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import json
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

import auth as A
import llm as L
import tools as T
from seed import seed_catalog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("legion")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="LEGION API")
api = APIRouter(prefix="/api")

PUBLIC_BOT_FIELDS = {"_id": 0, "system_instructions": 0, "versions": 0, "source_document": 0}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleBody(BaseModel):
    session_id: str


class ForgotBody(BaseModel):
    email: EmailStr


class ResetBody(BaseModel):
    token: str
    password: str = Field(min_length=6)


class ChatBody(BaseModel):
    bot_slug: str
    conversation_id: Optional[str] = None
    message: str
    model: Optional[str] = None
    images: Optional[List[str]] = None  # base64 strings


class RenameBody(BaseModel):
    title: str


class MemoryBody(BaseModel):
    content: str


class ProfileBody(BaseModel):
    name: Optional[str] = None
    memory_enabled: Optional[bool] = None


class PythonBody(BaseModel):
    code: str


class AdminBotBody(BaseModel):
    description: Optional[str] = None
    suite_slug: Optional[str] = None
    status: Optional[str] = None
    featured: Optional[bool] = None
    capabilities: Optional[dict] = None
    default_model: Optional[str] = None
    system_instructions: Optional[str] = None


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterBody):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    doc = A.new_user_doc(email, body.name, body.password)
    await db.users.insert_one(doc)
    token = A.create_token(doc["id"], email)
    return {"token": token, "user": _clean_user(doc)}


@api.post("/auth/login")
async def login(body: LoginBody, request: Request):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until", "") > now_iso():
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not A.verify_password(body.password, user["password_hash"]):
        cnt = (att.get("count", 0) if att else 0) + 1
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$set": {"count": cnt, "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat() if cnt >= 5 else ""}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    await db.login_attempts.delete_one({"identifier": ident})
    token = A.create_token(user["id"], email)
    return {"token": token, "user": _clean_user(user)}


@api.post("/auth/google")
async def google_auth(body: GoogleBody):
    data = await A.exchange_google_session(body.session_id)
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Google authentication failed")
    user = await db.users.find_one({"email": email})
    if not user:
        user = A.new_user_doc(email, data.get("name"), None, picture=data.get("picture"))
        await db.users.insert_one(user)
    token = A.create_token(user["id"], email)
    return {"token": token, "user": _clean_user(user)}


@api.get("/auth/me")
async def me(user=Depends(A.get_current_user)):
    return _clean_user(user)


@api.post("/auth/logout")
async def logout():
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot(body: ForgotBody):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        tok = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": tok, "email": email, "used": False,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        })
        logger.info(f"[PASSWORD RESET] link token for {email}: {tok}")
    return {"ok": True, "message": "If the account exists, a reset link has been generated."}


@api.post("/auth/reset-password")
async def reset(body: ResetBody):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec or rec["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    await db.users.update_one({"email": rec["email"]}, {"$set": {"password_hash": A.hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}


def _clean_user(u: dict):
    return {
        "id": u["id"], "email": u["email"], "name": u.get("name"),
        "role": u.get("role", "user"), "picture": u.get("picture"),
        "memory_enabled": u.get("memory_enabled", True),
        "auth_provider": u.get("auth_provider", "password"),
    }


@api.patch("/profile")
async def update_profile(body: ProfileBody, user=Depends(A.get_current_user)):
    upd = {}
    if body.name is not None:
        upd["name"] = body.name
    if body.memory_enabled is not None:
        upd["memory_enabled"] = body.memory_enabled
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    fresh = await db.users.find_one({"id": user["id"]})
    return _clean_user(fresh)


# ----------------------------------------------------------------------------
# Models list
# ----------------------------------------------------------------------------
@api.get("/models")
async def list_models():
    return [{"id": k, "label": L.MODEL_LABELS[k]} for k in L.MODEL_MAP.keys()]


# ----------------------------------------------------------------------------
# Suites & Bots
# ----------------------------------------------------------------------------
@api.get("/suites")
async def get_suites():
    suites = await db.suites.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return suites


@api.get("/suites/{slug}")
async def get_suite(slug: str):
    suite = await db.suites.find_one({"slug": slug}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")
    bots = await db.bots.find({"suite_slug": slug, "status": "active"}, PUBLIC_BOT_FIELDS).sort("sort_order", 1).to_list(500)
    return {"suite": suite, "bots": bots}


@api.get("/bots")
async def get_bots(q: Optional[str] = None, suite: Optional[str] = None,
                   capability: Optional[str] = None, sort: str = "recommended",
                   favorites: bool = False, limit: int = 500,
                   user=Depends(A.optional_user)):
    query = {"status": "active"}
    if suite:
        query["suite_slug"] = suite
    if capability:
        query[f"capabilities.{capability}"] = True
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"suite_label": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    fav_ids = set()
    if user:
        favs = await db.favorites.find({"user_id": user["id"]}).to_list(1000)
        fav_ids = {f["bot_id"] for f in favs}
    if favorites and user:
        query["id"] = {"$in": list(fav_ids)}

    sort_map = {"alphabetical": ("name", 1), "recent": ("created_at", -1),
                "popular": ("usage_count", -1), "recommended": ("sort_order", 1)}
    sk, sd = sort_map.get(sort, ("sort_order", 1))
    bots = await db.bots.find(query, PUBLIC_BOT_FIELDS).sort(sk, sd).to_list(limit)
    for b in bots:
        b["is_favorite"] = b["id"] in fav_ids
    return bots


@api.get("/bots/{slug}")
async def get_bot(slug: str, user=Depends(A.optional_user)):
    bot = await db.bots.find_one({"slug": slug}, PUBLIC_BOT_FIELDS)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if user:
        fav = await db.favorites.find_one({"user_id": user["id"], "bot_id": bot["id"]})
        bot["is_favorite"] = bool(fav)
    return bot


# ----------------------------------------------------------------------------
# Search
# ----------------------------------------------------------------------------
@api.get("/search")
async def search(q: str, user=Depends(A.optional_user)):
    if not q or len(q.strip()) < 1:
        return {"bots": [], "suites": []}
    await _usage(user, "search", {"q": q})
    rx = {"$regex": q, "$options": "i"}
    bots = await db.bots.find(
        {"status": "active", "$or": [{"name": rx}, {"description": rx}, {"suite_label": rx}, {"tags": rx}]},
        PUBLIC_BOT_FIELDS,
    ).limit(40).to_list(40)
    suites = await db.suites.find({"$or": [{"name": rx}, {"description": rx}]}, {"_id": 0}).to_list(30)
    return {"bots": bots, "suites": suites}


# ----------------------------------------------------------------------------
# Favorites & Recent
# ----------------------------------------------------------------------------
@api.get("/favorites")
async def list_favorites(user=Depends(A.get_current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    ids = [f["bot_id"] for f in favs]
    bots = await db.bots.find({"id": {"$in": ids}}, PUBLIC_BOT_FIELDS).to_list(1000)
    for b in bots:
        b["is_favorite"] = True
    order = {bid: i for i, bid in enumerate(ids)}
    bots.sort(key=lambda b: order.get(b["id"], 999))
    return bots


@api.post("/favorites/{bot_id}")
async def add_favorite(bot_id: str, user=Depends(A.get_current_user)):
    exists = await db.favorites.find_one({"user_id": user["id"], "bot_id": bot_id})
    if not exists:
        await db.favorites.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "bot_id": bot_id, "created_at": now_iso()})
        await _usage(user, "favorite_added", {"bot_id": bot_id})
    return {"ok": True, "is_favorite": True}


@api.delete("/favorites/{bot_id}")
async def remove_favorite(bot_id: str, user=Depends(A.get_current_user)):
    await db.favorites.delete_one({"user_id": user["id"], "bot_id": bot_id})
    return {"ok": True, "is_favorite": False}


@api.get("/recent")
async def list_recent(user=Depends(A.get_current_user)):
    recents = await db.recent_bots.find({"user_id": user["id"]}, {"_id": 0}).sort("last_used", -1).limit(12).to_list(12)
    ids = [r["bot_id"] for r in recents]
    bots = await db.bots.find({"id": {"$in": ids}}, PUBLIC_BOT_FIELDS).to_list(50)
    bm = {b["id"]: b for b in bots}
    out = []
    for r in recents:
        if r["bot_id"] in bm:
            b = bm[r["bot_id"]]
            b = {**b, "last_used": r["last_used"]}
            out.append(b)
    return out


async def _touch_recent(user_id, bot_id):
    await db.recent_bots.update_one(
        {"user_id": user_id, "bot_id": bot_id},
        {"$set": {"last_used": now_iso()}, "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )


async def _usage(user, event, meta=None):
    if not user:
        return
    await db.usage_events.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "event": event,
        "meta": meta or {}, "created_at": now_iso(),
    })


# ----------------------------------------------------------------------------
# Conversations
# ----------------------------------------------------------------------------
@api.get("/conversations")
async def list_conversations(q: Optional[str] = None, user=Depends(A.get_current_user)):
    query = {"user_id": user["id"], "archived": {"$ne": True}}
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    convs = await db.conversations.find(query, {"_id": 0}).sort("last_activity", -1).to_list(500)
    return convs


@api.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user=Depends(A.get_current_user)):
    conv = await db.conversations.find_one({"id": conv_id, "user_id": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return {"conversation": conv, "messages": msgs}


@api.patch("/conversations/{conv_id}")
async def rename_conversation(conv_id: str, body: RenameBody, user=Depends(A.get_current_user)):
    res = await db.conversations.update_one({"id": conv_id, "user_id": user["id"]}, {"$set": {"title": body.title}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}


@api.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user=Depends(A.get_current_user)):
    await db.conversations.delete_one({"id": conv_id, "user_id": user["id"]})
    await db.messages.delete_many({"conversation_id": conv_id})
    return {"ok": True}


# ----------------------------------------------------------------------------
# Chat streaming
# ----------------------------------------------------------------------------
@api.post("/chat/stream")
async def chat_stream(body: ChatBody, user=Depends(A.get_current_user)):
    bot = await db.bots.find_one({"slug": body.bot_slug})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # capability gate for images
    images = body.images or []
    if images and not bot.get("capabilities", {}).get("image"):
        images = []  # silently drop; UI prevents this

    # conversation
    conv = None
    if body.conversation_id:
        conv = await db.conversations.find_one({"id": body.conversation_id, "user_id": user["id"]})
    if not conv:
        conv = {
            "id": str(uuid.uuid4()), "user_id": user["id"], "bot_id": bot["id"],
            "bot_slug": bot["slug"], "bot_name": bot["name"], "suite_label": bot["suite_label"],
            "bot_icon": bot["icon"],
            "title": body.message[:60] + ("..." if len(body.message) > 60 else ""),
            "model": body.model or bot.get("default_model", L.DEFAULT_MODEL),
            "archived": False, "created_at": now_iso(), "last_activity": now_iso(),
        }
        await db.conversations.insert_one({**conv})

    model_id = body.model or conv.get("model") or bot.get("default_model", L.DEFAULT_MODEL)

    # history
    hist_docs = await db.messages.find({"conversation_id": conv["id"]}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    history = [{"role": m["role"], "content": m["content"]} for m in hist_docs]

    # memory
    memory_text = ""
    if user.get("memory_enabled", True):
        mems = await db.memories.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
        memory_text = "\n".join(f"- {m['content']}" for m in mems)

    # save user message
    user_msg = {
        "id": str(uuid.uuid4()), "conversation_id": conv["id"], "role": "user",
        "content": body.message, "images": images[:4], "created_at": now_iso(),
    }
    await db.messages.insert_one({**user_msg})

    await _touch_recent(user["id"], bot["id"])
    await db.bots.update_one({"id": bot["id"]}, {"$inc": {"usage_count": 1}})
    await _usage(user, "conversation_message", {"bot_id": bot["id"]})

    async def event_gen():
        yield f"data: {json.dumps({'type': 'start', 'conversation_id': conv['id'], 'model': model_id})}\n\n"
        acc = ""
        try:
            async for chunk in L.stream_bot_reply(bot, model_id, history, body.message, images, memory_text):
                acc += chunk
                yield f"data: {json.dumps({'type': 'delta', 'content': chunk})}\n\n"
        except Exception as e:
            logger.exception("stream error")
            err = "The AI provider returned an error. Please try again or switch models."
            yield f"data: {json.dumps({'type': 'error', 'content': err + f' ({str(e)[:120]})'})}\n\n"
            if not acc:
                return

        # document generation
        gen_file = None
        spec, cleaned = T.extract_file_request(acc)
        final_text = cleaned if spec else acc
        if spec:
            try:
                f = T.generate_file(spec)
                rec = {
                    "id": f["id"], "user_id": user["id"], "conversation_id": conv["id"],
                    "filename": f["filename"], "format": f["format"], "mime": f["mime"],
                    "size": f["size"], "disk_path": f["disk_path"], "created_at": f["created_at"],
                }
                await db.generated_files.insert_one({**rec})
                gen_file = {k: rec[k] for k in ("id", "filename", "format", "size")}
            except Exception:
                logger.exception("file gen failed")

        assistant_msg = {
            "id": str(uuid.uuid4()), "conversation_id": conv["id"], "role": "assistant",
            "content": final_text, "model": model_id,
            "generated_file": gen_file, "created_at": now_iso(),
        }
        await db.messages.insert_one({**assistant_msg})
        await db.conversations.update_one({"id": conv["id"]}, {"$set": {"last_activity": now_iso(), "model": model_id}})

        if gen_file:
            yield f"data: {json.dumps({'type': 'file', 'file': gen_file})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'message_id': assistant_msg['id'], 'conversation_id': conv['id']})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})


# ----------------------------------------------------------------------------
# Files
# ----------------------------------------------------------------------------
@api.get("/files/{file_id}/download")
async def download_file(file_id: str, token: Optional[str] = None, request: Request = None):
    # allow token via query for direct browser download
    user = None
    if token:
        import jwt as _jwt
        try:
            payload = _jwt.decode(token, A.get_secret(), algorithms=[A.JWT_ALGORITHM])
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        except Exception:
            pass
    if not user:
        user = await A.get_current_user(request)
    rec = await db.generated_files.find_one({"id": file_id, "user_id": user["id"]})
    if not rec or not os.path.exists(rec["disk_path"]):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(rec["disk_path"], media_type=rec["mime"], filename=rec["filename"])


@api.post("/tools/python")
async def python_tool(body: PythonBody, user=Depends(A.get_current_user)):
    return T.run_python(body.code)


# ----------------------------------------------------------------------------
# Memory
# ----------------------------------------------------------------------------
@api.get("/memory")
async def get_memory(user=Depends(A.get_current_user)):
    mems = await db.memories.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"enabled": user.get("memory_enabled", True), "memories": mems}


@api.post("/memory")
async def add_memory(body: MemoryBody, user=Depends(A.get_current_user)):
    rec = {"id": str(uuid.uuid4()), "user_id": user["id"], "content": body.content, "created_at": now_iso()}
    await db.memories.insert_one({**rec})
    return {k: rec[k] for k in ("id", "content", "created_at")}


@api.delete("/memory/{mem_id}")
async def delete_memory(mem_id: str, user=Depends(A.get_current_user)):
    await db.memories.delete_one({"id": mem_id, "user_id": user["id"]})
    return {"ok": True}


@api.delete("/memory")
async def clear_memory(user=Depends(A.get_current_user)):
    await db.memories.delete_many({"user_id": user["id"]})
    return {"ok": True}


# ----------------------------------------------------------------------------
# Dashboard
# ----------------------------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user=Depends(A.get_current_user)):
    convs = await db.conversations.find({"user_id": user["id"], "archived": {"$ne": True}}, {"_id": 0}).sort("last_activity", -1).limit(6).to_list(6)
    favs = await db.favorites.find({"user_id": user["id"]}).to_list(1000)
    fav_ids = [f["bot_id"] for f in favs][:8]
    fav_bots = await db.bots.find({"id": {"$in": fav_ids}}, PUBLIC_BOT_FIELDS).to_list(8)
    for b in fav_bots:
        b["is_favorite"] = True
    recents = await db.recent_bots.find({"user_id": user["id"]}, {"_id": 0}).sort("last_used", -1).limit(8).to_list(8)
    rec_ids = [r["bot_id"] for r in recents]
    rec_bots = await db.bots.find({"id": {"$in": rec_ids}}, PUBLIC_BOT_FIELDS).to_list(8)
    rbm = {b["id"]: b for b in rec_bots}
    recent_bots = [rbm[r["bot_id"]] for r in recents if r["bot_id"] in rbm]
    suites = await db.suites.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    featured = await db.bots.find({"status": "active", "featured": True}, PUBLIC_BOT_FIELDS).sort("sort_order", 1).limit(8).to_list(8)
    stats = {
        "conversations": await db.conversations.count_documents({"user_id": user["id"]}),
        "favorites": len(favs),
        "recent_bots": await db.recent_bots.count_documents({"user_id": user["id"]}),
        "saved_files": await db.generated_files.count_documents({"user_id": user["id"]}),
        "total_bots": await db.bots.count_documents({"status": "active"}),
        "total_suites": await db.suites.count_documents({}),
    }
    return {
        "conversations": convs, "favorite_bots": fav_bots, "recent_bots": recent_bots,
        "suites": suites, "featured_bots": featured, "stats": stats,
    }


# ----------------------------------------------------------------------------
# Admin
# ----------------------------------------------------------------------------
@api.get("/admin/overview")
async def admin_overview(admin=Depends(A.get_admin_user)):
    return {
        "total_bots": await db.bots.count_documents({}),
        "active_bots": await db.bots.count_documents({"status": "active"}),
        "library_bots": await db.bots.count_documents({"status": "library"}),
        "total_suites": await db.suites.count_documents({}),
        "users": await db.users.count_documents({}),
        "conversations": await db.conversations.count_documents({}),
        "messages": await db.messages.count_documents({}),
    }


@api.get("/admin/bots")
async def admin_bots(q: Optional[str] = None, admin=Depends(A.get_admin_user)):
    query = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    bots = await db.bots.find(query, {"_id": 0, "system_instructions": 0}).sort("sort_order", 1).to_list(1000)
    return bots


@api.get("/admin/bots/{bot_id}")
async def admin_bot_detail(bot_id: str, admin=Depends(A.get_admin_user)):
    bot = await db.bots.find_one({"id": bot_id}, {"_id": 0})
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot


@api.patch("/admin/bots/{bot_id}")
async def admin_update_bot(bot_id: str, body: AdminBotBody, admin=Depends(A.get_admin_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "suite_slug" in upd:
        s = await db.suites.find_one({"slug": upd["suite_slug"]})
        if s:
            upd["suite_label"] = s["name"]
            upd["icon"] = s["icon"]
    if upd:
        upd["updated_at"] = now_iso()
        await db.bots.update_one({"id": bot_id}, {"$set": upd})
    bot = await db.bots.find_one({"id": bot_id}, {"_id": 0})
    return bot


@api.get("/root")
async def root():
    return {"message": "LEGION API online"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.bots.create_index("slug")
    await db.bots.create_index("suite_slug")
    await db.conversations.create_index("user_id")
    await db.messages.create_index("conversation_id")
    await db.favorites.create_index([("user_id", 1), ("bot_id", 1)])
    await db.password_reset_tokens.create_index("expires_at")
    result = await seed_catalog(db)
    logger.info(f"Seed: {result}")
    # admin seed
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@legion.ai")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "LegionAdmin2026!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one(A.new_user_doc(admin_email, "Legion Admin", admin_pw, role="admin"))
        logger.info(f"Admin seeded: {admin_email}")
    elif not A.verify_password(admin_pw, existing.get("password_hash") or ""):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": A.hash_password(admin_pw), "role": "admin"}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
