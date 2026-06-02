/**
 * P17-06 source-scan tripwire — Phase 17 Wave 0.
 *
 * Asserts that apps/web/app/%5Fdebug/convex/page.tsx does NOT nest a <main>
 * element inside the root layout's <main id="main">. The route currently uses
 * <main> (line 50), violating the single-main-landmark rule. This test is
 * intentionally RED on the current pre-implementation codebase; it turns GREEN
 * when Wave 2 (Plan 17-05) applies the one-line <main> → <div> fix.
 *
 * The %5Fdebug path is a Next.js 15 private-folder escape: the folder on disk
 * is literally named %5Fdebug (not _debug) so the route IS accessible at
 * /_debug/convex but is not treated as a Next.js private directory.
 *
 * Same pattern as archive-cardswap.test.ts (Phase 11): readFileSync, no DOM.
 *
 * If any assertion fails, DO NOT delete it or weaken it. Fix the source instead.
 * This file IS the codebase-level guard for Phase 17 P17-06.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ─── Path ─────────────────────────────────────────────────────────────────────

// Note: literal %5F in the directory name (Next.js 15 private-folder escape).
// See Phase 3 decision: the %5F prefix makes /_debug/convex accessible while
// avoiding Next.js private-folder exclusion.
const DEBUG_PATH = resolve(__dirname, '../app/%5Fdebug/convex/page.tsx')

// ─── P17-06: _debug/convex page must not nest a <main> element ────────────────

describe('P17-06: _debug/convex page has no nested <main> landmark', () => {
  const src = readFileSync(DEBUG_PATH, 'utf-8')

  it('file exists and is the correct Convex smoke-test page', () => {
    // Sanity guard: ensure we are reading the right file and not an empty stub
    expect(src).toContain('Convex smoke test')
  })

  it('page does not nest a <main> element (root layout owns the single <main>)', () => {
    // The root layout at apps/web/app/layout.tsx owns <main id="main">.
    // Route-level components (page.tsx, loading.tsx, error.tsx) must use
    // <div> or semantic sectioning elements — never <main>.
    expect(src).not.toContain('<main')
  })
})
