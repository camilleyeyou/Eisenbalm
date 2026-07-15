---
phase: 42
slug: fact-check-stage
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
updated: 2026-07-15
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (console `apps/dispatch-control`) · pytest 8.3.x + pytest-asyncio (pipeline `packages/pipeline`) · convex-test (edge-runtime, in `apps/dispatch-control/__tests__`) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` · `packages/pipeline/pyproject.toml` |
| **Quick run command** | `pnpm --filter dispatch-control test:unit -- __tests__/<file>` · `cd packages/pipeline && uv run pytest tests/<file> -x -q` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -x -q && pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build && pnpm --filter @eisenbalm/convex typecheck` |
| **Estimated runtime** | pipeline suite ~1-2 min · console suite ~1-2 min · build ~1-2 min (each incremental) |

> Project memory: vitest does NOT type-check — run the strict `pnpm --filter dispatch-control build` before declaring any frontend work done. Convex functions must be synced to the dev deployment (`pnpm --filter @eisenbalm/convex dev:once`, dev:modest-magpie-797), not merely committed. The standing `dispatch-control-no-sanity-write.test.ts` source-scan tripwire must stay green (no direct console→Sanity writes) — Plan 42-06/42-07 assert it.

---

## Sampling Rate

- **After every task commit:** Run the quick-run command scoped to the touched file(s).
- **After every plan wave:** Run the relevant full suite (pipeline `pytest -x -q` for Waves 2-3 pipeline plans; console `test:unit` + strict `build` for Waves 2/4/5 console plans); for any wave touching `convex/*.ts`, sync dev (`dev:once`) before treating it verified.
- **Before `/gsd:verify-work`:** the Plan 42-08 gate — both full suites green, strict build 0, convex typecheck clean, Convex synced to dev, no-Sanity-write tripwire green, demo-leg UAT approved.
- **Max feedback latency:** < 180 s per quick run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | FCT-01/05/06/07 (contract) | source-scan | `grep -q "## §42" docs/API_CONTRACTS.md` | ✅ target doc | ⬜ pending |
| 42-01-02 | 01 | 1 | FCT-01/05/07 (schema+fns) | convex-test + typecheck | `pnpm --filter @eisenbalm/convex typecheck && pnpm --filter dispatch-control test:unit -- __tests__/claimChecksFactcheck.test.ts` | ❌ tdd (RED-first) | ⬜ pending |
| 42-02-01 | 02 | 2 | FCT-01 | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_researcher_importance.py -x -q` | ❌ tdd (RED-first) | ⬜ pending |
| 42-02-02 | 02 | 2 | FCT-01 | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_publisher_importance.py -x -q` | ❌ tdd (RED-first) | ⬜ pending |
| 42-03-01 | 03 | 2 | FCT-07 | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -k "touched or reset" -x -q` | ✅ extend existing | ⬜ pending |
| 42-03-02 | 03 | 2 | FCT-07 | integration (pytest) | `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -x -q` | ✅ extend existing | ⬜ pending |
| 42-04-01 | 04 | 3 | FCT-05 | integration (pytest) | `cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q` | ❌ tdd (RED-first) | ⬜ pending |
| 42-04-02 | 04 | 3 | FCT-06 | integration (pytest) | `cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q` | ❌ tdd (RED-first) | ⬜ pending |
| 42-05-01 | 05 | 2 | FCT-02 | unit (vitest) | `pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts` | ✅ extend existing | ⬜ pending |
| 42-05-02 | 05 | 2 | FCT-02 | strict build | `pnpm --filter dispatch-control build` | ✅ (type gate) | ⬜ pending |
| 42-06-01 | 06 | 4 | FCT-04 | component (vitest) | `pnpm --filter dispatch-control test:unit -- __tests__/ClaimProvenanceCard.test.tsx` | ❌ tdd (RED-first) | ⬜ pending |
| 42-06-02 | 06 | 4 | FCT-03 | unit (vitest) | `pnpm --filter dispatch-control test:unit -- __tests__/factCheckFilters.test.ts` | ❌ tdd (RED-first) | ⬜ pending |
| 42-06-03 | 06 | 4 | FCT-02/05/06 | suite + build | `pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build` | ✅ (screen + swap) | ⬜ pending |
| 42-07-01 | 07 | 5 | FCT-04 | regression (vitest) | `pnpm --filter dispatch-control test:unit -- __tests__/ClaimMark.test.tsx __tests__/claimProvenance.test.ts` | ✅ existing | ⬜ pending |
| 42-07-02 | 07 | 5 | FCT-04 | suite + build | `pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build` | ✅ existing (no-sanity-write) | ⬜ pending |
| 42-08-01 | 08 | 6 | FCT-01..07 | full gate | `cd packages/pipeline && uv run pytest -x -q && pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build && pnpm --filter @eisenbalm/convex typecheck` | ✅ | ⬜ pending |
| 42-08-02 | 08 | 6 | FCT-01..07 | MANUAL (demo leg UAT) | operator-driven; underlying units covered above | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Every non-manual task carries an `<automated>` verify command; new test files are created RED-first inside their `tdd="true"` task (Wave 0 folded into the task), satisfying Dimension 8.*

---

## Wave 0 Requirements

New test scaffolds are created RED-first within the code task that owns them (task-level TDD), rather than as a separate up-front wave — each is listed with its owning task:

- [x] `apps/dispatch-control/__tests__/claimChecksFactcheck.test.ts` — new Convex fields/mutations (importance, changedSinceCheck, markChanged/keepAsWritten/remove/updateClaim; allSignedOff regression) — **Plan 42-01 Task 2**
- [x] `packages/pipeline/tests/test_researcher_importance.py` — ClaimOutput.importance + mapped_claims — **Plan 42-02 Task 1**
- [x] `packages/pipeline/tests/test_publisher_importance.py` — sourced/unsourced importance merge — **Plan 42-02 Task 2**
- [x] `packages/pipeline/tests/test_content_patch_endpoints.py` (new cases) — `_touched_block_indices` / `_reset_touched_claims` incl. index-drift + self-reset ordering — **Plan 42-03**
- [x] `packages/pipeline/tests/test_factcheck_endpoints.py` — six actions + evidence preview/apply — **Plan 42-04**
- [x] `apps/dispatch-control/__tests__/derivedState.test.ts` (extended) — `deriveFactCheckSummary` / `isMustFix` / corrected `deriveTasks` / allSignedOff↔mustFix equivalence — **Plan 42-05 Task 1**
- [x] `apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx` — 9-field never-blank card + `deriveSourcePublisher`/`deriveClaimAgent` — **Plan 42-06 Task 1**
- [x] `apps/dispatch-control/__tests__/factCheckFilters.test.ts` — 7 filter predicates + org/person + weak-source heuristics — **Plan 42-06 Task 2**
- [x] Regression: `dispatch-control-no-sanity-write.test.ts` stays green after `factCheckClient.ts` / `ClaimProvenanceCard.tsx` — **asserted Plan 42-06/42-07/42-08**
- [x] Regression: `claimChecks:allSignedOff` still blocks facts-cleared when a must-fix claim exists — **Plan 42-01 Task 2 + Plan 42-05 Task 1 equivalence test**
- [x] Framework install: none — pytest + vitest + convex-test already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The live demo leg (My Tasks → Fact Check claim detail → Ask agent for better evidence → Confirm → counters/header/My-Tasks/Approval/publish-lock update live) | FCT-05 (+ FCT-02, FCT-06) | End-to-end reactive UI across Convex + pipeline + Sanity; the full live update chain is integration-level and cannot be asserted in a unit harness | Plan 42-08 Task 2, 8-step walkthrough on a seeded/real run with an unsourced Load-bearing claim |
| FCT-07 changed-since-check flip in the live UI after a section edit | FCT-07 | Requires a real content patch flowing through content.py → Convex reactivity → the Stage 3 chip | Plan 42-08 Task 2, step 7 (unit-covered by test_content_patch_endpoints reset cases) |

---

## Validation Sign-Off

- [x] All non-manual tasks have `<automated>` verify (or a tdd RED-first test created in-task)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only the final checkpoint task is manual, and it is backed by 42-08 Task 1's full-suite gate)
- [x] Wave 0 covers all new test files (folded into owning tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 180 s per quick run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-07-15
