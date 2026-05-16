---
phase: 5
slug: agent-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed map authored in `05-RESEARCH.md` §"Validation Architecture" — this file pins the contract; downstream agents inherit those rows.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (already in dev-deps from Phase 4) |
| **Config file** | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/ -x -q --timeout=30` |
| **Full suite command** | `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/ -v --timeout=120` |
| **Real-mode smoke** | `cd packages/pipeline && EISENBALM_STUB_MODE=false uv run pytest tests/test_pipeline_real_mode.py -x` |
| **Estimated runtime** | ~30s quick, ~120s full, ~60s real-mode (one Tavily call, mocked OpenRouter) |

---

## Sampling Rate

- **After every task commit:** Run the quick command (`pytest -x -q --timeout=30`)
- **After every plan wave:** Run the full suite (`pytest -v --timeout=120`)
- **Before `/gsd:verify-work`:** Full stub-mode suite green + manual real-mode smoke against Railway URL
- **Max feedback latency:** 30 seconds (stub mode) · 120 seconds (full suite)

---

## Per-Task Verification Map

Authoritative source: `05-RESEARCH.md` §"Phase Requirements to Test Map". Summary below; planner expands each REQ-ID into a task with a concrete `<automated>` command pointing to the matching test file.

| REQ-ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| AGT-01 | Calibrator bonusType rotation avoids most-recent type | unit | `pytest tests/agents/test_calibrator.py::test_bonus_rotation -x` | ❌ W0 | ⬜ pending |
| AGT-02 | Calibrator voice constants match CLAUDE_CODE_BRIEF.md | unit | `pytest tests/agents/test_calibrator.py::test_voice_constants -x` | ❌ W0 | ⬜ pending |
| AGT-03 | Scout returns 3-5 candidates | unit (stub) | `pytest tests/agents/test_scout.py::test_candidate_count -x` | ❌ W0 | ⬜ pending |
| AGT-04 | Scout dedup filters previously featured charities | unit | `pytest tests/agents/test_scout.py::test_dedup -x` | ❌ W0 | ⬜ pending |
| AGT-05 | Advocate scores each candidate; writes agentVotes | unit (stub) | `pytest tests/agents/test_advocate.py -x` | ❌ W0 | ⬜ pending |
| AGT-06 | Editor gate1 interrupt fires only on narrow score gap | unit | `pytest tests/agents/test_editor.py::test_interrupt_threshold -x` | ❌ W0 | ⬜ pending |
| AGT-07 | Researcher emits founderName + founderNameSourceUrl | unit (stub) | `pytest tests/agents/test_researcher.py::test_founder_fields -x` | ❌ W0 | ⬜ pending |
| AGT-08 | verify_research sets founderNameVerified correctly | unit | `pytest tests/agents/test_verify.py -x` | ❌ W0 | ⬜ pending |
| AGT-09 | Section writers receive isolated voice + research only | unit | `pytest tests/lib/test_voice.py::test_prompt_isolation -x` | ❌ W0 | ⬜ pending |
| AGT-10 | FounderBio uses role framing when founderNameVerified=False | unit | `pytest tests/agents/test_founder_bio.py::test_role_framing -x` | ❌ W0 | ⬜ pending |
| AGT-11 | BonusWriter branches on bonusType; correct schema per branch | unit | `pytest tests/agents/test_bonus.py -x` | ❌ W0 | ⬜ pending |
| AGT-12 | GameWriter embedCode has no forbidden constructs | unit | `pytest tests/agents/test_game.py::test_no_external_deps -x` | ❌ W0 | ⬜ pending |
| AGT-13 | DesignAgent colors pass hex regex + WCAG-AA | unit | `pytest tests/lib/test_wcag.py -x` | ❌ W0 | ⬜ pending |
| AGT-14 | DesignAgent fonts in whitelist | unit | `pytest tests/agents/test_design.py::test_font_whitelist -x` | ❌ W0 | ⬜ pending |
| AGT-15 | Layer-1 rules.py catches exclamation + sentiment keywords | unit | `pytest tests/agents/qa/test_rules.py -x` | ❌ W0 | ⬜ pending |
| AGT-16 | Editor Final emits editor-final event | unit (stub) | `pytest tests/agents/test_editor_final.py -x` | ❌ W0 | ⬜ pending |
| AGT-17 | modelVersions populated after each LLM call | unit | `pytest tests/lib/test_openrouter.py::test_model_version_recording -x` | ❌ W0 | ⬜ pending |
| AGT-18 | Scout max_tool_calls=8; Researcher max_tool_calls=12 | unit | `pytest tests/agents/test_tool_limits.py -x` | ❌ W0 | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Additional cross-cutting tests required by `05-RESEARCH.md` (not 1:1 with a single REQ-ID):

| Concern | Test File | Automated Command |
|---------|-----------|-------------------|
| CostRecorder soft warn @ 70% + hard cap @ 100% | `tests/lib/test_cost.py` | `pytest tests/lib/test_cost.py -x` |
| Tavily mock returns N+1 → tool-limit-exceeded | `tests/agents/test_tool_limits.py` | (covered above) |
| End-to-end real-mode pipeline (cost cap, modelVersions populated, zero Layer-1 hard-rule errors) | `tests/test_pipeline_real_mode.py` | `EISENBALM_STUB_MODE=false pytest tests/test_pipeline_real_mode.py -x` |

---

## Wave 0 Requirements

- [ ] `convex/schema.ts` patch — extend `deliberationEvents.eventType` union to include `cost-warning` + `agent-tool-limit-exceeded`; change `qaCorrections.severity` enum from `minor|moderate|major` → `info|warning|error` (matches API_CONTRACTS §3.6 and CONTEXT D-01). Redeploy via `pnpm --filter @eisenbalm/convex deploy`.
- [ ] `packages/pipeline/tests/agents/` directory — one test file per agent (14 agents + verify_research)
- [ ] `packages/pipeline/tests/lib/test_wcag.py` — known color pairs + WCAG boundary cases
- [ ] `packages/pipeline/tests/lib/test_voice.py` — assert `build_section_writer_prompt()` output contains only voice + research + charity + styleBrief; no cross-section fields
- [ ] `packages/pipeline/tests/lib/test_openrouter.py` — mock OpenRouter response; assert model+revision recorded into state
- [ ] `packages/pipeline/tests/lib/test_cost.py` — assert warn @ 70%, raise @ 100%
- [ ] `packages/pipeline/tests/agents/qa/__init__.py` + `test_rules.py` — known-good + known-bad strings exercise every Layer-1 predicate
- [ ] `packages/pipeline/tests/agents/qa/test_judge.py` — mock OpenRouter judge response; assert Pydantic parsing + Convex write
- [ ] `packages/pipeline/tests/test_pipeline_real_mode.py` — phase-gate smoke against Railway URL
- [ ] `packages/pipeline/tests/conftest.py` — shared fixtures: mock Convex client, mock Sanity client, stub OpenRouter responses, mock Tavily, mock httpx for verify_research

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Voice rubric drift over real runs | AGT-10, AGT-15 | Voice judgment is what the rubric exists to capture — at some point Andrew must read N issues and confirm Jesse voice maintained. No automated rubric can be the final word on its own ground truth. | Andrew reads three back-to-back real-mode issues. Confirms zero "this doesn't sound like Jesse" instances. Logs verdict in STATE.md. |
| Font whitelist Andrew-approval (D-16) | AGT-14 | Subjective brand decision + WeasyPrint render confirmation per font requires Andrew's eye. | Andrew reviews `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` candidate list, marks each `✓` or `✗`, commits. |
| First-real-run cost baseline | OPS-03 / D-08 | Per-run LLM cost baseline unknown until ~5 real runs (STATE.md blocker). Calibration value for `PIPELINE_COST_CAP_USD`. | Run 5 stub-mode + 1 real-mode pipeline runs. Record per-agent + total USD from `pipelineRuns.cost`. Adjust `PIPELINE_COST_CAP_USD` env default if baseline diverges materially from $10. |
| QA rubric iteration (Andrew's edits) | AGT-15 | The first `agents/qa/rubric.md` is a research-authored draft; Andrew refines based on what he actually flags in first ~3 real issues. | After first 3 published issues, Andrew opens `rubric.md`, edits axes / examples / forbidden constructs. Commit; QA picks up next run. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency declared
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Convex schema patch + 18 test files)
- [ ] No watch-mode flags (pytest runs are one-shot with `--timeout`)
- [ ] Feedback latency < 30s for quick command, < 120s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter after gsd-plan-checker passes

**Approval:** pending
