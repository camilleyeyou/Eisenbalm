---
phase: 17-ui-ux-audit-follow-ups
verified: 2026-06-02T03:50:00Z
status: human_needed
score: 7/7 source-checkable must-haves verified
human_verification:
  - test: "Run Lighthouse on a live or Vercel preview /issue/[slug] page and record the CLS score"
    expected: "CLS measurably lower than pre-Phase-17 baseline (next/image fill + sizes= on storyboard grid eliminates the largest CLS element on the page)"
    why_human: "CLS is a runtime Lighthouse metric — not source-checkable. Improvement is architecturally guaranteed by the next/image conversion (P17-01) but the numeric delta requires a live browser test."
  - test: "Andrew opens http://localhost:3000/about (or deployed preview) and reads the three paragraphs; confirms Jesse voice (dry, precise, no irony, no exclamation marks)"
    expected: "Andrew either approves prose as-is (deletes the TODO(Andrew) JSX comment) or replaces the paragraph text with his own wording, then re-runs pnpm --filter web test:unit -- --run about-page to confirm it stays green"
    why_human: "Editorial voice approval is an intentional non-blocking human gate. The source-checkable half of P17-05 (placeholder removed, article wrapper intact, TODO(Andrew) marker present) is fully automated and GREEN. The final voice judgment is Andrew's."
---

# Phase 17: UI/UX Audit Follow-Ups Verification Report

**Phase Goal:** Land the deferred medium-priority polish from the 2026-05-20 UI/UX audit — image optimization (next/image, CLS), archive pagination, loading.tsx skeletons, /about copy, and a minor duplicate-`<main>` fix on an internal debug route. Hard constraints: no new npm dependency, no CDN; Phase 14 light-theme + Phase 12 typography lock + Phase 8 commerce surface untouched; web vitest baseline (234/234) preserved.

**Verified:** 2026-06-02T03:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | BonusSection storyboard grid uses next/image (optimized, CLS-safe), no raw `<img>`, no eslint-disable | VERIFIED | `import Image from 'next/image'` at L21; `<Image fill sizes=...>` at L58-64; wrapper has `relative aspect-video` at L56; stripped-comment scan shows no `<img>`; `@next/next/no-img-element` string absent |
| 2 | CLS measurably improved on /issue/[slug] (Lighthouse runtime) | HUMAN/MANUAL | Architecture guarantees improvement (fill+sizes eliminates the fixed-size img CLS element); numeric delta requires live Lighthouse run — see Human Verification |
| 3 | Archive shows first 10 issues initially with a load-more control; searching/sorting resets to PAGE_SIZE | VERIFIED | `const PAGE_SIZE = 10` at L10; `visibleCount`, `hasMore`, `slice(0, visibleCount)`, `setVisibleCount(PAGE_SIZE)` in useEffect([query,order]) all present; `Load N more` button with `min-h-11` present |
| 4 | Four loading.tsx skeleton files exist at all four route segments and none contain `<main` | VERIFIED | All four files exist (existsSync confirmed); no `<main` in any; all use `animate-pulse` + `bg-[color:var(--color-line)]` tokens |
| 5 | /about page no longer shows "This page is being written" placeholder; `<article>` wrapper preserved; `TODO(Andrew)` marker present | VERIFIED | Placeholder absent; `<article>` at L30; `TODO(Andrew)` comment at L35 |
| 6 | Andrew's final /about voice approval (Jesse-voice prose) | HUMAN/MANUAL | Non-blocking editorial gate; interim prose is code-complete and presentable; `TODO(Andrew)` is the tracking mechanism — see Human Verification |
| 7 | `/_debug/convex` route contains no `<main` | VERIFIED | File changed from `<main className="mx-auto max-w-2xl...">` to `<div className="mx-auto max-w-2xl...">` at L50/L72; confirmed no `<main` |
| 8 | 259/259 tests pass; dep count stays at 17 | VERIFIED | `pnpm --filter web test:unit` output: 31 test files, 259 passed (234 baseline + 25 new Phase 17 tests); `apps/web/package.json` `dependencies` count = 17 |

**Score:** 6/6 source-checkable must-haves verified (2 items correctly routed to human verification)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/issue/BonusSection.tsx` | next/image fill, no raw img, relative aspect-video, sizes= | VERIFIED | L21 import, L56 wrapper class, L58-64 Image tag, no eslint-disable |
| `apps/web/components/archive/ArchiveList.tsx` | PAGE_SIZE, visibleCount, useEffect reset, hasMore button, min-h-11 | VERIFIED | All 8 grep checks pass |
| `apps/web/app/issue/[slug]/loading.tsx` | animate-pulse skeleton, `<article>` root, no `<main>` | VERIFIED | Exists; animate-pulse on root; `<article>` root; no `<main>` |
| `apps/web/app/archive/loading.tsx` | animate-pulse, `<div>` root, no `<main>` | VERIFIED | Exists; `<div>` root; animate-pulse; no `<main>` |
| `apps/web/app/charities/loading.tsx` | animate-pulse, `<div>` root, no `<main>` | VERIFIED | Exists; `<div>` root; animate-pulse; no `<main>` |
| `apps/web/app/charities/[slug]/loading.tsx` | animate-pulse, `<div>` root, no `<main>` | VERIFIED | Exists; `<div>` root; animate-pulse; no `<main>` |
| `apps/web/app/about/page.tsx` | No placeholder, `<article>` wrapper, TODO(Andrew) marker | VERIFIED | Placeholder absent; `<article>` at L30; `TODO(Andrew)` at L35 |
| `apps/web/app/%5Fdebug/convex/page.tsx` | `<div>` wrapper, no `<main>` | VERIFIED | `<div className="mx-auto max-w-2xl px-6 py-12">` at L50; no `<main>` |
| `apps/web/__tests__/bonus-section-image.test.ts` | 7 assertions for P17-01 | VERIFIED | Exists; 7/7 GREEN in test run |
| `apps/web/__tests__/archive-pagination.test.ts` | 6 assertions for P17-03 + dep guard | VERIFIED | Exists; 6/6 GREEN in test run |
| `apps/web/__tests__/loading-skeletons.test.ts` | 8 assertions for P17-04 | VERIFIED | Exists; 8/8 GREEN in test run |
| `apps/web/__tests__/about-page.test.ts` | 2 assertions for P17-05 | VERIFIED | Exists; 2/2 GREEN in test run |
| `apps/web/__tests__/debug-route.test.ts` | 2 assertions for P17-06 | VERIFIED | Exists; 2/2 GREEN in test run |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `BonusSection.tsx` | `next.config.ts` remotePatterns (cdn.sanity.io) | `<Image src={url}>` — CDN host pre-authorized | VERIFIED | `next/image` import present; cdn.sanity.io was already in remotePatterns (no config change needed) |
| `ArchiveList.tsx` | `filtered` useMemo result | `filtered.slice(0, visibleCount)` for display; `filtered.length > visibleCount` for hasMore | VERIFIED | `slice(0, visibleCount)` present; `hasMore` derived correctly |
| `useEffect([query, order])` | `setVisibleCount(PAGE_SIZE)` | Resets window when search/sort changes | VERIFIED | `useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, order])` at L37-39 |
| Each `loading.tsx` | `var(--color-line)` token | `bg-[color:var(--color-line)]` skeleton bars | VERIFIED | All four files contain `var(--color-line)` token; no hardcoded hex |
| `_debug/convex/page.tsx` | Root layout `<main id="main">` | `<div>` wrapper avoids nested landmark | VERIFIED | `<div className="mx-auto max-w-2xl px-6 py-12">` — single-main-landmark restored |
| `apps/web/__tests__/archive-pagination.test.ts` | `apps/web/package.json` | `readFileSync + JSON.parse + Object.keys(dependencies).length === 17` | VERIFIED | Test passes; dep count = 17 confirmed independently |
| `apps/web/__tests__/loading-skeletons.test.ts` | 4 loading.tsx paths | `existsSync` per path | VERIFIED | All 4 existsSync checks pass; 4 no-`<main>` guards pass |

---

## Data-Flow Trace (Level 4)

Not applicable — Phase 17 modifies UI components, loading skeletons, and a static about page. No data fetch chain was introduced or modified. The ArchiveList component reads from its `issues` prop (passed from `archive/page.tsx` which fetches via GROQ) — this upstream data flow is unchanged from Phase 2 and Phase 10; out of scope for this phase's verification.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite: 259 tests pass, 31 files | `pnpm --filter web test:unit` | "Test Files 31 passed (31) / Tests 259 passed (259)" | PASS |
| Dep count guard (P17-07) | Embedded in `archive-pagination.test.ts` | `Object.keys(dependencies).length === 17` — PASS | PASS |
| BonusSection no raw `<img>` (comment-stripped) | Python regex strip + `<img` search | No match | PASS |
| loading.tsx files: 4 exist, none contain `<main` | `existsSync` + `grep -n "<main"` | All 4 present; no `<main` found | PASS |
| debug page no `<main` | `grep -n "<main" %5Fdebug/convex/page.tsx` | No match | PASS |
| about page placeholder removed, `<article>` + `TODO(Andrew)` present | grep checks | All 3 pass | PASS |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| P17-01 | 17-01, 17-02 | BonusSection uses next/image fill, no raw `<img>`, no eslint-disable | SATISFIED | next/image import + `<Image fill sizes=>` verified; eslint-disable absent |
| P17-02 | 17-02 | CLS measurable improvement on /issue/[slug] | NEEDS HUMAN | Architecture guarantees reduction (fill+sizes); Lighthouse delta requires live run |
| P17-03 | 17-01, 17-03 | Archive pagination: PAGE_SIZE, visibleCount, load-more, useEffect reset | SATISFIED | All 8 ArchiveList grep checks pass; 6/6 test assertions GREEN |
| P17-04 | 17-01, 17-04 | Four loading.tsx at route segments; none contain `<main>` | SATISFIED | All 4 files exist; 8/8 test assertions GREEN |
| P17-05 | 17-01, 17-05 | /about: placeholder removed; Jesse-voice interim copy; `<article>` preserved; TODO(Andrew) marker | SATISFIED (source-checkable half) / NEEDS HUMAN (voice approval) | Source checks pass; Andrew voice gate remains open (by design) |
| P17-06 | 17-01, 17-04 | `/_debug/convex` contains no `<main` | SATISFIED | `<div>` wrapper confirmed; 2/2 test assertions GREEN |
| P17-07 | 17-01, 17-02, 17-03, 17-04, 17-05 | 259-test suite green; dep count = 17; no new npm dep | SATISFIED | 259/259 GREEN; dep count = 17 confirmed in test + independent check |

All requirement IDs P17-01 through P17-07 are accounted for across plan frontmatter `requirements` fields. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/about/page.tsx` | 35 | `TODO(Andrew)` JSX comment | INFO | Intentional — tracked in the plan as a non-blocking editorial gate. Not a gap. |

No hardcoded hex colors introduced in any touched file. All new color usage routes through `var(--color-*)` tokens. No `'use client'` added to loading.tsx files. No new npm dependency added.

---

## Human Verification Required

### 1. CLS Lighthouse Measurement (P17-02)

**Test:** Run Lighthouse on `/issue/[slug]` for a page with BigBudget bonus storyboards. Compare CLS before and after Phase 17.
**Expected:** CLS score lower than pre-Phase-17 baseline. The architectural change (raw `<img>` with no reserved space → `next/image fill` inside an `aspect-video` container) eliminates the layout shift source. A CLS improvement from the storyboard grid is expected.
**Why human:** CLS is a runtime Lighthouse metric that requires a browser, a live or preview URL, and storyboard images actually loaded. The code change is verified; the metric delta is not source-checkable.

### 2. Andrew: /about Voice Approval (P17-05)

**Test:** Andrew opens `/about` (local dev or deployed preview), reads the three interim paragraphs, confirms Jesse voice (dry, precise, no irony signaling, no exclamation marks).
**Expected:** Andrew either approves as-is (removes the `TODO(Andrew)` JSX comment from `apps/web/app/about/page.tsx`) or replaces the paragraph text with his own wording, then confirms `pnpm --filter web test:unit -- --run about-page` stays green.
**Why human:** The source-checkable half of P17-05 (placeholder removed, structural wrapper preserved, greppable TODO marker present) is automated and GREEN. Final prose quality is an editorial judgment that only Andrew can make. This is a non-blocking gate by design — the page is presentable and code-complete without it.

---

## Gaps Summary

No source-checkable gaps. All automated must-haves are verified:

- P17-01 (BonusSection next/image): VERIFIED — import, fill, sizes=, relative aspect-video, no raw img, no eslint-disable
- P17-03 (archive pagination): VERIFIED — PAGE_SIZE=10, visibleCount, slice, hasMore, load-more button, min-h-11 touch target, useEffect reset
- P17-04 (loading.tsx skeletons): VERIFIED — all 4 files exist, animate-pulse, --color-line token, no `<main>` in any
- P17-05 (about copy, source half): VERIFIED — placeholder removed, `<article>` wrapper intact, TODO(Andrew) marker present
- P17-06 (debug duplicate main): VERIFIED — `<div>` wrapper, no `<main>` in page
- P17-07 (regression baseline): VERIFIED — 259/259 tests GREEN, dep count = 17

The two outstanding items (P17-02 CLS metric, P17-05 Andrew voice gate) are correctly classified as human_verification per the 17-VALIDATION.md contract. They are non-blocking by design and do not prevent phase goal achievement.

---

_Verified: 2026-06-02T03:50:00Z_
_Verifier: Claude (gsd-verifier)_
