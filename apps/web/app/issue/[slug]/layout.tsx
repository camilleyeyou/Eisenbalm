/**
 * Per-issue layout. CONTEXT.md D-10 / D-11 / D-20.
 *
 * Phase 19 (Plan 05): per-issue theming is RE-ENABLED unconditionally.
 * DESIGNAGENT_SUPPRESSED now affects ONLY the pipeline side (whether the
 * DesignAgent node runs) — it no longer gates web theming. The web layout
 * always calls serializeThemeCss(theme) so each issue's Sanity theme overrides
 * the oxblood/cream BRAND_DEFAULTS for accent + type tokens (DES-06, WEB-06).
 * Structure and motion are constant across issues; only color + font tokens change.
 *
 * LAYER 1 — server side (FOUC-free first paint):
 *   Fetches the issue, calls serializeThemeCss(issue.theme), and inlines the
 *   resulting CSS in a <style> tag before children render. This guarantees the
 *   correct theme is applied on the very first byte of HTML, with no flash of
 *   unstyled content.
 *
 * LAYER 2 — client side (defense-in-depth):
 *   Renders <ThemeApplier theme={issue.theme} suppressed={false} /> which
 *   re-runs applyTheme() after hydration via useEffect. Catches any client-side
 *   mutation that might bypass the server style.
 *
 * Security: serializeThemeCss validates every value before building the CSS
 * string — no raw theme data from Sanity reaches the <style> innerHTML.
 *
 * If no published issue is found for the slug, children render with the brand
 * default theme (serializeThemeCss(null) emits the BRAND_DEFAULTS :root block).
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

  let theme: IssueTheme = null
  try {
    const result: ThemeResult = await sanityClient.fetch(QUERY_ISSUE_THEME, { slug })
    theme = result?.theme ?? null
  } catch {
    // If the fetch fails, fall through to brand defaults in serializeThemeCss(null).
    // The page will still render; just without the per-issue theme.
  }

  // Phase 19 (Plan 05): theming is unconditional — always emit the :root block.
  // serializeThemeCss(null) emits BRAND_DEFAULTS; serializeThemeCss(theme) overlays
  // the per-issue accent + type tokens from Sanity (DES-06, WEB-06).
  const themeCss = serializeThemeCss(theme)

  return (
    <>
      {/*
       * LAYER 1: Inline <style> for FOUC-free first paint.
       * Content is validated inside serializeThemeCss — safe to embed.
       */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />

      {/*
       * LAYER 2: Client component re-runs applyTheme on hydration (defense-in-depth).
       * suppressed={false} — theming is always active on the web side (Phase 19).
       */}
      <ThemeApplier theme={theme} suppressed={false} />

      {children}
    </>
  )
}
