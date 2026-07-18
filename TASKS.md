# TASKS

The single backlog for Strata — everything not yet built lives here. The phased
build (Phases 1–9) is complete; per-phase history is in the user memory and git
log, not this file. Keep it current as you go.

Work an item with the project skills: `/qms-test` to verify, `/qms-migration` for
schema changes, `/qms-smoke` against a live server, the `qms-feature` agent to
scaffold a vertical, `qms-reviewer` before committing. Backend and frontend get
**separate commits**; never commit on `main`.

---

## Cleanup / tech debt

Safe and incremental — the test suite guards all of these.

- [ ] **Split the kitchen-sink type/schema files by domain.**
      `frontend/react-app/src/types/master.ts` (~870 LOC) and
      `backend/app/schemas/master.py` (~430 LOC) bundle every domain, so every
      feature churns them. Split into per-domain modules (projects, pours, cube,
      ncr, analytics, …). Biggest churn-reducer available.

- [ ] **Break up the fat page components.** `pages/NCRDashboard.tsx` (~610 LOC)
      holds the list, detail panel and AI section inline; `LandingPage.tsx` is
      ~760. Extract reusable pieces into `src/components/`.

---

## UI component library — Path B (Tailwind + shadcn/ui)

**Path A is done.** Radix primitives (`Dialog`, `ConfirmDialog`/`useConfirm`,
forwardRef `Button`/`Card`/`Badge`/`Input`/`Select`/`ErrorBox`) live in
`src/components/ui/`, styled with the existing hand-written CSS + token system
(`--gray-*`, `--primary`, `--lp-navy`, … in `index.css`). Focus-trap, `Esc`,
ARIA and keyboard handling are all covered.

Path B is the full visual overhaul. shadcn is Radix underneath, so the mental
model from Path A transfers directly.

- [ ] **Adopt Tailwind + shadcn/ui.** Needs explicit approval — it touches every
      page eventually. Sequence:
      1. Install/configure Tailwind (`tailwind.config`, `postcss`, content
         globs); map the existing CSS-variable tokens into the Tailwind theme so
         colours stay on-brand.
      2. Init shadcn; generate the components needed (Button, Input, Select,
         Dialog, Table, …). Decide: replace `components/ui/*` or run both during
         the transition.
      3. Migrate page-by-page, deleting each page's `.css` as it converts.
         Coexistence mid-migration is fine.
      4. Re-verify every migrated page.

      **Effort:** multi-day, several PRs. **Risk:** medium — a styling-paradigm
      shift with two systems live at once; visual regressions need per-page
      checking. Per the `qms-frontend` skill this is "a deliberate migration, not
      a drive-by." **Buys:** ~40 consistent accessible components, CVA variants,
      theming/dark-mode, fastest long-term UI velocity.

      **Constraint to re-check first:** `vite.config.ts` sets
      `cssCodeSplit: false` (with a global CSS import in `main.tsx`) because
      route-level code-splitting loaded shared CSS per-chunk and left pages
      unstyled on a direct reload. Don't assume that still holds after Tailwind.

---

## Analytics rollup — Phase 6b (design recorded, not built)

Analytics ship **live aggregation**: `AnalyticsService` runs `GROUP BY` straight
against the transactional tables (project-scoped, indexed). At current volumes
that is correct and simplest. This section records the seam so moving to
pre-aggregated rollups is a drop-in.

**What makes it a drop-in:** every metric goes through `AnalyticsService` and no
router or page writes aggregation SQL, so only the *insides* of those methods
change — signatures, `schemas/analytics.py` DTOs, routers, frontend and the AI
query layer are untouched. `TraceabilityService` is point-lookup plus a bounded
FK walk; it never needs rollups.

- [ ] **Build the rollups when volume demands it.** A daily fact-rollup keyed by
      the dimensions metrics slice on:

      ```
      quality_rollup(
          project_id, day,            -- daily grain; aggregate up to month/qtr
          tower_id, grade_id, supplier_id,
          test_count, pass_count, fail_count, critical_count,
          sum_strength,               -- AVG = sum_strength / test_count
          PRIMARY KEY (project_id, day, tower_id, grade_id, supplier_id)
      )
      ```

      Plus `dispatch_rollup` (truck accepted/rejected/total per project/day) and
      `ncr_rollup` (open/under_review/closed + closed-duration sums). Any
      dashboard dimension is a `GROUP BY` subset of these keys; drill-down past
      the lowest grain falls back to the raw facts.

      **Refresh:** near-real-time is acceptable, so schedule rather than
      synchronise — a `pg_cron` job recomputes the current and previous day every
      few minutes (`INSERT … ON CONFLICT … DO UPDATE`); closed past days are
      immutable. A `MATERIALIZED VIEW` + `REFRESH … CONCURRENTLY` is the
      alternative if the logic stays expressible as one view, but the incremental
      upsert scales better once the fact tables are large.

- [ ] **Partition the fact tables** (the 100M-row insurance). Range-partition by
      time (monthly), keeping the project-scoped composite indexes per partition:
      `transaction.pours` by `pour_date`, `quality.cube_tests` by `test_date`,
      `transaction.truck_dispatches` by `created_at`. Old partitions detach and
      archive; date-filtered queries prune to a few partitions.

      **Trigger for both:** watch p95 latency on `/analytics/*` and the row
      counts of `cube_tests` / `pours` / `truck_dispatches`. When live
      aggregation crosses the latency budget (or those tables reach tens of
      millions), do the rollups first — biggest win, smallest change — then
      partitioning.

---

## Deferred (needs infra, a decision, or an external dependency)

- [ ] **Persistent file storage.** Uploads are ephemeral on the current host, so
      mix-design and lab-report PDFs are lost on restart/redeploy while their DB
      rows survive. `app/core/storage.py` is already S3-shaped — put Cloudflare
      R2 or Supabase Storage behind it when persistence matters. See
      `DEPLOYMENT.md`.

- [ ] **IP-based rate limiting.** Per-account limits are all in place (OTP
      brute-force cap, 60s resend cooldown, login attempt cap + lockout). What's
      left is genuinely infra: a flood across *many* addresses needs
      request-level throttling middleware (slowapi/Redis), which a per-account
      counter structurally can't cover. Pick the mechanism first.

- [ ] **Content-Security-Policy.** `vercel.json` sets `X-Content-Type-Options`,
      `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` but no CSP —
      a useful one must name the backend origin in `connect-src`, and that origin
      is a per-deploy build var (`VITE_API_BASE_URL`). Add it once the backend
      host is stable. The refresh token lives in `localStorage` for 7 days, so a
      CSP is the main thing that would blunt a future XSS.

- [ ] **Automated lab-report reminders (7/14/28-day).** The token flow is live
      and reminders are manual today (the QE clicks "resend report link", per
      `routers/cube_tests.py::resend_report_link`). Automating the nudge needs a
      scheduler — APScheduler in-process, or a `scripts/` runner on Task
      Scheduler/cron — that sweeps samples whose milestone is due and re-emails
      the lab. `send_lab_report_request_email(..., is_reminder=True)` already
      exists; only the scheduling layer is missing.

- [ ] **Swap RAG retrieval to pgvector when available.** Retrieval is
      pgvector-free (float[] + Python cosine) behind a swappable seam because
      pgvector isn't installed. When it is, move similarity into the DB —
      localised to the embedding repo and retrieval, no API/DTO change.

- [ ] **NDT / retest analytics.** The `Retest` model stores only a derived
      `observed_strength_mpa` per `retest_type` (CORE_CUTTING / REBOUND_HAMMER /
      UPV), not the raw readings — rebound number, UPV velocity, core L/D ratio.
      Real NDT statistics (rebound-number → strength correlation, SonReb,
      IS 13311 quality-grade classification, per-tower histograms) need a schema
      extension first, plus a decision on whether NDT hangs off an NCR retest or
      becomes a standalone project-scoped survey. Reference material:
      `~/Downloads/NDT statistics graph - by asifa 2021.xlsx`,
      `Graph algorithm for cortex software.xlsx`, `statistics-rebound-example.pdf`.

- [ ] **PDF-driven auto-fill (product vision).** Upload a PDF on a
      document-bearing entity → auto-fill its form fields. Upload button on those
      entities, never on pours. The mix design already carries the full detailed
      form plus a mandatory PDF per record; auto-fill *from* that PDF is what
      remains.

---

## Recently done

Phases 1–9 (pours → dispatch/gate → cube/IS-456 → NCR lifecycle →
analytics/traceability → documents → AI analyst agent → AISuggestion/RAG), the
90-minute placement window and date-integrity rules, RMC-owned QE-approved mix
designs, the QE in-situ slump gate with its polled inbox, document review, the
conformance analyser, and the full analytics suite (graphical summary, outlier
scan, code-standard selector, clarifying analyst agent).

**2026-07-18 — whole-codebase audit: 26 findings, all fixed.** The ones carrying
lasting design constraints, so they aren't undone by accident:

- Supplier/lab confirmation tokens **expire and are single-use**
  (`app/core/external_tokens.py`, migration `a1c3e5f7b9d2`), and **blocking an
  entity revokes its tokens**. Per-sample lab report tokens are refused in
  `CubeService` because they live on the sample, not the lab.
- `auth_service._register_failed_login` is the **second documented exception** to
  the flush-only rule — it must `commit()` or `get_db` rolls the attempt counter
  back and the login cap never bites.
- **Registration deliberately cannot reveal whether an address has an account** —
  identical 201 either way, with an out-of-band email. Don't "improve" it back
  into a 409.
- Logout revokes the refresh token; the frontend clears the React Query cache and
  chat transcripts on sign-out (a shared site tablet leaked the previous user's
  data to the next one).
