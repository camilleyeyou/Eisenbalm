'use client'

/**
 * ShopMotion — IntersectionObserver island for scroll-reveal animations.
 *
 * Adds `.in` to every `.rv` element inside `.d-shop` when it enters
 * the viewport (one-shot, no reverse). Renders nothing (returns null).
 *
 * Respects prefers-reduced-motion: if the user prefers reduced motion,
 * returns immediately and leaves all .rv elements fully visible (the CSS only hides
 * .rv inside a prefers-reduced-motion: no-preference block, so no JS
 * intervention is needed beyond early-return).
 *
 * Cleans up the observer on unmount.
 */

import { useEffect } from 'react'

export function ShopMotion() {
  useEffect(() => {
    // Early-return: leave .rv elements visible when motion is reduced.
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const elements = document.querySelectorAll<HTMLElement>('.d-shop .rv')
    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target) // one-shot
          }
        })
      },
      { threshold: 0.12 },
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return null
}
