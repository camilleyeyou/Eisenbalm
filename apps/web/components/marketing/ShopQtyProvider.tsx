'use client'

/**
 * ShopQtyProvider — shared quantity state for the /shop page.
 *
 * Exposes:
 *   - ShopQtyProvider: context provider wrapper
 *   - useShopQty: hook for reading/setting quantity + unitPriceCents
 *   - QtyStepper: labelled −/+ stepper + live running-total line
 *
 * Quantity is clamped to integer 1–20.
 * unitPriceCents = BALM_PRICE_CENTS from lib/site.ts (single price source).
 */

import { createContext, useContext, useState, useCallback } from 'react'
import { BALM_PRICE_CENTS } from '@/lib/site'

// ─── Context ──────────────────────────────────────────────────────────────────

interface ShopQtyCtx {
  quantity: number
  setQuantity: (n: number) => void
  unitPriceCents: number
}

const ShopQtyContext = createContext<ShopQtyCtx | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ShopQtyProvider({ children }: { children: React.ReactNode }) {
  const [quantity, setRaw] = useState(1)
  const unitPriceCents = BALM_PRICE_CENTS

  const setQuantity = useCallback((n: number) => {
    setRaw(Math.min(20, Math.max(1, Math.round(n) || 1)))
  }, [])

  return (
    <ShopQtyContext.Provider value={{ quantity, setQuantity, unitPriceCents }}>
      {children}
    </ShopQtyContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useShopQty(): ShopQtyCtx {
  const ctx = useContext(ShopQtyContext)
  if (!ctx) throw new Error('useShopQty must be used inside <ShopQtyProvider>')
  return ctx
}

// ─── QtyStepper ──────────────────────────────────────────────────────────────

/**
 * Accessible quantity stepper with live running-total display.
 * Styled by the .d-qty* rules in components/dispatch/shop.css.
 */
export function QtyStepper() {
  const { quantity, setQuantity, unitPriceCents } = useShopQty()
  const totalFormatted = ((quantity * unitPriceCents) / 100).toFixed(2)

  return (
    <div className="d-qty">
      <div className="d-qty-row">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={quantity <= 1}
          onClick={() => setQuantity(quantity - 1)}
          className="d-qty-btn"
        >
          −
        </button>
        <span aria-live="polite" aria-atomic="true" className="d-qty-value">
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={quantity >= 20}
          onClick={() => setQuantity(quantity + 1)}
          className="d-qty-btn"
        >
          +
        </button>
      </div>
      <p className="d-qty-total">Total: ${totalFormatted}</p>
    </div>
  )
}
