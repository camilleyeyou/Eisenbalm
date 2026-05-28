---
phase: 15
slug: shop-storefront
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 15-RESEARCH.md "## Validation Architecture" + 15-UI-SPEC.md test contract.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing — installed Phase 7) |
| **Config file** | `apps/web/vitest.config.ts` (existing — no install needed) |
| **Quick run command** | `cd apps/web && npx vitest run __tests__/shop-page.test.ts` |
| **Full suite command** | `pnpm --filter web test:unit` |
| **Build command** | `pnpm --filter web build` |
| **Estimated runtime** | ~3 seconds (unit/source-scan only; no DOM render) |

---

## Sampling Rate

- **After every task commit:** `cd apps/web && npx vitest run __tests__/shop-page.test.ts`
- **After every plan wave:** `pnpm --filter web test:unit` (all 25 test files / 215+ tests must stay green)
- **Before `/gsd:verify-work`:** Full web suite green + `pnpm --filter web build` exits 0
- **Max feedback latency:** ~5 seconds

---

## Per-Requirement Verification Map

> Task IDs assigned by the planner; every derived SHOP-* requirement maps to an automated check except the two genuinely-visual ones (SHOP-05 visual hierarchy + SHOP-06 voice register), which are manual.

| Req ID | Behavior | Test Type | Automated Command | File | Status |
|--------|----------|-----------|-------------------|------|--------|
| SHOP-01 | 8 section IDs (`#shop-hero` … `#shop-footer-cta`) present in page source | source-scan | `npx vitest run __tests__/shop-page.test.ts` | shop-page.test.ts (extend) | ⬜ pending |
| SHOP-02 | Hero tagline `Stop. Breathe. Balm.` + `A human-only ritual for an AI-everywhere world.` present verbatim | source-scan | same | shop-page.test.ts (extend) | ⬜ pending |
| SHOP-03 | `<BuyButton` appears ≥2 times in the rebuilt page (3 per UI-SPEC) | source-scan | same | shop-page.test.ts (extend) | ⬜ pending |
| SHOP-04 | Sanity charity callout server-rendered (`QUERY_LATEST_CHARITY_NAME` + `sanityClient` import preserved) | source-scan | same | shop-page.test.ts (existing CMR-01 assertion #3) | ✅ already green |
| SHOP-07 | Phase 8 server-component contract preserved (no `'use client'`, async default function, `revalidate = 60`) | source-scan | same | shop-page.test.ts (existing CMR-01 assertions 1–6) | ✅ already green |
| SHOP-08 | No urgency vocabulary in the rebuilt page (CMR-09 contract — also `<BuyButton` is the only client-only commerce trigger) | source-scan | same | shop-page.test.ts (extend) + existing CMR-09 tripwire | ⬜ pending |
| SHOP-09 | No hardcoded hex in `shop/page.tsx` (only `--color-*` tokens) | source-scan | same | shop-page.test.ts (extend) | ⬜ pending |
| SHOP-10 | At least one `TODO(Andrew)` marker present (image slots / final tagline / final price / edition number / voice-check) | source-scan | same | shop-page.test.ts (extend) | ⬜ pending |
| SHOP-11 | `pnpm --filter web build` exits 0; full vitest suite stays at 215/215; all prior tripwires green | build + unit | `pnpm --filter web build` ; `pnpm --filter web test:unit` | regression gate | ⬜ pending |
| SHOP-05 | Visual hierarchy + 4-tier typography render correctly on warm-paper light theme + at mobile breakpoints | manual | browser walkthrough on desktop + mobile | — | ⬜ pending |
| SHOP-06 | Copy on `/shop` is in the lip-balm sub-brand voice ("Stop. Breathe. Balm." register), NOT the Dispatch's editorial register | manual | editorial read-through | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing Vitest infrastructure covers the automated phase requirements — **no new test files needed**. The Wave 0 work is an **extension** of the existing `shop-page.test.ts`:

- [ ] `apps/web/__tests__/shop-page.test.ts` — add a `describe('Phase 15: /shop long-scroll structure', …)` block with ≥7 new assertions covering SHOP-01 (8 section IDs), SHOP-02 (hero tagline verbatim), SHOP-03 (`<BuyButton` ≥2 occurrences), SHOP-08 (extended no-urgency vocabulary sweep), SHOP-09 (no hardcoded hex in this file), SHOP-10 (`TODO(Andrew)` marker present), and one structural sanity (`<details>`/`<summary>` FAQ block exists).

No new test files. No new fixtures. No new framework installs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendered storefront visual hierarchy on warm-paper light theme | SHOP-05 | Visual judgement of 4-tier typography rhythm, ornament-divider placement, feature-card balance | Run `pnpm --filter web dev` (with the Stripe-keys caveat: do NOT click BuyButton against live keys); load `/shop`; confirm each of the 8 sections renders in the right register, no surface looks "off-brand" against the light palette |
| Mobile breakpoints | SHOP-05 | Layout collapse from 3-col → 1-col on `#shop-features`, 2-col → 1-col on `#shop-buy`, hero padding rebalance — requires browser viewport changes | DevTools responsive mode at 360px / 480px / 768px / 1024px / 1440px; confirm touch targets remain ≥44px on every CTA at every breakpoint |
| BuyButton wrapper-pattern spacing (double-spacing check) | SHOP-03 | BuyButton has internal `mt-8`; wrapper `mt-N` may compound depending on block/flex context — visual check decides whether to keep wrapper margin or rely on the internal one | At each of the 3 BuyButton positions, confirm the spacing above the button looks editorially correct — not visibly double-spaced |
| FAQ accordion behavior | SHOP-08 | Native `<details>`/`<summary>` interaction + custom chevron rotation requires a click test, not a source scan | Open/close each FAQ item; confirm the disclosure triangle is suppressed, the custom chevron rotates on open, and the answer text is legible on the light theme |
| Voice register on `/shop` is the lip-balm sub-brand voice, not the Dispatch editorial voice | SHOP-06 | Editorial judgement — verbatim copy from UI-SPEC should pass, but a sweep confirms no executor paraphrase drifted into the wrong register | Read every body paragraph + FAQ answer on `/shop` and confirm it reads as "Stop. Breathe. Balm." register (meditative, declarative) — not the Dispatch's "dry editorial about charities" register |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (extending shop-page.test.ts covers SHOP-01/02/03/08/09/10; existing tripwires cover SHOP-04/SHOP-07; build + suite covers SHOP-11)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the test-extension dependency before implementation is verified
- [ ] No watch-mode flags (uses `vitest run`)
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
