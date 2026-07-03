---
phase: 29-deployment-hardening-code-fixes
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/lib/auth.ts
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
  - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts
autonomous: true
requirements: [D-1]
must_haves:
  truths:
    - "A Convex dashboard mutation called with no Clerk identity throws Unauthorized"
    - "A pipeline-facing Convex mutation called without the correct pipeline secret throws Unauthorized"
    - "The dual-lane mutations (pipelineConfig.upsert, charities.upsertCandidate) succeed from EITHER a Clerk identity OR a correct pipeline secret"
    - "qaCorrections.insert stays callable with no identity and no secret (GAM-05 anonymous reader path)"
    - "The pipeline (admin-key HTTP client) still writes run/deliberation/vote/pitch/QA events after the change"
    - "The Stripe webhook still records orders and triggers email using the webhook secret"
  artifacts:
    - path: "convex/lib/auth.ts"
      provides: "requireOperator + requirePipelineSecret + requireOperatorOrPipeline guards with constant-time secret compare"
      contains: "requireOperator"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py"
      provides: "central pipelineSecret injection into every outgoing mutation"
      contains: "PIPELINE_CONVEX_SECRET"
    - path: "apps/dispatch-control/__tests__/convexAuthLockdown.test.ts"
      provides: "convex-test coverage of all four guard classes"
  key_links:
    - from: "packages/pipeline/.../lib/convex_client.py::convex_mutation"
      to: "guarded Convex mutations"
      via: "pipelineSecret arg injected before POST /api/mutation"
      pattern: "pipelineSecret"
    - from: "apps/web/lib/stripe/handlers.ts"
      to: "stripeEvents.claim / stripeOrders.insert"
      via: "webhookSecret arg from STRIPE_TO_CONVEX_SECRET"
      pattern: "webhookSecret"
---

<objective>
Close the D-1 Convex authorization hole: today nearly every Convex `mutation` is public and trusts a spoofable `actorId`/`workspace_id` argument, and the Stripe webhook writes orders through an unauthenticated `ConvexHttpClient` (an open email-relay + fake-donation-ledger vector). Lock every mutation into the correct one of four lanes and update every caller so nothing breaks.

Purpose: no Convex write can be performed by an unauthenticated/spoofed caller, except the one deliberate public exception (GAM-05).
Output: a shared guard helper, guarded mutations, updated pipeline + Stripe callers, documented secret env vars, and a convex-test suite proving all four lanes.

**CRITICAL — follow 29-RESEARCH.md, NOT the superseded CONTEXT text.** Do NOT convert pipeline/webhook mutations to `internalMutation` (they are unreachable via the HTTP `/api/mutation` API and this would break the pipeline). Use public `mutation`s guarded by a shared-secret argument, mirroring the existing `convex/auditLog.ts` `write`/`record` precedent and the `convex/payouts.ts::markPayoutSent` identity guard.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/29-deployment-hardening-code-fixes/29-RESEARCH.md
@.planning/phases/29-deployment-hardening-code-fixes/29-CONTEXT.md
@docs/API_CONTRACTS.md

<interfaces>
Reference guard idiom already in the repo (replicate for the dashboard lane):

From convex/payouts.ts / convex/users.ts / convex/pipelineConfig.ts::setNotificationConfig:
```typescript
const identity = await ctx.auth.getUserIdentity()
if (!identity) throw new Error('Unauthorized')
const actorId = identity.subject   // Clerk userId — use for audit, NOT a trusted arg
```

Reference internal/public split (do NOT restructure — just add the secret arg to `record`):
From convex/auditLog.ts: `write` = internalMutation (ctx.runMutation only); `record` = public mutation for the FastAPI pipeline.

Pipeline caller central injection point (only place that needs editing for ~25 call sites):
From packages/pipeline/.../lib/convex_client.py::convex_mutation — merge the secret into `args` before POST.

Stripe caller:
From apps/web/lib/stripe/handlers.ts::getConvexClient — `new ConvexHttpClient(url)` today with no auth; add the webhook secret as a mutation arg instead.
</interfaces>

Convex default (V8) runtime has NO `crypto.timingSafeEqual`. Implement a small length-guarded constant-time string compare in `convex/lib/auth.ts` (XOR-accumulate over char codes) rather than importing Node crypto.

Env var names (per research recommendation, two distinct secrets so each rotates independently):
- `PIPELINE_CONVEX_SECRET` — pipeline lane (pipeline sends it; Convex validates it)
- `STRIPE_TO_CONVEX_SECRET` — Stripe-webhook lane (server-only Next var; never `NEXT_PUBLIC_*`)

Both secret VALUES are set externally (out of scope). Ship code that fails closed when the secret is absent/blank on the Convex side.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Shared guard helper + identity-guard the dashboard-lane mutations</name>
  <files>convex/lib/auth.ts, convex/promptVersions.ts, convex/pipelineConfig.ts, convex/agents.ts, convex/claimChecks.ts, convex/charities.ts</files>
  <read_first>
    - convex/payouts.ts (markPayoutSent — reference identity guard)
    - convex/users.ts (upsertCurrentUser — reference identity guard)
    - convex/pipelineConfig.ts (setNotificationConfig already guarded; setAutoPublish + upsert here)
    - convex/promptVersions.ts, convex/agents.ts, convex/claimChecks.ts, convex/charities.ts
    - convex/AGENTS.md and convex/CLAUDE.md (Convex API rules / project conventions that override training data)
  </read_first>
  <action>
    Create `convex/lib/auth.ts` exporting THREE helpers (plain functions, NOT registered as Convex functions):
    - `requireOperator(ctx): Promise<string>` — `const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error('Unauthorized'); return identity.subject`.
    - `requirePipelineSecret(secret?: string): void` — read `process.env.PIPELINE_CONVEX_SECRET`; if it is unset/blank OR `secret` is missing OR `!constantTimeEqual(secret, expected)` → `throw new Error('Unauthorized')`.
    - `requireOperatorOrPipeline(ctx, secret?): Promise<{ actor: string; isPipeline: boolean }>` — return `{actor: identity.subject, isPipeline:false}` when identity present; else if the pipeline secret validates return `{actor:'pipeline', isPipeline:true}`; else throw `'Unauthorized'`.
    - Include a private `constantTimeEqual(a: string, b: string): boolean` — return false if lengths differ, else XOR-accumulate char codes and return accumulator === 0.

    Apply `requireOperator(ctx)` at the top of the handler of each DASHBOARD-ONLY mutation (derive `actorId` from the returned subject where the handler currently trusts an `actorId`/`workspace_id` arg for attribution — keep the arg in the signature only if a downstream write needs `workspace_id`, but NEVER trust an incoming `actorId` for identity):
    - `convex/promptVersions.ts`: `upsertActive`, `saveVersion`, `activate`
    - `convex/pipelineConfig.ts`: `setAutoPublish` (leave `setNotificationConfig` as-is; `upsert` is Task 2 dual-lane)
    - `convex/agents.ts`: `upsert`
    - `convex/claimChecks.ts`: `setStatus`
    - `convex/charities.ts`: `setStatus`
    Do NOT touch `payouts.markPayoutSent`, `users.upsertCurrentUser`, `pipelineConfig.setNotificationConfig` (already guarded).
  </action>
  <verify>
    <automated>pnpm typecheck:convex</automated>
  </verify>
  <acceptance_criteria>
    - `test -f convex/lib/auth.ts` && `grep -q "requireOperator" convex/lib/auth.ts` && `grep -q "requirePipelineSecret" convex/lib/auth.ts` && `grep -q "requireOperatorOrPipeline" convex/lib/auth.ts`
    - `grep -c "getUserIdentity" convex/lib/auth.ts` >= 1 and a length-guarded constant-time compare exists (`grep -q "length" convex/lib/auth.ts`)
    - Each of promptVersions.ts (upsertActive/saveVersion/activate), pipelineConfig.ts (setAutoPublish), agents.ts (upsert), claimChecks.ts (setStatus), charities.ts (setStatus) calls `requireOperator` — `grep -l "requireOperator" convex/promptVersions.ts convex/pipelineConfig.ts convex/agents.ts convex/claimChecks.ts convex/charities.ts` lists all five
    - `pnpm typecheck:convex` exits 0
  </acceptance_criteria>
  <done>Dashboard mutations derive the actor from the Clerk JWT and throw on anonymous callers; Convex typecheck is green.</done>
</task>

<task type="auto">
  <name>Task 2: Secret-guard the pipeline + webhook lanes; dual-lane guard; leave qaCorrections public</name>
  <files>convex/pipelineRuns.ts, convex/runs.ts, convex/deliberationEvents.ts, convex/agentVotes.ts, convex/pitchLog.ts, convex/claimChecks.ts, convex/reviewActions.ts, convex/auditLog.ts, convex/charities.ts, convex/pipelineConfig.ts, convex/qaCorrections.ts, convex/stripeEvents.ts, convex/stripeOrders.ts, convex/lib/auth.ts</files>
  <read_first>
    - convex/lib/auth.ts (from Task 1)
    - convex/auditLog.ts (record — reference; add secret arg, do NOT restructure the write/record split)
    - convex/pipelineRuns.ts, convex/runs.ts, convex/deliberationEvents.ts, convex/agentVotes.ts, convex/pitchLog.ts
    - convex/claimChecks.ts, convex/reviewActions.ts, convex/charities.ts, convex/pipelineConfig.ts
    - convex/qaCorrections.ts, convex/stripeEvents.ts, convex/stripeOrders.ts
    - apps/web/components/issue/GameSlot.tsx (proves qaCorrections.insert is an anonymous-reader caller — GAM-05)
  </read_first>
  <action>
    For every PIPELINE-LANE mutation, add `pipelineSecret: v.optional(v.string())` to `args` and call `requirePipelineSecret(args.pipelineSecret)` first thing in the handler (do not persist `pipelineSecret`; destructure it out before any `db.insert`/`db.patch`):
    - `pipelineRuns.ts`: create, updateStatus
    - `runs.ts`: create, updateStatus, requestCancel, setConfigSnapshot, setScheduledPublish
    - `deliberationEvents.ts`: insert
    - `agentVotes.ts`: insert
    - `pitchLog.ts`: insert, markSelected
    - `claimChecks.ts`: insertBatch
    - `reviewActions.ts`: record
    - `auditLog.ts`: `record` ONLY (keep `write` internalMutation untouched, keep `listForWorkspace` untouched)
    - `charities.ts`: upsertFeatured, seedFromPublished

    For the TWO DUAL-LANE mutations add `pipelineSecret: v.optional(v.string())` and call `await requireOperatorOrPipeline(ctx, args.pipelineSecret)` (accepts a Clerk operator OR the pipeline secret):
    - `pipelineConfig.ts`: upsert
    - `charities.ts`: upsertCandidate

    For the WEBHOOK lane add `webhookSecret: v.string()` (required) and guard with a constant-time compare against `process.env.STRIPE_TO_CONVEX_SECRET` (reuse `constantTimeEqual` via a small `requireWebhookSecret` in convex/lib/auth.ts, or inline the same length-guarded compare); throw `'Unauthorized'` on absent/blank env or mismatch:
    - `stripeEvents.ts`: claim
    - `stripeOrders.ts`: insert

    For `qaCorrections.ts::insert` (intentional public exception — GAM-05): do NOT add any auth guard. Add `pipelineSecret: v.optional(v.string())` to its `args` ONLY so the centrally-injected pipeline arg (Task 3) passes validation, and ignore it in the handler. Add a code comment explaining it must stay public (anonymous reader reports a rejected game embed) and add a defensive handler-side length cap: truncate `reason` and `sectionName` to <= 2000 chars before insert.
  </action>
  <verify>
    <automated>pnpm typecheck:convex</automated>
  </verify>
  <acceptance_criteria>
    - `grep -l "requirePipelineSecret" convex/pipelineRuns.ts convex/runs.ts convex/deliberationEvents.ts convex/agentVotes.ts convex/pitchLog.ts convex/claimChecks.ts convex/reviewActions.ts convex/auditLog.ts convex/charities.ts` lists all nine files
    - `grep -q "requireOperatorOrPipeline" convex/pipelineConfig.ts` && `grep -q "requireOperatorOrPipeline" convex/charities.ts`
    - `grep -q "STRIPE_TO_CONVEX_SECRET" convex/stripeEvents.ts convex/stripeOrders.ts convex/lib/auth.ts` (env var referenced in the webhook guard)
    - `grep -q "webhookSecret" convex/stripeEvents.ts` && `grep -q "webhookSecret" convex/stripeOrders.ts`
    - `convex/qaCorrections.ts` has NO `requirePipelineSecret`/`requireOperator` call (`grep -c "requireOperator\|requirePipelineSecret" convex/qaCorrections.ts` == 0) but DOES declare `pipelineSecret: v.optional` (`grep -q "pipelineSecret" convex/qaCorrections.ts`)
    - `convex/auditLog.ts` still exports both `write` (internalMutation) and `record` (`grep -q "internalMutation" convex/auditLog.ts`)
    - `pnpm typecheck:convex` exits 0
  </acceptance_criteria>
  <done>Every pipeline/webhook write is secret-guarded, dual-lane mutations accept both callers, and qaCorrections.insert remains anonymously callable; Convex typecheck green.</done>
</task>

<task type="auto">
  <name>Task 3: Update pipeline + Stripe callers, document secrets, and add the convex-test suite</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py, apps/web/lib/stripe/handlers.ts, apps/web/.env.example, packages/pipeline/.env.example, apps/dispatch-control/__tests__/convexAuthLockdown.test.ts</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation — single injection point)
    - apps/web/lib/stripe/handlers.ts (getConvexClient + claim/insert call sites)
    - apps/web/.env.example, packages/pipeline/.env.example
    - apps/dispatch-control/__tests__/auditLog.test.ts and apps/dispatch-control/__tests__/setup.ts (convex-test harness usage pattern)
    - apps/dispatch-control/package.json (confirm convex-test dep ^0.0.53)
  </read_first>
  <action>
    1. In `convex_client.py::convex_mutation`, inject the pipeline secret centrally so the ~25 agent/api/lib call sites need NO edits: before building the POST body, do `merged_args = {**args, "pipelineSecret": os.environ.get("PIPELINE_CONVEX_SECRET", "")}` and send `merged_args`. Do NOT inject into `convex_query` (queries are unguarded). Update the module docstring to note the injection.
    2. In `apps/web/lib/stripe/handlers.ts`, pass `webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET ?? ''` as an arg to both the `stripeEvents.claim` and `stripeOrders.insert` mutation calls. Keep `new ConvexHttpClient(url)` (no `.setAuth`).
    3. Add `PIPELINE_CONVEX_SECRET=` (with a comment: "Shared secret the pipeline sends on every Convex mutation; set matching value via `npx convex env set PIPELINE_CONVEX_SECRET`") to `packages/pipeline/.env.example`. Add `STRIPE_TO_CONVEX_SECRET=` (server-only, never NEXT_PUBLIC; comment: "Secret the Stripe webhook sends to Convex; set matching value on Convex") to `apps/web/.env.example`.
    4. Create `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` using the `convex-test` harness (mirror auditLog.test.ts). Cover the four classes with real assertions:
       - dashboard-lane (e.g. `promptVersions.activate`): `t.mutation(...)` WITHOUT identity rejects; WITH `t.withIdentity({subject:'user_x'})` succeeds.
       - pipeline-lane (e.g. `deliberationEvents.insert`): rejects with wrong/absent `pipelineSecret`; succeeds with the correct secret (set via the test's env or `vi.stubEnv('PIPELINE_CONVEX_SECRET', ...)`).
       - dual-lane (`pipelineConfig.upsert`): succeeds via identity AND (separately) via correct secret; rejects with neither.
       - public (`qaCorrections.insert`): succeeds with NO identity and NO secret.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- convexAuthLockdown</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "PIPELINE_CONVEX_SECRET" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` and the injection is inside `convex_mutation` (not `convex_query`)
    - `grep -q "webhookSecret" apps/web/lib/stripe/handlers.ts`
    - `grep -q "PIPELINE_CONVEX_SECRET" packages/pipeline/.env.example` && `grep -q "STRIPE_TO_CONVEX_SECRET" apps/web/.env.example`
    - `test -f apps/dispatch-control/__tests__/convexAuthLockdown.test.ts`
    - `pnpm --filter dispatch-control test -- convexAuthLockdown` exits 0 (all four lane assertions pass)
    - Regression: `cd packages/pipeline && uv run pytest -q` exits 0 (pipeline stub/mocks still write; the central injection did not break existing tests — update test mocks to tolerate the extra `pipelineSecret` arg only if a mock asserts exact args)
    - Regression: `pnpm --filter web build` exits 0 and `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Pipeline and Stripe callers send their secrets, both new secret vars are documented, and the convex-test suite proves all four lanes; pipeline pytest + both web builds stay green.</done>
</task>

</tasks>

<verification>
- `pnpm typecheck:convex` exits 0
- `pnpm --filter dispatch-control test` green (including the new convexAuthLockdown suite + existing activate/saveVersion/runs/auditLog suites — zero-regression on operator flows)
- `cd packages/pipeline && uv run pytest -q` green (pipeline admin-key writes still succeed)
- `pnpm --filter web build` + `pnpm --filter dispatch-control build` green
</verification>

<success_criteria>
No Convex mutation can be invoked by a spoofed/unauthenticated caller except `qaCorrections.insert` (documented GAM-05 exception). The pipeline, dashboard, and Stripe webhook all still perform their writes. A follow-up external step (`npx convex env set PIPELINE_CONVEX_SECRET …` + matching Railway/Vercel vars) is required before the pipeline/webhook can write again post-deploy — flag this to the user.
</success_criteria>

<output>
After completion, create `.planning/phases/29-deployment-hardening-code-fixes/29-01-SUMMARY.md`
</output>
