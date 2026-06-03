'use client'

/**
 * ScrollProgressBar — framer-motion scroll progress indicator (Phase 19).
 *
 * Fixed top 3px bar tracking scroll position via useScroll().
 * z-index 300 (above nav z-200).
 * Color: var(--color-accent).
 *
 * Reduced-motion: bar stays at 0% — decorative only, acceptable per UI-SPEC.
 */

import { useScroll, useSpring, motion } from 'framer-motion'

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className="progress"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      aria-hidden="true"
    />
  )
}
