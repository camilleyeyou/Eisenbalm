import { isMarketingStep } from './offsets'

export type SubscriberLike = { consentState: 'subscribed' | 'unsubscribed' } | null | undefined

/** Marketing steps (4-8) are suppressed when the subscriber is unsubscribed. Transactional (1-3) never suppressed. */
export function shouldSuppressStep(step: number, subscriber: SubscriberLike): boolean {
  if (!isMarketingStep(step)) return false
  return subscriber?.consentState === 'unsubscribed'
}

/** Idempotency gate: a step may send only if no prior row is already 'sent'. */
export type SendRowLike = { status: 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'skipped' } | null | undefined

export function shouldSendStep(existing: SendRowLike): boolean {
  return existing?.status !== 'sent'
}
