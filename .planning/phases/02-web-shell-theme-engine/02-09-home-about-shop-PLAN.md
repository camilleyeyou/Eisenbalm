---
phase: 02-web-shell-theme-engine
plan: 09
type: execute
wave: 3
depends_on: ["02-01", "02-02", "02-05"]
files_modified:
  - apps/web/app/page.tsx
  - apps/web/app/about/page.tsx
  - apps/web/app/shop/page.tsx
autonomous: true
requirements: [WEB-01, WEB-05, WEB-11]
must_haves:
  truths:
    - "/ redirects to /issue/{latestSlug} when a published issue exists; otherwise renders the empty-state page"
    - "/about renders a static page with the locked placeholder copy (Andrew supplies real copy later — blocker noted in STATE.md)"
    - "/shop renders a static shell with charity-of-the-week callout, 'Coming soon' button (no Stripe in Phase 2)"
    - "All three pages emit OG + Twitter metadata"
    - "Empty-state copy on / matches UI-SPEC Copywriting Contract verbatim"
  artifacts:
    - path: apps/web/app/page.tsx
      provides: "Server component: QUERY_LATEST_ISSUE_SLUG → redirect or empty state"
    - path: apps/web/app/about/page.tsx
      provides: "Static about page with placeholder copy"
    - path: apps/web/app/shop/page.tsx
      provides: "Static shop shell: charity callout from latest issue + disabled 'Coming soon' button"
  key_links:
    - from: apps/web/app/page.tsx
      to: apps/web/lib/sanity/queries.ts (QUERY_LATEST_ISSUE_SLUG)
      via: "sanityClient.fetch + redirect"
      pattern: "QUERY_LATEST_ISSUE_SLUG"
    - from: apps/web/app/shop/page.tsx
      to: apps/web/lib/sanity/queries.ts (charity callout fetch)
      via: "GROQ fetch for latest issue's charity name"
      pattern: "weeklyIssue.*status.*published"
---

<objective>
Land the three remaining static-ish routes: homepage redirect, about page placeholder, and shop shell. Together with the existing Wave 3 plans these complete WEB-01 (`/` redirect) and WEB-05 (`/about`) plus the Phase 2 shop shell (Phase 8 wires Stripe later).

Purpose: Ensures every URL listed in CONTEXT.md D-20 resolves without 404. Andrew can click through every nav link by end of Wave 3.
Output: Three small route files. No new shared components (header/footer + chrome inherited from Wave 2).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@CLAUDE.md
@apps/web/lib/sanity/client.ts
@apps/web/lib/sanity/queries.ts
@apps/web/lib/sanity/types.ts
@apps/web/lib/site.ts

<interfaces>
<!-- LOCKED copy strings (UI-SPEC Copywriting Contract): -->
- Empty state — no issues:        "The first issue is being prepared. Check back Thursday."
- About placeholder:               "The Eisenbalm Dispatch publishes weekly. This page is being written."
- Shop product name:               "Jesse A. Eisenbalm"
- Shop sub-label:                  "Lip Balm"
- Shop charity callout (issue):    "This week's proceeds benefit {charity.name}."
- Shop charity callout (no issue): "Proceeds go to our featured charity each week."
- Shop description placeholder:    "Product details coming soon."
- Shop button (Phase 2):           "Coming soon"

<!-- UI-SPEC §"/" Homepage: -->
- redirect(/issue/{latestSlug}) when QUERY_LATEST_ISSUE_SLUG returns non-null
- Otherwise: empty-state page with title + body, SiteHeader + SiteFooter (from root layout)

<!-- UI-SPEC §"/about" — static, no Sanity dep; copy hardcoded -->
<!-- UI-SPEC §"/shop" — static shell; Phase 8 replaces this implementation -->

<!-- Shop charity callout: needs charity name. Plan adds a small GROQ query
     inline rather than extending lib/sanity/queries.ts (this is the only
     consumer of "latest issue charity name only" and Phase 8 will replace
     the entire shop page). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: apps/web/app/page.tsx — homepage (redirect or empty state)</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"/" Homepage
    - apps/web/lib/sanity/queries.ts (QUERY_LATEST_ISSUE_SLUG)
    - .planning/phases/02-web-shell-theme-engine/02-05-root-layout-globals-SUMMARY.md (if a stub app/page.tsx was created; this task overwrites)
  </read_first>
  <files>apps/web/app/page.tsx</files>
  <action>
    Overwrite (or create) `apps/web/app/page.tsx`. If Plan 02-05 Task 7 created a `HomePlaceholder` stub, replace it.

    ```typescript
    import type { Metadata } from 'next'
    import { redirect } from 'next/navigation'
    import { sanityClient } from '@/lib/sanity/client'
    import { QUERY_LATEST_ISSUE_SLUG } from '@/lib/sanity/queries'
    import type { LatestIssueSlug } from '@/lib/sanity/types'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'

    export const revalidate = 60

    export const metadata: Metadata = {
      title: SITE_NAME,
      description: 'A weekly editorial on one obscure charity. One product. 100% donated.',
      alternates: { canonical: getSiteUrl() },
    }

    export default async function HomePage() {
      const latest = await sanityClient.fetch<LatestIssueSlug>(QUERY_LATEST_ISSUE_SLUG)

      if (latest?.slug) {
        redirect(`/issue/${latest.slug}`)
      }

      // Empty state: no published issues yet.
      return (
        <section className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
          <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            The Eisenbalm Dispatch
          </h1>
          <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
            The first issue is being prepared. Check back Thursday.
          </p>
        </section>
      )
    }
    ```

    NOTES:
    - `redirect()` from `next/navigation` issues a 307 in dev / production (Next 15 default for server components).
    - When the demo seed (Plan 02-04) has run, `/` redirects to `/issue/issue-1`.
    - When the seed hasn't run (empty production dataset OR fresh local dev without seed), the empty state renders.
    - No countdown, no email capture (UI-SPEC anti-features).
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/page.tsx && \
      grep -q "QUERY_LATEST_ISSUE_SLUG" apps/web/app/page.tsx && \
      grep -q "redirect" apps/web/app/page.tsx && \
      grep -q "The first issue is being prepared. Check back Thursday\." apps/web/app/page.tsx && \
      ! grep -q "countdown" apps/web/app/page.tsx && \
      ! grep -q "subscribe" apps/web/app/page.tsx && \
      ! grep -q "newsletter" apps/web/app/page.tsx
    </automated>
  </verify>
  <done>
    `/` either redirects to the latest issue (with the demo seed in place, that's `/issue/issue-1`) or renders the Jesse-voice empty-state. No countdown/email/newsletter elements present.
  </done>
</task>

<task type="auto">
  <name>Task 2: apps/web/app/about/page.tsx — static About with placeholder copy</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §14 AboutPage
    - .planning/STATE.md (blocker: "/about page copy not specified in brief; Andrew must provide")
  </read_first>
  <files>apps/web/app/about/page.tsx</files>
  <action>
    Create `apps/web/app/about/page.tsx`:

    ```typescript
    import type { Metadata } from 'next'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'

    export const metadata: Metadata = {
      title: 'About',
      description: 'Jesse A. Eisenbalm. One charity per week. One product.',
      alternates: { canonical: `${getSiteUrl()}/about` },
      openGraph: {
        type: 'website',
        title: `About — ${SITE_NAME}`,
        description: 'Jesse A. Eisenbalm. One charity per week. One product.',
        url: '/about',
        images: ['/og-default.png'],
      },
    }

    export default function AboutPage() {
      return (
        <article className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
          <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-[1.15] text-[color:var(--color-text)]">
            About
          </h1>
          <p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
            The Eisenbalm Dispatch publishes weekly. This page is being written.
          </p>
        </article>
      )
    }
    ```

    The placeholder copy is locked by UI-SPEC. Andrew supplies real copy before Phase 2 closes (per STATE.md blocker). When that arrives, the developer who lands it can either inline it here or extract to an MDX file — UI-SPEC §14 leaves both options open.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/about/page.tsx && \
      grep -q "The Eisenbalm Dispatch publishes weekly. This page is being written\." apps/web/app/about/page.tsx && \
      grep -q "'About'" apps/web/app/about/page.tsx && \
      grep -q "metadata" apps/web/app/about/page.tsx
    </automated>
  </verify>
  <done>
    `/about` resolves and renders the locked placeholder copy. Metadata includes canonical URL + OG defaults.
  </done>
</task>

<task type="auto">
  <name>Task 3: apps/web/app/shop/page.tsx — Phase 2 shell with charity callout</name>
  <read_first>
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §15 ShopShell + §"/shop"
    - apps/web/lib/sanity/queries.ts (QUERY_LATEST_ISSUE_SLUG — used as a base for fetching latest charity name)
  </read_first>
  <files>apps/web/app/shop/page.tsx</files>
  <action>
    Create `apps/web/app/shop/page.tsx`. Inline a tiny GROQ query for the latest issue's charity name — the only place that needs this projection, and Phase 8 will rewrite this page anyway, so it doesn't deserve a slot in `lib/sanity/queries.ts`.

    ```typescript
    import type { Metadata } from 'next'
    import { groq } from 'next-sanity'
    import { sanityClient } from '@/lib/sanity/client'
    import { SITE_NAME, getSiteUrl } from '@/lib/site'

    export const revalidate = 60

    export const metadata: Metadata = {
      title: 'Shop',
      description: 'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
      alternates: { canonical: `${getSiteUrl()}/shop` },
      openGraph: {
        type: 'website',
        title: `Shop — ${SITE_NAME}`,
        description: 'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
        url: '/shop',
        images: ['/og-default.png'],
      },
    }

    /**
     * Phase 2 only needs the latest issue's charity name for the callout.
     * Phase 8 rewrites this page with the real product flow + Stripe Checkout.
     */
    const QUERY_LATEST_CHARITY_NAME = groq`
      *[_type == "weeklyIssue" && status == "published"]
      | order(issueNumber desc)[0] {
        "charityName": charity->name
      }
    `

    export default async function ShopPage() {
      const result = await sanityClient.fetch<{ charityName: string | null } | null>(
        QUERY_LATEST_CHARITY_NAME,
      )
      const charityCallout = result?.charityName
        ? `This week's proceeds benefit ${result.charityName}.`
        : 'Proceeds go to our featured charity each week.'

      return (
        <section className="mx-auto max-w-[860px] px-4 md:px-6 lg:px-8 py-16">
          <p className="font-ui text-[14px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
            SHOP
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
          <p className="mt-4 font-ui text-[14px] text-[color:var(--color-text-muted)]">
            Product details coming soon.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-8 inline-flex h-11 cursor-not-allowed items-center justify-center rounded bg-[color:var(--color-text-muted)] px-6 font-ui text-[14px] font-semibold text-[color:var(--color-bg)] opacity-60"
          >
            Coming soon
          </button>
        </section>
      )
    }
    ```

    Notes:
    - Disabled button uses a plain `<button>` — no shadcn primitive added here. Phase 8 introduces the real button + Stripe Checkout flow.
    - The page doesn't render `<ShopCallout>` (that's per-issue chrome at the bottom of `/issue/[slug]`). `/shop` IS the product page.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/app/shop/page.tsx && \
      grep -q "Jesse A. Eisenbalm" apps/web/app/shop/page.tsx && \
      grep -q "Lip Balm" apps/web/app/shop/page.tsx && \
      grep -q "This week's proceeds benefit" apps/web/app/shop/page.tsx && \
      grep -q "Proceeds go to our featured charity each week\." apps/web/app/shop/page.tsx && \
      grep -q "Product details coming soon\." apps/web/app/shop/page.tsx && \
      grep -q "Coming soon" apps/web/app/shop/page.tsx && \
      grep -q "disabled" apps/web/app/shop/page.tsx && \
      pnpm --filter web typecheck 2>&1 | tail -3 && \
      pnpm --filter web build 2>&1 | tail -10
    </automated>
  </verify>
  <done>
    `/shop` resolves with the locked Phase 2 shell. Charity callout pulls from latest published issue. Button is visibly disabled. typecheck + build succeed.
  </done>
</task>

</tasks>

<verification>
- / redirects to /issue/issue-1 when demo seed is in place (or renders empty state otherwise)
- /about renders with locked placeholder copy
- /shop renders product shell with dynamic charity callout
- All three carry canonical URLs and OG metadata
- typecheck + build pass
</verification>

<success_criteria>
- WEB-01: / redirects to latest issue or shows graceful empty state
- WEB-05: /about resolves with metadata + placeholder copy
- Phase 2 shop shell satisfies UI-SPEC §15 ShopShell without Stripe wiring
- All UI-SPEC copy strings present verbatim (no exclamation marks, no winking)
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-09-home-about-shop-SUMMARY.md` recording: redirect behavior, empty-state path, the inline shop GROQ projection name (`charityName`), and a reminder that Phase 8 rewrites `app/shop/page.tsx`.
</output>
