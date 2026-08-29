# THE AI WEB TOOLS — LEGION OF BOTS · PRD

## Original Problem
A free, premium AI hub of ~150 specialized bots (deduplicated from 279 supplied operational-instruction DOCX files) organized into suites, with login + memory + personal dashboards, global search, ChatGPT-like per-bot workspaces (streaming, markdown, code, image vision, doc generation, python), favorites, recent, conversations, and an admin panel. Matrix theme meshing with aiwebtools.app; prominent "MORE AI TOOLS" buttons → https://aiwebtools.app.

## Architecture
- **Frontend**: React 19 + Tailwind (matrix dark theme: #050505 / neon green #00FF41; Chivo/IBM Plex Sans/JetBrains Mono), react-markdown + rehype-highlight, framer-ready. Bearer-token auth in localStorage.
- **Backend**: FastAPI + MongoDB (motor). JWT (bcrypt) email/password auth + Emergent Google auth. All routes under /api.
- **LLM**: emergentintegrations Universal Key. Per-request model selection: Claude Sonnet 4.6 (default), GPT-5.4, Gemini 3.1 Pro. Streaming SSE. Per-bot system-prompt isolation.
- **Importer** (`importer.py`): parses 279 docs → 210 bot families → 150 active + 60 internal library, 14 suites; keeps version history; capability + suite inference; smallest-modification compatibility note for doc generation.
- **Tools** (`tools.py`): docx/pdf/csv/txt/md generation via generate-file block; sandboxed subprocess Python runner.

## User Personas
- Operator (end user): finds a bot, chats, downloads outputs, saves favorites/memory.
- Admin: manages catalog, suites, capabilities, inspects operational instructions & versions.

## Core Requirements (static)
Auth, per-user data isolation, 150-bot catalog w/ suites, global search, bot workspace w/ streaming + model switch, favorites, recent, conversation persistence, memory, document generation, python tool, image vision, admin panel, matrix UI, MORE AI TOOLS links.

## Implemented (2026-06)
- ✅ Auth (JWT email/password + Emergent Google), 150 active / 210 total bots, 14 suites, dashboard, global search.
- ✅ Bot workspace: SSE streaming, per-bot instruction isolation, model selector, markdown+code, regenerate/copy/stop.
- ✅ Conversations, favorites, recent, memory, admin panel, matrix UI, MORE AI TOOLS links, mobile responsive.
- ✅ **Import Manager** (admin): upload ZIP → dedup preview (new/duplicate) → publish to internal library; history; source files never overwritten.
- ✅ **Cleaner Names + descriptions**: enrich_v2 (polish names) + dedup_v3 (content-hash dedup → 150 byte-unique active bots, cleaned descriptions) + names_v4 (rough-name polish).
- ✅ **File Attachments**: images (any model) + PDF/CSV/TXT/DOCX/XLSX (text injected; binary auto-routes to Gemini).
- ✅ **Prompt Library**: per-bot suggested_prompts (name-personalized) on the workspace empty state.
- ✅ Document generation (DOCX/PDF/CSV/TXT/MD downloads, ownership-checked), sandboxed Python tool.
- ✅ Verified: testing agent iterations 1-3 → backend 100% (85 tests), frontend 100%; all 150 bots unique + in-character; multi-user authorization enforced.

## Backlog / Remaining (cosmetic/optional)
- P2: LLM-generated conversation titles (currently first 60 chars); humanize a few bot descriptions.
- P2: notice when files are attached to a non-files bot; split server.py into routers; bulk_write migrations at larger scale.
- P2: hash-dedup at import-publish time; object storage for generated files when deploying.

## Credentials
- Admin: admin@legion.ai / LegionAdmin2026!
- Test user: testuser@legion.ai / TestUser2026!
