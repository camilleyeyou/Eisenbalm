---
phase: 41-issue-workspace-frame
plan: 05
subsystem: ui
tags: [react-context, convex, typescript, vitest, dispatch-control, workspace-frame]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "deriveSectionStates(inputs, draftSectionIds) + draftSectionIdsFromDraft(draft) + SectionState/SectionStateResult from lib/derivedState.ts (Plan 41-01)"
provides:
  - "WorkspaceStateProvider + useWorkspaceState() — the ONE place the Issue Workspace's 8 Convex subscriptions + deriveIssueStatus/deriveStageStates/deriveTasks/estimateWorkMinutes live"
  - "The authoritative-draft-sourced sectionStates contract: getDraft(runId, token) -> draftSectionIdsFromDraft(draft) -> deriveSectionStates, undefined while loading/failed (never an inferred empty set)"
  - "WorkspaceOutline — 5-state label+icon section outline with jump-to-section + loading state + always-visible legend"
  - "ContextPanel — shared collapsible shell with persistent Hide/Show control (localStorage)"
  - "galleyAnchorFor shared into lib/galley/sectionIdMap.ts (de-duplicated on its third use)"
affects: [41-06-workspace-frame-layout-nav, 41-08-stage2-draft-recomposition, 41-09-stage5-approval-publish-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One Context provider per composite screen owns all Convex subscriptions + derivation; every descendant reads via a single hook instead of re-subscribing (41-RESEARCH Pattern 1 / Pitfall 3)"
    - "Authoritative-draft presence source shared by two independent UI surfaces (outline provider here, Stage-2 canvas in 41-08) via the 41-01 draftSectionIdsFromDraft function — disagreement is structurally impossible"
    - "undefined (never an empty collection) as the loading/error sentinel for a derived map, so a not-yet-loaded state can never be silently inferred as a real absence"
    - "SSR-safe localStorage-persisted UI toggle: initial render always assumes the default (shown), a post-hydration useEffect applies the persisted value — avoids hydration mismatches"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx
    - apps/dispatch-control/__tests__/WorkspaceOutline.test.tsx
    - apps/dispatch-control/__tests__/ContextPanel.test.tsx
  modified:
    - apps/dispatch-control/lib/galley/sectionIdMap.ts

key-decisions:
  - "sectionStates is undefined (not an empty Record) whenever the draft is loading or the fetch failed — the outline renders a loading state, never a wall of 'not generated' inferred from absence (the plan-review blocker fix)"
  - "The provider fetches its own getDraft(runId, token) copy (mirroring ReviewDeskRunView.reloadDraft) rather than sharing state with the Stage-2 canvas's own draft fetch — both hit the same endpoint and the same draftSectionIdsFromDraft presence rule, so the accepted minor double-GET cannot cause presence divergence between the two surfaces"
  - "galleyAnchorFor is added as a new shared export in lib/galley/sectionIdMap.ts; the two existing private copies in ReviewDeskRunView.tsx and DecisionRail.tsx are left as-is (explicitly out of scope for this plan) — only the outline consumes the shared export"
  - "ContextPanel's hidden-state persistence uses localStorage (Claude's-discretion mechanism per 41-CONTEXT D-19), guarded with typeof window checks and a post-mount effect so server-rendered and first-hydration markup never mismatch"

patterns-established:
  - "Pattern: composite-screen Context provider owning all Convex subscriptions + derived-state selectors once, exposed via a throw-if-outside-provider hook"
  - "Pattern: a shared presence-source function consumed identically by two independent surfaces, with the consuming surface required to render a loading (not inferred-absent) state whenever that source hasn't resolved yet"

requirements-completed: [WSP-02, WSP-03, WSP-07]

# Metrics
duration: 14min
completed: 2026-07-15
---

# Phase 41 Plan 05: WorkspaceStateProvider + WorkspaceOutline + ContextPanel Summary

**One React Context provider (`WorkspaceStateProvider`) now owns all 8 of the Issue Workspace's Convex subscriptions plus `deriveIssueStatus`/`deriveStageStates`/`deriveTasks`/`estimateWorkMinutes`, and sources its per-section outline signal from the SAME authoritative `getDraft()` fetch the Stage-2 canvas will read — never from side-tables — so the new `WorkspaceOutline` (5-state label+icon list + jump-to-section) and `ContextPanel` (collapsible shell with a persistent Hide control) can never disagree with the canvas about which sections exist.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-15T05:58:00Z
- **Completed:** 2026-07-15T06:11:05Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `WorkspaceStateProvider.tsx` lifts the exact 8-query subscription block + `signOffs` `{}`-on-resolved-no-run normalization + `claimRows` text->claimText mapping out of `issues/[issueNumber]/page.tsx` into a `'use client'` provider, running `deriveIssueStatus`/`deriveStageStates`/`deriveTasks`/`estimateWorkMinutes` exactly once and exposing the results via `useWorkspaceState()` (throws if used outside the provider) — no other frame consumer will re-subscribe to these queries independently (41-RESEARCH Pitfall 3).
- The BLOCKER fix from plan review: the provider additionally fetches the authoritative draft via `getDraft(runId, token)` (token from `useAuth().getToken()`, mirroring `ReviewDeskRunView.reloadDraft`) into local state, and computes `sectionStates = draft ? deriveSectionStates(inputs, draftSectionIdsFromDraft(draft)) : undefined`. While the draft is loading or the fetch failed, `sectionStates` is `undefined` — never an inferred empty set that would mislabel every section 'not-generated'.
- `WorkspaceOutline.tsx` renders one row per `EDITABLE_SECTIONS` entry with a LABEL + ICON 5-state mark (clean/review/must-fix/changed-since-review/not-generated — never color alone), a jump-to-section click handler via the shared `galleyAnchorFor`, and a `data-testid="outline-loading"` state whenever `sectionStates` is `undefined` — guarding the blocker's mirror-image concern (never a wall of "not generated" rows). A legend always shows all five state labels, including `changed-since-review`, which the 41-01 selector never actually produces this phase.
- `galleyAnchorFor(sectionId)` added as a new shared export in `lib/galley/sectionIdMap.ts` (theme -> null, deliberation-conversation -> `galley-deliberation`, else `galley-{id}`) — de-duplicated on this, its third use. The two existing private copies in `ReviewDeskRunView.tsx`/`DecisionRail.tsx` are left untouched (explicitly out of scope per the plan).
- `ContextPanel.tsx` is a shared collapsible shell (`{ title, children }`) with a persistent "Hide panel"/"Show panel" toggle — hidden state renders only a slim "Show panel" affordance, never a blank region — and localStorage persistence under `dc.workspace.contextPanel.hidden`, guarded for SSR (initial render always assumes "shown"; a post-hydration `useEffect` applies the persisted value, avoiding a hydration mismatch). Empty `children` renders the `_PlaceholderScreen`-style "Nothing to show for this stage yet" copy.
- 15 new component tests (7 `WorkspaceOutline`, 8 `ContextPanel`), all green; full `dispatch-control` suite (78 files, 614 passed / 2 todo / 1 pre-existing skip) and `pnpm --filter dispatch-control build` both pass with zero new type errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkspaceStateProvider context (the shared derivation contract)** - `4f99f3d` (feat)
2. **Task 2: WorkspaceOutline — 5-state section list + jump (WSP-02/WSP-07)** - `94b0dc4` (feat)
3. **Task 3: ContextPanel — collapsible shell with Hide control (WSP-03)** - `8d570b1` (feat)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - the shared Convex-subscription + derivation Context provider, including the authoritative-draft-sourced `sectionStates`
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx` - the persistent 5-state section outline + legend + jump-to-section
- `apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx` - the collapsible context-panel shell with a persistent Hide/Show control
- `apps/dispatch-control/lib/galley/sectionIdMap.ts` - adds the shared `galleyAnchorFor` export
- `apps/dispatch-control/__tests__/WorkspaceOutline.test.tsx` - 7 tests: row-per-section, not-generated marker, clean-never-mislabeled guard, must-fix label, loading-state guard, jump-to-section, legend
- `apps/dispatch-control/__tests__/ContextPanel.test.tsx` - 8 tests: content render, empty-children placeholder, hide/show toggle, localStorage persistence + round-trip on fresh mount

## Decisions Made
- `sectionStates` stays `undefined` (never an empty `Record`) while the draft is loading or the fetch failed — this is the load-bearing guarantee the plan's blocker fix required, verified by a dedicated `WorkspaceOutline` test asserting no per-section rows render (only the loading state) when `sectionStates` is `undefined`.
- The provider keeps its own `getDraft` fetch rather than threading the Stage-2 canvas's draft state down — both independently hit the same endpoint and share the same `draftSectionIdsFromDraft` presence rule (per 41-01's contract), so the accepted minor double-GET cannot cause the two surfaces to disagree about which sections exist.
- `galleyAnchorFor`'s two existing private copies (`ReviewDeskRunView.tsx`, `DecisionRail.tsx`) were left as-is — the plan explicitly scoped de-duplication to adding the shared export for the outline's use, not rewiring existing call sites.
- `ContextPanel`'s hidden-state persistence mechanism (localStorage, key `dc.workspace.contextPanel.hidden`) was Claude's discretion per 41-CONTEXT D-19; chosen over an `issues`-table field since it's a pure UI-chrome preference with no editorial meaning and no cross-device sync requirement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `pnpm exec tsc --noEmit` shows the same pre-existing baseline errors documented in `41-01-SUMMARY.md` (`syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`) — confirmed none reference any file this plan touched. `pnpm --filter dispatch-control build` passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useWorkspaceState()` is ready for Plan 41-06 (workspace frame layout + nav) to consume for the stage tabs, header status readout, and persistent controls (Hold/Reopen, run history) that today live in `issues/[issueNumber]/page.tsx`.
- `WorkspaceOutline` and `ContextPanel` are ready to be composed into the frame's three-part layout by Plan 41-06 — neither owns its own data fetching; both consume `useWorkspaceState()` / accept `children`.
- `sectionStates`'s authoritative-draft contract is now the shape Plan 41-08 (Stage-2 canvas) MUST also honor for its own draft-derived presence checks — it already does, per 41-01's `draftSectionIdsFromDraft` byte-identical predicate; no new coordination needed.
- No blockers identified for Plan 41-06.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 6 claimed files found on disk; all 3 task commits (`4f99f3d`, `94b0dc4`, `8d570b1`) found in git history.
