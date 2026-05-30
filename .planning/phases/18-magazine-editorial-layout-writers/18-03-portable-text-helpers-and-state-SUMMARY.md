---
phase: 18-magazine-editorial-layout-writers
plan: "03"
subsystem: pipeline/lib + pipeline/graph
tags: [portable-text, pydantic, state, discriminated-union, body-blocks]
dependency_graph:
  requires: [18-01, 18-02]
  provides: [portable_text_builders, BodyBlock_union, list_dict_body_fields]
  affects: [18-04-writers, 18-05-qa-axis, 18-06-fixtures-verification]
tech_stack:
  added: []
  patterns:
    - Pydantic v2 discriminated union with Field(discriminator='type')
    - Portable Text block builder pattern (mirrors text_to_portable_text)
    - TypedDict body field re-typed to list[dict] (Pydantic enforces at write time)
key_files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py
  modified:
    - packages/pipeline/src//eisenbalm_pipeline/lib/portable_text.py
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
decisions:
  - "BodyBlock union placed in graph/blocks.py (new sibling to state.py) to avoid circular imports when writers import both DispatchState and BodyBlock"
  - "compose_section_body handles both dict (production model_dump path) and attr-style Pydantic instances (defensive/test path)"
  - "text_to_portable_text preserved as tombstone per D-04 (BigBudget/Jingle bonus branches + stub fixtures)"
  - "body: list[dict] on TypedDicts (not list[BodyBlock]) per CONTEXT D-01 — TypedDict cannot carry discriminated union; Pydantic at each writer enforces shape"
metrics:
  duration: "~8 min"
  completed_date: "2026-05-30"
  tasks: 3
  files: 3
---

# Phase 18 Plan 03: Portable Text Helpers and State — Summary

Lib + state substrate that Plans 18-04 / 18-05 / 18-06 consume: 4 typed block builders + compose_section_body serializer in lib/portable_text.py, shared BodyBlock discriminated union in graph/blocks.py, and list[dict] body fields in state.py TypedDicts.

## What Was Built

### Task 1: lib/portable_text.py extended (+128 lines)

Four new block builder functions appended after the `text_to_portable_text` tombstone:

- `block_paragraph(text: str) -> dict` — style='normal'
- `block_h2(text: str) -> dict` — style='h2'
- `block_h3(text: str) -> dict` — style='h3'
- `block_blockquote(text: str) -> dict` — style='blockquote'
- `compose_section_body(blocks: list) -> list[dict]` — dispatches on `type` field

All builders follow the same `_type='block'`, `_key='block-{8hex}'`, `markDefs=[]`, single-span pattern as `text_to_portable_text`. Unknown `type` values fall back to `block_paragraph`. Empty input returns empty list. `text_to_portable_text` preserved as tombstone.

Commit: `593e88f`

### Task 2: graph/blocks.py created (55 lines)

New file with the shared `BodyBlock` discriminated union:

```python
class Paragraph(BaseModel):    # type: Literal['paragraph'] = 'paragraph'
class Heading(BaseModel):      # type: Literal['h2', 'h3']
class Blockquote(BaseModel):   # type: Literal['blockquote'] = 'blockquote'

BodyBlock = Annotated[Union[Paragraph, Heading, Blockquote], Field(discriminator='type')]
```

Pydantic v2.13.4 discriminator correctly routes `{type:'h2', ...}` → `Heading`, `{type:'paragraph', ...}` → `Paragraph`, `{type:'blockquote', ...}` → `Blockquote`.

Commit: `acfca4f`

### Task 3: graph/state.py — 3 body fields re-typed (3 lines changed)

Three `body: str` fields changed to `body: list[dict]` with Phase 18 D-01 inline comments:

- `SectionContent.body` — was `str`, now `list[dict]`
- `CaseStudyContent.body` — was `str`, now `list[dict]`
- `BonusContent.body` — was `str`, now `list[dict]` (TypedDict permissive; SpecAdBonus uses list[BodyBlock]; BigBudget/Jingle still str at writer-Pydantic layer per D-04)

No other fields touched. All existing TypedDicts, imports, and the DispatchState unchanged.

Commit: `6919479`

## Test Results

**Plan 18-02 lib RED tests → GREEN (9/9):**
```
cd packages/pipeline && uv run pytest tests/lib/test_portable_text_blocks.py -q
9 passed in 0.02s
```

**Full pipeline suite (excluding still-RED Wave 2/3 tests):**
```
cd packages/pipeline && uv run pytest --ignore=tests/agents/test_writer_structural_floor.py --ignore=tests/agents/test_qa_structural_axis.py --ignore=tests/agents/test_bonus_specad_only.py -q
201 passed, 33 skipped in 38.72s
```

**Writer-floor + QA-axis RED tests still correctly RED (not collection errors):**
```
17 failed, 5 passed — failing assertions, not import errors
```

**No new pip dependency:** `pyproject.toml` unchanged.

## Deviations from Plan

None — plan executed exactly as written.

The worktree was created before Plans 18-01 and 18-02 ran. A `git merge master` fast-forward was needed at the start to bring in the RED test files from Plan 18-02. This is not a deviation; it's standard worktree synchronization.

## Known Stubs

None. This plan is purely infrastructure (lib helpers + types + state re-typing). No data flows through yet — Plan 18-04 wires writers to use `compose_section_body`, Plan 18-06 updates fixtures.

## Self-Check: PASSED

Files exist:
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` — FOUND (5 functions: text_to_portable_text + 4 builders + compose_section_body)
- `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py` — FOUND (Paragraph, Heading, Blockquote, BodyBlock)
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — FOUND (3 body: list[dict] fields)

Commits exist:
- `593e88f` feat(18-03): extend portable_text.py
- `acfca4f` feat(18-03): create graph/blocks.py
- `6919479` feat(18-03): re-type body fields in state.py

Test counts: 9 lib tests GREEN, 201 total passing (no regression), 17 writer/QA RED tests still RED (Wave 2/3 work).
