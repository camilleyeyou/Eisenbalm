---
phase: 29-deployment-hardening-code-fixes
plan: 01
subsystem: auth
tags: [convex, clerk, stripe, pipeline, authorization, constant-time-compare, shared-secret]

# Dependency graph
requires:
  - phase: 21-auth-app-shell-convex-schema
    provides: Clerk JWT forwarding to Convex (ConvexProviderWithClerk, auth.config.ts) — the operator identity lane
  - phase: 23-observability
    provides: auditLog write/record internal+public split — the reference precedent for HTTP-reachable pipeline writes
  - phase: 25-run-control
    provides: PIPELINE_TRIGGER_SECRET fail-closed idiom the pipeline-lane secret mirrors
provides:
  - "convex/lib/auth.ts shared guards: requireOperator, requirePipelineSecret, requireOperatorOrPipeline, requireWebhookSecret (constant-time compare)"
  - "Four-lane Convex mutation authorization: dashboard (Clerk identity), pipeline (shared secret), dual-lane (either), webhook (Stripe secret)"
  - "qaCorrections.insert documented public GAM-05 exception + defensive length cap"
  - "Central pipelineSecret injection in convex_client.py (scoped allowlist)"
  - "Stripe webhook sends STRIPE_TO_CONVEX_SECRET; closes the open email-relay / fake-donation-ledger vector"
  - "convex-test suite proving all four lanes"
affects: [29-02, 29-03, deployment, convex, stripe, pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-secret argument + constant-time compare for server-to-server Convex writes (NOT internalMutation — unreachable via HTTP /api/mutation)"
    - "requireOperatorOrPipeline dual-lane guard (Clerk identity OR pipeline secret)"
    - "Scoped injection allowlist in convex_client.py (Convex rejects undeclared args)"

key-files:
  created:
    - convex/lib/auth.ts
    - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts
  modified:
    - convex/promptVersions.ts
    - convex/pipelineConfig.ts
    - convex/agents.ts
    - convex/claimChecks.ts
    - convex/charities.ts
    - convex/pipelineRuns.ts
    - convex/runs.ts
    - convex/deliberationEvents.ts
    - convex/agentVotes.ts
    - convex/pitchLog.ts
    - convex/reviewActions.ts
    - convex/auditLog.ts
    - convex/qaCorrections.ts
    - convex/stripeEvents.ts
    - convex/stripeOrders.ts
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - apps/web/lib/stripe/handlers.ts
    - apps/web/.env.example
    - packages/pipeline/.env.example
    - apps/dispatch-control/__tests__/activate.test.ts
    - apps/dispatch-control/__tests__/saveVersion.test.ts
    - apps/dispatch-control/__tests__/runs.test.ts
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "Followed 29-RESEARCH.md over CONTEXT: public mutations + shared-secret guard, NOT internalMutation (internal functions are unreachable via the HTTP /api/mutation API the pipeline + Stripe webhook use)"
  - "Two distinct secrets (PIPELINE_CONVEX_SECRET, STRIPE_TO_CONVEX_SECRET) so each lane rotates independently"
  - "constantTimeEqual in convex/lib/auth.ts (XOR-accumulate) — Convex V8 runtime has no crypto.timingSafeEqual"
  - "Scoped injection allowlist (_PIPELINE_SECRET_GUARDED_PATHS) instead of unconditional merge — Convex rejects undeclared args, which would break agentRuns:* and any future unguarded mutation"
  - "qaCorrections.insert left deliberately public (GAM-05 anonymous game-validator reporter) + a 2000-char truncation on reason/sectionName as the only feasible hardening; excluded from the injection allowlist"

patterns-established:
  - "Shared-secret Convex guard: pipelineSecret: v.optional(v.string()) arg, destructured out before any db write, validated via requirePipelineSecret with constant-time compare, fails closed on unset/blank env"
  - "Dashboard guard derives the actor from ctx.auth.getUserIdentity().subject; never trusts an incoming actorId arg"

requirements-completed: [D-1]

# Metrics
duration: ~2h15m
completed: 2026-07-03
---

# Phase 29 Plan 01: Convex Auth Lockdown Summary

**Four-lane Convex mutation authorization — dashboard mutations gate on the Clerk JWT, pipeline/webhook writes require a constant-time-compared shared secret, two dual-lane mutations accept either, and qaCorrections.insert stays deliberately public (GAM-05) — closing the spoofable-actorId hole and the open Stripe email-relay/fake-donation vector.**

## Performance

- **Duration:** ~2h 15m (incl. a mid-Task-3 API interruption and resume)
- **Started:** 2026-07-03T18:01:59Z (first task commit)
- **Completed:** 2026-07-03T19:20:00Z
- **Tasks:** 3
- **Files modified:** 23 (2 created, 21 modified)

## Accomplishments
- Added `convex/lib/auth.ts` with four plain-function guards and a length-guarded constant-time string compare (no `crypto.timingSafeEqual` in Convex's V8 runtime).
- Guarded 6 dashboard-only mutations with `requireOperator(ctx)`, deriving the actor from the verified Clerk JWT subject instead of a spoofable `actorId` arg.
- Secret-guarded 18 pipeline/webhook mutations: `requirePipelineSecret` for pipeline-only writes, `requireOperatorOrPipeline` for the two dual-lane mutations (`pipelineConfig.upsert`, `charities.upsertCandidate`), and `requireWebhookSecret` for the two Stripe-webhook writes.
- Left `qaCorrections.insert` public (GAM-05 anonymous reporter) with a documented exception and a defensive 2000-char length cap.
- Wired every caller: central `pipelineSecret` injection in `convex_client.py` (scoped allowlist) so ~25 pipeline call sites needed no edits, and `webhookSecret` on both Stripe calls.
- Added a convex-test suite proving all four lanes; documented both new secret env vars.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared guard helper + identity-guard dashboard mutations** — `8f63e23` (feat)
2. **Task 2: Secret-guard pipeline/webhook/dual-lane; qaCorrections stays public** — `d6342a2` (feat)
3. **Task 3: Update pipeline + Stripe callers, document secrets, convex-test suite** — `3c8007a` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `convex/lib/auth.ts` — the four guard helpers + private `constantTimeEqual`.
- `convex/{promptVersions,pipelineConfig,agents,claimChecks,charities}.ts` — dashboard-lane `requireOperator` guards.
- `convex/{pipelineRuns,runs,deliberationEvents,agentVotes,pitchLog,claimChecks,reviewActions,auditLog,charities}.ts` — pipeline-lane `pipelineSecret` + `requirePipelineSecret`.
- `convex/{pipelineConfig,charities}.ts` — dual-lane `requireOperatorOrPipeline` on `upsert`/`upsertCandidate`.
- `convex/{stripeEvents,stripeOrders}.ts` — required `webhookSecret` + `requireWebhookSecret`.
- `convex/qaCorrections.ts` — documented public exception + `pipelineSecret` arg (ignored) + length cap.
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — central `pipelineSecret` injection via `_PIPELINE_SECRET_GUARDED_PATHS` (18 paths).
- `apps/web/lib/stripe/handlers.ts` — sends `STRIPE_TO_CONVEX_SECRET` on both mutation calls.
- `apps/web/.env.example`, `packages/pipeline/.env.example` — documented the two new secrets (placeholders only).
- `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` — 9 assertions across all four lanes; `vitest.config.ts` registers it as edge-runtime.
- `apps/dispatch-control/__tests__/{activate,saveVersion,runs}.test.ts` — updated existing suites to pass identity / the now-required `pipelineSecret`.

## Decisions Made
- Followed **29-RESEARCH.md over CONTEXT**: kept pipeline/webhook functions as public `mutation`s guarded by a shared-secret argument, because Convex `internalMutation` functions are unreachable via the HTTP `/api/mutation` API the pipeline's admin-key client and the Stripe webhook's `ConvexHttpClient` use — converting them would have broken every pipeline write.
- Two distinct secrets (`PIPELINE_CONVEX_SECRET`, `STRIPE_TO_CONVEX_SECRET`) so each lane rotates independently.
- **Scoped injection allowlist** rather than the plan's literal unconditional merge: Convex validators reject any undeclared arg with a hard "Unexpected field" error (verified empirically against convex-test), so unconditionally injecting `pipelineSecret` would break `agentRuns:*` (untouched internalMutations reached over the same admin-key path) and any future unguarded mutation. `_PIPELINE_SECRET_GUARDED_PATHS` mirrors exactly the 18 enforcing functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped the pipelineSecret injection to an allowlist instead of unconditional merge**
- **Found during:** Task 3 (updating `convex_client.py`)
- **Issue:** The plan's literal instruction — `merged_args = {**args, "pipelineSecret": ...}` on EVERY outgoing mutation — would attach `pipelineSecret` to `agentRuns:*` and other untouched mutations whose validators do not declare it. Convex rejects undeclared args with a hard "Unexpected field" validator error (confirmed empirically with a throwaway convex-test probe), which would break the pipeline's per-agent progress writes.
- **Fix:** Injection is gated behind `_PIPELINE_SECRET_GUARDED_PATHS`, a frozenset of exactly the 18 Convex functions that enforce the secret. All other paths are sent unchanged. `qaCorrections:insert` is deliberately excluded (its arg is optional and ignored).
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`
- **Verification:** `_PIPELINE_SECRET_GUARDED_PATHS` reconciled 1:1 against `grep requirePipelineSecret|requireOperatorOrPipeline convex/*.ts`; pipeline pytest 354 passed; both web/dispatch-control builds green.
- **Committed in:** `3c8007a` (Task 3 commit)

**2. [Rule 1 - Test correctness] Updated existing convex-test suites for the new guards**
- **Found during:** Tasks 1–2
- **Issue:** `activate.test.ts` / `saveVersion.test.ts` called now-Clerk-guarded mutations without an identity; `runs.test.ts` called the now-secret-guarded `runs.create` without `pipelineSecret` — all would have gone red.
- **Fix:** Wrapped the operator calls in `t.withIdentity({subject: ...})` and passed the stubbed `pipelineSecret` on `runs.create` (with `PIPELINE_CONVEX_SECRET` stubbed via `beforeEach`/`afterEach`).
- **Files modified:** `apps/dispatch-control/__tests__/{activate,saveVersion,runs}.test.ts`
- **Verification:** `pnpm --filter dispatch-control test` — 129 passed.
- **Committed in:** `8f63e23`, `d6342a2`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 test-correctness)
**Impact on plan:** Both essential to keep the pipeline writing and the existing suites green. No scope creep — the injection allowlist is a strictly-safer implementation of the plan's stated intent.

## Issues Encountered
- A mid-Task-3 API connection error interrupted execution after the Task 3 files were staged but before commit. Resumed per the coordinator's state hand-off: re-ran all gates, tightened `_PIPELINE_SECRET_GUARDED_PATHS` to exclude `qaCorrections:insert` (public exception), then committed Task 3. Tasks 1–2 were already committed and were not re-done.

## User Setup Required

**External secret provisioning is required before the pipeline/webhook can write again post-deploy** (out of scope for this plan — ships code + docs only):
- `npx convex env set PIPELINE_CONVEX_SECRET <value>` on the Convex deployment, and the SAME value as `PIPELINE_CONVEX_SECRET` on Railway (pipeline).
- `npx convex env set STRIPE_TO_CONVEX_SECRET <value>` on Convex, and the SAME value as `STRIPE_TO_CONVEX_SECRET` on Vercel (apps/web, server-only — never `NEXT_PUBLIC_*`).

The guards fail closed: until these are set on the Convex side, every pipeline/webhook write throws `Unauthorized`. Both `.env.example` files document the vars (placeholders only — no real values committed).

## Next Phase Readiness
- D-1 (Convex auth lockdown) complete. Remaining Phase 29 plans (pipeline FastAPI fail-closed, restart reconciliation, mechanical cleanups) are independent and unblocked.
- Verification gates all green: `pnpm typecheck:convex`, `pnpm --filter web build`, `pnpm --filter dispatch-control build`, `pnpm --filter dispatch-control test` (129 passed incl. 9 new lockdown assertions), pipeline `uv run pytest -q` (354 passed / 33 skipped).

---
*Phase: 29-deployment-hardening-code-fixes*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: convex/lib/auth.ts
- FOUND: apps/dispatch-control/__tests__/convexAuthLockdown.test.ts
- FOUND: .planning/phases/29-deployment-hardening-code-fixes/29-01-SUMMARY.md
- FOUND commit: 8f63e23 (Task 1)
- FOUND commit: d6342a2 (Task 2)
- FOUND commit: 3c8007a (Task 3)
