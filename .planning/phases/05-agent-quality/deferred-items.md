## Plan 05-07 (Advocate) — out-of-scope discoveries

- `tests/agents/test_editor.py` has a collection-time ImportError:
  `cannot import name 'EDITOR_CONFIDENCE_THRESHOLD' from
  'eisenbalm_pipeline.agents.editor'`. The test file is a parallel-execution
  artifact from Plan 05-08 (Editor Gate 1), which is still listed as
  incomplete in STATE.md. Out of scope for Plan 05-07 — owned by Plan 05-08.
  Worked around in Plan 05-07 verification by `--ignore=tests/agents/test_editor.py`;
  the advocate suite passes cleanly on its own.

## Plan 05-11 (Bonus + Game) — out-of-scope discoveries

- `tests/agents/test_problem.py` has a collection-time ImportError:
  `cannot import name 'KeyDataPoint' from
  'eisenbalm_pipeline.agents.problem'`. Owned by Plan 05-10 (Section
  Writers — still listed as incomplete). Pre-exists Plan 05-11.
- `tests/agents/test_design.py` has a collection-time ImportError as well
  (DesignAgent symbols not yet implemented). Owned by Plan 05-12
  (DesignAgent — still listed as incomplete). Pre-exists Plan 05-11.
- Plan 05-11 verification confirmed both errors pre-exist by running
  `git stash && pytest --collect-only && git stash pop`. Plan 05-11
  test_bonus.py + test_game.py pass cleanly when run in isolation.
