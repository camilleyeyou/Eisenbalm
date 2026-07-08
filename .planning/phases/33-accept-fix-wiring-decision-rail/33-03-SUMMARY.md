---
phase: 33-accept-fix-wiring-decision-rail
plan: 03
subsystem: pipeline-api
tags: [fastapi, span-resolver, qa-findings, publish-gate, convex, sanity]
requires:
  - 33-01 (§33 API contract — endpoint flows, 409 reasons, resolver spec frozen)
  - Phase 31 content-patch machinery (patch_issue_field, get_issue_draft, compose_section_body, _resolve_sanity_id)
  - Phase 32 spanResolver.ts (port target) + qaCorrections.blockIndexHint
provides:
  - packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py (resolve_span, 1:1 TS port)
  - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (accept/dismiss/reopen router)
  - open-error-findings 409 gate in review.py publish_issue AND schedule_issue
  - qaCorrections:setResolution in _PIPELINE_SECRET_GUARDED_PATHS
affects:
  - 33-04/33-05 (dashboard decision rail + galley action popovers call these endpoints)
  - Phase 34 (two-sign-off gate layers onto this same guard chain)
tech-stack:
  added: []
  patterns:
    - split-escape-join regex build (Python re.escape escapes whitespace, unlike TS escapeRegExp)
    - Pitfall-6 loud-failure: post-Sanity-patch Convex flip failure -> 502, never swallowed
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py
    - packages/pipeline/tests/test_span_resolver.py
    - packages/pipeline/tests/test_findings_endpoints.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - packages/pipeline/tests/test_review_endpoints.py
decisions:
  - "Ambiguity semantics match TS exactly: 'ambiguous' at a stage STOPS (unresolved) — only zero-matches falls through to the next stage"
  - "Python whitespace-tolerant pattern built via split-on-\\s+/escape/join, NOT re.sub over re.escape output (Python escapes spaces, TS does not — naive port leaves orphaned backslashes)"
  - "dismiss/reopen skip _resolve_sanity_id (no Sanity involvement per §33.3) — convex_http + actor taken directly"
  - "Pitfall 6: setResolution failure after a successful Sanity patch raises 502 resolution_flip_failed with operator guidance (text applied, finding not flipped)"
metrics:
  duration: 12min
  tasks: 3
  files: 8
completed: 2026-07-08
---

# Phase 33 Plan 03: Pipeline Findings Endpoints Summary

Python span resolver mirroring spanResolver.ts stage-for-stage plus accept/dismiss/reopen findings endpoints that patch the real Sanity draft, flip Convex resolution through the secret-guarded lane, audit everything, and a server-enforced open-error-findings 409 gate on both publish and schedule.

## Tasks Completed

| # | Task | Commits | Key files |
|---|------|---------|-----------|
| 1 | Python span resolver port + parity tests | 459c52b (RED), a52adce (GREEN) | lib/span_resolver.py, tests/test_span_resolver.py (14 tests) |
| 2 | findings.py router + register + secret path | f1d27ae (RED), 7e0c1e3 (GREEN) | api/findings.py, api/main.py, lib/convex_client.py, tests/test_findings_endpoints.py (21 tests) |
| 3 | open-error-findings gate on publish + schedule | b353945 (RED), 9f77467 (GREEN) | api/review.py, tests/test_review_endpoints.py (+3 tests) |

## What Shipped

**`lib/span_resolver.py` (§33.5):** `resolve_span(blocks, quoted, block_index_hint) -> Match | None` — three stages in order (exact `str.find` per block → length-preserving curly-quote normalization → whitespace-tolerant `re.finditer`), each searched block-by-block, never against joined section text. Disambiguation identical to the TS `disambiguate`: 0 → next stage, 1 → winner, 2+ → hint wins only when it names an actual candidate block, else ambiguous → `None` (never guess). Offsets always index the ORIGINAL block text.

**`api/findings.py` (§33.3, EDT-04):**
- **accept**: `_resolve_sanity_id` → `qaCorrections:byId` (404 wrong-run/missing; 409 `already_resolved`) → 409 `accept_unavailable` (no fix/span, `game`, non-specAd bonus) → `get_issue_draft` → `resolve_span` (None → 409 `span_not_resolved` with "Use Edit inline instead.") → `text[:start] + suggestedFix + text[end:]` → `patch_issue_field` on `{key}.body` / `bonus.body` (stale rev → 409 `revision_mismatch` propagated) → `qaCorrections:setResolution` accepted → audit `finding.accepted` with before=quotedSpan / after=suggestedFix. `problem → problemStatement` mapping mirrored from sectionIdMap.ts.
- **dismiss**: whitespace-only reason → 422; Convex-only flip with `resolutionReason`; audit `finding.dismissed` after=reason; no Sanity write.
- **reopen**: 409 `not_resolved` when open; `setResolution` with `resolution` OMITTED (clears the four fields, §33.1); audit `finding.reopened`; never reverts text (D-04).
- Router registered in `main.py`; `qaCorrections:setResolution` added to `_PIPELINE_SECRET_GUARDED_PATHS` (Pitfall 3).

**Publish/schedule gate (§33.4, GLY-04 server):** identical guard in `publish_issue` and `schedule_issue`, after the claims-signoff gate, before the sanityIssueId guard: `qaCorrections:byRunId` → `open_errors = severity=="error" and not resolution` → 409 `{reason: "open_error_findings", count}`. Deliberately anchor-blind (D-11b) — an orphaned error finding still blocks.

## Verification

- `uv run pytest tests/test_span_resolver.py tests/test_findings_endpoints.py tests/test_review_endpoints.py -q` — 42 passed
- Full pipeline suite: **435 passed / 33 skipped** (no regressions; prior baseline ≤ 397 before this plan's +38)
- All plan acceptance-criteria greps verified (setResolution in guarded set, 3 route decorators, problem→problemStatement map, before=/after= audit, 4×409-reason + 422 test coverage, gate present ×2 with anchor-blind predicate)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Python `re.escape` escapes whitespace — naive TS pattern-build port broke the whitespace-tolerant stage**
- **Found during:** Task 1 (GREEN run — curly-quote + whitespace parity test failed)
- **Issue:** The plan's suggested `re.sub(r"\s+", r"\\s+", re.escape(s))` leaves orphaned backslashes because Python's `re.escape` (unlike the TS `escapeRegExp`) escapes space/tab/newline, producing patterns like `\\s+` (literal backslash) instead of `\s+`.
- **Fix:** Build the pattern as `r"\s+".join(re.escape(part) for part in re.split(r"\s+", normalized_quoted))` — semantically identical to the TS build.
- **Files modified:** packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py
- **Commit:** a52adce

No other deviations — endpoints, gate, and tests implement §33.3–§33.5 verbatim.

## Known Stubs

None — no placeholder values, no unwired data paths. (The Convex `qaCorrections:setResolution` / `byId` functions themselves ship in parallel plan 33-02; this plan's tests mock the Convex boundary per the wave-2 split, and the guarded-path set addition here lands the Python half of §33.1's both-edits-together mandate.)

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/findings.py
- FOUND: packages/pipeline/tests/test_span_resolver.py
- FOUND: packages/pipeline/tests/test_findings_endpoints.py
- FOUND commits: 459c52b, a52adce, f1d27ae, 7e0c1e3, b353945, 9f77467
