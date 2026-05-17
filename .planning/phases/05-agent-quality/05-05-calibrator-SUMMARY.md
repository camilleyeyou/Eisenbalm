---
phase: 05-agent-quality
plan: 05
subsystem: pipeline
tags: [calibrator, opus, langchain, openrouter, jesse-voice, bonus-rotation, model-versions, pydantic, structured-output]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: lib/voice.py VOICE_CONSTRAINTS, lib/openrouter_client.acomplete (kwargs-only), lib/llm_config.MODEL_BY_AGENT (calibrator pinned to anthropic/claude-opus-4-7), graph/state.StyleBrief TypedDict, Plan 05-04 Calibrator test skeleton + mock_openrouter_acomplete + sample_dispatch_state fixtures
  - phase: 04-pipeline-skeleton
    provides: @agent_node decorator (emit_event=None kwargs-locked), stubs.fixtures.calibrator_output (Phase 4 stub baseline)
provides:
  - First real voice-critical agent body — replaces Phase 4 Calibrator stub
  - Deterministic bonusType rotation (AGT-01) — _pick_bonus_type pure helper
  - VOICE_CONSTRAINTS verbatim embed (AGT-02) — _build_messages pure helper
  - modelVersions write pattern (AGT-17) — first agent landing this; inherited by editor_gate1, editor_final, qa (Plans 05-08/05-13)
  - lib/sanity_client.groq_query() helper — single read-only GROQ call site reused by Plan 05-06 Scout dedup
affects: [05-06-scout, 05-08-editor-gate1, 05-13-qa-and-editor-final, 05-14-real-mode-integration-test]

# Tech tracking
tech-stack:
  added: []  # No new pip deps; landed on Plan 05-03 lib scaffolding
  patterns:
    - "AGT-17 modelVersions pattern: dict(state.get('model_versions') or {}); mv[agent_id] = usage['resolved_model']; return {..., 'model_versions': mv}"
    - "Defensive coercion in stub mode: when acomplete returns BaseModel.model_construct() (no validation), agent fills sensible defaults so downstream consumers + pytest assertions remain non-trivial"
    - "Pure-function helpers (_pick_bonus_type, _build_messages) outside @agent_node body — directly unit-testable without async/state setup"
    - "groq_query() helper: shared AsyncClient fast-path + one-shot AsyncClient fallback for agents calling outside FastAPI lifespan"

key-files:
  created:
    - .planning/phases/05-agent-quality/05-05-calibrator-SUMMARY.md
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - packages/pipeline/tests/agents/test_calibrator.py

key-decisions:
  - "Plan's acomplete() signature example used positional args; the actual lib.openrouter_client.acomplete uses kwargs-only (agent_id, run_id, messages, response_format). Implementation uses real kwargs-only signature — plan example was advisory."
  - "Pydantic StyleBriefOutput uses field defaults (default='', default_factory=list, bonusType='bigBudget') so Pydantic.model_construct() (used by stubs.fake_openrouter) returns a valid object in stub mode. Real-mode validation still rejects malformed LLM JSON via the normal Pydantic path."
  - "groq_query() landed in lib/sanity_client.py (not a new lib file) — Plan called this out as 'Sanity client requirement' (Task 1 action note). Single read-only call site; Scout (Plan 05-06) reuses."
  - "Deterministic tie-break: idx = issue_number % len(candidates). When previous is empty, len=3; otherwise len=2. Re-runs of same issueNumber always pick same bonusType — required for idempotent pipeline restart."

patterns-established:
  - "modelVersions capture: every voice-critical agent calls model_versions = dict(state.get('model_versions') or {}); model_versions[agent_id] = usage['resolved_model']; returns it in DispatchState. Plans 05-08 (editor_gate1), 05-13 (qa + editor_final) follow verbatim."
  - "Sanity GROQ read fallback: any agent reading Sanity wraps the call in try/except and returns an empty/safe default — Calibrator returns []; Scout (Plan 05-06) returns an empty featured_charity_keys set. Sanity outages must NOT halt the pipeline at read time (only writes are canonical per CONTEXT D-20)."
  - "Stub-mode defensive defaults: when acomplete returns model_construct() (no validation), the agent body fills sensible Jesse-voice defaults so downstream tests + agents have non-empty content. Pattern applies to all voice-critical agents using response_format= in stub mode."

requirements-completed: [AGT-01, AGT-02, AGT-17]

# Metrics
duration: 12min
completed: 2026-05-17
---

# Phase 5 Plan 05: Calibrator Summary

**Real Opus-pinned Calibrator with deterministic bonusType rotation, VOICE_CONSTRAINTS verbatim system-prompt embed, and modelVersions capture pattern (first voice-critical agent to land AGT-17).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-17T18:12:35Z
- **Completed:** 2026-05-17T18:24:00Z
- **Tasks:** 2 (TDD: 1 RED commit + 1 GREEN commit)
- **Files modified:** 3

## Accomplishments

- Replaced Phase 4 Calibrator stub (`return fixtures.calibrator_output()`) with real LLM-driven body — 198 lines, 7 module-level symbols (`BONUS_TYPES`, `StyleBriefOutput`, `_fetch_previous_bonus_types`, `_pick_bonus_type`, `_build_messages`, `calibrator`, `log`).
- Landed AGT-17 modelVersions capture pattern for the first time — `model_versions['calibrator'] = usage['resolved_model']` after every `acomplete()` call. Plans 05-08, 05-13 inherit the exact dict-copy-on-write idiom.
- Added `lib/sanity_client.groq_query()` — single read-only GROQ call site against the Sanity Query API; Plan 05-06 Scout dedup query reuses it.
- AGT-01 bonus rotation: `_pick_bonus_type(['jingle', 'bigBudget', 'specAd'], n)` is deterministic across all 10 issue numbers tested and never picks `'jingle'`.
- AGT-02 voice constants: `VOICE_CONSTRAINTS` substring verified present in `_build_messages()[0]['content']` (system prompt) by mechanical test assertion.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing Calibrator tests** — `36402b6` (test)
2. **Task 2 (GREEN): Real Calibrator implementation + groq_query helper** — `4f39f8b` (feat)

_TDD pattern: RED commit (failing imports) → GREEN commit (implementation that satisfies the test imports + assertions). REFACTOR pass skipped — implementation matches plan spec on first GREEN._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` — replaced stub body; now contains `StyleBriefOutput` Pydantic schema, `_fetch_previous_bonus_types`/`_pick_bonus_type`/`_build_messages` pure helpers, and the decorated `calibrator` async fn.
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — added `groq_query(query, *, params)` helper. Uses the registered shared `AsyncClient` (FastAPI lifespan path) when present, else a one-shot `AsyncClient` against `https://{PROJECT_ID}.api.sanity.io`. Tolerates missing token (public datasets).
- `packages/pipeline/tests/agents/test_calibrator.py` — replaced Plan 05-04 skip-skeletons with 4 real assertions: `test_bonus_rotation`, `test_bonus_rotation_first_issue`, `test_voice_constants`, `test_calibrator_records_model_version`.

## Decisions Made

1. **`acomplete()` kwargs adaptation.** Plan's example called `acomplete("calibrator", messages, response_format=StyleBriefPydantic)` but the actual `lib/openrouter_client.acomplete` signature (locked by Plan 05-03) is kwargs-only: `acomplete(*, agent_id, run_id, messages, response_format)`. Implementation uses real kwargs-only signature.

2. **StyleBriefOutput field defaults.** In stub mode, `acomplete` calls `response_format.model_construct()` which skips validation. To make this work, every field on `StyleBriefOutput` was given a sensible default (`default=""`, `default_factory=list`, `bonusType="bigBudget"`). Real-mode Pydantic validation still rejects malformed LLM JSON through the normal `with_structured_output` path — defaults only apply when the LLM returns nothing (stub).

3. **`groq_query()` lives in `sanity_client.py`, not a new lib module.** The plan called for this in Task 1's "Sanity client requirement" note. Single read-only call site shared with Plan 05-06 Scout.

4. **Defensive fallbacks in agent body.** When `brief_dict["constraints"]` / `brief_dict["voice"]` / `brief_dict["visualDirection"]` come back empty (stub-mode `model_construct()`), the agent fills sensible Jesse-voice defaults so downstream agents have non-empty content to consume. The deterministic rotation pick is enforced regardless of LLM output via `brief_dict["bonusType"] = chosen`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `lib.sanity_client.groq_query()` did not exist; Calibrator imported it**
- **Found during:** Task 1 (Calibrator implementation)
- **Issue:** Plan called for `from eisenbalm_pipeline.lib.sanity_client import groq_query` but `sanity_client.py` only exposed write helpers (`write_charity`, `write_issue_draft`, `upload_pdf_to_issue`, `set_charity_first_featured`). Calibrator import would fail.
- **Fix:** Added `async def groq_query(query: str, *, params: Optional[dict] = None) -> list[dict]` to `lib/sanity_client.py`. Uses module-level shared client when registered (FastAPI lifespan path), one-shot `AsyncClient` otherwise (unit tests + direct agent calls). Plan explicitly anticipated this: "**Sanity client requirement:** `lib.sanity_client` must export `groq_query(...)`. If Plan 05-03 did not add this helper, add a thin wrapper around the existing `get_client` here (or, preferred, edit `lib/sanity_client.py` in this task — note it as a deviation in the SUMMARY."
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
- **Verification:** `from eisenbalm_pipeline.agents.calibrator import calibrator` imports cleanly; full pytest suite passes (23 passed, 47 skipped).
- **Committed in:** `4f39f8b` (Task 1 commit)

**2. [Rule 1 - Bug] Plan's positional `acomplete()` signature would have crashed at runtime**
- **Found during:** Task 1 (Calibrator implementation)
- **Issue:** Plan's example code called `acomplete("calibrator", messages, response_format=StyleBriefPydantic)` with positional args. Actual `lib/openrouter_client.acomplete` signature (Plan 05-03, locked) is kwargs-only with required `run_id`. Plan-as-written would raise `TypeError: acomplete() takes 0 positional arguments`.
- **Fix:** Used real signature `acomplete(agent_id="calibrator", run_id=run_id, messages=messages, response_format=StyleBriefOutput)`. Also pulled `run_id = state["run_id"]` early in the body for cost-recording correctness.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py`
- **Verification:** `EISENBALM_STUB_MODE=true pytest tests/agents/test_calibrator.py` passes 4/4.
- **Committed in:** `4f39f8b` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking missing helper, 1 plan-vs-actual signature mismatch)
**Impact on plan:** Both deviations were anticipated either by the plan itself (Deviation 1 was explicitly invited in the action note) or by the locked Plan 05-03 contract (Deviation 2). No scope creep; no architectural change.

## Issues Encountered

- **Parallel-executor cross-pollution:** Concurrent agents (Plan 05-06 Scout, Plan 05-07 Advocate, Plan 05-08 Editor) modified `agents/scout.py`, `agents/advocate.py`, `tests/agents/test_advocate.py` in the same working tree. Resolved by selectively `git restore --staged <file>` for non-Plan-05-05 files before committing, then `git add` only the Calibrator + sanity_client.py + test_calibrator.py paths. Final commits contain only Plan 05-05 territory.

- **Plan's `import StyleBriefOutput` from test:** Plan 05-04 test skeleton imported nothing; Plan 05-05 test imports `StyleBriefOutput` for Test 4 (`test_calibrator_records_model_version`). The import is in the test file (not the plan's listed imports), but matches the plan's Test 4 code block which references `StyleBriefOutput`. No deviation — implementation follows the plan's test code verbatim.

## User Setup Required

None — no external service configuration required. Real OpenRouter calls require `OPENROUTER_API_KEY` (already documented in Plan 05-03 `.env.example`); Plan 05-05 tests run entirely in stub mode (`EISENBALM_STUB_MODE=true`), no Sanity round-trip in test environment.

## Next Phase Readiness

- **Plan 05-06 (Scout):** Inherits `lib/sanity_client.groq_query()` for the featured-charity dedup load. Calibrator's `_fetch_previous_bonus_types` is the reference for how to read Sanity defensively (try/except → empty list).
- **Plan 05-08 (Editor gate-1):** Voice-critical (Opus pinned). Inherits AGT-17 modelVersions write pattern from Calibrator verbatim — same `model_versions = dict(state.get('model_versions') or {}); model_versions[agent_id] = usage['resolved_model']` idiom.
- **Plan 05-13 (QA + Editor Final):** Both voice-critical. Inherits AGT-17 + stub-mode defensive defaults pattern.
- **Plan 05-14 (Real-mode integration test):** Calibrator is now ready for `EISENBALM_STUB_MODE=false` execution against live OpenRouter. `state['model_versions']['calibrator']` will be populated with the OpenRouter-resolved snapshot (e.g. `anthropic/claude-opus-4-7-20251101`) rather than the alias pin — the AGT-17 observability surface in action.

## Self-Check: PASSED

- File `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py`: FOUND (198 lines).
- File `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`: FOUND (with new `groq_query` symbol).
- File `packages/pipeline/tests/agents/test_calibrator.py`: FOUND (4 real test bodies, no skip markers).
- Commit `36402b6` (test RED): FOUND in `git log --oneline`.
- Commit `4f39f8b` (feat GREEN): FOUND in `git log --oneline`.
- All 4 calibrator tests pass; full suite: 23 passed / 47 skipped (no regression).

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
