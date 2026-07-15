---
phase: 41-issue-workspace-frame
plan: 11
subsystem: ui
tags: [react-context, convex, typescript, vitest, dispatch-control, workspace-frame, gap-closure]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "WorkspaceStateProvider + useWorkspaceState() (41-05) — the single Convex-subscription/derivation context; ContextPanel collapsible shell (41-05); layout.tsx frame mount point (41-06)"
provides:
  - "panelContent / setPanelContent slot on WorkspaceStateValue — the mechanism a nested stage route uses to publish content into the frame's single persistent ContextPanel"
  - "pitchRows / qaFindings / claimRows / signOffs exposed on the context value — the SAME already-subscribed queries, reusable by Plan 41-12's stage publishers with zero new Convex subscriptions"
  - "layout.tsx FrameChrome renders <ContextPanel title=\"Context\">{panelContent}</ContextPanel> instead of a hardcoded {null}"
  - "WorkspaceContextPanelSlot.test.tsx — regression proof that setPanelContent flows to the rendered panel and that the honest empty-state placeholder still shows by default"
affects: [41-12-stage-panel-publishers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider-owned UI slot: a useState<ReactNode> living in the same Context provider that already owns all Convex subscriptions, so a deeply-nested stage page can publish into a persistent, non-remounting ancestor component (the frame) without prop-drilling or lifting the panel itself into each stage"
    - "Zero-new-subscription data reuse: expose already-fetched query results on the shared context value rather than re-fetching in each consumer — extends the Plan 41-05 pattern (one Context provider per composite screen owns all Convex subscriptions) to also cover N future consumers of the SAME data"

key-files:
  created:
    - apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx

key-decisions:
  - "panelContent defaults to null (not an empty fragment or string) — this preserves ContextPanel's own `hasContent` check (children !== null && !== undefined && !== false) so the honest 'Nothing to show for this stage yet' placeholder keeps working with zero changes to ContextPanel.tsx"
  - "The four exposed arrays (pitchRows/qaFindings/claimRows/signOffs) are returned as the exact same local variables already computed inside the provider body — no wrapper, no re-derivation, no new useQuery — verified by an unchanged useQuery( count of 8"
  - "ContextPanel.tsx itself was NOT touched — per the plan's explicit scope boundary, the gap was purely at the call site (layout.tsx's hardcoded {null}) and the missing publish mechanism (the provider), not the shell component"

patterns-established:
  - "Pattern: a persistent-panel content slot lives on the SAME context provider that already spans the persistent frame and every nested stage page, so any stage can publish into an ancestor-rendered region without moving that region into the stage itself (avoids the D-19 anti-pattern of remounting the panel per tab)"

requirements-completed: [WSP-03]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 41 Plan 11: ContextPanel Slot Mechanism Summary

**A `panelContent`/`setPanelContent` slot added to `WorkspaceStateProvider` lets any nested stage route publish into the frame's single persistent `ContextPanel` — replacing `layout.tsx`'s hardcoded `<ContextPanel title="Context">{null}</ContextPanel>` — while `pitchRows`/`qaFindings`/`claimRows`/`signOffs` are exposed on the same context value so Plan 41-12's stage publishers reuse them with zero new Convex subscriptions.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-15T02:00:00Z
- **Completed:** 2026-07-15T02:12:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `WorkspaceStateProvider.tsx` gained a `useState<ReactNode>(null)` panel-content slot, exposed as `panelContent`/`setPanelContent` on `WorkspaceStateValue`, plus the four already-subscribed arrays (`pitchRows`, `qaFindings`, `claimRows`, `signOffs`) added to the returned value object — the file's `useQuery(` count stayed at exactly 8 (verified by grep), confirming no new Convex subscription was introduced.
- `layout.tsx`'s `FrameChrome` now destructures `panelContent` from `useWorkspaceState()` and renders `<ContextPanel title="Context">{panelContent}</ContextPanel>` — the hardcoded `{null}` that caused the WSP-03 gap (41-VERIFICATION.md) is gone.
- `WorkspaceContextPanelSlot.test.tsx` (new, 2 tests) mirrors `WorkspaceLayout.test.tsx`'s full mock block (next/navigation, @clerk/nextjs, @/lib/contentPatchClient, @convex/_generated/api, convex/react) to render the REAL provider + REAL layout end-to-end: a `SlotProbe` child calls `setPanelContent(<span>PANEL_PROBE_CONTENT</span>)` in an effect, and the test asserts the probe's content renders inside the panel while the placeholder disappears; a second test confirms the placeholder still renders when nothing publishes.
- Full `dispatch-control` suite: 82 files passed / 1 skipped (83), 639 tests passed / 2 todo (641) — exactly the pre-existing 637/639 baseline (per 41-VERIFICATION.md) plus this plan's 1 new file / 2 new tests, zero regressions.
- `pnpm --filter dispatch-control exec tsc --noEmit` reports zero errors across all three files this plan touched.

## Task Commits

Each task was committed atomically to master:

1. **Task 1: Add the panelContent slot + expose already-fetched per-run data on WorkspaceStateProvider** - `ab5fb18` (feat)
2. **Task 2: Render {panelContent} in the frame + prove the slot end-to-end** - `b14334c` (feat)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` - adds `panelContent`/`setPanelContent` slot state + exposes `pitchRows`/`qaFindings`/`claimRows`/`signOffs` on the context value (no new `useQuery`)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` - `FrameChrome` now destructures `panelContent` and renders it inside `<ContextPanel>` instead of a hardcoded `{null}`
- `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx` - 2 tests: published content replaces the placeholder; default (no publisher) still shows the honest placeholder

## Decisions Made
- `panelContent` defaults to `null` (matching `ContextPanel`'s own `hasContent` guard) rather than a placeholder React node — keeps `ContextPanel.tsx` completely untouched, per the plan's explicit "do not rewrite ContextPanel" constraint.
- The four exposed arrays are returned as the literal existing local variables (`pitchRows`, `qaFindings`, `claimRows`, `signOffs`) already computed for `derivationInputs` earlier in the provider body — zero re-derivation, zero new subscriptions, and their types are reused directly from `DerivationInputs['qaFindings' | 'claimRows' | 'signOffs']` plus `Doc<'pitchLog'>[] | undefined` for the raw pitch rows, per the plan's interface contract.
- Left `ContextPanel.tsx` byte-unchanged — the gap (41-VERIFICATION.md) was explicitly located at the call site (layout.tsx) and the missing publish mechanism (the provider), never in the shell component itself.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `pnpm --filter dispatch-control exec tsc --noEmit` shows zero errors in any of the three files this plan touched (`WorkspaceStateProvider.tsx`, `layout.tsx`, `WorkspaceContextPanelSlot.test.tsx`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 41-12 (wave 2) can now consume `useWorkspaceState().setPanelContent` from each of the 5 stage pages (or their inner client components) to publish real per-stage content: Stage 1 lead/org detail from `pitchRows`, Stage 2 open QA items from `qaFindings`, Stage 3 claim detail from `claimRows`, Stage 4 voice findings from `qaFindings` (voice-axis subset), Stage 5 decision log/readiness detail from `signOffs` — all four already available on the context with zero new subscriptions.
- Plan 41-12 must additionally publish via an effect with cleanup (resetting `panelContent` to `null` on unmount/stage change) so the panel never shows a stale prior stage's content — the slot itself does not enforce this; it is the publisher's responsibility, as documented in the interface comment.
- Full-suite + strict build gate is deferred to Plan 41-12 (the last gap-closure plan), per this plan's own `<success_criteria>`.
- `node gsd-tools roadmap get-phase 41` still returns `malformed_roadmap` (the known multi-milestone ROADMAP.md CLI quirk) — the Phase 41 plan checkbox was updated directly in ROADMAP.md's `### Phase 41:` block.
- No blockers identified for Plan 41-12.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 3 claimed files found on disk; both task commits (`ab5fb18`, `b14334c`) found in git history.
