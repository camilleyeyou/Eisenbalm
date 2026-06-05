import { describe, it, expect } from 'vitest'
import { planEnqueue } from '@eisenbalm/emails'

describe('planEnqueue', () => {
  it('returns skip:true when customerEmail is absent', () => {
    const result = planEnqueue({})
    expect(result.skip).toBe(true)
  })

  it('returns skip:true when customerEmail is null', () => {
    const result = planEnqueue({ customerEmail: null })
    expect(result.skip).toBe(true)
  })

  it('returns skip:true when customerEmail is empty string', () => {
    const result = planEnqueue({ customerEmail: '' })
    expect(result.skip).toBe(true)
  })

  it('returns skip:false when customerEmail is set', () => {
    const result = planEnqueue({ customerEmail: 'a@b.c' })
    expect(result.skip).toBe(false)
  })

  it('always returns steps [1,2,3,4,5,6,7,8] when email absent', () => {
    const result = planEnqueue({})
    expect(result.steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('always returns steps [1,2,3,4,5,6,7,8] when email present', () => {
    const result = planEnqueue({ customerEmail: 'a@b.c' })
    expect(result.steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('returns exactly 8 steps', () => {
    expect(planEnqueue({}).steps.length).toBe(8)
    expect(planEnqueue({ customerEmail: 'a@b.c' }).steps.length).toBe(8)
  })
})
