---
phase: 13-deliberation-as-conversation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - apps/studio/schemas/weeklyIssue.ts
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/tests/test_chronicler.py
  - packages/pipeline/tests/test_builder_wiring.py
  - packages/pipeline/tests/test_sanity_write.py
  - apps/web/__tests__/deliberation-conversation.test.ts
autonomous: true
requirements: [DEL-CONV-01, DEL-CONV-02, DEL-CONV-03, DEL-CONV-06]
must_haves:
  truths:
    - "docs/API_CONTRACTS.md declares the deliberation_conversation DispatchState field (§7), the conversation[] GROQ read (§1.2), and the conversation[] Sanity write (§2.2)"
    - "The weeklyIssue Sanity schema has an additive selectionDeliberation.conversation[] array of {speaker, text} objects with NO existing field renamed"
    - "DispatchState carries deliberation_conversation: Optional[list[dict]] with a comment citing API_CONTRACTS §7"
    - "The four Wave 0 test files collect cleanly — `cd packages/pipeline && python -m pytest tests/test_chronicler.py tests/test_builder_wiring.py tests/test_sanity_write.py --collect-only` exits 0, and the full pipeline pytest + web vitest suites are green at the Wave 1 commit"
    - "The existing test_transcript_format and deliberation-no-model-names tripwire are NOT deleted"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "Contract amendments for deliberation_conversation field + conversation[] read/write"
      contains: "deliberation_conversation"
    - path: "apps/studio/schemas/weeklyIssue.ts"
      provides: "Additive selectionDeliberation.conversation[] schema field"
      contains: "name: 'conversation'"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "deliberation_conversation field on DispatchState"
      contains: "deliberation_conversation"
    - path: "packages/pipeline/tests/test_chronicler.py"
      provides: "Chronicler unit tests (faithful turns, well-formed list, fallback, model_versions)"
      contains: "def test_"
    - path: "packages/pipeline/tests/test_builder_wiring.py"
      provides: "Source-scan asserting editor_gate_1->chronicler->researcher wiring"
      contains: "chronicler"
    - path: "packages/pipeline/tests/test_sanity_write.py"
      provides: "Mock-Sanity write test asserting conversation array with _key fields"
      contains: "conversation"
    - path: "apps/web/__tests__/deliberation-conversation.test.ts"
      provides: "Render-layer source scan for chat thread (no markdown chars, no model names)"
      contains: "del-conversation"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      to: "docs/API_CONTRACTS.md §7"
      via: "VERBATIM comment + matching field declaration"
      pattern: "deliberation_conversation"
    - from: "apps/studio/schemas/weeklyIssue.ts conversation[]"
      to: "docs/API_CONTRACTS.md §1.2 / §2.2"
      via: "speaker + text object shape"
      pattern: "conversation"
---

<objective>
Settle the shared data contract for Phase 13 and lay down the Wave 0 test scaffold BEFORE any producer or consumer code is written. This is the contract-first gate: per CLAUDE.md, no schema/eventType/payload change may happen without reconciling docs/API_CONTRACTS.md first, and RESEARCH.md Pitfall 4 requires the contract to be declared before graph/state.py is touched.

This plan:
1. Amends docs/API_CONTRACTS.md (§7 DispatchState, §1.2 GROQ read, §2.2 Sanity write) to declare the new `deliberation_conversation` state field and the additive `selectionDeliberation.conversation[]` Sanity field.
2. Adds the additive `selectionDeliberation.conversation[]` array field to the Sanity weeklyIssue schema (no field renames — D-08).
3. Adds the `deliberation_conversation: Optional[list[dict]]` field to DispatchState (D-03).
4. Creates the four Wave 0 test files (3 pytest + 1 vitest) that the Wave 2 producer/consumer plans turn green.

Purpose: a single source of truth for the structured-turn shape so Plan 02 (pipeline producer) and Plan 03 (frontend consumer) can be built in parallel against an agreed contract.
Output: amended contract doc, additive schema field, new state field, four failing/skip-marked test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md
@.planning/phases/13-deliberation-as-conversation/13-RESEARCH.md
@.planning/phases/13-deliberation-as-conversation/13-VALIDATION.md

<interfaces>
<!-- The agreed structured-turn shape this plan declares. Plans 02 + 03 consume it directly. -->

DispatchState field (Python — graph/state.py, after deliberation_transcript line 136):
```python
deliberation_conversation: Optional[list[dict]]  # Chronicler turns: [{"speaker": "scout|advocate|editor", "text": "plain prose"}]
```

Sanity weeklyIssue.selectionDeliberation.conversation[] (each item):
```
{ _type: 'object', _key: 'turn-NNN', speaker: string, text: string }
```
speaker ∈ {"scout", "advocate", "editor"}; text = plain string, NO Markdown.

GROQ projection addition (QUERY_ISSUE_BY_SLUG selectionDeliberation block):
```groq
conversation[] { speaker, text }
```

TypeScript type (declared by Plan 03, shown here for contract alignment):
```typescript
export type IssueDeliberationTurn = { speaker: string; text: string }
// IssueDeliberation gains: conversation: IssueDeliberationTurn[] | null
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md (§7 DispatchState, §1.2 GROQ read, §2.2 Sanity write)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (lines 47-124 §1.2 GROQ read; lines 297-404 §2.2 Sanity write; lines 1311-1348 §7 DispatchState — read the exact current text)
    - .planning/phases/13-deliberation-as-conversation/13-CONTEXT.md (D-03, D-06, D-07, D-08, D-17 — the locked decisions on storage shape)
    - .planning/STATE.md (Phase 06 decision: API_CONTRACTS amendments use a strikethrough/blockquote-callout convention — see Plan 06-06 entry; additive fields do NOT need strikethrough, just an additive insertion with a clear comment)
    - CLAUDE.md (hard rule: schema field names locked; check API_CONTRACTS.md first)
  </read_first>
  <action>
    Make three ADDITIVE amendments to docs/API_CONTRACTS.md. These are additive (no existing field renamed or removed), so use plain additive insertions with an explanatory comment — NOT the strikethrough convention (that is reserved for corrections of wrong contracts, per Plan 06-06).

    1. §7 DispatchState (the `class DispatchState(TypedDict)` block, after the line `deliberation_transcript: Optional[str]      # full Scout+Advocate+Editor text` at ~line 1323). Insert exactly:
    ```python
    deliberation_conversation: Optional[list[dict]]   # Phase 13 (DEL-CONV): Chronicler dialogue turns — [{"speaker": "scout|advocate|editor", "text": "plain prose, no Markdown"}]; written by the chronicler node; flattened into deliberation_transcript for the podcast/NotebookLM export
    ```

    2. §1.2 GROQ read (`QUERY_ISSUE_BY_SLUG`, inside the `selectionDeliberation { ... }` block at ~lines 113-122, after `runnerUpNotes,`). Insert exactly:
    ```groq
    runnerUpNotes,
    conversation[] { speaker, text },   // Phase 13 (DEL-CONV): Chronicler dialogue turns for the chat-thread render
    ```
    (Add the `conversation[] { speaker, text },` line after the existing `runnerUpNotes,` line so the closing `}` of the selectionDeliberation block follows it.)

    3. §2.2 Sanity write (`write_issue_draft`, the `'selectionDeliberation': { ... }` dict at ~lines 362-378, after `'runnerUpNotes': state['runner_up_notes'],`). Insert exactly:
    ```python
    'runnerUpNotes': state['runner_up_notes'],
    'conversation': [   # Phase 13 (DEL-CONV): Chronicler turns; _key required for Sanity array items
        {'_type': 'object', '_key': f'turn-{i:03d}', 'speaker': t['speaker'], 'text': t['text']}
        for i, t in enumerate(state.get('deliberation_conversation') or [])
    ] or None,
    ```

    Do NOT touch §3.4 deliberationEvents:insert or §4.3 deliberationEvents.ts — turns do NOT go to Convex (D-06/D-08). Leave the closed eventType union unchanged. (This task confirms the no-Convex decision by leaving those sections untouched.)
  </action>
  <verify>
    <automated>grep -c "deliberation_conversation" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "deliberation_conversation: Optional\[list\[dict\]\]" docs/API_CONTRACTS.md` returns a line inside the §7 DispatchState block (line number > 1311)
    - `grep -n "conversation\[\] { speaker, text }" docs/API_CONTRACTS.md` returns a line inside the §1.2 QUERY_ISSUE_BY_SLUG selectionDeliberation block (line number between 113 and 124 region)
    - `grep -n "'conversation': \[" docs/API_CONTRACTS.md` returns a line inside the §2.2 write_issue_draft selectionDeliberation dict
    - `grep -n "turn-{i:03d}" docs/API_CONTRACTS.md` returns exactly one line
    - `grep -c "conversation-turn" docs/API_CONTRACTS.md` returns 0 (no new Convex eventType literal added — D-08)
    - The deliberationEvents.eventType union in §4.3 is unchanged: `grep -n "conversation" docs/API_CONTRACTS.md` shows NO match inside §3.4 or §4.3 (lines 598-905)
  </acceptance_criteria>
  <done>API_CONTRACTS.md declares the deliberation_conversation field in §7, the conversation[] read in §1.2, and the conversation[] write in §2.2, with no Convex eventType change.</done>
</task>

<task type="auto">
  <name>Task 2: Add additive selectionDeliberation.conversation[] field to the Sanity weeklyIssue schema + add deliberation_conversation to DispatchState</name>
  <files>apps/studio/schemas/weeklyIssue.ts, packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>
  <read_first>
    - apps/studio/schemas/weeklyIssue.ts (lines 343-383 — the selectionDeliberation defineField object; read the exact candidates/editorDecision/runnerUpNotes field shapes and the array-of-object preview pattern)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (lines 124-178 — DispatchState; the deliberation_transcript field at line 136 is the insertion anchor; note the file header comment about VERBATIM from API_CONTRACTS §7)
    - docs/API_CONTRACTS.md (the §7 + §2.2 edits committed in Task 1 — the field shape must match exactly)
    - .planning/phases/13-deliberation-as-conversation/13-RESEARCH.md (Pattern 3 + Pattern 4 — exact field definitions)
  </read_first>
  <action>
    Two additive edits. NO existing field renamed (D-08, CLAUDE.md hard rule).

    A) apps/studio/schemas/weeklyIssue.ts — inside the `selectionDeliberation` object's `fields: [ ... ]` array (the defineField at line ~344), AFTER the existing `runnerUpNotes` defineField (which ends ~line 381) and BEFORE the closing `]` of the fields array, add this defineField verbatim:
    ```typescript
    defineField({
      name: 'conversation',
      title: 'Deliberation Conversation',
      type: 'array',
      description: 'Chronicler-dramatized dialogue turns for the chat render. Auto-generated by the pipeline. Plain prose, no Markdown.',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'speaker',
              title: 'Speaker',
              type: 'string',
              description: 'Persona id: scout | advocate | editor',
              validation: Rule => Rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Text',
              type: 'text',
              rows: 3,
              description: 'Plain string, no Markdown.',
              validation: Rule => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'speaker', subtitle: 'text' },
            prepare: ({ title, subtitle }: { title: string; subtitle: string }) => ({
              title: title?.toUpperCase() ?? 'UNKNOWN',
              subtitle: subtitle?.slice(0, 80) ?? '',
            }),
          },
        },
      ],
    }),
    ```

    B) packages/pipeline/src/eisenbalm_pipeline/graph/state.py — in the `class DispatchState(TypedDict)` block, immediately AFTER the line:
    ```python
    deliberation_transcript: Optional[str]      # full Scout+Advocate+Editor text
    ```
    (line ~136) add:
    ```python
    deliberation_conversation: Optional[list[dict]]  # Phase 13 (DEL-CONV): Chronicler turns [{"speaker","text"}] — VERBATIM from docs/API_CONTRACTS.md §7
    ```
    Only one sequential node (chronicler) writes this field, so NO reducer / Annotated wrapper is needed (RESEARCH Pattern 3). Do not wrap it in Annotated.

    Do NOT regenerate sanity.types.ts in this task (TypeGen requires Studio tooling; Plan 03 consumes the field via hand-written types in apps/web/lib/sanity/types.ts per the established Phase 2 hand-written-projection pattern). Note in the SUMMARY that `pnpm --filter @eisenbalm/studio typegen` should be run by Andrew when convenient, but it is not load-bearing for this phase because apps/web types are hand-written.
  </action>
  <verify>
    <automated>grep -n "name: 'conversation'" apps/studio/schemas/weeklyIssue.ts && grep -n "deliberation_conversation" packages/pipeline/src/eisenbalm_pipeline/graph/state.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "name: 'conversation'" apps/studio/schemas/weeklyIssue.ts` returns a line inside the selectionDeliberation fields array (line number between 343 and 384 region)
    - `grep -c "name: 'speaker'" apps/studio/schemas/weeklyIssue.ts` returns 1 and `grep -c "name: 'text'" apps/studio/schemas/weeklyIssue.ts` returns at least 1
    - `grep -n "name: 'candidates'" apps/studio/schemas/weeklyIssue.ts` still returns its original line (no existing field renamed)
    - `grep -n "name: 'editorDecision'" apps/studio/schemas/weeklyIssue.ts` and `grep -n "name: 'runnerUpNotes'" apps/studio/schemas/weeklyIssue.ts` both still return (untouched)
    - `grep -n "deliberation_conversation: Optional\[list\[dict\]\]" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` returns one line immediately after the deliberation_transcript field
    - `grep -c "Annotated" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` is unchanged (the new field is NOT Annotated — still only model_versions uses Annotated)
    - `cd packages/pipeline && python -c "from eisenbalm_pipeline.graph.state import DispatchState; print('deliberation_conversation' in DispatchState.__annotations__)"` prints `True`
  </acceptance_criteria>
  <done>Sanity schema has the additive conversation[] array of {speaker,text}; DispatchState carries deliberation_conversation; no existing field renamed.</done>
</task>

<task type="auto">
  <name>Task 3: Author the four Wave 0 test files (3 pytest + 1 vitest)</name>
  <files>packages/pipeline/tests/test_chronicler.py, packages/pipeline/tests/test_builder_wiring.py, packages/pipeline/tests/test_sanity_write.py, apps/web/__tests__/deliberation-conversation.test.ts</files>
  <read_first>
    - packages/pipeline/tests/agents/test_editor.py (lines 1-120 — the AsyncMock/patch pattern for acomplete, the test_transcript_format assertions; mirror this mocking style)
    - packages/pipeline/tests/test_pipeline_e2e.py (top-level pipeline test conventions, imports)
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (lines 100-150 — the exact add_node/add_edge call strings the wiring test will source-scan for)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (lines 113-119 — acomplete kwargs-only signature; the chronicler mock returns (ChroniclerOutput_instance, usage_dict))
    - apps/web/__tests__/deliberation-no-model-names.test.ts (the readFileSync + codeOnly() source-scan tripwire pattern to mirror)
    - apps/web/__tests__/issue-page-typography.test.ts (the codeOnly() comment-stripping helper to copy)
    - .planning/phases/13-deliberation-as-conversation/13-RESEARCH.md (Validation Architecture → Wave 0 Gaps + test commands; the Chronicler patterns 1 + Pydantic shapes)
    - .planning/phases/13-deliberation-as-conversation/13-UI-SPEC.md (CSS class names del-conversation*, the per-turn anatomy, the no-Markdown / no-dangerouslySetInnerHTML rules the web test asserts)
  </read_first>
  <action>
    Create four test files. They reference symbols that do not exist yet (chronicler module, conversation render block) — that is intentional Wave 0 RED. Use `pytest.importorskip` / try-import guards OR `pytest.mark.skip(reason="Wave 2: chronicler not yet implemented")` so the suite COLLECTS green now and Plan 02/03 un-skip by implementing. The web test uses readFileSync source-scan so it does not require the render to exist — write its assertions to fail clearly until Plan 03 lands, but guard the readFileSync inside each it() (Phase 9 pattern: readFileSync for not-yet-existing files must be INSIDE the it() callback, not module scope).

    1. `packages/pipeline/tests/test_chronicler.py` — covers DEL-CONV-01 substrate (faithfulness, well-formed turns, fallback, model_versions). Write these test functions, each `@pytest.mark.asyncio` and each `patch("eisenbalm_pipeline.agents.chronicler.acomplete", AsyncMock(...))`:
       - `test_chronicler_produces_wellformed_turns`: mock acomplete to return a ChroniclerOutput with ≥8 turns each with speaker ∈ {scout,advocate,editor}; assert the returned dict has `deliberation_conversation` as a list of ≥8 dicts each with keys exactly {"speaker","text"}.
       - `test_turn_faithfulness`: pass a state with a known winning_charity name + a candidate with advocateScore=7; mock acomplete to echo those into turns; assert the chronicler passes the real charity name + score into the user prompt (assert the prompt string built by the chronicler contains the charity name and "7"). Mock acomplete with side_effect to capture the `messages` kwarg and assert the candidate name + score appear in the user message content.
       - `test_fallback_preserves_transcript`: mock acomplete to raise Exception; pass a state whose `deliberation_transcript` is a sentinel string "EDITOR_TEMPLATE_TRANSCRIPT"; assert the chronicler returns `deliberation_conversation` is None (or absent) AND does not overwrite deliberation_transcript (the returned dict must NOT set deliberation_transcript to None — either omit the key or return the sentinel unchanged).
       - `test_model_versions_recorded`: mock acomplete to return usage with resolved_model="anthropic/claude-opus-x"; assert returned dict's model_versions contains key "chronicler".
       Wrap the `from eisenbalm_pipeline.agents.chronicler import chronicler` in a module-level try/except that sets a `CHRONICLER_AVAILABLE` flag, and decorate each test with `@pytest.mark.skipif(not CHRONICLER_AVAILABLE, reason="Wave 2: chronicler not yet implemented")`.

    2. `packages/pipeline/tests/test_builder_wiring.py` — covers DEL-CONV-01 wiring (DEL-P13-08). Pure source-scan (read builder.py with open()/read), assert all present as substrings:
       - `'builder.add_node("chronicler"' ` (the chronicler node is registered)
       - `'builder.add_edge("editor_gate_1", "chronicler")'`
       - `'builder.add_edge("chronicler", "researcher")'`
       - assert `'builder.add_edge("editor_gate_1", "researcher")'` is NOT present (the old direct edge was rewired). Until Plan 02 lands these assertions FAIL — that is intended Wave 0 RED; mark the whole module with `@pytest.mark.skip(reason="Wave 2: builder edge rewire not yet done")` OR write a `BUILDER_SRC` read at test time and skip when chronicler substring absent. Prefer skip-when-absent so the file collects green.

    3. `packages/pipeline/tests/test_sanity_write.py::test_conversation_write` — covers DEL-CONV-02 write (DEL-P13-09). Build a state dict with `deliberation_conversation = [{"speaker":"scout","text":"a"},{"speaker":"editor","text":"b"}]`, patch the httpx post inside write_issue_draft (mirror test_sanity_client_pdfcontent.py mocking style — read that file first to copy the AsyncClient mock), call write_issue_draft, and assert the posted document's `selectionDeliberation.conversation` is a list where every item has a `_key` matching `^turn-\d{3}$`, `_type == 'object'`, and `speaker`/`text` keys. Guard with skip-when-write-doesn't-yet-emit-conversation so it collects green pre-Plan-02.

    4. `apps/web/__tests__/deliberation-conversation.test.ts` — covers DEL-CONV-04 + DEL-CONV-06 render contract (DEL-P13-04). Copy the `codeOnly()` helper from issue-page-typography.test.ts. Read `apps/web/components/issue/DeliberationSlot.tsx` via readFileSync INSIDE each it(). Assert (each its own it()):
       - the component source contains the class string `del-conversation` (the thread wrapper class — Plan 03 adds it)
       - the source contains `role="log"` (the thread container ARIA)
       - the source contains `conversation` (the new prop)
       - the code (codeOnly-stripped) contains NO literal Markdown emphasis token that would render as text — assert codeOnly source does NOT match `/dangerouslySetInnerHTML/`
       - re-assert DEL-04: codeOnly().toLowerCase() does NOT contain any of `claude`, `gpt`, `sonnet`, `haiku`, `openrouter` (complements the never-skipped tripwire)
       Each it() must read the file inside the callback and skip via `if (!existsSync(PATH)) return` is NOT needed (file exists), but the new-string assertions will FAIL until Plan 03 — that is intended Wave 0 RED for the web suite. To keep CI green at this commit, wrap the four NEW assertions (del-conversation, role="log", conversation prop, no-dangerouslySetInnerHTML) in a single `describe.skip('Plan 13-03 conversation render (un-skip when DeliberationSlot extended)', ...)` block; keep the DEL-04 re-assertion in a non-skipped describe so it runs immediately. Plan 03 removes the `.skip`.

    DO NOT modify or delete packages/pipeline/tests/agents/test_editor.py::test_transcript_format or apps/web/__tests__/deliberation-no-model-names.test.ts (D-18 + DEL-04 — both must survive).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)/packages/pipeline" && python -m pytest tests/test_chronicler.py tests/test_builder_wiring.py tests/test_sanity_write.py --collect-only -q && cd "$(git rev-parse --show-toplevel)" && pnpm --filter web test:unit deliberation-conversation 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/pipeline/tests/test_chronicler.py packages/pipeline/tests/test_builder_wiring.py packages/pipeline/tests/test_sanity_write.py` lists all three files
    - `ls apps/web/__tests__/deliberation-conversation.test.ts` lists the file
    - `grep -c "def test_" packages/pipeline/tests/test_chronicler.py` returns ≥4
    - `grep -n "chronicler.acomplete" packages/pipeline/tests/test_chronicler.py` returns at least one patch target
    - `grep -n 'add_edge("editor_gate_1", "chronicler")' packages/pipeline/tests/test_builder_wiring.py` returns a line (the wiring assertion string)
    - `grep -n "turn-" packages/pipeline/tests/test_sanity_write.py` returns the _key regex assertion
    - `grep -n "del-conversation" apps/web/__tests__/deliberation-conversation.test.ts` returns a line
    - `grep -n "describe.skip" apps/web/__tests__/deliberation-conversation.test.ts` returns the Plan-13-03 skip block (so the web suite stays green at this commit)
    - `cd packages/pipeline && python -m pytest tests/test_chronicler.py tests/test_builder_wiring.py tests/test_sanity_write.py --collect-only -q` exits 0 (collects without import errors)
    - `cd packages/pipeline && python -m pytest -q` exits 0 (full suite green — new files skip/collect cleanly, test_transcript_format still passes)
    - `pnpm --filter web test:unit` exits 0 (web suite green — DEL-04 re-assertion runs, new render assertions are skip-gated)
  </acceptance_criteria>
  <done>Four Wave 0 test files exist; pipeline pytest collects+passes; web vitest passes; existing test_transcript_format and DEL-04 tripwire untouched.</done>
</task>

</tasks>

<verification>
Full-suite gate after this plan (per 13-VALIDATION.md sampling — run before merging Wave 1):
- `cd packages/pipeline && python -m pytest -q` exits 0
- `pnpm --filter web test:unit` exits 0
- `pnpm --filter web build` exits 0 (schema/state/test-only changes must not break the web build)
- `grep -c "deliberation_conversation" docs/API_CONTRACTS.md` ≥ 1
- `grep -c "name: 'conversation'" apps/studio/schemas/weeklyIssue.ts` == 1
</verification>

<success_criteria>
- docs/API_CONTRACTS.md reconciled for §7 / §1.2 / §2.2 (DEL-CONV-03)
- Sanity schema has additive conversation[] field, no renames (DEL-CONV-02)
- DispatchState carries deliberation_conversation (DEL-CONV-03)
- Four Wave 0 test files exist and the suite is green (DEL-CONV-06; Nyquist Dimension 8)
- No Convex eventType added; deliberationEvents path untouched (DEL-CONV-02)
- test_transcript_format + deliberation-no-model-names tripwire preserved (DEL-CONV-06)
</success_criteria>

<output>
After completion, create `.planning/phases/13-deliberation-as-conversation/13-01-SUMMARY.md`
</output>
</output>
