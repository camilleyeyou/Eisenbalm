---
phase: quick-260722-f2c
plan: 01
subsystem: ui
tags: [dispatch-control, gate1, copy, vitest, nextjs]

# Dependency graph
requires:
  - phase: Phase 47 (BRF-04)
    provides: "NeedsYourDecisionCard Gate-1 two-option adjudication card + the 'Needs your decision' plain label precedent (D-07)"
  - phase: Phase 37 (SIG-03)
    provides: "AdjudicationPanel + the shared adjudicateGate1 resume bridge"
provides:
  - "Plain-language operator copy on the Gate-1 'Needs your decision' card (no 'Rationale', 'Burden', 'Evidence quality', or 'Adjudication' jargon)"
  - "A visible note that the reason is saved to the decision log and not published"
  - "Matching plain error/success copy across NeedsYourDecisionCard and AdjudicationPanel"
affects: [dispatch-control, story-brief, signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator-facing (Mission Control) copy stays plain English, distinct from Jesse's editorial voice used on the public magazine"

key-files:
  created: []
  modified:
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx"
    - "apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx"

key-decisions:
  - "Used the HTML entity &rsquo; for apostrophes in JSX text content (matches existing convention in BriefFieldTable.tsx/DecisionPanel.tsx), but a literal apostrophe character in the plain JS string literal passed to setMessage() — HTML entities do not decode in runtime string values rendered via {message}, only in compiled JSX text."
  - "Also updated the two doc-comments above describeEvidenceQuality/describeBurden that quoted the old label names ('Evidence quality', 'Burden'), so they reflect the new labels and don't false-positive on the plan's own no-jargon grep check. Comments only — no identifier, testid, or aria-label changed."

patterns-established: []

requirements-completed: [QUICK-260722-F2C]

# Metrics
duration: 8min
completed: 2026-07-22
---

# Quick Task 260722-f2c: Rename obscure operator-facing labels Summary

**Renamed four jargon labels on the Gate-1 "Needs your decision" adjudication card to plain operator English, added a note that the reason is audit-log-only, and synced the same plain error/success copy to the signal-desk AdjudicationPanel.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-22T18:00:23Z
- **Tasks:** 1 completed
- **Files modified:** 3

## Accomplishments
- `NeedsYourDecisionCard.tsx`: "Rationale (required)" -> "Why this pick? (required)" with a new helper line ("Saved to the decision log — not published."); "Evidence quality" -> "What's been verified"; "Burden" -> "What still needs checking"; `describeBurden`'s no-gaps copy -> "Nothing left to check here."; error copy -> "Couldn't submit your choice — try again."; success copy -> "Got it — the run is continuing with {pick}."
- `AdjudicationPanel.tsx`: matched the same two shared error/success strings only (label, header, and button left untouched — those were explicitly out of scope).
- `NeedsYourDecision.test.tsx`: updated the `getByLabelText` query and the two content assertions that depended on the renamed strings; left the `describeEvidenceQuality`/`describeBurden` content assertions ("Domain live", "verify registration") untouched since their underlying text did not change.
- No internal identifiers, `data-testid` values, or the `aria-label="Needs your decision"` region name were touched.

## Task Commits

1. **Task 1: Rename Gate-1 card labels to plain language + update the tests that assert them** - `afc958e` (feat)

_No plan metadata commit yet — this summary + STATE.md update follow in the final commit._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx` - Renamed operator-facing labels, added reason helper text, plain error/success copy, updated two doc-comments to match
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx` - Matched the two shared error/success strings for cross-surface consistency
- `apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx` - Updated accessible-name query and two content assertions for the new visible strings

## Decisions Made
- Apostrophe handling differs by context: `&rsquo;` HTML entity in JSX text (`What&rsquo;s been verified`), but a real `'` character inside the plain JS string literal used in `setMessage(... : "Couldn't submit your choice — try again.")` — entities only decode in compiled JSX text, not in runtime strings rendered via `{message}`.
- Updated two doc-comments (`describeEvidenceQuality`, `describeBurden`) that quoted the old jargon label names, purely so the code's own documentation doesn't reference retired copy and so the plan's no-jargon grep check has no false positives from comments. No behavior, identifier, or test-facing string was affected by this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Caught an HTML-entity-in-plain-string bug before it shipped**
- **Found during:** Task 1, while editing the error-message string in both components
- **Issue:** Initially wrote `'Couldn&rsquo;t submit your choice — try again.'` as the fallback string passed to `setMessage()`. Since `setMessage` receives a runtime JS string (not compiled JSX text), React would have rendered the literal characters `&rsquo;` on screen instead of an apostrophe.
- **Fix:** Changed to a double-quoted string literal with a real apostrophe character: `"Couldn't submit your choice — try again."` in both `NeedsYourDecisionCard.tsx` and `AdjudicationPanel.tsx`.
- **Files modified:** Same two files as the task.
- **Verification:** Re-ran the targeted vitest suite (21/21 passing) and `pnpm --filter dispatch-control build` (type-checks + compiles clean) after the fix.
- **Committed in:** `afc958e` (part of task commit — caught before commit, no separate fix commit needed)

**2. [Rule 2 - Correctness] Updated two doc-comments quoting the retired label names**
- **Found during:** Task 1, running the plan's own mandatory no-jargon grep check
- **Issue:** `describeEvidenceQuality`/`describeBurden` had doc-comments literally quoting `"Evidence quality"` and `"Burden"` — these are not visible UI copy, but they caused the plan's verification grep to report a match and left stale documentation referencing retired labels.
- **Fix:** Updated the two comments to quote the new label text (`"What's been verified"`, `"What still needs checking"`) instead.
- **Files modified:** `NeedsYourDecisionCard.tsx`
- **Verification:** Re-ran the grep check — zero matches.
- **Committed in:** `afc958e` (part of task commit)

## Known Stubs
None.

## Self-Check

- FOUND: apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx
- FOUND: apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx
- FOUND commit: afc958e

## Self-Check: PASSED
