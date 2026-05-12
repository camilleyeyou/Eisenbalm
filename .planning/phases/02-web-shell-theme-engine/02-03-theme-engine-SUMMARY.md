---
phase: 02-web-shell-theme-engine
plan: 03
subsystem: apps/web/lib/theme.ts
tags: [theme-engine, security, wcag, css-variables, validation]
dependency_graph:
  requires:
    - apps/web/lib/sanity/types.ts (IssueTheme type — provided by 02-02)
  provides:
    - apps/web/lib/theme.ts (validateHex, validateFont, relativeLuminance, contrastRatio, passesWcagAA, serializeThemeCss, applyTheme, FONT_WHITELIST, BRAND_DEFAULTS, HEX_REGEX, WCAG_AA_THRESHOLD)
  affects:
    - apps/web/app/issue/[slug]/layout.tsx (02-06 imports applyTheme)
    - apps/web/app/issue/[slug]/page.tsx (02-06 imports serializeThemeCss for FOUC prevention)
    - Phase 5 (DesignAgent) — FONT_WHITELIST is extended here, one-line append
    - Phase 6 (WeasyPrint) — same 6 font names used for base64 @font-face declarations
tech_stack:
  added: []
  patterns:
    - WCAG 2.1 relative luminance formula (inline, no lib)
    - element.style.setProperty() as exclusive DOM injection API
    - Object.freeze() for immutable FONT_WHITELIST and BRAND_DEFAULTS
key_files:
  created:
    - apps/web/lib/theme.ts
    - apps/web/lib/theme.test.ts
  modified: []
decisions:
  - validateHex returns string|null (not boolean) so callers can use the validated value directly without a second lookup
  - resolvePalette is internal (not exported) — callers use applyTheme or serializeThemeCss; the palette resolution logic is not a public API surface
  - WCAG fallback applies to bg+text only; primary+accent retain validated values regardless of contrast (they are not body-text colors)
  - Test runner chosen: apps/studio/node_modules/.bin/tsx --test (tsx workspace-resolvable from repo root; no new dep added to apps/web)
  - serializeThemeCss uses join('\n') on an array rather than template literals to avoid any possibility of multi-line injection artifacts
metrics:
  duration_minutes: 4
  completed_date: "2026-05-12"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
requirements: [WEB-06, WEB-07, WEB-08, WEB-09]
---

# Phase 2 Plan 3: Theme Engine Summary

Security-critical theme engine with hex regex validation, WCAG AA contrast gating, 6-font whitelist, and setProperty-only DOM injection.

## What Was Built

`apps/web/lib/theme.ts` — 389 lines, zero dependencies beyond Node.js built-ins and the `IssueTheme` type import. Exports:

| Export | Purpose |
|--------|---------|
| `HEX_REGEX` | `/^#[0-9a-fA-F]{6}$/` — the locked validation regex |
| `WCAG_AA_THRESHOLD` | `4.5` — WCAG AA body text threshold |
| `FONT_WHITELIST` | Frozen array of 6 safe Google Fonts |
| `BRAND_DEFAULTS` | Frozen brand palette + default fonts |
| `validateHex(value)` | Returns string if valid 6-digit hex, else null |
| `validateFont(value)` | Returns WhitelistedFont if in FONT_WHITELIST, else null |
| `relativeLuminance(hex)` | WCAG 2.1 luminance (0.2126 R + 0.7152 G + 0.0722 B) |
| `contrastRatio(fg, bg)` | WCAG contrast ratio; returns 0 on invalid input |
| `passesWcagAA(text, bg)` | Returns true iff ratio >= 4.5 |
| `serializeThemeCss(theme)` | `:root { ... }` string for server-side FOUC prevention |
| `applyTheme(element, theme)` | Client-side injection via setProperty only; never throws |

## Security Contract Satisfied

- **WEB-07 (hex validation):** `/^#[0-9a-fA-F]{6}$/` rejects named colors, shorthand, rgb(), hsl(), empty strings, non-strings. Every CSS variable goes through `validateHex` before any setProperty call.
- **WEB-08 (setProperty only):** `applyTheme` uses `element.style.setProperty(name, value)` exclusively. No `cssText`, no `innerHTML`, no template-literal `<style>` tags.
- **WEB-09 (WCAG AA):** `contrastRatio(text, bg) < 4.5` triggers fallback of both bg and text to `BRAND_DEFAULTS`. Primary and accent are not subject to the contrast gate (they are not body-text colors). Failure is logged via `console.warn` with the exact ratio.
- **WEB-06 (CSS variables):** All 6 required CSS variables are set: `--color-bg`, `--color-text`, `--color-primary`, `--color-accent`, `--font-display`, `--font-body`. The `--font-ui` variable is never overridden by theme per UI-SPEC.

## Font Whitelist (Phase 2)

Six fonts — all WeasyPrint-safe (Phase 6 dependency locked in now):

1. `Playfair Display` — default `--font-display`
2. `Lora` — default `--font-body`
3. `Inter` — UI font (never themed)
4. `Cormorant Garamond` — alt display
5. `Merriweather` — alt body
6. `DM Serif Display` — alt display

**Phase 5 extension:** FONT_WHITELIST is extended by appending to the frozen array in this file. No other code change is required — `validateFont` reads from the same constant.

## Brand Fallback Palette (from UI-SPEC)

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-bg` | `#FAFAF8` | Off-white, warm editorial |
| `--color-text` | `#1A1A18` | Near-black, high contrast |
| `--color-primary` | `#2D5016` | Forest green, editorial authority |
| `--color-accent` | `#8B1A1A` | Deep crimson, CTA color |

Brand default pair contrast ratio: >15:1 (far exceeds 4.5:1 threshold).

## Test Coverage

`apps/web/lib/theme.test.ts` — 54 tests, all pass.

Test runner: `apps/studio/node_modules/.bin/tsx --test apps/web/lib/theme.test.ts`
(tsx is workspace-resolvable from repo root; no new dependency added to apps/web)

Covered:
- `validateHex`: 11 tests (accepts valid, rejects 3-digit, 8-digit, named, rgb/hsl/var, non-hex chars, non-strings, empty)
- `validateFont`: 4 tests (accepts whitelist, rejects non-whitelist, rejects non-strings, case-sensitive)
- `relativeLuminance`: 5 tests (white=1, black=0, mid-gray≈0.2158, brand bg, NaN on invalid)
- `contrastRatio`: 7 tests (black/white≈21, symmetric, same-color=1, brand defaults>15, invalid→0)
- `passesWcagAA`: 7 tests (brand defaults, black/white, gray/white fail, invalid inputs fail, threshold constant)
- `FONT_WHITELIST`: 2 tests (6 entries, all required fonts present)
- `HEX_REGEX`: 3 tests (pattern source locked, positive, negative)
- `BRAND_DEFAULTS`: 2 tests (palette matches UI-SPEC, fonts are whitelisted)
- `serializeThemeCss`: 7 tests including XSS injection attempt (not-a-hex, `"><script>alert(1)</script>` — both absent from output)
- `applyTheme`: 6 tests including injection attempt security test, null element handling

## Commits

| Hash | Message |
|------|---------|
| `094830c` | feat(02-03): implement security-critical theme engine module |
| `6b3b9dd` | test(02-03): add smoke tests for theme engine security contract |

## Deviations from Plan

None — plan executed exactly as written.

The plan's action block included a complete reference implementation. The executor implemented it faithfully, with two minor adjustments:

1. Comment phrasing for FORBIDDEN patterns was adjusted to avoid grep false-positives in the verify step (the original JSDoc said `element.style.cssText = ...` as an example of forbidden usage, which would match the `! grep -q "element\.style\.cssText"` verify check). Reworded to avoid the false positive while preserving the documentation intent.

2. `apps/web/lib/sanity/types.ts` was created as a stub with just `IssueTheme` before plan 02-02's full version replaced it (parallel wave execution). The stub was superseded by 02-02's richer types file — no conflict, the `IssueTheme` export is identical.

## Known Stubs

None. The theme engine is fully wired with real validation logic and brand defaults. No placeholder values flow to UI rendering.

## Self-Check: PASSED

- apps/web/lib/theme.ts: FOUND
- apps/web/lib/theme.test.ts: FOUND
- commit 094830c: FOUND
- commit 6b3b9dd: FOUND
- 54/54 tests pass (re-run confirmed)
