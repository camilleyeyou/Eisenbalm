---
phase: 49-roles-permissions
plan: 09
subsystem: testing
tags: [vitest, source-scan, rbac, integration-gate, human-verify, tripwire]

# Dependency graph
requires:
  - phase: 49-02
    provides: "the recorded empirical claim-propagation gate (ROL-01) in 49-VERIFICATION.md"
  - phase: 49-03
    provides: "FastAPI _require_editor on revision/factcheck/review + the signoffs sounds-human in-handler branch"
  - phase: 49-04
    provides: "Convex requireEditor on promptVersions.activate + charities.setStatus"
  - phase: 49-05
    provides: "convex/comments.ts (add + listByIssueNumber)"
  - phase: 49-07
    provides: "the six LockedControl-wrapped gated controls (ROL-03 rendering)"
  - phase: 49-08
    provides: "the IssueComments affordance mounted across the workspace (ROL-04)"
provides:
  - "roleGateInventory.test.ts — a durable source-scan tripwire asserting the gate is on EXACTLY six actions (SC-2): 3 FastAPI Depends(_require_editor) + 1 signoffs in-handler branch + 2 Convex requireEditor(ctx)"
  - "A green phase gate: full pytest (692 pass / 38 skip) + full vitest (959 pass) + strict Next build + Convex dev:once sync"
  - "Human sign-off (49-VERIFICATION.md) that a Collaborator sees locked controls + a working comment affordance, with the ROL-01 empirical gate on record"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fs-recursive source-scan tripwire (mirrors dispatch-control-no-sanity-write.test.ts): count gate call-sites across both backends and assert an exact allowlist of files — fails if a 7th action is gated or one of the six is ungated."

key-files:
  created:
    - "apps/dispatch-control/__tests__/roleGateInventory.test.ts"
  modified:
    - ".planning/phases/49-roles-permissions/49-VERIFICATION.md"

key-decisions:
  - "Task 1 & 2 (both type=auto) executed by a gsd-executor and verified green with zero regressions on the first run — no code fixes were needed. Task 3 (checkpoint:human-verify) was performed by the user in a real signed-in env and is NOT auto-approvable: despite workflow auto_advance being on, the empirical/UX gates require genuine human observation and were driven interactively rather than fabricated."
  - "roleGateInventory.test.ts excludes convex/_generated and convex/lib/auth.ts (where requireEditor is DEFINED) from the call-site count so the definition is not miscounted as a seventh gate."

patterns-established:
  - "Exactly-N-gated source-scan tripwire as the durable SC-2 guard against future scope creep in role gating."

requirements-completed: [ROL-01, ROL-02, ROL-03, ROL-04]

# Metrics
completed: 2026-07-16
---

# Phase 49 Plan 09: Integration Gate Summary

**Proved the phase's cross-cutting invariants: a durable `roleGateInventory.test.ts` source-scan asserting the gate is on EXACTLY six actions (SC-2), the full pipeline pytest + dispatch-control vitest suites + strict Next build + Convex dev sync all green, and a human sign-off that a Collaborator sees locked-with-explanation controls (ROL-03) plus a working comment affordance (ROL-04), with the ROL-01 empirical claim-propagation gate on record.**

## Accomplishments

- **Task 1 — SC-2 tripwire (auto):** `roleGateInventory.test.ts` (vitest + node fs, no convex-test needed) asserts:
  - `Depends(_require_editor)` appears in EXACTLY `revision.py`, `factcheck.py`, `review.py` under `packages/pipeline/src/eisenbalm_pipeline/api/` and no other api file (count == 3).
  - `signoffs.py` gates via the `kind == "sounds-human"` in-handler branch and does NOT use the route `Depends`.
  - `requireEditor(ctx)` appears in EXACTLY `convex/promptVersions.ts` and `convex/charities.ts` (count == 2), excluding the definition in `convex/lib/auth.ts`.
  - Scope-creep guard: no other FastAPI route or Convex mutation gained the gate.
  - `pnpm vitest run __tests__/roleGateInventory.test.ts` → 4 tests pass, exit 0.
- **Task 2 — phase gate (auto):** all four green on the first run, no regressions:
  - `uv run pytest -x -q` → **692 passed, 38 skipped**.
  - `pnpm test` (dispatch-control vitest) → **959 passed**.
  - `pnpm --filter dispatch-control build` → strict Next build succeeded (typecheck + lint + routes).
  - `pnpm --filter @eisenbalm/convex dev:once` → synced to `dev:modest-magpie-797`.
- **Task 3 — human-verify (checkpoint):** signed in as a Collaborator in a real env (localhost:3001 against real Clerk + Convex):
  - Locked control (Prompt Lab **Make active**) renders present-but-locked and is server-refused (ROL-03). **PASS**
  - Comment affordance on `/my-tasks` renders and a submitted comment appears (ROL-04). **PASS**
  - "Empirical claim-propagation gate (ROL-01)" entry confirmed present in 49-VERIFICATION.md. **PASS**

## Task Commits

1. **Task 1: roleGateInventory source-scan tripwire (SC-2)** — `aeb8b3a`
2. **Task 2: full suites + strict build + Convex sync** — no code changes needed (all green first run); no commit.
3. **Task 3: Collaborator UX + empirical gate sign-off** — recorded in `49-VERIFICATION.md` (this plan's docs commit).

## Files Created/Modified

- `apps/dispatch-control/__tests__/roleGateInventory.test.ts` — the exactly-six-gated source-scan tripwire.
- `.planning/phases/49-roles-permissions/49-VERIFICATION.md` — appended the Collaborator UX Task-3 sign-off to the existing verification record.

## Decisions Made

- See `key-decisions` in frontmatter: human-verify was driven interactively (not auto-approved) despite `auto_advance` being on, because empirical/UX gates cannot be honestly automated; the inventory scan excludes the `requireEditor` definition file.

## Deviations from Plan

- **Residual (carried from 49-02):** the FastAPI live-token leg of the empirical gate (`claims["role"]`) was not exercised — the pipeline is unreachable from local (`NEXT_PUBLIC_PIPELINE_URL` unset). It is unit-test-covered (`test_role_gate.py`, green) and recorded transparently in 49-VERIFICATION.md as a follow-up rather than claimed as verified. Does not block the phase's automated enforcement.

## Issues Encountered

- None on the automated tasks (all green first run). Clerk-config friction during the dependency plan (49-02) was resolved live; see 49-02-SUMMARY.md.

## Next Phase Readiness

- ROL-01..ROL-04 delivered and gated: six server-side enforced actions (SC-1/SC-2, tripwired), six locked-with-explanation controls never hidden (SC-3), read-everything-and-comment (SC-4).
- One tracked residual: FastAPI live-token spot-check for when the pipeline is deployed/reachable.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*

## Self-Check: PASSED

`roleGateInventory.test.ts` present on disk; commit `aeb8b3a` in git history; empirical + Collaborator-UX sign-offs recorded in 49-VERIFICATION.md.
