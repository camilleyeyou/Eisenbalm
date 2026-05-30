---
phase: 18-magazine-editorial-layout-writers
plan: 02
type: execute
wave: 0
depends_on: []
files_modified:
  - packages/pipeline/tests/agents/test_writer_structural_floor.py
  - packages/pipeline/tests/agents/test_qa_structural_axis.py
  - packages/pipeline/tests/agents/test_bonus_specad_only.py
  - packages/pipeline/tests/lib/test_portable_text_blocks.py
autonomous: true
requirements: [MEL-01, MEL-02, MEL-04, MEL-08]

must_haves:
  truths:
    - "4 new RED-first pytest files exist, importing the not-yet-built lib + writer surfaces"
    - "All 4 new test files run (collect cleanly) but FAIL at this commit — the production code they assert against doesn't exist yet (validates Wave 1+ unblocks them)"
    - "Test fixture body shapes use the discriminated-union dict form (type/text keys) — matches CONTEXT D-01 verbatim"
  artifacts:
    - path: "packages/pipeline/tests/agents/test_writer_structural_floor.py"
      provides: "Parametrized RED tests for MEL-01 (≥2 h2/h3) and MEL-02 (≥1 blockquote) across 5 writers"
      contains: "_enforce_structural_floor"
    - path: "packages/pipeline/tests/agents/test_qa_structural_axis.py"
      provides: "RED test for MEL-04 (structural-variety axis in judge.py + rubric.md)"
      contains: "structural-variety"
    - path: "packages/pipeline/tests/agents/test_bonus_specad_only.py"
      provides: "RED negative test for MEL-08 (BigBudget + Jingle do NOT have structural floor)"
      contains: "BigBudgetBonus"
    - path: "packages/pipeline/tests/lib/test_portable_text_blocks.py"
      provides: "Unit tests for 4 new block builders + compose_section_body serializer"
      contains: "compose_section_body"
  key_links:
    - from: "test_writer_structural_floor.py"
      to: "agents/origin_story.OriginStoryOutput (re-typed in Plan 18-04)"
      via: "ValidationError import + writer Pydantic instantiation"
      pattern: "OriginStoryOutput|ProblemOutput|FounderBioOutput|CaseStudyOutput|SpecAdBonus"
    - from: "test_portable_text_blocks.py"
      to: "lib.portable_text.block_h2 (added in Plan 18-03)"
      via: "import from eisenbalm_pipeline.lib.portable_text"
      pattern: "from eisenbalm_pipeline.lib.portable_text import"
---

<objective>
RED-first test scaffold. Author 4 pytest files that fail at this commit because they import
production surfaces that don't exist yet (block builders, BodyBlock union, structural floor
validators, structural-variety judge axis). When Wave 1 (Plan 18-03) ships the lib + state
layer, the helper tests turn green. When Wave 2 (Plan 18-04) ships the writer Pydantic
changes, the structural-floor tests turn green. When Wave 3 (Plan 18-05) ships the QA axis,
the judge tests turn green. Negative test stays green continuously (asserts an ABSENCE).

Purpose: Encode MEL-01, MEL-02, MEL-04, MEL-08 as machine-checkable contracts before any
production code is written — exposes interface drift between plan text and code.
Output: 4 new test files in `packages/pipeline/tests/{agents,lib}/`, all failing at this commit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md
@.planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md
@packages/pipeline/tests/conftest.py

<interfaces>
<!-- Existing pytest patterns this plan follows — sourced from prior RED-first scaffolds (Phase 16 NRR test files). -->

Existing test directory layout (verified):
- `packages/pipeline/tests/agents/test_*.py` — agent-scoped tests
- `packages/pipeline/tests/lib/test_*.py` — lib-scoped tests
- conftest.py provides: `stub_mode` env fixture, fake OpenRouter, run_id helper

Pydantic v2 ValidationError import (RESEARCH §Pattern 2):
```python
from pydantic import ValidationError
```

Conforming body shape (from RESEARCH §Code Examples — fixture body):
```python
VALID_BODY = [
    {"type": "paragraph", "text": "Burlington, Vermont. 1987."},
    {"type": "h2", "text": "The founding moment"},
    {"type": "paragraph", "text": "A librarian made a recording."},
    {"type": "blockquote", "text": "The silence is the product."},
    {"type": "h2", "text": "Why not something else"},
    {"type": "paragraph", "text": "Acoustic data has no institutional home."},
]

INVALID_NO_HEADINGS = [
    {"type": "paragraph", "text": "All paragraphs, no headings."},
    {"type": "paragraph", "text": "Still flat."},
    {"type": "blockquote", "text": "One pull-quote."},
]

INVALID_NO_BLOCKQUOTE = [
    {"type": "paragraph", "text": "Two h2s but no blockquote."},
    {"type": "h2", "text": "First movement"},
    {"type": "paragraph", "text": "Middle prose."},
    {"type": "h2", "text": "Second movement"},
    {"type": "paragraph", "text": "Final prose."},
]
```

Writer Pydantic models to import (currently each has `body: str = ""`; Plan 18-04 changes to `list[BodyBlock]`):
- `from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput`
- `from eisenbalm_pipeline.agents.problem import ProblemOutput`
- `from eisenbalm_pipeline.agents.founder_bio import FounderBioOutput`
- `from eisenbalm_pipeline.agents.case_study import CaseStudyOutput`
- `from eisenbalm_pipeline.agents.bonus import SpecAdBonus, BigBudgetBonus, JingleBonus`

QA judge surface (Plan 18-05 adds "structural-variety"):
- `from eisenbalm_pipeline.agents.qa.judge import JudgeFinding`
- `JudgeFinding.model_fields['axis'].annotation` returns the Literal type

Helper surface (Plan 18-03 creates):
- `from eisenbalm_pipeline.lib.portable_text import block_paragraph, block_h2, block_h3, block_blockquote, compose_section_body`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create test_writer_structural_floor.py (MEL-01 + MEL-02 — parametrized over 5 writers)</name>
  <files>packages/pipeline/tests/agents/test_writer_structural_floor.py</files>
  <read_first>
    - packages/pipeline/tests/conftest.py (existing fixture patterns; stub-mode env handling)
    - packages/pipeline/tests/agents/test_origin_story.py (existing per-agent test pattern to mirror for import paths)
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py (current OriginStoryOutput shape — confirms `body: str = ""` is the pre-Phase-18 shape; Plan 18-04 changes to `list[BodyBlock]`)
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py lines 83-92 (SpecAdBonus current shape)
  </read_first>
  <action>
    Create the file with this EXACT content (parametrized RED scaffold):

    ```python
    """Phase 18 MEL-01 + MEL-02 — Writer structural-floor RED tests.

    Asserts each of the 5 long-read writers' response Pydantic model rejects
    bodies with < 2 sub-headers OR < 1 blockquote, and accepts conforming bodies.

    RED at commit (Wave 0); turns GREEN after Plan 18-04 lands writer Pydantic
    changes. Until then, expect ImportError on Annotated[Union[...], discriminator]
    OR ValidationError NOT raised (the current `body: str` field accepts any string).

    Source: CONTEXT.md D-01 + D-02; RESEARCH §Pattern 2.
    """
    from __future__ import annotations

    import pytest
    from pydantic import ValidationError

    # Imports below will fail at Wave 0 commit because the writers still have
    # `body: str`. After Plan 18-04, they import `list[BodyBlock]` and the
    # validator. The conftest skip-on-import pattern is intentionally NOT used
    # — these tests are SUPPOSED to fail until Wave 2.
    from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput
    from eisenbalm_pipeline.agents.problem import ProblemOutput
    from eisenbalm_pipeline.agents.founder_bio import FounderBioOutput
    from eisenbalm_pipeline.agents.case_study import CaseStudyOutput
    from eisenbalm_pipeline.agents.bonus import SpecAdBonus


    VALID_BODY = [
        {"type": "paragraph", "text": "Burlington, Vermont. 1987."},
        {"type": "h2",        "text": "The founding moment"},
        {"type": "paragraph", "text": "A librarian made a recording."},
        {"type": "blockquote","text": "The silence is the product."},
        {"type": "h2",        "text": "Why not something else"},
        {"type": "paragraph", "text": "Acoustic data has no institutional home."},
    ]

    INVALID_NO_HEADINGS = [
        {"type": "paragraph", "text": "All paragraphs, no headings."},
        {"type": "paragraph", "text": "Still flat."},
        {"type": "blockquote","text": "One pull-quote."},
    ]

    INVALID_ONE_HEADING_NO_BLOCKQUOTE = [
        {"type": "paragraph", "text": "Only one h2."},
        {"type": "h2",        "text": "Movement"},
        {"type": "paragraph", "text": "Final paragraph."},
    ]

    INVALID_TWO_HEADINGS_NO_BLOCKQUOTE = [
        {"type": "paragraph", "text": "Two h2s but no blockquote."},
        {"type": "h2",        "text": "First movement"},
        {"type": "paragraph", "text": "Middle prose."},
        {"type": "h2",        "text": "Second movement"},
        {"type": "paragraph", "text": "Final prose."},
    ]


    # Per-writer construction helpers — each writer's required fields differ;
    # we instantiate with the minimum legal set + the body fixture under test.
    def _make(writer_cls, body):
        if writer_cls is OriginStoryOutput:
            return writer_cls(headline="H", body=body)
        if writer_cls is ProblemOutput:
            return writer_cls(
                headline="H",
                body=body,
                pdfContent={
                    "problemStatement": "p",
                    "keyDataPoints": [
                        {"stat": "1", "source": "s"},
                        {"stat": "2", "source": "s"},
                        {"stat": "3", "source": "s"},
                    ],
                    "interventionMechanism": "i",
                },
            )
        if writer_cls is FounderBioOutput:
            return writer_cls(headline="H", body=body)
        if writer_cls is CaseStudyOutput:
            return writer_cls(subjectName="S", headline="H", body=body)
        if writer_cls is SpecAdBonus:
            return writer_cls(headline="H", body=body)
        raise ValueError(f"Unknown writer class: {writer_cls}")


    WRITERS = [
        pytest.param(OriginStoryOutput, id="origin_story"),
        pytest.param(ProblemOutput,    id="problem"),
        pytest.param(FounderBioOutput, id="founder_bio"),
        pytest.param(CaseStudyOutput,  id="case_study"),
        pytest.param(SpecAdBonus,      id="bonus[specAd]"),
    ]


    @pytest.mark.parametrize("writer_cls", WRITERS)
    def test_structural_floor_headings_required(writer_cls):
        """MEL-01: writer rejects body with < 2 h2/h3 sub-headers."""
        with pytest.raises(ValidationError) as exc_info:
            _make(writer_cls, INVALID_NO_HEADINGS)
        assert "structural-floor" in str(exc_info.value)
        assert "sub-headers" in str(exc_info.value)


    @pytest.mark.parametrize("writer_cls", WRITERS)
    def test_structural_floor_blockquote_required(writer_cls):
        """MEL-02: writer rejects body with < 1 blockquote."""
        with pytest.raises(ValidationError) as exc_info:
            _make(writer_cls, INVALID_TWO_HEADINGS_NO_BLOCKQUOTE)
        assert "structural-floor" in str(exc_info.value)
        assert "blockquote" in str(exc_info.value)


    @pytest.mark.parametrize("writer_cls", WRITERS)
    def test_structural_floor_one_heading_rejected(writer_cls):
        """MEL-01 edge: one heading is not enough (need >= 2)."""
        with pytest.raises(ValidationError):
            _make(writer_cls, INVALID_ONE_HEADING_NO_BLOCKQUOTE)


    @pytest.mark.parametrize("writer_cls", WRITERS)
    def test_structural_floor_valid_body_accepted(writer_cls):
        """MEL-01 + MEL-02 happy path: 2 h2 + 1 blockquote passes."""
        out = _make(writer_cls, VALID_BODY)
        # body is a list[BodyBlock]; each block has a `type` and `text`
        # (either as dict keys after model_dump, or as attrs on Pydantic instances)
        assert len(out.body) == len(VALID_BODY)
        # accept either dict-shaped (model_dump) or attr-shaped (Pydantic instance)
        first = out.body[0]
        first_type = first.get("type") if isinstance(first, dict) else getattr(first, "type", None)
        assert first_type == "paragraph"
    ```

    Do NOT add `@pytest.mark.skip` — tests are SUPPOSED to fail at Wave 0. Wave 1 collection
    must succeed (no ImportError at the file-import level — that requires the writer modules to
    exist, which they already do; only the validator behavior is missing).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py --collect-only -q 2>&1 | grep -E "20 tests collected|errors|ERROR" | head -3</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `packages/pipeline/tests/agents/test_writer_structural_floor.py`
    - `grep -c "VALID_BODY\|INVALID_NO_HEADINGS\|INVALID_ONE_HEADING_NO_BLOCKQUOTE\|INVALID_TWO_HEADINGS_NO_BLOCKQUOTE" packages/pipeline/tests/agents/test_writer_structural_floor.py` returns `4` (one declaration each, plus references inside test functions — actual count is higher; the assertion is "all four fixture names appear")
    - `grep -c "@pytest.mark.parametrize" packages/pipeline/tests/agents/test_writer_structural_floor.py` returns `4` (one decorator per test function — 4 functions)
    - `grep -c "pytest.param" packages/pipeline/tests/agents/test_writer_structural_floor.py` >= 5 (the WRITERS list)
    - `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py --collect-only -q 2>&1 | grep -c "test_structural_floor"` returns `20` (4 functions × 5 writers parametrized)
    - `grep "@pytest.mark.skip" packages/pipeline/tests/agents/test_writer_structural_floor.py` produces NO matches (test must be RED, not skipped)
    - `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -x 2>&1 | grep -E "FAILED|ValidationError NOT raised|did not raise"` produces at least one match (confirms RED — fails because writer `body: str` accepts anything)
  </acceptance_criteria>
  <done>
    Test file exists, collects 20 tests, fails RED at Wave 0 commit because the Pydantic validator doesn't exist yet. Plan 18-04 will land the validator and turn these green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create test_qa_structural_axis.py (MEL-04) and test_bonus_specad_only.py (MEL-08)</name>
  <files>packages/pipeline/tests/agents/test_qa_structural_axis.py, packages/pipeline/tests/agents/test_bonus_specad_only.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py lines 69-90 (current JudgeFinding.axis Literal — Plan 18-05 will add "structural-variety")
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (current axes — "Evaluation Axes" section; Plan 18-05 will add axis 6)
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py lines 54-92 (BigBudgetBonus, JingleBonus, SpecAdBonus current shapes — confirms BigBudget and Jingle bodies stay str per D-04)
  </read_first>
  <action>
    Create `packages/pipeline/tests/agents/test_qa_structural_axis.py` with this EXACT content:

    ```python
    """Phase 18 MEL-04 — QA judge structural-variety axis RED test.

    Asserts:
      1. JudgeFinding.axis Literal includes "structural-variety"
      2. rubric.md contains a "structural-variety" axis section

    RED at commit (Wave 0); turns GREEN after Plan 18-05 extends the Literal
    and appends the axis to rubric.md.

    Source: CONTEXT.md D-05; RESEARCH §Pattern 5.
    """
    from __future__ import annotations

    from pathlib import Path
    from typing import get_args, get_type_hints

    from eisenbalm_pipeline.agents.qa.judge import JudgeFinding


    def test_judge_finding_axis_includes_structural_variety():
        """MEL-04: 'structural-variety' is a permitted JudgeFinding.axis value."""
        hints = get_type_hints(JudgeFinding)
        axis_type = hints["axis"]
        permitted = set(get_args(axis_type))
        assert "structural-variety" in permitted, (
            f"Expected 'structural-variety' in JudgeFinding.axis Literal, "
            f"got {sorted(permitted)}"
        )


    def test_rubric_md_documents_structural_variety_axis():
        """MEL-04: rubric.md has a 'structural-variety' axis section under Evaluation Axes."""
        rubric_path = (
            Path(__file__).resolve().parents[2]
            / "src" / "eisenbalm_pipeline" / "agents" / "qa" / "rubric.md"
        )
        text = rubric_path.read_text(encoding="utf-8")
        assert "structural-variety" in text, (
            "rubric.md must document the 'structural-variety' axis"
        )
        # Severity guidance: this axis uses 'warning' (not 'error') per CONTEXT D-05
        # — confirm a warning-severity reference appears in the axis section.
        # Find the section header and check the following ~10 lines mention 'warning'.
        idx = text.find("structural-variety")
        nearby = text[idx:idx + 600]
        assert "warning" in nearby.lower(), (
            "rubric.md must indicate severity='warning' for structural-variety axis "
            "(per CONTEXT D-05 — Phase 5 D-02 keeps QA annotation-only)"
        )
    ```

    Create `packages/pipeline/tests/agents/test_bonus_specad_only.py` with this EXACT content:

    ```python
    """Phase 18 MEL-08 — Bonus structural-floor applies ONLY to specAd branch.

    Asserts:
      1. SpecAdBonus has the _enforce_structural_floor validator on its body field
      2. BigBudgetBonus does NOT have the validator (body stays str — D-04)
      3. JingleBonus does NOT have the validator (body stays str — D-04)

    SpecAd assertion is RED at commit (Wave 0); turns GREEN after Plan 18-04.
    BigBudget/Jingle assertions are GREEN at commit and STAY GREEN — they assert
    an ABSENCE, which is the pre-Phase-18 state and the post-Phase-18 state.

    Source: CONTEXT.md D-04; RESEARCH §phase_requirements MEL-08.
    """
    from __future__ import annotations

    from eisenbalm_pipeline.agents.bonus import (
        BigBudgetBonus,
        JingleBonus,
        SpecAdBonus,
    )


    def _has_body_field_validator(cls) -> bool:
        """Return True iff the Pydantic class has a validator named '_enforce_structural_floor'
        registered on the 'body' field (Pydantic v2 decorator info lives in
        __pydantic_decorators__.field_validators)."""
        decorators = getattr(cls, "__pydantic_decorators__", None)
        if decorators is None:
            return False
        field_validators = getattr(decorators, "field_validators", {})
        for name, info in field_validators.items():
            # name is the function name; info.info.fields is the tuple of field names
            if name == "_enforce_structural_floor":
                fields = getattr(info.info, "fields", ())
                if "body" in fields:
                    return True
        return False


    def test_specad_bonus_has_structural_floor_validator():
        """MEL-08 (positive): SpecAdBonus enforces the structural floor on body."""
        assert _has_body_field_validator(SpecAdBonus), (
            "SpecAdBonus.body MUST have @field_validator('body') named "
            "_enforce_structural_floor (CONTEXT D-02 + D-04)"
        )


    def test_big_budget_bonus_has_no_structural_floor():
        """MEL-08 (negative): BigBudgetBonus body stays str — D-04 carve-out."""
        assert not _has_body_field_validator(BigBudgetBonus), (
            "BigBudgetBonus must NOT carry the structural-floor validator — "
            "its body remains str; visual variety comes from storyboards[] (D-04)"
        )


    def test_jingle_bonus_has_no_structural_floor():
        """MEL-08 (negative): JingleBonus body stays str — D-04 carve-out."""
        assert not _has_body_field_validator(JingleBonus), (
            "JingleBonus must NOT carry the structural-floor validator — "
            "its body remains str; visual variety comes from lyrics + sunoPrompt (D-04)"
        )
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py tests/agents/test_bonus_specad_only.py --collect-only -q 2>&1 | grep -c "::test_"</automated>
  </verify>
  <acceptance_criteria>
    - Both files exist
    - `cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py --collect-only -q 2>&1 | grep -c "::test_"` returns `2`
    - `cd packages/pipeline && uv run pytest tests/agents/test_bonus_specad_only.py --collect-only -q 2>&1 | grep -c "::test_"` returns `3`
    - `cd packages/pipeline && uv run pytest tests/agents/test_qa_structural_axis.py -x 2>&1 | grep -E "FAILED.*test_judge_finding_axis_includes_structural_variety|AssertionError"` produces at least one match (RED at Wave 0)
    - `cd packages/pipeline && uv run pytest tests/agents/test_bonus_specad_only.py::test_specad_bonus_has_structural_floor_validator -x 2>&1 | grep -E "FAILED|AssertionError"` produces at least one match (RED at Wave 0 — SpecAdBonus doesn't have the validator yet)
    - `cd packages/pipeline && uv run pytest tests/agents/test_bonus_specad_only.py::test_big_budget_bonus_has_no_structural_floor -x 2>&1 | grep -E "passed|PASSED"` produces a match (GREEN at Wave 0 — asserts absence, which is the current state)
    - `grep "@pytest.mark.skip" packages/pipeline/tests/agents/test_qa_structural_axis.py packages/pipeline/tests/agents/test_bonus_specad_only.py` produces NO matches
  </acceptance_criteria>
  <done>
    test_qa_structural_axis.py: 2 RED tests (judge Literal + rubric.md axis); test_bonus_specad_only.py: 1 RED test (SpecAd has validator) + 2 GREEN tests (BigBudget/Jingle absence assertion).
  </done>
</task>

<task type="auto">
  <name>Task 3: Create test_portable_text_blocks.py (helpers substrate — MEL-01 + MEL-02 lib layer)</name>
  <files>packages/pipeline/tests/lib/test_portable_text_blocks.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (current 40-line helper — the new builders follow the same `_type: 'block'` + `_key: f'block-{uuid.uuid4().hex[:8]}'` + markDefs + single-span pattern)
    - packages/pipeline/tests/lib/test_voice.py (existing lib-test pattern — import + assertion shape)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md §Pattern 3 (exact compose_section_body dispatch logic)
  </read_first>
  <action>
    Create `packages/pipeline/tests/lib/test_portable_text_blocks.py` with this EXACT content:

    ```python
    """Phase 18 lib-layer — block builders + compose_section_body RED tests.

    Asserts:
      - block_paragraph emits style='normal'
      - block_h2 emits style='h2'
      - block_h3 emits style='h3'
      - block_blockquote emits style='blockquote'
      - Every block has unique _key + _type='block' + markDefs=[] + single span
      - compose_section_body dispatches list[dict] inputs to the right builder
      - compose_section_body accepts attr-style Pydantic instances too (defensive)

    RED at commit (Wave 0); turns GREEN after Plan 18-03 ships the helpers.

    Source: RESEARCH §Pattern 3.
    """
    from __future__ import annotations

    from eisenbalm_pipeline.lib.portable_text import (
        block_blockquote,
        block_h2,
        block_h3,
        block_paragraph,
        compose_section_body,
    )


    def _assert_block_shape(block: dict, expected_style: str, expected_text: str) -> None:
        assert block["_type"] == "block"
        assert block["style"] == expected_style
        assert block["markDefs"] == []
        assert block["_key"].startswith("block-")
        children = block["children"]
        assert len(children) == 1
        span = children[0]
        assert span["_type"] == "span"
        assert span["_key"].startswith("span-")
        assert span["text"] == expected_text
        assert span["marks"] == []


    def test_block_paragraph_shape():
        b = block_paragraph("Hello.")
        _assert_block_shape(b, "normal", "Hello.")


    def test_block_h2_shape():
        b = block_h2("First movement")
        _assert_block_shape(b, "h2", "First movement")


    def test_block_h3_shape():
        b = block_h3("Sub-point")
        _assert_block_shape(b, "h3", "Sub-point")


    def test_block_blockquote_shape():
        b = block_blockquote("The silence is the product.")
        _assert_block_shape(b, "blockquote", "The silence is the product.")


    def test_unique_keys_across_blocks():
        """Sanity Studio renders blank for duplicate _keys — each block must be unique."""
        blocks = [block_paragraph(f"p{i}") for i in range(10)]
        keys = [b["_key"] for b in blocks]
        assert len(set(keys)) == 10


    def test_compose_section_body_dispatches_dict_input():
        """The production path: writer Pydantic emits list[dict] via model_dump()."""
        blocks_input = [
            {"type": "paragraph", "text": "p1"},
            {"type": "h2",        "text": "h2a"},
            {"type": "blockquote","text": "q1"},
            {"type": "h3",        "text": "h3a"},
            {"type": "paragraph", "text": "p2"},
        ]
        out = compose_section_body(blocks_input)
        assert len(out) == 5
        assert [b["style"] for b in out] == ["normal", "h2", "blockquote", "h3", "normal"]
        assert [b["children"][0]["text"] for b in out] == ["p1", "h2a", "q1", "h3a", "p2"]


    def test_compose_section_body_unknown_type_falls_back_to_paragraph():
        """Defensive: unknown 'type' value coerces to paragraph (style='normal')."""
        out = compose_section_body([{"type": "weirdtype", "text": "x"}])
        assert out[0]["style"] == "normal"
        assert out[0]["children"][0]["text"] == "x"


    def test_compose_section_body_attr_style_input():
        """Defensive: accept Pydantic-instance-style inputs (attr access on .type/.text)."""

        class FakeBlock:
            def __init__(self, type_: str, text: str):
                self.type = type_
                self.text = text

        out = compose_section_body([
            FakeBlock("h2", "movement"),
            FakeBlock("paragraph", "prose"),
        ])
        assert out[0]["style"] == "h2"
        assert out[1]["style"] == "normal"


    def test_compose_section_body_empty_input():
        assert compose_section_body([]) == []
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py --collect-only -q 2>&1 | grep -c "::test_"</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `packages/pipeline/tests/lib/test_portable_text_blocks.py`
    - `cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py --collect-only -q 2>&1 | grep -c "::test_"` returns `9`
    - `cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py -x 2>&1 | grep -E "ImportError|cannot import name" | head -1` produces at least one match (RED at Wave 0 — block_h2/h3/blockquote/paragraph/compose_section_body don't exist in portable_text.py yet)
    - `grep "@pytest.mark.skip" packages/pipeline/tests/lib/test_portable_text_blocks.py` produces NO matches
    - `grep -c "from eisenbalm_pipeline.lib.portable_text import" packages/pipeline/tests/lib/test_portable_text_blocks.py` returns `1`
    - All 5 helper names appear in the import: `grep "block_blockquote\|block_h2\|block_h3\|block_paragraph\|compose_section_body" packages/pipeline/tests/lib/test_portable_text_blocks.py | head -1` returns the import line containing all 5
  </acceptance_criteria>
  <done>
    test_portable_text_blocks.py: 9 RED tests — 4 shape tests + 1 unique-keys + 4 compose_section_body behaviors. Fails ImportError at Wave 0 because the helpers don't exist yet; turns green after Plan 18-03.
  </done>
</task>

</tasks>

<verification>
- `find packages/pipeline/tests/agents/test_writer_structural_floor.py packages/pipeline/tests/agents/test_qa_structural_axis.py packages/pipeline/tests/agents/test_bonus_specad_only.py packages/pipeline/tests/lib/test_portable_text_blocks.py -type f | wc -l` returns `4`
- `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py tests/agents/test_qa_structural_axis.py tests/agents/test_bonus_specad_only.py tests/lib/test_portable_text_blocks.py --collect-only -q 2>&1 | grep -E "(34 tests|31 tests|test_)" | head -3` — collection succeeds (counts ≥ 34: 20 + 2 + 3 + 9)
- `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py tests/agents/test_qa_structural_axis.py tests/agents/test_bonus_specad_only.py tests/lib/test_portable_text_blocks.py 2>&1 | tail -5 | grep -E "failed|passed"` shows mixed results (most fail RED; the 2 BigBudget/Jingle absence assertions pass GREEN)
- The pre-existing pipeline test suite count is unchanged for tests OTHER than the 4 new files: `cd packages/pipeline && uv run pytest -x -q --ignore=tests/agents/test_writer_structural_floor.py --ignore=tests/agents/test_qa_structural_axis.py --ignore=tests/agents/test_bonus_specad_only.py --ignore=tests/lib/test_portable_text_blocks.py --collect-only 2>&1 | tail -1` matches the Phase 16 baseline collection count
</verification>

<success_criteria>
- 4 new pytest files exist at the paths in `files_modified`
- Collection succeeds for all 4 files (no SyntaxError, no ImportError at the test file's top — though import errors at the asserted-surface level are EXPECTED and SUPPOSED to happen for Plan 18-03's symbols)
- Test count: writer_structural_floor=20, qa_structural_axis=2, bonus_specad_only=3, portable_text_blocks=9 → total 34 new tests
- At Wave 0 commit: 23 of the 34 tests fail RED (writer_structural_floor 20 + qa_structural_axis 2 + bonus_specad_only 1 specad-positive); 11 fail differently (portable_text_blocks 9 fail ImportError; bonus_specad_only 2 pass GREEN — absence assertions)
- No `@pytest.mark.skip` decorator anywhere in the 4 new files (RED-first; not skip-first)
- Pre-existing test suite count for OTHER files is unchanged (no collateral collection breakage)
</success_criteria>

<output>
After completion, create `.planning/phases/18-magazine-editorial-layout-writers/18-02-SUMMARY.md`
summarizing: test file paths + test counts per file, the RED/GREEN matrix at Wave 0 commit
(which tests fail because of which missing production symbol — drives Wave 1/2/3 ordering),
and confirmation that no existing test was modified.
</output>
