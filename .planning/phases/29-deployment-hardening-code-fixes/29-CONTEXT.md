# Phase 29: Deployment hardening code fixes - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning
**Source:** Pre-production audit (2026-07-03), 4 parallel audit agents + full builds. Findings also in memory `pre-deploy-audit-260703`.

<domain>
## Phase Boundary

This phase closes the **code-track** blockers found in the pre-production audit so the stack is safe to deploy. All local builds (`web`, `dispatch-control`, `studio`, `convex`) and the pipeline pytest suite (354 passed) are already green — nothing here is a build failure. The work is security, reliability, and pre-deploy hygiene in existing code.

**In scope (code only):** Convex mutation authorization, pipeline FastAPI auth hardening, pipeline restart reconciliation, and a set of mechanical cleanups (deps, stale env docs, a debug route, dead subscriptions, checkout UX, ESLint, test TS errors, favicon, env.example gaps).

**Explicitly OUT of scope (external actions the user owns — do NOT attempt in code):**
- Stripe live-mode cutover (keys, price, webhook, shipping rates)
- Clerk production instance (keys + issuer domain)
- Resend DNS / email env (`EMAIL_LIVE_SEND`, `RESEND_API_KEY`, domain verify, CAN-SPAM address)
- Regenerating the Convex deploy key + setting it on Railway/Vercel
- Deleting demo Sanity docs (`issue-001-demo`, `charity-demo-quiet-foundation`) from the production dataset
- Writing real legal (privacy/terms) or shop copy, confirming price/contact email
- Setting env vars on Vercel / Railway / Convex dashboards
- Creating the Railway weekly-cron service

These are tracked separately as the user's external punch-list; plans must NOT include tasks that require credentials or dashboard access we don't have.
</domain>

<decisions>
## Implementation Decisions

### Locked by user (2026-07-03, AskUserQuestion)
- **Full GSD phase** for the security-critical work (plan → execute → verify), not ad-hoc quick edits.
- **Convex stays dev-tier `modest-magpie-797` as v1 live.** This is a mutation-authorization fix + deploy-key regeneration (user-side), NOT a prod-vs-dev migration. Do not add tasks that migrate deployments.

### SECURITY-CRITICAL (priority 1)

> **⚠ MECHANISM CORRECTION (see 29-RESEARCH.md, authoritative).** The `internalMutation` approach described below in lane 2/lane 3 is technically WRONG and would break the pipeline: Convex `internalMutation` functions cannot be invoked via the HTTP function-call API (`/api/mutation`) by ANY external caller, including the pipeline's admin-deploy-key client and the Stripe webhook's `ConvexHttpClient`. Use the repo's **existing precedent** instead (`convex/auditLog.ts` = an `internalMutation` `write` + a public `mutation` `record` pair): keep pipeline/webhook-facing functions as **public `mutation`s guarded by a shared-secret argument with `hmac`/constant-time compare** (mirrors D-3). Additional research corrections that override the classification below: (a) there are **three** caller lanes (Clerk-browser dispatch-control, admin-key-no-identity pipeline, anonymous-public `apps/web`); (b) `pipelineConfig.upsert` and `charities.upsertCandidate` are **dual-lane** (a dashboard caller AND a pipeline caller) — a single guard breaks one lane; (c) `qaCorrections.insert` is called from an **anonymous public reader browser** (`apps/web/components/issue/GameSlot.tsx`, per locked requirement GAM-05) and must NOT be locked to Clerk-identity or a pipeline secret; (d) Railway's env var is `RAILWAY_ENVIRONMENT_NAME` (not `RAILWAY_ENVIRONMENT`) for D-2; (e) the D-8 "5 Convex subs" tripwire lives in THREE test files: `deliberation-subscriptions.test.ts`, `machine-editorial-components.test.ts`, `motion-polish.test.ts`. The security GOAL (no spoofable-identity writes, no open email relay) is unchanged; only the mechanism changes. The planner MUST follow 29-RESEARCH.md where it conflicts with the text below.

**D-1. Convex auth lockdown.** Today nearly every Convex `mutation` is public and accepts caller identity (`actorId`/`workspace_id`) as a plain, spoofable argument. Only three call `ctx.auth.getUserIdentity()`: `payouts.markPayoutSent`, `pipelineConfig.setNotificationConfig`, `users.upsertCurrentUser` — use these as the reference pattern for the guarded lane. Split all mutations into two lanes:

1. **Dashboard-facing (operator) mutations** — add an auth guard that calls `ctx.auth.getUserIdentity()`, throws on null, and derives the actor from `identity.subject` instead of trusting an arg. Clerk JWT is already forwarded via `ConvexProviderWithClerk`, so guarded functions keep working from dispatch-control. Files/functions: `promptVersions.ts` (upsertActive, saveVersion, activate), `pipelineConfig.ts` (upsert, setAutoPublish), `agents.ts` (upsert), `payouts.*` (already guarded — leave), `claimChecks.ts` (insertBatch, setStatus), `reviewActions.ts` (record), `auditLog.ts` (record), `charities.ts` operator-facing writes (upsertFeatured/setStatus/seedFromPublished — judgment call per function).
2. **Pipeline-facing writes** → convert to `internalMutation` (callable only by the admin deploy-key the pipeline already sends as `Authorization: Convex {CONVEX_DEPLOY_KEY}`, not by public clients): `pipelineRuns.ts` (create, updateStatus), `runs.ts` (create, updateStatus, requestCancel, setConfigSnapshot, setScheduledPublish), `deliberationEvents.ts` (insert), `agentVotes.ts` (insert), `pitchLog.ts` (insert, markSelected), `qaCorrections.ts` (insert), `charities.ts` candidate writes (upsertCandidate). Note: converting to `internalMutation` requires updating every caller — the pipeline's Python `convex_client.py` calls these over the HTTP mutation API with admin auth, which CAN invoke internal functions; verify the call path and function-reference names still resolve.
3. **Stripe webhook writes** — the Next webhook route builds `new ConvexHttpClient(url)` with **no** auth token, which currently forces `stripeEvents.claim` + `stripeOrders.insert` to be public. Give that client server-side admin auth (a server-only key via `client.setAuth(...)`, or route through an authenticated Convex HTTP action) and make both functions `internalMutation`. Do not leave order/email creation publicly callable — today `stripeOrders.insert` is an open email relay (schedules `enqueueEmailFlow` → Resend to an attacker-chosen address) and a fake-donation-ledger vector.

**Zero-regression contract for D-1:** dispatch-control operator flows (prompt edit/activate, config, review actions, payouts, registry) must still work post-lockdown (Clerk JWT path); the pipeline must still write run/deliberation/vote/pitch/QA events (admin deploy-key path); the Stripe webhook must still record orders + trigger email (admin-authed client). The existing Convex typecheck (`pnpm typecheck:convex`) and web/dispatch-control builds must stay green.

**D-2. Pipeline FastAPI auth fail-closed.** Auth guards currently degrade OPEN when their env var is unset: `api/auth.py` (Clerk JWT → returns a `local-dev-operator` sentinel when `CLERK_JWT_ISSUER_DOMAIN` unset), `api/runs.py` `_require_trigger_secret` (returns early when `PIPELINE_TRIGGER_SECRET` unset), same sentinel pattern in `control.py`/`agents.py`. Add a deployed-environment guard: when a deployment marker is present (`RAILWAY_ENVIRONMENT` set, or an explicit `APP_ENV`/`PIPELINE_ENV=production`), a missing required auth secret must hard-fail (refuse to boot at startup, or 401 the request) instead of silently allowing access. Local dev (no marker) keeps the current convenience behavior. Contrast the already-correct fail-closed paths: Sanity webhook (`sanity_webhook.py` 503 when secret unset) and Stripe webhook (500 when secret unset).

**D-3. `runs.py` trigger-secret compare → constant-time.** `api/runs.py` (~line 146) uses `provided != expected`. Change to `hmac.compare_digest(provided, expected)` (guard the `not provided` case first), matching the Sanity/Stripe paths.

**D-4. Pipeline restart reconciliation.** A run executes as an in-process `asyncio.create_task` (`api/runs.py` `_execute_run`). A Railway restart/redeploy kills the task; Convex `runs.status` stays `'running'` forever; the one-at-a-time gate (409 in `/pipeline/run`, `run_in_progress` skip in `/pipeline/tick`) then blocks ALL future runs permanently, and `/runs/{id}/cancel` only sets `cancelRequested` (polled by a now-dead node) so it can't clear it. Add a startup lifespan sweep (in `main.py` lifespan) that finds Convex runs stuck in `'running'` with no live in-process task and marks them `failed`/`cancelled` (with a clear reason), so a restart cannot deadlock the gate. Checkpointer *resume* is a larger effort and is NOT required here — reconciliation (unstick + mark terminal) is the minimum that ships.

### MECHANICAL CLEANUPS (priority 2 — bundle into the phase)

**D-5.** Add `PyJWT` and `requests` to pipeline `pyproject.toml` `[project.dependencies]` and `uv lock`. Both are imported directly in `api/auth.py` (Clerk JWKS verification) but only present transitively (pyjwt via supabase-auth←supabase; requests via tavily). `supabase==2.30.0` appears to be dead (not imported in `src/`) — if it's dropped later, pyjwt vanishes and auth breaks at import. Declaring them directly removes the hidden coupling. (Dropping `supabase` itself is optional / judgment call.)

**D-6.** Fix stale `SUPABASE_POSTGRES_URL` guidance. The var now points at **Railway Postgres** (moved 2026-06-12), not Supabase. Update `packages/pipeline/.env.example` (the ~20-line Supabase session-pooler block) and the error strings in `graph/checkpointer.py` and `cli.py` that still instruct "use the Supabase session pooler." Functional-only doc fix; do not rename the env var (that's a wider change).

**D-7.** Remove the public `/_debug/convex` route. Delete `apps/web/app/%5Fdebug/convex/page.tsx` (the `%5F` makes `/_debug/convex` publicly routable), update its tripwire test (`apps/web/__tests__/debug-route.test.ts` currently asserts the file EXISTS — flip/remove it), remove the `robots.txt` Disallow entry for it, and any README note. Follow the removal checklist embedded in the file header.

**D-8.** Remove the 5 dead Convex `useQuery` subscriptions in `apps/web/components/issue/DeliberationSlot.tsx` (lines ~49-56, `void run; void pitchLog; ...`). They open 5 subscriptions per visitor on the highest-traffic page and discard all results; the rendered deliberation actually comes from Sanity (`IssueLayout.tsx`). Remove the subs and the stale `MOCK_ISSUE` comment. **Guard:** the DEL-04 / "5 Convex subs" tripwire referenced across prior phases (11-19) may assert these exist — check for and update/remove that tripwire test so this doesn't regress a prior contract; confirm the deliberation still renders from Sanity.

**D-9.** Add a visible checkout-failure message in `apps/web/components/marketing/BuyButton.tsx`. On API error it currently only `console.error`s and re-enables the button (silent). Add a dry, on-voice inline message (no toast — matches the "no toast per voice rules" note). Also consider replacing the runtime `require()` in the client component (fragile under Turbopack) with a static import.

**D-10.** Add an ESLint config to `apps/web` so `next lint` / `pnpm lint:web` stops dropping into the interactive "How would you like to configure ESLint?" prompt (the gate is currently non-functional; every `eslint-disable` comment is decorative). Use Next's flat/eslintrc config appropriate to Next 15. Must not introduce a wall of new errors that blocks CI — configure to match the existing code (warnings acceptable, don't fail the build on pre-existing style).

**D-11.** Fix the ~17 TypeScript errors in `apps/web/__tests__` (product source is clean). Errors: TS2532 "possibly undefined" in `checkout-create-session.test.ts` + `stripe-webhook-idempotency.test.ts`; stale `@ts-expect-error` directives in `model-pricing-staleness.test.ts:21`, `notifications-ledger.test.ts:24`, `stripe-reconciliation.test.ts:23`; null-safety in `stripe-reconciliation.test.ts:57`, `notifications-ledger.test.ts:51,62`. `pnpm --filter web typecheck` must exit 0 afterward.

**D-12.** Add a favicon. No `app/icon.*` / `app/favicon.ico` exists; `/favicon.ico` 404s and tabs show the default globe. Add a real favicon (use the brand mark / an on-brand mark). Verify it's served.

**D-13.** Document missing env vars in the tracked `.env.example` files (docs-only — do NOT set real values):
- `apps/dispatch-control/.env.example` + `apps/dispatch-control/DEPLOY.md`: add `PREVIEW_SECRET` and `NEXT_PUBLIC_WEB_PREVIEW_BASE` (used in `lib/previewToken.ts` / review page; the review-gate preview silently degrades to "not configured" without them). Also correct DEPLOY.md's "optional" label on `NEXT_PUBLIC_PIPELINE_URL` — the review/control clients THROW without it.
- `packages/pipeline/.env.example`: add `DESIGNAGENT_SUPPRESSED` (operationally significant Railway toggle, referenced in `graph/builder.py`; current live posture = true) and `LOG_LEVEL`.

### Claude's Discretion
- Exact shape of the Convex auth-guard helper (a shared `requireOperator(ctx)` helper vs inline per-function) — planner/executor choose, but it must derive actor from `getUserIdentity().subject`.
- How the deployed-env marker is detected for D-2 (env var name/precedence) — pick the simplest robust signal.
- Favicon artwork source (existing brand asset vs a simple generated mark).
- ESLint config style (flat config vs `.eslintrc.json`) appropriate to the Next 15 version in use.
- Whether to also drop the dead `supabase` dep in D-5.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Interface contracts (MANDATORY before any Convex/pipeline signature change)
- `docs/API_CONTRACTS.md` — every interface boundary (Convex mutation shapes, pipeline endpoints, LangGraph DispatchState). Converting mutations to `internalMutation` or changing signatures must be checked here first (project rule: do not change field names without checking this).
- `convex/schema.ts` — Convex table definitions (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog, runs, stripeOrders, stripeEvents, etc.). Do not modify field names.

### Convex auth reference pattern
- `convex/payouts.ts` (`markPayoutSent`), `convex/pipelineConfig.ts` (`setNotificationConfig`), `convex/users.ts` (`upsertCurrentUser`) — the three mutations that already gate on `ctx.auth.getUserIdentity()`; replicate this for the dashboard lane.
- `convex/auth.config.ts` — Clerk JWT issuer config for Convex.
- `apps/dispatch-control/` `ConvexProviderWithClerk` wiring + `middleware.ts` — how the operator JWT reaches Convex.

### Pipeline auth + lifecycle
- `packages/pipeline/src/eisenbalm_pipeline/api/auth.py`, `api/runs.py`, `api/control.py`, `api/agents.py` — auth guards to make fail-closed (D-2, D-3).
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` (lifespan) — where the restart-reconciliation sweep goes (D-4).
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — how the pipeline authenticates to Convex (admin deploy-key path that must keep working after internalMutation conversion).
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` — the reference fail-closed pattern.

### Stripe webhook path
- `apps/web/app/api/stripe/webhook/route.ts` + `apps/web/lib/stripe/handlers.ts` — the ConvexHttpClient that needs admin auth (D-1 lane 3).
- `convex/stripeEvents.ts` (`claim`), `convex/stripeOrders.ts` (`insert`), `convex/emailActions.ts` — the currently-public functions to internalize.

### Prior tripwire contracts to respect / update
- Prior phases (11-19) locked "5 Convex subs", DEL-04, game-sandbox, theme, WCAG AA, single `<main>`, ≥44px targets — D-8 touches the "5 Convex subs" contract deliberately; check for and update the specific tripwire test rather than silently breaking it.
- Project memory `pre-deploy-audit-260703` — full audit findings this phase derives from.

### Project workflow
- `CLAUDE.md` — GSD workflow enforcement, voice constraints, schema-change rules, tech-stack locks (no new npm deps without cause; here D-10 ESLint is dev-tooling, not a runtime dep — acceptable).
</canonical_refs>

<specifics>
## Specific Ideas

- Suggested wave shape: **Wave 1** = the three security-critical, mostly-independent tracks in parallel — (A) Convex auth lockdown [convex/ + Stripe webhook client], (B) pipeline auth fail-closed + constant-time compare [api/auth.py, runs.py, control.py], (C) pipeline restart reconciliation [main.py lifespan] + pyproject deps. **Wave 2** = mechanical web cleanups that don't collide (debug route removal, dead subs, BuyButton message, favicon, ESLint, test TS fixes) and the doc-only env.example/DEPLOY.md fixes. Group by file-collision, not by theme.
- Verification per the audit: `pnpm typecheck:convex` (exit 0), `pnpm --filter web typecheck` (exit 0 after D-11), `pnpm --filter web build` + `pnpm --filter dispatch-control build` + `pnpm build:studio` (all currently green — keep green), `pnpm --filter web test` (440 pass — keep green, minus intentionally-removed tripwires), pipeline `uv run pytest` (354 pass — keep green; add coverage for D-2/D-3/D-4 where practical). Per memory `run-strict-build-before-frontend-phase-done`: run the strict `build`, not just vitest, before declaring any web/dispatch-control work done.
- The pipeline has a strong existing test suite and stub mode (`EISENBALM_STUB_MODE`) — D-2/D-3/D-4 should get unit tests (fail-open regression, constant-time compare, orphaned-run sweep).
</specifics>

<deferred>
## Deferred Ideas

- **Checkpointer resume** after crash (re-enter a killed run from its last checkpoint) — larger effort; D-4 does reconciliation only.
- **Weekly cron scheduling** setup — external (Railway service creation) + a config seed; user's punch-list, not code.
- **OpenRouter/Tavily retry hardening** (backoff, 429 handling) — noted in audit as thin but bounded (no runaway risk); not a deploy blocker, deferred.
- **`FONTS_DIR` fragility** under non-editable install (`agents/publisher/fonts.py`) — real but hasn't recurred since the Dockerfile fix; consider `importlib.resources` later.
- **Renaming** `SUPABASE_POSTGRES_URL` → a Railway-accurate name — wider change touching Railway config; D-6 only fixes the misleading docs/strings.
- **Per-issue OG images**, on-demand revalidation endpoint, `global-error.tsx` — audit "notes", not blockers.
</deferred>

---

*Phase: 29-deployment-hardening-code-fixes*
*Context gathered: 2026-07-03 from pre-production audit*
