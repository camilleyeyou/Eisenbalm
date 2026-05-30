---
phase: 18
plan: 04
subsystem: pipeline-writers
tags: [pydantic, portable-text, writer-schema, structural-floor, sanity-write]
dependency_graph:
  requires: [18-03]
  provides: [list[BodyBlock] body in 5 writers + sanity_client rewired]
  affects: [sanity_client.py, origin_story.py, problem.py, founder_bio.py, case_study.py, bonus.py]
tech_stack:
  added: []
  patterns: [pydantic field_validator, discriminated union, compose_section_body dispatch]
key_files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
    - packages/pipeline/tests/agents/test_bonus.py
    - packages/pipeline/tests/agents/test_origin_story.py
    - packages/pipeline/tests/agents/test_problem.py
    - packages/pipeline/tests/agents/test_founder_bio.py
    - packages/pipeline/tests/agents/test_case_study.py
    - packages/pipeline/tests/test_pipeline_real_mode.py
decisions:
  - "Payload builders updated to compute word count from list[BodyBlock] bodies defensively"
  - "CaseStudyOutput gained subjectName field (test_writer_structural_floor.py required it)"
  - "QA _body_to_text() helper added inline (Plan 18-05 scope pull-forward — blocking Rule 3)"
  - "test fixtures updated to use model_construct() for wiring/isolation tests bypassing structural floor"
metrics:
  duration: 19min
  completed: "2026-05-30"
  tasks: 3
  files: 13
---

# Phase 18 Plan 04: Writer Pydantic and Prompts Summary

Re-type 5 long-read writer Pydantic schemas from `body: str` to `body: list[BodyBlock]`, add `_enforce_structural_floor` validators, inject `STRUCTURE_CONTRACT` into each writer's guidance strings, and rewire 5 `sanity_client.py` call sites from `text_to_portable_text` to `compose_section_body`.

## Per-Writer Diff Summary

| Writer | Lines Added | Lines Removed | Key Changes |
|--------|------------|---------------|-------------|
| origin_story.py | +38 | -3 | STRUCTURE_CONTRACT, list[BodyBlock] body, validator, payload builder |
| problem.py | +48 | -3 | STRUCTURE_CONTRACT, list[BodyBlock] body, validator, D-03 pdfContent UNCHANGED |
| founder_bio.py | +46 | -4 | STRUCTURE_CONTRACT on both GUIDANCE_VERIFIED + GUIDANCE_ANONYMOUS, validator |
| case_study.py | +48 | -3 | STRUCTURE_CONTRACT on both guidance variants, subjectName field added, validator |
| bonus.py | +39 | -5 | SpecAdBonus re-typed, STRUCTURE_CONTRACT in _build_spec_ad_prompt ONLY (D-04) |

## D-03 (pdfContent) Verification

```
grep -c "pdfContent: PdfContent = Field(default_factory=PdfContent)" agents/problem.py
=> 1  (UNCHANGED — Phase 6 WeasyPrint contract preserved)
```

## D-04 (BigBudget/Jingle) Verification

```
grep -n "body: str = Field" agents/bonus.py
=> line 59: BigBudgetBonus.body: str = Field(default="", description="200-400 words on concept")
=> line 70: JingleBonus.body: str = Field(default="", description="100-200 words on concept")
=> line 88: comment only: (was: body: str = Field(...))
```

BigBudget and Jingle body fields are unchanged byte-for-byte. SpecAdBonus is the only bonus class with `_enforce_structural_floor`. `_build_big_budget_prompt` and `_build_jingle_prompt` are byte-unchanged.

## Test State Matrix (Plan 18-02 RED tests)

| Test File | Tests | Status After 18-04 | Remaining RED |
|-----------|-------|-------------------|---------------|
| test_writer_structural_floor.py | 20 | GREEN (20/20) | 0 |
| test_bonus_specad_only.py | 3 | GREEN (3/3) | 0 |
| test_portable_text_blocks.py | 10 | GREEN (turned GREEN in 18-03) | 0 |
| test_qa_structural_axis.py | 1 | RED (awaits Plan 18-05) | 1 |
| **Total** | **34** | **33 GREEN** | **1** |

## Voice Propagation Tripwire

```
uv run pytest tests/test_section_writer_voice_propagation.py tests/test_voice.py -q
=> 8 passed in 0.19s (Phase 16 NRR-04 byte-equivalence preserved)
```

STRUCTURE_CONTRACT is appended to `section_guidance` (not `voice_constraints`), so the voice propagation test (which only asserts `voice_constraints == "HERZOG_PERSONA_MARKER"`) stays green.

## Full Suite

```
uv run pytest --ignore=tests/agents/test_qa_structural_axis.py -q
=> 224 passed, 33 skipped, 6 warnings
```

Only `test_qa_structural_axis.py` remains RED — awaits Plan 18-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] QA orchestrator body extraction (_body_to_text)**
- **Found during:** Task 3 verification run
- **Issue:** `agents/qa/__init__.py::_extract_sections` read body fields as strings via `.get("body", "")`. After Phase 18, bodies are `list[dict]`. QA regex predicates raised `TypeError: expected string or bytes-like object, got 'list'` in the pipeline wiring test.
- **Fix:** Added `_body_to_text()` helper to `qa/__init__.py` that handles both `str` (BigBudget/Jingle/stubs) and `list[dict]` (Phase 18 narrative bodies). Updated `_extract_sections` to call it for all 4 narrative + bonus body reads. This is the Plan 18-05 scope (Pitfall 2 from RESEARCH) pulled forward as a Rule 3 blocking fix.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py`
- **Commit:** 51e2f02

**2. [Rule 1 - Bug] test_bonus.py fixture used str body**
- **Found during:** Task 3 verification
- **Issue:** `test_bonus.py::test_spec_ad_branch` constructed `SpecAdBonus(body="B"*300)` — now invalid since body is `list[BodyBlock]`.
- **Fix:** Updated to use `SpecAdBonus(headline="H", body=[conforming_list])` with valid BodyBlock dicts.
- **Files modified:** `packages/pipeline/tests/agents/test_bonus.py`
- **Commit:** 51e2f02

**3. [Rule 1 - Bug] test_origin_story.py, test_problem.py, test_founder_bio.py, test_case_study.py — str body in fixtures**
- **Found during:** Task 3 full suite run
- **Issue:** Agent tests constructed writer outputs with `body="B"` or `body="B"*400` — invalid after Phase 18 body re-type.
- **Fix:** Replaced all such constructions with `WriterClass.model_construct(headline="H", body=[])` (wiring tests) or `body=[]` (isolation tests that don't check body truthiness). One assertion updated from `body == "B"` to `body == []`.
- **Files modified:** 4 test files + test_pipeline_real_mode.py
- **Commit:** 51e2f02

**4. [Rule 1 - Bug] _bonus_payload word count for list body**
- **Found during:** Task 2/3 integration
- **Issue:** `_bonus_payload` in `bonus.py` called `body.split()` which fails on `list`.
- **Fix:** Added `isinstance(body, list)` branch computing word count from block text attributes, mirroring the pattern used in the 4 narrative writer payload builders.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`
- **Commit:** 51e2f02

**5. [Rule 2 - Missing Critical] CaseStudyOutput.subjectName field**
- **Found during:** Task 1 — test_writer_structural_floor.py line 80 calls `CaseStudyOutput(subjectName="S", headline="H", body=body)`
- **Issue:** Original `CaseStudyOutput` had only `headline` and `body` — no `subjectName`. The test requires it.
- **Fix:** Added `subjectName: str = ""` to `CaseStudyOutput`, mirroring the payload builder which was already reading `case_study["subjectName"]` from state.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py`
- **Commit:** f22c5a4

**6. [Deviation] Worktree base branch behind master**
- **Found during:** Initial import verification
- **Issue:** Worktree was created from the pre-18-03 commit. `graph/blocks.py` and updated `portable_text.py` + `state.py` from Plan 18-03 were missing.
- **Fix:** `git merge master --no-edit` (fast-forward to 050f0b6 — 18-03 complete commit). No code conflict.

## Known Stubs

None — all 5 writers now emit `list[BodyBlock]` in production. BigBudget/Jingle body remains `str` per D-04 carve-out (intentional, not a stub). QA `_body_to_text` handles the str→text path defensively for those branches.

## Self-Check: PASSED
