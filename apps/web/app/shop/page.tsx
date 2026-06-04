import type { Metadata } from 'next'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'
import { SITE_NAME, getSiteUrl } from '@/lib/site'
import { BuyButton } from '@/components/marketing/BuyButton'
import { ShopQtyProvider, QtyStepper } from '@/components/marketing/ShopQtyProvider'
import { ShopStickyBar } from '@/components/marketing/ShopStickyBar'
import { ShopMotion } from '@/components/marketing/ShopMotion'

import './shop-brand.css'

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
 * Phase quick-260604-ftt: Rebuilt as the "Stop. Breathe. Balm." sub-brand
 * microsite inside the shared SiteHeader/SiteFooter layout. The sub-brand
 * palette and fonts are scoped under .shop-brand (shop-brand.css) and do
 * not leak to shared chrome.
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
    <div className="shop-brand">
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
            SECTION 1: Hero — split-screen (tube left / buy panel right)
            id="shop-hero" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-hero" className="sb-hero">

          {/* ── Left: CSS tube placeholder + edition stamp ─────────────── */}
          <div className="sb-hero-left">
            {/* TODO(Andrew): upload product photography (portrait, 3:4). Replace
                the CSS tube placeholder below with a Next.js <Image> when
                real photography is ready. */}
            <div className="sb-tube rv" aria-hidden="true">
              <div className="sb-tube-cap" />
              <div className="sb-tube-body">
                <div className="sb-tube-label">
                  <span
                    style={{
                      fontFamily: 'var(--sb-mono)',
                      fontSize: '0.5rem',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase' as const,
                      color: 'var(--paper)',
                      textAlign: 'center' as const,
                      lineHeight: '1.5',
                    }}
                  >
                    Jesse A.<br />Eisenbalm
                  </span>
                </div>
              </div>
              <div className="sb-tube-base" />
            </div>

            <div className="sb-stamp rv">
              {/* TODO(Andrew): confirm hand-numbering process and edition count before launch */}
              Release 001 &middot; Hand-numbered
            </div>
          </div>

          {/* ── Right: buy panel ─────────────────────────────────────────── */}
          <div className="sb-hero-right">
            <p className="sb-eyebrow rv">Jesse A. Eisenbalm</p>

            <h1 className="sb-h1 rv">
              The Lip Balm.
            </h1>

            {/*
              "Stop. Breathe. Balm." — required verbatim by shop-page.test.ts
              Do not alter this string; it is the locked sub-brand tagline.
            */}
            <p className="sb-tagline rv">
              Stop. Breathe. Balm.
            </p>

            <p
              className="rv"
              style={{
                marginTop: '0.75rem',
                fontFamily: 'var(--sb-body)',
                fontSize: '1rem',
                lineHeight: '1.6',
                color: 'var(--ink-2)',
              }}
            >
              A human-only ritual for an AI-everywhere world. Beeswax base.
              Petrolatum-free. One application. Lasting effect.
            </p>

            {/* TODO(Andrew): confirm final price before launch */}
            <p className="sb-price rv">$8.99</p>

            {/* Quantity stepper + running total */}
            <div className="rv" style={{ marginTop: '1.5rem' }}>
              <QtyStepper />
            </div>

            {/* BuyButton — instance 1 of ≥2 (required by shop-page.test.ts) */}
            <div className="rv" style={{ marginTop: '1.5rem' }}>
              <BuyButton className="mt-0" />
            </div>

            {/* Trust bullets */}
            <ul
              className="sb-trust rv"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
              aria-label="Product trust indicators"
            >
              <li className="sb-trust-item">
                {charityName
                  ? `100% of proceeds → ${charityName}`
                  : "100% of proceeds go to this week's charity"}
              </li>
              <li className="sb-trust-item">Ships flat-rate, continental US</li>
              <li className="sb-trust-item">Release 001 · hand-numbered</li>
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            The Ritual — dark full-bleed breathing band
            ════════════════════════════════════════════════════════════════ */}
        <div className="sb-ritual">
          <div className="sb-breathe-circle rv" aria-hidden="true">
            <div className="sb-breathe-inner" />
          </div>
          <div className="sb-in-out rv" aria-hidden="true">
            <span className="sb-in-out-in">Inhale</span>
            <span className="sb-in-out-sep"> · </span>
            <span className="sb-in-out-out">Exhale</span>
          </div>
          <h2 className="sb-ritual-heading rv">
            One product. One moment. Yours.
          </h2>
          <p className="sb-ritual-body rv">
            A balm designed for the pause between tasks. Applied deliberately.
            The opposite of a distraction.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 2: The Formula — What&apos;s in / What isn&apos;t
            id="shop-features" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-features" className="sb-formula">
          <div className="sb-formula-inner">
            <p className="sb-eyebrow rv" style={{ textAlign: 'center' }}>
              The Formula.
            </p>

            {/* TODO(Andrew): verify ingredient list against manufacturer spec sheet before launch */}
            <div className="sb-formula-grid">
              <div className="rv">
                <p className="sb-formula-col-label sb-formula-col-label--in">
                  What&apos;s in it
                </p>
                <ul className="sb-formula-list sb-formula-list--in" style={{ listStyle: 'none', padding: 0 }}>
                  <li>Beeswax</li>
                  <li>Shea butter</li>
                  <li>Vitamin E (tocopherol)</li>
                  <li>Natural flavor</li>
                </ul>
              </div>
              <div className="rv">
                <p className="sb-formula-col-label sb-formula-col-label--out">
                  What isn&apos;t
                </p>
                <ul className="sb-formula-list sb-formula-list--out" style={{ listStyle: 'none', padding: 0 }}>
                  <li>Petrolatum</li>
                  <li>Parabens</li>
                  <li>Synthetic fragrance</li>
                  <li>Mineral oil</li>
                  <li>Dimethicone</li>
                </ul>
              </div>
            </div>

            <p className="sb-formula-close rv">
              The goal was a formula a professional would use, not one a
              marketing department would describe. Transepidermal water loss
              addressed at the source. One application. Lasting effect.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            The Edition — big 001 numeral on paper3 background
            ════════════════════════════════════════════════════════════════ */}
        <div className="sb-edition">
          {/* TODO(Andrew): confirm edition number before launch */}
          <span className="sb-edition-numeral rv" aria-hidden="true">001</span>
          <p className="sb-edition-label rv">Release 001</p>
          <p className="sb-edition-desc rv">
            The first edition. Hand-numbered at the manufacturing step.
            A marker of where this product began.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 3: The Cause — full-bleed accent close
            id="shop-buy" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-buy" className="sb-cause">
          <p className="sb-cause-eyebrow rv">This week.</p>
          <h2 className="sb-cause-heading rv">
            {charityName
              ? `$8.99 → ${charityName}.`
              : "$8.99 → this week's charity."}
          </h2>
          <p className="sb-cause-body rv">
            One product. One weekly charity. One hundred percent of proceeds.
            No overhead. No administrative cut. The full amount transfers.
          </p>

          {/* BuyButton — instance 2 of ≥2 (required by shop-page.test.ts) */}
          <div className="sb-cause-buy rv">
            <BuyButton className="mt-0" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 4: FAQ — native details/summary, zero-JS accordion
            id="shop-faq" required by shop-page.test.ts
            ════════════════════════════════════════════════════════════════ */}
        <section id="shop-faq" className="sb-faq">
          <div className="sb-faq-inner">
            <p className="sb-faq-heading rv">Questions.</p>

            <details className="rv">
              <summary>
                What is Jesse A. Eisenbalm?
                <span className="sb-faq-chevron" aria-hidden="true">↓</span>
              </summary>
              <div className="sb-faq-body">
                A lip balm. Professional-grade, beeswax-based, petrolatum-free.
                Made for people who take their skin barrier seriously.
              </div>
            </details>

            <details className="rv">
              <summary>
                Where does the money go?
                <span className="sb-faq-chevron" aria-hidden="true">↓</span>
              </summary>
              <div className="sb-faq-body">
                One hundred percent of proceeds from every sale go directly to the
                week&apos;s featured charity on The Eisenbalm Dispatch. No overhead.
                No administrative percentage. The full amount transfers.
              </div>
            </details>

            <details className="rv">
              <summary>
                What is Release 001?
                <span className="sb-faq-chevron" aria-hidden="true">↓</span>
              </summary>
              <div className="sb-faq-body">
                {/* TODO(Andrew): confirm hand-numbering process description before launch */}
                The first edition of Jesse A. Eisenbalm lip balm. Each tube is
                hand-numbered at the manufacturing step. Release 001 is a
                designation — a marker of where this product began.
              </div>
            </details>

            <details className="rv">
              <summary>
                What does petrolatum-free mean?
                <span className="sb-faq-chevron" aria-hidden="true">↓</span>
              </summary>
              <div className="sb-faq-body">
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
                <span className="sb-faq-chevron" aria-hidden="true">↓</span>
              </summary>
              <div className="sb-faq-body">
                {/* TODO(Andrew): add shipping rates, carrier, and estimated delivery window before launch */}
                Ships flat-rate within the continental United States.
              </div>
            </details>

            <details className="rv">
              <summary>
                How do I contact you?
                <span className="sb-faq-chevron" aria-hidden="true">↓</span>
              </summary>
              <div className="sb-faq-body">
                {/* TODO(Andrew): insert contact email address before launch */}
                Email forthcoming.
              </div>
            </details>
          </div>
        </section>

      </ShopQtyProvider>
    </div>
  )
}
