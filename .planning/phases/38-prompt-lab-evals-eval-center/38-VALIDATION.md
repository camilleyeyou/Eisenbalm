---
phase: 38
slug: prompt-lab-evals-eval-center
status: draft
nyquist_compliant: false
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
| (filled by planner — foundations first: contract §38; scenario fixtures + GET /eval/scenarios; eval_scores Convex table; promptVersions.activate gate extension; pure discover_candidates() extraction for shadow) | | | EVL-01..05 | | | | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 / Wave 1 Requirements

Foundations the research corrected (must land before consumers), RED-first:
- [ ] Contract-first: `docs/API_CONTRACTS.md` §38 (GET /eval/scenarios; eval_scores table; promptVersions.activate gate + override-with-reason; shadow endpoint) BEFORE code.
- [ ] Golden scenario fixtures (repo, D-01) targeting test-run-REPLICABLE agents ONLY (scout/researcher/advocate/editor/bonus/game/calibrator/design — NOT the section writers that use build_section_writer_prompt, which test-run does not replicate) + `GET /eval/scenarios` read endpoint.
- [ ] `eval_scores` append-only Convex table + requireOperator mutation (EVL-04 / D-09).
- [ ] EVL-03 gate: EXTEND the existing `promptVersions.activate` Convex mutation's `{blocked, reason}` pattern with the eval-gate check (target-metric-up / no regressions, freshness-guarded) + logged override-with-reason (audit_log) — NOT a new pipeline endpoint.
- [ ] EVL-05: extract a pure `discover_candidates()` from scout.py (registry read → search → LLM parse → dedup) with NO Sanity/Convex writes, then the read-only shadow endpoint over it (isolation test asserting zero run-table writes).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Eval drawer auto-selects + scoreboard deltas | EVL-02 | Live model calls | Edit a prompt in Prompt Lab; confirm affected scenarios auto-run and show draft-vs-active deltas |
| Commit gate blocks + override works | EVL-03 | Live | Attempt commit with a regression → blocked; override-with-reason → commits + audit row |
| Eval Center drift time-series | EVL-04 | Visual/live | Confirm scenario cards + an append-only time-series that grows per eval run |
| Shadow run isolation | EVL-05 | Live + side-effect | Run a shadow discovery; confirm output previews AND no pitchLog/pipelineRuns/agent_runs rows were written |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0/1 covers scenarios+endpoint, eval_scores, the activate-gate extension, and the shadow isolation extraction
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
