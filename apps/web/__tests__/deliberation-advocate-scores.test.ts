/**
 * DEL-02 — Advocate score extraction source-scan.
 *
 * Phase 9 original: Asserted that DeliberationSlot.tsx extracted advocate
 * scores directly from Convex deliberationEvents (eventType='advocate-argument'
 * payload JSON parsing).
 *
 * Phase 19 UPDATE (Plan 03): DeliberationSlot rewritten as dark-band centerpiece.
 * Advocate score extraction from Convex events is STAGE B (Plan 05) — in Stage A,
 * scores are passed as props from MOCK_ISSUE.selectionDeliberation.candidates[].
 * When Plan 05 wires live data, the score extraction logic moves to the data-prep
 * layer (page.tsx or a server component), not inline in DeliberationSlot.
 *
 * The negative assertions (must NOT read agentVotes.score) remain active.
 * The positive assertions for 'advocate-argument' event parsing are deferred
 * to Plan 05 Stage B which will reintroduce Convex data processing.
 *
 * The null-score fallback copy assertion is deferred to Plan 05 as well since
 * Stage A uses mock data where scores are numeric (no null case to render).
 *
 * Plan 05 restores this suite to fully active.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
const SCOREBOARD_PATH = resolve(__dirname, '../components/issue/DelibScoreboard.tsx')

describe('DEL-02: advocate score extraction (Phase 19 Stage A)', () => {
  it('does NOT read a .score property off agentVotes rows (no score field in schema)', () => {
    // agentVotes table has no score column — scores live in deliberationEvents payload.
    // This negative assertion guards against a future mistake of reading the wrong table.
    const source = readFileSync(PATH, 'utf-8')
    expect(source).not.toMatch(/votes?\.score\b/)
    expect(source).not.toMatch(/agentVote\.score\b/)
  })

  it('DelibScoreboard accepts score prop (numeric) for Stage A candidate display', () => {
    // Stage A: scores come from MOCK_ISSUE candidates array via prop drilling.
    // DelibScoreboard renders the score prop directly.
    const source = readFileSync(SCOREBOARD_PATH, 'utf-8')
    expect(source).toContain('score')
  })

  it.todo('keys score extraction on the "advocate-argument" event type (Plan 05 Stage B)')
  it.todo('JSON.parse is used for deliberationEvents payload (Plan 05 Stage B)')
  it.todo('renders null-score fallback copy when scores did not complete (Plan 05 Stage B)')
})
