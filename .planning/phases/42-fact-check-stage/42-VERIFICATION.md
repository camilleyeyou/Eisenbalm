---
phase: 42-fact-check-stage
plan: 08
gate: integration
verified: 2026-07-15
status: automated-gate-green, demo-leg-pending-human-uat
---

# Phase 42 Verification

**Gate:** Plan 42-08 Task 1 — full pipeline pytest, full console vitest, the no-Sanity-write tripwire, the strict dispatch-control build, the Convex typecheck, and the Convex dev-deployment sync.

## Pass/Fail Table

| # | Check | Command | Result | Status |
|---|-------|---------|--------|--------|
| 1 | Full pipeline pytest suite | `cd packages/pipeline && uv run pytest -x -q` | 578 passed, 36 skipped, 0 failed (14.34s) | ✅ PASS |
| 2 | Full console vitest suite | `pnpm --filter dispatch-control test:unit` | 86 files passed \| 1 skipped (87); 743 passed \| 2 todo (745) | ✅ PASS |
| 3 | no-Sanity-write tripwire (explicit, isolated run) | `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` (from `apps/dispatch-control`) | 1 file passed, 2/2 tests passed | ✅ PASS |
| 4 | Strict dispatch-control build | `pnpm --filter dispatch-control build` | Compiled successfully; all 30 routes generated incl. `/issues/[issueNumber]/fact-check`; exit 0 | ✅ PASS |
| 5 | Convex typecheck | `pnpm --filter @eisenbalm/convex typecheck` (`tsc --noEmit`) | Exit 0, no errors | ✅ PASS |
| 6 | Convex dev-deployment sync | `pnpm --filter @eisenbalm/convex dev:once` (`convex dev --once`) | `✔ Convex functions ready! (5.7s)` against `dev:modest-magpie-797` | ✅ PASS (synced live) |
| 7 | Convex deploy-parity guard (memory-note tripwire, 260710-fxx) | `pnpm check:convex-parity` | `✓ convex deploy parity: 53 called functions all present on dev:modest-magpie-797 (124 deployed)` | ✅ PASS |

**All 7 automated checks green.** The two project-memory tripwires this gate exists to close — "vitest doesn't type-check" (item 4) and "committing convex/*.ts ≠ deployed" (items 6-7) — are both explicitly exercised and both pass.

## Command Output Tails

### 1. Pipeline pytest

```
........................................................................ [ 11%]
........................................................................ [ 23%]
........................................................................ [ 35%]
...................ss..ss.............ssssssss...............sssss...... [ 46%]
...................................sssssss.....s................s....... [ 58%]
.............................................................s.......... [ 70%]
.......................................................sssss....s....... [ 82%]
.................................................ss..................... [ 93%]
..................s...................                                   [100%]
578 passed, 36 skipped, 11 warnings in 14.34s
```

(11 warnings are pre-existing Pydantic serialization UserWarnings on Portable-Text/ClaimSpanRef dict-vs-model fixtures, unrelated to Phase 42 — not new.)

### 2. Console vitest (full suite, includes Phase 42 files)

```
 ✓ __tests__/claimChecksFactcheck.test.ts (9 tests) 114ms
 ✓ __tests__/derivedState.test.ts (45 tests) 36ms
 ✓ __tests__/claimProvenance.test.ts (7 tests) 28ms
 ✓ __tests__/factCheckFilters.test.ts (19 tests) 26ms
 ✓ __tests__/dispatch-control-no-sanity-write.test.ts (2 tests) 104ms
 ...
 Test Files  86 passed | 1 skipped (87)
      Tests  743 passed | 2 todo (745)
   Duration  18.42s
```

(The 1 skipped file / 2 todo tests are the pre-existing `workspace-upsert.test.ts` items, unrelated to Phase 42.)

### 3. no-Sanity-write tripwire (isolated)

```
 ✓ __tests__/dispatch-control-no-sanity-write.test.ts (2 tests) 16ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

Confirms `factCheckClient.ts` and `ClaimProvenanceCard.tsx` (the two new Phase 42 console surfaces that talk to claim data) introduced no direct Sanity write — every content-touching action still routes through the pipeline API boundary.

### 4. Strict build

```
   ▲ Next.js 15.5.18
 ✓ Compiled successfully in 4.5s
   Linting and checking validity of types ...
 ✓ Generating static pages (11/11)
...
├ ƒ /issues/[issueNumber]/fact-check      4.28 kB         177 kB
...
```

### 5. Convex typecheck

```
> @eisenbalm/convex@0.0.0 typecheck
> tsc --noEmit
(exit 0, no output)
```

### 6. Convex dev sync

```
> @eisenbalm/convex@0.0.0 dev:once
> convex dev --once

- Preparing Convex functions...
✔ Convex functions ready! (5.7s)
```

### 7. Deploy-parity guard

```
✓ convex deploy parity: 53 called functions all present on dev:modest-magpie-797 (124 deployed)
```

## Manual-Only Item (deferred, not gated by this record)

**The 8-step live demo leg (Plan 42-08 Task 2)** — My Tasks → Fact Check claim detail → Ask agent for better evidence → Confirm replacement → live counters/My-Tasks/Approval-readiness/header update, plus the FCT-07 changed-since-check flip and the Draft/Approval provenance-card parity check — is an operator-driven, human-only end-to-end reactive-UI verification per `42-VALIDATION.md`'s Manual-Only Verifications table. It cannot be executed inside this autonomous gate (no live browser session available to this agent). It is recorded as a **pending human-verification item** in `42-08-SUMMARY.md` and carried forward to the phase's human-UAT flow. All underlying units it exercises (claimChecksFactcheck, derivedState/deriveFactCheckSummary, ClaimProvenanceCard, factCheckFilters, ClaimMark, claimProvenance, SourceIndex, the factcheck endpoints, the content-patch reset-touched-claims tests) are covered and green in checks #1-#2 above.

---
*Phase: 42-fact-check-stage*
*Gate executed: 2026-07-15*
