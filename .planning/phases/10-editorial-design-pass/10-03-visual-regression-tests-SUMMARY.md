---
phase: 10-editorial-design-pass
plan: 03
subsystem: testing
tags: [vitest, source-scan, tripwire, regression, design-contract, typography]

# Dependency graph
requires:
  - phase: 07-game-rendering
    provides: "apps/web/__tests__/game-sandbox.test.ts canonical source-scan pattern (readFileSync + grep) + Vitest 3.x infrastructure in apps/web"
  - phase: 08-stripe-commerce
    provides: "apps/web/__tests__/issue-page-shop-callout.test.ts comment-stripping pattern for code-only regex matching"
  - phase: 10-editorial-design-pass
    plan: 01
    provides: "Five typography utilities (.prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block) + extended Playfair Display + Lora font subsets"
  - phase: 10-editorial-design-pass
    plan: 02
    provides: "EditorialSection lead prop wiring + drop-cap className passthrough + CaseStudySection .metadata-block dl + IssueHero masthead .eyebrow usage + page.tsx Origin Story lead prop"
provides:
  - "CI guard for Phase 10 design contract — fails the build if drop-cap class, ornament divider, next/font/google contract, .prose-measure utility, or ShopCallout/GameSlot inheritance regresses"
  - "Six describe blocks (one per DES-01..DES-06) reading as a design contract document, runs in <1s"
  - "Zero new dependencies — uses existing Vitest 3.x + vite-tsconfig-paths infrastructure from Phase 7"
affects:
  - 10-04-readme-and-uat  # final phase plan inherits this guard in CI

# Tech tracking
tech-stack:
  added: []  # no new deps; vitest + node:fs already present
  patterns:
    - "Source-scan tripwire — readFileSync(SRC_PATH, 'utf-8') at test runtime so assertions ALWAYS reflect current file content, never a stale snapshot"
    - "Comment-stripping helper (codeOnly) — strips block + JSX block + line comments so regex matches behavior (JSX, classNames, identifiers) rather than documentation prose. Pattern mirrored from issue-page-shop-callout.test.ts"
    - "One describe block per requirement ID (DES-01..DES-06) — each block reads only the source files relevant to that requirement, runs targeted assertions; failure messages point at exactly which contract broke"
    - "Lazy multiline regex pattern ([\\s\\S]{0,N}) — bounded so unrelated content N chars away never accidentally matches; preserves single-section semantic"

key-files:
  created:
    - "apps/web/__tests__/issue-page-typography.test.ts — 287 lines, 6 describe blocks, 42 it() assertions"
  modified: []

key-decisions:
  - "Single file (not one per requirement) — reads as a contract document, runs in <1s, single failure surface; ratio 42 it() / 6 describe matches Phase 7 game-validator.test.ts precedent (24 it() in 1 file)"
  - "codeOnly() helper added (3 regex substitutions: block + JSX block + line comments) — required because Plan 10-02 page.tsx documents the lead prop in a JSX block comment, so raw match counts 2 but semantic intent is 1"
  - "Bounded lazy regex `[\\s\\S]{0,200}` / `[\\s\\S]{0,400}` — explicit upper bounds (not greedy [\\s\\S]*?) so assertion fails fast on dropped declarations and never spuriously matches content several rules away"
  - "Both negative AND positive assertions for the GameSlot sandbox cross-check (`toContain('sandbox=\"allow-scripts\"')` + `not.toContain('allow-same-origin')`) — defends against both removal and additive errors, mirroring Phase 7 GAM-03's canonical pattern"

patterns-established:
  - "Phase 10 contract guards live in apps/web/__tests__/issue-page-typography.test.ts behind 'DES-NN:' describe-block prefix — future Phase 10 maintenance reads as a labeled contract document"
  - "Lead-prop-once-per-page assertion uses codeOnly() pre-pass — establishes the pattern for any future single-occurrence-in-code-not-comments invariants"

requirements-completed:
  - DES-01
  - DES-02
  - DES-03
  - DES-04
  - DES-05
  - DES-06

# Metrics
duration: 4min
completed: 2026-05-19
---

# Phase 10 Plan 03: Visual Regression Tests Summary

**Locked Phase 10's editorial design contract behind a 42-assertion source-scan tripwire (one describe block per DES-01..DES-06). Mirrors Phase 7's `game-sandbox.test.ts` pattern: `readFileSync` at test runtime + grep-style assertions. Fails the build if any future edit removes the drop cap, the ornament divider, the `next/font/google` contract, the `.prose-measure` utility, or the ShopCallout/GameSlot inheritance.**

## Performance

- **Duration:** ~4 min (228 seconds from start to final commit)
- **Started:** 2026-05-19T14:33:43Z
- **Completed:** 2026-05-19T14:37:31Z
- **Tasks:** 1 completed
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- **Single new test file:** `apps/web/__tests__/issue-page-typography.test.ts` — 287 lines, **6 describe blocks** (one per DES-01..DES-06), **42 it() assertions**.
- **42/42 new tests pass.** Phase 7's `game-sandbox.test.ts` (3/3), Phase 8 CMR-09 `issue-page-shop-callout.test.ts` (5/5), Phase 7 `game-validator.test.ts` (24/24), and Phase 8 CMR-01 server-component subset (5/5) — all still green. Pre-existing 29-fail count from Phase 8 Wave 0 sentinels (stripe-webhook, checkout, thank-you, legal-pages, BuyButton) is unchanged.
- **Zero new dependencies.** Uses existing Vitest 3.x + `vite-tsconfig-paths` infrastructure from Phase 7. `vitest.config.ts` already includes `__tests__/**/*.test.ts` so the file is auto-collected.
- **Nine source files scanned at test runtime** via `readFileSync`:
  - `apps/web/app/layout.tsx` — DES-01 next/font/google contract
  - `apps/web/app/globals.css` — DES-02/03/04/05/06 utility classes + theme variables
  - `apps/web/components/issue/EditorialSection.tsx` — DES-02 lead prop + DES-03 prose-measure + DES-04 eyebrow + ornament + DES-06 var(--color-primary)
  - `apps/web/components/issue/CaseStudySection.tsx` — DES-03 prose-measure + DES-04 ornament + DES-05 metadata-block dl/dt/dd
  - `apps/web/components/issue/IssueHero.tsx` — DES-04 eyebrow (2+ usages: issue label + metadata) + DES-06 var(--color-primary)
  - `apps/web/components/issue/PortableTextRenderer.tsx` — DES-03 `leading-[1.7]`
  - `apps/web/app/issue/[slug]/page.tsx` — DES-02 lead-once-on-Origin-Story + DES-06 ShopCallout + GameSlot + Server Component + no Google Fonts link
  - `apps/web/components/issue/ShopCallout.tsx` — DES-06 untouched, `export function ShopCallout` still present
  - `apps/web/components/issue/GameSlot.tsx` — DES-06 untouched, `sandbox="allow-scripts"` present + no `allow-same-origin`

## Task Commits

1. **Task 1: Create the typography source-scan tripwire test file** — `827332d` (test)

## Files Created

- `apps/web/__tests__/issue-page-typography.test.ts` — 287 lines. Top-level imports: `readFileSync`, `resolve`, Vitest `describe/it/expect`. Nine resolved source paths declared at module top so failure messages name the offending file. One `codeOnly()` helper strips block + JSX block + line comments before regex matching (mirrors `issue-page-shop-callout.test.ts`). Six describe blocks read as a design contract document.

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Single file, not one per requirement** — 42 assertions / 6 describe blocks matches Phase 7's `game-validator.test.ts` ratio precedent. Single failure surface, runs in <1s.
- **`codeOnly()` helper** — strips comments before counting `lead` occurrences in `page.tsx` because Plan 10-02 documents the lead prop in a JSX block comment (raw count 2 / semantic count 1).
- **Bounded lazy regex** (`[\\s\\S]{0,200}` etc.) — explicit upper bounds prevent spurious cross-rule matches and surface dropped declarations fast.
- **Negative + positive sandbox cross-check** — both `toContain("sandbox=\"allow-scripts\"")` and `not.toContain("allow-same-origin")` defend against removal and additive errors (mirrors Phase 7 GAM-03 canonical pattern).

## Deviations from Plan

Plan executed as specified, with one inline correction:

### Rule 1 (Bug fix) — `lead`-occurrence-count assertion

- **Found during:** Task 1 verification reading `page.tsx`
- **Issue:** The plan's `expect(leadMatches.length).toBe(1)` against raw `pageSrc.match(/\blead\b/g)` would have failed because Plan 10-02 leaves an intentional JSX block comment above the Origin Story EditorialSection — `{/* 2. Origin story — id="origin-story" (lead = drop cap per DES-02) */}` — so `pageSrc` contains 2 `lead` word-boundary matches (1 comment + 1 JSX prop). Plan 10-02's own SUMMARY explicitly notes "Two `lead` matches in page.tsx — one in a doc comment, one in the JSX prop. The semantic intent (only ONE EditorialSection has the prop) is satisfied".
- **Fix:** Added a `codeOnly()` helper (3 regex substitutions: block comments, JSX block comments `{/* */}`, line comments — the same pattern as `apps/web/__tests__/issue-page-shop-callout.test.ts`). The assertion runs `codeOnly(pageSrc).match(/\blead\b/g)` so it counts CODE-only `lead` occurrences. Semantic intent (single drop cap per issue) is preserved.
- **Files modified:** `apps/web/__tests__/issue-page-typography.test.ts` (added 9-line helper before the describe blocks; updated DES-02 lead-count assertion to call `codeOnly(pageSrc)` first).
- **Commit:** `827332d` (single task commit incorporates the fix)

### Out-of-Scope (Deferred Items)

**1. Phase 8 Wave 0 sentinel tests — pre-existing, NOT regressed**

- **Observed during:** `pnpm --filter web test:unit` final run
- **State:** **79 pass / 29 fail** AFTER this plan. The +42 new passes come entirely from the new `issue-page-typography.test.ts`. The 29 fails are the same Phase 8 Wave 0 sentinels carried since Plan 08-01 (target route handlers + stripe npm package don't exist until Plans 08-04..08-07).
- **Source:** Phase 8 Plan 08-01 SUMMARY: "Wave 0 sentinel confirmed — 10 test files total (2 Phase 7 + 8 Phase 8), 66 tests, 37 pass / 29 fail." After Plan 10-01 added zero tests and Plan 10-02 added zero tests, baseline at Plan 10-03 start was 37 pass / 29 fail. After this plan: 79 pass / 29 fail = 37 pass + 42 new + 29 fail.
- **Decision:** NOT fixed (SCOPE BOUNDARY rule). Plan 10-03's responsibility is the Phase 10 design-contract tripwire, not Phase 8 sentinel cleanup. Phase 8 owns those tests.

## Self-Check

Verification of claims made in this summary:

- File exists: `apps/web/__tests__/issue-page-typography.test.ts` — FOUND
- File has 6 describe blocks — VERIFIED (`grep -c "describe(" → 6`)
- File has 42 it() blocks — VERIFIED (`grep -cE '^\s*it\(' → 42`)
- All 6 DES requirement tags present (DES-01..DES-06) — VERIFIED
- Required pattern tokens present (readFileSync, Playfair_Display, Lora, drop-cap, ornament-divider, metadata-block, prose-measure, ShopCallout, `sandbox="allow-scripts"`) — VERIFIED
- Commit exists: `827332d` — VERIFIED (`git log --oneline -1` shows `test(10-03): add Phase 10 typography source-scan tripwire`)
- `pnpm --filter web test:unit` shows `__tests__/issue-page-typography.test.ts (42 tests)` PASSING — VERIFIED
- Phase 7 + Phase 8 CMR-09 + Phase 2 pre-existing pass-files unchanged (game-sandbox 3/3, shop-callout 5/5, game-validator 24/24, shop-page 5/5) — VERIFIED
- Test pass/fail count: 79 pass / 29 fail (was 37 pass / 29 fail at Plan 10-03 start; delta = +42 new pass, identical 29 fail) — VERIFIED

## Self-Check: PASSED
