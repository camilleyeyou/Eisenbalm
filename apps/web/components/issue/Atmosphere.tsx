'use client'

/**
 * Atmosphere — decorative dark editorial layers.
 * UI-SPEC §Atmosphere layer + §Motion Contract.
 *
 * Renders four fixed decorative divs (aurora / bg-grid / grain / progress).
 * All are aria-hidden and pointer-events:none — purely cosmetic.
 *
 * Scroll progress:
 *   A passive scroll listener updates --scroll-progress on <html> so the
 *   .progress bar's CSS var-driven width tracks the reader's position.
 *   The listener early-returns when prefers-reduced-motion is set, keeping
 *   the bar static at 0 (acceptable per UI-SPEC Motion Contract — the bar
 *   is decorative).
 *
 * Motion:
 *   Aurora/grain keyframes are defined in globals.css and are neutralised
 *   by the existing @media (prefers-reduced-motion: reduce) guard
 *   (animation-duration: 0.01ms !important). No duplicate guard here.
 *   The only JS-driven motion (scroll-progress width) uses its own early-return.
 */

import { useEffect } from 'react'

export function Atmosphere() {
  useEffect(() => {
    // Compute once at mount — value won't change during the session.
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    function onScroll() {
      // Early-return under reduced-motion: bar stays static at 0%.
      if (prefersReducedMotion) return

      const scrollTop = window.scrollY
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      document.documentElement.style.setProperty(
        '--scroll-progress',
        `${Math.min(100, Math.max(0, progress))}%`,
      )
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <>
      {/* Aurora radial-gradient layer */}
      <div className="aurora" aria-hidden="true" />

      {/* Vertical grid lines */}
      <div className="bg-grid" aria-hidden="true" />

      {/* Film-grain texture */}
      <div className="grain" aria-hidden="true" />

      {/* Scroll-progress hairline at top of viewport */}
      <div className="progress" aria-hidden="true" />
    </>
  )
}
