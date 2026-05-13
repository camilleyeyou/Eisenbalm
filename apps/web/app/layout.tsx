/**
 * Root layout. UI-SPEC Typography + Color System.
 *
 * Loads the three default fonts via next/font/google as CSS variables.
 * Renders SiteHeader + SiteFooter. Inlines default theme via
 * serializeThemeCss(null) — issue pages override with their own theme.
 * Wraps children in <TooltipProvider> so shadcn Tooltip primitives (used
 * by Plan 02-06's <AnchorCopyButton>) work without per-component providers.
 */
import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Lora, Inter } from 'next/font/google'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'
import { serializeThemeCss } from '@/lib/theme'
import { SITE_NAME, SITE_DESCRIPTION, getSiteUrl } from '@/lib/site'
import './globals.css'

// ─── Fonts (next/font/google → CSS variables) ─────────────────────────────

const fontDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-loaded',
  weight: ['600'],
})

const fontBody = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-loaded',
  weight: ['400'],
})

const fontUi = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-loaded',
  weight: ['400', '600'],
})

// ─── Site-level metadata ──────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og-default.png'],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#FAFAF8',
  colorScheme: 'light',
}

// ─── Layout ────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Default theme variables — issue layout overrides on /issue/[slug].
  const defaultThemeCss = serializeThemeCss(null)

  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable}`}
    >
      <head>
        {/*
          Inline <style> with the brand default theme. Issue layouts emit
          their own <style> after this one, overriding the variables.
          This avoids FOUC even before client JS runs.
        */}
        <style
          // Content is built entirely from validated values inside
          // serializeThemeCss — no user input.
          dangerouslySetInnerHTML={{ __html: defaultThemeCss }}
        />
      </head>
      <body className="flex min-h-screen flex-col font-body text-[color:var(--color-text)]">
        <ConvexClientProvider>
          <TooltipProvider delayDuration={0}>
            <SiteHeader />
            <main className="flex-1" id="main">
              {children}
            </main>
            <SiteFooter />
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
