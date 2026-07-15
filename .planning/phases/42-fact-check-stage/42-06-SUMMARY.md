---
phase: 42-fact-check-stage
plan: 06
subsystem: ui
tags: [react, nextjs, convex, fact-check, provenance, claims, dispatch-control]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: 04
    provides: "The six factcheck.py pipeline endpoints (keep/PATCH/replace-source/DELETE/evidence-preview/evidence-apply) this plan's factCheckClient.ts calls"
  - phase: 42-fact-check-stage
    plan: 05
    provides: "isMustFix/deriveFactCheckSummary/FactCheckClaimRow selectors this plan's summary + filters + chip derivation reuse (single source of truth, D-16)"
provides:
  - "ONE shared ClaimProvenanceCard (components/provenance/) rendering the §42.6 9-field claim shape with never-blank guarantees and the D-08 5-state chip vocabulary; exports deriveSourcePublisher/deriveClaimAgent/deriveClaimChipState for Plan 42-07's Draft/Approval reuse"
  - "factCheckClient.ts — typed callers for all six pipeline claim-action + evidence endpoints, no Sanity import (EDT-05)"
  - "factCheckFilters.ts — the 7 client-side filter predicates (FACT_CHECK_FILTERS + applyFilters), OR-union multi-select, removed-row exclusion"
  - "FactCheckScreen.tsx — the real Stage 3 workspace: affirmative summary, filter chips, claim table, card-on-selection, all six actions wired to their write boundary with a freshly-fetched ifRevisionID"
  - "Phase 41's FactCheckPlaceholder.tsx retired; page.tsx now mounts the real screen"
affects: [42-07, 42-08, phase-44-inspector, phase-45-agent-revision-generalization, phase-49-rbac]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared provenance card pattern (D-09): ONE component + two exported pure field-sourcing helpers (deriveSourcePublisher, deriveClaimAgent) consumed by Stage 3 now and Draft/Approval/inspector later — never forked"
    - "D-08 chip derivation reused from the card by the claim table (deriveClaimChipState exported), so the table and the card can never silently disagree"
    - "Reveal-then-confirm inline forms (mirrors UnresolvedFindingCard.tsx) for every reason/text/URL-collecting action, instead of native browser prompts"
    - "Context-panel restore-on-deselect: FactCheckScreen's own effect republishes buildFactCheckPanelContent(leanClaimRows) on deselect/cleanup rather than nulling the panel, so FactCheckPanelPublisher's default content is never left blank after a selection ends"
    - "Fresh-ifRevisionID-before-apply: content-touching actions (Edit claim with text, evidence/apply) call getDraft(runId, token) immediately before the pipeline call, mirroring ReviewDeskRunView.reloadDraft, since useWorkspaceState() does not expose a revisionId"

key-files:
  created:
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx
    - apps/dispatch-control/lib/factCheckClient.ts
    - apps/dispatch-control/lib/factCheckFilters.ts
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
    - apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx
    - apps/dispatch-control/__tests__/factCheckFilters.test.ts
    - apps/dispatch-control/__tests__/FactCheckScreen.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
  deleted:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx
    - apps/dispatch-control/__tests__/FactCheckPlaceholder.test.tsx

key-decisions:
  - "ClaimProvenanceView gained an additive changedSinceCheck?: boolean field beyond the plan's literal listed shape, so the ONE shared chip derivation can render D-08's 'Changed' state; FactCheckScreen passes it through from the full row"
  - "The claim table reuses ClaimProvenanceCard's exported deriveClaimChipState for its own per-row chip, rather than reimplementing severity display logic a second time — keeps the table and the card provably consistent"
  - "Reason/text/URL-collecting actions (Edit claim, Replace source, Remove claim, Keep as written) each reveal a small inline form on click (mirrors UnresolvedFindingCard.tsx's dismiss-with-reason pattern) rather than window.prompt — consistent with the rest of the codebase, and keeps every control visible/testable even when its handler is unwired"
  - "FactCheckPlaceholder.test.tsx was deleted and replaced by FactCheckScreen.test.tsx (5 tests) rather than renamed in place, so the new screen's never-blank summary (loading / empty / zero-counters-shown / not-yet-verified) gets direct regression coverage under its real name"
  - "Confidence is rendered as '—' whenever claim.confidence is undefined (always, in this phase — no stored source yet per §42.6), never fabricated; the prop is kept typed as an optional number for forward compatibility"

patterns-established:
  - "Any future claim-detail surface (Plan 42-07's Draft/Approval reuse, Phase 44's inspector Sources tab) imports ClaimProvenanceCard + deriveSourcePublisher/deriveClaimAgent/deriveClaimChipState from components/provenance/ClaimProvenanceCard.tsx rather than re-deriving any of the three"

requirements-completed: [FCT-02, FCT-03, FCT-04, FCT-05, FCT-06]

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 42 Plan 06: Provenance Card + Stage 3 Screen Summary

**ONE shared 9-field ClaimProvenanceCard with the D-08 chip vocabulary, a factCheckClient covering all six pipeline claim-action + evidence endpoints, 7 pure client-side claim-table filters, and the real Stage 3 FactCheckScreen (summary + filters + table + card + actions) that replaces the Phase 41 placeholder.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-15T06:18:39-07:00
- **Tasks:** 3 (Tasks 1–2 `type="auto" tdd="true"`, Task 3 `type="auto"`)
- **Files modified:** 8 (7 created, 1 modified, 2 deleted)

## Accomplishments

- `components/provenance/ClaimProvenanceCard.tsx` — renders all 9 fields of the §42.6 claim shape (`text, importance, status, sourceUrl, sourcePublisher, supportingPassage, retrievedAt, agent, confidence`) with every never-blank guarantee from the plan's `<behavior>` list: unsourced → "Unsourced", importance-absent → "Supporting" (D-03), agent-absent → "—", confidence → always "—" (no stored source this phase, §42.6). Exports `deriveSourcePublisher`, `deriveClaimAgent`, and `deriveClaimChipState` (D-08's 5-state label+icon vocabulary, reusing `isMustFix` from `lib/derivedState.ts` so the card can never disagree with the Stage 3 summary/table). All six actions (Confirm, Edit claim, Replace source, Ask agent for better evidence, Remove claim, Keep as written) plus Open source + Inspect render as isolated, never-hidden controls; reason/text/URL-collecting actions reveal an inline form rather than a native prompt.
- `lib/factCheckClient.ts` — `keepClaim`/`patchClaim`/`replaceSource`/`removeClaim`/`evidencePreview`/`evidenceApply`, each calling the exact `api/factcheck.py` route/body/response shape shipped in Plan 42-04. Zero Sanity import.
- `lib/factCheckFilters.ts` — `FACT_CHECK_FILTERS` (7 chips) + `applyFilters` (OR-union across active chips, documented default; `removed`-status rows always excluded). `must-fix` reuses `isMustFix` from `derivedState.ts`; `isOrgClaim`/`isWeakSource` implement the D-13 org-suffix + low-authority-host heuristics as small, documented, tested pure helpers.
- `FactCheckScreen.tsx` — subscribes to the FULL `claim_checks` rows via `useQuery(api.claimChecks.listByRunId, {runId})` (not the workspace provider's lean projection, per the plan's checker-Warning-2 mandate); renders the affirmative summary (`checked X of Y · N must fix · N unchecked · N conflicting sources · N checks not run · N changed since check · last verified/not yet verified` — every counter always shown, loading/empty states explicit); renders the 7 filter chips over full rows; renders the filtered claim table with the SAME chip derivation the card uses; publishes the card into the frame's context panel on row selection and restores the default coverage-summary content on deselect/cleanup; wires Confirm to the direct `claimChecks:setStatus` Convex mutation and the other five actions through `factCheckClient`, obtaining a fresh `ifRevisionID` via `getDraft` immediately before any content-touching apply (checker-Warning-3 mandate); renders a §9-style Original/Proposed/"What changed" comparison card for the "Ask agent for better evidence" preview → apply flow.
- `page.tsx` swapped to mount `FactCheckScreen`; `FactCheckPlaceholder.tsx` deleted; its test file replaced by `FactCheckScreen.test.tsx` (5 tests covering the same never-blank guarantees under the real component's name).

## Task Commits

Each task was committed atomically:

1. **Task 1: ClaimProvenanceCard.tsx + factCheckClient.ts** - `d0d3c9b` (feat)
2. **Task 2: factCheckFilters.ts** - `ad4af7d` (feat)
3. **Task 3: FactCheckScreen.tsx + page.tsx swap + delete placeholder** - `02c0e8a` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP update, committed separately per the final-commit step)

## Files Created/Modified

- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` - The one shared 9-field provenance card + action-control slots
- `apps/dispatch-control/lib/factCheckClient.ts` - Typed callers for the six pipeline claim-action + evidence endpoints
- `apps/dispatch-control/lib/factCheckFilters.ts` - The 7 client-side filter predicates
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx` - The real Stage 3 screen
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx` - Mounts FactCheckScreen instead of the placeholder
- `apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx` - 32 tests (field sourcing, never-blank, chip derivation, all actions)
- `apps/dispatch-control/__tests__/factCheckFilters.test.ts` - 19 tests (all 7 predicates + applyFilters semantics)
- `apps/dispatch-control/__tests__/FactCheckScreen.test.tsx` - 5 tests (never-blank summary at the screen level)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPlaceholder.tsx` - Deleted (superseded)
- `apps/dispatch-control/__tests__/FactCheckPlaceholder.test.tsx` - Deleted (superseded by FactCheckScreen.test.tsx)

## Decisions Made

- `ClaimProvenanceView` gained an additive `changedSinceCheck?: boolean` field beyond the plan's literal `{text, importance?, status, sourceUrl?, supportingPassage?, retrievedAt?, sectionName?, confidence?}` shape — without it, the ONE shared chip derivation could never render D-08's "Changed" state on the card itself (only status+importance+sourceUrl are otherwise available). `FactCheckScreen` passes it through from the full row it already has.
- The claim table reuses the card's exported `deriveClaimChipState` for its own per-row chip rather than reimplementing the same severity-to-label mapping a second time — the table and the card can now never silently disagree (extends D-16's "single source of truth" discipline from selectors to chip rendering).
- Every reason/text/URL-collecting action (Edit claim, Replace source, Remove claim, Keep as written) reveals a small inline form on click — mirrors `UnresolvedFindingCard.tsx`'s "Dismiss" reveal-then-confirm pattern already shipped in this codebase — rather than a native `window.prompt()` (which the codebase does not use anywhere else). This keeps every control visible, keyboard-accessible, and independently testable, and makes it trivial for a future Phase 49 wrapper to swap any one control for a locked-with-explanation render without touching the others.
- `FactCheckPlaceholder.test.tsx` was deleted and replaced by a new `FactCheckScreen.test.tsx` (5 tests) rather than edited in place — the plan explicitly offered either option ("update/rename... or delete it and add a FactCheckScreen never-blank assertion"); starting fresh under the real component's name gave cleaner, more direct regression coverage of the loading/empty/zero-counters/not-yet-verified states without carrying over placeholder-specific fixture shapes.
- `confidence` renders `'—'` whenever `claim.confidence` is `undefined`, which is always the case in this phase (§42.6: no stored confidence source yet) — the prop stays typed as an optional `number` so a future phase can populate it without an API change to the card.

## Deviations from Plan

None beyond the two documented decisions above (both within the plan's own stated discretion: the `ClaimProvenanceView` field addition is additive/backward-compatible per D-11's "structured for later reuse" framing, and the test-file replacement was one of the two options the plan itself offered).

## Issues Encountered

- The first `FactCheckScreen.test.tsx` draft asserted `queryByText(/verified/i)` against the whole document, which false-matched the screen's own static intro copy ("Blank never means verified…"). Fixed by scoping the query to the `region` with `aria-label="Fact check summary"` via `within(...)` — a test-authoring fix, not a component bug.

## User Setup Required

None — no external service configuration required. This plan is pure console-side (components/client/screen); the pipeline endpoints it calls were already shipped and deployed in Plan 42-04, and the Convex schema/functions in Plan 42-01 (both noted as pending the deferred `pnpm --filter @eisenbalm/convex dev:once` sync, tracked for Plan 42-08's integration gate).

## Next Phase Readiness

- Stage 3 (Fact Check) is a fully usable editorial surface: the affirmative summary, the 7-filter table over full rows, the shared provenance card on selection, and all six actions at their correct write boundary with a real `ifRevisionID`. The load-bearing demo leg (My Tasks → claim detail → Ask agent for better evidence → Confirm) is exercisable end-to-end once the pending Convex dev-deployment sync lands.
- `ClaimProvenanceCard.tsx` + its three exported helpers (`deriveSourcePublisher`, `deriveClaimAgent`, `deriveClaimChipState`) are ready for Plan 42-07 to consume from `ClaimMark.tsx`/`SourceIndex.tsx` (Draft/Approval reuse) without forking a second card (D-09).
- `pnpm --filter dispatch-control test:unit` (86 files, 741 tests) and `pnpm --filter dispatch-control build` both exit 0; `dispatch-control-no-sanity-write.test.ts` stays green (verified in the full suite run — neither `factCheckClient.ts` nor `ClaimProvenanceCard.tsx` introduces a Sanity import).
- No blockers. The outstanding Convex dev-deployment sync (`pnpm --filter @eisenbalm/convex dev:once`) remains deferred to Plan 42-08's integration gate, per the 42-01/42-04 SUMMARYs.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 9 files created/modified this plan were confirmed present on disk; the 2 deleted files (FactCheckPlaceholder.tsx, FactCheckPlaceholder.test.tsx) were confirmed absent. All 3 task commits (`d0d3c9b`, `ad4af7d`, `02c0e8a`) confirmed present in `git log --oneline --all`. Full test suite (86 files, 741 tests) green; `pnpm --filter dispatch-control build` exits 0.
