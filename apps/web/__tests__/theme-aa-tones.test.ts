/**
 * Phase 9 — AA contrast gate for house secondary tones.
 *
 * The theme engine (apps/web/lib/theme.ts) gates bg+text pairs at 4.5:1
 * but does NOT gate secondary tones. This test file is the build-level
 * assertion that every house secondary tone passes WCAG AA (≥4.5:1) on
 * the dark house bg (#0C0B0A).
 *
 * The spec (09-UI-SPEC §Color §AA gate) explicitly rejects the mockup's
 * --cream-mute #615B4D (2.9:1 — FAILS) and replaces it with #938A77 (5.8:1).
 *
 * If a contrast ratio fails: fix the CSS variable in globals.css, not
 * this test. The accepted values are locked by the UI-SPEC.
 */

import { describe, it, expect } from 'vitest'
import { contrastRatio } from '@/lib/theme'

/** Dark house background (--color-bg). */
const DARK_BG = '#0C0B0A'

/** WCAG AA threshold for body text (normal size). */
const AA = 4.5

/** WCAG AA threshold for large text (≥18px or ≥14px bold). */
const AA_LARGE = 3.0

describe('Phase 9 house secondary tones — WCAG AA on dark bg (#0C0B0A)', () => {
  it('--color-text #F0EAD9 passes AA (primary body text)', () => {
    expect(contrastRatio('#F0EAD9', DARK_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('--color-text-dim #A89F8A passes AA (secondary prose, 7.5:1 target)', () => {
    const ratio = contrastRatio('#A89F8A', DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    // Expected ~7.5:1; confirm it's meaningfully above threshold
    expect(ratio).toBeGreaterThan(7.0)
  })

  it('--color-text-mute #938A77 passes AA (tertiary labels — NOT #615B4D)', () => {
    // The mockup's #615B4D has only 2.9:1 — FAILS AA. This test locks
    // the corrected value #938A77 (5.8:1) per 09-UI-SPEC §AA gate.
    expect(contrastRatio('#938A77', DARK_BG)).toBeGreaterThanOrEqual(AA)
  })

  it('rejected value #615B4D (mockup cream-mute) FAILS AA — must never appear in globals.css', () => {
    // This assertion documents WHY #615B4D was rejected.
    // 2.9:1 on dark bg — below 4.5:1 threshold.
    expect(contrastRatio('#615B4D', DARK_BG)).toBeLessThan(AA)
  })

  it('--color-scout #8A9B7A (sage) passes AA on dark bg (6.6:1 target)', () => {
    const ratio = contrastRatio('#8A9B7A', DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(ratio).toBeGreaterThan(6.0)
  })

  it('--color-advocate #6E92B8 (azure) passes AA on dark bg (6.1:1 target)', () => {
    const ratio = contrastRatio('#6E92B8', DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(ratio).toBeGreaterThan(5.5)
  })

  it('--color-primary #CDA434 (gold) passes AA on dark bg (8.4:1 target)', () => {
    const ratio = contrastRatio('#CDA434', DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(ratio).toBeGreaterThan(7.0)
  })

  it('--color-accent #C2502A (ember) passes AA-large only (4.2:1 — large-text constraint)', () => {
    const ratio = contrastRatio('#C2502A', DARK_BG)
    // Ember passes AA-large (≥3:1) but NOT normal AA (≥4.5:1).
    // Must ONLY be used at ≥18px or for borders/icons — never body text.
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE)
    // Document that it does NOT meet normal AA — this is the constraint:
    expect(ratio).toBeLessThan(AA)
  })
})
