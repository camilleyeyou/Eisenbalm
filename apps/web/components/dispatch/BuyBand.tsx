import { FundButton } from './FundButton'
import { BalmCounter } from './BalmCounter'
import type { ImpactRange } from '@/lib/dispatch/derive'
import {
  buyEyebrow,
  BUY_HEADLINE,
  buyLead,
  BALM_LINE,
  SHIPPING_NOTE,
  MORE_THAN_ONE_LINK,
  fundButtonLabel,
} from '@/lib/dispatch/copy'
import './commerce.css'

export function BuyBand(p: {
  charityName: string
  charitySlug: string
  sinceMs?: number
  countLabel: string
  initialBalms: number | undefined
  impact: ImpactRange | null
}) {
  return (
    <section id="buy" aria-labelledby="buy-title" className="d-buy d-on-dark" data-shop-callout>
      <div className="d-container d-buy-grid">
        <div className="d-buy-copy">
          <p className="d-eyebrow d-buy-eyebrow">{buyEyebrow(p.charityName)}</p>
          <h2 id="buy-title" className="d-display">{BUY_HEADLINE}</h2>
          <p className="d-body d-buy-lead">{buyLead(p.charityName, p.impact)}</p>
          <p className="d-body d-buy-balm">{BALM_LINE}</p>
          <FundButton label={fundButtonLabel(p.charityName)} />
          <p className="d-label d-buy-note">{SHIPPING_NOTE}</p>
          <a href="/shop" className="d-tap d-label d-link d-buy-more">{MORE_THAN_ONE_LINK}</a>
        </div>
        <div className="d-buy-side">
          <BalmCounter
            charitySlug={p.charitySlug}
            sinceMs={p.sinceMs}
            initial={p.initialBalms}
            label={p.countLabel}
            impact={p.impact}
          />
          <span className="d-balm-glyph" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
