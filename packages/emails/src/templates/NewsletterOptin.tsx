// TODO(Andrew): voice sign-off required before live sending
import { Heading, Hr, Section, Text } from '@react-email/components'
import React from 'react'
import MarketingLayout from '../layouts/MarketingLayout'
import type { RenderData } from '../render'

type Props = Pick<RenderData, 'order' | 'charity' | 'others' | 'postalAddress' | 'unsubscribeToken'> & {
  baseUrl?: string
}

/**
 * E7 — The hinge. Renders OTHER charities (not the one this order funded)
 * to prove the Dispatch features more than one. CTA opts into the weekly
 * charity newsletter. v1 only captures consent — does not promise the
 * newsletter is already sending.
 */
export default function NewsletterOptin({
  order,
  charity,
  others,
  postalAddress,
  unsubscribeToken,
  baseUrl = '',
}: Props) {
  void order

  const hasOthers = others && others.length > 0

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
          There are more.
        </Heading>

        {hasOthers ? (
          <>
            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
              Every week, the Eisenbalm Dispatch features a different obscure
              charity. Since your purchase, the machine has continued selecting.
              Among the others:
            </Text>
            <ul
              style={{
                margin: '0 0 20px',
                paddingLeft: '20px',
              }}
            >
              {others.map((o, i) => (
                <li key={i} style={{ fontSize: '16px', color: '#333', marginBottom: '6px' }}>
                  {o.name}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
            Every week, the Eisenbalm Dispatch features a different obscure
            charity. Since your purchase, the machine has continued selecting.
            There are more.
          </Text>
        )}

        <Hr style={{ borderColor: '#e5e5e5', margin: '20px 0' }} />

        <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 12px' }}>
          If you would like to know which charity receives the following
          week&rsquo;s proceeds — before the issue publishes — you can opt in
          to the weekly Eisenbalm Dispatch email.
        </Text>

        <Text style={{ fontSize: '14px', color: '#666', margin: '0 0 12px' }}>
          One email per week. Charity-focused. In Jesse&rsquo;s voice. No
          announcements, no promotions. The newsletter does not exist yet as a
          live send; signing up reserves your place.
        </Text>

        <Text style={{ fontSize: '14px', color: '#555', margin: '0' }}>
          To opt in, visit{' '}
          <a href={`${baseUrl}/subscribe`} style={{ color: '#111' }}>
            {baseUrl}/subscribe
          </a>{' '}
          or reply to this email with &ldquo;subscribe&rdquo; in the subject.
        </Text>
      </Section>
    </MarketingLayout>
  )
}
