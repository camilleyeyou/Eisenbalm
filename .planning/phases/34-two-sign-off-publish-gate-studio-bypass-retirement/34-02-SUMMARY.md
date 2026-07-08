---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 02
subsystem: database
tags: [convex, sign-off, publish-gate, schema]

# Dependency graph
requires:
  - phase: 34-01
    provides: "§34.1/§34.2 frozen Convex sign_offs table + signOffs.ts function contract in docs/API_CONTRACTS.md"
provides:
  - "convex/schema.ts sign_offs table (one active row per runId+kind, kind constrained to facts-cleared|sounds-human)"
  - "convex/signOffs.ts record/revokeAll/activeByRunId/listByRunId functions"
  - "regenerated + committed convex/_generated/api.d.ts with typed api.signOffs.*"
affects: [34-03, 34-04, 34-05, 34-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upsert-by-compound-index (by_runId_and_kind) with PATCH-to-clear-revocation on re-sign"
    - "Pipeline-lane mutations secret-guarded via requirePipelineSecret; public unguarded queries per claimChecks/qaCorrections convention"

key-files:
  created:
    - convex/signOffs.ts
  modified:
    - convex/schema.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "Followed §34.1/§34.2 contract verbatim — no field name, index, or function signature deviated from the frozen shape"

patterns-established:
  - "sign_offs upsert pattern: query by_runId_and_kind .unique() -> patch if exists (clearing revokedAt/revokedReason) else insert"

requirements-completed: [PUB-01, PUB-04]

# Metrics
duration: 8min
completed: 2026-07-08
---

# Phase 34 Plan 02: Convex sign_offs Table + signOffs.ts Summary

**New Convex `sign_offs` table (one active row per runId+kind) plus `convex/signOffs.ts` upsert/revoke/query functions implementing the frozen §34.1/§34.2 two-sign-off publish-gate contract.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-08T14:49:41Z
- **Completed:** 2026-07-08T14:57:xxZ
- **Tasks:** 3
- **Files modified:** 3 (convex/schema.ts, convex/signOffs.ts, convex/_generated/api.d.ts)

## Accomplishments
- `sign_offs` table added to `convex/schema.ts` with the exact §34.1 shape (`kind` constrained union, `revokedAt`/`revokedReason` optional, three indexes) — no existing table touched
- `convex/signOffs.ts` created with all four §34.2 functions: `record` (secret-guarded upsert-by-`by_runId_and_kind`, re-sign clears revocation), `revokeAll` (secret-guarded, patches every active row for a run), `activeByRunId` (public, active-rows-only keyed by kind), `listByRunId` (public, all rows newest-first)
- Convex codegen regenerated and committed — `api.d.ts` now imports/exposes `signOffs`, so `api.signOffs.*` type-checks for the 34-06 dashboard subscription

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the sign_offs table to convex/schema.ts** - `3836af9` (feat)
2. **Task 2: Create convex/signOffs.ts** - `af025bd` (feat)
3. **Task 3: Regenerate + commit convex/_generated (api.d.ts + api.js)** - `3ee5948` (chore)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `convex/schema.ts` - Appended `sign_offs: defineTable(...)` after `review_actions`, with `by_runId`, `by_runId_and_kind`, `by_workspace` indexes
- `convex/signOffs.ts` - New module: `record`, `revokeAll` (pipeline-lane, secret-guarded), `activeByRunId`, `listByRunId` (public)
- `convex/_generated/api.d.ts` - Regenerated via `pnpm --filter @eisenbalm/convex exec convex codegen`; `signOffs` now appears in the typed `fullApi` map. `api.js` unchanged (uses `anyApi` proxy — no per-module codegen needed there)

## Decisions Made
None beyond following §34.1/§34.2 verbatim — the plan's `<action>` blocks were the exact target shape, so implementation was a direct transcription with no judgment calls required.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `pnpm --filter @eisenbalm/convex exec tsc --noEmit` passes clean after all three commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`convex/signOffs.ts` and the `sign_offs` table are ready for:
- 34-03 (`api/signoffs.py` sign-off record endpoint calling `signOffs:record`)
- 34-04 (webhook re-check calling `signOffs:activeByRunId`)
- 34-05 (auto-revoke-on-mutation calling `signOffs:revokeAll`)
- 34-06 (DecisionRail dashboard subscribing to `api.signOffs.activeByRunId`/`listByRunId`, now type-checked via the committed codegen)

No blockers. Note: the Convex codegen ran in offline/local mode (per the 33-02 precedent) — the full `convex dev --once` deploy against the live deployment happens at phase deploy time, not in this plan.

---
*Phase: 34-two-sign-off-publish-gate-studio-bypass-retirement*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created/modified files and all 3 task commit hashes verified present on disk / in git history.
