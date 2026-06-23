---
phase: 26
plan: "06"
subsystem: dispatch-control
tags: [registry, auto-publish, review-gate, convex, dashboard]
one_liner: "Charity registry UI with status management and friction-gated auto_publish toggle with persistent alarming banner"
dependency_graph:
  requires: [26-01, 26-02]
  provides: [REG-01, RVW-04]
  affects: [dispatch-control dashboard layout, config page, registry page]
tech_stack:
  added: []
  patterns:
    - "Inline modal (no external Dialog library) — matches Phase 24 PromptSaveDialog pattern"
    - "Client/Server boundary: Server Component page passes workspace_id to client trigger wrapper"
    - "Non-dismissible modal: Escape key stopped with onKeyDown, no outside-click handler"
key_files:
  created:
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialog.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialogTrigger.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx
    - apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/config/page.tsx
    - apps/dispatch-control/app/(dashboard)/layout.tsx
    - convex/_generated/api.d.ts
decisions:
  - "AddCharityDialogTrigger wrapper added (not in plan) — required to maintain Server/Client boundary since registry/page.tsx is a Server Component but the dialog state is client-side"
  - "AutoPublishToggle placed in a separate Advanced panel below AutomationPanel (not inside it) — avoids modifying Phase 25 AutomationPanel while still satisfying UI-SPEC Screen 4 placement"
  - "Non-dismissible modal implemented via Escape key stopPropagation + no outside-click handler (no Radix Dialog needed — inline modal matches existing project pattern)"
metrics:
  duration: "7 min"
  completed: "2026-06-23"
  tasks: 2
  files: 10
requirements_satisfied: [RVW-04, REG-01]
---

# Phase 26 Plan 06: Dashboard Registry + Auto-publish Summary

## What Was Built

Charity registry management UI (REG-01) and friction-gated `auto_publish` toggle (RVW-04) for `apps/dispatch-control`.

**Registry (`/registry`):** Replaces the Phase 26 placeholder with a full management UI. The `RegistryTable` component subscribes to `charities:listByWorkspace` and renders filter pills (All/Candidates/Featured/Blocklisted), a status-badged table with featured counts and relative timestamps, inline blocklist confirmation popover naming the charity explicitly ("The Scout will skip [name] in all future runs."), and unblocklist action. `AddCharityDialog` calls `charities:upsertCandidate` with `runId: "manual"` so manual adds enter as candidates. `CharityStatusBadge` uses text + color for all three states (WCAG: color is additive, not sole signal).

**Auto-publish toggle (`/config` Advanced subsection):** `AutoPublishToggle` reads `pipelineConfig:getAll` and calls `pipelineConfig:setAutoPublish({workspace_id, enabled, actorId})`. Disabling is immediate. Enabling opens a non-dismissible modal (no X, no outside-click, Escape blocked) with the exact UI-SPEC copy. Rate-limit error ("Wait 24 hours before re-enabling.") is caught and surfaced from the mutation's `rate_limited` throw. The toggle button is always rendered in destructive-red style per UI-SPEC Screen 4.

**Auto-publish banner (`layout.tsx`):** `AutoPublishBanner` is injected at the top of every dashboard page. Renders a `border-red-200 bg-red-50 text-red-700 role="alert"` banner with "Change in Config" link when `auto_publish === true`; renders nothing when disabled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `charities` module missing from `convex/_generated/api.d.ts`**
- **Found during:** Task 1 typecheck
- **Issue:** Plan 26-01 added `convex/charities.ts` but the generated `api.d.ts` (which is updated by `npx convex dev`) did not include it, causing `api.charities.*` references to fail typecheck
- **Fix:** Added `import type * as charities from "../charities.js"` and `charities: typeof charities` to `convex/_generated/api.d.ts`
- **Files modified:** `convex/_generated/api.d.ts`
- **Commit:** 66c05cc

**2. [Rule 2 - Missing] `AddCharityDialogTrigger` wrapper component added**
- **Found during:** Task 1 — registry/page.tsx is a Server Component but dialog open-state is client-side
- **Issue:** Cannot render `useState` directly in a Server Component page; need a client wrapper for the trigger + dialog
- **Fix:** Created `AddCharityDialogTrigger.tsx` as a `'use client'` component that wraps the open/close state and renders `AddCharityDialog` in a backdrop overlay
- **Files modified:** `apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialogTrigger.tsx`
- **Commit:** 66c05cc

## Known Stubs

None — all data sources are wired to live Convex queries/mutations.

## Self-Check: PASSED

All created files exist on disk. Both plan commits verified in git log:
- `66c05cc` — feat(26-06): build charity registry page
- `8e0ba14` — feat(26-06): auto_publish toggle with friction modal + persistent red banner
