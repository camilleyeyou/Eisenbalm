---
phase: 33-accept-fix-wiring-decision-rail
plan: 02
subsystem: convex
tags: [convex, qa-findings, resolution-state, claim-checks, pitch-log, convex-test]
requires:
  - phase: 33-01
    provides: "API_CONTRACTS.md §33.1/§33.2/§33.7 frozen shapes"
provides:
  - "qaCorrections additive resolution fields (resolution/resolutionReason/resolvedBy/resolvedAt, D-01)"
  - "qaCorrections:setResolution pipeline-lane mutation (requirePipelineSecret, legacy accepted sync)"
  - "qaCorrections:byId public query"
  - "claim_checks.checkedAt stamped by setStatus on checked/skipped (D-13)"
  - "pitchLog:selectedByRunId query on by_runId_and_selected (D-12)"
affects: [33-03, 33-04, 33-05, phase-34-publish-gate]
tech-stack:
  added: []
  patterns:
    - "pipeline-lane secret guard cloned from claimChecks:insertBatch (NOT the public insert exception)"
    - "reopen = patch with undefined optional fields (Convex removes them) + accepted:false"
key-files:
  created:
    - apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts
  modified:
    - convex/schema.ts
    - convex/qaCorrections.ts
    - convex/claimChecks.ts
    - convex/pitchLog.ts
    - apps/dispatch-control/vitest.config.ts
decisions:
  - "codegen output (_generated/api.d.ts) is module-typeof format — function names never appear in it; type visibility verified via tsc --noEmit + convex-test instead of the plan's literal grep"
  - "checkedAt persists when a claim is re-opened to pending (patch only adds the stamp on checked/skipped; it never clears) — matches §33.2 which only forbids stamping on pending"
metrics:
  duration: "~12 min"
  completed: "2026-07-08"
  tasks: 3
  files: 6
---

# Phase 33 Plan 02: Convex Resolution State Summary

Additive Convex resolution state for QA findings: secret-guarded `qaCorrections:setResolution` with legacy `accepted` sync, `byId`/`selectedByRunId` queries, and a `checkedAt` stamp in `claimChecks:setStatus` — covered by a 6-test edge-runtime convex-test suite.

## What Was Built

- **Schema (additive only):** `qaCorrections` gained `resolution` (accepted/dismissed union, absent = open), `resolutionReason`, `resolvedBy`, `resolvedAt`; `claim_checks` gained `checkedAt`. No existing field or index changed.
- **`qaCorrections:setResolution`** — pipeline-lane mutation mirroring `claimChecks:insertBatch`'s `requirePipelineSecret` guard. Patches the four resolution fields and syncs legacy `accepted = (resolution === 'accepted')`. Passing `resolution: undefined` (reopen, D-04) clears all four optional fields via Convex's undefined-removes-field patch semantics and sets `accepted: false`.
- **`qaCorrections:byId`** — public read so the pipeline findings endpoints (33-03) can load one finding by Convex `_id`.
- **`pitchLog:selectedByRunId`** — public query on the existing `by_runId_and_selected` index; feeds the decision rail's hook card (D-12) with `charityName` + `scoutSummary`.
- **`claimChecks:setStatus`** now stamps `checkedAt = Date.now()` only when status flips to `checked`/`skipped` — never on `pending` (no false check time). `requireOperator` lane and status validation untouched; Phase 26 `ClaimsChecklist.tsx` needs zero changes.
- **Test suite** `qaCorrectionsResolution.test.ts` (6/6 green under edge-runtime): secret-guard rejection (missing + wrong secret), accept sync, dismiss reason, reopen clears, checkedAt stamp gating, byId/selectedByRunId round-trips.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | e6e86bf | Schema fields + setResolution/byId + selectedByRunId |
| 2 | 4f96a66 | checkedAt stamp in setStatus + codegen/typecheck |
| 3 | cdb86c5 | convex-test suite + vitest edge-runtime registration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale worktree — fast-forwarded to master**
- **Found during:** Load plan
- **Issue:** The parallel-executor worktree was at Phase 30 HEAD; the 33-02 plan and the 33-01 contract amendment only existed on master.
- **Fix:** `git merge --ff-only master` (clean fast-forward, no divergence).

**2. [Rule 3 - Blocking] Worktree had no node_modules**
- **Found during:** Task 2 codegen
- **Issue:** `convex` binary missing — fresh worktree, deps never installed.
- **Fix:** `pnpm install --prefer-offline`; also copied the gitignored `convex/.env.local` from the main checkout so codegen could resolve the deployment.

**3. [Plan verification mismatch] `grep setResolution convex/_generated/api.d.ts` is structurally impossible**
- **Found during:** Task 2
- **Issue:** The generated `api.d.ts` is module-`typeof` based (`import type * as qaCorrections from "../qaCorrections.js"`); NO function names appear in it — existing functions like `allSignedOff` don't either. The plan's acceptance grep assumed a per-function codegen format.
- **Fix:** Substituted equivalent verification: `tsc --noEmit` on the convex package (clean) + the convex-test suite compiling and calling `api.qaCorrections.setResolution` / `api.pitchLog.selectedByRunId` at runtime (proves the generated API surface carries them). `_generated` files correctly have no diff — the module list is unchanged, so there was nothing new to commit there.
- **Note:** `convex codegen` in this CLI version also pushed functions to the dev deployment (`modest-magpie-797`) — harmless since all changes are additive optional fields + new functions.

## Verification

- `pnpm --filter dispatch-control test:unit __tests__/qaCorrectionsResolution.test.ts -- --run` → 6/6 green (edge-runtime).
- `pnpm --filter dispatch-control test:unit __tests__/convexAuthLockdown.test.ts -- --run` → 9/9 green (no regression; public `insert` exception intact).
- `pnpm --filter @eisenbalm/convex run typecheck` → clean.
- `git diff` on `convex/qaCorrections.ts` across the plan: zero removed lines — `insert` byte-unchanged, including the GAM-05 "Do NOT gate this handler" comment (it wraps across two source lines, which is why the plan's single-line grep missed it).
- `api as any` count in run-monitor unchanged (pre-existing baseline 3; none added).

## Handoff Notes for 33-03

- `setResolution` must be registered in `_PIPELINE_SECRET_GUARDED_PATHS` in `packages/pipeline/.../lib/convex_client.py` when the pipeline findings endpoints land (§33.1 says both edits land together; the Convex-side guard is live now, so any pipeline call without central secret injection will throw Unauthorized).
- Reopen semantics: call `setResolution` with `resolution` omitted — the handler clears all four fields and sets `accepted: false`.
- `checkedAt` is never cleared on re-open to pending; the rail's "last checked" should use `max(checkedAt)` across done rows only (§33.7).

## Known Stubs

None — all new functions are fully wired and tested.

## Self-Check: PASSED

- FOUND: convex/schema.ts resolution + checkedAt fields
- FOUND: convex/qaCorrections.ts setResolution/byId
- FOUND: convex/pitchLog.ts selectedByRunId
- FOUND: apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts
- FOUND: commits e6e86bf, 4f96a66, cdb86c5
