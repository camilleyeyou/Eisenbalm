---
phase: 19-issue-page-redesign-dispatch-magazine-layout
verified: 2026-06-03T20:30:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Open a real published issue at /issue/[real-slug] and confirm all 10 sections render with live Sanity data (charity name, origin story, problem, founder bio, case study, game iframe, bonus, deliberation, podcast, shop band)"
    expected: "All 10 sections display real content. No MOCK_ISSUE placeholder text visible."
    why_human: "Requires a real published Sanity issue with a slug; cannot be asserted by source scan or build output."
  - test: "Open two published issues with different Sanity theme.accentColor values (or set a distinct accentColor on one issue in Sanity Studio) and compare the rendered pages"
    expected: "Accent color (links, eyebrows, drop cap first letter, pull-quote border) changes between issues while section structure, grid, and motion are identical (DES-06). The oxblood #9A3324 default applies when no theme is set."
    why_human: "Per-issue theme override requires two live issues with distinct Sanity theme fields; visual comparison cannot be automated."
  - test: "Open a published issue with a real runId set in Sanity. Navigate to the deliberation section."
    expected: "DelibScoreboard shows candidate scores from live Convex data. DelibChat renders the conversation messages from issue.selectionDeliberation.conversation. The 5 Convex useQuery subscriptions (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections) receive live data."
    why_human: "Requires a live pipeline run with runId populated in Sanity and Convex data written; cannot be tested without a real run."
  - test: "Open a published issue with problemPdfUrl set in Sanity. Inspect the Problem section."
    expected: "A button '↓  Download the Problem Statement Deck (PDF)' appears with min-height 44px and an appropriate aria-label."
    why_human: "Requires a live issue with problemPdfUrl populated; visual/interaction check."
  - test: "Toggle OS prefers-reduced-motion (macOS: System Settings > Accessibility > Display > Reduce motion) and open /issue/[slug]"
    expected: "All 10 sections are immediately visible with no hidden, opacity-0, or empty states. Scroll reveals show content immediately. Stat count-ups show final values. DelibChat shows all messages at once. ConfidenceBar shows full width immediately. No content is trapped behind motion."
    why_human: "Requires browser environment with OS reduced-motion flag active; cannot be asserted by source scan."
---

# Phase 19: Issue Page Redesign — Dispatch Magazine Layout — Verification Report

**Phase Goal:** Rebuild `/issue/[slug]` to match the Dispatch oxblood/cream magazine prototype precisely, replacing the old Atmosphere aurora + vertical-timeline SectionNavigator with 10 locked sections, Fraunces/Newsreader/IBM Plex Mono fonts, framer-motion animations, per-issue Sanity theme re-enabled, and Stage B live data wiring.

**Verified:** 2026-06-03T20:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 10 sections render in locked order in page.tsx; Atmosphere.tsx + SectionNavigator.tsx deleted | VERIFIED | page.tsx documents and renders 14 items (ScrollProgressBar, SectionRail, IssueMasthead, IssueBriefing, MissionBand, 4x EditorialSection, CaseStudySection, GameSlot, BonusSection, DeliberationSlot, PodcastSlot, ShopBand) in exact order; `ls components/issue/` confirms Atmosphere.tsx and SectionNavigator.tsx absent |
| 2 | Fraunces/Newsreader/IBM Plex Mono load via next/font; FONT_WHITELIST has 9 entries including the 3 new ones; BRAND_DEFAULTS oxblood/cream | VERIFIED | `grep` returns 6 matches for Fraunces/Newsreader/IBM_Plex_Mono in layout.tsx; 0 matches for old Playfair_Display/Lora/Inter; FONT_WHITELIST in theme.ts has all 9 entries; BRAND_DEFAULTS has `primary: '#9A3324'`, `accent: '#9A3324'`, `bg: '#FBFAF6'`, `text: '#1A1714'`, `fontDisplay: 'Fraunces'`, `fontBody: 'Newsreader'`, `fontUi: 'IBM Plex Mono'` |
| 3 | serializeThemeCss + applyTheme emit --color-bg + --color-text; HEX_REGEX + security invariants unchanged | VERIFIED | serializeThemeCss body emits `--color-bg: ${p.bg}` and `--color-text: ${p.text}`; applyTheme has `setProperty('--color-bg', p.bg)` and `setProperty('--color-text', p.text)` including in the catch-block fallback; `HEX_REGEX = /^#[0-9a-fA-F]{6}$/` intact |
| 4 | Per-issue theming unconditional — suppression gate removed from layout.tsx | VERIFIED | `grep -c "suppressed ? '' :" layout.tsx` returns 0; `grep -c "serializeThemeCss(theme)" layout.tsx` returns 3 (used unconditionally); `DESIGNAGENT_SUPPRESSED` removed from live theming path; `ThemeApplier` called with `suppressed={false}` |
| 5 | MOCK_ISSUE removed; QUERY_ISSUE_BY_SLUG wired in page.tsx; runId threaded to GameSlot + DeliberationSlot | VERIFIED | `grep -c "MOCK_ISSUE" page.tsx` returns 0; `grep -c "QUERY_ISSUE_BY_SLUG" page.tsx` returns 5; `issue.runId ?? null` appears at both GameSlot and DeliberationSlot; `issue.problemPdfUrl` threaded to EditorialSection |
| 6 | 5 Convex useQuery subscriptions preserved in DeliberationSlot with 'skip' sentinel | VERIFIED | DeliberationSlot.tsx lines 49-53 contain all 5 subscriptions: pipelineRuns.byRunId, pitchLog.byRunId, deliberationEvents.byRunId, agentVotes.byRunId, qaCorrections.byRunId — each using `runId ? { runId } : 'skip'` |
| 7 | framer-motion in package.json; reduced-motion path uses `initial={false}` guard (no opacity-0 trap) | VERIFIED | `package.json` has `"framer-motion": "^12.40.0"`; ScrollReveal.tsx uses `initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}`; DelibChat.tsx uses `initial={prefersReducedMotion ? false : 'hidden'}`; ConfidenceBar.tsx and StatCountUp.tsx also import and honor useReducedMotion |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/issue/[slug]/page.tsx` | 10-section Dispatch layout, live Sanity fetch, no MOCK_ISSUE | VERIFIED | Live QUERY_ISSUE_BY_SLUG fetch; 14 JSX elements in locked order |
| `apps/web/app/issue/[slug]/layout.tsx` | Unconditional serializeThemeCss(theme), no suppression gate | VERIFIED | 3 occurrences of serializeThemeCss(theme); 0 occurrences of `suppressed ? '' :` |
| `apps/web/lib/theme.ts` | FONT_WHITELIST 9 entries, oxblood/cream BRAND_DEFAULTS, --color-bg/text in serialize+apply | VERIFIED | All checks pass; HEX_REGEX unchanged |
| `apps/web/app/layout.tsx` | Fraunces/Newsreader/IBM_Plex_Mono next/font wiring | VERIFIED | 6 matches for the 3 font names; 0 matches for old fonts |
| `apps/web/app/globals.css` | --color-bg #FBFAF6, --color-prose #2C2823, --color-accent #9A3324, --color-surface-accent, --color-accent-deep #6E2117 | VERIFIED | All 5 tokens present in :root; 0 occurrences of old #FAFAF8 |
| `apps/web/components/issue/ScrollReveal.tsx` | framer-motion scroll reveal, useReducedMotion | VERIFIED | Present; uses `initial={prefersReducedMotion ? false : ...}` |
| `apps/web/components/issue/ScrollProgressBar.tsx` | Scroll progress indicator | VERIFIED | Present in components/issue/ |
| `apps/web/components/issue/StatCountUp.tsx` | framer-motion animate 0→N, useReducedMotion | VERIFIED | Present; imports useReducedMotion from framer-motion |
| `apps/web/components/issue/SectionRail.tsx` | Sticky left scroll-spy nav, role=navigation | VERIFIED | Present; `role="navigation"` + `aria-label="Article sections"` confirmed |
| `apps/web/components/issue/IssueMasthead.tsx` | Compact masthead | VERIFIED | Present; used in page.tsx |
| `apps/web/components/issue/IssueBriefing.tsx` | 3-col briefing, StatCountUp | VERIFIED | Present; StatCountUp with `plain` prop support |
| `apps/web/components/issue/MissionBand.tsx` | Dark mission band | VERIFIED | Present; used in page.tsx |
| `apps/web/components/issue/ShopBand.tsx` | Shop band with data-shop-callout (CMR-09) | VERIFIED | 2 occurrences of `data-shop-callout` |
| `apps/web/components/issue/EditorialSection.tsx` | Drop caps, pull-quotes, pdfUrl prop | VERIFIED | pdfUrl prop added; renders accessible download button |
| `apps/web/components/issue/CaseStudySection.tsx` | Case study layout | VERIFIED | Present; id="case" in page.tsx |
| `apps/web/components/issue/GameSlot.tsx` | sandbox="allow-scripts", no allow-same-origin, aria-label | VERIFIED | 2 occurrences sandbox="allow-scripts"; 0 occurrences allow-same-origin; aria-label on play button |
| `apps/web/components/issue/BonusSection.tsx` | spec-ad bonus treatment | VERIFIED | Present; id="bonus" in page.tsx |
| `apps/web/components/issue/DeliberationSlot.tsx` | Dark-band centerpiece, 5 Convex subs | VERIFIED | Full rewrite; all 5 subscriptions with 'skip' sentinel |
| `apps/web/components/issue/DelibScoreboard.tsx` | Animated scoreboard | VERIFIED | Present |
| `apps/web/components/issue/DelibChat.tsx` | Message stagger, role=log, aria-live, DEL-04 SPEAKER_NAMES | VERIFIED | role="log" + aria-live="polite"; SPEAKER_NAMES const map; no model names |
| `apps/web/components/issue/ConfidenceBar.tsx` | CSS transition width, useReducedMotion | VERIFIED | Present; useReducedMotion guards CSS transition |
| `apps/web/components/issue/PodcastSlot.tsx` | Custom player, dynamic aria-label, audio controls | VERIFIED | aria-label="Play episode"/"Pause episode" |
| `apps/web/__tests__/issue-page-dispatch.test.ts` | All tripwires active, 0 it.todo remaining | VERIFIED | 0 it.todo; 282 tests pass / 13 todo total (todo in other files) |
| **DELETED:** `apps/web/components/issue/Atmosphere.tsx` | Retired | VERIFIED | Absent from components/issue/ directory listing |
| **DELETED:** `apps/web/components/issue/SectionNavigator.tsx` | Retired | VERIFIED | Absent from components/issue/ directory listing |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| layout.tsx | serializeThemeCss(theme) | unconditional call (no suppression gate) | WIRED | 3 occurrences of `serializeThemeCss(theme)`; 0 of `suppressed ? '' :` |
| page.tsx | QUERY_ISSUE_BY_SLUG (sanityClient.fetch) | live issue fetch | WIRED | 5 occurrences of QUERY_ISSUE_BY_SLUG; MOCK_ISSUE absent |
| page.tsx | GameSlot runId | issue.runId ?? null | WIRED | Line 256 |
| page.tsx | DeliberationSlot runId | issue.runId ?? null | WIRED | Line 263 |
| page.tsx | EditorialSection pdfUrl | issue.problemPdfUrl ?? undefined | WIRED | Line 236 |
| DeliberationSlot | 5 Convex useQuery | runId ? { runId } : 'skip' | WIRED | Lines 49-53 |
| layout.tsx | ThemeApplier | suppressed={false} | WIRED | ThemeApplier called with suppressed always false |
| theme.ts serializeThemeCss | --color-bg / --color-text | validated palette serialization | WIRED | Both vars emitted in :root block |
| theme.ts applyTheme | --color-bg / --color-text | element.style.setProperty | WIRED | Lines 350, 351, 383, 384 |
| app/layout.tsx | globals.css | --font-display-loaded / --font-body-loaded / --font-ui-loaded | WIRED | Fraunces/Newsreader/IBM_Plex_Mono with .variable |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| page.tsx | issue | sanityClient.fetch(QUERY_ISSUE_BY_SLUG, { slug }) | Yes — live Sanity GROQ query | FLOWING |
| DeliberationSlot | run/pitchLog/events/votes/corrections | useQuery with real runId | Real Convex subscriptions when runId present | FLOWING (skip when no runId — correct) |
| IssueBriefing | briefingStats | issue.charity.foundingYear | Derives from live charity data | FLOWING |
| ShopBand | charityName | issue.charity.name | Live Sanity field | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for live-data behaviors (server running required; Sanity/Convex external services). Automated proxy checks run instead.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes (282 tests) | `pnpm --filter web test:unit` | 282 passed / 13 todo (32 files) | PASS |
| Build completes clean | `pnpm --filter web build` | Static pages generated, 0 errors | PASS |
| Typecheck — no new errors | `pnpm --filter web typecheck` | 5 errors (pre-existing, Phase 08 files unchanged) | PASS (baseline) |
| MOCK_ISSUE removed | `grep -c "MOCK_ISSUE" page.tsx` | 0 | PASS |
| Suppression gate removed | `grep -c "suppressed ? '' :" layout.tsx` | 0 | PASS |
| framer-motion installed | `grep "framer-motion" package.json` | `"framer-motion": "^12.40.0"` | PASS |
| FONT_WHITELIST has 9 entries | Inspect theme.ts | 9 entries confirmed | PASS |
| Atmosphere.tsx deleted | `ls components/issue/Atmosphere.tsx` | File not found | PASS |
| SectionNavigator.tsx deleted | `ls components/issue/SectionNavigator.tsx` | File not found | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| P19-01 | 10 locked sections in order; Atmosphere + SectionNavigator deleted | SATISFIED | page.tsx comment documents locked order (sections 1-14); file system confirms deletions |
| P19-02 | Fraunces/Newsreader/IBM Plex Mono via next/font; FONT_WHITELIST 9 entries; BRAND_DEFAULTS fonts | SATISFIED | layout.tsx; theme.ts FONT_WHITELIST; BRAND_DEFAULTS |
| P19-03 | Oxblood/cream BRAND_DEFAULTS + globals.css; per-issue theme re-enabled; --color-bg/text emitted; security invariants intact | SATISFIED | theme.ts; globals.css; layout.tsx unconditional theming |
| P19-04 | framer-motion drives scroll reveals, count-ups, progress bar, rail, deliberation stagger; prefers-reduced-motion honored everywhere | SATISFIED | All 4 motion components use useReducedMotion(); `initial={prefersReducedMotion ? false : ...}` pattern confirmed |
| P19-05 | Two-staged delivery — Stage A approved by user before Stage B wired | SATISFIED | 19-04-SUMMARY.md documents user approval; Stage B completed in 19-05 |
| P19-06 | Zero-regression — 282 tests / 13 todo / 32 files; typecheck 5 pre-existing errors only; build clean; theme-aa-tones updated | SATISFIED | Test run confirmed; pre-existing typecheck errors trace to Phase 08 commits (e71619f), untouched by Phase 19 |
| P19-07 | Accessibility: role=navigation, aria-label, role=log, aria-live, skip-link, sandbox=allow-scripts, DEL-04 | SATISFIED | All checked in source; game-sandbox.test.ts green |
| DES-01 | FONT_WHITELIST includes Fraunces/Newsreader/IBM Plex Mono | SATISFIED | theme.ts FONT_WHITELIST confirmed |
| DES-06, WEB-06 | Per-issue theming re-enabled unconditionally | SATISFIED | layout.tsx; suppression gate removed |
| WEB-07 | serializeThemeCss validates hex before emission | SATISFIED | resolvePalette + HEX_REGEX validate before serialization |
| WEB-08 | applyTheme uses setProperty only | SATISFIED | Confirmed in theme.ts; --color-bg/text added via setProperty |
| WEB-09 | WCAG AA gate in applyTheme | SATISFIED | Security invariants preserved per SUMMARY.md self-check |
| GAM-01 | sandbox="allow-scripts"; no allow-same-origin | SATISFIED | 2 occurrences allow-scripts; 0 allow-same-origin |
| GAM-05 | runId threaded to GameSlot for QA write path | SATISFIED | page.tsx line 256 |
| DEL-01..05 | 5 Convex subscriptions preserved in DeliberationSlot | SATISFIED | Lines 49-53 DeliberationSlot.tsx |
| DEL-04 | No model names in deliberation components | SATISFIED | SPEAKER_NAMES const map; deliberation-no-model-names.test.ts green |
| POD-01 | audio controls as accessible source of truth | SATISFIED | PodcastSlot.tsx preserves <audio controls> |
| POD-03 | Dynamic aria-label on podcast play/pause | SATISFIED | aria-label={playing ? 'Pause episode' : 'Play episode'} |
| CMR-09 | data-shop-callout on shop section | SATISFIED | ShopBand.tsx has data-shop-callout (2 occurrences) |
| AGT-14 | FONT_WHITELIST membership enforced at write time | SATISFIED | validateFont uses FONT_WHITELIST membership check; unchanged |

**Note on REQUIREMENTS.md status table:** The table at lines 386-392 still shows P19-01..P19-07 as "Not started" — this is a known documentation artifact. The requirement narratives at lines 201-207 show them as completed with `[x]`. The status column in the table was not updated by the phase execution (this is a documentation gap in REQUIREMENTS.md only, not a code gap; all 7 requirements are implemented).

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `__tests__/checkout-create-session.test.ts` | 4 TypeScript "Object is possibly 'undefined'" errors | Info | Pre-existing from Phase 08 (commit e71619f); untouched by Phase 19; 2 of the prior Phase 19 typecheck errors were fixed (lib/theme.test.ts) |
| `__tests__/stripe-webhook-idempotency.test.ts` | 1 TypeScript "Object is possibly 'undefined'" error | Info | Same pre-existing Phase 08 baseline |

No blockers. No stub implementations found in Phase 19 deliverables. The ConfidenceBar defaults to value=80 when no explicit confidence prop is passed from page.tsx — this is an intentional design decision (no numeric confidence field in IssueDeliberation type) documented in 19-03-SUMMARY.md Known Stubs.

---

### Human Verification Required

The following 5 items cannot be verified programmatically and require Andrew (or a developer with live Sanity data) to confirm.

**1. Live content rendering across all 10 sections**

**Test:** Deploy or run `pnpm --filter web dev` against the live Sanity project. Navigate to `/issue/[real-published-slug]`.
**Expected:** All 10 sections display real Sanity content. Charity name in masthead matches Sanity. Origin story, problem, founder bio, case study body text renders. Game iframe loads. Bonus section shows real bonus. Shop band names the featured charity. No "MOCK" or placeholder text visible anywhere.
**Why human:** Requires a real published issue in Sanity.

**2. Per-issue Sanity theme override (DES-06)**

**Test:** In Sanity Studio, set `theme.accentColor` to a visually distinct value (e.g., `#2C5F8A` blue) on one published issue. Leave a second issue with no theme (oxblood default). Open both in browser.
**Expected:** Accent color (eyebrow labels, drop-cap first letter, pull-quote left border, CTA buttons, links) differs between the two issues. Structure, grid, section order, and framer-motion animations are identical. The default issue uses oxblood `#9A3324`.
**Why human:** Requires two live issues with distinct Sanity theme fields; visual comparison cannot be automated.

**3. Live deliberation with real runId**

**Test:** Open an issue where `runId` is populated (a real pipeline run exists). Navigate to the Deliberation section (id="delib").
**Expected:** DelibScoreboard shows real candidate names and advocate scores. DelibChat animates the real conversation from `selectionDeliberation.conversation`. ConfidenceBar fills to reflect the editorial decision confidence. Empty-state ("This issue predates the open deliberation record.") does NOT appear.
**Why human:** Requires a live Convex dataset with matching runId.

**4. PDF download button**

**Test:** Open an issue in Sanity Studio, set `problemPdfUrl` to a real PDF URL, publish. Navigate to the Problem section on the live page.
**Expected:** A button labelled "↓  Download the Problem Statement Deck (PDF)" appears within the Problem section with visible min-height of at least 44px and an appropriate aria-label.
**Why human:** Requires an issue with problemPdfUrl populated.

**5. prefers-reduced-motion content visibility**

**Test:** Enable OS "Reduce motion" (macOS: System Settings > Accessibility > Display > Reduce motion). Open `/issue/[slug]` in a browser that respects this flag.
**Expected:** All 10 sections are fully visible without any interaction. No content is hidden, transparent, or empty. Scroll reveals show content immediately (no fade-in). Stat count-ups show final values immediately. DelibChat shows all messages at once. ConfidenceBar is at full width immediately. No opacity-0 states trap any content.
**Why human:** Requires browser environment with OS reduced-motion flag active.

---

### Gaps Summary

No gaps found in automated verification. All 7 P19 success criteria are implemented and verifiable in the codebase. The 5 human verification items are live-UAT checks that depend on real Sanity content, real Convex runs, and OS-level browser settings — all correctly deferred per the Phase 19 two-stage delivery model.

The REQUIREMENTS.md status table shows P19-01..P19-07 as "Not started" (documentation artifact — the narrative section above it marks them as checked; the table was not updated during phase execution). This is a documentation housekeeping item, not a code gap.

The 5 pre-existing TypeScript errors in checkout and Stripe webhook test files are a Phase 08 baseline (commit e71619f), untouched by Phase 19.

---

_Verified: 2026-06-03T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
