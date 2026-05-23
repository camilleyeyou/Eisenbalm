---
phase: 13-deliberation-as-conversation
plan: "01"
subsystem: contract
tags: [deliberation, contract, test-scaffold, wave-0, pipeline, sanity-schema, dispatch-state]
dependency_graph:
  requires: []
  provides:
    - docs/API_CONTRACTS.md: "deliberation_conversation §7/§1.2/§2.2"
    - apps/studio/schemas/weeklyIssue.ts: "selectionDeliberation.conversation[]"
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py: "deliberation_conversation field"
    - packages/pipeline/tests/test_chronicler.py: "Wave 0 Chronicler test scaffold"
    - packages/pipeline/tests/test_builder_wiring.py: "Wave 0 builder wiring test scaffold"
    - packages/pipeline/tests/test_sanity_write.py: "Wave 0 Sanity write test scaffold"
    - apps/web/__tests__/deliberation-conversation.test.ts: "Wave 0 render contract test scaffold"
  affects:
    - Plan 13-02 (pipeline producer): reads §7/§2.2 + state.py to implement Chronicler
    - Plan 13-03 (frontend consumer): reads §1.2 + conversation[] schema to build chat render
tech_stack:
  added: []
  patterns:
    - Additive API_CONTRACTS.md amendments with explanatory comment (Plan 06-06 convention)
    - Sanity schema array-of-objects with defineField + preview prepare
    - DispatchState TypedDict additive field (no Annotated — single sequential writer)
    - Wave 0 skip-guard pattern (pytest.mark.skipif + CHRONICLER_AVAILABLE flag; pytestmark module-level; _conversation_written() probe)
    - describe.skip for Plan 13-03 render assertions with non-skipped DEL-04 re-assertion
key_files:
  created:
    - packages/pipeline/tests/test_chronicler.py
    - packages/pipeline/tests/test_builder_wiring.py
    - packages/pipeline/tests/test_sanity_write.py
    - apps/web/__tests__/deliberation-conversation.test.ts
  modified:
    - docs/API_CONTRACTS.md
    - apps/studio/schemas/weeklyIssue.ts
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
decisions:
  - "selectionDeliberation.conversation[] (not podcast.conversation) — matches D-07 leaning + keeps turns co-located with candidates/editorDecision in Sanity Studio"
  - "Plain string text field (not Portable Text) for turn text — render layer adds formatting; no Markdown stored (D-07)"
  - "No Annotated wrapper on deliberation_conversation — single sequential chronicler node, same pattern as all other Phase 1 fields"
  - "TypeGen note: pnpm --filter @eisenbalm/studio typegen deferred to Andrew — apps/web types are hand-written per Phase 2 projection pattern; not load-bearing"
  - "test_vercel_client.py failure is pre-existing (missing respx dep) and out-of-scope for this plan"
metrics:
  duration: "10 min"
  completed_date: "2026-05-23"
  tasks: 3
  files: 7
---

# Phase 13 Plan 01: Contract and Test Scaffold Summary

Contract-first gate for Phase 13 (deliberation-as-conversation). Three additive
amendments to `docs/API_CONTRACTS.md`, two schema additions, and four Wave 0 test
files that Plans 02 and 03 turn green.

## What was built

**Task 1 — API_CONTRACTS.md amendments (3 additive insertions)**

- `§7 DispatchState`: `deliberation_conversation: Optional[list[dict]]` inserted after `deliberation_transcript`, with a comment citing DEL-CONV + the plain-prose-no-Markdown constraint.
- `§1.2 GROQ read`: `conversation[] { speaker, text }` added inside the `selectionDeliberation { ... }` projection, after `runnerUpNotes,`.
- `§2.2 Sanity write`: `conversation` array comprehension added to the `selectionDeliberation` dict with `_type: 'object'`, `_key: f'turn-{i:03d}'`, `speaker`, and `text`; guarded by `state.get('deliberation_conversation') or []`.

The Convex `deliberationEvents.eventType` union was NOT touched. D-06/D-08 confirmed: turns are Sanity content, not Convex events.

**Task 2 — Schema additions (additive, no renames)**

- `apps/studio/schemas/weeklyIssue.ts`: `conversation[]` array of `{speaker, text}` objects added inside `selectionDeliberation.fields`, after `runnerUpNotes`. Each object has validation on both fields, and a `preview.prepare` that uppercases the speaker and truncates the text to 80 chars for Studio display.
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`: `deliberation_conversation: Optional[list[dict]]` added on the line immediately after `deliberation_transcript`, with a VERBATIM comment citing `docs/API_CONTRACTS.md §7`. No `Annotated` wrapper (single sequential node).

No existing field was renamed. `grep -n "name: 'candidates'"`, `name: 'editorDecision'`, `name: 'runnerUpNotes'` all still return their original lines.

**Task 3 — Four Wave 0 test files**

- `test_chronicler.py`: 4 skip-guarded `@pytest.mark.asyncio` tests covering well-formed turns, faithful prompt construction (charity name + advocate score in user message), fallback behavior (LLM failure → `deliberation_conversation=None`, transcript not overwritten), and `model_versions['chronicler']` AGT-17 record. Skip guard: `CHRONICLER_AVAILABLE` flag from try/except import.
- `test_builder_wiring.py`: 4 skip-guarded source-scan tests (pytestmark module-level) asserting the three chronicler edges and the removal of the old direct `editor_gate_1 → researcher` edge. Skip guard: `_chronicler_wired()` check whether the edge already exists in builder.py.
- `test_sanity_write.py`: 2 skip-guarded `@pytest.mark.asyncio` tests asserting the conversation array shape in the Sanity payload (`_key ^turn-\d{3}$`, `_type == 'object'`, speaker/text). Skip guard: `_conversation_written()` probe that runs a minimal write and checks the payload.
- `deliberation-conversation.test.ts`: 6 vitest tests — 2 DEL-04 re-assertions (always run: no modelVersions, no model-name literals), 4 render contract assertions under `describe.skip('Plan 13-03 ...')` (chat class `del-conversation`, `role="log"`, `conversation` prop, no `dangerouslySetInnerHTML`).

## Test results at Wave 1 commit

- Pipeline: 10 new tests — 1 passed (test_transcript_format), 10 skipped (new skip-guarded tests). Pre-existing suite failures (78 failed, pre-existing) are unrelated to this plan.
- Web: deliberation-conversation.test.ts — 5 passed / 4 skipped. deliberation-no-model-names.test.ts — 3 passed. Pre-existing web failures (29 failed) are out-of-scope.
- `pnpm --filter web build` — passes.

## Deviations from Plan

None — plan executed exactly as written.

## TypeGen note

`pnpm --filter @eisenbalm/studio typegen` should be run by Andrew when convenient to regenerate `sanity.types.ts` with the new `conversation` array field. It is not load-bearing for Phase 13 because `apps/web` types (`lib/sanity/types.ts`) are hand-written against GROQ projections — the Phase 2 established pattern. Plan 13-03 will add the hand-written `IssueDeliberationTurn` type.

## Deferred items

- `tests/lib/test_vercel_client.py` fails to collect due to missing `respx` dependency. Pre-existing before this plan. Logged for future resolution.

## Self-Check: PASSED

Files created/modified:
- `docs/API_CONTRACTS.md` — FOUND (grep confirms 3 insertions)
- `apps/studio/schemas/weeklyIssue.ts` — FOUND (name: 'conversation' at line 384)
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — FOUND (deliberation_conversation at line 137)
- `packages/pipeline/tests/test_chronicler.py` — FOUND
- `packages/pipeline/tests/test_builder_wiring.py` — FOUND
- `packages/pipeline/tests/test_sanity_write.py` — FOUND
- `apps/web/__tests__/deliberation-conversation.test.ts` — FOUND

Commits:
- `7cc3fcb` — feat(13-01): amend API_CONTRACTS.md
- `86e1966` — feat(13-01): additive schema fields
- `8d11ab9` — test(13-01): Wave 0 test scaffold
