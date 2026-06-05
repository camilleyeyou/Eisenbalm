---
phase: 20
slug: post-purchase-email-lifecycle-8-email-flow
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-05
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seed contract — the planner refines the Per-Task Verification Map against the
> Validation Architecture section of 20-RESEARCH.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/web) |
| **Config file** | apps/web/vitest.config.ts |
| **Quick run command** | `cd apps/web && npx vitest run <target test>` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~3 seconds (current suite: 32 files / 288 tests) |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted `npx vitest run <file>`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|-----------|-------------------|------|--------|
| 20-01 T2 | 20-01 | 1 | EMAIL-01 | unit | `cd apps/web && npx vitest run __tests__/email-offsets.test.ts` | email-offsets.test.ts | ⬜ pending |
| 20-01 T2 | 20-01 | 1 | EMAIL-03 | unit | `cd apps/web && npx vitest run __tests__/email-suppression.test.ts` | email-suppression.test.ts | ⬜ pending |
| 20-01 T2 | 20-01 | 1 | EMAIL-07 | unit | `cd apps/web && npx vitest run __tests__/email-token.test.ts` | email-token.test.ts | ⬜ pending |
| 20-01 T2 | 20-01 | 1 | EMAIL-02 | unit | `cd apps/web && npx vitest run __tests__/email-idempotency.test.ts` | email-idempotency.test.ts | ⬜ pending |
| 20-01 T3 | 20-01 | 1 | EMAIL (provider OFF) | unit | `cd apps/web && npx vitest run __tests__/email-provider.test.ts` | email-provider.test.ts | ⬜ pending |
| 20-01 T2 | 20-01 | 1 | EMAIL-04/05/06/08 (Wave-0 skeleton) | unit (it.todo) | `cd apps/web && npx vitest run __tests__/email-templates.test.ts` | email-templates.test.ts (skeleton) | ⬜ pending |
| 20-02 T1-3 | 20-02 | 1 | EMAIL-02/03/09 | deploy | `pnpm --filter @eisenbalm/convex dev:once` | convex schema+fns | ⬜ pending |
| 20-03 T1 | 20-03 | 2 | charity GROQ | unit | `cd apps/web && npx vitest run __tests__/email-charity-queries.test.ts` | email-charity-queries.test.ts | ⬜ pending |
| 20-03 T2 | 20-03 | 2 | EMAIL-09 | unit | `cd apps/web && npx vitest run __tests__/email-enqueue-missing-email.test.ts` | email-enqueue-missing-email.test.ts | ⬜ pending |
| 20-03 T3 | 20-03 | 2 | EMAIL-01/02/03 | deploy+grep | `pnpm --filter @eisenbalm/convex dev:once` | convex emailActions/crons | ⬜ pending |
| 20-04 T3 | 20-04 | 3 | EMAIL-04/05/06/08 | unit (fills Wave-0 skeleton) | `cd apps/web && npx vitest run __tests__/email-templates.test.ts` | email-templates.test.ts (filled) | ⬜ pending |
| 20-05 T1 | 20-05 | 3 | EMAIL-03 | unit | `cd apps/web && npx vitest run __tests__/email-unsubscribe-cancel.test.ts` | email-unsubscribe-cancel.test.ts | ⬜ pending |
| 20-05 T2 | 20-05 | 3 | EMAIL-10 | unit | `cd apps/web && npx vitest run __tests__/email-unsubscribe-route.test.ts` | email-unsubscribe-route.test.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Convex deploy rows have no vitest coverage (no official Convex unit-test SDK) — their logic is covered by the pure-helper unit tests the Convex fns call (planEnqueue, shouldSuppressStep, shouldSendStep, shouldCancelOnUnsubscribe, GROQ builders).*

---

## Wave 0 Requirements

- [x] Test harness for Convex email-flow logic — SEAM CHOSEN: extract all decision logic into pure functions in `@eisenbalm/emails` (`offsets`, `suppression.shouldSuppressStep`/`shouldSendStep`/`shouldCancelOnUnsubscribe`, `enqueuePlan.planEnqueue`, `charity` GROQ builders, `token`). The Convex mutations/actions call these same helpers, so vitest coverage of the helpers covers the real decisions. Authored in Plans 20-01 (Wave 0 tests) and 20-03/20-05.
- [x] Provider abstraction / dry-run mode (Plan 20-01 Task 3): `SendEmailProvider` interface + `ResendProvider` + `FakeEmailProvider` + `selectProvider(env)` with live sending OFF unless `EMAIL_LIVE_SEND==='true'` AND `RESEND_API_KEY` present. Entire flow is testable with the Fake provider and no network.
- [x] Template render test seam (`apps/web/__tests__/email-templates.test.ts`) — CREATED in Wave 1 (Plan 20-01 Task 2) as an `it.todo` skeleton reserving EMAIL-04/05/06/08; FILLED with real `renderEmailStep` assertions in Wave 3 (Plan 20-04 Task 3) once the templates exist. The file is a Wave-0 artifact (reserved up front) even though its assertions land alongside the template implementation it must test (the templates cannot be imported until 20-04). Plan 20-01 also sets `packages/emails/tsconfig.json` (`jsx: react-jsx` + `.tsx` include) so the `.tsx` render seam (20-03) and templates (20-04) compile with no later rename.

*Wave 0 finalized: pure-helper extraction + provider abstraction + the email-templates test seam (skeleton) + tsx-ready tsconfig land in Wave 1 (Plan 20-01) before any Convex wiring or template code consumes them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real deliverability / inbox placement | go-live | Requires verified DNS (SPF/DKIM/DMARC) + Resend domains | Launch prerequisite, not a build gate |
| Jesse-voice copy approval (8 beats) | voice gate | Brand voice is a human editorial decision (Andrew) | Andrew reviews drafts before live sending is enabled |

*All build-time behaviors (enqueue, idempotency, offset correctness, unsubscribe suppression, per-order charity resolution) must have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-06-05
