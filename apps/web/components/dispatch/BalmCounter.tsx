'use client'

import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { impactProgress, type ImpactRange } from '@/lib/dispatch/derive'
import { impactCaption } from '@/lib/dispatch/copy'
import './commerce.css'

type TileProps = { value: number | undefined; label: string; impact?: ImpactRange | null }

export function BalmTile({ value, label, impact }: TileProps) {
  if (value === undefined) return null
  const pct = impact ? Math.round(impactProgress(value, impact) * 100) : 0
  return (
    <div className="d-count">
      <p className="d-label d-count-label">{label}</p>
      <p className="d-heading d-count-value">{value.toLocaleString('en-US')}</p>
      {impact && (
        <div className="d-impact">
          <p className="d-label" id="d-impact-label">
            {impactCaption(impact.unit)}
          </p>
          <div
            className="d-impact-track"
            role="meter"
            aria-labelledby="d-impact-label"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="d-impact-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

type CounterProps = {
  charitySlug: string
  sinceMs?: number
  initial: number | undefined
  label: string
  impact?: ImpactRange | null
}

function LiveBalmCounter({ charitySlug, sinceMs, initial, label, impact }: CounterProps) {
  const live = useQuery(
    api.stripeOrders.balmsForCharity,
    sinceMs === undefined ? { charitySlug } : { charitySlug, sinceMs },
  )
  return <BalmTile value={live?.balms ?? initial} label={label} impact={impact} />
}

export function BalmCounter(props: CounterProps) {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return <LiveBalmCounter {...props} />
  return <BalmTile value={props.initial} label={props.label} impact={props.impact} />
}
