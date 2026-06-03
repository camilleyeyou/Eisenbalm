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
import { Fraunces, Newsreader, IBM_Plex_Mono } from 'next/font/google'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'
import { serializeThemeCss } from '@/lib/theme'
import { SITE_NAME, SITE_DESCRIPTION, getSiteUrl } from '@/lib/site'
import './globals.css'

// ─── Fonts (next/font/google → CSS variables) ─────────────────────────────

const fontDisplay = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-loaded',
  axes: ['opsz'],
  // Fraunces is a variable font — axes requires weight='variable' or omitted.
  // With axes defined, omit weight to load the full variable range.
  style: ['normal', 'italic'],
})

const fontBody = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-loaded',
  axes: ['opsz'],
  // Newsreader is a variable font — same pattern as Fraunces above.
  style: ['normal', 'italic'],
})

const fontUi = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-loaded',
  weight: ['400', '500'],
  // No axes — IBM Plex Mono is not a variable font
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
  themeColor: '#FBFAF6',
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
        {/* Skip-to-content link — first focusable element per WCAG 2.4.1.
            Visually hidden via sr-only until keyboard-focused, then revealed
            with a readable background. Targets <main id="main"> below.
            The global :focus-visible ring in globals.css applies automatically. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[color:var(--color-bg)] focus:px-4 focus:py-2 focus:font-ui focus:text-[14px] focus:text-[color:var(--color-text)]"
        >
          Skip to content
        </a>
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
