---
status: partial
phase: 40-issue-entity-issues-home
source: [40-VERIFICATION.md]
started: 2026-07-15T01:41:26Z
updated: 2026-07-15T01:41:26Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ISS-02 — legacy run-keyed URL issues a live 307 redirect to the issue-keyed URL
expected: Signed in to the console, visiting a legacy run-keyed URL for one of the four backfilled runs (e.g. `/review-desk/{runId}`) lands on `/issues/{issueNumber}/review`. (Automated proxy: `issueRouteResolver.test.ts` proves the resolver function; the Next.js `redirect()` mechanics need a real Clerk-authenticated browser session — a curl returns 404 `x-clerk-auth-reason: dev-browser-missing`.)
result: [pending]

### 2. ISS-05 — four header readouts stay distinguishable without color
expected: Loading the console in greyscale, all four masthead readouts (Issue status · System activity · My Tasks · Cost vs budget) remain distinguishable by label + icon alone — none rely on color to be understood. (Automated proxy: `Masthead.test.tsx` asserts each readout renders a distinct label + icon node; perceptual legibility needs a human eye.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
