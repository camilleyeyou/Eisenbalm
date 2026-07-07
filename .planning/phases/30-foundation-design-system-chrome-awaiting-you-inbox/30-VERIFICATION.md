---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
verified: 2026-07-07T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 1 visual item needs human sign-off
human_verification:
  - test: "Visual UAT: compare the live dispatch-control console (masthead, sidebar, placeholder screens, Config/Finance/Settings, How-to-use) against docs/design/dispatch-control-v2/Dispatch Control.dc.html"
    expected: "Every screen matches the 1c anti-SaaS look (hard edges, correct type scale/tracking, correct token colors) with no leftover default shadcn/Tailwind gray styling visible to the eye — token-swap and chrome rebuild were verified by source-scan/grep, not by rendering the app."
    why_human: "Steps 3-7's grep/test tripwires prove the CSS-variable tokens and class names are present in source, but cannot confirm visual fidelity (spacing, contrast, font rendering, dropdown positioning) against the dc.html spec. 30-03-SUMMARY.md itself flags this as an open recommendation before considering Phase 30 fully verified."
---

# Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox Verification Report

**Phase Goal:** Every console screen presents the 1c design system, the operator always sees pipeline/spend/lock status from the masthead, navigation is workflow-ordered, and a single inbox aggregates everything blocked on a human — with the deployed dashboard actually reaching the pipeline API.
**Verified:** 2026-07-07
**Status:** human_needed (all automated checks pass; one visual-fidelity item needs Andrew's eyes)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, goal-backward anchors)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Every screen renders using the 1c token set + 4 fonts via `next/font`, no leftover default styling | ✓ VERIFIED (source-level); ? needs visual UAT | `globals.css` has full `@theme` token block (`--color-ink: #17140e`, `--color-cobalt: #253ad4`, `--color-vermilion: #e8471d`, `--color-marigold: #f2b01e`, `--color-green: #148a52`, `--radius: 0`); `layout.tsx` loads Newsreader/Lora/Space_Grotesk/IBM_Plex_Mono via `next/font/google` with all 4 `.variable` classes on `<body>`; `screen-token-swap.test.ts` (65 tests) asserts zero `neutral-`/`bg-white`/`text-white`/`text-black` literals remain across the 13 Config/Finance/Settings files and that each references a 1c token |
| 2 | Masthead on every route shows issue #, pipeline-state chip, MTD spend vs cap, auto-publish lock chip, live | ✓ VERIFIED | `Masthead.tsx` wires `api.runs.latest`, `api.pipelineRuns.byRunId`, `api.runs.monthToDateCost`, `api.pipelineConfig.getAll` via `useQuery`; renders `Issue {n}`, marigold state chip, `$mtd / $cap` (vermilion tint at/over cap), `Auto-publish ON/OFF`; mounted in `(dashboard)/layout.tsx` above the sidebar+main row so it wraps every dashboard route; `Masthead.test.tsx` (9 tests) passes all behavior assertions |
| 3 | Left nav lists Review Desk, Signal Desk, Run Monitor, Voice Pass / Prompt Lab, Eval Center, Registry in order + How-to-use screen | ✓ VERIFIED | `lib/nav.ts` `NAV_GROUPS` matches exactly: Workflow (Review Desk, Signal Desk, Run Monitor, Voice Pass) → Craft & memory (Prompt Lab, Eval Center, Registry) → Operations (Config, Finance, Settings), `NAV_PINNED` = How to use; `AppSidebar.tsx` renders groups + pinned item with `w-[210px]`, `bg-[color:var(--color-nav)]`, active = ink bg + `border-[color:var(--color-vermilion)]` 3px left border; `how-to-use/page.tsx` contains the 5 weekly-loop steps, 4-entry color legend, and 4 house rules verbatim (`Nothing silent.`, `The irreversible ones ask twice.`, etc.); `nav.test.ts` (4 tests) walks every href and confirms a `page.tsx` exists |
| 4 | Awaiting-you inbox lists every awaiting-review run, Gate 1 interrupt, unresolved blocker, failed run; items route to owning screen | ✓ VERIFIED | `AwaitingYouInbox.tsx` derives 4 categories purely from `runs.listForWorkspace`, `runs.latest`, `qaCorrections.byRunId`, `claimChecks.allSignedOff` (zero `mutation(` calls — grep confirms 0); blockers-first order (QA errors → open sign-offs → awaiting-review → current-cycle-failed); every item is a `next/link` to `/run-monitor/runs/{runId}/review` or `/run-monitor/runs/{runId}`; wired into `Masthead.tsx`'s Awaiting-you trigger via `useState` + `relative`-positioned dropdown; `AwaitingYouInbox.test.tsx` (8 tests) passes all behavior + no-mutation assertions |
| 5 | Deployed dashboard's test-run panel calls the pipeline API in production | ✓ VERIFIED (human-attested, per task instructions) | Per orchestrator instruction, this criterion (CHR-05) was human-verified 2026-07-07 by Andrew via a live test-run on the deployed dashboard; recorded in `apps/dispatch-control/DEPLOY.md` §"CHR-05: verified live (2026-07-07)" (both `NEXT_PUBLIC_PIPELINE_URL` and `DASHBOARD_ALLOWED_ORIGINS` documented) and `30-08-SUMMARY.md` (test-run against the advocate agent's fixture returned real cost + a full 6-axis voice-score panel, no CORS/unset-URL error) |

**Score:** 5/5 truths verified at the source/automated level; criterion 1's visual fidelity (does it *look* like the dc.html spec, not just reference the right token names) is flagged for human UAT below.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `docs/design/dispatch-control-v2/` (7 files) | Binding 1c visual spec in-repo | ✓ VERIFIED | `ls` confirms exactly 7 files incl. `Dispatch Control.dc.html` (non-empty, `disp_howto` present), `DECISIONS.md`, `README.md` |
| `apps/dispatch-control/app/globals.css` | 1c `@theme` token block + preserved `.cm-prompt-editor` rules + hard edges | ✓ VERIFIED | All 5 named hex tokens present, `--radius: 0` present, `.cm-var-known`/`.cm-var-unknown` rules intact |
| `apps/dispatch-control/app/layout.tsx` | 4 `next/font/google` loaders as CSS vars on `<body>` | ✓ VERIFIED | `Newsreader`, `Lora`, `Space_Grotesk`, `IBM_Plex_Mono` all imported/configured; all 4 `.variable` classes interpolated on `<body>` |
| `app/(dashboard)/{review-desk,signal-desk,voice-pass,eval-center,how-to-use}/page.tsx` | Placeholders + how-to-use | ✓ VERIFIED | All 5 exist; placeholders use `_PlaceholderScreen.tsx` with "coming in {phase}" honest-placeholder copy, zero `neutral-` literals |
| `app/(dashboard)/run-monitor/{page,runs/page,graph/page}.tsx` | Tab shell hosting Runs + Graph (D-05) | ✓ VERIFIED | All 3 exist; old `graph/`, `runs/`, `prompts/` dirs removed (git mv) |
| `apps/dispatch-control/next.config.ts` | `redirects()` old→new (D-03) | ✓ VERIFIED | 6 redirect entries covering `/graph`, `/runs`, `/prompts` (+ `:path*` variants) → new homes, all `permanent: true` |
| `apps/dispatch-control/__tests__/screen-token-swap.test.ts` | Tripwire — no `neutral-`/`bg-white` in 13 files | ✓ VERIFIED | 65 tests, all green; `grep -rl neutral-`/`bg-white` on config+finance+settings returns nothing |
| `apps/dispatch-control/components/Masthead.tsx` | Persistent masthead, 4 live chips + trigger + `UserButton` | ✓ VERIFIED | Contains `monthToDateCost`, `monthly_cap_usd`, `auto_publish`, `var(--color-vermilion)`, `h-[52px]`; `UserButton` imported from `@clerk/nextjs` |
| `apps/dispatch-control/app/(dashboard)/layout.tsx` | Column layout mounting `<Masthead/>` | ✓ VERIFIED | `flex-col` outer div, `<Masthead />` first child, `<AutoPublishBanner>` preserved inside `<main>` |
| `apps/dispatch-control/lib/nav.ts` | Grouped `NAV_GROUPS` (3 groups) + pinned item | ✓ VERIFIED | Matches spec verbatim, no icon imports |
| `apps/dispatch-control/components/AppSidebar.tsx` | 1c grouped sidebar, dc.html active-state formula | ✓ VERIFIED | `w-[210px]`, vermilion active border, `min-h-[44px]` tap targets, no duplicate `UserButton` |
| `apps/dispatch-control/components/AwaitingYouInbox.tsx` | Pure-derivation dropdown | ✓ VERIFIED | `listForWorkspace`, `allSignedOff`, `byRunId`, `/run-monitor/runs/`, `w-[360px]` all present; 0 `mutation(` calls |
| `apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` | Full weekly-loop/legend/house-rules content | ✓ VERIFIED | All 5 loop steps, both spot-checked hex+meaning legend entries, and all 4 house-rule headlines present verbatim |
| `apps/dispatch-control/DEPLOY.md` | Dated "verified live" CHR-05 entry | ✓ VERIFIED | `NEXT_PUBLIC_PIPELINE_URL` and `DASHBOARD_ALLOWED_ORIGINS` both present under a "CHR-05: verified live (2026-07-07)" heading |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `layout.tsx` | `globals.css` | font CSS vars in `@theme` | ✓ WIRED | `--font-display: var(--font-newsreader), serif;` etc. all reference the `.variable` names set in `layout.tsx` |
| `(dashboard)/page.tsx` | `/review-desk` | `redirect()` | ✓ WIRED | `redirect('/review-desk')`, no `app/page.tsx` conflict |
| `next.config.ts` | `/run-monitor`, `/prompt-lab` | permanent redirects | ✓ WIRED | Confirmed via grep + build; no stale `/runs`, `/graph`, `/prompts` links remain anywhere in `app/`/`components/` |
| `Masthead.tsx` | Convex `runs.latest` / `pipelineConfig.getAll` / `runs.monthToDateCost` / `pipelineRuns.byRunId` | `useQuery` | ✓ WIRED | All 4 query names exist in `convex/*.ts`; `'skip'` sentinel used correctly for the cross-ref query |
| `AppSidebar.tsx` | `lib/nav.ts` | `NAV_GROUPS`/`NAV_PINNED` import | ✓ WIRED | Direct import, mapped to `<Link>` with `usePathname()` active-state check |
| `AwaitingYouInbox.tsx` | `/run-monitor/runs/{runId}/review` | `next/link` | ✓ WIRED | Routes match the post-30-02 route tree; `ReviewQueue.tsx` precedent followed |
| `Masthead.tsx` | `AwaitingYouInbox` | trigger toggles dropdown open state | ✓ WIRED | `useState`, `relative` container, backdrop-click-to-close all present |
| Deployed dashboard (Vercel) | Railway pipeline `/agents/{key}/test-run` | `NEXT_PUBLIC_PIPELINE_URL` + `DASHBOARD_ALLOWED_ORIGINS` | ✓ WIRED (human-attested) | Recorded in `DEPLOY.md`; live test-run evidence in `30-08-SUMMARY.md` |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | --------------- | ------------ | ------ | -------- |
| CHR-01 | 30-01, 30-03 | 1c design system on every screen | ✓ SATISFIED | Token/font substrate (30-01) + literal-class swap on Config/Finance/Settings (30-03), both test-locked |
| CHR-02 | 30-04 | Persistent masthead with live status | ✓ SATISFIED | `Masthead.tsx` + layout mount, `Masthead.test.tsx` green |
| CHR-03 | 30-02, 30-05, 30-07 | Workflow-ordered nav + How-to-use | ✓ SATISFIED | Route skeleton (30-02) + grouped nav (30-05) + full How-to-use content (30-07) |
| CHR-04 | 30-06 | Awaiting-you inbox, pure derivation | ✓ SATISFIED | `AwaitingYouInbox.tsx`, zero new backend, routes to real screens |
| CHR-05 | 30-08 | Production pipeline reachability | ✓ SATISFIED (human-verified 2026-07-07) | `DEPLOY.md` + `30-08-SUMMARY.md` |

No orphaned requirements — all 5 CHR-0x IDs from `.planning/REQUIREMENTS.md` §Phase 30 appear in at least one plan's `requirements:` frontmatter, and each is independently evidenced above.

### Automated Test Suite / Build

- `pnpm --filter dispatch-control test -- --run` → **242 passed, 2 todo, 1 skipped** across 29 test files (1 skipped file is `workspace-upsert.test.ts`, pre-existing/unrelated to Phase 30)
- `pnpm --filter dispatch-control build` → **exits 0**, all 19 routes compile (`/review-desk`, `/signal-desk`, `/run-monitor`, `/run-monitor/runs`, `/run-monitor/graph`, `/voice-pass`, `/prompt-lab`, `/prompt-lab/[agentKey]`, `/eval-center`, `/registry`, `/how-to-use`, `/config`, `/finance`, `/settings`, `/`, `/sign-in/[[...sign-in]]`, `/_not-found`)

### CONTEXT.md Locked Decisions Spot-Check

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-01/D-06 (3 nav groups + Operations, dc.html fidelity) | ✓ Honored | `lib/nav.ts` matches exactly |
| D-02 (honest phase-labeled placeholders) | ✓ Honored | `_PlaceholderScreen.tsx` "coming in {phase}" pattern on all 4 unbuilt screens |
| D-03 (final route set + redirects) | ✓ Honored | All 8 final routes exist; 6 redirect rules cover old paths |
| D-04 (home → /review-desk) | ✓ Honored | `redirect('/review-desk')` in `(dashboard)/page.tsx` |
| D-05 (`/run-monitor` hosts Runs+Graph as tabs) | ✓ Honored | `run-monitor/{page,runs,graph}` structure confirmed |
| D-06/D-07 (token swap, no re-layout) | ✓ Honored | Config/Finance/Settings token-swapped, logic/structure preserved (spot-checked `monthly_cap_usd` wiring intact) |
| D-08/D-09/D-10/D-11 (inbox: pure derivation, no new backend, current-cycle scope, routes to real screens) | ✓ Honored | 0 `mutation(` calls in inbox file; current-cycle-only failed-run logic; all routes point to real `/run-monitor/runs/...` pages |
| D-12 (design bundle committed) | ✓ Honored | 7 files present verbatim under `docs/design/dispatch-control-v2/` |
| D-13 (How-to-use content from handoff) | ✓ Honored | Weekly loop, legend, house rules all verbatim-matched |
| D-14 (CHR-05 human checkpoint, both env vars + CORS) | ✓ Honored | Human-verified 2026-07-07, documented in `DEPLOY.md` |
| Phase 24 `.cm-prompt-editor` styles preserved | ✓ Honored | `.cm-var-known`/`.cm-var-unknown` rule blocks intact in `globals.css`; `PromptEditor.test.tsx` still passes |

### Anti-Patterns Found

None. Source-scan across all Phase 30 key files (`Masthead.tsx`, `AwaitingYouInbox.tsx`, `AppSidebar.tsx`, `nav.ts`, `how-to-use/page.tsx`, the 4 placeholder pages, `_PlaceholderScreen.tsx`) for `TODO|FIXME|XXX|HACK|not yet implemented|not available` returned zero matches. No hardcoded-empty stub patterns found in the inbox or masthead data derivation — every rendered value traces to a live Convex `useQuery`.

### Human Verification Required

### 1. Visual UAT against the dc.html spec

**Test:** Load the deployed (or locally-run) dispatch-control console and visually compare the masthead, sidebar, the four placeholder screens, Config/Finance/Settings, and How-to-use against `docs/design/dispatch-control-v2/Dispatch Control.dc.html`.
**Expected:** The console reads as the hard-edged 1c anti-SaaS design — no rounded-corner SaaS card styling, correct type scale/letter-spacing on the wordmark and nav labels, correct chip colors, dropdown positioning under the Awaiting-you trigger, and no visually "off" spacing introduced by the mechanical token-swap pass on Config/Finance/Settings (D-07 explicitly allowed layout follow-ups to be *noted* rather than fixed in this phase).
**Why human:** All Phase 30 automated checks (`grep`, source-scan tests, `pnpm build`) confirm the *correct token/class names* are present in source — they cannot confirm rendered visual fidelity, font loading in a real browser, or that the mechanical class-for-class swap didn't produce an awkward layout. `30-03-SUMMARY.md` itself explicitly flags this open item ("a visual UAT pass against `Dispatch Control.dc.html` is recommended before considering Phase 30 fully verified").

### Gaps Summary

No functional gaps found. All 5 phase requirements (CHR-01 through CHR-05) are satisfied at the source/test/build level, all must_haves from all 8 plans are verified against the actual codebase (not just SUMMARY claims), and no orphaned requirements exist. CHR-05's production-reachability criterion was independently confirmed via the documented human checkpoint. The sole open item is a visual/aesthetic UAT pass — recommended by the plan authors themselves — which is inherently unautomatable and does not block the phase's functional goal achievement.

---

*Verified: 2026-07-07*
*Verifier: Claude (gsd-verifier)*
