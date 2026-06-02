---
status: complete
phase: 06-pdf-generation-webhook-chain
source: [06-VERIFICATION.md]
started: 2026-05-18T12:45:00Z
updated: 2026-06-02T00:30:00Z
---

## Current Test

CHAIN VERIFIED END-TO-END 2026-06-01. A signed publish webhook for issue-999601 drove the full chain to green: PDF rendered + uploaded (problemPdf = file-a73b428b…-pdf, 20444 bytes application/pdf), Convex pipelineRuns.status flipped to 'complete' at ~36s (= ~6s render/upload + 30s CDN delay + Vercel deploy), Vercel redeployed, and the live /issue/issue-999601 page now renders the "Download the Problem Statement Deck (PDF)" link pointing at the new CDN asset.

## Config landed 2026-06-01

- ✓ Sanity GROQ webhook created via management API — id `ke7h311yQAAOHbcJ`, name `publish-to-railway-pipeline`, dataset `production`, url `https://eisenbalm-pipeline-production.up.railway.app/webhook/sanity-publish`, filter `_type == "weeklyIssue" && status == "published"`, projection `{_id, _type, status, issueNumber, "runId": pipelineMetadata.runId}`, on [create, update], httpMethod POST, includeDrafts false, secret set (HMAC signing on), enabled.
- ✓ Railway `SANITY_WEBHOOK_SECRET` set by Andrew and confirmed to MATCH the Sanity webhook secret (a properly-signed test request returned HTTP 200 {"skipped":"not-published"}; an unsigned request returns 401).
- ⏳ Railway `VERCEL_DEPLOY_HOOK_URL` — not yet confirmed set. Required for _run_publisher's Vercel deploy step (test 3).

## Two latent Phase 6 bugs found + fixed during the 2026-06-01 smoke

The live smoke surfaced two bugs that had been latent since Phase 6 was built (its end-to-end smoke was always `autonomous: false` / pending, so the Publisher was never exercised on Railway):

1. **Null-theme KeyError** (commit `8f08ab9`) — Phase 12/14 suppressed per-issue themes (DESIGNAGENT_SUPPRESSED), so `weeklyIssue.theme.fontDisplay`/`fontBody` come back null. The renderer did a hard `theme['fontDisplay']` subscript → `KeyError`. Fix: `_theme_with_defaults()` overlays a house-palette default (warm paper / rust / gold + vendored Playfair Display / Source Serif Pro). +2 regression tests.
2. **fonts/ missing from Docker image** (commit `35ce465`) — the Dockerfile copied `src/` but not the vendored `fonts/` dir (which lives outside `src/`). On Railway, `FONTS_DIR=/app/fonts` didn't exist → `font_to_base64` raised `FileNotFoundError` at the render step. Fix: `COPY fonts/ ./fonts/`. + tripwire test.

Both crashed the Publisher BEFORE the PDF upload (problemPdf stayed null, Convex status never reached complete). Verified locally: render of the real empty-theme issue-999601 now produces a 20KB valid %PDF. Full pipeline suite 228 passing.

## Tests

### 1. End-to-end publish → PDF on Sanity + live page
expected: After publish, weeklyIssue.problemPdf is populated with a Sanity asset URL within ~60s; /issue/[slug] on Vercel renders the PDF download link; downloaded PDF opens as a valid %PDF with embedded fonts (not HTTP-loaded Google Fonts).
result: PASS — verified 2026-06-01 via signed publish webhook for issue-999601. problemPdf = file-a73b428bb275d0d997857af09c3dadb45cbab0ac-pdf; CDN URL https://cdn.sanity.io/files/6h1vd9mf/production/a73b428bb275d0d997857af09c3dadb45cbab0ac.pdf returns content-type application/pdf, content-length 20444, magic bytes %PDF-. Live /issue/issue-999601 renders the "Download the Problem Statement Deck (PDF)" link pointing at that exact CDN asset (IssueHero.tsx:205-213, GROQ problemPdfUrl projection). Fonts embedded via base64 (vendored Playfair Display + Source Serif Pro after the Docker fonts/ fix).

### 2. Tampered/missing webhook signature returns non-200 against live Railway
expected: POST to /webhook/sanity-publish with a corrupted or missing sanity-webhook-signature header returns 401; no Publisher background task is scheduled
result: PASS — verified 2026-06-01. Unsigned POST returns HTTP 401; correctly-signed non-published POST returns HTTP 200 {"skipped"}; correctly-signed valid payload schedules the Publisher. Signature gate working.

### 3. Vercel deploy hook actually fires ≥30s after webhook receipt
expected: Vercel deploy fires ≥30s after the webhook arrives (WHK-05 CDN propagation delay)
result: PASS — verified 2026-06-01. Convex status reached 'complete' at ~36s post-webhook; the Convex-complete write happens AFTER the Vercel deploy POST in _run_publisher, so reaching 'complete' proves the Vercel deploy fired (it would have crashed at the deploy step otherwise). VERCEL_DEPLOY_HOOK_URL confirmed set on Railway by Andrew. Live page subsequently reflected the new build.

### 4. Idempotency-key dedup against live Supabase webhook_idempotency table
expected: Same idempotency-key twice triggers Publisher exactly once
result: [deferred — not separately exercised. Each smoke used a unique key; the lib has unit coverage (test_idempotency.py, env-gated on Railway). Non-blocking: the chain is proven; dedup is a retry-safety property, not a happy-path requirement.]

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

None blocking. The Phase 6 webhook chain is live and verified end-to-end (publish → HMAC verify → PDF render+upload → 30s CDN wait → Vercel deploy → Convex complete → live page shows PDF link). Test 4 (idempotency dedup) deferred as a non-happy-path retry-safety property with existing unit coverage.
