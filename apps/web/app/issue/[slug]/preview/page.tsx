/**
 * Draft preview route — Plan 26-04.
 *
 * Token-guarded Server Component that renders the exact Phase 19 magazine
 * layout from the Sanity DRAFT (`previewDrafts` perspective). Used by
 * dispatch-control to iframe a WYSIWYG preview of the issue before approval
 * (D-09 fidelity).
 *
 * Security model:
 *   - Verifies a 5-minute HMAC token before any Sanity read (verifyPreviewToken).
 *   - Uses server-only sanityPreviewClient (SANITY_API_TOKEN never reaches browser).
 *   - frame-ancestors CSP is set per-route in next.config.ts (not globally).
 *   - noindex/nofollow so draft content is never indexed.
 *
 * URL: /issue/[slug]/preview?token=<hmac>&runId=<runId>
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Issue } from '@/lib/sanity/types'
import { verifyPreviewToken } from '@/lib/preview-token'
import { sanityPreviewClient } from '@/lib/sanity/preview-client'
import { QUERY_ISSUE_PREVIEW_BY_SLUG } from '@/lib/sanity/queries'
import { IssueLayout } from '@/components/issue/IssueLayout'

// ─── Unauthorized UI ──────────────────────────────────────────────────────────

function PreviewUnauthorized() {
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        color: '#1A1A1A',
        background: '#FAFAF8',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <p style={{ fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
          401 Unauthorized
        </p>
        <p style={{ marginTop: '1rem', fontSize: '1rem' }}>
          Unauthorized preview request.
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          The preview token is missing, expired, or invalid. Preview tokens expire after 5 minutes.
        </p>
      </div>
    </main>
  )
}

// ─── Unavailable UI ───────────────────────────────────────────────────────────

function PreviewUnavailable() {
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        color: '#1A1A1A',
        background: '#FAFAF8',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <p style={{ fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
          Preview
        </p>
        <p style={{ marginTop: '1rem', fontSize: '1rem' }}>
          Preview unavailable. The draft issue may not be ready yet.
        </p>
      </div>
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PreviewPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string; runId?: string }>
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const [{ slug }, { token, runId }] = await Promise.all([params, searchParams])

  // Token gate — verifyPreviewToken MUST be called before any Sanity fetch.
  // An invalid/missing token returns 401 immediately.
  const authorized = verifyPreviewToken(token, runId, slug)
  if (!authorized) {
    return <PreviewUnauthorized />
  }

  // Fetch the DRAFT issue using the server-only previewDrafts client.
  // QUERY_ISSUE_PREVIEW_BY_SLUG has no status == "published" filter.
  const issue = await sanityPreviewClient.fetch<Issue>(
    QUERY_ISSUE_PREVIEW_BY_SLUG,
    { slug },
  )

  if (!issue) {
    return <PreviewUnavailable />
  }

  return (
    <>
      {/* Prevent indexing of draft content */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <meta name="robots" content="noindex,nofollow" />
      <IssueLayout issue={issue} slug={slug} noindex />
    </>
  )
}
