/**
 * Per-issue layout. CONTEXT.md D-10 / D-11 / D-20.
 *
 * MED-01/MED-02: when DESIGNAGENT_SUPPRESSED is set, themeCss is '' and
 * ThemeApplier is suppressed — the globals.css :root house palette is the
 * sole source of colors/fonts. Flip the env var + redeploy to restore
 * per-issue theming with no code change.
 *
 * LAYER 1 — server side (FOUC-free first paint):
 *   Fetches the issue, calls serializeThemeCss(issue.theme), and inlines the
 *   resulting CSS in a <style> tag before children render. This guarantees the
 *   correct theme is applied on the very first byte of HTML, with no flash of
 *   unstyled content.
 *
 * LAYER 2 — client side (defense-in-depth):
 *   Renders <ThemeApplier theme={issue.theme} /> which re-runs applyTheme()
 *   after hydration via useEffect. Catches any client-side mutation that might
 *   bypass the server style.
 *
 * Security: serializeThemeCss validates every value before building the CSS
 * string — no raw theme data from Sanity reaches the <style> innerHTML.
 *
 * If no published issue is found for the slug, children render with the brand
 * default theme (serializeThemeCss(null) in the root layout takes over).
 */
import { sanityClient } from '@/lib/sanity/client'
import { serializeThemeCss } from '@/lib/theme'
import { ThemeApplier } from '@/components/issue/ThemeApplier'
import type { IssueTheme } from '@/lib/sanity/types'
import { groq } from 'next-sanity'

interface IssueLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

/** Minimal query — theme fields only for layout. Page.tsx fetches the full issue. */
const QUERY_ISSUE_THEME = groq`
  *[_type == "weeklyIssue" && slug.current == $slug && status == "published"][0] {
    theme {
      primaryColor,
      accentColor,
      backgroundColor,
      textColor,
      fontDisplay,
      fontBody,
    }
  }
`

type ThemeResult = { theme: IssueTheme } | null

export default async function IssueLayout({ children, params }: IssueLayoutProps) {
  const { slug } = await params

  // MED-02: request-time server read. NEVER NEXT_PUBLIC_ (that bakes at build time).
  const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'

  let theme: IssueTheme = null
  try {
    const result: ThemeResult = await sanityClient.fetch(QUERY_ISSUE_THEME, { slug })
    theme = result?.theme ?? null
  } catch {
    // If the fetch fails, fall through to brand defaults in serializeThemeCss(null).
    // The page will still render; just without the per-issue theme.
  }

  // MED-01: when suppressed, emit empty string so globals.css :root dark palette
  // wins the cascade. NOT serializeThemeCss(null) — that emits the LIGHT palette.
  const themeCss = suppressed ? '' : serializeThemeCss(theme)

  return (
    <>
      {/*
       * LAYER 1: Inline <style> for FOUC-free first paint.
       * Content is validated inside serializeThemeCss — safe to embed.
       */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />

      {/*
       * LAYER 2: Client component re-runs applyTheme on hydration.
       * suppressed={suppressed} short-circuits applyTheme when MED-02 flag is ON.
       */}
      <ThemeApplier theme={theme} suppressed={suppressed} />

      {children}
    </>
  )
}
