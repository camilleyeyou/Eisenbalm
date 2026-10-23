---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 02
subsystem: dispatch-control
tags: [shell, tokens, nav, preflight]
requires: [56-01]
provides: [EditorShell, EDITOR_NAV, editor tokens, plain admin labels]
affects: [all editor and admin routes]
key-files:
  created:
    - apps/dispatch-control/components/editor/EditorShell.tsx
    - apps/dispatch-control/__tests__/EditorShell.test.tsx
    - .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md
  modified:
    - apps/dispatch-control/app/globals.css
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/app/(editorial)/layout.tsx
    - apps/dispatch-control/app/admin/layout.tsx
    - apps/dispatch-control/__tests__/nav.test.ts
    - apps/dispatch-control/__tests__/AdminHub.test.tsx
decisions:
  - Pipeline does not load packages/pipeline/.env under `uv run uvicorn`; browser QA must export DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001 on the command line.
metrics:
  tasks: 3
  completed: 2026-10-22
---

# Phase 56 Plan 02: Shell, Tokens, Nav Summary

Shared EditorShell (masthead plus three-link nav: This week's issue, Past issues, Behind the scenes) now wraps both the editorial and admin layouts; seven additive editor tokens added; the seven admin dials relabelled in plain words; command palette and the Admin/UserButton chrome unmounted.

## Commits
- Task 1: pre-flight doc (docs(56-02): pre-flight CORS and baseline suite)
- Task 2: efd5ca6a (tokens, EditorShell, nav, tests)
- Task 3: 52a7b0d4 (layouts)

## Pre-flight findings
- Pipeline health route is `/healthz`, not `/health`.
- CORS initially FAILED from :3001 because `.env` is not loaded by `uv run uvicorn`, so origins fell back to localhost:3000. With the variable exported, the probe returns the correct allow-origin header (CORS: PASS). Recorded in 56-PREFLIGHT.md. No repo files changed for this.
- Baseline was 108 files / 1024 tests all green (the "known failure" in the plan no longer exists). After this plan: 109 files pass, 1033 tests pass.
- Draft loading in a browser was not exercised (left to 56-13); OpenRouter key is revoked.

## Deviations from Plan
- [Rule 1] The plan's probe used `/runs` and `/health`; actual routes are `/runs/{id}/cancel` and `/healthz`. Probed those instead.
- Added `afterEach(cleanup)` to EditorShell.test.tsx (needed for multi-render tests).

## Verification
Strict `pnpm --filter dispatch-control build` exits 0; full suite green.

## Known Stubs
None.

## Self-Check: PASSED
