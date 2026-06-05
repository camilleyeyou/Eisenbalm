// TODO(Andrew): voice sign-off required before live sending
import { Heading, Hr, Section, Text } from '@react-email/components'
import React from 'react'
import MarketingLayout from '../layouts/MarketingLayout'
import type { RenderData } from '../render'

type Props = Pick<RenderData, 'order' | 'charity' | 'postalAddress' | 'unsubscribeToken'> & {
  baseUrl?: string
}

/**
 * E5 — THE ANCHOR. Full-screen version of the funded-charity story.
 * "$8.99 went here." with charity name, location, focus area, and mission statement.
 * Graceful fallback when charity data is null or missing charitySlug.
 */
export default function CharityReceipt({
  order,
  charity,
  postalAddress,
  unsubscribeToken,
  baseUrl,
}: Props) {
  const amountDisplay = `$${(order.amountTotal / 100).toFixed(2)}`

  return (
    <MarketingLayout
      charity={charity}
      postalAddress={postalAddress}
      unsubscribeToken={unsubscribeToken}
      baseUrl={baseUrl}
    >
      <Section>
        <Text
          style={{
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#999',
            margin: '0 0 8px',
          }}
        >
          Where your {amountDisplay} went
        </Text>

        {charity ? (
          <>
            <Heading
              as="h1"
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#111',
                margin: '0 0 4px',
                lineHeight: '1.2',
              }}
            >
              {charity.name}
            </Heading>

            {charity.location && (
              <Text
                style={{
                  fontSize: '14px',
                  color: '#777',
                  margin: '0 0 20px',
                }}
              >
                {charity.location}
              </Text>
            )}

            <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />

            {charity.focusArea && (
              <Text
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#999',
                  margin: '0 0 8px',
                }}
              >
                {charity.focusArea}
              </Text>
            )}

            {charity.missionStatement && (
              <Text
                style={{
                  fontSize: '18px',
                  color: '#222',
                  margin: '0 0 20px',
                  lineHeight: '1.5',
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{charity.missionStatement}&rdquo;
              </Text>
            )}

            <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />

            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
              This is not a footnote. This is the organization that received
              your money. One hundred percent of it. That is the arrangement.
            </Text>

            <Text style={{ fontSize: '14px', color: '#666', margin: '0' }}>
              A new charity is featured every week. The machine selects.
              Andrew approves. The money moves.
            </Text>
          </>
        ) : (
          <>
            <Heading
              as="h1"
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: '#111',
                margin: '0 0 16px',
                lineHeight: '1.2',
              }}
            >
              This week&rsquo;s featured charity
            </Heading>
            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
              Your {amountDisplay} was sent to this week&rsquo;s featured charity in
              full. Charity details are available on the Eisenbalm Dispatch
              website.
            </Text>
            <Text style={{ fontSize: '14px', color: '#666', margin: '0' }}>
              One hundred percent of proceeds. That is the arrangement.
            </Text>
          </>
        )}
      </Section>
    </MarketingLayout>
  )
}
