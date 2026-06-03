'use client'

/**
 * IssueBriefing — 3-column briefing grid (Phase 19).
 * UI-SPEC §Section 4 Three-Column Briefing.
 *
 * Client component because it wraps ScrollReveal (framer-motion).
 *
 * Columns:
 *   1. "Why this charity" — prose (Newsreader 15px)
 *   2. "At a glance" — 2×2 stat grid with StatCountUp
 *   3. "What's inside" — TOC list with section links
 *
 * Grid: 1.2fr 1.3fr 1fr → 1fr stacked below 980px (via CSS).
 * Center col: background var(--color-surface).
 *
 * Props:
 *   why   — "Why this charity" prose string
 *   stats — array of stat objects for count-up
 *   toc   — array of TOC items with section links
 */

import { ScrollReveal } from './ScrollReveal'
import { StatCountUp } from './StatCountUp'

export interface StatItem {
  to?: number       // numeric value for count-up stats (omit for text stats)
  suffix?: string
  plain?: boolean
  text?: string     // text-valued fact (e.g. location, focus area) — rendered as-is, no count-up
  label: string
}

export interface TocItem {
  n: string       // section number e.g. "01"
  name: string    // section name
  type: string    // type tag e.g. "Editorial"
  id: string      // anchor id e.g. "origin"
  must?: boolean  // italic treatment
}

interface IssueBriefingProps {
  why: string
  stats: StatItem[]
  toc: TocItem[]
}

export function IssueBriefing({ why, stats, toc }: IssueBriefingProps) {
  return (
    <section className="briefing">
      <div className="briefing-grid">
        {/* Col 1 — Why this charity */}
        <ScrollReveal className="brief-col">
          <div className="brief-label">Why this charity</div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'var(--color-text-dim)',
            }}
          >
            {why}
          </p>
        </ScrollReveal>

        {/* Col 2 — At a glance (stats) — center col with surface background */}
        <ScrollReveal className="brief-col center">
          <div className="brief-label">At a glance</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px 12px',
            }}
          >
            {stats.map((stat, i) => (
              <div key={i} className="stat">
                <div className="n">
                  {stat.text != null ? (
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        letterSpacing: 0,
                        lineHeight: 1.3,
                        display: 'block',
                      }}
                    >
                      {stat.text}
                    </span>
                  ) : (
                    <StatCountUp to={stat.to ?? 0} suffix={stat.suffix} plain={stat.plain} />
                  )}
                </div>
                <div className="l">{stat.label}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Col 3 — What's inside (TOC) */}
        <ScrollReveal className="brief-col">
          <div className="brief-label">What&apos;s inside</div>
          <ul className="toc">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={item.must ? 'must' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '10px',
                    textDecoration: 'none',
                    color: 'var(--color-text)',
                    padding: '7px 8px',
                    margin: '0 -8px',
                    minHeight: '44px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-card-hover)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = ''
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      color: 'var(--color-text-mute)',
                      width: '18px',
                      flexShrink: 0,
                    }}
                  >
                    {item.n}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14.5px',
                      color: 'var(--color-text)',
                      fontStyle: item.must ? 'italic' : 'normal',
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-accent)',
                      marginLeft: 'auto',
                      alignSelf: 'center',
                    }}
                  >
                    {item.type}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  )
}
