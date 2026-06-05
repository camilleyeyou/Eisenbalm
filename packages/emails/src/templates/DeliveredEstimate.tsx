// TODO(Andrew): voice sign-off required before live sending
import { Heading, Section, Text } from '@react-email/components'
import React from 'react'
import TransactionalLayout from '../layouts/TransactionalLayout'
import type { RenderData } from '../render'

// EMAIL-08: copy uses "should reach you" / "on its way" / "estimated" framing only.
// No claim of a verified receipt. Carrier data unavailable.

type Props = Pick<RenderData, 'order' | 'charity' | 'postalAddress'>

export default function DeliveredEstimate({ order, charity, postalAddress }: Props) {
  void order

  return (
    <TransactionalLayout charity={charity} postalAddress={postalAddress}>
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
          It should reach you any day now.
        </Heading>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          Based on the estimated transit window, your package is on its way to
          you. We have no carrier data beyond that, so this is an estimate.
        </Text>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          If the package has not reached you within the next few days, contact
          us and we will look into it. We do not believe in writing off packages
          prematurely.
        </Text>
        <Text style={{ fontSize: '14px', color: '#666', margin: '0' }}>
          In a few days, a follow-up message will arrive with a note about the
          charity your purchase supported.
        </Text>
      </Section>
    </TransactionalLayout>
  )
}
