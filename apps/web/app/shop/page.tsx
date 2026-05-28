import type { Metadata } from 'next'
import { groq } from 'next-sanity'
import { ChevronDown } from 'lucide-react'

import { sanityClient } from '@/lib/sanity/client'
import { SITE_NAME, getSiteUrl } from '@/lib/site'
import { BuyButton } from '@/components/marketing/BuyButton'

/**
 * ISR: charity callout refreshes within 60s of a new issue publishing.
 * Preserves the Phase 2 revalidate value verbatim.
 */
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
  twitter: {
    card: 'summary_large_image',
    title: `Shop — ${SITE_NAME}`,
    description: 'Jesse A. Eisenbalm lip balm. 100% of proceeds go to the featured charity.',
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
 * Phase 15: 8-section long-scroll product page in the lip-balm sub-brand
 * "Stop. Breathe. Balm." voice register.
 *
 * CMR-01: server-rendered (no 'use client', no useEffect, no loading skeleton).
 * The BuyButton instances below are Client Component islands; they do not block
 * the server-rendered page from streaming with charity name already in the HTML.
 *
 * Error path: a Sanity outage must not 500 the shop page. The try/catch
 * falls through with null and renders the fallback copy + BuyButton.
 *
 * Phase 8 Stripe machinery byte-unchanged:
 * - BuyButton.tsx (no props passed; spacing via wrapper <div> only)
 * - /api/checkout/create-session/route.ts
 * - /api/stripe/webhook/route.ts
 * - /shop/thank-you/page.tsx
 * - /legal/privacy/page.tsx, /legal/terms/page.tsx
 * - components/issue/ShopCallout.tsx
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

  return (
    <>
      {/* ─── Section 1: #shop-hero ─────────────────────────────────────────── */}
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

      {/* ─── Section 2: #shop-positioning ──────────────────────────────────── */}
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

      {/* ─── Section 3: #shop-features ─────────────────────────────────────── */}
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

      {/* ─── Section 4: #shop-ingredient-story ─────────────────────────────── */}
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

      {/* ─── Section 5: #shop-charity ──────────────────────────────────────── */}
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

      {/* ─── Section 6: #shop-buy ──────────────────────────────────────────── */}
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

      {/* ─── Section 7: #shop-faq ──────────────────────────────────────────── */}
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

      {/* ─── Section 8: #shop-footer-cta ───────────────────────────────────── */}
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
    </>
  )
}
