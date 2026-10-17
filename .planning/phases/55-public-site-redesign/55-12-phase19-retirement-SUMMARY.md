---
phase: 55-public-site-redesign
plan: 12
subsystem: web
tags: [retirement, cleanup, tests, nav]
requires: [55-11]
provides:
  - Phase 19 public-page components and transcript projection removed
  - phase19-retired.test.ts retirement guard
  - IssueNav omits links to sections that do not render
affects: []
key-files:
  created: [apps/web/__tests__/phase19-retired.test.ts]
  modified:
    - apps/web/lib/sanity/queries.ts
    - apps/web/lib/sanity/types.ts
    - apps/web/components/dispatch/IssueNav.tsx
    - apps/web/components/issue/IssueLayout.tsx
    - docs/API_CONTRACTS.md
    - .planning/REQUIREMENTS.md
decisions:
  - IssueNav takes an `omit` list of section ids; IssueLayout passes ['bonus'] when issue.bonus is absent
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 12: Phase 19 Retirement Summary

All 17 Phase 19 components deleted with zero remaining importers, the `conversation[]` projection dropped from both public queries (schema field and pipeline writer untouched), and pinned tests rewritten or removed with coverage recorded below.

## Commits

| Commit | Content |
|--------|---------|
| f1d0d26e | 17 component deletions; narrator-chip, shop-callout, typography, dispatch tests re-pointed |
| 017497c5 | conversation projection/type removed, 9 test dispositions, fixture cleanup, retirement guard, docs |
| (fix commit) | `fix(55-12)`: nav omits dangling `#bonus` |

## Component deletions

Every one grepped repo-wide (apps/web, dispatch-control, all apps) before removal. Only importers were the set itself, tests, and comment mentions. `components/marketing/ShopCallout.tsx` (used by /shop) was kept. None recorded as "kept".

IssueMasthead, IssueBriefing, MissionBand, SectionRail, ScrollProgressBar, StatCountUp, ThemeApplier, DelibChat, DelibScoreboard, ConfidenceBar, DeliberationSlot, ShopBand, ShopCallout (issue), IssueHero, ScrollReveal, EditorialSection, CaseStudySection.

## Test disposition table

| File | Disposition | Coverage now |
|------|-------------|--------------|
| deliberation-agent-cards.test.ts | deleted | delib-cards.test.tsx |
| deliberation-conversation.test.ts | deleted | phase19-retired.test.ts (no `conversation[]`, no `role="log"`), delib-cards.test.tsx |
| deliberation-advocate-scores.test.ts | deleted | delib-cards.test.tsx |
| deliberation-qa-severity.test.ts | deleted | target component gone; no replacement (QA severity is not on the public page) |
| deliberation-subscriptions.test.ts | deleted | delib-cards.test.tsx (no useQuery/convex) |
| deliberation-no-model-names.test.ts | deleted | delib-cards.test.tsx (forbidden-name scan) |
| machine-editorial-components.test.ts | deleted | all subjects deleted; delib-cards.test.tsx |
| issue-hero-motion.test.ts | deleted | IssueHero gone; Hero covered by dispatch-top / issue-front-page tests |
| motion-polish.test.ts | trimmed | kept globals.css `.section-card:hover` translateY and `.pitch-card-list` scroll-snap |
| narrator-chip.test.ts | re-pointed to dispatch/Hero.tsx | guards kept; style assertion now `d-label`; ordering now chip before `<h1` (Hero has no `<time>`) |
| issue-page-shop-callout.test.ts | rewritten | CMR-09 against BuyBand + BalmCounter |
| issue-page-typography.test.ts | trimmed | removed blocks on deleted files; added Manrope `--font-dispatch` test |
| issue-page-dispatch.test.ts | trimmed | replaced Plan 02/03 describes with "retired components absent" |

## Security guard

- typography test: `sandbox="allow-scripts"` (line 208) and `not.toContain('allow-same-origin')` (line 209) retained
- issue-page-dispatch.test.ts: "Security: theme.ts invariants preserved" describe retained
- game-sandbox.test.ts, lib/theme.ts, lib/game-validator.ts: zero diff across this plan

## Nav fix

IssueNav listed `#bonus` even when BonusSection returned null. Added `omit` prop; IssueLayout passes `['bonus']` when `issue.bonus` is absent. Bonus was the only nav section that can render nothing (sparse fixture renders the other seven). Tests: sparse issue has no nav href without a matching id; full issue keeps `#bonus`.

## Verification

- `pnpm --filter web test`: 61 files, 634 passed
- `pnpm --filter web typecheck`: clean
- `pnpm --filter web build`: success

## Deviations

1. [Rule 3] `__tests__/fixtures/issue.ts` had `conversation: null` that no longer type-checks; removed.
2. narrator-chip ordering test re-pointed at `<h1` because Hero has no `<time>` element.
3. Orphaned CSS `.del-conversation*` in globals.css left in place (plan forbids touching globals.css).

## Known Stubs

None.

## Self-Check: PASSED
