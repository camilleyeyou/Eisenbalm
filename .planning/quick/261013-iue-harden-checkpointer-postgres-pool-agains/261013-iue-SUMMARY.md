---
phase: quick-261013-iue
plan: 01
subsystem: pipeline
tags: [postgres, psycopg-pool, checkpointer, railway]
key-files:
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
    - packages/pipeline/tests/test_checkpointer.py
decisions:
  - "Pool-level fix only (check, max_idle, keepalives); no caller retry logic"
metrics:
  completed: 2026-10-13
  tasks: 1
---

# Quick 261013-iue: Harden checkpointer Postgres pool against stale connections

`create_pool` now passes `check=AsyncConnectionPool.check_connection`, `max_idle=120`, and TCP keepalives (1/30/10/3). A connection that Railway's proxy has closed is discarded and replaced before it is lent out. This targets the run df6e982935b94f10ad15c81311c6445e failure (`SSL error: unexpected eof while reading` in `AsyncPostgresSaver.aget_tuple`).

The existing autocommit, prepare_threshold=None, row_factory=dict_row, and open=False settings are unchanged. The docstring documents the rationale. A new DB-free test, `test_create_pool_hardened_against_stale_connections`, pins all of these settings.

## Verification
- `tests/test_checkpointer.py`: 2 passed, 1 skipped (the DB-backed test).
- Full suite: 733 passed, 38 skipped.

## Commit
- a9112ca fix(quick-261013-iue): harden checkpointer pool against stale connections

## Deviations
None.

## Self-Check: PASSED
