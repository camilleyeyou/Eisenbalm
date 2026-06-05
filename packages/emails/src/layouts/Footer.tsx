import { Hr, Link, Section, Text } from '@react-email/components'
import React from 'react'

export interface FooterProps {
  charity?: {
    name: string
    location?: string
    focusArea?: string
    missionStatement?: string
  } | null
  postalAddress?: string | null
  unsubscribeToken?: string | null
  baseUrl?: string
}

/**
 * Email footer: funded-charity line, CAN-SPAM postal address, conditional unsubscribe link.
 *
 * Transactional layouts pass no unsubscribeToken — no unsubscribe link rendered.
 * Marketing layouts pass unsubscribeToken — unsubscribe link rendered.
 */
export default function Footer({
  charity,
  postalAddress,
  unsubscribeToken,
  baseUrl = '',
}: FooterProps) {
  const charityLine = charity
    ? `This order funded ${charity.name}${charity.location ? ', ' + charity.location : ''}.`
    : 'This order funded this week’s featured charity.'

  const postalLine = postalAddress ?? 'TODO(Andrew): postal address'

  return (
    <Section>
      <Hr
        style={{
          borderColor: '#e5e5e5',
          margin: '24px 0',
        }}
      />
      <Text
        style={{
          fontSize: '12px',
          color: '#666',
          margin: '0 0 8px',
        }}
      >
        {charityLine}
      </Text>
      <Text
        style={{
          fontSize: '11px',
          color: '#999',
          margin: '0 0 8px',
        }}
      >
        {/* TODO(Andrew): confirm postal address */}
        The Eisenbalm Dispatch &middot; {postalLine}
      </Text>
      {unsubscribeToken && (
        <Text
          style={{
            fontSize: '11px',
            color: '#999',
            margin: '0',
          }}
        >
          <Link
            href={`${baseUrl}/api/email/unsubscribe?token=${unsubscribeToken}`}
            style={{ color: '#999' }}
          >
            Unsubscribe from marketing emails
          </Link>{' '}
          &mdash; transactional receipts continue.
        </Text>
      )}
    </Section>
  )
}
