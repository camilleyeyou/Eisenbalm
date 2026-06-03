'use client'

/**
 * ScrollReveal — framer-motion scroll-reveal wrapper (Phase 19).
 *
 * Props:
 *   children  — content to reveal
 *   className — optional CSS class applied to the motion div
 *   id        — optional id for anchor targeting
 *
 * Reduced-motion contract (UI-SPEC §Motion Contract):
 *   When prefers-reduced-motion is set, initial={false} so the element
 *   renders at its final visible state immediately — no opacity:0 trap.
 *
 * Trigger: useInView once:true, threshold 0.2 (amount:0.2).
 */

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export function ScrollReveal({ children, className, id }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <motion.div
      ref={ref}
      id={id}
      className={className}
      // Under reduced-motion: initial={false} renders at final state immediately.
      // This prevents the opacity:0 trap where content stays invisible.
      initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
      animate={
        isInView || prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : {}
      }
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
