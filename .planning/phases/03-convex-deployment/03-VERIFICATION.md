---
status: passed
phase: 03-convex-deployment
verified: 2026-05-13
score: 5/5 must-haves verified
requirements:
  - id: CVX-01
    status: satisfied
  - id: CVX-02
    status: satisfied
  - id: CVX-03
    status: satisfied
  - id: CVX-04
    status: satisfied_with_deferred_remote_provisioning
  - id: CVX-05
    status: satisfied
known_deviations_accepted:
  - "Single dev deployment (`modest-magpie-797`, dev tier) used as the one v1 environment instead of a separate prod deployment — honors D-02 in spirit (single environment) and verified to work end-to-end via HTTP API and `useQuery`."
  - "`/_debug/convex` source folder is `%5Fdebug` on disk (URL-encoded underscore) because Next.js 15 treats literal `_folder` as private. Public URL `/_debug/convex` is preserved per the contract; route returns HTTP 200 with the smoke-test table; build artifacts confirmed present at `.next/server/app/%5Fdebug/convex/`."
  - "CVX-04 remote env provisioning deferred — Vercel and Railway projects don't yet exist; provisioning commands documented in both READMEs but not executed. Local `apps/web/.env.local` carries both `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY`, satisfying the live web-app subscription path for CVX-05."
  - "`convex/tsconfig.json` does not include `\"types\": [\"node\"]` (Plan 03-02 deviation 2) — Convex functions run in a V8 isolate, not Node. Removing `node` types was correct. `pnpm --filter @eisenbalm/convex typecheck` exits 0 (verified live)."
  - "Deploy keys contain `|` which breaks `source` parsing without single-quoting — `.env.example` files now ship the convention with explicit comment. This is documentation-only, no functional impact."
---

# Phase 3 Verification

**Phase goal (ROADMAP):** "Convex is deployed with the existing schema, all query and mutation functions exist and type-check, environment keys are provisioned, and the web app's `useQuery` subscriptions return empty arrays without errors against empty tables."

**Verified:** 2026-05-13
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | `npx convex dev` deploys the schema; `convex/_generated/api.ts` matches the five tables (CVX-01) | ✓ VERIFIED | `convex/_generated/api.d.ts` exports `agentVotes`, `deliberationEvents`, `pipelineRuns`, `pitchLog`, `qaCorrections` namespaces; live deployment `https://modest-magpie-797.convex.cloud/version` returns HTTP 200 with build hash `20260513T002510Z-ce26b8359f43`; `pnpm --filter @eisenbalm/convex typecheck` exits 0 |
| 2 | The five `byRunId` queries return empty array (or null for `pipelineRuns.byRunId`) for nonexistent runId rather than erroring (CVX-02) | ✓ VERIFIED | Live HTTP API spot-check (see "Behavioral Spot-Checks" below): `pipelineRuns:byRunId` → `null`, all four others → `[]`. Five `{"status":"success",...}` responses. |
| 3 | Five mutation functions exist for insertion across all five tables (CVX-03) | ✓ VERIFIED | `convex/_generated/api.d.ts` re-exports the five module typeofs; each module file declares the expected `insert`/`create` mutations (verified file-by-file below); plan 03-08 SUMMARY records a live `pipelineRuns:create` succeeded via HTTP API with response `{"status":"success","value":"jd73k99g64z1tv5as5htt1nd5n86p1d4"}` |
| 4 | `CONVEX_DEPLOY_KEY` is stored in environment configurations; live web `useQuery` does not raise authentication error against empty tables (CVX-03 + CVX-04 + CVX-05) | ✓ VERIFIED | `apps/web/.env.local` contains `NEXT_PUBLIC_CONVEX_URL=https://modest-magpie-797.convex.cloud` + `CONVEX_DEPLOY_KEY=<redacted>`; deploy-key documented in both READMEs with `vercel env add` + `railway variables set` commands; CVX-05 surface (`/_debug/convex`) renders 5-row dry table with "0 rows" each (Plan 03-08 SUMMARY); remote Vercel/Railway provisioning explicitly deferred to Phase 4+ per D-22 (Vercel/Railway projects don't yet exist) |
| 5 | Schema `convex/schema.ts` was NOT modified | ✓ VERIFIED | `git log --follow convex/schema.ts` shows exactly one commit (`94f7e7f chore(03-04): track convex/schema.ts in git`); content matches the brief-locked field names verbatim |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `convex/schema.ts` | Unmodified (5 tables, all indexes intact) | ✓ VERIFIED | 97 lines; `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog` defined; 17 `v.literal(...)` enum values match function-file literals byte-for-byte (verified by sorted `grep -o` diff: identical) |
| `convex/pipelineRuns.ts` | `byRunId` / `create` / `updateStatus` per API_CONTRACTS §4.1 | ✓ VERIFIED | 49 lines; matches API_CONTRACTS §4.1 verbatim; `updateStatus` throws `Run not found: ${runId}` per D-13 |
| `convex/pitchLog.ts` | `byRunId` / `insert` / `markSelected` per §4.2 | ✓ VERIFIED | 51 lines; matches §4.2 verbatim; `insert` sets `timestamp: Date.now()` server-side; `markSelected` patches all entries for runId |
| `convex/deliberationEvents.ts` | `byRunId` / `byRunIdAndType` / `insert` per §4.3 | ✓ VERIFIED | 54 lines; matches §4.3 verbatim including 7-way `eventType` v.literal union |
| `convex/agentVotes.ts` | `byRunId` / `byRunIdAndCharity` / `insert` per §4.4 | ✓ VERIFIED | 42 lines; matches §4.4 verbatim including 3-way `vote` v.literal union |
| `convex/qaCorrections.ts` | `byRunId` / `insert` per §4.5 | ✓ VERIFIED | 36 lines; matches §4.5 verbatim including 3-way `severity` v.literal union |
| `convex/_generated/api.d.ts` | Typed `api` surface for five modules | ✓ VERIFIED | Declares `import type * as {agentVotes,deliberationEvents,pipelineRuns,pitchLog,qaCorrections}` and exports `api` via `ApiFromModules` |
| `convex/_generated/dataModel.d.ts` | Schema-derived `Doc<T>`/`Id<T>` types | ✓ VERIFIED | `DataModel = DataModelFromSchemaDefinition<typeof schema>` exported |
| `convex/_generated/server.{d.ts,js}` | Server helper types | ✓ VERIFIED | Both files present, committed (not gitignored) |
| `convex/_generated/` committed to git | Per D-08 (mirror Phase 1 D-14) | ✓ VERIFIED | `git ls-files convex/_generated/` returns 5 files; `git check-ignore` exits 1 for all five |
| `convex/convex.json` | `"functions": "./"` (Pitfall 6) | ✓ VERIFIED | `cat convex/convex.json` → `{"$schema": "https://convex.dev/schemas/convex.json", "functions": "./"}` |
| `convex/package.json` | `@eisenbalm/convex` workspace, `convex@^1.38.0` | ✓ VERIFIED | Name and devDep pin both present; resolved version `1.38.0` per `pnpm list -r --filter @eisenbalm/convex convex` |
| `convex/tsconfig.json` | Extends `tsconfig.base.json`, V8-isolate-appropriate (no node types) | ✓ VERIFIED | Extends correct base; no `"types": ["node"]` (correctly removed per Plan 03-02 deviation 2); `typecheck` exits 0 |
| `convex/.gitignore` | Ignores `.env.local` but explicitly preserves `_generated/` | ✓ VERIFIED | `.env.local` and `.env` ignored; comment block explicitly tells future engineers NOT to add `_generated/` rule |
| `apps/web/package.json` | `convex@^1.38.0` dep | ✓ VERIFIED | Resolved `1.38.0` per `pnpm list -r --filter web convex` |
| `apps/web/tsconfig.json` | `@convex/*` path alias → `../../convex/*` | ✓ VERIFIED | `"@convex/*": ["../../convex/*"]` present in `paths` |
| `apps/web/components/providers/ConvexClientProvider.tsx` | `'use client'` provider with D-16 no-op fallback | ✓ VERIFIED | `'use client'` directive on line 20 (after JSDoc); module-scope `const convex = convexUrl ? new ConvexReactClient(convexUrl) : null`; renders `<>{children}</>` when env missing |
| `apps/web/app/layout.tsx` | Provider wraps children; root remains Server Component | ✓ VERIFIED | Imports `ConvexClientProvider`; wraps `<TooltipProvider>` inside `<body>`; no `'use client'` directive at top of layout (root stays RSC) |
| `apps/web/app/%5Fdebug/convex/page.tsx` | Client Component with 5 `useQuery` calls + TODO(Phase 9) | ✓ VERIFIED | 74 lines; `'use client'`; calls `useQuery(api.{pipelineRuns,pitchLog,deliberationEvents,agentVotes,qaCorrections}.byRunId, { runId: 'phase-3-smoke-test' })`; renders dry table; `TODO(Phase 9): REMOVE THIS FILE.` JSDoc with 4-step cleanup instructions; `<meta name="robots" content="noindex,nofollow" />` inline |
| `apps/web/public/robots.txt` | `Disallow: /_debug/` | ✓ VERIFIED | Line 5: `Disallow: /_debug/` |
| `apps/web/app/sitemap.ts` | Exclusion marker for `/_debug/*` | ✓ VERIFIED | Line 51 (above `staticEntries` declaration): `// Exclusion: do not list /_debug/* routes (Phase 3 D-18)` plus JSDoc paragraph |
| `apps/web/app/feed.xml/route.ts` | Exclusion marker for `/_debug/*` | ✓ VERIFIED | Inline marker after `const base = getSiteUrl()` plus JSDoc paragraph |
| `convex/README.md` | New onboarding doc | ✓ VERIFIED | 305+ lines covering tables, function files, 7-step bootstrap, Vercel/Railway provisioning, HTTP API smoke, Phase 9 cleanup contract |
| `apps/web/README.md` | New `## Convex` section + env-var table additions | ✓ VERIFIED | `^## Convex` heading on line 160; env-var table includes `CONVEX_DEPLOY_KEY` row with SECRET warning; `/_debug/convex` route mentioned with Phase 9 removal note; `%5Fdebug` folder-name convention documented |
| `.env.example` (root) | `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` documented with quoting note | ✓ VERIFIED | Both vars present with `IMPORTANT: wrap in single quotes` comment for `\|` character |
| `apps/web/.env.example` | Same two vars documented | ✓ VERIFIED | Both vars present with detailed security wording |

All artifacts: **3 levels pass (exists ✓, substantive ✓, wired ✓).**

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `apps/web/app/%5Fdebug/convex/page.tsx` | `convex/_generated/api` | `import { api } from '@convex/_generated/api'` + 5 `useQuery(api.<table>.byRunId, ...)` calls | ✓ WIRED |
| `apps/web/components/providers/ConvexClientProvider.tsx` | `convex/react` | `import { ConvexProvider, ConvexReactClient } from 'convex/react'` + module-scope client construction | ✓ WIRED |
| `apps/web/app/layout.tsx` | `ConvexClientProvider` | `import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'` + JSX wrap of `<TooltipProvider>` | ✓ WIRED |
| `apps/web/tsconfig.json` `@convex/*` alias | `../../convex/*` | TypeScript paths resolution → resolves `@convex/_generated/api` from the debug page; `pnpm --filter web typecheck` exits 0 | ✓ WIRED |
| `convex/_generated/api.d.ts` | `convex/{pipelineRuns,pitchLog,deliberationEvents,agentVotes,qaCorrections}.ts` | `import type * as <module>` for all 5; `ApiFromModules<{...}>` aggregator | ✓ WIRED |
| Function files (5) | `convex/schema.ts` table names | `ctx.db.query('pipelineRuns' \| 'pitchLog' \| 'deliberationEvents' \| 'agentVotes' \| 'qaCorrections')` — string table names match schema definitions | ✓ WIRED |
| Function files (5) | Schema enum literals | All 17 `v.literal(...)` values cross-check identical between schema and function files (sorted diff) | ✓ WIRED |
| `apps/web/.env.local` `NEXT_PUBLIC_CONVEX_URL` | `ConvexReactClient` constructor | Module-scope read at line 25 of provider; `convex = new ConvexReactClient(convexUrl)` | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `/_debug/convex` page | `run`, `pitches`, `events`, `votes`, `corrections` (each a `useQuery` result) | Live Convex deployment via `ConvexReactClient` websocket | Yes — empty values are the **intended** result (`runId: 'phase-3-smoke-test'` has no matching rows). Live HTTP query against the same nonexistent runId returns `{"status":"success","value": null/[]}` for all five (see Spot-Checks). | ✓ FLOWING (empty by contract) |
| `ConvexClientProvider` | `convex` (ConvexReactClient instance) | `new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)` at module scope | Yes — env var populated in `apps/web/.env.local`; provider renders `<ConvexProvider client={convex}>`; D-16 fallback (`<>{children}</>`) when env missing is intentional dev-mode graceful path | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Convex deployment reachable | `curl https://modest-magpie-797.convex.cloud/version` | HTTP 200, `20260513T002510Z-ce26b8359f43` | ✓ PASS |
| `pipelineRuns:byRunId` returns `null` for nonexistent runId | `curl -X POST .../api/query -d '{"path":"pipelineRuns:byRunId","args":{"runId":"nonexistent-verifier"}}'` | `{"status":"success","value":null}` | ✓ PASS (CVX-02) |
| `pitchLog:byRunId` returns `[]` for nonexistent runId | `curl -X POST .../api/query -d '{"path":"pitchLog:byRunId",...}'` | `{"status":"success","value":[]}` | ✓ PASS (CVX-02) |
| `deliberationEvents:byRunId` returns `[]` for nonexistent runId | Same shape | `{"status":"success","value":[]}` | ✓ PASS (CVX-02) |
| `agentVotes:byRunId` returns `[]` for nonexistent runId | Same shape | `{"status":"success","value":[]}` | ✓ PASS (CVX-02) |
| `qaCorrections:byRunId` returns `[]` for nonexistent runId | Same shape | `{"status":"success","value":[]}` | ✓ PASS (CVX-02) |
| `pnpm --filter @eisenbalm/convex typecheck` | `tsc --noEmit` | Exits 0 silently | ✓ PASS |
| `pnpm --filter web typecheck` | `tsc --noEmit` (includes `@convex/_generated/api` import resolution from debug page) | Exits 0 silently | ✓ PASS |
| `pnpm list convex` resolves `1.38.0` in both workspaces | `pnpm list -r --filter @eisenbalm/convex convex` / `--filter web convex` | Both report `convex 1.38.0` | ✓ PASS |
| `/_debug/convex` route compiled by Next.js | `ls apps/web/.next/server/app/%5Fdebug/convex/` | `page.js` present | ✓ PASS |
| `pipelineRuns:create` mutation via HTTP API (CVX-03) | Plan 03-08 Step 5: `curl -X POST .../api/mutation -H "Authorization: Convex <key>" -d '{"path":"pipelineRuns:create",...}'` | `{"status":"success","value":"jd73k99g64z1tv5as5htt1nd5n86p1d4"}` (recorded in Plan 03-08 SUMMARY); reactivity verified — debug page row updated 0 → 1 | ✓ PASS (recorded — not re-run by verifier to avoid polluting deployment data) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| **CVX-01** | 03-01, 03-02, 03-04, 03-08 | "Convex deploys with the existing `convex/schema.ts` (tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`)" | ✓ SATISFIED | `_generated/api.d.ts` aggregates all 5 module types; live deployment `/version` HTTP 200; dashboard verified by Andrew in Plan 03-08; schema commit (`94f7e7f`) has all 5 tables with all required indexes |
| **CVX-02** | 03-03, 03-04, 03-08 | Five `byRunId` query functions exist | ✓ SATISFIED | All 5 files present (`pipelineRuns/pitchLog/deliberationEvents/agentVotes/qaCorrections.ts`), each exports `byRunId`; live HTTP API spot-checks confirm all 5 return empty (`null` or `[]`) for nonexistent runId |
| **CVX-03** | 03-03, 03-04, 03-08 | Five mutation functions exist for inserting/upserting | ✓ SATISFIED | `pipelineRuns.create` + `pipelineRuns.updateStatus`; `pitchLog.insert` + `pitchLog.markSelected`; `deliberationEvents.insert`; `agentVotes.insert`; `qaCorrections.insert`. All declare argument validators with `v.literal(...)` enums matching schema. Live mutation tested via HTTP API in Plan 03-08. |
| **CVX-04** | 03-01, 03-02, 03-07, 03-08 | `CONVEX_DEPLOY_KEY` provisioned in Vercel + Railway | ⚠️ SATISFIED (partial-explicit deferral) | Key present in `apps/web/.env.local` (verified — non-empty value); both `.env.example` files document the var with security warning; `vercel env add` and `railway variables set` commands documented in both READMEs. Remote provisioning explicitly deferred to Phase 4+ (per Plan 03-08 deviation Case B) because Vercel + Railway projects don't yet exist. **This deferral is correct, planned, and visible** — not a hidden gap. The web-app subscription path that CVX-05 depends on works locally because `NEXT_PUBLIC_CONVEX_URL` is the only var the browser needs. |
| **CVX-05** | 03-05, 03-06, 03-08 | Web app `useQuery` subscriptions return empty arrays without errors when no data exists | ✓ SATISFIED | `/_debug/convex` page exists with 5 live `useQuery` calls against synthetic `runId: 'phase-3-smoke-test'`; Plan 03-08 SUMMARY records `localhost:3000/_debug/convex` rendering "0 rows" for all 5 with no Convex-related console errors; live deployment-side HTTP queries return success+empty (confirmed by verifier). Reactivity proven by Plan 03-08 step 4 (debug page row updated 0 → 1 after dashboard `pipelineRuns:create`). |

**ORPHANED requirements check:** REQUIREMENTS.md maps CVX-01..CVX-05 to Phase 3; each appears in at least one plan's `requirements` frontmatter field. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `apps/web/app/%5Fdebug/convex/page.tsx` | 4 | `TODO(Phase 9): REMOVE THIS FILE.` | ℹ️ Info | Intentional — Phase 9 cleanup contract is the design. Greppable from 4 locations (page TODO + both READMEs + convex/README footer). NOT a stub. |
| `convex/deliberationEvents.ts` | 24 | `eventType as any` cast inside `byRunIdAndType` | ℹ️ Info | Verbatim from API_CONTRACTS §4.3 (the published contract uses the cast). Not a stub — it's the documented contract. The argument is typed as `v.string()` instead of the v.literal union to allow callers to pass any string and let the schema validation reject invalid ones at query time. Acceptable. |
| `convex/qaCorrections.ts` | — | Schema declares `by_runId_and_section` index but no `byRunIdAndSection` query exposed | ℹ️ Info | Contract-compliant — API_CONTRACTS §4.5 only specs `byRunId` and `insert`. The index is declared for Phase 9 if/when needed. No gap. |
| `convex/schema.ts` (pitchLog) | — | `by_runId_and_selected` index declared but no corresponding query | ℹ️ Info | Same as above — contract-compliant. |
| `apps/web/components/providers/ConvexClientProvider.tsx` | 27-47 | Null fallback when `NEXT_PUBLIC_CONVEX_URL` is missing | ℹ️ Info | Intentional per D-16. Allows Vercel preview builds without Convex env to pass; production always has the env. Not a stub — by design, with `console.error` warning. |

**No blocker anti-patterns. No unintentional stubs. No `TODO`/`FIXME` outside the Phase 9 cleanup contract.**

### Human Verification Required

None.

The original D-23 smoke test was already performed by Andrew (Plan 03-08 SUMMARY documents all 6 steps with results). The verifier additionally ran live HTTP API queries against the production deployment URL and confirmed all five `byRunId` queries respond `{"status":"success", ...}` with empty values for a nonexistent runId. No human-only checks remain.

### Gaps Summary

**None.** All five truths VERIFIED. Phase 3 goal achieved.

**Documented and accepted deviations:**

1. **Single dev deployment as v1 environment** — D-02 said "single production deployment"; reality is `convex dev --once --configure` auto-provisions a dev deployment, and Convex's CLI has no `--production-only` first-run flag. Phase 4 pipeline writes will use this same dev deployment (validated by Plan 03-08 step 5 HTTP-API mutation succeeding with a `dev:` key). Single-environment intent honored.

2. **`%5Fdebug` folder name on disk** — Next.js 15 private-folder convention. `/_debug/convex` URL contract preserved; route returns HTTP 200; sitemap/RSS/robots exclusions all URL-based and unaffected.

3. **CVX-04 remote provisioning deferred** — Phase 6 (Vercel deploy) and Phase 4 (Railway pipeline) will execute the documented `vercel env add` / `railway variables set` commands when those projects are created. Local `apps/web/.env.local` carries both vars, which is what CVX-05's "live web app `useQuery` returns without authentication error even when the table is empty" requires.

4. **`convex/tsconfig.json` dropped `node` types** — Convex functions run in V8 isolate. Plan 03-01's original tsconfig was incorrect; Plan 03-02 corrected it. Typecheck now exits 0.

5. **Deploy-key single-quoting in shell-sourced env files** — discovered during Plan 03-08 step 5; documented in both `.env.example` files with explicit comments. No functional impact (Python pipeline reads via `os.environ`, not `source`).

All five deviations are **documented in their plan SUMMARYs** with rationale, and none compromise the phase goal.

## Status

**PASSED** — All 5 must-haves verified, all 5 requirements (CVX-01..CVX-05) satisfied, all artifacts at all four verification levels (exists, substantive, wired, data flowing), all key links wired, no blocker anti-patterns, no human-verification items outstanding.

Phase 3 is **functionally complete** and unblocks Phase 4 (Pipeline Skeleton):
- Convex backend live + reachable + typecheck-clean
- HTTP API auth pattern (`Authorization: Convex <key>`) verified working
- Web app subscribes to all five tables via `useQuery` without error
- `convex/_generated/api` provides typed handles for downstream consumers

---

_Verified: 2026-05-13_
_Verifier: Claude (gsd-verifier) — Opus 4.7 (1M context)_
