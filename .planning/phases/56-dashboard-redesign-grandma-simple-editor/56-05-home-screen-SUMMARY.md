---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 05
subsystem: dispatch-control
tags: [editor, home, slab, hold, stop, publish]
requires: [56-01, 56-02, 56-03]
provides: [IssueHomeView, IssueHome, HoldStopFooter, "/?run= past-issue pinning"]
affects: [56-07, 56-12]
key-files:
  created:
    - apps/dispatch-control/app/(editorial)/_components/HoldStopFooter.tsx
    - apps/dispatch-control/__tests__/HoldStopFooter.test.tsx
  modified:
    - apps/dispatch-control/app/(editorial)/page.tsx
    - apps/dispatch-control/app/(editorial)/_components/IssueHome.tsx
    - apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx
    - apps/dispatch-control/lib/publishChain.ts
    - apps/dispatch-control/__tests__/IssueHome.test.tsx
    - apps/dispatch-control/__tests__/IssueHomeView.test.tsx
    - apps/dispatch-control/__tests__/publishChain.test.ts
    - apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts
  deleted:
    - PublishFooter.tsx, StoryRow.tsx, StartIssueButton.tsx, HoldDialog.tsx, HoldControl.tsx (and the three matching tests)
decisions:
  - "Publish failure always shows COPY.publishFailed with the issue number; the server message is no longer surfaced"
  - "Slow-publish notice renders as a role=status paragraph under the view, since the slab has no notice slot"
  - "Draft-load error is shown only when the footer is ready or loading, as before"
metrics:
  tasks: 3
  completed: 2026-10-22
---

# Phase 56 Plan 05: Home screen Summary

`/` and `/?run=<id>` now render the Main / Home-Writing / Home-Published layout: one slab sentence with at most one cobalt button, the issue header, four stations, nine parts, and a quiet Hold/Stop footer. Start, Publish, Hold, Release and Stop are folded into the slab and footer.

## What shipped
- IssueHomeView is a pure-props view across ready, writing, held, published, collaborator, empty, problem, stuck, loading and draft-error states.
- IssueHome keeps the draft-load, preview-url and publish-latch behaviours. The `derivePublishGate(` call stays literal for the tripwire.
- A past Problem or Stopped issue redirects to its Behind-the-scenes page. An unpublished past issue is read-only. Part links keep `?run=`.
- HoldStopFooter: Stop always asks first (client bug 3). Hold calls the mutation with the fixed reason "Held by the editor".
- publishChain copy constants made plain; names and gate logic unchanged.

## Deviations from Plan
None to behaviour. All three tasks went into one commit (0296925e) because the view, wrapper and deletions had to compile together.

## Verification
- `pnpm --filter dispatch-control build`: passes.
- `pnpm --filter dispatch-control test`: 113 files passed, 1 skipped; 1052 tests passed, 2 todo. The skipped file and the lower count come from deleting the three old component tests and rewriting the Home tests; no failures.

## Known Stubs
None.

## Self-Check: PASSED
