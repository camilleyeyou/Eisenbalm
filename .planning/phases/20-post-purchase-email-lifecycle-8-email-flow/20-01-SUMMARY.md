---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 01
subsystem: email
tags: [typescript, vitest, tdd, workspace, resend, crypto, email-lifecycle]

# Dependency graph
requires:
  - phase: 20-post-purchase-email-lifecycle-8-email-flow
    provides: BRIEF + RESEARCH defining purchase-anchored offsets, suppression rules, idempotency contract, and Resend as delivery provider

provides:
  - "@eisenbalm/emails workspace package (source-resolution, no build step, .tsx-ready from day 1)"
  - "OFFSETS_MS (8 purchase-anchored ms constants, E1+0 through E8+42d)"
  - "isMarketingStep + STEP_STREAM (transactional/marketing split, steps 1-3 vs 4-8)"
  - "shouldSuppressStep (CAN-SPAM: transactional always sends, marketing suppressed when unsubscribed)"
  - "shouldSendStep (idempotency gate: returns false only when existing row status==='sent')"
  - "generateUnsubscribeToken (64-char hex, node:crypto, collision-resistant)"
  - "SUBJECTS record (8 deadpan Jesse-voice draft subject lines, step 3 delivery-estimate-safe)"
  - "SendEmailProvider interface + FakeEmailProvider + ResendProvider (lazy import) + selectProvider (live OFF by default)"
  - "5 vitest files (39 pure-helper tests + 8 provider tests + 5 it.todo Wave-0 skeletons for EMAIL-04/05/06/08)"

affects:
  - 20-02-convex-data-model
  - 20-03-convex-flow-engine
  - 20-04-react-email-templates
  - 20-05-unsubscribe-route-and-cancellation

# Tech tracking
tech-stack:
  added:
    - "@eisenbalm/emails workspace package (packages/emails/)"
  patterns:
    - "Source-resolution workspace (no build step, main/types both point to src/index.ts) — mirrors @eisenbalm/shared"
    - "tsconfig.json includes both .ts and .tsx with jsx:react-jsx set up from day 1 (no later rename needed)"
    - "TDD for pure helpers: RED (test fails) → GREEN (minimal impl) → commit"
    - "Lazy dynamic import for Resend (await import('resend')) keeps package dep-free at module load"
    - "Dependency-count tripwire tests updated on each planned dep addition (Phase 19 baseline 18 → Phase 20 baseline 19)"

key-files:
  created:
    - packages/emails/package.json
    - packages/emails/tsconfig.json
    - packages/emails/src/index.ts
    - packages/emails/src/offsets.ts
    - packages/emails/src/suppression.ts
    - packages/emails/src/token.ts
    - packages/emails/src/subjects.ts
    - packages/emails/src/provider.ts
    - apps/web/__tests__/email-offsets.test.ts
    - apps/web/__tests__/email-suppression.test.ts
    - apps/web/__tests__/email-token.test.ts
    - apps/web/__tests__/email-idempotency.test.ts
    - apps/web/__tests__/email-templates.test.ts
    - apps/web/__tests__/email-provider.test.ts
  modified:
    - apps/web/package.json
    - apps/web/__tests__/archive-cardswap.test.ts
    - apps/web/__tests__/archive-pagination.test.ts
    - pnpm-lock.yaml

key-decisions:
  - "provider.ts created in Task 2 (not Task 3) to unblock barrel import — barrel lists all 5 modules so tests would fail before provider existed; Task 3 added only the test file"
  - "SUBJECTS[3] uses 'It should reach you any day now.' — avoids 'arrived'/'delivered' per delivery-estimate-safe requirement"
  - "Dependency-count tripwires updated to 19 (was 18) as a Rule 1 auto-fix — adding @eisenbalm/emails is a planned planned step"

patterns-established:
  - "Pattern: Pure functions in packages/emails/src/ have zero Convex/React imports — safe for vitest node environment"
  - "Pattern: SubscriberLike and SendRowLike typed as null|undefined-accepting unions so callers don't need to pre-check"
  - "Pattern: Wave-0 it.todo skeleton in email-templates.test.ts reserves coverage seam for Plan 20-04"

requirements-completed: [EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-07]

# Metrics
duration: 10min
completed: 2026-06-05
---

# Phase 20 Plan 01: Emails Package and Pure Helpers Summary

**@eisenbalm/emails workspace package with 8 purchase-anchored offset constants, marketing-suppression, idempotency gate, 64-char unsubscribe token, Jesse-voice subject drafts, and env-gated Resend/Fake provider — 47 tests green**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-05T05:52:13Z
- **Completed:** 2026-06-05T06:02:20Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Scaffolded `@eisenbalm/emails` workspace package mirroring `@eisenbalm/shared` pattern, pre-wired for `.tsx` (Plan 20-03 and 20-04 need no tsconfig change)
- Implemented 8 pure helpers (zero Convex/React imports) that all Wave 2-4 plans build on: OFFSETS_MS, STEP_STREAM, isMarketingStep, shouldSuppressStep, shouldSendStep, generateUnsubscribeToken, SUBJECTS, and the full provider abstraction
- 47 tests green (39 pure helpers + 8 provider), 5 Wave-0 it.todo skeletons reserved for Plan 20-04 template tests; full suite 329 passed / 0 failed

## Task Commits

1. **Task 1: Scaffold @eisenbalm/emails workspace package** - `c42a3d4` (feat)
2. **Task 2: Pure helpers — offsets, suppression, idempotency, token, subjects** - `4da55b8` (feat)
3. **Task 3: SendEmailProvider abstraction** - `fc2a28d` (feat)
4. **[Rule 1 auto-fix] Update dependency count tripwires** - `7b6cb97` (fix)

## Files Created/Modified

- `packages/emails/package.json` - @eisenbalm/emails workspace package, source-resolution, typecheck script
- `packages/emails/tsconfig.json` - extends base, jsx:react-jsx, includes .ts and .tsx
- `packages/emails/src/index.ts` - barrel re-exporting all 5 modules
- `packages/emails/src/offsets.ts` - OFFSETS_MS (8 entries), STEP_STREAM, isMarketingStep, offsetForStep
- `packages/emails/src/suppression.ts` - shouldSuppressStep + shouldSendStep + SubscriberLike/SendRowLike types
- `packages/emails/src/token.ts` - generateUnsubscribeToken() via node:crypto
- `packages/emails/src/subjects.ts` - SUBJECTS record (8 deadpan subjects, step 3 delivery-estimate-safe)
- `packages/emails/src/provider.ts` - SendEmailProvider interface, FakeEmailProvider, ResendProvider (lazy import), selectProvider
- `apps/web/__tests__/email-offsets.test.ts` - 20 tests covering OFFSETS_MS, STEP_STREAM, isMarketingStep, SUBJECTS
- `apps/web/__tests__/email-suppression.test.ts` - 8 tests for shouldSuppressStep
- `apps/web/__tests__/email-token.test.ts` - 4 tests for generateUnsubscribeToken
- `apps/web/__tests__/email-idempotency.test.ts` - 7 tests for shouldSendStep
- `apps/web/__tests__/email-templates.test.ts` - Wave-0 it.todo skeleton for EMAIL-04/05/06/08
- `apps/web/__tests__/email-provider.test.ts` - 8 tests for FakeEmailProvider + selectProvider
- `apps/web/package.json` - added @eisenbalm/emails workspace:* dependency
- `apps/web/__tests__/archive-cardswap.test.ts` - updated dep count tripwire 18→19
- `apps/web/__tests__/archive-pagination.test.ts` - updated dep count tripwire 18→19
- `pnpm-lock.yaml` - workspace link resolved

## Decisions Made

- **provider.ts in Task 2 not Task 3**: The barrel exports all 5 modules including provider; task 2 tests would fail if provider didn't exist at module load time. Created full provider implementation during Task 2; Task 3 then added the dedicated test file. No behavior difference.
- **SUBJECTS[3] wording**: "It should reach you any day now." — avoids "arrived" and "delivered" per delivery-estimate-safe requirement while maintaining Jesse's deadpan precision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated dependency count tripwire tests (18→19)**
- **Found during:** Final test suite run (after Task 3)
- **Issue:** `archive-cardswap.test.ts` and `archive-pagination.test.ts` both assert `pkg.dependencies.length === 18`; adding `@eisenbalm/emails` bumped the count to 19, causing 2 failures
- **Fix:** Updated both tripwires to assert 19 and updated comments to document Phase 20 as the reason
- **Files modified:** `apps/web/__tests__/archive-cardswap.test.ts`, `apps/web/__tests__/archive-pagination.test.ts`
- **Verification:** Full suite 329 passed / 0 failed
- **Committed in:** `7b6cb97`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — tripwire count stale after planned dep addition)
**Impact on plan:** Necessary correctness fix; no scope creep.

## Issues Encountered

None — implementation matched the plan spec exactly.

## User Setup Required

None - no external service configuration required by this plan. Resend key and DNS (SPF/DKIM/DMARC) are required before live sending but are Plan 20-03/20-04 concerns.

## Next Phase Readiness

- **Plan 20-02 (Convex data model)**: `emailSubscribers` + `emailSends` tables can be typed against `SubscriberLike` and `SendRowLike` from this package
- **Plan 20-03 (Convex flow engine)**: Import `OFFSETS_MS`, `shouldSuppressStep`, `shouldSendStep` from `@eisenbalm/emails` in Convex scheduled functions
- **Plan 20-04 (React Email templates)**: The `.tsx` tsconfig seam is already in place; `packages/emails/src/provider.ts` has the lazy `import('resend')` for `@react-email/render` compatibility
- **Blocker for go-live** (not build): Resend API key + sending subdomain DNS, CAN-SPAM postal address, Andrew voice sign-off on 8 subject lines

---
*Phase: 20-post-purchase-email-lifecycle-8-email-flow*
*Completed: 2026-06-05*
