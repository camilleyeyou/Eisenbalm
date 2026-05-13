---
phase: 03-convex-deployment
plan: 03
subsystem: database
tags: [convex, typescript, mutations, queries, schema-validators]

# Dependency graph
requires:
  - phase: 03-convex-deployment
    provides: "Convex workspace + deployed schema (modest-magpie-797 dev) + _generated/server.{d.ts,js} stubs"
provides:
  - "convex/pipelineRuns.ts (byRunId / create / updateStatus) per API_CONTRACTS §4.1"
  - "convex/pitchLog.ts (byRunId / insert / markSelected) per API_CONTRACTS §4.2"
  - "convex/deliberationEvents.ts (byRunId / byRunIdAndType / insert) per API_CONTRACTS §4.3"
  - "convex/agentVotes.ts (byRunId / byRunIdAndCharity / insert) per API_CONTRACTS §4.4"
  - "convex/qaCorrections.ts (byRunId / insert) per API_CONTRACTS §4.5"
  - "All five enum-bearing mutations enforce v.literal unions matching schema verbatim"
  - "All insert mutations set timestamp: Date.now() server-side (D-12)"
  - "pipelineRuns.updateStatus throws if run not found (D-13)"
affects: [03-04 codegen+deploy, 04 pipeline-python-client, 09 deliberation-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex query/mutation file = one file per table, filename derives API surface (api.pipelineRuns.byRunId, etc.)"
    - "v.literal(...) unions copy schema.ts enum values byte-for-byte (no string drift across the contract)"
    - "Server-side timestamp injection (Date.now()) — never trust caller's clock"
    - "Mutation throws on missing-row updates → pipeline bugs fail loud, not silent"

key-files:
  created:
    - convex/pipelineRuns.ts
    - convex/pitchLog.ts
    - convex/deliberationEvents.ts
    - convex/agentVotes.ts
    - convex/qaCorrections.ts
  modified: []

key-decisions:
  - "Files written byte-for-byte from API_CONTRACTS §4.1–4.5 — zero design work, zero helper extraction, zero consolidation (D-10)"
  - "No abstraction layer over Convex query/mutation builders — bare exports per the contract"
  - "convex/_generated/ regenerated locally to confirm typecheck, but NOT committed in this plan — Plan 03-04 owns the codegen commit"

patterns-established:
  - "Pattern 5 from RESEARCH §Architecture: one TypeScript file per Convex table; filename = api.<filename>.<export>"
  - "Pattern: argument validator enums mirror schema.ts v.literal(...) values byte-for-byte; pipeline calls with wrong literal string fail at the boundary"
  - "Pattern: server-injected timestamps on insert; client never supplies timestamp arg"

requirements-completed: [CVX-02, CVX-03]

# Metrics
duration: 7min
completed: 2026-05-13
---

# Phase 3 Plan 3: Query/Mutation Functions Summary

**Five Convex function files (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections) — one file per table, copied byte-for-byte from API_CONTRACTS §4.1–4.5; all insert mutations stamp `timestamp: Date.now()` server-side; pipelineRuns.updateStatus throws on missing run.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-13T17:11Z (executor handoff after STATE.md indicated Plan 03-02 complete)
- **Completed:** 2026-05-13T17:14Z (after `convex dev --once` regenerated `_generated/api.d.ts`)
- **Tasks:** 5 (all `type="auto"`, no checkpoints)
- **Files created:** 5

## Accomplishments

- All five query/mutation files exist at the exact paths `convex/<tableName>.ts` per D-10
- Convex CLI's `convex dev --once` regenerated `_generated/api.d.ts` with all five new modules (`agentVotes`, `deliberationEvents`, `pipelineRuns`, `pitchLog`, `qaCorrections`) — typecheck passes (codegen exited clean in 4.76s)
- Every `v.literal(...)` enum value (status, eventType, vote, severity) matches `convex/schema.ts` byte-for-byte
- Every insert mutation injects `timestamp: Date.now()` server-side (D-12); no insert accepts a caller-supplied timestamp
- `pipelineRuns.updateStatus` throws `Run not found: ${runId}` when the row is missing (D-13)
- Imports use the required relative path `'./_generated/server'` and `'convex/values'` — no `@convex/*` alias inside `convex/` itself
- `convex/schema.ts` not modified (mtime 2026-05-09, byte-identical pre/post)
- `convex/_generated/` regenerated but intentionally NOT committed (Plan 03-04 owns that commit per success criteria)

## Task Commits

Each task was committed atomically (5 commits total):

1. **Task 1: convex/pipelineRuns.ts (byRunId / create / updateStatus)** — `0b67b1d` (feat)
2. **Task 2: convex/pitchLog.ts (byRunId / insert / markSelected)** — `66b6e6f` (feat)
3. **Task 3: convex/deliberationEvents.ts (byRunId / byRunIdAndType / insert)** — `ff0f3ae` (feat)
4. **Task 4: convex/agentVotes.ts (byRunId / byRunIdAndCharity / insert)** — `632bc4d` (feat)
5. **Task 5: convex/qaCorrections.ts (byRunId / insert)** — `31d0aa8` (feat)

## Files Created/Modified

| Path | Lines | Exports | Purpose |
| --- | --- | --- | --- |
| `convex/pipelineRuns.ts` | 49 | `byRunId`, `create`, `updateStatus` | Per-run record; updateStatus throws if missing |
| `convex/pitchLog.ts` | 51 | `byRunId`, `insert`, `markSelected` | Scout's candidate log; markSelected flips bool across all entries for runId |
| `convex/deliberationEvents.ts` | 54 | `byRunId`, `byRunIdAndType`, `insert` | Raw deliberation stream; 7-way eventType union |
| `convex/agentVotes.ts` | 42 | `byRunId`, `byRunIdAndCharity`, `insert` | Queryable vote subset; 3-way vote union |
| `convex/qaCorrections.ts` | 36 | `byRunId`, `insert` | QA correction log; 3-way severity union |
| **Total** | **232** | **15 exports** | |

Line counts confirm no truncation — each file is the contract verbatim plus the required imports.

## Verification

Per-task verify commands (grep + test -f) all passed at task close. Final integrity check:

```
$ pnpm --filter @eisenbalm/convex exec convex dev --once
✔ 10:14:50 Convex functions ready! (4.76s)
```

Codegen succeeded, which means:
- All five files parse as valid TypeScript
- Schema (`schema.ts`) and function files are mutually consistent
- `_generated/api.d.ts` now exposes `api.{pipelineRuns,pitchLog,deliberationEvents,agentVotes,qaCorrections}` with full type info for downstream consumers

## Decisions Made

None — plan executed exactly as written. The plan dictated verbatim copies of API_CONTRACTS §4.1–4.5; this executor produced exactly that. Zero deviation from the source contract.

## Deviations from Plan

None — plan executed exactly as written.

The plan was deliberately mechanical: each task was "create file X with exactly content Y." No bugs surfaced during execution (Rule 1), no missing critical functionality detected (Rule 2), no blocking issues (Rule 3), no architectural questions (Rule 4).

The convex codegen succeeded on first attempt — schema + function-file alignment was correct on the first write.

## Issues Encountered

None during planned work.

## Out-of-Scope Observations (not fixed)

- `convex/schema.ts` shows as untracked (`??`) in `git status` — this is a pre-existing condition dating from Phase 1 / Plan 03-01. The schema file has never been committed to git. **This is NOT in scope for Plan 03-03** (which only adds query/mutation files) and the success criteria explicitly state "schema UNTOUCHED — git status confirms no modification." The file has mtime 2026-05-09 and was not modified by this plan. Plan 03-04 should commit `convex/schema.ts` alongside `convex/_generated/` to fully resolve this. Logged here for visibility; not added to `deferred-items.md` because Plan 03-04 already owns the next Convex commit cycle.

## Known Stubs

None. The files implement the full contract; no placeholders, no TODO markers, no empty handlers.

## User Setup Required

None — no external service configuration required by this plan. Andrew's manual smoke test for Phase 3 (browsing `/_debug/convex`, curl smoke) is deferred until Plan 03-08 per the phase roadmap.

## Next Phase Readiness

**Plan 03-04 (codegen + deploy) is unblocked.** It should:

1. Commit the regenerated `convex/_generated/{api,server,dataModel}.{d.ts,js}` files (and `convex/schema.ts` if not already tracked) — D-08 mandates `_generated/` ships in git
2. Run `pnpm --filter @eisenbalm/convex deploy` to push schema + the five new function files to the `modest-magpie-797` dev deployment
3. Verify in the Convex dashboard that all five functions appear under their respective table modules

**Downstream contract surface now in place:**

- `api.pipelineRuns.byRunId` / `.create` / `.updateStatus`
- `api.pitchLog.byRunId` / `.insert` / `.markSelected`
- `api.deliberationEvents.byRunId` / `.byRunIdAndType` / `.insert`
- `api.agentVotes.byRunId` / `.byRunIdAndCharity` / `.insert`
- `api.qaCorrections.byRunId` / `.insert`

Phase 4 (Python pipeline client) and Phase 9 (deliberation layer subscriptions) will both consume this API via the HTTP `/api/mutation` endpoint and the TypeScript `useQuery` hook respectively. Argument shapes match API_CONTRACTS §3 byte-for-byte, so the Python `convex_mutation('pipelineRuns:create', {...})` calls planned for Phase 4 will succeed without further translation.

## Self-Check: PASSED

- `convex/pipelineRuns.ts` — FOUND (49 lines, 3 exports verified by grep)
- `convex/pitchLog.ts` — FOUND (51 lines, 3 exports verified by grep)
- `convex/deliberationEvents.ts` — FOUND (54 lines, 3 exports verified by grep)
- `convex/agentVotes.ts` — FOUND (42 lines, 3 exports verified by grep)
- `convex/qaCorrections.ts` — FOUND (36 lines, 2 exports verified by grep)
- Commit `0b67b1d` (Task 1) — FOUND in `git log`
- Commit `66b6e6f` (Task 2) — FOUND in `git log`
- Commit `ff0f3ae` (Task 3) — FOUND in `git log`
- Commit `632bc4d` (Task 4) — FOUND in `git log`
- Commit `31d0aa8` (Task 5) — FOUND in `git log`
- `convex/schema.ts` — UNTOUCHED (mtime 2026-05-09, byte-identical)
- `convex/_generated/` — regenerated; NOT staged in this plan (Plan 03-04 owns)
- `pnpm --filter @eisenbalm/convex exec convex dev --once` — exited 0, codegen succeeded in 4.76s

---
*Phase: 03-convex-deployment*
*Completed: 2026-05-13*
