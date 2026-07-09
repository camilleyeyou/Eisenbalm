/**
 * Phase 37 (MON-03, Plan 37-04 Task 1) — strengthScore lib behavior tests.
 *
 * Runs in the default `node` vitest environment (pure logic, no DOM).
 */
import { describe, it, expect } from 'vitest'
import {
  strengthScore,
  flagCounts,
  bandFor,
  PENALTY,
  type QaFindingRow,
} from '../lib/runMonitor/strengthScore'

function row(
  severity: QaFindingRow['severity'],
  overrides: Partial<QaFindingRow> = {},
): QaFindingRow {
  return { severity, ...overrides }
}

describe('strengthScore', () => {
  it('returns 100 for no findings', () => {
    expect(strengthScore([])).toBe(100)
  })

  it('subtracts the error penalty for one open error', () => {
    expect(strengthScore([row('error')])).toBe(100 - PENALTY.error) // 75
  })

  it('subtracts the warning penalty for one open warning', () => {
    expect(strengthScore([row('warning')])).toBe(100 - PENALTY.warning) // 92
  })

  it('subtracts the info penalty for one open info', () => {
    expect(strengthScore([row('info')])).toBe(100 - PENALTY.info) // 98
  })

  it('floors at 0 and never goes negative (5 open errors)', () => {
    expect(strengthScore([row('error'), row('error'), row('error'), row('error'), row('error')])).toBe(0)
  })

  it('excludes a CLOSED finding via accepted:true', () => {
    expect(strengthScore([row('error', { accepted: true })])).toBe(100)
  })

  it('excludes a CLOSED finding via resolution:"dismissed"', () => {
    expect(strengthScore([row('error', { resolution: 'dismissed' })])).toBe(100)
  })

  it('mixes open and closed findings correctly', () => {
    const rows = [
      row('error'), // open, -25
      row('warning', { accepted: true }), // closed, ignored
      row('info', { resolution: 'accepted' }), // closed, ignored
      row('warning'), // open, -8
    ]
    expect(strengthScore(rows)).toBe(100 - PENALTY.error - PENALTY.warning) // 67
  })
})

describe('flagCounts', () => {
  it('returns all-zero counts for no findings', () => {
    expect(flagCounts([])).toEqual({ info: 0, warning: 0, error: 0 })
  })

  it('counts only OPEN findings by severity', () => {
    const rows = [
      row('error'),
      row('error', { accepted: true }), // closed, excluded
      row('warning'),
      row('warning'),
      row('info', { resolution: 'dismissed' }), // closed, excluded
    ]
    expect(flagCounts(rows)).toEqual({ info: 0, warning: 2, error: 1 })
  })
})

describe('bandFor', () => {
  it('is green for scores >= 80', () => {
    expect(bandFor(100)).toBe('green')
    expect(bandFor(80)).toBe('green')
  })

  it('is amber for scores 50-79', () => {
    expect(bandFor(79)).toBe('amber')
    expect(bandFor(50)).toBe('amber')
  })

  it('is red for scores < 50', () => {
    expect(bandFor(49)).toBe('red')
    expect(bandFor(0)).toBe('red')
  })
})
