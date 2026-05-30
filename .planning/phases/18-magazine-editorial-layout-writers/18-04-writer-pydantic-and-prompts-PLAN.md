---
phase: 18-magazine-editorial-layout-writers
plan: 04
type: execute
wave: 2
depends_on: [18-03]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
autonomous: true
requirements: [MEL-01, MEL-02, MEL-03, MEL-08]

must_haves:
  truths:
    - "OriginStoryOutput, ProblemOutput, FounderBioOutput, CaseStudyOutput, SpecAdBonus all have body: list[BodyBlock] + _enforce_structural_floor validator"
    - "BigBudgetBonus and JingleBonus body fields remain str (D-04 carve-out)"
    - "SECTION_GUIDANCE in each of the 4 narrative writers gains a STRUCTURE_CONTRACT addendum"
    - "_build_spec_ad_prompt in bonus.py gains the STRUCTURE_CONTRACT addendum (BigBudget + Jingle prompts unchanged)"
    - "sanity_client.py rewires 4 long-read write call sites to compose_section_body; _build_bonus branches on bonusType (specAd uses compose_section_body, BigBudget/Jingle use text_to_portable_text)"
    - "All 20 tests in test_writer_structural_floor.py + the 1 SpecAd positive test in test_bonus_specad_only.py turn GREEN"
    - "ProblemOutput.pdfContent shape is byte-equivalent (D-03 — Phase 6 contract preserved)"
    - "test_section_writer_voice_propagation.py (Phase 16 NRR-04) stays green — STRUCTURE_CONTRACT in section_guidance does NOT regress the voice_constraints kwarg assertion"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py"
      provides: "OriginStoryOutput with list[BodyBlock] body + structural-floor validator + STRUCTURE_CONTRACT in SECTION_GUIDANCE"
      contains: "_enforce_structural_floor"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/problem.py"
      provides: "ProblemOutput.body re-typed + validator; pdfContent UNCHANGED (D-03)"
      contains: "_enforce_structural_floor"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py"
      provides: "FounderBioOutput re-typed + validator; both GUIDANCE_VERIFIED + GUIDANCE_ANONYMOUS gain STRUCTURE_CONTRACT"
      contains: "_enforce_structural_floor"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py"
      provides: "CaseStudyOutput re-typed + validator; both verified + anonymous guidance paths gain STRUCTURE_CONTRACT"
      contains: "_enforce_structural_floor"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py"
      provides: "SpecAdBonus re-typed + validator + _build_spec_ad_prompt addendum; BigBudgetBonus + JingleBonus untouched"
      contains: "_enforce_structural_floor"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "5 call sites rewired (originStory.body, problemStatement.body, founderBio.body, caseStudy.body, _build_bonus branched)"
      contains: "compose_section_body"
  key_links:
    - from: "agents/*.py writer Pydantic models"
      to: "graph/blocks.BodyBlock (created in Plan 18-03)"
      via: "import"
      pattern: "from eisenbalm_pipeline.graph.blocks import BodyBlock"
    - from: "lib/sanity_client.py write call sites"
      to: "lib/portable_text.compose_section_body (created in Plan 18-03)"
      via: "import + call"
      pattern: "compose_section_body\\("
    - from: "agents/bonus.py _build_bonus branch"
      to: "style_brief['bonusType']"
      via: "string equality check on 'specAd' vs. 'bigBudget'/'jingle'"
      pattern: "bonusType.*specAd"
---

<objective>
The core production change. Upgrade 5 long-read writer Pydantic schemas + their system prompts +
the Sanity write path to emit structured body blocks. This is the plan that activates the dead-coded
Phase 10 PortableTextRenderer h2/h3/blockquote primitives at the live URL.

Five writers can be modified in parallel within this single plan (each agent is its own file; no
inter-file dependencies among the 5 writers). The bonus.py change is scoped to the specAd branch
only — BigBudget and Jingle paths must remain byte-equivalent (D-04).

Purpose: Turn 20 RED tests in test_writer_structural_floor.py + 1 RED test in
test_bonus_specad_only.py::test_specad_bonus_has_structural_floor_validator GREEN.
Output: 6 modified Python files; the 5 long-read writers can now emit structured bodies;
sanity_client.py routes those structured bodies through compose_section_body to Sanity.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
@packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
@packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
@packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
@packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py

<interfaces>
<!-- The shared validator template (RESEARCH §Pattern 2 + CONTEXT D-02) — embed verbatim into each writer -->

```python
from pydantic import field_validator
from eisenbalm_pipeline.graph.blocks import BodyBlock

class <Writer>Output(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []
    # ... other fields unchanged ...

    @field_validator('body')
    @classmethod
    def _enforce_structural_floor(cls, body: list[BodyBlock]) -> list[BodyBlock]:
        heading_count = sum(1 for b in body if b.type in ('h2', 'h3'))
        blockquote_count = sum(1 for b in body if b.type == 'blockquote')
        if heading_count < 2:
            raise ValueError(
                f"structural-floor: need >=2 sub-headers, got {heading_count}"
            )
        if blockquote_count < 1:
            raise ValueError(
                f"structural-floor: need >=1 blockquote, got {blockquote_count}"
            )
        return body
```

<!-- STRUCTURE_CONTRACT addendum to each writer's SECTION_GUIDANCE (RESEARCH §Pattern 4) -->

```python
STRUCTURE_CONTRACT: str = (
    "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
    "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
    "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
    "movements. Blockquote: a single sentence lifted verbatim from the most "
    "quotable line in the body prose - not a generic restatement. "
    "Sub-headers and blockquote serve Jesse's register. "
    "Do not break voice; structural variety is typographic, not tonal."
)
```

<!-- Current writer body field declarations (Plan 18-03 already re-typed state.py, but writer Pydantic still uses str = "") -->
- agents/origin_story.py:47 — `body: str = ""`
- agents/problem.py:78 — `body: str = ""`
- agents/founder_bio.py:54 — `body: str = ""`
- agents/case_study.py:53 — `body: str = ""`
- agents/bonus.py:87 — SpecAdBonus `body: str = Field(...)`

<!-- BigBudget + Jingle to NOT touch (RESEARCH §source) -->
- agents/bonus.py:58 — BigBudgetBonus `body: str = Field(default="", description="200-400 words on concept")` UNCHANGED
- agents/bonus.py:69 — JingleBonus `body: str = Field(default="", description="100-200 words on concept")` UNCHANGED

<!-- sanity_client.py call sites (RESEARCH §Pitfall 5 — verified line numbers) -->
- Line 81 (`_build_bonus`): `text_to_portable_text(bonus.get("body", ""))` — must branch on bonusType
- Line 177 (`originStory.body`): `text_to_portable_text(...)` → `compose_section_body(...)`
- Line 183 (`problemStatement.body`): same rewire
- Line 195 (`founderBio.body`): same rewire
- Line 202 (`caseStudy.body`): same rewire
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Re-type 4 narrative writer Pydantic models + add STRUCTURE_CONTRACT to SECTION_GUIDANCE (origin_story, problem, founder_bio, case_study)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py, packages/pipeline/src/eisenbalm_pipeline/agents/problem.py, packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py, packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py (full file — see existing `SECTION_GUIDANCE: str = (...)` block + `OriginStoryOutput` class shape)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (full file — note `PdfContent._exactly_three` field_validator pattern is the same lane Phase 18 uses; pdfContent must stay UNCHANGED per D-03)
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py (full file — two guidance variants: `GUIDANCE_VERIFIED` + `GUIDANCE_ANONYMOUS`; both get STRUCTURE_CONTRACT)
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py (full file — also has verified + anonymous guidance paths; both get STRUCTURE_CONTRACT)
    - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py (Plan 18-03 — BodyBlock import target)
    - packages/pipeline/tests/test_section_writer_voice_propagation.py (Phase 16 NRR-04 — assertion is line 93: only `voice_constraints` kwarg is checked; STRUCTURE_CONTRACT in `section_guidance` does NOT regress this test per RESEARCH Pitfall 6)
  </read_first>
  <behavior>
    - Each of the 4 narrative writer modules:
      - Imports `BodyBlock` from `eisenbalm_pipeline.graph.blocks`
      - Imports `field_validator` from `pydantic`
      - Defines a module-level `STRUCTURE_CONTRACT: str = (...)` constant (the exact ≤120-word block — same wording across all 4 writers)
      - Appends `STRUCTURE_CONTRACT` to its existing `SECTION_GUIDANCE` string (founder_bio + case_study: appends to BOTH verified + anonymous variants)
      - Changes its writer Pydantic model's `body` field declaration from `str = ""` to `list[BodyBlock] = []`
      - Adds the `_enforce_structural_floor` `@field_validator('body')` classmethod (verbatim copy of the template)
    - ProblemOutput's `pdfContent` field stays byte-equivalent (D-03 — Phase 6 WeasyPrint contract preserved)
    - No agent function body (the actual `acomplete` call) is touched — only the schema + the SECTION_GUIDANCE string
    - test_section_writer_voice_propagation.py (Phase 16 NRR-04) stays GREEN
  </behavior>
  <action>
    For EACH of the 4 narrative writer modules (`origin_story.py`, `problem.py`, `founder_bio.py`,
    `case_study.py`), apply the following 4 edits IN ORDER:

    **EDIT 1 — Add imports** (top of file, in the existing import block):

    ```python
    from pydantic import BaseModel, field_validator   # may already import BaseModel; add field_validator
    from eisenbalm_pipeline.graph.blocks import BodyBlock
    ```

    (If the file already imports `BaseModel` or `Field` from pydantic, MERGE `field_validator` into
    the same import statement rather than adding a duplicate line. If the file already imports
    `field_validator` for another validator — e.g. `problem.py`'s `_exactly_three` — no new import
    needed; just verify the import exists.)

    **EDIT 2 — Add module-level STRUCTURE_CONTRACT constant** immediately ABOVE the existing
    `SECTION_GUIDANCE: str = (...)` declaration (or `GUIDANCE_VERIFIED` for founder_bio/case_study):

    ```python
    # Phase 18 D-01/D-02 — appended to SECTION_GUIDANCE (and to GUIDANCE_VERIFIED /
    # GUIDANCE_ANONYMOUS variants for founder_bio + case_study). Encodes the structural
    # floor at the prompt layer; the Pydantic _enforce_structural_floor validator below
    # is the hard gate (retries once via the existing acomplete path on failure).
    STRUCTURE_CONTRACT: str = (
        "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
        "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
        "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
        "movements. Blockquote: a single sentence lifted verbatim from the most "
        "quotable line in the body prose - not a generic restatement. "
        "Sub-headers and blockquote serve Jesse's register. "
        "Do not break voice; structural variety is typographic, not tonal."
    )
    ```

    **EDIT 3 — Append STRUCTURE_CONTRACT to the existing guidance string(s)**:

    For `origin_story.py` and `problem.py` (single SECTION_GUIDANCE):
    ```python
    # AFTER the existing SECTION_GUIDANCE assignment, add:
    SECTION_GUIDANCE = SECTION_GUIDANCE + STRUCTURE_CONTRACT
    ```

    For `founder_bio.py` and `case_study.py` (two guidance variants — verified + anonymous):
    ```python
    # AFTER each of the two existing guidance string assignments, add:
    GUIDANCE_VERIFIED = GUIDANCE_VERIFIED + STRUCTURE_CONTRACT
    GUIDANCE_ANONYMOUS = GUIDANCE_ANONYMOUS + STRUCTURE_CONTRACT
    ```

    (Use the actual variable names from each file. If founder_bio.py / case_study.py use
    different identifiers — e.g. `GUIDANCE_NAMED_FOUNDER` — preserve the actual names verbatim.
    Read the file before this edit to confirm.)

    **EDIT 4 — Re-type body field + add structural-floor validator** on the writer's response
    Pydantic class:

    For `origin_story.py` — `OriginStoryOutput`:
    ```python
    class OriginStoryOutput(BaseModel):
        headline: str = ""
        body: list[BodyBlock] = []     # Phase 18 D-01 (was: body: str = "")

        @field_validator('body')
        @classmethod
        def _enforce_structural_floor(cls, body: list[BodyBlock]) -> list[BodyBlock]:
            heading_count = sum(1 for b in body if b.type in ('h2', 'h3'))
            blockquote_count = sum(1 for b in body if b.type == 'blockquote')
            if heading_count < 2:
                raise ValueError(
                    f"structural-floor: need >=2 sub-headers, got {heading_count}"
                )
            if blockquote_count < 1:
                raise ValueError(
                    f"structural-floor: need >=1 blockquote, got {blockquote_count}"
                )
            return body
    ```

    For `problem.py` — `ProblemOutput`. Apply the same body re-type + validator. CRITICAL:
    `pdfContent: PdfContent = Field(default_factory=PdfContent)` stays UNCHANGED (D-03 — Phase 6
    WeasyPrint contract; the existing `PdfContent._exactly_three` validator stays intact). The
    new `_enforce_structural_floor` validator is added ALONGSIDE the existing `_exactly_three`
    (one on `body`, the other on `pdfContent.keyDataPoints`).

    For `founder_bio.py` — `FounderBioOutput`: same body re-type + validator. Other fields
    (`headline`, etc.) preserved.

    For `case_study.py` — `CaseStudyOutput`: same body re-type + validator. Other fields
    (`subjectName`, `headline`, etc.) preserved.

    DO NOT modify the agent function body (the actual `acomplete` call site). DO NOT change
    `build_section_writer_prompt` signature — Phase 5 D-13 locks it; the STRUCTURE_CONTRACT
    is threaded via the `section_guidance` kwarg's string value (Plan-level read-first
    confirms this).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py tests/test_section_writer_voice_propagation.py -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "_enforce_structural_floor" packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` returns >= 1
    - `grep -c "_enforce_structural_floor" packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` returns >= 1
    - `grep -c "_enforce_structural_floor" packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` returns >= 1
    - `grep -c "_enforce_structural_floor" packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` returns >= 1
    - `grep -c "STRUCTURE_CONTRACT" packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py packages/pipeline/src/eisenbalm_pipeline/agents/problem.py packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` returns >= 12 (each file: constant declaration + at least one append + 1 mention in docstring/comment — adjust threshold if a leaner pattern is used; minimum is 8)
    - `grep -c "body: list\[BodyBlock\]" packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py packages/pipeline/src/eisenbalm_pipeline/agents/problem.py packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` returns `4`
    - `grep -c "from eisenbalm_pipeline.graph.blocks import BodyBlock" packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py packages/pipeline/src/eisenbalm_pipeline/agents/problem.py packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` returns `4`
    - pdfContent UNTOUCHED in problem.py: `grep -c "pdfContent: PdfContent = Field(default_factory=PdfContent)" packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` returns `1` (same as pre-plan baseline)
    - `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -x -q 2>&1 | tail -1` shows at least 16 passed (4 narrative writers × 4 test functions = 16; the 5th writer SpecAd is Task 2's job; partial GREEN here is acceptable)
    - `cd packages/pipeline && uv run pytest tests/test_section_writer_voice_propagation.py -x -q 2>&1 | tail -1` shows `passed` (Phase 16 NRR-04 byte-equivalence preserved)
    - Module imports succeed: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.origin_story import OriginStoryOutput, STRUCTURE_CONTRACT, SECTION_GUIDANCE; from eisenbalm_pipeline.agents.problem import ProblemOutput; from eisenbalm_pipeline.agents.founder_bio import FounderBioOutput; from eisenbalm_pipeline.agents.case_study import CaseStudyOutput; print('OK')"` prints `OK`
  </acceptance_criteria>
  <done>
    4 narrative writer Pydantic models re-typed body + validator added; 4 SECTION_GUIDANCE strings (+ the 2 anonymous variants in founder_bio + case_study) have STRUCTURE_CONTRACT appended; pdfContent untouched; voice-propagation test green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Re-type SpecAdBonus + add STRUCTURE_CONTRACT to _build_spec_ad_prompt — BigBudget + Jingle UNTOUCHED</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py (full file — three branches: BigBudgetBonus lines 54-63, JingleBonus lines 65-72, SpecAdBonus lines 83-92; three prompt builders: _build_big_budget_prompt, _build_jingle_prompt, _build_spec_ad_prompt; main agent body lines 180-230 routes on style_brief["bonusType"])
    - .planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md D-04 (specAd-only carve-out is non-negotiable)
    - packages/pipeline/tests/agents/test_bonus_specad_only.py (Plan 18-02 — 3 tests; SpecAd positive turns GREEN this task, BigBudget/Jingle negative tests must STAY GREEN)
    - packages/pipeline/tests/agents/test_bonus.py (existing per-agent test — must stay green)
  </read_first>
  <behavior>
    - `SpecAdBonus.body` field is re-typed from `str = Field(...)` to `list[BodyBlock] = []`
    - `SpecAdBonus` gains the `_enforce_structural_floor` validator (same template as Task 1)
    - `BigBudgetBonus.body` and `JingleBonus.body` remain `str = Field(default="", description="...")` BYTE-UNCHANGED
    - `_build_spec_ad_prompt` gains a STRUCTURE_CONTRACT addendum (in the system or user message body)
    - `_build_big_budget_prompt` and `_build_jingle_prompt` are BYTE-UNCHANGED
    - The agent function body (the `acomplete` call routing on `bonus_type`) is UNCHANGED
    - test_bonus_specad_only.py: SpecAd positive test turns GREEN; BigBudget + Jingle negative tests stay GREEN
    - test_bonus.py: existing assertions stay GREEN
  </behavior>
  <action>
    Open `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`.

    **EDIT 1 — Add imports** (top-of-file import block):
    ```python
    from pydantic import BaseModel, Field, field_validator   # add field_validator if not already
    from eisenbalm_pipeline.graph.blocks import BodyBlock     # NEW import
    ```

    **EDIT 2 — Add module-level STRUCTURE_CONTRACT constant** above the existing prompt builder
    functions (recommended placement: just before `_build_big_budget_prompt`):
    ```python
    # Phase 18 D-04 — appended to _build_spec_ad_prompt ONLY.
    # _build_big_budget_prompt + _build_jingle_prompt are BYTE-UNCHANGED — their structured
    # outputs (storyboards[] for BigBudget, lyrics+sunoPrompt for Jingle) already break the
    # visual rhythm; the Phase 18 wall-of-text fix targets ONLY narrative prose bodies.
    STRUCTURE_CONTRACT: str = (
        "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
        "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
        "Sub-headers: <=6 words, Jesse-voice, break the body into 3+ logical "
        "movements. Blockquote: a single sentence lifted verbatim from the most "
        "quotable line in the body prose - not a generic restatement. "
        "Sub-headers and blockquote serve Jesse's register. "
        "Do not break voice; structural variety is typographic, not tonal."
    )
    ```

    **EDIT 3 — Modify `_build_spec_ad_prompt` to include STRUCTURE_CONTRACT**. The current
    function constructs a list of message dicts and ends with a "Return JSON SpecAdBonus." line.
    Append `STRUCTURE_CONTRACT` to whichever message string communicates section guidance
    (typically the system or first user message). The minimal edit is to append it to the
    existing instruction string before the "Return JSON SpecAdBonus." closer:

    ```python
    def _build_spec_ad_prompt(charity: dict, style_brief: dict) -> list[dict[str, str]]:
        # ... existing prefix and main prompt construction unchanged ...
        # Locate the existing "system" or instruction message content string;
        # concatenate STRUCTURE_CONTRACT to it. Example pattern (adjust to the
        # actual local variable name used in the current function):
        system_content = (
            <existing system_content text>
            + STRUCTURE_CONTRACT
        )
        # ... rest of function unchanged; return [...] of messages ...
    ```

    The exact local variable name and message structure depend on the current function body.
    Read `_build_spec_ad_prompt` before editing and append `STRUCTURE_CONTRACT` to the content
    field of the message that defines section guidance / writing constraints. Do NOT add new
    messages to the list — concatenate to an existing message's content.

    **EDIT 4 — Re-type `SpecAdBonus.body` + add validator** (replace the existing class body):

    ```python
    class SpecAdBonus(BaseModel):
        headline: str = Field(default="", description="<=6 words")
        body: list[BodyBlock] = Field(   # Phase 18 D-01/D-04 (was: body: str = Field(...))
            default_factory=list,
            description="100-300 words rendered as list[BodyBlock]; >=2 h2/h3 + >=1 blockquote",
        )

        @field_validator('body')
        @classmethod
        def _enforce_structural_floor(cls, body: list[BodyBlock]) -> list[BodyBlock]:
            heading_count = sum(1 for b in body if b.type in ('h2', 'h3'))
            blockquote_count = sum(1 for b in body if b.type == 'blockquote')
            if heading_count < 2:
                raise ValueError(
                    f"structural-floor: need >=2 sub-headers, got {heading_count}"
                )
            if blockquote_count < 1:
                raise ValueError(
                    f"structural-floor: need >=1 blockquote, got {blockquote_count}"
                )
            return body
    ```

    **EDIT 5 — VERIFY (do not modify)** `BigBudgetBonus.body` and `JingleBonus.body` declarations:

    `BigBudgetBonus.body` MUST remain literally:
    ```python
    body: str = Field(default="", description="200-400 words on concept")
    ```

    `JingleBonus.body` MUST remain literally:
    ```python
    body: str = Field(default="", description="100-200 words on concept")
    ```

    `_build_big_budget_prompt` and `_build_jingle_prompt` MUST remain byte-unchanged. The agent
    function body (the `acomplete` routing block lines 180-230) MUST remain byte-unchanged.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_headings_required tests/agents/test_writer_structural_floor.py::test_structural_floor_blockquote_required tests/agents/test_bonus_specad_only.py tests/agents/test_bonus.py -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "_enforce_structural_floor" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns `1` (ONLY SpecAdBonus has it — D-04)
    - `grep -c "body: list\[BodyBlock\]" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns `1` (ONLY SpecAdBonus)
    - BigBudget + Jingle body lines preserved verbatim: `grep -c "body: str = Field" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns `2` (BigBudget + Jingle — D-04 carve-out)
    - `grep -c "from eisenbalm_pipeline.graph.blocks import BodyBlock" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns `1`
    - `grep -c "STRUCTURE_CONTRACT" packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` returns >= 2 (declaration + append in _build_spec_ad_prompt)
    - All 3 tests in test_bonus_specad_only.py pass: `cd packages/pipeline && uv run pytest tests/agents/test_bonus_specad_only.py -q 2>&1 | tail -1` shows `3 passed`
    - All 5 SpecAd-parametrized test cases in test_writer_structural_floor.py pass (across the 4 test functions): `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -k "bonus" -q 2>&1 | tail -1` shows `4 passed`
    - All 20 tests in test_writer_structural_floor.py pass (Task 1 covered 16 narrative writers; this task covers the 4 SpecAd cases): `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -q 2>&1 | tail -1` shows `20 passed`
    - test_bonus.py stays green: `cd packages/pipeline && uv run pytest tests/agents/test_bonus.py -q 2>&1 | tail -1` shows the same pass count as pre-plan baseline (no regression to BigBudget/Jingle flows)
    - Module imports succeed: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.bonus import SpecAdBonus, BigBudgetBonus, JingleBonus, STRUCTURE_CONTRACT, _build_spec_ad_prompt, _build_big_budget_prompt, _build_jingle_prompt; print('OK')"` prints `OK`
  </acceptance_criteria>
  <done>
    SpecAdBonus has list[BodyBlock] body + structural-floor validator; BigBudgetBonus + JingleBonus body fields untouched + their prompt builders byte-unchanged; STRUCTURE_CONTRACT threaded into _build_spec_ad_prompt only.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Rewire 5 sanity_client.py call sites — long-read sections use compose_section_body; _build_bonus branches on bonusType</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (full file — see the 5 call sites at lines 81, 177, 183, 195, 202 enumerated in RESEARCH §Pitfall 5)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md §Pitfall 7 (the _build_bonus branching pattern verbatim)
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (Plan 18-03 — confirm `compose_section_body` is importable)
  </read_first>
  <behavior>
    - 4 long-read narrative section write call sites (originStory.body, problemStatement.body, founderBio.body, caseStudy.body) call `compose_section_body(body_blocks)` instead of `text_to_portable_text(body_str)`
    - `_build_bonus` helper branches on `bonus_type`: `"specAd"` uses `compose_section_body`, `"bigBudget"` / `"jingle"` use `text_to_portable_text` (D-04 — BigBudget/Jingle body still str)
    - `text_to_portable_text` import is preserved (still used by bonus.py BigBudget/Jingle branches)
    - `compose_section_body` is added to the import statement
    - All other code in sanity_client.py (PDF helpers, GROQ helpers, etc.) is byte-unchanged
    - test_sanity_write.py + test_sanity_client_pdfcontent.py stay GREEN
  </behavior>
  <action>
    Open `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`.

    **EDIT 1 — Extend the import line** for `text_to_portable_text` to also import `compose_section_body`:
    ```python
    # CURRENT (line 20):
    from eisenbalm_pipeline.lib.portable_text import text_to_portable_text
    # REPLACE WITH:
    from eisenbalm_pipeline.lib.portable_text import (
        compose_section_body,
        text_to_portable_text,
    )
    ```

    **EDIT 2 — Rewrite `_build_bonus`** (currently lines ~71-90) to branch on `bonus_type`:
    ```python
    def _build_bonus(state: dict) -> dict:
        """Mirror API_CONTRACTS §2.2 _build_bonus.

        Phase 18 D-04: specAd bonus body is list[BodyBlock] -> compose_section_body.
        BigBudget + Jingle bonus body remains str -> text_to_portable_text (unchanged).

        For ``jingle`` bonus type, include lyrics + sunoPrompt (sunoAudioUrl
        is set to empty string per CONTEXT D-19).
        """
        bonus = state.get("bonus") or {}
        bonus_type = (state.get("style_brief") or {}).get("bonusType")
        body_value = bonus.get("body", "")
        if bonus_type == "specAd" and isinstance(body_value, list):
            body_pt = compose_section_body(body_value)
        else:
            # BigBudget + Jingle branches (D-04) — body remains str
            # Defensive: if specAd somehow emitted a str (stub-mode legacy), fall back to text_to_portable_text
            body_pt = text_to_portable_text(body_value if isinstance(body_value, str) else "")
        result = {
            "headline": bonus.get("headline", ""),
            "body": body_pt,
        }
        if bonus_type == "jingle":
            result["lyrics"] = bonus.get("lyrics", "")
            result["sunoPrompt"] = bonus.get("sunoPrompt", "")
            # sunoAudioUrl intentionally omitted — Phase 5 D-19 sets to empty at write boundary
        return result
    ```

    **EDIT 3 — Rewire 4 narrative section call sites** (lines ~177, 183, 195, 202). Each currently
    calls `text_to_portable_text(...)` around the body extraction. Replace each one with
    `compose_section_body(...)`:

    ```python
    # CURRENT (~line 177):
            "body": text_to_portable_text(
                (state.get("origin_story") or {}).get("body", "")
            ),
    # REPLACE WITH:
            "body": compose_section_body(
                (state.get("origin_story") or {}).get("body", []) or []
            ),
    ```

    Apply the SAME replacement pattern to:
    - `problemStatement.body` (~line 183): state key `problem_statement`
    - `founderBio.body` (~line 195): state key `founder_bio`
    - `caseStudy.body` (~line 202): state key `case_study`

    Each call uses `compose_section_body(...)` and substitutes the default from `""` to `[]` so an
    empty/missing body produces an empty Portable Text array instead of a single empty paragraph.

    DO NOT modify the `_build_pdf_content` helper or any other helper. DO NOT remove the
    `text_to_portable_text` import. DO NOT change the surrounding write-document structure.

    For each of the 4 sections, the `headline` field assignment in the same block stays unchanged.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_sanity_write.py tests/test_sanity_client_pdfcontent.py tests/agents/test_writer_structural_floor.py tests/agents/test_bonus.py -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "compose_section_body" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns >= 5 (1 import + 4 narrative call sites + 1 _build_bonus specAd branch = 6, but minimum 5 to allow planner discretion)
    - `grep -c "text_to_portable_text" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns >= 2 (import + at least 1 use in _build_bonus BigBudget/Jingle else branch)
    - `grep -c "bonus_type == \"specAd\"" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns >= 1 (the branch guard in _build_bonus)
    - `grep -c "isinstance(body_value, list)\|isinstance(body, list)" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns >= 1 (defensive guard in _build_bonus)
    - All 4 narrative section blocks rewired (verify by counting compose_section_body calls in the long-read region): inspect file and confirm 5 total compose_section_body() callsites (1 originStory + 1 problemStatement + 1 founderBio + 1 caseStudy + 1 in _build_bonus specAd branch)
    - test_sanity_write.py stays green: `cd packages/pipeline && uv run pytest tests/test_sanity_write.py -q 2>&1 | tail -1` shows same pass count as pre-plan baseline
    - test_sanity_client_pdfcontent.py stays green (D-03 — pdfContent unchanged): `cd packages/pipeline && uv run pytest tests/test_sanity_client_pdfcontent.py -q 2>&1 | tail -1` shows same pass count as pre-plan baseline
    - All 20 writer structural-floor tests pass: `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -q 2>&1 | tail -1` shows `20 passed`
    - Module imports succeed: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.sanity_client import _build_bonus, compose_section_body, text_to_portable_text; print('OK')"` prints `OK`
  </acceptance_criteria>
  <done>
    sanity_client.py: 4 narrative call sites rewired to compose_section_body; _build_bonus branches on bonusType (specAd→compose, BigBudget/Jingle→text_to_portable_text); text_to_portable_text import preserved; PDF + sanity-write tests stay green.
  </done>
</task>

</tasks>

<verification>
- All 20 writer_structural_floor tests pass: `cd packages/pipeline && uv run pytest tests/agents/test_writer_structural_floor.py -q 2>&1 | tail -1` shows `20 passed`
- All 3 bonus_specad_only tests pass (including the previously-RED SpecAd positive): `cd packages/pipeline && uv run pytest tests/agents/test_bonus_specad_only.py -q 2>&1 | tail -1` shows `3 passed`
- Phase 16 NRR-04 voice-propagation test stays green: `cd packages/pipeline && uv run pytest tests/test_section_writer_voice_propagation.py -q 2>&1 | tail -1` shows `passed`
- All 5 per-agent existing tests stay green: `cd packages/pipeline && uv run pytest tests/agents/test_origin_story.py tests/agents/test_problem.py tests/agents/test_founder_bio.py tests/agents/test_case_study.py tests/agents/test_bonus.py -q 2>&1 | tail -1` shows pass count matching pre-plan baseline + 20 new (the per-agent tests can fail if stub fixtures still emit body:str; Plan 18-06 updates fixtures)
- Cumulative: full pipeline suite has more passing tests than at end of Plan 18-03 (target: ≥ Phase 16 baseline + 20 new tests passing)
- No regression in API surface: docs/API_CONTRACTS.md unchanged from end of Plan 18-01
</verification>

<success_criteria>
- 5 writer Pydantic models (4 narrative + SpecAdBonus) have body: list[BodyBlock] + _enforce_structural_floor
- BigBudgetBonus + JingleBonus untouched (D-04 verified by grep counts)
- ProblemOutput.pdfContent untouched (D-03 verified)
- 4 narrative SECTION_GUIDANCE strings + 2 founder_bio/case_study anonymous variants gain STRUCTURE_CONTRACT
- _build_spec_ad_prompt gains STRUCTURE_CONTRACT; _build_big_budget_prompt + _build_jingle_prompt byte-unchanged
- sanity_client.py 5 call sites updated: 4 narrative → compose_section_body; _build_bonus branches on bonusType
- text_to_portable_text preserved (tombstone for BigBudget/Jingle + stubs)
- 23/34 Plan 18-02 RED tests now GREEN (20 writer_structural_floor + 1 SpecAd positive + 2 BigBudget/Jingle negative already green); remaining 11 RED tests: 9 portable_text_blocks (turned green in Plan 18-03 — should still be green) + 2 QA-axis (Plan 18-05 turns green)
- Phase 16 NRR-04 byte-equivalence test stays green
</success_criteria>

<output>
After completion, create `.planning/phases/18-magazine-editorial-layout-writers/18-04-SUMMARY.md`
summarizing: per-writer diff sizes (lines added per file), confirmation of D-03 (pdfContent untouched)
and D-04 (BigBudget/Jingle untouched) via grep evidence, the full test-state matrix at this commit
(which Plan-18-02 tests turned green here, which remain RED for Plans 18-05/18-06), and any
deviations from the plan text (e.g. if a writer's SECTION_GUIDANCE used a different identifier than
documented).
</output>
