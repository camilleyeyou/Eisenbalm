# Phase 29: Deployment Hardening Code Fixes - Research

**Researched:** 2026-07-03
**Domain:** Convex mutation authorization architecture, FastAPI auth fail-closed patterns, LangGraph process-restart reconciliation, Next.js 15 lint/typecheck hygiene
**Confidence:** HIGH (all findings verified against this repo's actual source + official Convex/Railway docs, not training-data assumptions)

## Summary

This phase's hardest problem — Convex mutation authorization — has a load-bearing technical fact that the CONTEXT's proposed plan gets wrong in a way that would break the pipeline if implemented literally: **`internalMutation`/`internalQuery` functions cannot be invoked through Convex's generic HTTP function-call API (`/api/mutation`, `/api/query`) by ANY external caller, regardless of auth level** — not the Python pipeline's admin deploy-key client, not a `ConvexHttpClient`, not even a raw curl with the deploy key. Internal functions can only be called from *inside* other Convex functions (`ctx.runMutation(internal.x.y, …)`) or from actions/HTTP actions/the scheduler/CLI. This is confirmed both by current Convex documentation and by this codebase's own existing precedent: `convex/auditLog.ts` already has exactly this problem solved — `write` is `internalMutation` (used only via `ctx.runMutation` from other Convex functions like `payouts.markPayoutSent`), and a **separate, duplicate-logic public `record` mutation** exists specifically so the FastAPI pipeline can reach the same table via the HTTP API. That `record`/`write` split is the existing convention to follow, but converting the D-1 lane-2 list wholesale to `internalMutation` will simply make every pipeline write to those functions start failing with a "function not found" / not-a-public-function error.

The second load-bearing fact: **every Convex call the FastAPI pipeline makes — including the ones triggered by a Clerk-authenticated dashboard operator clicking a button in dispatch-control (`/pipeline/run`, `/runs/{id}/cancel`, `/runs/{id}/agents/{key}/rerun`, `/pipeline/tick`) — goes through the pipeline's own admin deploy-key HTTP client (`convex_client.py`), NOT through a per-user Clerk JWT forwarded to Convex.** FastAPI verifies the Clerk JWT itself (`require_clerk_jwt` / `_require_clerk_jwt_control`) and then calls Convex as "the pipeline," with `ctx.auth.getUserIdentity()` returning `null` inside the mutation. This means a handful of mutations the CONTEXT groups as "dashboard-facing, guard with `getUserIdentity()`" are **actually called from two structurally different lanes** — direct-browser-with-Clerk-identity AND FastAPI-with-admin-key-no-identity — and a naive `getUserIdentity()`-throws-on-null guard would 500 the FastAPI-mediated path. `pipelineConfig.upsert` is the clearest example (dashboard `AutomationPanel.tsx` calls it directly with Clerk identity; `control.py`'s `/pipeline/tick` ALSO calls it with the admin key, no identity, to advance `schedule_next_run_at` every cron tick).

A third, more urgent finding: **`convex/qaCorrections.ts:insert` is called directly from the public, unauthenticated `apps/web` site** — `GameSlot.tsx` (a `'use client'` component on every issue page) calls `useMutation(api.qaCorrections.insert)` when the game-embed validator rejects an agent's output (GAM-05: "Andrew is notified via Convex `qaCorrections`"). `apps/web` has no Clerk installed at all. This function **cannot** be locked to Clerk identity or to the pipeline's secret without breaking GAM-05, and the CONTEXT's blanket classification of `qaCorrections.insert` as pipeline-facing `internalMutation` material is incorrect — it has three real callers (QA agent, DesignAgent's fallback, and anonymous public readers), and the anonymous-write path is a deliberate product requirement, not an oversight.

**Primary recommendation:** Do not attempt literal `internalMutation` conversion for pipeline-facing writes. Keep them as public `mutation` functions (identical Python call sites, zero pipeline code changes needed at call sites) but add an explicit shared-secret argument checked inside each handler with a constant-time compare against a Convex-side environment variable — the same fail-closed idiom D-2/D-3 already establish for the pipeline's own HTTP layer (`_require_trigger_secret`). For the small set of genuinely dual-lane mutations (`pipelineConfig.upsert`, `charities.upsertCandidate`), guard with "valid Clerk identity OR valid pipeline secret." Leave `qaCorrections.insert` deliberately public (document why), optionally tightening its argument validators (string length caps) as the only feasible hardening. Use the existing `auditLog.write`/`auditLog.record` split as the template for anything that legitimately needs a true `internalMutation` variant reachable *from other Convex code* (e.g., if the Stripe-webhook or pipeline gateway route work is later routed through a Convex HTTP Action).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full GSD phase (plan → execute → verify) for the security-critical work, not ad-hoc quick edits.
- Convex stays dev-tier `modest-magpie-797` as v1 live — this is a mutation-authorization fix + deploy-key regeneration (user-side), NOT a prod-vs-dev migration. Do not add tasks that migrate deployments.

### Claude's Discretion
- Exact shape of the Convex auth-guard helper (shared `requireOperator(ctx)` helper vs inline per-function) — must derive actor from `getUserIdentity().subject`.
- How the deployed-env marker is detected for D-2 (env var name/precedence) — pick the simplest robust signal. **Research finding: use `RAILWAY_ENVIRONMENT_NAME`, not `RAILWAY_ENVIRONMENT` — see Environment Detection section below.**
- Favicon artwork source (existing brand asset vs a simple generated mark).
- ESLint config style (flat config vs `.eslintrc.json`) appropriate to the Next 15 version in use (confirmed: Next 15.3.9, React 19.2.6).
- Whether to also drop the dead `supabase` dep in D-5.

### Deferred Ideas (OUT OF SCOPE)
- Checkpointer resume after crash (re-enter a killed run from its last checkpoint) — D-4 does reconciliation only.
- Weekly cron scheduling setup (Railway service creation) — external.
- OpenRouter/Tavily retry hardening — not a deploy blocker.
- `FONTS_DIR` fragility under non-editable install — deferred.
- Renaming `SUPABASE_POSTGRES_URL` — D-6 only fixes misleading docs/strings.
- Per-issue OG images, on-demand revalidation endpoint, `global-error.tsx` — notes, not blockers.
- **Also explicitly out of scope per phase boundary:** Stripe live-mode cutover, Clerk production instance, Resend DNS/email env, regenerating the Convex deploy key + setting it on Railway/Vercel, deleting demo Sanity docs, legal/shop copy, setting env vars on Vercel/Railway/Convex dashboards, creating the Railway weekly-cron service.

## Project Constraints (from CLAUDE.md)

- Tech stack is locked (Next.js 14+/Vercel, Sanity v3, FastAPI/Railway, LangGraph, OpenRouter, Supabase, Convex, Stripe, WeasyPrint/Playwright) — do not substitute.
- Schema files in `schemas/` and `convex/schema.ts` — do not modify field names without checking `docs/API_CONTRACTS.md` first. This phase does not require any schema field renames (confirmed below); any NEW fields (e.g. a `pipelineSecret`-style arg is a mutation *argument*, not a schema field, so no `convex/schema.ts` change is implied).
- GSD workflow enforcement: this work must go through `/gsd:execute-phase`, not direct edits.
- Voice: dry, precise, no exclamation marks, no winking — applies to the one new user-facing string this phase adds (BuyButton failure message, D-9).
- No `git commit --no-verify`, no force-push, no destructive git ops without explicit ask.

## Convex Authorization Architecture (the core of this phase)

### The three caller lanes that reach Convex

| Lane | Mechanism | What Convex sees | Examples |
|------|-----------|-------------------|----------|
| **A. Browser → Convex direct** | `dispatch-control`'s `ConvexProviderWithClerk` + `useQuery`/`useMutation` | `ctx.auth.getUserIdentity()` returns the real Clerk identity (JWT forwarded via the `"convex"` JWT template, per `convex/auth.config.ts`) | `AutomationPanel.tsx`, `AddCharityDialog.tsx`, `RegistryTable.tsx`, `VersionHistoryPanel.tsx`, `PayoutRow.tsx`, `NotificationSettings.tsx` |
| **B. FastAPI (pipeline) → Convex via admin deploy key** | `packages/pipeline/.../lib/convex_client.py`'s `convex_mutation`/`convex_query`, `POST {CONVEX_URL}/api/mutation` with `Authorization: Convex {CONVEX_DEPLOY_KEY}` | `ctx.auth.getUserIdentity()` returns **`null`** — the deploy-key header is not a recognized JWT provider; Convex does not synthesize an identity from it | ALL of `agents/*.py`, `api/control.py`, `api/review.py`, `api/runs.py`, `lib/agent_wrapper.py`, `lib/config_loader.py`, `lib/budget.py`, `lib/cost.py` — this includes calls made in *response to* a Clerk-verified dashboard action, because FastAPI does its own Clerk check and then talks to Convex as itself |
| **C. Stripe webhook (Next.js API route) → Convex** | `apps/web/lib/stripe/handlers.ts`, bare `new ConvexHttpClient(url)`, **no auth token set at all today** | `ctx.auth.getUserIdentity()` returns `null` | `stripeEvents.claim`, `stripeOrders.insert` |
| **D. Public reader browser → Convex direct** | `apps/web` (no Clerk installed) — `GameSlot.tsx`'s `useMutation(api.qaCorrections.insert)` | `ctx.auth.getUserIdentity()` returns `null` (no Clerk provider on this app at all) | `qaCorrections.insert` only |

**Critical technical confirmation (verified against current Convex docs, not training-data recall):** internal functions (`internalMutation`, `internalQuery`, `internalAction`) are **not reachable via lanes A, B, C, or D** — none of them are "calling from another Convex function." The *only* legitimate way an external HTTP caller reaches an internal function is indirectly: call a public `mutation`/`query`/`action`/`httpAction` that itself does `ctx.runMutation(internal.x.y, args)`. This codebase already demonstrates the pattern correctly in `convex/auditLog.ts` (`write` = `internalMutation`, `record` = public `mutation` with identical body, added specifically "for callers outside Convex (e.g. the FastAPI pipeline)").

**Sources:**
- [Convex Internal Functions docs](https://docs.convex.dev/functions/internal-functions) — "Internal mutations can read from and write to the database but are not exposed as part of your app's public API. They can only be called by other Convex functions using `ctx.runMutation` or by the scheduler."
- [Convex HTTP API docs](https://docs.convex.dev/http-api/) — deploy-key auth "gives full read and write access to your Convex data" but this is scoped to the HTTP API's own public-function surface, not a bypass of the internal/public split.
- This repo: `convex/auditLog.ts` lines 1-70 (the `write`/`record` split, with an explicit code comment stating the reason).

### Enumeration of every pipeline-facing mutation and its real caller(s)

Verified by grepping every `convex_mutation(...)`/`convex_mutation_safe(...)` call site in `packages/pipeline/src` and every `api.<module>.<fn>` reference in `apps/web` and `apps/dispatch-control` (excluding `.next` build output and generated files).

| Function | Caller(s) found | Classification | Notes |
|----------|-----------------|----------------|-------|
| `pipelineRuns:create` | `api/runs.py::_start_run` (lane B only) | Pipeline-only | No dashboard/browser caller |
| `pipelineRuns:updateStatus` | `agents/_wrapper.py`, `agents/editor.py`, `agents/publisher/__init__.py`, `agents/validate.py`, `api/runs.py` (all lane B) | Pipeline-only | |
| `pipelineRuns:byRunId` (query) | `api/runs.py`, `api/control.py`, `api/review.py` (lane B); `apps/web` `DeliberationSlot.tsx`/`_debug` (public read, lane D, read-only) | Pipeline-write / public-read | Query, not mutation — already safe as a public query with no PII leak beyond what's already public on the issue page |
| `runs:create` | `api/runs.py::_start_run` (lane B only) | Pipeline-only | |
| `runs:updateStatus` | `api/runs.py::_execute_run` (lane B only) | Pipeline-only | |
| `runs:requestCancel` | `api/control.py::cancel_run` (lane B only — the Clerk check happens in FastAPI, Convex itself sees no identity) | Pipeline-only (transitively operator-triggered) | No direct dashboard `useMutation(api.runs.requestCancel)` found |
| `runs:setConfigSnapshot` | `lib/config_loader.py::snapshot_config` (lane B only) | Pipeline-only | |
| `runs:setScheduledPublish` | `api/control.py` (tick sweep), `api/review.py` (approve-and-schedule) — both lane B only | Pipeline-only | |
| `runs:isCancelRequested` (query) | `lib/agent_wrapper.py` (lane B, fail-open by design — RUN-04) | Pipeline-only | |
| `deliberationEvents:insert` | `agents/_wrapper.py`, `agents/advocate.py`, `agents/calibrator.py`, `agents/publisher/__init__.py`, `lib/cost.py` (all lane B) | Pipeline-only | |
| `agentVotes:insert` | `agents/advocate.py` (lane B only) | Pipeline-only | |
| `pitchLog:insert` / `pitchLog:markSelected` | `agents/scout.py`, `agents/editor.py` (lane B only) | Pipeline-only | |
| `qaCorrections:insert` | `agents/qa/__init__.py`, `agents/design/__init__.py` (lane B) **AND** `apps/web/components/issue/GameSlot.tsx` (lane D — anonymous public reader, `'use client'`, no Clerk) | **DUAL — pipeline + anonymous public** | See dedicated callout below. GAM-05 requires this. |
| `charities:upsertCandidate` | `agents/scout.py` (lane B) **AND** `apps/dispatch-control/.../AddCharityDialog.tsx` (lane A — authenticated operator, direct browser `useMutation`) | **DUAL — pipeline + operator** | Needs "identity OR secret" guard, not a single lane |
| `charities:upsertFeatured` | `agents/publisher/__init__.py` (lane B only) | Pipeline-only | No dashboard caller found |
| `charities:listForDedup` (query) | `agents/scout.py`, `lib/convex_client.py` (lane B) | Pipeline-only (query) | |
| `charities:setStatus` | `apps/dispatch-control/.../RegistryTable.tsx` (lane A only) | **Dashboard-only** | Matches CONTEXT's classification cleanly — no pipeline caller |
| `charities:seedFromPublished` | `packages/pipeline/scripts/backfill_charity_registry.py` — a **one-time developer-run CLI script**, not live pipeline traffic. The code comment claims "also available as an operator-triggered 'Seed registry' button in dispatch-control" but **no such button exists in the current dispatch-control source** (grepped, zero hits) | Script-only today | Low priority; guard however is convenient, nothing live depends on either lane |
| `claimChecks:insertBatch` | `agents/publisher/__init__.py` (lane B only) | Pipeline-only | |
| `claimChecks:setStatus` / `claimChecks:allSignedOff` | `apps/dispatch-control/.../ClaimsChecklist.tsx` (lane A, `setStatus`) and BOTH `api/review.py` + dashboard (`allSignedOff`, query) | `setStatus` dashboard-only; `allSignedOff` dual-read (fine, it's a query) | |
| `reviewActions:record` | `api/review.py` (lane B only) | Pipeline-only | Note: name says "record" but no distinct internal `write` exists yet for this one — same split-if-needed pattern as auditLog could apply later, not required now |
| `auditLog:record` | `api/control.py`, `api/review.py` (lane B) | Pipeline-only | Already the "public HTTP-reachable half" of an existing internal/public split — **use this file as the reference template, do not touch its architecture** |
| `pipelineConfig:upsert` | `apps/dispatch-control/.../AutomationPanel.tsx`, `BudgetCapsPanel.tsx` (lane A) **AND** `api/control.py::pipeline_tick` (lane B, writes `schedule_next_run_at` every cron tick) | **DUAL — dashboard + pipeline-cron** | The single trickiest case: same mutation, two legitimate unrelated purposes |
| `pipelineConfig:setAutoPublish` | `apps/dispatch-control/.../AutoPublishToggle.tsx` (lane A only) | **Dashboard-only** | Clean — matches CONTEXT |
| `pipelineConfig:setNotificationConfig` | `apps/dispatch-control/.../NotificationSettings.tsx` (lane A only) | **Already guarded** (existing `ctx.auth.getUserIdentity()`) — leave as-is | |
| `pipelineConfig:getAll` (query) | Both lanes read it | Query — no change needed | |
| `promptVersions:upsertActive` / `saveVersion` / `activate` | Dashboard only (`PromptSaveDialog.tsx`, `VersionHistoryPanel.tsx`) + test harness. `promptVersions:getActive` is ALSO read by `lib/config_loader.py` (lane B, query) and `api/agents.py` (lane B, query, test-run) | Writes = dashboard-only; the *query* `getActive` is legitimately dual-read (fine, queries aren't the attack surface here) | |
| `agents:upsert` | Not found as a live caller anywhere outside dashboard UI (grepped pipeline + dispatch-control non-test source: zero hits for `agents:upsert` in Python; only `agents:listForWorkspace`, a query, is read by `lib/config_loader.py`) | **Dashboard-only** (or seed-script-only) | Matches CONTEXT cleanly |
| `payouts:markPayoutSent` | Dashboard only, **already guarded** | Leave as-is | Reference pattern |
| `users:upsertCurrentUser` | Dashboard only, **already guarded** | Leave as-is | Reference pattern |
| `stripeEvents:claim` | `apps/web/lib/stripe/handlers.ts` only (lane C) | **Webhook-only** | |
| `stripeOrders:insert` | `apps/web/lib/stripe/handlers.ts` only (lane C) | **Webhook-only** | |

### The `qaCorrections.insert` public-write conflict (read this before touching D-1 lane 2)

`apps/web/components/issue/GameSlot.tsx` (verified source, lines ~28-73):

```tsx
'use client'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
// ...
const insertQaCorrection = useMutation(api.qaCorrections.insert)
// ...
useEffect(() => {
  if (!validation || validation.valid) return
  if (reportedRef.current) return
  if (!runId) return
  reportedRef.current = true
  insertQaCorrection({
    runId, sectionName: 'game',
    reason: `Game validator rejected embedCode: ${validation.reason}`,
    severity: 'error', accepted: false, agentId: 'game-validator', axis: 'hard-rule',
  }).catch((err) => console.error('[GameSlot] qaCorrections.insert failed', err))
}, [validation, runId, insertQaCorrection])
```

`apps/web` has **no Clerk installed anywhere** (confirmed: Clerk only exists in `apps/dispatch-control`). This call fires from any anonymous reader's browser whenever the GameWriter's embed fails the client-side validator — a locked requirement (GAM-05: "If validation fails, ... Andrew is notified via Convex `qaCorrections`"). There is no identity to check and no secret the public browser could legitimately hold without exposing it to everyone (any secret shipped to `apps/web`'s client bundle is not a secret).

**Recommendation for the planner:** treat `qaCorrections.insert` as an intentional exception, not a lockdown target. Options, cheapest first:
1. **Do nothing structural** — document the exception in the mutation's own comment (why it must stay public) and move on. The write surface is narrow (one table, append-only, human-reviewed in the dashboard, no read of other data, no side effects like the Stripe email trigger `stripeOrders.insert` has).
2. **Optional hardening (cheap, in-scope):** tighten the Convex validators to cap `reason`/`sectionName` string lengths (e.g. `v.string()` → still `v.string()` but add a handler-side length check + truncate) to blunt a trivial spam/DoS vector, since anyone can currently POST arbitrarily large strings at zero cost.
3. **Do NOT** attempt to route this through the FastAPI pipeline or a secret-gated path in this phase — that would require a product redesign (e.g., a new public Next.js API route that rate-limits before forwarding), which is out of scope for a hardening phase and risks breaking GAM-05 during execution.

### The `charities.upsertCandidate` and `pipelineConfig.upsert` dual-lane conflicts

Both have one caller in lane A (Clerk-identified dashboard) and one in lane B (pipeline/cron, admin key, no identity). The single-guard patterns CONTEXT proposes (either "getUserIdentity()-only" or "internalMutation-only") each break one of the two real callers. Recommended pattern (works for both):

```typescript
// Illustrative — exact helper shape is Claude's Discretion (CONTEXT)
async function requireOperatorOrPipeline(ctx: MutationCtx, pipelineSecret?: string) {
  const identity = await ctx.auth.getUserIdentity()
  if (identity) return { actor: identity.subject, isPipeline: false }
  const expected = process.env.PIPELINE_CONVEX_SECRET
  if (expected && pipelineSecret && timingSafeEqual(pipelineSecret, expected)) {
    return { actor: 'pipeline', isPipeline: true }
  }
  throw new Error('Unauthorized')
}
```

This requires adding one new optional argument (`pipelineSecret: v.optional(v.string())`) to exactly these two mutations, and one new Convex-side env var. Every other pipeline-facing mutation in the table above (the "Pipeline-only" rows) needs ONLY the secret check (no identity branch), matching the simpler `_require_trigger_secret` idiom already in `api/runs.py`.

### Provisioning the shared secret (what's in-scope vs. external)

This phase can and should:
- Write the Convex-side handler code that reads `process.env.PIPELINE_CONVEX_SECRET` (or similar name — naming is Claude's Discretion) and rejects on mismatch/absence **only when a Convex-side "deployed" signal would apply** — but note Convex functions have no direct equivalent of `RAILWAY_ENVIRONMENT_NAME`; the pragmatic approach is to make the guard unconditional (always required) rather than environment-conditional, since Convex dev-tier `modest-magpie-797` is already the *live* v1 deployment per the locked decision (there is no separate "Convex local dev" the pipeline talks to — `packages/pipeline/.env.example`'s `NEXT_PUBLIC_CONVEX_URL` points at the same dev-tier deployment in every environment). This is a materially different situation from D-2/D-3 (FastAPI's own env), where a genuine local-vs-Railway distinction exists.
- Add the new env var names to `packages/pipeline/.env.example` (pipeline-side secret to send) and document the Convex-side var name the operator must set via `npx convex env set` (external action, out of scope to execute).
- Update `convex_client.py`'s `convex_mutation`/`convex_mutation_safe` to inject the secret into every outgoing pipeline mutation call (one central change point — all ~25 call sites keep their existing `{path, args}` signature since the secret can be added centrally inside `convex_mutation`, not at each call site, IF the function signature is `convex_mutation(http, path, args)` → wrap by merging `{**args, "pipelineSecret": os.environ.get("PIPELINE_CONVEX_SECRET", "")}` before sending. This means the ~25 pipeline call sites in agents/*.py, api/*.py, lib/*.py do **NOT** need individual edits — only `convex_client.py`'s low-level `convex_mutation` function needs the injection, plus the Convex `args` validator objects gain one optional field each.

This phase **cannot** (out of scope, no dashboard/Convex CLI credentials assumed): actually set the matching secret VALUE in the live Convex deployment's environment. Ship code that fails closed if the secret is absent/blank on the Convex side (reject all writes) — flag this loudly in the plan's verification section so the user knows a manual `npx convex env set PIPELINE_CONVEX_SECRET <value>` (and matching `packages/pipeline` Railway env var) is required post-merge before the pipeline can write again. This is the same shape of "ships code, needs a value set externally" as `PIPELINE_TRIGGER_SECRET` already is.

### Existing reference pattern (guard idiom to replicate for dashboard mutations)

All three already-guarded mutations use the identical idiom — this is the shape for `promptVersions.upsertActive/saveVersion/activate`, `pipelineConfig.upsert`/`setAutoPublish`, `agents.upsert`, `claimChecks.setStatus`, `auditLog`-adjacent writes, `charities.setStatus`/`upsertFeatured` (operator-facing half), `reviewActions.record` (if a dashboard-direct write is ever added):

```typescript
export const someOperatorMutation = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthorized')
    const actorId = identity.subject   // Clerk userId — use for audit `actorId`, NOT a trusted arg
    // ... proceed, optionally call internal.auditLog.write with actorId
  },
})
```

Source: `convex/payouts.ts::markPayoutSent`, `convex/pipelineConfig.ts::setNotificationConfig`, `convex/users.ts::upsertCurrentUser` (all read verbatim in this research pass). `convex/auth.config.ts` confirms the JWT provider is Clerk's `"convex"`-named template, forwarded via `dispatch-control/components/ConvexClientProvider.tsx`'s `ConvexProviderWithClerk`.

**A shared helper is recommended** (`convex/lib/auth.ts` or similar, e.g. `requireOperator(ctx): Promise<string>` returning `identity.subject` or throwing) to avoid copy-pasting the two-line guard ~10+ times, but this is explicitly Claude's Discretion per CONTEXT.

## Stripe Webhook Convex Auth (D-1 lane 3)

`apps/web/lib/stripe/handlers.ts::getConvexClient()` currently does:
```typescript
function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return new ConvexHttpClient(url)   // no .setAuth(), no admin key at all
}
```

`ConvexHttpClient.setAuth(token)` (the JS client's auth-attach method) expects a **Clerk-issued JWT** matching `convex/auth.config.ts`'s configured provider — there is no Clerk identity available in a server-side Stripe webhook handler, so `.setAuth()` is not directly usable here (there's no user session to mint a token from). And per the internal-function finding above, giving this client "admin auth" would not let it reach `internalMutation` functions even if such a token existed — the HTTP/browser client SDKs are bound by the exact same public-function-only restriction as the Python client.

**Recommendation:** apply the identical secret-argument pattern used for the pipeline lane. Add a `webhookSecret: v.string()` (or reuse one shared `pipelineSecret`-style name) argument to `stripeEvents.claim` and `stripeOrders.insert`, checked with a constant-time compare against a Convex env var, and have `handlers.ts` pass `process.env.STRIPE_TO_CONVEX_SECRET` (a NEW, server-only Next.js env var — never `NEXT_PUBLIC_*`) with every call. This is a single caller (lane C only, confirmed — no other code calls these two functions), so no dual-guard complexity is needed here, just the secret check. Document the new env var in `apps/web/.env.example` (which does not currently exist as a checked-in file per the repo listing — verify before assuming its presence; if absent, note the gap but it's outside the explicit D-13 scope which only lists `dispatch-control` and `packages/pipeline` `.env.example` gaps).

## Pipeline FastAPI Fail-Closed Auth (D-2)

### Environment detection — verified correction to the CONTEXT's guess

CONTEXT proposes `RAILWAY_ENVIRONMENT`. **This is stale/wrong.** Per Railway's current official variables reference (fetched live, not from training data), the auto-injected variable for the environment name is **`RAILWAY_ENVIRONMENT_NAME`** (Railway also injects `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_NAME`, `RAILWAY_DEPLOYMENT_ID`, `RAILWAY_PROJECT_NAME`, `RAILWAY_PUBLIC_DOMAIN`, etc. — `RAILWAY_ENVIRONMENT` without the `_NAME` suffix is not in the current reference). Grepped this repo: no existing usage of any `RAILWAY_*` var, no `APP_ENV`/`PIPELINE_ENV` convention exists today — this is a green field choice.

**Recommendation:** `if os.environ.get("RAILWAY_ENVIRONMENT_NAME"):` as the "we are deployed" signal (auto-present on every Railway service, zero manual provisioning needed, unlike a hand-set `APP_ENV`). Verified this is safe against the existing test suite: `tests/api/test_clerk_auth.py::test_cron_trigger_secret_path_unaffected` and other tests rely on the CURRENT fail-open behavior when `PIPELINE_TRIGGER_SECRET`/`CLERK_JWT_ISSUER_DOMAIN` are unset — none of them set `RAILWAY_ENVIRONMENT_NAME`, so gating the hard-fail strictly behind that var's presence keeps all 387 existing pipeline tests green with zero modification, while still fixing the real vulnerability (Railway-deployed process with a missing secret today silently opens the door; after the fix it refuses to boot / 401s).

### The three fail-open sites (all confirmed, all follow the identical idiom)

1. `packages/pipeline/src/eisenbalm_pipeline/api/auth.py::require_clerk_jwt` — `if not os.environ.get("CLERK_JWT_ISSUER_DOMAIN"): return {"sub": "local-dev-operator"}`
2. `packages/pipeline/src/eisenbalm_pipeline/api/control.py::_require_clerk_jwt_control` — near-duplicate of the above, same env var, same sentinel
3. `packages/pipeline/src/eisenbalm_pipeline/api/runs.py::_require_trigger_secret` — `if not expected: log.warning(...); return` (skips the check entirely)

**Recommended shape** (applies to all three, minimal diff): wrap the existing "unset → skip" branch with an additional check —
```python
if not os.environ.get(SECRET_VAR_NAME):
    if os.environ.get("RAILWAY_ENVIRONMENT_NAME"):
        raise HTTPException(status_code=500, detail=f"{SECRET_VAR_NAME} must be set in a deployed environment")
        # or: raise RuntimeError(...) at import/startup time for a hard boot failure instead of per-request
    log.warning(...)  # existing local-dev behavior, unchanged
    return <sentinel>
```
A **boot-time assertion** (raised once in `main.py`'s lifespan, before `yield`) is stronger than a per-request 401 (it prevents the service from ever accepting traffic in a misconfigured deployed state, matching `assert_tables_exist`'s existing fail-fast pattern in the same lifespan) and is the recommended primary mechanism; the per-request guard is a reasonable belt-and-suspenders addition for the two Clerk-guard call sites specifically (since `main.py`'s lifespan cannot know in advance whether a request will hit a Clerk-gated or trigger-secret-gated route). **Both `PIPELINE_TRIGGER_SECRET` and `CLERK_JWT_ISSUER_DOMAIN` should be checked once at lifespan startup** when `RAILWAY_ENVIRONMENT_NAME` is present, raising/logging a fatal error that prevents `/healthz` from ever reporting healthy — this is the cleanest single-point fix and touches one file (`main.py`) rather than three.

### Reference fail-closed patterns already in this codebase (use as the tone/shape template)

- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` — raises typed `SignatureError` subclasses; the webhook route returns 401/503 accordingly, no bypass.
- `apps/web/app/api/stripe/webhook/route.ts` — `if (!secret) { console.error(...); return 500 }` — **always** verifies, in every environment, no dev bypass (CMR-05). This is the gold-standard shape D-2 should mirror in spirit (though D-2 additionally needs the "but stay convenient locally" carve-out these two do NOT have, since Stripe/Sanity webhooks never need a local-dev bypass at all).

## Pipeline Restart Reconciliation (D-4)

### Confirmed architecture

- A run executes as `asyncio.create_task(_execute_run(...))` inside `api/runs.py::_start_run`, strong-ref'd into `app.state.background_tasks` (an in-memory `set()`, initialized fresh in `main.py`'s lifespan on every process start: `app.state.background_tasks = set()`).
- **A Railway restart/redeploy kills the whole Python process.** `app.state.background_tasks` is reconstructed empty on the next boot. There is no persistence of "which tasks were in flight" anywhere except Convex's `runs.status`/`pipelineRuns.status` fields, which stay `"running"` forever once orphaned.
- **Confirmed: "any run with `status == 'running'` at boot is by definition orphaned.`** There is no in-process state that could legitimately still be "running" immediately after a fresh lifespan starts — the reconciliation sweep does not need to distinguish "genuinely still running" from "orphaned," because nothing can genuinely still be running at boot time in this single-process architecture (no distributed workers, no separate task queue).
- The one-at-a-time gate (`control.py::pipeline_run` and `pipeline_tick`, both check `runs:latest` status `== "running"`) and `runs.py::resume_run`/`cancel_run` all read this same stuck status, so an orphaned run permanently blocks every future run until manually cleared in Convex — this is the exact production risk D-4 targets.

### Recommended implementation shape

No new Convex schema or function is required. `convex/runs.ts::listForWorkspace` already returns **every** row for the workspace (no status filter) — reconciliation can call this existing query, filter `status === "running"` in Python, and for each match call the two mutations already used by the existing `RunCancelled`/`CostCapExceeded` termination path in `_execute_run` (`runs:updateStatus` with `status: "failed"` + `completedAt`, and `pipelineRuns:updateStatus` with `status: "failed"` + a clear `errorMessage`, e.g. `"Orphaned by service restart — no live task after reboot"`). This exactly mirrors the Pitfall-1 convention already established in this codebase (`runs.status` free-string, `pipelineRuns.status` stays on the frozen `running|awaiting-review|complete|failed` union).

Add this as a new function (e.g. `reconcile_orphaned_runs(app)`) called from `main.py`'s lifespan **after** `convex_client.set_client(convex_http)` runs (the sweep needs the shared client) and **before** `yield` — i.e., in the same startup block that currently builds the graph/checkpointer/clients, guarded so a Convex failure during the sweep degrades the same way the rest of lifespan already does (log + continue, don't crash boot). Do not run the sweep in the degraded-mode branch (no `SUPABASE_POSTGRES_URL` / graph unavailable) since there's nothing to reconcile against if the graph never loads anyway — though the sweep only touches Convex, not Postgres, so it's technically independent; keep it simple and only run it on the clean-boot path to avoid adding new failure surface to the already-complex degraded-mode logic.

**Do not build checkpointer resume in this phase** (explicitly deferred) — reconciliation marks the run terminal; a human must manually re-trigger a fresh run for that issue number if content was lost mid-run.

## Tripwire Tests That Will Break By Design

### D-7 (debug route removal)

`apps/web/__tests__/debug-route.test.ts` — reads `apps/web/app/%5Fdebug/convex/page.tsx` via `readFileSync` and asserts (a) the file contains `'Convex smoke test'` and (b) it does not contain `<main`. Deleting the page file will make the `readFileSync` call throw (ENOENT), failing the whole suite, not just producing a "friendly" assertion mismatch. **This file must be deleted or its two `it()` blocks removed/replaced** as part of the same commit that deletes the route — there is no partial-safe order.

Also update, per the file's own embedded removal checklist (found in both the page file's header comment AND `apps/web/README.md` lines 190-192 — already written by prior authors, just needs executing):
1. Delete `apps/web/app/%5Fdebug/convex/page.tsx` (and the `%5Fdebug/` dir if empty).
2. Remove `Disallow: /_debug/` from `apps/web/public/robots.txt` (confirmed present, line 5).
3. Update `apps/web/README.md` (lines 24, 182-192 all reference `/_debug/convex` — the README documents it as "Phase 3 evidence only, removed in Phase 9," which is **already stale** — this route has evidently survived past its planned Phase 9 removal into Phase 29; the README's own claim it was "removed in Phase 9" is factually false in the current tree and should be corrected, not just re-asserted).
4. `apps/web/app/sitemap.ts` and `apps/web/app/feed.xml/route.ts` both have comments referencing the `/_debug/` exclusion — these are just comments (no functional Disallow logic to remove there), leave them or trim for accuracy at the executor's discretion.

### D-8 (dead Convex subscriptions in DeliberationSlot.tsx)

**Three test files reference the same five `api.X.byRunId` strings against `DeliberationSlot.tsx`'s source** — the CONTEXT only vaguely referenced "the DEL-04/5-subs tripwire" (singular); all three must be updated in the same commit as the component change or the suite goes red:

1. `apps/web/__tests__/deliberation-subscriptions.test.ts` — dedicated suite, asserts all 5 `useQuery(api.X.byRunId, ...)` calls + the `'skip'` sentinel pattern + DEL-05 empty-state copy.
2. `apps/web/__tests__/machine-editorial-components.test.ts` — asserts the same 5 strings (lines ~66-70) as part of a broader "machine editorial" source-scan.
3. `apps/web/__tests__/motion-polish.test.ts` — asserts the same 5 strings (lines ~140-144) as part of Phase 11 motion tripwires.

Confirmed via direct source read: `DeliberationSlot.tsx` (lines 45-56) currently does exactly what CONTEXT describes — 5 live `useQuery` calls immediately followed by `void run; void pitchLog; void events; void votes; void corrections` to suppress unused-var lint, with a comment explicitly stating "Stage A renders from props... Stage B (Plan 05) uses these live values" — but the real render data comes from Sanity via `IssueLayout.tsx`, confirming these 5 subscriptions are genuinely unused dead weight on the highest-traffic page. Before removing, confirm (as CONTEXT instructs) that the actual rendered deliberation content still comes from Sanity-sourced props (`conversation`, `candidates` params) — it does, per the component signature.

## Environment Availability

No new external tool/service dependency is introduced by this phase's code changes (ESLint is a new **npm devDependency**, not an external service). Verified locally:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/pnpm workspace | apps/web build | ✓ | Next 15.3.9, React 19.2.6 | — |
| Python 3.11 + uv | pipeline tests | ✓ | 387 tests collected, pytest 8.4.2/9.0.2 present in cache | — |
| `eslint` + `eslint-config-next` | D-10 | ✗ (not in `apps/web/package.json` at all — confirmed empty) | none installed today | Must be added; pin `eslint-config-next` to `^15.3.9` to match the installed Next version |
| Convex CLI / dashboard access | provisioning the new pipeline/webhook shared secret | Not verified/assumed available in this environment | — | Ship code + `.env.example` docs; flag the secret-provisioning step as an external follow-up (see Convex Authorization section) |

**Missing dependencies with no fallback:** none blocking code changes.
**Missing dependencies with fallback:** ESLint tooling — add as new devDependency (permitted: CLAUDE.md's "no new npm deps" locks are about runtime/production deps in specific past phases, not dev tooling; D-10 itself explicitly plans to add it).

## Next.js 15 ESLint Setup for apps/web (D-10)

Confirmed: `apps/web/package.json` has **zero** ESLint-related packages (`eslint`, `eslint-config-next` both absent from `devDependencies`) despite a `"lint": "next lint"` script already present. Running it today drops into Next's interactive "How would you like to configure ESLint?" prompt (non-functional in CI), exactly as CONTEXT states.

**Verified current Next.js 15 flat-config pattern** (fetched from official Next.js docs, not recalled from training data):
```javascript
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
```
Alternative (if a TypeScript-aware ruleset is also wanted): use `FlatCompat` from `@eslint/eslintrc` to `compat.extends('next/core-web-vitals', 'next/typescript')`.

**Build-breaking risk not called out in CONTEXT — flag for the plan:** `apps/web/next.config.ts` currently has **no `eslint.ignoreDuringBuilds` key**. Next.js's default behavior is to run ESLint during `next build` and **fail the build on lint errors** once a config is detected (today it silently no-ops because no config exists at all — that silence ends the moment D-10 adds one). Since the actual error count against the existing ~110-requirement, multi-phase codebase is unknown until `next/core-web-vitals` is actually run, the safe execution order is: (1) install + add the flat config, (2) run `pnpm --filter web exec next lint` once to see the real error count, (3) if errors exceed what's reasonable to fix in this phase, set `eslint.ignoreDuringBuilds: true` in `next.config.ts` explicitly (documented as intentional — lint runs as an advisory `pnpm lint:web` step, not a build gate) rather than let `next build` start failing CI. This decision should be made during execution once real numbers are known, not guessed at plan time — the plan should include the "run once, then decide" step explicitly rather than assuming zero-new-errors.

## TypeScript Test Errors (D-11) — verified exact list

Ran `apps/web`'s `typecheck` script directly; **17 errors across exactly 5 files**, matching CONTEXT precisely:

```
__tests__/checkout-create-session.test.ts       — 10× TS2532 "Object is possibly 'undefined'" (lines 70,85,103,116,143,156,169,182,195,208)
__tests__/stripe-webhook-idempotency.test.ts    — 1× TS2532 (line 101)
__tests__/model-pricing-staleness.test.ts       — 1× TS2578 "Unused '@ts-expect-error' directive" (line 21)
__tests__/notifications-ledger.test.ts          — 1× TS2578 (line 24) + 2× TS18048 "'email' is possibly 'undefined'" (lines 51, 62)
__tests__/stripe-reconciliation.test.ts         — 1× TS2578 (line 23) + 1× TS18047 "'r.feeCents' is possibly 'null'" (line 57)
```
Product source (`apps/web/app`, `apps/web/components`, `apps/web/lib`) is confirmed clean of these errors — they are entirely test-file assertions on array/object index access without a null-check, plus three stale `@ts-expect-error` comments whose underlying error apparently got fixed elsewhere and the directive is now unused (TS flags unused suppressions as errors under current `strict`-adjacent settings). Straightforward fixes: add `?.`/non-null-assertion-with-guard or restructure the destructure to check length first; delete the three stale `@ts-expect-error` lines.

## Pipeline Dependency + Env Doc Gaps (D-5, D-6, D-13) — verified exact locations

- **D-5:** `packages/pipeline/pyproject.toml`'s `[project] dependencies` list (lines 7-23) has NO `pyjwt` or `requests` entries — both are imported directly in `api/auth.py` (`import jwt`, `import requests`) and only present transitively via `supabase==2.30.0` (brings in `pyjwt` via `supabase-auth`) and `tavily-python`/`langchain-tavily` (bring in `requests`). `supabase==2.30.0` itself is NOT imported anywhere in `src/` (grepped, zero hits) — confirmed genuinely dead, safe to drop if desired (Claude's Discretion per CONTEXT).
- **D-6:** `packages/pipeline/.env.example` line 19 (`SUPABASE_POSTGRES_URL=postgres://postgres.PROJECTREF:...@aws-0-REGION.pooler.supabase.com...`) plus lines 22/25 (commented alternates) all describe a **Supabase** pooler URL shape; `graph/checkpointer.py` line 39 and `cli.py` line 62 both emit an error string instructing "See packages/pipeline/.env.example" / Supabase-flavored guidance. Per project memory (`pipeline-checkpointer-db`), this variable has pointed at **Railway Postgres** since 2026-06-12 — the env var name itself is correctly left unchanged (D-6 explicitly says don't rename), only the example value/comments and the two error strings need Railway-accurate wording.
- **D-13:** `apps/dispatch-control/.env.example` (full file read) has NO `PREVIEW_SECRET` or `NEXT_PUBLIC_WEB_PREVIEW_BASE` entries, though `lib/previewToken.ts` throws explicit runtime errors naming both if unset, and `DEPLOY.md` doesn't mention either. `DEPLOY.md` line 48 mislabels `NEXT_PUBLIC_PIPELINE_URL` as `_(optional)_` when `lib/testRunClient.ts`-style clients actually throw without it (per CONTEXT — confirmed the "optional" label exists at DEPLOY.md:48). `packages/pipeline/.env.example` has no `DESIGNAGENT_SUPPRESSED` or `LOG_LEVEL` entries though `graph/builder.py` line 71 reads `DESIGNAGENT_SUPPRESSED` directly and `api/main.py`'s `logging.basicConfig` reads `LOG_LEVEL`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time secret comparison | A manual `==`/`!=` loop or "close enough" string compare | Python: `hmac.compare_digest(a, b)` (already imported pattern-adjacent in `sanity_webhook.py`'s `hmac` usage); TypeScript/Convex: Node's `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` (guard equal-length first, since `timingSafeEqual` throws on length mismatch rather than returning false) | Naive `!==` comparisons leak timing information proportional to the matching prefix length; this is the exact class of bug D-3 fixes for the pipeline side, and the same discipline should apply to any new Convex-side secret check |
| Convex "is this an internal admin call" detection | Trying to read raw HTTP headers inside a `mutation`/`query` handler (not possible — `ctx` has no header access outside `httpAction`) | An explicit `args` field checked in the handler body | Regular mutations/queries never see the request's headers; only `httpAction` gets a `Request` object |
| A generic path-string → internal-function dispatcher | A hand-maintained `internalMutation` name-string switch inside an `action`/`httpAction` to fake "call any internal function from HTTP" | Keep functions public + secret-argument-gated (this phase's scope) | Building a generic internal-dispatch gateway is a legitimate *future* architecture (Convex HTTP Actions) but is a materially larger change (new `convex/http.ts` route, rewiring `convex_client.py`'s transport from `/api/mutation` to a custom route, one dispatch table to keep in sync) than this hardening phase's time-box supports |

## Common Pitfalls

### Pitfall 1: Assuming `internalMutation` is reachable via the admin deploy key
**What goes wrong:** Convert `pipelineRuns.create` (etc.) to `internalMutation`, pipeline immediately starts 404/erroring on every write, no runs can start.
**Why it happens:** The deploy key's "full read/write access" framing in Convex marketing copy sounds like it should bypass the internal/public split; it does not.
**How to avoid:** Keep pipeline-facing functions as public `mutation`, add secret-argument guard (see above). Verified against current Convex docs + this repo's own `auditLog.write`/`record` precedent.
**Warning signs:** After the change, `packages/pipeline`'s pytest suite (or a live smoke run) starts throwing `RuntimeError: Convex mutation failed` with a "could not find public function" style `errorMessage`.

### Pitfall 2: Guarding a dual-lane mutation with `getUserIdentity()`-only
**What goes wrong:** `pipelineConfig.upsert` or `charities.upsertCandidate` guarded with a plain "throw if no identity" check breaks the FastAPI/pipeline-cron caller (which legitimately has no Convex identity), causing `/pipeline/tick`'s schedule-cursor advance or the Scout's candidate registration to start failing silently (both call sites already wrap the call in `try/except`-adjacent patterns that log-and-continue in some places, meaning this could fail *quietly* for a while before anyone notices the schedule cursor stopped advancing).
**Why it happens:** The CONTEXT's caller enumeration was done at the requirements-gathering level, not by grepping actual call sites; the dual nature only surfaces on a full grep.
**How to avoid:** Use the enumeration table above; apply the "identity OR secret" pattern to exactly the two confirmed dual-lane functions.
**Warning signs:** `schedule_next_run_at` stops advancing (the Thursday cron silently stops firing new runs) or new charity candidates silently fail to register from the dashboard's "Add Charity" dialog.

### Pitfall 3: Treating `qaCorrections.insert` as purely pipeline-facing
**What goes wrong:** Locking it down (Clerk-only or secret-only) breaks GAM-05 — the public issue page can no longer report a rejected game embed, and the fallback UI still shows correctly but Andrew never gets notified via the dashboard.
**How to avoid:** Leave it public, documented as an intentional exception (see dedicated section above).
**Warning signs:** `apps/web/__tests__/game-sandbox.test.ts`-adjacent behavior stays fine (rendering doesn't break), but the QA-corrections table stops receiving `agentId: 'game-validator'` rows — a silent regression that wouldn't be caught by existing tests unless a new test specifically checks the mutation stays public/callable without auth.

### Pitfall 4: `RAILWAY_ENVIRONMENT` vs `RAILWAY_ENVIRONMENT_NAME`
**What goes wrong:** Implementing D-2's deployed-env check against `RAILWAY_ENVIRONMENT` (the CONTEXT's literal suggestion) means the check never fires on a real Railway deployment (the var is simply absent under that name in current Railway), silently preserving the exact fail-open vulnerability D-2 exists to close.
**How to avoid:** Use `RAILWAY_ENVIRONMENT_NAME` (verified against Railway's current official variables reference, fetched live).
**Warning signs:** None visible in testing — this is the dangerous kind of bug, since local dev tests would all still pass (they don't set either var) and the code would look correct on inspection. Recommend a live smoke check post-deploy: confirm the boot-time assertion actually fires when `PIPELINE_TRIGGER_SECRET` is deliberately left unset on a Railway staging/preview deploy, before relying on it in production.

### Pitfall 5: `next build` starting to fail CI once ESLint is configured
**What goes wrong:** D-10 adds `eslint-config-next`, `next build` (which many CI/deploy pipelines run, and which Vercel runs on every deploy) starts enforcing lint and fails on pre-existing style issues across ~30+ phases of accumulated code, blocking every future deploy until fully fixed.
**How to avoid:** Run `next lint` once standalone first to gauge real error count; default to `eslint.ignoreDuringBuilds: true` if the count is large, treating lint as advisory (`pnpm lint:web`) rather than build-gating, at least for this phase.
**Warning signs:** A previously-green `pnpm --filter web build` starts exiting non-zero immediately after the D-10 commit, with no code behavior change — a classic "the fix broke the build" ticket.

## Code Examples

### Constant-time compare fix for D-3 (`api/runs.py::_require_trigger_secret`)
```python
# Current (line ~146):
provided = request.headers.get("X-Pipeline-Trigger-Secret")
if not provided or provided != expected:
    raise HTTPException(...)

# Fixed:
import hmac
provided = request.headers.get("X-Pipeline-Trigger-Secret")
if not provided or not hmac.compare_digest(provided, expected):
    raise HTTPException(...)
```
Note: `hmac.compare_digest` requires both arguments be the same type (`str`/`str` or `bytes`/`bytes`) and does NOT itself guard against one side being empty/`None` — the existing `if not provided` short-circuit before the call already handles that correctly; keep it in that order (falsy-check first, THEN compare_digest) since `compare_digest(None, x)` raises `TypeError`.

### Existing internal/public split to replicate (already in this repo)
```typescript
// convex/auditLog.ts — the reference pattern for "needs both an internal-callers
// version AND an HTTP-API-reachable version"
export const write = internalMutation({ /* called via ctx.runMutation(internal.auditLog.write, ...) */ })
export const record = mutation({ /* identical body, called via the HTTP API by FastAPI */ })
```

## State of the Art

| Old Approach (this codebase, pre-Phase-29) | Current/Correct Approach | When Changed | Impact |
|--------------------------------------------|---------------------------|---------------|--------|
| Public mutations trust `actorId`/`workspace_id` args at face value | Derive actor from `ctx.auth.getUserIdentity().subject` for browser-authenticated writes; secret-argument for server-to-server writes | This phase | Closes spoofable-identity + open-write vulnerabilities |
| `RAILWAY_ENVIRONMENT` assumed as the deployment-marker env var | `RAILWAY_ENVIRONMENT_NAME` per current Railway docs | Verified now (2026-07) | Prevents a no-op fail-closed check |
| `provided != expected` secret comparison | `hmac.compare_digest(...)` | This phase | Removes timing side-channel |

**Deprecated/outdated:** the CONTEXT's literal "convert to `internalMutation`" instruction for pipeline-facing writes — superseded by the secret-argument pattern documented above, given Convex's internal-function HTTP-API restriction.

## Open Questions

1. **What should the new shared-secret env var(s) be named, and is one secret shared across pipeline+webhook, or two distinct secrets?**
   - What we know: functionally either works; a single shared secret is simpler to provision but conflates two trust boundaries (pipeline vs. Stripe webhook) into one value.
   - What's unclear: no existing naming convention for this exact kind of secret in the codebase (closest precedent, `PIPELINE_TRIGGER_SECRET`, is FastAPI-facing, not Convex-facing).
   - Recommendation: two distinct secrets (`PIPELINE_CONVEX_SECRET` for the pipeline lane, `STRIPE_TO_CONVEX_SECRET` for the webhook lane) so either can be rotated independently; document both as external-provisioning follow-ups.

2. **Should `charities.seedFromPublished` get any guard at all this phase, given it has no confirmed live caller?**
   - What we know: only a one-time developer CLI script calls it today; the code comment's claim of a dashboard "Seed registry" button appears to be aspirational/unbuilt.
   - What's unclear: whether a future phase will add that button, which would make this a THIRD dual-lane case.
   - Recommendation: apply the cheapest available guard (secret-only, matching the other pipeline-only functions) now; if a dashboard button is added later, revisit then. Low priority — flag as such in the plan so it isn't over-invested.

3. **Does `apps/web` need its own `.env.example` addition for the new `STRIPE_TO_CONVEX_SECRET` var?**
   - What we know: D-13 as scoped in CONTEXT only lists `dispatch-control` and `packages/pipeline` `.env.example` gaps; no `apps/web/.env.example` was mentioned.
   - What's unclear: whether `apps/web/.env.example` exists at all today (not explicitly checked in this pass beyond confirming it wasn't in D-13's listed scope).
   - Recommendation: the planner should check for `apps/web/.env.example` during task breakdown and add the new var there too if the file exists, since leaving a required server secret undocumented anywhere would undercut the whole hardening effort.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Pipeline framework | pytest 8.4.2 (also 9.0.2 cache present — check `uv.lock` for the pinned version), `asyncio_mode = "auto"`, `testpaths = ["tests"]`, 387 tests currently collected |
| Web framework | Vitest (`pnpm --filter web test` / `test:unit`) |
| Convex framework | `convex-test` harness (`t.mutation`/`t.query` pattern, seen in `apps/dispatch-control/__tests__/*.test.ts`) |
| Config files | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]`; `apps/web` vitest config (not read this pass, assume standard); Convex tests run inside `apps/dispatch-control/__tests__/` against the shared `convex/` functions |
| Quick run (pipeline) | `cd packages/pipeline && uv run pytest -x -q tests/api/test_clerk_auth.py tests/api/test_runs.py` |
| Quick run (web) | `pnpm --filter web typecheck && pnpm --filter web test` |
| Quick run (convex) | `pnpm typecheck:convex` (per CONTEXT's stated verification command) |
| Full suite | `cd packages/pipeline && uv run pytest -x -q` (387+ tests); `pnpm --filter web build`; `pnpm --filter dispatch-control build`; `pnpm build:studio` |

### Phase Requirements → Test Map
(This phase has no formal REQ-IDs in REQUIREMENTS.md — it is a hardening phase derived entirely from the audit in `29-CONTEXT.md`'s D-1..D-13 items. Mapping each D-item to its verification instead.)

| D-Item | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-1 (Convex lockdown) | Guarded dashboard mutations reject anonymous callers; pipeline-secret mutations reject callers without the secret; dual-lane mutations accept EITHER | unit (Convex) | `pnpm --filter dispatch-control test -- <new test file>` using `convex-test`'s `t.mutation(...)` with/without identity | ❌ Wave 0 — new test file needed, e.g. `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` |
| D-1 (zero-regression) | Existing operator flows (prompt edit/activate, config, review, payouts, registry) still work post-lockdown | integration | existing `apps/dispatch-control/__tests__/*.test.ts` suite (activate.test.ts, saveVersion.test.ts, runs.test.ts, auditLog.test.ts, auditViewer.test.ts already exercise these — re-run, do not weaken) | ✅ (existing) |
| D-1 (pipeline still writes) | Pipeline's admin-secret calls to `pipelineRuns:create`, `deliberationEvents:insert`, etc. still succeed | integration | pipeline pytest suite exercises these via mocked `convex_mutation` — after adding the secret injection centrally in `convex_client.py`, existing pipeline tests should stay green with zero test-file edits if the injection point is chosen correctly (single low-level function) | ✅ (existing, verify no edits needed) |
| D-1 (Stripe webhook) | `stripeEvents.claim`/`stripeOrders.insert` still record orders + trigger email with the new secret arg | integration | `apps/web/__tests__/stripe-webhook-idempotency.test.ts`, `stripe-reconciliation.test.ts` (existing — must stay green after `handlers.ts` adds the secret arg) | ✅ (existing) |
| D-2 (fail-closed) | Missing `PIPELINE_TRIGGER_SECRET`/`CLERK_JWT_ISSUER_DOMAIN` + `RAILWAY_ENVIRONMENT_NAME` set → hard fail; same missing vars WITHOUT the Railway marker → existing dev behavior unchanged | unit | new pytest case(s) in `tests/api/test_clerk_auth.py` / a new `tests/api/test_fail_closed.py`, using `monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME", "production")` + `monkeypatch.delenv(...)` | ❌ Wave 0 — new test cases needed |
| D-2 (regression) | `test_cron_trigger_secret_path_unaffected` and other existing dev-mode tests still pass (they never set `RAILWAY_ENVIRONMENT_NAME`) | unit | `uv run pytest tests/api/test_clerk_auth.py -x -q` | ✅ (existing, verify no edits needed) |
| D-3 (constant-time compare) | `hmac.compare_digest` used, not `!=` | unit | grep-based source-scan test OR a timing-insensitive functional test (correctness, not timing, is what's practically testable) asserting correct/incorrect secrets still accept/reject correctly | ❌ Wave 0 — trivial addition to existing `test_runs.py` secret tests |
| D-4 (orphaned-run sweep) | A `runs` row with `status: "running"` at boot gets marked `"failed"` by the lifespan sweep; a row with any other status is untouched | unit | new test mocking `runs:listForWorkspace` to return a mix of statuses, asserting only `"running"` rows get `updateStatus` calls | ❌ Wave 0 — new test file needed, e.g. `tests/api/test_reconciliation.py` |
| D-7 (debug route removed) | Route file gone; robots.txt entry gone; tripwire test updated | source-scan | `apps/web/__tests__/debug-route.test.ts` (rewritten to assert absence, or deleted) | Existing file needs rewrite, not new |
| D-8 (dead subs removed) | `DeliberationSlot.tsx` no longer references the 5 `api.X.byRunId` calls; deliberation still renders from Sanity props | source-scan + manual | the 3 files enumerated above, all rewritten | Existing files need rewrite, not new |
| D-11 (TS errors fixed) | `pnpm --filter web typecheck` exits 0 | type-check | `pnpm --filter web typecheck` | ✅ (existing command, currently exits 1) |

### Sampling Rate
- **Per task commit:** the narrowest relevant quick-run command from the table above (e.g. just `test_clerk_auth.py` for D-2 work, just the Convex auth test file for D-1 work).
- **Per wave merge:** full pipeline pytest (`uv run pytest -x -q`), `pnpm typecheck:convex`, `pnpm --filter web typecheck`, `pnpm --filter web build`.
- **Phase gate:** all of the above plus `pnpm --filter dispatch-control build`, `pnpm build:studio`, and a live-environment smoke check that the D-2 boot-time assertion actually fires as expected once `RAILWAY_ENVIRONMENT_NAME` is genuinely present (cannot be simulated locally with full confidence — flag for manual verification on a Railway preview/staging deploy per Pitfall 4).

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` (or similar) — covers D-1 guard behavior for every function in the enumeration table (guarded-dashboard-only, pipeline-secret-only, dual-lane, intentionally-public)
- [ ] `packages/pipeline/tests/api/test_fail_closed.py` (or additions to `test_clerk_auth.py`) — covers D-2's `RAILWAY_ENVIRONMENT_NAME`-gated hard-fail + regression that dev-mode behavior is unchanged
- [ ] `packages/pipeline/tests/api/test_reconciliation.py` — covers D-4's orphaned-run sweep logic in isolation (mock the Convex client, assert correct filtering + correct mutation calls)
- [ ] D-3's constant-time-compare correctness check can likely extend an existing test in `tests/api/test_runs.py` rather than needing a wholly new file — confirm during planning whether one already exists (none seen in this research pass beyond the fail-open test above)
- [ ] Rewrite (not new): `apps/web/__tests__/debug-route.test.ts`, `deliberation-subscriptions.test.ts`, `machine-editorial-components.test.ts`, `motion-polish.test.ts`

## Sources

### Primary (HIGH confidence)
- This repository, direct file reads: `convex/payouts.ts`, `convex/pipelineConfig.ts`, `convex/users.ts`, `convex/pipelineRuns.ts`, `convex/runs.ts`, `convex/charities.ts`, `convex/stripeEvents.ts`, `convex/stripeOrders.ts`, `convex/auditLog.ts`, `convex/promptVersions.ts`, `convex/agents.ts`, `convex/claimChecks.ts`, `convex/reviewActions.ts`, `convex/auth.config.ts`, `convex/schema.ts` — read in full or in relevant part.
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`, `api/main.py`, `api/auth.py`, `api/runs.py`, `api/control.py` — read in full.
- `apps/web/lib/stripe/handlers.ts`, `apps/web/app/api/stripe/webhook/route.ts`, `apps/web/components/issue/GameSlot.tsx`, `apps/web/components/issue/DeliberationSlot.tsx`, `apps/web/components/marketing/BuyButton.tsx` — read in full.
- `apps/web/__tests__/debug-route.test.ts`, `deliberation-subscriptions.test.ts` — read in full; `machine-editorial-components.test.ts`, `motion-polish.test.ts` — grepped for the specific assertion lines.
- Live grep enumeration of every `convex_mutation(...)` call site in `packages/pipeline/src` and every `api.<module>.<fn>` reference in `apps/web`/`apps/dispatch-control` (excluding build artifacts).
- Live command runs: `cd apps/web && pnpm typecheck` (17 errors, verified exact list); `cd packages/pipeline && uv run pytest --collect-only -q` (387 tests).
- [Convex Internal Functions docs](https://docs.convex.dev/functions/internal-functions) — fetched live.
- [Convex HTTP API docs](https://docs.convex.dev/http-api/) — referenced live.
- [Railway Variables Reference](https://docs.railway.com/variables/reference) — fetched live, confirms `RAILWAY_ENVIRONMENT_NAME` (not `RAILWAY_ENVIRONMENT`).
- [Next.js ESLint config docs](https://nextjs.org/docs/app/api-reference/config/eslint) — referenced live for the Next 15 flat-config shape.

### Secondary (MEDIUM confidence)
- General Convex community/discussion sources confirming internal-function call restrictions apply uniformly across HTTP/browser/Node clients (consistent with the primary docs, cross-checked).

### Tertiary (LOW confidence)
- None retained — every claim above was verified against either this repo's source or an official, currently-fetched doc page.

## Metadata

**Confidence breakdown:**
- Convex authorization architecture (the core finding): HIGH — verified against both official current Convex docs and this repo's own existing internal/public split precedent (`auditLog.ts`), plus exhaustive call-site grepping.
- Environment detection (Railway var name): HIGH — fetched live from Railway's current reference page, directly contradicts the CONTEXT's assumption.
- Restart reconciliation approach: HIGH — derived directly from reading `main.py`'s lifespan and `runs.py`'s task management; no external dependency to verify.
- ESLint/Next 15 setup: HIGH for the config shape (fetched live); MEDIUM for "how many lint errors will surface" (genuinely unknown until run — flagged as a "run once, then decide" step rather than guessed).
- Tripwire test enumeration: HIGH — every referenced file was read or grepped directly, not inferred.

**Research date:** 2026-07-03
**Valid until:** ~30 days for the codebase-specific findings (source of truth is this repo, changes only if the repo changes); Convex/Railway/Next.js external doc findings should be re-verified if this research is reused after ~90 days, since vendor docs can shift.
