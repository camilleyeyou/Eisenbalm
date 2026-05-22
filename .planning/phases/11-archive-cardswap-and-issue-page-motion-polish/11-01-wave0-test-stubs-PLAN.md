---
phase: 11-archive-cardswap-and-issue-page-motion-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/__tests__/archive-cardswap.test.ts
  - apps/web/__tests__/issue-hero-motion.test.ts
  - apps/web/__tests__/motion-polish.test.ts
autonomous: true
requirements: [ARC-01, MOT-01, MOT-02, MOT-03]

must_haves:
  truths:
    - "Three new source-scan test files exist in apps/web/__tests__/ and are picked up by Vitest"
    - "Running `pnpm --filter web test:unit` collects the new files without import/collection errors"
    - "The new ARC-01/MOT-01/MOT-02/MOT-03 assertions are RED (fail) because the implementation does not yet exist — Wave 2 turns them green"
    - "All five existing tripwire test files (game-sandbox, theme-aa-tones, deliberation-no-model-names, issue-page-typography, site-header-nav) stay green"
  artifacts:
    - path: "apps/web/__tests__/archive-cardswap.test.ts"
      provides: "ARC-01 source-scan assertions for CardSwap.tsx, archive/page.tsx, package.json, theme.ts FONT_WHITELIST"
      contains: "readFileSync"
    - path: "apps/web/__tests__/issue-hero-motion.test.ts"
      provides: "MOT-01 source-scan assertions for IssueHero.tsx word-span reveal"
      contains: "readFileSync"
    - path: "apps/web/__tests__/motion-polish.test.ts"
      provides: "MOT-02 + MOT-03 source-scan assertions for globals.css, DeliberationSlot.tsx, SectionNavigator.tsx"
      contains: "readFileSync"
  key_links:
    - from: "apps/web/__tests__/archive-cardswap.test.ts"
      to: "apps/web/components/archive/CardSwap.tsx"
      via: "readFileSync(resolve(__dirname, '../components/archive/CardSwap.tsx'))"
      pattern: "readFileSync"
    - from: "apps/web/__tests__/motion-polish.test.ts"
      to: "apps/web/app/globals.css"
      via: "readFileSync of globals.css"
      pattern: "globals\\.css"
---

<objective>
Author the three Wave 0 source-scan test files that encode the ARC-01, MOT-01, MOT-02, and MOT-03 acceptance contracts BEFORE implementation. Per Nyquist validation (VALIDATION.md Wave 0 Requirements), these tests must exist and FAIL first, so the Wave 2 implementation plans (02, 03, 04) have concrete failing tests to satisfy.

Purpose: Establish the automated feedback loop. Every Wave 2 task references one of these tests in its `<acceptance_criteria>`. No DOM, no React render, no mocks — pure `readFileSync` + grep, matching the existing `game-sandbox.test.ts` and `issue-page-typography.test.ts` pattern (node test environment).
Output: 3 new test files in `apps/web/__tests__/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-VALIDATION.md
@.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md

<interfaces>
<!-- Established test pattern — copy this structure verbatim. Source: game-sandbox.test.ts -->
The existing source-scan tripwire pattern (apps/web/__tests__/game-sandbox.test.ts):
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
})
```

`vitest.config.ts` uses `environment: 'node'`; run command is `pnpm --filter web test:unit` (no watch). `__dirname` resolves inside `apps/web/__tests__/`.

Existing `deliberation-no-model-names.test.ts` uses a `codeOnly(source)` helper that strips block + JSX-block + line comments before scanning for forbidden model-name strings. When asserting "no model names in code", reuse the same comment-stripping idea so prose in docstrings does not trip the regex.

`apps/web/package.json` `name` field is `"web"` (so the pnpm filter is `--filter web`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: archive-cardswap.test.ts (ARC-01 source-scan)</name>
  <files>apps/web/__tests__/archive-cardswap.test.ts</files>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (copy this readFileSync + describe/it/expect structure verbatim)
    - apps/web/__tests__/issue-page-typography.test.ts (multi-file readFileSync pattern + codeOnly comment-stripping helper to imitate)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md (Wave 0 Gaps section, lines 722-728; Tripwire Test Inventory)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (ARC-01 section, lines 192-291; Hard Constraint Checklist lines 568-591)
    - apps/web/lib/theme.ts (read FONT_WHITELIST to encode its exact 6 entries)
    - apps/web/app/archive/page.tsx (current structure — test asserts the future CardSwap import lands here)
  </read_first>
  <action>
Create `apps/web/__tests__/archive-cardswap.test.ts` following the `game-sandbox.test.ts` pattern: `import { readFileSync } from 'node:fs'`, `import { resolve } from 'node:path'`, `import { describe, it, expect } from 'vitest'`.

Define paths:
- `const CARDSWAP_PATH = resolve(__dirname, '../components/archive/CardSwap.tsx')`
- `const ARCHIVE_PAGE_PATH = resolve(__dirname, '../app/archive/page.tsx')`
- `const PACKAGE_JSON_PATH = resolve(__dirname, '../package.json')`
- `const THEME_PATH = resolve(__dirname, '../lib/theme.ts')`

Read CardSwap source INSIDE each `it()` body (NOT at describe scope) so collection does not throw before the file exists — use a helper `function readCardSwap() { return readFileSync(CARDSWAP_PATH, 'utf-8') }` and call it inside each test. (This mirrors the Phase 9 lesson in STATE.md line 264: readFileSync for not-yet-existing files must be inside each it() callback.) Read the already-existing files (archive/page.tsx, package.json, theme.ts) at describe scope since they exist.

Write a `function codeOnly(src: string): string` helper that strips block comments (`/\/\*[\s\S]*?\*\//g`), JSX block comments (`/\{\/\*[\s\S]*?\*\/\}/g`), and line comments (`/\/\/.*$/gm`) — copy the regex set from deliberation-no-model-names.test.ts / issue-page-typography.test.ts.

`describe('ARC-01: CardSwap source-scan', ...)` with these `it()` assertions (all read CardSwap via the helper inside the callback):
- `it('CardSwap.tsx exists and is non-empty')` → `expect(readCardSwap().length).toBeGreaterThan(0)`
- `it('binds to ArchiveIssue prop — no hardcoded issue content')`: assert `readCardSwap()` contains `ArchiveIssue` (the type import/usage); and assert it does NOT contain the spec's hardcoded sample strings: `expect(src).not.toContain('Project Solitude')`, `.not.toContain('Issue 042')`, `.not.toContain('Atacama')`. Use codeOnly() for these to ignore comments.
- `it('declares the prefers-reduced-motion guard')` → `expect(readCardSwap()).toContain('prefers-reduced-motion')`
- `it('uses matchMedia for the reduced-motion gate')` → `expect(readCardSwap()).toContain('matchMedia')`
- `it('has data-print-hide="true" on the wrapper')` → `expect(readCardSwap()).toContain('data-print-hide="true"')`
- `it('uses a <section> wrapper and adds no second <main>')`: `expect(codeOnly(readCardSwap())).not.toContain('<main')` and `expect(readCardSwap()).toContain('<section')`
- `it('indicator/control buttons carry aria-label and aria-current')`: `expect(readCardSwap()).toContain('aria-label')` and `expect(readCardSwap()).toContain('aria-current')`
- `it('imports formatMonthYear from @/lib/format (no duplicate date formatter)')` → `expect(readCardSwap()).toContain('formatMonthYear')`
- `it('has no CDN <script> tag or @import (no gsap, no Iconify)')`: `const code = codeOnly(readCardSwap())`; `expect(code).not.toContain('<script')`; `expect(code).not.toContain('@import')`; `expect(code).not.toContain('cdnjs')`; `expect(code).not.toMatch(/gsap/i)`; `expect(code).not.toContain('framer-motion')`

`describe('ARC-01: archive page wires CardSwap', ...)` (archive/page.tsx read at describe scope):
- `it('archive/page.tsx imports CardSwap')` → `expect(archivePageSource).toContain('CardSwap')`
- `it('archive/page.tsx renders <CardSwap issues=')` → `expect(archivePageSource).toMatch(/<CardSwap\s+issues=/)`

`describe('ARC-01: no new npm dependency', ...)`:
- `it('apps/web/package.json declares no gsap or framer-motion dependency')`: parse `JSON.parse(packageJsonSource)`; collect keys of `dependencies` and `devDependencies`; `expect(allDepKeys).not.toContain('gsap')`; `.not.toContain('framer-motion')`; `.not.toContain('@iconify/react')`
- `it('apps/web/package.json dependency count is unchanged at the Phase 11 baseline')`: assert `Object.keys(pkg.dependencies).length` equals the current baseline count. First run `node -e "console.log(Object.keys(require('./apps/web/package.json').dependencies).length)"` to get the exact integer, then hardcode that integer in the assertion with a comment `// Phase 11 baseline — bump ONLY with an approved dependency decision`.

`describe('Security: FONT_WHITELIST unchanged', ...)` (theme.ts read at describe scope):
- `it('theme.ts FONT_WHITELIST still has exactly 6 entries')`: scan for the FONT_WHITELIST array; assert the literal entries are present: `expect(themeSource).toContain("'Playfair Display'")`, `'Lora'`, `'Inter'`, `'Cormorant Garamond'`, `'Merriweather'`, `'DM Serif Display'`; and assert the forbidden additions are absent: `expect(themeSource).not.toContain('Spectral')`, `.not.toContain('IBM Plex Mono')`.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/web/__tests__/archive-cardswap.test.ts` exists and is non-empty
    - `grep -c "readFileSync" apps/web/__tests__/archive-cardswap.test.ts` returns ≥1
    - `grep "data-print-hide" apps/web/__tests__/archive-cardswap.test.ts` matches
    - `grep "FONT_WHITELIST" apps/web/__tests__/archive-cardswap.test.ts` OR `grep "Cormorant Garamond" apps/web/__tests__/archive-cardswap.test.ts` matches
    - `grep "framer-motion" apps/web/__tests__/archive-cardswap.test.ts` matches (the no-new-dep assertion)
    - Running `pnpm --filter web test:unit` collects the file with NO import/collection errors (it may report failing assertions for CardSwap.tsx not existing — that is the expected RED state)
    - The package.json baseline-count assertion uses a hardcoded integer matching `node -e "console.log(Object.keys(require('./apps/web/package.json').dependencies).length)"` output
  </acceptance_criteria>
  <done>archive-cardswap.test.ts encodes all ARC-01 + FONT_WHITELIST + no-new-dep assertions; Vitest collects it cleanly; CardSwap-dependent assertions are RED until Plan 02.</done>
</task>

<task type="auto">
  <name>Task 2: issue-hero-motion.test.ts (MOT-01) + motion-polish.test.ts (MOT-02/MOT-03)</name>
  <files>apps/web/__tests__/issue-hero-motion.test.ts, apps/web/__tests__/motion-polish.test.ts</files>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (the readFileSync pattern)
    - apps/web/__tests__/deliberation-no-model-names.test.ts (codeOnly() comment-stripping helper + forbidden model-name string list to reuse for the MOT-03 DEL-04 inheritance assertion)
    - apps/web/__tests__/issue-page-typography.test.ts (eyebrow count assertion to inherit for MOT-01)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md (Wave 0 Gaps lines 722-728; Pattern 2 hero word-reveal lines 135-183; Pattern 4 count-up lines 205-320)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (MOT-01 lines 294-348, MOT-02 lines 351-385, MOT-03 lines 388-466)
    - apps/web/components/issue/IssueHero.tsx (current <h1> at lines 90-98; eyebrow usages)
    - apps/web/app/globals.css (.section-card:hover at lines 521-527)
    - apps/web/components/issue/DeliberationSlot.tsx (confidence meter lines 487-534; module-scope prefersReducedMotion lines 95-97)
    - apps/web/components/issue/SectionNavigator.tsx (prefersReducedMotion early-return lines 94-101)
  </read_first>
  <action>
Create TWO files.

**File A — `apps/web/__tests__/issue-hero-motion.test.ts`** (MOT-01). Same imports as game-sandbox.test.ts. `const HERO_PATH = resolve(__dirname, '../components/issue/IssueHero.tsx')`; read at describe scope (file already exists). Add the `codeOnly()` comment-stripping helper.

`describe('MOT-01: IssueHero word-span clip-path reveal', ...)`:
- `it('splits the charity name into word spans')`: `expect(source).toContain('.split(')` (the `charity.name.split(' ')` call)
- `it('applies a per-span animationDelay inline style')`: `expect(source).toContain('animationDelay')`
- `it('defines an @keyframes for the hero reveal')`: `expect(source).toMatch(/@keyframes\s+heroWordReveal/)`
- `it('never sets opacity:0 as a base inline style on a word span (only inside @keyframes)')`: This is the Pitfall-1 guard. Strip the `@keyframes ... { ... }` block from the source, then assert the REMAINDER does not contain `opacity: 0` as an inline style. Implement: `const withoutKeyframes = source.replace(/@keyframes[\s\S]*?\}\s*\}/g, '')`; then `expect(codeOnly(withoutKeyframes)).not.toContain('opacity: 0')` and `expect(codeOnly(withoutKeyframes)).not.toContain('opacity:0')`. (Pitfall 1: opacity:0/clip-path must live ONLY in @keyframes from{}.)
- `it('never sets clip-path as a base inline style on a word span (only inside @keyframes)')`: similarly assert `expect(codeOnly(withoutKeyframes)).not.toContain('clip-path: inset')` and `.not.toContain('clipPath:')`.
- `it('retains ≥2 eyebrow class usages (DES-04 inheritance)')`: `const matches = source.match(/["']eyebrow/g) ?? []`; `expect(matches.length).toBeGreaterThanOrEqual(2)`
- `it('does NOT add a use client directive (stays a Server Component)')`: `expect(source.trimStart().startsWith("'use client'")).toBe(false)` and `expect(source).not.toContain('useEffect')` and `expect(source).not.toContain('useState')`. (Anti-pattern guard from RESEARCH lines 323 + 137.)

**File B — `apps/web/__tests__/motion-polish.test.ts`** (MOT-02 + MOT-03). Same imports. Paths:
- `const GLOBALS_PATH = resolve(__dirname, '../app/globals.css')`
- `const DELIB_PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')`
- `const NAV_PATH = resolve(__dirname, '../components/issue/SectionNavigator.tsx')`
Read all three at describe scope (they all exist). Add `codeOnly()` helper.

`describe('MOT-02: SectionNavigator hover translate', ...)`:
- `it('globals.css .section-card:hover includes a translateY transform')`: isolate the `.section-card:hover {` rule body via regex `globalsSource.match(/\.section-card:hover\s*\{([\s\S]*?)\}/)` and assert the captured block contains `translateY`. (Confirmed not present yet — RESEARCH line 379. RED until Plan 04.)
- `it('SectionNavigator.tsx keeps the prefersReducedMotion early-return')`: `expect(navSource).toContain('prefers-reduced-motion')` AND `expect(navSource).toMatch(/if\s*\(\s*prefersReducedMotion\s*\)\s*return/)`. (Preserve existing line 100.)
- `it('SectionNavigator.tsx adds no new mousemove cursor-tracking under reduced-motion — early-return is before the listener')`: assert the source still contains `'(prefers-reduced-motion: reduce)'`.

`describe('MOT-03: DeliberationSlot count-up + pitch-card scroll-snap', ...)`:
- `it('DeliberationSlot.tsx uses IntersectionObserver for the count-up')`: `expect(delibSource).toContain('IntersectionObserver')` (RED until Plan 04).
- `it('DeliberationSlot.tsx uses setDisplayValue state for the animated value')`: `expect(delibSource).toContain('setDisplayValue')`.
- `it('reduced-motion branch sets the final value (not 0) — guards Pitfall 4')`: assert the source contains both `prefersReducedMotion` and a `setDisplayValue(target)` style final-value set. Implement: `expect(delibSource).toContain('prefersReducedMotion')` and `expect(delibSource).toMatch(/setDisplayValue\(\s*target\s*\)/)`.
- `it('DeliberationSlot.tsx exposes no model names after edits (DEL-04 inheritance)')`: `const code = codeOnly(delibSource)`; reuse the forbidden-string list from deliberation-no-model-names.test.ts: for each of `['modelVersions', 'run?.cost', 'run.cost', 'claude', 'gpt', 'sonnet', 'haiku', 'openrouter']` assert `expect(code.toLowerCase()).not.toContain(needle.toLowerCase())` (note: this duplicates the existing tripwire intentionally so MOT-03 has its own DEL-04 guard).
- `it('globals.css .pitch-card-list defines scroll-snap-type')`: isolate `.pitch-card-list` rule via regex and assert it contains `scroll-snap-type` (RED until Plan 04).
- `it('DeliberationSlot.tsx applies the pitch-card-list class to the pitch container')`: `expect(delibSource).toContain('pitch-card-list')`.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - Files `apps/web/__tests__/issue-hero-motion.test.ts` and `apps/web/__tests__/motion-polish.test.ts` both exist and are non-empty
    - `grep "heroWordReveal" apps/web/__tests__/issue-hero-motion.test.ts` matches
    - `grep "IntersectionObserver" apps/web/__tests__/motion-polish.test.ts` matches
    - `grep "scroll-snap-type" apps/web/__tests__/motion-polish.test.ts` matches
    - `grep "translateY" apps/web/__tests__/motion-polish.test.ts` matches
    - `grep "setDisplayValue" apps/web/__tests__/motion-polish.test.ts` matches
    - Running `pnpm --filter web test:unit` collects both files with NO import/collection errors
    - The MOT-01 eyebrow-count assertion currently PASSES against the un-edited IssueHero.tsx (5 usages); the translateY / IntersectionObserver / scroll-snap-type / pitch-card-list assertions are RED until Plan 04, and the word-span / animationDelay / @keyframes assertions are RED until Plan 03
  </acceptance_criteria>
  <done>Both files encode the MOT-01/MOT-02/MOT-03 assertions; Vitest collects them; new motion assertions are RED until Wave 2; all five existing tripwires remain green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` runs and collects all 23 test files (20 existing + 3 new) with no collection/import errors.
- The five existing tripwires (game-sandbox, theme-aa-tones, deliberation-no-model-names, issue-page-typography, site-header-nav) are still GREEN — Plan 01 does not touch any source file, only adds test files.
- New ARC-01/MOT-01/MOT-02/MOT-03 assertions that depend on yet-unwritten implementation are RED (expected — they go green in Wave 2).
</verification>

<success_criteria>
- 3 new test files exist in apps/web/__tests__/.
- All readFileSync-of-CardSwap.tsx assertions are inside it() callbacks (so collection does not throw before the file exists).
- package.json baseline dependency count is hardcoded from the live value.
- FONT_WHITELIST 6-entry assertion present.
- No watch-mode flags; command is `pnpm --filter web test:unit`.
</success_criteria>

<output>
After completion, create `.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-01-SUMMARY.md`
</output>
