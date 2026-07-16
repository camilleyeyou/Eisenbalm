---
phase: 47-story-brief-stage
plan: 03
type: execute
wave: 3
depends_on: ["47-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
  - packages/pipeline/tests/lib/test_voice.py
autonomous: true
requirements: [BRF-05]
must_haves:
  truths:
    - "build_section_writer_prompt accepts a 5th optional `brief` param and renders the six Brief fields into the user message (append, never replacing the existing 4 content blocks)"
    - "All 7 section writers pass state['brief'] into their prompt so they draft FROM the Brief"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      provides: "build_section_writer_prompt with a 5th brief param"
      contains: "brief: dict[str, Any] | None = None"
  key_links:
    - from: "the 7 section writers"
      to: "build_section_writer_prompt / their prompt builders"
      via: "brief=state.get('brief')"
      pattern: "state.get(\"brief\")"
---

<objective>
Thread the six-field Brief into every section writer so they draft FROM it (BRF-05, second half). The precise, code-reviewed seam is `lib/voice.py::build_section_writer_prompt`, which has a hard 4-content-param invariant — add exactly ONE 5th optional `brief` param and render the six fields alongside `research`/`style_brief`. Then pass `brief=state.get("brief")` at every writer.

Purpose: Success criterion 5 requires "the section writers draft from it." The Brief only affects drafting if it reaches the prompts.
Output: 5th param on the helper; brief threaded into all 7 SECTION_WRITERS; updated test_voice.py.

IMPORTANT accuracy note (verified this session — corrects RESEARCH's "7 build_section_writer_prompt call sites"): only FOUR writers route through `build_section_writer_prompt` — `origin_story` (:125), `problem` (:158), `founder_bio` (:173), `case_study` (:168). `game` uses `load_prompt("game"/"game_user")`, `bonus` selects an internal prompt by `bonusType`, and `design` builds its own prompt. Thread the Brief through the helper's 4 call sites AND through the 3 bespoke prompt builders at their existing `style_brief` consumption points, so all 7 writers see the Brief.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/47-story-brief-stage/47-CONTEXT.md
@.planning/phases/47-story-brief-stage/47-RESEARCH.md

<interfaces>
build_section_writer_prompt smallest change (RESEARCH Pattern 5):
```python
def build_section_writer_prompt(
    *,
    section_id: str,
    section_title: str,
    section_guidance: str,
    charity: dict[str, Any],
    research: dict[str, Any],
    style_brief: dict[str, Any],
    brief: dict[str, Any] | None = None,   # NEW — BRF-05, Phase 47 (append into USER message; None => byte-identical to pre-Phase-47)
    voice_constraints: str = VOICE_CONSTRAINTS,
    claims: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
```

7 SECTION_WRITERS (builder.py `SECTION_WRITERS`): origin_story, problem, founder_bio, case_study, game, bonus, design.
- Helper users (add `brief=state.get("brief")` to the call): origin_story.py:125, problem.py:158, founder_bio.py:173, case_study.py:168 (each already builds `style_brief = state.get("style_brief") or {}` just above the call).
- Bespoke builders (append the Brief at their `state.get("style_brief")` site): game.py, bonus.py (~L259), design/__init__.py (~L172).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add 5th `brief` param to build_section_writer_prompt + render it</name>
  <read_first>
    packages/pipeline/src/eisenbalm_pipeline/lib/voice.py L250-320 (the function signature + its hard 4-content-param docstring invariant + the USER-message assembly where `style_brief`'s bonusType/visualDirection are already rendered — append the Brief there the same way). packages/pipeline/tests/lib/test_voice.py (existing assertions on the returned message list). 47-RESEARCH.md §"Pattern 5".
  </read_first>
  <behavior>
    - Calling with `brief=None` returns a message list byte-identical to the pre-Phase-47 output (no Brief header emitted).
    - Calling with a six-field brief renders all six values into the USER message content (never the system message — voice isolation).
    - The function signature exposes `brief` as an optional keyword param between `style_brief` and `voice_constraints`.
  </behavior>
  <action>
    Add the `brief: dict[str, Any] | None = None` keyword param per the interfaces block. Update the docstring's invariant note to record the Brief as the deliberate 5th content block (Phase 47, BRF-05). In the USER-message assembly, append a "STORY BRIEF (draft from this)" block rendering premise/currentPeg/centralClaim/readerEffect/knownRisks/voiceIntention ONLY when `brief` is truthy; emit nothing when `None`. Do NOT add it to the system message.
    Update `tests/lib/test_voice.py`: assert (a) `brief=None` output equals the prior shape, (b) a supplied brief's six values appear in the USER message and NOT the system message, (c) the signature accepts `brief` as keyword-only.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/lib/test_voice.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `voice.py` `build_section_writer_prompt` signature contains `brief: dict[str, Any] | None = None`
    - `grep -n "brief" packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` shows the six field labels rendered into the user-message block
    - `pytest tests/lib/test_voice.py` asserts None-equals-prior + six-values-in-user-not-system; green
  </acceptance_criteria>
  <done>The one code-reviewed writer-prompt seam accepts and renders the Brief.</done>
</task>

<task type="auto">
  <name>Task 2: Pass the Brief into all 7 section writers</name>
  <read_first>
    Each of the 7 writer files at the call sites in the interfaces block. For the 4 helper users, the `build_section_writer_prompt(...)` call (add one kwarg). For game.py / bonus.py (~L259) / design/__init__.py (~L172), the `style_brief = state.get("style_brief") or {}` site where the bespoke prompt is assembled — append a compact Brief block to that prompt's user content. packages/pipeline/tests/lib/test_voice.py.
  </read_first>
  <action>
    For `origin_story.py:125`, `problem.py:158`, `founder_bio.py:173`, `case_study.py:168`: add `brief=state.get("brief")` to the `build_section_writer_prompt(...)` call (one line each).
    For `game.py`, `bonus.py`, `design/__init__.py`: read `brief = state.get("brief") or {}` next to the existing `style_brief` read and append its six fields into the bespoke user prompt (a short "STORY BRIEF" block) so these three writers also draft from the Brief. Keep it additive and None-safe (empty brief => no block).
    Add a lightweight assertion (in test_voice.py or a small writer-threading test) that every SECTION_WRITER module references `state.get("brief")` — the grep-verifiable proof that all 7 thread it.
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -rl 'state.get("brief")' src/eisenbalm_pipeline/agents/origin_story.py src/eisenbalm_pipeline/agents/problem.py src/eisenbalm_pipeline/agents/founder_bio.py src/eisenbalm_pipeline/agents/case_study.py src/eisenbalm_pipeline/agents/game.py src/eisenbalm_pipeline/agents/bonus.py src/eisenbalm_pipeline/agents/design/__init__.py | wc -l | grep -q '^7$' && echo "ALL 7 THREAD BRIEF"</automated>
  </verify>
  <acceptance_criteria>
    - All 7 writer modules contain `state.get("brief")` (the grep count is exactly 7)
    - The 4 helper users pass `brief=state.get("brief")` into `build_section_writer_prompt`
    - `game.py`/`bonus.py`/`design/__init__.py` append a Brief block to their bespoke prompts, None-safe
    - `cd packages/pipeline && uv run pytest tests/ -q` remains green (no writer regression)
  </acceptance_criteria>
  <done>Every one of the 7 section writers drafts from the Brief.</done>
</task>

</tasks>

<verification>
- `pytest tests/lib/test_voice.py` + full pytest green.
- grep confirms all 7 writers reference `state.get("brief")`; the 4 helper users pass it via the 5th param.
</verification>

<success_criteria>
The six-field Brief reaches every section writer's prompt; BRF-05's "writers draft from it" is satisfied end-to-end (generation in 47-02, consumption here).
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-03-SUMMARY.md`.
</output>
