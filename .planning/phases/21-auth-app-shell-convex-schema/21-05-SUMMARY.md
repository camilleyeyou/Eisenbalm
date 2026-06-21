---
phase: 21-auth-app-shell-convex-schema
plan: "05"
subsystem: dispatch-control
tags: [app-shell, navigation, sidebar, clerk, auth]
dependency_graph:
  requires: ["21-01", "21-03"]
  provides: ["app-shell-nav", "dashboard-routes"]
  affects: ["22", "23", "24", "25", "26", "27"]
tech_stack:
  added: []
  patterns:
    - "Route-group (dashboard) layout wrapping all dashboard routes"
    - "NAV_ITEMS single source of truth (lib/nav.ts) for nav coverage"
    - "usePathname active-route highlighting in AppSidebar"
    - "Clerk UserButton pinned in sidebar footer"
key_files:
  created:
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/components/AppSidebar.tsx
    - apps/dispatch-control/app/(dashboard)/layout.tsx
    - apps/dispatch-control/app/(dashboard)/page.tsx
    - apps/dispatch-control/app/(dashboard)/graph/page.tsx
    - apps/dispatch-control/app/(dashboard)/runs/page.tsx
    - apps/dispatch-control/app/(dashboard)/config/page.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/page.tsx
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx
    - apps/dispatch-control/app/(dashboard)/finance/page.tsx
    - apps/dispatch-control/app/(dashboard)/settings/page.tsx
    - apps/dispatch-control/__tests__/nav.test.ts
  modified: []
decisions:
  - "Hand-rolled accessible <nav> sidebar (flex column) — shadcn Sidebar primitive not needed for this simple layout; reduces dependency footprint"
  - "Active-route check uses startsWith(href + '/') in addition to exact pathname match to handle future sub-routes"
  - "nav.test.ts imports fs directly and resolves page paths from __dirname — avoids mocking and proves real file existence"
metrics:
  duration: "4 min"
  completed: "2026-06-21"
  tasks_completed: 2
  files_created: 12
---

# Phase 21 Plan 05: App Shell — Nav, Sidebar, Placeholder Routes Summary

**One-liner:** Persistent left sidebar with 7-item nav (Graph-first), active-route highlighting, Clerk UserButton chrome, and 7 real placeholder pages each routing to a phase-labeled stub — automated nav-coverage test prevents dead links.

## What Was Built

### Task 1: Nav source-of-truth, sidebar chrome, dashboard shell layout (commit aba5f72)

- `lib/nav.ts` — `NAV_ITEMS: NavItem[]` array (7 items, D-07 order: Graph/Runs/Config/Prompts/Registry/Finance/Settings), typed with `LucideIcon`, single import point for sidebar and tests.
- `components/AppSidebar.tsx` — `'use client'` component; `usePathname()` for active-route highlighting; `<Link>` per nav item with `≥44px` min-height, `focus-visible` ring, `aria-current="page"` on active; `<UserButton />` pinned in footer (D-10); neutral Tailwind classes consistent with shadcn neutral base.
- `app/(dashboard)/layout.tsx` — Server Component flex-row shell: `<AppSidebar />` + single `<main className="flex-1">`. Wraps all dashboard routes; Clerk middleware guards all of them automatically.
- `app/(dashboard)/page.tsx` — `redirect('/graph')` (D-09 — Graph is the default home).

### Task 2: 7 placeholder route pages + nav-coverage test (commit daf5dbf)

- All 7 `app/(dashboard)/{graph,runs,config,prompts,registry,finance,settings}/page.tsx` — Server Components rendering a heading (section name) + a "coming in Phase N" copy line. No dead links, no 404s.
- `__tests__/nav.test.ts` — 4 assertions: (1) NAV_ITEMS has exactly 7 items, (2) Graph is first, (3) exact label/href order matches D-07, (4) every href resolves to a real `page.tsx` on disk via `fs.existsSync`. All 4 pass; existing 12 tests still green.

## Verification

- `pnpm --filter dispatch-control typecheck` — exits 0 (both tasks).
- `pnpm --filter dispatch-control test:unit` — 16 passed, 2 todo (skipped workspace-upsert), nav test 4/4.

## Deviations from Plan

### Auto-fixed Issues

None.

### Intentional Adjustments

**1. [Rule 2 - Improvement] Optional chaining on NAV_ITEMS[0] in nav.test.ts**
- **Found during:** Task 2 typecheck
- **Issue:** TypeScript `noUncheckedIndexedAccess` / strict mode flagged `NAV_ITEMS[0].label` as possibly undefined (array element access can return undefined under strict tsconfig)
- **Fix:** Changed to `NAV_ITEMS[0]?.label` and `NAV_ITEMS[0]?.href` — semantically equivalent in vitest assertions (undefined !== 'Graph', so the test still catches regressions)
- **Files modified:** `apps/dispatch-control/__tests__/nav.test.ts`
- **Commit:** daf5dbf

**2. Hand-rolled sidebar instead of shadcn Sidebar primitive**
- **Reason:** The shadcn `Sidebar` primitive is a full collapsible/mobile sidebar system. This layout is a simple persistent left nav — a hand-rolled flex column is 30 lines vs. installing a 400-line component with a Sheet + cookies + mobile-breakpoint logic that no phase currently uses.
- **Impact:** Zero — same visual result, less dependency surface. The shadcn `Sidebar` can be adopted later if mobile collapse is needed (Phase 28+).

## Known Stubs

All 7 route pages are intentional placeholder stubs per D-07. Each names its owning phase:

| Route | Stub | Owning Phase |
|-------|------|--------------|
| /graph | "coming in Phase 23" | Phase 23 (node wrappers, agent_runs) |
| /runs | "coming in Phase 23" | Phase 23 (run history) |
| /config | "coming in Phase 22" | Phase 22 (config externalization) |
| /prompts | "coming in Phase 24" | Phase 24 (prompt editor) |
| /registry | "coming in Phase 26" | Phase 26 (charity registry) |
| /finance | "coming in Phase 27" | Phase 27 (Stripe reconciliation) |
| /settings | "coming in Phase 28" | Phase 28 (RBAC, multi-tenancy) |

These stubs are the plan's intended output (D-07). Each later phase replaces its stub with the real view.

## Checkpoint: Awaiting Human Verification

Plan 05 has a `checkpoint:human-verify` gate after Task 2. The automated work is complete; human sign-off is required before this plan is marked done.

**Verify:**
1. `pnpm --filter dispatch-control dev` (and `pnpm --filter @eisenbalm/convex dev`), sign in.
2. Confirm redirect to /graph from the dashboard index.
3. Confirm 7 sidebar items in order: Graph, Runs, Config, Prompts, Registry, Finance, Settings.
4. Click each → rendering placeholder page (no 404, no blank).
5. Confirm active item is visually highlighted.
6. Confirm Clerk UserButton appears and opens account/sign-out menu.

## Self-Check: PASSED
