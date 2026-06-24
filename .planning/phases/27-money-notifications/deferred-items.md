# Phase 27 — Deferred / Out-of-Scope Items

## 27-03 (NTF track) executor observations

- **`convex/finance.ts` fails `npx convex codegen` with `Could not resolve "stripe"`.**
  - Found during: Task 2 codegen verification.
  - This file is owned by the **parallel Plan 02 (RCN track)** executor and was
    uncommitted/in-flight at the time. The `stripe` npm package is not installed
    in the convex package's resolution scope.
  - Out of scope for 27-03 (NTF track) per the plan's `files_owned_note` ("No
    overlap with Plan 02 (RCN track) files") and the parallel-execution rule
    (only touch files in my plan's files_modified list).
  - Verified my own modules (`notifications.ts`, `notificationActions.ts`, both
    seam edits) codegen clean (exit 0) and regenerate `_generated/api.d.ts`
    correctly when `finance.ts` is temporarily excluded. The codegen failure is
    entirely attributable to the parallel track's file.
  - Resolution: Plan 02 must add/install the `stripe` dependency for the convex
    bundle, or mark it external. Not actioned here.
