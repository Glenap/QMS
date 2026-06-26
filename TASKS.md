# TASKS

Living backlog for Strata. The phased build (Phases 1–9) is **complete** — see the
per-phase history in the user memory, not here. This file tracks what's left:
cleanup debt and deliberately-deferred work. Keep it current as you go.

## Cleanup / tech debt (safe, incremental — tests guard them)

- [ ] **Split the kitchen-sink type/schema files by domain.** `frontend/.../types/
      master.ts` (~870 LOC) and `backend/app/schemas/master.py` (~430 LOC) bundle
      every domain; every phase churns them. Split into per-domain modules
      (projects, pours, cube, ncr, analytics, …). Biggest churn-reducer.
- [ ] **Shared project-role dependency.** `_ensure_quality_engineer` is duplicated
      in `routers/{ncrs,cube_tests,ai_suggestions}.py`. Extract a
      `require_project_role(...)` dependency (mirror the `require_role` factory in
      `core/dependencies.py`) and delete the copies.
- [ ] **Break up the fat page components.** `pages/NCRDashboard.tsx` (~610 LOC)
      holds the list + detail panel + AI section inline; `LandingPage.tsx` (~760).
      Extract reusable pieces into `src/components/` (which is currently nearly
      empty).

## Deferred (needs infra, a decision, or an external dependency)

- [ ] **Register/resend rate-limiting by IP.** OTP brute-force cap + 60s resend
      cooldown are done; bombing via *varying* emails still needs request-level
      (IP) throttling middleware (e.g. slowapi/Redis). Out of scope for a code
      fix — pick the mechanism first.
- [ ] **Swap RAG retrieval to pgvector when available.** Phase 9 is pgvector-free
      (float[] + Python cosine) behind a swappable seam because pgvector isn't
      installed in Postgres. When it is, move similarity into the DB — localized to
      the embedding repo / retrieval, no API/DTO change.
- [ ] **Analytics rollup (Phase 6b).** Live `GROUP BY` today; the rollup-table +
      partitioning + incremental-refresh design is documented in
      `backend/docs/phase6_analytics_rollup_seam.md`. Build when data volume needs it.
- [ ] **PDF-driven auto-fill (product vision).** Upload a PDF on a document-bearing
      entity → auto-fill all form fields. Upload button on those entities, never on
      pours. Mix-design per-record attachment + the full ~16-field form are
      intentionally left thin until this is built.

## Recently done (for context)

- Phases 1–9 complete (pours → dispatch/gate → cube/IS-456 → NCR lifecycle →
  analytics/traceability → documents → AI analyst agent → AISuggestion/RAG).
- Phase 9 code-review fixes (idempotent apply, schema-drift, unused deps, FE error
  handling) and whole-project hardening (OTP attempt cap + resend cooldown,
  monotonic `age_fraction`, `decode_token` presence check, LIKE-wildcard escaping).

## How to work an item

Use the project skills/agents: `/qms-test` to verify, `/qms-migration` for schema
changes, `/qms-smoke` to check the live API, the `qms-feature` agent to scaffold a
new vertical, and `qms-reviewer` before committing. Backend + frontend get separate
commits; never commit on `main`.
