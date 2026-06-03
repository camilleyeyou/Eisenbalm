'use client'

/**
 * StatCountUp — animated stat counter (Phase 19).
 *
 * Props:
 *   to      — numeric target value
 *   suffix  — optional string appended after the count ("+", "yr")
 *   plain   — skip animation even under normal motion (for year values like 1997)
 *
 * Reduced-motion contract (UI-SPEC §Motion Contract):
 *   Under prefers-reduced-motion OR plain=true → renders final value immediately.
 *   No count-up animation; no 0→N progression.
 *
 * Animation: framer-motion animate() from 0 to `to` over 880ms, easeOut.
 * Triggers when the component enters viewport (useInView, amount:0.2).
 */

import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

interface StatCountUpProps {
  to: number
  suffix?: string
  plain?: boolean
}

export function StatCountUp({ to, suffix = '', plain = false }: StatCountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const [displayed, setDisplayed] = useState<string>(
    plain || prefersReducedMotion ? `${to}${suffix}` : '0'
  )

  useEffect(() => {
    // Reduced-motion or plain (year values): show final value immediately
    if (plain || prefersReducedMotion) {
      setDisplayed(`${to}${suffix}`)
      return
    }

    if (!isInView) return

    const controls = animate(0, to, {
      duration: 0.88,
      ease: 'easeOut',
      onUpdate: (latest) => {
        setDisplayed(`${Math.round(latest)}${suffix}`)
      },
      onComplete: () => {
        setDisplayed(`${to}${suffix}`)
      },
    })

    return () => controls.stop()
  }, [isInView, to, suffix, plain, prefersReducedMotion])

  return <span ref={ref}>{displayed}</span>
}
