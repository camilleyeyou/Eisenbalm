---
phase: quick-261022-cr6
plan: 01
subsystem: dispatch-control
tags: [ux-fix, navigation, stop-run, cost, recovery-rail]
requirements-completed: [UXFIX-01, UXFIX-02, UXFIX-03, UXFIX-04, UXFIX-05, UXFIX-06, UXFIX-07, UXFIX-08, UXFIX-09]
key-files:
  created:
    - apps/dispatch-control/components/StopRunButton.tsx
    - apps/dispatch-control/lib/runLabels.ts
    - apps/dispatch-control/lib/useRunLabel.ts
    - apps/dispatch-control/lib/gateInterrupt.ts
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/EarlierIssueBanner.tsx
    - packages/pipeline/tests/test_cancel_paused.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py
    - convex/agentRuns.ts
completed: 2026-10-22
---

# Quick 261022-cr6: Fix client UX feedback bugs 1-9 Summary

Client bugs 1-9 fixed in dispatch-control: any issue opens and edits via `?run=`, Stop works for a run paused at Gate 1, and Admin run pages show real costs and plain words.

## Commits

- `ab608f3c` Task 1: open/edit any issue, fix Review/Open links, Edit text per section (bugs 1, 2, 5)
- `4da33e08` Task 2: real Stop for a paused run, readable/de-cluttered runs list (bugs 3, 4)
- `b4d35980` Task 3: honest costs, writer count, paused state, dead buttons removed (bugs 6, 7, 8, 9)

## What changed

- **Bug 1/2/5:** `useCurrentRun({ runId })` pins a run; `/s/[section]?run=<id>` loads that run with an earlier-issue banner, and section nav keeps `?run=`. Past issues rows with drafts open the editor; published rows get a separate "View live" link. `/issues/N...` redirects to `/archive?issue=N`, which forwards to the issue. `/review-desk/:runId` redirects to `/s/originStory?run=:runId` (it was run-keyed). Admin Review/Open issue links use `issueOpenHref`. Run detail has "Edit text" per writer row; "Re-roll" is now "Rewrite this part".
- **Bug 3:** `POST /runs/{id}/cancel` handles `runs.status='awaiting-review'` with no `completedAt` (same predicate as `api/signoffs.py` 37.4(c); the publisher's genuine final-review rows always carry completedAt). It writes `runs:updateStatus cancelled` and `pipelineRuns:updateStatus failed`, and returns `{status:'cancelled', stopped:true}`. `StopRunButton` is on the front page (gate1 footer) and in the Admin rail. `deriveHomeFooter` maps `cancelled` to a new `stopped` kind (fixes the endless skeleton), and Start issue is enabled. No new public Convex mutation.
- **Bug 4:** run cards and the runs table read "Issue N — Charity · date". Unpublished runs older than 14 days sit under "Older runs (N)".
- **Bug 6:** `agentRuns.costTotalsForRuns` (public read query) sums `agent_runs.costUsd`. CostRollup, RunsTable, ReviewQueue and RunDetail use it. The reconciliation panel is replaced by one "Total cost" cell.
- **Bug 7:** writers label is "writing agents", and the group shows the count of listed writers.
- **Bug 8:** `lib/gateInterrupt.ts`. Interrupt-repr rows read "Waiting for you" (neutral chip), the repr is never printed, and the rail shows "It was choosing between: A, B".
- **Bug 9:** disabled Restart and Improve buttons removed from RecoveryRail.

## Verification

| Command | Result |
|---|---|
| `pnpm --filter dispatch-control exec vitest run` (full) | 105 files passed, 1 skipped; 976 tests passed, 2 todo, 0 failed |
| `pnpm --filter dispatch-control build` (strict Next build) | passed |
| `pnpm --filter dispatch-control exec tsc --noEmit` (non-test files) | clean (test files have pre-existing type errors, untouched) |
| pipeline `pytest tests/test_cancel_paused.py tests/test_cancel.py tests/test_control.py tests/test_reroll.py` | 13 passed |
| `pnpm --filter @eisenbalm/convex dev:once` | "Convex functions ready!" (dev:modest-magpie-797 synced) |
| grep: no `seven writing` in apps/dispatch-control | clean |
| grep: `href="/"` in app/admin | only admin layout nav links and the RunControlBar just-started link (allowed) |

## Deviations from Plan

- **[Rule 3]** `nextConfigRedirects.test.ts`: the test's redirect resolver captured params out of order for multi-param sources. Rewrote it as a single pass, and made the on-disk page check resolve `[dynamic]` segments and strip `?query`.
- **[Rule 1]** `PublishFooter` gate1 block changed from `<p>` to `<div><p>` so the stop control is not nested in a paragraph.
- RunsTable had no raw runId cell, so a new "Issue" column holds the label. RunsTable uses a button disclosure ("Older runs (N)") rather than `<details>`; ReviewQueue uses `<details>`.
- `runDetailActionNames.test.ts` source-scan assertion updated for the new `issueOpenHref` link.
- Plan bullet about edits to published issues reaching the live site: not investigated, no claim was added to the UI.
- Optional dev query of a real Interrupt repr was skipped; `summarizeInterrupt` is regex-based on the documented repr shape and returns `[]` if unparseable.

## Known limits / follow-ups

- `runs.monthToDateCost` and the budget start-gate still read the never-written `runs.cost`, so the budget gate never trips. Not changed, because it alters pipeline start-gate behaviour.
- Stop only applies to paused-at-Gate-1 runs; running runs still use the cooperative cancel.

## Post-merge steps (for the user)

1. Deploy the pipeline from repo root: `railway up --ci --service eisenbalm-pipeline`. The Stop endpoint does not work in prod until this ships.
2. Deploy Convex to prod if dispatch-control prod points at a separate deployment (`agentRuns.costTotalsForRuns`). Dev is already synced.
3. Deploy dispatch-control on Vercel.
4. Stop issue 999723 from the front page ("Stop this issue"), then press "Start issue".
5. Follow-up: fix `runs.monthToDateCost` / the budget gate to read agent_runs costs.

## Self-Check: PASSED

All created files exist; commits ab608f3c, 4da33e08, b4d35980 are in `git log`.
