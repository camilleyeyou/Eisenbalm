## Plan 05-07 (Advocate) — out-of-scope discoveries

- `tests/agents/test_editor.py` has a collection-time ImportError:
  `cannot import name 'EDITOR_CONFIDENCE_THRESHOLD' from
  'eisenbalm_pipeline.agents.editor'`. The test file is a parallel-execution
  artifact from Plan 05-08 (Editor Gate 1), which is still listed as
  incomplete in STATE.md. Out of scope for Plan 05-07 — owned by Plan 05-08.
  Worked around in Plan 05-07 verification by `--ignore=tests/agents/test_editor.py`;
  the advocate suite passes cleanly on its own.
