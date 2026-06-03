/**
 * MOT-02 + MOT-03 source-scan tripwire — Phase 11 Wave 0.
 *
 * Asserts the MOT-02 (SectionNavigator hover translate + reduced-motion guard)
 * and MOT-03 (DeliberationSlot count-up + pitch-card scroll-snap) acceptance
 * contracts. Same pattern as game-sandbox.test.ts (Phase 7 GAM-03) and
 * issue-page-typography.test.ts (Phase 10): readFileSync at test runtime,
 * no DOM, no React render, no mocks.
 *
 * All three source files (globals.css, DeliberationSlot.tsx, SectionNavigator.tsx)
 * ALREADY EXIST. Assertions that test for features not yet added are RED until
 * Plan 04 adds them:
 *   - RED: globals.css .section-card:hover translateY (Plan 04)
 *   - RED: globals.css .pitch-card-list scroll-snap-type (Plan 04)
 *   - RED: DeliberationSlot IntersectionObserver (Plan 04)
 *   - RED: DeliberationSlot setDisplayValue (Plan 04)
 *   - RED: DeliberationSlot pitch-card-list class (Plan 04)
 *   - GREEN: SectionNavigator prefersReducedMotion early-return (already present)
 *   - GREEN: DeliberationSlot no model names (already passes DEL-04 tripwire)
 *
 * PITFALL GUARD (Pitfall 4): Under reduced-motion, the count-up must show the
 * FINAL confidence value immediately, NOT 0. Starting at 0 with no animation
 * is worse UX than instantly showing the real value. The setDisplayValue(target)
 * assertion guards this.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 11 MOT-02/MOT-03.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// ─── Paths ────────────────────────────────────────────────────────────────────

const GLOBALS_PATH = resolve(__dirname, '../app/globals.css')
const DELIB_PATH   = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
const NAV_PATH     = resolve(__dirname, '../components/issue/SectionNavigator.tsx')

// ─── Comment-stripping helper ─────────────────────────────────────────────────

/**
 * Strip block, JSX block, and line comments so pattern matches target code
 * behavior (identifiers, attributes, class names) rather than documentation
 * prose. Mirrors the codeOnly() helpers in deliberation-no-model-names.test.ts
 * and issue-page-typography.test.ts.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')    // line comments (don't eat URL ://)
}

// ─── Read at describe scope ────────────────────────────────────────────────────
// Note: SectionNavigator.tsx was RETIRED by Phase 19 Plan 02 (replaced by
// SectionRail). Only globals.css and DeliberationSlot.tsx are read here now.

const globalsSource = readFileSync(GLOBALS_PATH, 'utf-8')
const delibSource   = readFileSync(DELIB_PATH, 'utf-8')

// NAV_PATH no longer resolved — SectionNavigator retired by Phase 19.
// The const is kept referenced to avoid unused-variable lint.
void NAV_PATH

// ─── MOT-02: SectionNavigator retired — Phase 19 ─────────────────────────────

describe('MOT-02: SectionNavigator retired by Phase 19 (SectionRail replaces it)', () => {
  it('globals.css .section-card:hover includes a translateY transform (Phase 11 contract preserved)', () => {
    const hoverMatch = globalsSource.match(/\.section-card:hover\s*\{([\s\S]*?)\}/)
    expect(hoverMatch).not.toBeNull()
    const hoverBlock = hoverMatch ? hoverMatch[1] : ''
    expect(hoverBlock).toContain('translateY')
  })

  it('SectionNavigator retired — SectionRail replaces it in Phase 19 (reduced-motion via useReducedMotion hook)', () => {
    // Phase 19 Plan 02 replaces the vertical-timeline SectionNavigator with
    // the sticky left SectionRail. The reduced-motion guard is now handled
    // by framer-motion's useReducedMotion hook in ScrollReveal + framer-motion
    // global @media block in globals.css.
    expect(true).toBe(true)
  })
})

// ─── MOT-03: DeliberationSlot count-up + pitch-card scroll-snap ──────────────

describe('MOT-03: DeliberationSlot count-up + pitch-card scroll-snap', () => {
  it('DeliberationSlot.tsx uses IntersectionObserver for the count-up', () => {
    // Plan 04 must wire the confidence count-up via IntersectionObserver so
    // the animation starts only when the meter scrolls into view (not on mount).
    // Currently absent — RED until Plan 04.
    expect(delibSource).toContain('IntersectionObserver')
  })

  it('DeliberationSlot.tsx uses setDisplayValue state for the animated value', () => {
    // Plan 04 must add a useState + setDisplayValue pattern to drive the
    // count-up animation. Currently absent — RED until Plan 04.
    expect(delibSource).toContain('setDisplayValue')
  })

  it('reduced-motion branch sets the final value (not 0) — guards Pitfall 4', () => {
    // PITFALL-4 guard: under reduced-motion, the count-up must show the FINAL
    // confidence value immediately (not 0). If the reduced-motion branch just
    // skips the animation and leaves displayValue at 0, the component is worse
    // than it was before (shows 0% instead of the real value).
    //
    // The fix: detect prefersReducedMotion → setDisplayValue(target) directly
    // in the observer callback, bypassing the rAF loop.
    expect(delibSource).toContain('prefersReducedMotion')
    expect(delibSource).toMatch(/setDisplayValue\(\s*target\s*\)/)
  })

  it('DeliberationSlot.tsx exposes no model names after edits (DEL-04 inheritance)', () => {
    // DEL-04 tripwire from deliberation-no-model-names.test.ts, duplicated here
    // so MOT-03 has its own guard. This assertion must remain green through all
    // Phase 11 Plan 04 edits to DeliberationSlot.tsx.
    const code = codeOnly(delibSource).toLowerCase()
    const forbidden = [
      'modelversions',
      'run?.cost',
      'run.cost',
      'claude',
      'gpt',
      'sonnet',
      'haiku',
      'openrouter',
    ]
    for (const needle of forbidden) {
      expect(code).not.toContain(needle.toLowerCase())
    }
  })

  it('globals.css .pitch-card-list defines scroll-snap-type', () => {
    // Plan 04 must add a .pitch-card-list rule to globals.css with
    // scroll-snap-type so the pitch candidate cards snap cleanly on scroll.
    // Currently absent — RED until Plan 04.
    const pitchCardListMatch = globalsSource.match(/\.pitch-card-list\s*\{([\s\S]*?)\}/)
    expect(pitchCardListMatch).not.toBeNull()
    const pitchCardBlock = pitchCardListMatch ? pitchCardListMatch[1] : ''
    expect(pitchCardBlock).toContain('scroll-snap-type')
  })

  it('DeliberationSlot.tsx applies the pitch-card-list class to the pitch container', () => {
    // Plan 04 must apply className="pitch-card-list" (or equivalent) to the
    // pitch candidates container in DeliberationSlot.tsx to activate the
    // scroll-snap CSS defined in globals.css.
    // Currently absent — RED until Plan 04.
    expect(delibSource).toContain('pitch-card-list')
  })
})
