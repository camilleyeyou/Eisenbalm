---
phase: 17-ui-ux-audit-follow-ups
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/__tests__/bonus-section-image.test.ts
  - apps/web/__tests__/archive-pagination.test.ts
  - apps/web/__tests__/loading-skeletons.test.ts
  - apps/web/__tests__/about-page.test.ts
  - apps/web/__tests__/debug-route.test.ts
autonomous: true
requirements: [P17-01, P17-03, P17-04, P17-05, P17-06, P17-07]
user_setup: []

must_haves:
  truths:
    - "Five new source-scan test files exist in apps/web/__tests__/ and are collected by vitest"
    - "Every assertion in the five files encodes a P17-* acceptance condition (next/image, load-more, 4 loading.tsx, no-placeholder, no-nested-main)"
    - "The five files FAIL on the current (pre-implementation) codebase — they are RED until Wave 2 lands the implementations"
    - "A dependency-count guard asserts apps/web/package.json dependencies length === 17 (no new dep)"
  artifacts:
    - path: "apps/web/__tests__/bonus-section-image.test.ts"
      provides: "P17-01 source-scan: next/image import, <Image fill, no raw <img, no eslint-disable, relative aspect-video, sizes="
      min_lines: 25
    - path: "apps/web/__tests__/archive-pagination.test.ts"
      provides: "P17-03 source-scan: PAGE_SIZE, visibleCount, hasMore+Load, min-h-11, useEffect reset; dep-count guard === 17"
      min_lines: 30
    - path: "apps/web/__tests__/loading-skeletons.test.ts"
      provides: "P17-04 existence check for 4 loading.tsx files + assertion none contain '<main'"
      min_lines: 20
    - path: "apps/web/__tests__/about-page.test.ts"
      provides: "P17-05 source-scan: no 'This page is being written' string + <article> wrapper present"
      min_lines: 12
    - path: "apps/web/__tests__/debug-route.test.ts"
      provides: "P17-06 source-scan: %5Fdebug/convex/page.tsx contains no '<main'"
      min_lines: 10
  key_links:
    - from: "apps/web/__tests__/archive-pagination.test.ts"
      to: "apps/web/package.json"
      via: "readFileSync + JSON.parse + Object.keys(dependencies).length === 17"
      pattern: "dependencies.*length.*17"
    - from: "apps/web/__tests__/loading-skeletons.test.ts"
      to: "apps/web/app/{issue/[slug],archive,charities,charities/[slug]}/loading.tsx"
      via: "existsSync per path"
      pattern: "existsSync"
---

<objective>
Author the five Wave 0 source-scan test files that encode every Phase 17 acceptance condition. These tests are RED on the current codebase and turn GREEN as the Wave 2 implementation plans (17-02..17-05) land. This is the Nyquist gate: no implementation task ships without a corresponding automated check authored here first.

Purpose: Lock the P17-01/03/04/05/06/07 contracts in executable form before any implementation, so executors implement against a fixed target and regressions are caught immediately.
Output: 5 new test files in apps/web/__tests__/ (~20-25 new assertions), bringing the suite from 234 to ~254-260 tests. The new files FAIL until Wave 2.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md
@.planning/phases/17-ui-ux-audit-follow-ups/17-VALIDATION.md

<interfaces>
<!-- Existing test pattern to replicate — all 26 existing files are pure source-scan (readFileSync + string assertions). -->
<!-- Canonical example: apps/web/__tests__/archive-cardswap.test.ts line 159 asserts dep count. Mirror its structure. -->

Source-scan test skeleton (Node fs + vitest, NO React render, NO jsdom):
```typescript
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const TARGET = resolve(__dirname, '../components/issue/BonusSection.tsx')
describe('P17-XX: ...', () => {
  const src = readFileSync(TARGET, 'utf-8')
  it('...', () => { expect(src).toContain('...') })
})
```

Confirmed file paths (relative to apps/web/__tests__/, use `resolve(__dirname, '../...')`):
- BonusSection:  ../components/issue/BonusSection.tsx
- ArchiveList:   ../components/archive/ArchiveList.tsx
- about page:    ../app/about/page.tsx
- debug page:    ../app/%5Fdebug/convex/page.tsx   (literal %5F in path — Phase 3 private-folder escape)
- package.json:  ../package.json
- loading.tsx targets (do NOT exist yet — Wave 2 creates them):
    ../app/issue/[slug]/loading.tsx
    ../app/archive/loading.tsx
    ../app/charities/loading.tsx
    ../app/charities/[slug]/loading.tsx
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author bonus-section-image.test.ts and debug-route.test.ts</name>
  <files>apps/web/__tests__/bonus-section-image.test.ts, apps/web/__tests__/debug-route.test.ts</files>
  <read_first>
    - apps/web/__tests__/archive-cardswap.test.ts (canonical source-scan pattern to replicate — readFileSync + toContain)
    - apps/web/components/issue/BonusSection.tsx (current state: raw <img> at ~L56, eslint-disable at L55, wrapper class at L53 lacks `relative`)
    - apps/web/app/%5Fdebug/convex/page.tsx (current state: <main className="mx-auto max-w-2xl px-6 py-12"> at L50, closing </main> at L72)
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Code Examples > "Source-scan tripwire — P17-01 bonus-section-image" — copy assertions)
  </read_first>
  <action>
    Create apps/web/__tests__/bonus-section-image.test.ts with target `resolve(__dirname, '../components/issue/BonusSection.tsx')`. Assert (P17-01):
      1. `src` contains `from 'next/image'`
      2. `src` contains `<Image`
      3. `src` contains `fill`
      4. After stripping block comments (`/\/\*[\s\S]*?\*\//g`) and line comments (`/(^|[^:])\/\/.*$/gm` → `'$1'`), the code does NOT contain `<img`
      5. `src` does NOT contain `@next/next/no-img-element`
      6. `src` contains `relative aspect-video`
      7. `src` contains `sizes=`
    Use the exact comment-stripping regex from 17-RESEARCH.md so JSX/line comments are ignored before the no-`<img` check.

    Create apps/web/__tests__/debug-route.test.ts with target `resolve(__dirname, '../app/%5Fdebug/convex/page.tsx')`. Assert (P17-06):
      1. `src` does NOT contain `<main` (the route page must use <div>, not nest a second <main> inside the root layout's <main id="main">)
    Add a sanity assertion that `src` contains `Convex smoke test` so the test is verifying the right file (guards against a path typo silently passing).

    Both files use `import { readFileSync } from 'node:fs'`, `import { resolve } from 'node:path'`, `import { describe, it, expect } from 'vitest'`. No jsdom, no render.
  </action>
  <acceptance_criteria>
    - `test -f apps/web/__tests__/bonus-section-image.test.ts` exits 0
    - `test -f apps/web/__tests__/debug-route.test.ts` exits 0
    - `grep -q "@next/next/no-img-element" apps/web/__tests__/bonus-section-image.test.ts` exits 0 (it asserts absence of that string)
    - `grep -q "relative aspect-video" apps/web/__tests__/bonus-section-image.test.ts` exits 0
    - `grep -q "'<main'" apps/web/__tests__/debug-route.test.ts || grep -q '"<main"' apps/web/__tests__/debug-route.test.ts` exits 0
    - `pnpm --filter web test:unit -- --run bonus-section-image debug-route` runs both files and reports FAILING assertions (RED — implementation not yet done; this proves the tests bite)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run bonus-section-image debug-route 2>&1 | grep -E "FAIL|failed" </automated>
  </verify>
  <done>Both test files exist, are collected by vitest, and currently FAIL against the unmodified BonusSection.tsx and %5Fdebug/convex/page.tsx (RED-first confirmed).</done>
</task>

<task type="auto">
  <name>Task 2: Author archive-pagination.test.ts, loading-skeletons.test.ts, about-page.test.ts</name>
  <files>apps/web/__tests__/archive-pagination.test.ts, apps/web/__tests__/loading-skeletons.test.ts, apps/web/__tests__/about-page.test.ts</files>
  <read_first>
    - apps/web/__tests__/archive-cardswap.test.ts (line ~159 — the dep-count assertion `Object.keys(pkg.dependencies).length === 17` to mirror)
    - apps/web/components/archive/ArchiveList.tsx (current state: 'use client', useMemo/useState, NO PAGE_SIZE/visibleCount/hasMore/useEffect yet)
    - apps/web/app/about/page.tsx (current state: <article> wrapper at L30, placeholder string "The Eisenbalm Dispatch publishes weekly. This page is being written." at L35)
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Code Examples > "Source-scan tripwire — P17-03 archive pagination" — copy assertions; Validation Architecture > Wave 0 Gaps)
  </read_first>
  <action>
    Create apps/web/__tests__/archive-pagination.test.ts. Target ArchiveList via `resolve(__dirname, '../components/archive/ArchiveList.tsx')`; target package.json via `resolve(__dirname, '../package.json')`. Assert (P17-03):
      1. ArchiveList src contains `PAGE_SIZE`
      2. ArchiveList src contains `visibleCount`
      3. ArchiveList src contains `hasMore` AND contains `Load`
      4. ArchiveList src contains `min-h-11` (touch-target on the load-more button)
      5. ArchiveList src contains `setVisibleCount` AND contains `useEffect` (the search/sort reset)
    In a second describe block, the dep-count guard (P17-07): `JSON.parse(readFileSync(pkgPath,'utf-8'))` then `expect(Object.keys(pkg.dependencies ?? {}).length).toBe(17)`.

    Create apps/web/__tests__/loading-skeletons.test.ts using `import { existsSync, readFileSync } from 'node:fs'`. Define the 4 target paths:
      ../app/issue/[slug]/loading.tsx, ../app/archive/loading.tsx, ../app/charities/loading.tsx, ../app/charities/[slug]/loading.tsx
    Assert (P17-04):
      1. For each of the 4 paths: `expect(existsSync(path)).toBe(true)` (iterate with it.each or a loop)
      2. For each of the 4 paths that exist: read the file and `expect(src).not.toContain('<main')` (single-main-landmark guard — guard the read with existsSync so a missing file produces the clear existence-failure RED signal, not a readFileSync throw)

    Create apps/web/__tests__/about-page.test.ts. Target `resolve(__dirname, '../app/about/page.tsx')`. Assert (P17-05):
      1. `src` does NOT contain `This page is being written`
      2. `src` contains `<article` (structural wrapper preserved)
  </action>
  <acceptance_criteria>
    - `test -f apps/web/__tests__/archive-pagination.test.ts && test -f apps/web/__tests__/loading-skeletons.test.ts && test -f apps/web/__tests__/about-page.test.ts` exits 0
    - `grep -q "toBe(17)" apps/web/__tests__/archive-pagination.test.ts` exits 0
    - `grep -q "existsSync" apps/web/__tests__/loading-skeletons.test.ts` exits 0
    - `grep -q "This page is being written" apps/web/__tests__/about-page.test.ts` exits 0 (asserts absence of that string)
    - `grep -c "loading.tsx" apps/web/__tests__/loading-skeletons.test.ts` returns >= 4
    - `pnpm --filter web test:unit -- --run archive-pagination loading-skeletons about-page` reports FAILING assertions for archive-pagination (no PAGE_SIZE yet), loading-skeletons (4 files missing), about-page (placeholder present) — RED-first confirmed; the dep-count guard PASSES (17 unchanged)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run archive-pagination loading-skeletons about-page 2>&1 | grep -E "FAIL|failed|passed"</automated>
  </verify>
  <done>Three test files exist, are collected by vitest, and FAIL on the unmodified codebase (PAGE_SIZE absent, 4 loading.tsx absent, "This page is being written" present); the dep-count guard already passes at 17.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` collects 31 test files (26 existing + 5 new) with no import/collection errors.
- The 5 new files contribute ~20-25 assertions, the majority RED (intended — Wave 2 turns them green).
- The pre-existing 234 tests remain GREEN (no existing file edited).
- Dep-count guard reports 17 (no dependency added).
</verification>

<success_criteria>
- 5 new test files exist in apps/web/__tests__/ encoding P17-01/03/04/05/06.
- Each new file is collected by vitest and its implementation-dependent assertions are RED against the current codebase.
- The dep-count guard and the existing 234-test baseline are GREEN.
</success_criteria>

<output>
After completion, create `.planning/phases/17-ui-ux-audit-follow-ups/17-01-SUMMARY.md`
</output>
