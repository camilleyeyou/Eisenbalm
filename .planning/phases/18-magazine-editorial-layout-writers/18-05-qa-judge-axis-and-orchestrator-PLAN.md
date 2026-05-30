---
phase: 18-magazine-editorial-layout-writers
plan: 05
type: execute
wave: 3
depends_on: [18-04]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
autonomous: true
requirements: [MEL-04]

must_haves:
  truths:
    - "JudgeFinding.axis Literal includes 'structural-variety' (6 axes total, was 5)"
    - "rubric.md Evaluation Axes section gains a #6 'structural-variety' axis with explicit severity='warning' guidance"
    - "agents/qa/__init__.py _extract_sections() handles both str (legacy/stubs) and list[dict] (Phase 18 production) section bodies via a _section_body_text helper"
    - "test_qa_structural_axis.py: both tests GREEN"
    - "test_qa_judge_narrator.py (Phase 16) stays GREEN — narrator-rubric appending logic unchanged"
    - "Single Opus call per Phase 5 D-03 preserved — no second LLM call for the new axis"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py"
      provides: "JudgeFinding.axis Literal extended by 'structural-variety'"
      contains: "structural-variety"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md"
      provides: "Axis #6 'structural-variety' with rubric definition + severity='warning' note"
      contains: "structural-variety"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py"
      provides: "_section_body_text helper + _extract_sections rewired to call it (str / list[dict] dual-handling)"
      contains: "_section_body_text"
  key_links:
    - from: "agents/qa/judge.py JudgeFinding.axis Literal"
      to: "rubric.md Evaluation Axes section"
      via: "judge instructs LLM via rubric.md system prompt; LLM responds with axis values constrained by JudgeFinding schema"
      pattern: "structural-variety"
    - from: "agents/qa/__init__.py _extract_sections()"
      to: "state['origin_story']['body'] (post-Phase-18: list[dict])"
      via: "_section_body_text(body) concatenates child spans"
      pattern: "_section_body_text"
---

<objective>
Extend the QA judge to evaluate structural variety craft (sub-header wording quality + pull-quote
authenticity) AFTER the Pydantic structural floor guarantees the counts. This closes the loop on
ROADMAP success criterion 4 ("QA judge rejects any draft where a long-read section has 0
sub-headers OR 0 blockquotes") — Pydantic already does the rejection at write time; QA layers a
craft-quality axis on top.

CRITICAL coordination: After Plan 18-04, every `state['origin_story']['body']` (and the 4 siblings)
is `list[dict]`, not `str`. The QA orchestrator at `agents/qa/__init__.py` currently reads
`body` as a string (line ~78). Without a fix, the judge receives `"[{'_type': 'block', ..."`
as the section body (RESEARCH §Pitfall 2). This plan adds a `_section_body_text` extraction helper
and rewires `_extract_sections` to use it.

Purpose: 2 RED tests in test_qa_structural_axis.py turn GREEN. QA orchestrator handles both
legacy `str` and Phase 18 `list[dict]` body shapes without regression.
Output: 3 modified files (judge.py axis Literal, rubric.md axis section, __init__.py extraction helper).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py

<interfaces>
<!-- Current JudgeFinding.axis Literal (judge.py lines 79-86) — 5 axes -->
```python
axis: Literal[
    "gravity",
    "sentiment",
    "irony-signaling",
    "precision",
    "cross-section-consistency",
]
```

<!-- Current rubric.md Evaluation Axes (5 axes) -->
1. gravity
2. sentiment
3. irony-signaling
4. precision
5. cross-section-consistency

<!-- Current agents/qa/__init__.py _extract_sections (lines ~60-83) -->
```python
def _extract_sections(state: DispatchState) -> dict[str, str]:
    origin = state.get("origin_story") or {}
    problem = state.get("problem_statement") or {}
    founder = state.get("founder_bio") or {}
    case_st = state.get("case_study") or {}
    game = state.get("game") or {}
    bonus = state.get("bonus") or {}
    return {
        "origin_story": origin.get("body", "") or "",      # Phase 18: body is list[dict] now
        "problem":      problem.get("body", "") or "",     # same
        "founder_bio":  founder.get("body", "") or "",     # same
        "case_study":   case_st.get("body", "") or "",     # same
        "game":         game.get("description", "") or "", # GameContent has no body field
        "bonus":        bonus.get("body", "") or "",       # specAd: list[dict]; BigBudget/Jingle: str
    }
```

<!-- Helper template (RESEARCH §Code Examples) -->
```python
def _section_body_text(section_value) -> str:
    """Extract plain text from section body — handles both str (legacy/stubs/BigBudget/Jingle)
    and list[dict] (Phase 18 narrative writers + SpecAdBonus)."""
    if isinstance(section_value, str):
        return section_value
    if isinstance(section_value, list):
        parts = []
        for block in section_value:
            for child in (block.get('children') or []):
                parts.append(child.get('text', ''))
        return ' '.join(parts)
    return ''
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend JudgeFinding.axis Literal in judge.py + extend rubric.md with structural-variety axis</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py, packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py lines 69-90 (the JudgeFinding class + axis Literal)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (full file — the Evaluation Axes section currently has 5 axes; output format JSON shows axis as an enum)
    - packages/pipeline/tests/agents/test_qa_structural_axis.py (Plan 18-02 — the 2 RED assertions: typing.get_args(JudgeFinding.axis) includes "structural-variety"; rubric.md contains "structural-variety" + a nearby "warning" mention)
  </read_first>
  <behavior>
    - judge.py: `JudgeFinding.axis` Literal contains 6 values (gravity, sentiment, irony-signaling, precision, cross-section-consistency, structural-variety)
    - rubric.md: `Evaluation Axes` section has 6 numbered axes (was 5); new #6 is `structural-variety` with a 2-3 sentence description + an explicit severity='warning' note
    - rubric.md: the Output Format JSON example axis enum list is extended to include `"structural-variety"`
    - test_qa_structural_axis.py: both tests pass
    - test_qa_judge_narrator.py (Phase 16) stays green — no other change to rubric.md or judge.py structure
  </behavior>
  <action>
    **EDIT judge.py — extend the axis Literal**. Find `class JudgeFinding(BaseModel)` (around line 69)
    and the `axis: Literal[...]` declaration (lines 79-86). Add `"structural-variety"` as the 6th
    literal value:

    ```python
    # CURRENT (judge.py:79-86):
    axis: Literal[
        "gravity",
        "sentiment",
        "irony-signaling",
        "precision",
        "cross-section-consistency",
    ]
    # REPLACE WITH:
    axis: Literal[
        "gravity",
        "sentiment",
        "irony-signaling",
        "precision",
        "cross-section-consistency",
        "structural-variety",   # Phase 18 D-05 — qualitative craft axis; severity='warning' per rubric
    ]
    ```

    DO NOT modify any other line in judge.py. DO NOT add a new `run_llm_judge` parameter — the
    single Opus call per Phase 5 D-03 is preserved.

    **EDIT rubric.md — append axis #6**. Find the `## Evaluation Axes` section. After the existing
    `5. **cross-section-consistency**` paragraph, append:

    ```markdown
    6. **structural-variety** — Do the sub-headers serve the prose? Check: <=6
       words, Jesse-voice, no generic labels ("Background", "Conclusion",
       "Overview"). Is the blockquote a real one-sentence lift from body prose,
       or a restated summary? Structural shell is guaranteed by the Pydantic
       validator at the writer layer (Phase 18 D-02); this axis judges craft.
       Severity: **warning** (counts are guaranteed by the pipeline; this axis
       catches "technically compliant but editorially lazy" output).
    ```

    Then locate the `## Output Format` JSON example (the `"axis":` enum line) and extend the
    enum list to include the new value:

    ```markdown
    # CURRENT line in the Output Format JSON example:
    "axis": "gravity" | "sentiment" | "irony-signaling" | "precision" | "cross-section-consistency",
    # REPLACE WITH:
    "axis": "gravity" | "sentiment" | "irony-signaling" | "precision" | "cross-section-consistency" | "structural-variety",
    ```

    DO NOT modify the `## Role`, `## Jesse Voice`, `## Forbidden`, or `## Input Format` sections.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py tests/test_qa_judge_narrator.py -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '"structural-variety"' packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` returns `1`
    - `grep -c "structural-variety" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` returns >= 2 (axis #6 heading + Output Format enum)
    - rubric.md has a #6 numbered axis: `grep -c "^6\. \*\*structural-variety\*\*" packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` returns `1`
    - severity='warning' guidance present near the new axis: `awk '/^6\. \*\*structural-variety\*\*/{f=1} f && /Severity.*warning/{print "OK"; exit}' packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` prints `OK`
    - judge.py axis Literal still has all 5 prior values: `grep -c "\"gravity\"\|\"sentiment\"\|\"irony-signaling\"\|\"precision\"\|\"cross-section-consistency\"" packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` returns `5`
    - Both Plan 18-02 RED tests now GREEN: `cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py -q 2>&1 | tail -1` shows `2 passed`
    - Phase 16 narrator-rubric test stays GREEN: `cd packages/pipeline && uv run pytest tests/test_qa_judge_narrator.py -q 2>&1 | tail -1` shows pre-plan baseline pass count
    - `cd packages/pipeline && uv run python -c "from typing import get_args, get_type_hints; from eisenbalm_pipeline.agents.qa.judge import JudgeFinding; print(sorted(get_args(get_type_hints(JudgeFinding)['axis'])))"` prints a list of 6 values including `structural-variety`
  </acceptance_criteria>
  <done>
    judge.py axis Literal extended by 1; rubric.md gains axis #6 with severity='warning' note + Output Format enum extended; both Plan 18-02 QA tests green; Phase 16 narrator-rubric test stays green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add _section_body_text helper to agents/qa/__init__.py and rewire _extract_sections</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py (full file — see lines 59-83 for _extract_sections; the rest of the orchestrator calls run_llm_judge with the sections dict)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md §Pitfall 2 + §Code Examples (the _section_body_text helper code is HIGH-confidence, ready to ship verbatim)
    - packages/pipeline/tests/test_qa_judge_narrator.py (Phase 16 — verifies narrator-rubric appending; must stay green)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (Plan 18-03 — SectionContent.body is now list[dict])
  </read_first>
  <behavior>
    - A new module-level helper `_section_body_text(section_value) -> str` exists, handles `str` (legacy/stubs/BigBudget/Jingle), `list[dict]` (Phase 18 production), and `None`/missing (returns `""`)
    - `_extract_sections` uses `_section_body_text(...)` for ALL section body extractions
    - The returned dict still has the SAME 6 keys (`origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus`)
    - `game` extraction still reads `.description` (GameContent has no body field — Phase 5 design)
    - Empty/missing section returns `""` (not `[]` — the judge expects a string)
    - No other change to the orchestrator function (qa() body, narrator-rubric appending, etc.)
    - test_qa_judge_narrator.py stays GREEN (Phase 16 NRR test — narrator-rubric assembly logic unchanged)
  </behavior>
  <action>
    Open `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py`.

    **EDIT 1 — Add the `_section_body_text` helper** as a module-level private function immediately
    above the existing `_extract_sections` function:

    ```python
    def _section_body_text(section_value) -> str:
        """Extract plain text from a section body field.

        Phase 18 introduces list[BodyBlock] body shape for narrative writers + SpecAdBonus.
        BigBudget + Jingle bonus bodies remain str. Stub-mode fixtures may also still emit
        str until Plan 18-06 updates them. This helper bridges both shapes for the QA judge,
        which expects a flat str body per section.

        Args:
            section_value: One of:
              - str (legacy / stubs / BigBudget / Jingle bonus): returned as-is
              - list[dict] (Phase 18 production: Portable Text blocks with 'children' spans):
                  concatenates each child span's text with single-space join
              - None or missing: returns ""

        Returns:
            Plain text body string for the judge.
        """
        if isinstance(section_value, str):
            return section_value
        if isinstance(section_value, list):
            parts: list[str] = []
            for block in section_value:
                if not isinstance(block, dict):
                    continue
                for child in (block.get('children') or []):
                    if isinstance(child, dict):
                        parts.append(child.get('text', ''))
            return ' '.join(parts)
        return ''
    ```

    **EDIT 2 — Rewire `_extract_sections`** to call `_section_body_text` for every section body
    extraction. Replace the current return dict (lines ~78-83):

    ```python
    # CURRENT:
    return {
        "origin_story": origin.get("body", "") or "",
        "problem":      problem.get("body", "") or "",
        "founder_bio":  founder.get("body", "") or "",
        "case_study":   case_st.get("body", "") or "",
        "game":         game.get("description", "") or "",
        "bonus":        bonus.get("body", "") or "",
    }
    # REPLACE WITH:
    return {
        "origin_story": _section_body_text(origin.get("body")),
        "problem":      _section_body_text(problem.get("body")),
        "founder_bio":  _section_body_text(founder.get("body")),
        "case_study":   _section_body_text(case_st.get("body")),
        "game":         game.get("description", "") or "",  # GameContent has no body (Phase 5)
        "bonus":        _section_body_text(bonus.get("body")),
    }
    ```

    DO NOT modify the `qa()` orchestrator function, the Layer-1 `check_unverified_name` calls, the
    narrator-rubric appending logic in the call to `run_llm_judge`, or the `_finding_to_qa_correction`
    helper.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py tests/test_qa_judge_narrator.py tests/agents/qa/ -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^def _section_body_text" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` returns `1`
    - `grep -c "_section_body_text(" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` returns >= 6 (1 definition + 5 narrative+bonus call sites in _extract_sections)
    - `game` extraction preserved: `grep -c "game.get(\"description\"" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` returns `1` (Phase 5 design — GameContent has no body)
    - Helper handles dict-list path: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.qa import _section_body_text; r = _section_body_text([{'_type':'block','style':'h2','children':[{'_type':'span','text':'Title'}]}, {'_type':'block','style':'normal','children':[{'_type':'span','text':'Body.'}]}]); print(r)"` prints `Title Body.`
    - Helper handles str path: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.qa import _section_body_text; print(_section_body_text('legacy plain text'))"` prints `legacy plain text`
    - Helper handles None: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.qa import _section_body_text; print(repr(_section_body_text(None)))"` prints `''`
    - test_qa_structural_axis.py stays GREEN (Task 1 made it pass): `cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py -q 2>&1 | tail -1` shows `2 passed`
    - test_qa_judge_narrator.py stays GREEN: `cd packages/pipeline && uv run pytest tests/test_qa_judge_narrator.py -q 2>&1 | tail -1` shows pre-plan baseline pass count
    - Any existing QA orchestrator tests in tests/agents/qa/ stay green
  </acceptance_criteria>
  <done>
    _section_body_text helper added; _extract_sections rewired to use it for all 5 long-read body fields (origin_story, problem, founder_bio, case_study, bonus); game extraction preserved as-is; narrator-rubric assembly unchanged.
  </done>
</task>

</tasks>

<verification>
- Plan 18-02 all RED tests GREEN at this point: `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py tests/agents/test_qa_structural_axis.py tests/agents/test_bonus_specad_only.py tests/lib/test_portable_text_blocks.py -q 2>&1 | tail -1` shows `34 passed`
- Phase 16 NRR-04 tripwires stay green: `cd packages/pipeline && uv run pytest tests/test_section_writer_voice_propagation.py tests/test_qa_judge_narrator.py tests/test_voice.py -q 2>&1 | tail -1` shows pass
- Full pipeline suite passing >= Phase 16 baseline (168 from STATE.md) + 34 new MEL tests = ≥ 202 passing: `cd packages/pipeline && uv run pytest -q 2>&1 | tail -2` (note: some per-agent tests in tests/agents/ may still RED if their stub fixtures still emit body:str — Plan 18-06 will fix; minor regression is expected and explicitly tracked in this plan's done criteria as Plan-18-06-deferred)
- Web vitest baseline preserved: `pnpm --filter web test:unit --run 2>&1 | tail -3` shows ≥ 234 passing
- JudgeFinding.axis includes structural-variety; rubric.md axis #6 documented; single Opus call preserved (no run_llm_judge signature change)
</verification>

<success_criteria>
- judge.py: 6-value axis Literal (was 5)
- rubric.md: 6-axis Evaluation Axes section + Output Format JSON updated
- agents/qa/__init__.py: _section_body_text helper added + _extract_sections rewired for all 5 long-read bodies
- All 4 Plan 18-02 test files have ALL tests GREEN (34 total): 20 writer_structural_floor + 2 qa_structural_axis + 3 bonus_specad_only + 9 portable_text_blocks
- Phase 16 NRR-04 byte-equivalence preserved (test_section_writer_voice_propagation.py + test_qa_judge_narrator.py + test_voice.py green)
- Plan 18-06 still needs to: update stub fixtures so the full e2e/stub pipeline doesn't regress
</success_criteria>

<output>
After completion, create `.planning/phases/18-magazine-editorial-layout-writers/18-05-SUMMARY.md`
summarizing: exact axis position in judge.py Literal, the rubric.md insertion location (line range of
new axis #6), the _section_body_text helper byte count, the 5 call site replacements in
_extract_sections, and a checkbox confirming all 34 Plan 18-02 RED tests are now GREEN.
</output>
