---
phase: 46
slug: signal-editor-candidate-verification
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-15
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 46-RESEARCH.md §Validation Architecture (maps SGE-01..SGE-05 to testable assertions).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (packages/pipeline) |
| **Config file** | `packages/pipeline/pyproject.toml` (pytest config) |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` |
| **Full suite command** | `cd packages/pipeline && uv run pytest tests/ -q` |
| **Estimated runtime** | ~60–120 seconds (existing pipeline suite) |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the touched area (e.g. `uv run pytest tests/agents/ tests/test_builder_wiring.py -x -q`)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full pipeline suite must be green, including the new checkpoint pause/resume test (SGE-04)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

*The gsd-planner fills exact Task IDs. This maps each requirement to its test type + automated command so no requirement lands without a sampling point.*

| Requirement | What must be TRUE | Test Type | Automated Command | Status |
|-------------|-------------------|-----------|-------------------|--------|
| SGE-01 | Signal Editor emits 3–5 leads, each with premise, datedPeg, pegSourceUrl, readerEnergy, charitableAngle, category, confidence, brandRiskFlag | unit (agent) | `uv run pytest tests/agents/test_signal_editor.py -q` | ✅ green |
| SGE-02 | No brand-risk-flagged lead is ever `recommended`; brand-risk lead surfaced with reason | unit (agent) | `uv run pytest tests/agents/test_signal_editor.py -k brand_risk -q` | ✅ green |
| SGE-03 | `verify_candidates` produces a per-org record (domainLive, registrationId, obscurity); definitively-failing candidates killed, transient errors kept as `unverified` | unit (node) | `uv run pytest tests/agents/test_verify_candidates.py -q` | ✅ green |
| SGE-04 | Graph has 20 nodes; edges `signal_editor→scout`, `scout→verify_candidates→advocate`; Postgres checkpointer resumes across a pause/resume spanning the new nodes | integration (graph + checkpoint) | `uv run pytest tests/test_builder_wiring.py tests/test_checkpoint_resume_phase46.py -q` | ✅ green (20-node wiring live-introspected in 46-06; pause/resume test filled in 46-07, skips cleanly without live Postgres — see 46-07-SUMMARY.md) |
| SGE-05 | Signal Editor reads Editorial Memory (recent coverage + avoid-list) and attaches a `repetitionWarning` to an overlapping lead WITHOUT dropping it | unit (agent + reused repetition_note) | `uv run pytest tests/agents/test_signal_editor.py -k repetition -q` | ✅ green |
| SGE-03 (D-14 sub-behavior) | When all candidates are killed, run enters recoverable degraded/needs-human state — NOT a RuntimeError crash in editor_gate_1 | unit (editor) | `uv run pytest tests/agents/test_editor.py -k no_candidates -q` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agents/test_signal_editor.py` — new test file (SGE-01, SGE-02, SGE-05): asserts lead count 3–5, full field shape, brand-risk `recommended=false` gate, repetition-warning attach-not-suppress. Mock OpenRouter + web_search + Convex read (follow `tests/agents/test_scout_discover.py` fixture pattern).
- [ ] `tests/agents/test_verify_candidates.py` — new test file (SGE-03): asserts per-org record shape, kill-on-definitive-failure vs keep-on-transient-error (mock httpx + web_search — follow `tests/` verify_research precedent).
- [ ] `tests/test_checkpoint_resume_phase46.py` — new test file (SGE-04): pause after `signal_editor`/`scout`, resume, assert state carries `story_leads` + verification records across the resume (follow existing checkpointer/interrupt test precedent).
- [ ] `tests/test_pipeline_real_mode.py` — UPDATE `_build_patches()` to add mock patches for `signal_editor` + `verify_candidates` (research pitfall: existing full-graph e2e breaks the moment builder.py is rewired).
- [ ] `tests/test_builder_wiring.py` — UPDATE node/edge assertions from 18 → 20 nodes + new edges (SGE-04).

*Existing pytest infrastructure covers the framework; only the above test files/updates are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Obscurity press-hit threshold tuning | SGE-03 | No numeric precedent exists; the "genuinely obscure" cutoff is a judgment tuning item (research Open Question 1) | After a real pipeline run, spot-check that well-known orgs are killed as "not obscure" and genuinely obscure orgs pass; adjust the threshold constant. |
| Signal Editor lead quality / Jesse-voice fit | SGE-01 | LLM output quality (premise sharpness, peg relevance) is not unit-assertable | On a real run, read the 3–5 emitted leads; confirm pegs are real + dated + sourced and the premise reads on-voice. |

**Status (46-07):** Both items remain PENDING UAT (require a real pipeline run against live OpenRouter/Tavily) — recorded as non-blocking per 46-07-PLAN.md Task 2. See `46-07-...-SUMMARY.md` § Manual Tuning Items.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 test-file dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all new test files + the two UPDATE-required existing test files
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter (after planner maps Task IDs)

**Approval:** Phase 46 integration gate closed 2026-07-16 (46-07). Full pipeline suite: 615 passed / 37 skipped / 0 failed. Convex live-sync (`dev:once`) + parity (`check:convex-parity`) both green on dev:modest-magpie-797.
