/** Shared Stripe Checkout starter used by BuyButton (/shop) and FundButton (front page). */

/** Dry, on-voice checkout-failure message. No exclamation, no pop-up ornament. */
export const CHECKOUT_FAILURE_MESSAGE = 'Checkout is unavailable right now. Try again in a moment.'

export async function startCheckout(quantity: number = 1): Promise<{ ok: true } | { ok: false }> {
  try {
    const res = await fetch('/api/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    })
    const body = (await res.json()) as { url?: string; error?: string }
    if (body.url) {
      window.location.href = body.url
      return { ok: true }
    }
    return { ok: false }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[checkout] failed:', err)
    return { ok: false }
  }
}
