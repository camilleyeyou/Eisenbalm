---
phase: 13-deliberation-as-conversation
plan: "02"
subsystem: pipeline
tags: [langgraph, chronicler, llm, sanity, deliberation, conversation, graph-wiring]

dependency_graph:
  requires:
    - phase: 13-01
      provides: "deliberation_conversation DispatchState field, Wave 0 test scaffolds, API_CONTRACTS §2.2/§7/§1.2 amendments"
  provides:
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py: "Chronicler @agent_node — single acomplete call, ChroniclerOutput Pydantic, D-18 fallback, AGT-17 model_versions"
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py: "chronicler entry in MODEL_BY_AGENT (Opus voice-critical) + SAMPLING_BY_AGENT (temperature 0.4)"
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py: "editor_gate_1 -> chronicler -> researcher edge rewiring"
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py: "selectionDeliberation.conversation[] write with _key=turn-NNN, _type=object, speaker, text"
  affects:
    - Plan 13-03 (frontend consumer): reads conversation[] from Sanity GROQ §1.2 to build chat render

tech-stack:
  added: []
  patterns:
    - "Single LLM call chronicler node pattern: @agent_node(emit_event=None) + try/except inside body (D-18 Pitfall 6)"
    - "ChroniclerOutput Pydantic with field defaults for stub-mode model_construct() safety (mirrors StyleBriefOutput)"
    - "Conversation array write to Sanity: _type='object', _key=f'turn-{i:03d}' (Pitfall 2 _key requirement)"
    - "D-18 fallback: on exception return {deliberation_conversation: None} only — transcript survives untouched"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py

key-decisions:
  - "chronicler uses emit_event=None — turns are Sanity content, not deliberationEvents (D-06/D-08 confirmed; Convex eventType union not touched)"
  - "try/except INSIDE the chronicler function body, not outside — @agent_node wrapper never sees the exception so it never marks the run failed (Pitfall 6)"
  - "fallback returns {deliberation_conversation: None} only — deliberation_transcript stays as editor_gate_1 set it (D-18)"
  - "conversation: [...] or None pattern — empty list on fallback path writes None not [] (graceful for frontend null-guard)"
  - "chronicler is voice-critical Opus tier (MODEL_PIN_VOICE_CRITICAL) at temperature 0.4 — creative staging but faithful to real scores/names"

requirements-completed: [DEL-CONV-01, DEL-CONV-02, DEL-CONV-05, DEL-CONV-06]

duration: 12min
completed: 2026-05-24
---

# Phase 13 Plan 02: Chronicler Pipeline Summary

**Chronicler LangGraph node dramatizes real deliberation data as Jesse-voice dialogue in one Opus LLM call, persists structured turns to Sanity with turn-NNN _keys, with deterministic transcript preserved as fallback**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-24T16:20:00Z
- **Completed:** 2026-05-24T16:33:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `agents/chronicler.py` created: single `acomplete` call with `ChroniclerOutput` Pydantic, `VOICE_CONSTRAINTS` verbatim (D-16), D-18 fallback inside function body (transcript preserved on failure), AGT-17 `model_versions['chronicler']` recorded; no model-name literals in source
- `graph/builder.py` rewired: `editor_gate_1 -> researcher` replaced with `editor_gate_1 -> chronicler -> researcher` (import + node registration + 2 edges)
- `sanity_client.write_issue_draft` extended: `selectionDeliberation.conversation[]` written with `_type='object'`, `_key=f'turn-{i:03d}'`, `speaker`, `text`; `or None` guard for fallback path
- All 10 Wave 0 tests green: 4 chronicler + 4 builder wiring + 2 sanity write

## Task Commits

1. **Task 1: Add chronicler to llm_config + create agents/chronicler.py** - `7fbb22a` (feat) — _pre-committed_
2. **Task 2: Rewire builder + write conversation[] in sanity_client** - `a798c03` (feat)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` — Chronicler @agent_node: `_build_system_prompt` (VOICE_CONSTRAINTS + persona rules), `_build_user_prompt` (candidate data rendering), single `acomplete` call, D-18 fallback, AGT-17 model_versions write
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — `"chronicler"` added to `MODEL_BY_AGENT` (Opus voice-critical) and `SAMPLING_BY_AGENT` (temperature 0.4)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — chronicler import + `add_node` + two edges replacing old direct edge
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — `conversation[]` comprehension added to `selectionDeliberation` dict with `_key=turn-NNN` and `or None` guard

## Decisions Made

- `emit_event=None` on the chronicler: turns are Sanity content, not Convex deliberationEvents (D-06/D-08 confirmed; `deliberationEvents.eventType` union untouched per critical constraint)
- `try/except` placed inside the node body, not outside: ensures `@agent_node` wrapper never sees the exception and never sets `pipelineRuns.status='failed'` on a chronicler hiccup (Pitfall 6)
- `[...] or None` pattern for the conversation array: an empty list from the fallback path writes `conversation: None` to Sanity rather than `[]`, which is cleaner for the frontend null-guard in Plan 13-03

## Deviations from Plan

None — plan executed exactly as written. `llm_config.py` and `builder.py` already had the chronicler entries from a prior partial session; `sanity_client.py` was the only net-new work in Task 2.

## Issues Encountered

- `test_sanity_write.py` skip guard (`_conversation_written()` probe) requires `SANITY_API_TOKEN` to be set at collection time even though the test uses `httpx.MockTransport`. Tests run green when `SANITY_API_TOKEN=test-token` is provided; they skip gracefully otherwise (pre-existing pattern from conftest.py `REQUIRED_ENV_VARS` guard). Not a defect — the probe runs `asyncio.run()` against a mock transport but `write_issue_draft` calls `_auth_headers()` which reads `os.environ['SANITY_API_TOKEN']`.

## Next Phase Readiness

- Chronicler node fully wired and tested; pipeline produces structured conversation turns and persists them to Sanity
- Plan 13-03 (frontend consumer) can now read `conversation[]` from the `selectionDeliberation` GROQ projection and render the chat-thread layout
- No blockers for Plan 13-03

---

## Self-Check: PASSED

Files created/modified:
- `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` — FOUND
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — FOUND (chronicler in both dicts)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — FOUND (chronicler import + node + 2 edges)
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — FOUND (conversation[] at line 232)

Commits:
- `7fbb22a` — feat(13-02): add chronicler agent — FOUND
- `a798c03` — feat(13-02): rewire graph + persist conversation[] to Sanity — FOUND

*Phase: 13-deliberation-as-conversation*
*Completed: 2026-05-24*
