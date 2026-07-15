// Phase 44 Plan 44-04. Covers INS-03 — the redefined missing-inputs diff
// (docs/API_CONTRACTS.md §44.4/§44.5), the headline diagnostic.
import { describe, expect, it } from 'vitest'
import { computeMissingInputs } from '../lib/inspector/missingInputsDiff'
import { DECLARED_STATE_INPUTS } from '../lib/inspector/declaredStateInputs'

describe('missing-inputs diff (§44.4 — declared state inputs, redefined)', () => {
  it('missing = DECLARED_STATE_INPUTS[agentKey] − supplied keys', () => {
    const result = computeMissingInputs(
      'founder_bio',
      ['research', 'winning_charity', 'style_brief'],
      '{"research":{},"winning_charity":{},"style_brief":{}}',
    )
    expect(result.missing).toEqual([])
    expect(result.approximate).toBe(false)
  })

  it(
    'uses untruncated inputKeys when present — a supplied-but-truncated-away key is NEVER reported missing',
    () => {
      // inputKeys is exact and says winning_charity WAS supplied, even though
      // the (irrelevant, since inputKeys wins) snapshot below is truncated.
      const truncatedSnapshot = `{"research":"${'x'.repeat(2000)}` // deliberately malformed/truncated-looking
      const result = computeMissingInputs(
        'founder_bio',
        ['research', 'winning_charity', 'style_brief'],
        `${truncatedSnapshot}...[truncated]`,
      )
      expect(result.missing.find((m) => m.key === 'winning_charity')).toBeUndefined()
      expect(result.approximate).toBe(false)
    },
  )

  it('reports a genuinely absent declared key when inputKeys is present and exact', () => {
    const result = computeMissingInputs(
      'founder_bio',
      ['research', 'style_brief'],
      '{"research":{},"style_brief":{}}',
    )
    expect(result.missing.map((m) => m.key)).toContain('winning_charity')
    expect(result.approximate).toBe(false)
    // Every DECLARED_STATE_INPUTS entry for founder_bio should be accounted for.
    expect(DECLARED_STATE_INPUTS.founder_bio).toEqual(['research', 'winning_charity', 'style_brief'])
  })

  it(
    "falls back to parsing inputSnapshot when inputKeys absent AND emits an 'approximate — snapshot truncated' note",
    () => {
      const bigValue = 'a'.repeat(2100)
      const truncatedSnapshot = `{"research":"${bigValue}...[truncated]`
      const result = computeMissingInputs('founder_bio', undefined, truncatedSnapshot)
      expect(result.approximate).toBe(true)
      expect(result.note).toBe('snapshot was truncated — this diff is approximate')
    },
  )

  it(
    "a declared key absent from a >2000-char truncated snapshot (no inputKeys) renders 'not captured (truncated)', never definitive 'missing'",
    () => {
      // Build a >2000-char snapshot string ending in the truncation marker,
      // whose parseable prefix does not contain `winning_charity` (the JSON
      // is cut off mid-value, exactly like agent_wrapper.py's _truncate()).
      const bigValue = 'a'.repeat(2100)
      const truncatedSnapshot = `{"research":"${bigValue}...[truncated]`
      expect(truncatedSnapshot.length).toBeGreaterThan(2000)
      expect(truncatedSnapshot.endsWith('...[truncated]')).toBe(true)

      const result = computeMissingInputs('founder_bio', undefined, truncatedSnapshot)

      expect(result.approximate).toBe(true)
      const winningCharityEntry = result.missing.find((m) => m.key === 'winning_charity')
      expect(winningCharityEntry).toBeDefined()
      expect(winningCharityEntry?.truncated).toBe(true)

      // HARD RULE: no entry in `missing` claims a definitive (unflagged) miss
      // when the snapshot was truncated.
      for (const entry of result.missing) {
        expect(entry.truncated).toBe(true)
      }
    },
  )

  it('degrades honestly when DECLARED_STATE_INPUTS[agentKey] is empty/unknown', () => {
    expect(() => computeMissingInputs('unknown_agent', undefined, undefined)).not.toThrow()
    const result = computeMissingInputs('unknown_agent', undefined, undefined)
    expect(result.missing).toEqual([])
    expect(result.note).toBe('declared inputs not catalogued for this agent')
  })

  it('an untruncated (fully parseable) inputSnapshot with no truncation marker yields an exact, non-approximate diff', () => {
    const result = computeMissingInputs(
      'founder_bio',
      undefined,
      '{"research":{},"style_brief":{}}',
    )
    expect(result.approximate).toBe(false)
    expect(result.missing.map((m) => m.key)).toContain('winning_charity')
    expect(result.missing.every((m) => m.truncated === undefined)).toBe(true)
  })

  it('renders a human gloss from VARIABLE_DESCRIPTIONS when available, else an empty string', () => {
    const result = computeMissingInputs('founder_bio', ['research', 'style_brief'], undefined)
    const entry = result.missing.find((m) => m.key === 'winning_charity')
    expect(entry).toBeDefined()
    // winning_charity is a DispatchState field name, not a VARIABLE_DESCRIPTIONS
    // token — the gloss degrades to '' rather than throwing/undefined.
    expect(entry?.gloss).toBe('')
  })
})
