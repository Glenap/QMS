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
| `DEPLOYMENT.md` | Hosted deploy (Neon + Render + Vercel), env vars, known limits | — |
| `render.yaml` | Render blueprint for the backend service | — |

## Features

- **Project setup** — clients, contractors (per-project, accept/decline), suppliers
  & testing labs (with an email confirmation handshake), towers/floors, mix designs.
- **Pour lifecycle** — schedule pours against tower/floor/component/grade.
- **RMC dispatch + gate scan** — a one-truck-per-token flow: QE requests a truck →
  supplier fills it via a public token link → site supervisor works the gate
  (arrive / accept / reject) with live volume accounting.
- **Mix designs (RMC-owned, QE-approved)** — the contractor requests grades from a
  supplier; the RMC submits the detailed mix + mandatory PDF through its own token
  link; the QE approves / rejects. Only a grade with an approved mix for **that
  supplier** can be dispatched or poured.
- **Cube tests + quality engine** — cast samples against a lab; the lab submits
  7/14/28-day results through a passwordless token link. A pure IS 456 engine
  grades PASS / FAIL / CRITICAL_FAILURE and auto-raises an NCR on a failing
  28-day result.
- **QE in-situ slump gate** — supervisor admission is provisional (`PENDING_QE`);
  the QE runs the in-situ slump test against the mix design's range and
  accepts/rejects every delivery, with a polled inbox + bell. Mismatches at the
  gate raise action items into that inbox.
- **90-minute placement window** — a truck whose dispatch→gate transit exceeds the
  IS 456 window is auto-rejected at the arrival scan.
- **NCR lifecycle** — review → root cause → corrective actions → penalties → close,
  with a guarded state machine.
- **Analytics & traceability** — per-project KPIs, pass-rate trends, supplier
  scorecards, run/CUSUM charts, normal-distribution and graphical-summary panels
  (moments, Anderson–Darling, Q–Q, KDE), modified-Thompson outlier scan, t-tests,
  an IS/ACI code-standard selector with clause citations, and a full lineage walk
  from any reference (sample / pour / NCR / challan / vehicle).
- **Conformance analyser** — per-photo concrete-defect classification against a
  72-entry taxonomy, with severity/root-cause/remediation and a grouped report.
- **Documents** — per-project file store (upload / list / download / delete) with
  QE/PM review.
- **AI analyst agent** — natural-language Q&A over the metrics layer (LangGraph
  ReAct loop, read-only tools, no text-to-SQL). Asks structured clarifying
  questions on broad queries and returns downloadable charts.
- **AI suggestions (RAG)** — for a failing NCR, retrieve similar past *resolved*
  NCRs and suggest a root cause + corrective actions, human-in-the-loop.

The AI provider is a seam (`AI_PROVIDER`): local **Ollama** for development,
an OpenAI-compatible hosted API (**Gemini**) in the hosted deploy. Tests never
call either — fakes are injected via dependency overrides.

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

## Operational safety

- **Destructive scripts fail closed.** `scripts/wipe_db.py` and
  `scripts/seed_demo.py` both truncate every table, so they share one guard
  (`app/database/wipe.py`) that refuses to run unless `ENVIRONMENT` is a
  known-safe local value (`development` / `local` / `test` / `testing`). An
  unset, misspelled, or production value aborts. The wipe + catalog re-seed
  itself lives in that one module, used by both scripts and the test fixture.
- **Request bodies are capped** before they are buffered
  (`app/core/body_limit.py`, `MAX_UPLOAD_BYTES`). The public token routers accept
  multipart uploads with no authentication, so the limit has to apply ahead of
  the route, not just inside the service.
- **Dev-convenience credentials are redacted in production**
  (`app/core/fallback_log.py`). Best-effort email failures log the OTP code or
  token link so local dev works without SMTP; in a hosted deploy those would land
  in retained log storage, so they are replaced with a placeholder.

## Architecture in one line

Backend is layered **router → service → repository → model** with Pydantic schemas
as the DTO boundary, pure domain cores (the IS 456 engine, the RAG helpers), and
interface-first seams (LLM client, embedder, storage, the analytics chokepoint) so
the model and storage backends are swappable and fully fakeable in tests. The
frontend's `src/api/*` mirrors the backend routers 1:1.
