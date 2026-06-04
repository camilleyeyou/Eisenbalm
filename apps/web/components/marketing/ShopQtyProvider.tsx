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
 * unitPriceCents = 899 ($8.99). TODO(Andrew): confirm final price before launch.
 */

import { createContext, useContext, useState, useCallback } from 'react'

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
  const unitPriceCents = 899 // TODO(Andrew): confirm final price; mirrors $8.99

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
 * Renders inside .shop-brand wrapper so scoped --accent / --ink vars resolve.
 */
export function QtyStepper() {
  const { quantity, setQuantity, unitPriceCents } = useShopQty()
  const totalFormatted = ((quantity * unitPriceCents) / 100).toFixed(2)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-0">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={quantity <= 1}
          onClick={() => setQuantity(quantity - 1)}
          className="flex h-11 w-11 items-center justify-center border border-[color:var(--rule)] bg-[color:var(--paper2)] text-[color:var(--ink)] text-lg font-medium transition-opacity disabled:opacity-40"
        >
          −
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="flex h-11 min-w-[3rem] items-center justify-center border-y border-[color:var(--rule)] bg-[color:var(--paper)] px-3 text-[color:var(--ink)] tabular-nums"
          style={{ fontFamily: 'var(--sb-mono)' }}
        >
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={quantity >= 20}
          onClick={() => setQuantity(quantity + 1)}
          className="flex h-11 w-11 items-center justify-center border border-[color:var(--rule)] bg-[color:var(--paper2)] text-[color:var(--ink)] text-lg font-medium transition-opacity disabled:opacity-40"
        >
          +
        </button>
      </div>
      <p className="text-sm text-[color:var(--ink-2)]" style={{ fontFamily: 'var(--sb-mono)' }}>
        Total: ${totalFormatted}
      </p>
    </div>
  )
}
