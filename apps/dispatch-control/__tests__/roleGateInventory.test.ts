/**
 * ROL-02 source-scan tripwire (SC-2 proof).
 *
 * Phase 49 gates EXACTLY six actions to Editor-in-chief (docs/API_CONTRACTS.md
 * §49.4): three FastAPI routes via `Depends(_require_editor)` (revision.py,
 * factcheck.py, review.py), one FastAPI in-handler branch (signoffs.py,
 * kind=="sounds-human" only — NOT a route Depends swap, since that route also
 * handles kind=="facts-cleared", which stays ungated), and two Convex
 * mutations via `requireEditor(ctx)` (promptVersions.ts activate, charities.ts
 * setStatus). This test asserts the gate call sites land in EXACTLY those six
 * places — no more, no fewer — by scanning the source tree directly (no
 * server or Convex deployment needed).
 *
 * Mirrors apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts
 * (recursive fs source-scan pattern).
 *
 * If this test fails because a future change gates a 7th action or ungates
 * one of the six, DO NOT weaken the assertions — fix the gate placement to
 * match docs/API_CONTRACTS.md §49.4 (or update §49.4 first, contract-first,
 * per CLAUDE.md).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const PIPELINE_API_DIR = path.join(
  REPO_ROOT,
  'packages/pipeline/src/eisenbalm_pipeline/api',
)
const CONVEX_DIR = path.join(REPO_ROOT, 'convex')

const EXPECTED_FASTAPI_EDITOR_FILES = ['factcheck.py', 'review.py', 'revision.py'].sort()
const EXPECTED_CONVEX_EDITOR_FILES = ['charities.ts', 'promptVersions.ts'].sort()

const FASTAPI_EDITOR_PATTERN = /Depends\(_require_editor\)/
const CONVEX_EDITOR_PATTERN = /requireEditor\(ctx\)/
const SOUNDS_HUMAN_PATTERN = /kind\s*==\s*["']sounds-human["']/

function listFiles(dir: string, ext: string, excludeDirNames: string[] = []): string[] {
  if (!fs.existsSync(dir)) return []
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludeDirNames.includes(entry.name)) continue
      results.push(...listFiles(path.join(dir, entry.name), ext, excludeDirNames))
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(path.join(dir, entry.name))
    }
  }
  return results
}

describe('ROL-02: exactly six actions are role-gated (source-scan tripwire)', () => {
  it('FastAPI: Depends(_require_editor) appears in EXACTLY revision.py, factcheck.py, review.py — and no other api/*.py file', () => {
    const apiFiles = listFiles(PIPELINE_API_DIR, '.py', ['__pycache__'])
    expect(apiFiles.length).toBeGreaterThan(0) // sanity: directory scan actually found files

    const matching = apiFiles.filter(f =>
      FASTAPI_EDITOR_PATTERN.test(fs.readFileSync(f, 'utf-8')),
    )
    const matchingNames = matching.map(f => path.basename(f)).sort()

    expect(matching.length).toBe(3)
    expect(matchingNames).toEqual(EXPECTED_FASTAPI_EDITOR_FILES)
  })

  it('FastAPI: signoffs.py gates sounds-human in-handler, NOT via a route Depends(_require_editor) swap', () => {
    const signoffsPath = path.join(PIPELINE_API_DIR, 'signoffs.py')
    expect(fs.existsSync(signoffsPath)).toBe(true)
    const content = fs.readFileSync(signoffsPath, 'utf-8')

    expect(SOUNDS_HUMAN_PATTERN.test(content)).toBe(true)
    expect(FASTAPI_EDITOR_PATTERN.test(content)).toBe(false)
  })

  it('Convex: requireEditor(ctx) call sites appear in EXACTLY promptVersions.ts and charities.ts — excluding the lib/auth.ts definition', () => {
    const authDefinitionPath = path.join(CONVEX_DIR, 'lib', 'auth.ts')
    const convexFiles = listFiles(CONVEX_DIR, '.ts', ['_generated', 'node_modules']).filter(
      f => f !== authDefinitionPath,
    )
    expect(convexFiles.length).toBeGreaterThan(0) // sanity: directory scan actually found files

    const matching = convexFiles.filter(f =>
      CONVEX_EDITOR_PATTERN.test(fs.readFileSync(f, 'utf-8')),
    )
    const matchingNames = matching.map(f => path.basename(f)).sort()

    expect(matching.length).toBe(2)
    expect(matchingNames).toEqual(EXPECTED_CONVEX_EDITOR_FILES)
  })

  it('Convex: lib/auth.ts DEFINES requireEditor (the helper both call sites import)', () => {
    const authDefinitionPath = path.join(CONVEX_DIR, 'lib', 'auth.ts')
    expect(fs.existsSync(authDefinitionPath)).toBe(true)
    const content = fs.readFileSync(authDefinitionPath, 'utf-8')

    expect(/export\s+async\s+function\s+requireEditor/.test(content)).toBe(true)
  })
})
