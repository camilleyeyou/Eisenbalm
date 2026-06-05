// TODO(Andrew): voice sign-off required before live sending
import { Heading, Hr, Section, Text } from '@react-email/components'
import React from 'react'
import MarketingLayout from '../layouts/MarketingLayout'
import type { RenderData } from '../render'

type Props = Pick<
  RenderData,
  'order' | 'charity' | 'fundedMoreCount' | 'postalAddress' | 'unsubscribeToken'
> & {
  baseUrl?: string
}

/**
 * E8 — Replenishment + last call.
 * Renders the live "since you bought, a machine has quietly funded N more causes" count
 * from weeklyIssues published after order.createdAt.
 * Graceful fallback when fundedMoreCount is null or 0.
 */
export default function Replenishment({
  order,
  charity,
  fundedMoreCount,
  postalAddress,
  unsubscribeToken,
  baseUrl,
}: Props) {
  void order

  const hasCount = typeof fundedMoreCount === 'number' && fundedMoreCount > 0

  return (
    <MarketingLayout
      charity={charity}
      postalAddress={postalAddress}
      unsubscribeToken={unsubscribeToken}
      baseUrl={baseUrl}
    >
      <Section>
        <Heading
          as="h1"
          style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#111',
            margin: '0 0 16px',
          }}
        >
          Six weeks.
        </Heading>

        {hasCount ? (
          <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
            Since you purchased, a machine has quietly funded{' '}
            <strong>{fundedMoreCount}</strong> more{' '}
            {fundedMoreCount === 1 ? 'cause' : 'causes'}. Each one selected
            without sentiment. Each one given the full proceeds of that week&rsquo;s
            orders.
          </Text>
        ) : (
          <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
            Since you purchased, the Eisenbalm Dispatch has continued funding
            a new obscure charity each week. Without announcement. Without
            ceremony. That is how the machine operates.
          </Text>
        )}

        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          A tube of Jesse A. Eisenbalm lip balm lasts approximately six weeks
          under normal conditions. If yours is running low, this is the
          appropriate moment to consider a replacement.
        </Text>

        <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />

        <Text style={{ fontSize: '14px', color: '#666', margin: '0 0 12px' }}>
          This is not a countdown. There is no scarcity mechanic. Release 001
          is a finite run and we are being straightforward about that without
          manufacturing urgency.
        </Text>

        <Text style={{ fontSize: '14px', color: '#555', margin: '0' }}>
          If you would like another tube, the shop is still open.
        </Text>
      </Section>
    </MarketingLayout>
  )
}
