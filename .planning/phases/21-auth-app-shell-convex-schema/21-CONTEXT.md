# Phase 21: Auth + App Shell + Convex Schema - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the new `dispatch-control` Next.js app behind Clerk authentication, build a navigable app shell (top-level nav: Graph, Runs, Config, Prompts, Registry, Finance, Settings), define all 11 new Convex tables each carrying `workspace_id`, protect FastAPI dashboard-control endpoints with Clerk JWT verification (while the Railway cron path keeps its existing `X-Pipeline-Trigger-Secret`), seed the single `eisenbalm` workspace, and attribute the signed-in operator's identity to audit-log and run records from day one.

**Explicitly in scope:**
- `apps/dispatch-control` scaffold (Next 15 / React 19 / Tailwind v4 / shadcn, matching `apps/web`)
- Clerk auth: every dashboard route + dashboard API protected; `apps/web` stays 100% unauthenticated
- App shell chrome with the 7 nav items routing to placeholder pages
- 11 new Convex tables with `workspace_id` + `by_workspace` indexes
- `eisenbalm` workspace seed + just-in-time user provisioning on first sign-in
- FastAPI Clerk-JWT verification on dashboard-control endpoints (cron secret untouched)
- Operator attribution shape (`triggered_by` / actor fields) defined on `runs` and `audit_log`

**Explicitly NOT in scope (owned by later phases):**
- Config externalization / prompt loader + run snapshot (Phase 22)
- Node wrappers, read-only dashboard views, real run data (Phase 23)
- Prompt editing/versioning UI (Phase 24)
- Run control / scheduler / cancel (Phase 25)
- Review gate / charity registry behavior (Phase 26)
- Stripe reconciliation / notifications (Phase 27)

</domain>

<decisions>
## Implementation Decisions

### Schema depth (the area discussed in detail)
- **D-01:** Hybrid depth, not full-now and not all-stubs. Tables Phase 21 actually exercises get **full** field definitions; the tables owned by later phases get **minimal stubs** (just `workspace_id` + a couple of obvious keys) and are fleshed out by their owning phase. Rationale: avoid guessing fields that phases 22–27 will discover and rewrite, while still proving the workspace-scoping + attribution shape now.
- **D-02:** **Full-shape tables in Phase 21** (4): `workspaces`, `users`, `runs`, `audit_log`. These carry their real, considered field sets because auth, seeding, and attribution (criterion 4) depend on them.
- **D-03:** **Stub tables in Phase 21** (7): `agents`, `prompt_versions`, `pipeline_config`, `agent_runs`, `charities`, `model_pricing`, `review_actions`. Each defined as `workspace_id` + minimal identifying keys only; owning phase adds the rest:
  - `agents` → Phase 23 (and config in 22)
  - `prompt_versions` → Phase 22/24
  - `pipeline_config` → Phase 22 (incl. `schedule_enabled`, `auto_publish`, `require_review`)
  - `agent_runs` → Phase 23
  - `charities` → Phase 26
  - `model_pricing` → Phase 27
  - `review_actions` → Phase 26
- **D-04:** **Attribution is "defined + seed/auth writes only" this phase.** `workspaces` is seeded and `users` is written (JIT on sign-in) for real in Phase 21. `runs` and `audit_log` are fully **defined** with their `triggered_by` / actor fields, but the actual run-trigger and audit *write flows* land with their endpoints in later phases (23/25). Phase 21 proves the shape, not the full live flow. Criterion 4 is satisfied by the schema carrying operator attribution from day one; do NOT build a synthetic run-trigger path just to demo it.
- **D-05:** **`workspace_id` index on every new table.** Every one of the 11 tables gets a `.index('by_workspace', ['workspace_id'])` (use a compound `by_workspace_and_<key>` where a natural secondary key exists, e.g. `runs` → `by_workspace_and_runId`). This matches criterion 5's "query by `workspace_id`" and avoids a destructive index migration over live run data later.
- **D-06:** **Follow the existing Convex file pattern.** Append all 11 `defineTable` definitions inline to `convex/schema.ts`, each preceded by an ASCII section-header comment (the established convention, e.g. `// ── <table> (Phase 21 — v2.0 Mission Control) ──`). Create per-table `.ts` files (mutations/queries) only when a phase needs that table's logic — mirroring how `pipelineRuns.ts`, `stripeOrders.ts`, etc. exist alongside `schema.ts`. The seed mutation + any users mutation needed this phase get their own file(s).

### App shell scope & layout (Claude's discretion — locked from brief + research)
- **D-07:** The 7 nav routes (Graph, Runs, Config, Prompts, Registry, Finance, Settings) render **placeholder pages** ("coming soon" / phase-labeled stubs), not chrome-only dead links — every nav item navigates to a real route that renders.
- **D-08:** **Sidebar layout** for the shell (persistent left nav + main content area), built with shadcn primitives to match `apps/web` conventions (neutral base color, CSS variables). Active-route highlighting on the nav.
- **D-09:** Landing/index route of `dispatch-control` redirects to (or renders) a sensible default — **Graph** as the home view per the brief's "dashboard mirrors the real pipeline graph" framing; the placeholder is fine for now.
- **D-10:** Shell includes the Clerk user button / sign-out affordance in the chrome.

### Operator identity & attribution (Claude's discretion — locked from brief + research)
- **D-11:** **Clerk just-in-time user provisioning** — on first authenticated load, upsert a `users` row keyed by the Clerk user id (store Clerk id, email, display name, `workspace_id="eisenbalm"`). No separate invite flow.
- **D-12:** **FastAPI verifies the Clerk JWT via JWKS** (Clerk's public keys / issuer), not by trusting Convex. Dashboard-control endpoints require a valid Clerk session token; the cron path's `X-Pipeline-Trigger-Secret` is untouched and unaffected.
- **D-13:** Attribution fields (`triggered_by`, capturing the operator's Clerk user id / `users` ref) are defined on `runs` and `audit_log` now; population happens where those write paths are built (later phases), except seed/auth writes which happen now.

### workspace_id type & seeding (Claude's discretion — locked from brief + research)
- **D-14:** **`workspace_id` is a plain string slug** (value `"eisenbalm"`), NOT a `v.id('workspaces')` reference. Criterion 5 literally specifies `querying by workspace_id = "eisenbalm"`, so the string-slug form is canonical. The `workspaces` table's own identifying key is the slug.
- **D-15:** **Seed via a Convex seed mutation** (idempotent — safe to re-run; matches the project's deterministic-upsert convention), not an ad-hoc script and not a Clerk webhook. Seeds the one `eisenbalm` workspace record.
- **D-16:** No hardcoded "eisenbalm" or charity-specific logic anywhere in the control-plane *code* — the slug lives only as seeded data + the default workspace constant. (Productization bones per brief §6.)

### Claude's Discretion
- Exact placeholder page copy/styling, shell spacing/typography, and which lucide icons map to each nav item.
- Precise field names within the full-shape tables (`workspaces`, `users`, `runs`, `audit_log`) beyond `workspace_id` + the attribution fields — researcher/planner to align with the brief's §5 data model and `pipelineRuns` join key (`runId`).
- Whether `dispatch-control` gets its own Vercel project now vs deferred config note (see canonical refs — research flags this as "confirm during Phase 21"); it MUST share the same Convex deployment as `apps/web` to read the same data.
- Clerk env-var wiring, middleware matcher specifics, and `ConvexProviderWithClerk` setup details.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & reconciliation (read first)
- `docs/MISSION_CONTROL_BRIEF.md` — Canonical v2.0 spec. §2 (config externalization keystone), §5 (technical architecture + data model listing all tables), §6 (productization bones / `workspace_id` threading), §8 (resolved decisions: Clerk, separate app, require_review default-on, Railway cron).
- `docs/CURRENT_STATE.md` — Phase 0 codebase reconciliation: frontend auth is greenfield (no middleware/provider/session today); prompts already file-externalized; content split across Sanity/Convex/Railway-Postgres.

### Research (v2.0 milestone)
- `.planning/research/SUMMARY.md` — Synthesis: Clerk is the Phase-1 blocker; `workspace_id` on every new table from day one (retrofitting later is a destructive migration); `runs` augments frozen `pipelineRuns`; auth boundary (Clerk on dispatch-control only, FastAPI verifies JWT, cron keeps secret).
- `.planning/research/STACK.md` — `@clerk/nextjs ^7.x` (chosen; native `ConvexProviderWithClerk`; do not revisit), reused packages.
- `.planning/research/ARCHITECTURE.md` — Config-in-Convex decision; frozen `pipelineRuns`/`deliberationEvents`; `runs`/`agent_runs` table design; auth boundary details.
- `.planning/research/PITFALLS.md` — `workspace_id` from day one (Phase 21 tag); no Eisenbalm-specific control-plane logic.

### Existing code / contracts
- `convex/schema.ts` — The 9 existing tables + conventions (inline `defineTable`, ASCII section headers, `.index()` patterns, deterministic upserts). New tables append here.
- `convex/pipelineRuns.ts`, `convex/stripeOrders.ts` — Per-table mutation/query file pattern to mirror.
- `docs/API_CONTRACTS.md` — §4 `pipelineRuns` contracts are FROZEN; the new `runs` table is additive on the same `run_id`. FastAPI route/secret conventions (Sanity webhook HMAC, secret-guarded `/run`).
- `apps/web/` — Stack to match: `package.json` (Next 15, React 19, Tailwind v4, convex ^1.38, lucide-react), `components.json` (shadcn: default style, neutral base, CSS variables, RSC), `app/layout.tsx`.
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py`, `api/runs.py`, `api/webhooks.py` — FastAPI app + existing secret-guard pattern to extend with Clerk-JWT verification (without touching the cron secret path).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/web` stack & shadcn config** — `apps/dispatch-control` should clone the same toolchain (Next 15 App Router, React 19, Tailwind v4 via `@tailwindcss/postcss`, shadcn neutral/CSS-vars, lucide-react). `components.json` aliases (`@/components`, `@/components/ui`, `@/lib`, `@/hooks`) are the template.
- **`@eisenbalm/shared` + `@eisenbalm/convex` workspace packages** — dispatch-control consumes the same Convex deployment (`convex ^1.38.0`) and shared types via pnpm `workspace:*`.
- **Convex conventions** — `defineTable` + `v.*` validators + `.index('by_x', [...])`; deterministic/idempotent upserts; per-table mutation files. Stripe idempotency tables show the `claim`/upsert pattern for the seed mutation.

### Established Patterns
- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`), NO Turborepo. Root `package.json` adds per-app scripts (`dev:web`, `dev:convex`, …) — add `dev:dispatch-control` / build / typecheck equivalents.
- **FastAPI:** secret-guarded endpoints (`X-Pipeline-Trigger-Secret`); `PyJWT` is already vendored in the pipeline venv (`jwt/api_jwt.py` present) — usable for Clerk JWKS verification.
- **No existing frontend auth** — Clerk provider/middleware is entirely greenfield; nothing in `apps/web` to refactor or risk breaking.

### Integration Points
- `convex/schema.ts` — append 11 tables; runs in the SAME Convex deployment used by `apps/web` (no new deployment).
- Root `package.json` workspaces + scripts — register the new app.
- `apps/web` must remain unauthenticated — verify no Clerk dependency leaks into it.
- FastAPI `api/main.py` dependency/middleware layer — add Clerk-JWT auth dependency to dashboard-control routes only; leave cron + Sanity-webhook paths on their existing guards.

</code_context>

<specifics>
## Specific Ideas

- Mental model for all schema + code work: "a configurable graph of agents that produces a scheduled content artifact" — NOT "Eisenbalm's pipeline." Keep the control plane brand-agnostic (brief §6).
- The 4 full-shape tables exist to make criterion 4 (operator attribution from day one) and criterion 5 (workspace query) provably true at the schema level, even though the live run/audit *write* flows arrive in later phases.
- `runs` shares the `runId` join key with the frozen `pipelineRuns` and is the dashboard-facing superset — do not modify `pipelineRuns`.

</specifics>

<deferred>
## Deferred Ideas

- Config externalization, prompt loader swap, run-config snapshot — **Phase 22**.
- Node wrappers (`wrap_agent_node`), `agent_runs` emissions, read-only dashboard views, `lib/registry.py` test-run — **Phase 23**.
- Prompt editing (CodeMirror + `{variable}` decoration), versioning, diff, rollback — **Phase 24**.
- Run control (`/pipeline/tick` + Railway cron, cancel, schedule editor, re-roll, budget caps) — **Phase 25**.
- Review gate, `auto_publish` friction, claims gate, charity registry + Scout dedup — **Phase 26**.
- Stripe reconciliation, Resend/Slack notifications, `model_pricing` usage — **Phase 27**.
- Per-workspace secrets, Clerk Organizations, graph-as-data, "rename the brand" grep test — **Phase 28 / productization prep**.
- `dispatch-control` dedicated Vercel project provisioning — to be confirmed during Phase 21 planning (infra note from research); shares one Convex deployment regardless.

</deferred>

---

*Phase: 21-auth-app-shell-convex-schema*
*Context gathered: 2026-06-21*
