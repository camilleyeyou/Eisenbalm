import type { Metadata } from 'next'
import Image from 'next/image'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'
import { SITE_NAME, getSiteUrl, BALM_PRICE_CENTS, formatUsd } from '@/lib/site'
import { BuyButton } from '@/components/marketing/BuyButton'
import { ShopQtyProvider, QtyStepper } from '@/components/marketing/ShopQtyProvider'
import { ShopStickyBar } from '@/components/marketing/ShopStickyBar'
import { ShopMotion } from '@/components/marketing/ShopMotion'

import '@/components/dispatch/shop.css'

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
 * Inline projection — single consumer (this page).
 * Preserving the inline location avoids polluting apps/web/lib/sanity/queries.ts
 * with a one-off projection.
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
 * Quick 261018-20a: renders inside the Dispatch design system (.dispatch
 * .d-shop, components/dispatch/shop.css) under the shared Dispatch top bar and
 * footer. The "Stop. Breathe. Balm." tagline and all copy are retained verbatim.
 *
 * CMR-01: server-rendered (no top-level 'use client', no useEffect).
 * BuyButton, QtyStepper, ShopStickyBar, ShopMotion are Client Component islands;
 * they do not block the server-rendered page from streaming with charity name
 * already in the HTML.
 *
 * Error path: a Sanity outage must not 500 the shop page. The try/catch
 * falls through with null and renders fallback copy + BuyButton.
 *
 * Phase 8 Stripe machinery byte-unchanged (only quantity wiring added):
 * - BuyButton now POSTs { quantity } JSON body
 * - /api/checkout/create-session reads + validates quantity from body
 * - /api/stripe/webhook/route.ts — unchanged
 * - /shop/thank-you/page.tsx — unchanged
 * - /legal/privacy/page.tsx, /legal/terms/page.tsx — unchanged
 * - components/issue/ShopCallout.tsx — unchanged
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
    <div className="dispatch d-page d-shop">
      {/*
        ShopQtyProvider wraps the interactive subtree so the stepper,
        both BuyButtons, and the sticky bar all share the same quantity state.
        ShopMotion + ShopStickyBar are rendered inside the provider.
      */}
      <ShopQtyProvider>

        {/* ── Scroll-reveal observer (client island, renders nothing) ──── */}
        <ShopMotion />

        {/* ── Sticky buy bar (fixed, appears after hero scrolls past) ──── */}
        <ShopStickyBar charityName={charityName} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 1: Hero (tube left / buy panel right)
            id="shop-hero" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-hero" className="d-shop-hero">
          <div className="d-container d-shop-hero-grid">

            {/* ── Left: product image + edition stamp ───────────────────── */}
            <div className="d-shop-art">
              <div className="d-shop-tube rv">
                <Image
                  src="/product/tube-cutout.png"
                  alt="Jesse A. Eisenbalm lip balm — Release 001, single tube"
                  width={1546}
                  height={1685}
                  priority
                  sizes="(min-width: 1024px) 260px, 200px"
                />
              </div>

              <div className="d-shop-stamp rv">
                {/* TODO(Andrew): confirm hand-numbering process and edition count before launch */}
                Release 001 &middot; Hand-numbered
              </div>
            </div>

            {/* ── Right: buy panel ───────────────────────────────────────── */}
            <div className="d-shop-copy">
              <p className="d-eyebrow rv">Jesse A. Eisenbalm</p>

              <h1 className="d-display rv">
                The Lip Balm.
              </h1>

              {/*
                "Stop. Breathe. Balm." — required verbatim by shop-page.test.ts
                Do not alter this string; it is the locked sub-brand tagline.
              */}
              <p className="d-heading d-shop-tagline rv">
                Stop. Breathe. Balm.
              </p>

              <p className="d-body d-shop-intro rv">
                A human-only ritual for an AI-everywhere world. Beeswax base.
                Petrolatum-free. One application. Lasting effect.
              </p>

              {/* TODO(Andrew): confirm final price before launch */}
              <p className="d-heading d-shop-price rv">{formatUsd(BALM_PRICE_CENTS)}</p>

              {/* Quantity stepper + running total */}
              <div className="d-shop-gap rv">
                <QtyStepper />
              </div>

              {/* BuyButton — instance 1 of ≥2 (required by shop-page.test.ts) */}
              <div className="d-shop-gap rv">
                <BuyButton />
              </div>

              {/* Trust bullets */}
              <ul className="d-shop-trust rv" aria-label="Product trust indicators">
                <li>
                  <span className="d-dot d-dot--blue" aria-hidden="true" />
                  {charityName
                    ? `100% of proceeds → ${charityName}`
                    : "100% of proceeds go to this week's charity"}
                </li>
                <li>
                  <span className="d-dot d-dot--blue" aria-hidden="true" />
                  Ships flat-rate, continental US
                </li>
                <li>
                  <span className="d-dot d-dot--blue" aria-hidden="true" />
                  Release 001 · hand-numbered
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            The Ritual — dark full-bleed breathing band
            ════════════════════════════════════════════════════════════════ */}
        <div className="d-shop-ritual d-on-dark">
          <div className="d-container">
            <div className="d-shop-breathe rv" aria-hidden="true" />
            <p className="d-eyebrow d-shop-inout rv" aria-hidden="true">
              <span>Inhale</span>
              <span> · </span>
              <span>Exhale</span>
            </p>
            <h2 className="d-display rv">
              One product. One moment. Yours.
            </h2>
            <p className="d-body d-shop-ritual-body rv">
              A balm designed for the pause between tasks. Applied deliberately.
              The opposite of a distraction.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 2: The Formula — What&apos;s in / What isn&apos;t
            id="shop-features" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-features" className="d-shop-formula">
          <div className="d-container">
            <p className="d-eyebrow rv">
              The Formula.
            </p>

            {/* TODO(Andrew): verify ingredient list against manufacturer spec sheet before launch */}
            <div className="d-shop-cols">
              <div className="d-shop-col rv">
                <p className="d-eyebrow">
                  What&apos;s in it
                </p>
                <ul className="d-shop-list">
                  <li><span className="d-dot d-dot--green" aria-hidden="true" /><span>Beeswax</span></li>
                  <li><span className="d-dot d-dot--green" aria-hidden="true" /><span>Shea butter</span></li>
                  <li><span className="d-dot d-dot--green" aria-hidden="true" /><span>Vitamin E (tocopherol)</span></li>
                  <li><span className="d-dot d-dot--green" aria-hidden="true" /><span>Natural flavor</span></li>
                </ul>
              </div>
              <div className="d-shop-col d-shop-col--out rv">
                <p className="d-eyebrow">
                  What isn&apos;t
                </p>
                <ul className="d-shop-list">
                  <li><span className="d-dot d-dot--red" aria-hidden="true" /><span>Petrolatum</span></li>
                  <li><span className="d-dot d-dot--red" aria-hidden="true" /><span>Parabens</span></li>
                  <li><span className="d-dot d-dot--red" aria-hidden="true" /><span>Synthetic fragrance</span></li>
                  <li><span className="d-dot d-dot--red" aria-hidden="true" /><span>Mineral oil</span></li>
                  <li><span className="d-dot d-dot--red" aria-hidden="true" /><span>Dimethicone</span></li>
                </ul>
              </div>
            </div>

            <p className="d-body d-shop-close rv">
              The goal was a formula a professional would use, not one a
              marketing department would describe. Transepidermal water loss
              addressed at the source. One application. Lasting effect.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            The Edition — big 001 numeral on a yellow band
            ════════════════════════════════════════════════════════════════ */}
        <div className="d-shop-edition">
          <div className="d-container">
            {/* TODO(Andrew): confirm edition number before launch */}
            <span className="d-shop-numeral rv" aria-hidden="true">001</span>
            <p className="d-heading rv">Release 001</p>
            <p className="d-body d-shop-edition-desc rv">
              The first edition. Hand-numbered at the manufacturing step.
              A marker of where this product began.
            </p>
            <div className="d-shop-frame rv">
              <Image
                src="/product/tubes-trio.jpg"
                alt="Jesse A. Eisenbalm lip balm — two tubes and cap"
                width={2000}
                height={1600}
                sizes="(min-width: 768px) 720px, 100vw"
              />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 3: The Cause — full-bleed blue close
            id="shop-buy" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-buy" className="d-shop-cause d-on-dark">
          <div className="d-container">
            <p className="d-eyebrow rv">This week.</p>
            <h2 className="d-display rv">
              {charityName
                ? `${formatUsd(BALM_PRICE_CENTS)} → ${charityName}.`
                : `${formatUsd(BALM_PRICE_CENTS)} → this week's charity.`}
            </h2>
            <p className="d-body d-shop-cause-body rv">
              One product. One weekly charity. One hundred percent of proceeds.
              No overhead. No administrative cut. The full amount transfers.
            </p>

            {/* BuyButton — instance 2 of ≥2 (required by shop-page.test.ts) */}
            <div className="rv">
              <BuyButton tone="paper" />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 4: FAQ — native details/summary, zero-JS accordion
            id="shop-faq" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-faq" className="d-shop-faq">
          <div className="d-container">
            <div className="d-shop-faq-inner">
              <p className="d-heading rv">Questions.</p>

              <details className="rv">
                <summary>
                  What is Jesse A. Eisenbalm?
                  <span className="d-shop-chevron" aria-hidden="true">↓</span>
                </summary>
                <div className="d-shop-faq-body">
                  A lip balm. Professional-grade, beeswax-based, petrolatum-free.
                  Made for people who take their skin barrier seriously.
                </div>
              </details>

              <details className="rv">
                <summary>
                  Where does the money go?
                  <span className="d-shop-chevron" aria-hidden="true">↓</span>
                </summary>
                <div className="d-shop-faq-body">
                  One hundred percent of proceeds from every sale go directly to the
                  week&apos;s featured charity on The Eisenbalm Dispatch. No overhead.
                  No administrative percentage. The full amount transfers.
                </div>
              </details>

              <details className="rv">
                <summary>
                  What is Release 001?
                  <span className="d-shop-chevron" aria-hidden="true">↓</span>
                </summary>
                <div className="d-shop-faq-body">
                  {/* TODO(Andrew): confirm hand-numbering process description before launch */}
                  The first edition of Jesse A. Eisenbalm lip balm. Each tube is
                  hand-numbered at the manufacturing step. Release 001 is a
                  designation — a marker of where this product began.
                </div>
              </details>

              <details className="rv">
                <summary>
                  What does petrolatum-free mean?
                  <span className="d-shop-chevron" aria-hidden="true">↓</span>
                </summary>
                <div className="d-shop-faq-body">
                  Petrolatum (petroleum jelly) creates an occlusive surface
                  barrier — it seals in existing moisture but does not add
                  moisture or support the skin&apos;s own function. The Jesse A.
                  Eisenbalm formula uses beeswax and shea butter instead, which
                  provide protection while allowing the skin barrier to function
                  normally.
                </div>
              </details>

              <details className="rv">
                <summary>
                  What is the shipping policy?
                  <span className="d-shop-chevron" aria-hidden="true">↓</span>
                </summary>
                <div className="d-shop-faq-body">
                  {/* TODO(Andrew): add shipping rates, carrier, and estimated delivery window before launch */}
                  Ships flat-rate within the continental United States.
                </div>
              </details>

              <details className="rv">
                <summary>
                  How do I contact you?
                  <span className="d-shop-chevron" aria-hidden="true">↓</span>
                </summary>
                <div className="d-shop-faq-body">
                  {/* TODO(Andrew): insert contact email address before launch */}
                  Email forthcoming.
                </div>
              </details>
            </div>
          </div>
        </section>

      </ShopQtyProvider>
    </div>
  )
}
