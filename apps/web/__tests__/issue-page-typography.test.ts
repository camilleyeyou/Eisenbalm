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
const EDITORIAL_PATH     = resolve(__dirname, '../components/issue/EditorialSection.tsx')
const CASESTUDY_PATH     = resolve(__dirname, '../components/issue/CaseStudySection.tsx')
const ISSUE_HERO_PATH    = resolve(__dirname, '../components/issue/IssueHero.tsx')
const PORTABLE_TEXT_PATH = resolve(__dirname, '../components/issue/PortableTextRenderer.tsx')
const ISSUE_PAGE_PATH    = resolve(__dirname, '../app/issue/[slug]/page.tsx')
const SHOP_CALLOUT_PATH  = resolve(__dirname, '../components/issue/ShopCallout.tsx')
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

  it('imports Playfair_Display from next/font/google', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*Playfair_Display[^}]*\}\s*from\s*['"]next\/font\/google['"]/)
  })

  it('imports Lora from next/font/google', () => {
    expect(layoutSrc).toMatch(/import\s*\{[^}]*Lora[^}]*\}\s*from\s*['"]next\/font\/google['"]/)
  })

  it('exposes Playfair Display as a CSS variable on <html>', () => {
    expect(layoutSrc).toMatch(/variable:\s*['"]--font-display-loaded['"]/)
  })

  it('exposes Lora as a CSS variable on <html>', () => {
    expect(layoutSrc).toMatch(/variable:\s*['"]--font-body-loaded['"]/)
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
  const editorialSrc = readFileSync(EDITORIAL_PATH, 'utf-8')
  const globalsSrc   = readFileSync(GLOBALS_PATH, 'utf-8')
  const pageSrc      = readFileSync(ISSUE_PAGE_PATH, 'utf-8')

  it('EditorialSection accepts a `lead` boolean prop', () => {
    expect(editorialSrc).toMatch(/lead\?:\s*boolean/)
  })

  it('EditorialSection passes "drop-cap" className when lead is true', () => {
    expect(editorialSrc).toMatch(/drop-cap/)
  })

  it('globals.css defines a .drop-cap rule targeting the first paragraph first letter', () => {
    expect(globalsSrc).toMatch(/\.drop-cap\s*>\s*p:first-of-type::first-letter/)
  })

  it('globals.css drop-cap rule uses the display font variable', () => {
    expect(globalsSrc).toMatch(/\.drop-cap[\s\S]{0,200}var\(--font-display\)/)
  })

  it('issue page applies lead to Origin Story EditorialSection exactly once (code-only)', () => {
    // Single drop cap per issue — only the first prose section gets it.
    // Strip comments first because the JSX block comment above the lead
    // EditorialSection intentionally documents the prop (see Plan 10-02 SUMMARY).
    const pageCode = codeOnly(pageSrc)
    const leadMatches = pageCode.match(/\blead\b/g) ?? []
    expect(leadMatches.length).toBe(1)
  })

  it('issue page Origin Story EditorialSection has the lead prop', () => {
    // Match across multiline JSX: <EditorialSection ... id="origin-story" ... lead ... />
    // The order of props varies; require BOTH id="origin-story" and lead within
    // the same EditorialSection tag.
    expect(pageSrc).toMatch(/<EditorialSection[\s\S]*?id="origin-story"[\s\S]*?lead[\s\S]*?\/>/)
  })
})

// ─── DES-03: Comfortable measure + line-height for body prose ──────────────

describe('DES-03: Reading measure 60-68ch + line-height >= 1.55', () => {
  const globalsSrc       = readFileSync(GLOBALS_PATH, 'utf-8')
  const editorialSrc     = readFileSync(EDITORIAL_PATH, 'utf-8')
  const caseStudySrc     = readFileSync(CASESTUDY_PATH, 'utf-8')
  const portableTextSrc  = readFileSync(PORTABLE_TEXT_PATH, 'utf-8')

  it('globals.css defines .prose-measure with max-width: 68ch', () => {
    expect(globalsSrc).toMatch(/\.prose-measure[\s\S]{0,200}max-width:\s*68ch/)
  })

  it('globals.css .prose-measure constrains horizontal padding for mobile', () => {
    expect(globalsSrc).toMatch(/\.prose-measure[\s\S]{0,200}padding-inline:/)
  })

  it('EditorialSection applies the .prose-measure class to its section element', () => {
    expect(editorialSrc).toMatch(/prose-measure/)
  })

  it('CaseStudySection applies the .prose-measure class', () => {
    expect(caseStudySrc).toMatch(/prose-measure/)
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
  const editorialSrc = readFileSync(EDITORIAL_PATH, 'utf-8')
  const caseStudySrc = readFileSync(CASESTUDY_PATH, 'utf-8')
  const issueHeroSrc = readFileSync(ISSUE_HERO_PATH, 'utf-8')

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

  it('EditorialSection renders an .ornament-divider div', () => {
    expect(editorialSrc).toMatch(/className=["']ornament-divider["']/)
  })

  it('CaseStudySection renders an .ornament-divider div', () => {
    expect(caseStudySrc).toMatch(/className=["']ornament-divider["']/)
  })

  it('EditorialSection uses the .eyebrow class for the section label', () => {
    expect(editorialSrc).toMatch(/className=["']eyebrow["']/)
  })

  it('IssueHero uses the .eyebrow class for the issue label and metadata row', () => {
    // At least two .eyebrow usages: issue label + metadata spans.
    const matches = issueHeroSrc.match(/["']eyebrow/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── DES-05: Case study metadata in footnote-style block ───────────────────

describe('DES-05: Case study structured metadata in .metadata-block', () => {
  const globalsSrc   = readFileSync(GLOBALS_PATH, 'utf-8')
  const caseStudySrc = readFileSync(CASESTUDY_PATH, 'utf-8')

  it('globals.css defines .metadata-block utility', () => {
    expect(globalsSrc).toMatch(/\.metadata-block/)
  })

  it('globals.css .metadata-block uses tabular numerals (monospace numerals)', () => {
    expect(globalsSrc).toMatch(/\.metadata-block[\s\S]{0,400}tabular-nums/)
  })

  it('globals.css .metadata-block uses accent-colored left border', () => {
    expect(globalsSrc).toMatch(/\.metadata-block[\s\S]{0,400}var\(--color-accent\)/)
  })

  it('CaseStudySection renders a <dl> with className="metadata-block"', () => {
    expect(caseStudySrc).toMatch(/<dl[^>]*className=["']metadata-block["']/)
  })

  it('CaseStudySection renders <dt> and <dd> inside the metadata block', () => {
    expect(caseStudySrc).toMatch(/<dt>/)
    expect(caseStudySrc).toMatch(/<dd>/)
  })
})

// ─── DES-06: Per-issue theme injection still works + locked artifacts ──────

describe('DES-06: Theme CSS variable preservation + locked artifacts', () => {
  const globalsSrc    = readFileSync(GLOBALS_PATH, 'utf-8')
  const editorialSrc  = readFileSync(EDITORIAL_PATH, 'utf-8')
  const caseStudySrc  = readFileSync(CASESTUDY_PATH, 'utf-8')
  const issueHeroSrc  = readFileSync(ISSUE_HERO_PATH, 'utf-8')
  const pageSrc       = readFileSync(ISSUE_PAGE_PATH, 'utf-8')
  const shopCalloutSrc = readFileSync(SHOP_CALLOUT_PATH, 'utf-8')
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

  it('EditorialSection consumes var(--color-primary)', () => {
    expect(editorialSrc).toMatch(/var\(--color-primary\)/)
  })

  it('CaseStudySection consumes var(--color-primary)', () => {
    expect(caseStudySrc).toMatch(/var\(--color-primary\)/)
  })

  it('IssueHero consumes var(--color-primary)', () => {
    expect(issueHeroSrc).toMatch(/var\(--color-primary\)/)
  })

  it('ShopCallout.tsx is untouched (Phase 2 + CMR-09 lock — only verify it still imports + renders)', () => {
    // We do NOT modify ShopCallout in Phase 10. The source-scan only checks
    // its public contract: file exists and exports `ShopCallout`.
    expect(shopCalloutSrc).toMatch(/export\s+function\s+ShopCallout/)
  })

  it('GameSlot.tsx is untouched (Phase 7 lock — sandbox="allow-scripts" still present)', () => {
    // Phase 7 GAM-03 source-scan still passes; this is a cross-check.
    expect(gameSlotSrc).toContain('sandbox="allow-scripts"')
    expect(gameSlotSrc).not.toContain('allow-same-origin')
  })

  it('issue page still imports + renders ShopCallout (CMR-09 inheritance)', () => {
    expect(pageSrc).toMatch(/import\s+\{\s*ShopCallout\s*\}\s+from\s+['"]@\/components\/issue\/ShopCallout['"]/)
    expect(pageSrc).toMatch(/<ShopCallout\s*(?:\s+[^>]*)?\/?>/)
  })

  it('issue page still renders GameSlot with runId', () => {
    expect(pageSrc).toMatch(/<GameSlot[\s\S]*?game=/)
    expect(pageSrc).toMatch(/<GameSlot[\s\S]*?runId=/)
  })

  it('issue page remains a Server Component (no "use client" at top)', () => {
    const firstThreeLines = pageSrc.split('\n').slice(0, 3).join('\n')
    expect(firstThreeLines).not.toMatch(/['"]use client['"]/)
  })

  it('issue page does NOT introduce a Google Fonts <link> tag (next/font/google contract)', () => {
    expect(pageSrc).not.toMatch(/fonts\.googleapis\.com/)
  })
})
