---
phase: 08-stripe-commerce
plan: 06
type: execute
wave: 3
depends_on:
  - "08-01"
  - "08-04"
files_modified:
  - apps/web/app/shop/page.tsx
autonomous: true
requirements:
  - CMR-01
must_haves:
  truths:
    - "apps/web/app/shop/page.tsx is rewritten as an async Server Component (NO 'use client' directive)"
    - "The page imports sanityClient and fetches the current charity name via GROQ at request time"
    - "The page imports BuyButton from @/components/marketing/BuyButton and renders it"
    - "The page declares ISR via `export const revalidate = 60`"
    - "The charity callout uses the same dynamic copy pattern as Phase 2: 'This week's proceeds benefit {name}.' OR fallback 'Proceeds go to our featured charity each week.'"
    - "Existing metadata export (SEO, OG, Twitter card) is preserved verbatim from Phase 2"
    - "The Wave 0 test __tests__/shop-page.test.ts passes after this plan"
  artifacts:
    - path: "apps/web/app/shop/page.tsx"
      provides: "Server-rendered /shop with charity callout + BuyButton trigger"
      contains: "BuyButton"
  key_links:
    - from: "apps/web/app/shop/page.tsx"
      to: "apps/web/components/marketing/BuyButton.tsx"
      via: "BuyButton client component embedded in server-rendered page"
      pattern: "<BuyButton"
    - from: "apps/web/app/shop/page.tsx"
      to: "apps/web/lib/sanity/client.ts"
      via: "Server-side sanityClient.fetch with QUERY_LATEST_CHARITY_NAME projection"
      pattern: "sanityClient\\.fetch"
---

<objective>
Rewrite the Phase 2 `/shop` placeholder to be the real product page: server-rendered (no client flicker), charity callout populated from the current published issue, BuyButton from Plan 08-04 wired in. After this plan: `pnpm --filter web test:unit __tests__/shop-page.test.ts` goes green.

Purpose: Honors CMR-01 (`/shop` server-rendered with charity callout, no client flicker). Replaces the "Coming soon" disabled-button shell from Phase 2 Plan 02-09 with the functional purchase path. Existing SEO metadata is preserved verbatim (Phase 2 already established robots, og, twitter cards).

Output: A live `/shop` page that renders correct copy server-side and offers a real Stripe Checkout trigger.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@apps/web/app/shop/page.tsx
@apps/web/__tests__/shop-page.test.ts
@apps/web/components/marketing/BuyButton.tsx
@apps/web/lib/sanity/client.ts
@apps/web/lib/site.ts
@apps/web/components/ui/button.tsx

<interfaces>
<!-- Phase 2 shop/page.tsx (apps/web/app/shop/page.tsx) — current state:
       - Async Server Component, no 'use client'
       - Inline QUERY_LATEST_CHARITY_NAME via groq (charityName: charity->name)
       - revalidate = 60
       - Metadata export with robots/og/twitter
       - Disabled "Coming soon" Button placeholder

     This plan KEEPS:
       - The metadata export verbatim
       - The QUERY_LATEST_CHARITY_NAME inline projection (or equivalent)
       - The revalidate = 60 ISR config
       - The "This week's proceeds benefit X" copy pattern + fallback
       - The general h1/heading layout (font-display, color-text, etc.)

     This plan CHANGES:
       - Replaces the disabled "Coming soon" Button with <BuyButton />
       - Removes the "Product details coming soon" placeholder paragraph
       - Adds product details copy (Andrew can adjust later; placeholder shape locked here)

     The Wave 0 test (__tests__/shop-page.test.ts) asserts:
       - File exists, default export is async function (Server Component)
       - NO 'use client' on first non-comment line
       - Imports @/lib/sanity/client
       - Renders <BuyButton ... /> in JSX
       - Has `export const revalidate = <number>`  -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite apps/web/app/shop/page.tsx with BuyButton + dynamic charity callout</name>
  <read_first>
    - apps/web/app/shop/page.tsx (current Phase 2 state — keep metadata, GROQ pattern, revalidate; rewrite body)
    - apps/web/__tests__/shop-page.test.ts (the assertion shape — server component, no 'use client', BuyButton, revalidate)
    - apps/web/components/marketing/BuyButton.tsx (Plan 08-04 — the import target)
    - apps/web/lib/sanity/client.ts (sanityClient signature)
    - apps/web/lib/site.ts (SITE_NAME, getSiteUrl)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 1 (server-component shape with charity-name fetch)
  </read_first>
  <behavior>
    - Test 1: File starts with imports / type declarations, NOT 'use client' (Server Component).
    - Test 2: Default export is `export default async function ShopPage()`.
    - Test 3: Imports `sanityClient` from `@/lib/sanity/client`.
    - Test 4: Imports and renders `<BuyButton />`.
    - Test 5: Declares `export const revalidate = 60`.
    - Test 6: When Sanity returns a charity, copy reads "This week's proceeds benefit {name}." (the apostrophe + period are part of the contract).
    - Test 7: When Sanity returns null, copy falls back to "Proceeds go to our featured charity each week."
  </behavior>
  <files>apps/web/app/shop/page.tsx</files>
  <action>
    Rewrite `apps/web/app/shop/page.tsx` entirely. Keep the metadata export shape and revalidate constant verbatim from the Phase 2 file; replace the body:

    ```typescript
    import type { Metadata } from 'next'
    import { groq } from 'next-sanity'

    import { sanityClient } from '@/lib/sanity/client'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'
    import { BuyButton } from '@/components/marketing/BuyButton'

    /**
     * ISR: charity callout refreshes within 60s of a new issue publishing.
     * (RESEARCH §Pattern 1 — match the existing Phase 2 revalidate value.)
     */
    export const revalidate = 60

    export const metadata: Metadata = {
      title: 'Shop',
      description:
        'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
      alternates: { canonical: `${getSiteUrl()}/shop` },
      openGraph: {
        type: 'website',
        title: `Shop — ${SITE_NAME}`,
        description:
          'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
        url: '/shop',
        images: ['/og-default.png'],
      },
      twitter: {
        card: 'summary_large_image',
        title: `Shop — ${SITE_NAME}`,
        description:
          'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
        images: ['/og-default.png'],
      },
    }

    /**
     * Inline projection — single consumer (this page). The same name pattern
     * was used in Phase 2 Plan 02-09; preserving the inline location avoids
     * polluting apps/web/lib/sanity/queries.ts with a one-off projection.
     */
    const QUERY_LATEST_CHARITY_NAME = groq`
      *[_type == "weeklyIssue" && status == "published"]
      | order(issueNumber desc)[0] {
        "charityName": charity->name
      }
    `

    /**
     * /shop — Server Component.
     *
     * CMR-01: server-rendered (no 'use client', no useEffect, no loading skeleton).
     * The BuyButton below is a Client Component island; it does not block the
     * server-rendered page from streaming or hydrating with the charity name
     * already in the HTML.
     */
    export default async function ShopPage() {
      let charityName: string | null = null
      try {
        const result = await sanityClient.fetch<{ charityName: string | null } | null>(
          QUERY_LATEST_CHARITY_NAME,
        )
        charityName = result?.charityName ?? null
      } catch {
        // Fall through with null — the fallback copy still renders.
        charityName = null
      }

      const charityCallout = charityName
        ? `This week's proceeds benefit ${charityName}.`
        : 'Proceeds go to our featured charity each week.'

      return (
        <section className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8 py-16">
          <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
            Shop
          </p>
          <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            Jesse A. Eisenbalm
          </h1>
          <p className="mt-1 font-display text-[22px] font-semibold text-[color:var(--color-text-muted)]">
            Lip Balm
          </p>

          <p className="mt-8 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
            {charityCallout}
          </p>

          <p className="mt-4 font-body text-[16px] leading-[1.65] text-[color:var(--color-text)]">
            One tube. Mineral-tinted, unscented, made by a small contract
            manufacturer in the Pacific Northwest. Ships flat-rate within the
            continental United States.
          </p>

          <BuyButton />
        </section>
      )
    }
    ```

    Notes:
    - Removed the "Product details coming soon" copy (Phase 2 placeholder).
    - Added a single-paragraph product description in Jesse's voice (dry, precise: "One tube. Mineral-tinted, unscented…"). Andrew can edit later; the prose IS the deliverable.
    - The `try/catch` around the Sanity fetch is defensive — a Sanity outage must not 500 the shop page. Same posture as `apps/web/app/issue/[slug]/page.tsx`.
    - Removed the disabled Button import — `BuyButton` from `@/components/marketing/BuyButton` is the only purchase trigger now.
    - The metadata export is preserved BYTE-FOR-BYTE from Phase 2 (same title, description, OG/Twitter card config).
    - `revalidate = 60` matches Phase 2 (ISR refresh within 60s of new issue publish).
    - The copy literally contains a curly apostrophe (`'`) in "This week's" — match the Phase 2 file exactly so the source-scan test for the literal string works if added later. Use a regular ASCII apostrophe.

    Voice rules (CLAUDE.md): no emoji, no exclamation mark, no urgency, no "Buy now". The button label lives in BuyButton.tsx (Plan 08-04 already locked "Buy the lip balm").
  </action>
  <verify>
    <automated>test -f apps/web/app/shop/page.tsx && grep -q "import.*BuyButton.*from '@/components/marketing/BuyButton'" apps/web/app/shop/page.tsx && grep -q "<BuyButton" apps/web/app/shop/page.tsx && grep -q "export const revalidate = 60" apps/web/app/shop/page.tsx && grep -q "export default async function ShopPage" apps/web/app/shop/page.tsx && ! head -1 apps/web/app/shop/page.tsx | grep -q "use client" && cd apps/web && npx vitest run __tests__/shop-page.test.ts 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/app/shop/page.tsx` exits 0
    - `head -1 apps/web/app/shop/page.tsx | grep -q "use client"` exits NON-zero (first line is NOT 'use client' — it's a Server Component)
    - `grep -q "import.*BuyButton.*from '@/components/marketing/BuyButton'" apps/web/app/shop/page.tsx` exits 0
    - `grep -q "<BuyButton" apps/web/app/shop/page.tsx` exits 0
    - `grep -q "export default async function ShopPage" apps/web/app/shop/page.tsx` exits 0
    - `grep -q "export const revalidate = 60" apps/web/app/shop/page.tsx` exits 0
    - `grep -q "sanityClient.fetch" apps/web/app/shop/page.tsx` exits 0
    - `grep -q "This week's proceeds benefit" apps/web/app/shop/page.tsx` exits 0 (dynamic charity copy)
    - `grep -q "Proceeds go to our featured charity each week" apps/web/app/shop/page.tsx` exits 0 (fallback copy)
    - `grep -q "Jesse A. Eisenbalm" apps/web/app/shop/page.tsx` exits 0 (heading copy)
    - NO match for `grep -q "Coming soon" apps/web/app/shop/page.tsx` (placeholder removed)
    - NO match for `grep -q "disabled" apps/web/app/shop/page.tsx` (no disabled button)
    - `pnpm --filter web typecheck` exits 0
    - `pnpm --filter web build` exits 0 (the shop route compiles in production build)
    - `cd apps/web && npx vitest run __tests__/shop-page.test.ts` exits 0 (Wave 0 test green)
    - Existing metadata export (title, description, OG, Twitter) preserved — `grep -c "openGraph" apps/web/app/shop/page.tsx` returns 1, `grep -c "twitter" apps/web/app/shop/page.tsx` returns at least 1
  </acceptance_criteria>
  <done>/shop is a real product page wired to BuyButton; Wave 0 test green; CMR-01 satisfied.</done>
</task>

</tasks>

<verification>
After Task 1 completes:
- `pnpm --filter web test:unit` shows green for shop-page test
- `pnpm --filter web build` exits 0 (production build of /shop succeeds)
- Visiting /shop in dev (manual, not required for plan close) shows the charity name in the HTML source view (server-rendered confirmation)
- CMR-09 (issue-page-shop-callout) test still passes — Phase 2 ShopCallout component is untouched, and it links to `/shop` (which now functions)
</verification>

<success_criteria>
- CMR-01 satisfied: /shop server-rendered with charity callout and no client flicker (button is the only client island)
- No regression in Phase 2 metadata behavior (OG, Twitter, canonical URL preserved)
- Server-side error path (Sanity unreachable) renders the fallback copy and still ships the BuyButton
- BuyButton is the SOLE purchase trigger (no second click target, no banner CTA)
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-06-shop-page-rewrite-SUMMARY.md` recording:
- Whether existing Phase 2 metadata was preserved verbatim (expected: yes)
- The product-description copy Andrew can revise later (lock the current placeholder for audit)
- Vitest result for __tests__/shop-page.test.ts (target: green)
- Whether `pnpm --filter web build` exits 0
- Note any deviation from RESEARCH Pattern 1 (none expected)
</output>
</content>
