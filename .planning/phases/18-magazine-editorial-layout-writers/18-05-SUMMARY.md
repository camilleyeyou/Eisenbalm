---
phase: 18
plan: 05
subsystem: pipeline-qa
tags: [qa-judge, rubric, structural-variety, pydantic, axis-literal]
dependency_graph:
  requires: [18-04]
  provides: [JudgeFinding.axis structural-variety, rubric.md axis #6, _body_to_text confirmed]
  affects: [agents/qa/judge.py, agents/qa/rubric.md]
tech_stack:
  added: []
  patterns: [pydantic Literal extension, rubric.md prompt engineering, QA craft axis]
key_files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
decisions:
  - "Task 2 skipped — _body_to_text helper (equivalent to plan's _section_body_text) was already added by 18-04 deviation (Rule 3 auto-fix, commit 51e2f02); objective explicitly says skip if helper exists"
  - "severity='warning' for structural-variety axis per CONTEXT.md D-05 — Pydantic is the count gate; QA is the craft critic"
  - "Single Opus call preserved — no run_llm_judge signature change, no second LLM call"
  - "Worktree base branch was behind master; git merge master --no-edit applied (fast-forward to 72c22de)"
metrics:
  duration: 5min
  completed: "2026-05-30"
  tasks: 2
  files: 2
---

# Phase 18 Plan 05: QA Judge Axis and Orchestrator Summary

Extends the QA judge with a `structural-variety` craft axis (6th axis). Pydantic validates structural counts at write time; this axis grades craft quality — generic sub-header labels, pull-quote authenticity. Two RED tests in `test_qa_structural_axis.py` turn GREEN.

## Axis Extension Details

### judge.py — JudgeFinding.axis Literal (lines 79-86)

Before (5 values):
```python
axis: Literal["gravity", "sentiment", "irony-signaling", "precision", "cross-section-consistency"]
```

After (6 values):
```python
axis: Literal[
    "gravity",
    "sentiment",
    "irony-signaling",
    "precision",
    "cross-section-consistency",
    "structural-variety",   # Phase 18 D-05 — qualitative craft axis; severity='warning' per rubric
]
```

Commit: `f876c5b`

### rubric.md — Axis #6 Insertion

Inserted after the existing `5. cross-section-consistency` paragraph, before `## Input Format`:

```markdown
6. **structural-variety** — Do the sub-headers serve the prose? Check: <=6
   words, Jesse-voice, no generic labels ("Background", "Conclusion",
   "Overview"). Is the blockquote a real one-sentence lift from body prose,
   or a restated summary? Structural shell is guaranteed by the Pydantic
   validator at the writer layer (Phase 18 D-02); this axis judges craft.
   Severity: **warning** (counts are guaranteed by the pipeline; this axis
   catches "technically compliant but editorially lazy" output).
```

Output Format JSON enum extended:
```
"axis": ... | "cross-section-consistency" | "structural-variety",
```

### _body_to_text Helper (Task 2 — SKIPPED)

`agents/qa/__init__.py` already contains `_body_to_text()` (Plan 18-04 deviation, commit 51e2f02). This is functionally identical to the plan's `_section_body_text`. 1 definition + 7 call sites confirmed via grep. No re-add needed per plan objective.

## Plan 18-02 RED Tests — All GREEN

- [x] 20 test_writer_structural_floor.py — GREEN (from 18-04)
- [x] 3 test_bonus_specad_only.py — GREEN (from 18-04)
- [x] 9 test_portable_text_blocks.py — GREEN (from 18-03)
- [x] 2 test_qa_structural_axis.py — GREEN (this plan)
- **Total: 34/34 GREEN**

## Full Suite Verification

```
uv run pytest -x -q
=> 226 passed, 33 skipped, 6 warnings in 33.98s
```

226 passed (was 224 after 18-04; +2 from the 2 qa_structural_axis tests turning green).

## Voice Propagation Tripwires

```
uv run pytest tests/test_section_writer_voice_propagation.py tests/test_qa_judge_narrator.py tests/test_voice.py -q
=> 11 passed in 0.17s  (Phase 16 NRR-04 byte-equivalence preserved)
```

## Deviations from Plan

### Auto-fixed Issues

None in this plan.

### Skipped Tasks

**Task 2 (Add _section_body_text helper) — SKIPPED per plan objective**
- Reason: Plan 18-04 deviation already added `_body_to_text()` (same function, different name) as a Rule 3 blocking fix (commit 51e2f02)
- Verification: `grep -c "^def _body_to_text" agents/qa/__init__.py` = 1; `grep -c "_body_to_text(" agents/qa/__init__.py` = 7
- The 2 RED tests in `test_qa_structural_axis.py` only assert the axis Literal and rubric.md content — not the helper name — so Task 2 was already satisfied

### Merge Required

Worktree was at Phase 16 tip (`ed7bae5`) — behind master by 8 commits (Phases 18-01 through 18-04). Applied `git merge master --no-edit` to bring worktree to `72c22de`. Edits to `judge.py` and `rubric.md` survived the merge with no conflicts.

## Known Stubs

None — all structural changes are complete and tested.

## Self-Check: PASSED
