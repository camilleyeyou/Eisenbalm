/**
 * P17-06 / D-7 source-scan tripwire — Phase 17 Wave 0, flipped in Phase 29.
 *
 * Phase 29 (D-7) removed the publicly-routable `/_debug/convex` smoke-test
 * page entirely (apps/web/app/%5Fdebug/convex/page.tsx no longer exists).
 * This test now asserts ABSENCE of the route file instead of scanning its
 * markup for a nested <main> — the original P17-06 concern (no nested <main>
 * landmark) is moot once the route is gone.
 *
 * Do not reintroduce apps/web/app/%5Fdebug/ or apps/web/app/_debug/ — see
 * .planning/phases/29-deployment-hardening-code-fixes/29-CONTEXT.md D-7.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ─── Paths ─────────────────────────────────────────────────────────────────────

// Note: literal %5F in the directory name (Next.js 15 private-folder escape).
// The route previously lived here; it must no longer exist on disk.
const DEBUG_PATH = resolve(__dirname, '../app/%5Fdebug/convex/page.tsx')
const DEBUG_DIR = resolve(__dirname, '../app/%5Fdebug')
const LITERAL_DEBUG_DIR = resolve(__dirname, '../app/_debug')

// ─── D-7: _debug/convex route removed ─────────────────────────────────────────

describe('D-7: the public /_debug/convex route no longer exists', () => {
  it('apps/web/app/%5Fdebug/convex/page.tsx does not exist', () => {
    expect(existsSync(DEBUG_PATH)).toBe(false)
  })

  it('apps/web/app/%5Fdebug/ directory does not exist', () => {
    expect(existsSync(DEBUG_DIR)).toBe(false)
  })

  it('apps/web/app/_debug/ (literal, non-escaped) directory does not exist', () => {
    expect(existsSync(LITERAL_DEBUG_DIR)).toBe(false)
  })
})
