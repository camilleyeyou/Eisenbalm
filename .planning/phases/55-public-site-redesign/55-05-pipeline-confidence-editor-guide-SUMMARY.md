---
phase: 55-public-site-redesign
plan: 05
subsystem: pipeline
tags: [sanity, pipeline, editor-guide]
requires: []
provides:
  - selectionDeliberation.editorConfidence written by write_issue_draft (valid 0-1 only)
  - frontPage carry-forward across pipeline re-runs (draft preferred)
  - EDITOR_GUIDE Front Page section
affects: [55-13 Railway deploy]
key-files:
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - apps/studio/EDITOR_GUIDE.md
  created:
    - packages/pipeline/tests/test_sanity_write_editor_confidence.py
    - packages/pipeline/tests/test_sanity_write_frontpage_carry.py
decisions:
  - Invalid confidence is omitted, never defaulted
  - frontPage lookup failure logs a warning and never blocks the draft write
metrics:
  tasks: 3
  completed: 2026-10-17
---

# Phase 55 Plan 05: Pipeline confidence and editor guide Summary

write_issue_draft now persists the real Editor Gate 1 confidence (omitted when invalid) and carries an existing editor-authored frontPage forward on re-runs; EDITOR_GUIDE documents every Front Page field.

## Commits
- 32944f5c: editorConfidence
- 401ed529: frontPage carry-forward
- 3a3310e3: EDITOR_GUIDE section

## Verification
`pytest` on the four sanity-write files: 29 passed (with SANITY_API_TOKEN set); `-k sanity`: 46 passed, 10 skipped.

## Deviations
- [Rule 3] New test files set SANITY_API_TOKEN/dataset via an autouse monkeypatch fixture; the existing test_sanity_write.py skips itself when the token is unset (its probe fails), so it was also run with a dummy token to confirm green.

## Notes
Railway deploy deferred to 55-13. No stubs.

## Self-Check: PASSED
