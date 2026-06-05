import { describe, it, expect } from 'vitest'
import { shouldSuppressStep } from '@eisenbalm/emails'
import type { SubscriberLike } from '@eisenbalm/emails'

describe('shouldSuppressStep (EMAIL-02)', () => {
  it('transactional step 1 is never suppressed even when unsubscribed', () => {
    const sub: SubscriberLike = { consentState: 'unsubscribed' }
    expect(shouldSuppressStep(1, sub)).toBe(false)
  })

  it('transactional step 2 is never suppressed even when unsubscribed', () => {
    const sub: SubscriberLike = { consentState: 'unsubscribed' }
    expect(shouldSuppressStep(2, sub)).toBe(false)
  })

  it('transactional step 3 is never suppressed even when unsubscribed', () => {
    const sub: SubscriberLike = { consentState: 'unsubscribed' }
    expect(shouldSuppressStep(3, sub)).toBe(false)
  })

  it('marketing step 4 IS suppressed when consentState is unsubscribed', () => {
    const sub: SubscriberLike = { consentState: 'unsubscribed' }
    expect(shouldSuppressStep(4, sub)).toBe(true)
  })

  it('marketing step 8 IS suppressed when consentState is unsubscribed', () => {
    const sub: SubscriberLike = { consentState: 'unsubscribed' }
    expect(shouldSuppressStep(8, sub)).toBe(true)
  })

  it('marketing step 4 is NOT suppressed when consentState is subscribed', () => {
    const sub: SubscriberLike = { consentState: 'subscribed' }
    expect(shouldSuppressStep(4, sub)).toBe(false)
  })

  it('marketing step 4 is NOT suppressed when subscriber is null (no row yet)', () => {
    expect(shouldSuppressStep(4, null)).toBe(false)
  })

  it('marketing step 4 is NOT suppressed when subscriber is undefined', () => {
    expect(shouldSuppressStep(4, undefined)).toBe(false)
  })
})
