---
status: partial
phase: 07-game-rendering
source: [07-VERIFICATION.md]
started: 2026-05-19T01:38:00Z
updated: 2026-05-19T01:38:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. GAM-06 — 360px mobile rendering of an LLM-generated game
expected: |
  At Chrome DevTools viewport 360 x 640px on the latest published issue's
  /issue/[slug] page, the #game section shows the game iframe with NO
  horizontal scrollbar; game content stays within the rounded container
  (h-[280px] mobile / sm:h-[360px] desktop); "THE GAME" label, headline,
  and description are readable without horizontal scroll.
why_human: |
  Requires a real browser at a real viewport against a real published
  issue. Vitest cannot evaluate visual layout, real font metrics, or
  the rendered output of LLM-generated HTML inside the iframe. The
  Vitest unit suite (GAM-06 substrate) only proves that injectGameHead
  prepends `overflow-x: hidden`, `max-width: 100%`, and the viewport
  meta — not that the final rendered game stays within the box.
result: [pending]

### 2. GAM-05 — Validation failure → fallback UI + Convex qaCorrections row
expected: |
  1. Andrew authors a fixture weeklyIssue draft in Sanity Studio with
     game.embedCode = `<script>document.cookie = "x";</script>` and
     publishes it. The issue's pipelineMetadata.runId must be set
     (manually or via a stub pipeline run).
  2. Opening /issue/<fixture-slug> shows "Game unavailable." (no iframe
     in the DOM; no console errors).
  3. The Convex qaCorrections table has a new row with:
     - runId = matching fixture runId
     - sectionName = 'game'
     - severity = 'error'
     - agentId = 'game-validator'
     - axis = 'hard-rule'
     - accepted = false
     - reason contains "Forbidden construct: cookie access (document.cookie)"
  4. Refreshing the page does NOT create a second row in production
     (Strict Mode off); dev mode may show 2 rows due to Strict Mode
     double-invocation, which is acceptable.
  5. Fixture issue is deleted or set to status='draft' afterwards.
why_human: |
  Requires Sanity Studio access to author a fixture, a real Convex
  deployment to receive the mutation, and inspection of the Convex
  dashboard for the qaCorrections row. The useEffect-driven Convex
  write fires only in a real browser with the React tree mounted and
  the ConvexClientProvider active. The Vitest source-scan and the
  Convex schema unit shape can be verified statically, but the
  end-to-end mutation flow cannot.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
