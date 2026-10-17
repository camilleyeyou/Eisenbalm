/**
 * Phase 10 — Editorial Design Pass: source-scan tripwire.
 *
 * Same pattern as apps/web/__tests__/game-sandbox.test.ts (Phase 7 GAM-03):
 * readFileSync at test runtime + grep-style assertions. NO DOM, NO React
 * render, NO Convex mock — pure file content scans.
 *
 * If this test fails, do NOT delete it or weaken assertions. Fix the
 * source instead. This test IS the codebase-level guard for Phase 10's
 * design contract.
 *
 * Requirements covered: DES-01, DES-02, DES-03, DES-04, DES-05, DES-06.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const LAYOUT_PATH        = resolve(__dirname, '../app/layout.tsx')
const GLOBALS_PATH       = resolve(__dirname, '../app/globals.css')
const PORTABLE_TEXT_PATH = resolve(__dirname, '../components/issue/PortableTextRenderer.tsx')
const ISSUE_PAGE_PATH    = resolve(__dirname, '../app/issue/[slug]/page.tsx')
// Plan 26-04: the magazine rendering tree was extracted to IssueLayout so the
// draft-preview route can share it exactly (D-09 fidelity). Source-scans that
// check for JSX inside the page now need to check IssueLayout.tsx.
const ISSUE_LAYOUT_PATH  = resolve(__dirname, '../components/issue/IssueLayout.tsx')
const GAME_SLOT_PATH     = resolve(__dirname, '../components/issue/GameSlot.tsx')

/**
 * Strip block and line comments so regex matches behavior (JSX, classNames,
 * identifiers) rather than documentation prose. Mirrors the pattern in
 * apps/web/__tests__/issue-page-shop-callout.test.ts.
 */
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (don't eat URL ://)
}

// ─── DES-01: Paired Google Fonts via next/font/google ───────────────────────

describe('DES-01: Paired Google Fonts via next/font/google (no FOUT)', () => {
  const layoutSrc = readFileSync(LAYOUT_PATH, 'utf-8')

  // Phase 19 locked decision: fonts swapped from Playfair_Display/Lora/Inter
  // to Fraunces/Newsreader/IBM_Plex_Mono sitewide.
  it('imports Fraunces from next/font/google (Phase 19 display font)', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*Fraunces[^}]*\}\s*from\s*['"]next\/font\/google['"]/)
  })

  it('imports Newsreader from next/font/google (Phase 19 body font)', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*Newsreader[^}]*\}\s*from\s*['"]next\/font\/google['"]/)
  })

  it('imports IBM_Plex_Mono from next/font/google (Phase 19 UI font)', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*IBM_Plex_Mono[^}]*\}\s*from\s*['"]next\/font\/google['"]/)
  })

  it('exposes Fraunces as a CSS variable on <html> (--font-display-loaded)', () => {
    expect(layoutSrc).toMatch(/variable:\s*['"]--font-display-loaded['"]/)
  })

  it('exposes Newsreader as a CSS variable on <html> (--font-body-loaded)', () => {
    expect(layoutSrc).toMatch(/variable:\s*['"]--font-body-loaded['"]/)
  })

  it('root layout loads Manrope as --font-dispatch (Phase 55)', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*Manrope[^}]*\}\s*from\s*['"]next\/font\/google['"]/)
    expect(layoutSrc).toMatch(/variable:\s*['"]--font-dispatch['"]/)
  })

  it('never loads fonts via <link href="https://fonts.googleapis.com/...">', () => {
    expect(layoutSrc).not.toMatch(/fonts\.googleapis\.com/)
  })

  it('next/font/google import points at the official package (not a shim)', () => {
    // Defense against developers replacing next/font/google with a runtime shim.
    const importCount = (layoutSrc.match(/from\s+['"]next\/font\/google['"]/g) ?? []).length
    expect(importCount).toBeGreaterThanOrEqual(1)
  })
})

// ─── DES-02: Drop cap on the lead section's first paragraph ────────────────

describe('DES-02: Drop cap on the first prose section (lead)', () => {
  const globalsSrc   = readFileSync(GLOBALS_PATH, 'utf-8')

  it('globals.css defines a .drop-cap rule targeting the first paragraph first letter', () => {
    expect(globalsSrc).toMatch(/\.drop-cap\s*>\s*p:first-of-type::first-letter/)
  })

  it('globals.css drop-cap rule uses the display font variable', () => {
    expect(globalsSrc).toMatch(/\.drop-cap[\s\S]{0,200}var\(--font-display\)/)
  })

  it('issue layout renders the Dispatch OriginSection (Phase 55; prose via PortableTextRenderer)', () => {
    // Phase 55: the EditorialSection lead/drop-cap composition was replaced by the
    // Dispatch numbered sections. Plan 26-04 kept the tree in IssueLayout.
    const layoutSrc = readFileSync(ISSUE_LAYOUT_PATH, 'utf-8')
    expect(layoutSrc).toMatch(/<OriginSection/)
    const originSrc = readFileSync(
      resolve(__dirname, '../components/dispatch/sections/OriginSection.tsx'),
      'utf-8',
    )
    expect(originSrc).toMatch(/PortableTextRenderer/)
  })

  it('issue layout renders ProblemSection, FounderSection and CaseSection', () => {
    const layoutSrc = readFileSync(ISSUE_LAYOUT_PATH, 'utf-8')
    expect(layoutSrc).toMatch(/<ProblemSection/)
    expect(layoutSrc).toMatch(/<FounderSection/)
    expect(layoutSrc).toMatch(/<CaseSection/)
  })
})

// ─── DES-03: Comfortable measure + line-height for body prose ──────────────

describe('DES-03: Reading measure 60-68ch + line-height >= 1.55', () => {
  const globalsSrc       = readFileSync(GLOBALS_PATH, 'utf-8')
  const portableTextSrc  = readFileSync(PORTABLE_TEXT_PATH, 'utf-8')

  it('globals.css defines .prose-measure with max-width: 68ch', () => {
    expect(globalsSrc).toMatch(/\.prose-measure[\s\S]{0,200}max-width:\s*68ch/)
  })

  it('globals.css .prose-measure constrains horizontal padding for mobile', () => {
    expect(globalsSrc).toMatch(/\.prose-measure[\s\S]{0,200}padding-inline:/)
  })

  it('PortableTextRenderer body paragraphs use leading-[1.7] (>= 1.55)', () => {
    expect(portableTextSrc).toMatch(/leading-\[1\.7\]/)
  })

  it('globals.css base html line-height is >= 1.55', () => {
    // Existing :root html { line-height: 1.65 } satisfies this.
    expect(globalsSrc).toMatch(/line-height:\s*1\.(?:5[5-9]|[6-9]\d?|\d{2,})/)
  })
})

// ─── DES-04: Ornament dividers + small-caps eyebrow ────────────────────────

describe('DES-04: Ornament dividers + eyebrow section headers', () => {
  const globalsSrc   = readFileSync(GLOBALS_PATH, 'utf-8')

  it('globals.css defines .ornament-divider rule', () => {
    expect(globalsSrc).toMatch(/\.ornament-divider/)
  })

  it('globals.css ornament-divider uses a Unicode ornament character', () => {
    // \2766 is the FLEURON glyph used by Plan 10-01.
    expect(globalsSrc).toMatch(/content:\s*['"]\\2766['"]/)
  })

  it('globals.css defines .eyebrow utility with small-caps treatment', () => {
    expect(globalsSrc).toMatch(/\.eyebrow[\s\S]{0,300}text-transform:\s*uppercase/)
  })

  it('globals.css .eyebrow uses generous letter-spacing', () => {
    expect(globalsSrc).toMatch(/\.eyebrow[\s\S]{0,300}letter-spacing:\s*0\.\d+em/)
  })

})

// ─── DES-05: Case study metadata in footnote-style block ───────────────────

describe('DES-05: Case study structured metadata in .metadata-block', () => {
  const globalsSrc   = readFileSync(GLOBALS_PATH, 'utf-8')

  it('globals.css defines .metadata-block utility', () => {
    expect(globalsSrc).toMatch(/\.metadata-block/)
  })

  it('globals.css .metadata-block uses tabular numerals (monospace numerals)', () => {
    expect(globalsSrc).toMatch(/\.metadata-block[\s\S]{0,400}tabular-nums/)
  })

  it('globals.css .metadata-block uses accent-colored left border', () => {
    expect(globalsSrc).toMatch(/\.metadata-block[\s\S]{0,400}var\(--color-accent\)/)
  })

})

// ─── DES-06: Per-issue theme injection still works + locked artifacts ──────

describe('DES-06: Theme CSS variable preservation + locked artifacts', () => {
  const globalsSrc    = readFileSync(GLOBALS_PATH, 'utf-8')
  const pageSrc       = readFileSync(ISSUE_PAGE_PATH, 'utf-8')
  const gameSlotSrc    = readFileSync(GAME_SLOT_PATH, 'utf-8')

  it('globals.css still defines --color-primary, --color-accent, --color-bg, --color-text in :root', () => {
    expect(globalsSrc).toMatch(/--color-primary:/)
    expect(globalsSrc).toMatch(/--color-accent:/)
    expect(globalsSrc).toMatch(/--color-bg:/)
    expect(globalsSrc).toMatch(/--color-text:/)
  })

  it('Phase 10 utilities consume theme CSS variables (no hardcoded hex)', () => {
    // Spot-check: .ornament-divider, .eyebrow, .metadata-block, .drop-cap all reference var(--color-*).
    expect(globalsSrc).toMatch(/\.ornament-divider[\s\S]{0,400}var\(--color-/)
    expect(globalsSrc).toMatch(/\.eyebrow[\s\S]{0,400}var\(--color-/)
    expect(globalsSrc).toMatch(/\.metadata-block[\s\S]{0,400}var\(--color-/)
    expect(globalsSrc).toMatch(/\.drop-cap[\s\S]{0,400}var\(--color-/)
  })

  it('GameSlot.tsx is untouched (Phase 7 lock — sandbox="allow-scripts" still present)', () => {
    // Phase 7 GAM-03 source-scan still passes; this is a cross-check.
    expect(gameSlotSrc).toContain('sandbox="allow-scripts"')
    expect(gameSlotSrc).not.toContain('allow-same-origin')
  })

  it('issue page renders shop section with data-shop-callout attribute (CMR-09 — ShopBand replaces ShopCallout in Phase 19)', () => {
    // Phase 19 Plan 02 retires ShopCallout (standalone component) and replaces
    // it with inline ShopBand section in page.tsx. The CMR-09 data-shop-callout
    // attribute is preserved on ShopBand.
    // Phase 55: BuyBand (in IssueLayout) replaces ShopBand; data-shop-callout preserved.
    expect(readFileSync(ISSUE_LAYOUT_PATH, 'utf-8')).toMatch(/<BuyBand/)
    expect(readFileSync(resolve(__dirname, '../components/dispatch/BuyBand.tsx'), 'utf-8')).toContain('data-shop-callout')
  })

  it('issue page still renders GameSlot with runId', () => {
    // Plan 26-04: rendering extracted to IssueLayout — check there.
    const layoutSrc = readFileSync(ISSUE_LAYOUT_PATH, 'utf-8')
    expect(layoutSrc).toMatch(/<GameSlot[\s\S]*?game=/)
    expect(layoutSrc).toMatch(/<GameSlot[\s\S]*?runId=/)
  })

  it('issue page remains a Server Component (no "use client" at top)', () => {
    const firstThreeLines = pageSrc.split('\n').slice(0, 3).join('\n')
    expect(firstThreeLines).not.toMatch(/['"]use client['"]/)
  })

  it('issue page does NOT introduce a Google Fonts <link> tag (next/font/google contract)', () => {
    expect(pageSrc).not.toMatch(/fonts\.googleapis\.com/)
  })
})
