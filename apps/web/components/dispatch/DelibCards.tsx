import { NumberedSection } from './NumberedSection'
import { CONFIDENCE_LABEL, DELIB_CARD_LABELS, DELIB_INTRO, sectionMeta } from '@/lib/dispatch/copy'
import type { DelibCard } from '@/lib/dispatch/derive'
import './bands.css'

/**
 * Section 07: deliberation as summary cards (locked decision 4).
 * Sanity-sourced props only. No subscriptions, no transcript, no model names.
 * Confidence meter renders only when a real 0-1 value exists.
 */
export function DelibCards({ cards, confidence }: { cards: DelibCard[]; confidence: number | null }) {
  const m = sectionMeta('delib')
  const pct = confidence === null ? null : Math.round(confidence * 100)
  return (
    <NumberedSection id="delib" number={m.number} label={m.label}>
      <p className="d-body d-delib-intro">{DELIB_INTRO}</p>
      {cards.length === 0 ? (
        <p className="d-body">This issue predates the open deliberation record.</p>
      ) : (
        <ul className="d-delib-cards">
          {cards.map((c, i) => (
            <li key={`${c.kind}-${i}`}>
              <article className={`d-delib-card d-delib-card--${c.kind}`}>
                <p className="d-label">{DELIB_CARD_LABELS[c.kind]}</p>
                <h3 className="d-delib-title">{c.name}</h3>
                {c.location && <p className="d-label d-delib-loc">{c.location}</p>}
                {c.blurb && <p className="d-body d-delib-blurb">{c.blurb}</p>}
              </article>
            </li>
          ))}
        </ul>
      )}
      {pct !== null && (
        <div className="d-confidence">
          <p id="delib-confidence-label" className="d-label">
            {CONFIDENCE_LABEL}
          </p>
          <div className="d-confidence-row">
            <div
              className="d-confidence-track"
              role="meter"
              aria-labelledby="delib-confidence-label"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${pct}%`}
            >
              <span className="d-confidence-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="d-heading d-confidence-value" aria-hidden="true">
              {pct}%
            </p>
          </div>
        </div>
      )}
    </NumberedSection>
  )
}
