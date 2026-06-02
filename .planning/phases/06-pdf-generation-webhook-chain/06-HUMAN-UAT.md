---
status: partial
phase: 06-pdf-generation-webhook-chain
source: [06-VERIFICATION.md]
started: 2026-05-18T12:45:00Z
updated: 2026-06-01T23:55:00Z
---

## Current Test

Webhook chain configured 2026-06-01 (Sanity webhook created + Railway secret confirmed matching). Awaiting one live publish to confirm the PDF + Vercel + Convex tail.

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

### 1. End-to-end Andrew publish on Sanity Studio
expected: After Andrew clicks Publish, weeklyIssue.problemPdf is populated with a Sanity asset URL within ~60s; /issue/[slug] on Vercel renders the "Download the problem framework" link; downloaded PDF opens with theme colors + Playfair Display / Source Serif Pro fonts embedded (NOT default browser fonts, NOT HTTP-loaded Google Fonts)
result: [pending — Andrew runs one live publish]

### 2. Tampered/missing webhook signature returns non-200 against live Railway
expected: POST to /webhook/sanity-publish with a corrupted or missing sanity-webhook-signature header returns 401; no Publisher background task is scheduled
result: PASS — verified 2026-06-01. Unsigned POST returns HTTP 401; correctly-signed non-published POST returns HTTP 200 {"skipped"}; correctly-signed valid payload would schedule the Publisher. Signature gate working.

### 3. Vercel deploy hook actually fires ≥30s after webhook receipt
expected: Timestamp of Vercel deploy job creation (visible in Vercel dashboard) is ≥30s after the Sanity webhook arrival logged in Railway
result: [pending — depends on VERCEL_DEPLOY_HOOK_URL set on Railway + test 1]

### 4. Idempotency-key dedup against live Supabase webhook_idempotency table
expected: Sending the same idempotency-key twice (simulated retry) triggers Publisher exactly once. First request returns {ok: true, scheduled: true}; second returns {ok: true, duplicate: true}; only one Vercel deploy fires; Convex pipelineRuns.status='complete' is written once
result: [pending — confirm during test 1]

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

Two operational items remain before the chain is fully live end-to-end:
1. Confirm `VERCEL_DEPLOY_HOOK_URL` is set on Railway (Andrew — Railway dashboard, or `railway login` then I can set it).
2. Run one live publish in Sanity Studio as the end-to-end smoke (Andrew — this is the production-deploy action; a prepared signed smoke webhook was NOT fired because it triggers a live Vercel deploy, which is Andrew's call).
