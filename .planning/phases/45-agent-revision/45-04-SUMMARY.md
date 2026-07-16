---
phase: 45-agent-revision
plan: 04
subsystem: ui
tags: [react, nextjs, revision, vitest, clerk, fetch-client]

# Dependency graph
requires:
  - phase: 45-agent-revision (plan 45-01)
    provides: "§45 API_CONTRACTS.md contract (locked DirectionChip identifiers, preview/apply request/response shapes) + Wave-0 it.todo test scaffolds this plan converts"
provides:
  - "revisionClient.ts — previewRevision/applyRevision fetch wrappers + typed RevisionError (cost_cap_exceeded/revision_mismatch/span_not_resolved/claim_edit_unavailable)"
  - "DirectionChips.tsx — the 7 REV-02 fixed-copy chips, cost-capped disabled state"
  - "RevisionComparisonCard.tsx — original/proposed/what-changed/claim-delta card with 4 actions"
  - "RevisionFlow.tsx — surface-agnostic container orchestrating chips -> preview -> card -> apply"
affects: [45-05-frontend-passage-toolbar-and-surface-wiring, 45-06-frontend-cost-vs-budget-readout, 45-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step preview->apply client mirroring factCheckClient.ts (own private pipelineBaseUrl(), typed *Error class, FastAPI-detail unwrap)"
    - "Surface-agnostic mountable kit (D-18): RevisionFlow knows nothing about the galley/inspector — receives a passage + onApplied/onClose"
    - "vi.mock class-inside-factory pattern (DecisionRail.test.tsx precedent) for typed error instanceof branching in container tests"

key-files:
  created:
    - apps/dispatch-control/lib/revisionClient.ts
    - apps/dispatch-control/components/revision/DirectionChips.tsx
    - apps/dispatch-control/components/revision/RevisionComparisonCard.tsx
    - apps/dispatch-control/components/revision/RevisionFlow.tsx
  modified:
    - apps/dispatch-control/__tests__/DirectionChips.test.tsx
    - apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx
    - apps/dispatch-control/__tests__/RevisionFlow.test.tsx

key-decisions:
  - "DirectionChips/RevisionComparisonCard/RevisionFlow use named exports (matching InspectorFooter.tsx's convention), not default exports"
  - "RevisionFlow keeps priorProposals on Discard (only clears the shown preview) so a later Try-another-approach still diverges from every proposal already seen"
  - "A cost_cap_exceeded 409 during any preview call (initial select or Try-another) returns the flow to the chip view with capped=true, rather than leaving a stale card visible"

requirements-completed: [REV-02, REV-03, REV-04]

# Metrics
duration: 15min
completed: 2026-07-16
---

# Phase 45 Plan 04: Frontend Revision Flow Kit Summary

**Surface-agnostic "Ask agent to revise" kit — revisionClient.ts (typed preview/apply fetch wrappers), the 7 fixed-copy DirectionChips, RevisionComparisonCard's original/proposed/claim-delta view, and a RevisionFlow container that wires them into the full preview→apply cycle with fresh-ifRevisionID and avoid-context accumulation.**

## Performance

- **Duration:** ~15 min (first commit 18:29:13 → last commit 18:40:20, local time)
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 test files converted from Wave-0 stubs)

## Accomplishments

- `revisionClient.ts` talks ONLY to the pipeline (`NEXT_PUBLIC_PIPELINE_URL`), never Sanity — `previewRevision`/`applyRevision` typed wrappers with a `RevisionError` that carries `spentUsd`/`projectedUsd`/`capUsd` for the cost-capped UI branch.
- `DirectionChips` renders exactly the 7 §45.1-locked chips (Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom) — never a single bare catch-all rewrite chip — with a `costCapped` disabled-with-explanation state.
- `RevisionComparisonCard` shows the original (strikethrough) / proposed / "What changed" line / advisory claim-delta block (with an explicit "No claims added, removed, or altered." fallback), plus all four actions (Apply / Edit before applying / Try another approach / Discard).
- `RevisionFlow` orchestrates the full cycle: chip selection → `previewRevision` → card → `applyRevision`, obtaining a FRESH `ifRevisionID` via `getDraft` immediately before every apply, accumulating `priorProposals` across repeated "Try another approach" (D-05), sending the edited text (not the agent's original proposal) on "Edit before applying" (D-11), and dropping into the cost-capped chip view on a `cost_cap_exceeded` 409 (D-14).
- All three Wave-0 `it.todo` scaffolds (`DirectionChips.test.tsx`, `RevisionComparisonCard.test.tsx`, `RevisionFlow.test.tsx`) converted into 17 real, passing assertions — zero `it.todo(` remaining in any of the three files. Full app suite (`npx vitest run`) stays green: 100 files / 857 tests passed, 11 `it.todo` remaining elsewhere belong to sibling plans 45-05/45-06, not this one.

## Task Commits

Each task was committed atomically:

1. **Task 1: revisionClient.ts (preview + apply + typed error)** - `72d9d0e` (feat)
2. **Task 2: DirectionChips + RevisionComparisonCard presentational components** - `04f4d9b` (feat)
3. **Task 3: RevisionFlow container (chips → preview → card → apply)** - `67b0f37` (feat)

_No TDD RED→GREEN split commits were needed — Task 2/3 wrote the component and its converted test together in one commit each, consistent with how this plan's `<action>` blocks specify component+test conversion as a single unit of work._

## Files Created/Modified

- `apps/dispatch-control/lib/revisionClient.ts` - `previewRevision`/`applyRevision` fetch wrappers + `RevisionError` (mirrors `factCheckClient.ts`); zero `@sanity/client` import
- `apps/dispatch-control/components/revision/DirectionChips.tsx` - the 7 fixed-copy direction chips + Custom free-text reveal + cost-capped disabled state
- `apps/dispatch-control/components/revision/RevisionComparisonCard.tsx` - original/proposed/what-changed/claim-delta card with 4 actions and an inline edit-before-applying textarea
- `apps/dispatch-control/components/revision/RevisionFlow.tsx` - the stateful container orchestrating the full preview→apply cycle
- `apps/dispatch-control/__tests__/DirectionChips.test.tsx` - 4 real tests (was 4 `it.todo`)
- `apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx` - 8 real tests (was 4 `it.todo`, expanded to cover both empty-delta and per-action click assertions)
- `apps/dispatch-control/__tests__/RevisionFlow.test.tsx` - 5 real orchestration tests (was 5 `it.todo`), with `previewRevision`/`applyRevision`/`getDraft` mocked via `vi.mock`

## Decisions Made

- Named exports for all three components (`export function DirectionChips`/`RevisionComparisonCard`/`RevisionFlow`), matching `InspectorFooter.tsx`'s precedent rather than `ClaimProvenanceCard.tsx`'s default-export style — chosen for consistency with the plan's own `exports: [...]` frontmatter (single named export per file).
- `RevisionFlow`'s `handleDiscard` intentionally keeps `priorProposals` (only clears the shown `preview`) so a subsequent "Try another approach" (after a chip reselect) still diverges from everything already shown — matches the plan's Task 3 action note verbatim.
- On a `cost_cap_exceeded` 409 from ANY `previewRevision` call (including a mid-flow "Try another approach"), the flow clears the current card and returns to the (now disabled) `DirectionChips` view rather than leaving a stale comparison card next to a now-invalid guard state.
- The 5th Wave-0 `it.todo` in `RevisionFlow.test.tsx` ("apply success reflects the touched-claims reset and revoked sign-offs in the workspace state") is converted into an assertion that `onApplied()` fires and `onClose()` follows — `RevisionFlow` itself has no visibility into Convex-side claim resets/sign-off revocation (that's server-side §45.4 behavior, reflected to the workspace via its OWN pre-existing Convex subscriptions once the mutation lands); `onApplied` is this container's only, and correct, signal back to the caller.

## Deviations from Plan

None of Rules 1–3 applied — no bugs found, no missing critical functionality, no blocking issues in the plan's own scope. Two out-of-scope, pre-existing environment gaps were discovered and logged (not fixed) per the SCOPE BOUNDARY rule:

### Deferred (logged, not fixed — see `.planning/phases/45-agent-revision/deferred-items.md`)

1. **`apps/dispatch-control` has no ESLint config file at all** (confirmed via `git log --all` on every conventional config filename — zero hits, ever). `npx eslint components/revision/RevisionFlow.tsx` (this plan's own Task 3 `<verify>` line) fails immediately with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file" — a repo-wide, pre-existing gap (no phase before 45 ever ran `npx eslint` against this app), not something introduced by this plan's changes. Verified instead via `tsc --noEmit` (zero errors in all 4 new/modified source files) + the full `vitest run` suite (green).
2. **`npx tsc` in this environment resolves to an unrelated joke npm package** ("This is not the tsc command you are looking for") instead of the locally-installed TypeScript compiler. Worked around by invoking `./node_modules/.bin/tsc` directly for every tsc-based verification in this plan.

Both are documented in full (root cause, verification workaround, suggested fix) in `deferred-items.md` for a future dedicated tooling plan.

## Issues Encountered

- `vi.mock('@/lib/revisionClient', ...)` initially referenced a module-top-level `MockRevisionError` class from inside the mock factory, which vitest's hoisting rejected (`ReferenceError: Cannot access 'MockRevisionError' before initialization`). Fixed by moving the class definition INSIDE the factory function (mirrors `DecisionRail.test.tsx`'s `vi.mock('@/lib/signOffClient', ...)` pattern) and importing the mocked `RevisionError`/`previewRevision`/`applyRevision` back out for use in test bodies — standard vitest hoisting discipline, not a plan deviation.
- 5 new `TS2532: Object is possibly 'undefined'` errors surfaced in `RevisionFlow.test.tsx` on `.mock.calls[N][idx]` array-index access, matching a systemic pre-existing pattern already present (and un-fixed) in 5 other test files in this app (`spanResolver.test.ts`, `StageContextPanels.test.tsx`, `syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`) under this tsconfig's array-indexing strictness. Fixed cleanly in the new file with non-null assertions (`.mock.calls[0]![1]`) rather than leaving it inconsistent with the rest — a zero-risk, in-scope cleanup of code this plan itself wrote (not the pre-existing files, which are out of scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The mountable kit (`revisionClient.ts` + `DirectionChips` + `RevisionComparisonCard` + `RevisionFlow`) is complete and self-contained — 45-05 can import `RevisionFlow` and mount it from the shared galley selection toolbar and the Phase-44 `InspectorFooter` with zero changes needed here (D-18's "one component, one endpoint" is satisfied).
- Blocker/concern for 45-05: none from this plan's side. The pipeline endpoints this client calls (`revise/preview`/`revise/apply`) are Plan 45-03's responsibility (wave 2, parallel to this plan) — 45-05's live E2E wiring will need 45-03 merged, but this plan's own tests never hit a live network (fully mocked), so nothing here is blocked.
- Flagging forward (not a blocker): `apps/dispatch-control`'s missing ESLint config (see Deferred above) will keep silently skipping lint on every future phase's dispatch-control changes until a dedicated plan adds one.

---
*Phase: 45-agent-revision*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 7 created/modified source files confirmed present on disk; all 3 task commits (`72d9d0e`, `04f4d9b`, `67b0f37`) confirmed present in `git log --oneline --all`.
