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
 * Error path: console.error (no toast/modal/banner per CLAUDE.md voice rules).
 *
 * quantity prop: if provided, uses that value; otherwise reads from ShopQtyProvider
 * context via useShopQty(). Falls back to 1 if used outside a provider.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// Optional: context-aware quantity. We try to import the hook but fall back
// gracefully when BuyButton is rendered outside ShopQtyProvider.
let _useShopQty: (() => { quantity: number }) | null = null
try {
  // Dynamic require so this module still loads if the context file is absent.
  // In practice ShopQtyProvider.tsx always exists, but this guards against
  // server-side rendering contexts where the hook would throw.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _useShopQty = require('@/components/marketing/ShopQtyProvider').useShopQty
} catch {
  _useShopQty = null
}

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

  // Resolve quantity: prop > context > 1
  let contextQty = 1
  if (_useShopQty) {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      contextQty = _useShopQty().quantity
    } catch {
      contextQty = 1
    }
  }
  const quantity = quantityProp ?? contextQty

  async function onClick() {
    if (loading) return
    setLoading(true)
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
      // No toast/modal/banner per voice rules. Surface to console and re-enable
      // the button so the user can retry. A small inline status could be added
      // later, but the brief locks against UI ornaments here.
      // eslint-disable-next-line no-console
      console.error('[BuyButton] checkout failed:', err)
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      disabled={loading}
      onClick={onClick}
      className={className ?? 'mt-8'}
    >
      {loading ? 'Redirecting…' : (label ?? 'Buy the lip balm')}
    </Button>
  )
}
