import { Body, Container, Head, Html } from '@react-email/components'
import React from 'react'
import Footer, { type FooterProps } from './Footer'

export interface MarketingLayoutProps {
  children: React.ReactNode
  charity?: FooterProps['charity']
  postalAddress?: string | null
  unsubscribeToken?: string | null
  baseUrl?: string
}

/**
 * Layout for marketing emails (E4–E8).
 *
 * Always passes unsubscribeToken to Footer — unsubscribe link rendered.
 * Required by CAN-SPAM and Gmail/Yahoo 2024 bulk-sender rules.
 */
export default function MarketingLayout({
  children,
  charity,
  postalAddress,
  unsubscribeToken,
  baseUrl,
}: MarketingLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Body
        style={{
          backgroundColor: '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: '0',
          padding: '0',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '24px',
          }}
        >
          {children}
          <Footer
            charity={charity}
            postalAddress={postalAddress}
            unsubscribeToken={unsubscribeToken ?? undefined}
            baseUrl={baseUrl}
          />
        </Container>
      </Body>
    </Html>
  )
}
