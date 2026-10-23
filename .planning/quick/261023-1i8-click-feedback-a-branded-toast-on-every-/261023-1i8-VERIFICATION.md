---
status: human_needed
verified: 2026-10-23
score: 8/8 must-haves verified
human_verification:
  - test: "Open dispatch-control in a browser, click Publish / Hold / Release / Save paragraph / Rewrite and an admin action"
    expected: "Branded toast appears bottom-center (green/red/cobalt bar), auto-dismisses (5s done/info, 9s problem), pauses on hover, Dismiss works"
    why_human: "Visual look-and-feel; Clerk blocks automation"
---

# Quick 261023-1i8 Verification

All automated checks pass.

| Check | Result |
|---|---|
| `pnpm --filter dispatch-control test` | 118 files passed, 1 skipped; 1126 tests passed |
| `pnpm --filter dispatch-control build` | exit 0 |
| layout.tsx `'use client'` | only in the "do NOT add" comment (line 1); no directive. `<ToastProvider>` mounted once inside ConvexClientProvider |
| `useToast` outside provider | returns frozen NOOP_API, never throws |
| useToast + toast calls in 15 admin + 3 editorial files | all present, none missing |
| 26 `toast*` keys in COPY | 26 found; COPY-wide banned-word test added and green |
| Banned/jargon words in toast strings | none (grep over call sites and COPY toast keys empty) |
| Existing test lines removed (4 files) | 0 |
| Changes under apps/web, convex, packages, package.json, lockfile | 0 files |
| Toast.tsx contains disabled / data-primary / h1 | none |
| IssueHome wiring | publishing info, publish problem, published-latch done, start, release, stop, discard, hold all present |

Note: layout grep count of 1 is the comment text, not a directive; the file starts with a comment and has no `'use client'` statement.

Remaining: visual verification in a browser (human item above).
