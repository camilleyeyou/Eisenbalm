import { describe, it, expect } from 'vitest'
import { isGateInterrupt, summarizeInterrupt } from '../lib/gateInterrupt'

const repr =
  "Interrupt(value={'candidates': [{'charityName': 'Charity A', 'x': 1}, {'name': 'Charity B'}, {'charityName': 'Charity A'}]}, id='x')"

describe('isGateInterrupt', () => {
  it('detects the repr and the list form', () => {
    expect(isGateInterrupt({ agentKey: 'editor_gate_1', status: 'failed', error: repr })).toBe(true)
    expect(isGateInterrupt({ agentKey: 'editor_gate_1', status: 'failed', error: `[${repr}]` })).toBe(true)
  })
  it('ignores normal errors and non-failed rows', () => {
    expect(isGateInterrupt({ agentKey: 'qa', status: 'failed', error: 'KeyError: x' })).toBe(false)
    expect(isGateInterrupt({ agentKey: 'qa', status: 'done', error: repr })).toBe(false)
    expect(isGateInterrupt({ agentKey: 'qa', status: 'failed' })).toBe(false)
  })
})

describe('summarizeInterrupt', () => {
  it('extracts deduped candidate names', () => {
    expect(summarizeInterrupt(repr)).toEqual({ candidates: ['Charity A', 'Charity B'] })
  })
  it('returns empty for unparseable text and caps at 5', () => {
    expect(summarizeInterrupt('garbage')).toEqual({ candidates: [] })
    const many = Array.from({ length: 8 }, (_, i) => `{'name': 'C${i}'}`).join(',')
    expect(summarizeInterrupt(`Interrupt(value=[${many}])`).candidates).toHaveLength(5)
  })
})
