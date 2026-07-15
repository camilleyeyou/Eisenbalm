---
phase: 43-my-tasks-decision-log
plan: 05
subsystem: ui
tags: [nextjs, react, convex, dispatch-control, my-tasks, nav]

# Dependency graph
requires:
  - phase: 43-my-tasks-decision-log (43-03)
    provides: deriveTasks' additive openedAt + formatTaskAge + corrected claim/sign-off hrefs
  - phase: 43-my-tasks-decision-log (43-04)
    provides: computeSessionStates + the screen-local DisplayTask (active/resolved/superseded) predicate
provides:
  - The /my-tasks route + screen (MyTasksScreen.tsx) rendering deriveTasks cross-stage for the current issue
  - MyTasksList — the pure, Convex-free render component (title/where/why/severity/stage/age/rec/primary/Inspect-context per row)
  - Designed empty state ("Nothing needs you" -> Approval) and never-silent superseded/resolved rows
  - Editorial nav "My Tasks" item + AwaitingYouInbox "See all ->" footer link handoff
affects: [44-inspect-panel, 49-permissions-gating]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen assembles DerivationInputs by copying Masthead's self-resolving current-issue query chain verbatim (no shared hook extracted — Masthead still compiles unmodified, same count)"
    - "Pure render component (MyTasksList) exported alongside the Convex-wired default export, so screen states are unit-testable without mocking useQuery"
    - "RerollSignal.href defaults every superseded row's 'new step' link to Draft (issueDraftHref) — the reroll only carries an agentKey, not a stage, so this is the single generic 'go re-review the regenerated content' destination"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx
    - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
    - apps/dispatch-control/__tests__/MyTasksScreen.test.tsx
  modified:
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/components/AwaitingYouInbox.tsx

key-decisions:
  - "Reroll hrefs point to Draft (issueDraftHref) generically, since the audit_log resourceId only carries {runId}:{agentKey} — no per-agent stage is recoverable, and Draft is where regenerated content lands for re-review"
  - "taskSection(task) = task.where verbatim — DerivedTask.where already carries the correct-case section name (snake_case for QA findings, camelCase for claims); computeSessionStates does the qaSectionToGalleyId bridging internally, so no extra mapping is needed at the call site"
  - "AwaitingYouInbox's existing item derivation is untouched — the new 'See all' footer link is a pure addition, kept as a separate narrower projection from /my-tasks' full cross-stage list, per the plan's explicit instruction not to repoint it"

patterns-established:
  - "Inspect context control is rendered as a disabled button with an explanatory title (mirrors ClaimProvenanceCard's disabled Inspect precedent) — visible-but-inert, not hidden, ready for Phase 44 to wire onClick"

requirements-completed: [TSK-01, TSK-02, TSK-03, TSK-04, TSK-05]

# Metrics
duration: 35min
completed: 2026-07-15
---

# Phase 43 Plan 05: My Tasks Screen + Nav Handoff Summary

**Built the /my-tasks screen — a severity-first, cross-stage task list (deriveTasks + computeSessionStates) with a designed empty state, never-silent superseded/resolved rows, and the Editorial-nav + AwaitingYouInbox handoffs the Masthead's count-only readout has always pointed at.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `/my-tasks` route + screen: assembles `DerivationInputs` exactly like `Masthead.tsx`'s self-resolving current-issue chain (`runs.latest -> pipelineRuns.byRunId -> issues.byIssueNumber` + the four run-keyed queries), feeds `deriveTasks(...)`, and wraps the result with `computeSessionStates(...)` fed by client-filtered `run.section_rerolled` audit-log rows.
- `MyTasksList` — the pure render half — renders every task row with title, where, why, a severity label WITH an icon (never color alone), stage, `formatTaskAge`, the agent recommendation when present, a primary deep-link, and a visible-but-inert "Inspect context" control.
- Empty state renders explicit "Nothing needs you." copy plus a link to the current issue's `/approval` — never a bare empty list.
- Superseded rows render struck-through with a "superseded" label and a link to the new step; resolved rows render struck-through "resolved just now".
- Editorial nav gained a "My Tasks" item in its reserved slot; `AwaitingYouInbox` gained a "See all →" footer link to `/my-tasks` — an addition, its existing item derivation is unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED component tests for the screen states** - `edaa4de` (test)
2. **Task 2: Build the /my-tasks screen (assembly + render + session states + Inspect stub)** - `d6294cd` (feat)
3. **Task 3: Nav item + AwaitingYouInbox 'See all' handoff** - `cc36ea3` (feat)

_No TDD refactor commit was needed — Task 2's implementation passed against Task 1's RED tests with only two test-side fixes (an ambiguous text-matcher collision and a text-split-across-elements matcher), no component refactor required._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx` - thin route entry mounting `<MyTasksScreen />`
- `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` - DerivationInputs assembly + `deriveTasks`/`computeSessionStates` wiring + `MyTasksList` pure render component
- `apps/dispatch-control/__tests__/MyTasksScreen.test.tsx` - RED->GREEN fixtures covering empty/active/superseded/resolved row states
- `apps/dispatch-control/lib/nav.ts` - adds `{ label: 'My Tasks', href: '/my-tasks' }` to the Editorial group
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` - adds a "See all →" footer link to `/my-tasks`

## Decisions Made
- Reroll hrefs generically point at Draft (`issueDraftHref`) rather than trying to infer the exact stage per agentKey, since the only queryable reroll signal (`audit_log` resourceId `{runId}:{agentKey}`) carries no stage information.
- `taskSection` is a one-line passthrough of `task.where` — `computeSessionStates` (43-04) already owns the QA/claim vocabulary bridge, so the screen does no additional section-name mapping.
- Did not extract a shared `useCurrentIssueDerivationInputs` hook from Masthead's assembly (left as the plan's stated discretion) — copied the query chain verbatim into MyTasksScreen to keep Masthead's own tests and behavior completely unchanged.

## Deviations from Plan

None - plan executed exactly as written. Two test-authoring adjustments were made while turning Task 1's RED tests GREEN (an ambiguous regex text-matcher and a text-node-split matcher), both confined to the test file/component markup, not scope changes — not deviations against the plan's behavior contract.

## Issues Encountered
- Initial RED-to-GREEN pass hit two RTL query-matcher issues: (1) `getByText(/unknown/i)` regex matched both the age span and a fixture title containing the substring "unknown" — fixed by renaming the fixture title and using an exact-string matcher; (2) `task.why` rendered as a bare text node adjacent to a `<span>` and a literal `' — '` separator, which RTL's `getByText` cannot match (text split across multiple sibling nodes) — fixed by wrapping `task.why` in its own `<span>`. Both fixes are confined to the test file and MyTasksList's markup; no behavior change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/my-tasks` is fully live and reachable from both the Editorial nav and the Masthead inbox's new "See all" link — no dead button, no capability lost, the Masthead's "My Tasks · N" count is unchanged (still `deriveTasks(...).length`).
- The "Inspect context" control is rendered visible-but-inert (disabled button, explanatory title) — ready for Phase 44 to wire its `onClick` into the universal inspector panel without any markup restructuring.
- Primary actions and the Inspect control are kept as identifiable, individually-targetable elements (not merged into a single composite control), so Phase 49's permissions gating can wrap/lock them without further restructuring.

---
*Phase: 43-my-tasks-decision-log*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 5 created/modified files confirmed present on disk; all 3 task commit hashes (`edaa4de`, `d6294cd`, `cc36ea3`) confirmed in `git log`.

## Known Stubs

- **File:** `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx:174-181`
  **What:** The "Inspect context" control on each active task row renders as a permanently `disabled` button with `title="Inspect panel arrives in a future phase — this entry point is reserved (D-16)."`.
  **Reason:** This is an intentional, plan-specified stub (Task 2's action explicitly says "render an 'Inspect context' control that is visible-but-inert ... do NOT build the panel," mirroring `ClaimProvenanceCard.tsx`'s existing disabled-Inspect precedent). Not a gap — the plan's `insp` inspector-artifact field and this entry point exist so Phase 44 (the universal "Inspect how this was made" panel) can wire the `onClick` without any markup restructuring.
