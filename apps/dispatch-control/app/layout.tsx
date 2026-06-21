// Server Component — do NOT add 'use client' here (Pitfall 3).
// ClerkProvider wraps a client-side ConvexClientProvider.
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from '@/components/ConvexClientProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eisenbalm Dispatch Control',
  description: 'Mission Control dashboard for the Eisenbalm editorial pipeline.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
