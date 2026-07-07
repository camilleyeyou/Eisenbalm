---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 08
subsystem: ops
tags: [deployment, cors, dispatch-control, pipeline]

# Dependency graph
requires:
  - phase: 30-05
    provides: grouped-nav sidebar hosting the Prompt Lab route the checkpoint verified against
provides:
  - Verified-live confirmation that the deployed dispatch-control dashboard reaches the Railway pipeline API in production
  - Dated DEPLOY.md record of the CHR-05 fix closing the milestone's foundational ops gap
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No code change — the fix was purely operational (setting two already-coded-for env vars: NEXT_PUBLIC_PIPELINE_URL on Vercel, DASHBOARD_ALLOWED_ORIGINS on Railway)"

key-files:
  created: []
  modified:
    - apps/dispatch-control/DEPLOY.md

key-decisions:
  - "Recorded the verification factually (which env vars, where they live, what was observed) without inventing or guessing the literal URL values, since Andrew reported success by screenshot/description rather than pasting the raw values"

requirements-completed: [CHR-05]

# Metrics
duration: ~5min
completed: 2026-07-07
---

# Phase 30 Plan 08: Pipeline URL Prod Fix Summary

**Closed CHR-05 — no code change required; Andrew set `NEXT_PUBLIC_PIPELINE_URL` (Vercel) and `DASHBOARD_ALLOWED_ORIGINS` (Railway) in production and verified the deployed Prompt Lab test-run panel works end-to-end with real cost metering and voice scoring.**

## Performance

- **Duration:** ~5 min (Task 2 only — Task 1 was a human-action checkpoint resolved out-of-band)
- **Completed:** 2026-07-07
- **Tasks:** 2 (1 checkpoint, 1 auto)
- **Files modified:** 1

## Accomplishments

- Task 1 (`checkpoint:human-action`): Andrew set both production env vars and exercised the live test-run panel. He replied "verified" on 2026-07-07 with a screenshot of the deployed dashboard's Prompt Lab test-run panel working in production — a test-run against the advocate agent's canned fixture returned real output, cost metering ($0.0008, `anthropic/claude-4.5-haiku-20251001`, 146 tokens in / 122 out, 3.8s duration), and a full voice-score panel (6.5/10 overall across all 6 axes: gravity, sentiment, irony-signaling, precision, cross-section-consistency, structural-variety). No CORS error and no "NEXT_PUBLIC_PIPELINE_URL is not set" error occurred.
- Task 2: Appended a dated "CHR-05: verified live (2026-07-07)" section to `apps/dispatch-control/DEPLOY.md`, recording both env vars by name and where they live (Vercel dispatch-control project / Railway pipeline service) without inventing the literal values, plus the observed test-run evidence. Existing DEPLOY.md content preserved (append-only).

## Task Commits

1. **Task 1 (checkpoint:human-action):** No commit — human-only action (setting Vercel/Railway env vars), resolved via user confirmation, no code/doc change at that step.
2. **Task 2: Record verified-live result in DEPLOY.md** - `473c04c` (docs)

## Files Created/Modified

- `apps/dispatch-control/DEPLOY.md` - added a dated CHR-05 verified-live section documenting both env vars and the production test-run evidence

## Decisions Made

- Documented the verification factually — env var names + where they're configured (Vercel/Railway dashboards) — rather than guessing or inventing the actual URL/origin strings, since Andrew's confirmation came as a description/screenshot of working behavior, not the literal values.

## Deviations from Plan

None — plan executed exactly as written. Task 1 was a `checkpoint:human-action` gate; Andrew's "verified" reply plus the described screenshot evidence satisfied the resume-signal and acceptance criteria without any console error being reported. Task 2's automated verification (`grep -q "NEXT_PUBLIC_PIPELINE_URL"` and `grep -q "DASHBOARD_ALLOWED_ORIGINS"` against DEPLOY.md) both pass.

## Issues Encountered

None.

## User Setup Required

None further — the two production env vars (`NEXT_PUBLIC_PIPELINE_URL` on Vercel, `DASHBOARD_ALLOWED_ORIGINS` on Railway) are already set and verified live by Andrew as part of this plan's checkpoint.

## Next Phase Readiness

- CHR-05 is fully satisfied — the deployed dispatch-control dashboard reaches the pipeline API in production. Phase 30 (Foundation — Design System, Chrome & Awaiting-You Inbox) is now complete: all 8 plans done, all 5 requirements (CHR-01 through CHR-05) closed.
- Phases 31+ (which depend on Phase 30's console shell) are unblocked to begin.

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/DEPLOY.md
- FOUND: commit 473c04c
