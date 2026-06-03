/**
 * IssueMasthead — compact dateline/h1/tagline block (Phase 19).
 * UI-SPEC §Section 3 Masthead.
 *
 * RSC. Renders the issue header: dateline, charity h1, and tagline.
 * max-width 1180px, centered, border-bottom.
 *
 * Props:
 *   issueNumber        — issue number (shown in accent in dateline)
 *   charityName        — the charity being featured (h1 content)
 *   tagline            — Newsreader italic tagline
 *   publishDate        — formatted date string (e.g. "May 30, 2026")
 *   readingTimeMinutes — reading time (WEB-15)
 */

interface IssueMastheadProps {
  issueNumber: number
  charityName: string
  tagline: string
  publishDate: string
  readingTimeMinutes: number
}

export function IssueMasthead({
  issueNumber,
  charityName,
  tagline,
  publishDate,
  readingTimeMinutes,
}: IssueMastheadProps) {
  return (
    <header className="masthead">
      {/* Dateline: IBM Plex Mono 11px uppercase, issue# in accent */}
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--color-text-mute)',
          marginBottom: '24px',
        }}
      >
        The Eisenbalm Dispatch&nbsp;&nbsp;·&nbsp;&nbsp;
        <b style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
          Issue {issueNumber}
        </b>
        &nbsp;&nbsp;·&nbsp;&nbsp;{publishDate}
        &nbsp;&nbsp;·&nbsp;&nbsp;{readingTimeMinutes} min read
      </div>

      {/* h1: Fraunces clamp(40px,6vw,76px) weight 400, optical sizing */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px,6vw,76px)',
          fontWeight: 400,
          lineHeight: 1.02,
          letterSpacing: '-0.025em',
          fontOpticalSizing: 'auto',
          marginBottom: '18px',
          color: 'var(--color-text)',
        } as React.CSSProperties}
      >
        {charityName}
      </h1>

      {/* Tagline: Newsreader clamp(17px,2vw,21px) italic, text-dim */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'clamp(17px,2vw,21px)',
          fontStyle: 'italic',
          color: 'var(--color-text-dim)',
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: 1.45,
        }}
      >
        {tagline}
      </p>
    </header>
  )
}
