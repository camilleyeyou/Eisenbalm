import type { FrontPageRow } from '@/lib/sanity/types'
import './bands.css'

export function AdSummary({ summary }: { summary: { title: string | null; rows: FrontPageRow[] } }) {
  return (
    <div className="d-adsummary">
      {summary.title && <h3 className="d-adsummary-title">{summary.title}</h3>}
      {summary.rows.length > 0 && (
        <dl className="d-adsummary-rows">
          {summary.rows.map((r, i) => (
            <div key={i} className="d-adsummary-row">
              <dt className="d-label">{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
