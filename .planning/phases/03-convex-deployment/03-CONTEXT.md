# Phase 3: Convex Deployment - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning
**Mode:** auto (user requested no clarifying questions — recommended defaults selected for every gray area)

<domain>
## Phase Boundary

Deploy the existing `convex/schema.ts` to a live Convex deployment, implement every query and mutation function spelled out in `docs/API_CONTRACTS.md §3-4`, provision the two Convex env vars (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`) across `apps/web/.env.local`, Vercel, and Railway, and wire `apps/web` with `ConvexProvider` + a verification surface deep enough that the five `useQuery` subscriptions return empty arrays (not errors) against empty tables (CVX-05).

**In scope:**
- Convex CLI init checkpoint (manual, by Andrew — like Phase 1 sanity-init)
- `convex/` promoted to its own workspace (`@eisenbalm/convex`) with its own `package.json` so the Convex CLI is owned by a real workspace while the directory stays at repo root per brief
- Five query/mutation files: `convex/pipelineRuns.ts`, `convex/pitchLog.ts`, `convex/deliberationEvents.ts`, `convex/agentVotes.ts`, `convex/qaCorrections.ts` — exact match to API_CONTRACTS §4
- `convex/_generated/` committed (matches Phase 1 D-08 "TypeGen artifacts checked in" pattern)
- `apps/web` Convex client: `convex` + `convex/react` deps, `ConvexProvider` in root layout, env wiring
- A hidden `/_debug/convex` route that exercises all five `useQuery` calls — Phase 3's CVX-05 evidence surface. **Removed in Phase 9** when the real `DeliberationSlot` wiring lands.
- Env files: extend `apps/web/.env.example` (commit) + `.env.example` at repo root for pipeline; document Vercel + Railway provisioning in README.
- `apps/web/README.md` Convex section + new `convex/README.md` onboarding doc.
- Andrew's manual smoke test (deploy succeeds, `/_debug/convex` returns 5 empty arrays, curl HTTP API returns `[]`).

**Strictly NOT in this phase:**
- Python `convex_client.py` (Phase 4)
- Real `DeliberationSlot` UI subscribing to live data (Phase 9)
- Any pipeline write that actually populates Convex tables (Phase 4 stubs, Phase 5 real)
- Convex auth / user identity (the system has no logged-in readers — public reads only, deploy key for server writes)
- A staging/dev Convex deployment alongside production (single prod deployment only — mirrors Sanity D-15)
- `convex.config.ts` (auth, http actions, crons, scheduled functions) — none of these are in v1
- Convex Vector / Convex File Storage / Convex Search — not used by this project
- Component testing of the `/_debug/convex` route beyond Andrew's manual smoke

</domain>

<decisions>
## Implementation Decisions

### Convex CLI + deployment topology

- **D-01:** Convex `1.38.0` (per `.planning/research/STACK.md`). Pin the major + minor in `convex/package.json` to avoid silent jumps; `convex` and `convex/react` ship as one package (peerDep on react), so the pin applies to both `apps/web` and `convex/`.
- **D-02:** **Single `production` deployment only.** No dev/staging Convex deployments in v1. Mirrors Phase 2 D-15 (`production` Sanity dataset only) and matches the one-Andrew, weekly-cadence ops model. If a second deployment becomes useful later, add it then.
- **D-03:** Convex CLI initialization is a **manual checkpoint Andrew runs once**, mirroring the Phase 1 D-20 `npx sanity@latest init` pattern. The plan ships everything around it; Andrew runs:
  ```bash
  pnpm --filter @eisenbalm/convex exec convex dev --once --configure
  ```
  This authenticates via OAuth, creates the deployment, and writes `convex.json` + sets `CONVEX_DEPLOYMENT` env hint. Plan must NOT attempt to run this autonomously. README documents the prerequisite.
- **D-04:** After Andrew completes the init checkpoint, the plan commits the generated `convex.json` and any deterministic config files. Secrets (`CONVEX_DEPLOY_KEY`, deployment URL) go into `.env.local` (gitignored) and `.env.example` (committed, with placeholder values).

### Monorepo placement

- **D-05:** **Promote `convex/` to its own workspace** named `@eisenbalm/convex`. The brief and Phase 1 D-05 both pin `convex/` at the repo root; this is satisfied by keeping the directory at root while adding `convex/package.json` so the Convex CLI has a workspace home. The package is private, has its own `convex` dev-dep, and exposes the queries/mutations only for inter-workspace type imports (not as a runtime export).
- **D-06:** Add `convex` to `pnpm-workspace.yaml` if not already covered by `apps/*` + `packages/*` — extend the workspace globs to include the root `convex/` directory. Cleanest add: keep `apps/*` and `packages/*`, and add `convex` as an explicit entry.
- **D-07:** `apps/web` consumes the generated Convex API via the auto-generated `api` object from `convex/_generated/api`. Type imports use a relative path (`@/../../../convex/_generated/api` or, cleaner, a TS path alias in `apps/web/tsconfig.json` mapping `@convex/*` to `../../convex/*`). Recommended: TS path alias to avoid fragile relative imports.

### Generated artifacts

- **D-08:** **Check `convex/_generated/` into git.** Mirrors Phase 1 D-08 + D-14 ("Do NOT gitignore generated `sanity.types.ts`"). Reasoning: type stability across CI / fresh clones / dev environments. Add a comment to the `_generated/` directory's `.gitignore` (or to the repo README) explaining the policy.
- **D-09:** Document the `pnpm --filter @eisenbalm/convex codegen` (or `convex dev --once`) command in `convex/README.md` so engineers regenerate after schema edits. No CI gate yet (Phase 1 D-15 deferred CI; carry the same posture).

### Query / mutation function files

- **D-10:** **One file per table — five files total**, exact filenames and exports per API_CONTRACTS §4.1-4.5:
  - `convex/pipelineRuns.ts` — `byRunId`, `create`, `updateStatus`
  - `convex/pitchLog.ts` — `byRunId`, `insert`, `markSelected`
  - `convex/deliberationEvents.ts` — `byRunId`, `byRunIdAndType`, `insert`
  - `convex/agentVotes.ts` — `byRunId`, `byRunIdAndCharity`, `insert`
  - `convex/qaCorrections.ts` — `byRunId`, `insert`
  - No additions, no renames, no consolidation. API_CONTRACTS is the contract; the planner copies it verbatim.
- **D-11:** Argument validators on every mutation use `v.literal(...)` unions for enum-like fields (e.g. `status`, `eventType`, `vote`, `severity`) — copied directly from `convex/schema.ts`. Convex enforces this at the mutation boundary so a malformed pipeline call fails fast rather than corrupting state.
- **D-12:** Insertion mutations set `timestamp: Date.now()` server-side — never trust the caller's clock. This matches API_CONTRACTS §4 verbatim and is critical for the deliberation event ordering Phase 9 will rely on.
- **D-13:** `pipelineRuns:updateStatus` finds the row by `runId` index, asserts it exists, and patches. If not found it throws — surfaces a pipeline bug loudly. (API_CONTRACTS §4.1 already specifies this.)

### Web app wiring (`apps/web`)

- **D-14:** Add deps to `apps/web/package.json`: `convex@^1.38.0` (the package ships both server and react entry points; no separate `convex/react` package). No other new deps.
- **D-15:** **`ConvexProvider` mounts in root `apps/web/app/layout.tsx`** with a `ConvexReactClient` constructed once and memoized at module scope. This is cheap (single websocket, idle when no `useQuery` is mounted), future-proofs Phase 9, and keeps the provider out of every per-route layout.
- **D-16:** The `ConvexReactClient` is constructed with `process.env.NEXT_PUBLIC_CONVEX_URL`. If the env var is missing at runtime, fall back to a no-op client / log a warning rather than crash the app (so devs without a Convex deployment can still see the rest of the site).
- **D-17:** The provider is a Client Component (`'use client'`); root layout passes children straight through. No `Suspense` boundary added in Phase 3 — Phase 9 introduces loading states when there's actual UI to gate.
- **D-18:** **Add a hidden `/_debug/convex` route** (`apps/web/app/_debug/convex/page.tsx`) — a Client Component that runs all five `useQuery` calls against a hardcoded `runId` value (`"phase-3-smoke-test"`, guaranteed empty) and renders the result counts in a simple table. This satisfies CVX-05 by exercising the live web → Convex path against empty tables.
  - Route is **NOT** linked from the site nav / sitemap / RSS / robots.
  - Route is **explicitly excluded** from `sitemap.xml` and `feed.xml` outputs (planner verifies).
  - Route returns 404 in production via `robots.txt` `Disallow: /_debug/` + a `<meta name="robots" content="noindex,nofollow" />` in the head.
  - Route is **removed in Phase 9** when the real `DeliberationSlot` subscriptions land. Phase 3's plan notes this as a Phase 9 cleanup task.
- **D-19:** TS path alias in `apps/web/tsconfig.json`: `"@convex/*": ["../../convex/*"]` so debug page imports `@convex/_generated/api`. Cleaner than long relative paths.

### Environment variables

- **D-20:** Two new env vars introduced in Phase 3:
  - `NEXT_PUBLIC_CONVEX_URL` — public deployment URL (e.g. `https://artful-mosquito-123.convex.cloud`), safe to expose, used by `ConvexReactClient`
  - `CONVEX_DEPLOY_KEY` — server-side write key, used by pipeline HTTP API (Phase 4) and Convex CLI deploys, **secret**
- **D-21:** Env wiring:
  - `apps/web/.env.local` (gitignored) — gets both vars (web only needs URL but having key locally is fine for HTTP API smoke tests)
  - `apps/web/.env.example` (committed) — gets both var names with placeholder values
  - Root `.env.example` (committed) — gets `CONVEX_DEPLOY_KEY` for the pipeline-shaped env reference (Phase 4 will consume); update to include `NEXT_PUBLIC_CONVEX_URL` for cross-workspace clarity
  - `convex/.env.local` (gitignored) — Convex CLI's local deployment hint file (autogenerated by `convex dev`)
- **D-22:** **Vercel + Railway env provisioning is MANUAL and documented**, mirroring Phase 2 D-27. README shows the exact `vercel env add` and `railway variables set` commands. The planner does NOT attempt to provision remote env vars autonomously.

### Smoke test (CVX-05 evidence)

- **D-23:** End-of-phase manual smoke test (`apps/web/README.md` + `convex/README.md`):
  1. `pnpm --filter @eisenbalm/convex exec convex dev --once --configure` — interactive init (one-time)
  2. `pnpm --filter @eisenbalm/convex deploy` — push schema + functions to prod
  3. Visit Convex dashboard → confirm five tables exist, five functions visible
  4. From dashboard, run each `byRunId` query with `runId: "nonexistent"` → expect empty array
  5. `pnpm --filter web dev` → browse to `http://localhost:3000/_debug/convex` → confirm five rows in the table, all showing `count: 0` (no errors)
  6. `curl -H "Authorization: Convex $CONVEX_DEPLOY_KEY" -d '{...}' $CONVEX_URL/api/mutation` smoke (creates + deletes a dummy run) to confirm Railway pathway works
- **D-24:** Document the cleanup contract: Phase 9 must remove `/_debug/convex` and replace with real `DeliberationSlot` Convex subscriptions. Add a `TODO(Phase 9):` comment at the top of the debug page.

### Documentation

- **D-25:** Create `convex/README.md` covering: what lives in `convex/`, the manual `convex dev --configure` checkpoint, how to regenerate `_generated/`, env vars, deploy workflow, link to API_CONTRACTS §3-4.
- **D-26:** Update `apps/web/README.md` with a new Convex section: what `/_debug/convex` is for, how to add the env vars, what Phase 9 will change.

### Claude's Discretion

- Exact tsconfig path-alias shape — planner picks the form (`@convex/*`, `~convex/*`, or relative imports) based on what plays nicely with Next 15's bundler.
- Exact wording of the `/_debug/convex` page table (Jesse voice, dry — "pipelineRuns: 0 rows", no emojis, no winks).
- Whether to scope the `ConvexReactClient` instantiation behind a getter (lazy) or eagerly (module-scope const) — planner picks based on Next 15 RSC compatibility. Lazy is safer if eager triggers RSC errors.
- Whether to silence Convex's verbose websocket logging in production (`client.setDebug(false)`) — planner decides based on dev experience.

### Folded Todos

(None — no pending todos matched Phase 3 scope per `gsd-tools todo match-phase 3`.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 specific

- `docs/API_CONTRACTS.md §3` — Pipeline → Convex mutation call shapes (Python-side). Planner uses these as the EXACT input shapes the mutation argument validators must accept.
- `docs/API_CONTRACTS.md §4` — Next.js → Convex TypeScript query files. **Copy verbatim** into `convex/pipelineRuns.ts` etc. The contract IS the implementation.
- `convex/schema.ts` — Existing schema. Five tables, all indexes already defined. Do NOT modify.

### Project / brand

- `CLAUDE.md` — "do not modify field names without checking API_CONTRACTS.md first" rule
- `docs/CLAUDE_CODE_BRIEF.md` — Convex usage notes (deliberation stream, run status, no auth)
- `docs/API_CONTRACTS.md §1.7` — `QUERY_ISSUE_RUN_ID` already implemented in `apps/web/lib/sanity/queries.ts`; documents the runId → Convex link Phase 9 will exploit

### Phase 1 & 2 outputs (consumed in Phase 3)

- `package.json` (root) — pnpm workspaces. Adding `convex` to the workspace list.
- `pnpm-workspace.yaml` — workspace globs. May need an explicit `convex` entry.
- `tsconfig.base.json` — strict TS config inherited by `convex/tsconfig.json`.
- `apps/web/package.json` — extend deps with `convex@^1.38.0`.
- `apps/web/app/layout.tsx` — mount `ConvexProvider` here.
- `apps/web/.env.example` — already exists from Phase 2; extend with Convex vars.
- `.env.example` at repo root — extend with Convex vars for pipeline-shape clarity.
- `apps/web/lib/sanity/queries.ts` — already exports `QUERY_ISSUE_RUN_ID` for Phase 9.
- `apps/web/components/issue/DeliberationSlot.tsx` — Phase 2 placeholder. Phase 9 wires Convex subscriptions here; Phase 3 leaves it untouched.

### Research

- `.planning/research/STACK.md` — Convex 1.38.0 pin; HTTP API contract; "no auth configuration needed"
- `.planning/research/PITFALLS.md` — LangGraph parallel-failure → `pipelineRuns.status` patterns (informs why mutation argument validators matter)
- `.planning/codebase/INTEGRATIONS.md §Convex` — Tables, mutations, queries, env vars, HTTP API shape

### Phase 9 forward link (Phase 3 contract owed)

- `apps/web/components/issue/DeliberationSlot.tsx` (Phase 9) — Phase 3 must leave this untouched but provide the wiring (provider + types + env) that Phase 9 will consume.
- `apps/web/app/_debug/convex/page.tsx` (Phase 3 ships, Phase 9 removes) — TODO(Phase 9) comment at the top of the file.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `convex/schema.ts` — production-ready, no changes. Five tables, every needed index, every `v.literal()` enum already defined. The planner reads but does not edit this file.
- `docs/API_CONTRACTS.md §4` — query/mutation handlers are pre-written as TypeScript snippets. Planner copies them into the appropriate files; no design work required at the function-shape level.
- `apps/web/lib/sanity/queries.ts QUERY_ISSUE_RUN_ID` — Phase 2 already reserved the runId fetch path. Phase 9 will plug `useQuery(api.deliberationEvents.byRunId, { runId })` next to this.
- `apps/web/app/layout.tsx` — root layout is the natural mount point for `ConvexProvider` (single shared client).
- `apps/web/components/issue/DeliberationSlot.tsx` — Phase 2 placeholder is a `<details>`/`<summary>` zero-JS collapsible. The internal text "Deliberation data will appear here when the pipeline is connected." is the cleanup target for Phase 9.

### Established Patterns

- **Manual interactive CLI checkpoints by Andrew** (Phase 1 D-20 sanity init; Phase 2 D-27 vercel link). Phase 3 reuses for `npx convex dev --configure`.
- **Generated artifacts checked in** (Phase 1 D-08 `.gitignore` exception, Phase 1 D-14 `sanity.types.ts` checked in). Phase 3 applies the same to `convex/_generated/`.
- **`.env.local` (gitignored) + `.env.example` (committed)** at every workspace boundary that needs config. Phase 3 adds two more `.env.example` lines.
- **Deterministic `_id`s for inserts** (Phase 1 D-17 `agent-{id}`, Phase 2 D-17 `charity-{slug}`, `issue-{paddedNumber}`). Convex uses auto-generated `_id`s by default — the `runId` field is the application-level dedupe key. No `_id` discipline change required.
- **Pin major+minor versions, not just major** (Phase 2 D-01 Next `^15.3.x`, Phase 1 D-01 Sanity v5.24+). Phase 3 pins `convex@^1.38.0`.
- **README per workspace** for onboarding (Phase 1 `apps/studio/README.md`, Phase 2 `apps/web/README.md`). Phase 3 adds `convex/README.md`.
- **No CI gates in v1** (Phase 1 D-15, D-22; Phase 2 implicit). Phase 3 holds the line.
- **Field names locked across schemas + contracts + types** (CLAUDE.md). Convex `schema.ts` field names ARE the contract; queries/mutations consume them verbatim.

### Integration Points

- `apps/web` (Convex client subscribes from browser) ↔ `convex/` (deployed functions). New websocket boundary; Phase 3 owns the wiring.
- `packages/pipeline` (Phase 4) → Convex HTTP API. Phase 3 ships only the env-var documentation and curl example; the Python client is Phase 4 work.
- Vercel + Railway env stores. Phase 3 ships the docs; Andrew provisions.

### Constraints from Existing Code

- `convex/` is at repo root per brief — do not relocate.
- `convex/schema.ts` field names are locked — Convex `v.literal(...)` enums in mutations MUST match the schema's enum values exactly.
- Next.js 15 + RSC: the `ConvexProvider` must be a Client Component island. The root layout itself can stay a Server Component; the provider wraps `children` via a small `'use client'` wrapper component (typical pattern).
- `apps/web/.env.example` is committed; Vercel build will fail if `NEXT_PUBLIC_CONVEX_URL` is required at build time. Plan must make the env var **optional at build** (fallback no-op client when missing) so previews/builds without a configured Convex still pass.

</code_context>

<specifics>
## Specific Ideas

- **Andrew's first run after Phase 3:** README must produce a clean onboarding sequence:
  1. `pnpm install` from repo root (picks up `convex` dep)
  2. `pnpm --filter @eisenbalm/convex exec convex dev --once --configure` (interactive — auth + create deployment)
  3. Copy generated `NEXT_PUBLIC_CONVEX_URL` and (from Convex dashboard) `CONVEX_DEPLOY_KEY` into `apps/web/.env.local`
  4. `pnpm --filter @eisenbalm/convex deploy` (push schema + functions to prod)
  5. `pnpm dev:web` → browse `http://localhost:3000/_debug/convex` → see five "0 rows" entries, no errors
  6. (Later, when Vercel/Railway projects exist) `vercel env add NEXT_PUBLIC_CONVEX_URL production` + `railway variables set CONVEX_DEPLOY_KEY=...`

- **The debug page is a contract, not a product.** It's a checkpoint that proves Phase 3 done. Its UI is purely functional ("pipelineRuns: 0 rows"), in Jesse voice if voice applies (dry table, no decoration), and Phase 9 deletes it.

- **Phase 9 cleanup is non-negotiable.** Phase 3's plan must add a Phase 9 cleanup task to the roadmap (or to Phase 9's eventual context) noting that `/_debug/convex` ships in Phase 3 and is removed when real subscriptions land. Do not let it become permanent.

- **Convex deploy key is sensitive.** README must call this out explicitly — it grants write access to every Convex mutation and effectively lets anyone with the key insert deliberation events. Never commit to git, never expose in `NEXT_PUBLIC_*`, never log.

</specifics>

<deferred>
## Deferred Ideas

- **`@eisenbalm/convex-types` export** — exposing Convex's generated `Doc` and `Id` types via `packages/shared` would let the pipeline (Phase 4) share types with the web app. Defer — Phase 4 will introduce its own typing approach (Python), and the web app can import directly from `convex/_generated/` via the path alias.
- **Convex auth (Convex Auth or third-party)** — no logged-in readers; deploy key is sufficient for pipeline writes. Revisit only if the site adds user accounts (out of v1 scope).
- **Per-developer Convex dev deployments** — defer until there's more than one engineer.
- **Convex HTTP actions** (custom HTTP endpoints in `convex/http.ts`) — not needed; pipeline uses the standard `/api/mutation` HTTP endpoint.
- **Convex crons / scheduled functions** — the weekly trigger lives on the pipeline side (Railway cron / manual trigger). Convex crons are not in v1.
- **Convex Vector / Search / File Storage** — none of these are used by the project.
- **CI gate on `convex typecheck`** — defer (Phase 1 D-15 deferred CI; carry the same posture). Engineers run locally.
- **Performance tuning of `useQuery` for large `deliberationEvents` arrays** — Phase 9 problem. Phase 3's empty tables make this moot.
- **Convex dashboard alerting** — defer to Phase 5+ when real runs produce real failure modes.
- **An integration test asserting `runId` consistency between Sanity and Convex (PIP-06 from REQUIREMENTS.md)** — PIP-06 belongs to Phase 4, not Phase 3. Phase 3 only proves the Convex side responds correctly.

### Reviewed Todos (not folded)

(None — no todos were reviewed.)

</deferred>

---

*Phase: 03-convex-deployment*
*Context gathered: 2026-05-12*
