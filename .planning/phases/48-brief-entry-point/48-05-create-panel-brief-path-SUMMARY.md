---
phase: 48-brief-entry-point
plan: 05
subsystem: ui
tags: [react, nextjs, dispatch-control, create-panel, brief-entry, clerk]

# Dependency graph
requires:
  - phase: 48-brief-entry-point (Plan 01)
    provides: "Frozen §48.2 POST /pipeline/run/brief contract (BriefRunBody/OrganizationInput shape) this client posts against"
  - phase: 48-brief-entry-point (Plan 02)
    provides: "CreatePanel.test.tsx Wave 0 scaffold with the skip-guarded second-card assertion block this plan turns GREEN"
provides:
  - "triggerBriefRun client + TriggerBriefRunBody/TriggerBriefRunOrganization interfaces in lib/pipelineControlClient.ts"
  - "CreatePanel.tsx second peer card ('Start from my brief') with inline intake form and handleCreateBrief submit chain"
affects: [48-06-stage1-brief-mode-render, 48-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New pipelineControlClient functions mirror an existing sibling exactly (fetch/auth-header/error-shape/return-type) rather than introducing a new client idiom"
    - "Shared className constants (CARD_CLASS/HEADING_CLASS/BODY_CLASS/BUTTON_CLASS/LABEL_CLASS/FIELD_CLASS/ERROR_CLASS) hoisted to module scope so two visually-peer cards stay byte-identical in styling without duplicating long Tailwind arbitrary-value strings"

key-files:
  created: []
  modified:
    - apps/dispatch-control/lib/pipelineControlClient.ts
    - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx

key-decisions:
  - "Inline-expand (not modal) for the brief intake form — simplest within the 1c token system, matches CONTEXT's 'Claude's discretion' note and keeps the second card self-contained"
  - "The toggle button ('Start from my brief') is replaced by the form + a distinctly-labeled 'Start this run' submit button once expanded, rather than showing both simultaneously — avoids two buttons matching overlapping accessible-name regexes and keeps the peer-card visual weight clean"
  - "Organization website field labeled 'Website (optional)' (not 'Organization website') so it does not also match a getByLabelText(/organization/i) query — keeps exactly one accessible element matching 'organization' per D-09's name+optional-website capture"
  - "Client-side required-field gate (premise/peg/orgName non-empty) disables the submit button so an empty organization.name can never reach the endpoint's 422 — satisfies the plan's explicit anti-422 instruction without any new validation library"
  - "A single shared `error` state renders once below the two-card grid (not duplicated per-card) since both submit paths write to the same state slot"

patterns-established: []

requirements-completed: [ENT-01]

# Metrics
duration: 18min
completed: 2026-07-16
---

# Phase 48 Plan 05: Create-panel brief path (frontend) Summary

**Filled dispatch-control's reserved second Create-panel grid cell with a visual-peer "Start from my brief" card whose inline intake form (premise/peg/organization[+website]/optional source material) submits via a new `triggerBriefRun` client mirroring `triggerRun`, landing at Stage 1 exactly like the existing "Find a story with agents" path.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-16T08:11:00-07:00
- **Completed:** 2026-07-16T08:21:09-07:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `lib/pipelineControlClient.ts` gains `TriggerBriefRunOrganization`, `TriggerBriefRunBody`, and `triggerBriefRun(body, token)` — byte-mirroring `triggerRun`'s fetch/Bearer-auth/error-throw/`TriggerRunResult`-return shape, posting to `POST /pipeline/run/brief` per the frozen §48.2 contract; `triggerRun` itself untouched
- `CreatePanel.tsx`'s reserved-but-absent second grid cell (Phase 40 D-28) now renders a visual PEER card — same card surface, heading, body-copy, and `min-h-[44px]` button styling as "Find a story" (hoisted into shared className constants so the two cards can never silently drift apart)
- Clicking "Start from my brief" reveals an inline form: Premise (required textarea), Peg (required input), Organization name (required input), Website (optional input), Source material (optional textarea)
- `handleCreateBrief` mirrors `handleCreate` exactly in shape: `ensureByNumber` → `getToken()` → `triggerBriefRun({ issueNumber, premise, peg, organization: { name, website? }, sourceMaterial? }, token)` → `router.push(issueHref(nextIssueNumber))`
- Submit button disabled until premise/peg/orgName are all non-empty (trimmed) — an empty `organization.name` can never reach the endpoint's 422
- `CreatePanel.test.tsx`'s Wave 4 second-card block (previously skip-guarded on the absence of the `triggerBriefRun` symbol) is now unconditionally green: two-peer-card render, form-reveal-on-click, and the `ensureByNumber → triggerBriefRun → router.push` ordering + payload assertions all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add triggerBriefRun client to pipelineControlClient.ts** - `43be1f9` (feat)
2. **Task 2: Fill CreatePanel's second cell with the 'Start from my brief' peer card + inline intake form** - `25b2708` (feat)

## Files Created/Modified
- `apps/dispatch-control/lib/pipelineControlClient.ts` - Added `TriggerBriefRunOrganization`/`TriggerBriefRunBody` interfaces + `triggerBriefRun(body, token)` client (sibling of `triggerRun`, posts to `POST /pipeline/run/brief`)
- `apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` - Filled the second grid cell with the "Start from my brief" peer card, inline intake form, `handleCreateBrief` submit chain, and shared styling className constants

## Decisions Made
- Inline-expand (not modal) for the intake form — simplest within the existing 1c token system and keeps the card self-contained; this was explicitly left to Claude's discretion by 48-CONTEXT.
- The "Start from my brief" toggle button is swapped out for the form (and its own "Start this run" submit button) on click, rather than both being shown at once — keeps the two cards' accessible names unambiguous for both users and tests, and avoids a stray disabled-looking CTA once the form is open.
- The organization website field is labeled "Website (optional)" rather than "Organization website" so exactly one form element matches an `/organization/i` query, consistent with D-09's "name + optional website" capture without accidental duplicate matches.
- Client-side required-field validation (premise/peg/orgName trimmed non-empty) gates the submit button — satisfies the plan's explicit instruction that "an empty org never reaches the 422" without introducing a new validation dependency.
- A single shared `error` banner renders beneath both cards (spanning the grid on `sm:` breakpoints) rather than duplicating error UI per card, since `handleCreate` and `handleCreateBrief` write to the same `error` state slot.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were satisfied literally:
- `triggerBriefRun`, `/pipeline/run/brief`, and `TriggerBriefRunBody` all present in `pipelineControlClient.ts`; `triggerRun` occurrence count unchanged (still exactly 1 export).
- "Start from my brief" and `triggerBriefRun` both present in `CreatePanel.tsx`; `handleCreate`/`triggerRun` (first path) unchanged.
- `pnpm --filter dispatch-control test:unit -- CreatePanel` exits 0 (4/4 tests green, including the previously skip-guarded Wave 4 block).

One point of scoped clarification during execution, not a deviation: the plan's `<verify>` for Task 1 used a `tsc | grep || echo` pattern the plan-checker flagged as maskable, and per the plan's own critical-project-rules instruction this was NOT trusted at face value — instead `pnpm exec tsc --noEmit -p tsconfig.json` was run directly (real exit code inspected, no grep-masking) and separately the authoritative `pnpm --filter dispatch-control build` (strict `next build` typecheck) was run and confirmed to exit 0. The raw scoped `tsc --noEmit -p tsconfig.json` surfaces ~221 pre-existing baseline errors repo-wide (confirmed present on `master` before this plan's changes via `git stash`), concentrated in `__tests__/*.tsx`/`*.ts` files with a `(...args: unknown[]) => mock(...args)` spread idiom that `tsc`'s test-tsconfig disagrees with vitest's runtime — none attributable to this plan's two modified files, and `next build`'s own stricter, test-excluding typecheck (the authoritative gate per `[[run-strict-build-before-frontend-phase-done]]`) passed clean.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 48-06 (Stage 1 brief-mode render) can now rely on the console offering a real brief-triggered run to render against — `POST /pipeline/run/brief` is reachable from the UI end-to-end (pending the pipeline-side endpoint from 48-04, already contracted in §48.2).
- 48-07 (integration gate) has both frontend acceptance criteria for ENT-01 satisfied: two equal-weight Create paths, both landing at `issueHref(n)` (Stage 1).
- No blockers. `pnpm --filter dispatch-control build` exits 0; full `pnpm --filter dispatch-control test:unit` is 936 passed / 3 pre-existing skipped (unrelated `workspace-upsert.test.ts`) / 2 todo — no regressions introduced.

---
*Phase: 48-brief-entry-point*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/lib/pipelineControlClient.ts
- FOUND: apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx
- FOUND: 43be1f9 (Task 1 commit)
- FOUND: 25b2708 (Task 2 commit)
