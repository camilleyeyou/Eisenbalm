# Phase 15: Shop Storefront — Rich Product Page — Research

**Researched:** 2026-05-28
**Domain:** Next.js Server Component page rebuild — UI-to-code translation + test compatibility audit
**Confidence:** HIGH

---

## Summary

Phase 15 is a **single-file page rebuild** (`apps/web/app/shop/page.tsx`) and a **single-file test update** (`apps/web/__tests__/shop-page.test.ts`). Every other file in the project is byte-unchanged. The UI-SPEC is locked and complete — there are no design decisions left for the executor. Research confirms that every CSS token, typography utility, and component reference in the UI-SPEC exists in the codebase today.

The critical finding is that `BuyButton` lives at `apps/web/components/marketing/BuyButton.tsx` — NOT `components/shop/BuyButton.tsx` as the research prompt suggested. The UI-SPEC correctly names it `apps/web/components/marketing/BuyButton.tsx` in the Stripe-machinery preservation contract. The current `shop/page.tsx` imports from `@/components/marketing/BuyButton`, confirming the actual path. This matters because the executor must preserve the correct import path.

The five existing CMR-01 test assertions all survive the rebuild without modification. Seven new assertions are added for Phase 15. No new test files are needed — the UI-SPEC already codifies the exact assertion shapes.

**Primary recommendation:** One plan, one executor task: rewrite `shop/page.tsx` verbatim to the 8-section UI-SPEC structure, then update `shop-page.test.ts` to add the 7 new assertions. Copy the UI-SPEC's draft copy verbatim — do not rewrite it.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | Long-scroll 8-section page structure (`#shop-hero`, `#shop-positioning`, `#shop-features`, `#shop-ingredient-story`, `#shop-charity`, `#shop-buy`, `#shop-faq`, `#shop-footer-cta`) | UI-SPEC §Full Section-by-Section Page Outline; single `<main>` |
| SHOP-02 | Hero tagline `Stop. Breathe. Balm.` present verbatim in h1 | UI-SPEC §Section 1; CMR-01 new assertion #11 |
| SHOP-03 | BuyButton wrapper-pattern: ≥2 positions, component byte-unchanged, spacing via wrapper `<div>` only | UI-SPEC §BuyButton Positions; BuyButton.tsx confirmed byte-unchanged |
| SHOP-04 | Charity callout server-rendered from Sanity — `QUERY_LATEST_CHARITY_NAME` inline query preserved verbatim | UI-SPEC §Section 5; shop/page.tsx existing query |
| SHOP-05 | 4-tier typography contract: T1 12px Inter, T2 16px Lora, T3 18px Lora, T4 clamp(28px,4vw,72px) Cormorant — no other sizes | UI-SPEC §Typography; all fonts in globals.css `:root` |
| SHOP-06 | Voice register: lip-balm sub-brand copy used verbatim from UI-SPEC; no Dispatch editorial voice; no exclamations; no urgency; no AI mentions in body | UI-SPEC §Voice Register Guardrails |
| SHOP-07 | Phase 8 Stripe machinery byte-unchanged: BuyButton, checkout API route, webhook route, thank-you page, legal pages | UI-SPEC §Stripe-Machinery Preservation Contract |
| SHOP-08 | No urgency vocabulary anywhere in page source (CMR-09 extension) | UI-SPEC §CMR Preservation; shop-page.test.ts new assertion #12 |
| SHOP-09 | Light-theme tokens only — all color from `--color-*` CSS variables, no hardcoded hex | UI-SPEC §Color; globals.css Phase 14 tokens verified present |
| SHOP-10 | Image-slot `TODO(Andrew)` comments explicit at both image positions; placeholder block in `#shop-buy` | UI-SPEC §Image Slot Specifications |
| SHOP-11 | `pnpm --filter web build` exits 0 and ALL prior tripwire tests stay green | ROADMAP Phase 15 success criterion 6; regression gate |
</phase_requirements>

---

## Exact Change Surface

### Files MODIFIED (2 files only)

| File | Change |
|------|--------|
| `apps/web/app/shop/page.tsx` | Full rewrite — Phase 8 minimal content replaced with 8-section long-scroll structure per UI-SPEC. Preserves: `export const revalidate = 60`, `QUERY_LATEST_CHARITY_NAME` inline query verbatim, `export default async function ShopPage()`, `sanityClient.fetch` + try/catch, `metadata` export (title/description/OG/Twitter — all already match the locked strings), `BuyButton` import from `@/components/marketing/BuyButton`. |
| `apps/web/__tests__/shop-page.test.ts` | Additive update — 5 existing assertions preserved unchanged; 7 new assertions added for Phase 15 contracts. See CMR Test Compatibility Audit below. |

### Files BYTE-UNCHANGED (all of these — executor must not touch them)

| File | Why Preserved |
|------|---------------|
| `apps/web/components/marketing/BuyButton.tsx` | SHOP-07 byte-unchanged contract. Lives at `components/marketing/` NOT `components/shop/`. Has hardcoded `className="mt-8"` internally — wrapper-pattern only. |
| `apps/web/app/api/checkout/create-session/route.ts` | SHOP-07 |
| `apps/web/app/api/stripe/webhook/route.ts` | SHOP-07 |
| `apps/web/app/shop/thank-you/page.tsx` | SHOP-07 |
| `apps/web/app/legal/privacy/page.tsx` | SHOP-07 |
| `apps/web/app/legal/terms/page.tsx` | SHOP-07 |
| `apps/web/components/issue/ShopCallout.tsx` | CMR-09 source-scan passes automatically; issue-page callout unchanged |
| `apps/web/lib/sanity/queries.ts` | `QUERY_LATEST_CHARITY_NAME` is inline in `shop/page.tsx`, not in `queries.ts` — confirmed by reading both files |
| `apps/web/app/globals.css` | All needed utilities (`.drop-cap`, `.ornament-divider`, `.eyebrow`, `.prose-measure`) and all `--color-*` tokens already exist |
| `apps/web/lib/theme.ts` | FONT_WHITELIST unchanged |
| All other project files | Phase 15 scope is `/shop` only |

### No New Files

The UI-SPEC rules that "The Phase 15 executor rewrites only `apps/web/app/shop/page.tsx` and adds no new routes." The planner should NOT break sections into sub-components in `apps/web/components/shop/`. Here is why:

- The existing magazine components (`IssueHero.tsx`, `DeliberationSlot.tsx`) show that large components are written as single files with all sections inline — IssueHero is ~180 lines and self-contained; DeliberationSlot is ~770 lines.
- The shop page has 8 simple content sections with no interactive state (all `<details>`/`<summary>` are zero-JS). There are no Convex subscriptions, no real-time data, no complex client islands.
- Sub-components would require new imports and new files (2+ new files), increasing change surface without benefit.
- The only client island is `BuyButton` (imported from `components/marketing/`) — already exists.

**Recommendation:** All 8 sections inline in `apps/web/app/shop/page.tsx`. The file will be ~250–350 lines — well within the project's established single-file norm.

---

## CMR Test Compatibility Audit

### Current test file: `apps/web/__tests__/shop-page.test.ts`

The test has one `describe` block with 6 `it` assertions. All use `readFileSync` on `apps/web/app/shop/page.tsx`.

### Assertions that SURVIVE the rebuild without modification

| # | Assertion | Why it survives |
|---|-----------|-----------------|
| 1 | `shop page file exists` | File is not deleted; it is rewritten |
| 2 | `does NOT declare "use client" at the top of file` | Rebuild is a Server Component — no `'use client'` |
| 3 | `imports sanityClient (server-side Sanity read)` | The `import { sanityClient } from '@/lib/sanity/client'` line is preserved |
| 4 | `exports an async default function (server component)` | `export default async function ShopPage()` preserved |
| 5 | `renders a BuyButton component (client-only purchase trigger)` | `<BuyButton` appears ≥2 times in the rebuilt page; regex `.toMatch(/<BuyButton/)` passes |
| 6 | `declares ISR with export const revalidate` | `export const revalidate = 60` preserved verbatim |

All 6 existing assertions stay green. Zero modifications needed to existing assertions.

### New assertions to ADD in Phase 15

The UI-SPEC (§Test Contract) codifies exact assertion shapes. The executor must add these as a second `describe` block in the same test file:

```typescript
describe('Phase 15: /shop long-scroll structure', () => {
  // #7
  it('renders BuyButton in at least 2 positions', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source.match(/<BuyButton/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  // #8
  it('renders #shop-hero section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-hero["']/)
  })

  // #9
  it('renders #shop-features section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-features["']/)
  })

  // #10
  it('renders #shop-buy section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-buy["']/)
  })

  // #11
  it('renders #shop-faq section', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/id=["']shop-faq["']/)
  })

  // #12
  it('hero tagline is present verbatim', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    expect(source).toMatch(/Stop\. Breathe\. Balm\./)
  })

  // #13 (CMR-09 extension)
  it('no urgency vocabulary in shop page source (CMR-09 extension)', () => {
    const source = readFileSync(SHOP_PAGE_PATH, 'utf8')
    // Strip block, JSX block, and line comments (mirrors Phase 8 codeOnly() pattern)
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
})
```

**Assertion #5 note:** After the rebuild, assertion #5 (`renders a BuyButton component`) becomes redundant with new assertion #7 (≥2 BuyButtons). Both stay in the file — redundancy is fine, and removing assertion #5 would change an existing test.

**No new test file needed.** The UI-SPEC's source-scan strategy (readFileSync + regex) is purely additive to the existing CMR-01 test file. The CMR-09 extension (assertion #13) covers the same urgency-vocab concern as the ShopCallout source-scan; no separate shop-page-source.test.ts file is warranted.

---

## Charity Callout Preservation

### Exact lines to preserve from Phase 8 shop/page.tsx

The following block is the load-bearing Phase 8 server wiring. Preserve byte-for-byte in the rebuilt page (same inline location, same variable names, same try/catch structure):

```typescript
const QUERY_LATEST_CHARITY_NAME = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charityName": charity->name
  }
`
```

```typescript
let charityName: string | null = null
try {
  const result = await sanityClient.fetch<{ charityName: string | null } | null>(
    QUERY_LATEST_CHARITY_NAME,
  )
  charityName = result?.charityName ?? null
} catch {
  charityName = null
}
```

The `charityCallout` string computation in Phase 8:
```typescript
const charityCallout = charityName
  ? `This week's proceeds benefit ${charityName}.`
  : 'Proceeds go to our featured charity each week.'
```
...is superseded by Phase 15's `#shop-charity` section structure, which renders the same two strings at T4 display size with an `.eyebrow` label above and a supporting line below. The variable name `charityName` is used directly in JSX (no `charityCallout` intermediary needed). The fallback string `'Proceeds go to our featured charity each week.'` is locked in the UI-SPEC Copywriting Contract.

### ISR preservation

`export const revalidate = 60` is at the top of the current Phase 8 file and is preserved verbatim in the rebuild. The 60-second revalidation means a new issue publishing in Sanity will surface the new charity name within 60 seconds — this contract is unchanged.

---

## Architecture Patterns

### Recommended page structure (inline, single file)

```
apps/web/app/shop/page.tsx
├── Metadata export (byte-preserved from Phase 8)
├── export const revalidate = 60
├── QUERY_LATEST_CHARITY_NAME (inline groq, byte-preserved)
├── export default async function ShopPage()
│   ├── sanityClient.fetch + try/catch (byte-preserved)
│   ├── <main> (single <main> per CLAUDE.md constraint)
│   │   ├── <section id="shop-hero">
│   │   │   ├── <p className="eyebrow"> — "Jesse A. Eisenbalm"
│   │   │   ├── <h1> — "Stop. Breathe. Balm."
│   │   │   ├── <p> italic sub-tagline
│   │   │   ├── <div className="mt-8"><BuyButton /></div>  ← BuyButton #1
│   │   │   └── <p> price line
│   │   ├── <section id="shop-positioning">
│   │   │   ├── <p className="eyebrow">
│   │   │   └── <div className="drop-cap prose-measure"> + 2 <p>
│   │   ├── <div className="ornament-divider" />
│   │   ├── <section id="shop-features">
│   │   │   └── 3 feature cards (CSS grid/flex)
│   │   ├── <div className="ornament-divider" />
│   │   ├── <section id="shop-ingredient-story">
│   │   │   └── w-full bg-[color:var(--color-surface)] outer + prose-measure inner
│   │   ├── <div className="ornament-divider" />
│   │   ├── <section id="shop-charity">
│   │   │   └── full-width --color-card panel with charityName dynamic line
│   │   ├── <div className="ornament-divider" />
│   │   ├── <section id="shop-buy">
│   │   │   ├── Left col: placeholder block (aspect-[3/4] --color-card)
│   │   │   └── Right col: product name, price, BuyButton #2
│   │   │       └── <div className="mt-6"><BuyButton /></div>  ← BuyButton #2
│   │   ├── <div className="ornament-divider" />
│   │   ├── <section id="shop-faq">
│   │   │   └── 6 <details>/<summary> items
│   │   └── <section id="shop-footer-cta">
│   │       ├── bg-[color:var(--color-surface)] outer
│   │       ├── outro line
│   │       └── <div className="mt-6"><BuyButton /></div>  ← BuyButton #3 (optional)
```

### Tailwind arbitrary CSS variable pattern (CRITICAL)

The UI-SPEC mandates this exact pattern for `--color-surface` and `--color-card` backgrounds:

```tsx
// CORRECT — established codebase pattern
<section className="w-full bg-[color:var(--color-surface)]">
<div className="bg-[color:var(--color-card)]">

// WRONG — do not use
<section className="bg-surface">
```

This pattern is already used in `ShopCallout.tsx` (`bg-[color:var(--color-line-strong)]`) and throughout `DeliberationSlot.tsx`. It is the project's established pattern for CSS variable color application in Tailwind v4.

### details/summary accordion pattern (FAQ)

The existing project pattern from `DeliberationSlot.tsx` confirms:
- `list-none` on `<summary>` suppresses the default browser disclosure triangle
- No `::-webkit-details-marker:none` is needed — `list-none` handles it
- The project uses an explicit chevron character (▾) or a Lucide icon + CSS rotate on `[open]` state
- The Tailwind `group` + `group-open:rotate-180` pattern is established

For the FAQ, the UI-SPEC specifies `lucide-react ChevronDown` (16px) + CSS rotate. The project already has `lucide-react ^1.14.0`. No new dependency. Chevron rotation CSS:

```css
/* In globals.css — add a single FAQ-specific block, or use Tailwind group pattern */
/* Phase 15 can use: className="transition-transform group-open:rotate-180" on the chevron span */
```

The `<summary>` needs `list-none py-[14px]` for the ≥44px touch target (28px padding + 16px text = 44px). This matches the existing DeliberationSlot pattern of `min-h-11` (44px).

### BuyButton wrapper-pattern (CRITICAL — double-spacing pitfall)

`BuyButton` has hardcoded `className="mt-8"` baked into its `<Button>` element inside the component. The wrapper pattern places `mt-N` on a `<div>` that wraps `<BuyButton />`:

```tsx
// BuyButton #1 (hero) — spacing between sub-tagline and button
<div className="mt-8"><BuyButton /></div>
// The BuyButton's internal mt-8 adds BELOW the button (between button top and its own top-of-content), 
// NOT above the button. The wrapper mt-8 sets the gap above the button wrapper.
// These DO NOT compound into double-spacing — internal mt-8 is on the <button> element's 
// top-margin relative to its container, but the wrapper <div> contains only the BuyButton;
// there is no "first child" content inside the wrapper above the BuyButton.
// Therefore wrapper mt-8 = space above the wrapper; BuyButton internal mt-8 = top margin on <button>.
// In practice the internal mt-8 pushes the button down 32px WITHIN its wrapper,
// which effectively adds 32px of top-space relative to the wrapper itself.
// Executor must test visually — if double-spacing occurs, reduce wrapper mt to mt-0 and 
// let the internal mt-8 alone set the gap.
```

**Practical recommendation:** Match the UI-SPEC exactly:
- `#shop-hero`: `<div className="mt-8"><BuyButton /></div>` — if this looks visually double-spaced, the wrapper `mt-8` is creating 32px above + internal `mt-8` creating another 32px. Use `<div className="mt-0"><BuyButton /></div>` or no wrapper div, just `<BuyButton />` inline (the internal `mt-8` will apply relative to whatever is above it in the flex/block context).

The safest pattern (zero risk): **no wrapper div, just `<BuyButton />`** — the internal `mt-8` applies to the button's margin relative to the element above it. The UI-SPEC wrapper-div instruction is for cases where the executor needs to ADD spacing; if the internal `mt-8` already provides it, the wrapper adds nothing.

**Note for the executor:** If the surrounding context is a flex column (`flex flex-col`), the internal `mt-8` on the `<Button>` element sets margin from the preceding sibling. If it is a block context, `mt-8` sets margin-top from the normal flow. The wrapper `<div className="mt-N">` only matters if the block context does not already separate the BuyButton from its predecessor. Test both visually. The byte-unchanged contract means the internal `mt-8` cannot be removed.

### Image placeholder pattern (clean editorial look)

For both image slots (hero + buy), use a `--color-card` block with centered `.eyebrow` text. This looks intentional, not broken:

```tsx
{/* TODO(Andrew): replace this comment with next/image when hero photography is ready */}
<div
  className="mx-auto max-w-[760px] w-full aspect-[4/3] bg-[color:var(--color-card)] flex items-center justify-center"
  aria-hidden="true"
>
  <p className="eyebrow">PRODUCT PHOTOGRAPHY COMING</p>
</div>
```

For `#shop-buy` (portrait):
```tsx
{/* TODO(Andrew): upload product still photography (3:4 portrait). Replaces placeholder block. */}
<div
  className="w-full max-w-[480px] aspect-[3/4] bg-[color:var(--color-card)] flex items-center justify-center"
  aria-hidden="true"
>
  <p className="eyebrow">PRODUCT PHOTOGRAPHY COMING</p>
</div>
```

---

## Token Verification

All `--color-*` tokens referenced in the UI-SPEC were verified against `apps/web/app/globals.css :root`:

| Token | Status | Value (Phase 14) |
|-------|--------|------------------|
| `--color-bg` | EXISTS | `#FAFAF8` |
| `--color-surface` | EXISTS | `#F2EFE9` |
| `--color-card` | EXISTS | `#EDE9E1` |
| `--color-primary` | EXISTS | `#CDA434` |
| `--color-primary-text` | EXISTS (Phase 14 NEW) | `#7A5C0E` |
| `--color-accent-text` | EXISTS (Phase 14 NEW) | `#9B3015` |
| `--color-text` | EXISTS | `#1A1A1A` |
| `--color-text-dim` | EXISTS | `#595047` |
| `--color-text-mute` | EXISTS | `#706860` |
| `--color-line` | EXISTS | `color-mix(...)` |
| `--color-line-strong` | EXISTS | `color-mix(...)` |
| `--color-text-muted` | EXISTS (back-compat alias) | `= --color-text-mute` |

All typography utilities verified in globals.css (Phase 10):

| Class | Status |
|-------|--------|
| `.prose-measure` | EXISTS — `max-width: 68ch; margin-inline: auto` |
| `.drop-cap` | EXISTS — `> p:first-of-type::first-letter` with `font-display` + `color: var(--color-primary)` |
| `.ornament-divider` | EXISTS — `❦ FLEURON`, `margin-block: 2.5rem` |
| `.eyebrow` | EXISTS — Inter 12px/600/uppercase/opacity 0.6 |

**Token mismatch to watch:** The current Phase 8 `shop/page.tsx` uses `--color-text-muted` (aliased back-compat name) and `font-ui` (Tailwind theme class). Both still work. The rebuild should use `--color-text-mute` (direct token) and `var(--font-ui)` where needed, consistent with the UI-SPEC and the Phase 14 naming. The back-compat alias means `--color-text-muted` still works, but the executor should use the Phase 14 canonical names.

---

## Common Pitfalls

### Pitfall 1: Wrong BuyButton import path
**What goes wrong:** Executor uses `@/components/shop/BuyButton` (does not exist) instead of `@/components/marketing/BuyButton`.
**Root cause:** The research prompt mentioned `components/shop/BuyButton.tsx` but the actual file is `components/marketing/BuyButton.tsx`. The UI-SPEC's Stripe-machinery preservation contract lists the correct path. The current Phase 8 page.tsx imports from `@/components/marketing/BuyButton` — this is the ground truth.
**Prevention:** Always copy the import statement from the existing `shop/page.tsx` line 6.

### Pitfall 2: ISR revalidate value not preserved
**What goes wrong:** Executor omits `export const revalidate = 60` or changes the value.
**Root cause:** Overlooking the Phase 8 ISR contract during a full page rewrite.
**Prevention:** Test assertion #6 catches this automatically. The revalidate export must be present in the rebuilt file.

### Pitfall 3: BuyButton internal mt-8 causing visual double-spacing
**What goes wrong:** Wrapper `<div className="mt-8">` + BuyButton's internal `className="mt-8"` on the `<Button>` element creates 64px of apparent top spacing in some flex/block contexts.
**Root cause:** BuyButton's source has `className="mt-8"` hardcoded on the `<Button>` element (confirmed by reading the file). This is NOT a prop — it is a static class on the returned element.
**How to detect:** Visual inspection in browser. The internal `mt-8` applies as top-margin on the button relative to its flex/block context.
**Prevention:** In most block contexts the wrapper `<div className="mt-8">` creates gap above the wrapper, and the internal `mt-8` applies to the button's own margin within the (now single-child) wrapper — they DO stack. If double-spacing is visible, remove the wrapper div and let the internal `mt-8` alone set the gap. The byte-unchanged contract is on the component source, not the wrapping JSX.

### Pitfall 4: BuyButton CMR-05 source-scan tripwire
**What goes wrong:** Executor is tempted to add a `className` or `style` prop to `<BuyButton />` to control spacing, but the CMR-05 source-scan looks for modification patterns.
**Root cause:** CMR-05 tripwire scans for bypass patterns in the webhook handler, not in the shop page — so this specific tripwire would not trigger. But the byte-unchanged contract for `BuyButton.tsx` is architectural. Any prop addition would require a component edit (forbidden).
**Prevention:** Use wrapper divs for spacing only. Never pass props to `<BuyButton />`.

### Pitfall 5: details/summary disclosure triangle remains visible
**What goes wrong:** `<summary>` shows the browser's default ▶ disclosure triangle alongside the custom lucide-react `ChevronDown` icon, creating a double-indicator.
**Root cause:** `globals.css` does NOT have a `details summary { list-style: none }` global reset. The existing `DeliberationSlot.tsx` uses `className="... list-none ..."` on the `<summary>` element directly.
**Prevention:** Apply `list-none` directly to the `<summary>` element's className (as the DeliberationSlot does). This suppresses the native triangle on all browsers including Chrome's pseudo-element `::-webkit-details-marker`.

### Pitfall 6: ornament-divider `margin-block: 2.5rem` (40px) adds to section padding
**What goes wrong:** Each `.ornament-divider` adds 40px margin-block (top + bottom = 80px total) between sections. If sections themselves have `py-16` (64px), the visual gap between sections becomes very large on desktop.
**Root cause:** The `.ornament-divider` utility has `margin-block: 2.5rem` baked in — this is by design (UI-SPEC calls it out explicitly). No change needed.
**Prevention:** This is intentional breathing room. Do not add extra margin on the ornament wrapper.

### Pitfall 7: Hardcoded hex values for placeholder blocks
**What goes wrong:** Executor writes `bg-[#EDE9E1]` instead of `bg-[color:var(--color-card)]`.
**Root cause:** Shortcut to avoid the longer CSS variable form.
**Prevention:** SHOP-09 assertion: no hardcoded hex in the page source. The Phase 14 theme-aa-tones.test.ts source-scan tripwires check the test files, not necessarily shop/page.tsx — but the UI-SPEC is explicit: "No hardcoded hex values anywhere on this page."

### Pitfall 8: Executor rewrites draft copy instead of using UI-SPEC verbatim
**What goes wrong:** Executor paraphrases the positioning paragraph, ingredient story, or FAQ answers.
**Root cause:** LLM tendency to "improve" or "adapt" copy.
**Prevention:** The planner must explicitly require the executor to copy the draft copy verbatim from UI-SPEC §Copywriting Contract. The copy in the UI-SPEC is in voice and approved. No modifications. `TODO(Andrew)` markers are part of the copy and must be preserved as JSX comments.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| FAQ accordion with animation | Custom React state + CSS transition | `<details>`/`<summary>` — zero JS, native, already established in the codebase (DeliberationSlot.tsx) |
| Disclosure triangle suppression | Custom CSS `::-webkit-details-marker` blocks | `list-none` on `<summary>` className — already the project pattern |
| Font loading | New `@import` or `next/font` calls | Already loaded via root layout; `font-display`, `font-body`, `font-ui` Tailwind classes work immediately |
| Color variables | Hardcoded hex values | `--color-*` tokens already defined; Tailwind arbitrary form `bg-[color:var(--color-card)]` |
| Image placeholder | SVG illustration or blank box | `--color-card` block + `.eyebrow` label — editorial-looking, intentional |
| Charity name query | New GROQ query | `QUERY_LATEST_CHARITY_NAME` inline in page.tsx — preserve verbatim from Phase 8 |

---

## State of the Art (Codebase-specific)

| Phase 8 Pattern | Phase 15 Replacement | Change |
|----------------|---------------------|--------|
| Single `<section>` with inline charity callout | 8 `<section>` elements in a `<main>` | Structural expansion only |
| `charityCallout` string displayed in body prose | Dynamic `charityName` used in T4 display type in `#shop-charity` | Same data, more prominent rendering |
| One `<BuyButton />` | ≥2 `<BuyButton />` (3 per spec) | Wrapper-pattern only; component unchanged |
| `--color-text-muted` (Phase 8 used back-compat alias) | `var(--color-text-mute)` (canonical Phase 14 name) | Functionally identical; canonical form preferred |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed in Phase 7, `apps/web/vitest.config.ts`) |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit` (only unit tests exist; no e2e) |
| Build command | `pnpm --filter web build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-01 | 8 section IDs present in page source | source-scan | `pnpm --filter web test:unit -- --reporter=verbose` | Wave 0 — update existing file |
| SHOP-02 | Hero tagline `Stop. Breathe. Balm.` in source | source-scan | same | Wave 0 — update existing file |
| SHOP-03 | `<BuyButton` appears ≥2 times | source-scan | same | Wave 0 — update existing file |
| SHOP-04 | `QUERY_LATEST_CHARITY_NAME` present; `sanityClient` import present | source-scan (existing assertion #3) | same | ALREADY GREEN — assertion #3 covers |
| SHOP-05 | No forbidden sizes outside 4-tier system | manual visual review | — | MANUAL-ONLY |
| SHOP-06 | No exclamation marks, no AI in body, correct voice | manual editorial review | — | MANUAL-ONLY |
| SHOP-07 | Phase 8 files untouched (CMR-01 assertions 1–6) | source-scan (existing) | same | ALREADY GREEN — all 6 existing assertions |
| SHOP-08 | No urgency vocabulary in shop page source | source-scan | same | Wave 0 — update existing file |
| SHOP-09 | No hardcoded hex in shop page | source-scan | same | Wave 0 — could add assertion |
| SHOP-10 | `TODO(Andrew)` markers in JSX for image slots | source-scan | same | Wave 0 — could add assertion |
| SHOP-11 | Build exits 0, all tripwires green | build + full unit suite | `pnpm --filter web build && pnpm --filter web test:unit` | Already configured |

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:unit`
- **Per wave merge:** `pnpm --filter web test:unit && pnpm --filter web build`
- **Phase gate:** `pnpm --filter web build` exits 0 AND all prior tripwire tests stay green

### Wave 0 Gaps (one update, no new files)

The only Wave 0 gap is adding 7 new assertions to the existing test file:

- [ ] `apps/web/__tests__/shop-page.test.ts` — add `describe('Phase 15: /shop long-scroll structure', ...)` block with assertions #7–#13 (see CMR Test Compatibility Audit section above for exact code)

No new test files. No new framework installs. No new fixtures. Existing Vitest config covers the update.

### Manual-Only Verifications (genuine human checks)

These cannot be automated and require Andrew or the executor to verify visually:

1. **Rendered storefront on warm-paper light theme** — confirm visual hierarchy, typography tiers, ornament dividers, feature card layout, and FAQ accordion renders correctly in Chrome/Safari on desktop
2. **Mobile breakpoints** — confirm `#shop-features` collapses from 3-col to 1-col at `<768px`; `#shop-buy` stacks from 2-col to 1-col; hero padding adjusts from `pt-24` to `pt-16`; touch targets ≥44px on all CTAs
3. **BuyButton spacing (double-spacing check)** — confirm no double-spacing from internal `mt-8` + wrapper `mt-8` at any BuyButton position
4. **FAQ accordion** — confirm `list-none` suppresses native disclosure triangle, custom ChevronDown icon rotates on open, answers are readable on light theme
5. **Voice register audit** — Andrew reads all 8 sections and confirms: no urgency language, no exclamations, no superlatives, `TODO(Andrew)` markers visible in rendered output (or confirmed as JSX comments only), copy matches UI-SPEC verbatim
6. **Stripe checkout flow** — click BuyButton from rebuilt page, confirm redirect to Stripe Checkout works (no regression from page rebuild)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 15 is a pure code/markup change. No external CLIs, services, runtimes, or databases are introduced. Existing project infrastructure (Node.js, pnpm, Vitest, Sanity CDN) is established.

---

## Open Questions

1. **BuyButton double-spacing in practice**
   - What we know: BuyButton has `className="mt-8"` on its internal `<Button>`. UI-SPEC says `<div className="mt-8"><BuyButton /></div>`.
   - What's unclear: Whether the wrapper + internal mt-8 compound to 64px visual gap or whether the flex/block context resolves it to one mt-8 effectively.
   - Recommendation: Executor tests this visually after the build. If double-spaced, remove the wrapper div and let internal `mt-8` alone set the gap. The byte-unchanged contract is on the component source file, not on the JSX wrapping in page.tsx.

2. **Optional third BuyButton in `#shop-footer-cta`**
   - What we know: UI-SPEC says "Include ONLY if user scroll analytics suggest high drop-off here (assumption: include it — three positions is justified)." The minimum contractual requirement is ≥2.
   - What's unclear: Whether Andrew wants 2 or 3 positions at launch.
   - Recommendation: Include 3 per the UI-SPEC's own assumption. Test assertion #7 requires ≥2 — 3 satisfies it.

3. **Eyebrow section header note in UI-SPEC §shop-positioning**
   - What we know: The UI-SPEC says the `#shop-positioning` eyebrow text is `"The formula."` but also calls it a "section eyebrow." The structure has eyebrow ABOVE the section headline. But the section headline for `#shop-positioning` is not named separately — the eyebrow IS the label.
   - What's unclear: Is `"The formula."` the eyebrow (`<p className="eyebrow">`) or a section headline (`<h2>`)?
   - Recommendation: Follow the UI-SPEC table exactly: `<p className="eyebrow">The formula.</p>` — no separate h2 for this section. The UI-SPEC typography column says "T1 — `.eyebrow`" confirming it is an eyebrow element, not a headline.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `apps/web/app/shop/page.tsx` — confirmed Phase 8 structure, QUERY location, BuyButton import path
- Direct file read: `apps/web/components/marketing/BuyButton.tsx` — confirmed byte-unchanged contract, internal `mt-8`, no-props interface
- Direct file read: `apps/web/__tests__/shop-page.test.ts` — confirmed 6 existing assertions verbatim
- Direct file read: `apps/web/app/globals.css` — confirmed all 11 `--color-*` tokens + 4 typography utilities present
- Direct file read: `apps/web/components/issue/DeliberationSlot.tsx` (lines 306–326) — confirmed `list-none` on `<summary>`, `group-open:rotate-180` chevron pattern
- Direct file read: `.planning/phases/15-shop-storefront/15-UI-SPEC.md` — locked design contract
- Direct file read: `.planning/ROADMAP.md` — Phase 15 success criteria
- Direct file read: `.planning/STATE.md` — Phase 8 decisions, inline query location, BuyButton import path history

### Secondary (MEDIUM confidence)
- `apps/web/components/issue/IssueHero.tsx` — pattern confirmation: large single-file component with all sections inline; `font-display clamp(...)` usage pattern; `bg-[color:var(--color-*)]` arbitrary-value pattern
- `apps/web/components/issue/ShopCallout.tsx` — CMR-09 source-of-truth; confirmed byte-unchanged contract

---

## Metadata

**Confidence breakdown:**
- Change surface: HIGH — confirmed by reading all target files directly
- CMR test compatibility: HIGH — all assertions read verbatim; compatibility analysis is deterministic
- Pitfalls: HIGH — BuyButton mt-8 confirmed by reading the component source; details/summary pattern confirmed by DeliberationSlot
- Token verification: HIGH — every token read directly from globals.css :root

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable — no moving parts; all decisions locked in UI-SPEC)
