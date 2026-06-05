import { describe, it, expect } from 'vitest'
import {
  OFFSETS_MS,
  STEP_STREAM,
  isMarketingStep,
  offsetForStep,
} from '@eisenbalm/emails'
import { SUBJECTS } from '@eisenbalm/emails'

const DAY_MS = 24 * 3600_000

describe('OFFSETS_MS (EMAIL-01)', () => {
  it('has exactly 8 entries', () => {
    expect(OFFSETS_MS.length).toBe(8)
  })

  it('E1 +0d: OFFSETS_MS[0] === 0', () => {
    expect(OFFSETS_MS[0]).toBe(0)
  })

  it('E2 +1d: OFFSETS_MS[1] === 1 * DAY_MS', () => {
    expect(OFFSETS_MS[1]).toBe(1 * DAY_MS)
  })

  it('E3 +4d: OFFSETS_MS[2] === 4 * DAY_MS', () => {
    expect(OFFSETS_MS[2]).toBe(4 * DAY_MS)
  })

  it('E4 +7d: OFFSETS_MS[3] === 7 * DAY_MS', () => {
    expect(OFFSETS_MS[3]).toBe(7 * DAY_MS)
  })

  it('E5 +9d: OFFSETS_MS[4] === 9 * DAY_MS', () => {
    expect(OFFSETS_MS[4]).toBe(9 * DAY_MS)
  })

  it('E6 +14d: OFFSETS_MS[5] === 14 * DAY_MS', () => {
    expect(OFFSETS_MS[5]).toBe(14 * DAY_MS)
  })

  it('E7 +21d: OFFSETS_MS[6] === 21 * DAY_MS', () => {
    expect(OFFSETS_MS[6]).toBe(21 * DAY_MS)
  })

  it('E8 +42d: OFFSETS_MS[7] === 42 * DAY_MS', () => {
    expect(OFFSETS_MS[7]).toBe(42 * DAY_MS)
  })
})

describe('STEP_STREAM (EMAIL-01)', () => {
  it('steps 1-3 are transactional', () => {
    expect(STEP_STREAM[1]).toBe('transactional')
    expect(STEP_STREAM[2]).toBe('transactional')
    expect(STEP_STREAM[3]).toBe('transactional')
  })

  it('steps 4-8 are marketing', () => {
    expect(STEP_STREAM[4]).toBe('marketing')
    expect(STEP_STREAM[5]).toBe('marketing')
    expect(STEP_STREAM[6]).toBe('marketing')
    expect(STEP_STREAM[7]).toBe('marketing')
    expect(STEP_STREAM[8]).toBe('marketing')
  })
})

describe('isMarketingStep (EMAIL-01)', () => {
  it('step 1 is NOT marketing', () => {
    expect(isMarketingStep(1)).toBe(false)
  })

  it('step 2 is NOT marketing', () => {
    expect(isMarketingStep(2)).toBe(false)
  })

  it('step 3 is NOT marketing', () => {
    expect(isMarketingStep(3)).toBe(false)
  })

  it('step 4 IS marketing', () => {
    expect(isMarketingStep(4)).toBe(true)
  })

  it('step 8 IS marketing', () => {
    expect(isMarketingStep(8)).toBe(true)
  })
})

describe('offsetForStep (EMAIL-01)', () => {
  it('step 1 returns 0', () => {
    expect(offsetForStep(1)).toBe(0)
  })

  it('step 8 returns 42 * DAY_MS', () => {
    expect(offsetForStep(8)).toBe(42 * DAY_MS)
  })
})

describe('SUBJECTS (EMAIL-01)', () => {
  it('has entries for all 8 steps', () => {
    for (let step = 1; step <= 8; step++) {
      expect(typeof SUBJECTS[step]).toBe('string')
      expect(SUBJECTS[step]!.length).toBeGreaterThan(0)
    }
  })

  it('SUBJECTS[3] does NOT contain "arrived" or "delivered" (delivery-estimate-safe)', () => {
    const subject3 = SUBJECTS[3] ?? ''
    expect(subject3).not.toMatch(/arrived|delivered/i)
  })
})
