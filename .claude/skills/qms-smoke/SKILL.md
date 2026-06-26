---
name: qms-smoke
description: Boot the Strata backend and smoke-test the live HTTP API (auth → project → an endpoint flow), optionally exercising the AI features against real Ollama. Use to confirm a change works against a running server, not just in tests.
---

# Smoke-test the live Strata API

Drives the real server over HTTP — complements the test suite (which stubs the
LLM). Uses existing demo data; **do not wipe the DB** unless asked.

## Steps

1. **Check demo data exists** (so you have a project + NCRs to hit). Query
   `construction_db` for `auth.users LIKE '%demo%'` and `master.projects`. If
   absent, run `UV_LINK_MODE=copy uv run python scripts/seed_demo.py` (it's
   additive and aborts if the demo org already exists — it never wipes).

2. **Start the server** in the background (from `backend/`):
   `UV_LINK_MODE=copy uv run uvicorn app.main:app --port 8000 --log-level warning`
   Then wait for readiness: poll `GET http://localhost:8000/health` until 200.
   If testing AI, also confirm Ollama: `GET http://localhost:11434/api/tags`.

3. **Drive the flow** (httpx or curl against `http://localhost:8000/api/v1`):
   - `POST /auth/login` (e.g. `qe@buildwell-demo.com` / `Password123!`) → bearer
   - `GET /projects` → pick a project id
   - the endpoints under review, e.g. `GET /projects/{id}/analytics/overview`,
     `GET /projects/{id}/ncrs`
   - AI (real Ollama, ~10–30s/call): `POST /projects/{id}/ncrs/{nid}/ai-suggestion`
     then `…/ai-suggestion/apply`; or `POST /projects/{id}/chat`
   - check an RBAC negative (e.g. a SUPERVISOR hitting a QE-only endpoint → 403)
   Print each step's status code + the key response fields.

4. **Stop the server** when done — find the listener on :8000 and kill it
   (PowerShell: `Get-NetTCPConnection -LocalPort 8000 -State Listen` →
   `Stop-Process -Id <pid> -Force`). Don't leave it running.

## Notes

- Set the HTTP client timeout high (120s+) for AI calls — CPU inference is slow.
- Demo logins (password `Password123!`): `client@skyline-demo.com`,
  `contractor@buildwell-demo.com`, `qe@buildwell-demo.com`,
  `supervisor@buildwell-demo.com`.
