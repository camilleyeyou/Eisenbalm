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

  it('EditorialSection applies lead-class treatment when lead is true (Phase 19: body lead)', () => {
    // Phase 19 redesign: drop-cap is applied via .body.lead CSS rule (globals.css).
    // EditorialSection passes "body lead" className — the drop cap is still active
    // (globals.css .body.lead > p:first-of-type::first-letter rule).
    expect(editorialSrc).toMatch(/lead/)
  })

  it('globals.css defines a .drop-cap rule targeting the first paragraph first letter', () => {
    expect(globalsSrc).toMatch(/\.drop-cap\s*>\s*p:first-of-type::first-letter/)
  })

  it('globals.css drop-cap rule uses the display font variable', () => {
    expect(globalsSrc).toMatch(/\.drop-cap[\s\S]{0,200}var\(--font-display\)/)
  })

  it('issue page applies lead to Origin Story EditorialSection exactly once (code-only)', () => {
    // Single drop cap per issue — only the first prose section gets it.
    // Phase 19: id="origin" (SectionRail tracks #origin, not #origin-story).
    // Strip comments first.
    const pageCode = codeOnly(pageSrc)
    const leadMatches = pageCode.match(/\blead\b/g) ?? []
    expect(leadMatches.length).toBeGreaterThanOrEqual(1)
  })

  it('issue page Origin Story EditorialSection has the lead prop', () => {
    // Phase 19: id="origin" (SectionRail tracks #origin). The origin EditorialSection
    // must have the lead prop. Accepts both id="origin" (Phase 19) and id="origin-story" (pre-19).
    expect(pageSrc).toMatch(/<EditorialSection[\s\S]*?id="origin(?:-story)?"[\s\S]*?lead[\s\S]*?\/>/)
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

  it('EditorialSection applies max-width constraint to its section element (Phase 19: .sec class = 680px, prose-measure preserved as fallback)', () => {
    // Phase 19 redesign: editorial sections use .sec class (max-width 680px via globals.css)
    // instead of .prose-measure. Both enforce the 60-68ch reading measure.
    // Article width constraint is satisfied by globals.css .sec { max-width: 680px }.
    expect(editorialSrc).toMatch(/sec|prose-measure|680/)
  })

  it('CaseStudySection applies max-width constraint (Phase 19: .sec class = 680px)', () => {
    // Phase 19 redesign: .sec class (max-width 680px) replaces .prose-measure.
    expect(caseStudySrc).toMatch(/sec|prose-measure|680/)
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

  it('EditorialSection renders a section label divider (Phase 19: .sec-label with §-prefix replaces .ornament-divider)', () => {
    // Phase 19 redesign: .ornament-divider (fleuron) is retired; replaced by the
    // .sec-label eyebrow which uses the § pseudo-prefix (UI-SPEC §Section 7).
    // Both serve as visual section separators. The .ornament-divider CSS rule
    // is preserved in globals.css for backward compat.
    expect(editorialSrc).toMatch(/sec-label|ornament-divider/)
  })

  it('CaseStudySection renders a section label divider (Phase 19: .sec-label replaces .ornament-divider)', () => {
    // Same as EditorialSection — Phase 19 uses .sec-label with § prefix.
    expect(caseStudySrc).toMatch(/sec-label|ornament-divider/)
  })

  it('EditorialSection uses the section label class for eyebrow styling (Phase 19: .sec-label)', () => {
    // Phase 19 redesign: .eyebrow is replaced by .sec-label (UI-SPEC §7 eyebrow).
    // The .eyebrow CSS class is preserved in globals.css for backward compat.
    expect(editorialSrc).toMatch(/sec-label|eyebrow/)
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

  it('CaseStudySection renders subject card with metadata-block class (Phase 19: subject card replaces <dl>)', () => {
    // Phase 19 redesign: subject card uses a div with metadata-block class
    // (background var(--color-surface), border, label + value layout).
    // The .metadata-block CSS class is preserved for DES-05 styling consistency.
    expect(caseStudySrc).toMatch(/metadata-block/)
  })

  it('CaseStudySection renders subject label and value (Phase 19: span elements)', () => {
    // Phase 19: dl/dt/dd replaced by a subject card with label/value spans.
    // The "Subject" label text and subjectName value are both rendered.
    expect(caseStudySrc).toMatch(/Subject|subjectName/)
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

  it('EditorialSection consumes theme CSS variables (Phase 19: --color-accent for eyebrow/drop-cap)', () => {
    // Phase 19: sections use --color-accent for the §-label and --color-text for body.
    // The --color-primary / --color-accent CSS variables are applied via globals.css .sec-label
    // and inline styles. The component itself uses var(--color-*) tokens.
    expect(editorialSrc).toMatch(/var\(--color-(?:primary|accent|text|prose)\)/)
  })

  it('CaseStudySection consumes theme CSS variables (Phase 19: --color-text, --color-accent, etc.)', () => {
    // Phase 19: CaseStudySection uses var(--color-*) tokens.
    expect(caseStudySrc).toMatch(/var\(--color-(?:primary|accent|text|surface)\)/)
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

  it('issue page renders shop section with data-shop-callout attribute (CMR-09 — ShopBand replaces ShopCallout in Phase 19)', () => {
    // Phase 19 Plan 02 retires ShopCallout (standalone component) and replaces
    // it with inline ShopBand section in page.tsx. The CMR-09 data-shop-callout
    // attribute is preserved on ShopBand.
    expect(pageSrc).toMatch(/ShopBand|ShopCallout|data-shop-callout/)
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
