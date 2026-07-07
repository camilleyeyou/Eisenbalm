// Server Component — do NOT add 'use client' here (Pitfall 3).
// ClerkProvider wraps a client-side ConvexClientProvider.
import type { Metadata } from 'next'
import { Newsreader, Lora, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import ConvexClientProvider from '@/components/ConvexClientProvider'
import './globals.css'

// ─── 1c fonts (next/font/google → CSS variables, CHR-01) ──────────────────
// Source: docs/design/dispatch-control-v2/Dispatch Control.dc.html

const fontDisplay = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  axes: ['opsz'],
  // Newsreader is a variable font — omit `weight` when axes are present.
  style: ['normal', 'italic'],
})

const fontBody = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lora',
  weight: ['400', '500', '600'],
  // Lora is not a variable font in next/font/google — declare weights explicitly.
})

const fontUi = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
})

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500'],
})

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
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable} ${fontMono.variable}`}
      >
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
