/**
 * Phase 19 — Issue Page Dispatch source-scan tripwires (Wave 0).
 *
 * These tripwires assert the Phase 19 foundation contracts:
 *   - Fonts: Fraunces/Newsreader/IBM_Plex_Mono in layout.tsx
 *   - FONT_WHITELIST: 9 entries (original 6 + 3 new)
 *   - BRAND_DEFAULTS: oxblood/cream palette
 *   - framer-motion: present in package.json
 *
 * INTENTIONALLY DEFERRED (it.todo): tripwires for conditions that are NOT yet
 * true at Plan 01 and will be turned active by later plans:
 *   - Plan 02: Atmosphere/SectionNavigator retired, new components exist
 *   - Plan 05: DESIGNAGENT_SUPPRESSED no longer gates theming in issue/[slug]/layout.tsx
 *   - Plan 02/03: aria attributes on new motion components
 *
 * Pattern: readFileSync + regex assertions. NO DOM, NO React render, NO mocks.
 * Same pattern as game-sandbox.test.ts (Phase 7 GAM-03).
 *
 * If an assertion fails, DO NOT delete it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 19 foundation requirements.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

// ─── Paths ────────────────────────────────────────────────────────────────────

const LAYOUT_PATH      = resolve(__dirname, '../app/layout.tsx')
const THEME_PATH       = resolve(__dirname, '../lib/theme.ts')
const PACKAGE_JSON_PATH = resolve(__dirname, '../package.json')

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

// ─── DEFERRED: conditions not yet true in Plan 01 ────────────────────────────
//
// These tripwires will be activated by later plans:
//   - Plan 02: Atmosphere retired, SectionNavigator retired, ScrollProgressBar
//     component exists, SectionRail.tsx exists
//   - Plan 05: DESIGNAGENT_SUPPRESSED no longer gates theming in issue/[slug]/layout.tsx
//   - Plan 02/03: aria-label on GameSlot play button, role="log" on DelibChat, etc.

describe('DEFERRED: Plan 02 — new motion components and retired components', () => {
  it.todo('Atmosphere.tsx is deleted or not imported in page.tsx (Plan 02)')
  it.todo('SectionNavigator.tsx is deleted or not imported in page.tsx (Plan 02)')
  it.todo('ScrollProgressBar.tsx exists with framer-motion useScroll (Plan 02)')
  it.todo('SectionRail.tsx exists with role="navigation" and aria-label (Plan 02)')
  it.todo('ScrollReveal.tsx exists with useReducedMotion guard (Plan 02)')
})

describe('DEFERRED: Plan 05 — DESIGNAGENT_SUPPRESSED suppression removed from theming path', () => {
  it.todo(
    // Plan 05 turns this green:
    // issue/[slug]/layout.tsx must NOT contain the pattern:
    //   suppressed ? '' : serializeThemeCss(theme)
    // i.e., theming is unconditional after Plan 05
    'issue/[slug]/layout.tsx: no suppressed ? "" : serializeThemeCss pattern (Plan 05)'
  )
})

describe('DEFERRED: Plan 02/03 — accessibility attributes on new components', () => {
  it.todo('GameSlot play button has aria-label containing "Play" (Plan 02)')
  it.todo('DelibChat has role="log" and aria-live="polite" (Plan 03)')
  it.todo('ScrollReveal components: reduced-motion initial={false} pattern (Plan 02)')
})
