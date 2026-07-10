---
phase: quick-260710-iwy
plan: 01
subsystem: ui
tags: [react, useEffect, vitest, python, regex, claims-extraction, dispatch-control, pipeline]

requires: []
provides:
  - "PreviewIframe.tsx — load-timeout effect keyed on [loaded], early-returns once loaded so a loaded preview is never flipped to the error state by a stale pending timer"
  - "PreviewIframe.test.tsx — fake-timer regression coverage for both the loaded-stays-visible and never-loaded-still-errors paths"
  - "claims.py — heading/blockquote block exclusion, headline string-field exclusion, proper-noun word cap + de-overlap, word-bounded context (both extraction paths: extract_claims_by_block live publisher path, extract_claims/extract_all_claim_types legacy path)"
  - "test_claims_extractor.py — 6 new regression cases covering all de-noise behaviors, full suite green"
  - "deferred-items.md — logged out-of-scope RE_NUMBER '$' stripping bug found while writing recall test"
affects: [dispatch-control, packages/pipeline, run-review, publisher]

tech-stack:
  added: []
  patterns:
    - "React load-timeout effect: depend the timeout effect on the loaded-state itself ([loaded]) and early-return once true, rather than an empty-deps effect with an internal stale-closure guard — the cleanup on the next render cancels the previous timer"
    - "Reject-not-truncate for runaway regex matches: keep a greedy/unbounded regex and drop over-long matches wholesale (proper-noun word cap) rather than adding lookahead bounds that would silently truncate valid matches"
    - "Word-boundary containment de-dup: pad both strings with a leading/trailing space before substring-checking, to avoid partial-word false positives (Trust vs Trustees)"
    - "Word-bounded context windowing: take a wider raw window than needed, then advance/retreat to the nearest whitespace at each edge instead of hard-slicing a fixed character count"

key-files:
  created:
    - apps/dispatch-control/__tests__/PreviewIframe.test.tsx
    - .planning/quick/260710-iwy-fix-preview-iframe-stale-closure-timeout/deferred-items.md
  modified:
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx"
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
    - packages/pipeline/tests/test_claims_extractor.py

key-decisions:
  - "Froze RE_NUMBER unchanged per the plan's explicit invariant (preserve existing number/date extraction), even though it silently strips a leading '$' from dollar amounts due to a \\b boundary quirk — logged as a separate, pre-existing, out-of-scope bug in deferred-items.md rather than fixed here"
  - "Joined section string fields (subjectName, subjectRole, etc.) with '. ' instead of the original '\\n' inside _section_to_text, because '\\n' is whitespace to RE_PROPER_NOUN's \\s+ and two adjacent Title-Case field values (e.g. subjectName immediately followed by subjectRole) would otherwise bleed into one accidental cross-field proper_noun match — necessary to satisfy the plan's own must-have that subjectName/subjectRole survive independently"

requirements-completed: [PREVIEW-IFRAME-TIMEOUT, CLAIMS-EXTRACTOR-NOISE]

duration: ~26min
completed: 2026-07-10
---

# Quick Task 260710-iwy: Fix preview-iframe stale-closure timeout + claims-extractor noise Summary

**PreviewIframe's load-timeout effect now depends on `[loaded]` and cancels its own pending timer once loaded (no more preview vanishing ~30s after a good load); claims.py excludes heading/blockquote blocks and headline fields, caps proper-noun length, de-overlaps fragments, and word-bounds context so the Factual Claims checklist shows clean, verifiable entities instead of garbled headline sentences.**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-07-10T13:44:00-07:00
- **Completed:** 2026-07-10T14:11:00-07:00
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified — excluding this SUMMARY and deferred-items.md)

## Accomplishments

- Fixed the stale-closure bug: `PreviewIframe`'s 30s load-timeout `useEffect` no longer freezes `loaded=false` in an empty-deps closure — it now depends on `[loaded]`, early-returns once loaded, and the cleanup cancels the previous pending timer, so a successfully-loaded preview never flips to "Preview unavailable."
- Added `PreviewIframe.test.tsx` with vitest fake timers proving both directions: a loaded iframe stays visible past 31s, and a never-loaded iframe still shows the error state after 31s
- De-noised the live "Factual Claims" checklist (confirmed garbled on run 999605): heading (h1-h4) and blockquote blocks — in both the nested Sanity block `style` path and the flat writer `type` path used by the live `extract_claims_by_block` publisher call — now yield zero claims
- Excluded `headline`/title-type string fields from section-value extraction while preserving factual fields (`subjectName`, `subjectRole`, etc.)
- Capped proper-noun extraction at 5 words (rejecting runaway 6+ word Title-Case runs wholesale, not truncating) and added a word-boundary containment pass that collapses overlapping proper-noun fragments to the single longest survivor
- Replaced the fixed ±30-char context slice with a word-bounded window, eliminating mid-word truncation like "...Netw" / "...Just"
- Full pipeline test suite green (526 passed, 36 skipped) and dispatch-control's strict `next build` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PreviewIframe stale-closure load timeout + add component test** - `5fb4cd4` (fix)
2. **Task 2 (RED): Add failing tests for claims extractor de-noise** - `e5748a7` (test)
3. **Task 2 (GREEN): De-noise the claims extractor** - `432bc5a` (feat)

_No separate plan-metadata commit — this SUMMARY.md and the deferred-items.md note are the only remaining artifacts; per this quick task's constraints, ROADMAP.md is not touched._

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx` - load-timeout effect keyed on `[loaded]`, early return, no stale closure
- `apps/dispatch-control/__tests__/PreviewIframe.test.tsx` - new fake-timer regression tests (loaded-stays-visible, never-loaded-still-errors)
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` - `_HEADING_BLOCKQUOTE`/`_HEADLINE_KEYS`/`_MAX_PROPER_NOUN_WORDS` constants, `_word_bounded_context()`, `_deoverlap_proper_nouns()`, exclusion wiring in `_flatten_portable_text`, `_section_to_text`, `extract_all_claim_types`, and `extract_claims_by_block`
- `packages/pipeline/tests/test_claims_extractor.py` - 6 new regression tests (heading/blockquote exclusion x2 paths, runaway-run rejection, de-overlap, headline-field exclusion + factual-field survival, word-bounded context)
- `.planning/quick/260710-iwy-fix-preview-iframe-stale-closure-timeout/deferred-items.md` - new file logging the out-of-scope RE_NUMBER "$"-stripping bug (see Deviations below)

## Decisions Made

- Followed the plan's TDD instruction for Task 2: wrote all 6 new tests first, confirmed RED (only those 6 failed; the pre-existing 17 + full 520-test baseline stayed green), then implemented the fix and confirmed GREEN across the full 526-test suite.
- Kept `RE_NUMBER`/`RE_DATE` completely untouched per the plan's explicit invariant ("preserve existing number/date extraction"), even where this surfaced a separate pre-existing gap (see Deviations).
- Changed the string-field join separator in `_section_to_text` from `"\n"` to `". "` — a minimal, in-scope adjustment needed to satisfy the plan's own stated requirement that adjacent factual string fields (`subjectName`, `subjectRole`) extract independently rather than merging into one fake cross-field "name".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjacent Title-Case section string fields could bleed into one fake proper_noun**
- **Found during:** Task 2, while writing the headline-exclusion regression test (`test_extract_claims_excludes_headline_but_keeps_factual_string_fields`)
- **Issue:** `_section_to_text` joined all non-body string fields with `"\n"`. `RE_PROPER_NOUN`'s `\s+` matches newlines too, so two adjacent Title-Case field values (e.g. `subjectName: "Jane Doe"` immediately followed by `subjectRole: "Founder"`) were extracted as a single bogus proper noun `"Jane Doe\nFounder"` instead of the plan's required independent `"Jane Doe"` claim.
- **Fix:** Joined the (non-headline) string field values with `". "` instead of `"\n"` before appending them as one `parts` entry — a period breaks the whitespace-only run the proper-noun regex requires, without affecting body-text extraction (still joined the same way it always was) or any other claim type.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py`
- **Verification:** New test passes; full 526-test pipeline suite green.
- **Committed in:** `432bc5a` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, directly caused by this task's own `_section_to_text` change)
**Impact on plan:** Necessary to satisfy the plan's own must-have ("subjectName and subjectRole ... must survive" as independent factual claims). No scope creep beyond the string-field join separator.

### Logged but NOT fixed (out of scope)

**RE_NUMBER drops a leading "$" from dollar amounts** — pre-existing regex boundary quirk (`\b` never matches immediately before `$` since both the preceding whitespace and `$` are non-word characters), unrelated to either of this task's two confirmed defects, and explicitly frozen by this task's "preserve existing number/date extraction" invariant. Full detail, repro, and a suggested future fix are in `.planning/quick/260710-iwy-fix-preview-iframe-stale-closure-timeout/deferred-items.md`. The plan's own illustrative recall-test wording ("$500,000") was adjusted in the actual test to match real (unmodified) `RE_NUMBER` behavior ("500,000", no `$`) rather than silently asserting behavior that doesn't exist.

## Issues Encountered

- Two of the six newly-written de-noise tests initially passed trivially against the OLD (pre-fix) code because the crafted input didn't actually exercise the bug (a single-sentence de-overlap fixture had no genuine overlapping regex matches; a context-window fixture happened to land on whitespace at both fixed ±30-char edges). Both were rewritten with more deliberate fixtures (two separate sentences producing genuinely overlapping proper-noun matches; a text engineered so the fixed ±30-char slice provably lands mid-word) so all 6 new tests were confirmed RED before the fix and GREEN after.

## User Setup Required

None — no external service configuration required. Both fixes are pure code changes with no new dependencies, env vars, or infrastructure.

## Next Phase Readiness

- Both confirmed run-999605 defects are resolved and covered by regression tests: the preview iframe no longer vanishes after a successful load, and the Factual Claims checklist no longer surfaces headline/pull-quote sentence fragments.
- The "Estimated Run Cost: —" tile remains an untouched, separately-tracked deferred gap (explicitly out of scope for this task, not implemented).
- The RE_NUMBER "$"-stripping bug is logged in `deferred-items.md` for a future quick task or phase to pick up; it's cosmetic (missing currency symbol) and does not block current review-desk usage.

---
*Quick task: 260710-iwy*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx
- FOUND: apps/dispatch-control/__tests__/PreviewIframe.test.tsx
- FOUND: packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
- FOUND: packages/pipeline/tests/test_claims_extractor.py
- FOUND: .planning/quick/260710-iwy-fix-preview-iframe-stale-closure-timeout/deferred-items.md
- FOUND: .planning/quick/260710-iwy-fix-preview-iframe-stale-closure-timeout/260710-iwy-SUMMARY.md
- FOUND: commit 5fb4cd4 (Task 1)
- FOUND: commit e5748a7 (Task 2 RED)
- FOUND: commit 432bc5a (Task 2 GREEN)
