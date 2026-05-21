/**
 * DEL-02 — Advocate score extraction source-scan.
 *
 * UNSKIP in Plan 09-02 when DeliberationSlot.tsx gets its Phase 9 implementation.
 * The describe.skip keeps this suite green at scaffold time.
 *
 * Asserted behaviors (against DeliberationSlot.tsx source):
 *   DEL-02: Scores come from deliberationEvents payload (eventType 'advocate-argument'),
 *           NOT from agentVotes (which has no score field per convex/schema.ts).
 *   DEL-02: payload is JSON-parsed (v.string() in schema; runtime JSON.parse required).
 *   DEL-02: Null-score fallback copy renders "Scores did not complete this cycle."
 *
 * readFileSync is INSIDE the describe.skip callback so collection never
 * throws against the current Phase 2 stub which lacks these patterns.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

// UNSKIP in Plan 09-02
describe.skip('DEL-02: advocate score extraction', () => {
  const source = readFileSync(PATH, 'utf-8')

  it('keys score extraction on the "advocate-argument" event type', () => {
    expect(source).toContain("'advocate-argument'")
  })

  it('JSON.parse is used (payload field is a JSON string per schema)', () => {
    expect(source).toContain('JSON.parse')
  })

  it('renders null-score fallback copy when scores did not complete', () => {
    expect(source).toContain('Scores did not complete this cycle.')
  })

  it('does NOT read a .score property off agentVotes rows (no score field in schema)', () => {
    // agentVotes table has no score column — scores live in deliberationEvents payload.
    // These negative assertions guard against a future mistake of reading the wrong table.
    expect(source).not.toMatch(/votes?\.score\b/)
    expect(source).not.toMatch(/agentVote\.score\b/)
  })
})
