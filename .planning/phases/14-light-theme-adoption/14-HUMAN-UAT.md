---
status: partial
phase: 14-light-theme-adoption
source: [14-VERIFICATION.md]
started: 2026-05-24T19:30:00Z
updated: 2026-05-24T19:30:00Z
---

## Current Test

[awaiting human review]

## Tests

### 1. No dark surfaces remain anywhere (visual sweep)
expected: Load `/`, `/issue/[slug]`, `/archive`, `/charities`, `/about`, `/shop` on the light build. Every surface reads as warm paper (#FAFAF8) — no residual dark cards, navigator, deliberation, hero, or footer.
result: [pending]

### 2. On-paper glow/shadow readability
expected: Issue-page atmosphere glows (halved opacity) + `.section-card:hover` warm paper shadow (rgba(90,75,50,0.18)) read as subtle and on-brand on paper — not muddy, not invisible, not a hard black ring.
result: [pending]

### 3. Editor-confidence `NN%` numeral — gold readability (EDITORIAL DECISION)
expected: DeliberationSlot editor-confidence percentage (clamp 32–48px) currently renders in brand gold #CDA434 = 2.24:1 on paper, which fails WCAG AA-large (3:1). DECISION NEEDED: keep gold as a brand display choice, or darken to `--color-primary-text` #7A5C0E (5.97:1) for legibility.
result: [pending]

### 4. "★ Selected this week" badge — gold legibility (AA VIOLATION)
expected: The pitch-card "★ Selected this week" badge (11px) renders gold #CDA434 on a 14% gold-wash background ≈ 2.0:1 — fails AA (4.5:1) for small text. One-line fix available: badge text → `--color-primary-text` #7A5C0E. Confirm fix (recommended) or accept.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
