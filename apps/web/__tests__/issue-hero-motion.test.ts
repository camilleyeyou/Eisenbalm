/**
 * MOT-01 source-scan tripwire — Phase 11 Wave 0.
 *
 * Asserts the MOT-01 acceptance contract for the IssueHero word-span
 * clip-path reveal animation. Same pattern as game-sandbox.test.ts (Phase 7
 * GAM-03) and issue-page-typography.test.ts (Phase 10): readFileSync at test
 * runtime, no DOM, no React render, no mocks.
 *
 * IssueHero.tsx ALREADY EXISTS. The word-span / animationDelay / @keyframes
 * assertions are RED until Plan 03 adds the animation to IssueHero.tsx.
 * The eyebrow-count assertion is GREEN now (IssueHero currently has ≥2 .eyebrow
 * usages) and must STAY GREEN after Plan 03 edits the component (DES-04
 * inheritance).
 *
 * PITFALL GUARDS:
 *   - opacity:0 / clip-path must live ONLY inside @keyframes. If set as a base
 *     inline style on a word span, words will be permanently hidden under
 *     prefers-reduced-motion (browsers skip @keyframes but honor base styles).
 *   - IssueHero must stay a Server Component — no 'use client', no useEffect,
 *     no useState. The word-split is done in JSX (static HTML), and the
 *     @keyframes is in a <style> tag or CSS module; no client JS needed.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 11 MOT-01.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// ─── Path ─────────────────────────────────────────────────────────────────────

const HERO_PATH = resolve(__dirname, '../components/issue/IssueHero.tsx')

// ─── Comment-stripping helper ─────────────────────────────────────────────────

/**
 * Strip block, JSX block, and line comments so pattern matches target code
 * behavior (identifiers, attributes, JSX) rather than documentation prose.
 * Mirrors the codeOnly() helpers in deliberation-no-model-names.test.ts and
 * issue-page-typography.test.ts.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')    // line comments (don't eat URL ://)
}

// ─── Read at describe scope (file already exists) ─────────────────────────────

const source = readFileSync(HERO_PATH, 'utf-8')

// ─── MOT-01: IssueHero word-span clip-path reveal ─────────────────────────────

describe('MOT-01: IssueHero word-span clip-path reveal', () => {
  it('splits the charity name into word spans', () => {
    // Implementation must call .split(' ') (or similar) on charity.name to
    // render each word as a separate span for staggered animation.
    expect(source).toContain('.split(')
  })

  it('applies a per-span animationDelay inline style', () => {
    // Each word span receives a calculated animationDelay (e.g., index * delay)
    // so words stagger in sequence.
    expect(source).toContain('animationDelay')
  })

  it('defines an @keyframes for the hero reveal', () => {
    // The @keyframes must be named heroWordReveal (or contain heroWordReveal)
    // per the UI-SPEC animation contract.
    expect(source).toMatch(/@keyframes\s+heroWordReveal/)
  })

  it('never sets opacity:0 as a base inline style on a word span (only inside @keyframes)', () => {
    // PITFALL-1 guard: opacity:0 / clip-path set as a base style will
    // permanently hide words when prefers-reduced-motion is active (browsers
    // skip @keyframes but always apply base styles). These values must only
    // appear inside the @keyframes from{} block.
    //
    // Strip the @keyframes block from the source, then assert no opacity:0
    // remains in the code outside it.
    const withoutKeyframes = source.replace(/@keyframes[\s\S]*?\}\s*\}/g, '')
    const code = codeOnly(withoutKeyframes)
    // Match opacity: 0 or opacity:0 only when NOT followed by a decimal digit
    // (i.e., not "opacity: 0.025"). This is the guard for hidden-by-default spans.
    expect(code).not.toMatch(/opacity:\s*0(?!\.\d)/)
  })

  it('never sets clip-path as a base inline style on a word span (only inside @keyframes)', () => {
    // PITFALL-1 guard: companion to the opacity:0 check above.
    // clip-path: inset(100%) must only appear inside @keyframes from{} —
    // not as a base JSX inline style that would permanently clip words
    // when reduced-motion users skip the animation.
    const withoutKeyframes = source.replace(/@keyframes[\s\S]*?\}\s*\}/g, '')
    expect(codeOnly(withoutKeyframes)).not.toContain('clip-path: inset')
    expect(codeOnly(withoutKeyframes)).not.toContain('clipPath:')
  })

  it('retains ≥2 eyebrow class usages (DES-04 inheritance)', () => {
    // DES-04 tripwire from issue-page-typography.test.ts: IssueHero must
    // maintain at least two .eyebrow class usages (issue label + meta row).
    // This assertion is ALREADY PASSING and must remain green after Plan 03
    // edits IssueHero to add the word-span animation.
    const matches = source.match(/["']eyebrow/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('does NOT add a use client directive (stays a Server Component)', () => {
    // ANTI-PATTERN guard: word-span animation is implemented as CSS @keyframes
    // + inline animationDelay style (pure HTML, no client JS required).
    // Adding 'use client' would unnecessarily client-side the entire hero,
    // breaking streaming SSR and adding bundle weight. No useEffect or
    // useState should appear either (the split is static JSX).
    expect(source.trimStart().startsWith("'use client'")).toBe(false)
    expect(source).not.toContain('useEffect')
    expect(source).not.toContain('useState')
  })
})
