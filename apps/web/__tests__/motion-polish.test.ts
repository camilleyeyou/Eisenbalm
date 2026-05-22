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

// ─── Read at describe scope (all three files already exist) ───────────────────

const globalsSource = readFileSync(GLOBALS_PATH, 'utf-8')
const delibSource   = readFileSync(DELIB_PATH, 'utf-8')
const navSource     = readFileSync(NAV_PATH, 'utf-8')

// ─── MOT-02: SectionNavigator hover translate ─────────────────────────────────

describe('MOT-02: SectionNavigator hover translate', () => {
  it('globals.css .section-card:hover includes a translateY transform', () => {
    // Plan 04 must add `transform: translateY(-4px)` to the .section-card:hover
    // rule in globals.css. Currently absent — RED until Plan 04.
    const hoverMatch = globalsSource.match(/\.section-card:hover\s*\{([\s\S]*?)\}/)
    expect(hoverMatch).not.toBeNull()
    const hoverBlock = hoverMatch ? hoverMatch[1] : ''
    expect(hoverBlock).toContain('translateY')
  })

  it('SectionNavigator.tsx keeps the prefersReducedMotion early-return', () => {
    // The reduced-motion early-return on line ~100 of SectionNavigator.tsx must
    // survive all Phase 11 edits. It stops cursor-tracking under reduced-motion,
    // leaving the glow centred (static hover only — acceptable per UI-SPEC Motion
    // Contract). Asserting both the string presence and the if-return pattern.
    expect(navSource).toContain('prefers-reduced-motion')
    expect(navSource).toMatch(/if\s*\(\s*prefersReducedMotion\s*\)\s*return/)
  })

  it('SectionNavigator.tsx adds no new mousemove cursor-tracking under reduced-motion — early-return is before the listener', () => {
    // The string '(prefers-reduced-motion: reduce)' must be present — it is the
    // matchMedia query string that gates the early-return. Asserting its presence
    // ensures no future refactor silently drops the check string while keeping
    // an empty guard body.
    expect(navSource).toContain('(prefers-reduced-motion: reduce)')
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
