/**
 * Email render dispatch — Plan 20-04 replaces the Plan 20-03 placeholder body.
 *
 * SIGNATURE IS STABLE: callers await renderEmailStep(step, data).
 * - File is .tsx so JSX is valid (tsconfig jsx: react-jsx).
 * - The barrel import specifier stays './render' (no extension change).
 * - RenderData interface is unchanged from Plan 20-03.
 */

import { render } from '@react-email/render'
import React from 'react'
import CharityReceipt from './templates/CharityReceipt'
import DeliveredEstimate from './templates/DeliveredEstimate'
import NewsletterOptin from './templates/NewsletterOptin'
import OrderConfirmation from './templates/OrderConfirmation'
import Replenishment from './templates/Replenishment'
import ReviewAsk from './templates/ReviewAsk'
import Shipping from './templates/Shipping'
import TheRitual from './templates/TheRitual'

export interface RenderData {
  order: {
    customerEmail?: string | null
    charitySlug?: string | null
    amountTotal: number
    createdAt: number
  }
  charity?: {
    name: string
    location?: string
    focusArea?: string
    missionStatement?: string
  } | null
  others?: Array<{ name: string }> | null
  fundedMoreCount?: number | null
  unsubscribeToken?: string | null
  postalAddress?: string | null
  baseUrl?: string
}

/**
 * Render a single email step to an HTML string via @react-email/render.
 *
 * Steps 1-3 are transactional (no unsubscribe link).
 * Steps 4-8 are marketing (unsubscribe link via MarketingLayout).
 */
export async function renderEmailStep(
  step: number,
  data: RenderData,
): Promise<string> {
  const { order, charity, others, fundedMoreCount, unsubscribeToken, postalAddress, baseUrl } = data

  switch (step) {
    case 1:
      return render(<OrderConfirmation order={order} charity={charity} postalAddress={postalAddress} />)
    case 2:
      return render(<Shipping order={order} charity={charity} postalAddress={postalAddress} />)
    case 3:
      return render(<DeliveredEstimate order={order} charity={charity} postalAddress={postalAddress} />)
    case 4:
      return render(
        <TheRitual
          order={order}
          charity={charity}
          postalAddress={postalAddress}
          unsubscribeToken={unsubscribeToken}
          baseUrl={baseUrl}
        />,
      )
    case 5:
      return render(
        <CharityReceipt
          order={order}
          charity={charity}
          postalAddress={postalAddress}
          unsubscribeToken={unsubscribeToken}
          baseUrl={baseUrl}
        />,
      )
    case 6:
      return render(
        <ReviewAsk
          order={order}
          charity={charity}
          postalAddress={postalAddress}
          unsubscribeToken={unsubscribeToken}
          baseUrl={baseUrl}
        />,
      )
    case 7:
      return render(
        <NewsletterOptin
          order={order}
          charity={charity}
          others={others}
          postalAddress={postalAddress}
          unsubscribeToken={unsubscribeToken}
          baseUrl={baseUrl}
        />,
      )
    case 8:
      return render(
        <Replenishment
          order={order}
          charity={charity}
          fundedMoreCount={fundedMoreCount}
          postalAddress={postalAddress}
          unsubscribeToken={unsubscribeToken}
          baseUrl={baseUrl}
        />,
      )
    default:
      throw new Error(`Unknown email step ${step}`)
  }
}
