# Frontend — React + Vite + TypeScript

Scope: this file governs `frontend/react-app/`. See the repo-root `CLAUDE.md` for
the product overview.

## Run & gates

```bash
npm run dev        # Vite dev server on :3000, proxies /api → backend :8000
npx tsc -b         # THE type gate — must be clean before calling work done
npx eslint src/... # lint the files you touched
```

- **`npx tsc -b` is the real gate.** `npm run lint` is informational; tsc is
  what must pass. Always typecheck after changes.
- Dev server is **:3000** (matches `FRONTEND_URL` in the backend so OTP / invite /
  dispatch links resolve). It proxies `/api` to the backend on `:8000`.

## Structure & conventions

- **`src/api/*` mirrors the backend routers 1:1** — thin axios wrappers around
  `api/client.ts` (which handles auth headers + token refresh). When you add a
  backend endpoint, add its wrapper here with the same shape.
- **Types** live in `src/types/` — currently `master.ts` is a large catch-all
  (one interface per backend schema). New DTOs go here mirroring the Pydantic
  response models exactly (field names + nullability). (Splitting it by domain is
  on TASKS.md.)
- **Pages** are under `src/pages/`; the project workspace is `src/pages/project/`,
  wrapped by `components/layout/ProjectLayout.tsx` which provides the project via
  `useProject()` context. The sidebar is context-aware (`useMatch`).
- **Role gates** are client-side conveniences (e.g. `user?.role ===
  'QUALITY_ENGINEER'`) — the backend is the real authority. Mirror the backend's
  RBAC so the UI doesn't offer actions that will 403.
- Reuse the existing UI primitives in `components/ui/` (`Card`, `Button`,
  `Badge`, `Input`, `Select`) and recharts/lucide — don't add a UI framework.
- Pages have grown large (e.g. `NCRDashboard.tsx`); when adding substantial UI,
  prefer extracting a component over inflating a page further (see TASKS.md).

## API error handling

- Use `getApiErrorMessage(err, fallback)` from `api/client.ts` for surfaced
  errors. When a 404 is an expected "none yet" (e.g. an AI suggestion that hasn't
  been generated), swallow **only** the 404 (`axios.isAxiosError(err) &&
  err.response?.status === 404`) and surface everything else.
