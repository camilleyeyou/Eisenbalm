---
phase: 20-post-purchase-email-lifecycle-8-email-flow
verified: 2026-06-05T00:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Jesse voice sign-off on the 8 email subject lines and body copy"
    expected: "Andrew reviews each draft template in packages/emails/src/templates/*.tsx and subjects.ts, confirms the deadpan register, and flips EMAIL_LIVE_SEND=true only after sign-off"
    why_human: "Brand voice conformance is an editorial judgment — no automated rubric can substitute for Andrew's approval; every template carries the TODO(Andrew) marker precisely for this reason"
  - test: "Live delivery round-trip (Resend + verified sending subdomains)"
    expected: "E1 lands in inbox from receipts@receipts.eisenbalm.com; E4 carries working List-Unsubscribe header; unsubscribe link hits /api/email/unsubscribe and produces the confirmation page"
    why_human: "Requires RESEND_API_KEY, DNS SPF/DKIM/DMARC verification, and EMAIL_LIVE_SEND=true — all explicit go-live prerequisites the BRIEF marks out of scope for this build phase"
---

# Phase 20: Post-Purchase Email Lifecycle (8-email flow) Verification Report

**Phase Goal:** In-house post-purchase email lifecycle for the single-SKU Stripe store — 8 purchase-anchored emails per completed order in Jesse's deadpan voice, charity-personalized off the charitySlug captured in Convex stripeOrders. React Email templates in apps/web/packages, Convex scheduled functions as the timer, Resend as delivery provider (live sending OFF by default until go-live). Transactional (1-3) vs marketing (4-8) split with one-click unsubscribe + List-Unsubscribe headers + CAN-SPAM footer; unsubscribe suppresses 4-8 but 1-3 still send.

**Verified:** 2026-06-05
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | 8 purchase-anchored offsets encoded as exact ms constants | VERIFIED | `packages/emails/src/offsets.ts` exports `OFFSETS_MS` with 8 entries: 0, 1d, 4d, 7d, 9d, 14d, 21d, 42d; asserted in `email-offsets.test.ts` |
| 2  | Idempotency gate: a step already 'sent' never re-sends | VERIFIED | `shouldSendStep` in `suppression.ts` returns false when `existing?.status === 'sent'`; `emailActions.ts` checks it before any send; `email-idempotency.test.ts` asserts this |
| 3  | Suppression: marketing (4-8) suppressed on unsubscribe, transactional (1-3) always send | VERIFIED | `shouldSuppressStep` in `suppression.ts` returns false for steps 1-3 regardless of consentState; asserted in `email-suppression.test.ts`; `sendEmailStep` action applies the gate |
| 4  | All 8 React Email templates exist with charity personalization slots | VERIFIED | 8 `.tsx` files under `packages/emails/src/templates/`; transactional (E1-E3) use `TransactionalLayout`; marketing (E4-E8) use `MarketingLayout`; E5 renders `charity.name`/`missionStatement`; E7 maps `others[]`; E8 renders `fundedMoreCount` |
| 5  | Marketing emails carry List-Unsubscribe + List-Unsubscribe-Post headers; transactional carry none | VERIFIED | `emailActions.ts` lines 133-143: headers object populated only when `isMarketingStep(step) && subscriber?.unsubscribeToken`; transactional path passes empty `{}` |
| 6  | E3 never claims verified delivery (no "arrived"/"delivered" in copy or subject) | VERIFIED | `DeliveredEstimate.tsx` uses "should reach you", "on its way", "estimate" framing; grep confirms no "arrived"/"delivered" in file text (only function name `DeliveredEstimate`); `SUBJECTS[3]` = "It should reach you any day now."; asserted in `email-templates.test.ts` and `email-offsets.test.ts` |
| 7  | Live sending is OFF by default (FakeEmailProvider unless EMAIL_LIVE_SEND=true AND RESEND_API_KEY present) | VERIFIED | `selectProvider` in `provider.ts`: returns `FakeEmailProvider` for all env combinations except `EMAIL_LIVE_SEND==='true' && RESEND_API_KEY`; `email-provider.test.ts` asserts all four cases |
| 8  | One-click unsubscribe route (GET + POST) validates token, calls Convex, returns HTML | VERIFIED | `apps/web/app/api/email/unsubscribe/route.ts` exports GET + POST, returns 400 on missing/blank token, calls `api.emailSubscribers.unsubscribeByTokenPublic` on valid token, returns `text/html`; `email-unsubscribe-route.test.ts` asserts all cases |
| 9  | Unsubscribe cancels pending scheduled marketing steps; transactional untouched | VERIFIED | `unsubscribeByToken` in `emailSubscribers.ts`: patches consentState to 'unsubscribed', iterates `emailSends` rows, calls `ctx.scheduler.cancel(scheduledFnId)` and patches status to 'cancelled' only when `shouldCancelOnUnsubscribe` returns true (marketing + scheduled); `email-unsubscribe-cancel.test.ts` asserts transactional never cancelled |
| 10 | Missing customerEmail marks all 8 steps skipped, never throws, never fails the order write | VERIFIED | `enqueueEmailFlow` in `emailFlow.ts`: `planEnqueue` returns `{skip:true}` when email absent; loop calls `markSkipped` for all 8 steps; no throw; stripeOrders.insert wraps the enqueue call in try/catch |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/emails/package.json` | @eisenbalm/emails workspace package, source-resolution | VERIFIED | name=`@eisenbalm/emails`, main=`./src/index.ts`, exports pointing to source; has `typecheck` script; @react-email/render, @react-email/components, resend, react in deps |
| `packages/emails/tsconfig.json` | jsx: react-jsx + .tsx include | VERIFIED | `"jsx": "react-jsx"`, `"include": ["src/**/*.ts", "src/**/*.tsx"]` |
| `packages/emails/src/offsets.ts` | OFFSETS_MS[8], STEP_STREAM, isMarketingStep, offsetForStep | VERIFIED | All 4 exports present; values exact per BRIEF |
| `packages/emails/src/suppression.ts` | shouldSuppressStep, shouldSendStep, shouldCancelOnUnsubscribe | VERIFIED | All 3 exports present with correct logic |
| `packages/emails/src/token.ts` | generateUnsubscribeToken() → 64-char hex | VERIFIED | `randomBytes(32).toString('hex')` = 64 chars |
| `packages/emails/src/subjects.ts` | SUBJECTS[1..8] with voice drafts, SUBJECTS[3] delivery-safe | VERIFIED | 8 entries; SUBJECTS[3]="It should reach you any day now." contains no "arrived"/"delivered" |
| `packages/emails/src/provider.ts` | SendEmailProvider, ResendProvider, FakeEmailProvider, selectProvider | VERIFIED | Interface + 2 classes + selector; lazy `await import('resend')` in ResendProvider |
| `packages/emails/src/charity.ts` | buildFundedCharityQuery, buildOtherCharitiesQuery, buildFundedSinceCountQuery, orderMsToIsoDate | VERIFIED | All 4 exports; slug/date sanitized; returns null for falsy slug |
| `packages/emails/src/enqueuePlan.ts` | planEnqueue(order) → {skip, steps} | VERIFIED | Returns skip:true when customerEmail absent |
| `packages/emails/src/render.tsx` | renderEmailStep dispatch to 8 templates via @react-email/render | VERIFIED | switch(step) case 1-8; uses `render()` from @react-email/render; default throws |
| `packages/emails/src/layouts/Footer.tsx` | CAN-SPAM postal footer + conditional unsubscribe link | VERIFIED | unsubscribeToken prop renders Link only when truthy; postal address with TODO(Andrew) marker |
| `packages/emails/src/layouts/TransactionalLayout.tsx` | wraps Footer WITHOUT unsubscribeToken | VERIFIED | Footer called with no unsubscribeToken prop |
| `packages/emails/src/layouts/MarketingLayout.tsx` | wraps Footer WITH unsubscribeToken | VERIFIED | Footer called with `unsubscribeToken={unsubscribeToken ?? undefined}` |
| `packages/emails/src/templates/OrderConfirmation.tsx` | E1 transactional, charity footer | VERIFIED | Uses TransactionalLayout; TODO(Andrew) marker |
| `packages/emails/src/templates/Shipping.tsx` | E2 transactional, no tracking link | VERIFIED | No http tracking URL; TODO comment marks upgrade path |
| `packages/emails/src/templates/DeliveredEstimate.tsx` | E3 transactional, delivery-estimate copy only | VERIFIED | No "arrived"/"delivered" in copy |
| `packages/emails/src/templates/TheRitual.tsx` | E4 marketing, unsubscribe via layout | VERIFIED | Uses MarketingLayout |
| `packages/emails/src/templates/CharityReceipt.tsx` | E5 marketing, full charity story, null-safe, >=20 lines | VERIFIED | 144 lines; renders charity.name/location/focusArea/missionStatement; null-charity fallback path |
| `packages/emails/src/templates/ReviewAsk.tsx` | E6 marketing | VERIFIED | Uses MarketingLayout |
| `packages/emails/src/templates/NewsletterOptin.tsx` | E7 marketing, renders others[] | VERIFIED | Maps `others` array; fallback when empty |
| `packages/emails/src/templates/Replenishment.tsx` | E8 marketing, fundedMoreCount | VERIFIED | Renders `fundedMoreCount` with fallback |
| `convex/schema.ts` | emailSubscribers + emailSends tables with correct indexes | VERIFIED | emailSubscribers: by_email + by_token; emailSends: by_orderId + by_orderId_step + by_email_step + by_status; scheduledFnId field present |
| `convex/emailSubscribers.ts` | getByEmail, getByToken, upsertSubscriber, unsubscribeByToken, unsubscribeByTokenPublic | VERIFIED | All 5 exports; upsertSubscriber does NOT overwrite consentState on existing row; scheduler.cancel called in unsubscribeByToken |
| `convex/emailSends.ts` | getByOrderStep, listStaleScheduled, insertScheduled, markSent, markFailed, markSkipped | VERIFIED | All 6 exports; all DB reads use withIndex |
| `convex/emailFlow.ts` | enqueueEmailFlow + getOrder | VERIFIED | enqueueEmailFlow schedules 8 steps with offsetForStep; records scheduledFnId; markSkipped loop for missing email |
| `convex/emailActions.ts` | sendEmailStep + sweepStaleSends, "use node" first line | VERIFIED | First line is `"use node"`; both exports present; full 8-step gate sequence present |
| `convex/crons.ts` | hourly email-retry-sweep cron | VERIFIED | `crons.hourly('email-retry-sweep', {minuteUTC:30}, internal.emailActions.sweepStaleSends, {})` |
| `convex/stripeOrders.ts` | enqueueEmailFlow hook, try/catch, return null preserved | VERIFIED | `ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow, {orderId})` inside try/catch; `return null` PRESERVED |
| `apps/web/app/api/email/unsubscribe/route.ts` | GET + POST, runtime=nodejs, 400 on bad token, 200 HTML on valid | VERIFIED | Both exports; `runtime = 'nodejs'`; `dynamic = 'force-dynamic'`; 400 guard; 200 text/html response |
| `apps/web/next.config.ts` | serverExternalPackages for @react-email | VERIFIED | `serverExternalPackages: ['@react-email/render', '@react-email/components']` |
| `apps/web/.env.example` | EMAIL_LIVE_SEND, RESEND_API_KEY, EMAIL_FROM_*, EMAIL_POSTAL_ADDRESS | VERIFIED | All 5 env vars documented with comments; no real secret values |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/stripeOrders.ts` | `internal.emailFlow.enqueueEmailFlow` | `ctx.scheduler.runAfter(0, ...)` inside try/catch | WIRED | Confirmed: orderId captured, enqueue fires fire-and-forget, return null preserved |
| `convex/emailFlow.ts` | `internal.emailActions.sendEmailStep` | `ctx.scheduler.runAfter(offsetForStep(step), ...)` | WIRED | Each of 8 steps scheduled at exact purchase-anchored offset |
| `convex/emailActions.ts` | `internal.emailSends.getByOrderStep` | `ctx.runQuery` idempotency gate | WIRED | Called before send; `shouldSendStep` gates execution |
| `convex/emailActions.ts` | `internal.emailSubscribers.getByEmail` | `ctx.runQuery` suppression check | WIRED | Subscriber lookup → `shouldSuppressStep` early-return for marketing |
| `convex/emailActions.ts` | `selectProvider(process.env)` | `@eisenbalm/emails` | WIRED | Live OFF by default; FakeEmailProvider unless both flags set |
| `convex/emailActions.ts` | `renderEmailStep(step, data)` | `@eisenbalm/emails` render.tsx | WIRED | Called with order, charity, others, fundedMoreCount, unsubscribeToken, postalAddress |
| `packages/emails/src/render.tsx` | 8 template components | `switch(step)` → `render(<Template/>)` | WIRED | All 8 cases present; default throws on unknown step |
| `packages/emails/src/layouts/Footer.tsx` | conditional unsubscribe Link | `{unsubscribeToken && <Link>}` | WIRED | Link rendered only when token truthy; confirmed via email-templates.test.ts |
| `apps/web/app/api/email/unsubscribe/route.ts` | `api.emailSubscribers.unsubscribeByTokenPublic` | `ConvexHttpClient.mutation` | WIRED | Pattern mirrors Phase 8 stripe webhook handler |
| `convex/emailSubscribers.ts` | `ctx.scheduler.cancel` | cancel each pending scheduled marketing step's scheduledFnId | WIRED | `shouldCancelOnUnsubscribe` guard; rows patched to 'cancelled' |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `CharityReceipt.tsx` | `charity.name/missionStatement` | `buildFundedCharityQuery` → Sanity CDN fetch in `sendEmailStep` | Yes — GROQ query against real Sanity production API | FLOWING |
| `NewsletterOptin.tsx` | `others[]` | `buildOtherCharitiesQuery` → Sanity CDN fetch in `sendEmailStep` step 7 branch | Yes — queries published weeklyIssues excluding buyer's slug | FLOWING |
| `Replenishment.tsx` | `fundedMoreCount` | `buildFundedSinceCountQuery` → Sanity CDN fetch in `sendEmailStep` step 8 branch | Yes — count query against real weeklyIssue docs | FLOWING |
| `sendEmailStep` | `subscriber.unsubscribeToken` | `ctx.runQuery(internal.emailSubscribers.getByEmail)` → DB lookup | Yes — real Convex query against emailSubscribers table | FLOWING |
| `sendEmailStep` idempotency | `existing.status` | `ctx.runQuery(internal.emailSends.getByOrderStep)` → by_orderId_step index | Yes — O(1) indexed Convex query | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| OFFSETS_MS has 8 entries and exact values | `grep -c "DAY_MS" packages/emails/src/offsets.ts` | Constants present | PASS |
| "use node" is first line of emailActions.ts | `head -1 convex/emailActions.ts` | `"use node"` | PASS |
| E3 template body contains no "arrived"/"delivered" | `grep -in "arrived\|delivered" packages/emails/src/templates/DeliveredEstimate.tsx` | No matches in copy (only function name) | PASS |
| Transactional layout does not pass unsubscribeToken to Footer | Source read of `TransactionalLayout.tsx` | Footer called with no unsubscribeToken | PASS |
| Marketing layout passes unsubscribeToken to Footer | Source read of `MarketingLayout.tsx` | Footer called with `unsubscribeToken={unsubscribeToken ?? undefined}` | PASS |
| stripeOrders.insert preserves return null | `grep "return null" convex/stripeOrders.ts` | Found; return orderId absent | PASS |
| selectProvider returns FakeEmailProvider by default | Source read of provider.ts | Only returns ResendProvider when EMAIL_LIVE_SEND==='true' && RESEND_API_KEY | PASS |
| scheduler.cancel present in unsubscribeByToken | `grep "scheduler.cancel" convex/emailSubscribers.ts` | Found in cancellation loop | PASS |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| EMAIL-01 | 20-01, 20-03 | 8 purchase-anchored offsets encoded as exact ms constants; steps 1-3 transactional, 4-8 marketing | SATISFIED | `OFFSETS_MS`, `STEP_STREAM`, `isMarketingStep`, `SUBJECTS` all present and unit-tested in `email-offsets.test.ts` |
| EMAIL-02 | 20-01, 20-02, 20-03 | Send ledger is idempotent: never double-send a step | SATISFIED | `shouldSendStep` + `emailSends.getByOrderStep` idempotency gate in `sendEmailStep`; `email-idempotency.test.ts` green |
| EMAIL-03 | 20-01, 20-02, 20-03, 20-05 | Unsubscribe suppresses marketing (4-8) but transactional (1-3) always send | SATISFIED | `shouldSuppressStep` in `sendEmailStep`; `shouldCancelOnUnsubscribe` in `unsubscribeByToken`; both unit-tested |
| EMAIL-04 | 20-04 | Templates render charity personalization in the funded-charity footer (E1-E6) | SATISFIED | Footer renders `charity.name`/`charity.location`; E1 render test asserts "The Nap Ministry" in HTML |
| EMAIL-05 | 20-04 | Marketing emails carry one-click unsubscribe link (/api/email/unsubscribe?token=...) | SATISFIED | MarketingLayout passes unsubscribeToken to Footer; E4 render test asserts `/api/email/unsubscribe?token=abc` in HTML |
| EMAIL-06 | 20-04 | Transactional emails carry NO unsubscribe link | SATISFIED | TransactionalLayout does not pass unsubscribeToken; E1 render test asserts `/api/email/unsubscribe` absent from HTML |
| EMAIL-07 | 20-01 | Unsubscribe tokens are 64-char hex, collision-resistant | SATISFIED | `generateUnsubscribeToken()` = `randomBytes(32).toString('hex')`; regex assertion in `email-token.test.ts` |
| EMAIL-08 | 20-04 | E3 never claims a verified delivery (no "arrived"/"delivered" in copy or subject) | SATISFIED | `DeliveredEstimate.tsx` uses "should reach you"/"estimate" framing; `SUBJECTS[3]` delivery-safe; asserted in `email-templates.test.ts` and `email-offsets.test.ts` |
| EMAIL-09 | 20-02, 20-03 | Missing customerEmail marks all 8 steps 'skipped'; enqueue never throws; order write never fails | SATISFIED | `planEnqueue` returns `skip:true`; `enqueueEmailFlow` markSkipped loop + early return; stripeOrders try/catch; `email-enqueue-missing-email.test.ts` green |
| EMAIL-10 | 20-05 | GET/POST /api/email/unsubscribe?token=... one-click unsubscribe (RFC 8058) | SATISFIED | Route exports GET + POST; runtime=nodejs; 400 on missing/blank token; 200 text/html + Convex mutation on valid token; `email-unsubscribe-route.test.ts` green |

**Notes on REQUIREMENTS.md cross-reference:** EMAIL-01 through EMAIL-10 are Phase 20-specific requirements defined in the PLAN frontmatter files. They do not yet appear in the top-level `.planning/REQUIREMENTS.md` traceability table (that document currently covers through P19-* and does not list email requirements). This is an orphan by omission in the master requirements file — the requirements are fully defined in the phase plans and verified here, but REQUIREMENTS.md should be updated to add the EMAIL-* block and traceability rows as a housekeeping task.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| All 8 template files | 1 | `// TODO(Andrew): voice sign-off required before live sending` | Info | Intentional launch gate marker — not a stub, copy is substantive draft content. Per BRIEF, Andrew's voice approval is a go-live prerequisite, not a build gate. |
| `packages/emails/src/subjects.ts` | 1 | `// TODO(Andrew): voice sign-off required on all 8 subject lines` | Info | Same as above — intentional, per BRIEF. |
| `packages/emails/src/layouts/Footer.tsx` | 32 | `postalAddress ?? 'TODO(Andrew): postal address'` | Info | Intentional placeholder per BRIEF — CAN-SPAM postal address is an external go-live dependency Andrew provides. |
| `convex/emailFlow.ts` | 17-20 | Inline copies of `offsetForStep` and `planEnqueue` instead of importing from `@eisenbalm/emails` | Warning | The comment explains: the Convex mutation runtime cannot resolve `@eisenbalm/emails` barrel because the barrel re-exports `token.ts` (node:crypto) and `provider.ts` (resend), which are unavailable in the Convex mutation sandbox. The inline copies are byte-for-byte identical to the exported versions. The action runtime (`emailActions.ts`) uses `"use node"` and imports from `@eisenbalm/emails` directly — only the mutation runtime has this constraint. No functional gap. |

No blockers found. The TODO markers are all intentional pre-launch gates documented in the BRIEF. The inline helper copies in `emailFlow.ts` are a documented Convex bundler constraint workaround with identical behavior.

---

## Human Verification Required

### 1. Jesse Voice Sign-Off

**Test:** Andrew reads all 8 template files in `packages/emails/src/templates/*.tsx` and all 8 subject lines in `packages/emails/src/subjects.ts`
**Expected:** Copy passes the "dry, precise, absurdly serious, no winking" voice standard; no exclamation marks; no sentiment; E2 "handed to carrier" beat lands correctly; E5 charity receipt reads as gravity, not charity marketing
**Why human:** Brand voice is an editorial judgment. The BRIEF explicitly states "Andrew's voice sign-off on the 8 copy beats — drafts ship for approval, NOT auto-send." No automated rubric substitutes for the human editorial gate.

### 2. Live Sending End-to-End

**Test:** Set `EMAIL_LIVE_SEND=true` + valid `RESEND_API_KEY` + verified sending subdomains, place a test order, verify all 8 emails arrive at the correct offsets
**Expected:** E1 arrives within seconds; E4-E8 carry functional List-Unsubscribe headers; clicking the unsubscribe link at `GET /api/email/unsubscribe?token=...` shows the HTML confirmation and stops the marketing stream
**Why human:** Requires Resend account with verified DNS (SPF/DKIM/DMARC), CAN-SPAM postal address, and live EMAIL_LIVE_SEND flag — all explicit BRIEF go-live prerequisites out of scope for this build phase.

---

## Gaps Summary

No gaps. All 10 EMAIL-* requirements are satisfied by the implemented code.

The two items above are human verification items, not gaps — they are go-live prerequisites the BRIEF explicitly defers from the build phase.

One housekeeping note: EMAIL-01 through EMAIL-10 requirements are not yet listed in `.planning/REQUIREMENTS.md`'s traceability table. The coverage count in that file reads "110 total" and the table ends at P19-07. Adding a Phase 20 block to REQUIREMENTS.md is recommended before the next roadmap review, but does not affect this phase's pass status.

---

_Verified: 2026-06-05_
_Verifier: Claude (gsd-verifier)_
