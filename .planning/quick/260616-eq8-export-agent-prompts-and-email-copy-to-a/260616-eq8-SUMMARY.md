---
phase: quick-260616-eq8
plan: "01"
subsystem: docs
tags: [export, client-copy, email, agent-prompts, docx]
dependency_graph:
  requires: []
  provides: [docs/client-editable/EISENBALM-EDITABLE-COPY.md, docs/client-editable/EISENBALM-EDITABLE-COPY.docx, scripts/build_editable_docx.py]
  affects: []
tech_stack:
  added: [python-docx]
  patterns: [PEP-723-inline-deps, uv-run]
key_files:
  created:
    - docs/client-editable/EISENBALM-EDITABLE-COPY.md
    - docs/client-editable/EISENBALM-EDITABLE-COPY.docx
    - scripts/build_editable_docx.py
  modified: []
decisions:
  - "11 prompt blocks exported (not 10): the plan text says 10 but the sources_to_read list contains 11 files (scout, advocate, researcher, calibrator, editor, editor-final, game, design, bonus-big-budget, bonus-jingle, bonus-spec-ad); all 11 are present verbatim"
  - "---  dividers preserved as 40-char box-drawing rule in .docx (python-docx has no native HR; visual separator reads clearly in Google Docs)"
  - "PEP 723 inline dependency header added to script so uv resolves python-docx automatically without a requirements file"
metrics:
  duration: "~8 min"
  completed: "2026-06-16"
  tasks: 2
  files: 3
---

# Quick 260616-eq8: Export Agent Prompts and Email Copy — Summary

One consolidated, Google-Docs-ready document created in two matching formats: a committed Markdown master and a generated .docx that uploads directly to Google Drive.

## What Was Built

**docs/client-editable/EISENBALM-EDITABLE-COPY.md** — Markdown source of truth. Contains:
- "How to use this document" intro with two-rule editing contract and Jesse-voice reminder
- PART 1: 8 email blocks (E1 OrderConfirmation through E8 Replenishment), each with `SOURCE: templates/<File>.tsx`, subject line from `subjects.ts`, verbatim body prose from the TSX template, and a "Keep these placeholders exactly" line
- Email footer block with `SOURCE: layouts/Footer.tsx`, verbatim charity/postal/unsubscribe copy
- PART 2: 11 agent prompt blocks (scout through bonus-spec-ad), each with `SOURCE: prompts/<file>.md`, verbatim text from between `<!-- PROMPT START -->` and `<!-- PROMPT END -->`, and a token-preservation line
- EXCLUDED section covering voice.py, QA rubric, and Chronicler

**docs/client-editable/EISENBALM-EDITABLE-COPY.docx** — Generated .docx. Content mirrors the Markdown master (headings mapped to docx Heading 1/2/3, body paragraphs preserved verbatim, `---` separators rendered as a visual rule). Valid docx confirmed via `unzip -l` showing `word/document.xml`.

**scripts/build_editable_docx.py** — Re-runnable generator. PEP 723 inline dep (`python-docx`), idempotent (overwrites on re-run), paths resolved relative to repo root. Run: `uv run --with python-docx python scripts/build_editable_docx.py`.

## Verification Results

- `docs/client-editable/EISENBALM-EDITABLE-COPY.md`: non-empty, 8 `SOURCE: templates/` labels, 11 `SOURCE: prompts/` labels, 21 "Keep these placeholders exactly" lines, "How to use this document" intro, EXCLUDED note
- `docs/client-editable/EISENBALM-EDITABLE-COPY.docx`: non-empty, valid docx (`word/document.xml` confirmed)
- `git status --porcelain packages/`: clean — no source file modified
- `uv run --with python-docx python scripts/build_editable_docx.py`: runs cleanly and regenerates .docx

## Deviations from Plan

**1. [Rule 1 - Clarification] 11 prompt blocks, not 10**
- **Found during:** Task 1
- **Issue:** Plan text says "10 prompt files" but `<sources_to_read>` lists 11 (scout, advocate, researcher, calibrator, editor, editor-final, game, design, bonus-big-budget, bonus-jingle, bonus-spec-ad). The automated verify command `grep -qx 10` in the plan is inconsistent with the actual source list.
- **Fix:** Exported all 11 files. The verify script in the plan has a typo; the correct count is 11. All listed files are present.
- **Files modified:** docs/client-editable/EISENBALM-EDITABLE-COPY.md

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 2735c92 | feat(quick-260616-eq8-01): author editable copy markdown master |
| 2 | 5104aef | feat(quick-260616-eq8-02): generate .docx from markdown master via uv + python-docx |

## Self-Check: PASSED

- `docs/client-editable/EISENBALM-EDITABLE-COPY.md`: FOUND (459 lines)
- `docs/client-editable/EISENBALM-EDITABLE-COPY.docx`: FOUND (non-empty, word/document.xml confirmed)
- `scripts/build_editable_docx.py`: FOUND
- Commits 2735c92 and 5104aef: FOUND
- `packages/` unchanged: CONFIRMED
