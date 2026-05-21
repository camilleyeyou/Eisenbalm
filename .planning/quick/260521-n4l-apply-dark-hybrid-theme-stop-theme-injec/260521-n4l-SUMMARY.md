---
phase: quick-260521-n4l
plan: 01
subsystem: web/theme
tags: [theme, dark-mode, hybrid, css-variables, security]
dependency_graph:
  requires: [apps/web/app/globals.css :root dark palette]
  provides: [HYBRID theme injection — accent/fonts only, no bg/text override]
  affects: [apps/web/app/layout.tsx, apps/web/app/issue/[slug]/layout.tsx]
tech_stack:
  added: []
  patterns: [HYBRID theme model — globals.css owns bg/text, injection owns primary/accent/fonts]
key_files:
  modified:
    - apps/web/lib/theme.ts
decisions:
  - HYBRID model: serializeThemeCss and applyTheme emit only --color-primary, --color-accent, --font-display, --font-body. The dark house palette in globals.css :root wins the cascade for all pages.
metrics:
  duration: "~5 min"
  completed: "2026-05-21"
  tasks: 1
  files: 1
---

# Phase quick-260521-n4l Plan 01: Apply Dark HYBRID Theme — Stop Theme Injection Overriding bg/text Summary

Stopped theme injection from overriding the dark house background/text on every page, allowing `globals.css :root` (`--color-bg: #0C0B0A`, `--color-text: #F0EAD9`) to win the cascade.

## What Was Done

### Root Cause

`serializeThemeCss(null)` (injected by the root layout) and `serializeThemeCss(issue.theme)` (injected by the issue layout) both emitted `--color-bg` and `--color-text`. Because inline `<style>` tags load after `globals.css`, the injected light values (`BRAND_DEFAULTS.bg = #FAFAF8`) overrode the dark house defaults on every page, making the entire Phase 9 dark redesign invisible.

### Fix Applied

Three surgical removals in `apps/web/lib/theme.ts` — exactly 6 lines deleted, nothing else changed:

1. **`serializeThemeCss()` return array** (lines 299–308): Removed the `` `  --color-bg: ${p.bg};` `` and `` `  --color-text: ${p.text};` `` template literal entries. The emitted CSS now contains only `--color-accent`, `--color-primary`, `--font-body`, `--font-display`.

2. **`applyTheme()` main path** (lines 344–350): Removed `element.style.setProperty('--color-bg', p.bg)` and `element.style.setProperty('--color-text', p.text)`. Primary, accent, and both font setProperty calls remain.

3. **`applyTheme()` catch/fallback path** (lines 377–383): Removed `element.style.setProperty('--color-bg', BRAND_DEFAULTS.bg)` and `element.style.setProperty('--color-text', BRAND_DEFAULTS.text)`. Primary, accent, and both font fallback calls remain.

### Security Contract — Unchanged

The following were NOT touched and remain byte-for-byte intact:

- `validateHex()` — hex regex `/^#[0-9a-fA-F]{6}$/`
- `validateFont()` — FONT_WHITELIST membership check
- `FONT_WHITELIST` — 6-entry frozen array
- `BRAND_DEFAULTS` — bg/text/primary/accent/font constants (still referenced by `resolvePalette` and the WCAG gate)
- `resolvePalette()` — still computes bg/text for the WCAG AA gate; values are validated but no longer emitted
- `passesWcagAA()` / `contrastRatio()` / `relativeLuminance()` — pure WCAG math, untouched
- `setProperty`-only injection structure — still the only DOM API used

## Verification

### Grep assertions

```
serializeThemeCss --color-bg/text emitted lines:  0  (expect 0)
serializeThemeCss --color-primary/accent lines:   2  (expect 2)
setProperty(--color-bg/text) calls in file:       0  (expect 0)
setProperty(--color-primary/accent) calls:        4  (2 main + 2 catch — correct)
```

### Build

```
pnpm --filter web build → exit 0
"✓ Compiled successfully in 4.8s"
23 static pages generated, no type errors, no "Failed to compile".
```

### Unit tests

```
Test Files:  7 failed | 13 passed (20)
Tests:       29 failed | 138 passed (167)
```

All 29 failures are the known Phase 8/CMR Wave-0 baseline sentinels (checkout-create-session, legal-pages, shop-page, stripe-webhook, stripe-webhook-source, stripe-webhook-idempotency, thank-you-source). Zero new failures. All Phase 9 + theme suites green (issue-page-typography: 42/42, deliberation-agent-cards: 6/6, deliberation-qa-severity: 12/12, issue-page-shop-callout: 5/5, site-header-nav: 5/5, agents-route: 4/4).

### Only changed file

`git diff --name-only HEAD~1` → `apps/web/lib/theme.ts`

## Commit

- `d20ea6a` — `fix(quick-260521-n4l): stop theme injection from overriding --color-bg/--color-text (HYBRID model)`

## Deviations from Plan

None. Plan executed exactly as written — three surgical removals, no scope creep.

## Known Stubs / Backlog Item

**Non-issue pages now inherit the dark house background (#0C0B0A) from globals.css :root.**

Pages affected: `/` (home), `/archive`, `/charities`, `/charities/[slug]`, `/about`, `/shop`. These pages were previously rendered light (BRAND_DEFAULTS `#FAFAF8`) due to theme injection. With injection stopped, they now render dark.

Whether this is correct is a content/design question: the dark house palette IS the intended Phase 9 default for the entire site, so dark on these pages is expected behavior. However, these pages were designed and styled during earlier phases when the assumption was light-by-default. Component colors, text contrast, and image treatments on these pages may need a follow-up review to ensure they read well on the dark background.

**Action required (backlog):** A UX audit of all non-issue pages on the dark background — check text contrast, link colors, card surfaces, image borders, and any light-assumption styles in components used by `/`, `/archive`, `/charities`, `/about`, `/shop`. This is a separate styling pass and does NOT block issue page functionality.

Flagged as backlog item (do not fix in this quick task).

## Self-Check: PASSED

- `apps/web/lib/theme.ts` modified and committed: FOUND (`d20ea6a`)
- Build exit 0: CONFIRMED
- Test tally unchanged from 29-failure baseline: CONFIRMED
- Only `apps/web/lib/theme.ts` changed: CONFIRMED (`git diff --name-only HEAD~1`)
