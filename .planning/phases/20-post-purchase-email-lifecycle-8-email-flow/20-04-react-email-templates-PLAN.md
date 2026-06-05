---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 04
type: execute
wave: 3
depends_on: [20-01, 20-03]
files_modified:
  - packages/emails/package.json
  - packages/emails/src/layouts/TransactionalLayout.tsx
  - packages/emails/src/layouts/MarketingLayout.tsx
  - packages/emails/src/layouts/Footer.tsx
  - packages/emails/src/templates/OrderConfirmation.tsx
  - packages/emails/src/templates/Shipping.tsx
  - packages/emails/src/templates/DeliveredEstimate.tsx
  - packages/emails/src/templates/TheRitual.tsx
  - packages/emails/src/templates/CharityReceipt.tsx
  - packages/emails/src/templates/ReviewAsk.tsx
  - packages/emails/src/templates/NewsletterOptin.tsx
  - packages/emails/src/templates/Replenishment.tsx
  - packages/emails/src/render.tsx
  - packages/emails/src/index.ts
  - apps/web/next.config.ts
  - apps/web/__tests__/email-templates.test.ts
autonomous: true
requirements: [EMAIL-04, EMAIL-05, EMAIL-06, EMAIL-08]
must_haves:
  truths:
    - "All 8 emails exist as React Email templates: E1-3 use the transactional layout (no unsubscribe), E4-8 use the marketing layout (unsubscribe link + CAN-SPAM postal footer)"
    - "renderEmailStep(step, data) renders the real template for each step to an HTML string via @react-email/render"
    - "Emails 1-6 render the funded charity in the footer; E7 renders OTHER charities; E8 renders the live 'N more' count"
    - "Email 3 copy never claims a verified delivery (no 'arrived'/'delivered')"
    - "Marketing templates include a working unsubscribe link built from the unsubscribeToken; transactional do not"
    - "Templates render with a graceful fallback when charity data is null (missing charitySlug)"
    - "Next.js builds with @react-email packages treated as server externals"
  artifacts:
    - path: "packages/emails/src/render.tsx"
      provides: "renderEmailStep dispatching to the 8 templates via @react-email/render"
      contains: "render"
    - path: "packages/emails/src/layouts/Footer.tsx"
      provides: "CAN-SPAM postal footer + conditional unsubscribe link"
      contains: "unsubscribe"
    - path: "packages/emails/src/templates/CharityReceipt.tsx"
      provides: "E5 full-screen funded-charity story"
      min_lines: 20
  key_links:
    - from: "packages/emails/src/render.tsx"
      to: "the 8 template components"
      via: "switch(step) → render(<Template .../>)"
      pattern: "render\\("
    - from: "apps/web/next.config.ts"
      to: "@react-email/render"
      via: "serverExternalPackages"
      pattern: "serverExternalPackages"
---

<objective>
Author the 8 post-purchase emails as React Email templates in `@eisenbalm/emails`, replace the Plan 20-03 `renderEmailStep` placeholder with the real `@react-email/render` dispatch, and configure Next.js to treat the React Email packages as server externals. Templates are Andrew-approvable DRAFTS in Jesse's deadpan voice with the locked copy constraints (E2 no tracking number, E3 delivery-ESTIMATE only), the transactional/marketing layout split, the CAN-SPAM postal footer + conditional unsubscribe link, and the charity personalization slots (E1-6 funded charity, E7 others, E8 'N more' count).

Purpose: Satisfies template render + header/footer placement (EMAIL-04/05/06) and the E3 delivery-claim guard (EMAIL-08). These are DRAFTS — Andrew's voice sign-off is a LAUNCH PREREQUISITE, not a build task. Every copy file carries a `TODO(Andrew)` voice-approval marker.
Output: 3 layouts + 8 templates + real renderEmailStep + next.config update + snapshot tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-BRIEF.md
@.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md
@apps/web/next.config.ts

<interfaces>
<!-- Render seam from Plan 20-03 (KEEP SIGNATURE STABLE) and library facts. -->

renderEmailStep signature (packages/emails/src/render.tsx — replace body, keep signature; the seam is ALREADY `.tsx` from Plan 20-03):
  RenderData = {
    order: { customerEmail?: string|null; charitySlug?: string|null; amountTotal: number; createdAt: number }
    charity?: { name: string; location?: string; focusArea?: string; missionStatement?: string } | null
    others?: Array<{ name: string }> | null
    fundedMoreCount?: number | null
    unsubscribeToken?: string | null
    postalAddress?: string | null
  }
  renderEmailStep(step: number, data: RenderData): Promise<string>

Library facts (20-RESEARCH): @react-email/render v2.0.8 exports `render(jsx)` which is ASYNC (renderAsync deprecated). @react-email/components v1.0.12 provides Html, Head, Body, Container, Text, Link, Hr, Section, Heading. resend v6.12.4 is added in Plan 20-01's provider (lazy) — templates do NOT import resend.

Next.js (20-RESEARCH Pitfall 6): apps/web/next.config.ts needs `serverExternalPackages: ['@react-email/render', '@react-email/components']` (top-level NextConfig key in Next 15).

Brand voice (CLAUDE.md): dry, precise, absurdly serious. No winking, no irony, no exclamation marks, no sentiment. Jesse was born AI.
Stream split: STEP_STREAM (from @eisenbalm/emails) maps 1-3 transactional, 4-8 marketing.
Unsubscribe URL: `${NEXT_PUBLIC_BASE_URL}/api/email/unsubscribe?token=${token}` (route built in Plan 20-05).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install React Email deps, add layouts + Footer, configure Next externals</name>
  <read_first>packages/emails/package.json, apps/web/next.config.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>packages/emails/package.json, packages/emails/src/layouts/TransactionalLayout.tsx, packages/emails/src/layouts/MarketingLayout.tsx, packages/emails/src/layouts/Footer.tsx, apps/web/next.config.ts</files>
  <action>
Add deps to `packages/emails/package.json` dependencies: `"@react-email/components": "^1.0.12"`, `"@react-email/render": "^2.0.8"`, `"resend": "^6.12.4"`, `"react": "^19.2.6"`. Add devDependency `"@types/react": "^19.0.0"`. Run `pnpm install`.

`packages/emails/tsconfig.json` already has `"jsx": "react-jsx"` and an `include` covering `.tsx` (set in Plan 20-01 Task 1) — VERIFY it (grep `react-jsx` + `tsx`) and only add them if Plan 20-01 somehow omitted them. The `"typecheck": "tsc --noEmit"` script must already exist in `packages/emails/package.json` (added in 20-01 Task 1); confirm it is present (Task 2 verify depends on it). No render-seam rename happens in this plan — 20-03 created the seam as `render.tsx`.

Create `packages/emails/src/layouts/Footer.tsx` — a React Email `Section` rendering:
- The funded-charity line when `charity` is present (e.g. "This order funded {charity.name}, {charity.location}."), else fallback copy ("This order funded this week's featured charity.").
- The CAN-SPAM physical postal address from `postalAddress` prop with a `{/* TODO(Andrew): confirm postal address */}` marker; render the prop value or the literal `TODO(Andrew): postal address` when null.
- A conditional unsubscribe `Link` rendered ONLY when an `unsubscribeToken` prop is passed (marketing layout passes it; transactional does not). Link href = `${baseUrl}/api/email/unsubscribe?token=${token}`. Accept `baseUrl` as a prop (default `''`).
Props: `{ charity?, postalAddress?, unsubscribeToken?, baseUrl? }`.

Create `packages/emails/src/layouts/TransactionalLayout.tsx` — wraps children in `Html/Head/Body/Container`; renders `<Footer charity postalAddress />` WITHOUT unsubscribeToken (no unsubscribe link). Props: `{ children, charity?, postalAddress? }`.

Create `packages/emails/src/layouts/MarketingLayout.tsx` — same wrapper; renders `<Footer charity postalAddress unsubscribeToken baseUrl />` (unsubscribe link present). Props: `{ children, charity?, postalAddress?, unsubscribeToken?, baseUrl? }`.

Update `apps/web/next.config.ts`: add top-level `serverExternalPackages: ['@react-email/render', '@react-email/components']` to the `NextConfig` object (Pitfall 6).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm install >/dev/null 2>&1; grep -q "@react-email/render" packages/emails/package.json && grep -q "serverExternalPackages" apps/web/next.config.ts && grep -q "unsubscribe" packages/emails/src/layouts/Footer.tsx && test -f packages/emails/src/layouts/MarketingLayout.tsx && test -f packages/emails/src/layouts/TransactionalLayout.tsx && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `packages/emails/package.json` has `@react-email/render`, `@react-email/components`, `resend`, `react` deps and a `"typecheck": "tsc --noEmit"` script (from 20-01).
- `packages/emails/tsconfig.json` has `"jsx": "react-jsx"` and an `include` covering `.tsx` (verified — set in 20-01).
- `apps/web/next.config.ts` contains `serverExternalPackages` listing both react-email packages.
- `Footer.tsx` renders the unsubscribe Link only when an `unsubscribeToken` prop is present (conditional).
- `TransactionalLayout.tsx` does NOT pass `unsubscribeToken` to Footer; `MarketingLayout.tsx` does.
- Footer includes a `TODO(Andrew)` postal-address marker.
  </acceptance_criteria>
  <done>Deps installed; two layouts + Footer with conditional unsubscribe; Next externals configured.</done>
</task>

<task type="auto">
  <name>Task 2: The 8 templates (Jesse-voice drafts, charity slots, E3 delivery-safe)</name>
  <read_first>packages/emails/src/layouts/TransactionalLayout.tsx, packages/emails/src/layouts/MarketingLayout.tsx, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-BRIEF.md</read_first>
  <files>packages/emails/src/templates/OrderConfirmation.tsx, packages/emails/src/templates/Shipping.tsx, packages/emails/src/templates/DeliveredEstimate.tsx, packages/emails/src/templates/TheRitual.tsx, packages/emails/src/templates/CharityReceipt.tsx, packages/emails/src/templates/ReviewAsk.tsx, packages/emails/src/templates/NewsletterOptin.tsx, packages/emails/src/templates/Replenishment.tsx</files>
  <action>
Create 8 template components. Each is a default-exported function component taking the RenderData fields it needs. Each file starts with `// TODO(Andrew): voice sign-off required before live sending` (LAUNCH PREREQUISITE). Voice: dry, precise, deadpan, no exclamation marks, no winking, no sentiment.

Transactional (use `TransactionalLayout`, pass `charity` + `postalAddress`):
- `OrderConfirmation.tsx` (E1): confirms the order, $-amount from `order.amountTotal/100`. Funded-charity footer via layout.
- `Shipping.tsx` (E2): deadpan "handed to the carrier / another machine now knows where you live" beat. NO tracking number, NO tracking link (we have none). Leave a `{/* TODO: real tracking when carrier integration exists */}` comment as the upgrade path.
- `DeliveredEstimate.tsx` (E3): delivery-ESTIMATE copy. MUST NOT contain the words "arrived" or "delivered" (or "your order has arrived"). Use "should reach you" / "on its way" framing only. This is EMAIL-08.

Marketing (use `MarketingLayout`, pass `charity` + `postalAddress` + `unsubscribeToken` + `baseUrl`):
- `TheRitual.tsx` (E4): teaches the 3-second pause ritual.
- `CharityReceipt.tsx` (E5) — THE ANCHOR: full-screen version of the funded-charity footer. Render `charity.name`, `charity.location`, `charity.focusArea`, `charity.missionStatement`, and the "$8.99 went here" framing. Graceful fallback when `charity` is null ("this week's featured charity"). ≥20 lines.
- `ReviewAsk.tsx` (E6): asks for a review, deadpan.
- `NewsletterOptin.tsx` (E7): the hinge. Renders `others[]` (2-3 OTHER charities by name) to prove "there are more"; CTA opts into the weekly charity newsletter (v1 only captures consent — link to a capture endpoint or the site; do NOT promise the newsletter is already sending). Fallback when `others` empty.
- `Replenishment.tsx` (E8): replenishment + last call. Renders the live "since you bought, a machine has quietly funded {fundedMoreCount} more causes" line; fallback when count is null/0.

All templates must accept null charity/others/count and render fallback copy (no crash). Add `export * from './templates/...'` lines OR a `templates/index.ts` barrel; ensure they are importable by render.tsx (Task 3).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && for f in OrderConfirmation Shipping DeliveredEstimate TheRitual CharityReceipt ReviewAsk NewsletterOptin Replenishment; do test -f packages/emails/src/templates/$f.tsx || { echo "MISSING $f"; exit 1; }; done; grep -iq "arrived\|delivered" packages/emails/src/templates/DeliveredEstimate.tsx && { echo "E3 contains forbidden word"; exit 1; } || echo "E3_SAFE"; grep -q "TODO(Andrew)" packages/emails/src/templates/CharityReceipt.tsx && pnpm --filter @eisenbalm/emails typecheck && echo OK</automated>
  </verify>
  <acceptance_criteria>
- All 8 template files exist under `packages/emails/src/templates/`.
- `DeliveredEstimate.tsx` (E3) contains NEITHER "arrived" NOR "delivered" (case-insensitive) — grep returns no match (EMAIL-08).
- `Shipping.tsx` (E2) has no tracking number/URL (no `http` tracking link; comment marks the upgrade path).
- `CharityReceipt.tsx` references `charity.name`, `charity.missionStatement`, and has a null-charity fallback.
- `NewsletterOptin.tsx` maps `others` and `Replenishment.tsx` renders `fundedMoreCount`.
- Every template file starts with a `TODO(Andrew)` voice-approval marker.
- `pnpm --filter @eisenbalm/emails typecheck` passes (template TSX compiles — surfaces JSX/type errors here, not late in Task 3).
  </acceptance_criteria>
  <done>8 deadpan draft templates with charity slots and the E2/E3 copy guards.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: renderEmailStep dispatch + snapshot/assertion tests</name>
  <read_first>packages/emails/src/render.tsx, packages/emails/src/templates/CharityReceipt.tsx, apps/web/__tests__/email-templates.test.ts, apps/web/vitest.config.ts</read_first>
  <files>packages/emails/src/render.tsx, packages/emails/src/index.ts, apps/web/__tests__/email-templates.test.ts</files>
  <behavior>
    - renderEmailStep(1, {order, charity}) resolves to an HTML string containing the charity name (funded footer)
    - renderEmailStep(3, {order, charity}) HTML contains neither "arrived" nor "delivered"
    - renderEmailStep(4, {order, charity, unsubscribeToken:'abc', baseUrl:'https://x'}) HTML contains '/api/email/unsubscribe?token=abc' (marketing has unsubscribe)
    - renderEmailStep(1, {order, charity, unsubscribeToken:'abc'}) HTML does NOT contain '/api/email/unsubscribe' (transactional has none)
    - renderEmailStep(5, {order, charity:null}) renders fallback copy without throwing
    - renderEmailStep(7, {order, others:[{name:'A'},{name:'B'}]}) HTML contains 'A' and 'B'
    - renderEmailStep(8, {order, fundedMoreCount:3}) HTML contains '3'
  </behavior>
  <action>
Replace the placeholder body of `packages/emails/src/render.tsx` `renderEmailStep` with a real dispatch (KEEP the exported signature + RenderData type unchanged; the file is ALREADY `.tsx` — created that way in Plan 20-03 — so NO rename is needed):
```typescript
import { render } from '@react-email/render'
import OrderConfirmation from './templates/OrderConfirmation'
// ...import the other 7...
export async function renderEmailStep(step: number, data: RenderData): Promise<string> {
  switch (step) {
    case 1: return render(<OrderConfirmation {...data} />)
    case 2: return render(<Shipping {...data} />)
    case 3: return render(<DeliveredEstimate {...data} />)
    case 4: return render(<TheRitual {...data} />)
    case 5: return render(<CharityReceipt {...data} />)
    case 6: return render(<ReviewAsk {...data} />)
    case 7: return render(<NewsletterOptin {...data} />)
    case 8: return render(<Replenishment {...data} />)
    default: throw new Error(`Unknown email step ${step}`)
  }
}
```
The seam is already `packages/emails/src/render.tsx` (Plan 20-03 created it with the `.tsx` extension); the barrel `export * from './render'` already resolves to it (specifier unchanged). Do NOT rename anything. tsconfig `jsx: react-jsx` + `.tsx` `include` are already in place from Plan 20-01 — no tsconfig edit here.

FILL IN `apps/web/__tests__/email-templates.test.ts` — this file already exists as an `it.todo` Wave-0 skeleton from Plan 20-01 Task 2 (it currently only reserves the EMAIL-04/05/06/08 coverage). REPLACE its `it.todo` placeholders with real `it(...)` assertions (vitest, `import { describe, it, expect } from 'vitest'`) encoding all behaviors below; now import `renderEmailStep` from `@eisenbalm/emails`. `renderEmailStep` is async — `await` it. Build a minimal `order` fixture `{ amountTotal: 899, createdAt: 0, customerEmail:'a@b.c', charitySlug:'nap-ministry' }` and a charity fixture `{ name:'The Nap Ministry', location:'Atlanta, GA', focusArea:'Rest', missionStatement:'Rest is resistance.' }`. Assert substrings per the behavior block, including the transactional-vs-marketing unsubscribe presence/absence (EMAIL-05/06) and the E3 delivery-safe guard (EMAIL-08).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-templates.test.ts</automated>
  </verify>
  <acceptance_criteria>
- `email-templates.test.ts` green (all behaviors).
- E4 render contains `/api/email/unsubscribe?token=abc`; E1 render does NOT contain `/api/email/unsubscribe` (EMAIL-05 + EMAIL-06).
- E3 render contains neither "arrived" nor "delivered" (EMAIL-08).
- E5 render with `charity:null` does not throw (fallback path).
- `renderEmailStep` dispatches all 8 steps via `@react-email/render`.
  </acceptance_criteria>
  <done>Real render dispatch wired to 8 templates; snapshot/assertion tests green; render seam now production.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/email-templates.test.ts` → green.
- `grep -L "TODO(Andrew)" packages/emails/src/templates/*.tsx` returns nothing (every template carries the voice-approval marker).
- `pnpm --filter web build` does not error on @react-email externals (serverExternalPackages set).
</verification>

<success_criteria>
- 8 Jesse-voice draft templates render via renderEmailStep; transactional/marketing split correct.
- Marketing carries unsubscribe; transactional does not; E3 never claims delivery.
- Charity personalization slots populated (E1-6 funded, E7 others, E8 count) with null-safe fallbacks.
</success_criteria>

<output>
After completion, create `.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-04-SUMMARY.md`
</output>
