---
phase: 38
slug: prompt-lab-evals-eval-center
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control, incl. convex-test) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `cd apps/dispatch-control && npx vitest run` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — vitest does not type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package.
- **After every plan wave:** Run BOTH full suites — this phase touches pipeline (scenarios endpoint, shadow discovery) and frontend/Convex (eval drawer, gate mutation, eval_scores, Eval Center).
- **Before `/gsd:verify-work`:** Both full suites green + `pnpm --filter dispatch-control build` exits 0 + the manual/live checks below.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------|-------------------|-------------|--------|
| T1 Contract §38 amendment | 38-01 | 1 | EVL-04 (+contract for 01/02/03/05) | doc source-scan | `grep -q "## §38" docs/API_CONTRACTS.md` | ❌ Wave 1 | ⬜ |
| T2 eval_scores table + evalScores.ts | 38-01 | 1 | EVL-04 | unit (convex-test) | `npx vitest run __tests__/evalScores.test.ts` | ❌ Wave 1 | ⬜ |
| T1 scenario manifest + loader | 38-02 | 2 | EVL-01 | unit (pytest) | `uv run pytest tests/evals/test_scenario_loader.py -x -q` | ❌ Wave 1 | ⬜ |
| T2 GET /eval/scenarios + TS client | 38-02 | 2 | EVL-01 | integration (pytest) | `uv run pytest tests/api/test_eval_scenarios.py -x -q` | ❌ Wave 1 | ⬜ |
| T1 activate eval-gate + override | 38-04 | 2 | EVL-03 | unit (convex-test) | `npx vitest run __tests__/promptVersionsEvalGate.test.ts` | ❌ Wave 1 | ⬜ |
| T2 VersionHistoryPanel override UI | 38-04 | 2 | EVL-03 | build | `pnpm --filter dispatch-control build` | ❌ | ⬜ |
| T1 pure discover_candidates() | 38-03 | 3 | EVL-05 | unit (pytest) | `uv run pytest tests/agents/test_scout_discover.py -x -q` | ❌ Wave 1 | ⬜ |
| T2 shadow-run + isolation proof | 38-03 | 3 | EVL-05 | integration (pytest) | `uv run pytest tests/api/test_shadow_run.py -x -q` | ❌ Wave 1 | ⬜ |
| T1 EvalDrawer scoreboard | 38-05 | 3 | EVL-02 | component (vitest) | `npx vitest run __tests__/EvalDrawer.test.tsx` | ❌ Wave 1 | ⬜ |
| T2 mount EvalDrawer | 38-05 | 3 | EVL-02 | build | `pnpm --filter dispatch-control build` | ❌ | ⬜ |
| T1 Eval Center cards + drift | 38-06 | 4 | EVL-04 | component (vitest) | `npx vitest run __tests__/EvalCenter.test.tsx` | ❌ Wave 1 | ⬜ |
| T2 ShadowRunPanel + client | 38-06 | 4 | EVL-05 | build | `pnpm --filter dispatch-control build` | ❌ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Every code-producing task authors its RED test in the same task (tdd="true") and its `<automated>` verify targets that test; the two build-only tasks (04-T2, 05-T2, 06-T2) gate on the strict `pnpm --filter dispatch-control build` (MEMORY: vitest does not type-check). No 3 consecutive tasks lack an automated verify.

---

## Wave 0 / Wave 1 Requirements

Foundations the research corrected (must land before consumers), RED-first — all in Waves 1-2:
- [x] Contract-first: `docs/API_CONTRACTS.md` §38 (GET /eval/scenarios; eval_scores table; promptVersions.activate gate + override-with-reason; shadow endpoint) BEFORE code → Plan 38-01 Task 1.
- [x] Golden scenario fixtures (repo, D-01) targeting test-run-REPLICABLE agents ONLY (scout/researcher/advocate/editor/bonus/game/calibrator/design — NOT the section writers that use build_section_writer_prompt) + `GET /eval/scenarios` read endpoint → Plan 38-02.
- [x] `eval_scores` append-only Convex table + requireOperator mutation (EVL-04 / D-09) → Plan 38-01 Task 2.
- [x] EVL-03 gate: EXTEND the existing `promptVersions.activate` Convex mutation's `{blocked, reason}` pattern with the eval-gate check (target-metric-up / no regressions, freshness-guarded) + logged override-with-reason (audit_log) — NOT a new pipeline endpoint → Plan 38-04.
- [x] EVL-05: extract a pure `discover_candidates()` from scout.py (registry read → search → LLM parse → dedup) with NO Sanity/Convex writes, then the read-only shadow endpoint over it (isolation test asserting zero run-table writes) → Plan 38-03.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Eval drawer auto-selects + scoreboard deltas | EVL-02 | Live model calls | Edit a prompt in Prompt Lab; confirm affected scenarios auto-run and show draft-vs-active deltas |
| Commit gate blocks + override works | EVL-03 | Live | Attempt commit with a regression → blocked; override-with-reason → commits + audit row |
| Commit gate CLEAN PASS (non-override path) | EVL-03 | Live | Edit a prompt with NO regression, run "Run evals for v{N}" on the saved version (writes commit-tagged eval_scores), then Activate(N) WITHOUT an override → succeeds (`blocked: false`, no `overridden` flag). Confirms the gate is passable on its intended path, not override-only. |
| Eval Center drift time-series | EVL-04 | Visual/live | Confirm scenario cards + an append-only time-series that grows per eval run |
| Shadow run isolation | EVL-05 | Live + side-effect | Run a shadow discovery; confirm output previews AND no pitchLog/pipelineRuns/agent_runs rows were written |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0/1 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0/1 covers scenarios+endpoint, eval_scores, the activate-gate extension, and the shadow isolation extraction
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner, 2026-07-09)
