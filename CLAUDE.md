# Strata — Construction Quality Management System

A concrete QMS for construction projects: pours → RMC dispatch/gate scan → cube
strength tests (IS 456 PASS/FAIL/CRITICAL) → auto-NCRs → corrective actions →
analytics/traceability → an AI analyst agent and AI suggestions (RAG). Backend is
FastAPI + async SQLAlchemy + Postgres; frontend is React + Vite + TypeScript.

The product is **project-scoped**: a client admin creates a project, brings on a
contractor, who assigns PM/QE/Supervisor; almost every API lives under
`/projects/{id}/...` and is authorised by `app/core/project_access.py`.

## Repo map

- `backend/` — FastAPI app (see `backend/CLAUDE.md` for env + conventions)
- `frontend/react-app/` — Vite React app (see its `CLAUDE.md`)
- `TASKS.md` — living backlog (debt + deferred work); update it as you go

## Golden rules (these bite if ignored)

1. **Backend runs through `uv`, and `uv` needs `UV_LINK_MODE=copy`** on this
   machine — the `.venv` is on a OneDrive-backed path and hardlinking fails
   (os error 396). It's set as a project env var in `.claude/settings.json`, but
   if you shell out manually, prefix it. Python is **3.11** (not 3.13).
2. **Postgres is on port 5433** (not 5432). App DB `construction_db`, test DB
   `construction_test_db`. The password lives in `backend/.env` — read it from
   there, never hardcode.
3. **Run the backend test suite in the background** — it's ~2 min and a 2-min
   foreground tool cap can kill it mid-run. `UV_LINK_MODE=copy uv run pytest -q`.
4. **The frontend gate is `npx tsc -b`** (and `npx eslint`), not `npm run lint`
   alone. tsc must be clean before you call frontend work done.
5. **Commit only when asked.** Never commit on `main` — work on a feature branch
   (current: `feat/connect-fe-be`). Backend and frontend get **separate commits**
   per change. End commit messages with the `Co-Authored-By` trailer.

## Architecture (and the conventions that keep it clean)

Backend layering — **router → service → repository → model**, with Pydantic
schemas as the DTO boundary. Keep each layer in its lane:

- **Routers** (`app/routers/`) parse/authorise and delegate; no business logic.
- **Services** (`app/services/`) own business logic. They **`flush()`, never
  `commit()`** — `get_db` owns the one commit per request (the OTP attempt
  counter in `auth_service` is the one documented exception, and it says why).
- **Repositories** (`app/repositories/`) own queries; subclass `BaseRepository`.
- **Domain core stays pure** — `app/core/quality_engine.py` (IS 456) and
  `app/ai/rag.py` have no I/O so they're unit-tested directly.
- **Swappable seams** are interface-first: `LLMClient`, `Embedder`,
  `LocalStorage`, and the analytics "metrics chokepoint" (`AnalyticsService`).
  Tests inject fakes via FastAPI dependency overrides — never hit a real model.

Frontend: `src/api/*` mirrors the backend routers 1:1 (thin axios wrappers);
pages under `src/pages/` (project workspace under `src/pages/project/`); shared
types in `src/types/`.

## Commands

```bash
# backend (from backend/)
UV_LINK_MODE=copy uv run uvicorn app.main:app --reload     # serve :8000
UV_LINK_MODE=copy uv run pytest -q                         # tests (run in bg)
UV_LINK_MODE=copy uv run ruff check app/ tests/            # lint
UV_LINK_MODE=copy uv run alembic upgrade head              # migrate construction_db
UV_LINK_MODE=copy uv run python scripts/seed_demo.py       # full demo data

# frontend (from frontend/react-app/)
npm run dev        # Vite on :3000 (proxies /api → :8000)
npx tsc -b         # the real type gate
npx eslint src/...
```

Demo logins (after `seed_demo.py`), all password `Password123!`:
`client@skyline-demo.com`, `contractor@buildwell-demo.com`,
`qe@buildwell-demo.com`, `supervisor@buildwell-demo.com`.

## Project skills & agents

- `/qms-test` — run backend tests + lints the correct way
- `/qms-migration` — author + apply a migration the project way
- `/qms-smoke` — boot the server and smoke-test the live API
- `qms-reviewer` agent — diff review tuned to these conventions
- `qms-feature` agent — scaffold a backend feature across all layers

The build roadmap (Phases 1–9, all done) and per-phase details live in the
user-level memory, not here — this file is for conventions, not history.
