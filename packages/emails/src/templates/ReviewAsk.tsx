// TODO(Andrew): voice sign-off required before live sending
import { Heading, Section, Text } from '@react-email/components'
import React from 'react'
import MarketingLayout from '../layouts/MarketingLayout'
import type { RenderData } from '../render'

type Props = Pick<RenderData, 'order' | 'charity' | 'postalAddress' | 'unsubscribeToken'> & {
  baseUrl?: string
}

export default function ReviewAsk({
  order,
  charity,
  postalAddress,
  unsubscribeToken,
  baseUrl,
}: Props) {
  void order

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
          A brief and direct request.
        </Heading>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          If the lip balm has been in your rotation for two weeks, you have
          formed an opinion. We would like to know what it is.
        </Text>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          A one-sentence review is sufficient. A paragraph is welcome. Both
          help the next person decide whether to purchase.
        </Text>
        <Text style={{ fontSize: '14px', color: '#666', margin: '0 0 12px' }}>
          Leave a review wherever you purchased, or reply to this email. Either
          method works. There is no incentive beyond the knowledge that you
          said a true thing.
        </Text>
        <Text style={{ fontSize: '14px', color: '#555', margin: '0' }}>
          We appreciate it.
        </Text>
      </Section>
    </MarketingLayout>
  )
}
