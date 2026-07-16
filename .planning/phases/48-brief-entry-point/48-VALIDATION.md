---
phase: 48
slug: brief-entry-point
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `48-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (pipeline)** | pytest 8.3 + pytest-asyncio (configured, `packages/pipeline/pyproject.toml`) |
| **Framework (dispatch-control)** | Vitest 3.2 (`apps/dispatch-control/package.json`) |
| **Config file (pipeline)** | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| **Config file (dispatch-control)** | `apps/dispatch-control/vitest.config.*` |
| **Quick run (pipeline)** | `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_start_run_brief_seed.py tests/test_brief_run_endpoint.py -x` |
| **Quick run (dispatch-control)** | `pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen` |
| **Full suite (pipeline)** | `cd packages/pipeline && uv run pytest` |
| **Full suite (dispatch-control)** | `pnpm --filter dispatch-control test:unit` |
| **Strict build gate** | `pnpm --filter dispatch-control build` (vitest does NOT type-check — `[[run-strict-build-before-frontend-phase-done]]`) |
| **Estimated runtime** | pipeline ~60–90s full · dispatch-control ~30s full |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick-run command(s) for the files touched (pipeline and/or dispatch-control).
- **After every plan wave:** Run BOTH full suites (`uv run pytest` + `pnpm --filter dispatch-control test:unit`).
- **Before `/gsd:verify-work`:** Both full suites green **plus** `pnpm --filter dispatch-control build` exits 0 **plus** Convex live-synced (`pnpm --filter @eisenbalm/convex dev:once`).
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| ENT-01 | Second Create-panel cell renders "Start from my brief" as a peer card; submit chains `ensureByNumber` → `triggerBriefRun` → `router.push(issueHref(n))` | unit (vitest, component) | `pnpm --filter dispatch-control test:unit -- CreatePanel` | ❌ W0 (new) | ⬜ pending |
| ENT-02 | Graph fork: brief mode routes `calibrator → verify_candidates → researcher` (skips signal_editor/scout/advocate/editor_gate_1/chronicler); `START → calibrator` unconditional & unchanged | unit (pytest, source-scan) | `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py -x` | ❌ W0 (new) | ⬜ pending |
| ENT-02 | `_start_run` seeds `entry_mode`/`winning_charity`/`candidates`/`brief` into `initial_state`; `briefs:insert` only when brief present; reduced `agent_keys` queue; existing callers byte-unchanged | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_start_run_brief_seed.py -x` | ❌ W0 (new) | ⬜ pending |
| ENT-02 | `POST /pipeline/run/brief` — 422 on empty org name, reuses one-at-a-time + budget 409s, 200 `{runId}`, emits `run.triggered` audit row | unit (pytest, FastAPI TestClient, mirrors `test_control.py`) | `cd packages/pipeline && uv run pytest tests/test_brief_run_endpoint.py -x` | ❌ W0 (new) | ⬜ pending |
| ENT-03 | A brief-started run (stub-mode) produces all 7 section fields + QA corrections + claims + reaches `publisher` — same artifacts as a discovery run, minus deliberation | integration (pytest, extend e2e) | `cd packages/pipeline && uv run pytest tests/test_pipeline_e2e.py -k brief -x` | ❌ W0 (extend) | ⬜ pending |
| ENT-03 | Stages 2–5 of a brief-started issue render identically to a discovery-started issue | manual-only | — | manual UAT | ⬜ pending |
| ENT-04 | `verify_candidates` persists exactly one `VerificationRecord` for the human org even when killed; `winning_charity`/researcher unaffected | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_verify_candidates_brief_mode.py -x` | ❌ W0 (new/extend Phase 46) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/API_CONTRACTS.md` §7 (`entry_mode` + `source_material` DispatchState fields) + new **§48** (endpoint, `runs.entryMode` field, brief-seed shape) — **contract-first gate, must land before any code** (CLAUDE.md hard rule).
- [ ] `convex/schema.ts` `runs.entryMode` field + `convex/runs.ts::create` arg — **must be live-synced** via `pnpm --filter @eisenbalm/convex dev:once` before any pipeline call exercises it (`[[convex-functions-need-live-sync]]`).
- [ ] `packages/pipeline/tests/test_builder_entry_mode_wiring.py` — source-scan test mirroring `test_builder_wiring.py`'s pattern (both `add_conditional_edges` calls + correct path_maps + unchanged `START → calibrator`).
- [ ] `packages/pipeline/tests/test_start_run_brief_seed.py` — `_start_run` seeding + `briefs:insert`-only-when-brief + `agent_keys` override + existing-caller regression.
- [ ] `packages/pipeline/tests/test_brief_run_endpoint.py` — FastAPI TestClient tests for `POST /pipeline/run/brief`.
- [ ] `packages/pipeline/tests/test_verify_candidates_brief_mode.py` (or extend the existing Phase 46 verify_candidates test file — confirm exact name at Wave 0).
- [ ] Extend `packages/pipeline/tests/test_pipeline_e2e.py` with a brief-mode case (clone `test_pipeline_e2e_runId_threaded_to_all_datastores`).
- [ ] `apps/dispatch-control/__tests__/CreatePanel.test.tsx` — new file (none exists today).
- [ ] Extend `apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx` with an `entryMode === 'brief'` render-path case.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stages 2–5 of a brief-started issue are visually "indistinguishable" from a discovery-started issue | ENT-03 | No snapshot/visual-regression tooling exists in this repo for cross-stage DOM parity | Start a brief run + a discovery run in the console; open both at Draft / Fact Check / Voice Pass / Approval; confirm identical layout, controls, and provenance rendering |
| Brief-started issue legitimately has NO deliberation section (D-12 honest divergence) | ENT-03 | Reader-facing absent-state is a design judgment, not a code assertion | Open a brief-started issue's reader page; confirm `DeliberationSlot` renders its absent state without error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (contract + Convex schema + new test files)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after mapping every task)

**Approval:** pending
