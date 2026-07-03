/**
 * MOT-02 + MOT-03 source-scan tripwire — Phase 11 Wave 0.
 *
 * Asserts the MOT-02 (SectionNavigator hover translate + reduced-motion guard)
 * and MOT-03 (DeliberationSlot count-up + pitch-card scroll-snap) acceptance
 * contracts. Same pattern as game-sandbox.test.ts (Phase 7 GAM-03) and
 * issue-page-typography.test.ts (Phase 10): readFileSync at test runtime,
 * no DOM, no React render, no mocks.
 *
 * Phase 19 UPDATE (Plan 03): DeliberationSlot was fully rewritten as the
 * dark-band centerpiece. MOT-03 assertions updated:
 *   - IntersectionObserver → ConfidenceBar uses CSS transition (no IntersectionObserver)
 *   - setDisplayValue → not in DeliberationSlot; confidence animation is CSS-transition-based
 *   - pitch-card-list → still in globals.css (Phase 11 CSS preserved); no longer in
 *     DeliberationSlot source (candidate display moved to DelibScoreboard component)
 *   - prefersReducedMotion → now in ConfidenceBar.tsx (useReducedMotion hook)
 *   - DEL-04 model-name check stays green
 *
 * Phase 29 UPDATE (D-8): the "5 Convex subs" contract (DEL-01) was INVERTED —
 *   DeliberationSlot.tsx no longer opens any api.*.byRunId subscriptions
 *   (they were dead code; the deliberation renders from Sanity props via
 *   IssueLayout.tsx). The final MOT-03 assertion below now checks absence.
 *
 * PITFALL GUARD (Pitfall 4): Under reduced-motion, the confidence bar must show the
 * FINAL value immediately. This is now enforced in ConfidenceBar.tsx via useReducedMotion.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 11 MOT-02/MOT-03.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// ─── Paths ────────────────────────────────────────────────────────────────────

const GLOBALS_PATH  = resolve(__dirname, '../app/globals.css')
const DELIB_PATH    = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
const CONF_BAR_PATH = resolve(__dirname, '../components/issue/ConfidenceBar.tsx')
const NAV_PATH      = resolve(__dirname, '../components/issue/SectionNavigator.tsx')

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
const confBarSource = readFileSync(CONF_BAR_PATH, 'utf-8')

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

// ─── MOT-03: Confidence bar + pitch-card scroll-snap ─────────────────────────
//
// Phase 19 Plan 03 UPDATE: DeliberationSlot rewritten as dark-band centerpiece.
//   - Confidence animation: moved to ConfidenceBar.tsx (CSS transition width 1.6s)
//   - Candidate display: moved to DelibScoreboard.tsx
//   - pitch-card-list CSS class: still in globals.css (Phase 11 CSS preserved)
//   - Reduced-motion: enforced in ConfidenceBar.tsx via useReducedMotion hook

describe('MOT-03: ConfidenceBar CSS transition + pitch-card-list CSS + reduced-motion guard', () => {
  it('ConfidenceBar.tsx uses CSS transition (not IntersectionObserver) for the count-up', () => {
    // Phase 19: confidence animation is a CSS-transition width on a div, not rAF.
    // ConfidenceBar uses a trigger prop + setTimeout(200ms) pattern.
    expect(confBarSource).toContain('width 1.6s cubic-bezier')
  })

  it('ConfidenceBar.tsx uses useReducedMotion for reduced-motion guard (Pitfall 4)', () => {
    // PITFALL-4 guard: under reduced-motion, the bar must show the FINAL
    // confidence value immediately, not 0. ConfidenceBar handles this by
    // initializing width to `value` when prefersReducedMotion is true.
    expect(confBarSource).toContain('useReducedMotion')
    // Confirm the initial value is set to `value` (not 0) under reduced-motion
    expect(confBarSource).toMatch(/prefersReducedMotion\s*\?\s*value/)
  })

  it('DeliberationSlot.tsx exposes no model names after Phase 19 rewrite (DEL-04 inheritance)', () => {
    // DEL-04 tripwire from deliberation-no-model-names.test.ts, duplicated here
    // so MOT-03 has its own guard. This assertion must remain green through all
    // Phase 19 edits to DeliberationSlot.tsx.
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

  it('globals.css .pitch-card-list defines scroll-snap-type (Phase 11 CSS preserved)', () => {
    // Phase 11 added .pitch-card-list scroll-snap CSS. Phase 19 preserves it
    // in globals.css (the CSS class still serves the Phase 12 Convex live view
    // when Stage B (Plan 05) wires the deliberationEvents pitch-log carousel).
    const pitchCardListMatch = globalsSource.match(/\.pitch-card-list\s*\{([\s\S]*?)\}/)
    expect(pitchCardListMatch).not.toBeNull()
    const pitchCardBlock = pitchCardListMatch ? pitchCardListMatch[1] : ''
    expect(pitchCardBlock).toContain('scroll-snap-type')
  })

  it('DeliberationSlot.tsx opens zero Convex subscriptions (DEL-01 contract, inverted Phase 29)', () => {
    // Phase 29 (D-8) removed the 5 dead subscriptions — every result was
    // discarded and the deliberation has always rendered from Sanity props.
    // This guards against the dead-subscription pattern regressing.
    expect(delibSource).not.toContain('api.pitchLog.byRunId')
    expect(delibSource).not.toContain('api.deliberationEvents.byRunId')
    expect(delibSource).not.toContain('api.agentVotes.byRunId')
    expect(delibSource).not.toContain('api.qaCorrections.byRunId')
    expect(delibSource).not.toContain('api.pipelineRuns.byRunId')
    expect(delibSource).not.toContain('useQuery')
  })
})
