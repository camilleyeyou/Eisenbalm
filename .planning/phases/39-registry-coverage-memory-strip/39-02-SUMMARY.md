---
phase: 39-registry-coverage-memory-strip
plan: 02
subsystem: pipeline-api
tags: [fastapi, registry, coverage-strip, convex-sanity-join, clerk, read-only, MEM-01]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    provides: "charities:listRecentFeatured (39-01) — up to 8 featured charities ordered by lastFeaturedAt desc"
  - phase: 31-content-patch-full-editing
    provides: "GET /issues/{run_id}/draft read-only Clerk-guarded endpoint precedent + content.py _cc/_sc import convention"
provides:
  - "GET /registry/coverage-strip — server-side join of Convex charities:listRecentFeatured to Sanity focusArea/location/scoutNotes (cause/geo/signal), Clerk-guarded, read-only, no audit row"
  - "packages/pipeline/src/eisenbalm_pipeline/api/registry.py — new router module"
affects: [39-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side Convex→Sanity join for a dashboard read (dispatch-control has zero Sanity access, EDT-05) — mirrors GET /issues/{run_id}/draft"
    - "groq_query called as groq_query(query, *, params=None) — NO http/positional-client arg (calibrator.py:70 precedent); tests enforce arity via autospec=True"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py
    - packages/pipeline/tests/test_registry_coverage.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py

key-decisions:
  - "Shipped as a NEW registry.py router (planner's discretion in 39-RESEARCH) rather than extending content.py — keeps the registry read surface distinct from the content-patch family"
  - "groq_query issued only when there is at least one sanityCharityId to look up (ids-empty short-circuit) so a legacy-only last-8 never fires a pointless Sanity read"

patterns-established:
  - "autospec=True on the groq_query mock so a wrong-arity call (e.g. passing an http client positionally) fails RED instead of silently shipping broken"

requirements-completed: [MEM-01]

# Metrics
duration: ~15min
completed: 2026-07-10
---

# Phase 39 Plan 02: Coverage-Strip Endpoint Summary

**`GET /registry/coverage-strip` server-side-joins the last ≤8 featured charities (Convex `charities:listRecentFeatured`) to their Sanity `focusArea`/`location`/`scoutNotes` (cause/geo/signal chip data), Clerk-guarded and read-only, gracefully rendering None chips for legacy rows without a `sanityCharityId` — the authenticated data source the 39-05 coverage-memory strip UI consumes.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed
- **Files created/modified:** 3

## Accomplishments
- New `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` router exposing `GET /registry/coverage-strip`: calls `_cc.convex_query(http, "charities:listRecentFeatured", {"workspace_id": "eisenbalm", "limit": 8})`, collects the present `sanityCharityId`s, issues ONE `_sc.groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}', params={"ids": ids})`, and zips the Sanity docs back onto the featured rows preserving `lastFeaturedAt`-desc order.
- Blocker-1 honored: `groq_query` is called with its real `groq_query(query, *, params=None)` signature — no `http`/positional-client arg (calibrator.py:70 precedent). The RED tests patch it with `autospec=True` so a wrong-arity call would fail loudly.
- Pitfall 6 handled: featured rows lacking `sanityCharityId` (legacy/backfilled) emit `{cause,geo,signal} = None` and never crash the request; their absent id never reaches the groq `$ids` param.
- Registered `registry.router` in `main.py` alongside the other 11 routers; Clerk-guarded via `Depends(_require_clerk_jwt_control)`, read-only, no audit row (reads are not audited).

## Task Commits

Each task committed atomically:

1. **Task 1 (RED): failing coverage-strip join + missing-sanityCharityId tests** — `1a85810` (test)
2. **Task 2 (GREEN): registry.py endpoint + main.py registration** — `6885e4e` (feat)

**Plan metadata:** (this commit) — docs: complete plan

_TDD task (Task 1→2) has the RED test commit then the GREEN implementation commit._

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` — New router: `GET /registry/coverage-strip` server-side join
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` — Added `registry` to the api import block + `app.include_router(registry.router)`
- `packages/pipeline/tests/test_registry_coverage.py` — New: join-shape/order/chip test + missing-sanityCharityId graceful-skip test (groq_query patched `autospec=True`)

## Decisions Made
- Followed the plan's endpoint shape verbatim; the ONE piece of planner discretion exercised (registry.py router vs extending content.py) chose a new module, keeping the registry read surface separate from the content-patch family.
- `groq_query` short-circuits to `[]` when there are no ids, so a last-8 composed entirely of legacy rows without `sanityCharityId` issues zero Sanity reads.

## Deviations from Plan

### Scope clarification (not a deviation)
- The coordinator's resume note mentioned "the coverage-strip TS client in `apps/dispatch-control/lib`". That belongs to plan **39-05** (coverage-strip-ui), NOT 39-02. Plan 39-02's `files_modified` and `<tasks>` are backend-only (registry.py, main.py, test file). No frontend file was touched; `pnpm --filter dispatch-control build` was therefore not required.

**Total deviations:** None — plan executed exactly as written (2 tasks, backend-only).

## Issues Encountered
None. (Execution was interrupted mid-run by an ECONNRESET after the RED commit landed; resumed cleanly — registry.py + main.py were already in the working tree, verified correct, tested GREEN, and committed.)

## Next Phase Readiness
- `GET /registry/coverage-strip` returns `[{name, sanityCharityId, lastFeaturedAt, cause, geo, signal}, ...]` (≤8) for plan **39-05**'s `CoverageStrip` component to fetch via an authenticated `pipelineBaseUrl()` request.
- Legacy featured rows without `sanityCharityId` never 500 the request.
- No blockers.

---
*Phase: 39-registry-coverage-memory-strip*
*Completed: 2026-07-10*

## Self-Check: PASSED

- `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` — FOUND (`listRecentFeatured` ×3, `focusArea`/`scoutNotes` present, `_require_clerk_jwt_control` present)
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` — `registry.router` registration FOUND
- `packages/pipeline/tests/test_registry_coverage.py` — FOUND
- Commits `1a85810`, `6885e4e` — both verified present in `git log`
- Test target GREEN (2 passed); full pipeline suite 517 passed / 36 skipped
