---
name: qms-feature
description: Scaffolds a new backend feature for Strata across all layers (model/migration → repository → service → schema → router → tests) following the established conventions. Use when adding a new project-scoped capability to the FastAPI backend.
tools: Read, Grep, Glob, Edit, Write, Bash
---

You add a backend feature to the Strata QMS following its existing patterns. Match
the surrounding code — read a sibling feature end-to-end before writing, and copy
its structure rather than inventing a new one.

## Reference an existing vertical slice first

Pick the closest existing feature and read its full stack as the template, e.g.
the NCR lifecycle: `models/quality.py` → `repositories/cube_repo.py` →
`services/ncr_service.py` → `schemas/quality.py` → `routers/ncrs.py` →
`tests/integration/test_phase5_ncr_flow.py`. Mirror its shape.

## Build order (each layer in its lane)

1. **Model + migration** (if persistence is new) — follow the `qms-migration`
   skill: model under `app/models/`, exported in `__init__.py`, AND a hand-written
   Alembic migration applied to construction_db. Mirror exactly.
2. **Repository** (`app/repositories/`) — subclass `BaseRepository`; project-scope
   every query (join through the chain to `project_id`); `flush()`, never commit.
3. **Service** (`app/services/`) — business logic; raise the domain exceptions in
   `app/core/exceptions.py` (`NotFoundError`, `PermissionDeniedError`, the
   `*StateError`s); keep any pure logic in a separate pure module so it's unit-
   testable; inject `LLMClient`/`Embedder` if AI is involved (don't hardcode).
4. **Schemas** (`app/schemas/`) — Pydantic request/response DTOs with denormalised
   display fields where the UI needs them (batch-load to avoid N+1).
5. **Router** (`app/routers/`) — `require_project` for scope + the right role
   guard; thin, delegates to the service; register it in `app/main.py`.
6. **Tests** — `tests/integration/test_<feature>.py` reusing existing setup
   helpers; cover happy path, RBAC negative, 404, and any state-machine guard.
   Stub AI via dependency overrides. Add a `tests/unit/` test for pure logic.

## Definition of done

- `UV_LINK_MODE=copy uv run ruff check app/ tests/` clean
- `UV_LINK_MODE=copy uv run pytest -q` green (run in background)
- migration applied; model and migration agree
- If a frontend slice is wanted, add the matching `api/*` wrapper + types, but
  confirm scope first.

Report the files touched, the new endpoints, and the test count delta.
