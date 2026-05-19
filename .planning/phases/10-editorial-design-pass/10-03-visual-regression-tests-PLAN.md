---
phase: 10-editorial-design-pass
plan: 03
type: execute
wave: 1
depends_on:
  - 10-01
files_modified:
  - apps/web/__tests__/issue-page-typography.test.ts
autonomous: true
requirements:
  - DES-01
  - DES-02
  - DES-03
  - DES-04
  - DES-05
  - DES-06
must_haves:
  truths:
    - "A Vitest test file at apps/web/__tests__/issue-page-typography.test.ts exists and is picked up by `pnpm --filter web test:unit`"
    - "The test file source-scans apps/web/app/layout.tsx and asserts Playfair_Display + Lora are imported from 'next/font/google'"
    - "The test file source-scans apps/web/app/globals.css and asserts .prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block utilities exist"
    - "The test file source-scans apps/web/components/issue/EditorialSection.tsx and asserts the `lead` prop and `drop-cap` className wiring are present"
    - "The test file source-scans apps/web/components/issue/CaseStudySection.tsx and asserts .metadata-block is rendered"
    - "The test file source-scans apps/web/app/issue/[slug]/page.tsx and asserts the Origin Story EditorialSection has the `lead` prop AND ShopCallout is still rendered (DES-06 + CMR-09 inheritance)"
    - "The test file source-scans apps/web/app/issue/[slug]/page.tsx and asserts no HTTP Google Fonts <link> tag was added (next/font/google contract)"
    - "All tests in `pnpm --filter web test:unit` exit 0 once Plans 10-01 + 10-02 are merged"
  artifacts:
    - path: "apps/web/__tests__/issue-page-typography.test.ts"
      provides: "Visual regression tripwire — source-scans the Phase 10 deliverables and fails if the design contract is broken"
      contains: "describe.*Phase 10"
      min_lines: 100
  key_links:
    - from: "apps/web/__tests__/issue-page-typography.test.ts"
      to: "apps/web/app/globals.css"
      via: "readFileSync at test runtime — always reflects current globals.css"
      pattern: "globals\\.css"
    - from: "apps/web/__tests__/issue-page-typography.test.ts"
      to: "apps/web/components/issue/EditorialSection.tsx"
      via: "readFileSync source scan"
      pattern: "EditorialSection\\.tsx"
---

<objective>
Build the source-scan tripwire that locks Phase 10's design contract in place. Same
pattern as Phase 7's apps/web/__tests__/game-sandbox.test.ts: readFileSync at test
runtime + grep-style assertions. Fails if a future edit removes the drop cap class,
the ornament divider, the next/font/google contract, the .prose-measure utility, or
the ShopCallout import on the issue page.

Why one file (not one per requirement): a single describe block with one suite per
requirement (DES-01 through DES-06) reads as a design contract document and runs in
under a second. No DOM, no React render, no Convex mock — just file content scans.

Purpose: This test is the CI guard for the Phase 10 redesign. If 10-01 utilities are
deleted, if 10-02 reverts EditorialSection, if a developer adds a Google Fonts <link>
to bypass next/font, the test fails — the build catches the regression.

Output: one new test file with six describe blocks (one per DES requirement) that
read the relevant source files and assert the contract.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/__tests__/game-sandbox.test.ts
@apps/web/__tests__/issue-page-shop-callout.test.ts
@apps/web/vitest.config.ts
@apps/web/app/layout.tsx
@apps/web/app/globals.css
@apps/web/components/issue/EditorialSection.tsx
@apps/web/components/issue/CaseStudySection.tsx
@apps/web/app/issue/[slug]/page.tsx

<interfaces>
<!-- Phase 7's apps/web/__tests__/game-sandbox.test.ts is the canonical pattern for -->
<!-- a source-scan tripwire test. Phase 10 copies its style verbatim. -->

From apps/web/__tests__/game-sandbox.test.ts (the pattern):
```typescript
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const GAME_SLOT_PATH = resolve(__dirname, '../components/issue/GameSlot.tsx')

describe('GAM-03: GameSlot sandbox security source-scan', () => {
  const source = readFileSync(GAME_SLOT_PATH, 'utf-8')

  it('never contains the literal string "allow-same-origin"', () => {
    expect(source).not.toContain('allow-same-origin')
  })
  // …
})
```

From apps/web/__tests__/issue-page-shop-callout.test.ts (the strip-comments pattern
when code-only matching is needed):
```typescript
const codeOnly = raw
  .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
  .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments
expect(codeOnly).not.toMatch(/banner/i)
```

From apps/web/vitest.config.ts:
```typescript
test: {
  environment: 'node',
  include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
}
```
Any new __tests__/*.test.ts file is automatically collected.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create the typography source-scan tripwire test file</name>
  <files>apps/web/__tests__/issue-page-typography.test.ts</files>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (the source-scan tripwire PATTERN — copy its structure: readFileSync + describe + it + expect.toMatch / expect.not.toMatch / expect.toContain)
    - apps/web/__tests__/issue-page-shop-callout.test.ts (the comment-stripping pattern for code-only matching)
    - apps/web/vitest.config.ts (confirm `include: ['__tests__/**/*.test.ts']` so this new file is automatically collected)
    - apps/web/app/globals.css (confirm Plan 10-01's .prose-measure / .drop-cap / .ornament-divider / .eyebrow / .metadata-block utilities — the test asserts each)
    - apps/web/components/issue/EditorialSection.tsx (confirm Plan 10-02 Task 1's `lead?: boolean` prop + drop-cap wiring — the test asserts both)
  </read_first>
  <action>
Create apps/web/__tests__/issue-page-typography.test.ts with six describe blocks
(one per DES requirement). Each describe block reads ONE source file at runtime
and runs targeted assertions. The file structure is verbatim:

```typescript
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

  it('issue page applies lead to Origin Story EditorialSection exactly once', () => {
    // Single drop cap per issue — only the first prose section gets it.
    const leadMatches = pageSrc.match(/\blead\b/g) ?? []
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
```

Constraints:
- Use `readFileSync(..., 'utf-8')` — same as Phase 7's game-sandbox.test.ts.
- Use `resolve(__dirname, '../path/to/file')` — same pattern.
- No DOM, no React render, no Convex mock — Vitest node environment is fine.
- All paths use forward slashes — Vitest runs on macOS/Linux dev + CI.
- All regex patterns use multi-line `[\s\S]*?` (lazy) to span multiline JSX attribute lists.
- Test count: ~38 individual it() blocks across six describe blocks. Acceptable
  per Phase 7's precedent (game-validator.test.ts has 20+ it() blocks).
  </action>
  <verify>
    <automated>test -f apps/web/__tests__/issue-page-typography.test.ts && grep -c "describe(" apps/web/__tests__/issue-page-typography.test.ts | awk '$1 >= 6 { exit 0 } { exit 1 }' && pnpm --filter web test:unit</automated>
  </verify>
  <acceptance_criteria>
    - test -f apps/web/__tests__/issue-page-typography.test.ts (file exists)
    - grep -c "describe(" apps/web/__tests__/issue-page-typography.test.ts returns ≥6 (one per DES-01..DES-06)
    - grep -q "DES-01" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "DES-02" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "DES-03" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "DES-04" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "DES-05" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "DES-06" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "readFileSync" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "Playfair_Display" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "Lora" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "drop-cap" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "ornament-divider" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "metadata-block" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "prose-measure" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "ShopCallout" apps/web/__tests__/issue-page-typography.test.ts
    - grep -q "sandbox=\"allow-scripts\"" apps/web/__tests__/issue-page-typography.test.ts
    - pnpm --filter web test:unit exits 0 (test passes after 10-01 + 10-02 land; if executed before 10-02, this test will fail but that is the Wave-0-fails-then-Wave-1-greens pattern — see scheduling note in plan-level notes below)
  </acceptance_criteria>
  <done>
    apps/web/__tests__/issue-page-typography.test.ts exists with 6 describe blocks
    (one per DES requirement) and ~38 it() assertions. `pnpm --filter web test:unit`
    exits 0 (assuming 10-01 + 10-02 have landed; otherwise this test red-flags exactly
    the gap they fill).
  </done>
</task>

</tasks>

<verification>
- The file at apps/web/__tests__/issue-page-typography.test.ts exists and contains 6 describe blocks (one per DES-01..DES-06)
- All it() assertions are grep-style file scans — no DOM, no React render, no mocks
- `pnpm --filter web test:unit` exits 0 with this test + all Phase 7 + Phase 8 + Phase 2 pre-existing tests passing
</verification>

<success_criteria>
- One new test file in apps/web/__tests__/ following the Phase 7 game-sandbox.test.ts pattern (readFileSync + grep assertions)
- Six describe blocks, each tagged with the corresponding DES requirement ID
- All required source files scanned: layout.tsx, globals.css, EditorialSection.tsx, CaseStudySection.tsx, IssueHero.tsx, PortableTextRenderer.tsx, issue/[slug]/page.tsx, ShopCallout.tsx, GameSlot.tsx
- pnpm --filter web test:unit exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/10-editorial-design-pass/10-03-visual-regression-tests-SUMMARY.md`
recording: total describe block count (should be 6), total it() count (should be ~38),
and confirmation that pnpm --filter web test:unit exits 0 after Plans 10-01 + 10-02
have landed.
</output>

<plan_notes>
This plan is in Wave 1 alongside 10-02. Either ordering works:
- If 10-02 lands first, 10-03's test passes immediately on first run.
- If 10-03 lands first, its test fails until 10-02 lands — which is the standard
  Wave 0 / Wave 1 TDD pattern (red→green). Either way, the test is in CI before
  Plan 10-04 closes the phase.
</plan_notes>
