---
phase: 18-magazine-editorial-layout-writers
plan: 03
type: execute
wave: 1
depends_on: [18-01, 18-02]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
autonomous: true
requirements: [MEL-01, MEL-02]

must_haves:
  truths:
    - "lib/portable_text.py exposes block_paragraph, block_h2, block_h3, block_blockquote, compose_section_body"
    - "graph/blocks.py exposes Paragraph, Heading, Blockquote Pydantic classes and the BodyBlock discriminated union"
    - "graph/state.py SectionContent.body, CaseStudyContent.body, BonusContent.body all typed list[dict] (was str)"
    - "All 9 tests in test_portable_text_blocks.py turn GREEN at this plan's completion"
    - "test_to_portable_text remains importable and functional (tombstone for BigBudget/Jingle + stubs)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py"
      provides: "4 new block builders + compose_section_body dispatch serializer"
      contains: "compose_section_body"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py"
      provides: "Shared Pydantic discriminated-union BodyBlock for all 5 long-read writers"
      contains: "BodyBlock"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "TypedDict body fields re-typed to list[dict]"
      contains: "body: list[dict]"
  key_links:
    - from: "lib/portable_text.compose_section_body"
      to: "lib/sanity_client.py call sites (rewired in Plan 18-04)"
      via: "Python function import"
      pattern: "from eisenbalm_pipeline.lib.portable_text import compose_section_body"
    - from: "graph/blocks.BodyBlock"
      to: "agents/{origin_story,problem,founder_bio,case_study,bonus}.py writer Pydantic models (re-typed in Plan 18-04)"
      via: "Python type import"
      pattern: "from eisenbalm_pipeline.graph.blocks import BodyBlock"
---

<objective>
Build the lib + state-layer substrate that Plans 18-04 / 18-05 / 18-06 consume.

1. Extend `lib/portable_text.py` with 4 new block builders + `compose_section_body` serializer
   (RESEARCH §Pattern 3). Keep `text_to_portable_text` as a tombstone — BigBudget/Jingle bonus
   branches + stub-mode fixtures still call it.
2. Create `graph/blocks.py` with the shared `BodyBlock` discriminated union (RESEARCH §Pattern 1).
   Five writers import from one place — no drift risk.
3. Re-type `graph/state.py` body fields from `str` to `list[dict]` (TypedDict can't express
   the discriminated union; Pydantic layer at each writer enforces shape).

Purpose: All 9 Plan 18-02 portable_text helper tests turn GREEN. Writer Pydantic schemas in
Plan 18-04 can `from eisenbalm_pipeline.graph.blocks import BodyBlock` without circular imports.
Output: 3 modified/created Python files; pytest collection succeeds on all existing tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py

<interfaces>
<!-- Verbatim from RESEARCH §Pattern 3 — block builders -->
<!-- Verbatim from RESEARCH §Pattern 1 — BodyBlock discriminated union -->

Current portable_text.py (40 lines — text_to_portable_text only):
```python
import uuid

def text_to_portable_text(text: str) -> list[dict]:
    paragraphs = [p.strip() for p in text.strip().split('\n\n') if p.strip()]
    return [
        {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'normal',
            'markDefs': [],
            'children': [{'_type': 'span', '_key': f'span-{uuid.uuid4().hex[:8]}', 'text': para, 'marks': []}],
        }
        for para in paragraphs
    ]
```

Pydantic v2.13.4 discriminator syntax (RESEARCH §Standard Stack):
```python
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field

BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
```

Current state.py TypedDicts (lines 80-99 — SectionContent, CaseStudyContent, BonusContent — all currently `body: str`):
```python
class SectionContent(TypedDict):
    headline: str
    body: str                           # plain text, paragraphs separated by \n\n

class CaseStudyContent(TypedDict):
    subjectName: str
    headline: str
    body: str

class BonusContent(TypedDict):
    headline: str
    body: str
    lyrics: Optional[str]               # jingle only
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend lib/portable_text.py with 4 block builders + compose_section_body</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (full current 40-line file — match the existing _key/_type/markDefs/single-span pattern verbatim)
    - packages/pipeline/tests/lib/test_portable_text_blocks.py (Plan 18-02 — the 9 RED tests that must turn GREEN; they encode the expected helper signatures + dispatch behavior)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md §Pattern 3 (exact builder code)
  </read_first>
  <behavior>
    - `block_paragraph(text: str) -> dict` returns a Sanity Portable Text block with `style: "normal"`, single span containing `text`
    - `block_h2(text: str) -> dict` returns a block with `style: "h2"`, single span
    - `block_h3(text: str) -> dict` returns a block with `style: "h3"`, single span
    - `block_blockquote(text: str) -> dict` returns a block with `style: "blockquote"`, single span
    - All 4 builders share the same structure: `_type='block'`, unique `_key='block-{8hex}'`, `markDefs=[]`, single span with `_type='span'`, unique `_key='span-{8hex}'`, `marks=[]`
    - `compose_section_body(blocks: list[dict]) -> list[dict]` iterates the input, dispatches each block on its `type` field (or `.type` attribute for Pydantic-instance inputs), routes to the matching builder, returns the list of Sanity Portable Text dicts
    - Unknown `type` values fall back to `block_paragraph` (defensive)
    - Empty input returns empty list
    - `text_to_portable_text` is UNCHANGED — remains in the module as a tombstone
  </behavior>
  <action>
    APPEND to the existing `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` (do NOT
    delete `text_to_portable_text` — D-04 says BigBudget/Jingle bonus branches + stub fixtures
    still need it; Claude's Discretion in CONTEXT.md recommends keeping it as a deprecation
    tombstone). Add this EXACT code after the existing function:

    ```python


    # ────────────────────────────────────────────────────────────────────────
    # Phase 18: typed block builders + compose_section_body serializer
    #
    # Source: docs/API_CONTRACTS.md §2.4 + CONTEXT D-01 + RESEARCH §Pattern 3.
    #
    # Long-read writer Pydantic models emit list[BodyBlock] (discriminated union
    # over Paragraph | Heading | Blockquote — see graph/blocks.py). The Sanity
    # write path in lib/sanity_client.py calls compose_section_body(body_blocks)
    # which dispatches each block on its `type` field to the matching builder.
    #
    # `text_to_portable_text` (above) stays in this module as a tombstone:
    #   - BigBudgetBonus.body remains str (D-04 — visual variety from storyboards[])
    #   - JingleBonus.body remains str (D-04 — visual variety from lyrics+sunoPrompt)
    #   - Stub fixtures may still emit body: str until Plan 18-06 updates them
    # ────────────────────────────────────────────────────────────────────────


    def block_paragraph(text: str) -> dict:
        """Emit one Sanity Portable Text block with style='normal'."""
        return {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'normal',
            'markDefs': [],
            'children': [
                {
                    '_type': 'span',
                    '_key': f'span-{uuid.uuid4().hex[:8]}',
                    'text': text,
                    'marks': [],
                }
            ],
        }


    def block_h2(text: str) -> dict:
        """Emit one Sanity Portable Text block with style='h2' (sub-header)."""
        return {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'h2',
            'markDefs': [],
            'children': [
                {
                    '_type': 'span',
                    '_key': f'span-{uuid.uuid4().hex[:8]}',
                    'text': text,
                    'marks': [],
                }
            ],
        }


    def block_h3(text: str) -> dict:
        """Emit one Sanity Portable Text block with style='h3' (nested sub-header)."""
        return {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'h3',
            'markDefs': [],
            'children': [
                {
                    '_type': 'span',
                    '_key': f'span-{uuid.uuid4().hex[:8]}',
                    'text': text,
                    'marks': [],
                }
            ],
        }


    def block_blockquote(text: str) -> dict:
        """Emit one Sanity Portable Text block with style='blockquote' (pull-quote)."""
        return {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'blockquote',
            'markDefs': [],
            'children': [
                {
                    '_type': 'span',
                    '_key': f'span-{uuid.uuid4().hex[:8]}',
                    'text': text,
                    'marks': [],
                }
            ],
        }


    def compose_section_body(blocks: list) -> list[dict]:
        """Dispatch a list of typed body blocks to the matching Portable Text builder.

        Args:
            blocks: A list whose elements are either:
              - dicts with 'type' and 'text' keys (production path: writer Pydantic
                model_dump() output), OR
              - Pydantic instances with .type and .text attributes (defensive path:
                tests / direct agent calls).

            Block 'type' values map to builders:
              - 'h2'         -> block_h2
              - 'h3'         -> block_h3
              - 'blockquote' -> block_blockquote
              - 'paragraph'  -> block_paragraph (default for any unknown type)

        Returns:
            A list of Sanity Portable Text block dicts ready to write to Sanity.
        """
        result: list[dict] = []
        for b in blocks:
            if isinstance(b, dict):
                t = b.get('type')
                text = b.get('text', '')
            else:
                t = getattr(b, 'type', None)
                text = getattr(b, 'text', '')
            if t == 'h2':
                result.append(block_h2(text))
            elif t == 'h3':
                result.append(block_h3(text))
            elif t == 'blockquote':
                result.append(block_blockquote(text))
            else:
                # 'paragraph', None, or any unknown value falls back to paragraph
                result.append(block_paragraph(text))
        return result
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py -x -q 2>&1 | tail -3` shows `9 passed` (all 9 RED tests now GREEN)
    - `grep -c "^def block_paragraph\|^def block_h2\|^def block_h3\|^def block_blockquote\|^def compose_section_body" packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` returns `5`
    - `grep -c "^def text_to_portable_text" packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` returns `1` (tombstone preserved)
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.portable_text import block_paragraph, block_h2, block_h3, block_blockquote, compose_section_body, text_to_portable_text; print('OK')"` prints `OK`
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.portable_text import compose_section_body; print(compose_section_body([{'type':'h2','text':'X'}])[0]['style'])"` prints `h2`
  </acceptance_criteria>
  <done>
    portable_text.py contains 5 functions (text_to_portable_text + 4 new builders + compose_section_body); all 9 Plan 18-02 lib tests pass; text_to_portable_text tombstone preserved.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create graph/blocks.py with shared BodyBlock discriminated union</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (full file — confirms `from __future__ import annotations` style + import patterns; the new blocks.py mirrors)
    - packages/pipeline/pyproject.toml (verify `pydantic==2.13.4` pin — the `Field(discriminator='type')` syntax is stable from v2.0+)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md §Pattern 1 (verbatim BodyBlock code)
  </read_first>
  <behavior>
    - `Paragraph` is a Pydantic BaseModel with `type: Literal['paragraph']` (default 'paragraph') and `text: str = ""`
    - `Heading` is a Pydantic BaseModel with `type: Literal['h2', 'h3']` (multi-value Literal — no default) and `text: str = ""`
    - `Blockquote` is a Pydantic BaseModel with `type: Literal['blockquote']` (default 'blockquote') and `text: str = ""`
    - `BodyBlock` is `Annotated[Union[Paragraph, Heading, Blockquote], Field(discriminator='type')]`
    - Importing all 4 symbols (`Paragraph`, `Heading`, `Blockquote`, `BodyBlock`) from `eisenbalm_pipeline.graph.blocks` succeeds at module load
    - Parsing `{"type": "h2", "text": "X"}` via a Pydantic model that has `body: list[BodyBlock]` produces a `Heading` instance, not a `Paragraph`
  </behavior>
  <action>
    Create a NEW file `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` with this EXACT content:

    ```python
    """Phase 18 — shared BodyBlock discriminated union for long-read writer schemas.

    All five long-read writer response models (OriginStoryOutput, ProblemOutput,
    FounderBioOutput, CaseStudyOutput, SpecAdBonus) import BodyBlock from here.
    One definition, five consumers — no drift risk.

    Used by: agents/{origin_story,problem,founder_bio,case_study,bonus}.py
    Serialized by: lib/portable_text.compose_section_body
    Documented in: docs/API_CONTRACTS.md §7 + §2.4 + CONTEXT.md D-01.

    Pydantic v2.13.4 discriminator pattern; Literal['h2','h3'] is the multi-value
    discriminator on Heading. The Phase 13 chronicler turns module uses the same
    `Field(discriminator='type')` pattern (no drift from established codebase style).
    """
    from __future__ import annotations

    from typing import Annotated, Literal, Union

    from pydantic import BaseModel, Field


    class Paragraph(BaseModel):
        """Plain prose block — renders as <p> in Sanity Portable Text."""

        type: Literal['paragraph'] = 'paragraph'
        text: str = ""


    class Heading(BaseModel):
        """Sub-header block — renders as <h2> or <h3> in Sanity Portable Text.

        The writer picks h2 (top-level movement) or h3 (nested sub-point) per
        local hierarchy. Phase 18 structural floor counts both as "sub-headers".
        """

        type: Literal['h2', 'h3']
        text: str = ""


    class Blockquote(BaseModel):
        """Pull-quote block — renders as <blockquote> in Sanity Portable Text.

        Phase 18 requires every long-read section to lift ONE sentence from body
        prose into a blockquote. Editorial register; per CONTEXT D-05 the QA judge
        evaluates pull-quote authenticity (vs. generic restatement) qualitatively.
        """

        type: Literal['blockquote'] = 'blockquote'
        text: str = ""


    BodyBlock = Annotated[
        Union[Paragraph, Heading, Blockquote],
        Field(discriminator='type'),
    ]
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.blocks import Paragraph, Heading, Blockquote, BodyBlock; from pydantic import BaseModel; class _T(BaseModel): items: list[BodyBlock]; t = _T(items=[{'type':'h2','text':'X'}, {'type':'paragraph','text':'Y'}, {'type':'blockquote','text':'Z'}]); print(type(t.items[0]).__name__, type(t.items[1]).__name__, type(t.items[2]).__name__)"</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py`
    - `grep -c "^class Paragraph\|^class Heading\|^class Blockquote" packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` returns `3`
    - `grep -c "^BodyBlock = Annotated\[" packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` returns `1`
    - `grep "Field(discriminator='type')" packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` matches one line
    - `grep "Literal\['h2', 'h3'\]" packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` matches one line
    - Discriminator dispatch sanity check: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.blocks import BodyBlock; from pydantic import BaseModel, TypeAdapter; ta = TypeAdapter(list[BodyBlock]); items = ta.validate_python([{'type':'h2','text':'A'}, {'type':'paragraph','text':'B'}, {'type':'blockquote','text':'C'}]); print(type(items[0]).__name__, type(items[1]).__name__, type(items[2]).__name__)"` prints `Heading Paragraph Blockquote`
    - No new pip dependency: `cd packages/pipeline && uv pip show pydantic | grep Version` shows `Version: 2.13.4`
  </acceptance_criteria>
  <done>
    graph/blocks.py exists with Paragraph/Heading/Blockquote Pydantic classes and a discriminated-union BodyBlock; Pydantic correctly dispatches `{type: 'h2', ...}` to Heading (not Paragraph).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Re-type SectionContent.body / CaseStudyContent.body / BonusContent.body to list[dict] in graph/state.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py lines 80-99 (the three TypedDicts being modified — verify they still match the snapshot in CONTEXT.md)
    - docs/API_CONTRACTS.md §7 (Plan 18-01 amended this — the new declaration must match the doc)
  </read_first>
  <behavior>
    - `SectionContent.body` is typed `list[dict]` (was `str`)
    - `CaseStudyContent.body` is typed `list[dict]` (was `str`)
    - `BonusContent.body` is typed `list[dict]` (was `str`)
    - Inline comment on each line cites Phase 18 + cross-references the BodyBlock union in graph/blocks.py
    - NO other field is touched (lyrics, subjectName, headline, etc. preserved byte-equivalently)
    - All existing imports + the rest of `state.py` are unchanged
    - Module imports succeed without ImportError
  </behavior>
  <action>
    Open `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`. Locate the three TypedDict
    classes `SectionContent`, `CaseStudyContent`, `BonusContent` (lines ~80-99). For EACH of those
    three classes, change the `body` field declaration:

    - FROM: `body: str` (with its inline comment, e.g. `# plain text, paragraphs separated by \n\n`)
    - TO: `body: list[dict]                       # Phase 18 D-01: list[BodyBlock] (graph/blocks.py); Pydantic at each writer enforces shape`

    Concretely, replace these THREE lines (one per TypedDict). The exact target lines today are:

    ```python
    class SectionContent(TypedDict):
        headline: str
        body: str                           # plain text, paragraphs separated by \n\n
    ```
    becomes:
    ```python
    class SectionContent(TypedDict):
        headline: str
        body: list[dict]                    # Phase 18 D-01: list[BodyBlock] (graph/blocks.py); Pydantic at each writer enforces shape
    ```

    ```python
    class CaseStudyContent(TypedDict):
        subjectName: str
        headline: str
        body: str
    ```
    becomes:
    ```python
    class CaseStudyContent(TypedDict):
        subjectName: str
        headline: str
        body: list[dict]                    # Phase 18 D-01: list[BodyBlock] (graph/blocks.py); Pydantic at each writer enforces shape
    ```

    ```python
    class BonusContent(TypedDict):
        headline: str
        body: str
        lyrics: Optional[str]               # jingle only
    ```
    becomes:
    ```python
    class BonusContent(TypedDict):
        headline: str
        body: list[dict]                    # Phase 18 D-01: SpecAdBonus uses list[BodyBlock]; BigBudget/Jingle still str at writer-Pydantic layer (D-04); TypedDict permissive
        lyrics: Optional[str]               # jingle only
    ```

    DO NOT touch any other line in the file. DO NOT add a top-level import of `BodyBlock`
    into state.py — the TypedDicts use `list[dict]` (not `list[BodyBlock]`) because TypedDict
    cannot carry the discriminated union (CONTEXT D-01 explicit + RESEARCH §Architecture). The
    Pydantic layer at each writer enforces the actual `BodyBlock` shape.
  </action>
  <verify>
    <automated>grep -c "body: list\[dict\]" packages/pipeline/src/eisenbalm_pipeline/graph/state.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "body: list\[dict\]" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` returns `3` (SectionContent, CaseStudyContent, BonusContent)
    - The three modified lines all reference Phase 18: `grep -c "Phase 18 D-01" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` returns `3`
    - `grep "    body: str" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` produces NO matches inside the SectionContent/CaseStudyContent/BonusContent classes (verify the str declaration is gone for those three; OTHER fields like `headline: str` are untouched)
    - `grep -c "    headline: str" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` is unchanged from pre-plan baseline (preserves other TypedDict shapes)
    - Module imports succeed: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState, SectionContent, CaseStudyContent, BonusContent; print('OK')"` prints `OK`
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import SectionContent; import typing; print(typing.get_type_hints(SectionContent)['body'])"` prints `list[dict]`
    - Pre-existing test suite collection is unchanged: `cd packages/pipeline && uv run pytest --collect-only -q 2>&1 | tail -2` shows the same total count as pre-plan baseline + the 34 new tests from Plan 18-02
  </acceptance_criteria>
  <done>
    state.py three TypedDicts' body fields re-typed from str to list[dict] with Phase 18 D-01 inline comment; no other field touched; module imports clean.
  </done>
</task>

</tasks>

<verification>
- All 9 tests in `packages/pipeline/tests/lib/test_portable_text_blocks.py` GREEN: `cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py -q 2>&1 | tail -1` shows `9 passed`
- Pre-existing pipeline test suite stays green (no regression from re-typing): `cd packages/pipeline && uv run pytest --ignore=tests/agents/test_writer_structural_floor.py --ignore=tests/agents/test_qa_structural_axis.py --ignore=tests/agents/test_bonus_specad_only.py -q 2>&1 | tail -3` shows >= Phase 16 baseline passing
- Plan 18-02 RED tests for writer-floor and QA-axis still RED (Wave 2/3 will turn them green): `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py tests/agents/test_qa_structural_axis.py 2>&1 | tail -1` shows failing assertions (not collection errors)
- graph/blocks.py importable + BodyBlock discriminator works
- No new pip dependency: `git diff packages/pipeline/pyproject.toml` produces no output
</verification>

<success_criteria>
- 3 files modified/created with exact intended changes (portable_text.py extended, blocks.py created, state.py re-typed)
- Plan 18-02 lib tests (9) all GREEN
- Plan 18-02 writer-floor + QA-axis tests still RED (waiting on Plans 18-04 / 18-05)
- Existing pipeline pytest suite zero regression
- text_to_portable_text preserved as tombstone
- No circular import (graph/blocks.py imports nothing from agents/; agents/ will import from graph/blocks.py in Plan 18-04)
</success_criteria>

<output>
After completion, create `.planning/phases/18-magazine-editorial-layout-writers/18-03-SUMMARY.md`
summarizing: byte-count added to portable_text.py, the exact 3 lines changed in state.py, the
new blocks.py module byte count + symbol exports, and confirmation that all 9 lib tests turned
GREEN at this commit + writer/QA tests still RED.
</output>
