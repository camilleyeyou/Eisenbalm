/**
 * Phase 19 — Issue Page Dispatch source-scan tripwires.
 *
 * These tripwires assert the Phase 19 foundation contracts:
 *   - Fonts: Fraunces/Newsreader/IBM_Plex_Mono in layout.tsx
 *   - FONT_WHITELIST: 9 entries (original 6 + 3 new)
 *   - BRAND_DEFAULTS: oxblood/cream palette
 *   - framer-motion: present in package.json
 *   - Plan 02: Atmosphere/SectionNavigator retired, new motion components exist
 *   - Plan 03: DelibChat role=log/aria-live, useReducedMotion in motion components
 *
 * Pattern: readFileSync + regex assertions. NO DOM, NO React render, NO mocks.
 * Same pattern as game-sandbox.test.ts (Phase 7 GAM-03).
 *
 * If an assertion fails, DO NOT delete it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 19 foundation requirements.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// ─── Paths ────────────────────────────────────────────────────────────────────

const LAYOUT_PATH      = resolve(__dirname, '../app/layout.tsx')
const THEME_PATH       = resolve(__dirname, '../lib/theme.ts')
const PACKAGE_JSON_PATH = resolve(__dirname, '../package.json')
const PAGE_PATH        = resolve(__dirname, '../app/issue/[slug]/page.tsx')
const COMPONENTS_DIR   = resolve(__dirname, '../components/issue')

// ─── DES-01: Fraunces/Newsreader/IBM Plex Mono in layout.tsx ────────────────

describe('DES-01: Phase 19 fonts wired in app/layout.tsx', () => {
  const layoutSrc = readFileSync(LAYOUT_PATH, 'utf-8')

  it('imports Fraunces from next/font/google', () => {
    expect(layoutSrc).toMatch(
      /import\s*\{[^}]*Fraunces[^}]*\}\s*from\s*['"]next\/font\/google['"]/
    )
  })

  it('imports Newsreader from next/font/google', () => {
    expect(layoutSrc).toMatch(
      /import\s*\{[^}]*Newsreader[^}]*\}\s*from\s*['"]next\/font\/google['"]/
    )
  })

  it('imports IBM_Plex_Mono from next/font/google', () => {
    expect(layoutSrc).toMatch(
      /import\s*\{[^}]*IBM_Plex_Mono[^}]*\}\s*from\s*['"]next\/font\/google['"]/
    )
  })

  it('Fraunces configured with axes: [\'opsz\'] for optical sizing', () => {
    expect(layoutSrc).toMatch(/axes:\s*\['opsz'\]/)
  })

  it('themeColor is the cream brand bg (#FBFAF6)', () => {
    expect(layoutSrc).toContain("'#FBFAF6'")
  })

  it('does not import Playfair_Display, Lora, or Inter (old fonts retired)', () => {
    // Strip comments to avoid matching documentation
    const code = layoutSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // Old fonts must be gone
    expect(code).not.toContain('Playfair_Display')
    expect(code).not.toContain("'Lora'")
    // New fonts must be present
    expect(code).toContain('Fraunces')
    expect(code).toContain('Newsreader')
    expect(code).toContain('IBM_Plex_Mono')
  })
})

// ─── AGT-14: FONT_WHITELIST contains all 9 fonts ─────────────────────────────

describe('AGT-14: theme.ts FONT_WHITELIST has 9 entries (Phase 19 extended)', () => {
  const themeSrc = readFileSync(THEME_PATH, 'utf-8')

  it('FONT_WHITELIST contains original 6 entries (backward compat)', () => {
    expect(themeSrc).toContain("'Playfair Display'")
    expect(themeSrc).toContain("'Lora'")
    expect(themeSrc).toContain("'Inter'")
    expect(themeSrc).toContain("'Cormorant Garamond'")
    expect(themeSrc).toContain("'Merriweather'")
    expect(themeSrc).toContain("'DM Serif Display'")
  })

  it('FONT_WHITELIST contains Phase 19 additions: Fraunces', () => {
    expect(themeSrc).toContain("'Fraunces'")
  })

  it('FONT_WHITELIST contains Phase 19 additions: Newsreader', () => {
    expect(themeSrc).toContain("'Newsreader'")
  })

  it('FONT_WHITELIST contains Phase 19 additions: IBM Plex Mono', () => {
    expect(themeSrc).toContain("'IBM Plex Mono'")
  })
})

// ─── P19-03: BRAND_DEFAULTS oxblood/cream ────────────────────────────────────

describe('P19-03: BRAND_DEFAULTS uses oxblood/cream Phase 19 palette', () => {
  const themeSrc = readFileSync(THEME_PATH, 'utf-8')

  it('BRAND_DEFAULTS bg is cream #FBFAF6', () => {
    expect(themeSrc).toContain("'#FBFAF6'")
  })

  it('BRAND_DEFAULTS text is warm near-black #1A1714', () => {
    expect(themeSrc).toContain("'#1A1714'")
  })

  it('BRAND_DEFAULTS primary/accent is oxblood #9A3324', () => {
    expect(themeSrc).toContain("'#9A3324'")
  })

  it('BRAND_DEFAULTS fontDisplay is Fraunces', () => {
    expect(themeSrc).toMatch(/fontDisplay:\s*'Fraunces'\s*as\s*WhitelistedFont/)
  })

  it('BRAND_DEFAULTS fontBody is Newsreader', () => {
    expect(themeSrc).toMatch(/fontBody:\s*'Newsreader'\s*as\s*WhitelistedFont/)
  })

  it('BRAND_DEFAULTS fontUi is IBM Plex Mono', () => {
    expect(themeSrc).toMatch(/fontUi:\s*'IBM Plex Mono'\s*as\s*WhitelistedFont/)
  })
})

// ─── P19-04: framer-motion dependency ────────────────────────────────────────

describe('P19-04: framer-motion is an installed dependency', () => {
  it('framer-motion is in apps/web/package.json dependencies', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
      dependencies?: Record<string, string>
    }
    expect(pkg.dependencies).toBeDefined()
    expect(Object.keys(pkg.dependencies ?? {})).toContain('framer-motion')
  })

  it('framer-motion version is ^12 (current stable)', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
      dependencies?: Record<string, string>
    }
    const version = pkg.dependencies?.['framer-motion'] ?? ''
    expect(version).toMatch(/^\^12\./)
  })
})

// ─── Security: theme.ts invariants still intact ───────────────────────────────

describe('Security: theme.ts invariants preserved through Phase 19 extension', () => {
  const themeSrc = readFileSync(THEME_PATH, 'utf-8')

  it('HEX_REGEX is the 6-digit only regex (unchanged)', () => {
    expect(themeSrc).toContain('HEX_REGEX = /^#[0-9a-fA-F]{6}$/')
  })

  it('serializeThemeCss emits --color-bg (Phase 19 extension)', () => {
    expect(themeSrc).toMatch(/--color-bg.*\$\{p\.bg\}/)
  })

  it('serializeThemeCss emits --color-text (Phase 19 extension)', () => {
    expect(themeSrc).toMatch(/--color-text.*\$\{p\.text\}/)
  })

  it('applyTheme sets --color-bg via setProperty (Phase 19 extension)', () => {
    // Must use setProperty only — WEB-08 invariant
    expect(themeSrc).toMatch(/setProperty\('--color-bg',\s*p\.bg\)/)
  })

  it('applyTheme sets --color-text via setProperty (Phase 19 extension)', () => {
    expect(themeSrc).toMatch(/setProperty\('--color-text',\s*p\.text\)/)
  })
})

// ─── Plan 02: Atmosphere + SectionNavigator retired ──────────────────────────

describe('Plan 02: Atmosphere.tsx deleted and SectionNavigator.tsx deleted', () => {
  it('Atmosphere.tsx is deleted (not present in components/issue/)', () => {
    expect(existsSync(resolve(COMPONENTS_DIR, 'Atmosphere.tsx'))).toBe(false)
  })

  it('SectionNavigator.tsx is deleted (not present in components/issue/)', () => {
    expect(existsSync(resolve(COMPONENTS_DIR, 'SectionNavigator.tsx'))).toBe(false)
  })

  it('Atmosphere is not imported in page.tsx', () => {
    const pageSrc = readFileSync(PAGE_PATH, 'utf-8')
    expect(pageSrc).not.toContain('Atmosphere')
  })

  it('SectionNavigator is not imported in page.tsx', () => {
    const pageSrc = readFileSync(PAGE_PATH, 'utf-8')
    expect(pageSrc).not.toContain('SectionNavigator')
  })
})

// ─── Plan 02: New motion components exist ────────────────────────────────────

describe('Plan 02: ScrollProgressBar, SectionRail, ScrollReveal exist', () => {
  it('ScrollProgressBar.tsx exists with framer-motion useScroll', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'ScrollProgressBar.tsx'), 'utf-8')
    expect(src).toContain('useScroll')
  })

  it('SectionRail.tsx exists with role="navigation" and aria-label', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'SectionRail.tsx'), 'utf-8')
    expect(src).toContain('role="navigation"')
    expect(src).toMatch(/aria-label/)
  })

  it('ScrollReveal.tsx exists with useReducedMotion guard', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'ScrollReveal.tsx'), 'utf-8')
    expect(src).toContain('useReducedMotion')
  })
})

// ─── Plan 02: GameSlot play button aria-label ─────────────────────────────────

describe('Plan 02: GameSlot play button has aria-label containing "Play"', () => {
  it('GameSlot.tsx contains aria-label with Play', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'GameSlot.tsx'), 'utf-8')
    expect(src).toMatch(/aria-label[^>]*[Pp]lay/)
  })
})

// ─── Plan 03: DelibChat accessibility + reduced-motion ───────────────────────

describe('Plan 03: DelibChat has role="log", aria-live="polite", useReducedMotion', () => {
  it('DelibChat.tsx has role="log"', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'DelibChat.tsx'), 'utf-8')
    expect(src).toContain('role="log"')
  })

  it('DelibChat.tsx has aria-live="polite"', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'DelibChat.tsx'), 'utf-8')
    expect(src).toContain('aria-live="polite"')
  })

  it('DelibChat.tsx uses useReducedMotion for reduced-motion guard', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'DelibChat.tsx'), 'utf-8')
    expect(src).toContain('useReducedMotion')
  })
})

// ─── Plan 03: framer-motion motion components contain useReducedMotion ────────

describe('Plan 03: useReducedMotion present in motion components', () => {
  it('DelibChat.tsx contains useReducedMotion', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'DelibChat.tsx'), 'utf-8')
    expect(src).toContain('useReducedMotion')
  })

  it('ScrollReveal.tsx contains useReducedMotion', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'ScrollReveal.tsx'), 'utf-8')
    expect(src).toContain('useReducedMotion')
  })

  it('StatCountUp.tsx contains useReducedMotion', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'StatCountUp.tsx'), 'utf-8')
    expect(src).toContain('useReducedMotion')
  })

  it('ConfidenceBar.tsx contains useReducedMotion', () => {
    const src = readFileSync(resolve(COMPONENTS_DIR, 'ConfidenceBar.tsx'), 'utf-8')
    expect(src).toContain('useReducedMotion')
  })
})

// ─── Plan 05: DESIGNAGENT_SUPPRESSED suppression removed from theming path ────

const ISSUE_LAYOUT_PATH = resolve(__dirname, '../app/issue/[slug]/layout.tsx')

describe('Plan 05: per-issue theming is unconditional — no suppression gate', () => {
  const layoutSrc = readFileSync(ISSUE_LAYOUT_PATH, 'utf-8')

  it('issue/[slug]/layout.tsx calls serializeThemeCss(theme) (unconditional theming)', () => {
    // The live call must be present — not just in comments
    const codeOnly = layoutSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(codeOnly).toMatch(/serializeThemeCss\s*\(/)
  })

  it('issue/[slug]/layout.tsx does NOT contain the suppressed ? "" : serializeThemeCss pattern', () => {
    // The old MED-01/MED-02 suppression gate must be gone from the theming path
    expect(layoutSrc).not.toMatch(/suppressed\s*\?\s*''\s*:\s*serializeThemeCss/)
  })

  it('issue/[slug]/layout.tsx does NOT read DESIGNAGENT_SUPPRESSED for theming', () => {
    // DESIGNAGENT_SUPPRESSED may appear in comments but must not be in live code
    const codeOnly = layoutSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // After stripping all comments, DESIGNAGENT_SUPPRESSED must not appear as live code
    expect(codeOnly).not.toContain('DESIGNAGENT_SUPPRESSED')
  })
})
