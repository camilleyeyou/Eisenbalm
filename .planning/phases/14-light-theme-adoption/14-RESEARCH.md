# Phase 14: Light Theme Adoption — Research

**Researched:** 2026-05-24
**Domain:** CSS custom property token architecture, WCAG AA contrast, dark-to-light palette inversion
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md found for this phase — constraints sourced from ROADMAP.md and 14-UI-SPEC.md.

### Locked Decisions
- Single-fixed-palette architecture unchanged: DesignAgent stays suppressed, per-issue theming stays OFF
- `theme.ts` validation logic, `FONT_WHITELIST`, `WCAG_AA_THRESHOLD`, `BRAND_DEFAULTS`, `serializeThemeCss`, `applyTheme` — ALL function signatures and constants unchanged
- DESIGNAGENT_SUPPRESSED flag architecture unchanged: `suppressed ? '' : serializeThemeCss(theme)` expression preserved
- Game sandbox: `sandbox="allow-scripts"` only — never `allow-same-origin`
- Theme injection: `element.style.setProperty(name, value)` only — never `cssText`, `innerHTML`, string concat
- Hex validation: `/^#[0-9a-fA-F]{6}$/` before any CSS variable is set
- DEL-04: never expose model names in UI
- All exact token values and WCAG ratios come from `14-UI-SPEC.md` — that file is authoritative

### Claude's Discretion
- Test assertion threshold values (use UI-SPEC ratios ± 0.05 to account for rounding)
- Exact CSS block ordering within globals.css (preserve logical groupings)
- DesignAgent prompt prose — tone and word choice for the light aesthetic description

### Deferred Ideas (OUT OF SCOPE)
- Re-enabling per-issue theming / DesignAgent unsuppression
- Dark mode media query / system preference detection
- Any change to `theme.ts`, `FONT_WHITELIST`, or `BRAND_DEFAULTS`
- Any new component files or layout changes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIGHT-01 | All `--color-*` tokens in `:root` updated to light-palette values per UI-SPEC table | globals.css `:root` block; exact values from 14-UI-SPEC.md |
| LIGHT-02 | `color-mix()` derived tokens re-expressed for light bg (bright→darken, glow→reduce) | color-mix direction analysis below |
| LIGHT-03 | `theme-aa-tones.test.ts` updated: DARK_BG→LIGHT_BG, all assertions reflect new ratios, two new tokens added | Test update table from UI-SPEC; Wave 0 gap resolved |
| LIGHT-04 | `DeliberationSlot.tsx` `agentChipStyle()` editor branch: `--color-primary` → `--color-primary-text` (plus QA warning/error, advocate-score numerals, live indicator) | Single TSX change; agentChipStyle() analysis below |
| LIGHT-05 | globals.css small-text CSS classes updated: 11px uses of `--color-primary` → `--color-primary-text` (incl. live `.snw-tag-pill` hover/active text) | Identified class list: `.snw-*`, `.sc-*` |
| LIGHT-06 | DesignAgent system prompt updated: dark-canvas aesthetic → light-paper aesthetic | design/__init__.py text-only update |
| LIGHT-07 | Build passes + all theme tripwires green (no regression) after the re-tone | `pnpm --filter web build` + `npx vitest run __tests__/theme-aa-tones.test.ts`; gates Plans 02 & 03 (frontmatter requirements) |
</phase_requirements>

---

## Summary

Phase 14 reverses the Phase 12 dark palette lock (MED-01). The change surface is smaller than expected: **4 files** need edits — not the ~10 component files one might fear. The single-fixed-palette architecture (DesignAgent suppressed, per-issue theming off) is unchanged. All component files except one auto-resolve their colors through `--color-*` tokens.

**The primary risk is hardcoded color literals that bypass the token system.** Research found exactly ONE genuine regression risk: `rgba(0,0,0,0.7)` in `.section-card:hover` box-shadow (globals.css line ~525). This black drop-shadow becomes an inappropriate dark ring on paper background and must change to an ink-wash shadow. All other scanning candidates were false positives.

**The second risk is color-mix derivation direction.** Three derived tokens need explicit re-expression: `--color-primary-bright` (currently whitens gold, must darken it), `--color-primary-glow` (currently 40% opacity, must reduce to 12%), and aurora glows (reduce percentages for light bg). Two derived tokens (`--color-line`, `--color-line-strong`) auto-track correctly because they mix relative to `--color-text`.

**Primary recommendation:** Execute in 4 tasks matching the 4 files; treat globals.css as the anchor (largest change, contains both token redefinitions and hardcoded-color fixes); validate with the updated Vitest suite before merge.

---

## Standard Stack

No new libraries. All work is CSS and TypeScript edits within the existing stack.

| Tool | Version | Purpose | Note |
|------|---------|---------|------|
| Vitest | existing | AA contrast ratio tests | `theme-aa-tones.test.ts` update |
| CSS `color-mix()` | CSS Color 5 | Derived token expressions | Already used in globals.css |
| Tailwind CSS | existing | Utility classes | Zero changes — all via CSS vars |

**Installation:** None required.

---

## Architecture Patterns

### Change Surface — 4 Files Only

```
apps/web/app/globals.css                       ← PRIMARY — token values + hardcoded fix + class updates
apps/web/__tests__/theme-aa-tones.test.ts      ← TEST UPDATE — DARK_BG→LIGHT_BG + all assertions
apps/web/components/issue/DeliberationSlot.tsx ← SINGLE TSX CHANGE — agentChipStyle() editor branch
packages/pipeline/src/eisenbalm_pipeline/
  agents/design/__init__.py                    ← PROSE UPDATE — dark→light aesthetic description
```

### Files Confirmed Unchanged

| File | Why Unchanged |
|------|---------------|
| `apps/web/lib/theme.ts` | All logic/constants locked; BRAND_DEFAULTS already has light values (coincidental, irrelevant) |
| `apps/web/app/layout.tsx` | `themeColor: '#FAFAF8'` already correct for light |
| `apps/web/components/issue/IssueHero.tsx` | Zero hardcoded colors; all `var(--color-*)` inline styles |
| `apps/web/components/issue/SectionNavigator.tsx` | Zero hardcoded in TSX; color via `.snw-*` CSS classes (globals.css change covers this) |
| `apps/web/components/issue/PodcastSlot.tsx` | All `style={{}}` use `var(--color-*)` tokens; auto-resolves |
| `apps/web/components/issue/DeliberationSlot.tsx` (most of it) | All tokens except agentChipStyle() editor branch |
| Print stylesheet (`@media print`) in globals.css | `background: white !important; color: black !important` — correct regardless of live theme |
| shadcn shim `:root` block in globals.css | Identity re-exports (`--background: var(--color-bg)` etc.) — auto-resolves when core tokens change |

### Pattern 1: Token Swap in `:root` Block

The entire palette flip happens by replacing values in the single `:root { }` block at the top of `globals.css`. Every component that uses `var(--color-*)` inherits the new value automatically.

**Current dark values → light values (authoritative from 14-UI-SPEC.md):**

```css
/* DARK (current) → LIGHT (target) */
--color-bg:            #0C0B0A → #FAFAF8   /* warm paper */
--color-text:          #F0EAD9 → #1A1A1A   /* near-black ink */
--color-primary:       #CDA434 → #CDA434   /* gold unchanged */
--color-accent:        #C2502A → #C2502A   /* rust unchanged */
--color-surface:       #14110D → #F0ECE3   /* warmer paper */
--color-card:          #1A1611 → #EDE8DE   /* parchment */
--color-card-hover:    #221D16 → #E5DFD3   /* deeper parchment */
--color-text-dim:      #A89F8A → #595047   /* warm brown ink */
--color-text-mute:     #938A77 → #706860   /* medium ink (5.24:1 — just clears AA) */
--color-scout:         #8A9B7A → #3D6B2E   /* deeper green */
--color-advocate:      #6E92B8 → #1B4F8A   /* deeper blue */
```

> ⚠️ SURFACE-HEX CAVEAT (resolves checker WARNING 4): the surface/card hex shown in THIS code example (`#F0ECE3` / `#EDE8DE` / `#E5DFD3`) are an EARLIER warmer-paper draft. The AUTHORITATIVE values live in 14-UI-SPEC.md §Surface Tokens: `--color-surface #F2EFE9` / `--color-card #EDE9E1` / `--color-card-hover #E5E0D6`. When this example and the UI-SPEC table disagree, the UI-SPEC table WINS. Plans copy surface hex from the UI-SPEC table only.

**New tokens to ADD (not present in dark palette):**

```css
--color-primary-text:  #7A5C0E   /* 5.97:1 on #FAFAF8 — gold text that clears AA */
--color-accent-text:   #9B3015   /* 7.11:1 on #FAFAF8 — rust text that clears AA */
```

These are needed because raw `--color-primary` (#CDA434) is only 2.24:1 on light bg and `--color-accent` (#C2502A) is only 4.49:1 (passes AA-large but not AA normal text).

### Pattern 2: color-mix Re-Expression

Three derived tokens require explicit re-expression, not just value inheritance:

```css
/* --color-primary-bright: CHANGE DIRECTION */
/* Dark (current): mixes toward white — makes gold lighter */
--color-primary-bright: color-mix(in srgb, var(--color-primary) 78%, white 22%);
/* Light (target): mixes toward black — makes gold darker (legible on paper) */
--color-primary-bright: color-mix(in srgb, var(--color-primary) 78%, black 22%);

/* --color-primary-glow: REDUCE OPACITY */
/* Dark (current): 40% opacity — vivid halo on dark bg */
--color-primary-glow: color-mix(in srgb, var(--color-primary) 40%, transparent);
/* Light (target): 12% opacity — subtle wash on paper */
--color-primary-glow: color-mix(in srgb, var(--color-primary) 12%, transparent);
```

**Auto-tracking correctly (no expression change needed):**
```css
/* --color-line and --color-line-strong: auto-track via --color-text */
--color-line:       color-mix(in srgb, var(--color-text) 8%,  transparent);
--color-line-strong: color-mix(in srgb, var(--color-text) 16%, transparent);
/* On light: var(--color-text) = #1A1A1A; 8% ink on #FAFAF8 ≈ #E9E6E2 hairline. Correct. */
```

### Pattern 3: Aurora Reduction

The `.aurora` section (Phase 9 block in globals.css) uses `color-mix()` at percentages that create visible glows on dark bg. On light bg these become muddy stains:

```css
/* Dark (current) → Light (target) */
/* Phase 9 aurora percentages: 10%/6%/4% → 5%/3%/2% */
/* Exact expressions: locate via "aurora" comment block */
```

### Pattern 4: Small-Text Class Updates in globals.css

These CSS classes use `color: var(--color-primary)` at 11px text — that's 2.24:1 on light bg, failing AA. Must switch to `--color-primary-text`:

```css
/* All of these in globals.css — change var(--color-primary) → var(--color-primary-text) */
.snw-section-num { color: var(--color-primary-text); }   /* was --color-primary */
.snw-read-value  { color: var(--color-primary-text); }   /* was --color-primary */
.snw-title-accent { color: var(--color-primary-text); }  /* was --color-primary */
.snw-module-label { color: var(--color-primary-text); }  /* was --color-primary */
.sc-num          { color: var(--color-primary-text); }   /* was --color-primary */
.sc-arrow        { color: var(--color-primary-text); }   /* was --color-primary */
/* PLUS (checker BLOCKER 1) the LIVE Phase-12 nav tag-pill hover/active TEXT: */
.snw-row:hover .snw-tag-pill,
.snw-row.active .snw-tag-pill { color: var(--color-primary-text); }  /* border-color stays raw gold */
```

### Pattern 5: Single TSX Code Change

**File:** `apps/web/components/issue/DeliberationSlot.tsx`
**Function:** `agentChipStyle()` editor branch (plus QA warning/error, advocate-score numerals, live indicator per checker BLOCKER 3)

```typescript
// CURRENT (fails AA on light — #CDA434 at 11px = 2.24:1 on #FAFAF8)
if (agentId === 'editor') {
  return {
    color: 'var(--color-primary)',
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
  }
}

// TARGET (passes AA — #7A5C0E = 5.97:1 on #FAFAF8)
if (agentId === 'editor') {
  return {
    color: 'var(--color-primary-text)',
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
  }
}
```

Note: `chip.color` (which is `agentChipStyle().color`) is used for both the chip span and the speaker name `p` tag in the chat thread. The single function change covers both rendered locations. The advocate-score `{scoreValue}/10` numerals (11px) and the "● live" indicator (11px) ALSO render raw gold and are listed under `--color-primary-text` in the UI-SPEC §Accent-as-Text table — Plan 03 changes those too.

### Pattern 6: Hardcoded Shadow Fix

**File:** `apps/web/app/globals.css`
**Selector:** `.section-card:hover`
**Location:** Approximately line 525

```css
/* CURRENT — black ring on paper bg */
.section-card:hover {
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.7);
}

/* TARGET — ink-wash paper shadow per UI-SPEC */
.section-card:hover {
  box-shadow: 0 24px 60px -20px rgba(90, 75, 50, 0.18);
}
```

### Pattern 7: DesignAgent Prose Update

**File:** `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py`

Text-only replacement in the aesthetic envelope system prompt block:

```
CURRENT description references:
  - Canvas: #0C0B0A (near-black)
  - Ink: #F0EAD9 (cream)
  - Dark aurora glows, deep shadows

TARGET description references:
  - Canvas: #FAFAF8 (warm paper / daylight broadsheet)
  - Ink: #1A1A1A (near-black)
  - Ink-wash atmosphere, paper shadows, diffuse light
```

No logic changes. No function signatures. Pure prose update.

### Anti-Patterns to Avoid

- **Changing theme.ts**: BRAND_DEFAULTS already has light values (`bg: '#FAFAF8'`, `text: '#1A1A18'`) but these are per-issue theme fallbacks, NOT the house palette. Do not touch this file.
- **Adding a media query for dark/light mode**: Phase 14 is a hard palette switch, not adaptive theming.
- **Modifying serializeThemeCss or applyTheme**: Suppression contract depends on `suppressed ? '' : serializeThemeCss(theme)` being unchanged.
- **Touching schema files**: Zero schema changes in this phase.
- **Changing FONT_WHITELIST**: Out of scope; locked.
- **Removing the `.bg-grid` mask `#000` stops**: These are mask transparency stops controlling edge fade, not page colors. They work correctly on both dark and light backgrounds. Do NOT change them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Contrast ratio calculation | Custom math | Existing `relLuminance()` + `contrastRatio()` in `theme-aa-tones.test.ts` |
| Token list | New registry | Existing `:root` block in globals.css |
| WCAG threshold constants | New constants | Existing `AA = 4.5`, `AA_LARGE = 3.0` in test file |

---

## Hardcoded Color Audit (Critical Planning Input)

### Genuine Regression Risk: 1 item

| File | Selector | Current Value | Issue | Fix |
|------|----------|---------------|-------|-----|
| globals.css ~L525 | `.section-card:hover box-shadow` | `rgba(0,0,0,0.7)` | Dark ring on paper bg | `rgba(90,75,50,0.18)` per UI-SPEC |

### False Positives (confirmed safe — no change needed)

| File | Location | Value | Why Safe |
|------|----------|-------|----------|
| globals.css | `.bg-grid mask-image` (L383-384, L390-391) | `#000 8%` / `#000 92%` | Mask transparency stops — control which parts of grid are visible, not color. Work correctly on both dark and light bg. |
| layout.tsx L86 | `<meta name="theme-color">` | `#FAFAF8` | Already the target light value. |
| globals.css | `@media print` | `white`, `black` | Print stylesheet — correct regardless of live theme. |

### Vitest Tripwire Tests

The existing source-scan tripwire tests in `theme-aa-tones.test.ts` grep for hardcoded color literals in component files. After Phase 14, the test's `EXPECTED_VIOLATIONS` allowlist may need updating if any currently-allowed literal is removed. Planner should note: the test file itself will have the most changes (DARK_BG → LIGHT_BG + all assertion values).

---

## Common Pitfalls

### Pitfall 1: color-mix Direction Blindness
**What goes wrong:** Updating `--color-primary-bright` value only (e.g., changing the percentage) without flipping `white` → `black`. Gold mixed toward white gets _lighter_ on light bg — less visible, not more.
**Why it happens:** Dark bg developer instinct — "brighter = more white". On light bg "brighter contrast" means slightly darker (deeper) gold.
**How to avoid:** Explicitly verify: `color-mix(in srgb, var(--color-primary) 78%, black 22%)` produces ~#AE8A2A, visibly deeper than raw gold (#CDA434). Check in browser.
**Warning signs:** Gold text looks washed out / low-contrast on paper after update.

### Pitfall 2: Missing the 11px Small-Text AA Failure
**What goes wrong:** Updating `:root` token values but forgetting that CSS classes using `var(--color-primary)` at 11px still fail AA (gold = 2.24:1 on light).
**Why it happens:** Token auto-resolution makes it look like "everything is fixed". AA pass/fail depends on text size — 4.49:1 passes AA-large but not normal text.
**How to avoid:** Use `--color-primary-text` (#7A5C0E, 5.97:1) for ALL text < 18px using the gold color. Class list: `.snw-section-num`, `.snw-read-value`, `.snw-title-accent`, `.snw-module-label`, `.sc-num`, `.sc-arrow`, and the live `.snw-tag-pill` hover/active text.
**Warning signs:** Vitest test `--color-primary on light bg` assertion fires; SectionNavigator nav labels look faint.

### Pitfall 3: DESIGNAGENT_SUPPRESSED Contract Break
**What goes wrong:** Touching the `suppressed ? '' : serializeThemeCss(theme)` expression path in an attempt to "apply the light theme programmatically".
**Why it happens:** The light palette looks like it should be "applied", not just be the CSS default. But the suppressed path returning `''` is exactly what makes `:root` defaults win. Changing this would cause BRAND_DEFAULTS to override the house palette.
**How to avoid:** Do not touch `theme.ts`, `DesignAgent.__init__.py` logic sections, or the suppression flag evaluation.
**Warning signs:** Per-issue `style=""` attribute appears on `<html>` with BRAND_DEFAULTS values, overriding house palette.

### Pitfall 4: Aurora Muddiness
**What goes wrong:** Leaving aurora `color-mix` percentages at dark-bg levels (10%/6%/4%) — on light bg these create visible amber/rust stains instead of subtle atmosphere.
**Why it happens:** Dark bg aurora glows are barely perceptible at high percentages; same percentages on light bg become prominent color patches.
**How to avoid:** Halve all aurora color-mix percentages per UI-SPEC: 10%→5%, 6%→3%, 4%→2%.
**Warning signs:** Issue pages have visible gold or rust smears in the background near hero section.

### Pitfall 5: Test File DARK_BG→LIGHT_BG Miss
**What goes wrong:** Updating token values in globals.css but not updating the test file — tests pass on wrong bg (still asserting against `#0C0B0A`).
**Why it happens:** The test file change is the most mechanical but easy to overlook when focused on globals.css.
**How to avoid:** Update `DARK_BG → LIGHT_BG = '#FAFAF8'` first, run tests (expect failures), then update assertions to match.
**Warning signs:** Old tests still pass even with wrong new colors — confirms tests are still using dark bg constant.

### Pitfall 6: QA Severity Warning Gold (Open Question)
**What:** `QA_SEVERITY.warning` in `DeliberationSlot.tsx` uses `color: 'var(--color-primary)'` for Warning pill border and text at small size.
**Status:** UI-SPEC Component Reconciliation Summary does NOT flag this — it only flags `agentChipStyle()`. At badge/pill usage the visual prominence may be acceptable. However: if Warning severity text is rendered at < 18px on a `#FAFAF8` or `#EDE8DE` background, it fails AA.
**Resolution (checker BLOCKER 3):** The Warning pill text renders at 11px — raw gold fails AA. Plan 03 changes `QA_SEVERITY.warning.color` → `--color-primary-text` and `QA_SEVERITY.error.color` → `--color-accent-text`. The advocate-score numerals and the "● live" indicator (also 11px gold) are likewise switched to `--color-primary-text` per the UI-SPEC §Accent-as-Text token table (authoritative over the §Component Reconciliation Summary).

---

## Code Examples

### globals.css `:root` target state (key tokens)

```css
/* Source: 14-UI-SPEC.md token table — authoritative */
:root {
  /* Backgrounds — AUTHORITATIVE hex is the UI-SPEC table (#F2EFE9 / #EDE9E1 / #E5E0D6) */
  --color-bg: #FAFAF8;
  --color-surface: #F2EFE9;
  --color-card: #EDE9E1;
  --color-card-hover: #E5E0D6;

  /* Text */
  --color-text: #1A1A1A;
  --color-text-dim: #595047;
  --color-text-mute: #706860;

  /* Brand (unchanged hue, new text variants) */
  --color-primary: #CDA434;          /* decorative gold — fails AA on light for text */
  --color-primary-text: #7A5C0E;    /* NEW — use for small gold text (5.97:1) */
  --color-accent: #C2502A;           /* decorative rust — passes AA-large only */
  --color-accent-text: #9B3015;     /* NEW — use for small rust text (7.11:1) */

  /* Derived (re-expressed for light bg) */
  --color-primary-bright: color-mix(in srgb, var(--color-primary) 78%, black 22%);
  --color-primary-glow:   color-mix(in srgb, var(--color-primary) 12%, transparent);

  /* Auto-tracking (expression unchanged) */
  --color-line:       color-mix(in srgb, var(--color-text) 8%,  transparent);
  --color-line-strong: color-mix(in srgb, var(--color-text) 16%, transparent);

  /* Agent colors (deeper for light bg contrast) */
  --color-scout:    #3D6B2E;  /* 6.01:1 */
  --color-advocate: #1B4F8A;  /* 7.94:1 */
}
```

### theme-aa-tones.test.ts target state (key changes)

```typescript
// Source: 14-UI-SPEC.md test update table
const LIGHT_BG = '#FAFAF8'  // was: const DARK_BG = '#0C0B0A'

describe('CSS token contrast on light background', () => {  // updated describe name

  it('--color-text passes AA', () => {
    // #1A1A1A on #FAFAF8 = 16.65:1
    expect(contrastRatio('#1A1A1A', LIGHT_BG)).toBeGreaterThan(15.0)
  })

  it('--color-text-dim passes AA', () => {
    // #595047 on #FAFAF8 = 7.55:1
    expect(contrastRatio('#595047', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-text-mute passes AA', () => {
    // #706860 on #FAFAF8 = 5.24:1
    expect(contrastRatio('#706860', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-primary is decorative (fails AA on light)', () => {
    // #CDA434 on #FAFAF8 = 2.24:1 — decorative only
    expect(contrastRatio('#CDA434', LIGHT_BG)).toBeLessThan(AA)
  })

  it('--color-primary-text passes AA (new token)', () => {
    // #7A5C0E on #FAFAF8 = 5.97:1
    expect(contrastRatio('#7A5C0E', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-accent-text passes AA (new token)', () => {
    // #9B3015 on #FAFAF8 = 7.11:1
    expect(contrastRatio('#9B3015', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-scout passes AA', () => {
    // #3D6B2E on #FAFAF8 = 6.01:1
    expect(contrastRatio('#3D6B2E', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-advocate passes AA', () => {
    // #1B4F8A on #FAFAF8 = 7.94:1
    expect(contrastRatio('#1B4F8A', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  // Rejected value documentation (updated):
  // was: '#615B4D' fails dark bg
  // now: '#938A77' (old --color-text-mute) = 3.89:1 on #FAFAF8 — fails AA, replaced by #706860
  it('rejected --color-text-mute value fails AA on light', () => {
    expect(contrastRatio('#938A77', LIGHT_BG)).toBeLessThan(AA)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dark editorial palette (Phase 9 / Phase 12 MED-01 lock) | Light paper palette | Phase 14 | All `--color-*` token values flip; color-mix derivations re-expressed |
| `--color-primary` used for all gold text | `--color-primary-text` for small text | Phase 14 | 2.24:1 → 5.97:1 at 11px; AA-compliant |
| No paper shadow token | `rgba(90,75,50,0.18)` ink-wash shadow | Phase 14 | `.section-card:hover` shadow matches paper aesthetic |

**Decisions from previous phases that Phase 14 preserves:**
- Phase 12: `suppressed ? '' : serializeThemeCss(theme)` — empty string for suppressed path
- Phase 12: Single-fixed-palette architecture
- Phase 13: `.del-conversation` block in globals.css (preserve, update token values)
- Phase 9: Aurora CSS block structure (preserve, reduce percentages only)

---

## Open Questions

1. **QA Severity Warning gold text** — RESOLVED (checker BLOCKER 3)
   - What we know: `QA_SEVERITY.warning.color = 'var(--color-primary)'` in DeliberationSlot.tsx. Gold = 2.24:1 on light bg. The Warning pill renders at `text-[11px]`.
   - Resolution: 11px is normal-text size, so it fails AA. Plan 03 switches `QA_SEVERITY.warning` → `--color-primary-text` and `QA_SEVERITY.error` → `--color-accent-text`. The advocate-score numerals and the "● live" indicator (also 11px gold) are switched to `--color-primary-text` per UI-SPEC §Accent-as-Text (authoritative token table).

2. **DesignAgent FONT_WHITELIST mismatch**
   - What we know: `theme.ts` FONT_WHITELIST has 6 entries; `design/__init__.py` has an extended list (~17 entries) for the aesthetic envelope prompt.
   - What's unclear: Do any of the 17 prompt entries reference dark-specific fonts that should change for light palette?
   - Recommendation: Planner should verify that the extended font list in design/__init__.py is unchanged — it describes available options, not selected ones, and likely needs no update.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is CSS/TypeScript file edits only).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `apps/web/vitest.config.ts` (existing) |
| Quick run command | `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` |
| Full suite command | `cd apps/web && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIGHT-01 | `:root` token values emit correct hex | unit | `npx vitest run __tests__/theme-aa-tones.test.ts` | ✅ (needs update) |
| LIGHT-02 | Derived tokens produce expected visual (color-mix) | manual | Open browser, inspect computed styles | ✅ n/a |
| LIGHT-03 | All AA contrast assertions pass on LIGHT_BG | unit | `npx vitest run __tests__/theme-aa-tones.test.ts` | ✅ (needs update) |
| LIGHT-04 | Editor chip / QA / advocate-score / live-indicator use -text variants | unit (source scan) | `npx vitest run __tests__/theme-aa-tones.test.ts` | ✅ (update scan pattern) |
| LIGHT-05 | `.snw-*` / `.sc-*` classes (incl. `.snw-tag-pill`) use `--color-primary-text` | unit (source scan) | `npx vitest run __tests__/theme-aa-tones.test.ts` | ✅ (add scan pattern) |
| LIGHT-06 | DesignAgent prompt references light canvas | manual | `grep '#FAFAF8\|warm paper\|daylight' packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` | ✅ manual |
| LIGHT-07 | Build passes + all theme tripwires green (no regression) | build + unit | `pnpm --filter web build` && `npx vitest run __tests__/theme-aa-tones.test.ts` | ✅ |

### Sampling Rate

- **Per task commit:** `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts`
- **Per wave merge:** `cd apps/web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

The test file requires **update** not creation. The Vitest infrastructure is already in place. No new test files needed.

Required test file changes before implementation can be verified:

- [ ] `apps/web/__tests__/theme-aa-tones.test.ts` — rename `DARK_BG` → `LIGHT_BG`, update all hex values and assert thresholds per UI-SPEC table, add `--color-primary-text` and `--color-accent-text` assertions, add rejected-value doc for `#938A77`

Optional source-scan additions (if existing tripwire tests don't cover):

- [ ] Add scan pattern: `--color-primary` in `.snw-*` / `.sc-*` CSS selectors (incl. `.snw-tag-pill` hover/active text) should NOT appear after Phase 14 (should be `--color-primary-text`)
- [ ] Add scan pattern: `rgba(0,0,0,` in `.section-card` should NOT appear after Phase 14
- [ ] Add conditional guard for `.section-card.feature .sc-name` (fixed if rendered, tolerated only if confirmed dead code)

---

## Sources

### Primary (HIGH confidence)
- `14-UI-SPEC.md` — authoritative token table, WCAG ratios, component reconciliation summary, test update table
- `apps/web/app/globals.css` — direct read; all `:root` values, CSS class definitions, hardcoded color scan
- `apps/web/__tests__/theme-aa-tones.test.ts` — direct read; existing test structure, DARK_BG constant, assertion patterns
- `apps/web/components/issue/DeliberationSlot.tsx` — direct read; agentChipStyle(), QA_SEVERITY map
- `apps/web/lib/theme.ts` — direct read; BRAND_DEFAULTS, FONT_WHITELIST, serializeThemeCss, applyTheme
- `apps/web/app/layout.tsx` — direct read; confirmed themeColor: '#FAFAF8' already correct
- `.planning/STATE.md` — Phase 9, 12, 13 decisions affecting Phase 14 scope
- `.planning/ROADMAP.md` — Phase 14 entry, 6 success criteria

### Secondary (MEDIUM confidence)
- `apps/web/components/issue/IssueHero.tsx` — direct read; confirmed zero hardcoded colors
- `apps/web/components/issue/SectionNavigator.tsx` — direct read; confirmed zero hardcoded in TSX (renders `.snw-tag-pill`)
- `apps/web/components/issue/PodcastSlot.tsx` — direct read; confirmed all tokens
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` — direct read; confirmed aesthetic envelope location

---

## Metadata

**Confidence breakdown:**
- Change surface (4 files): HIGH — direct file reads, no inference
- Hardcoded color audit: HIGH — direct grep confirmed 1 genuine risk, 2 false positives
- color-mix analysis: HIGH — CSS Color 5 spec behavior is deterministic
- Token values: HIGH — sourced directly from 14-UI-SPEC.md (authoritative)
- Pitfalls: HIGH — sourced from STATE.md decisions and direct code inspection

**Research date:** 2026-05-24
**Valid until:** Stable until any of the 4 change-surface files is modified
</content>
