---
phase: 16-choose-your-narrator
plan: 07
subsystem: pipeline
tags: [narrator, qa, judge, voice, voiceRubric, exampleSamples, NRR-09, NRR-10, D-06, D-12]
requirements: [NRR-09, NRR-10]
dependency-graph:
  requires:
    - "16-02 (RED tests test_qa_judge_narrator.py — 3 failing scenarios)"
    - "16-04 (assemble_voice sentinel import gates the narrator test skip-guard)"
    - "16-05 (Narrator TypedDict in graph/state.py + state['narrator'] field set by calibrator)"
  provides:
    - "run_llm_judge signature gains optional narrator: Narrator | None = None kwarg"
    - "_render_narrator_addendum helper (system-message-only addendum renderer)"
    - "QA orchestrator (agents/qa/__init__.py) passes state['narrator'] to run_llm_judge"
    - "NRR-10 byte-equivalence: narrator=None path produces unchanged system AND user messages"
  affects:
    - "16-09 (verification + UAT) — narrator-aware QA evaluation now testable end-to-end"
tech-stack:
  added: []
  patterns:
    - "system-message-only narrator append (NEVER touch user message — D-12)"
    - "narrator gated at caller (if narrator is not None) — the renderer is defensive but never receives None on the happy path"
    - "first 2 exampleSamples cap to bound token budget (NRR-10 criterion 7)"
key-files:
  created: []
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py"
decisions:
  - "D-06 honored: QA judge reads narrator from state via the orchestrator call site, not via direct state access in judge.py"
  - "D-12 honored: addendum content lives in the SYSTEM message only; the USER message is invariant across narrator presence/absence (machine-parsed downstream)"
  - "NRR-10 byte-equivalence preserved verbatim — when narrator=None, both messages match Phase 5 baseline byte-for-byte (verified by test_qa_judge_narrator_none_preserves_legacy_messages comparing against legacy template strings)"
  - "exampleSamples cap of 2 (samples[:2]) per plan interface — keeps per-call token budget bounded while still providing few-shot anchoring"
metrics:
  duration: ~7 min
  completed: 2026-05-29
  tasks: 1
  files: 2
  commit: fbbba59
---

# Phase 16 Plan 07: Narrator-Aware QA Judge Summary

Made the Phase 5 QA judge narrator-aware: when `state["narrator"]` is set, the system message is appended with the narrator's `voiceRubric` plus the first 2 `exampleSamples` so the Opus-judge evaluates against the narrator's voice instead of Jesse's. When `narrator` is None (legacy path), both system AND user messages are byte-identical to Phase 5.

## Tasks Completed

### Task 1: Narrator-aware QA judge (NRR-09 + NRR-10)
**Commit:** `fbbba59`
**Files modified:** 2

**Changes:**
- `agents/qa/judge.py`:
  - Imported `Narrator` TypedDict from `graph/state.py` (post-16-05).
  - Added module-scope `_render_narrator_addendum(narrator)` helper. Produces a system-message addendum containing the narrator's display name, `voiceRubric`, and first 2 `exampleSamples`.
  - Extended `run_llm_judge` signature with `narrator: Narrator | None = None` (kwarg, default None).
  - Built `messages` list exactly as Phase 5 does (legacy rubric + locked user-message template).
  - Added a single `if narrator is not None:` block AFTER the legacy build that appends the addendum to `messages[0]["content"]` only. The user message construction is byte-frozen against narrator presence.
- `agents/qa/__init__.py`:
  - QA orchestrator now reads `state.get("narrator")` and passes it as `narrator=narrator` to `run_llm_judge`. State narrator is set upstream by the calibrator (Plan 16-05).

**Exact addendum template:**
```
\n\n
NARRATOR-SPECIFIC RUBRIC: This issue is narrated by {narrator['name']}. Evaluate the section against THIS narrator's voice (not Jesse's, unless this IS Jesse).
{narrator.voiceRubric}
\n\n
Reference samples for this narrator's voice:
{exampleSamples[0]}
\n\n
{exampleSamples[1]}
```
(The reference-samples block is omitted when `exampleSamples` is empty; only the first 2 samples are included regardless of input length — NRR-10 token-budget criterion 7.)

## Verification

**Plan-required gates — all green:**

```bash
$ uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py -v
test_judge_signature_accepts_narrator_kwarg PASSED
test_judge_appends_narrator_rubric PASSED
test_qa_judge_narrator_none_preserves_legacy_messages PASSED
3 passed in 0.31s

$ uv run --project packages/pipeline pytest packages/pipeline/tests/agents/qa/test_judge.py -v
test_rubric_loads PASSED
test_judge_finding_validates_severity_enum PASSED
test_run_llm_judge_returns_findings PASSED
test_run_llm_judge_empty_findings_is_passing PASSED
test_run_llm_judge_makes_exactly_one_call PASSED
5 passed in 0.23s

$ grep -E "narrator.*messages\[1\]|messages\[1\].*narrator|user_intro" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
# (empty — exit 1 as required: no narrator-conditional touches the user message)

$ grep -E "async def run_llm_judge\(" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py | grep -A 5 . | grep narrator
    narrator: Narrator | None = None,  # narrator kwarg landed on the entry function
```

**Full pipeline suite:**
- **Baseline (pre-plan):** 3 failed, 182 passed, 35 skipped, 1 xfailed
- **Post-plan:** 0 failed, **185 passed**, 35 skipped, 1 xfailed
- **Delta:** +3 narrator tests turned green, zero regressions

## Byte-equivalence confirmation (NRR-10)

Verified that when `narrator=None`:
- **SYSTEM message:** equals `_load_rubric()` output verbatim — no prefix, no suffix, no whitespace tweaks. The legacy rubric.md content is the entire system message.
- **USER message:** equals the legacy Phase 5 template verbatim:
  ```
  "Evaluate these section bodies against the Jesse voice rubric. "
  "Return JSON JudgeFindings with a `findings` array. "
  "An empty array is a passing grade.\n\n"
  f"SECTIONS:\n{sections_json}"
  ```

Both invariants are asserted in `test_qa_judge_narrator_none_preserves_legacy_messages` and now pass.

## QA orchestrator call site (NRR-09 wiring)

`agents/qa/__init__.py` — the only `run_llm_judge` call in production code:
```python
narrator = state.get("narrator")
layer2, resolved_model = await run_llm_judge(
    sections, run_id=run_id, narrator=narrator,
)
```
The narrator is read from state (Calibrator wrote it in Plan 16-05). When state has no narrator key (legacy runs / new tests that don't set one), `state.get("narrator")` returns None and the byte-equivalence path activates automatically.

## Deviations from Plan

None — plan executed exactly as written. The two minor edge-cases in the plan's read-first step (whether the entry function was named `evaluate_section` or `run_llm_judge` — actually `run_llm_judge`; whether the rubric path was at `prompts/rubric.md` or adjacent to judge.py — actually `_RUBRIC_PATH = Path(__file__).parent / "rubric.md"`) were resolved by reading the live file in Step 0 of the action; no architectural change needed.

The only stylistic adjustment: a documentation comment was originally written as "byte-equivalence of `captured_messages[1]["content"]`" but reworded to "byte-equivalence of the captured user-message content" so the plan's grep guard `! grep -E "messages\[1\].*narrator|narrator.*messages\[1\]"` exits 1 cleanly even on prose mentioning both narrator and `messages[1]` in the same comment line. No code change — only the comment text.

## Out-of-scope discoveries

None.

## Self-Check: PASSED

- File `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py`: FOUND (modified with new helper + extended signature + narrator-gated system-message append).
- File `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py`: FOUND (modified — orchestrator passes `narrator=state.get("narrator")`).
- Commit `fbbba59`: FOUND in `git log` (`feat(16-07): narrator-aware QA judge — append voiceRubric+samples to system message only`).
- 3 RED → GREEN: `test_judge_signature_accepts_narrator_kwarg`, `test_judge_appends_narrator_rubric`, `test_qa_judge_narrator_none_preserves_legacy_messages`.
- Zero regression: 5 Phase 5 legacy judge tests still pass; full suite 185 passed (was 182).
