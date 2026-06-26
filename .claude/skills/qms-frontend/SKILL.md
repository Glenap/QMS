---
name: qms-frontend
description: Improve the Strata frontend — UI/UX polish, accessibility, consistency, and component extraction — for a given page or component, the right way for this repo. Use when asked to make the UI better, clean up a page, improve UX/accessibility, or extract components. Also covers the recommended (optional) library adoptions.
---

# Make the Strata frontend better

The app works but the UI carries debt: fat page components (400–600 LOC with list +
detail + forms inline), a nearly-empty `src/components/`, hand-rolled
`useEffect`/`useState` data loading and manual forms, and accessibility gaps in the
custom panels/menus. This skill is the workflow to improve a target without a
framework rewrite. Work **one page/component at a time**, keep `tsc` green, verify
visually.

## Before touching anything

- Read the target file and the `components/ui/` primitives (`Card`, `Button`,
  `Badge`, `Input`, `Select`) — reuse them, don't reinvent.
- Read the relevant page's CSS and `index.css` for existing design tokens (CSS
  variables like `--gray-*`, `--primary`, `--lp-navy`). Reuse tokens; don't
  hardcode new colors.
- Note the data + role flow: `useProject()` for the active project, `useAuth()` for
  role gating, `api/*` for calls.

## The improvement checklist (apply what's relevant)

1. **Design-system consistency** — replace ad-hoc inline-styled elements with the
   `ui/` primitives and existing tokens. If a pattern repeats (a stat card, a
   filter bar, a status badge map), extract it to `components/`. Kill magic colors
   and one-off spacing.
2. **Component extraction** — split fat pages: a 600-LOC page with an inline detail
   panel + forms should become `<XList>`, `<XDetail>`, `<XForm>` under
   `components/` or a page-local folder. Smaller files, testable units, reuse.
3. **UX states** — every async view needs explicit **loading** (skeleton/spinner),
   **empty** ("no NCRs yet"), and **error** states; disable/spin buttons while
   `busy`; confirm destructive actions. Don't leave a blank flash on load.
4. **Accessibility** — semantic elements (`button`, not clickable `div`); labels
   tied to inputs; keyboard operability; focus trap + `Esc` close + `aria-*` on
   modals/menus/disclosures (use a primitive lib for these — see below); visible
   focus rings; sufficient contrast.
5. **Responsiveness** — tables/grids shouldn't overflow on narrow widths; use the
   responsive grid utilities already in the CSS (`auto-fit` patterns).
6. **Feedback** — prefer a toast for transient success/error over a persistent
   inline box where it makes sense.
7. **Performance** — memoize expensive derived lists; stable callbacks for rows;
   avoid refetch storms (a query lib handles this — see below).

## Recommended libraries (optional, adopt incrementally)

Adopt these per-feature; they don't require a rewrite or Tailwind:

- **@tanstack/react-query** — replace the manual `useEffect` load/`useState`/loading
  boilerplate (and the disabled `set-state-in-effect` lint). Caching, refetch,
  dedupe, and clean loading/error state. **Highest ROI.**
- **react-hook-form + zod + @hookform/resolvers** — replace manual controlled-form
  state and ad-hoc validation in the big forms (pours, mix designs, project setup).
- **@radix-ui/react-\*** (dialog, dropdown-menu, tabs, tooltip, popover) — accessible
  *unstyled* primitives you style with the existing CSS. Fixes the a11y gaps in the
  hand-rolled panels/menus without adopting a UI kit.
- **sonner** (or react-hot-toast) — toast notifications to replace inline error divs.
- **@tanstack/react-table** — for the many sortable/filterable data tables.
- **eslint-plugin-jsx-a11y** — catch accessibility issues at lint time.

Bigger commitment (only with the user's go-ahead): **Tailwind + shadcn/ui** gives a
polished, consistent, accessible component set, but it's a styling-paradigm shift
from the current hand-written CSS — propose it as a deliberate migration, not a
drive-by.

## Verify before calling it done

- `npx tsc -b` clean (the gate) and `npx eslint` clean on touched files.
- Run it: `npm run dev` and check the page actually renders + behaves (use the
  `/run` or `/verify` skill, or screenshot). Loading/empty/error states included.
- No behavior regressions: the same data still loads, the same role gates still
  apply (backend is the authority — don't show actions that 403).
