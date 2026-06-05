import { describe, it, expect } from 'vitest'
import { shouldSendStep } from '@eisenbalm/emails'
import type { SendRowLike } from '@eisenbalm/emails'

describe('shouldSendStep (EMAIL-07 — idempotency gate)', () => {
  it('returns false when existing row has status "sent"', () => {
    const row: SendRowLike = { status: 'sent' }
    expect(shouldSendStep(row)).toBe(false)
  })

  it('returns true when existing row is undefined (first send attempt)', () => {
    expect(shouldSendStep(undefined)).toBe(true)
  })

  it('returns true when existing row is null', () => {
    expect(shouldSendStep(null)).toBe(true)
  })

  it('returns true when existing row has status "scheduled"', () => {
    const row: SendRowLike = { status: 'scheduled' }
    expect(shouldSendStep(row)).toBe(true)
  })

  it('returns true when existing row has status "failed" (allow retry)', () => {
    const row: SendRowLike = { status: 'failed' }
    expect(shouldSendStep(row)).toBe(true)
  })

  it('returns true when existing row has status "cancelled"', () => {
    const row: SendRowLike = { status: 'cancelled' }
    expect(shouldSendStep(row)).toBe(true)
  })

  it('returns true when existing row has status "skipped"', () => {
    const row: SendRowLike = { status: 'skipped' }
    expect(shouldSendStep(row)).toBe(true)
  })
})
