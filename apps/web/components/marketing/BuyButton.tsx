'use client'

/**
 * BuyButton — initiates Stripe Checkout for the Eisenbalm lip balm.
 *
 * Flow:
 *   1. User clicks
 *   2. fetch('/api/checkout/create-session', { method: 'POST', body: JSON.stringify({ quantity }) })
 *   3. Server returns { url }
 *   4. window.location.href = url (redirects to Stripe-hosted Checkout)
 *
 * Loading state: text changes to "Redirecting…" and button disables.
 * Error path (Phase 29 D-9): a dry, on-voice inline message renders below the
 * button and it re-enables so the reader can retry. No pop-up ornament
 * (banner/modal/notification widget) per CLAUDE.md voice rules.
 *
 * quantity prop: if provided, uses that value; otherwise reads from
 * ShopQtyProvider context via useShopQty(). BuyButton is only ever rendered
 * inside <ShopQtyProvider> (the /shop page wraps its whole interactive
 * subtree), matching ShopStickyBar's static-import usage of the same hook.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useShopQty } from '@/components/marketing/ShopQtyProvider'

/** Dry, on-voice checkout-failure message. No exclamation, no pop-up ornament. */
export const CHECKOUT_FAILURE_MESSAGE = 'Checkout is unavailable right now. Try again in a moment.'

interface BuyButtonProps {
  /** Explicit quantity to pass to checkout. If omitted, reads from ShopQtyProvider context. */
  quantity?: number
  /** Button label. Defaults to "Buy the lip balm". */
  label?: string
  /** Additional className for the Button element. */
  className?: string
}

export function BuyButton({ quantity: quantityProp, label, className }: BuyButtonProps = {}) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { quantity: contextQty } = useShopQty()
  const quantity = quantityProp ?? contextQty

  async function onClick() {
    if (loading) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })
      const body = (await res.json()) as { url?: string; error?: string }
      if (body.url) {
        window.location.href = body.url
        return
      }
      throw new Error(body.error ?? 'Checkout failed')
    } catch (err) {
      // No pop-up ornament per voice rules — a dry inline message near the
      // button, and re-enable so the reader can retry.
      // eslint-disable-next-line no-console
      console.error('[BuyButton] checkout failed:', err)
      setErrorMessage(CHECKOUT_FAILURE_MESSAGE)
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        size="lg"
        disabled={loading}
        onClick={onClick}
        className={className ?? 'mt-8'}
      >
        {loading ? 'Redirecting…' : (label ?? 'Buy the lip balm')}
      </Button>
      {errorMessage && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-ui, inherit)',
            fontSize: '13px',
            color: 'var(--color-text-dim, #6b6b6b)',
            marginTop: '10px',
          }}
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
}
