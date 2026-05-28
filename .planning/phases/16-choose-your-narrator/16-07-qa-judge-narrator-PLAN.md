---
phase: 16-choose-your-narrator
plan: 07
type: execute
wave: 4
depends_on: [16-02, 16-05]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
autonomous: true
requirements:
  - NRR-09
  - NRR-10
must_haves:
  truths:
    - "QA judge system message is appended with narrator.voiceRubric + narrator.exampleSamples when narrator is present"
    - "When narrator is None, BOTH system AND user messages are byte-identical to legacy Phase 5 QA judge messages"
    - "Narrator-aware additions ONLY touch the system message — the user message format is invariant"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
      provides: "narrator-aware QA judge system prompt"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
      to: "packages/pipeline/tests/test_qa_judge_narrator.py"
      via: "system + user message byte-equivalence assertion"
      pattern: "captured_messages[0]['content'] / captured_messages[1]['content']"
---

<objective>
Make the QA judge narrator-aware by appending `narrator.voiceRubric` + first 1-2 `narrator.exampleSamples` to its system message — **without altering the user message at all**. When `narrator=None`, both system and user messages must be byte-identical to the legacy Phase 5 implementation (NRR-10).

Purpose: Narrator-aware QA evaluation (NRR-09) without disturbing the existing prompt structure. The QA judge's user message is format-stable and machine-parsed downstream (corrections JSON schema relies on it).

Output: Updated `qa/judge.py` that:
- Loads the legacy rubric (the existing Phase 5 behaviour).
- If `narrator` is present, APPENDS `_render_narrator_addendum(narrator)` to the system message AFTER the existing rubric content.
- Leaves the user message construction completely untouched.

Implements: NRR-09 (narrator-aware QA), NRR-10 (byte-identical narrator=None behaviour for BOTH system and user messages).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
@packages/pipeline/src/eisenbalm_pipeline/state.py  # <-- post-16-05 Narrator TypedDict

<decisions_implemented>
- **D-06**: QA judge reads `state["narrator"]` (resolved object).
- **D-12**: Narrator-aware QA addendum is APPENDED to the system message, NEVER injected into the user message.
- **NRR-10** (re-confirmed by B6 revision): When `narrator=None` (legacy path), the QA judge MUST produce the byte-identical system AND user messages as Phase 5. No prefix, no suffix, no whitespace tweaks. The test_qa_judge_narrator.py test (Plan 16-02 Task 2) MUST assert both messages byte-for-byte.
</decisions_implemented>

<interfaces>
Current QA judge entry (Phase 5 baseline — preserve):
```python
# packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
async def evaluate_section(
    section_id: str,
    section_body: str,
    category: str,
    # ... etc
) -> QaCorrection: ...
```

Phase 16 addition — the entry signature gains an optional `narrator` parameter (kwarg with default None to preserve callers):
```python
async def evaluate_section(
    section_id: str,
    section_body: str,
    category: str,
    *,
    narrator: Narrator | None = None,
) -> QaCorrection: ...
```

Narrator addendum renderer (helper):
```python
def _render_narrator_addendum(narrator: Narrator) -> str:
    """
    Produce a system-message ADDENDUM that anchors evaluation against
    the narrator's voice rubric. Appended AFTER the legacy rubric.md content.

    Returns "" if narrator is None (caller should not call in that case, but defensive).
    """
    rubric = narrator["voiceRubric"]
    constraints_lines = "\n".join(f"- {c}" for c in rubric["constraints"])
    samples = narrator.get("exampleSamples") or []
    sample_block = ""
    if samples:
        # Take first 2 samples — keep token budget bounded.
        sample_block = "\n\nReference samples for this narrator's voice:\n" + "\n\n".join(samples[:2])

    return (
        f"\n\n"
        f"NARRATOR-SPECIFIC RUBRIC: This issue is narrated by {narrator['displayName']}. "
        f"Evaluate the section against THIS narrator's voice (not Jesse's, unless this IS Jesse).\n"
        f"Register: {rubric['register']}\n"
        f"Cadence: {rubric['cadence']}\n"
        f"Constraints:\n{constraints_lines}"
        f"{sample_block}"
    )
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Append narrator addendum to QA judge SYSTEM message; preserve USER message byte-for-byte</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py</files>

  <read_first>
    1. READ the FULL current `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` end-to-end. Note:
       - the current import block,
       - the current entry function signature,
       - how the system and user messages are currently built (via a `prompts.format_messages(category=...)` call or similar),
       - the rubric loading path (probably `prompts/rubric.md` or per-category rubric files).
    2. READ `packages/pipeline/src/eisenbalm_pipeline/state.py` post-16-05 to confirm `Narrator` TypedDict.
    3. RECORD the exact current "legacy" system message content and user message content (e.g., by running an existing Phase 5 QA judge test in isolation and inspecting the captured messages). This is what NRR-10 binds you to.
  </read_first>

  <action>
    Edit `qa/judge.py`:

    1. **Add the import**:
       ```python
       from eisenbalm_pipeline.state import Narrator
       ```

    2. **Add a private renderer** `_render_narrator_addendum` at module scope (verbatim from `<interfaces>` above).

    3. **Modify the entry function** `evaluate_section` (or its current name) to accept an optional `narrator` keyword:
       ```python
       async def evaluate_section(
           section_id: str,
           section_body: str,
           category: str,
           *,
           narrator: Narrator | None = None,
       ) -> QaCorrection: ...
       ```

    4. **Inside the function**: build messages the same way Phase 5 does. Then, ONLY for the system message and ONLY when narrator is set, append the addendum:
       ```python
       # Build messages exactly as Phase 5 does first.
       messages = prompts.format_messages(category=category, section_body=section_body)
       # messages is List[dict[str,str]] with messages[0] = system, messages[1] = user.

       # Phase 16 — narrator-aware ADDENDUM to system message only (NRR-09 + NRR-10).
       if narrator is not None:
           addendum = _render_narrator_addendum(narrator)
           messages[0] = {
               **messages[0],
               "content": messages[0]["content"] + addendum,
           }

       # User message is UNTOUCHED — preserves NRR-10 byte-equivalence.
       ```

    5. **Do NOT** add any `user_intro`, prefix, or suffix to the user message — regardless of narrator presence. The Plan 16-02 Task 2 test asserts byte-equivalence of `captured_messages[1]["content"]` against the legacy user content, and a single character difference fails the test.

    6. **Wire narrator into the call site**: in the QA orchestrator / runner that fans out to `evaluate_section` for each category, pass `narrator=state["narrator"]`. (This call site may live in `qa/__init__.py` or a per-category loop in the main graph — find it during the read step and update.)

    7. Do NOT modify the corrections JSON schema, the OpenRouter call site, or the per-category rubric files.
  </action>

  <verify>
    <automated>
      # 1. QA judge narrator test passes (Plan 16-02 Task 2 creates this).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py -v

      # 2. Specific byte-equivalence test for narrator=None on BOTH system and user.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py::test_qa_judge_narrator_none_preserves_legacy_messages -v

      # 3. Narrator-set system message contains the narrator display name.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py::test_judge_appends_narrator_rubric -v

      # 4. No regression on Phase 5 QA judge tests.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge.py -v

      # 5. Grep guard — judge.py does NOT modify the user message based on narrator.
      ! grep -E "narrator.*messages\[1\]|messages\[1\].*narrator|user_intro" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
      # Any such pattern means the user message is being touched — must fail to find.
    </automated>
  </verify>

  <done>
    - `evaluate_section` accepts `narrator: Narrator | None = None`.
    - When `narrator=None`: system AND user messages byte-identical to Phase 5.
    - When `narrator=<some narrator>`: system message has addendum appended; user message untouched.
    - `_render_narrator_addendum` only ever touches system content.
    - QA orchestrator passes `state["narrator"]` to every `evaluate_section` call.
    - All Phase 5 QA judge tests still pass.
    - New narrator tests pass.
  </done>
</task>

</tasks>

<verification>
- `uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py -v` exits 0.
- `uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge.py -v` exits 0 (no Phase 5 regression).
- Source grep guard: no narrator-conditional touches the user message (`messages[1]`).
</verification>

<success_criteria>
- NRR-09 satisfied: narrator-aware QA evaluation when narrator is present.
- NRR-10 satisfied: legacy byte-equivalence for both system and user messages when narrator=None.
- No leakage to the OpenRouter call shape or to the corrections JSON schema.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-07-qa-judge-narrator-SUMMARY.md`. Record:
- The exact addendum template.
- Confirmation that both system AND user messages are byte-identical to Phase 5 when narrator=None.
- The QA orchestrator call site that now passes narrator.
</output>
