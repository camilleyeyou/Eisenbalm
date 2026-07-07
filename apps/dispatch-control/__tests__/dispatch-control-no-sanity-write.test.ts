/**
 * EDT-05 source-scan tripwire.
 *
 * Phase 31 locks the write boundary: dashboard -> pipeline API -> Sanity for
 * every content mutation (PROJECT.md "Write boundary" decision). This test
 * asserts apps/dispatch-control has ZERO direct Sanity write paths — no
 * @sanity/client import, no bare `from 'sanity'`, no createClient() call, and
 * no *.api.sanity.io references anywhere in app/, components/, or lib/.
 *
 * Mirrors apps/dispatch-control/__tests__/apps-web-no-clerk.test.ts (recursive
 * source-scan pattern) and apps/web/__tests__/stripe-webhook-source.test.ts
 * (FORBIDDEN regex-array pattern).
 *
 * Baseline (2026-07-07): apps/dispatch-control/package.json has ZERO
 * @sanity/* dependency entries and zero source hits — this test PASSES
 * immediately on the current tree and stays green as long as no future
 * change reintroduces a direct Sanity write path.
 *
 * If this test fails, DO NOT delete it or weaken the assertions. Route the
 * write through the pipeline API's content-patch endpoints (docs/API_CONTRACTS.md
 * §31) instead.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

const FORBIDDEN_IMPORTS: RegExp[] = [
  /@sanity\/client/,
  /from ['"]sanity['"]/,
  /createClient\s*\(/,
  /\.api\.sanity\.io/,
]

const APP_ROOT = path.resolve(__dirname, '..')
const SEARCH_DIRS = ['app', 'components', 'lib'].map(d => path.join(APP_ROOT, d))

interface Violation {
  file: string
  pattern: string
}

function collectViolations(dir: string, violations: Violation[]): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectViolations(fullPath, violations)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (ext !== '.ts' && ext !== '.tsx') continue
      const content = fs.readFileSync(fullPath, 'utf-8')
      for (const pattern of FORBIDDEN_IMPORTS) {
        if (pattern.test(content)) {
          violations.push({ file: fullPath, pattern: pattern.toString() })
        }
      }
    }
  }
}

describe('EDT-05: dispatch-control has zero direct Sanity write paths', () => {
  it('app/, components/, and lib/ contain zero FORBIDDEN Sanity-client patterns', () => {
    const violations: Violation[] = []
    for (const dir of SEARCH_DIRS) {
      collectViolations(dir, violations)
    }

    if (violations.length > 0) {
      throw new Error(
        'FORBIDDEN direct-Sanity-write pattern found (EDT-05 violation):\n' +
          violations.map(v => `  ${v.file} matches ${v.pattern}`).join('\n'),
      )
    }
  })

  it('package.json declares zero @sanity/* dependencies', () => {
    const pkgPath = path.join(APP_ROOT, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    const sanityDeps = Object.keys(deps).filter(name => name.startsWith('@sanity/'))
    expect(sanityDeps).toEqual([])
  })
})
