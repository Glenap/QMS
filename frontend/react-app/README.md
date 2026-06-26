# Strata — Frontend

The React + Vite + TypeScript single-page app for the Strata Construction QMS. It
talks to the FastAPI backend (see [`../../backend/README.md`](../../backend/README.md))
through a thin typed API layer.

## Tech stack

| | |
|---|---|
| Framework | React 19 + TypeScript |
| Build/dev | Vite (dev server on **:3000**, proxies `/api` → backend `:8000`) |
| Routing | React Router |
| HTTP | axios (`api/client.ts`, with auth headers + token refresh) |
| Charts | Recharts |
| Icons | lucide-react |
| Styling | hand-written CSS + a small set of UI primitives (no CSS framework) |

## Setup

```bash
npm install
npm run dev        # http://localhost:3000 (expects the backend on :8000)
```

The dev server runs on **:3000** because the backend's `FRONTEND_URL` points there,
so OTP / invitation / dispatch email links resolve, and Vite proxies `/api` to the
backend.

## Scripts

```bash
npm run dev        # Vite dev server (HMR)
npm run build      # tsc -b && vite build
npm run preview    # preview the production build
npm run lint       # eslint
npx tsc -b         # type-check — THE gate; must be clean before shipping
```

> **`npx tsc -b` is the real quality gate.** `npm run lint` is informational.

## Structure

```
src/
├── api/            # one module per backend router (thin axios wrappers)
│   └── client.ts   # axios instance: base URL, auth header, 401 refresh
├── pages/          # route-level screens
│   └── project/    # the per-project workspace (pours, cube, NCR, analytics, …)
├── components/
│   ├── layout/     # Sidebar, ProjectLayout (provides project via useProject())
│   └── ui/         # primitives: Card, Button, Badge, Input, Select
├── hooks/          # useAuth, …
├── lib/            # roles, small helpers
├── types/          # TypeScript types mirroring the backend Pydantic schemas
└── context/        # AuthContext
```

### Conventions

- **`api/*` mirrors the backend routers 1:1.** Add a backend endpoint → add its
  wrapper here with the same request/response shape. Types in `src/types/` mirror
  the Pydantic models exactly (field names + nullability).
- **The backend is the authority on permissions.** Client-side role checks
  (`user?.role === 'QUALITY_ENGINEER'`) only hide UI you'd otherwise 403 on.
- **Reuse `components/ui/` primitives** and Recharts/lucide — don't add a UI kit
  without a deliberate decision (see the UI/UX notes below).
- The project workspace is wrapped by `ProjectLayout`, which exposes the active
  project via the `useProject()` context; the sidebar is route-aware.

## State of the UI & where it's going

The functional surface is complete, but the UI carries known debt (tracked in the
repo-root [`TASKS.md`](../../TASKS.md)):

- **Fat page components** — several pages exceed 400–600 LOC with list + detail +
  forms inline; `src/components/` is nearly empty. Extract reusable pieces.
- **Hand-rolled data loading & forms** — pages repeat `useEffect`/`useState`
  load-and-set patterns and manual controlled-form state.
- **A11y gaps** — custom expandable panels / inline error boxes aren't built on
  accessible primitives (focus management, keyboard nav, ARIA).

The `/qms-frontend` Claude skill captures the improvement workflow and a
recommended (optional) library set — TanStack Query for data fetching,
react-hook-form + zod for forms, Radix primitives for accessible
dialogs/menus/tabs, and a toast system — adoptable incrementally without a
framework rewrite.
