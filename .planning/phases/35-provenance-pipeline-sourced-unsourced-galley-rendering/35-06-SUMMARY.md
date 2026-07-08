---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 06
subsystem: ui
tags: [react, nextjs, convex, decision-rail, provenance, source-index]

# Dependency graph
requires:
  - phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
    provides: "claim_checks additive provenance fields (claimId, sourceUrl, retrievedAt, sectionName, blockIndexHint) from Plan 35-01"
provides:
  - "SourceIndex.tsx — unsourced-on-top + sourced-by-section source index with per-row check/skip + jump links, mounted in the decision rail's Verification section"
affects: [36-voice-pass, 37-run-monitor-v2-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source index groups claim_checks rows by presence/absence of claimId (sourced vs unsourced), then sub-groups sourced rows by a fixed galley-order array — mirrors the D-14 requirement without introducing a new table or query"
    - "Legacy-row honesty: rows missing claimId/sectionName render in the unsourced group with no jump link rather than being hidden or crashing"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx

key-decisions:
  - "SourceIndex runs its own useQuery(api.claimChecks.listByRunId) call rather than threading rows down as a prop from DecisionRail — keeps the component self-contained and matches the plan's interface spec; Convex query caching means this is not a duplicate network round-trip in practice"
  - "Sourced rows with an unrecognized/absent sectionName (should not occur post-Plan-35-04, but never assumed) land in a trailing 'Other sourced claims' group rather than being silently dropped — nothing disappears"
  - "Jump-link and check/skip buttons carry per-row aria-labels keyed by claimIndex (e.g. 'Check claim 2') for unambiguous, testable accessible names across an arbitrary number of rows"

requirements-completed: [PRV-04]

# Metrics
duration: ~20min
completed: 2026-07-08
---

# Phase 35 Plan 06: Decision Rail Source Index Summary

**New `SourceIndex.tsx` component upgrades the decision rail's Verification block into a merged checklist + source list: unsourced claims pin on top, sourced claims group by galley section in reading order, every row carries the same `claimChecks:setStatus` check/skip control plus a jump link to its galley span.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified) + 1 test file extended

## Accomplishments
- Extended `DecisionRail.test.tsx` with 5 RED tests (unsourced-above-sourced ordering, sourced-by-galley-order grouping with `sourceUrl` links, per-row check control, per-row skip control, legacy-row safety) — confirmed RED against the pre-existing rail before any component code existed
- Built `SourceIndex.tsx`: partitions `claim_checks` rows on `claimId` presence (sourced/unsourced per the §35.4 invariant), renders the unsourced group first, then sourced rows grouped by the fixed D-14 galley order (`originStory`, `problemStatement`, `founderBio`, `caseStudy`, `bonus`), each row showing an "Open source" link, a status pill, a Check button, a Skip button (both calling `useMutation(api.claimChecks.setStatus)`), and a "Jump to section" button (`document.getElementById('galley-<sectionName>')?.scrollIntoView`) when a known `sectionName` is present
- Mounted `<SourceIndex runId={runId} />` inside `DecisionRail.tsx`'s existing `Verification` section, directly below the untouched "N/M claims checked · checked Nm ago" summary line
- Verified the Sign-offs section and Publish gate are byte-unchanged (diff scoped to the header comment, one import, and the Verification section only)
- All 26 `DecisionRail.test.tsx` tests green; full `apps/dispatch-control` vitest suite green (44 files / 381 passed, 2 todo, 1 pre-existing skip); `pnpm --filter dispatch-control build` exits 0 (all 20 routes, per the CLAUDE.md memory rule that vitest alone does not type-check)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests — unsourced-on-top grouping, sourced-by-section, jump links, legacy safety** - `2b59b93` (test)
2. **Task 2: SourceIndex component + mount in the rail's Verification section** - `d022208` (feat)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` - New component: unsourced-on-top + sourced-by-galley-section source index with check/skip + jump links + Open-source links
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` - Mounted `<SourceIndex runId={runId} />` inside the existing Verification section; header doc comment updated; Sign-offs/Actions/Publish sections untouched
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx` - Added `useMutation` mock wiring + 5 new tests covering the source index's grouping, controls, and legacy-row safety

## Decisions Made
- SourceIndex owns its own Convex subscription (`useQuery(api.claimChecks.listByRunId, { runId })`) rather than receiving rows as a prop — self-contained per the plan's stated component interface (`{ runId: string }`), and Convex's client-side query cache means DecisionRail's existing summary block and SourceIndex's own query don't produce a duplicate network round-trip
- Sourced rows whose `sectionName` doesn't match the five known galley ids fall into a trailing "Other sourced claims" group instead of being dropped — preserves the "nothing silent" house rule for a shape that shouldn't occur post-Plan-35-04 but is never assumed
- Per-row `aria-label`s embed `claimIndex` (e.g. `Check claim 2`, `Jump to claim 2`) so automated tests (and screen readers) can address a specific row unambiguously regardless of row count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `noUncheckedIndexedAccess` TypeScript error in the section-label lookup**
- **Found during:** Task 2 strict build verification (`pnpm --filter dispatch-control build`)
- **Issue:** `SECTION_LABELS[sectionName]` returned `string | undefined` under the repo's `noUncheckedIndexedAccess: true` tsconfig setting, failing to satisfy the `label: string` field in the sourced-group object literal
- **Fix:** Added a `?? sectionName` fallback so an (unexpected) unmapped key still produces a usable label instead of a type error
- **Files modified:** `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx`
- **Verification:** `pnpm --filter dispatch-control build` now exits 0
- **Committed in:** `d022208` (Task 2 commit)

**2. [Rule 3 - Blocking] Restored the parallel-execution worktree, which was 151 commits behind `master`**
- **Found during:** Start of Task 1 — the assigned worktree branch was at the Phase 30 tip and had none of Phases 31–35's code (no `DecisionRail.tsx`, no `claim_checks` provenance fields, etc.)
- **Issue:** The worktree could not execute this plan at all in that state
- **Fix:** Confirmed the worktree branch had zero commits of its own ahead of `master` (`git rev-list --count master..HEAD` = 0) and the working tree was clean, then fast-forwarded via `git merge master --ff-only` (safe, non-destructive — no unique work existed to lose)
- **Files modified:** none directly (repository-state fix, not a content change)
- **Verification:** `git log --oneline -5` confirmed the worktree now sits on `0b62420` (Plan 35-01's completion commit); the plan's prerequisite files (`DecisionRail.tsx`, `convex/claimChecks.ts` with provenance fields) were then present and readable
- **Committed in:** n/a (merge, not a plan-scoped commit)

**3. [Rule 3 - Blocking] Copied the gitignored `.env.local` from the main checkout into the worktree**
- **Found during:** Task 2 strict build verification
- **Issue:** `pnpm --filter dispatch-control build` failed during static prerendering ("Could not find Convex client!") because the worktree had no `.env.local` (gitignored, not copied by `git worktree add`) and thus no `NEXT_PUBLIC_CONVEX_URL`/Clerk keys; confirmed via a `git stash` A/B test that the SAME failure occurs on unmodified code (just on a different page), proving this was a pre-existing worktree-environment gap, not something this plan's code caused
- **Fix:** Copied `apps/dispatch-control/.env.local` from the main checkout (`/Users/user/Desktop/Eisenbalm`) into the worktree's `apps/dispatch-control/.env.local`
- **Files modified:** `apps/dispatch-control/.env.local` (gitignored — not committed, not part of any task commit)
- **Verification:** `pnpm --filter dispatch-control build` then exits 0 with all 20 routes generated
- **Committed in:** n/a (gitignored local file, never staged)

---

**Total deviations:** 3 auto-fixed (2 blocking build/typecheck fixes, 1 blocking environment-setup fix)
**Impact on plan:** All three were necessary to execute and verify the plan at all in this worktree; none touched plan-scoped application behavior beyond the one-line type-safety fallback in `SourceIndex.tsx`. No scope creep.

## Issues Encountered
None beyond the three items documented above as deviations.

## User Setup Required

None - no external service configuration required. The worktree's copy of `.env.local` mirrors the same local dev credentials already present in the main checkout; no new secrets or dashboard steps.

## Next Phase Readiness

- PRV-04 is now satisfied: the decision rail's source index groups unsourced-on-top + sourced-by-section with sources, check/skip controls, and jump links; the Phase 34 facts-cleared gate contract is unchanged (verified via the untouched Sign-offs/Actions section diff)
- This plan depended only on Plan 35-01's schema/contract work (`claim_checks` additive fields), not on Plans 35-02..35-05 (Researcher, writer, publisher seeding, galley wash) — so `SourceIndex.tsx` will show real sourced groups only once those plans land and start populating `claimId`/`sourceUrl`/`sectionName` on live runs; until then it renders every row as unsourced, which is the correct, honest degrade behavior by design
- Phase 36 (Voice Pass) and Phase 37 (Run Monitor v2 / Signal Desk) build on the same rail; no changes required to this component for either to proceed

---
*Phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created/modified files verified present on disk: `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx` (created), `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` (modified), `apps/dispatch-control/__tests__/DecisionRail.test.tsx` (modified). Both task commit hashes (`2b59b93`, `d022208`) verified present in `git log --oneline`.
