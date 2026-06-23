/**
 * Wave 0 scaffold — Phase 26 PRV-01/PRV-02: Preview route + frame-ancestors CSP tests.
 *
 * All tests are `it.skip` — they document what WILL be verified in Plan 26-04
 * once the preview route is implemented. This file runs green (all skipped)
 * with zero infrastructure changes.
 *
 * TODO (Plan 26-04): Remove `it.skip` and implement the assertions after:
 *   - apps/web/app/preview/[token]/page.tsx is created
 *   - next.config.ts adds `frame-ancestors` CSP for draft-preview origins
 *   - apps/web/lib/preview-token.ts implements HMAC token verification
 *
 * Referenced spec:
 *   API_CONTRACTS §26.8 — Draft-preview route
 *   Token format: HMAC-SHA256(key=PREVIEW_SECRET, msg="{runId}:{windowMs}")
 *   5-minute window: windowMs = Math.floor(Date.now() / (5 * 60 * 1000))
 *   CSP: frame-ancestors 'self' https://{DISPATCH_CONTROL_ORIGIN}
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const WEB_APP_ROOT = join(__dirname, '..')

describe('Preview route (Plan 26-04)', () => {
  it.skip('TODO (Plan 26-04): preview page file exists at apps/web/app/preview/[token]/page.tsx', () => {
    const previewPagePath = join(WEB_APP_ROOT, 'app', 'preview', '[token]', 'page.tsx')
    expect(existsSync(previewPagePath)).toBe(true)
  })

  it.skip('TODO (Plan 26-04): preview page exports a default React component', () => {
    const previewPagePath = join(WEB_APP_ROOT, 'app', 'preview', '[token]', 'page.tsx')
    const source = readFileSync(previewPagePath, 'utf-8')
    // Must export a default React component (server component or client)
    expect(source).toMatch(/export default/)
  })

  it.skip('TODO (Plan 26-04): preview page validates token before rendering (no token = 401 or redirect)', () => {
    // The preview page must verify the HMAC token from the URL path.
    // If the token is invalid or expired (> 5-minute window), the page
    // must return a 401 response or redirect to /not-found.
    // Verified by: integration test against Next.js dev server or
    // unit test of the token-verification helper.
    const previewPagePath = join(WEB_APP_ROOT, 'app', 'preview', '[token]', 'page.tsx')
    const source = readFileSync(previewPagePath, 'utf-8')
    // Must reference token verification
    expect(source).toMatch(/verify.*token|token.*verify|HMAC|preview.?token/i)
  })
})

describe('Preview token helper (Plan 26-04)', () => {
  it.skip('TODO (Plan 26-04): apps/web/lib/preview-token.ts exists', () => {
    const tokenLibPath = join(WEB_APP_ROOT, 'lib', 'preview-token.ts')
    expect(existsSync(tokenLibPath)).toBe(true)
  })

  it.skip('TODO (Plan 26-04): preview-token.ts exports generatePreviewToken and verifyPreviewToken', () => {
    const tokenLibPath = join(WEB_APP_ROOT, 'lib', 'preview-token.ts')
    const source = readFileSync(tokenLibPath, 'utf-8')
    expect(source).toMatch(/export.*generatePreviewToken/)
    expect(source).toMatch(/export.*verifyPreviewToken/)
  })

  it.skip('TODO (Plan 26-04): token uses 5-minute sliding window (windowMs = floor(Date.now() / 300_000))', () => {
    const tokenLibPath = join(WEB_APP_ROOT, 'lib', 'preview-token.ts')
    const source = readFileSync(tokenLibPath, 'utf-8')
    // 300_000 ms = 5 minutes; the window math must be present
    expect(source).toMatch(/300.?000|5 \* 60|300_000/)
  })

  it.skip('TODO (Plan 26-04): token is HMAC-SHA256 (not MD5, not SHA1)', () => {
    const tokenLibPath = join(WEB_APP_ROOT, 'lib', 'preview-token.ts')
    const source = readFileSync(tokenLibPath, 'utf-8')
    expect(source).toMatch(/sha256|SHA-256/i)
  })
})

describe('next.config.ts frame-ancestors CSP (Plan 26-04)', () => {
  it.skip('TODO (Plan 26-04): next.config.ts sets frame-ancestors for preview route', () => {
    // next.config.ts must add a Content-Security-Policy header for the
    // /preview/* route with: frame-ancestors 'self' https://{DISPATCH_CONTROL_ORIGIN}
    // This prevents the preview iframe from being embedded on arbitrary origins.
    const nextConfigPath = join(WEB_APP_ROOT, 'next.config.ts')
    if (!existsSync(nextConfigPath)) {
      throw new Error('next.config.ts does not exist — create it in Plan 26-04')
    }
    const source = readFileSync(nextConfigPath, 'utf-8')
    expect(source).toMatch(/frame-ancestors/)
  })

  it.skip('TODO (Plan 26-04): frame-ancestors is scoped to /preview/* (not site-wide)', () => {
    // The frame-ancestors policy must be on the preview route only.
    // Setting it site-wide would prevent legitimate embeds elsewhere.
    const nextConfigPath = join(WEB_APP_ROOT, 'next.config.ts')
    const source = readFileSync(nextConfigPath, 'utf-8')
    // Should reference /preview path when setting frame-ancestors
    expect(source).toMatch(/preview/)
    expect(source).toMatch(/frame-ancestors/)
  })
})

describe('Sanity deferred: source.destination render (Plan 26-04)', () => {
  it.skip('TODO (Plan 26-04): preview page renders the correct issue content for the run_id in the token', () => {
    // The preview page must resolve run_id → sanityIssueId (from pipelineRuns)
    // then fetch the issue via GROQ and render it as the normal issue page.
    // Verified by: integration test with a real Sanity draft document.
    // This test is deferred to Plan 26-04 integration test phase.
  })
})
