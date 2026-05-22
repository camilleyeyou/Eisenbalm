'use client'

/**
 * SectionNavigator — Vertical Timeline rebuild (Phase 12 MED-04).
 * UI-SPEC §SectionNavigator — Vertical Timeline (MED-04).
 *
 * Renders a <nav aria-label="Sections"> vertical list of 8 anchor links
 * pointing at the CANONICAL section ids. Each row has:
 *   - A central spine with a node dot (gold when active/in-view)
 *   - A § NN section number
 *   - A category tag pill
 *   - A Cormorant Garamond title (with one italic word via <em>)
 *   - A Lora italic subtitle
 *   - A right-aligned READ STATUS machine-readout
 *
 * Canonical ids used: #origin-story #problem #founder-bio #case-study
 *                     #game #bonus #deliberation #podcast
 * NOTE: the-problem / the-game / the-bonus are forbidden; use the canonical ids above.
 *
 * Cursor glow:
 *   A mousemove listener on each .snw-row updates --mx/--my CSS vars for the
 *   ::before radial-gradient highlight. The listener early-returns when
 *   prefers-reduced-motion is set, leaving the glow centred (static hover
 *   only — acceptable per UI-SPEC Motion Contract).
 *
 * Reading progress:
 *   A second useEffect + IntersectionObserver (threshold 0.3) tracks which
 *   section is currently in the viewport and marks that row's node dot active.
 *   A scroll listener drives the spine progress fill height via --spine-progress.
 *   Under prefers-reduced-motion: observer still fires (sets state), but CSS
 *   transitions are 0.01ms globally via the globals.css guard — no JS bypass needed.
 *
 * Touch targets: each .snw-row has min-height: 88px from globals.css — ≥44px.
 * Single <main>: this nav lives inside the root layout's <main id="main">.
 * No <main>, no role="main" added here.
 */

import { useEffect, useRef, useState } from 'react'

interface SectionCard {
  href: string
  number: string
  title: string
  tag: string
  subtitle?: string
  italicWord?: string
}

const CARDS: SectionCard[] = [
  {
    href: '#origin-story',
    number: '01',
    title: 'The Architecture of Absence',
    tag: 'EDITORIAL',
    subtitle: 'How a thing with no funding found a reason to exist.',
    italicWord: 'Absence',
  },
  {
    href: '#problem',
    number: '02',
    title: 'The Problem',
    tag: 'ANALYSIS',
    subtitle: 'The precise mechanism by which the world fails this population.',
    italicWord: 'Problem',
  },
  {
    href: '#founder-bio',
    number: '03',
    title: 'Founder Bio',
    tag: 'PROFILE',
    subtitle: 'The person who decided this was worth doing.',
    italicWord: 'Bio',
  },
  {
    href: '#case-study',
    number: '04',
    title: 'Case Study',
    tag: 'IMPACT',
    subtitle: 'One documented instance. One outcome.',
    italicWord: 'Study',
  },
  {
    href: '#game',
    number: '05',
    title: 'The Game',
    tag: 'INTERACTIVE',
    subtitle: 'A game about the stakes.',
    italicWord: 'Game',
  },
  {
    href: '#bonus',
    number: '06',
    title: 'The Bonus',
    tag: 'EXTRA',
    subtitle: 'Something we could not leave out.',
    italicWord: 'Bonus',
  },
  {
    href: '#deliberation',
    number: '07',
    title: 'The Deliberation',
    tag: 'PROCESS',
    subtitle: 'A full audit of the candidate selection process.',
    italicWord: 'Deliberation',
  },
  {
    href: '#podcast',
    number: '08',
    title: 'The Podcast',
    tag: 'AUDIO',
    subtitle: 'Listen to the decision being made.',
    italicWord: 'Podcast',
  },
]

/**
 * Render a section title string with the italicWord wrapped in <em>.
 * If italicWord is absent or not found in the title, renders the title plain.
 */
function renderTitle(title: string, italicWord?: string) {
  if (!italicWord) {
    return <span className="snw-section-title">{title}</span>
  }
  const idx = title.indexOf(italicWord)
  if (idx === -1) {
    return <span className="snw-section-title">{title}</span>
  }
  const before = title.slice(0, idx)
  const after = title.slice(idx + italicWord.length)
  return (
    <span className="snw-section-title">
      {before}
      <em>{italicWord}</em>
      {after}
    </span>
  )
}

export function SectionNavigator() {
  const navRef = useRef<HTMLElement>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Effect 1: Cursor-following radial glow (--mx/--my) on each .snw-row.
  // Preserved behavior from Phase 11 — early-return under prefers-reduced-motion.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    // Under reduced-motion: skip mouse tracking; CSS ::before centres the glow.
    if (prefersReducedMotion) return

    const nav = navRef.current
    if (!nav) return

    const rows = Array.from(
      nav.querySelectorAll<HTMLAnchorElement>('.snw-row'),
    )

    const handlers: Array<{ el: HTMLAnchorElement; fn: (e: MouseEvent) => void }> =
      []

    for (const row of rows) {
      const fn = (e: MouseEvent) => {
        const rect = row.getBoundingClientRect()
        const mx = ((e.clientX - rect.left) / rect.width) * 100
        const my = ((e.clientY - rect.top) / rect.height) * 100
        row.style.setProperty('--mx', `${mx}%`)
        row.style.setProperty('--my', `${my}%`)
      }
      row.addEventListener('mousemove', fn)
      handlers.push({ el: row, fn })
    }

    return () => {
      for (const { el, fn } of handlers) {
        el.removeEventListener('mousemove', fn)
      }
    }
  }, [])

  // Effect 2: Reading-progress via IntersectionObserver on each section anchor.
  // Also drives the spine fill fraction via --spine-progress CSS variable.
  useEffect(() => {
    const sectionIds = CARDS.map((c) => c.href.slice(1)) // strip '#'

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { threshold: 0.3 },
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    // Spine fill: track scroll fraction and set --spine-progress on the nav.
    const onScroll = () => {
      const nav = navRef.current
      if (!nav) return
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable <= 0) return
      const fraction = Math.min(1, Math.max(0, window.scrollY / scrollable))
      nav.style.setProperty('--spine-progress', `${fraction * 100}%`)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // set initial value

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="section-navigator"
    >
      {/* Header block */}
      <div style={{ marginBottom: '48px' }}>
        <div className="snw-module-label">NAVIGATION MODULE 01-B</div>
        <div className="snw-title-plain">
          In this{' '}
          <span className="snw-title-accent">Issue</span>
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="snw-timeline">
        {CARDS.map((card) => {
          const id = card.href.slice(1)
          const isActive = activeSection === id

          return (
            <a
              key={card.href}
              href={card.href}
              className={`snw-row${isActive ? ' active' : ''}`}
              aria-label={`§ ${card.number} ${card.title} — ${card.tag}`}
            >
              {/* Left spine column */}
              <div className="snw-spine">
                <div className="snw-spine-line" />
                <div
                  className="snw-spine-progress"
                  style={{ height: 'var(--spine-progress, 0%)' }}
                />
                <div
                  className={`snw-node${isActive ? ' active' : ''}`}
                  aria-hidden="true"
                />
                <div className="snw-section-num">§ {card.number}</div>
              </div>

              {/* Center content block */}
              <div className="snw-content">
                <div className="snw-tag-pill">{card.tag}</div>
                {renderTitle(card.title, card.italicWord)}
                {card.subtitle && (
                  <div className="snw-subtitle">{card.subtitle}</div>
                )}
              </div>

              {/* Right read-status column */}
              <div className="snw-read-status">
                <span
                  aria-live="polite"
                  aria-label={`Read status: ${isActive ? '100' : '0'}%`}
                >
                  <div className="snw-read-label">READ STATUS:</div>
                  <div className="snw-read-value">{isActive ? '100' : '0'}%</div>
                  <div className="snw-read-dash">——</div>
                </span>
              </div>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
