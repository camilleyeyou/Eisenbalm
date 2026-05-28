---
phase: 15-shop-storefront
verified: 2026-05-28T11:10:00Z
status: human_needed
score: 5/6 success criteria verified automatically
human_verification:
  - test: "Load /shop in a browser at desktop (1440px) and mobile (375px / 768px). Confirm: (a) hero → positioning → features → ingredient story → charity → buy → FAQ → footer renders in order with warm-paper background; (b) #shop-features collapses from 3-col to 1-col below 768px; (c) #shop-buy stacks image above copy below 768px; (d) hero top padding rebalances (pt-24 desktop / pt-16 mobile); (e) every BuyButton, <details><summary>, and <a> has a visible touch target ≥44px."
    expected: "Long-scroll storefront is visible and correctly laid out at all tested viewport widths. No overflow. No invisible elements."
    why_human: "Responsive layout and touch-target enforcement require a browser. The source-scan confirms correct Tailwind classes are present but cannot verify the rendered geometry."
  - test: "Visually inspect the three BuyButton placements (#shop-hero wrapper mt-8, #shop-buy wrapper mt-6, #shop-footer-cta wrapper mt-6). Check whether the internal className='mt-8' on <Button> inside BuyButton.tsx and the wrapper div's mt-N compound into visually excessive double-spacing above any button."
    expected: "Each BuyButton appears with a single comfortable gap above it, not a doubled gap. If double-spacing is visible at any position, remove the wrapper div at that position and rely on BuyButton's internal mt-8 alone."
    why_human: "BuyButton.tsx has a hardcoded className='mt-8' on its internal <Button> element. Whether wrapper + internal mt compound to 64px visual gap depends on the flex/block context at each position and can only be judged by eye."
  - test: "Read every paragraph, headline, FAQ answer, and the footer-cta outro line on /shop aloud. Confirm: (a) the 'Stop. Breathe. Balm.' register is maintained throughout (meditative, declarative, no exclamation marks, no superlatives, no urgency); (b) the footer outro 'One product. This week's charity needs it.' is acceptable or needs a more neutral close; (c) no unintended AI mentions appear in body copy."
    expected: "Every piece of visible copy reads in the lip-balm sub-brand voice as defined by UI-SPEC §Voice Register Guardrails. The footer outro either reads as acceptable or is flagged for a gentler alternative."
    why_human: "Voice register is an editorial/tonal judgment. The urgency-vocabulary source-scan (CMR-09 extension) mechanically passes, but whether the overall register stays meditative-and-deliberate vs. slipping into persuasive-marketing requires a human read-through."
  - test: "Open one <details> FAQ item, confirm the native browser disclosure triangle is suppressed (list-none on <summary> is doing its job), the ChevronDown icon appears and rotates 180° when the item is open, and the answer text is readable on the warm-paper background."
    expected: "No double-indicator (triangle + chevron). Chevron rotates on open. Answer legible."
    why_human: "Browser disclosure-triangle suppression via list-none behaves differently across Chrome/Safari/Firefox and requires visual confirmation. The source-scan confirms list-none is present but not its rendered effect."
  - test: "Confirm /shop has the correct page title 'Shop — The Eisenbalm Dispatch' in the browser tab and that real photography slots (hero and #shop-buy) are marked as editorial placeholders, not broken images."
    expected: "Browser tab shows the locked title. Both placeholder divs show 'PRODUCT PHOTOGRAPHY COMING' in eyebrow type on a warm-card background — no broken-image icon, no empty space."
    why_human: "Page title rendering and image-placeholder visual treatment require browser inspection."
  - test: "Click a BuyButton on the rebuilt /shop page with a live Stripe test-key configured (Andrew's dev environment, not CI). Confirm the click still redirects to Stripe Checkout."
    expected: "Stripe Checkout loads. No 4xx or 5xx. Session URL includes /shop/thank-you as the success_url."
    why_human: "Live Stripe checkout requires Andrew's test-key. CI runs the checkout route with a mock. The actual redirect was gated on Andrew's test-key swap per Phase 8 plan 08-08 manual UAT."
---

# Phase 15: Shop Storefront Verification Report

**Phase Goal:** Convert the minimal Phase 8 `/shop` into a long-scroll product page (8 sections) modeled on `jesseaeisenbalm.com`. Phase 8 Stripe machinery byte-unchanged. Voice on `/shop` = lip-balm sub-brand ("Stop. Breathe. Balm." register). Light theme + Phase 10 editorial typography. No new deps; brief constraints (no Shopify/cart/urgency) honored.
**Verified:** 2026-05-28T11:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Six Phase Success Criteria

| # | Success Criterion | Status | Adjudication |
|---|-------------------|--------|--------------|
| 1 | Long-scroll product page (8 sections in order), warm-paper light base, mobile-friendly, every CTA ≥44px | HUMAN_NEEDED | Structure verified automatically (all 8 section IDs present, BuyButton x3, <details>/<summary> x6, fragment return). Mobile layout + touch-target geometry require browser. |
| 2 | Phase 8 BuyButton reused byte-unchanged at ≥2 positions; clicking still POSTs to `/api/checkout/create-session` | PASS (automated) + HUMAN_NEEDED (click-through) | Source-scan: 3 `<BuyButton />` with no props. BuyButton.tsx diff: 0 lines changed. Checkout route diff: 0 lines changed. Stripe click-through needs Andrew's test key. |
| 3 | Charity callout query preserved, server-rendered, CMR-09 ShopCallout tripwire green | PASS | `QUERY_LATEST_CHARITY_NAME` present verbatim (2 grep hits: declaration + usage). `sanityClient.fetch` + try/catch wired. `charityName` interpolated inline. Fallback string `'Proceeds go to our featured charity each week.'` confirmed. ISR `revalidate = 60` present. No `'use client'`. ShopCallout.tsx: 0 diff lines. All 225/225 tests green (CMR-09 included). |
| 4 | Editorial typography: `.eyebrow`, `.ornament-divider`, `.prose-measure`, `.drop-cap`; Cormorant/Lora/Inter only | PASS | `.eyebrow` on every section label (7 instances). `.ornament-divider` x5 (between sections 2→3, 3→4, 4→5, 5→6, 6→7). `.prose-measure` x2 (#shop-positioning, #shop-ingredient-story). `.drop-cap` x1 (#shop-positioning only). `lib/theme.ts` diff: 0 lines (FONT_WHITELIST unchanged). `globals.css` diff: 0 lines. |
| 5 | Locked constraints: WCAG AA tokens, single `<main>`, no hex, no new deps, no urgency mechanics | PASS | No `<main>` in shop/page.tsx (root layout owns it). No hardcoded 6-digit hex in code (hex-strip test passes). No `'use client'`. `package.json` diff: 0 lines. Urgency vocab scan (comment-stripped): CLEAN for `limited`, `only N left`, `countdown`, `hurry`, `act now`. All `--color-*` tokens used via `bg-[color:var(--color-*)]` / `text-[color:var(--color-*)]` / `border-[color:var(--color-*)]`. WCAG token choices confirmed: `--color-primary-text` (#7A5C0E, 5.97:1) used for gold text in #shop-buy, not raw `--color-primary` (#CDA434, fails AA as text). |
| 6 | `pnpm --filter web build` exits 0; all prior tripwire tests stay green; shop-page.test.ts runs 16 assertions all green | PASS | Build: exit 0 (confirmed). Test suite: 225/225 (was 215 before Phase 15; +10 new Phase 15 assertions). CMR-01 block (6 assertions): all green. Phase 15 block (10 assertions): all green. |

**Score: 5/6 criteria fully automated-PASS; 1 criterion has automated components that all pass but also contains 6 human-verification sub-items that genuinely require browser and editorial review.**

---

### Observable Truths (from PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Reader sees 8 sections in order (#shop-hero → … → #shop-footer-cta) | VERIFIED | All 8 `id="shop-*"` attributes present in source (grep: 1 each). Fragment return confirmed (no rogue `<main>`). |
| 2 | Hero tagline `Stop. Breathe. Balm.` + sub-tagline present verbatim | VERIFIED | Line 89: `Stop. Breathe. Balm.` in `<h1>`. Line 92: `A human-only ritual for an AI-everywhere world.` in sub-tagline `<p>`. Source-scan test 'hero tagline is present verbatim' green. |
| 3 | BuyButton at ≥2 positions, no props, byte-unchanged, routes to Stripe | VERIFIED (automated) / HUMAN_NEEDED (click) | Source: 3 × `<BuyButton />` with no props (grep confirms 0 'BuyButton className' hits). BuyButton.tsx: 0 diff lines. Checkout route: 0 diff lines. Live click-through: needs Andrew's test-key. |
| 4 | Charity name server-rendered into #shop-charity; fallback on Sanity outage | VERIFIED | `QUERY_LATEST_CHARITY_NAME` declared and used inline. try/catch + null fallback present. No `charityCallout` intermediary (removed per plan). Fallback string locked verbatim. ISR 60s preserved. |
| 5 | 6-item inline FAQ with native `<details>`/`<summary>`, zero JS | VERIFIED | 6 `<details className="group">` blocks. 6 `<summary className="... list-none ...">` blocks. ChevronDown import from lucide-react (no new dep — already in package.json). No `'use client'`. Assertion 'uses native <details>/<summary>' green. |
| 6 | Lip-balm voice register — no urgency, no exclamations, no AI in body | PARTIALLY VERIFIED | Mechanical: urgency vocab scan CLEAN. No `!` in non-comment copy. "AI" appears once (line 92, hero sub-tagline — UI-SPEC explicitly permits this exactly once). Meditative register judgment: HUMAN_NEEDED (voice read-through by Andrew). |
| 7 | `pnpm --filter web build` exits 0; all prior tripwires green | VERIFIED | Exit 0 confirmed. 225/225 tests green. |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/shop/page.tsx` | 8-section storefront, ≥250 lines, fragment return, all Phase 8 wiring preserved | VERIFIED | 308 lines. Fragment `<>` return. All checks above pass. |
| `apps/web/__tests__/shop-page.test.ts` | 6 CMR-01 assertions + 10 Phase 15 assertions = 16 total | VERIFIED | 127 lines. Both describe blocks present. 16/16 green. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/app/shop/page.tsx` | `apps/web/components/marketing/BuyButton.tsx` | `import { BuyButton } from '@/components/marketing/BuyButton'` | WIRED | Line 7, confirmed. BuyButton used at lines 95, 219, 301. |
| `apps/web/app/shop/page.tsx` | `@/lib/sanity/client` | `QUERY_LATEST_CHARITY_NAME` via `sanityClient.fetch` | WIRED | Lines 5, 39–44, 70–73. try/catch present. |
| `apps/web/app/shop/page.tsx (#shop-charity)` | `weeklyIssue → charity name` | `charityName` interpolated at line 184 | WIRED | `This week's proceeds benefit ${charityName}.` — inline ternary, no intermediary variable. |
| `apps/web/__tests__/shop-page.test.ts` | `apps/web/app/shop/page.tsx` | `readFileSync` source-scan | WIRED | `SHOP_PAGE_PATH` resolves to the file. 16 assertions all green. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `#shop-charity` section | `charityName` | `sanityClient.fetch(QUERY_LATEST_CHARITY_NAME)` → `weeklyIssue.charity->name` | Yes (Sanity published doc) | FLOWING — real GROQ query; null fallback for outage; ISR 60s |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 16 shop-page assertions all green | `pnpm --filter web test:unit` | 225/225 (Test Files 25 passed) | PASS |
| Build exits 0 | `pnpm --filter web build` | Exit 0 | PASS |
| All 8 section IDs present | grep on page.tsx | 8/8 | PASS |
| BuyButton x3 with no props | grep on page.tsx | 3 instances, 0 prop hits | PASS |
| No hardcoded hex in code | python3 comment-strip + regex | No matches | PASS |
| No urgency vocabulary in code | python3 comment-strip + regex | CLEAN on all 5 terms | PASS |
| 11 TODO(Andrew) markers present | grep on page.tsx | 11 hits | PASS |
| Phase 8 files byte-unchanged | `git diff HEAD~2` on 10 files | 0 lines changed | PASS |
| fragment return (no extra `<main>`) | grep `<main` on page.tsx | 0 hits | PASS |
| Live Stripe click-through | Requires running server + test key | Not runnable in CI | SKIP — needs Andrew |

---

### Requirements Coverage

| Requirement | Source Plan | Automated Coverage | Status | Evidence |
|-------------|------------|-------------------|--------|---------|
| SHOP-01 | 15-01 | Section ID grep x8; test assertions shop-hero/features/buy/faq green | PASS | All 8 section IDs in source |
| SHOP-02 | 15-01 | Test 'hero tagline is present verbatim'; grep on page.tsx | PASS | Line 89: `Stop. Breathe. Balm.`; line 92: sub-tagline verbatim |
| SHOP-03 | 15-01 | Test 'renders BuyButton in at least 2 positions'; BuyButton.tsx diff=0; checkout diff=0 | PASS (automated) + HUMAN_NEEDED (click-through) | 3 `<BuyButton />` no-props; byte-unchanged confirmed |
| SHOP-04 | 15-01 | Test 'imports sanityClient'; QUERY grep x2; try/catch + null fallback present; ISR grep | PASS | Full wiring confirmed |
| SHOP-05 | 15-01 | `.eyebrow` x7, `.ornament-divider` x5, `.prose-measure` x2, `.drop-cap` x1 in source; FONT_WHITELIST diff=0 | PASS (structural) + HUMAN_NEEDED (rendered hierarchy) | Classes present; visual rendering deferred to Andrew |
| SHOP-06 | 15-01 | Urgency vocab scan CLEAN; no exclamation marks in JSX output; "AI" once in sub-tagline (permitted) | PARTIAL — HUMAN_NEEDED | Mechanical checks pass; voice quality requires Andrew read-through |
| SHOP-07 | 15-01 | git diff HEAD~2 on all 10 preserved files: 0 lines changed; no `'use client'`; CMR-01 x6 green | PASS | Phase 8 Stripe machinery byte-unchanged |
| SHOP-08 | 15-01 | Test 'no urgency vocabulary in shop page source (CMR-09 extension)' green | PASS | comment-stripped scan CLEAN |
| SHOP-09 | 15-01 | Test 'no hardcoded 6-digit hex values' green; python3 cross-check CLEAN | PASS | All color via `--color-*` tokens |
| SHOP-10 | 15-01 | Test 'includes at least one TODO(Andrew) marker' green; grep returns 11 | PASS | All 11 TODO(Andrew) markers from SUMMARY table present |
| SHOP-11 | 15-01 | `pnpm --filter web build` exit 0; `pnpm --filter web test:unit` 225/225 | PASS | Both confirmed |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/shop/page.tsx` | 87 | `{/* TODO(Andrew): upload hero product photography ... */}` | Info | Intentional stub — product photography not yet available. Tracked in SUMMARY §Known Stubs. Not a code defect. |
| `apps/web/app/shop/page.tsx` | 198 | `{/* TODO(Andrew): upload product still photography ... */}` + placeholder `<div>` | Info | Intentional stub — editorial placeholder visible to user as "PRODUCT PHOTOGRAPHY COMING". Not a defect. |
| `apps/web/app/shop/page.tsx` | 98–99 | `$8.99` with TODO(Andrew) price confirm comment | Info | Placeholder price. Intentional — Andrew must confirm before launch. |

No blockers. No warnings. All anti-patterns are documented intentional stubs per Phase 15 scope.

---

### Human Verification Required

The following items require Andrew to run `pnpm --filter web dev` and visit `/shop` in a browser, or require his test-key-enabled environment:

#### 1. Responsive Layout + Touch Targets (SC-1)

**Test:** Load `/shop` at 375px, 768px, 1024px, and 1440px. Verify: (a) `#shop-features` shows 3 columns at ≥768px, 1 column below; (b) `#shop-buy` shows image-left / copy-right at ≥768px, stacked below; (c) hero padding is `pt-24` at desktop, `pt-16` at mobile (as specified); (d) every `<BuyButton>`, `<summary>`, and `<a>` has a touch target ≥44px height.
**Expected:** All breakpoints render correctly. No horizontal scroll. Generous touch targets throughout.
**Why human:** Tailwind responsive classes (`md:grid-cols-3`, `md:grid-cols-2`, `md:pt-24`, `min-h-11` on `<summary>`) are present in source but rendered geometry requires a browser.

#### 2. BuyButton Wrapper Double-Spacing (SC-1, SC-2)

**Test:** Inspect the visual gap above each of the three BuyButton placements. BuyButton.tsx has a hardcoded `className="mt-8"` on its internal `<Button>`. Each wrapper div also has `mt-8` (hero) or `mt-6` (buy, footer-cta). Check whether these compound into a visually excessive gap.
**Expected:** Single comfortable gap above each button. If double-spaced at any position, remove that wrapper's `mt-N` class (or the wrapper div entirely) and let BuyButton's internal `mt-8` supply the spacing alone. The BuyButton source itself must not be changed.
**Why human:** Whether wrapper + internal `mt-8` visually compound depends on flex/block context at each position — only visible in a rendered browser.

#### 3. Voice Register Read-Through (SC-2, SHOP-06)

**Test:** Read all 8 sections' visible copy, including FAQ answers and the footer outro (`One product. This week's charity needs it.`). The UI-SPEC flags the footer outro as potentially leaning persuasive — Andrew to decide whether it stays or needs a more neutral close.
**Expected:** All copy reads in the meditative, declarative "Stop. Breathe. Balm." register. No urgency, no exclamations, no superlatives. Footer outro either accepted as-is or revised before launch.
**Why human:** Voice quality is editorial judgment. The automated urgency scan checks for specific forbidden vocabulary but cannot evaluate tonal register.

#### 4. FAQ Accordion Visual Behavior (SC-1, SHOP-05)

**Test:** Open and close each of the 6 FAQ items. Confirm: (a) no native browser disclosure triangle appears alongside the ChevronDown icon; (b) ChevronDown rotates 180° on open; (c) answers render legibly on the warm-paper background.
**Expected:** Single custom chevron indicator per FAQ item. Rotate animation on open. No double-indicator.
**Why human:** `list-none` on `<summary>` suppresses the native triangle but its effectiveness across Chrome/Safari/Firefox requires visual confirmation.

#### 5. Stripe Checkout Click-Through (SC-2, SHOP-07)

**Test:** With Andrew's Stripe test keys configured in `.env.local`, click a BuyButton on the rebuilt `/shop` page. Confirm the redirect to Stripe Checkout occurs (no 4xx/5xx from the unchanged `/api/checkout/create-session` route). The success URL should include `/shop/thank-you`.
**Expected:** Stripe Checkout page loads. Session URL correct. No regression from Phase 15 page rebuild.
**Why human:** Live Stripe requires test keys not present in CI. Phase 8 plan 08-08 established this as the manual UAT gate for Stripe smoke testing.

#### 6. Photography Placeholder Visual Quality (SC-1)

**Test:** Confirm both placeholder `<div>` blocks (hero `4:3`, buy `3:4`) render as intentional editorial placeholders — warm card background with centered "PRODUCT PHOTOGRAPHY COMING" in eyebrow type — not as broken images or empty space.
**Expected:** Both placeholders look deliberate and on-brand, consistent with the warm-paper light theme.
**Why human:** Visual quality of the placeholder requires browser inspection.

---

### Gaps Summary

No gaps. All automated checks pass. The phase goal is structurally achieved: the `/shop` page has been rebuilt from a 97-line Phase 8 placeholder into a 308-line 8-section storefront in the correct voice register, with all Phase 8 Stripe machinery preserved byte-unchanged, no new dependencies, no hardcoded hex, no urgency vocabulary, 11 TODO(Andrew) markers for items Andrew must confirm before launch, and a 16-assertion test suite that is fully green.

The `human_needed` status reflects 6 visual/editorial/live-checkout checks that are genuine manual verification items — not defects or incomplete implementation. Per the phase-level deferred work documented in the SUMMARY, all 6 are expected to be resolved by Andrew in the 15-HUMAN-UAT pass before the `/shop` page goes live.

---

_Verified: 2026-05-28T11:10:00Z_
_Verifier: Claude (gsd-verifier)_
