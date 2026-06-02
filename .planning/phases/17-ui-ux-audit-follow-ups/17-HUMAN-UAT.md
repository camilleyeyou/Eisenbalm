---
status: partial
phase: 17-ui-ux-audit-follow-ups
source: [17-VERIFICATION.md]
started: 2026-06-02T03:55:00Z
updated: 2026-06-02T03:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CLS Lighthouse measurement (P17-02)
expected: Run Lighthouse on a live/Vercel-preview `/issue/[slug]` page that has BigBudget bonus storyboards; CLS measurably lower than the pre-Phase-17 baseline (the `next/image fill` + `sizes=` conversion eliminates the storyboard grid's layout-shift source). Record the numeric CLS delta in this file.
result: [pending]

### 2. Andrew /about voice approval (P17-05)
expected: Andrew opens `/about` (local `http://localhost:3000/about` or deployed preview), reads the three interim paragraphs, and confirms Jesse voice (dry, precise, no irony, no exclamation marks). He either approves as-is (deletes the `TODO(Andrew)` JSX comment in `apps/web/app/about/page.tsx`) or replaces the prose with his own wording, then re-runs `pnpm --filter web test:unit -- --run about-page` to confirm it stays green. This is a non-blocking editorial gate — the source half (placeholder removed, `<article>` intact, marker present) is already automated and green.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
