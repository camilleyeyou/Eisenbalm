/**
 * Stripe API version pin (RESEARCH Pitfall 6).
 *
 * Pinning prevents silent API contract drift when the SDK ships a new
 * major. To bump: update this constant in one place, run integration
 * tests + Stripe Dashboard sanity-check, then commit.
 *
 * Match the SDK major resolved in Plan 08-03 — stripe@^21.0.0 (resolved
 * 21.0.1). The matching default apiVersion for 21.x is '2025-04-30.basil'
 * (recorded in Plan 08-03 SUMMARY and cross-referenced here).
 */
import { getSiteUrl } from '@/lib/site'

export const STRIPE_API_VERSION = '2025-04-30.basil' as const
// NOTE: If Plan 08-03 SUMMARY recorded a different SDK major's default
// apiVersion, swap this string accordingly. The pin is what matters,
// not the specific value.

/** Stripe substitutes {CHECKOUT_SESSION_ID} at redirect time. */
export const SUCCESS_PATH = '/shop/thank-you?session_id={CHECKOUT_SESSION_ID}'
export const CANCEL_PATH = '/shop'

export function buildSuccessUrl(): string {
  return `${getSiteUrl()}${SUCCESS_PATH}`
}

export function buildCancelUrl(): string {
  return `${getSiteUrl()}${CANCEL_PATH}`
}
