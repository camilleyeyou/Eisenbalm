/**
 * DEL-06 (chip side) — Agent identity card links source-scan.
 *
 * UNSKIP in Plan 09-02 when DeliberationSlot.tsx gets its Phase 9 implementation
 * including agent identity chips that link to /agents/[agentId].
 * The describe.skip keeps this suite green at scaffold time.
 *
 * Asserted behaviors (against DeliberationSlot.tsx source):
 *   DEL-06: href construction points to /agents/[agentId].
 *   DEL-06: displayName and role from agent profile are rendered.
 *   DEL-06: No model-name literal leaks through the chip render path.
 *
 * readFileSync is INSIDE the describe.skip callback so collection never
 * throws against the current Phase 2 stub which lacks these patterns.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

describe('DEL-06: agent identity card links', () => {
  const source = readFileSync(PATH, 'utf-8')

  it('constructs the agent-profile href with /agents/ path segment', () => {
    expect(source).toMatch(/\/agents\//)
  })

  it('uses agentId in the href construction', () => {
    expect(source).toContain('agentId')
  })

  it('renders the displayName from the agent profile', () => {
    expect(source).toContain('displayName')
  })

  it('renders the role from the agent profile', () => {
    expect(source).toContain('role')
  })

  it('does not expose modelVersions in the chip render path (DEL-04 extension)', () => {
    expect(source).not.toContain('modelVersions')
  })

  it('contains no model-name literals in the chip render path', () => {
    // Strip comments first to avoid documentation prose tripping the assertion.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    const code = codeOnly.toLowerCase()
    for (const modelName of ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter']) {
      expect(code).not.toContain(modelName)
    }
  })
})
