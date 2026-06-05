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

/**
 * Cancel-on-unsubscribe decision helper.
 *
 * Returns true only when ALL of:
 *   1. The step is a marketing step (step >= 4) — transactional (1-3) are NEVER cancelled.
 *   2. The row is still 'scheduled' — already-sent, failed, cancelled, or skipped rows
 *      are left untouched (the send already happened or was already resolved).
 *
 * Called both by the pure unit tests (vitest node) and by the Convex
 * unsubscribeByToken mutation (which imports from @eisenbalm/emails).
 */
export function shouldCancelOnUnsubscribe(row: { step: number; status: string }): boolean {
  return isMarketingStep(row.step) && row.status === 'scheduled'
}
