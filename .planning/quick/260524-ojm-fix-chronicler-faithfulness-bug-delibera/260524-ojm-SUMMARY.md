---
phase: quick-260524-ojm
plan: 01
subsystem: pipeline/chronicler
tags: [chronicler, prompt-fix, faithfulness, deliberation-conversation, tdd]
dependency_graph:
  requires: [Phase 13 P02 (chronicler agent), Phase 13 P03 (chat render)]
  provides: [CHRON-WINNER-AUTHORITATIVE]
  affects: [deliberation_conversation, deliberation_transcript]
tech_stack:
  added: []
  patterns: [WINNER-authority system-prompt rule, labeled-field user-prompt pattern]
key_files:
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py
    - packages/pipeline/tests/test_chronicler.py
decisions:
  - "Prompt-level fix only — no shape, schema, or DispatchState changes required"
  - "TDD: failing test written first (RED), then chronicler.py updated (GREEN)"
  - "WINNER AUTHORITY inserted as system-prompt rule 7; JSON-schema rule renumbered to 8"
  - "User-prompt uses labeled inline annotations: '(authoritative — the selected charity, the final call)' and '(supporting rationale only — may discuss runners-up)'"
  - "Final-turn instruction placed immediately after RUNNER-UP NOTES line in user prompt"
metrics:
  duration: "~2 min"
  completed: "2026-05-25T00:46:07Z"
  tasks: 2
  files: 2
---

# Quick Task 260524-ojm: Fix Chronicler Faithfulness Bug Summary

**One-liner:** Prompt-level WINNER AUTHORITY fix in chronicler.py — system rule 7 + user-prompt inline annotations ensure the editor's final turn always names the actual featured charity even when editor_decision text favors a different candidate.

## What Was Done

Surfaced by issue 999001: when two candidates tie and `editor_gate_1` produces an `editor_decision` text that explicitly names a different charity as the pick, the Chronicler's LLM followed the narrative in `editor_decision` rather than the authoritative `WINNER` field.

Root cause confirmed: `_build_user_prompt` passed both `WINNER: {name}` (authoritative) and `EDITOR DECISION: {text favoring runner-up}` with no relative weighting between them. The LLM's default behavior was to follow the longer narrative.

Fix applied at the prompt-construction level only. No shape, schema, API_CONTRACTS.md, DispatchState, or voice.py changes.

## Changes

### `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py`

**`_build_system_prompt()`** — inserted new rule 7 "WINNER AUTHORITY (non-negotiable)" between the Jesse-voice rule and the JSON-schema rule; JSON-schema rule renumbered from 7 to 8. Rule text:

> The Editor's final turn must conclude that the WINNER named in the data is the selected charity — the pick. The WINNER is the authoritative final decision. The EDITOR DECISION text is supporting rationale only: the Editor may discuss and weigh runners-up, but if the EDITOR DECISION text names a different charity as chosen, treat that as the Editor's earlier reasoning and still conclude the conversation with the WINNER as the final call.

**`_build_user_prompt()`** — replaced three bare lines (`WINNER:`, `EDITOR DECISION:`, `RUNNER-UP NOTES:`) with:
- WINNER line labeled `(authoritative — the selected charity, the final call)`
- EDITOR DECISION line labeled `(supporting rationale only — may discuss runners-up)`
- RUNNER-UP NOTES unchanged
- New fourth line: explicit final-turn instruction naming `{winning_charity_name} is the selected charity`

### `packages/pipeline/tests/test_chronicler.py`

Added `test_winner_authoritative_when_editor_decision_diverges` — constructs a divergence scenario where `winning_charity.name = "Grassroots Poverty Action Network"` but `editor_decision` explicitly favors `"Community Justice and Accountability Initiative"`. Captures `acomplete` kwargs and asserts at the prompt-construction level:

- `"authoritative"` in all prompt content
- `f"{winner} is the selected charity"` in all prompt content
- `"supporting rationale only"` in all prompt content
- Both charity names present (faithful data)
- `"WINNER AUTHORITY"` in all prompt content (system rule present)

## Verification

All hard constraints verified:

| Constraint | Status |
|------------|--------|
| Exactly 1 `await acomplete(` in chronicler.py | PASS — `grep -c` returns 1 |
| `VOICE_CONSTRAINTS` verbatim (f-string interpolation) | PASS — `grep -q 'f"{VOICE_CONSTRAINTS}'` |
| D-18 fallback `return {"deliberation_conversation": None}` unchanged | PASS |
| `{speaker, text}` turn shape unchanged | PASS — no key renames |
| DEL-04 preserved (no AI/LLM references) | PASS — no new such text added |
| No new deps | PASS |
| API_CONTRACTS.md / DispatchState unchanged | PASS — prompt text only |

Test results:
- `python -m pytest tests/test_chronicler.py -q` → **5 passed** (4 existing + 1 new)
- `python -m pytest tests/agents/test_editor.py::test_transcript_format -x` → **1 passed**

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| `3951204` | fix(quick-260524-ojm): make WINNER authoritative in Chronicler prompts |

## Self-Check: PASSED

- chronicler.py: FOUND
- test_chronicler.py: FOUND
- SUMMARY.md: FOUND
- commit 3951204: FOUND
