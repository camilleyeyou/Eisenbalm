---
status: partial
phase: 26-review-gate-charity-registry
source: [26-VERIFICATION.md]
started: 2026-06-23T00:00:00Z
updated: 2026-06-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. RVW-04 email-alert deferral sign-off
expected: Enabling `auto_publish` emits a Convex `deliberationEvents` row (inner payload `eventType:'auto-publish-enabled'`) as the Phase 27 notification seam; no email/Slack is sent in Phase 26. CONTEXT D-11 + API_CONTRACTS §26.6 document this as a pre-planned deferral. REQUIREMENTS.md ("alerted + audit-logged") is satisfied by banner + event + audit log; ROADMAP success criterion #4 literally says "triggers an email alert to the operator." Confirm whether the event emission satisfies Phase 26 sign-off, or whether the email transport must land in this phase.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
