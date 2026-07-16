---
phase: 49-roles-permissions
plan: 04
subsystem: auth
tags: [convex, rbac, clerk, convex-error, vitest, convex-test]

# Dependency graph
requires:
  - phase: 49-01
    provides: Clerk role claim (publicMetadata.role -> JWT claim on session token + "convex" template), Role/isEditor type contract (§49 in API_CONTRACTS.md)
provides:
  - "requireEditor(ctx) role-gate helper in convex/lib/auth.ts (fails closed, first ConvexError usage in the repo)"
  - "promptVersions.activate gated to Editor-in-chief (Make instruction active — one of the six ROL-02 actions)"
  - "charities.setStatus gated to Editor-in-chief (Mark Do not use — one of the six ROL-02 actions)"
  - "Convex-side SC-1 proof: Collaborator-role identity rejected server-side with a thrown ConvexError({code:'forbidden_role'})"
affects: [49-05, 49-06, dispatch-control-frontend-lock-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireEditor(ctx) as a sibling (not a wrapper) to requireOperator(ctx) in convex/lib/auth.ts — both independently call ctx.auth.getUserIdentity(); fails closed on missing identity AND on identity.role !== 'Editor-in-chief'"
    - "First ConvexError usage in this repo (convex/values), replacing plain Error for the role-gate rejection path only — requireOperator/requirePipelineSecret/etc. keep throwing plain Error"

key-files:
  created:
    - .planning/phases/49-roles-permissions/deferred-items.md
  modified:
    - convex/lib/auth.ts
    - convex/promptVersions.ts
    - convex/charities.ts
    - apps/dispatch-control/__tests__/activate.test.ts
    - apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts
    - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts
    - apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts

key-decisions:
  - "Left convex/promptVersions.ts's other two requireOperator(ctx) call sites (upsertActive, saveVersion) untouched — the plan's own action text and the orchestrator's critical_constraints both say swap ONLY activate + setStatus (D-07: exactly six gated actions, no more no fewer); one of the plan's own acceptance-criteria greps (requiring 0 requireOperator(ctx) matches in promptVersions.ts) was internally inconsistent with that scope and was not followed literally — documented as a deviation below"
  - "Fixed convexAuthLockdown.test.ts's pre-existing no-identity assertion (/Unauthorized/) to /unauthorized/i, since requireEditor's no-identity branch now throws ConvexError({code:'unauthorized', message:'Not authenticated'}) instead of requireOperator's plain Error('Unauthorized') — authentication still gates before role does (the must_have truth), only the string shape of the rejection changed"

requirements-completed: [ROL-01, ROL-02]

# Metrics
duration: 11min
completed: 2026-07-16
---

# Phase 49 Plan 04: Convex Editor Gate Summary

**`requireEditor(ctx)` (first ConvexError usage in the repo) now gates `promptVersions.activate` and `charities.setStatus` to Editor-in-chief, with the four pre-existing convex-test suites updated to carry `role:'Editor-in-chief'` and new Collaborator-rejection negative tests proving the server-side reject.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-16T18:01:25Z
- **Completed:** 2026-07-16T18:12:00Z
- **Tasks:** 3 completed
- **Files modified:** 7 (2 source, 4 test, 1 new deferred-items doc)

## Accomplishments
- `requireEditor(ctx)` added in `convex/lib/auth.ts` — sibling to `requireOperator`, fails closed on missing identity (`ConvexError({code:'unauthorized'})`) or wrong role (`ConvexError({code:'forbidden_role'})`)
- `promptVersions.activate` ("Make instruction active") and `charities.setStatus` ("Mark Do not use", gates ALL status transitions incl. `blocklisted`) both swapped from `requireOperator` to `requireEditor` — the Convex half of ROL-02's six-action inventory
- The four enumerated pre-existing convex-test files updated so every `withIdentity()` call exercising these two mutations carries `role:'Editor-in-chief'`, keeping all pre-existing suites green
- New Collaborator-rejection negative tests added to `activate.test.ts` and `charitiesDoNotUse.test.ts`, each asserting a thrown `forbidden_role`/`Editor-in-chief` error and confirming no state mutation occurred on rejection
- Dev Convex deployment (dev:modest-magpie-797) synced via `pnpm --filter @eisenbalm/convex dev:once` — the new guard is live, not just committed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add requireEditor(ctx) to convex/lib/auth.ts** - `f871601` (feat)
2. **Task 2: Swap the two mutations + update existing tests + add Collaborator negatives** - `7a41e5c` (feat)
3. **Task 3: Sync the mutation changes to the dev Convex deployment** - no commit (verification/sync-only action; `pnpm --filter @eisenbalm/convex dev:once` exited 0, no code changed)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `convex/lib/auth.ts` - Added `requireEditor(ctx)`, imported `ConvexError` from `convex/values`
- `convex/promptVersions.ts` - `activate` mutation now calls `requireEditor(ctx)` instead of `requireOperator(ctx)`; `upsertActive`/`saveVersion` untouched
- `convex/charities.ts` - `setStatus` mutation now calls `requireEditor(ctx)` instead of `requireOperator(ctx)`; `upsertCandidate`/`upsertFeatured`/`seedFromPublished` untouched
- `apps/dispatch-control/__tests__/activate.test.ts` - Added `role:'Editor-in-chief'` to both existing `activate` `withIdentity()` calls; added a Collaborator-rejection negative test
- `apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts` - Added `role:'Editor-in-chief'` to the `asOperator` helper's identity (used by all three existing tests); added a Collaborator-rejection negative test
- `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` - Added `role:'Editor-in-chief'` to the Lane-1 "succeeds with a Clerk identity" `activate` call; fixed the "rejects with no Clerk identity" assertion's regex (see Deviations)
- `apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts` - Added `role:'Editor-in-chief'` to all 6 `activate`-exercising `withIdentity()` calls
- `.planning/phases/49-roles-permissions/deferred-items.md` - Logged pre-existing, unrelated `tsc --noEmit` failures in `dispatch-control` discovered while extra-verifying with `pnpm typecheck:dispatch-control`

## Decisions Made
- Scoped the `requireOperator` → `requireEditor` swap to exactly `promptVersions.activate` and `charities.setStatus`, leaving `promptVersions.ts`'s other two `requireOperator(ctx)` call sites (`upsertActive`, `saveVersion`) and all of `charities.ts`'s pipeline/dual-lane helpers untouched — per D-07 ("exactly six actions, no more no fewer") and the plan's own action text / the orchestrator's critical_constraints ("Do NOT change requireOperator's other call sites").
- Followed the plan's Task 1 interface code for `requireEditor` verbatim (including its exact `ConvexError` shapes), even though this changes the string shape of the no-identity rejection for `activate` — fixed the one pre-existing test assertion that depended on the old shape (see Deviations) rather than watering down `requireEditor`'s error to preserve a stale regex.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2's own acceptance-criteria grep contradicts Task 2's own action text for `convex/promptVersions.ts`**
- **Found during:** Task 2 (verifying acceptance criteria after the swap)
- **Issue:** The plan's Task 2 acceptance criteria state `grep -c "requireOperator(ctx)" convex/promptVersions.ts` must equal `0`. But `promptVersions.ts` has three `requireOperator(ctx)` call sites (`upsertActive`, `saveVersion`, `activate`) — the plan's own action text and the orchestrator's critical_constraints explicitly say to swap ONLY the `activate` handler and "do NOT change requireOperator's other call sites." Literally satisfying the grep-to-0 criterion would have meant incorrectly gating `upsertActive` and `saveVersion` (the Phase 22/24 seed and version-save mutations) to Editor-in-chief — actions never named among ROL-02's six, and not reachable by a Collaborator's UI at all per the CONTEXT.
- **Fix:** Followed the explicit scope instruction (swap only `activate`) over the literal but internally-inconsistent grep count. `convex/promptVersions.ts` correctly retains 2 `requireOperator(ctx)` call sites (`upsertActive`, `saveVersion`) plus the 1 new `requireEditor(ctx)` call (`activate`). `convex/charities.ts`'s analogous criterion (`0` `requireOperator(ctx)` matches) held true naturally, since `setStatus` was its only call site.
- **Files modified:** `convex/promptVersions.ts` (no additional change beyond the intended one-line swap)
- **Verification:** `grep -c "requireEditor(ctx)" convex/promptVersions.ts` == 1; `grep -c "requireOperator(ctx)" convex/promptVersions.ts` == 2 (both pre-existing, unrelated call sites); full `pnpm test` suite (941 tests) green
- **Committed in:** `7a41e5c` (Task 2 commit)

**2. [Rule 1 - Bug] convexAuthLockdown.test.ts's pre-existing no-identity assertion broke under the plan's own requireEditor implementation**
- **Found during:** Task 2 (running the four enumerated test files)
- **Issue:** `requireEditor`'s no-identity branch throws `ConvexError({code:'unauthorized', message:'Not authenticated'})` (exactly as specified in the plan's Task 1 interface code), whose stringified error does not match the pre-existing test's `/Unauthorized/` regex (which was written against `requireOperator`'s plain `Error('Unauthorized')`). The plan's must_have truth requires this no-identity case to "stay green" but its own specified `requireEditor` code makes the old regex fail.
- **Fix:** Updated the assertion from `.rejects.toThrow(/Unauthorized/)` to `.rejects.toThrow(/unauthorized/i)`, with a comment explaining the Phase 49 shape change. Authentication still gates before role does (identical control flow); only the rejection's string shape differs.
- **Files modified:** `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts`
- **Verification:** `pnpm vitest run __tests__/convexAuthLockdown.test.ts` — 9/9 passing
- **Committed in:** `7a41e5c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs surfaced by literally following the plan's own specified code/criteria against each other)
**Impact on plan:** Both were internal inconsistencies within the plan document itself (a grep criterion vs. the plan's own explicit scope instruction; a pre-existing test regex vs. the plan's own specified `requireEditor` error shape), not scope creep or new functionality. No architectural changes.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required
None - no external service configuration required. (The Clerk-side role-claim JWT template setup is Plan 49-01/49-02's scope, already landed per the `requires` dependency above; this plan only reads `identity.role` on the Convex side.)

## Next Phase Readiness
- Both Convex-side ROL-02 actions ("Make instruction active", "Mark Do not use") are now server-side role-gated, matching the four FastAPI actions gated in 49-03. All six ROL-02 actions across both surfaces are now enforced.
- `apps/dispatch-control` frontend `<LockedControl>` wiring (ROL-03) and the `comments` capability (ROL-04) — later plans in this phase — can now safely assume both Convex mutations reject a Collaborator server-side; no frontend hiding is required for correctness (only for UX per D-09/D-10).
- Pre-existing, unrelated `tsc --noEmit` failures in `apps/dispatch-control/__tests__/` (5 files, listed in `deferred-items.md`) remain open — out of this plan's scope, flagged for whichever future plan owns dispatch-control test-file type hygiene.

## Self-Check: PASSED

All 9 files created/modified verified present on disk; both task commits (`f871601`, `7a41e5c`) verified present in `git log --all`.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*
