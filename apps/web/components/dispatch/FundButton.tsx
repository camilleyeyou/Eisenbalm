'use client'

import { useRef, useState } from 'react'
import { startCheckout, CHECKOUT_FAILURE_MESSAGE } from '@/lib/checkout-client'
import { CHECKOUT_LOADING } from '@/lib/dispatch/copy'
import './commerce.css'

export function FundButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  async function onClick() {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    const result = await startCheckout(1)
    if (!result.ok) {
      setError(CHECKOUT_FAILURE_MESSAGE)
      setLoading(false)
      busy.current = false
    }
  }

  return (
    <div className="d-fund">
      <button
        type="button"
        className="d-pill d-pill--accent d-fund-btn"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading || undefined}
      >
        {loading ? CHECKOUT_LOADING : label}
      </button>
      <p className="d-label d-fund-status" aria-live="polite">
        {error ?? ''}
      </p>
    </div>
  )
}
