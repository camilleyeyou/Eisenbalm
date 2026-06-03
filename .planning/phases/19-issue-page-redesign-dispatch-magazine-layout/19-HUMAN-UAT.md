---
status: partial
phase: 19-issue-page-redesign-dispatch-magazine-layout
source: [19-VERIFICATION.md]
started: 2026-06-03T12:57:02-0700
updated: 2026-06-03T12:57:02-0700
---

## Current Test

[awaiting human testing — requires a live published Sanity issue + Convex deliberation data]

## Tests

### 1. Live content renders across all 10 sections with real Sanity data
expected: Opening `/issue/[slug]` for a real published issue renders masthead, 3-col briefing, mission band, sticky rail, article sections (origin/problem/founder) with drop caps + pull-quotes, case study, full-width game, spec-ad bonus, deliberation centerpiece, podcast, and shop band — all populated from live GROQ (no mock data).
result: [pending]

### 2. Per-issue Sanity theme override changes accent while structure stays identical (DES-06)
expected: Two issues with distinct `theme.accentColor` (and/or type tokens) render with different colors, but identical structure/grid/motion. An issue with no theme resolves to oxblood/cream BRAND_DEFAULTS.
result: [pending]

### 3. Live deliberation with real runId feeds DelibScoreboard + DelibChat from Convex
expected: An issue with a real `runId` shows the candidate scoreboard scores and the chat-style transcript driven by the 5 Convex subscriptions; no raw model/provider names appear (DEL-04); empty/loading state is graceful when no run data exists.
result: [pending]

### 4. PDF download button appears on Problem section when problemPdfUrl is set
expected: An issue whose `problemPdfUrl` is populated shows an accessible (≥44px) PDF download link in the Problem editorial section; absent when the field is empty.
result: [pending]

### 5. prefers-reduced-motion: all 10 sections immediately visible, no opacity-0 traps
expected: With OS reduced-motion enabled, every section's content is fully visible on load (scroll reveals off), all deliberation chat messages present, confidence bar at full width, scroll progress bar static — no hidden/empty/opacity-0 states.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
