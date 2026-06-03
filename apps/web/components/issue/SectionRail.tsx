'use client'

/**
 * SectionRail — sticky left scroll-spy rail (Phase 19).
 *
 * Fixed left 24px, vertically centered. role="navigation" aria-label="Article sections".
 * Appears when scrollY > 700px.
 * Hidden below 980px via .rail CSS class (display:none).
 * Tracks sections: #origin, #problem, #founder, #case, #game, #bonus, #delib, #pod.
 * Active when section getBoundingClientRect().top < window.innerHeight * 0.4.
 *
 * Keyboard accessible: all items are anchor elements with href="#id".
 */

import { useEffect, useState } from 'react'
import { useScroll, useMotionValueEvent } from 'framer-motion'

const SECTIONS = [
  { id: 'origin',  label: 'Origin' },
  { id: 'problem', label: 'Problem' },
  { id: 'founder', label: 'Founder' },
  { id: 'case',    label: 'Case Study' },
  { id: 'game',    label: 'Game' },
  { id: 'bonus',   label: 'Bonus' },
  { id: 'delib',   label: 'Deliberation' },
  { id: 'pod',     label: 'Podcast' },
]

export function SectionRail() {
  const [visible, setVisible] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const { scrollY } = useScroll()

  // Show/hide rail based on scroll position
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible(latest > 700)
  })

  // Track active section via scroll position
  useEffect(() => {
    function updateActive() {
      const threshold = window.innerHeight * 0.4
      let current: string | null = null

      // Walk sections in reverse to find deepest section above threshold
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = SECTIONS[i]
        if (!section) continue
        const el = document.getElementById(section.id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top < threshold) {
          current = section.id
          break
        }
      }

      setActiveId(current)
    }

    window.addEventListener('scroll', updateActive, { passive: true })
    updateActive()
    return () => window.removeEventListener('scroll', updateActive)
  }, [])

  return (
    <nav
      className="rail"
      role="navigation"
      aria-label="Article sections"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.4s',
      }}
    >
      {SECTIONS.map(({ id, label }) => {
        const isActive = activeId === id
        return (
          <a
            key={id}
            href={`#${id}`}
            className={isActive ? 'active' : ''}
            aria-current={isActive ? 'location' : undefined}
          >
            <span
              className="tick"
              style={{
                width: isActive ? 28 : 18,
                background: isActive ? 'var(--color-accent)' : 'var(--color-line-strong)',
                transition: 'background 0.25s, width 0.25s',
              }}
            />
            <span className="rl">{label}</span>
          </a>
        )
      })}
    </nav>
  )
}
