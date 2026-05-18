---
status: partial
phase: 06-pdf-generation-webhook-chain
source: [06-VERIFICATION.md]
started: 2026-05-18T12:45:00Z
updated: 2026-05-18T12:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end Andrew publish on Sanity Studio dev dataset
expected: After Andrew clicks Publish, weeklyIssue.problemPdf is populated with a Sanity asset URL within ~60s; /issue/[slug] on Vercel renders the "Download the problem framework" link; downloaded PDF opens with theme colors + Playfair Display / Source Serif Pro fonts embedded (NOT default browser fonts, NOT HTTP-loaded Google Fonts)
result: [pending]

### 2. Tampered webhook signature returns non-200 against live Railway
expected: curl POST to https://<railway-domain>/webhook/sanity-publish with a deliberately corrupted sanity-webhook-signature header returns 401; Railway logs show the "Webhook rejected (signature)" warn line; no Publisher background task is scheduled
result: [pending]

### 3. Vercel deploy hook actually fires ≥30s after webhook receipt
expected: Timestamp of Vercel deploy job creation (visible in Vercel dashboard) is ≥30s after the Sanity webhook arrival logged in Railway
result: [pending]

### 4. Idempotency-key dedup against live Supabase webhook_idempotency table
expected: Sending the same idempotency-key twice (simulated retry) triggers Publisher exactly once. First request returns {ok: true, scheduled: true}; second returns {ok: true, duplicate: true}; only one Vercel deploy fires; Convex pipelineRuns.status='complete' is written once
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
