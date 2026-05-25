/**
 * Phase 14 — AA contrast gate for house tones on the light base (#FAFAF8).
 *
 * The theme engine (apps/web/lib/theme.ts) gates bg+text pairs at 4.5:1
 * but does NOT gate secondary tones. This test file is the build-level
 * assertion that every house text/UI tone passes WCAG AA (≥4.5:1) on the
 * light house bg (#FAFAF8).
 *
 * Phase 14 flips the palette from the Phase 9 dark (#0C0B0A) base to the
 * locked warm-paper light (#FAFAF8) base. All hex values below are copied
 * verbatim from .planning/phases/14-light-theme-adoption/14-UI-SPEC.md.
 *
 * New in Phase 14:
 *   - Two AA-safe "text" variants (#7A5C0E, #9B3015) asserted to pass AA.
 *   - Raw gold #CDA434 asserted BELOW AA on light (decorative only).
 *   - Dark mute #938A77 documented as failing on the light base.
 *   - Source-scan tripwires (see "Phase 14 source-scan tripwires" describe)
 *     that gate Plan 02 (globals.css re-tone) and Plan 03 (DeliberationSlot).
 *
 * If a contrast ratio assertion fails: fix the CSS variable in globals.css,
 * not this test. The accepted values are locked by 14-UI-SPEC.md.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/lib/theme'

/** Light house background (--color-bg). */
const LIGHT_BG = '#FAFAF8'

/** WCAG AA threshold for body text (normal size). */
const AA = 4.5

/** WCAG AA threshold for large text (≥18px or ≥14px bold). */
const AA_LARGE = 3.0

describe('Phase 14 house tones — WCAG AA on light bg (#FAFAF8)', () => {
  it('--color-text #1A1A1A passes AA (primary body text, 16.65:1)', () => {
    expect(contrastRatio('#1A1A1A', LIGHT_BG)).toBeGreaterThan(15.0)
  })

  it('--color-text-dim #595047 passes AA (secondary prose, 7.55:1)', () => {
    const ratio = contrastRatio('#595047', LIGHT_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    // Expected ~7.55:1; confirm it is meaningfully above threshold
    expect(ratio).toBeGreaterThan(7.0)
  })

  it('--color-text-mute #706860 passes AA (tertiary labels — just clears 5.24:1)', () => {
    // Replaces the dark-bg --color-text-mute #938A77 which fails on light.
    // This value just clears AA; no additional >5 guard (5.24:1 margin is thin).
    expect(contrastRatio('#706860', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('dark --color-text-mute #938A77 FAILS AA on light bg (3.89:1) — must never appear as text on #FAFAF8', () => {
    // Documents why the old dark-base mute was rejected for the light palette.
    // #938A77 scored 5.8:1 on dark (#0C0B0A) but only 3.89:1 on light — below 4.5:1.
    // Replaced by #706860 (5.24:1). Never use #938A77 as text color on light bg.
    expect(contrastRatio('#938A77', LIGHT_BG)).toBeLessThan(AA)
  })

  it('--color-scout #3D6B2E (moss) passes AA on light bg (6.01:1)', () => {
    const ratio = contrastRatio('#3D6B2E', LIGHT_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(ratio).toBeGreaterThan(5.5)
  })

  it('--color-advocate #1B4F8A (deep navy) passes AA on light bg (7.94:1)', () => {
    const ratio = contrastRatio('#1B4F8A', LIGHT_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(ratio).toBeGreaterThan(7.0)
  })

  it('--color-primary #CDA434 (gold) FAILS AA as normal text on light bg (2.24:1) — decorative only', () => {
    // Gold fails AA as text on light; use --color-primary-text for text.
    // Gold is decorative: fills, borders, active-state dots, drop-cap, ornaments.
    // NEVER use --color-primary as a normal-size text color on the light palette.
    expect(contrastRatio('#CDA434', LIGHT_BG)).toBeLessThan(AA)
  })

  it('--color-accent #C2502A (rust) passes AA-large only on light bg (4.49:1)', () => {
    const ratio = contrastRatio('#C2502A', LIGHT_BG)
    // Rust passes AA-large (≥3:1) at 4.49:1, but does NOT meet normal AA (≥4.5:1).
    // Use at ≥18px or for borders/icons. Use --color-accent-text for normal-size text.
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE)
    // Deliberately assert it falls below normal-text AA threshold:
    expect(ratio).toBeLessThan(AA)
  })

  it('--color-primary-text #7A5C0E passes AA (gold darkened for text/link use, 5.97:1)', () => {
    // New token in Phase 14. Use instead of --color-primary wherever gold
    // appears as normal-size clickable text, labels, or named small text.
    expect(contrastRatio('#7A5C0E', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-accent-text #9B3015 passes AA (rust darkened for text/link use, 7.11:1)', () => {
    // New token in Phase 14. Use instead of --color-accent for QA error labels,
    // editor del-flow-label, and any rust-colored normal-size text.
    expect(contrastRatio('#9B3015', LIGHT_BG)).toBeGreaterThanOrEqual(AA)
  })
})

// ─── Source-scan tripwires ─────────────────────────────────────────────────────
//
// These tripwires assert the no-raw-gold-as-text contract at the source level.
// They will be RED until Plans 02/03 land — that is the intended TDD gate.
//
// BLOCKER 1: .snw-tag-pill hover/active text must use --color-primary-text
// BLOCKER 2: .section-card.feature .sc-name must be fixed OR confirmed dead code
// BLOCKER 3: DeliberationSlot advocate-score numerals + live indicator + editor
//            chip + QA warning/error must use -text variants
//
// readFileSync calls are inside each it() body so Vitest collection never throws
// even if a path is temporarily missing. (Phase 9 pattern — STATE.md decision.)

describe('Phase 14 source-scan tripwires', () => {
  // ── BLOCKER 1 + misc globals.css small-text gold ─────────────────────────

  it('globals.css: small-text gold classes use --color-primary-text, not raw --color-primary', () => {
    const css = readFileSync(resolve(__dirname, '..', 'app/globals.css'), 'utf8')

    // Helper: extract a CSS selector's declaration block as text.
    // Scans from the first occurrence of the selector string to the matching '}'.
    // Returns empty string if not found so assertions give useful failure messages.
    function extractBlock(selector: string): string {
      const idx = css.indexOf(selector)
      if (idx === -1) return ''
      const start = css.indexOf('{', idx)
      if (start === -1) return ''
      const end = css.indexOf('}', start)
      if (end === -1) return ''
      return css.slice(start, end + 1)
    }

    // The seven rendered small-text gold spots that MUST use --color-primary-text
    // for their text `color:` declaration (not --color-primary) per 14-UI-SPEC.md.
    const selectors = [
      '.snw-section-num',
      '.snw-module-label',
      '.snw-read-value',
      '.snw-title-accent',
      '.sc-num',
      '.sc-arrow',
    ]

    for (const sel of selectors) {
      const block = extractBlock(sel)
      // Must NOT use the raw token as a color: declaration
      expect(block, `${sel} must not use color: var(--color-primary);`).not.toContain(
        'color: var(--color-primary);'
      )
      // MUST reference the AA-safe text token instead
      expect(block, `${sel} must use var(--color-primary-text)`).toContain(
        'var(--color-primary-text)'
      )
    }

    // BLOCKER 1 SPECIFIC: .snw-tag-pill hover/active text
    // SectionNavigator.tsx renders `.snw-tag-pill` (confirmed live — not dead code).
    // The shared rule sets BOTH border-color AND color. On light bg, the text color
    // (11px Inter) must use --color-primary-text (5.97:1) while the border-color
    // may legitimately stay at var(--color-primary) (decorative, not text).
    const tagPillHoverBlock = extractBlock('.snw-row:hover .snw-tag-pill')
    // Must include the AA-safe text color token for the text color declaration
    expect(tagPillHoverBlock, '.snw-row:hover .snw-tag-pill must use color: var(--color-primary-text)').toContain(
      'color: var(--color-primary-text)'
    )
    // Must NOT use the raw gold as the bare text color declaration
    // (Note: border-color: var(--color-primary) is still acceptable and stays)
    expect(tagPillHoverBlock, '.snw-row:hover .snw-tag-pill must not use bare color: var(--color-primary);').not.toContain(
      'color: var(--color-primary);'
    )
  })

  // ── BLOCKER 2: .section-card.feature .sc-name ─────────────────────────────

  it('.section-card.feature .sc-name gold is either fixed or confirmed dead code', () => {
    // .section-card.feature .sc-name renders 27px gold (#CDA434 = 2.24:1 on light,
    // fails even AA-large at 27px bold). Plan 02 Task 1 owns the dead-code investigation.
    //
    // This tripwire is CONDITIONAL: if any .tsx source (outside __tests__/) renders
    // .section-card or .sc-name class names, the CSS declaration MUST be fixed to use
    // --color-primary-text. If confirmed dead code (no .tsx renders it), the raw gold
    // is tolerated and documented here as an explicit exclusion.
    //
    // `.section-card.feature .sc-name` excluded ONLY because confirmed dead code (no
    // .tsx renders .section-card/.sc-name); if a render path is ever added this branch
    // flips and requires --color-primary-text.

    const css = readFileSync(resolve(__dirname, '..', 'app/globals.css'), 'utf8')

    // Scan all .tsx files under apps/web (excluding __tests__/) for className usage.
    // We check for the class name strings in source (not for CSS definitions).
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
    function collectTsxSources(dir: string): string[] {
      let sources: string[] = []
      try {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === '__tests__' || entry === '.next') continue
          const full = resolve(dir, entry)
          try {
            const stat = statSync(full)
            if (stat.isDirectory()) {
              sources = sources.concat(collectTsxSources(full))
            } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
              const content = readFileSync(full, 'utf8')
              sources.push(content)
            }
          } catch {
            // skip unreadable entries
          }
        }
      } catch {
        // skip unreadable directories
      }
      return sources
    }

    const allSources = collectTsxSources(resolve(__dirname, '..'))
    const combinedSource = allSources.join('\n')

    // Check if any TSX source (outside __tests__/) renders these class names
    const scNameIsRendered =
      combinedSource.includes('section-card') || combinedSource.includes('sc-name')

    if (scNameIsRendered) {
      // When rendered: the CSS MUST be fixed to use --color-primary-text
      const idx = css.indexOf('.section-card.feature .sc-name')
      const start = idx !== -1 ? css.indexOf('{', idx) : -1
      const end = start !== -1 ? css.indexOf('}', start) : -1
      const scNameBlock = start !== -1 && end !== -1 ? css.slice(start, end + 1) : ''
      expect(
        scNameBlock,
        '.section-card.feature .sc-name is rendered — must use --color-primary-text for text'
      ).toContain('var(--color-primary-text)')
    } else {
      // Confirmed dead code: no .tsx outside __tests__/ renders .section-card or .sc-name.
      // Raw gold in this selector is tolerated as a dead-code artifact.
      // If a render path is ever added, this branch flips and requires --color-primary-text.
      expect(scNameIsRendered).toBe(false)
    }
  })

  // ── BLOCKER 3: DeliberationSlot editor chip + QA + advocate-score + live ──

  it('DeliberationSlot.tsx: editor chip + QA warning/error + advocate-score numerals + live indicator use AA-safe -text variants', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'components/issue/DeliberationSlot.tsx'),
      'utf8'
    )

    // ── Editor chip color ──────────────────────────────────────────────────
    // agentChipStyle() editor branch must use var(--color-primary-text) not
    // var(--color-primary). The chip label text is 11px Inter — fails AA on light.
    expect(
      src,
      'editor chip must use var(--color-primary-text), not var(--color-primary)'
    ).toContain("color: 'var(--color-primary-text)'")

    // ── QA_SEVERITY warning ────────────────────────────────────────────────
    // warning.color must be --color-primary-text (not --color-primary).
    // QA warning label ("Warning") is rendered at small text size.
    expect(
      src,
      'QA_SEVERITY.warning.color must be var(--color-primary-text)'
    ).toContain("warning: { color: 'var(--color-primary-text)'")

    // ── QA_SEVERITY error ──────────────────────────────────────────────────
    // error.color must be --color-accent-text (not --color-accent).
    expect(
      src,
      'QA_SEVERITY.error.color must be var(--color-accent-text)'
    ).toContain("error:   { color: 'var(--color-accent-text)'")

    // ── Advocate-score numeral {scoreValue}/10 ─────────────────────────────
    // The 11px span rendering {scoreValue}/10 must use --color-primary-text.
    // Targeted check: locate the scoreValue/10 context and assert the AA-safe token.
    const scoreValueIdx = src.indexOf('{scoreValue}/10')
    expect(scoreValueIdx, '{scoreValue}/10 span must exist in DeliberationSlot').toBeGreaterThan(-1)
    // Look at the surrounding 300 chars before {scoreValue}/10 for the style attr
    const scoreContext = src.slice(Math.max(0, scoreValueIdx - 300), scoreValueIdx)
    expect(
      scoreContext,
      'advocate-score numeral span must use var(--color-primary-text)'
    ).toContain('var(--color-primary-text)')
    // And confirm it does NOT use the raw gold token for this text
    expect(
      scoreContext,
      'advocate-score numeral must not use bare var(--color-primary) for text color'
    ).not.toContain("color: 'var(--color-primary)'")

    // ── "● live" indicator ─────────────────────────────────────────────────
    // The live indicator span must use --color-primary-text.
    const liveIdx = src.indexOf('● live')
    expect(liveIdx, '"● live" indicator must exist in DeliberationSlot').toBeGreaterThan(-1)
    // Look at the surrounding 200 chars before "● live" for the style attr
    const liveContext = src.slice(Math.max(0, liveIdx - 200), liveIdx)
    expect(
      liveContext,
      '"● live" indicator must use var(--color-primary-text)'
    ).toContain('var(--color-primary-text)')
    // And confirm it does NOT use the raw gold token
    expect(
      liveContext,
      '"● live" indicator must not use var(--color-primary) as text color'
    ).not.toContain("color: 'var(--color-primary)'")

    // ── Aggregate occurrence counts (belt-and-suspenders) ─────────────────
    // Count occurrences of --color-primary-text in the file.
    // Editor chip + QA warning + live indicator + advocate-score = ≥4 occurrences.
    const primaryTextOccurrences = (src.match(/var\(--color-primary-text\)/g) ?? []).length
    expect(
      primaryTextOccurrences,
      'var(--color-primary-text) must appear ≥4 times (editor chip + QA warning + live indicator + advocate-score)'
    ).toBeGreaterThanOrEqual(4)

    // QA error must use --color-accent-text ≥1 time
    const accentTextOccurrences = (src.match(/var\(--color-accent-text\)/g) ?? []).length
    expect(
      accentTextOccurrences,
      'var(--color-accent-text) must appear ≥1 time (QA error)'
    ).toBeGreaterThanOrEqual(1)
  })

  // ── Paper shadow: no rgba(0,0,0) in .section-card:hover ──────────────────

  it('globals.css: .section-card:hover uses warm paper shadow, not rgba(0,0,0)', () => {
    const css = readFileSync(resolve(__dirname, '..', 'app/globals.css'), 'utf8')
    const cssNoSpace = css.replace(/\s+/g, '')

    // Extract .section-card:hover block
    const hoverIdx = cssNoSpace.indexOf('.section-card:hover{')
    expect(hoverIdx, '.section-card:hover block must exist').toBeGreaterThan(-1)
    const hoverEnd = cssNoSpace.indexOf('}', hoverIdx)
    const hoverBlock = hoverIdx !== -1 && hoverEnd !== -1
      ? cssNoSpace.slice(hoverIdx, hoverEnd + 1)
      : ''

    // Must NOT use the dark elevation shadow (paper shadow required on light bg)
    expect(
      hoverBlock,
      '.section-card:hover must not use rgba(0,0,0) shadow (dark shadow is wrong on paper bg)'
    ).not.toContain('rgba(0,0,0,')

    // MUST use the warm sepia paper shadow
    expect(
      hoverBlock,
      '.section-card:hover must use warm paper shadow rgba(90,75,50,0.18)'
    ).toContain('rgba(90,75,50,0.18)')
  })
})
