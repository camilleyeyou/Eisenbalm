/**
 * DelibScoreboard — Phase 19 deliberation centerpiece: candidate scoreboard.
 * UI-SPEC §10 Deliberation Centerpiece — Left Candidate Scoreboard.
 *
 * Dark-band inline constants (never CSS vars — deliberation band is always dark):
 *   card bg: #241F1A  card border: #38322A  accent-on-dark: #E0B0A4
 *   note: #9A9384  location: #7A7264  muted-text: #5A544A  tertiary: #8A8273
 *
 * No framer-motion needed — static render (RSC-compatible, but used as client child).
 */

export type DelibCandidate = {
  name: string
  location: string
  score: number | null
  note: string
  winning: boolean
  runnerUp?: boolean
}

type Props = {
  candidates: DelibCandidate[]
}

export function DelibScoreboard({ candidates }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {candidates.map((c, i) => (
        <div
          key={i}
          className={c.winning ? 'cand win' : 'cand'}
          style={{
            background: c.winning
              ? 'linear-gradient(135deg, rgba(154,51,36,.18), #241F1A)'
              : '#241F1A',
            border: c.winning
              ? '1px solid var(--color-accent)'
              : '1px solid #38322A',
            padding: '18px 20px',
            position: 'relative',
            borderLeft: c.winning
              ? '3px solid var(--color-accent)'
              : undefined,
          }}
        >
          {/* Name + badge row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '19px',
                fontWeight: 400,
                color: '#FBFAF6',
                lineHeight: 1.2,
              }}
            >
              {c.name}
            </span>
            {c.winning ? (
              <span
                className="w"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  padding: '4px 9px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Selected
              </span>
            ) : c.runnerUp ? (
              <span
                className="r"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  border: '1px solid #443E35',
                  color: '#8A8273',
                  padding: '4px 9px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Runner-Up
              </span>
            ) : null}
          </div>

          {/* Location */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#7A7264',
              margin: '4px 0 8px',
            }}
          >
            {c.location}
          </p>

          {/* Score */}
          {c.score !== null && (
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '30px',
                fontWeight: 500,
                color: c.winning ? '#E0B0A4' : '#5A544A',
                lineHeight: 1,
                marginBottom: '8px',
              }}
              aria-label={`Advocate score: ${c.score} out of 10`}
            >
              {c.score}
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  fontWeight: 400,
                  color: '#7A7264',
                  marginLeft: '4px',
                }}
              >
                /10
              </span>
            </p>
          )}

          {/* Note */}
          {c.note && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontStyle: 'italic',
                color: '#9A9384',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {c.note}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
