---
status: partial
phase: 32-native-galley-read-only-span-resolver
source: [32-VERIFICATION.md]
started: 2026-07-07T22:35:00Z
updated: 2026-07-07T22:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Galley visual fidelity
expected: Open /review-desk/[runId] for a real completed run and read the galley top-to-bottom. Reads as the reader will see it — theme display/body Google Fonts loaded, accent color flavoring pullquotes/borders, D-04 type scale (52px headline / italic 22px deck / 16.5px body) visually present, paper background matches console chrome.
result: [pending]

### 2. Iframe fallback paths render
expected: Toggle "Show preview" in the Review Desk header — the Phase 31 PreviewIframe still renders the live Sanity preview. Separately open the Phase 26 /run-monitor/runs/[runId]/review page directly — it renders exactly as before Phase 32 (SC-4 soak-cycle fallback).
result: [pending]

### 3. Chip jump navigation
expected: In galley mode, click each section chip (Origin Story, Problem, Founder Bio, Case Study, Bonus, Game, Deliberation, Podcast) — each click smooth-scrolls the galley to the matching #galley-{id} anchor. The Theme chip is a documented no-anchor exception (applies globally, no dedicated section).
result: [pending]

### 4. Sandboxed game plays cleanly
expected: For a real run's embedCode, the game renders and is interactive inside the sandboxed iframe with no browser console CSP/sandbox errors.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
