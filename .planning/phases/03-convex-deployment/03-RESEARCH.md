# Phase 3: Convex Deployment — Research

**Researched:** 2026-05-12
**Domain:** Convex 1.38 deployment + Next.js 15 App Router (RSC) + React 19 client integration + pnpm workspace topology + manual env provisioning across Vercel and Railway
**Confidence:** HIGH

---

## Summary

Phase 3 is integration plumbing. The schema is locked, the query/mutation handler code is dictated verbatim by API_CONTRACTS.md §4, and the project has already established analogous patterns for every moving part (manual CLI checkpoint for Andrew, generated artifacts checked in, README per workspace, single-deployment topology). The remaining research questions are all about *de-risking the mechanical steps*, not about choosing approaches.

Three findings drove the rest of this document:

1. **Convex CLI flags are real and well-documented.** `npx convex dev --once --configure` is the canonical "one-time init" command (confirmed via `convex@1.38.0 dev --help`). `--configure` accepts an optional `new|existing` argument; `--once` runs configure → codegen → push and exits. This makes Andrew's manual checkpoint deterministic.
2. **`useQuery` semantics give us CVX-05 for free.** `useQuery` returns `undefined` while loading and the query's actual return value once data arrives. For `.collect()` queries against an empty table, that return value is `[]`; for `.first()`, it is `null`. Our four `byRunId` collect-queries naturally return `[]` against the hardcoded smoke-test `runId`, and our one `pipelineRuns.byRunId` first-query naturally returns `null`. The `/_debug/convex` page only needs to wait until `data !== undefined` and then render a count.
3. **`convex` ships both client and server entry points from one package.** `convex/react` (browser, `ConvexReactClient`, `useQuery`, `ConvexProvider`), `convex/nextjs` (server-side `preloadQuery`, `fetchQuery`), `convex/server` (function definitions used by `_generated/`), and `convex/values` (`v.string()` etc.) are all subpath exports of the single `convex` npm package. D-14 is correct: one dep, no separate `convex/react` package.

**Primary recommendation:** Treat Phase 3 as a verbatim implementation of API_CONTRACTS.md §4 plus a small `apps/web` wiring layer plus documentation. Do not invent abstractions. The only place where research adds value is the no-op-client fallback (so Vercel preview builds without env vars don't break) and the path-alias mechanics for cross-workspace TS imports — both spelled out below.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

| ID | Decision | Implication for Plan |
|----|----------|----------------------|
| **D-01** | Pin `convex@^1.38.0` in `convex/package.json` and `apps/web/package.json` | Single source of truth; major+minor pin matches Phase 2 D-01 pattern. |
| **D-02** | Single `production` Convex deployment only | No dev/staging. Mirrors Sanity single-dataset model. No preview deploy keys. |
| **D-03** | Andrew runs `pnpm --filter @eisenbalm/convex exec convex dev --once --configure` once, manually | Plan ships everything *around* this — does NOT attempt to automate the init. README documents. |
| **D-04** | After init, plan commits `convex.json`. Secrets go to `.env.local` (gitignored) and `.env.example` (committed, placeholder) | Mirrors Phase 1 D-21. |
| **D-05** | Promote `convex/` to its own workspace `@eisenbalm/convex` (NOT a sub-folder of apps/web) | Directory stays at repo root per brief; gains its own `package.json`. |
| **D-06** | Add `convex` to `pnpm-workspace.yaml` | Currently only `apps/*` and `packages/*` are globs; needs explicit `convex` entry. |
| **D-07** | TS path alias `@convex/*` in `apps/web/tsconfig.json` → `../../convex/*` | Cleaner than long relative paths. |
| **D-08** | Check `convex/_generated/` into git | Mirrors Phase 1 D-08/D-14 (sanity.types.ts checked in). |
| **D-09** | Document regeneration command in `convex/README.md`. No CI gate yet. | Mirrors Phase 1 D-15 (CI deferred). |
| **D-10** | One file per table — five files: `pipelineRuns.ts`, `pitchLog.ts`, `deliberationEvents.ts`, `agentVotes.ts`, `qaCorrections.ts`. Copy API_CONTRACTS §4.1–4.5 **verbatim**. | No design work at the function-shape level. |
| **D-11** | Mutation argument validators use `v.literal(...)` unions for enum-like fields, matching `convex/schema.ts` exactly | Convex enforces at the boundary. |
| **D-12** | Insertion mutations set `timestamp: Date.now()` server-side, never trust caller's clock | Critical for deliberation event ordering in Phase 9. |
| **D-13** | `pipelineRuns:updateStatus` throws if run not found | Surfaces pipeline bugs loudly. |
| **D-14** | Add `convex@^1.38.0` to `apps/web/package.json` (no separate `convex/react` package — it ships from the main package) | Verified: `convex/react` is a subpath export, not a separate npm package. |
| **D-15** | `ConvexProvider` mounts in root `apps/web/app/layout.tsx` via a small `'use client'` wrapper component | Root layout stays a Server Component; provider is a client island. |
| **D-16** | `ConvexReactClient` must handle missing `NEXT_PUBLIC_CONVEX_URL` gracefully — no-op fallback so builds without env still pass | Mirrors `apps/web/lib/sanity/client.ts` placeholder fallback pattern (Phase 2). |
| **D-17** | Provider is a `'use client'` Client Component; root layout passes children straight through. No Suspense boundary. | Phase 9 introduces loading states. |
| **D-18** | Hidden `/_debug/convex` route at `apps/web/app/_debug/convex/page.tsx`. Runs all 5 `useQuery` calls with hardcoded `runId: "phase-3-smoke-test"`. Excluded from sitemap/RSS/robots. Removed in Phase 9. | This is CVX-05's evidence surface. |
| **D-19** | TS path alias `"@convex/*": ["../../convex/*"]` in `apps/web/tsconfig.json` | Same pattern as `@/*` already in tsconfig. |
| **D-20** | Two env vars: `NEXT_PUBLIC_CONVEX_URL` (public) + `CONVEX_DEPLOY_KEY` (secret) | Verified against Convex docs. |
| **D-21** | Env wiring: `apps/web/.env.local` (both), `apps/web/.env.example` (both placeholders), root `.env.example` (both), `convex/.env.local` (autogenerated by CLI — gitignored) | Mirrors Phase 1 / 2 env pattern. |
| **D-22** | Vercel + Railway env provisioning is MANUAL and documented. Plan does NOT attempt to provision remotely. | Mirrors Phase 2 D-27. |
| **D-23** | 6-step end-of-phase manual smoke test (CLI init → deploy → dashboard verify → dashboard query → `/_debug/convex` browser check → curl HTTP API smoke) | Document in `apps/web/README.md` and `convex/README.md`. |
| **D-24** | Add `TODO(Phase 9):` comment at top of debug page noting it will be removed | Lockable cleanup contract. |
| **D-25** | Create `convex/README.md` | New onboarding doc. |
| **D-26** | Update `apps/web/README.md` with Convex section | Documents `/_debug/convex` + env vars + Phase 9 changes. |

### Claude's Discretion

- Exact tsconfig path-alias shape — picked `@convex/*` (D-19) for symmetry with `@/*`; relative imports are the fallback if the alias plays badly with Next 15's bundler (see Pitfall 2 below).
- Exact wording of the `/_debug/convex` page table — Jesse voice, dry, table-only, no decoration, no emojis.
- Eager vs lazy `ConvexReactClient` instantiation — **recommend eager at module scope** in the provider's `'use client'` file. The official Convex Next.js quickstart uses module-scope `const convex = new ConvexReactClient(...)`. Lazy instantiation is only needed if a top-level `new ConvexReactClient(undefined)` throws — and we work around that with D-16's no-op fallback (see "Code Examples").
- Whether to call `client.setDebug(false)` — skip; default is already off in production. Adding it adds clutter for no benefit.

### Deferred Ideas (OUT OF SCOPE)

- `@eisenbalm/convex-types` shared package — Phase 4 will handle Python typing differently.
- Convex auth — no logged-in readers; deploy key is sufficient.
- Per-developer Convex dev deployments — single-engineer ops model.
- `convex.config.ts` (Convex Components, HTTP actions, crons) — none used in v1.
- Convex Vector / Search / File Storage — unused.
- CI gate on `convex typecheck` — engineers run locally; matches Phase 1 D-15 posture.
- Pagination on `deliberationEvents.byRunId` — Phase 9 problem; empty tables make it moot for Phase 3.
- Integration test asserting `runId` consistency between Sanity and Convex (PIP-06) — belongs to Phase 4.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CVX-01** | Convex deploys with the existing `convex/schema.ts` (5 tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`) | Schema is locked, verified to already include all 5 tables with every needed index. `npx convex dev --once --configure` deploys schema + generates `_generated/`. |
| **CVX-02** | Convex query functions exist for `pipelineRuns.byRunId`, `pitchLog.byRunId`, `agentVotes.byRunId`, `qaCorrections.byRunId`, `deliberationEvents.byRunId` | API_CONTRACTS §4.1–4.5 specifies each handler verbatim. Plan copies them. |
| **CVX-03** | Convex mutation functions exist for inserting pipelineRun, pitchLog, agentVotes, qaCorrections, deliberationEvents | API_CONTRACTS §4.1–4.5 specifies each mutation verbatim (including `markSelected`, `updateStatus`, `byRunIdAndType`, `byRunIdAndCharity`). |
| **CVX-04** | `CONVEX_DEPLOY_KEY` is provisioned in Vercel + Railway | Manual `vercel env add CONVEX_DEPLOY_KEY production` and `railway variables set` documented in README per D-22. Verified Vercel CLI command syntax below. |
| **CVX-05** | Web app `useQuery` against all 5 Convex queries returns empty arrays without errors when no data exists | `useQuery` returns `undefined` while loading; `.collect()` returns `[]` against an empty table; `.first()` returns `null`. `/_debug/convex` page (D-18) calls all 5 with hardcoded `runId: "phase-3-smoke-test"` and shows row counts. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex` | `^1.38.0` (latest, published 2026-05-08) | Convex client + server + CLI in one package | Locked by D-01. Subpath exports: `convex`, `convex/react`, `convex/nextjs`, `convex/server`, `convex/values`. Native React 19 support since v1.38. |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next` | `^15.3.9` | App Router host | Already in `apps/web` (Phase 2). Provider mounts inside its root layout. |
| `react` | `^19.2.6` | Required peer for `convex@1.38` and Next 15.3 | Already installed. |

### Alternatives Considered (and rejected)

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| `convex/react` `ConvexProvider` + `useQuery` | `@convex-dev/react-query` (TanStack adapter) | Adds query caching, error boundaries, devtools | **Rejected.** D-17 explicitly defers Suspense/loading states. Phase 3 needs raw `useQuery` for the smoke surface; Phase 9 may revisit. |
| Module-scope eager `new ConvexReactClient(url)` | Lazy `getConvex()` factory | Eager is what Convex's official quickstart uses | **Recommend eager** with D-16's no-op fallback handling missing URL. Lazy adds complexity without benefit unless eager actively throws — which the fallback prevents. |
| `convex/nextjs` `preloadQuery` (SSR data hydration) | Pure client-side `useQuery` | `preloadQuery` lets a Server Component fetch initial data, then `usePreloadedQuery` hydrates on the client | **Rejected for Phase 3.** `/_debug/convex` is throwaway. Phase 9's `DeliberationSlot` may use `preloadQuery` for first-paint deliberation data; that's a Phase 9 decision. |

**Installation (in `convex/package.json`):**
```jsonc
{
  "name": "@eisenbalm/convex",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "convex dev",
    "dev:once": "convex dev --once",
    "deploy": "convex deploy",
    "codegen": "convex codegen",
    "dashboard": "convex dashboard"
  },
  "devDependencies": {
    "convex": "^1.38.0",
    "typescript": "^5.6.0"
  }
}
```

**Installation (extend `apps/web/package.json` dependencies):**
```
"convex": "^1.38.0"
```

**Version verification (against npm registry, 2026-05-12):**
- `convex` latest = `1.38.0`, published 2026-05-08 (4 days before today).
- Bin: `convex` (so `pnpm --filter @eisenbalm/convex exec convex …` works).
- Dependencies: `esbuild@0.27.0`, `prettier@^3.0.0`, `ws@8.18.0`. No React peer dep is declared at the package level; `convex/react` subpath requires React 18+ (v19 supported since 1.38).
- `dist-tags`: `latest: 1.38.0`, `alpha: 1.39.0-alpha.0`. Do NOT use alpha.

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 deltas only)

```
eisenbalm/
├── pnpm-workspace.yaml              # MODIFY: add `convex` glob
├── package.json                     # MODIFY: optional root scripts (dev:convex, deploy:convex)
├── .env.example                     # MODIFY: add NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY
├── convex/                          # PROMOTED to workspace @eisenbalm/convex
│   ├── package.json                 # NEW (D-05): private workspace, owns convex CLI
│   ├── tsconfig.json                # NEW: extends tsconfig.base.json
│   ├── convex.json                  # NEW (D-04): created by `convex dev --configure`, committed
│   ├── .env.local                   # NEW: gitignored, CLI writes CONVEX_DEPLOYMENT + CONVEX_DEPLOY_KEY
│   ├── .gitignore                   # NEW: gitignore .env.local but keep _generated/
│   ├── README.md                    # NEW (D-25)
│   ├── schema.ts                    # EXISTING — do not modify
│   ├── pipelineRuns.ts              # NEW (D-10) — copy API_CONTRACTS §4.1 verbatim
│   ├── pitchLog.ts                  # NEW (D-10) — copy API_CONTRACTS §4.2 verbatim
│   ├── deliberationEvents.ts        # NEW (D-10) — copy API_CONTRACTS §4.3 verbatim
│   ├── agentVotes.ts                # NEW (D-10) — copy API_CONTRACTS §4.4 verbatim
│   ├── qaCorrections.ts             # NEW (D-10) — copy API_CONTRACTS §4.5 verbatim
│   └── _generated/                  # NEW — CHECKED IN per D-08
│       ├── api.d.ts
│       ├── api.js
│       ├── dataModel.d.ts
│       ├── server.d.ts
│       └── server.js
└── apps/web/
    ├── package.json                 # MODIFY: add `convex` dep
    ├── tsconfig.json                # MODIFY: add `@convex/*` path alias
    ├── .env.local                   # MODIFY: add Convex vars (gitignored)
    ├── .env.example                 # MODIFY: add Convex vars (committed)
    ├── README.md                    # MODIFY: add Convex section (D-26)
    ├── app/
    │   ├── layout.tsx               # MODIFY: wrap children in <ConvexClientProvider>
    │   └── _debug/
    │       └── convex/
    │           └── page.tsx         # NEW (D-18) — TODO(Phase 9) cleanup
    └── components/
        └── providers/
            └── ConvexClientProvider.tsx  # NEW — 'use client' wrapper
```

### Pattern 1: ConvexClientProvider as a Client Component island

**What:** Root layout stays a Server Component; the provider wraps `children` via a small `'use client'` wrapper. This is the canonical Next.js App Router + Convex pattern (Convex official docs, "Real-Time APIs Done Right With RSCs").
**When to use:** Every Next.js App Router + Convex integration.
**Why this works:** `ConvexProvider` uses React Context, which only Client Components can consume. A `'use client'` wrapper creates the client-side island; the root layout itself can remain RSC.
**Example:** see "Code Examples §1" below.

### Pattern 2: Module-scope `ConvexReactClient` instantiation

**What:** Construct `new ConvexReactClient(url)` ONCE at module scope, not inside the component.
**Why:** Each `ConvexReactClient` opens a websocket. Re-creating on every render would leak connections.
**Caveat:** If `url` is `undefined`, instantiating throws. Use the no-op fallback below (Pattern 3).

### Pattern 3: No-op fallback when `NEXT_PUBLIC_CONVEX_URL` is missing

**What:** Detect missing env and either (a) construct against a placeholder URL that will never resolve OR (b) skip the provider entirely and pass children through.
**Why:** D-16 — Vercel preview builds without Convex env should still pass; `apps/web/lib/sanity/client.ts` already follows this pattern (placeholder projectId).
**Example:** see "Code Examples §2" below.

### Pattern 4: Manual interactive CLI checkpoint by Andrew

**What:** The plan documents but does NOT run `npx convex dev --once --configure`. Andrew runs it interactively to authenticate via OAuth and create the production deployment.
**Why:** Mirrors Phase 1 D-20 (`npx sanity@latest init`) and Phase 2 D-27 (`vercel link`). Avoids embedding interactive prompts in automation.
**Reference:** see "Code Examples §6" for the exact command sequence Andrew runs.

### Pattern 5: One file per Convex table

**What:** `convex/pipelineRuns.ts`, `convex/pitchLog.ts`, etc. — each exports `byRunId` (and any other queries/mutations for that table).
**Why:** Convex `api` object is auto-derived from filename. `api.pipelineRuns.byRunId` requires `convex/pipelineRuns.ts` exporting `byRunId`. Renaming files renames the API surface.
**Anti-pattern:** A single `convex/index.ts` with everything in it would collapse to `api.index.*`. Not what the contract specifies.

### Pattern 6: Hidden debug surface, lockable cleanup

**What:** `/_debug/convex` route at `apps/web/app/_debug/convex/page.tsx`. Excluded from sitemap/feed/robots; marked with `TODO(Phase 9):` for removal.
**Why:** Phase 3's evidence surface — proves CVX-05 — without polluting the production site. Phase 9 deletes it when real `DeliberationSlot` subscriptions land.
**Exclusion mechanics:**
- `app/sitemap.ts` already only emits known routes (`/`, `/archive`, `/charities`, `/issue/*`, `/about`, `/shop`). `_debug/*` is implicitly excluded — verify by inspection.
- `apps/web/public/robots.txt` should add a `Disallow: /_debug/` line.
- `app/_debug/convex/page.tsx` should export Next.js metadata with `robots: { index: false, follow: false }`.

### Anti-Patterns to Avoid

- **Modifying `convex/schema.ts` in Phase 3.** Locked. Field names match `v.literal(...)` enums in API_CONTRACTS §4 verbatim.
- **Modifying `DeliberationSlot.tsx` in Phase 3.** Phase 9 owns this. Phase 3 only provides the wiring (provider + types + env) Phase 9 will consume.
- **Putting `CONVEX_DEPLOY_KEY` in a `NEXT_PUBLIC_*` env var.** Grants write access to all mutations. Server-side only.
- **Calling `useQuery` from a Server Component.** It's a React hook and uses Context. Server Components have no Context.
- **Adding Convex auth.** No logged-in readers in v1.
- **Hand-editing `convex/_generated/`.** Auto-generated. Re-run codegen (`pnpm --filter @eisenbalm/convex codegen`) after schema or function changes.
- **Using `convex/react` as a dependency name in `package.json`.** It's a subpath export of `convex`. Just install `convex`.
- **Calling `new ConvexReactClient()` in render.** Use module scope. Re-creating per-render leaks websockets.
- **Reading the `runId` from Convex.** It comes from Sanity (`QUERY_ISSUE_RUN_ID`). Convex is queried *by* `runId`, not for it. This is the canonical Sanity→Convex bridge.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-workspace TS imports of generated API | Re-export `_generated/api` from `packages/shared` | TS path alias `@convex/*` in `apps/web/tsconfig.json` (D-19) | Re-export adds a build step and breaks the auto-regenerated `api.d.ts` contract. Path alias is zero-config. |
| Authenticated HTTP API client for Python | Custom Convex Python SDK / hand-rolled HMAC | The documented `httpx.AsyncClient` → `POST {CONVEX_URL}/api/mutation` with `Authorization: Convex {DEPLOY_KEY}` header from API_CONTRACTS §3 | The official Convex HTTP API is a documented, stable contract. Use the standard `convex-py` package only if we later need it (Phase 4 decision). |
| Loading state UI for `useQuery` | Custom `if (data === undefined) return <Spinner />` everywhere | `data === undefined` is the documented loading signal, but Phase 3 explicitly defers loading states (D-17). For `/_debug/convex`, render "loading" once and "count: N" when data arrives. | The `/_debug/convex` page is a checkpoint, not a product. Phase 9 owns real loading UI. |
| Environment-variable typing | Generic `process.env` reads everywhere | Wrap in `lib/env.ts` or just check `if (!url) return placeholder` at module top | Next.js inlines `NEXT_PUBLIC_*` at build time; missing values are `undefined` strings. The fallback pattern in Pattern 3 is sufficient. |
| Connection state introspection | `client.setDebug(true)` + custom event listeners | Convex dashboard's "Logs" tab + `client.connectionState()` if absolutely needed | Phase 3 doesn't need connection introspection; the dashboard handles observability. |

**Key insight:** Phase 3 is a *thin* phase. The temptation to introduce abstractions (a shared types package, a connection-aware wrapper component, a typed env loader) should be resisted — every one of those is a Phase 5+ concern when actual integration pressure surfaces. Honor D-10's "copy verbatim" mandate.

---

## Common Pitfalls

### Pitfall 1: ConvexReactClient throwing on `undefined` URL during build

**What goes wrong:** `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` (with the `!` non-null assertion from Convex docs) throws `TypeError: Invalid URL` when the env is missing.
**Why it happens:** Vercel preview builds without the Convex env vars set will still execute module-level code in the provider file.
**How to avoid:** D-16 mandates a fallback. The provider file should detect missing URL and either skip provider mounting OR construct with a known-harmless URL. See "Code Examples §2."
**Warning signs:** Vercel build logs show `TypeError: Invalid URL` from `node_modules/convex/dist/...` during a preview deploy.

### Pitfall 2: TS path alias `@convex/*` not resolving for `_generated/api`

**What goes wrong:** `import { api } from '@convex/_generated/api'` fails with TS2307 ("Cannot find module"). Next.js's bundler may resolve aliases differently from `tsc`.
**Why it happens:** Next 15 with `moduleResolution: "Bundler"` (already set in `apps/web/tsconfig.json`) resolves paths relative to the file, but the path alias root is the tsconfig dir. The mapping `"@convex/*": ["../../convex/*"]` resolves `@convex/_generated/api` to `<repo>/convex/_generated/api` — Next's bundler should follow this, but **needs to be in `paths` AND a valid relative path**.
**How to avoid:**
  - Verify the path: from `apps/web/tsconfig.json`, `../../convex/` is `<repo>/convex/`. Correct.
  - Test with `pnpm --filter web typecheck` BEFORE Andrew runs the smoke test.
  - Fallback: use the relative import `import { api } from '../../../../convex/_generated/api'` from `apps/web/app/_debug/convex/page.tsx`. Ugly but always works.
**Warning signs:** `tsc --noEmit` errors in Wave 0 or build-time errors in `next build`.

### Pitfall 3: Forgetting to commit `_generated/`

**What goes wrong:** `apps/web/app/_debug/convex/page.tsx` imports `@convex/_generated/api`. Without checked-in `_generated/`, a fresh clone fails to type-check or build until someone runs `convex codegen`.
**Why it happens:** Phase 3 introduces `_generated/` for the first time. The `.gitignore` does not yet have a rule for `convex/`, so by default everything is committed — but contributors may "tidy" by adding a `convex/_generated/` ignore rule.
**How to avoid:**
  - Mirror the Phase 1 D-08 / D-14 pattern: add a comment to the repo root `.gitignore` or `convex/.gitignore` explicitly stating "Do NOT ignore convex/_generated/ — types must travel with the repo".
  - Verify by running `git ls-files convex/_generated/` after the first commit.
**Warning signs:** CI / preview deploys break with TS errors after a fresh checkout.

### Pitfall 4: `runId` mismatch between Sanity and Convex (deferred, but flagged)

**What goes wrong:** Phase 9's `DeliberationSlot` queries Convex by the `runId` from Sanity. If the pipeline generates two different runIds (one for Convex, one written to Sanity), the deliberation layer shows nothing.
**Why it happens:** This is a Phase 4 concern (PIP-05, PIP-06). Phase 3 only documents the boundary.
**How to avoid (in Phase 3 scope):** The `/_debug/convex` page uses the hardcoded `runId: "phase-3-smoke-test"`. This is deliberately a synthetic ID — there is NO Sanity issue with that runId, so the smoke test cannot accidentally show real data.
**Warning signs:** N/A for Phase 3 (intentional empty state). Phase 9 must verify.
**Cross-reference:** `.planning/research/PITFALLS.md` §8.1.

### Pitfall 5: Confusing CLI deploy key vs HTTP API mutation key

**What goes wrong:** Engineer assumes `CONVEX_DEPLOY_KEY` is a single magic value; uses it inconsistently. Convex actually has multiple key types: **Production Deploy Key** (`prod:slug|...`), **Preview Deploy Key**, **Development Deploy Key**, **Project Token**, **Admin Key**.
**Why it happens:** Convex docs name them all "deploy keys" colloquially.
**How to avoid:**
  - For **Vercel `production` env**: use a **Production Deploy Key**. `npx convex deploy` reads this and pushes the Convex functions before `next build`.
  - For **Railway** (pipeline calling `/api/mutation` from Phase 4): also use a **Production Deploy Key**. The same key works as the `Authorization: Convex {KEY}` header for HTTP API calls per Convex HTTP API docs.
  - Same key value is fine for both. README must say "this key grants full read/write to your Convex data — treat like a database password."
  - Vercel preview deploys: NOT needed in v1 per D-02 (production-only deployment). If preview deploys are ever added, generate a separate Preview Deploy Key.
**Warning signs:** `401 Unauthorized` when curling `/api/mutation`; or "deploy key does not match" errors from `npx convex deploy`.
**Source:** [Convex Deploy Key Types docs](https://docs.convex.dev/cli/deploy-key-types).

### Pitfall 6: Convex CLI in monorepo can't find `package.json`

**What goes wrong:** Running `convex dev --once --configure` from a directory without a `package.json` (e.g., from repo root) causes the CLI to either prompt confusingly or write `convex.json` in the wrong place.
**Why it happens:** Convex CLI expects `convex.json` and the `convex/` directory in the same directory as a `package.json`. The brief pins `convex/` at repo root, but the *root* `package.json` (the workspace one) is NOT the CLI's target.
**How to avoid:** D-05 promotes `convex/` to its own workspace `@eisenbalm/convex` with its own `package.json` at `convex/package.json`. The CLI then sees `convex/package.json` next to `convex/schema.ts` and works correctly.
**Wait — directory shape clash:** Convex CLI's default looks for `<package.json dir>/convex/`. With our `convex/package.json` and `convex/schema.ts` siblings (NOT under a nested `convex/`), the CLI sees no `convex/` subdir.
**Resolution:** Use `convex.json` with `{"functions": "./"}` to tell Convex "the functions ARE this directory, not a subdirectory." Andrew runs `convex dev --once --configure` from `convex/`; the CLI prompts and writes `convex.json` with this entry. Verify after init.
**Alternative:** Restructure to nest `convex/schema.ts` under `convex/convex/schema.ts`. **Don't.** Breaks the brief's "convex/ at root" constraint and breaks the path alias `@convex/_generated/api`.
**Warning signs:** CLI errors during `--configure` flow; `convex.json` written to the wrong directory.
**Source:** [Convex Project Configuration docs](https://docs.convex.dev/production/project-configuration) — `functions` field repoints the functions directory.

### Pitfall 7: Sanity webhook namespace collision with `/_debug/`

**What goes wrong:** None expected — but worth noting that `_` (underscore-prefixed) paths in Next.js App Router are valid and don't trigger framework conventions. `_debug/convex` is a normal route.
**Why this is a non-issue:** Next.js only treats `_` specially for private folders that should NOT become routes. Since `_debug/convex/page.tsx` exists, Next.js explicitly *does* turn it into a route. (Compare: `app/_components/Foo.tsx` would NOT become a route.) The underscore here is a naming convention, not a framework directive.
**How to verify:** After Phase 3, browse to `http://localhost:3000/_debug/convex` and see the page render.
**Warning signs:** 404 on `/_debug/convex`. If this happens, rename to `/debug/convex` and update README.

### Pitfall 8: Convex `useQuery` returning `null` vs `undefined` confusion

**What goes wrong:** Code that checks `if (!data)` treats both loading (`undefined`) and "found nothing" (`null` for `.first()` queries, `[]` for `.collect()`) as the same state.
**Why it happens:** Convex's semantics are unique:
  - `undefined` = still loading (subscription not yet resolved)
  - `null` = query returned no document (for `.first()` queries)
  - `[]` = query returned an empty array (for `.collect()` queries)
  - any other value = data
**How to avoid:** In `/_debug/convex`:
  - `pipelineRuns.byRunId` returns `PipelineRun | null` (uses `.first()`)
  - The other 4 return `[]` arrays (use `.collect()`)
  - Render "loading…" if `data === undefined`
  - Render "0 rows" if `Array.isArray(data) && data.length === 0`
  - Render "1 row" if `data === null` (the run-not-found case)
  - Actually for CVX-05: just `data === undefined ? '—' : Array.isArray(data) ? data.length : (data ? 1 : 0)` works.
**Warning signs:** Smoke test shows "loading…" forever or shows a fake count when subscription hasn't resolved.
**Source:** [Convex useQuery semantics](https://docs.convex.dev/api/modules/react).

---

## Runtime State Inventory

> Phase 3 is greenfield infrastructure — no existing Convex deployment, no migrations, no runtime state to update. The section below is included for completeness because the plan does manage *secrets* that are runtime-registered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phase 3 creates the first Convex deployment. The five tables will be empty until Phase 4 writes to them. | None. |
| **Live service config** | (a) Convex Cloud — a new project + production deployment must be provisioned by Andrew running `convex dev --once --configure`. This config lives in Convex Cloud (the project) and locally in `convex/.env.local` (`CONVEX_DEPLOYMENT` hint). (b) Vercel project — `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` must be set. (c) Railway service — `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` will be set in Phase 4 but documented here per D-21/D-22. | All three: manual provisioning. README documents commands. |
| **OS-registered state** | None — no launchd / cron / Task Scheduler / systemd registrations. | None. |
| **Secrets and env vars** | New: `NEXT_PUBLIC_CONVEX_URL` (public), `CONVEX_DEPLOY_KEY` (secret). Both NEW — no rename, no existing references to break. | Add to `.env.example` at root + `apps/web/.env.example`. Add to Vercel project (manual). Document for Railway (Phase 4 sets remotely). |
| **Build artifacts / installed packages** | New: `node_modules/convex` will land at the pnpm hoisted root; `convex/_generated/` will be committed. No stale artifacts from prior phases. | None — fresh install. |

**The canonical question:** "After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?" — **None for Phase 3.** This is greenfield. The runtime-state risks live in Phase 4 (pipeline writes to Convex) and Phase 9 (Convex subscriptions read from Convex).

---

## Code Examples

Verified patterns from official sources, adapted to project conventions.

### §1 — `ConvexClientProvider.tsx` (the 'use client' wrapper)

```tsx
// apps/web/components/providers/ConvexClientProvider.tsx
// Source: https://docs.convex.dev/quickstart/nextjs (adapted with D-16 fallback)
'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

// Module-scope: one client per browser session. Convex maintains one
// websocket per ConvexReactClient instance. Do NOT instantiate in render.
//
// D-16: handle missing NEXT_PUBLIC_CONVEX_URL gracefully so Vercel preview
// builds without Convex env still pass. Pattern mirrors apps/web/lib/sanity/client.ts.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

const convex = convexUrl
  ? new ConvexReactClient(convexUrl)
  : null

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // Fallback: render children without a provider. useQuery in any
    // descendant will throw (no provider) — that is the correct loud
    // failure when an env var is missing in development. In production
    // (Vercel) the URL is provisioned per D-22; this branch only fires
    // for builds without the env (preview deploys before Convex setup).
    return <>{children}</>
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
```

**Alternative (lazy):** If the eager pattern causes issues in Next 15's RSC build, wrap the client construction in `useState` inside the component. Per Convex official docs, eager is the documented pattern; switch to lazy only if eager errors surface.

### §2 — Root layout integration

```tsx
// apps/web/app/layout.tsx — MODIFY: wrap children in ConvexClientProvider
// (only the relevant diff shown)
import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'

// ...existing imports + metadata + viewport...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const defaultThemeCss = serializeThemeCss(null)
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: defaultThemeCss }} />
      </head>
      <body className="flex min-h-screen flex-col font-body text-[color:var(--color-text)]">
        <ConvexClientProvider>
          <TooltipProvider delayDuration={0}>
            <SiteHeader />
            <main className="flex-1" id="main">{children}</main>
            <SiteFooter />
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}
```

The provider can wrap `TooltipProvider` (either order works; both are React Context providers and don't conflict).

### §3 — A single convex function file (verbatim from API_CONTRACTS §4.1)

```ts
// convex/pipelineRuns.ts — copy verbatim per D-10
// Source: docs/API_CONTRACTS.md §4.1
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('pipelineRuns')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
  },
})

export const create = mutation({
  args: {
    runId: v.string(),
    issueNumber: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('pipelineRuns', {
      ...args,
      status: 'running' as const,
    })
  },
})

export const updateStatus = mutation({
  args: {
    runId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('awaiting-review'),
      v.literal('complete'),
      v.literal('failed'),
    ),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first()
    if (!run) throw new Error(`Run not found: ${args.runId}`)
    const { runId, ...updates } = args
    await ctx.db.patch(run._id, updates)
  },
})
```

Repeat for the other four files exactly per API_CONTRACTS §4.2–4.5. No additions, no consolidations, no helper extractions.

### §4 — `/_debug/convex/page.tsx` (CVX-05 evidence surface)

```tsx
// apps/web/app/_debug/convex/page.tsx
// TODO(Phase 9): Remove this file. Real DeliberationSlot subscriptions
// replace this debug surface. See .planning/phases/03-convex-deployment/03-CONTEXT.md D-18, D-24.
'use client'

import type { Metadata } from 'next'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

// Hidden route — exclude from indexing.
// (Note: Client Components can't export `metadata` in Next 15. Use
//  generateMetadata in a sibling Server Component layout if strict
//  indexing control is needed. For Phase 3 the robots.txt Disallow
//  + the route's hidden URL are sufficient.)

const SMOKE_TEST_RUN_ID = 'phase-3-smoke-test'

function rowCount(data: unknown): string {
  if (data === undefined) return '—'
  if (Array.isArray(data)) return String(data.length)
  if (data === null) return '0'
  return '1'
}

export default function DebugConvexPage() {
  const run = useQuery(api.pipelineRuns.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const pitches = useQuery(api.pitchLog.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const events = useQuery(api.deliberationEvents.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const votes = useQuery(api.agentVotes.byRunId, { runId: SMOKE_TEST_RUN_ID })
  const corrections = useQuery(api.qaCorrections.byRunId, { runId: SMOKE_TEST_RUN_ID })

  const rows: [string, unknown][] = [
    ['pipelineRuns', run],
    ['pitchLog', pitches],
    ['deliberationEvents', events],
    ['agentVotes', votes],
    ['qaCorrections', corrections],
  ]

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <meta name="robots" content="noindex,nofollow" />
      <h1 className="font-display text-2xl mb-2">Convex smoke test</h1>
      <p className="font-ui text-sm opacity-60 mb-6">
        Run ID: {SMOKE_TEST_RUN_ID}. Empty by design.
      </p>
      <table className="w-full font-ui text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Query</th>
            <th className="text-right py-2">Rows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, data]) => (
            <tr key={name} className="border-b last:border-b-0">
              <td className="py-2">{name}.byRunId</td>
              <td className="py-2 text-right">{rowCount(data)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

Jesse voice: dry, table only, no decoration. The "—" placeholder while loading is intentional and matches the rest of the site's "no winking" convention.

### §5 — `convex.json` (committed)

```json
{
  "$schema": "https://convex.dev/schemas/convex.json",
  "functions": "./"
}
```

The `functions: "./"` field is critical because of D-05: our `convex/package.json` and `convex/schema.ts` are siblings (not parent/child). Without this, Convex CLI would look for `convex/convex/schema.ts`. Verify after Andrew runs `--configure`; if the CLI wrote a different value, hand-edit.

### §6 — Andrew's one-time init command sequence (README)

```bash
# 1. Install workspace deps (after Phase 3 plan lands)
pnpm install

# 2. One-time Convex setup (interactive — OAuth login + create deployment)
pnpm --filter @eisenbalm/convex exec convex dev --once --configure

# Convex CLI will:
#   - Open browser for OAuth login
#   - Prompt: team + project name + deployment type (cloud, NOT local — D-02)
#   - Write convex/.env.local with CONVEX_DEPLOYMENT
#   - Write convex.json
#   - Push schema.ts + the five function files
#   - Generate convex/_generated/{api,server,dataModel}.{ts,js}
#
# At end, Andrew copies from terminal output / dashboard:
#   - NEXT_PUBLIC_CONVEX_URL (shown on dashboard's Settings page)
#   - CONVEX_DEPLOY_KEY (Settings → Deploy Keys → generate Production key)

# 3. Add the two values to apps/web/.env.local (local dev) — gitignored
echo "NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud" >> apps/web/.env.local
echo "CONVEX_DEPLOY_KEY=prod:<...>" >> apps/web/.env.local

# 4. Push schema + functions to production (after any edit)
pnpm --filter @eisenbalm/convex deploy

# 5. Verify locally
pnpm --filter web dev
# → browse http://localhost:3000/_debug/convex
# → expect 5 rows, all showing "0" (or "—" briefly while loading)

# 6. Provision remote env (manual, when projects exist)
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add CONVEX_DEPLOY_KEY production
railway variables set NEXT_PUBLIC_CONVEX_URL=https://<...>.convex.cloud
railway variables set CONVEX_DEPLOY_KEY=prod:<...>

# 7. HTTP API smoke (proves Railway pathway works — Phase 4 will rely on this)
curl -X POST "${NEXT_PUBLIC_CONVEX_URL}/api/mutation" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Convex ${CONVEX_DEPLOY_KEY}" \
  -d '{
    "path": "pipelineRuns:create",
    "args": {
      "runId": "smoke-test-curl",
      "issueNumber": 0,
      "startedAt": '"$(node -e 'console.log(Date.now())')"'
    },
    "format": "json"
  }'
# Expected response: {"status":"success","value":"<convex_id>",...}

# Cleanup (delete the smoke-test row via dashboard or another mutation call)
```

### §7 — `apps/web/tsconfig.json` path alias diff

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    // ...existing options...
    "paths": {
      "@/*": ["./*"],
      "@convex/*": ["../../convex/*"]  // NEW (D-19)
    }
  }
}
```

### §8 — `convex/tsconfig.json` (NEW)

```jsonc
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "strict": true,
    "types": ["node"]
  },
  "include": ["**/*.ts", "_generated/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Convex CLI runs its own typecheck (`--typecheck try` by default on `convex dev` and `convex deploy`). Our `convex/tsconfig.json` exists primarily so that `pnpm --filter web typecheck` (which walks the workspace) can resolve types correctly through the `@convex/*` alias.

### §9 — `convex/.gitignore` (NEW)

```gitignore
# Convex CLI local config — NEVER commit
.env.local
.env

# But DO commit _generated/ so types travel with the repo (Phase 1 D-08 pattern)
# (No explicit rule needed — git tracks _generated/ unless we ignore it.)
```

### §10 — `pnpm-workspace.yaml` diff

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'convex'   # NEW (D-06)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React 18 + Convex 1.37 | React 19 + Convex 1.38 | 2026-05-08 (convex 1.38 published) | Direct React 19 peer support, no `--legacy-peer-deps` workarounds needed. Our React 19.2.6 is fine. |
| `convex/react` as a separate npm package | Subpath export of `convex` | Long-standing (since at least 1.x) | D-14 is correct: install only `convex`. |
| Pages Router setup with `_app.tsx` for `<ConvexProvider>` | App Router setup with a `'use client'` wrapper file | Next.js 13+ App Router (2023) | We use the modern pattern. |
| Manual `npm install convex && npx convex init` two-step | `npx convex dev --once --configure` single command | Convex 1.33+ improvements | Mirrors Phase 1 D-20 single-step Sanity init. |

**Deprecated / outdated:**
- `convex init` as a standalone command — folded into `convex dev --configure`.
- React 17 — unsupported by Convex 1.38; we're on 19, no issue.
- Multiple Convex deployments per environment (dev + prod) — still supported, but we deliberately opt for production-only per D-02 (matches Sanity D-15 single-dataset model).

---

## Open Questions

1. **Does `convex.json` need `"functions": "./"`?**
   - What we know: Convex CLI defaults to looking for `<package.json dir>/convex/`. Our `convex/package.json` is sibling to `convex/schema.ts`. Without `functions: "./"`, the CLI looks for `convex/convex/schema.ts`.
   - What's unclear: Whether `convex dev --configure` detects this layout automatically and writes the right value, or whether Andrew must hand-edit.
   - Recommendation: Plan assumes the CLI writes a default that we hand-correct to `"./"` immediately after init. Verification step in Andrew's smoke test: open `convex/convex.json` and confirm `"functions": "./"`.

2. **Will the `@convex/*` path alias resolve cleanly under Next 15's bundler?**
   - What we know: Next 15 with `moduleResolution: "Bundler"` honors `tsconfig.paths`. The alias points to a valid relative path (`../../convex/*` from `apps/web`).
   - What's unclear: Whether Next.js's webpack resolver follows the alias for files outside the `apps/web` directory in dev mode.
   - Recommendation: Plan an early Wave verification: after adding the alias and a stub import in `/_debug/convex/page.tsx`, run `pnpm --filter web typecheck` AND `pnpm --filter web dev` to confirm both type-check and dev-server resolve `@convex/_generated/api`. If broken, fall back to a relative import (uglier but always works).

3. **Does the Convex HTTP API `/api/mutation` accept a Production Deploy Key in the `Authorization: Convex {key}` header?**
   - What we know: Convex HTTP API docs show the `Authorization: Convex <access_key>` pattern with "Deploy key from dashboard." API_CONTRACTS §3 already specifies this exact pattern.
   - What's unclear: The Convex HTTP API docs page mentions both `Bearer <auth_token>` (for end-user auth) and `Convex <deploy_key>` (for server-to-server). The Production Deploy Key works with the `Convex` prefix.
   - Recommendation: The smoke test in Code Example §6 step 7 will confirm. If the curl returns `401`, the key needs to be regenerated as a Project Token (also `Convex` prefix) rather than a Production Deploy Key. Document the test result in the Phase 3 SUMMARY.

4. **Is there a way to enforce single-deployment topology (block accidental dev-deployment creation)?**
   - What we know: D-02 mandates "production-only". `convex dev --configure --dev-deployment cloud` creates a cloud dev deployment alongside production; `--dev-deployment local` creates a local-only one.
   - What's unclear: Whether we should run `--once` with `--dev-deployment local` (so all reads/writes go to local SQLite during dev) OR provision a single cloud deployment used both for `pnpm dev` and production.
   - Recommendation: Plan recommends `--dev-deployment local` only if Andrew wants offline dev. For the v1 ops model (Andrew on his laptop, single engineer), the cloud production deployment is the only one that exists. The plan should document this explicitly in `convex/README.md`.

---

## Environment Availability

> Required tools/services for Phase 3. The plan SHIPS documentation for these; Andrew PROVISIONS them.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 18+ | Convex CLI, Next.js | ✓ | (already installed for Phase 1/2) | — |
| pnpm 9+ | Workspace tooling | ✓ | `9.15.4` (pinned in root package.json) | — |
| `convex@1.38.0` npm package | All Convex work | ✗ — install via `pnpm install` after plan adds dep | `1.38.0` | None (locked) |
| Convex Cloud account | Hosts deployment | ✗ — Andrew provisions during `--configure` | — | None (must exist before plan complete) |
| `convex.json` | CLI config | ✗ — generated by `--configure` | — | None |
| Vercel project (for `apps/web`) | Final env provisioning | Unknown — Phase 2 may or may not have created | — | Phase 3 documents commands only; Andrew runs when project exists |
| Railway service (for pipeline) | Final env provisioning for Phase 4 | ✗ — created in Phase 4 | — | Phase 3 documents commands; Phase 4 actually sets vars |
| `curl` | HTTP API smoke test | ✓ (macOS built-in) | (default) | `httpie` or `wget --post-data` |

**Missing dependencies with no fallback:** Convex Cloud project + Production Deploy Key. Both require Andrew's manual action. **The plan is unblocked** for everything except the final smoke test of D-23 step 6 (curl HTTP API), which requires the deploy key.

**Missing dependencies with fallback:** Vercel/Railway env provisioning — if either project doesn't exist yet, the plan still ships and the README's "later, when …" section instructs Andrew to provision when the project exists. No code blocks on this.

---

## Validation Architecture

> `.planning/config.json` was inspected — there is no explicit `workflow.nyquist_validation: false` directive observable, so this section is included per the default. If the project has CI-light posture (per Phase 1 D-15), the framework recommendations below stay local-only.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently configured in `apps/web` or anywhere in the repo. Phase 2 D-15 explicitly deferred CI. Phase 3 should NOT introduce a test framework — that's a Phase 4+ decision when there is meaningful runtime behavior to test. |
| Config file | None |
| Quick run command | `pnpm --filter web typecheck` (TypeScript is the validation surface) |
| Full suite command | `pnpm --filter @eisenbalm/convex deploy --dry-run` + `pnpm --filter web typecheck` + `pnpm --filter web build` |
| Phase gate | Andrew's manual 6-step smoke test (D-23). |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **CVX-01** | Schema deploys, `_generated/api.ts` created with 5 tables | manual + typecheck | `pnpm --filter @eisenbalm/convex deploy --dry-run` (verifies schema parses) | ✅ existing `convex/schema.ts` |
| **CVX-02** | Five `byRunId` queries exist and type-check | typecheck | `pnpm --filter web typecheck` (resolves `@convex/_generated/api.byRunId`) | ❌ Wave 1 creates query files |
| **CVX-03** | Five mutations exist with correct validators | typecheck | `pnpm --filter web typecheck` (resolves mutation argument types via `api`) | ❌ Wave 1 creates mutation files |
| **CVX-04** | `CONVEX_DEPLOY_KEY` in Vercel + Railway | manual (out of automatable scope) | None — Andrew verifies via `vercel env ls production` and `railway variables` | N/A (env config, not code) |
| **CVX-05** | `useQuery` returns empty arrays without error | manual browser smoke + typecheck | `pnpm --filter web dev` + browse `/_debug/convex` + Andrew confirms 5 rows render | ❌ Wave 2 creates debug page |

### Sampling Rate

- **Per task commit:** `pnpm --filter web typecheck` (validates `@convex/*` alias + mutation argument shapes match)
- **Per wave merge:** `pnpm --filter web build` (validates Next.js builds without env vars, exercising the D-16 no-op fallback)
- **Phase gate:** Andrew's 6-step manual smoke test per D-23, exact sequence in `convex/README.md`

### Wave 0 Gaps

- [ ] `convex/package.json` — establish workspace, install `convex@^1.38.0` as devDependency
- [ ] `convex/tsconfig.json` — extends `tsconfig.base.json`, enables Convex codegen TS support
- [ ] `convex/.gitignore` — gitignore `.env.local` (the auto-generated CLI hint file)
- [ ] `convex.json` — created by `convex dev --configure`, hand-edit `"functions": "./"` if CLI wrote a different value
- [ ] Add `convex` glob to `pnpm-workspace.yaml`
- [ ] Add `@convex/*` path alias to `apps/web/tsconfig.json`
- [ ] Add `convex@^1.38.0` dep to `apps/web/package.json`
- [ ] Add `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` to `apps/web/.env.example` and root `.env.example`

*No test framework gap — Phase 3 holds Phase 1 D-15's CI-deferred posture. TypeScript IS the test surface in this phase.*

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` and `docs/CLAUDE_CODE_BRIEF.md` MUST be honored by the planner:

1. **Field names locked across schemas + contracts + types.** Convex `schema.ts` field names ARE the contract; the mutations in API_CONTRACTS §4 use the exact same names (`runId`, `issueNumber`, `startedAt`, `status`, `agentId`, `eventType`, `charityId`, `sectionName`, etc.). Do NOT rename a single one. The `v.literal(...)` enum values must match the schema verbatim (e.g., `'running' | 'awaiting-review' | 'complete' | 'failed'` — note the kebab-case `'awaiting-review'`, not `awaitingReview`).
2. **Do not modify field names without checking API_CONTRACTS.md first.** No discretion here for Phase 3.
3. **GSD workflow enforcement.** Phase 3 ships under `/gsd:execute-phase`. No ad-hoc edits.
4. **Stack is locked.** Convex 1.38.0 is non-negotiable per CONTEXT D-01 + STACK research. Do not propose alternates (Liveblocks, Supabase Realtime, etc.).
5. **Jesse voice in any user-visible text.** The `/_debug/convex` page is technically user-visible (hidden URL but renders in the browser). Voice: dry, precise. "0 rows" not "All empty! ✨". No exclamation marks. No winking.
6. **No CI gates in v1.** Phase 1 D-15 + Phase 2 implicit. Phase 3 holds the line — no GitHub Actions, no pre-commit hook for `convex deploy --dry-run`. Engineers run locally.
7. **Andrew is single-threaded.** Andrew runs the manual init checkpoint AND the manual smoke test. Plan must not require concurrent action by anyone else.
8. **No authentication.** Public reads on Convex; deploy key for server writes. Do not introduce `ctx.auth` checks or Convex Auth.
9. **Single Convex production deployment** (CONTEXT D-02). No dev/staging cloud deployments. Local SQLite dev deployment via `--dev-deployment local` is acceptable for individual engineers but not required.

---

## Sources

### Primary (HIGH confidence)

- `docs/API_CONTRACTS.md §3-4` — the verbatim contract for mutations + queries (project-internal, authoritative)
- `convex/schema.ts` — existing schema, all 5 tables + indexes (project-internal, locked)
- [Convex Next.js Quickstart](https://docs.convex.dev/quickstart/nextjs) — official ConvexClientProvider pattern, module-scope client construction
- [Convex Next.js docs](https://docs.convex.dev/client/react/nextjs/) — RSC boundary, Client Component requirement for `useQuery`
- [Convex CLI docs](https://docs.convex.dev/cli) — `convex dev`, `convex deploy`, `CONVEX_DEPLOY_KEY` semantics
- [Convex Project Configuration docs](https://docs.convex.dev/production/project-configuration) — `convex.json`, `functions` field, monorepo placement
- [Convex Deploy Key Types](https://docs.convex.dev/cli/deploy-key-types) — Production / Preview / Development / Project Token / Admin Key distinctions
- [Convex HTTP API docs](https://docs.convex.dev/http-api/) — `/api/mutation` request shape, `Authorization: Convex {key}` header
- [Convex Generated Code docs](https://docs.convex.dev/generated-api/) — `_generated/{api,server,dataModel}.{ts,d.ts,js}` files
- [Convex Vercel hosting docs](https://docs.convex.dev/production/hosting/vercel) — `npx convex deploy --cmd 'npm run build'` pattern
- `npm view convex@1.38.0` — verified version, deps, dist-tags (2026-05-12)
- `npx convex@1.38.0 dev --help` — verified `--once` and `--configure` flags exist with documented semantics (2026-05-12)
- `npx convex@1.38.0 deploy --help` — verified deploy flags and Preview vs Production key behavior (2026-05-12)
- [Convex useQuery API reference](https://docs.convex.dev/api/modules/react) — `undefined` while loading, returns query result on subscribe
- [Convex React docs](https://docs.convex.dev/client/react) — empty array vs null vs undefined semantics

### Secondary (MEDIUM confidence)

- [Convex Stack: "Help, my app is overreacting!"](https://stack.convex.dev/help-my-app-is-overreacting) — confirms `isEmpty = data?.length === 0` pattern
- [Schemets: Definitive Guide to Initializing Convex in Next.js](https://www.schemets.com/blog/convex-nextjs-initialization-guide-app-router) — independent corroboration of eager module-scope client + `'use client'` wrapper
- [Convex preloadQuery for RSC](https://docs.convex.dev/client/nextjs/app-router/server-rendering) — Phase 9 reference for SSR data preloading
- [Convex 1.33 release notes (CLI improvements)](https://ship.convex.dev/changelog/convex-1-33-0) — `CONVEX_AGENT_MODE=anonymous`, `--start` flag context

### Tertiary (LOW confidence — flagged for validation)

- Vercel CLI `vercel env add NEXT_PUBLIC_CONVEX_URL production` syntax — based on current Vercel docs; verify the exact command shape with `vercel env --help` at runtime (Andrew's responsibility during D-22)
- Railway CLI `railway variables set X=Y` syntax — based on current Railway docs; verify with `railway --help`

---

## Metadata

**Confidence breakdown:**
- Standard Stack: **HIGH** — version verified against npm registry; CLI flags verified by running `--help` directly
- Architecture: **HIGH** — patterns drawn verbatim from Convex official docs + project's existing Phase 1/2 conventions
- Pitfalls: **HIGH** — backed by Convex docs, npm registry, and direct CLI inspection
- Path-alias resolution under Next 15 bundler: **MEDIUM** — well-established pattern but project-specific verification needed at plan time
- `convex.json "functions": "./"` automatic detection: **MEDIUM** — flagged as Open Question 1; smoke test confirms

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days — Convex 1.38 is fresh, expect a minor or patch in this window; revisit if `convex@1.39` ships before Phase 3 plan executes)
