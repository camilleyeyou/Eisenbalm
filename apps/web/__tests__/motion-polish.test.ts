/**
 * MOT-02 + MOT-03 CSS source-scan tripwire (trimmed in Phase 55 plan 12).
 *
 * Phase 55 retired SectionNavigator, DeliberationSlot, ConfidenceBar and
 * DelibScoreboard. Their component-level assertions are gone; the DEL-04
 * (no model names) and zero-subscription coverage lives in
 * delib-cards.test.tsx. Only the globals.css assertions survive here because
 * other routes still use those classes.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const globalsSource = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf-8')

describe('MOT-02/03: surviving globals.css motion classes', () => {
  it('globals.css .section-card:hover includes a translateY transform', () => {
    const hoverMatch = globalsSource.match(/\.section-card:hover\s*\{([\s\S]*?)\}/)
    expect(hoverMatch).not.toBeNull()
    expect(hoverMatch ? hoverMatch[1] : '').toContain('translateY')
  })

  it('globals.css .pitch-card-list defines scroll-snap-type', () => {
    const m = globalsSource.match(/\.pitch-card-list\s*\{([\s\S]*?)\}/)
    expect(m).not.toBeNull()
    expect(m ? m[1] : '').toContain('scroll-snap-type')
  })
})
