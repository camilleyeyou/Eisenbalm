---
phase: 29-deployment-hardening-code-fixes
plan: 05
subsystem: infra
tags: [env-vars, docs, railway, postgres, dispatch-control, pipeline]

# Dependency graph
requires:
  - phase: 29-deployment-hardening-code-fixes (plan 01)
    provides: PIPELINE_CONVEX_SECRET entry already added to packages/pipeline/.env.example
provides:
  - Railway-accurate SUPABASE_POSTGRES_URL guidance in packages/pipeline/.env.example (var name kept, but example value/comments + error strings now describe Railway Postgres instead of a stale Supabase session-pooler setup)
  - Documented DESIGNAGENT_SUPPRESSED and LOG_LEVEL pipeline toggles
  - Documented dispatch-control PREVIEW_SECRET + NEXT_PUBLIC_WEB_PREVIEW_BASE (review-gate preview vars) in .env.example and DEPLOY.md
  - Corrected DEPLOY.md's "(optional)" mislabel on NEXT_PUBLIC_PIPELINE_URL to "Required"
affects: [deployment-hardening-code-fixes, future-env-var-audits]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/pipeline/.env.example
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py
    - packages/pipeline/src/eisenbalm_pipeline/cli.py
    - apps/dispatch-control/.env.example
    - apps/dispatch-control/DEPLOY.md

key-decisions:
  - "Kept the SUPABASE_POSTGRES_URL var name unchanged (renaming deferred per D-6/CONTEXT) — only fixed the misleading example value, comments, and error strings to describe Railway Postgres"
  - "Fixed an additional misleading 'Supabase pooler' comment in cli.py's DDL-execution note and 'Supabase' wording in checkpointer.py's assert_tables_exist error, beyond the exact grep targets in the plan, since they're the same stale-guidance issue in scope for D-6"

requirements-completed: [D-6, D-13]

# Metrics
duration: 10min
completed: 2026-07-04
---

# Phase 29 Plan 05: Railway Postgres Env Docs + Missing Env-Var Docs Summary

**Replaced stale Supabase-session-pooler guidance with Railway-accurate wording across pipeline .env.example/checkpointer.py/cli.py, and documented four previously-undocumented env vars (DESIGNAGENT_SUPPRESSED, LOG_LEVEL, PREVIEW_SECRET, NEXT_PUBLIC_WEB_PREVIEW_BASE) plus corrected dispatch-control's DEPLOY.md mislabeling NEXT_PUBLIC_PIPELINE_URL as optional.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-04T06:47:24Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `packages/pipeline/.env.example`'s `SUPABASE_POSTGRES_URL` block no longer instructs operators to use a Supabase session pooler; it now explains the var name is a legacy misnomer pointing at Railway Postgres (moved 2026-06-12) and gives Railway-sourced connection-string guidance
- Fixed matching stale guidance in `checkpointer.py` (docstring + `RuntimeError` messages + `assert_tables_exist` error) and `cli.py` (module docstring + `_require_postgres_url` error + a DDL comment)
- Documented `DESIGNAGENT_SUPPRESSED` (current live posture: true) and `LOG_LEVEL` in the pipeline `.env.example`
- Documented `PREVIEW_SECRET` + `NEXT_PUBLIC_WEB_PREVIEW_BASE` in dispatch-control's `.env.example` and `DEPLOY.md`, and corrected `DEPLOY.md`'s incorrect "(optional)" label on `NEXT_PUBLIC_PIPELINE_URL` to "Required"

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Railway Postgres guidance + add pipeline toggles (D-6, D-13 pipeline)** - `9116ba7` (docs)
2. **Task 2: Document dispatch-control preview + pipeline URL vars (D-13 dispatch-control)** - `d697342` (docs)

_No TDD tasks — docs-only plan._

## Files Created/Modified
- `packages/pipeline/.env.example` - Railway-accurate `SUPABASE_POSTGRES_URL` guidance; added `DESIGNAGENT_SUPPRESSED` + `LOG_LEVEL`
- `packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py` - Fixed docstrings/error strings that referenced the Supabase session pooler
- `packages/pipeline/src/eisenbalm_pipeline/cli.py` - Fixed module docstring, `_require_postgres_url` error message, and a DDL comment
- `apps/dispatch-control/.env.example` - Added `PREVIEW_SECRET` + `NEXT_PUBLIC_WEB_PREVIEW_BASE`; clarified `NEXT_PUBLIC_PIPELINE_URL` is required
- `apps/dispatch-control/DEPLOY.md` - Added both preview vars to the env table; changed `NEXT_PUBLIC_PIPELINE_URL` row from "(optional)" to "Required"

## Decisions Made
- No real secret values were set anywhere — all new entries are placeholders/guidance comments, per the plan's explicit constraint
- Extended the D-6 fix slightly beyond the plan's exact grep targets (`cli.py`'s "Supabase pooler" DDL comment, `checkpointer.py`'s "not found in Supabase" error) because they're the same category of stale guidance and leaving them would still mislead an operator reading those files

## Deviations from Plan

None - plan executed exactly as written (the two extra string fixes noted above are within the same task's stated action of updating "the error strings ... to Railway-accurate wording" and don't change scope, files touched, or verification).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan is documentation-only; no real secrets were set and no dashboard/env changes are needed as a result of this plan (operators still need to separately provision the actual Railway Postgres URL, PREVIEW_SECRET, etc. per the existing external punch-list, which is out of scope per 29-CONTEXT.md).

## Next Phase Readiness

This is the last plan of Phase 29 (deployment-hardening-code-fixes). All 5 plans (29-01 through 29-05) are now complete. Grep-based acceptance criteria for D-6 and D-13 pass, `packages/pipeline` API tests pass (37 passed, 9 skipped), and `pnpm --filter dispatch-control build` exits 0.

---
*Phase: 29-deployment-hardening-code-fixes*
*Completed: 2026-07-04*

## Self-Check: PASSED

All modified files confirmed present on disk; both task commits (`9116ba7`, `d697342`) confirmed in git log.
