'use client'

/**
 * SectionNavigator — 8-card jump-nav for editorial sections.
 * UI-SPEC §Section navigator + §Motion Contract + §Spacing touch-target rule.
 *
 * Renders a <nav aria-label="Sections"> grid of 8 anchor links pointing at
 * the CANONICAL section ids (UI-SPEC §Anchor-id reconciliation). Card copy
 * may be editorial ("The Problem") but hrefs ALWAYS use the canonical id.
 *
 * Canonical ids used: #origin-story #problem #founder-bio #case-study
 *                     #game #bonus #deliberation #podcast
 * NOTE: the-problem / the-game / the-bonus are forbidden; use the canonical ids above.
 *
 * Magnetic glow:
 *   A mousemove listener on each card updates --mx/--my CSS vars for the
 *   ::before radial-gradient highlight. The listener early-returns when
 *   prefers-reduced-motion is set, leaving the glow centred (static hover
 *   only — acceptable per UI-SPEC Motion Contract).
 *
 * Touch targets: each card link has min-height from padding (≥44px via
 *   .section-navigator a CSS in globals.css).
 */

import { useEffect, useRef } from 'react'

interface SectionCard {
  href: string
  number: string
  title: string
  tag: string
  wide?: boolean
  feature?: boolean
}

const CARDS: SectionCard[] = [
  {
    href: '#origin-story',
    number: '01',
    title: 'Origin Story',
    tag: 'History',
  },
  {
    href: '#problem',
    number: '02',
    title: 'The Problem',
    tag: 'Analysis',
  },
  {
    href: '#founder-bio',
    number: '03',
    title: 'Founder Bio',
    tag: 'Profile',
  },
  {
    href: '#case-study',
    number: '04',
    title: 'Case Study',
    tag: 'Impact',
  },
  {
    href: '#game',
    number: '05',
    title: 'The Game',
    tag: 'Interactive',
    feature: true,
  },
  {
    href: '#bonus',
    number: '06',
    title: 'The Bonus',
    tag: 'Extra',
  },
  {
    href: '#deliberation',
    number: '07',
    title: 'The Deliberation',
    tag: 'Process',
    wide: true,
    feature: true,
  },
  {
    href: '#podcast',
    number: '08',
    title: 'The Podcast',
    tag: 'Audio',
    wide: true,
  },
]

export function SectionNavigator() {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    // Under reduced-motion: skip mouse tracking; CSS ::before centres the glow.
    if (prefersReducedMotion) return

    const nav = navRef.current
    if (!nav) return

    const cards = Array.from(
      nav.querySelectorAll<HTMLAnchorElement>('.section-card'),
    )

    const handlers: Array<{ el: HTMLAnchorElement; fn: (e: MouseEvent) => void }> =
      []

    for (const card of cards) {
      const fn = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const mx = ((e.clientX - rect.left) / rect.width) * 100
        const my = ((e.clientY - rect.top) / rect.height) * 100
        card.style.setProperty('--mx', `${mx}%`)
        card.style.setProperty('--my', `${my}%`)
      }
      card.addEventListener('mousemove', fn)
      handlers.push({ el: card, fn })
    }

    return () => {
      for (const { el, fn } of handlers) {
        el.removeEventListener('mousemove', fn)
      }
    }
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="section-navigator"
    >
      <div className="snw-head">
        <span className="snw-title">In This Issue</span>
        <span className="snw-rule" aria-hidden="true" />
        <span className="snw-count">08 SECTIONS</span>
      </div>

      <div className="section-cards">
        {CARDS.map((card) => (
          <a
            key={card.href}
            href={card.href}
            className={[
              'section-card',
              card.wide ? 'wide' : '',
              card.feature ? 'feature' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="sc-top">
              <span className="sc-num">{card.number}</span>
              <span className="sc-tag">{card.tag}</span>
            </div>
            <span className="sc-name">{card.title}</span>
            <span className="sc-arrow" aria-hidden="true">
              Read →
            </span>
          </a>
        ))}
      </div>
    </nav>
  )
}
