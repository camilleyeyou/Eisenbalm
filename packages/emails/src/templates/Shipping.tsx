// TODO(Andrew): voice sign-off required before live sending
import { Heading, Section, Text } from '@react-email/components'
import React from 'react'
import TransactionalLayout from '../layouts/TransactionalLayout'
import type { RenderData } from '../render'

type Props = Pick<RenderData, 'order' | 'charity' | 'postalAddress'>

export default function Shipping({ order, charity, postalAddress }: Props) {
  void order // charity resolution uses order.charitySlug upstream

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
          It has been handed to the carrier.
        </Heading>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          Your lip balm is in transit. Another machine now knows where you live.
          This is the standard arrangement.
        </Text>
        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          Estimated delivery: a few days. The carrier will not share further
          details with us, and we will not pretend otherwise.
        </Text>
        {/* TODO: real tracking when carrier integration exists */}
        <Text style={{ fontSize: '14px', color: '#666', margin: '0' }}>
          You will receive one more message when the package is expected to
          arrive.
        </Text>
      </Section>
    </TransactionalLayout>
  )
}
