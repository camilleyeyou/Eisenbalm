'use client'

/**
 * ShopBand — inline shop section replacing ShopCallout (Phase 19).
 * UI-SPEC §Section 12 Shop Band.
 *
 * Client component (has mouse event handlers on buy button).
 * Centered band with charity-name-personalized h2.
 * Links to /shop. data-shop-callout attribute (CMR-09 tripwire).
 * Wraps in ScrollReveal for scroll-reveal animation.
 *
 * Props:
 *   charityName — featured charity name (interpolated into h2)
 */

import { ScrollReveal } from './ScrollReveal'

interface ShopBandProps {
  charityName: string
}

export function ShopBand({ charityName }: ShopBandProps) {
  return (
    <ScrollReveal>
      <section
        className="shop"
        data-shop-callout
        aria-label="Shop — Eisenbalm lip balm"
      >
        {/* Label: IBM Plex Mono 11px uppercase ls .18em */}
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: 'var(--color-accent)',
            marginBottom: '18px',
          }}
        >
          Jesse A. Eisenbalm
        </div>

        {/* h2: Fraunces clamp(32px,4.5vw,54px) weight 400 */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px,4.5vw,54px)',
            fontWeight: 400,
            lineHeight: 1.06,
            marginBottom: '14px',
          }}
        >
          Premium lip balm.{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
            100% to {charityName}.
          </em>
        </h2>

        {/* Sub: Newsreader 18px italic */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            fontStyle: 'italic',
            color: 'var(--color-text-dim)',
            maxWidth: '520px',
            margin: '0 auto 32px',
            lineHeight: 1.5,
          }}
        >
          Not a pledge. Not a percentage. Every dollar from every purchase this week funds
          the charity above.
        </p>

        {/* Buy button: IBM Plex Mono 12px weight 500 uppercase, links to /shop */}
        <a
          href="/shop"
          className="shop-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            background: 'var(--color-accent)',
            color: '#fff',
            padding: '16px 36px',
            textDecoration: 'none',
            minHeight: '44px',
            transition: 'background 0.15s, transform 0.15s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.background = 'var(--color-accent-deep)'
            el.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.background = 'var(--color-accent)'
            el.style.transform = ''
          }}
        >
          Buy the Lip Balm →
        </a>
      </section>
    </ScrollReveal>
  )
}
