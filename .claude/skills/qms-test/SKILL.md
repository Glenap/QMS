---
name: qms-test
description: Run the Strata backend test suite and lints the correct way for this repo (uv + UV_LINK_MODE=copy, suite in the background, ruff, and the frontend tsc/eslint gates). Use when asked to run tests, check the suite is green, or verify a change before committing.
---

# Run the Strata checks

This repo has env quirks that make a naive `pytest`/`npm test` fail or hang. Run
the checks exactly as below.

## Backend (from `backend/`)

The suite is ~2 min and `uv` needs `UV_LINK_MODE=copy` (the env var is set in
`.claude/settings.json`, but include it to be safe). **Run the suite in the
background** so a foreground tool cap can't kill it mid-run.

1. Lint first (fast): `UV_LINK_MODE=copy uv run ruff check app/ tests/`
2. Full suite, in the background:
   `UV_LINK_MODE=copy uv run pytest -q`
   - Targeted run while iterating:
     `UV_LINK_MODE=copy uv run pytest tests/integration/test_<x>.py -q`
3. Report the pass/fail count and any failures with their `assert` output. The
   suite is green at 201 tests today — a drop means a regression.

Notes:
- Tests never call Ollama; the LLM/embedder are stubbed via dependency
  overrides. If a test starts taking ~10s+, it's wrongly hitting a real model —
  fix the override.
- Don't "fix" a flaky-looking hang by retrying — see the backend env notes about
  leaked `idle in transaction` Postgres connections.

## Frontend (from `frontend/react-app/`)

1. Type gate (the real one): `npx tsc -b` — must be clean.
2. Lint the touched files: `npx eslint src/<files>`

## Done means

Backend: ruff clean + full suite green (stated count). Frontend: `tsc -b` clean +
eslint clean on changed files. State each result plainly; if something failed,
show the output rather than claiming success.
