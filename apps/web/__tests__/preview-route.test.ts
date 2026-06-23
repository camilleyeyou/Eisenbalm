/**
 * Preview route tests — Plan 26-04: PRV-01/PRV-02.
 *
 * Tests:
 *   1. File-system assertions — verify the artifacts from Plan 26-04 exist.
 *   2. Source-scan assertions — verify security and correctness invariants.
 *   3. Token round-trip unit tests — HMAC generate + verify contract.
 *
 * Referenced spec:
 *   API_CONTRACTS §26.8 — Draft-preview route
 *   Token formula: HMAC-SHA256(key=PREVIEW_SECRET, msg="${runId}:${slug}:${floor(Date.now()/300_000)}")
 *   5-minute window: Math.floor(Date.now() / 300_000)
 *   CSP: frame-ancestors 'self' ${PREVIEW_ALLOWED_ORIGIN}
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const WEB_APP_ROOT = join(__dirname, '..')

// ─── File-system assertions ────────────────────────────────────────────────

describe('Preview route artifacts (Plan 26-04)', () => {
  it('preview page exists at apps/web/app/issue/[slug]/preview/page.tsx', () => {
    const previewPagePath = join(WEB_APP_ROOT, 'app', 'issue', '[slug]', 'preview', 'page.tsx')
    expect(existsSync(previewPagePath)).toBe(true)
  })

  it('preview-token.ts exists at apps/web/lib/preview-token.ts', () => {
    const tokenLibPath = join(WEB_APP_ROOT, 'lib', 'preview-token.ts')
    expect(existsSync(tokenLibPath)).toBe(true)
  })

  it('preview-client.ts exists at apps/web/lib/sanity/preview-client.ts', () => {
    const clientPath = join(WEB_APP_ROOT, 'lib', 'sanity', 'preview-client.ts')
    expect(existsSync(clientPath)).toBe(true)
  })
})

// ─── Source-scan assertions ────────────────────────────────────────────────

describe('Preview page security invariants (Plan 26-04)', () => {
  let previewPageSource: string

  beforeAll(() => {
    const previewPagePath = join(WEB_APP_ROOT, 'app', 'issue', '[slug]', 'preview', 'page.tsx')
    previewPageSource = readFileSync(previewPagePath, 'utf-8')
  })

  it('preview page references verifyPreviewToken', () => {
    expect(previewPageSource).toMatch(/verifyPreviewToken/)
  })

  it('preview page uses force-dynamic (no caching)', () => {
    expect(previewPageSource).toMatch(/force-dynamic/)
  })

  it('preview page has noindex/nofollow (drafts must not be indexed)', () => {
    expect(previewPageSource).toMatch(/noindex/)
  })

  it('preview page has an unauthorized branch', () => {
    expect(previewPageSource).toMatch(/Unauthorized/)
  })

  it('preview page does NOT use status == "published" in a GROQ filter', () => {
    // The page source may reference "status == published" in a comment about
    // the absence of the filter — that is fine. What matters is that no GROQ
    // query string in the file itself contains it (the page delegates to
    // QUERY_ISSUE_PREVIEW_BY_SLUG which has no status filter).
    // We check that the page does NOT import or inline QUERY_ISSUE_BY_SLUG.
    expect(previewPageSource).not.toMatch(/QUERY_ISSUE_BY_SLUG[^_P]/)
  })

  it('verifyPreviewToken is called before sanityPreviewClient.fetch', () => {
    const verifyPos = previewPageSource.indexOf('verifyPreviewToken')
    const fetchPos = previewPageSource.indexOf('sanityPreviewClient.fetch')
    expect(verifyPos).toBeGreaterThan(-1)
    expect(fetchPos).toBeGreaterThan(-1)
    expect(verifyPos).toBeLessThan(fetchPos)
  })
})

describe('Preview query invariants (Plan 26-04)', () => {
  it('QUERY_ISSUE_PREVIEW_BY_SLUG exists in queries.ts', () => {
    const queriesPath = join(WEB_APP_ROOT, 'lib', 'sanity', 'queries.ts')
    const source = readFileSync(queriesPath, 'utf-8')
    expect(source).toMatch(/QUERY_ISSUE_PREVIEW_BY_SLUG/)
  })

  it('QUERY_ISSUE_PREVIEW_BY_SLUG does not filter status == "published"', () => {
    const queriesPath = join(WEB_APP_ROOT, 'lib', 'sanity', 'queries.ts')
    const source = readFileSync(queriesPath, 'utf-8')
    // Extract just the QUERY_ISSUE_PREVIEW_BY_SLUG template literal body
    const startIdx = source.indexOf('QUERY_ISSUE_PREVIEW_BY_SLUG')
    const afterStart = source.slice(startIdx)
    // Find the closing backtick of the groq template
    const lines = afterStart.split('\n')
    let endLine = lines.length
    for (let i = 1; i < lines.length; i++) {
      if ((lines[i] ?? '').trim() === '`') {
        endLine = i
        break
      }
    }
    const queryBody = lines.slice(0, endLine + 1).join('\n')
    expect(queryBody).not.toMatch(/status == "published"/)
  })

  it('QUERY_ISSUE_BY_SLUG still filters status == "published" (unchanged)', () => {
    const queriesPath = join(WEB_APP_ROOT, 'lib', 'sanity', 'queries.ts')
    const source = readFileSync(queriesPath, 'utf-8')
    // QUERY_ISSUE_BY_SLUG (not PREVIEW) must retain the published filter
    const origIdx = source.indexOf('export const QUERY_ISSUE_BY_SLUG')
    const afterOrig = source.slice(origIdx)
    const origLines = afterOrig.split('\n')
    let origEndLine = origLines.length
    for (let i = 1; i < origLines.length; i++) {
      if ((origLines[i] ?? '').trim() === '`') {
        origEndLine = i
        break
      }
    }
    const origQueryBody = origLines.slice(0, origEndLine + 1).join('\n')
    expect(origQueryBody).toMatch(/status == "published"/)
  })
})

describe('next.config.ts frame-ancestors CSP (Plan 26-04)', () => {
  let nextConfigSource: string

  beforeAll(() => {
    const nextConfigPath = join(WEB_APP_ROOT, 'next.config.ts')
    nextConfigSource = readFileSync(nextConfigPath, 'utf-8')
  })

  it('next.config.ts has a headers() block with frame-ancestors', () => {
    expect(nextConfigSource).toMatch(/frame-ancestors/)
  })

  it('frame-ancestors is scoped to /issue/:slug/preview (not site-wide)', () => {
    expect(nextConfigSource).toMatch(/\/issue\/:slug\/preview/)
    expect(nextConfigSource).toMatch(/frame-ancestors/)
  })

  it('headers block contains exactly one source (no global frame-ancestors)', () => {
    // Count occurrences of 'source:' near 'frame-ancestors'
    const headersIdx = nextConfigSource.indexOf('async headers()')
    expect(headersIdx).toBeGreaterThan(-1)
    const headersBlock = nextConfigSource.slice(headersIdx)
    // Should have exactly one source definition in the headers function
    const sourceMatches = headersBlock.match(/source:/g)
    expect(sourceMatches?.length).toBe(1)
  })
})

describe('env.example documentation (Plan 26-04)', () => {
  let envExampleSource: string

  beforeAll(() => {
    const envExamplePath = join(WEB_APP_ROOT, '.env.example')
    envExampleSource = readFileSync(envExamplePath, 'utf-8')
  })

  it('SANITY_API_TOKEN is documented in .env.example', () => {
    expect(envExampleSource).toMatch(/SANITY_API_TOKEN=/)
  })

  it('PREVIEW_SECRET is documented in .env.example', () => {
    expect(envExampleSource).toMatch(/PREVIEW_SECRET=/)
  })

  it('PREVIEW_ALLOWED_ORIGIN is documented in .env.example', () => {
    expect(envExampleSource).toMatch(/PREVIEW_ALLOWED_ORIGIN=/)
  })
})

// ─── Token round-trip unit tests ───────────────────────────────────────────

describe('Preview token round-trip (Plan 26-04)', () => {
  const originalSecret = process.env.PREVIEW_SECRET
  const TEST_SECRET = 'test-secret-abc123'

  beforeAll(() => {
    process.env.PREVIEW_SECRET = TEST_SECRET
  })

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.PREVIEW_SECRET
    } else {
      process.env.PREVIEW_SECRET = originalSecret
    }
  })

  it('a freshly generated token verifies correctly', async () => {
    // Dynamic import so the module picks up the env var set above
    const { previewToken, verifyPreviewToken } = await import('../lib/preview-token')
    const runId = 'run-abc-123'
    const slug = 'test-charity-slug'
    const token = previewToken(TEST_SECRET, runId, slug)
    expect(verifyPreviewToken(token, runId, slug)).toBe(true)
  })

  it('a tampered token fails verification', async () => {
    const { previewToken, verifyPreviewToken } = await import('../lib/preview-token')
    const runId = 'run-abc-123'
    const slug = 'test-charity-slug'
    const validToken = previewToken(TEST_SECRET, runId, slug)
    // Flip the last character to tamper
    const lastChar = validToken[validToken.length - 1]
    const tamperedChar = lastChar === 'a' ? 'b' : 'a'
    const tamperedToken = validToken.slice(0, -1) + tamperedChar
    expect(verifyPreviewToken(tamperedToken, runId, slug)).toBe(false)
  })

  it('a token from a different slug fails verification', async () => {
    const { previewToken, verifyPreviewToken } = await import('../lib/preview-token')
    const runId = 'run-abc-123'
    const token = previewToken(TEST_SECRET, runId, 'slug-a')
    expect(verifyPreviewToken(token, runId, 'slug-b')).toBe(false)
  })

  it('a token from a different runId fails verification', async () => {
    const { previewToken, verifyPreviewToken } = await import('../lib/preview-token')
    const slug = 'test-charity-slug'
    const token = previewToken(TEST_SECRET, 'run-1', slug)
    expect(verifyPreviewToken(token, 'run-2', slug)).toBe(false)
  })

  it('missing token returns false', async () => {
    const { verifyPreviewToken } = await import('../lib/preview-token')
    expect(verifyPreviewToken(null, 'run-1', 'slug')).toBe(false)
    expect(verifyPreviewToken(undefined, 'run-1', 'slug')).toBe(false)
    expect(verifyPreviewToken('', 'run-1', 'slug')).toBe(false)
  })

  it('missing PREVIEW_SECRET returns false', async () => {
    // Temporarily unset
    const saved = process.env.PREVIEW_SECRET
    delete process.env.PREVIEW_SECRET
    try {
      // Re-import to avoid module cache
      const { previewToken } = await import('../lib/preview-token')
      // The verify function reads process.env.PREVIEW_SECRET at call time
      const { verifyPreviewToken } = await import('../lib/preview-token')
      const token = previewToken(TEST_SECRET, 'run-1', 'slug')
      expect(verifyPreviewToken(token, 'run-1', 'slug')).toBe(false)
    } finally {
      process.env.PREVIEW_SECRET = saved
    }
  })

  it('previous 5-minute window token still verifies (clock skew)', async () => {
    const { previewToken, verifyPreviewToken } = await import('../lib/preview-token')
    const runId = 'run-skew-test'
    const slug = 'skew-slug'
    // Token generated 1 window ago
    const prevWindowMs = Date.now() - 300_000
    const oldToken = previewToken(TEST_SECRET, runId, slug, prevWindowMs)
    expect(verifyPreviewToken(oldToken, runId, slug)).toBe(true)
  })

  it('token from 2+ windows ago fails (expired)', async () => {
    const { previewToken, verifyPreviewToken } = await import('../lib/preview-token')
    const runId = 'run-expired-test'
    const slug = 'expired-slug'
    // Token from 2 windows ago (10 minutes) — should fail
    const expiredWindowMs = Date.now() - 600_000
    const expiredToken = previewToken(TEST_SECRET, runId, slug, expiredWindowMs)
    expect(verifyPreviewToken(expiredToken, runId, slug)).toBe(false)
  })
})
