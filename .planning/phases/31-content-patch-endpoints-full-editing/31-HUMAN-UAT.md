---
status: partial
phase: 31-content-patch-endpoints-full-editing
source: [31-VERIFICATION.md]
started: 2026-07-07T11:00:00Z
updated: 2026-07-07T11:00:00Z
auto_chain: true
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live-Sanity non-clobber confirmation (headline-only save)
expected: On a real draft with populated `problemStatement.pdfContent.keyDataPoints`, edit ONLY the problem-statement headline in the Review Desk editor and Save. `problemStatement.pdfContent` must be byte-unchanged in Sanity, and no `content.pdf_data_points_patched` audit row is written to Convex. (All boundary tests mock Sanity — this confirms the dirty-gating against the real dataset. Same check applies to a specAd bonus headline-only save leaving `bonus.body` untouched.)
result: [pending]

### 2. Asset upload end-to-end
expected: Upload a podcast audio file through the console's AssetUploadSlot. Inline `<audio>` player plays back from the Sanity CDN URL, the asset appears in Sanity's asset library attached to the draft, and an audit row records the upload. Also verify a Suno audio upload lands as a plain URL string in `bonus.sunoAudioUrl` (not a file reference) and plays on the live issue page.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
