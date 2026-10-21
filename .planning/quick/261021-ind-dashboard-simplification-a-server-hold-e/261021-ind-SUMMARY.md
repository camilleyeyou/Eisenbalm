---
phase: quick-261021-ind
plan: 01
subsystem: pipeline + dispatch-control
tags: [hold, publish-gate, gate-1, derivations, copy]
requires: [quick-261021-7aw]
provides:
  - lib/issue_hold.py single hold helper wired into 6 publish paths
  - Gate 1 auto-proceed (no human pause)
  - sign-off-free console derivations
affects: [packages/pipeline, apps/dispatch-control, docs/API_CONTRACTS.md]
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/issue_hold.py
    - packages/pipeline/tests/test_issue_hold.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/{review,control,runs,webhooks}.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
    - apps/dispatch-control/lib/derivedState.ts
    - apps/dispatch-control/components/{AwaitingYouInbox,Masthead}.tsx
    - docs/API_CONTRACTS.md
decisions:
  - Hold lookup fails closed (503) on dashboard/manual paths, fails open on the Sanity webhook (must always return 200)
  - Tick sweep clears scheduledPublishAt for a held run so releasing the hold never silently publishes a stale slot
  - Gate 1 no-candidates now fails the run (RuntimeError) instead of pausing
metrics:
  completed: 2026-10-21
---

# Quick 261021-ind: Dashboard simplification A - correctness fixes

Hold is now enforced on the server for every publish path, Gate 1 never pauses, and the console agrees with the front door (Ready -> Published, no sign-offs).

## Commits
- 87567c93 Task 1: pipeline hold helper on every publish path, Gate 1 auto-proceed, API_CONTRACTS
- d4442ab3 Task 2: derivations, /run Publishing panel, My Tasks, inbox, DecisionRail
- d9c3f633 Task 3: stale copy, dead controls hidden, wordmark -> /

## Verification
- Pipeline: `uv run pytest` 955 passed, 40 skipped (baseline 939 passed)
- dispatch-control: vitest 1373 passed, 2 todo (157 files, 1 skipped); `pnpm --filter dispatch-control build` (strict) succeeds
- No convex/ changes, so no `dev:once` sync was needed

## Deviations from Plan
1. [Rule 3] RunScreen: a leftover `claimsContradicted` variable was still passed to RunBody and failed the strict build (vitest did not catch it); restored the one-line derivation.
2. [Rule 1] AwaitingYouInbox: `runs` rows carry no `issueNumber`, so the inbox looks up `pipelineRuns:byRunId` for the current (first) awaiting-review run and the failed run. Only the first awaiting-review run is listed (previous code listed all); consistent with the "~1 in flight" assumption already in the file.
3. [Scope] Also deleted `test_brief_assembled_and_persisted_on_no_candidates_resume_path` (tested the removed synthetic-winner branch) in addition to the two editor tests the plan named.
4. DecisionRail headline "N blockers to clear" changed to "N open notes" (one-line swap, as the plan allowed); matching test strings updated. The "Must fix items" board itself is left for Part B.
5. Exempt section notes reworded to "the agents check it as a whole" (previously verbatim UI-SPEC strings).

## Not done / notes
- Pipeline changes are NOT live until Railway redeploys. Nothing pushed or deployed.
- Part B items (route deletion, /admin hub, Start/Hold on `/`, comments removal, fact-check/voice surface deletion) untouched.
- `adjudicate`/`resume` endpoints and the Signal Desk Gate-1 UI remain for legacy paused runs; deriveTasks keeps the legacy `gate1-decision` task.
- Auto-publish: UI hidden (banner, toggle, masthead chip); component files and `auto_publish` config key retained.

## Known Stubs
None.

## Self-Check: PASSED
Commits 87567c93, d4442ab3, d9c3f633 exist; issue_hold.py and test_issue_hold.py exist.
