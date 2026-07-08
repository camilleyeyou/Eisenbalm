---
status: partial
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
source: [34-VERIFICATION.md]
started: 2026-07-08T16:05:00Z
updated: 2026-07-08T16:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SANITY_STUDIO_DISABLE_PUBLISH flag-flip UAT
expected: Set `SANITY_STUDIO_DISABLE_PUBLISH=true` in the Studio env, rebuild/redeploy Studio, and confirm the publish action disappears for `weeklyIssue` documents only (other document types keep their publish action). Unset the flag and rebuild — the publish action returns. (This is the D-10 soak-end mechanism; per D-11 the flag stays OFF until 2–3 consecutive real weekly issues ship entirely via the console.)
result: [pending]

### 2. End-to-end Studio-bypass block (D-07)
expected: With a run that does NOT have both sign-offs active, flip its `weeklyIssue.status` to `published` directly in Sanity Studio. The webhook must: skip the publisher (no PDF/Vercel deploy), revert the Sanity status back to `in-review`, write an audit row, and emit the alert event. Requires live Sanity + Convex + FastAPI with real webhook delivery (local webhook tests are env-skipped without SUPABASE_POSTGRES_URL).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
