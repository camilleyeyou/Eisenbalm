import { Body, Container, Head, Html } from '@react-email/components'
import React from 'react'
import Footer, { type FooterProps } from './Footer'

export interface TransactionalLayoutProps {
  children: React.ReactNode
  charity?: FooterProps['charity']
  postalAddress?: string | null
}

/**
 * Layout for transactional emails (E1, E2, E3).
 *
 * Does NOT pass unsubscribeToken to Footer — no unsubscribe link rendered.
 * Transactional emails always send regardless of marketing opt-out.
 */
export default function TransactionalLayout({
  children,
  charity,
  postalAddress,
}: TransactionalLayoutProps) {
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
          <Footer charity={charity} postalAddress={postalAddress} />
        </Container>
      </Body>
    </Html>
  )
}
