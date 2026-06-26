# Backend — FastAPI + async SQLAlchemy + Postgres

Scope: this file governs `backend/`. See the repo-root `CLAUDE.md` for the
product overview and cross-cutting rules.

## Environment

- **uv project** (`pyproject.toml` + `uv.lock`, Python pinned `>=3.11,<3.13`).
  Run everything via `uv run …`, and always with **`UV_LINK_MODE=copy`** (the
  `.venv` is on a OneDrive path; hardlinking fails with os error 396). It's set
  in `.claude/settings.json`, but include it when you shell out by hand.
- **Postgres 16 on port 5433.** App DB `construction_db`; tests use
  `construction_test_db`. Connection string is in `.env` (`DATABASE_URL`) — read
  it from there. Five schemas: `auth, master, transaction, quality, audit`.
- **Ollama** (local, CPU-only) powers the AI features at runtime: `qwen2.5:3b`
  (analyst agent + suggestions) and `nomic-embed-text` (RAG embeddings). A live
  agent turn is ~5–15s on this hardware; **tests never call it** (fakes injected).

## Testing

- `UV_LINK_MODE=copy uv run pytest -q` — **run in the background** (~2 min; a
  foreground 2-min tool cap can kill it). 201 tests today.
- Isolation is **transaction-rollback**, not per-test truncate: a single
  connection + outer transaction is rolled back at teardown; the app's `commit()`
  only releases a SAVEPOINT (so a service that must persist across an error —
  e.g. the OTP attempt counter — calls `commit()` deliberately, and it works
  under the savepoint harness). Catalogs are seeded once; bcrypt rounds are
  reduced in the test env.
- AI is stubbed via FastAPI dependency overrides: `get_llm` → a scripted reply,
  `get_embedder` → a deterministic bag-of-words embedder. Follow that pattern for
  anything touching `app/ai/`.
- Tests live in `tests/unit` (pure logic) and `tests/integration` (full HTTP via
  the `client` fixture). Per-feature files reuse each other's setup helpers
  (e.g. phase-5 imports phase-4's `_qe_pour`). `tests/helpers.py` + `tests/mailbox.py`.

## Migrations (Alembic)

Every schema change is **a migration AND a mirror on the model** — the test
schema is built from models via `create_all`, the real DB from migrations, so
both must agree (a mismatch is a real bug we've caught in review).

1. Add/adjust the SQLAlchemy model under `app/models/` (and export it in
   `app/models/__init__.py`).
2. Write the migration in `alembic/versions/` (hand-written here, matching the
   existing style; set `down_revision` to the current head).
3. `UV_LINK_MODE=copy uv run alembic upgrade head` against `construction_db`.
4. Confirm tests still pass (they build the schema from the model).

## Conventions

- **Layering:** router → service → repository → model; Pydantic schemas in
  `app/schemas/` are the DTO boundary. No business logic in routers; no raw SQL
  (ORM only — `ilike` is parameterised and wildcard-escaped).
- **Repos `flush()`, never `commit()`.** `get_db` commits once per request.
- **RBAC:** project access via `app/core/project_access.py` (`require_project`
  dependency + `ensure_can_manage_*`). Role checks like quality-engineer-only are
  currently inline per router — prefer a shared dependency when adding new ones
  (see TASKS.md).
- **Best-effort side effects** (emails) are wrapped so an SMTP failure never
  rolls back the request — `# noqa: BLE001` with a logged fallback link/code.
- Lint with `ruff` (`E,F,I,UP,B`); `zip()` needs `strict=`.
- Keep domain logic out of I/O modules so it stays unit-testable (`quality_engine`,
  `rag`).
