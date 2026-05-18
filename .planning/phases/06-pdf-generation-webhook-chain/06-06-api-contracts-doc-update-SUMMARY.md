---
phase: 06-pdf-generation-webhook-chain
plan: 06
subsystem: docs
tags: [docs, api-contracts, sanity-webhook, signature, hmac, base64url]
requires: []
provides:
  - "docs/API_CONTRACTS.md §5.3 correctly documents the verified Sanity webhook signature algorithm (t={ms},v1={base64url})"
  - "Cross-reference from API_CONTRACTS §5.3 to packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py as the canonical Python implementation (Plan 06-04)"
  - "Signature header parsing notes (regex tolerance, base64url no-pad, symmetric age skew rule) inlined in §5.3 to prevent re-introduction of the bug"
affects:
  - "docs/API_CONTRACTS.md (lines 1044-1079 → 1044-1136, +57 net lines in §5.3)"
tech-stack:
  added: []
  patterns:
    - "Doc-only correction (no code change)"
    - "Blockquote callout (> **Algorithm correction...**) used in place of strikethrough; renders as a styled admonition in GitHub-flavored markdown"
key-files:
  created: []
  modified:
    - "docs/API_CONTRACTS.md (§5.3 only)"
decisions:
  - "Used blockquote-with-bold-prefix callout (`> **Algorithm correction (Phase 6 / 2026-05-18):** ...`) instead of markdown strikethrough — renders cleanly in GitHub UI and remains readable in plain-text terminal renders; strikethrough on multi-line code blocks would have been visually broken"
  - "Preserved the wrong sha256=hex shape NOWHERE in the new §5.3 — replaced verbatim rather than leaving a struck-through historical record; the blockquote prose explicitly names what the old algorithm was so future readers see the correction in context"
  - "Did not amend §5.1, §5.2, or §5.4 — the wrong algorithm was localized to §5.3's code block; no collateral edits needed"
  - "Used the standard summary filename `06-06-api-contracts-doc-update-SUMMARY.md` (matches phase 05 convention and gsd-tools update-progress recognition) rather than the plan's non-standard suggested filename `06-pdf-generation-webhook-chain-06-SUMMARY.md`"
metrics:
  duration: "1 min"
  completed: "2026-05-18"
  tasks: 1
  files_modified: 1
---

# Phase 6 Plan 06: API Contracts §5.3 Sanity Webhook Signature Correction Summary

Replaced the wrong `sha256=hex` HMAC algorithm in `docs/API_CONTRACTS.md §5.3` with the verified upstream `t={ms},v1={base64url}` algorithm from `@sanity/webhook` v5+, and cross-referenced `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` as the canonical Python implementation.

## What changed

- **File:** `docs/API_CONTRACTS.md`
- **Section:** §5.3 — FastAPI handler (only)
- **Sections untouched:** §5.1 (webhook configuration), §5.2 (payload shape), §5.4 (Vercel deploy trigger) — all confirmed present and unchanged via `grep -c "### 5.X"`
- **Line-range replaced:** 1044-1079 (36 lines) → 1044-1136 (93 lines). Net +57 lines in §5.3.
- **Strikethrough rendering:** the plan asked whether markdown strikethrough or a blockquote note was used. **Decision: blockquote note with bold prefix** (`> **Algorithm correction (Phase 6 / 2026-05-18):** ...`). Markdown strikethrough on a multi-line code block would have been visually broken in GitHub UI; the blockquote renders as a styled admonition and stays readable in plain-text terminal renders. The prose explicitly names what the wrong algorithm was so the correction has context.

## New §5.3 contents (high level)

1. **Algorithm correction blockquote** — names the wrong algorithm (`sha256=<hex>`), states the canonical one (`t={ms},v1={base64url}`), and points to `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` plus the upstream source (`github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts`).
2. **Corrected FastAPI handler code block** — imports `verify_sanity_signature`, `SignatureError`, `SignatureExpiredError`, and `SIGNATURE_HEADER_NAME` from the canonical lib; calls `verify_sanity_signature(raw, sig_header, secret)` and maps `SignatureExpiredError → 410` and `SignatureError → 401`; demonstrates WHK-04 idempotency-key dedup via `claim_idempotency_key`; uses `asyncio.create_task` with strong-ref'd app.state.background_tasks (Phase 4 Research Pitfall 4 pattern).
3. **Signature header parsing notes** — the regex `^t=(\d+)[, ]+v1=([^, ]+)$`, the role of `sanity-transaction-time` vs. `t=`, the symmetric 5-minute skew rule (both `now-ts > MAX_AGE_MS` AND `ts-now > MAX_AGE_MS` reject), and the base64url-no-padding requirement.

## Acceptance criteria — all PASSED

- ✓ `grep -c "t={timestamp_ms},v1=" docs/API_CONTRACTS.md` → 1
- ✓ `grep -c "verify_sanity_signature" docs/API_CONTRACTS.md` → 2
- ✓ `grep -c "base64url_no_pad" docs/API_CONTRACTS.md` → 1
- ✓ `grep -c "Algorithm correction" docs/API_CONTRACTS.md` → 1
- ✓ `grep -c "lib/sanity_webhook" docs/API_CONTRACTS.md` → 2
- ✓ `grep -c "compare_digest(f'sha256=" docs/API_CONTRACTS.md` → 0 (OLD wrong line absent)
- ✓ `grep -E "f'sha256=\{expected\}'" docs/API_CONTRACTS.md` → no matches (OLD wrong shape gone)
- ✓ `grep -c "### 5.1"` → 1, `### 5.2` → 1, `### 5.4` → 1 (surrounding sections intact)

Bundled command from `<verify>` block also passes:

```bash
grep -c "t={timestamp_ms},v1=" docs/API_CONTRACTS.md && grep -c "verify_sanity_signature" docs/API_CONTRACTS.md && grep -c "lib/sanity_webhook" docs/API_CONTRACTS.md && ! grep -E "compare_digest\(f'sha256=" docs/API_CONTRACTS.md && echo ok
# Output: 1 / 2 / 2 / ok
```

## Collateral

None. The wrong `sha256=hex` algorithm was localized to §5.3's code block. Confirmed by:

```bash
$ grep -nE "f'sha256=" docs/API_CONTRACTS.md
(no output)
$ grep -n "compare_digest" docs/API_CONTRACTS.md
(no output)
$ grep -n "sha256=<hex>" docs/API_CONTRACTS.md
1046:> signature is NOT `sha256=<hex>` — that was a guess pinned in this doc
(only inside the correction blockquote, as expected)
```

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<output>` block suggested filename `06-pdf-generation-webhook-chain-06-SUMMARY.md`. This SUMMARY uses the standard gsd-tools convention `06-06-api-contracts-doc-update-SUMMARY.md` (matching phase 05's naming) so that `gsd-tools state update-progress` and `gsd-tools roadmap update-plan-progress` correctly recognize the plan as complete. The content remains the same.

## Commits

- `1742326` docs(06-06): correct API_CONTRACTS §5.3 Sanity webhook signature algorithm

## Self-Check: PASSED

- FOUND: docs/API_CONTRACTS.md (file exists, 1364 lines, modified §5.3)
- FOUND: commit 1742326 in `git log`
- FOUND: all 8 acceptance grep checks return expected counts
- FOUND: ### 5.1, ### 5.2, ### 5.4 each present exactly once (no collateral damage)
- FOUND: blockquote-style algorithm correction callout at the top of §5.3
- FOUND: cross-reference to `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` (appears 2x: once in prose, once in code-block path comment)
