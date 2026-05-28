'use client'

/**
 * BuyButton — initiates Stripe Checkout for the Eisenbalm lip balm.
 *
 * Flow:
 *   1. User clicks
 *   2. fetch('/api/checkout/create-session', { method: 'POST' })
 *   3. Server returns { url }
 *   4. window.location.href = url (redirects to Stripe-hosted Checkout)
 *
 * Loading state: text changes to "Redirecting…" and button disables.
 * Error path: console.error (no toast/modal/banner per CLAUDE.md voice rules).
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function BuyButton() {
  const [loading, setLoading] = useState(false)

  async function onClick() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/checkout/create-session', { method: 'POST' })
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
      className="mt-8"
    >
      {loading ? 'Redirecting…' : 'Buy the lip balm'}
    </Button>
  )
}
