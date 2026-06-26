# Strata — Construction Quality Management System

Strata is a concrete **Quality Management System** for construction projects. It
takes a pour from plan to verdict: schedule a pour → dispatch ready-mix concrete
and scan it in at the site gate → cast cube samples and record strength tests →
auto-raise a **Non-Conformance Report** when a result fails IS 456 → work the NCR
to closure with corrective actions and penalties → and read it all back through
analytics, full-chain traceability, and an **AI analyst agent** plus **AI-suggested
root causes** (RAG over past resolved NCRs).

The app is **project-scoped** end to end: a client admin creates a project and
brings on a contractor, who assigns the project manager, quality engineer, and
site supervisor. Visibility and every action are authorised per project and role.

```
┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
│  React + TS │ → │  FastAPI     │ → │  PostgreSQL 16   │
│  (Vite :3000)│  │  (async :8000)│   │  5 schemas :5433 │
└─────────────┘   └──────┬───────┘   └──────────────────┘
                         │
                    ┌────▼─────┐   local, CPU-only
                    │  Ollama  │   qwen2.5:3b · nomic-embed-text
                    └──────────┘   (AI agent + RAG suggestions)
```

## Monorepo layout

| Path | What | README |
|------|------|--------|
| `backend/` | FastAPI + async SQLAlchemy + Postgres API | [backend/README.md](backend/README.md) |
| `frontend/react-app/` | React + Vite + TypeScript SPA | [frontend/react-app/README.md](frontend/react-app/README.md) |
| `CLAUDE.md` | Conventions for Claude Code sessions | — |
| `TASKS.md` | Living backlog (debt + deferred work) | — |

## Features

- **Project setup** — clients, contractors (per-project, accept/decline), suppliers
  & testing labs (with an email confirmation handshake), towers/floors, mix designs.
- **Pour lifecycle** — schedule pours against tower/floor/component/grade.
- **RMC dispatch + gate scan** — a one-truck-per-token flow: QE requests a truck →
  supplier fills it via a public token link → site supervisor works the gate
  (arrive / accept / reject) with live volume accounting.
- **Cube tests + quality engine** — cast samples, record 7/28-day strengths; a pure
  IS 456 engine grades PASS / FAIL / CRITICAL_FAILURE and auto-raises an NCR.
- **NCR lifecycle** — review → root cause → corrective actions → penalties → close,
  with a guarded state machine.
- **Analytics & traceability** — per-project KPIs, pass-rate trends, supplier
  scorecards, and a full lineage walk from any reference (sample / pour / NCR /
  challan / vehicle).
- **Documents** — per-project file store (upload / list / download / delete).
- **AI analyst agent** — natural-language Q&A over the metrics layer (LangGraph
  ReAct loop + Ollama tool-calling; read-only tools, no text-to-SQL).
- **AI suggestions (RAG)** — for a failing NCR, retrieve similar past *resolved*
  NCRs and suggest a root cause + corrective actions, human-in-the-loop.

## Quick start

Prerequisites: **PostgreSQL 16 on port 5433**, [**uv**](https://docs.astral.sh/uv/),
Node 18+, and (for the AI features) [**Ollama**](https://ollama.com) running locally.

```bash
# 1. Backend  (see backend/README.md for detail)
cd backend
cp .env.sample .env                     # set DATABASE_URL, SECRET_KEY, MAIL_*
UV_LINK_MODE=copy uv sync
UV_LINK_MODE=copy uv run alembic upgrade head
UV_LINK_MODE=copy uv run python scripts/seed_demo.py   # optional: full demo data
UV_LINK_MODE=copy uv run uvicorn app.main:app --reload # API on :8000, docs at /docs

# 2. AI models (optional, for the agent + suggestions)
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

# 3. Frontend  (see frontend/react-app/README.md)
cd frontend/react-app
npm install
npm run dev                              # app on :3000, proxies /api → :8000
```

> **Note:** `UV_LINK_MODE=copy` is required for `uv` on this machine (the `.venv`
> sits on a OneDrive-backed path where hardlinking fails). It's set ambient in
> `.claude/settings.json` for Claude Code sessions.

Demo logins after `seed_demo.py` (all password `Password123!`):
`client@skyline-demo.com` · `contractor@buildwell-demo.com` ·
`qe@buildwell-demo.com` · `supervisor@buildwell-demo.com`.

## Tech stack

**Backend:** FastAPI · SQLAlchemy 2.0 async · asyncpg · Alembic · PostgreSQL 16 ·
JWT (python-jose) · passlib/bcrypt · LangGraph · Ollama · pytest · ruff · uv.

**Frontend:** React 19 · Vite · TypeScript · React Router · axios · Recharts ·
lucide-react.

## Architecture in one line

Backend is layered **router → service → repository → model** with Pydantic schemas
as the DTO boundary, pure domain cores (the IS 456 engine, the RAG helpers), and
interface-first seams (LLM client, embedder, storage, the analytics chokepoint) so
the model and storage backends are swappable and fully fakeable in tests. The
frontend's `src/api/*` mirrors the backend routers 1:1.
