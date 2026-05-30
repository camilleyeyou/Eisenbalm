# Phase 18: Magazine Editorial Layout — Writer Structure - Research

**Researched:** 2026-05-30
**Domain:** Pipeline writer-agent Pydantic schemas, Portable Text emission, QA rubric extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Pydantic typed `body` blocks.** Each long-read writer's response Pydantic schema changes its `body` field from `str` to `list[BodyBlock]`, where `BodyBlock` is a discriminated union:
```python
class Paragraph(BaseModel):
    type: Literal['paragraph'] = 'paragraph'
    text: str

class Heading(BaseModel):
    type: Literal['h2', 'h3']      # writer picks per local hierarchy
    text: str

class Blockquote(BaseModel):
    type: Literal['blockquote'] = 'blockquote'
    text: str                       # one-sentence pull-quote lift

BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
```

**D-02: Structural floor enforced at the Pydantic layer (`@field_validator`).** Each writer's response model includes `_enforce_structural_floor` validator: `count(type in ('h2','h3')) >= 2 AND count(type == 'blockquote') >= 1`. Failure triggers the existing Phase 5 `acomplete` retry-once-then-fail path. Second failure raises; `@agent_node` wrapper sets `pipelineRuns.status='failed'`.

**D-03: `pdfContent` stays flat.** ProblemWriter's `pdfContent` (Phase 6 WeasyPrint contract) is UNCHANGED. Only `body` changes type. PDF stays single-column prose.

**D-04: Bonus structural contract applies ONLY to the `specAd` branch.** `SpecAdBonus` Pydantic + `_build_spec_ad_prompt` gain the contract. `BigBudgetBonus` and `JingleBonus` (and their prompt builders) are UNCHANGED.

**D-05: QA judge gets a qualitative `structural-variety` axis** (severity='warning'). Judges sub-head wording craft + pull-quote authenticity. `JudgeFinding.axis` Literal gains `"structural-variety"`. No new acomplete call.

### Claude's Discretion

- Whether `compose_section_body` lives in `lib/portable_text.py` or a new file (recommended: same file).
- Exact Pydantic discriminator pattern — `Annotated[Union[...], Field(discriminator='type')]` vs. `Annotated[..., Discriminator('type')]`.
- Whether to consolidate the three ROADMAP test files into one with `pytest.mark.parametrize`.
- Exact STRUCTURE_CONTRACT wording (≤120 words seed from ROADMAP stub).
- Whether to keep `text_to_portable_text` as a deprecation-tombstone or delete it.
- Per-writer h2-vs-h3 hierarchy preference.
- Test fixture body shapes for RED tests.
- Whether to add a negative test asserting BigBudgetBonus + JingleBonus do NOT carry the validator.
- Exact wording of the new `rubric.md` `structural-variety` axis description.

### Deferred Ideas (OUT OF SCOPE)

- `StatRow` component for `problemStatement.pdfContent.keyDataPoints` (UI-REVIEW Fix #2).
- Per-section `.lede` paragraph styling (UI-REVIEW Fix #3).
- Sticky SectionNavigator (UI-REVIEW Fix #5).
- Empty CaseStudy metadata-block bug (`subjectName?.trim()` guard) — file as `/gsd:quick`.
- End-of-section "next: THE PROBLEM →" link.
- Visible scroll-progress bar.
- `FigureWithCaption` component.
- `bigBudget` + `jingle` structural enforcement.
- Narrator override of structural floor.
- `pdfContent` structural body.
- Layer-1 deterministic regex predicate for body-block counts.
- New `deliberationEvents.eventType` for structural-retry visibility.
- Body-shape migration for chronicler conversation turns.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

MEL-01 through MEL-08 are NOT yet in REQUIREMENTS.md. Below is the researcher's proposed derivation from ROADMAP success criteria (SC 1-7) + CONTEXT.md decisions (D-01..D-05) + the 5 ROADMAP plan stubs. The planner writes these verbatim to REQUIREMENTS.md as the first task of Plan 18-00.

| ID | Derived From | Description |
|----|-------------|-------------|
| MEL-01 | SC-1 | Each of the 5 long-read sections (origin_story, problem_statement, founder_bio, case_study, bonus[specAd]) emits ≥2 `block.style: "h2"` or `"h3"` blocks in its Sanity body Portable Text array; verified by GROQ `count(*.body[style in ["h2","h3"]]) >= 2` per section |
| MEL-02 | SC-2 | Each of those 5 sections emits ≥1 `block.style: "blockquote"` block; verified by `count(*.body[style=="blockquote"]) >= 1` per section |
| MEL-03 | SC-3, D-01, D-02 | Body prose voice is unchanged: existing Phase 5 voice-isolation tripwires (no exclamation marks, no forbidden adjectives, no passive hedging, no AI reference) still pass on the assembled body text for every section; `test_section_writer_voice_propagation.py` stays green |
| MEL-04 | SC-4, D-05 | QA `rubric.md` gains a `structural-variety` axis; `JudgeFinding.axis` Literal includes `"structural-variety"`; findings from a flat-paragraph-wall section produce at least one `structural-variety` finding in `qaCorrections` with `severity='warning'` |
| MEL-05 | SC-5 | Zero-regression: pipeline pytest suite ≥190 passing; web vitest baseline ≥234 passing; all listed Phase 18 tripwire tests stay green (see Tripwires section) |
| MEL-06 | SC-6 | Live frontend at `/issue/[slug]` for a freshly-generated issue contains ≥2 `<h2>` elements and ≥1 `<blockquote>` element within each of the 5 long-read section containers; verified by HTML scan (no 7-10 consecutive `<p>` blocks per section) |
| MEL-07 | SC-7 | Cost per writer call rises ≤15% vs. Phase 16 baseline (STRUCTURE_CONTRACT ≤120-word system-prompt addition + at most 1 retry per writer per run) |
| MEL-08 | D-04, SC-1-2 | `BigBudgetBonus.body` and `JingleBonus.body` remain `str` (no structural floor); only `SpecAdBonus.body` is `list[BodyBlock]`; a negative test asserts BigBudget + Jingle Pydantic models do NOT carry `_enforce_structural_floor` |

</phase_requirements>

---

## Summary

Phase 18 is a **pure pipeline-side writer upgrade** that activates the already-shipped frontend Portable Text renderer primitives (h2, h3, blockquote) by changing the five long-read writer agents from emitting flat `body: str` to emitting `body: list[BodyBlock]` — a Pydantic discriminated union with a structural floor validator. The frontend `PortableTextRenderer.tsx` (102 lines, confirmed) already has correct handlers for h2/h3/blockquote that render at 0 instances on the live URL today. Zero frontend changes are required.

The change surface is narrow and well-scoped: (1) a new shared `BodyBlock` discriminated union + `compose_section_body()` serializer in `lib/portable_text.py`; (2) re-typed `body` fields + `@field_validator` on five writer Pydantic models (origin_story, problem, founder_bio, case_study, bonus[specAd only]); (3) STRUCTURE_CONTRACT addendum in each writer's `section_guidance`; (4) `JudgeFinding.axis` extended by one literal + `rubric.md` extended by one axis; (5) all `text_to_portable_text(body_str)` call sites in `sanity_client.py` rewired to `compose_section_body(body_blocks)`; (6) `graph/state.py` re-typed body fields from `str` to `list[dict]`; (7) stub fixtures updated to emit conforming `list[BodyBlock]` payloads; (8) `docs/API_CONTRACTS.md §7 + §2.2 + §2.4` amended FIRST per CLAUDE.md hard rule.

**Primary recommendation:** Follow the CONTEXT.md decisions verbatim. Contract amendment first (Plan 18-01), then RED tests (Plan 18-02), then lib + state layer (Plan 18-03), then five writers in parallel (Plan 18-04), then QA axis (Plan 18-05), then stub fixtures + verification (Plan 18-06).

---

## Standard Stack

### Core (no new dependencies — Phase 18 uses only what is already installed)

| Library | Pinned Version | Purpose | Status |
|---------|---------------|---------|--------|
| `pydantic` | `2.13.4` (pinned in `pyproject.toml`) | Discriminated union + `@field_validator` | Already installed |
| `uuid` (stdlib) | stdlib | `_key` generation in Portable Text helpers | Already used |
| `pytest` / `pytest-asyncio` | existing | RED-first test scaffold | Already installed |

**No new Python dependencies required.** No new npm dependencies required. No new Sanity schema field. No new Convex query/mutation.

### Pydantic version note

The project pins `pydantic==2.13.4`. At Pydantic v2.x, the standard discriminated union syntax is:

```python
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field

BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
```

This syntax has been stable since Pydantic v2.0.0 and works correctly through 2.13.x. The alternative `Annotated[..., Discriminator('type')]` form (Pydantic v2.5+) also works but requires importing `Discriminator` from `pydantic`. The `Field(discriminator='type')` form is simpler and is the pattern already used in this codebase's Phase 13 chronicler discriminated unions. **Use `Field(discriminator='type')`.**

**Critical Pydantic constraint from Phase 5 Plan 05-15:** Anthropic's structured-output schema validator rejects `minItems`/`maxItems` on arrays (the `_exactly_three` validator in `problem.py` documents this). The same constraint applies here: the structural floor (`count >= 2 headings`, `count >= 1 blockquote`) MUST be enforced in `@field_validator` AFTER parse time, NOT via `min_length=2` on the list annotation. The Phase 5 pattern in `PdfContent._exactly_three` is the exact template to follow.

---

## Architecture Patterns

### Recommended Project Structure (Phase 18 modification points only)

```
packages/pipeline/src/eisenbalm_pipeline/
├── lib/
│   └── portable_text.py          # ADD: block_paragraph, block_h2, block_h3,
│                                 #      block_blockquote, compose_section_body
│                                 # KEEP: text_to_portable_text (deprecation tombstone)
├── graph/
│   └── state.py                  # CHANGE: SectionContent.body, CaseStudyContent.body,
│                                 #          BonusContent.body  str → list[dict]
├── agents/
│   ├── origin_story.py           # CHANGE: OriginStoryOutput.body + field_validator
│   ├── problem.py                # CHANGE: ProblemOutput.body + field_validator
│   ├── founder_bio.py            # CHANGE: FounderBioOutput.body + field_validator
│   ├── case_study.py             # CHANGE: CaseStudyOutput.body + field_validator
│   ├── bonus.py                  # CHANGE: SpecAdBonus.body + validator ONLY
│   └── qa/
│       ├── judge.py              # CHANGE: JudgeFinding.axis Literal += "structural-variety"
│       └── rubric.md             # CHANGE: add structural-variety axis
├── stubs/
│   └── fixtures.py               # CHANGE: 5 long-read fixture functions emit list[BodyBlock]
docs/
└── API_CONTRACTS.md              # CHANGE FIRST: §7, §2.2, §2.4
```

### Pattern 1: Discriminated Union Declaration (shared module placement)

**What:** `BodyBlock` and its constituent classes live in a single module imported by all five writers.

**Recommended placement:** `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` (new file, or inline in `graph/state.py`). CONTEXT.md notes "the cross-cutting `BodyBlock` union lives once in `graph/state.py` (or a sibling `graph/blocks.py`)." Given that `graph/state.py` already imports from `__future__ import annotations` and `typing`, placing `BodyBlock` there avoids a new module. However, `state.py` is already 210 lines and the CLAUDE.md mandate is to keep changes minimal. A sibling `graph/blocks.py` is cleaner and avoids a circular import risk when writers import both `DispatchState` and `BodyBlock`.

**Example (graph/blocks.py):**
```python
"""Phase 18 — shared BodyBlock discriminated union for writer Pydantic schemas.

All five long-read writer response models import BodyBlock from here.
One definition, five consumers — no drift risk.
"""
from __future__ import annotations
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field


class Paragraph(BaseModel):
    type: Literal['paragraph'] = 'paragraph'
    text: str = ""


class Heading(BaseModel):
    type: Literal['h2', 'h3']
    text: str = ""


class Blockquote(BaseModel):
    type: Literal['blockquote'] = 'blockquote'
    text: str = ""


BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
```

### Pattern 2: `@field_validator` Structural Floor (copy-paste template)

**What:** Every long-read writer's response model gets this validator verbatim (from CONTEXT.md D-02).

```python
from pydantic import field_validator

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

**Critical nuance:** The `b.type` access works on `Paragraph | Heading | Blockquote` instances after parse. In stub mode, `model_construct()` skips validation entirely — the validator does NOT run. This is correct behavior: stub mode bypasses Pydantic validation by design (Phase 5 D-22). Stub fixtures must be manually updated to emit conforming shapes (see Wave 4).

### Pattern 3: Portable Text Block Builders (extend lib/portable_text.py)

**What:** Four new builder functions following the exact same `_key` and `_type` pattern as the existing `text_to_portable_text`.

```python
# Source: mirrors text_to_portable_text pattern in lib/portable_text.py
import uuid

def block_paragraph(text: str) -> dict:
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'normal',
        'markDefs': [],
        'children': [{'_type': 'span', '_key': f'span-{uuid.uuid4().hex[:8]}', 'text': text, 'marks': []}],
    }

def block_h2(text: str) -> dict:
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'h2',
        'markDefs': [],
        'children': [{'_type': 'span', '_key': f'span-{uuid.uuid4().hex[:8]}', 'text': text, 'marks': []}],
    }

def block_h3(text: str) -> dict:
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'h3',
        'markDefs': [],
        'children': [{'_type': 'span', '_key': f'span-{uuid.uuid4().hex[:8]}', 'text': text, 'marks': []}],
    }

def block_blockquote(text: str) -> dict:
    return {
        '_type': 'block',
        '_key': f'block-{uuid.uuid4().hex[:8]}',
        'style': 'blockquote',
        'markDefs': [],
        'children': [{'_type': 'span', '_key': f'span-{uuid.uuid4().hex[:8]}', 'text': text, 'marks': []}],
    }

def compose_section_body(blocks: list[dict]) -> list[dict]:
    """Serialize a list[BodyBlock] (or already-serialized list[dict]) to
    Sanity Portable Text. Dispatches on block['type'] to the matching builder.

    Call sites in sanity_client.py replace text_to_portable_text(body_str)
    with compose_section_body(body_blocks) for the 5 long-read sections.
    """
    result = []
    for b in blocks:
        t = b.get('type') if isinstance(b, dict) else getattr(b, 'type', None)
        text = b.get('text', '') if isinstance(b, dict) else getattr(b, 'text', '')
        if t == 'h2':
            result.append(block_h2(text))
        elif t == 'h3':
            result.append(block_h3(text))
        elif t == 'blockquote':
            result.append(block_blockquote(text))
        else:  # 'paragraph' or anything else
            result.append(block_paragraph(text))
    return result
```

**Why both `dict` and attribute access in `compose_section_body`:** After `acomplete` returns a Pydantic model, the agent calls `out_obj.model_dump()` which converts to `dict`. The `compose_section_body` will always receive `list[dict]` in practice. The dual-access pattern is defensive for test scenarios that pass Pydantic instances directly.

### Pattern 4: STRUCTURE_CONTRACT Addendum (each writer's section_guidance)

**What:** A ≤120-word block appended to each writer's `SECTION_GUIDANCE` string.

```python
STRUCTURE_CONTRACT: str = (
    "\n\nSTRUCTURE CONTRACT (non-negotiable):\n"
    "Emit at minimum 2 sub-headers (h2 or h3) and 1 blockquote per section. "
    "Sub-headers: ≤6 words, Jesse-voice, break the body into 3+ logical "
    "movements. Blockquote: a single sentence lifted verbatim from the most "
    "quotable line in the body prose — not a generic restatement. "
    "Sub-headers and blockquote serve Jesse's register. "
    "Do not break voice; structural variety is typographic, not tonal."
)
```

This is appended to each writer's existing `SECTION_GUIDANCE` string, which is passed as the `section_guidance` kwarg to `build_section_writer_prompt`. The `build_section_writer_prompt` signature is UNCHANGED (Phase 5 D-13 + CONTEXT.md canonical_refs).

### Pattern 5: QA Judge Extension (one-token diff on judge.py)

**What:** Add `"structural-variety"` to `JudgeFinding.axis` Literal, and extend `rubric.md`.

```python
# In judge.py — add ONE literal to the existing union:
axis: Literal[
    "gravity",
    "sentiment",
    "irony-signaling",
    "precision",
    "cross-section-consistency",
    "structural-variety",    # Phase 18 D-05
]
```

**rubric.md extension** (append to Evaluation Axes):

```markdown
6. **structural-variety** — Do the sub-headers serve the prose? Check: ≤6
   words, Jesse-voice, no generic labels ("Background", "Conclusion",
   "Overview"). Is the blockquote a real one-sentence lift from body prose,
   or a restated summary? Structural shell is guaranteed by the Pydantic
   validator; this axis judges craft.
   Severity: **warning** (structural counts are guaranteed by the pipeline;
   this axis catches "technically compliant but editorially lazy" output).
```

**rubric.md input format note:** The rubric currently shows `"bonus"` in the sections JSON. After Phase 18, when specAd is the bonus type, the body passed to the judge will be the body TEXT from each block concatenated — the judge sees prose, not Portable Text JSON. The `run_llm_judge` caller in `agents/qa/__init__.py` currently passes `sections: dict[str, str]` (string bodies). This interface DOES NOT CHANGE. The planner must audit how `__init__.py` assembles the `sections` dict — it currently reads `state['origin_story']['body']` as a `str`. After Phase 18, `body` is `list[dict]`. The QA orchestrator must concatenate body block texts before passing to the judge.

### Anti-Patterns to Avoid

- **Inline `BodyBlock` in each writer module.** Five copies of the same discriminated union definition = five future maintenance points. Centralize in `graph/blocks.py`.
- **Adding `min_length=2` to the `list[BodyBlock]` annotation.** Anthropic's structured-output schema validator rejects list cardinality constraints (Phase 5 Plan 05-15 regression). Use `@field_validator` instead.
- **Passing the Pydantic `list[BodyBlock]` directly to Sanity.** Sanity expects Portable Text dicts. Always go through `compose_section_body()`.
- **Modifying `build_section_writer_prompt` signature.** Phase 5 D-13 locks this. Thread the STRUCTURE_CONTRACT via `section_guidance` string concatenation, not a new kwarg.
- **Calling `text_to_portable_text(body_str)` for long-read sections after Phase 18.** Replace at every call site in `sanity_client.py`. The tombstone stays for stubs-only backward compatibility but is NOT called in production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block-style dispatch | A custom Portable Text serializer with regex/string matching | `compose_section_body()` + the four builder functions | Consistent `_key` uniqueness; mirrors the existing `text_to_portable_text` pattern exactly |
| Structural count validation | A new Layer-1 deterministic predicate in `rules.py` | `@field_validator` on writer Pydantic models | Layer-1 operates on `body: str` (pre-Phase 18 shape); Pydantic validators run at parse time on the correct data type |
| Retry mechanism for structural failures | New retry logic in the writer agents | The existing `acomplete` retry-once-then-fail path (Phase 5 D-14) | Already handles `OutputParserException` which wraps Pydantic `ValidationError`; adding structural failure to the same lane costs nothing |
| Union type dispatch | A chain of `if isinstance(b, Paragraph) elif isinstance(b, Heading)` | `b.type` string dispatch in `compose_section_body` | After `model_dump()`, all blocks are dicts with a `type` key; string dispatch is simpler and avoids re-importing Pydantic types at the serializer layer |

**Key insight:** The existing `acomplete` retry path in `openrouter_client.py` (lines 169-179) already catches all exceptions from `structured.ainvoke()`, appends the error message to the prompt, and retries once. A Pydantic `ValidationError` (which is what `@field_validator` raises as `ValueError`) is wrapped by `langchain-openai`'s `with_structured_output` into an `OutputParserException` — so the retry path already fires automatically. No new mechanism is needed.

---

## Runtime State Inventory

> Phase 18 is NOT a rename/refactor/migration phase. No runtime state needs auditing.
> No Sanity documents are renamed, no Convex schema fields change, no env vars are renamed.
> Existing Sanity `weeklyIssue` documents with `body: []` (Portable Text arrays) are unaffected
> — the Sanity schema already accepts the Portable Text `block` type with any `style` string.
> Future pipeline runs produce richer Portable Text; existing documents are unchanged.
>
> **Nothing found in all 5 categories — verified by phase scope analysis.**

---

## Common Pitfalls

### Pitfall 1: Sanity Portable Text `style` Acceptance

**What goes wrong:** If Sanity's `weeklyIssue.ts` body field has a custom `styles` array restricting accepted style values, emitting `h2`, `h3`, or `blockquote` blocks will be silently dropped or cause a write error.

**Why it happens:** Sanity's `type: 'block'` defaults to accepting any style, but a schema that explicitly lists `styles: [{ value: 'normal', title: 'Normal' }]` would reject non-listed styles.

**How to avoid:** Verified from `apps/studio/schemas/weeklyIssue.ts` (line 22): the body field is defined as `type: 'array', of: [{ type: 'block' }]` with NO explicit `styles` restriction. Sanity's default `block` type accepts all standard Portable Text styles including `h2`, `h3`, and `blockquote`. **No Sanity schema change needed** (CONTEXT.md canonical_refs confirms this explicitly).

**Warning signs:** Sanity write succeeds (200 OK) but the block is missing from Studio preview. Check Sanity's block type default styles list in `@sanity/block-editor` if this appears.

### Pitfall 2: QA Orchestrator Body Concatenation

**What goes wrong:** `agents/qa/__init__.py` assembles `sections: dict[str, str]` to pass to `run_llm_judge`. After Phase 18, `state['origin_story']['body']` is `list[dict]` (Portable Text blocks), not `str`. If the QA orchestrator reads `body` as a string directly, it will pass `[{...}, {...}]` as a string representation to the judge.

**Why it happens:** `state.py` re-types `SectionContent.body` from `str` to `list[dict]`, but the QA orchestrator `__init__.py` is not a writer and doesn't go through the Pydantic layer — it reads from state directly.

**How to avoid:** The planner must audit `agents/qa/__init__.py` to confirm how it reads section bodies. The fix is a `_extract_body_text(body)` helper that handles both `str` (legacy) and `list[dict]` (Phase 18):

```python
def _extract_body_text(body) -> str:
    if isinstance(body, str):
        return body
    # list[dict] — concatenate text spans
    parts = []
    for block in (body or []):
        for child in block.get('children', []):
            parts.append(child.get('text', ''))
    return ' '.join(parts)
```

**Warning signs:** QA judge receives `"[{'_type': 'block', ..."` as section body string. Judge output is nonsensical or finds errors in Portable Text syntax strings.

### Pitfall 3: LLM JSON-Mode Discriminated Union Coercion

**What goes wrong:** Some LLM providers or model versions struggle to produce the correct `type` discriminator field reliably in JSON mode, producing blocks without a `type` field or with `type: null`.

**Why it happens:** The OpenRouter → Anthropic path (already locked per `openrouter_client.py` D-22.1 `provider: {order: ["Anthropic"]}`) uses `with_structured_output` which passes the Pydantic schema to the API as JSON Schema. Anthropic's API generally handles discriminated unions correctly but the `Literal['h2', 'h3']` on `Heading` (not a single value) is the most likely pain point — it means the same `type` key has two possible values.

**How to avoid:** The `Heading.type: Literal['h2', 'h3']` pattern works in Pydantic v2 discriminated unions (the discriminator field just needs to be a `Literal` — it can list multiple values). Anthropic's API has been observed to handle multi-value Literals correctly through `with_structured_output`. If issues surface in real-mode testing, the fallback is to split into two classes (`H2(type: Literal['h2'])` and `H3(type: Literal['h3'])`) — more verbose but unambiguous.

**Warning signs:** `ValidationError: BodyBlock discriminator 'type' is missing` on real LLM output during Plan 18-05 real-mode smoke. Retry once (D-02 path) — a second failure confirms the schema is incompatible with the model.

### Pitfall 4: Stub-Mode Fixtures Emit `body: str` After Phase 18

**What goes wrong:** `stubs/fixtures.py` functions like `origin_story_output()` still return `{"body": "plain text ..."}`. Stub-mode pipeline runs pass the structural floor silently (because `model_construct()` skips validation), but if any test directly asserts `origin_story['body']` shape, it will see `str` instead of `list[dict]`.

**Why it happens:** `stubs/fixtures.py` is a static file; it doesn't go through the Pydantic layer. Must be manually updated.

**How to avoid:** Update every long-read fixture in `stubs/fixtures.py` to emit a conforming `list[dict]` payload with ≥2 headings + ≥1 blockquote. This is Wave 4 work (after RED tests pass). The CONTEXT.md notes: "planner confirms" stub fixtures need updating.

**Warning signs:** Integration tests that use stub mode emit `body: "string"` → `sanity_client.py` calls `compose_section_body("string")` → `compose_section_body` iterates over characters. The `_extract_body_text` helper in QA (Pitfall 2) also needs to handle this legacy case gracefully.

### Pitfall 5: `text_to_portable_text` Tombstone vs. Active Call Sites

**What goes wrong:** After Phase 18, there should be ZERO calls to `text_to_portable_text(body_str)` for the 5 long-read sections. If any call site is missed in `sanity_client.py`, it converts the `list[dict]` body to a string representation before wrapping in Portable Text, producing malformed blocks.

**Why it happens:** `sanity_client.py` has multiple call sites (confirmed by reading the file): `originStory.body`, `problemStatement.body`, `founderBio.body`, `caseStudy.body`, `bonus.body` all currently call `text_to_portable_text()`. The `_build_bonus()` helper also calls it.

**How to avoid:** The planner must enumerate ALL call sites in `sanity_client.py` that pass `body` to `text_to_portable_text()` and replace each one with `compose_section_body()`. The audit from reading the file identifies these call sites:
  - Line 81 (in `_build_bonus`): `text_to_portable_text(bonus.get("body", ""))`
  - Line 177 (`originStory.body`)
  - Line 183 (`problemStatement.body`)
  - Line 195 (`founderBio.body`)
  - Line 202 (`caseStudy.body`)

`text_to_portable_text` stays in the module as a tombstone for any stubs-mode path that may still emit `body: str` (BigBudgetBonus, JingleBonus, and anything not covered by the structural contract). The docstring is updated to mark it stubs-only.

### Pitfall 6: `test_section_writer_voice_propagation.py` Breaking Change

**What goes wrong:** The Phase 16 NRR-04 byte-equivalence test (`test_section_writer_voice_propagation.py`) patches `build_section_writer_prompt` and captures kwargs. After Phase 18, `SECTION_GUIDANCE` for each writer gains the STRUCTURE_CONTRACT addendum — the `section_guidance` kwarg value changes. If the test asserts an exact string value for `section_guidance`, it will fail.

**Why it happens:** The test only asserts `voice_constraints == "HERZOG_PERSONA_MARKER"` (line 93). It does NOT assert the value of `section_guidance`. Therefore, the STRUCTURE_CONTRACT addendum to `section_guidance` does NOT break this test. The test is safe.

**Confirmation from reading the test:** The test at line 89-96 asserts only two things: (1) `voice_constraints` key is present in `captured`, (2) its value equals the sentinel string. The `section_guidance` content is never asserted. No breaking change.

**Warning signs:** If anyone adds a `section_guidance` assertion to this test in the future without updating the Phase 18 STRUCTURE_CONTRACT wording, it will be fragile. The planner should add a comment to this effect.

### Pitfall 7: `SpecAdBonus` vs. `BigBudgetBonus`/`JingleBonus` Body Shape Split

**What goes wrong:** `bonus.py` returns `out_dict` from `out_obj.model_dump()`. After Phase 18, `SpecAdBonus.body` is `list[dict]` but `BigBudgetBonus.body` and `JingleBonus.body` remain `str`. If `sanity_client.py`'s `_build_bonus()` blindly calls either `compose_section_body()` or `text_to_portable_text()` on whatever it finds in `bonus["body"]`, it will call the wrong one for the non-specAd branches.

**How to avoid:** `_build_bonus()` must branch on `bonus_type` (which is tagged onto `out_dict` by the agent — line 224 of `bonus.py`):

```python
def _build_bonus(state: dict) -> dict:
    bonus = state.get("bonus") or {}
    bonus_type = bonus.get("bonusType") or (state.get("style_brief") or {}).get("bonusType")
    body = bonus.get("body", "")
    if bonus_type == "specAd" and isinstance(body, list):
        body_pt = compose_section_body(body)
    else:
        body_pt = text_to_portable_text(body if isinstance(body, str) else "")
    ...
```

The `isinstance(body, list)` guard is defensive — in real mode specAd always emits `list`, in stub mode it still emits `str` until fixtures are updated.

---

## Code Examples

### Complete OriginStoryOutput after Phase 18

```python
# Source: agents/origin_story.py (Phase 18 modification)
from eisenbalm_pipeline.graph.blocks import BodyBlock
from pydantic import BaseModel, field_validator

class OriginStoryOutput(BaseModel):
    headline: str = ""
    body: list[BodyBlock] = []

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

### Conforming stub fixture body (for fixtures.py update)

```python
def origin_story_output() -> dict:
    return {
        "origin_story": {
            "headline": "The Quiet Foundation, 1987",
            "body": [
                {"type": "paragraph", "text": "Burlington, Vermont. 1987."},
                {"type": "h2", "text": "The founding moment"},
                {"type": "paragraph", "text": "A librarian made a recording."},
                {"type": "blockquote", "text": "The silence is the product."},
                {"type": "h2", "text": "Why not something else"},
                {"type": "paragraph", "text": "Acoustic data has no institutional home."},
            ],
        },
    }
```

### QA orchestrator body extraction (how __init__.py should handle the new shape)

```python
# In agents/qa/__init__.py — defensive text extraction for judge
def _section_body_text(section_value) -> str:
    """Extract plain text from section body — handles both str and list[dict]."""
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

---

## State of the Art

| Old Approach (Pre-Phase 18) | Phase 18 Approach | Impact |
|----------------------------|-------------------|--------|
| `body: str` emitted by writers | `body: list[BodyBlock]` Pydantic discriminated union | Structured at the source; no regex post-processing |
| `text_to_portable_text(body_str)` — splits on `\n\n` | `compose_section_body(blocks)` — dispatches on `block.type` | Exact style control; h2/h3/blockquote emitted correctly |
| All blocks have `style: 'normal'` | Blocks have `style: 'normal' | 'h2' | 'h3' | 'blockquote'` | Activates dead-coded PortableTextRenderer primitives |
| QA judge has 5 axes | QA judge has 6 axes (+ `structural-variety`) | Catches "2 sub-heads labelled 'Background'/'Conclusion'" pattern |
| Frontend: 0 `<h2>`, 0 `<blockquote>` per section | Frontend: ≥2 `<h2>` or `<h3>`, ≥1 `<blockquote>` per section | User-perceived: sections become scannable 3-4 chunk reads |

**Deprecated/outdated after Phase 18:**
- `text_to_portable_text(body_str)` for long-read writer sections — replaced by `compose_section_body(blocks)`. Kept as tombstone for BigBudget/Jingle bonus branches and any stubs-only backward compat.

---

## Wave / Dependency Ordering

Honoring CLAUDE.md hard rule (contract change first):

**Wave 0 — Contract + RED tests (2 plans, can run same day)**
- Plan 18-00: Amend `docs/API_CONTRACTS.md §7` (SectionContent.body, CaseStudyContent.body, BonusContent.body: `str` → `list[dict]`), `§2.2` (confirm compose_section_body call path in the write shape description), `§2.4` (document new helpers). Write MEL-01..MEL-08 to REQUIREMENTS.md.
- Plan 18-01: RED-first test scaffold — `test_writer_structural_floor.py` (parametrized over 5 writers × 2 contracts = 10 tests) + `test_qa_structural_axis.py` (1 test for `structural-variety` in `JudgeFinding.axis`) + `test_bonus_specad_only.py` (negative test: BigBudget + Jingle have no floor validator). All tests fail at this commit. Baseline pytest count: 190.

**Wave 1 — Lib + State layer (1 plan)**
- Plan 18-02: Extend `lib/portable_text.py` with 4 block builders + `compose_section_body`. Create `graph/blocks.py` with `BodyBlock` union. Re-type `graph/state.py` body fields. Unblock Wave 0 tests that test helpers.

**Wave 2 — Writers (1 plan, 5 agents in parallel within the plan)**
- Plan 18-03: Update 5 writer Pydantic models + SECTION_GUIDANCE + `sanity_client.py` call sites. All RED tests turn GREEN for writer-floor contracts.

**Wave 3 — QA axis (1 plan)**
- Plan 18-04: Extend `judge.py` axis Literal. Extend `rubric.md`. Audit `agents/qa/__init__.py` body-text extraction. RED → GREEN for QA test.

**Wave 4 — Fixtures + Verification (1 plan)**
- Plan 18-05: Update `stubs/fixtures.py` long-read functions. Run full pytest suite — assert ≥200 passing (190 baseline + 10 new MEL tests). Author `18-VERIFICATION.md`. Trigger production pipeline run + GROQ post-condition check + HTML scan + Andrew UAT.

**Total: 6 plans (18-00 through 18-05).** This is one more than the ROADMAP's 5-stub count. The ROADMAP stubs are coarse; the contract plan (18-00) is separate from the RED test plan (18-01) to keep the first plan machine-autonomous (contract doc edit only) and the second plan autonomous too. If the planner finds it cleaner to merge 18-00 and 18-01, that's within discretion.

---

## Open Questions

1. **`agents/qa/__init__.py` body extraction**
   - What we know: `run_llm_judge` receives `sections: dict[str, str]` (string bodies). After Phase 18, `state` bodies are `list[dict]`.
   - What's unclear: the exact code path in `agents/qa/__init__.py` that assembles the `sections` dict. This file was NOT read during research (it was not in the `files_to_read` list and is not one of the ~20 files already read).
   - Recommendation: Planner reads `agents/qa/__init__.py` in Wave 3 (Plan 18-04) and adds `_section_body_text()` extraction before assembling the judge input. The helper design is fully specified in the Code Examples section above.

2. **`stubs/fixtures.py` problem_output fixture shape**
   - What we know: `problem_output()` currently returns `problem_statement: {"body": "plain text", "pdfContent": {...}}`. After Phase 18, `body` must be `list[dict]`. The `pdfContent` field stays unchanged (D-03).
   - What's unclear: whether `sanity_client._build_pdf_content()` reads `state['problem_statement']['pdfContent']` — confirmed it does. The pdfContent path is safe.
   - Recommendation: Update `problem_output()` fixture to emit `body: list[dict]` conforming shape; `pdfContent` dict unchanged.

3. **Cost baseline for ≤15% cap verification**
   - What we know: Phase 5 Plan 05-15 noted token capture is approximate (zeros recorded on structured-output path due to langchain-openai 1.2.1 not exposing `usage_metadata` on `with_structured_output` wrapper). The `state['cost_per_agent']` surface is not fully reliable.
   - What's unclear: how the planner verifies the ≤15% criterion (MEL-07) given approximate token capture.
   - Recommendation: Verify cost via a controlled real-mode test (Plan 18-05) that runs one writer agent twice (once with old prompt, once with STRUCTURE_CONTRACT) and measures `tokens_in` difference. The STRUCTURE_CONTRACT is ~80 tokens; typical writer input is ~800-1200 tokens → <10% increase. The retry-once adds at most one full call: worst case ≤5 retries across 5 writers = +100% on retrying runs, but expected-case is 0 retries once the model is tuned. Document this as an expected-case estimate with worst-case disclaimer.

---

## Environment Availability

> Step 2.6: SKIPPED — Phase 18 is purely pipeline-side code and documentation changes.
> No new external tools, services, CLIs, runtimes, databases, or package managers are required.
> All dependencies (pydantic 2.13.4, pytest, pytest-asyncio) are already installed in the venv.

---

## Validation Architecture

> `workflow.nyquist_validation: true` — section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (existing, packages/pipeline/) |
| Config file | `packages/pipeline/pyproject.toml` (existing) |
| Quick run command | `cd packages/pipeline && uv run pytest tests/agents/test_origin_story.py tests/agents/test_problem.py -x -q` |
| Full suite command | `cd packages/pipeline && uv run pytest -x -q` |
| Web test command | `pnpm --filter web test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEL-01 | ≥2 h2/h3 blocks in each of 5 section bodies | unit (parametrized) | `uv run pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_headings -x` | ❌ Wave 0 (Plan 18-01) |
| MEL-02 | ≥1 blockquote block in each of 5 section bodies | unit (parametrized) | `uv run pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_blockquote -x` | ❌ Wave 0 (Plan 18-01) |
| MEL-03 | Voice tripwires still green after body-shape change | unit (existing) | `uv run pytest tests/test_section_writer_voice_propagation.py -x` | ✅ (Phase 16) |
| MEL-04 | `structural-variety` axis present in JudgeFinding Literal | unit | `uv run pytest tests/agents/test_qa_structural_axis.py -x` | ❌ Wave 0 (Plan 18-01) |
| MEL-05 | Zero-regression: ≥190 pipeline tests, ≥234 web tests | regression | `uv run pytest -q && pnpm --filter web test:unit` | ✅ (existing suite) |
| MEL-06 | Live HTML: ≥2 `<h2>` + ≥1 `<blockquote>` per section | e2e/manual | Shell: `curl ... | grep -c '<h2>'` in 18-VERIFICATION.md | ❌ Wave 4 (Plan 18-05) |
| MEL-07 | Cost per writer call ≤+15% | integration (manual) | Controlled real-mode call, token diff logged | ❌ Wave 4 estimate |
| MEL-08 | BigBudget + Jingle do NOT have structural floor validator | unit (negative) | `uv run pytest tests/agents/test_bonus_specad_only.py -x` | ❌ Wave 0 (Plan 18-01) |

### Tripwires That MUST Stay Green

All tripwires from CONTEXT.md canonical_refs (inherited):

```
apps/web/__tests__/deliberation-no-model-names.test.ts (DEL-04)
apps/web/__tests__/game-sandbox.test.ts (Phase 7)
apps/web/__tests__/issue-page-typography.test.ts (Phase 10 DES-01..DES-06)
apps/web/__tests__/deliberation-conversation.test.ts (Phase 13)
apps/web/__tests__/podcast-slot.test.ts (Phase 13)
apps/web/__tests__/theme-aa-tones.test.ts (Phase 14)
apps/web/__tests__/shop-page.test.ts (Phase 15)
apps/web/__tests__/narrator-chip.test.ts (Phase 16)
Phase 8 commerce sentinel suite (29 tests)
packages/pipeline/tests/test_section_writer_voice_propagation.py (Phase 16 NRR-04)
packages/pipeline/tests/test_voice.py (Phase 16 NRR-10)
```

### Sampling Rate

- **Per task commit:** `uv run pytest tests/agents/test_writer_structural_floor.py -x -q`
- **Per wave merge:** `uv run pytest -x -q` (full pipeline suite)
- **Phase gate:** Full pipeline suite ≥200 passing + web vitest ≥234 passing + 18-VERIFICATION.md HTML scan green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/pipeline/tests/agents/test_writer_structural_floor.py` — covers MEL-01, MEL-02 (parametrized over 5 writers)
- [ ] `packages/pipeline/tests/agents/test_qa_structural_axis.py` — covers MEL-04
- [ ] `packages/pipeline/tests/agents/test_bonus_specad_only.py` — covers MEL-08 (negative: BigBudget/Jingle have no floor)

*(The existing test suite covers MEL-03 and MEL-05 without new files.)*

---

## Sources

### Primary (HIGH confidence — read directly from codebase)

- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` — exact 40-line helper pattern; UUID key convention confirmed
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` — retry-once-then-fail mechanism (lines 169-179); `OutputParserException` catch confirmed
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — `@agent_node` decorator; generic `except Exception` catches and sets `status='failed'`; `ValueError` (from `field_validator`) propagates through the retry path
- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` — current writer pattern; SECTION_GUIDANCE string; `OriginStoryOutput(body: str)` confirmed
- `packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` — `PdfContent._exactly_three` `@field_validator` pattern (the exact template for Phase 18 structural floor); `pdfContent` shape confirmed unchanged
- `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` — three-branch routing; `SpecAdBonus(body: str)` confirmed; `BigBudgetBonus.storyboards` visual variety confirmed
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` — `JudgeFinding.axis` Literal (5 values); single-call `run_llm_judge`; narrator-addendum pattern
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` — 5 existing axes; output format JSON; severity guide
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `SectionContent.body: str`; `CaseStudyContent.body: str`; `BonusContent.body: str` all confirmed as current types
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — ALL 5 call sites of `text_to_portable_text()` for long-read sections enumerated (lines 81, 177, 183, 195, 202)
- `packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py` — confirms `body: str` in all long-read stub fixtures
- `packages/pipeline/pyproject.toml` — `pydantic==2.13.4` confirmed
- `apps/web/components/issue/PortableTextRenderer.tsx` — h2/h3/blockquote handlers confirmed (lines 34-52); zero frontend change needed
- `apps/studio/schemas/weeklyIssue.ts` — `type: 'array', of: [{type: 'block'}]` with NO custom `styles` restriction confirmed; no Sanity schema change needed
- `packages/pipeline/tests/test_section_writer_voice_propagation.py` — test assertions (lines 89-96) confirmed: ONLY checks `voice_constraints` kwarg, NOT `section_guidance` content; STRUCTURE_CONTRACT addendum does NOT break this test

### Secondary (MEDIUM confidence — verified from CONTEXT.md with code corroboration)

- `docs/API_CONTRACTS.md §7, §2.2, §2.4` — not directly read (too large) but CONTEXT.md canonical_refs section provides verbatim field shapes + modification instructions; corroborated by `graph/state.py` and `sanity_client.py` actuals
- Pydantic v2.13.4 `Field(discriminator='type')` syntax — training knowledge verified against the `pyproject.toml` pin and corroborated by the Phase 13 chronicler turns pattern (also a discriminated union in this codebase)

### Tertiary (LOW confidence — flagged)

- `agents/qa/__init__.py` body-text extraction — NOT read during research. Risk documented in Open Questions #1. LOW confidence that the exact orchestrator code is known; planner must read this file in Wave 3 before implementing.
- Cost ≤15% cap (MEL-07) — token capture on structured-output path is approximate (noted in STATE.md Phase 5 Plan 05-15 deviations). The 80-token STRUCTURE_CONTRACT estimate is training-data reasoning, not measured.

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps, Pydantic v2 discriminated union): HIGH — pinned version read, syntax confirmed against codebase pattern
- Architecture (wave ordering, modification points): HIGH — all 13 modification-point files read
- Pitfalls (5 documented): HIGH for Pitfalls 1, 5, 6, 7 (confirmed from code); MEDIUM for Pitfall 2 (QA orchestrator not read); MEDIUM for Pitfall 3 (Anthropic Literal behavior — training-data knowledge)
- MEL requirements proposal: HIGH — derived from ROADMAP SC 1-7 + CONTEXT D-01..D-05 verbatim; planner has full derivation logic

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable codebase; no fast-moving external dependencies)
