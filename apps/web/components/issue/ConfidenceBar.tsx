'use client'

/**
 * ConfidenceBar — Phase 19 deliberation centerpiece: confidence bar + verdict box.
 * UI-SPEC §10 Deliberation Centerpiece — Verdict box + confidence bar.
 *
 * Dark-band inline constants (never CSS vars — deliberation band is always dark):
 *   bar track: #38322A  verdict bg: #241F1A  accent-on-dark: #E0B0A4
 *   tertiary: #8A8273
 *
 * CSS transition (not framer-motion) per RESEARCH §"Don't Hand-Roll" lines 415-417.
 * Under prefers-reduced-motion: renders at full value% immediately, no transition.
 */

import { useState, useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'

type Props = {
  /** Target fill percentage 0–100 */
  value: number
  /** Parent triggers true after last chat message reveals */
  trigger: boolean
  /** Optional editor decision label (winner charity name) */
  winner?: string | null
}

export function ConfidenceBar({ value, trigger, winner }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const [width, setWidth] = useState(prefersReducedMotion ? value : 0)

  useEffect(() => {
    if (prefersReducedMotion) {
      // Reduced-motion: render at full value immediately, no transition
      setWidth(value)
      return
    }
    if (trigger) {
      // 200ms delay after last message (per UI-SPEC motion contract)
      const t = setTimeout(() => setWidth(value), 200)
      return () => clearTimeout(t)
    }
  }, [trigger, value, prefersReducedMotion])

  return (
    <div
      style={{ marginTop: '24px', padding: '20px 22px', background: '#241F1A', border: '1px solid var(--color-accent)' }}
      aria-label={`Editor confidence: ${value}%`}
    >
      {/* Verdict header row */}
      <div
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: '#8A8273',
          }}
        >
          Editor Confidence
        </span>
        {winner && (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 400,
              color: '#E0B0A4',
            }}
          >
            {winner}
          </span>
        )}
      </div>

      {/* Bar track */}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: '3px',
          background: '#38322A',
          overflow: 'hidden',
        }}
      >
        {/* Fill — CSS transition, not framer-motion */}
        <div
          style={{
            height: '100%',
            background: 'var(--color-accent)',
            width: `${width}%`,
            transition: prefersReducedMotion
              ? 'none'
              : 'width 1.6s cubic-bezier(.16,1,.3,1)',
          }}
        />
      </div>

      {/* Percentage label */}
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#8A8273',
          marginTop: '8px',
        }}
      >
        {value}%
      </p>
    </div>
  )
}
