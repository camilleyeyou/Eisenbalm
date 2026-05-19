---
phase: 08-stripe-commerce
plan: 07
type: execute
wave: 3
depends_on:
  - "08-01"
files_modified:
  - apps/web/app/shop/thank-you/page.tsx
  - apps/web/app/legal/privacy/page.tsx
  - apps/web/app/legal/terms/page.tsx
  - .planning/STATE.md
autonomous: true
requirements:
  - CMR-03
  - CMR-07
  - CMR-08
  - CMR-09
must_haves:
  truths:
    - "apps/web/app/shop/thank-you/page.tsx exists and renders a confirmation message"
    - "thank-you page does NOT import @sanity/client, convex, or call fetch() — verified by source-scan in apps/web/__tests__/thank-you-source.test.ts"
    - "thank-you page accepts the session_id URL param but does NOT use it for any DB lookup"
    - "thank-you page has `metadata.robots = { index: false, follow: false }` (post-purchase, not public marketing)"
    - "apps/web/app/legal/privacy/page.tsx exists, exports default async/sync function, renders without 404"
    - "apps/web/app/legal/terms/page.tsx exists, exports default async/sync function, renders without 404"
    - "Both legal pages contain placeholder copy with explicit TODO(Andrew) markers"
    - "STATE.md gains a new blocker entry: 'Legal pages have placeholder copy; Andrew must replace before public launch'"
    - "Wave 0 tests __tests__/thank-you-source.test.ts and __tests__/legal-pages.test.ts pass after this plan"
    - "Phase 2 ShopCallout component is NOT modified (CMR-09 confirmed via source-scan in __tests__/issue-page-shop-callout.test.ts — passes both before and after this plan)"
  artifacts:
    - path: "apps/web/app/shop/thank-you/page.tsx"
      provides: "Decorative post-purchase confirmation; NO DB query"
      exports: ["default", "metadata"]
    - path: "apps/web/app/legal/privacy/page.tsx"
      provides: "Privacy policy placeholder page"
      exports: ["default", "metadata"]
    - path: "apps/web/app/legal/terms/page.tsx"
      provides: "Terms of service placeholder page"
      exports: ["default", "metadata"]
    - path: ".planning/STATE.md"
      provides: "Updated Blockers section tracking legal-copy TODO"
      contains: "Legal pages"
  key_links:
    - from: "apps/web/app/shop/thank-you/page.tsx"
      to: "(none — decorative landing)"
      via: "Stripe success_url redirect with session_id URL param (NOT used by page)"
      pattern: "session_id"
    - from: ".planning/STATE.md"
      to: "apps/web/app/legal/{privacy,terms}/page.tsx"
      via: "Blocker entry marking placeholder copy"
      pattern: "Legal pages"
---

<objective>
Ship three static pages that satisfy CMR-03 (thank-you with NO DB query), CMR-07 (privacy), CMR-08 (terms), and reconfirm CMR-09 (ShopCallout source-scan still green). All three pages render with no 404 and pass their Wave 0 source-scan / render tests.

This plan deliberately produces placeholder copy for the legal pages and surfaces a STATE.md blocker — same posture as Phase 2's `/about` page (Andrew owns the actual copy). The thank-you page copy is locked in Jesse's voice per CLAUDE.md.

Purpose: Honors CMR-03 (thank-you static, no DB query — Stripe's default email handles fulfillment confirmation), CMR-07 + CMR-08 (legal pages exist with no 404). Mirrors RESEARCH §Pattern 3 (thank-you) and §Pattern 6 (legal pages). CMR-09 (ShopCallout) is re-verified — no code change, just confirm the existing Phase 2 component still satisfies its source-scan contract after Plans 08-06's shop rewrite.

Output: Three new page files; STATE.md blocker entry; four Wave 0 tests pass.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@apps/web/__tests__/thank-you-source.test.ts
@apps/web/__tests__/legal-pages.test.ts
@apps/web/__tests__/issue-page-shop-callout.test.ts
@apps/web/app/about/page.tsx
@apps/web/components/issue/ShopCallout.tsx
@apps/web/app/issue/[slug]/page.tsx

<interfaces>
<!-- Phase 2 /about page (apps/web/app/about/page.tsx) is the precedent for
     a static page with placeholder copy + a STATE.md blocker. Read it to
     match the conventions: import type Metadata; export const metadata; default
     async function with no Sanity / Convex calls.

     Wave 0 test fixtures (already created in Plan 08-01):
       __tests__/thank-you-source.test.ts:
         existsSync(THANK_YOU_PATH) === true
         source does NOT match @sanity/client | @/lib/sanity | sanityClient.fetch
         source does NOT match convex | @convex | ConvexHttpClient | convex.query|mutation
         source does NOT match \bfetch\s*\(  (no arbitrary HTTP)
         source does NOT match sessions.retrieve | stripe.checkout (no Stripe API call)

       __tests__/legal-pages.test.ts:
         existsSync(PRIVACY_PATH) === true
         existsSync(TERMS_PATH) === true
         both export default function

       __tests__/issue-page-shop-callout.test.ts (already green from Phase 2):
         issue page imports ShopCallout
         issue page renders <ShopCallout />
         ShopCallout source does NOT contain banner|modal|popup|countdown -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create apps/web/app/shop/thank-you/page.tsx (CMR-03)</name>
  <read_first>
    - apps/web/__tests__/thank-you-source.test.ts (the exact set of source-scan assertions this file must satisfy)
    - apps/web/app/about/page.tsx (Phase 2 precedent for a static page — metadata + default async function with no DB call)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 3 (verbatim thank-you shape; the session_id param read for completeness but NOT used for DB lookup)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pitfall 5 (webhook is source of truth, NOT thank-you page)
    - CLAUDE.md (Jesse voice: dry, precise, no exclamation marks, no winking)
  </read_first>
  <behavior>
    - Test 1: thank-you page file exists at apps/web/app/shop/thank-you/page.tsx.
    - Test 2: Source does NOT import from @sanity/client OR @/lib/sanity.
    - Test 3: Source does NOT import from convex OR @convex.
    - Test 4: Source does NOT call fetch(.
    - Test 5: Source does NOT contain `sessions.retrieve` OR `stripe.checkout`.
    - Test 6: Page exports a default function (renders without DB query).
    - Test 7: Page exports `metadata` with `robots: { index: false, follow: false }`.
  </behavior>
  <files>apps/web/app/shop/thank-you/page.tsx</files>
  <action>
    Create `apps/web/app/shop/thank-you/page.tsx`:

    ```typescript
    import type { Metadata } from 'next'
    import Link from 'next/link'

    /**
     * /shop/thank-you — decorative post-purchase landing.
     *
     * CMR-03: this page MUST NOT query any database. The Stripe webhook
     * at /api/stripe/webhook is the source of truth for fulfillment.
     * Stripe sends a default email receipt to the customer; this page is
     * a visual confirmation that the redirect landed where it should.
     *
     * Source-scan tripwire at apps/web/__tests__/thank-you-source.test.ts
     * fails the build if any of these forbidden imports/calls appear:
     *   - @sanity/client / @/lib/sanity / sanityClient.fetch
     *   - convex / @convex / ConvexHttpClient / convex.query|mutation
     *   - fetch(  (no arbitrary HTTP)
     *   - stripe.checkout / sessions.retrieve
     *
     * The session_id URL param is accepted (Stripe templates it into the
     * success_url) but we deliberately do NOT use it for any lookup —
     * exposing it would invite enumeration attacks.
     */

    export const metadata: Metadata = {
      title: 'Thank you',
      description: 'Order received.',
      robots: { index: false, follow: false },
    }

    interface PageProps {
      // Next.js 15: searchParams is a Promise
      searchParams: Promise<{ session_id?: string }>
    }

    export default async function ThankYouPage({ searchParams }: PageProps) {
      // We resolve the searchParams Promise to satisfy the Next.js 15 contract,
      // but we deliberately discard the value. The session_id is meaningful
      // only to Stripe; we do not look it up.
      await searchParams

      return (
        <section className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8 py-16">
          <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
            Order received
          </p>
          <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            Your lip balm is on the way.
          </h1>
          <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
            A receipt is in your inbox. 100% of proceeds from this week&apos;s
            sales go to the featured charity.
          </p>
          <p className="mt-8 font-body text-[16px] leading-[1.65]">
            <Link
              href="/"
              className="text-[color:var(--color-accent)] underline-offset-4 hover:underline"
            >
              Return to the latest issue.
            </Link>
          </p>
        </section>
      )
    }
    ```

    Voice notes:
    - Heading: "Your lip balm is on the way." Period, not exclamation. No "Yay!", no "Awesome!".
    - Body: dry confirmation. Mentions the receipt (Stripe's default email handles this — no app-side email send needed).
    - No order details surfaced: amount, items, shipping address, customer email are all in Stripe Dashboard + the receipt email. Surfacing them here invites the enumeration attack described in RESEARCH Pitfall 5.
    - Uses `&apos;` for the apostrophe in "week's" because JSX dislikes raw `'` in some lint configs (Phase 2 ShopCallout uses the same pattern — verify by grep).

    Type notes:
    - Next.js 15 `searchParams` is a `Promise<...>`. We resolve it (`await searchParams`) to satisfy the contract; the value is unused.
    - No use of `session_id` value beyond receiving it.

    File location: `apps/web/app/shop/thank-you/page.tsx` (the directory `apps/web/app/shop/thank-you/` may need to be created — Next.js App Router uses folders for routes).
  </action>
  <verify>
    <automated>test -f apps/web/app/shop/thank-you/page.tsx && grep -q "export default async function ThankYouPage" apps/web/app/shop/thank-you/page.tsx && grep -q "robots: { index: false, follow: false }\\|robots:.*index:.*false" apps/web/app/shop/thank-you/page.tsx && ! grep -q "@sanity/client\\|@/lib/sanity\\|sanityClient" apps/web/app/shop/thank-you/page.tsx && ! grep -q "convex\\|ConvexHttpClient" apps/web/app/shop/thank-you/page.tsx && ! grep -q "fetch(" apps/web/app/shop/thank-you/page.tsx && ! grep -q "sessions.retrieve\\|stripe.checkout" apps/web/app/shop/thank-you/page.tsx && cd apps/web && npx vitest run __tests__/thank-you-source.test.ts 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/app/shop/thank-you/page.tsx` exits 0
    - `grep -q "export default async function ThankYouPage" apps/web/app/shop/thank-you/page.tsx` exits 0
    - `grep -q "robots" apps/web/app/shop/thank-you/page.tsx` exits 0 (metadata has noindex/nofollow)
    - `grep -q "index: false" apps/web/app/shop/thank-you/page.tsx` exits 0
    - NO match `grep -q "@sanity/client" apps/web/app/shop/thank-you/page.tsx`
    - NO match `grep -q "@/lib/sanity" apps/web/app/shop/thank-you/page.tsx`
    - NO match `grep -q "sanityClient" apps/web/app/shop/thank-you/page.tsx`
    - NO match `grep -q "ConvexHttpClient\|@convex/" apps/web/app/shop/thank-you/page.tsx`
    - NO match `grep -qE "\\bfetch\\s*\\(" apps/web/app/shop/thank-you/page.tsx` (no fetch call)
    - NO match `grep -qE "sessions\\.retrieve|stripe\\.checkout" apps/web/app/shop/thank-you/page.tsx`
    - `grep -q "Your lip balm is on the way" apps/web/app/shop/thank-you/page.tsx` exits 0 (locked copy)
    - `grep -q "Return to the latest issue" apps/web/app/shop/thank-you/page.tsx` exits 0
    - No exclamation marks in the body copy (`grep -c "!" apps/web/app/shop/thank-you/page.tsx` — only matches if any; expect 0 in body prose)
    - `pnpm --filter web typecheck` exits 0
    - `pnpm --filter web build` exits 0 (production build of /shop/thank-you compiles)
    - `cd apps/web && npx vitest run __tests__/thank-you-source.test.ts` exits 0 (all 5 source-scan assertions pass)
  </acceptance_criteria>
  <done>Thank-you page lands; source-scan test green; CMR-03 satisfied.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create apps/web/app/legal/privacy/page.tsx + apps/web/app/legal/terms/page.tsx (CMR-07, CMR-08)</name>
  <read_first>
    - apps/web/__tests__/legal-pages.test.ts (asserts file existence + default function export)
    - apps/web/app/about/page.tsx (Phase 2 precedent — static page with metadata + Jesse-voice placeholder copy)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 6 (legal pages with TODO(Andrew) markers)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Open Question 4 (placeholder copy with explicit TODO; STATE.md blocker entry; mirrors how /about is handled)
    - .planning/STATE.md Blockers section (existing pattern for TODO entries — e.g. the /about copy blocker still open)
  </read_first>
  <behavior>
    - Test 1: privacy page file exists.
    - Test 2: terms page file exists.
    - Test 3: Both pages export a default function.
    - Test 4: Both pages have a metadata export with a title.
    - Test 5: Both pages contain the literal string `TODO(Andrew)` in a comment (so a future maintainer sees the gap).
    - Test 6: Both pages contain copy that mentions Stripe (privacy: payment processing; terms: refund/return policy reference).
  </behavior>
  <files>apps/web/app/legal/privacy/page.tsx, apps/web/app/legal/terms/page.tsx</files>
  <action>
    Create both pages. The directory `apps/web/app/legal/` may need to be created (Next.js folders are routes).

    **File 1: `apps/web/app/legal/privacy/page.tsx`**

    ```typescript
    import type { Metadata } from 'next'

    /**
     * /legal/privacy — placeholder privacy policy.
     *
     * CMR-07: the page must exist with no 404. Content is a documented
     * placeholder until Andrew commissions reviewed copy.
     *
     * TODO(Andrew): replace placeholder text with reviewed privacy copy
     * covering: data we collect (Stripe customer details, shipping address),
     * data we share (Stripe processes payments), retention period, EU/UK/CA
     * subject rights, contact email.
     */

    export const metadata: Metadata = {
      title: 'Privacy',
      description: 'Privacy practices for The Eisenbalm Dispatch.',
    }

    export default function PrivacyPage() {
      return (
        <article className="mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-16">
          <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
            Legal
          </p>
          <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            Privacy
          </h1>

          <div className="mt-8 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)] space-y-6">
            <p>
              The Eisenbalm Dispatch collects the minimum data needed to ship lip
              balm and to acknowledge receipt of payment. We use Stripe to process
              payments; Stripe receives the data necessary to complete the
              transaction, including your name, email, billing address, shipping
              address, and payment details.
            </p>
            <p>
              We do not maintain marketing email lists. We do not sell or share
              your information with third parties beyond Stripe and the postal
              carrier required to deliver your order.
            </p>
            <p>
              For questions about your data, contact{' '}
              <a
                href="mailto:hello@eisenbalm.com"
                className="text-[color:var(--color-accent)] underline-offset-4 hover:underline"
              >
                hello@eisenbalm.com
              </a>
              .
            </p>
            <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
              Last updated: placeholder pending Andrew&apos;s review.
            </p>
          </div>
        </article>
      )
    }
    ```

    **File 2: `apps/web/app/legal/terms/page.tsx`**

    ```typescript
    import type { Metadata } from 'next'

    /**
     * /legal/terms — placeholder terms of service.
     *
     * CMR-08: the page must exist with no 404. Content is a documented
     * placeholder until Andrew commissions reviewed copy.
     *
     * TODO(Andrew): replace placeholder text with reviewed terms covering:
     * refund/return policy, shipping policy, intellectual property notice,
     * limitation of liability, governing law, contact email.
     */

    export const metadata: Metadata = {
      title: 'Terms',
      description: 'Terms of service for The Eisenbalm Dispatch.',
    }

    export default function TermsPage() {
      return (
        <article className="mx-auto max-w-[720px] px-4 md:px-6 lg:px-8 py-16">
          <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
            Legal
          </p>
          <h1 className="mt-3 font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            Terms
          </h1>

          <div className="mt-8 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)] space-y-6">
            <p>
              The Eisenbalm Dispatch is operated by Jesse A. Eisenbalm (the
              proprietor) and offers a single product: a tube of lip balm.
              100% of net proceeds from each weekly sale benefit the featured
              charity for that week.
            </p>
            <p>
              Payments are processed by Stripe and are subject to Stripe&apos;s
              terms. Refunds for damaged or missing items may be requested by
              emailing{' '}
              <a
                href="mailto:hello@eisenbalm.com"
                className="text-[color:var(--color-accent)] underline-offset-4 hover:underline"
              >
                hello@eisenbalm.com
              </a>{' '}
              within 30 days of delivery.
            </p>
            <p>
              Editorial content on this site is intended for general interest.
              It does not constitute professional advice and should not be relied
              upon for legal, medical, or financial decisions.
            </p>
            <p className="font-ui text-[14px] text-[color:var(--color-text-muted)]">
              Last updated: placeholder pending Andrew&apos;s review.
            </p>
          </div>
        </article>
      )
    }
    ```

    Notes for both:
    - The `TODO(Andrew)` marker is in the JSDoc, NOT in the rendered HTML. A reader sees the placeholder copy; a future engineer reading the file sees the TODO.
    - The "Last updated: placeholder pending Andrew's review" text IS visible to readers — this is the user-visible signal that the copy is provisional. Mirrors the practice from Phase 2's `/about` page.
    - Both pages reference the same `hello@eisenbalm.com` mailto. If Andrew has a different contact email, that's a TODO too (note in SUMMARY).
    - No `'use client'` — these are Server Components with no interactivity.
    - No Stripe SDK import; no Convex import; no Sanity import. Pure static pages.
    - Style classes match the Phase 2 typography conventions (font-display, font-body, color tokens). The visual language is established; we use it.
  </action>
  <verify>
    <automated>test -f apps/web/app/legal/privacy/page.tsx && test -f apps/web/app/legal/terms/page.tsx && grep -q "export default function PrivacyPage" apps/web/app/legal/privacy/page.tsx && grep -q "export default function TermsPage" apps/web/app/legal/terms/page.tsx && grep -q "TODO(Andrew)" apps/web/app/legal/privacy/page.tsx && grep -q "TODO(Andrew)" apps/web/app/legal/terms/page.tsx && grep -q "Stripe" apps/web/app/legal/privacy/page.tsx && grep -q "Stripe" apps/web/app/legal/terms/page.tsx && cd apps/web && npx vitest run __tests__/legal-pages.test.ts __tests__/issue-page-shop-callout.test.ts 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/app/legal/privacy/page.tsx` exits 0
    - `test -f apps/web/app/legal/terms/page.tsx` exits 0
    - `grep -q "export default function PrivacyPage" apps/web/app/legal/privacy/page.tsx` exits 0
    - `grep -q "export default function TermsPage" apps/web/app/legal/terms/page.tsx` exits 0
    - `grep -q "TODO(Andrew)" apps/web/app/legal/privacy/page.tsx` exits 0
    - `grep -q "TODO(Andrew)" apps/web/app/legal/terms/page.tsx` exits 0
    - `grep -q "Stripe" apps/web/app/legal/privacy/page.tsx` exits 0 (payment processor mentioned)
    - `grep -q "Stripe" apps/web/app/legal/terms/page.tsx` exits 0 (payments + refund context)
    - `grep -q "export const metadata" apps/web/app/legal/privacy/page.tsx` exits 0
    - `grep -q "export const metadata" apps/web/app/legal/terms/page.tsx` exits 0
    - NO `'use client'` directive at the top of either file
    - `pnpm --filter web typecheck` exits 0
    - `pnpm --filter web build` exits 0 (both legal routes compile)
    - `cd apps/web && npx vitest run __tests__/legal-pages.test.ts` exits 0 (4 assertions pass)
    - `cd apps/web && npx vitest run __tests__/issue-page-shop-callout.test.ts` exits 0 (Phase 2 ShopCallout component still satisfies CMR-09 source-scan — this plan did not touch it)
  </acceptance_criteria>
  <done>Two legal pages render with no 404; TODO(Andrew) markers documented; CMR-07 + CMR-08 satisfied; CMR-09 re-confirmed.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add legal-copy blocker entry to .planning/STATE.md</name>
  <read_first>
    - .planning/STATE.md (current Blockers/Concerns section — see the open entry for "/about page copy not specified in brief; Andrew must provide before Phase 2 closes" as precedent)
  </read_first>
  <files>.planning/STATE.md</files>
  <action>
    Edit `.planning/STATE.md` Blockers/Concerns section to append a new entry. Find the existing list of blockers under `### Blockers/Concerns` (immediately after `### Pending Todos`). Append (do NOT remove existing entries):

    ```markdown
    - [Phase 8] Legal pages at `apps/web/app/legal/privacy/page.tsx` and `apps/web/app/legal/terms/page.tsx` contain TODO(Andrew) placeholder copy. The pages exist with no 404 (CMR-07 + CMR-08 satisfied for code-completeness), but the prose has not been reviewed by counsel. Andrew must replace with reviewed copy covering: (privacy) data collected/shared/retained, EU/UK/CA subject rights, contact email; (terms) refund/return policy, IP notice, limitation of liability, governing law. Tracked at `.planning/phases/08-stripe-commerce/08-07-thank-you-and-legal-pages-SUMMARY.md`.
    ```

    Same posture as the existing `/about` blocker — Andrew is the source of truth for the actual copy; this plan ships placeholders that satisfy "no 404" only.

    Do NOT modify any other section of STATE.md. Specifically, do NOT touch:
    - Front matter (the YAML at the top)
    - Performance Metrics
    - Accumulated Context > Decisions
    - The Phase 6 Stripe Dashboard blocker (Plan 08-02 owns that resolution)
    - Phase 5 First-Real-Run Cost Baseline
    - Session Continuity

    Only append the one new bullet to Blockers/Concerns.
  </action>
  <verify>
    <automated>grep -q "Phase 8.*Legal pages" .planning/STATE.md && grep -c "TODO(Andrew)" .planning/STATE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "\\[Phase 8\\] Legal pages" .planning/STATE.md` exits 0
    - `grep -q "TODO(Andrew)" .planning/STATE.md` exits 0
    - `grep -q "legal/privacy" .planning/STATE.md` exits 0
    - `grep -q "legal/terms" .planning/STATE.md` exits 0
    - The existing `/about` blocker entry is still present: `grep -q "\\[Phase 2\\] .about. page copy" .planning/STATE.md` exits 0
    - The existing Phase 6 Stripe Dashboard blocker is still present: `grep -q "\\[Phase 6\\].*Stripe" .planning/STATE.md` exits 0
    - No fields in the YAML front matter changed: `head -15 .planning/STATE.md` shows the same gsd_state_version, milestone, status block (only milestone fields are allowed to change via gsd-tools, not via this plan)
  </acceptance_criteria>
  <done>Legal-copy gap is tracked in STATE.md; Andrew sees it on next session resume.</done>
</task>

</tasks>

<verification>
After all three tasks complete:
- `pnpm --filter web test:unit` shows green for: thank-you-source, legal-pages, issue-page-shop-callout
- `pnpm --filter web build` exits 0 (all three new routes compile)
- STATE.md has a new blocker entry tracking the legal-copy gap
- Phase 2 ShopCallout component remains untouched — CMR-09 still green from inheritance
</verification>

<success_criteria>
- CMR-03 satisfied: /shop/thank-you exists, source-scan confirms no DB query
- CMR-07 satisfied: /legal/privacy exists with metadata; placeholder copy ships
- CMR-08 satisfied: /legal/terms exists with metadata; placeholder copy ships
- CMR-09 re-confirmed: Phase 2 ShopCallout is in place; source-scan green
- Andrew has a clear path to replace legal copy via the STATE.md blocker
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-07-thank-you-and-legal-pages-SUMMARY.md` recording:
- 3 page files created (thank-you, privacy, terms) + directory structure created
- Wave 0 test results (4 tests target green: thank-you-source, legal-pages, issue-page-shop-callout, plus shop-page from Plan 08-06)
- Build pass confirmation (`pnpm --filter web build` exits 0)
- The placeholder contact email (`hello@eisenbalm.com`) — flag for Andrew if it differs from his actual contact
- STATE.md blocker line range that was edited
- Confirmation that the existing /about Phase 2 blocker is still in place (not accidentally clobbered)
</output>
</content>
