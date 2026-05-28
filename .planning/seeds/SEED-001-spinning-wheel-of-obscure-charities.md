---
id: SEED-001
status: dormant
planted: 2026-05-28
planted_during: post-Phase-15 (Shop Storefront complete, on Phase 999.1 backlog cleanup)
trigger_when: Phase 8 (Stripe / Commerce) is fully closed AND charity catalog ≥12 entries AND Andrew wants a commerce-side variation mechanism
scope: Medium
source: client doc — Eisenbalm Obscure Charity Navigator, "5/26 Ideas" section (2026-05-28)
---

# SEED-001: Spinning Wheel of Obscure Charities

Interactive charity-selection variant at checkout. Reader spins a wheel at `/shop`; their purchase routes 100% of proceeds to whichever pre-vetted charity they land on, rather than to the current week's featured charity. Reference: [Elvis Costello's Spectacular Spinning Songbook](https://www.youtube.com/watch?v=9lsfUz1n0BU) — showmanship as commerce.

## Why This Matters

Three reasons this is worth keeping warm, and three reasons it's not the next move:

**Worth keeping:**
- Turns the lip balm purchase from a passive "I am donating to this week's charity" into an active, theatrical "I chose this one." That's a different emotional register and a different shareability profile.
- Surfaces the whole archive of obscure charities at the moment of highest reader intent (checkout), which the current weekly cadence buries.
- Creates a second editorial lever for Andrew (curate the wheel pool) without compromising the weekly format.

**Why deferred:**
- **Phase 8 (Stripe / Commerce) is not yet fully closed.** Andrew still owes the test-key swap (08-02) and the live 08-HUMAN-UAT (08-08) — tracked in [.planning/phases/08-stripe-commerce/08-HUMAN-UAT.md](.planning/phases/08-stripe-commerce/08-HUMAN-UAT.md). Piling multi-charity routing on top of an un-UAT'd commerce path is asking for it.
- **Donation attribution today is single-charity-per-week.** The current published issue's `weeklyIssue.charity` reference defines the recipient. Multi-charity routing means Stripe session metadata MUST carry the selected charity, the webhook handler MUST attribute funds per-session, and any donation-report surface MUST split across charities.
- **Pool size matters.** A 3-slot wheel feels like a bug; a 12+ slot wheel feels like a feature. Until the charity catalog is real, this is a UI demo, not a commerce primitive.

## When to Surface

**Trigger:** ALL three conditions below must hold before `/gsd:new-milestone` should propose this seed:

1. **Phase 8 / Stripe is fully closed** — `08-HUMAN-UAT.md` signed off, live keys validated end-to-end, no outstanding CMR sentinel red, and 08-02 + 08-08 have actually been performed (not just checked off).
2. **Charity catalog has ≥12 wheel-eligible entries** — either published `charity` documents in Sanity or Scout-vetted candidates explicitly flagged `wheelEligible`. The wheel has to feel curated, not sparse.
3. **Andrew explicitly wants a commerce-side variation mechanism** — before this surfaces, confirm the wheel is the lever he wants, vs. alternatives like limited drops, alt SKUs, or seasonal bundles. The wheel is one shape of variation, not the only one.

## Scope Estimate

**Medium** — a real phase (probably 6-8 plans), not a quick task, but not a whole milestone. Rough surface area when it wakes:

- **Sanity schema:** `charity.wheelEligible: boolean` flag (defaults false); editorial UI in Studio to curate.
- **Donation reporting:** the existing single-charity attribution query splits per-Stripe-session, keyed on `selected_charity_id` metadata.
- **Frontend (`apps/web`):** `/shop` gains a wheel variant (feature-flagged so it can be toggled without code deploy). Reduced-motion fallback = vertical list + "Pick one for me" random button. Token-based styling — inherits the Phase 14 light theme.
- **Stripe (`apps/web/app/api/checkout/create-session/route.ts` + `.../stripe/webhook/route.ts`):** checkout session metadata carries `selected_charity_id`; webhook attributes the order to the chosen charity; idempotency contract (CMR-06) unchanged.
- **Editorial workflow:** Andrew curates the wheel pool — not every published charity belongs on it. Wheel-eligible needs explicit opt-in, not opt-out.

**Explicit non-goals:**
- No urgency mechanics, countdowns, scarcity banners, or "spin again" upsells. The Costello reference is showmanship, not pressure. The brand brief at [docs/CLAUDE_CODE_BRIEF.md](docs/CLAUDE_CODE_BRIEF.md) explicitly forbids urgency mechanics — this seed honors that.
- No gamification of the donation amount (no "spin to double your donation"). 100% of proceeds, always.

## Breadcrumbs

Where this would land in the codebase when it wakes:

**Commerce surface (Phase 8):**
- [apps/web/app/shop/page.tsx](apps/web/app/shop/page.tsx) — current `/shop` server component fetching published issue's charity
- [apps/web/app/api/checkout/create-session/route.ts](apps/web/app/api/checkout/create-session/route.ts) — Stripe session creation; this is where `selected_charity_id` metadata gets attached
- [apps/web/app/api/stripe/webhook/route.ts](apps/web/app/api/stripe/webhook/route.ts) — webhook with CMR-04/05/06 atomic idempotency contract; per-charity attribution adds here
- [apps/web/components/marketing/BuyButton.tsx](apps/web/components/marketing/BuyButton.tsx) — current redirect client
- [apps/web/components/marketing/ShopCallout.tsx](apps/web/components/marketing/ShopCallout.tsx) — referenced from every issue page
- [apps/web/app/shop/thank-you/page.tsx](apps/web/app/shop/thank-you/page.tsx) — purely static today; would echo the chosen charity name post-spin

**Phase 15 (current `/shop` shape — the long-scroll storefront the wheel replaces or augments):**
- [.planning/phases/15-shop-storefront/15-01-shop-storefront-PLAN.md](.planning/phases/15-shop-storefront/15-01-shop-storefront-PLAN.md)
- [.planning/phases/15-shop-storefront/15-UI-SPEC.md](.planning/phases/15-shop-storefront/15-UI-SPEC.md)

**Phase 8 (commerce contract this builds on):**
- [.planning/phases/08-stripe-commerce/08-HUMAN-UAT.md](.planning/phases/08-stripe-commerce/08-HUMAN-UAT.md) — Andrew-deferred UAT that gates this seed waking
- All `08-*-PLAN.md` files in [.planning/phases/08-stripe-commerce/](.planning/phases/08-stripe-commerce/)

**Charity schema:**
- [schemas/charity.ts](schemas/charity.ts) — where `wheelEligible: boolean` lands

**Phase 14 light theme (visual constraints the wheel inherits):**
- [.planning/phases/14-light-theme-adoption/](.planning/phases/14-light-theme-adoption/) — warm-paper palette, gold/rust as accent only, no raw-gold text

## Notes

- This was sent as one of three ideas in the same client doc. The other two are being handled now:
  - **Choose Your Narrator** → Phase 16 (planning starts immediately after this seed is planted)
  - **Agentic Chat Origin Story** → likely Phase 17, after Narrator validates the voice-variation pattern
- The "Semi-Plausible Connection to Lip Balm" pattern in the client doc (empty columns in the charity table) is a separate editorial primitive that may want its own seed if it doesn't get absorbed into Phase 16's narrator work or into a future Scout-input research doc.
- When this wakes, re-check whether the `weeklyIssue` schema has gained an `issueFormat` discriminator from Phase 17. If yes, the wheel may want to default to "donate to currently-featured charity" for chat-format issues, since those have a stronger relationship between reader and a single specific charity.
