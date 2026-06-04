'use client'

/**
 * ShopStickyBar — sticky buy bar that appears after the hero scrolls past.
 *
 * - Reads quantity from ShopQtyProvider context via useShopQty().
 * - Shows the product name, $8.99, and "100% → {charityName}" cause line.
 * - Visibility toggled via .visible class (CSS transition) once window.scrollY
 *   passes ~600px (approximately the end of the hero on most viewports).
 * - Fixed bottom, z-index 100 (below the SiteHeader's z-[150]).
 * - Min 44px touch target on the Add-to-cart button (via BuyButton lg size).
 * - Under prefers-reduced-motion: transition is suppressed in CSS; JS still
 *   toggles the .visible class (just instant show/hide, no animation).
 */

import { useEffect, useRef } from 'react'
import { BuyButton } from '@/components/marketing/BuyButton'
import { useShopQty } from '@/components/marketing/ShopQtyProvider'

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
    <div ref={barRef} className="sb-sticky" role="complementary" aria-label="Quick buy">
      <div className="sb-sticky-info">
        <span className="sb-sticky-product">Jesse A. Eisenbalm</span>
        <span className="sb-sticky-price">$8.99 · qty {quantity}</span>
        {charityName ? (
          <span className="sb-sticky-cause">100% → {charityName}</span>
        ) : (
          <span className="sb-sticky-cause">100% to this week&apos;s charity</span>
        )}
      </div>
      <div className="shrink-0">
        <BuyButton
          quantity={quantity}
          label="Add to cart"
          className="mt-0"
        />
      </div>
    </div>
  )
}
