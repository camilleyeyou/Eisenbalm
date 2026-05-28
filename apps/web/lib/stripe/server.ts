/**
 * Stripe server SDK singleton.
 *
 * - Lazy: initialized on first call so env vars resolve at runtime,
 *   not at module load. This keeps Vitest happy when STRIPE_SECRET_KEY
 *   is set per-test.
 * - Singleton: cached on a module-level variable so we don't pay
 *   construction cost or break Stripe SDK's internal connection pool.
 * - apiVersion pinned via STRIPE_API_VERSION constant (Pitfall 6).
 *
 * Throws when STRIPE_SECRET_KEY is missing. The webhook + checkout
 * route handlers each map this to a 500 response so misconfiguration
 * is loud, not silent.
 */
import Stripe from 'stripe'
import { STRIPE_API_VERSION } from './constants'

let _stripe: Stripe | null = null

export function getStripeServer(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Plan 08-02 (Andrew checkpoint) provisions this.',
    )
  }
  _stripe = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
    typescript: true,
  })
  return _stripe
}

/**
 * Test-only helper: clear the cached client so a test can install a fresh
 * mock or env value between cases.
 *
 * NOT exported in production builds — tests import via path alias and
 * vitest doesn't run a separate production bundle, so calling this in
 * tests is fine. Do NOT call from runtime code.
 */
export function _resetStripeServerForTests(): void {
  _stripe = null
}
