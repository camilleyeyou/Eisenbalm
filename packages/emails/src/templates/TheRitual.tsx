// TODO(Andrew): voice sign-off required before live sending
import { Heading, Hr, Section, Text } from '@react-email/components'
import React from 'react'
import MarketingLayout from '../layouts/MarketingLayout'
import type { RenderData } from '../render'

type Props = Pick<RenderData, 'order' | 'charity' | 'postalAddress' | 'unsubscribeToken'> & {
  baseUrl?: string
}

export default function TheRitual({
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
          The three-second pause.
        </Heading>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          Before applying, stop. Three seconds. Nothing is required of you in
          that interval.
        </Text>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          This is the ritual. It is not a meditation practice. It is not
          self-care in the contemporary sense. It is simply three seconds in
          which a machine is not telling you what to do.
        </Text>
        <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />
        <Text style={{ fontSize: '14px', color: '#555', margin: '0 0 12px' }}>
          Jesse A. Eisenbalm was formulated by a machine and applied by a
          human. That boundary is the product.
        </Text>
        <Text style={{ fontSize: '14px', color: '#666', margin: '0' }}>
          Stop. Breathe. Balm. In that order. Every time.
        </Text>
      </Section>
    </MarketingLayout>
  )
}
