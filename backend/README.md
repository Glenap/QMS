# Construction QMS — Backend

FastAPI + async SQLAlchemy backend for the Construction Quality Management System.
Dependencies and the virtual environment are managed with [**uv**](https://docs.astral.sh/uv/).

## Tech stack

| | |
|---|---|
| Language | Python **3.11** (deps lack 3.13 wheels; pinned `>=3.11,<3.13`) |
| Web | FastAPI 0.111 · Uvicorn |
| ORM | SQLAlchemy 2.0 (async) · asyncpg |
| Migrations | Alembic (multi-schema, async) |
| DB | PostgreSQL 16 on **port 5433**, database `construction_db` |
| Auth | JWT (python-jose) · passlib + bcrypt |
| Email | fastapi-mail + Jinja2 |
| AI | LangGraph agent + local **Ollama** (`qwen2.5:3b`) tool-calling; RAG via `nomic-embed-text` embeddings + Python cosine (no pgvector) |
| Tooling | uv · pytest + pytest-asyncio · ruff · Docker |

## Project structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, router registration, CORS
│   ├── config.py            # pydantic-settings, reads .env
│   ├── core/                # security (JWT/bcrypt), dependencies, project_access
│   │                        #   (RBAC), exceptions, email, storage, quality_engine
│   ├── ai/                  # analyst agent: llm (Ollama client), embeddings,
│   │                        #   tools, graph (LangGraph), rag, agent
│   ├── database/            # DeclarativeBase, async engine, get_db() session
│   ├── models/              # auth, master, transaction, quality, audit (5 schemas)
│   ├── schemas/             # Pydantic DTOs (per domain: master, transaction,
│   │                        #   quality, analytics, traceability, chat, …)
│   ├── repositories/        # DB query layer (base_repo + per-resource repos)
│   ├── services/            # business logic — one per domain (~18 services)
│   ├── routers/             # one per domain (~19 routers, registered in main.py)
│   └── templates/email/     # invitation, truck_dispatch, truck_result, lab_reminder
├── alembic/                 # env.py (creates all 5 schemas) + versions/
├── scripts/                 # seed_demo.py (full demo), wipe_db.py
├── tests/
│   ├── conftest.py          # test-DB bootstrap, fixtures, email/AI stubs
│   ├── helpers.py · mailbox.py
│   ├── unit/                # quality_engine, rag, security, invite-permission
│   └── integration/         # per-phase E2E flows (auth → … → AI suggestions)
├── pyproject.toml           # deps, dev group, build, pytest + ruff config
├── uv.lock                  # pinned, reproducible dependency graph (committed)
├── .python-version          # 3.11
├── alembic.ini
├── Dockerfile · .dockerignore
└── .env.sample
```

### Database schemas

| Schema | Contents |
|--------|----------|
| `auth` | organisations, users, project_team, org_invitations, token_blacklist |
| `master` | projects, towers, floors, components, grades, suppliers, mix_designs, testing_labs |
| `master` (cont.) | + documents (per-project file store) |
| `transaction` | pours, rmc_dispatches, truck_dispatches, pour_dispatch_links, cube_samples |
| `quality` | cube_tests, ncrs, penalties, corrective_actions, ai_suggestions, ncr_embeddings |
| `audit` | audit_logs, ingestion_logs, embeddings |

## Setup

### Prerequisites
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- PostgreSQL 16 running on port 5433 (database `construction_db`)
- [Ollama](https://ollama.com) (optional — only for the AI agent/suggestions at
  runtime): `ollama pull qwen2.5:3b && ollama pull nomic-embed-text`

> **`UV_LINK_MODE=copy`** — on this machine the `.venv` is on a OneDrive-backed
> path where hardlinking fails (os error 396), so prefix `uv` commands with
> `UV_LINK_MODE=copy` (or `export` it). It's set ambient for Claude Code in
> `.claude/settings.json`. The commands below omit the prefix for brevity.

### 1. Install dependencies
```bash
cd backend
UV_LINK_MODE=copy uv sync     # creates .venv (Python 3.11), installs locked deps + dev tools
```
`uv sync` editable-installs the `app` package, so `app.*` imports resolve everywhere —
no `PYTHONPATH` juggling needed.

### 2. Configure environment
```bash
cp .env.sample .env
# fill in DATABASE_URL, SECRET_KEY, MAIL_* (see .env.sample)
```
Generate a secret key: `uv run python -c "import secrets; print(secrets.token_hex(32))"`

### 3. Create the database & run migrations
```bash
# create the DB once (psql, or any client), then:
uv run alembic upgrade head     # alembic/env.py creates all 5 schemas automatically
```

### 4. (Optional) seed a full demo dataset
```bash
uv run python scripts/seed_demo.py   # client+contractor orgs, verified users, a
                                     # project, pours → dispatch/gate → cube tests
                                     # → NCRs (one worked to closed). Aborts if the
                                     # demo org already exists; never wipes.
```
Demo logins (all password `Password123!`): `client@skyline-demo.com`,
`contractor@buildwell-demo.com`, `qe@buildwell-demo.com`, `supervisor@buildwell-demo.com`.

### 5. Run the server
```bash
uv run uvicorn app.main:app --reload
```
- API base: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/docs`

## Common commands

All `uv` commands assume the `UV_LINK_MODE=copy` prefix (see Setup).

```bash
uv sync                         # install / update the environment from uv.lock
uv add <pkg>                    # add a runtime dependency (updates pyproject + uv.lock)
uv add --dev <pkg>              # add a dev dependency
uv run uvicorn app.main:app --reload
uv run alembic revision -m "msg"   # migrations are hand-written (not autogenerated)
uv run alembic upgrade head
uv run pytest -q                # full suite (uses a dedicated construction_test_db)
uv run ruff check app/ tests/   # lint
uv run python scripts/seed_demo.py  # full demo dataset
```

## Testing

Tests are hermetic: `tests/conftest.py` creates a separate **`construction_test_db`**
on the same server, builds the schema from the models (`create_all`, not Alembic),
and stubs outbound email and the AI clients. The live `construction_db` is never
touched.

- **Isolation is transaction-rollback**, not per-test truncate: one connection +
  outer transaction is rolled back at teardown; the app's `commit()` only releases
  a SAVEPOINT (catalogs are seeded once, bcrypt rounds reduced). The full suite is
  ~2 min — **run it in the background** so a 2-minute foreground cap can't kill it.
- **AI is faked** via FastAPI dependency overrides (`get_llm`, `get_embedder`), so
  tests never need Ollama running.

```bash
uv run pytest -q                       # unit + integration (201 tests)
uv run pytest tests/unit
uv run pytest tests/integration/test_phase9_ai_suggestion_flow.py -q
```

## Auth endpoints

Base: `/api/v1`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Client self-registers (org + CLIENT_ADMIN); returns an OTP challenge |
| POST | `/auth/verify-otp` | — | Verify the emailed code → activate account + tokens |
| POST | `/auth/resend-otp` | — | Re-send a verification code |
| POST | `/auth/login` | — | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | — | New access token from refresh token |
| POST | `/auth/accept-invitation` | — | Accept invite, create account (returns OTP challenge) |
| POST | `/auth/logout` | Bearer | Blacklist current access token |
| GET | `/auth/me` | Bearer | Current user + organisation |
| GET | `/auth/team` | Bearer | Org directory (users + pending invitations) |
| POST | `/auth/invite` | role-based | Invite a user to your org |

Account activation uses an **email OTP** (activation only): register / accept-invitation create
an inactive account and email a 6-digit code; `verify-otp` activates it and issues tokens.
Login itself is password-only.

Project-scoped endpoints (visibility + management are scoped per project):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST/GET | `/projects` | Create (CLIENT_ADMIN) / list (membership-scoped) |
| GET | `/projects/{id}` | Detail + the viewer's `access` capabilities |
| GET/POST | `/projects/{id}/members` | List / assign-or-invite a member |
| GET/POST | `/projects/{id}/contractors` | List / bring a contractor onto the project |
| GET/POST | `/projects/{id}/suppliers` | List / register an RMC supplier (contractor side) |
| GET/POST | `/projects/{id}/labs` | List / register a testing lab (contractor side) |
| GET | `/projects/assigned` | A contractor org's project links (accept screen) |
| POST | `/projects/assigned/{pc_id}/accept` \| `/decline` | Contractor admin responds |

### Feature endpoints (all project-scoped under `/projects/{id}`)

| Area | Endpoints | Who |
|------|-----------|-----|
| Catalog/setup | `/grades`, `/components`, `.../towers`, `.../floors`, `.../mix-designs` | viewer / managers |
| Pours | `GET/POST .../pours`, `PATCH .../pours/{id}/complete` | QE |
| RMC dispatch | `POST .../dispatches` (QE) · public `/external/dispatch?token=` (supplier fill) · `.../gate/{token}` arrive/accept/reject (SUPERVISOR) | mixed |
| Cube tests | `POST .../pours/{pid}/samples`, `POST .../samples/{sid}/tests` (QE) · `GET .../samples`, `.../ncrs` | QE / viewer |
| NCR lifecycle | `GET .../ncrs[/{id}]` · `PATCH .../ncrs/{id}`, `.../corrective-actions`, `.../penalties` (QE) | viewer / QE |
| **AI suggestions** | `GET .../ncrs/{id}/ai-suggestion` (viewer) · `POST` generate, `POST .../apply` (QE) | viewer / QE |
| Analytics | `GET .../analytics/{overview,quality,suppliers}` | viewer |
| Traceability | `GET .../trace/search?q=`, `GET .../trace/{sample_id}` | viewer |
| Documents | `POST` (upload) · `GET` list · `GET .../download` · `DELETE` | viewer |
| **AI analyst** | `POST .../chat` (natural-language Q&A over the metrics layer) | viewer |

The IS 456 verdict is computed by a pure `core/quality_engine.py` (PASS / FAIL /
CRITICAL_FAILURE); a failing test auto-raises an NCR. The AI agent
(`app/ai/`, LangGraph + Ollama) answers questions through read-only tools over the
analytics/traceability/NCR services — no text-to-SQL. AI suggestions retrieve
similar past **closed** NCRs (embeddings + Python cosine) to ground a root-cause
suggestion, human-in-the-loop.

### Role model
```
Org roles:     CLIENT_ADMIN, CLIENT_USER, CONTRACTOR_ADMIN, CONTRACTOR_USER,
               PROJECT_MANAGER, QUALITY_ENGINEER, SUPERVISOR
Org invites (/auth/invite):
  CLIENT_ADMIN      → CLIENT_USER
  CONTRACTOR_ADMIN  → CONTRACTOR_USER, PROJECT_MANAGER, SUPERVISOR, QUALITY_ENGINEER
  CONTRACTOR_USER   → PROJECT_MANAGER, SUPERVISOR, QUALITY_ENGINEER

Project flow:
  CLIENT_ADMIN  creates project + assigns CLIENT_LEAD members
  CLIENT_LEAD   brings on a contractor (project link starts PENDING)
  CONTRACTOR_ADMIN  accepts the project + assigns CONTRACTOR_LEAD members
  CONTRACTOR_LEAD   registers suppliers/labs + assigns PROJECT_MANAGER/QE/SUPERVISOR
```

## Docker

```bash
# build from the repo root or backend/
docker build -t qms-backend backend
docker run --rm -p 8000:8000 --env-file backend/.env qms-backend
```
The image is a multi-stage uv build, runs as a non-root user, and serves
`app.main:app` on port 8000. Provide configuration via `--env-file` / runtime env —
secrets are never baked into the image.

## Notes

- **`UV_LINK_MODE=copy`** is required for `uv` here (OneDrive-backed `.venv`,
  hardlink os error 396). Set ambient for Claude Code in `.claude/settings.json`.
- **AI is optional at runtime.** The agent + suggestions call a local Ollama
  (`qwen2.5:3b`, `nomic-embed-text`); on CPU a turn is ~5–15s. The build and tests
  never need it — the LLM/embedder are faked via dependency overrides. RAG is
  **pgvector-free** (embeddings stored as `float[]`, cosine in Python) behind a
  swappable seam; it can move to pgvector later without touching the API.
- **Migrations are hand-written**, not autogenerated, and every schema change is
  mirrored on the model so the test schema (`create_all`) matches.
- **bcrypt** is pinned to `4.0.1` for passlib compatibility; the
  `(trapped) error reading bcrypt version` warning is harmless.
- Adding a value to an existing PostgreSQL enum needs a manual migration step:
  `op.execute("ALTER TYPE schema.enumname ADD VALUE IF NOT EXISTS 'NEW_VALUE'")`.
