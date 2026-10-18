'use client'

/**
 * ShopStickyBar — sticky buy bar that appears after the hero scrolls past.
 *
 * - Reads quantity from ShopQtyProvider context via useShopQty().
 * - Shows the product name, the price, and "100% → {charityName}" cause line.
 * - Visibility toggled via .visible class (CSS transition) once window.scrollY
 *   passes ~600px (approximately the end of the hero on most viewports).
 * - Fixed bottom, z-index 100 (Dispatch ink bar; the top bar is not sticky).
 * - Min 44px touch target on the Add-to-cart button (the .d-pill class).
 * - Under prefers-reduced-motion: transition is suppressed in CSS; JS still
 *   toggles the .visible class (just instant show/hide, no animation).
 */

import { useEffect, useRef } from 'react'
import { BuyButton } from '@/components/marketing/BuyButton'
import { useShopQty } from '@/components/marketing/ShopQtyProvider'
import { BALM_PRICE_CENTS, formatUsd } from '@/lib/site'

interface ShopStickyBarProps {
  charityName: string | null
}

export function ShopStickyBar({ charityName }: ShopStickyBarProps) {
  const { quantity } = useShopQty()
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const THRESHOLD = 600 // px — approximately end of hero

    function onScroll() {
      if (!barRef.current) return
      if (window.scrollY > THRESHOLD) {
        barRef.current.classList.add('visible')
      } else {
        barRef.current.classList.remove('visible')
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // run once on mount
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={barRef} className="d-shop-sticky d-on-dark" role="complementary" aria-label="Quick buy">
      <div className="d-shop-sticky-info">
        <span className="d-label">Jesse A. Eisenbalm</span>
        <span className="d-label">{formatUsd(BALM_PRICE_CENTS)} · qty {quantity}</span>
        {charityName ? (
          <span className="d-label d-shop-sticky-cause">100% → {charityName}</span>
        ) : (
          <span className="d-label d-shop-sticky-cause">100% to this week&apos;s charity</span>
        )}
      </div>
      <div className="shrink-0">
        <BuyButton
          quantity={quantity}
          label="Add to cart"
          tone="accent"
          className="d-pill--compact"
        />
      </div>
    </div>
  )
}
