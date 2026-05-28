---
phase: 15-shop-storefront
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/__tests__/shop-page.test.ts
  - apps/web/app/shop/page.tsx
autonomous: true
nyquist_compliant: true
requirements:
  - SHOP-01
  - SHOP-02
  - SHOP-03
  - SHOP-04
  - SHOP-05
  - SHOP-06
  - SHOP-07
  - SHOP-08
  - SHOP-09
  - SHOP-10
  - SHOP-11

must_haves:
  truths:
    - "Reader landing on /shop sees a long-scroll product page with 8 sections in order (#shop-hero → #shop-positioning → #shop-features → #shop-ingredient-story → #shop-charity → #shop-buy → #shop-faq → #shop-footer-cta)."
    - "Reader sees the hero tagline `Stop. Breathe. Balm.` followed by the locked sub-tagline `A human-only ritual for an AI-everywhere world.` rendered as the page's display headline."
    - "Reader can click BuyButton in ≥2 positions on the page and reach Stripe Checkout via the unchanged Phase 8 `/api/checkout/create-session` route."
    - "Reader sees the current week's featured charity name (or fallback copy on Sanity outage) server-rendered in #shop-charity — no client-side flicker."
    - "Reader sees a 6-item inline FAQ that opens/closes via native `<details>`/`<summary>` with zero JS."
    - "Reader sees lip-balm sub-brand voice (`Stop. Breathe. Balm.` register) — no urgency vocabulary, no exclamation marks, no AI mentions in body copy, no superlatives."
    - "Site-wide regression: `pnpm --filter web build` exits 0 and all prior tripwire tests (CMR-09 ShopCallout, Phase 10 typography, Phase 14 theme-aa-tones, Phase 7 game-sandbox, Phase 12 navigator/deliberation, Phase 13 deliberation-conversation) stay green."
  artifacts:
    - path: "apps/web/__tests__/shop-page.test.ts"
      provides: "Extended source-scan suite — 6 preserved CMR-01 assertions + a new `Phase 15: /shop long-scroll structure` describe block with ≥7 new assertions (section IDs, hero tagline verbatim, ≥2 BuyButtons, no-urgency, no-hardcoded-hex, TODO(Andrew) marker, <details>/<summary> FAQ block)."
      contains: "describe('Phase 15: /shop long-scroll structure'"
    - path: "apps/web/app/shop/page.tsx"
      provides: "Rewritten 8-section long-scroll storefront. Preserves: metadata export, `export const revalidate = 60`, `QUERY_LATEST_CHARITY_NAME` inline groq, `sanityClient.fetch` + try/catch, `export default async function ShopPage()`, BuyButton import from `@/components/marketing/BuyButton`. Adds: 8 `<section id=\"shop-*\">` blocks inline within a single `<main>`, BuyButton at 3 positions (hero, buy, footer-cta) each wrapped in `<div className=\"mt-N\"><BuyButton /></div>`, 6 `<details>`/`<summary>` FAQ items, 5 `.ornament-divider` blocks between sections, `.drop-cap` + `.prose-measure` + `.eyebrow` typography utilities reused, `--color-*` tokens only (no hex), 2 image-slot placeholders with `TODO(Andrew)` markers."
      min_lines: 250
  key_links:
    - from: "apps/web/app/shop/page.tsx"
      to: "apps/web/components/marketing/BuyButton.tsx"
      via: "import { BuyButton } from '@/components/marketing/BuyButton'"
      pattern: "from\\s+['\"]@/components/marketing/BuyButton['\"]"
    - from: "apps/web/app/shop/page.tsx"
      to: "@/lib/sanity/client"
      via: "QUERY_LATEST_CHARITY_NAME GROQ via sanityClient.fetch with try/catch fallback"
      pattern: "from\\s+['\"]@/lib/sanity/client['\"]"
    - from: "apps/web/app/shop/page.tsx (#shop-charity)"
      to: "weeklyIssue → charity name (Sanity published doc)"
      via: "charityName variable interpolated into `This week's proceeds benefit {charityName}.`"
      pattern: "This week's proceeds benefit"
    - from: "apps/web/__tests__/shop-page.test.ts"
      to: "apps/web/app/shop/page.tsx"
      via: "readFileSync source-scan asserting 8 section IDs + hero tagline + ≥2 BuyButton + no-urgency vocab + TODO(Andrew) marker + <details>/<summary>"
      pattern: "Phase 15: /shop long-scroll structure"
---

<objective>
Rebuild `/shop` from the current minimal Phase 8 placeholder (one sentence + a single BuyButton) into an 8-section long-scroll product page per the locked 15-UI-SPEC, while preserving the Phase 8 Stripe machinery byte-unchanged.

Purpose: Convert `/shop` into a real storefront that holds a reader's attention across 8 narrative beats (hero → positioning → features → ingredient story → charity → product/buy → FAQ → footer CTA), in the lip-balm sub-brand's "Stop. Breathe. Balm." voice register — distinct from the Dispatch's editorial voice — on the Phase 14 warm-paper light base, with Phase 10 editorial typography utilities. No new npm dependencies. No new routes. No new components. No CMS changes. The page remains a Server Component; ISR stays at 60s; the existing `QUERY_LATEST_CHARITY_NAME` inline GROQ is preserved verbatim; the BuyButton client component is reused at 3 positions byte-unchanged via the wrapper-`<div>` spacing pattern. Brief constraints (no Shopify / no Commerce.js / no cart / no urgency mechanics) honored throughout.

Output:
- Extended `apps/web/__tests__/shop-page.test.ts` — original 6 CMR-01 assertions preserved verbatim + new `Phase 15: /shop long-scroll structure` describe block with ≥7 new source-scan assertions.
- Rewritten `apps/web/app/shop/page.tsx` — 8 sections inline in a single `<main>`, BuyButton at 3 positions, dynamic charity name preserved, all copy verbatim from 15-UI-SPEC §Copywriting Contract, all `TODO(Andrew)` markers in place.
- No other files touched. The Phase 8 BuyButton, checkout API route, Stripe webhook route, thank-you page, legal pages, and the issue-page ShopCallout component are all byte-unchanged.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/15-shop-storefront/15-UI-SPEC.md
@.planning/phases/15-shop-storefront/15-RESEARCH.md
@.planning/phases/15-shop-storefront/15-VALIDATION.md
@apps/web/app/shop/page.tsx
@apps/web/__tests__/shop-page.test.ts
@apps/web/components/marketing/BuyButton.tsx
@apps/web/components/issue/DeliberationSlot.tsx
@apps/web/app/globals.css
@CLAUDE.md

<preservation_contract>
The following are BYTE-UNCHANGED in Phase 15. The executor MUST NOT touch any of them:

| Artifact | Path | Why |
|----------|------|-----|
| BuyButton client component | `apps/web/components/marketing/BuyButton.tsx` | SHOP-07 — Phase 8 Stripe machinery byte-unchanged. Has hardcoded internal `className="mt-8"`. NEVER pass props to `<BuyButton />`. Spacing goes on a wrapper `<div>` only. |
| Checkout API route | `apps/web/app/api/checkout/create-session/route.ts` | SHOP-07 |
| Stripe webhook route | `apps/web/app/api/stripe/webhook/route.ts` | SHOP-07 |
| Thank-you page | `apps/web/app/shop/thank-you/page.tsx` | SHOP-07 |
| Legal pages | `apps/web/app/legal/privacy/page.tsx`, `apps/web/app/legal/terms/page.tsx` | SHOP-07 |
| Issue-page ShopCallout | `apps/web/components/issue/ShopCallout.tsx` | CMR-09 — unchanged; the issue-page callout is independent of the /shop page rebuild. |
| `lib/theme.ts` FONT_WHITELIST | `apps/web/lib/theme.ts` | SHOP-05 — no new fonts; Phase 10 trio (Cormorant Garamond / Lora / Inter) only. |
| `globals.css` :root + utilities | `apps/web/app/globals.css` | All needed tokens + utilities (`.eyebrow`, `.drop-cap`, `.ornament-divider`, `.prose-measure`) already exist (Phase 10 + Phase 14). |
| Convex schema + queries | `convex/` | SHOP requires NO new Convex tables, queries, or subscriptions. |

The executor rewrites ONLY `apps/web/app/shop/page.tsx` and extends ONLY `apps/web/__tests__/shop-page.test.ts`. No other code, no other tests, no new files, no new routes.
</preservation_contract>

<interfaces>
<!-- Key types and contracts the executor needs. Embedded so no codebase exploration required. -->

BuyButton (apps/web/components/marketing/BuyButton.tsx):
```typescript
// Client component — 'use client' at top
// NO PROPS — takes nothing, renders a <Button size="lg" className="mt-8">
export function BuyButton(): JSX.Element
// Usage:        <BuyButton />                         // valid
// FORBIDDEN:    <BuyButton className="..." />          // adds a prop — illegal
// FORBIDDEN:    <BuyButton mt={4} />                   // adds a prop — illegal
// Spacing:      <div className="mt-8"><BuyButton /></div>   // wrapper-div pattern (UI-SPEC)
```

sanityClient (apps/web/lib/sanity/client):
```typescript
import { sanityClient } from '@/lib/sanity/client'
// Already imported in current shop/page.tsx — preserve the import line verbatim.
// Usage: await sanityClient.fetch<{ charityName: string | null } | null>(QUERY_LATEST_CHARITY_NAME)
```

QUERY_LATEST_CHARITY_NAME (preserved inline, byte-unchanged from Phase 8):
```typescript
const QUERY_LATEST_CHARITY_NAME = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charityName": charity->name
  }
`
```

DeliberationSlot.tsx `<details>`/`<summary>` pattern (FAQ accordion reference):
```tsx
// Pattern to reuse in FAQ (zero JS, native disclosure):
<details className="group border-b border-[color:var(--color-line)]">
  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px]">
    <span className="font-body text-[16px] font-semibold text-[color:var(--color-text)]">Question</span>
    <ChevronDown size={16} aria-hidden className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
  </summary>
  <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">Answer body</div>
</details>
// CRITICAL: `list-none` on <summary> suppresses the native ▶ disclosure triangle (no globals.css reset exists).
```

globals.css utilities (all already present — no edits needed):
- `.eyebrow` — Inter 12px / 600 / uppercase / opacity 0.6 / `--color-text-mute`
- `.drop-cap` — wraps a div containing one or more `<p>`; `> p:first-of-type::first-letter` is 3.5em, font-display, `--color-primary`
- `.ornament-divider` — `❦` fleuron, `margin-block: 2.5rem`, opacity 0.5, `--color-primary`
- `.prose-measure` — `max-width: 68ch; margin-inline: auto`

globals.css tokens used by this plan (all present):
- `--color-bg` `#FAFAF8` (page bg)
- `--color-surface` `#F2EFE9` (ingredient-story bg, footer-cta bg)
- `--color-card` `#EDE9E1` (feature card bg, charity panel bg, image placeholder bg)
- `--color-primary` `#CDA434` (decorative — drop cap, ornament, feature card top border, eyebrow tint)
- `--color-primary-text` `#7A5C0E` (AA-safe gold text — price/edition in #shop-buy)
- `--color-text` `#1A1A1A` (primary text)
- `--color-text-dim` `#595047` (secondary text — sub-tagline, FAQ answers, supporting lines)
- `--color-text-mute` `#706860` (price-line, edition sub-note, chevron)
- `--color-line` (hairlines — FAQ dividers, card borders)
- `--color-line-strong` (panel borders — charity callout top/bottom)

Tailwind arbitrary-value CSS-variable pattern (codebase convention):
```tsx
className="bg-[color:var(--color-surface)]"  // CORRECT — matches DeliberationSlot/ShopCallout
className="bg-surface"                        // WRONG — do not use even if @theme alias exists
className="text-[color:var(--color-text-dim)]"// CORRECT
className="border-[color:var(--color-line)]"  // CORRECT
```

Phase 10 typography classes (Tailwind config provides these — no new CSS):
- `font-display` → Cormorant Garamond via `var(--font-display)`
- `font-body` → Lora via `var(--font-body)`
- `font-ui` → Inter via `var(--font-ui)`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend shop-page.test.ts with Phase 15 source-scan assertions (Wave 0 — RED first)</name>
  <files>apps/web/__tests__/shop-page.test.ts</files>

  <read_first>
    - apps/web/__tests__/shop-page.test.ts (current 6 CMR-01 assertions — preserve VERBATIM, do not edit any existing `it(...)` block)
    - .planning/phases/15-shop-storefront/15-UI-SPEC.md §Test Contract: CMR Preservation After Rebuild (assertions #6–#12, exact regex shapes)
    - .planning/phases/15-shop-storefront/15-RESEARCH.md §CMR Test Compatibility Audit (Phase 8 `codeOnly()` comment-stripping pattern + the exact assertion code block)
    - .planning/phases/15-shop-storefront/15-VALIDATION.md §Wave 0 Requirements (extension scope, no new files, no new framework)
  </read_first>

  <behavior>
    The 6 existing CMR-01 `it(...)` assertions remain byte-unchanged.
    A new `describe('Phase 15: /shop long-scroll structure', ...)` block is appended below the existing describe.
    On the CURRENT (Phase 8) `apps/web/app/shop/page.tsx`, every NEW assertion in the Phase 15 describe block FAILS (RED). After Task 2 rewrites the page, every assertion in both describe blocks PASSES (GREEN).
    Test runtime: ~3 seconds total (source-scan only, no DOM render).
  </behavior>

  <action>
Append a new `describe('Phase 15: /shop long-scroll structure', ...)` block to `apps/web/__tests__/shop-page.test.ts` (do NOT modify the existing CMR-01 describe block or any of its 6 `it(...)` assertions — they must remain byte-unchanged so CMR-01 stays green throughout).

The new block holds 9 assertions. Add them VERBATIM as written below (the regex shapes are locked by 15-UI-SPEC §Test Contract — do not paraphrase):

```typescript
describe('Phase 15: /shop long-scroll structure', () => {
  it('renders BuyButton in at least 2 positions', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source.match(/<BuyButton/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('renders #shop-hero section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-hero["']/)
  })

  it('renders #shop-features section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-features["']/)
  })

  it('renders #shop-buy section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-buy["']/)
  })

  it('renders #shop-faq section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-faq["']/)
  })

  it('hero tagline is present verbatim', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/Stop\. Breathe\. Balm\./)
  })

  it('no urgency vocabulary in shop page source (CMR-09 extension)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    // Strip block comments, JSX comment blocks, and line comments (Phase 8 codeOnly() pattern).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*$/gm, '')
    expect(codeOnly).not.toMatch(/\blimited\b/i)
    expect(codeOnly).not.toMatch(/only\s+\d+\s+left/i)
    expect(codeOnly).not.toMatch(/\bcountdown\b/i)
    expect(codeOnly).not.toMatch(/\bhurry\b/i)
    expect(codeOnly).not.toMatch(/\bact\s+now\b/i)
  })

  it('no hardcoded 6-digit hex values in shop page source (SHOP-09)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    // Strip comments so doc-strings cannot trip the rule; assert against code only.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*$/gm, '')
    expect(codeOnly).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('includes at least one TODO(Andrew) marker (image slots / price / edition)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/TODO\(Andrew\)/)
  })

  it('uses native <details>/<summary> for the FAQ accordion (zero-JS)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/<details/)
    expect(source).toMatch(/<summary/)
  })
})
```

Implementation rules:
1. Append this block AFTER the existing CMR-01 `describe(...)` block. Do not delete or modify any existing `it(...)`. The CMR-01 assertion `renders a BuyButton component (client-only purchase trigger)` and the new `renders BuyButton in at least 2 positions` are both retained — redundancy is acceptable; removing the CMR-01 assertion would change an existing test (forbidden).
2. The imports at the top of the file already cover `readFileSync, existsSync` from `'node:fs'`, `resolve` from `'node:path'`, and `describe, it, expect` from `'vitest'`. Do not re-import. Do not add new imports.
3. The `SHOP_PAGE_PATH` const at the top of the file is reused — do not redeclare it.
4. The new `it('no hardcoded 6-digit hex values...')` assertion (SHOP-09) is an addition beyond the UI-SPEC's exact assertion list. It is justified because the UI-SPEC §Color section explicitly forbids hardcoded hex on this page. The `codeOnly` comment-stripping prevents false positives from doc comments.

Run after the edit:
```
cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/shop-page.test.ts
```
Expected result: the 6 existing CMR-01 `it(...)` assertions PASS; the 10 new `it(...)` assertions in the Phase 15 describe block FAIL (RED) — this is the desired Wave 0 state. Task 2 turns them green.

Do NOT proceed to Task 2 until this red state is observed and committed.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web &amp;&amp; npx vitest run __tests__/shop-page.test.ts 2&gt;&amp;1 | tee /tmp/shop-test-out.txt; grep -c "Phase 15: /shop long-scroll structure" /tmp/shop-test-out.txt</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "describe('Phase 15: /shop long-scroll structure'" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "describe('CMR-01:" apps/web/__tests__/shop-page.test.ts` still returns `1` (existing block preserved).
    - `grep -c "it('shop page file exists'" apps/web/__tests__/shop-page.test.ts` returns `1` (existing assertion #1 preserved).
    - `grep -c "renders BuyButton in at least 2 positions" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "id=\\\\[\"']shop-hero" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "id=\\\\[\"']shop-features" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "id=\\\\[\"']shop-buy" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "id=\\\\[\"']shop-faq" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "Stop\\\\\\. Breathe\\\\\\. Balm\\\\\\." apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "TODO(Andrew)" apps/web/__tests__/shop-page.test.ts` returns at least `1`.
    - `grep -c "<details" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `grep -c "<summary" apps/web/__tests__/shop-page.test.ts` returns `1`.
    - `cd apps/web && npx vitest run __tests__/shop-page.test.ts` reports the 6 CMR-01 `it(...)` assertions passing AND the new Phase 15 `it(...)` assertions failing (RED state expected before Task 2).
  </acceptance_criteria>

  <done>
    `apps/web/__tests__/shop-page.test.ts` now contains the original CMR-01 describe block (byte-unchanged) followed by a new `describe('Phase 15: /shop long-scroll structure', ...)` block with 10 source-scan assertions. Running the test file shows the CMR-01 assertions green and the Phase 15 assertions red (expected — Task 2 will turn them green). No other test files are touched.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Rewrite shop/page.tsx as 8-section long-scroll storefront (GREEN — turns Task 1 assertions green)</name>
  <files>apps/web/app/shop/page.tsx</files>

  <read_first>
    - apps/web/app/shop/page.tsx (CURRENT Phase 8 minimal page — preserve EXACT metadata block, `export const revalidate = 60`, `QUERY_LATEST_CHARITY_NAME` groq query, `sanityClient.fetch` + try/catch + `charityName` variable; replace ONLY the rendered JSX from `return (` onward through the closing of the function)
    - apps/web/__tests__/shop-page.test.ts (the Task 1-extended test file — `npx vitest run __tests__/shop-page.test.ts` must exit 0 after this task)
    - apps/web/components/marketing/BuyButton.tsx (NO PROPS interface — confirms the wrapper-div spacing pattern)
    - apps/web/components/issue/DeliberationSlot.tsx (the `<details>`/`<summary>` `list-none` + `group-open:rotate-180` chevron pattern to mirror for the FAQ)
    - apps/web/app/globals.css (confirms every `--color-*` token + `.eyebrow` + `.drop-cap` + `.ornament-divider` + `.prose-measure` is present — no edits to globals.css in this task)
    - .planning/phases/15-shop-storefront/15-UI-SPEC.md (THE source of truth — copy every piece of draft copy VERBATIM, do not paraphrase; respect every typography tier; honor every `TODO(Andrew)` marker)
    - .planning/phases/15-shop-storefront/15-RESEARCH.md §Common Pitfalls (Pitfall 1: BuyButton import path; Pitfall 3: BuyButton double-spacing; Pitfall 5: <summary> list-none; Pitfall 7: hardcoded hex; Pitfall 8: do not paraphrase draft copy)
    - CLAUDE.md (single `<main>`, ≥44px touch targets, WCAG AA, security constraints)
  </read_first>

  <behavior>
    After this task, the 6 CMR-01 assertions remain green AND the 10 Phase 15 assertions added in Task 1 turn green. `pnpm --filter web build` exits 0. The full `pnpm --filter web test:unit` suite stays at its current pass count + the 10 new assertions (no previous tripwire regresses — CMR-09 issue-page-shop-callout source-scan is unaffected because `components/issue/ShopCallout.tsx` is untouched).
  </behavior>

  <action>
**Replace the body of `apps/web/app/shop/page.tsx`** with the 8-section long-scroll page below. Preserve the metadata export, the ISR `export const revalidate = 60`, the `QUERY_LATEST_CHARITY_NAME` groq query, and the `sanityClient.fetch` + try/catch — these are byte-unchanged from Phase 8 per SHOP-04 and SHOP-07. The only structural changes are: (a) the `<main>` wrapper around the 8 `<section>` blocks (replacing the current single `<section>`), and (b) the imports — add `ChevronDown` from `lucide-react` for the FAQ chevron.

**Step-by-step:**

1. **Imports at the top (replace current import block):**

```typescript
import type { Metadata } from 'next'
import { groq } from 'next-sanity'
import { ChevronDown } from 'lucide-react'

import { sanityClient } from '@/lib/sanity/client'
import { SITE_NAME, getSiteUrl } from '@/lib/site'
import { BuyButton } from '@/components/marketing/BuyButton'
```

(`lucide-react` is already in the project — Phase 2 pinned it at `^1.14.0` per the UI-SPEC. The `ChevronDown` import is the only new import in this file.)

2. **Preserve byte-unchanged:** `export const revalidate = 60`, the `metadata` Metadata export, the `QUERY_LATEST_CHARITY_NAME` groq const, and the `try/catch` + `charityName` variable inside `ShopPage`. Do NOT keep the `charityCallout` intermediate string — Phase 15's `#shop-charity` section inlines `charityName` directly into a template-literal JSX expression.

3. **Replace the JSX return.** Wrap everything in a single `<main>` (CLAUDE.md hard rule: exactly one `<main>` per page — the root layout at `apps/web/app/layout.tsx` already wraps the page in `<main id="main">`, so this page's outer wrapper MUST be a `<>` fragment or a non-`<main>` element. Use a `<>` fragment as the top-level return; do NOT add a `<main>` here).

Inline ALL 8 sections in the same file. Use the VERBATIM copy and structure below. Do NOT paraphrase. Do NOT substitute hex values. Do NOT pass props to `<BuyButton />`.

**Section 1 — `#shop-hero`:**

```tsx
<section
  id="shop-hero"
  className="mx-auto w-full max-w-[1340px] px-4 md:px-10 pt-16 pb-12 md:pt-24 md:pb-16 text-center"
>
  <p className="eyebrow">Jesse A. Eisenbalm</p>
  {/* TODO(Andrew): upload hero product photography (4:3 landscape). Replace the JSX placeholder block below with <Image src=... alt="Jesse A. Eisenbalm lip balm — Release 001" /> when ready. */}
  <h1 className="mt-4 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.1] text-[color:var(--color-text)]">
    Stop. Breathe. Balm.
  </h1>
  <p className="mx-auto mt-4 max-w-xl font-display text-[clamp(28px,4vw,72px)] italic font-normal leading-[1.3] text-[color:var(--color-text-dim)]">
    A human-only ritual for an AI-everywhere world.
  </p>
  <div className="mt-8">
    <BuyButton />
  </div>
  <p className="mt-4 font-body text-[16px] leading-[1.5] text-[color:var(--color-text-mute)]">
    {/* TODO(Andrew): confirm final price before launch */}
    $8.99
  </p>
</section>
```

**Section 2 — `#shop-positioning`:**

```tsx
<section id="shop-positioning" className="px-4 py-16 md:px-10">
  <p className="eyebrow text-center">The formula.</p>
  <div className="drop-cap prose-measure mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
    <p>
      Jesse A. Eisenbalm lip balm is a professional-grade formula. Beeswax base. No petrolatum. No synthetic emollients. No parabens. No petroleum derivatives.
    </p>
    <p className="mt-4">
      It was designed to address transepidermal water loss — the mechanism by which lips lose moisture — rather than to coat the surface and create dependency. One application. Lasting effect.
    </p>
  </div>
</section>

<div className="ornament-divider" aria-hidden="true" />
```

**Section 3 — `#shop-features`:**

```tsx
<section id="shop-features" className="mx-auto w-full max-w-[1040px] px-4 py-16 md:px-10">
  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
    <article className="border border-t-2 border-[color:var(--color-line)] border-t-[color:var(--color-primary)] bg-[color:var(--color-card)] p-6">
      <p className="eyebrow">BEESWAX FORMULA</p>
      <h3 className="mt-3 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.2] text-[color:var(--color-text)]">
        The base.
      </h3>
      <p className="mt-3 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        Premium beeswax. Petrolatum-free. No synthetics, no parabens, no petroleum derivatives.
      </p>
    </article>
    <article className="border border-t-2 border-[color:var(--color-line)] border-t-[color:var(--color-primary)] bg-[color:var(--color-card)] p-6">
      <p className="eyebrow">100% TO CHARITY</p>
      <h3 className="mt-3 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.2] text-[color:var(--color-text)]">
        The cause.
      </h3>
      <p className="mt-3 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        Every dollar from every sale goes to this week&apos;s featured charity. No overhead. No administrative cut.
      </p>
    </article>
    <article className="border border-t-2 border-[color:var(--color-line)] border-t-[color:var(--color-primary)] bg-[color:var(--color-card)] p-6">
      <p className="eyebrow">RELEASE 001</p>
      <h3 className="mt-3 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.2] text-[color:var(--color-text)]">
        The edition.
      </h3>
      <p className="mt-3 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        {/* TODO(Andrew): confirm hand-numbering process before launch */}
        Hand-numbered. The first edition. Each tube is marked at the manufacturing step.
      </p>
    </article>
  </div>
</section>

<div className="ornament-divider" aria-hidden="true" />
```

**Section 4 — `#shop-ingredient-story`:**

```tsx
<section
  id="shop-ingredient-story"
  className="w-full bg-[color:var(--color-surface)] py-16"
>
  <div className="prose-measure px-4 md:px-10">
    <p className="eyebrow text-center">What&apos;s in it. What isn&apos;t.</p>
    {/* TODO(Andrew): verify ingredient list against manufacturer spec sheet before launch */}
    <div className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
      <p>
        The formula contains: beeswax, shea butter, vitamin E (tocopherol), and natural flavor. That is the complete ingredient list.
      </p>
      <p className="mt-4">
        What it does not contain: petrolatum (petroleum jelly), parabens, synthetic fragrance, mineral oil, or dimethicone. These omissions are deliberate. The goal was a formula a professional would use, not one a marketing department would describe.
      </p>
    </div>
  </div>
</section>

<div className="ornament-divider" aria-hidden="true" />
```

**Section 5 — `#shop-charity`** (preserves the dynamic `charityName` from the Phase 8 server query):

```tsx
<section
  id="shop-charity"
  className="w-full border-y border-[color:var(--color-line-strong)] bg-[color:var(--color-card)] py-16"
>
  <div className="mx-auto w-full max-w-[860px] px-4 md:px-6 lg:px-8 text-center">
    <p className="eyebrow">This week.</p>
    <p className="mt-4 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.3] text-[color:var(--color-text)]">
      {charityName
        ? `This week's proceeds benefit ${charityName}.`
        : 'Proceeds go to our featured charity each week.'}
    </p>
    <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text-dim)]">
      One product. One weekly charity. One hundred percent of proceeds.
    </p>
  </div>
</section>

<div className="ornament-divider" aria-hidden="true" />
```

**Section 6 — `#shop-buy`:**

```tsx
<section id="shop-buy" className="mx-auto w-full max-w-[1040px] px-4 py-20 md:px-10">
  <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
    {/* TODO(Andrew): upload product still photography (3:4 portrait, close-up of tube). Replace the placeholder block below with <Image src=... alt="Jesse A. Eisenbalm lip balm — Release 001, close-up" /> when ready. */}
    <div
      className="mx-auto flex aspect-[3/4] w-full max-w-[480px] items-center justify-center bg-[color:var(--color-card)]"
      aria-hidden="true"
    >
      <p className="eyebrow">PRODUCT PHOTOGRAPHY COMING</p>
    </div>
    <div>
      <p className="eyebrow">THE BALM</p>
      <h2 className="mt-3 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.1] text-[color:var(--color-text)]">
        Jesse A. Eisenbalm
      </h2>
      <p className="mt-4 font-display text-[clamp(28px,4vw,72px)] font-normal leading-[1.2] text-[color:var(--color-primary-text)]">
        {/* TODO(Andrew): confirm final price + edition number before launch */}
        $8.99 · Release 001 · hand-numbered
      </p>
      <p className="mt-3 font-body text-[16px] leading-[1.5] text-[color:var(--color-text-mute)]">
        {/* TODO(Andrew): confirm shipping rates, carrier, and estimated delivery window before launch */}
        Ships flat-rate, continental US.
      </p>
      <div className="mt-6">
        <BuyButton />
      </div>
    </div>
  </div>
</section>

<div className="ornament-divider" aria-hidden="true" />
```

**Section 7 — `#shop-faq`** (6 inline `<details>`/`<summary>` items, mirroring DeliberationSlot's `list-none` + `group-open:rotate-180` pattern):

```tsx
<section id="shop-faq" className="mx-auto w-full max-w-[860px] px-4 py-16 md:px-10">
  <p className="eyebrow text-center">Questions.</p>
  <div className="mt-6 divide-y divide-[color:var(--color-line)] border-y border-[color:var(--color-line)]">
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px] font-body text-[16px] font-semibold leading-[1.4] text-[color:var(--color-text)]">
        What is Jesse A. Eisenbalm?
        <ChevronDown size={16} aria-hidden="true" className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        A lip balm. Professional-grade, beeswax-based, petrolatum-free. Made for people who take their skin barrier seriously.
      </div>
    </details>
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px] font-body text-[16px] font-semibold leading-[1.4] text-[color:var(--color-text)]">
        Where does the money go?
        <ChevronDown size={16} aria-hidden="true" className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        One hundred percent of proceeds from every sale go directly to the week&apos;s featured charity on The Eisenbalm Dispatch. No overhead. No administrative percentage. The full amount transfers.
      </div>
    </details>
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px] font-body text-[16px] font-semibold leading-[1.4] text-[color:var(--color-text)]">
        What is Release 001?
        <ChevronDown size={16} aria-hidden="true" className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        {/* TODO(Andrew): confirm hand-numbering process description before launch */}
        The first edition of Jesse A. Eisenbalm lip balm. Each tube is hand-numbered at the manufacturing step. Release 001 is a designation — a marker of where this product began.
      </div>
    </details>
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px] font-body text-[16px] font-semibold leading-[1.4] text-[color:var(--color-text)]">
        What does petrolatum-free mean?
        <ChevronDown size={16} aria-hidden="true" className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        Petrolatum (petroleum jelly) creates an occlusive surface barrier — it seals in existing moisture but does not add moisture or support the skin&apos;s own function. The Jesse A. Eisenbalm formula uses beeswax and shea butter instead, which provide protection while allowing the skin barrier to function normally.
      </div>
    </details>
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px] font-body text-[16px] font-semibold leading-[1.4] text-[color:var(--color-text)]">
        What is the shipping policy?
        <ChevronDown size={16} aria-hidden="true" className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        {/* TODO(Andrew): add shipping rates, carrier, and estimated delivery window before launch */}
        Ships flat-rate within the continental United States.
      </div>
    </details>
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-[14px] font-body text-[16px] font-semibold leading-[1.4] text-[color:var(--color-text)]">
        How do I contact you?
        <ChevronDown size={16} aria-hidden="true" className="text-[color:var(--color-text-mute)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-2 font-body text-[16px] leading-[1.65] text-[color:var(--color-text-dim)]">
        {/* TODO(Andrew): insert contact email address before launch */}
        Email forthcoming.
      </div>
    </details>
  </div>
</section>
```

**Section 8 — `#shop-footer-cta`:**

```tsx
<section
  id="shop-footer-cta"
  className="w-full border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)] py-16"
>
  <div className="mx-auto w-full max-w-[860px] px-4 md:px-6 lg:px-8 text-center">
    {/* TODO(Andrew): voice-check this outro line — "needs it" leans persuasive; consider a more neutral close before launch */}
    <p className="font-body italic text-[16px] leading-[1.4] text-[color:var(--color-text-dim)]">
      One product. This week&apos;s charity needs it.
    </p>
    <div className="mt-6">
      <BuyButton />
    </div>
  </div>
</section>
```

**4. Final `return (…)` shape.** Wrap all 8 sections + 5 ornament-divider blocks in a top-level fragment so the root layout's `<main id="main">` remains the single `<main>` on the page:

```tsx
return (
  <>
    {/* section 1 hero */}
    {/* section 2 positioning */}
    {/* ornament-divider */}
    {/* section 3 features */}
    {/* ornament-divider */}
    {/* section 4 ingredient story */}
    {/* ornament-divider */}
    {/* section 5 charity (uses charityName) */}
    {/* ornament-divider */}
    {/* section 6 buy */}
    {/* ornament-divider */}
    {/* section 7 faq */}
    {/* section 8 footer-cta */}
  </>
)
```

(No ornament-divider between #shop-faq and #shop-footer-cta — the surface shift on #shop-footer-cta is the visual break.)

**5. Visual double-spacing check (manual — per 15-RESEARCH §Pitfall 3 and 15-VALIDATION §Manual-Only).** After the build passes, run `pnpm --filter web dev` and load `/shop`. If any of the three BuyButton wrappers visibly produces double-spacing above the button (because BuyButton has an internal `mt-8` on its `<Button>`), reduce the wrapper margin to `mt-0` or remove the wrapper `<div>` and place `<BuyButton />` inline. The byte-unchanged contract is on `BuyButton.tsx`, not on the wrapper JSX. The wrapper-pattern remains the UI-SPEC's default — only adjust if visually wrong. This is a follow-up visual judgement, not a build-gate.

**6. Hard rules (do NOT break):**
- No `'use client'` directive on this page (it stays a Server Component — CMR-01 assertion #2).
- No hardcoded hex anywhere in this file's source (SHOP-09).
- No `className`, `mt-*`, `style`, or any other prop on `<BuyButton />` (BuyButton.tsx is byte-unchanged — SHOP-07).
- No new files. No new routes. No new components. No new fonts. No new npm deps. No CDN scripts.
- No urgency vocabulary anywhere — `limited`, `only N left`, `countdown`, `hurry`, `act now` (SHOP-08, CMR-09 contract extension).
- No exclamation marks. No superlatives. No AI mentions in body copy. (SHOP-06 voice register; manually audited.)
- "Release 001" is a brand fact (an edition designation), NOT a scarcity claim. Never frame it with limited / only-N-left / first-come language.
- Exactly one `<main>` per page — the root layout already provides it; this file returns a `<>` fragment.
- Every `TODO(Andrew)` marker is a JSX comment `{/* TODO(Andrew): ... */}` and is part of the file source (greppable).
- Every CSS color reference uses `--color-*` token form via Tailwind arbitrary-value `bg-[color:var(--color-*)]` / `text-[color:var(--color-*)]` / `border-[color:var(--color-*)]`.
- `<summary>` has `list-none` to suppress the native ▶ disclosure triangle (per Pitfall 5).

Final verification commands after the edit:
```
cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/shop-page.test.ts
pnpm --filter web test:unit
pnpm --filter web build
```
All three must exit 0.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web &amp;&amp; npx vitest run __tests__/shop-page.test.ts &amp;&amp; cd /Users/user/Desktop/Eisenbalm &amp;&amp; pnpm --filter web test:unit &amp;&amp; pnpm --filter web build</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "id=\"shop-hero\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-positioning\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-features\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-ingredient-story\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-charity\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-buy\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-faq\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep -c "id=\"shop-footer-cta\"" apps/web/app/shop/page.tsx` returns `1`.
    - `grep "Stop\\. Breathe\\. Balm\\." apps/web/app/shop/page.tsx` matches (hero tagline verbatim).
    - `grep "A human-only ritual for an AI-everywhere world\\." apps/web/app/shop/page.tsx` matches (sub-tagline verbatim).
    - `grep -c "<BuyButton" apps/web/app/shop/page.tsx` returns at least `2` (UI-SPEC has 3 positions; floor is 2).
    - `grep -c "BuyButton className" apps/web/app/shop/page.tsx` returns `0` (no props on BuyButton — byte-unchanged contract).
    - `grep -c "'use client'" apps/web/app/shop/page.tsx` returns `0` (Server Component preserved).
    - `grep -c "export const revalidate = 60" apps/web/app/shop/page.tsx` returns `1` (ISR preserved).
    - `grep -c "QUERY_LATEST_CHARITY_NAME" apps/web/app/shop/page.tsx` returns at least `2` (declaration + usage — preserved).
    - `grep -c "from '@/components/marketing/BuyButton'" apps/web/app/shop/page.tsx` returns `1` (correct import path preserved).
    - `grep -c "TODO(Andrew)" apps/web/app/shop/page.tsx` returns at least `5` (per the UI-SPEC's enumerated TODO markers: hero image, price confirm, edition confirm, ingredient verify, shipping, voice-check; FAQ also has 3).
    - `grep -E "#[0-9a-fA-F]{6}\\b" apps/web/app/shop/page.tsx` returns no match in code (only inside comments if any — comment-stripped check matches the test).
    - `grep -c "ornament-divider" apps/web/app/shop/page.tsx` returns `5` (between sections 2→3, 3→4, 4→5, 5→6, 6→7).
    - `grep -c "drop-cap" apps/web/app/shop/page.tsx` returns `1` (only on #shop-positioning).
    - `grep -c "prose-measure" apps/web/app/shop/page.tsx` returns at least `2` (#shop-positioning + #shop-ingredient-story).
    - `grep -c "<details" apps/web/app/shop/page.tsx` returns `6` (6 FAQ items).
    - `grep -c "<summary" apps/web/app/shop/page.tsx` returns `6`.
    - `grep -c "list-none" apps/web/app/shop/page.tsx` returns at least `6` (one per `<summary>`).
    - `grep -c "limited\\|only [0-9]\\+ left\\|countdown\\|hurry\\|act now" apps/web/app/shop/page.tsx` returns `0` (no urgency vocab; case-sensitive check).
    - `grep -ci "limited\\|countdown\\|hurry" apps/web/app/shop/page.tsx` returns `0` (case-insensitive check; redundant but explicit).
    - `cd apps/web && npx vitest run __tests__/shop-page.test.ts` exits 0 (all 6 CMR-01 assertions + all 10 Phase 15 assertions green).
    - `pnpm --filter web test:unit` exits 0 (full web suite — no prior tripwire regresses; CMR-09 issue-page-shop-callout stays green because `components/issue/ShopCallout.tsx` is byte-unchanged).
    - `pnpm --filter web build` exits 0.
  </acceptance_criteria>

  <done>
    `/shop` renders 8 sections in order in the warm-paper light theme with BuyButton at 3 positions (or ≥2). The hero tagline `Stop. Breathe. Balm.` followed by the sub-tagline `A human-only ritual for an AI-everywhere world.` appears verbatim. The dynamic charity name from the Phase 8 server query renders in `#shop-charity` (with the locked fallback string on Sanity outage). The FAQ uses native `<details>`/`<summary>` with a chevron that rotates on open. Every `TODO(Andrew)` marker from the UI-SPEC is present in the source as a JSX comment. No hardcoded hex anywhere. No urgency vocabulary. `apps/web/__tests__/shop-page.test.ts` is green for all 16 assertions (6 CMR-01 + 10 Phase 15). `pnpm --filter web build` and `pnpm --filter web test:unit` both exit 0. The Phase 8 Stripe machinery (BuyButton, checkout API route, webhook route, thank-you page, legal pages, issue-page ShopCallout) is byte-unchanged.
  </done>
</task>

</tasks>

<verification>
**Phase 15 gate verification** — run from repo root:

```
# Targeted shop test suite (extended in Task 1, all-green after Task 2)
cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/shop-page.test.ts

# Full web unit suite (regression — no prior tripwire breaks)
pnpm --filter web test:unit

# Web build (Next.js typecheck + production compile)
pnpm --filter web build
```

All three commands must exit 0. The shop test now runs:
- 6 CMR-01 assertions (preserved verbatim from Phase 8)
- 10 Phase 15 assertions covering: ≥2 BuyButtons, 4 of the 8 section IDs (the test sample is intentionally smaller than the implementation — `acceptance_criteria` greps cover all 8 IDs in the source), hero tagline verbatim, no-urgency vocab (CMR-09 extension), no-hardcoded-hex, `TODO(Andrew)` marker present, `<details>`/`<summary>` FAQ block present.

**Regression matrix** — the following prior tripwires must stay green and are not modified by this phase:
- `apps/web/__tests__/issue-page-shop-callout.test.ts` (CMR-09) — `components/issue/ShopCallout.tsx` byte-unchanged
- `apps/web/__tests__/issue-page-typography.test.ts` (Phase 10 DES-01..06) — issue page untouched
- `apps/web/__tests__/theme-aa-tones.test.ts` (Phase 14 LIGHT-03/05) — globals.css untouched
- `apps/web/__tests__/game-sandbox.test.ts` (Phase 7 GAM-03) — game component untouched
- `apps/web/__tests__/section-navigator-timeline.test.ts` + `deliberation-carousel-flow.test.ts` (Phase 12 MED-04/05) — components untouched
- `apps/web/__tests__/deliberation-conversation.test.ts` + `deliberation-no-model-names.test.ts` (Phase 13 DEL-CONV) — components untouched
- All Phase 8 CMR tests on Stripe routes / shop-thank-you / legal pages — files byte-unchanged
- All Phase 11 ARC-01 / MOT-01..03 archive + motion tests — files untouched

**Manual-only verifications** (per 15-VALIDATION.md §Manual-Only):
1. Visual hierarchy + 4-tier typography on warm-paper light theme renders correctly (SHOP-05).
2. Mobile breakpoints (360 / 480 / 768 / 1024 / 1440): `#shop-features` collapses 3→1 col; `#shop-buy` collapses 2→1 col; hero padding rebalances; touch targets ≥44px on every CTA at every viewport (SHOP-05).
3. BuyButton wrapper-pattern spacing at 3 positions: visual check for double-spacing from internal `mt-8`; if visibly doubled, drop the wrapper margin and rely on the internal `mt-8` (SHOP-03 follow-up).
4. FAQ accordion: confirm `list-none` suppresses the native disclosure triangle; chevron rotates on open; answers legible (SHOP-08 / SHOP-05).
5. Voice register read-through: every body paragraph + FAQ answer reads in the "Stop. Breathe. Balm." register (meditative, declarative) — NOT the Dispatch's editorial-about-charities register (SHOP-06).
6. Stripe checkout flow regression: click BuyButton from rebuilt page, confirm redirect to Stripe Checkout works (no SHOP-07 regression).
</verification>

<success_criteria>
1. `/shop` renders as a long-scroll product page in the warm-paper light theme — hero (tagline + price + first BuyButton) → positioning paragraph with drop-cap → 3-column features → expanded ingredient story → dynamic charity callout from Sanity → product section (image placeholder + price + second BuyButton) → 6-item inline FAQ → footer CTA (third BuyButton). Mobile responsive; every CTA touch target ≥44px.
2. The Phase 8 `<BuyButton>` from `apps/web/components/marketing/BuyButton.tsx` is reused byte-unchanged at 3 positions (≥2 required); clicking still POSTs to `/api/checkout/create-session` — no Stripe wiring change.
3. The charity callout query (`QUERY_LATEST_CHARITY_NAME`) is preserved verbatim inline; the charity name is server-rendered into `#shop-charity` with no client flicker; the locked fallback string renders on Sanity outage; CMR-09 issue-page ShopCallout source-scan stays green (`components/issue/ShopCallout.tsx` byte-unchanged).
4. Editorial typography is consistent with the rest of the magazine: `.eyebrow` on every section label, `.drop-cap` on `#shop-positioning`, `.ornament-divider` between 5 section boundaries, `.prose-measure` on prose blocks; only Cormorant Garamond + Lora + Inter (FONT_WHITELIST unchanged).
5. Locked constraints preserved: WCAG AA on every text/accent token (raw gold replaced by `--color-primary-text` where used as text); single `<main>` (root layout's `<main>` is the only one); `prefers-reduced-motion` respected (no new motion introduced); only `--color-*` tokens for color (no hardcoded hex); no new npm dependencies; no CDN scripts; brief constraints honored (no Shopify, no Commerce.js, no cart, no urgency mechanics, no popups, no countdown).
6. `pnpm --filter web build` exits 0 and all prior tripwire tests stay green; `apps/web/__tests__/shop-page.test.ts` runs 16 assertions (6 CMR-01 + 10 Phase 15) and exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/15-shop-storefront/15-01-shop-storefront-SUMMARY.md` per the standard summary template, recording:
- Tasks executed (Task 1 test extension + Task 2 page rewrite)
- Files touched (exactly 2: `apps/web/__tests__/shop-page.test.ts` extended, `apps/web/app/shop/page.tsx` rewritten)
- Test counts before/after (CMR-01: 6/6 unchanged; Phase 15: 0→10)
- Decisions taken during execution (e.g., whether wrapper `<div className="mt-N">` was kept or dropped at any BuyButton position due to double-spacing — record the visual judgement)
- Any TODO(Andrew) items deferred to Andrew before launch (hero photo, product photo, final price, edition number, ingredient list verification, shipping rates, contact email, voice-check on the footer outro line)
- Confirmation that Phase 8 Stripe machinery is byte-unchanged (BuyButton.tsx, /api/checkout/create-session/route.ts, /api/stripe/webhook/route.ts, /shop/thank-you/page.tsx, /legal/privacy/page.tsx, /legal/terms/page.tsx, components/issue/ShopCallout.tsx) — each verified with `git diff HEAD~ -- <path>` reporting no changes
</output>
