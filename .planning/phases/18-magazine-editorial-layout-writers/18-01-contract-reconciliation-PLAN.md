---
phase: 18-magazine-editorial-layout-writers
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [MEL-01, MEL-02, MEL-03, MEL-04, MEL-05, MEL-06, MEL-07, MEL-08]

must_haves:
  truths:
    - "MEL-01 through MEL-08 are written to REQUIREMENTS.md with full descriptions"
    - "docs/API_CONTRACTS.md §7 declares SectionContent.body / CaseStudyContent.body / BonusContent.body as list[dict] (was str)"
    - "docs/API_CONTRACTS.md §2.2 mentions compose_section_body as the write-path serializer for 5 long-read sections"
    - "docs/API_CONTRACTS.md §2.4 documents block_paragraph / block_h2 / block_h3 / block_blockquote / compose_section_body helpers alongside text_to_portable_text"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "MEL-01..MEL-08 requirement definitions"
      contains: "MEL-08"
    - path: "docs/API_CONTRACTS.md"
      provides: "Contract changes for body shape + new helpers"
      contains: "compose_section_body"
  key_links:
    - from: "REQUIREMENTS.md MEL-* IDs"
      to: "ROADMAP.md Phase 18 Requirements line"
      via: "ID match"
      pattern: "MEL-0[1-8]"
    - from: "API_CONTRACTS.md §7 body field type"
      to: "graph/state.py SectionContent.body (changed in Plan 18-03)"
      via: "list[dict] declaration"
      pattern: "list\\[dict\\]"
---

<objective>
Reconcile contracts BEFORE any code changes. This plan satisfies the CLAUDE.md hard rule
("no schema/payload change without docs/API_CONTRACTS.md first"). It adds MEL-01..MEL-08 to
REQUIREMENTS.md and amends API_CONTRACTS.md §7 + §2.2 + §2.4 to describe the new body-shape
contract and the four new Portable Text helpers + compose_section_body serializer.

Purpose: Lock the contract surface so Plans 18-02..18-06 cannot drift from it.
Output: docs/API_CONTRACTS.md amended; .planning/REQUIREMENTS.md MEL-01..MEL-08 added.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md

<interfaces>
<!-- Phase 18 body-shape contract — verbatim from CONTEXT.md D-01. -->
<!-- Executor MUST embed this discriminated union in API_CONTRACTS.md §7. -->

From CONTEXT.md D-01 (Pydantic discriminated union):
```python
class Paragraph(BaseModel):
    type: Literal['paragraph'] = 'paragraph'
    text: str

class Heading(BaseModel):
    type: Literal['h2', 'h3']      # writer picks per local hierarchy
    text: str

class Blockquote(BaseModel):
    type: Literal['blockquote'] = 'blockquote'
    text: str

BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
```

Current state.py declarations (RESEARCH §sources — to be re-typed in Plan 18-03):
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

Existing portable_text.py module signature (RESEARCH §Pattern 3 — Plan 18-03 will extend):
```python
def text_to_portable_text(text: str) -> list[dict]: ...
```

Existing REQUIREMENTS.md format pattern (from SHOP-01..SHOP-11, lines 173-185):
```
- [ ] **MEL-01**: <description in success-criteria voice>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add MEL-01..MEL-08 section to REQUIREMENTS.md</name>
  <files>.planning/REQUIREMENTS.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (read tail; see lines 173-185 for SHOP-* pattern to mirror; read traceability table tail to find insertion point)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md (§phase_requirements — the candidate MEL-01..MEL-08 table is HIGH-confidence and ready to ship verbatim)
    - .planning/ROADMAP.md (Phase 18 section, lines 346-364 — success criteria 1-7 are the derivation source)
  </read_first>
  <action>
    Insert a new `### Magazine Editorial Layout — Writer Structure (Phase 18)` section BETWEEN
    the existing `### Shop Storefront — Rich Product Page (Phase 15)` section (ends at line 185)
    and `## v2 Requirements` (starts at line 187).

    Use these 8 requirement definitions VERBATIM (derived from RESEARCH §phase_requirements,
    refined for the REQUIREMENTS.md format pattern observed in SHOP-* lines 175-185):

    ```
    ### Magazine Editorial Layout — Writer Structure (Phase 18)

    - [ ] **MEL-01**: Each of the 5 long-read sections (`originStory`, `problemStatement`, `founderBio`, `caseStudy`, `bonus` when `bonusType == "specAd"`) emits at minimum 2 Portable Text blocks with `style: "h2"` or `style: "h3"` in its Sanity body array; verified by GROQ post-condition `count(<section>.body[style in ["h2","h3"]]) >= 2` per section
    - [ ] **MEL-02**: Each of those 5 sections emits at minimum 1 Portable Text block with `style: "blockquote"`; verified by `count(<section>.body[style=="blockquote"]) >= 1` per section
    - [ ] **MEL-03**: Body prose voice is byte-equivalent: existing Phase 5 voice-isolation tripwires (no exclamation marks, no forbidden adjectives, no passive hedging, no AI self-reference) still pass on the assembled body text for every section; `packages/pipeline/tests/test_section_writer_voice_propagation.py` stays green; `packages/pipeline/tests/test_voice.py` stays green (Phase 16 NRR-10 byte-equivalence)
    - [ ] **MEL-04**: QA judge rubric (`packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`) gains a `structural-variety` axis; `JudgeFinding.axis` `Literal` in `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` includes `"structural-variety"`; findings from a flat-paragraph-wall section produce at least one `structural-variety` entry in `qaCorrections` with `severity: "warning"` (not `error` — per CONTEXT D-05; Phase 5 D-02 keeps QA annotation-only)
    - [ ] **MEL-05**: Zero-regression matrix: `cd packages/pipeline && uv run pytest -x -q` reports >= 200 passing (>= 190 Phase 16 baseline + 4 new Phase 18 test files); `pnpm --filter web test:unit` reports >= 234 passing (Phase 16 baseline preserved); all listed Phase 18 tripwire tests (see 18-CONTEXT.md canonical_refs > Tripwires) stay green
    - [ ] **MEL-06**: Live frontend at `https://eisenbalm-web.vercel.app/issue/<next-issue-slug>` for a freshly-generated issue contains at least 2 `<h2>` elements AND at least 1 `<blockquote>` element within each of the 5 long-read section containers; verified by HTML scan documented in `18-VERIFICATION.md` (no 7-10 consecutive `<p>` blocks per section)
    - [ ] **MEL-07**: Cost per writer call rises at most 15% vs. Phase 16 baseline; the STRUCTURE_CONTRACT (CONTEXT D-01) is a <=120-word system-prompt addition; the structural-validator retry (CONTEXT D-02) adds at most one extra `acomplete` call per writer per run; verified by controlled real-mode run documented in `18-VERIFICATION.md`
    - [ ] **MEL-08**: `BigBudgetBonus.body` and `JingleBonus.body` Pydantic fields remain typed `str` (no structural floor — per CONTEXT D-04); only `SpecAdBonus.body` is typed `list[BodyBlock]`; a negative pytest case asserts `BigBudgetBonus` and `JingleBonus` Pydantic models do NOT carry the `_enforce_structural_floor` validator
    ```

    THEN update the `## Traceability` table (starts at line 228; SHOP-11 is the last entry before the
    coverage footer at line ~225). Append 8 new rows after the SHOP-11 row, using the same format as
    the SHOP-* rows:

    ```
    | MEL-01 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-02 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-03 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-04 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-05 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-06 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-07 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    | MEL-08 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
    ```

    THEN update the Coverage footer (currently `v1 requirements: 95 total (84 prior + 11 SHOP-*
    added Phase 15)`) to `v1 requirements: 103 total (95 prior + 8 MEL-* added Phase 18)` and
    `Mapped to phases: 103`. Update the "Last updated" trailer to `2026-05-30 — added MEL-01..MEL-08
    for Phase 18 (Magazine Editorial Layout — Writer Structure)`.

    DO NOT modify any FND/WEB/CVX/PIP/AGT/PDF/WHK/GAM/CMR/DEL/POD/OPS/DES/ARC/MOT/MED/LIGHT/SHOP entries.
  </action>
  <verify>
    <automated>grep -c "^- \[ \] \*\*MEL-0[1-8]\*\*:" .planning/REQUIREMENTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^- \[ \] \*\*MEL-0[1-8]\*\*:" .planning/REQUIREMENTS.md` returns `8`
    - `grep -c "| MEL-0[1-8] | Phase 18:" .planning/REQUIREMENTS.md` returns `8`
    - `grep "v1 requirements: 103 total" .planning/REQUIREMENTS.md` matches one line
    - `grep "Magazine Editorial Layout — Writer Structure (Phase 18)" .planning/REQUIREMENTS.md` matches exactly one heading line
    - No SHOP-* / LIGHT-* / MED-* / ARC-* / MOT-* line removed: `grep -c "^- \[x\] \*\*SHOP-" .planning/REQUIREMENTS.md` returns `11`
    - The new MEL section is placed BEFORE `## v2 Requirements`: `awk '/^### Magazine Editorial Layout/{m=NR} /^## v2 Requirements/{v=NR} END{print (m<v && m>0 && v>0) ? "OK" : "FAIL"}' .planning/REQUIREMENTS.md` prints `OK`
  </acceptance_criteria>
  <done>
    REQUIREMENTS.md contains MEL-01..MEL-08 as v1 requirements with full descriptions; traceability table includes 8 new MEL rows; coverage footer reflects 103 total v1 requirements.
  </done>
</task>

<task type="auto">
  <name>Task 2: Amend docs/API_CONTRACTS.md §7 — re-type body fields to list[dict]</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (find §7 DispatchState section — search for `SectionContent` / `CaseStudyContent` / `BonusContent`)
    - .planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md (canonical_refs section — confirms §7 modification scope)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py lines 80-99 (current TypedDict shapes — the source of truth being amended)
  </read_first>
  <action>
    Open `docs/API_CONTRACTS.md` and locate §7 (the `DispatchState` TypedDict section). Find the
    three TypedDicts: `SectionContent`, `CaseStudyContent`, `BonusContent`.

    For EACH of those three TypedDicts, change the `body` field declaration:
    - FROM: `body: str` (with whatever inline comment exists, e.g. `# plain text, paragraphs separated by \n\n`)
    - TO: `body: list[dict]   # Phase 18: discriminated-union BodyBlock; Pydantic at writer enforces; TypedDict can't express the union`

    Immediately AFTER the `SectionContent` TypedDict declaration (or BonusContent, whichever
    appears last among the three), insert this explanatory block (verbatim — copied from CONTEXT.md D-01):

    ```
    ## Phase 18: BodyBlock discriminated union

    `SectionContent.body`, `CaseStudyContent.body`, and `BonusContent.body` (when
    `style_brief["bonusType"] == "specAd"`) are typed `list[dict]` at the TypedDict layer
    because Python's `TypedDict` cannot express a discriminated union. The actual write-time
    shape is enforced by each writer agent's Pydantic response model via:

    ```python
    from typing import Annotated, Literal, Union
    from pydantic import BaseModel, Field

    class Paragraph(BaseModel):
        type: Literal['paragraph'] = 'paragraph'
        text: str

    class Heading(BaseModel):
        type: Literal['h2', 'h3']      # writer picks per local hierarchy
        text: str

    class Blockquote(BaseModel):
        type: Literal['blockquote'] = 'blockquote'
        text: str

    BodyBlock = Annotated[
        Union[Paragraph, Heading, Blockquote],
        Field(discriminator='type'),
    ]
    ```

    The shared `BodyBlock` declaration lives in `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py`
    (created in Plan 18-03) and is imported by all five long-read writer Pydantic models
    (`OriginStoryOutput`, `ProblemOutput`, `FounderBioOutput`, `CaseStudyOutput`, `SpecAdBonus`).

    A `@field_validator('body')` named `_enforce_structural_floor` runs on each writer's response
    and raises `ValueError` if `count(type in ('h2','h3')) < 2` OR `count(type == 'blockquote') < 1`.
    The existing Phase 5 `acomplete` retry-once-then-fail path (`lib/openrouter_client.py` lines
    169-179) handles structural-validation retries automatically — no new mechanism.

    `BigBudgetBonus.body` and `JingleBonus.body` remain `str` (CONTEXT D-04 — those branches'
    structured payloads `storyboards[]` / `lyrics + sunoPrompt` already provide visual variety).

    `ProblemOutput.pdfContent` is UNCHANGED (CONTEXT D-03 — Phase 6 WeasyPrint contract preserved).
    ```

    Do not delete or modify any other §7 field. Do not touch §1, §3, §4, §5, §6, §8 in this task.
  </action>
  <verify>
    <automated>grep -c "Phase 18: BodyBlock discriminated union\|body: list\[dict\]" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 18: BodyBlock discriminated union" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "BodyBlock = Annotated\[" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "Field(discriminator='type')" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "_enforce_structural_floor" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "^    body: str" docs/API_CONTRACTS.md` returns `0` (within §7 — all three were re-typed; if other §s still legitimately have `body: str` outside §7, narrow to §7 with sed range)
    - `grep -c "body: list\[dict\]" docs/API_CONTRACTS.md` >= 3 (one per TypedDict: SectionContent, CaseStudyContent, BonusContent)
    - `grep "pdfContent" docs/API_CONTRACTS.md` still produces matches (D-03 — pdfContent must NOT be removed; just not modified in this task)
  </acceptance_criteria>
  <done>
    §7 TypedDicts re-typed body fields to `list[dict]`; Phase 18 BodyBlock discriminated union section is documented inline alongside the TypedDicts; pdfContent reference preserved.
  </done>
</task>

<task type="auto">
  <name>Task 3: Amend docs/API_CONTRACTS.md §2.2 + §2.4 — document compose_section_body call path and new block helpers</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md (find §2.2 — "create weeklyIssue draft" Python write shape; find §2.4 — Portable Text helpers)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md (§Pattern 3 — exact builder function signatures + compose_section_body dispatch logic)
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (current text_to_portable_text — the pattern the new helpers follow)
  </read_first>
  <action>
    Open `docs/API_CONTRACTS.md` and locate §2.2 ("create weeklyIssue draft" Python write shape).
    Find the existing example that shows `text_to_portable_text(...)` being called for each
    long-read section body field. Add a note immediately after that example block (do NOT delete
    the existing text_to_portable_text reference — it remains valid for BigBudget/Jingle bonus
    branches and for stub-mode legacy paths):

    ```
    **Phase 18 update (long-read sections):** For the five long-read sections
    (`originStory`, `problemStatement`, `founderBio`, `caseStudy`, and `bonus` when
    `style_brief["bonusType"] == "specAd"`), the Python write path calls
    `compose_section_body(body_blocks)` instead of `text_to_portable_text(body_str)` because
    each long-read writer's Pydantic `body` field is now `list[BodyBlock]` (a discriminated
    union of Paragraph / Heading / Blockquote — see §7). `compose_section_body` dispatches each
    block on its `type` field to the matching builder (`block_paragraph`, `block_h2`,
    `block_h3`, `block_blockquote`) and returns a `list[dict]` of Sanity Portable Text blocks.

    `text_to_portable_text(body_str)` remains valid for:
    - `BigBudgetBonus.body` (D-04 — body remains str; visual variety comes from `storyboards[]`)
    - `JingleBonus.body`    (D-04 — body remains str; visual variety comes from lyrics + sunoPrompt)
    - Stub-mode fixtures that emit `body: str` (legacy backward-compat — see Plan 18-06)

    The `_build_bonus` helper in `lib/sanity_client.py` branches on `style_brief["bonusType"]`:
    `specAd` uses `compose_section_body`; `bigBudget` and `jingle` use `text_to_portable_text`.
    ```

    THEN locate §2.4 (Portable Text helpers). Add documentation for the new helpers AFTER the
    existing `text_to_portable_text` documentation:

    ```
    ### Phase 18: Portable Text block builders (long-read sections)

    Defined in `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` (Plan 18-03 adds):

    - `block_paragraph(text: str) -> dict` — emits one block with `style: "normal"`
    - `block_h2(text: str) -> dict` — emits one block with `style: "h2"`
    - `block_h3(text: str) -> dict` — emits one block with `style: "h3"`
    - `block_blockquote(text: str) -> dict` — emits one block with `style: "blockquote"`
    - `compose_section_body(blocks: list[dict]) -> list[dict]` — dispatches each block on `block['type']`
      to the matching builder; returns a list of Sanity Portable Text block dicts ready to write to Sanity.

    All four builders follow the same `_type: 'block'` + `_key: f'block-{uuid.uuid4().hex[:8]}'`
    + `markDefs: []` + single-span pattern as the existing `text_to_portable_text` helper.

    Sanity's `weeklyIssue.body` field type is `type: 'array', of: [{type: 'block'}]` with NO
    custom `styles` restriction (verified `apps/studio/schemas/weeklyIssue.ts`) — Sanity's default
    block type accepts `h2`, `h3`, `blockquote` styles natively. **No Sanity schema change.**

    The frontend `apps/web/components/issue/PortableTextRenderer.tsx` (Phase 10) has rendering
    handlers for `h2` / `h3` / `blockquote` block styles that are dead-coded at the live URL today
    — Phase 18 activates them by emitting the markers writers currently omit.
    ```

    Do not modify any other §2.x subsection. Do not delete or change the existing §2.4 description
    of `text_to_portable_text`.
  </action>
  <verify>
    <automated>grep -c "compose_section_body\|block_h2\|block_h3\|block_blockquote\|block_paragraph" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "compose_section_body" docs/API_CONTRACTS.md` >= 3 (mentioned in §2.2 once, §2.4 twice — once in list, once in dispatch sentence)
    - `grep -c "block_h2" docs/API_CONTRACTS.md` >= 2
    - `grep -c "block_h3" docs/API_CONTRACTS.md` >= 2
    - `grep -c "block_blockquote" docs/API_CONTRACTS.md` >= 2
    - `grep -c "block_paragraph" docs/API_CONTRACTS.md` >= 2
    - `grep -c "Phase 18 update (long-read sections)" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "Phase 18: Portable Text block builders" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "text_to_portable_text" docs/API_CONTRACTS.md` >= 2 (the original §2.4 documentation is preserved; new §2.2 note also mentions it)
    - `grep -c "BigBudgetBonus.body\|JingleBonus.body" docs/API_CONTRACTS.md` >= 1 (D-04 branch documented)
  </acceptance_criteria>
  <done>
    §2.2 documents the compose_section_body call path for the 5 long-read sections with the bonusType branch; §2.4 documents the four new block builders + compose_section_body serializer; text_to_portable_text remains documented as the legacy path for BigBudget/Jingle bonus branches and stubs.
  </done>
</task>

</tasks>

<verification>
- `grep -c "MEL-0[1-8]" .planning/REQUIREMENTS.md` returns >= 16 (8 in v1 list + 8 in traceability)
- `grep -c "Phase 18:" docs/API_CONTRACTS.md` returns >= 5 (BodyBlock heading + 2.2 update note + 2.4 helper heading + at least one inline mention each side)
- `cd packages/pipeline && uv run pytest -x -q --collect-only 2>&1 | tail -1` is unchanged from pre-plan baseline (no tests touched in this plan)
- `pnpm --filter web test:unit --run 2>&1 | tail -3` is unchanged from pre-plan baseline (no frontend touched)
</verification>

<success_criteria>
- REQUIREMENTS.md contains MEL-01..MEL-08 (8 entries in v1 list, 8 entries in traceability table, coverage footer updated to 103)
- API_CONTRACTS.md §7 declares the three TypedDicts' `body` fields as `list[dict]` with an inline BodyBlock discriminated-union explainer
- API_CONTRACTS.md §2.2 documents the compose_section_body call path with the BigBudget/Jingle bonus-branch carve-out
- API_CONTRACTS.md §2.4 documents the four new block builders + the compose_section_body serializer
- No pytest or vitest baseline regression (this plan touches docs + planning files only — no production code)
- `git status` shows exactly 2 files modified: `docs/API_CONTRACTS.md` and `.planning/REQUIREMENTS.md`
</success_criteria>

<output>
After completion, create `.planning/phases/18-magazine-editorial-layout-writers/18-01-SUMMARY.md`
summarizing: which §s were amended, the exact line ranges added, the 8 MEL IDs added, and any
inline-link decisions (e.g. did §2.2 reference Plan 18-03 by number?).
</output>
