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
- ✅ Auth: register/login/me/logout/forgot/reset (JWT), Emergent Google login, brute-force lockout, admin seed.
- ✅ 150 active bots / 14 suites seeded from real instructions; public endpoints exclude system_instructions.
- ✅ Dashboard (stats, continue working, favorites, recent, featured, suites), global search overlay.
- ✅ All Bots (filters: suite/capability/sort/search), Suites + suite detail.
- ✅ Bot workspace: SSE streaming chat, markdown + code copy, per-bot instruction isolation, model selector, image upload (vision), document generation + download, regenerate/copy/stop, conversation sidebar.
- ✅ Conversations (list/rename/delete/search), favorites, recent, memory settings, profile.
- ✅ Admin: overview, bot table (all 210), feature/status toggle, instruction preview modal (admin-only), route-guarded.
- ✅ Matrix theme, MORE AI TOOLS buttons, mobile responsive drawers, legal pages.
- ✅ Tested: backend 100% (52 passed), frontend ~92% → 3 issues fixed (generate-file leak, admin guard, admin row cap).

## Backlog / Remaining
- P1: Improve importer name cleaning for a few raw/add-on titles; tighten dedup of Book Writer V1–V8 variants.
- P1: Admin import-manager UI (upload ZIP, dedup review) + version restore UI.
- P2: PDF/CSV/XLSX richer formatting; non-image file (PDF/CSV) attachments via Gemini; regression test harness UI.
- P2: Rate limiting headers, account export/delete, conversation archive UI.

## Credentials
- Admin: admin@legion.ai / LegionAdmin2026!
- Test user: testuser@legion.ai / TestUser2026!
