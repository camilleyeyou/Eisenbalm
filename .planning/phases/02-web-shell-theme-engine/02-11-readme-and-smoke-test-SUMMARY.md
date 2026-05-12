---
phase: 02-web-shell-theme-engine
plan: 11
subsystem: ui
tags: [next.js, readme, smoke-test, documentation, onboarding, vercel]

requires:
  - phase: 02-01 through 02-10
    provides: "all Phase 2 app code (routes, theme engine, seed, sitemap, RSS, JSON-LD) that the README documents and the smoke test exercises"

provides:
  - "apps/web/README.md: full developer onboarding doc covering routes, prerequisites, setup, scripts, architecture notes (two-layer theme injection, Sanity reader, print stylesheet), Vercel deploy steps, troubleshooting"
  - "Andrew's empirical verification: all 16 WEB-* success criteria confirmed PASS against the running dev server with demo seed"
  - "Phase 2 closure: every WEB-* requirement manually exercised by the human editor; no open failures"

affects:
  - "Any future contributor onboarding to apps/web — README is the entry point"
  - "Phase 8 (Stripe) — inherits the documented dev setup and Vercel env var pattern"
  - "Phase 9 (Issue Page Completion) — theme injection architecture documented here is extended"

tech-stack:
  added: []
  patterns:
    - "apps/web README mirrors apps/studio README tone: Status → Routes → Prerequisites → Setup → Scripts → Architecture notes → Vercel deploy → Troubleshooting"
    - "Vercel deploy documented as a manual Andrew step (vercel link → vercel → vercel --prod) per CONTEXT.md D-27"

key-files:
  created: []
  modified:
    - apps/web/README.md

key-decisions:
  - "README explicitly documents the two-layer theme injection (server-side serializeThemeCss for FOUC prevention + client-side ThemeApplier for defense-in-depth) so Phase 5/9 engineers understand the architecture before touching it"
  - "Vercel env var list kept minimal (3 vars) — Phase 8 will append Stripe vars"

patterns-established:
  - "Smoke-test-before-phase-close: every Phase 2 WEB-* requirement verified by Andrew against a live dev server before phase is marked complete"

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11, WEB-12, WEB-13, WEB-14, WEB-15, WEB-16]

duration: ~20min (Task 1 automated + Task 2 Andrew smoke test)
completed: 2026-05-12
---

# Phase 2 Plan 11: README and Smoke Test Summary

**apps/web/README.md onboarding doc delivered + Andrew manually verified all 16 WEB-* success criteria PASS against the live dev server with the demo seed running**

## Performance

- **Duration:** ~20 min (Task 1 auto + Task 2 human gate)
- **Started:** 2026-05-11T00:00:00Z
- **Completed:** 2026-05-12T00:00:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- `apps/web/README.md` replaces the Phase 1 placeholder with a full developer onboarding document: status banner, routes table (10 routes), prerequisites, step-by-step setup (pnpm install → seed:demo → dev:web), scripts reference, architecture notes covering the Sanity reader, two-layer theme injection, print stylesheet, and ISR pattern, Vercel deploy instructions, and troubleshooting section.
- Andrew ran the complete 16-item WEB-* smoke test checklist against the dev server with the demo seed ("The Quiet Foundation" / Issue 1) and returned "approved" — all 16 passed.
- Theme injection security path empirically confirmed: invalid hex fallback (WEB-07), WCAG AA low-contrast fallback (WEB-09), and client-side ThemeApplier re-validation (WEB-08) all verified by Andrew.

## Task Commits

1. **Task 1: apps/web/README.md** — `b07a9e6` (docs)
2. **Task 2: smoke test checkpoint** — approved by Andrew; no code changes required (all 16 PASS). Partial-progress chore note committed at `4ab6b9d`.

**Plan metadata:** committed in this docs commit (see final commit below).

## Files Created/Modified

- `apps/web/README.md` — Replaced Phase 1 placeholder. Sections: Status, Routes table, Prerequisites, Setup (4-step: install → env → seed:demo → dev:web), Scripts table, Architecture notes (Sanity reader, theme engine two-layer injection, routes/ISR, print stylesheet), Vercel deploy, Troubleshooting.

## Smoke Test Results (Andrew — 2026-05-12)

Andrew's verdict: **approved** — all 16 WEB-* items passed plus all three UI-SPEC extras.

| # | Requirement | Result | Notes |
|---|---|---|---|
| 1 | WEB-01 | PASS | `/` 307-redirects to `/issue/issue-1`; full issue HTML in view-source |
| 2 | WEB-02 | PASS | All 8 section `id=` anchors present; correct order in DOM |
| 3 | WEB-03 | PASS | Archive row visible; "quiet" filter keeps it; "asdf" shows empty state; sort toggle no errors |
| 4 | WEB-04 | PASS | `/charities` lists The Quiet Foundation; detail page shows all fields + external links |
| 5 | WEB-05 | PASS | `/about` renders locked placeholder copy |
| 6 | WEB-06 | PASS | Inline `<style>` in `<head>` contains `:root { --color-bg: #F5EEDC; --color-text: #1A1A18; --color-primary: #14213D; --color-accent: #FCA311; ... }` |
| 7 | WEB-07 | PASS | `theme.primaryColor = "red"` falls back to `#2D5016`; no crash; `[theme]` console warning logged |
| 8 | WEB-08 | PASS | Page source has `<style>` tag (not template-literal); client `ThemeApplier` reapplies validated values on mount; invalid devtools hex rejected with warning |
| 9 | WEB-09 | PASS | `backgroundColor=#FFFFFF` + `textColor=#CCCCCC` (1.6:1) reverts to `#FAFAF8` / `#1A1A18`; no crash |
| 10 | WEB-10 | PASS | `<script type="application/ld+json">` contains `@type:Article`, `datePublished:2026-06-05`, `author.name:Jesse A. Eisenbalm`, `about.@type:NGO` |
| 11 | WEB-11 | PASS | OG + Twitter card meta tags present on issue page and archive |
| 12 | WEB-12 | PASS | `/sitemap.xml` valid XML; contains `/`, `/archive`, `/charities`, `/about`, `/shop`, `/issue/issue-1`, `/charities/the-quiet-foundation` |
| 13 | WEB-13 | PASS | `/feed.xml` valid RSS 2.0; channel title "The Eisenbalm Dispatch"; one `<item>` for The Quiet Foundation Issue 1 |
| 14 | WEB-14 | PASS | Print preview: header/footer/anchor buttons/game/deliberation/podcast/shop callout hidden; black-on-white serif |
| 15 | WEB-15 | PASS | Reading time visible in hero metadata row (single-digit min read, not 0) |
| 16 | WEB-16 | PASS | Link icon click shows shadcn Tooltip "Copied" for 1500ms; pasted URL ends with `#origin-story` |
| E1 | UI-SPEC | PASS | `/not-found` garbage URL renders "This page does not exist." |
| E2 | UI-SPEC | PASS | Shop callout on issue page: correct one-sentence copy + "Buy the lip balm" button linking to `/shop` |
| E3 | UI-SPEC | PASS | `/shop` shows "This week's proceeds benefit The Quiet Foundation." + disabled "Coming soon" button |

## Decisions Made

- README documents the two-layer theme injection explicitly so future Phase 5/9 engineers understand the server (FOUC prevention) vs client (defense-in-depth) split before modifying either layer.
- Vercel env var section kept to three vars; Phase 8 will append `STRIPE_*` and `NEXT_PUBLIC_STRIPE_*` to this list per the commerce phase plan.

## Deviations from Plan

None — plan executed exactly as written. Task 1 automated; Task 2 was a blocking checkpoint:human-verify gate that Andrew cleared on 2026-05-12 with all 16 WEB-* items and 3 UI-SPEC extras marked PASS.

## Issues Encountered

None. No failures were reported by Andrew during the smoke test. No gap closure cycle was needed.

## Known Stubs

- `apps/web/app/about/page.tsx` — placeholder copy ("This page is being written.") per UI-SPEC lock. Andrew supplies final /about content in a later phase (no plan number assigned yet).
- `apps/web/app/shop/page.tsx` — Phase 2 shell with disabled button. Phase 8 (Stripe) replaces this entirely.
- `apps/web/public/og-default.png` — off-white 1200x630 placeholder from Plan 02-10. Replace with real brand artwork before launch.

## Next Phase Readiness

- Phase 2 is fully closed: all 11 plans complete, all 16 WEB-* requirements empirically verified by Andrew.
- Phase 3 (Convex Deployment) and Phase 8 (Stripe) can both begin immediately — Phase 3 depends only on Phase 1, Phase 8 depends only on Phase 2.
- The theme engine documented in `apps/web/README.md` and `apps/web/lib/theme.ts` is the stable interface for Phase 5 (DesignAgent) and Phase 9 (issue page completion).
- Font whitelist blocker remains open: Andrew or designer must approve the ~25-font extended whitelist before Phase 5 closes.

---
*Phase: 02-web-shell-theme-engine*
*Completed: 2026-05-12*
