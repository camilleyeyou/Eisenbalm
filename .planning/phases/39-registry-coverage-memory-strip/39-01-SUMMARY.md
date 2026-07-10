---
phase: 39-registry-coverage-memory-strip
plan: 01
subsystem: database
tags: [convex, contract-first, append-only, audit-log, registry, charity]

# Dependency graph
requires:
  - phase: 26-review-gate-charity-registry
    provides: charities table (dedupKey, status, lastFeaturedAt, sanityCharityId), by_workspace_status index, requireOperator-guarded mutation convention
provides:
  - "docs/API_CONTRACTS.md §39 — the contract for charity_corrections, listRecentFeatured, GET /registry/coverage-strip, and the Researcher's corrections read (landed before any implementing code)"
  - "convex/charity_corrections Convex table — append-only, workspace_id + charityKey + sanityCharityId? + text + author + createdAt"
  - "convex/charityCorrections.ts — append (requireOperator-guarded, audit-logged) + listByCharityKey (unguarded, ascending order); no update/patch/remove/delete export"
  - "convex/charities.ts:listRecentFeatured — up to 8 featured charities ordered by lastFeaturedAt desc, unguarded"
affects: [39-02, 39-03, 39-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only Convex table pattern (mirrors audit_log/eval_scores) enforced by a source-scan tripwire test, not just code review"
    - "requireOperator + ctx.runMutation(internal.auditLog.write, ...) copied byte-for-byte from promptVersions.saveVersion, NOT charities.setStatus's gapped no-audit precedent"

key-files:
  created:
    - convex/charityCorrections.ts
    - apps/dispatch-control/__tests__/charity-corrections-append-only.test.ts
    - apps/dispatch-control/__tests__/charityCorrections.test.ts
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/charities.ts
    - convex/_generated/api.d.ts
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "Contract §39 landed as its own top-level '## §39 — Title (Phase NN)' section (matching the §35-§38 convention), not folded into the older '## Phase 26' heading style"
  - "convex/_generated/api.d.ts was hand-edited (2-line additive diff: one import, one fullApi entry) rather than regenerated via `convex codegen`, because this sandbox has no network access and the CLI's fetch call fails offline — mirrors the exact situation and fix documented in the Phase 38-01 SUMMARY (api.js needs no change since it uses anyApi)"

patterns-established:
  - "Append-only enforcement via a standing source-scan tripwire test (mirrors dispatch-control-no-sanity-write.test.ts) — any future edit/delete addition to charity_corrections must fail this test"

requirements-completed: [MEM-01, MEM-02, MEM-03]

# Metrics
duration: ~20min
completed: 2026-07-10
---

# Phase 39 Plan 01: Contract + Convex Foundations Summary

**Append-only `charity_corrections` Convex table with a `requireOperator`-guarded, audit-logged `append` mutation and an unguarded `listByCharityKey` query, plus `charities:listRecentFeatured`, landed only after amending `docs/API_CONTRACTS.md` §39 first per the project's contract-first hard rule.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 completed
- **Files modified/created:** 8

## Accomplishments
- `docs/API_CONTRACTS.md` §39 documents the `charity_corrections` table, `append`/`listByCharityKey` signatures, `charities:listRecentFeatured`, the `GET /registry/coverage-strip` endpoint shape, and the Researcher's corrections read — landed before any implementing code, with a cross-reference added under the existing §26 registry section.
- New append-only `charity_corrections` Convex table (`by_workspace_charityKey` + `by_workspace` indexes) with `convex/charityCorrections.ts` exposing exactly `append` (guarded + audited, mirrors `promptVersions.saveVersion`) and `listByCharityKey` (unguarded, ascending order) — no mutability path exists.
- `charities:listRecentFeatured` returns up to 8 featured charities ordered by `lastFeaturedAt` desc via the existing `by_workspace_status` index, unlocking the Phase 39 downstream coverage-memory-strip and corrections-UI plans.
- Two new tests: a source-scan tripwire proving no edit/delete path exists, and a functional `convex-test` covering auth-throws, the audit row, and chronological ordering (RED-verified before GREEN).

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend API_CONTRACTS.md with §39** - `91bb6d9` (docs)
2. **Task 2 (RED): failing tests for charity_corrections append-only** - `a940384` (test)
2. **Task 2 (GREEN): charity_corrections table + charityCorrections.ts** - `2a32a2b` (feat)
3. **Task 3: charities:listRecentFeatured query** - `771765a` (feat)

**Plan metadata:** (this commit) — docs: complete plan

_TDD task (Task 2) has two commits: test (RED) → feat (GREEN)._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New §39 section (table, functions, endpoint, Researcher read) + one-line §26 cross-reference
- `convex/schema.ts` - New `charity_corrections` table with `by_workspace_charityKey` + `by_workspace` indexes
- `convex/charityCorrections.ts` - New file: `append` (requireOperator + audit) + `listByCharityKey` (unguarded)
- `convex/charities.ts` - New `listRecentFeatured` query (unguarded, ≤8 rows, `lastFeaturedAt` desc)
- `convex/_generated/api.d.ts` - Hand-regenerated to register the new `charityCorrections` module (network-sandboxed environment, see Deviations)
- `apps/dispatch-control/__tests__/charity-corrections-append-only.test.ts` - New: source-scan tripwire (append-only enforcement)
- `apps/dispatch-control/__tests__/charityCorrections.test.ts` - New: functional convex-test (auth-throws, audit row, ascending order)
- `apps/dispatch-control/vitest.config.ts` - Registered `charityCorrections.test.ts` for `edge-runtime` (convex-test requirement)

## Decisions Made
- Followed the plan's exact schema/function shapes verbatim — no field name, index, or signature was invented or altered from the plan/contract.
- `append`'s audit call copies `promptVersions.saveVersion` byte-for-byte (actor from `requireOperator`, `resourceId: charityKey`, `after: JSON.stringify({ text })`) rather than `charities.setStatus`'s no-audit pattern, per the plan's explicit Pitfall 4 guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `convex codegen` fails in this sandbox (no network access)**
- **Found during:** Task 2 (GREEN step — registering the new `charityCorrections` module in the generated API)
- **Issue:** `pnpm --filter @eisenbalm/convex codegen` invokes a network `fetch` internally and errors with `TypeError: fetch failed` in this offline sandbox — it never completes.
- **Fix:** Hand-edited `convex/_generated/api.d.ts` with the same 2-line additive diff `codegen` would produce (one `import type * as charityCorrections from "../charityCorrections.js"` line + one `charityCorrections: typeof charityCorrections;` entry in `fullApi`, both alphabetically ordered). `api.js` required no change since it exports `anyApi` (a runtime proxy, not a per-module literal) — this exact situation and fix is already documented as the precedent in the Phase 38-01 SUMMARY.
- **Files modified:** `convex/_generated/api.d.ts`
- **Verification:** `pnpm --filter dispatch-control test` (full suite, 499/501 passing, 2 pre-existing todos) and `pnpm --filter @eisenbalm/convex typecheck` (`tsc --noEmit`, clean) both pass using the hand-edited types; `t.mutation(api.charityCorrections.append, ...)` / `t.query(api.charityCorrections.listByCharityKey, ...)` resolve correctly in the convex-test harness.
- **Committed in:** `2a32a2b` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to complete Task 2 in an offline sandbox; produces byte-identical output to what `convex codegen` would generate. No scope creep.

## Issues Encountered
None beyond the codegen deviation documented above.

## User Setup Required
None - no external service configuration required. (Note: when this code is deployed against a real Convex environment with network access, running `npx convex dev` or `pnpm --filter @eisenbalm/convex codegen` once will regenerate `api.d.ts`/`api.js` normally and should produce no further diff beyond what's already hand-applied here.)

## Next Phase Readiness
- `api.charityCorrections.append` / `api.charityCorrections.listByCharityKey` and `api.charities.listRecentFeatured` are ready for Plans 39-02 (coverage-strip endpoint + UI), 39-03 (corrections UI), and 39-04 (Researcher corrections read) to import directly.
- Contract-first discipline honored: §39 fully specifies the shapes those plans must implement verbatim.
- No blockers.

---
*Phase: 39-registry-coverage-memory-strip*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present; all 4 task commit hashes (`91bb6d9`, `a940384`, `2a32a2b`, `771765a`) verified present in `git log --oneline --all`.
