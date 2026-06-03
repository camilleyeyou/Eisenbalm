---
phase: 19-issue-page-redesign-dispatch-magazine-layout
plan: 05
subsystem: issue-page-live-wiring
tags: [stage-b, live-data, sanity-fetch, convex-subs, theme-suppression-reversal, runid, problemPdfUrl]
dependency_graph:
  requires: [19-04-stage-a-visual-approval]
  provides: [live-wired-issue-page, unconditional-per-issue-theming, nyquist-compliant-phase-19]
  affects:
    - apps/web/app/issue/[slug]/layout.tsx
    - apps/web/app/issue/[slug]/page.tsx
    - apps/web/components/issue/EditorialSection.tsx
    - apps/web/__tests__/issue-page-dispatch.test.ts
    - apps/web/lib/theme.test.ts
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-VALIDATION.md
tech_stack:
  added: []
  patterns:
    - QUERY_ISSUE_BY_SLUG live fetch replacing MOCK_ISSUE (minimal-diff data swap)
    - serializeThemeCss(theme) unconditional — no suppression gate in web layout
    - issue.runId threaded to GameSlot (GAM-05) and DeliberationSlot (Convex subs DEL-01)
    - issue.problemPdfUrl threaded to EditorialSection pdfUrl prop
    - pdfUrl prop on EditorialSection renders 44px accessible download link (UI-SPEC §7)
    - IssueBriefing stats derived from live charity.foundingYear
    - lib/theme.test.ts Phase 19 unconditional-theming contract (replaces MED-01 suppression gate)
key_files:
  modified:
    - apps/web/app/issue/[slug]/layout.tsx
    - apps/web/app/issue/[slug]/page.tsx
    - apps/web/components/issue/EditorialSection.tsx
    - apps/web/__tests__/issue-page-dispatch.test.ts
    - apps/web/lib/theme.test.ts
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-VALIDATION.md
decisions:
  - "DESIGNAGENT_SUPPRESSED removed from web theming path (Phase 19 reversal) — pipeline flag stays, web theming unconditional"
  - "pdfUrl added to EditorialSection rather than wrapping with a new component — minimal diff, reuses existing section structure"
  - "briefingStats derives only foundingYear from live data — stat list kept minimal to avoid null-stat rendering issues"
  - "lib/theme.test.ts MED-01 section updated to Phase 19 unconditional contract — IssueTheme import added (fixes pre-existing typecheck error)"
  - "briefingToc as mutable array (no as const) — IssueBriefing expects TocItem[] mutable type"
metrics:
  duration: 14 minutes
  completed_date: "2026-06-03T19:46:16Z"
  tasks_completed: 3
  files_modified: 6
  files_created: 0
---

# Phase 19 Plan 05: Stage B Live Wiring and Verification Summary

Minimal-diff data wiring: MOCK_ISSUE removed, live Sanity fetch threaded, per-issue theming re-enabled unconditionally, runId and problemPdfUrl wired through, suppression-off tripwire activated, full suite green, 19-VALIDATION.md flipped to nyquist_compliant.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Re-enable per-issue theming in layout.tsx; fix lib/theme.test.ts IssueTheme typecheck error | `892391c` | layout.tsx, lib/theme.test.ts |
| 2 | Swap MOCK_ISSUE for live Sanity fetch; thread runId + problemPdfUrl | `3f8d319` | page.tsx, EditorialSection.tsx |
| 3 | Activate suppression-off tripwire; flip 19-VALIDATION.md nyquist_compliant | `b1ba84f` | issue-page-dispatch.test.ts, 19-VALIDATION.md |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] pdfUrl prop added to EditorialSection**
- **Found during:** Task 2
- **Issue:** `EditorialSection` had no `pdfUrl` prop, but the plan spec (UI-SPEC §7) requires the Problem section to render a PDF download button when `issue.problemPdfUrl` is populated.
- **Fix:** Added `pdfUrl?: string` prop to `EditorialSectionProps`; renders an accessible anchor with `min-height: 44px`, `aria-label`, and `↓ Download the Problem Statement Deck (PDF)` copy when set.
- **Files modified:** `apps/web/components/issue/EditorialSection.tsx`
- **Commit:** `3f8d319`

**2. [Rule 1 - Bug] TypeScript `as const` causes readonly type mismatch with IssueBriefing toc prop**
- **Found during:** Task 2 typecheck
- **Issue:** `briefingToc` defined with `as const` made it `readonly`, but `IssueBriefing` expects a mutable `TocItem[]`.
- **Fix:** Removed `as const` from `briefingToc` declaration.
- **Files modified:** `apps/web/app/issue/[slug]/page.tsx`
- **Commit:** `3f8d319`

**3. [Rule 2 - Missing critical functionality] lib/theme.test.ts pre-existing IssueTheme import error fixed**
- **Found during:** Task 1 (noted in 19-04 SUMMARY as "pre-existing typecheck error")
- **Issue:** `lib/theme.test.ts` referenced `IssueTheme` without importing it (node:test file, last touched Phase 12), causing a typecheck error. Plan 05 instructions explicitly required fixing this.
- **Fix:** Added `import type { IssueTheme } from './sanity/types.js'` to theme.test.ts.
- **Files modified:** `apps/web/lib/theme.test.ts`
- **Commit:** `892391c`

### MED-01 Suppression Contract Update (Rule 2 — required by plan)

The `lib/theme.test.ts` MED-01 describe block documented the OLD Phase 12 `suppressed ? '' : serializeThemeCss(theme)` contract. Phase 19 reverses this. The block was updated to document the new unconditional contract:
- Old: "suppressed-mode CSS is empty string" helper test
- New: "serializeThemeCss always returns non-empty :root block regardless of theme value"

All security-invariant assertions (hex validation, FONT_WHITELIST, WCAG AA gate, setProperty-only) are **unchanged**.

## Security Invariants Verified

| Invariant | Status |
|-----------|--------|
| `serializeThemeCss` validates hex before CSS emission | PRESERVED — WEB-07 |
| `applyTheme` uses only `element.style.setProperty()` | PRESERVED — WEB-08 |
| WCAG AA contrast gate in `applyTheme` | PRESERVED — WEB-09 |
| FONT_WHITELIST membership enforced at write time | PRESERVED — AGT-14 |
| `sandbox="allow-scripts"` in GameSlot, never `allow-same-origin` | PRESERVED — GAM-01 |
| `DESIGNAGENT_SUPPRESSED` removed from web theming path | REVERSED — now unconditional (DES-06, WEB-06) |
| DEL-04: no model names in deliberation components | PRESERVED |
| DEL-01..05: 5 Convex useQuery subscriptions preserved | PRESERVED |

## Verification Matrix Results

| Gate | Result |
|------|--------|
| `pnpm --filter web test:unit` | 282 passed / 13 todo (was 279/14) — +3 active suppression-off assertions |
| `pnpm --filter web typecheck` | 5 pre-existing errors only (checkout/stripe tests — unchanged from Stage A) |
| `pnpm --filter web build` | Clean — all static pages generated |
| `grep -c "MOCK_ISSUE" page.tsx` | 0 |
| `grep -c "QUERY_ISSUE_BY_SLUG" page.tsx` | 5 (import + multiple uses) |
| `grep -c "issue.runId" page.tsx` | 2 (GameSlot + DeliberationSlot) |
| `grep -c "problemPdfUrl" page.tsx` | 1 |
| `grep -c "it.todo" issue-page-dispatch.test.ts` | 0 |
| `19-VALIDATION.md nyquist_compliant` | true |

## Stage B UAT (checkpoint:human-verify — auto-approved per auto_advance: true)

Auto mode is active (`auto_advance: true`). The following requires live browser verification by Andrew:

1. **Live content renders:** Open a real published issue at `/issue/[real-slug]` — all 10 sections should render with live Sanity data.
2. **Per-issue theme override:** Set distinct `theme.accentColor` values on two published issues in Sanity Studio; confirm accent color (links, eyebrows, drop cap, pull-quote border) changes between them while layout/grid/motion are identical (DES-06).
3. **Deliberation with runId:** Open a real issue with `runId` set; confirm DelibScoreboard shows candidate scores + DelibChat renders the conversation from `selectionDeliberation.conversation`.
4. **PDF download button:** Open an issue with `problemPdfUrl` set; confirm "↓ Download the Problem Statement Deck (PDF)" button appears on the Problem section with min-height 44px.
5. **Reduced-motion:** Toggle OS reduced-motion; confirm all sections are fully visible (no opacity-0/hidden states).

## Self-Check: PASSED

Files modified:
- apps/web/app/issue/[slug]/layout.tsx: FOUND
- apps/web/app/issue/[slug]/page.tsx: FOUND
- apps/web/components/issue/EditorialSection.tsx: FOUND
- apps/web/__tests__/issue-page-dispatch.test.ts: FOUND
- apps/web/lib/theme.test.ts: FOUND
- .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-VALIDATION.md: FOUND

Commits:
- 892391c: FOUND
- 3f8d319: FOUND
- b1ba84f: FOUND

Test results: 282 passed + 13 todo (32 files) — all green
Typecheck: 5 pre-existing errors only — no new errors
Build: exits 0 — static pages generated
nyquist_compliant: true — 19-VALIDATION.md flipped
