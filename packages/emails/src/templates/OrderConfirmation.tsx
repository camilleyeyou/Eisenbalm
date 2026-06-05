// TODO(Andrew): voice sign-off required before live sending
import { Heading, Section, Text } from '@react-email/components'
import React from 'react'
import TransactionalLayout from '../layouts/TransactionalLayout'
import type { RenderData } from '../render'

type Props = Pick<RenderData, 'order' | 'charity' | 'postalAddress'>

export default function OrderConfirmation({ order, charity, postalAddress }: Props) {
  const amountDisplay = `$${(order.amountTotal / 100).toFixed(2)}`

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
          Order confirmed.
        </Heading>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          {amountDisplay} received. One unit of Jesse A. Eisenbalm lip balm has
          entered the fulfillment queue.
        </Text>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          One hundred percent of proceeds fund{' '}
          {charity
            ? `${charity.name}${charity.location ? `, ${charity.location}` : ''}`
            : "this week's featured charity"}
          . That is not a marketing claim. That is where the money went.
        </Text>
        <Text style={{ fontSize: '14px', color: '#666', margin: '0 0 12px' }}>
          You will receive a shipping notification when the package leaves the
          building. No further action is required on your part.
        </Text>
      </Section>
    </TransactionalLayout>
  )
}
