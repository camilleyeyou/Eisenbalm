/**
 * Phase 23 — OBS-04: costRollup unit tests.
 * Pure-node: no convex-test, no edge-runtime.
 */
import { describe, it, expect } from 'vitest'
import { parseCostJson, sumRunsCost } from '../lib/costRollup'

describe('parseCostJson', () => {
  it('parses a valid cost JSON string', () => {
    const raw = '{"total":0.08,"agents":{"scout":{"usd":0.02,"tokens_in":1000,"tokens_out":500,"duration_ms":2000}}}'
    const result = parseCostJson(raw)
    expect(result.total).toBe(0.08)
    expect(result.agents.scout.usd).toBe(0.02)
    expect(result.agents.scout.tokens_in).toBe(1000)
  })

  it('returns zero payload for undefined', () => {
    const result = parseCostJson(undefined)
    expect(result.total).toBe(0)
    expect(result.agents).toEqual({})
  })

  it('returns zero payload for null', () => {
    const result = parseCostJson(null)
    expect(result.total).toBe(0)
    expect(result.agents).toEqual({})
  })

  it('returns zero payload for empty string', () => {
    const result = parseCostJson('')
    expect(result.total).toBe(0)
    expect(result.agents).toEqual({})
  })

  it('returns zero payload for invalid JSON', () => {
    const result = parseCostJson('{not valid json}')
    expect(result.total).toBe(0)
    expect(result.agents).toEqual({})
  })

  it('handles missing total field gracefully', () => {
    const raw = '{"agents":{"scout":{"usd":0.02}}}'
    const result = parseCostJson(raw)
    expect(result.total).toBe(0)
    expect(result.agents.scout.usd).toBe(0.02)
  })

  it('handles missing agents field gracefully', () => {
    const raw = '{"total":0.05}'
    const result = parseCostJson(raw)
    expect(result.total).toBe(0.05)
    expect(result.agents).toEqual({})
  })
})

describe('sumRunsCost', () => {
  it('sums total costs across multiple runs', () => {
    const runs = [
      { cost: '{"total":0.08,"agents":{}}' },
      { cost: '{"total":0.02,"agents":{}}' },
    ]
    const result = sumRunsCost(runs)
    expect(result).toBeCloseTo(0.10, 5)
  })

  it('returns 0 for empty array', () => {
    expect(sumRunsCost([])).toBe(0)
  })

  it('treats null cost as 0', () => {
    const runs = [{ cost: null }, { cost: '{"total":0.03,"agents":{}}' }]
    const result = sumRunsCost(runs)
    expect(result).toBeCloseTo(0.03, 5)
  })

  it('treats undefined cost as 0', () => {
    const runs = [{ cost: undefined }, { cost: '{"total":0.05,"agents":{}}' }]
    const result = sumRunsCost(runs)
    expect(result).toBeCloseTo(0.05, 5)
  })

  it('treats invalid JSON cost as 0', () => {
    const runs = [{ cost: 'bad json' }, { cost: '{"total":0.01,"agents":{}}' }]
    const result = sumRunsCost(runs)
    expect(result).toBeCloseTo(0.01, 5)
  })

  it('sums multiple runs with agent breakdown', () => {
    const runs = [
      { cost: '{"total":0.021,"agents":{"scout":{"usd":0.021}}}' },
      { cost: '{"total":0.003,"agents":{"calibrator":{"usd":0.003}}}' },
      { cost: '{"total":0.058,"agents":{"researcher":{"usd":0.058}}}' },
    ]
    const result = sumRunsCost(runs)
    expect(result).toBeCloseTo(0.082, 5)
  })
})
