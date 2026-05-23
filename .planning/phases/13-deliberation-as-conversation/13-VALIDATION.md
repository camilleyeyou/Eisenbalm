---
phase: 13
slug: deliberation-as-conversation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-23
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 13-RESEARCH.md §"Validation Architecture". Per-Task Verification
> Map filled by the planner now that PLAN.md tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (pipeline) + Vitest (web) |
| **Config file** | `packages/pipeline/pyproject.toml` · `apps/web/vitest.config.ts` |
| **Quick run command** | `cd packages/pipeline && python -m pytest -q` · `pnpm --filter web test:unit` |
| **Full suite command** | `cd packages/pipeline && python -m pytest` && `pnpm --filter web test:unit` && `pnpm --filter web build` |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (pytest for pipeline tasks, `test:unit` for web tasks)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green (pipeline pytest + web Vitest + `pnpm --filter web build`)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-T1 | 13-01 | 1 | DEL-CONV-03 | source-scan | `grep -c "deliberation_conversation" docs/API_CONTRACTS.md` | ✅ (Task creates) | ⬜ pending |
| 13-01-T2 | 13-01 | 1 | DEL-CONV-02/03 | source-scan + import | `cd packages/pipeline && python -c "from eisenbalm_pipeline.graph.state import DispatchState; assert 'deliberation_conversation' in DispatchState.__annotations__"` | ✅ (Task creates) | ⬜ pending |
| 13-01-T3 | 13-01 | 1 | DEL-CONV-06 | collect + suite | `cd packages/pipeline && python -m pytest -q` && `pnpm --filter web test:unit` | ❌→✅ Wave 0 files | ⬜ pending |
| 13-02-T1 | 13-02 | 2 | DEL-CONV-01 | pytest unit | `cd packages/pipeline && python -m pytest tests/test_chronicler.py -x -q` | ✅ (13-01-T3) | ⬜ pending |
| 13-02-T2 | 13-02 | 2 | DEL-CONV-01/02 | pytest unit | `cd packages/pipeline && python -m pytest tests/test_builder_wiring.py tests/test_sanity_write.py -x -q` | ✅ (13-01-T3) | ⬜ pending |
| 13-03-T1 | 13-03 | 2 | DEL-CONV-04 | build | `pnpm --filter web build` | ✅ infra | ⬜ pending |
| 13-03-T2 | 13-03 | 2 | DEL-CONV-04/06 | vitest + build | `pnpm --filter web test:unit deliberation-no-model-names && pnpm --filter web build` | ✅ DEL-04 tripwire | ⬜ pending |
| 13-03-T3 | 13-03 | 2 | DEL-CONV-05/06 | vitest + build | `pnpm --filter web test:unit && pnpm --filter web build` | ✅ (13-01-T3 + tripwires) | ⬜ pending |

**Regression (must stay green throughout — D-18 + DEL-04):**

| Guard | Requirement | Automated Command |
|-------|-------------|-------------------|
| Deterministic transcript fallback survives | DEL-CONV-01/05 (D-18) | `cd packages/pipeline && python -m pytest tests/agents/test_editor.py::test_transcript_format -x` |
| No model names in DeliberationSlot | DEL-CONV-06 (DEL-04) | `pnpm --filter web test:unit deliberation-no-model-names` |
| Game sandbox tripwire | cross-cutting | `pnpm --filter web test:unit game-sandbox` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/pipeline/tests/test_chronicler.py` — Chronicler node unit tests: faithful turns (winner/scores/names trace to state), well-formed `{speaker,text}` list, fallback-on-LLM-failure leaves `editor_gate_1` transcript intact, `model_versions['chronicler']` recorded (created in Plan 13-01 Task 3; turned green in Plan 13-02 Task 1)
- [ ] `packages/pipeline/tests/test_builder_wiring.py` — source-scan asserting `add_edge("editor_gate_1", "chronicler")` + `add_edge("chronicler", "researcher")` present and the old direct edge absent (created in 13-01-T3; green in 13-02-T2)
- [ ] `packages/pipeline/tests/test_sanity_write.py::test_conversation_write` — mock-Sanity write asserting `conversation` array with `_key` fields (created in 13-01-T3; green in 13-02-T2)
- [ ] `apps/web/__tests__/deliberation-conversation.test.ts` — render-layer source scan: turns render attributed bubbles (`del-conversation`, `role="log"`, `conversation` prop), no `dangerouslySetInnerHTML`, no model names (created in 13-01-T3 with the render assertions skip-gated; un-skipped in 13-03-T3)
- [ ] Confirm `packages/pipeline/tests/agents/test_editor.py::test_transcript_format` (existing) still passes — the deterministic template is now the D-18 fallback, not removed

*Existing infrastructure (pytest + Vitest + the DEL-04 / game-sandbox tripwires) covers most behaviors; the four new test files above are the gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Conversation "reads as a genuine, engaging multi-turn debate" (editorial quality) | Success criterion 1 | Subjective brand/voice quality — Andrew's editorial judgement | After a real pipeline run, Andrew reviews the generated conversation in Sanity Studio + the rendered issue page; confirms turn-taking reads as a real exchange in Jesse voice |
| Chat thread visually formatted inline (not buried, no literal `#`/`**`) on a live published issue | Success criterion 2 | Visual fidelity needs a browser against published Sanity content | Render a published issue at `/issue/[slug]`; confirm conversation appears at top of `#deliberation`, formatted, with per-speaker attribution |

*Automated tests cover structure, fidelity-by-source, fallback, no-model-names, and build; the above two are the human editorial/visual passes.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (4 new test files in Plan 13-01 Task 3)
- [x] No watch-mode flags (test:unit = `vitest run`; pytest non-watch)
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-05-23
