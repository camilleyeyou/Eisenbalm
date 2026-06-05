/**
 * P17-03 + P17-07 source-scan tripwires — Phase 17 Wave 0.
 *
 * Asserts that ArchiveList.tsx has client-side load-more pagination (PAGE_SIZE,
 * visibleCount, hasMore, Load-more button, useEffect reset), and that the
 * apps/web dependency count has not grown beyond 17.
 *
 * The P17-03 assertions are intentionally RED on the current pre-implementation
 * codebase (ArchiveList has no PAGE_SIZE / visibleCount yet); they turn GREEN
 * when Wave 2 (Plan 17-03) adds load-more pagination to ArchiveList.
 *
 * The P17-07 dep-count guard is GREEN immediately (17 deps, no new dep added).
 * It mirrors archive-cardswap.test.ts line 159 exactly.
 *
 * Same pattern as archive-cardswap.test.ts (Phase 11): readFileSync, no DOM.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 17 P17-03.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ─── Paths ────────────────────────────────────────────────────────────────────

const ARCHIVE_LIST_PATH = resolve(__dirname, '../components/archive/ArchiveList.tsx')
const PKG_PATH          = resolve(__dirname, '../package.json')

// ─── P17-03: ArchiveList has load-more pagination ─────────────────────────────

describe('P17-03: ArchiveList has load-more pagination', () => {
  const src = readFileSync(ARCHIVE_LIST_PATH, 'utf-8')

  it('declares PAGE_SIZE constant', () => {
    expect(src).toContain('PAGE_SIZE')
  })

  it('tracks visibleCount state', () => {
    expect(src).toContain('visibleCount')
  })

  it('renders a load-more button when hasMore is true', () => {
    expect(src).toContain('hasMore')
    expect(src).toContain('Load')
  })

  it('load-more button has min-h-11 for touch target (≥44px)', () => {
    expect(src).toContain('min-h-11')
  })

  it('resets visibleCount on query/order change via useEffect', () => {
    expect(src).toContain('setVisibleCount')
    expect(src).toContain('useEffect')
  })
})

// ─── P17-07: no new npm dependency (dep count still 17) ───────────────────────

describe('P17-07: no new npm dep added (dependency count still 17)', () => {
  it('apps/web/package.json dependency count is unchanged at 17', () => {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8')) as {
      dependencies?: Record<string, string>
    }
    // Phase 11 baseline was 17. Phase 19 adds framer-motion (approved dep decision).
    // Phase 20 adds @eisenbalm/emails workspace dep (email lifecycle plan 20-01).
    // Updated to 19 to reflect Phase 20 addition.
    // Mirror of archive-cardswap.test.ts updated count.
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(19)
  })
})
