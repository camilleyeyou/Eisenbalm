import './top.css'
import { FUND_CTA, MASTHEAD_TAGLINE, MASTHEAD_WORDMARK, TOPBAR_LINKS } from '@/lib/dispatch/copy'
import Link from 'next/link'

export function DispatchMasthead({
  issueNumber,
  dateLabel,
  compact,
}: {
  issueNumber: number | null
  dateLabel: string | null
  compact?: boolean
}) {
  const issueLine = `${issueNumber != null ? `Issue ${issueNumber}` : ''}${
    issueNumber != null && dateLabel ? ' · ' : ''
  }${dateLabel ?? ''}`
  return (
    <>
      <header className="d-topbar">
        <div className="d-container d-topbar-row">
          <p className="d-label">{issueLine}</p>
          {!compact && (
            <nav aria-label="Main">
              <ul className="d-topbar-links">
                {TOPBAR_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="d-tap d-label d-link">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {!compact && (
            <Link href="/shop" className="d-pill d-pill--ink d-pill--compact">
              {FUND_CTA}
            </Link>
          )}
        </div>
      </header>
      <div className="d-masthead">
        <div className="d-container d-masthead-row">
          <p className="d-display d-wordmark">{MASTHEAD_WORDMARK}</p>
          <div className="d-tagline-row">
            <span className="d-dots" aria-hidden="true">
              <span className="d-dot d-dot--green" />
              <span className="d-dot d-dot--blue" />
              <span className="d-dot d-dot--red" />
              <span className="d-dot d-dot--yellow" />
            </span>
            <p className="d-body d-tagline">{MASTHEAD_TAGLINE}</p>
          </div>
        </div>
      </div>
    </>
  )
}
