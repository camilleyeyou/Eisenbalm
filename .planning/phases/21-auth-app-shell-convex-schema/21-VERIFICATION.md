---
phase: 21-auth-app-shell-convex-schema
verified: 2026-06-21T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 2 manual checkpoints deferred per user decision
human_verification:
  - test: "Sign-in redirect + shell navigation (Plans 03 and 05 checkpoints)"
    expected: "Unauthenticated visit to http://localhost:3001/graph redirects to Clerk sign-in; after sign-in the shell renders with 7 nav items (Graph, Runs, Config, Prompts, Registry, Finance, Settings) in order; each nav item routes to a rendering placeholder page; active route is highlighted; Clerk UserButton opens account/sign-out menu; apps/web at http://localhost:3000/ loads with no sign-in prompt"
    why_human: "Requires real Clerk API keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY), manual JWT template creation ('convex') in Clerk Dashboard, and CLERK_JWT_ISSUER_DOMAIN set on the Convex deployment. Cannot be automated without live credentials."
  - test: "Convex auth.config.ts JWT trust verification"
    expected: "After npx convex env set CLERK_JWT_ISSUER_DOMAIN <url> + npx convex dev, ConvexProviderWithClerk does not throw 401 after sign-in (Convex receives and trusts the Clerk JWT). Confirmed by absence of auth errors in browser console."
    why_human: "Requires live Convex deployment with CLERK_JWT_ISSUER_DOMAIN env var set and Clerk JWT template 'convex' created."
  - test: "seedEisenbalm idempotency proof"
    expected: "npx convex run workspace:seedEisenbalm returns { seeded: true } on first call; { seeded: false, message: 'eisenbalm workspace already exists' } on second call. Query workspace_id='eisenbalm' returns the seeded workspace."
    why_human: "convex-test not installed in @eisenbalm/convex package (documented in 21-02-SUMMARY.md). The mutation logic is statically verified by typecheck but live idempotency requires a running Convex deployment. Per plan decision, npx convex run x2 is the documented manual proof."
---

# Phase 21: Auth + App Shell + Convex Schema — Verification Report

**Phase Goal:** Operator can sign in to `dispatch-control` and see a navigable app shell; every dashboard route is protected by Clerk while `apps/web` stays unauthenticated; all new Convex tables carry `workspace_id` and the "eisenbalm" workspace is seeded.

**Verified:** 2026-06-21
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unauthenticated → redirect to Clerk sign-in; shell renders with 7 nav items | ? HUMAN | clerkMiddleware + createRouteMatcher code verified; NAV_ITEMS confirmed 7 items in correct order; live flow needs real Clerk credentials |
| 2 | Every dashboard route returns redirect/401 without session; apps/web has zero Clerk dependency | ✓ VERIFIED | middleware.ts protects all non-/sign-in routes; grep confirms 0 @clerk occurrences in all apps/web files (package.json + app/ + components/); automated test enforces this |
| 3 | FastAPI dashboard endpoints reject without valid Clerk JWT; cron keeps X-Pipeline-Trigger-Secret | ✓ VERIFIED | auth.py implements require_clerk_jwt with RS256/JWKS verification; /dashboard/whoami guarded by Depends(require_clerk_jwt); _require_trigger_secret function body confirmed untouched; 0 skip markers in test_clerk_auth.py |
| 4 | Audit log + run records attribute operator identity from day one | ✓ VERIFIED | audit_log table has actorId: v.string(); runs table has triggeredBy: v.optional(v.string()); upsertCurrentUser writes identity.subject as clerkUserId; workspace.ts writes actorId: 'system:seed' to audit_log on seed |
| 5 | All 11 new Convex tables carry workspace_id; query workspace_id="eisenbalm" returns seeded workspace | ✓ VERIFIED | grep confirms exactly 11 occurrences of `workspace_id: v.string()` and 11 `.index('by_workspace'` entries in schema.ts; seedEisenbalm code inserts workspaces row with workspace_id='eisenbalm'; idempotency branch confirmed in code |

**Score:** 5/5 automated truths verified (live browser flow deferred to manual per explicit user decision)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/package.json` | Next 15 / React 19 / Tailwind v4 workspace app | ✓ VERIFIED | Contains "name": "dispatch-control", "@clerk/nextjs": "^7.5.7", exact dep versions from apps/web |
| `apps/dispatch-control/vitest.config.ts` | Test harness mirroring apps/web | ✓ VERIFIED | Exists; includes `__tests__/**/*.test.ts` pattern |
| `apps/dispatch-control/lib/workspace.ts` | DEFAULT_WORKSPACE_ID constant (D-16) | ✓ VERIFIED | `export const DEFAULT_WORKSPACE_ID = 'eisenbalm'` confirmed |
| `packages/pipeline/tests/api/test_clerk_auth.py` | Wave 0 stubs + AUTH-03 tests | ✓ VERIFIED | 4 tests, 0 skip markers (filled by Plan 04), contains `require_clerk_jwt` |
| `package.json` (root) | 5 dispatch-control scripts | ✓ VERIFIED | All 5 scripts confirmed: dev/build/lint/typecheck/test |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | 11 new tables with workspace_id and by_workspace index | ✓ VERIFIED | 11 `workspace_id: v.string()`, 11 `by_workspace` indexes; pipelineRuns and deliberationEvents untouched |
| `convex/auth.config.ts` | Convex trusts Clerk JWTs | ✓ VERIFIED | applicationID: "convex", CLERK_JWT_ISSUER_DOMAIN env-driven |
| `convex/workspace.ts` | Idempotent eisenbalm seed mutation | ✓ VERIFIED | seedEisenbalm: inserts workspaces + audit_log; returns seeded:false if exists; args:{} present |
| `convex/users.ts` | JIT user upsert keyed by Clerk sub | ✓ VERIFIED | upsertCurrentUser: getUserIdentity(), throws on null, writes identity.subject as clerkUserId, patches lastSeenAt on repeat |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/middleware.ts` | clerkMiddleware protecting all non-public routes | ✓ VERIFIED | Uses clerkMiddleware + createRouteMatcher(['/sign-in(.*)']); auth.protect() called; isPublicRoute exported for tests |
| `apps/dispatch-control/components/ConvexClientProvider.tsx` | ConvexProviderWithClerk with useAuth | ✓ VERIFIED | 'use client'; useAuth from @clerk/nextjs (not @clerk/clerk-react); ConvexProviderWithClerk confirmed |
| `apps/dispatch-control/app/sign-in/[[...sign-in]]/page.tsx` | Clerk SignIn surface | ✓ VERIFIED | File exists; imports SignIn from @clerk/nextjs |
| `apps/dispatch-control/app/layout.tsx` | Server Component with ClerkProvider wrapping ConvexClientProvider | ✓ VERIFIED | No 'use client'; ClerkProvider wraps ConvexClientProvider in body |

### Plan 04 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pipeline/src/eisenbalm_pipeline/api/auth.py` | require_clerk_jwt FastAPI dependency | ✓ VERIFIED | HTTPBearer, RSAAlgorithm.from_jwk, RS256, jwks.json URL, degraded-dev branch, lru_cache |
| `packages/pipeline/tests/api/test_clerk_auth.py` | AUTH-03 unit tests (JWKS-mocked) | ✓ VERIFIED | 4 tests present, 0 @pytest.mark.skip markers; tests 401/403 on missing header, 401 "Token expired" on expired, 200 with sub on valid, cron path unaffected |

### Plan 05 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/lib/nav.ts` | 7 nav items (label, href, icon) in D-07 order | ✓ VERIFIED | Graph/Runs/Config/Prompts/Registry/Finance/Settings with correct hrefs; typed NavItem[] |
| `apps/dispatch-control/components/AppSidebar.tsx` | Sidebar with nav + UserButton + active highlight | ✓ VERIFIED | UserButton from @clerk/nextjs; usePathname for active check; NAV_ITEMS mapped; aria-current |
| `apps/dispatch-control/app/(dashboard)/layout.tsx` | Sidebar shell layout | ✓ VERIFIED | AppSidebar + single <main> flex layout |
| `apps/dispatch-control/app/(dashboard)/page.tsx` | Redirect to /graph | ✓ VERIFIED | redirect('/graph') confirmed |
| 7x `app/(dashboard)/{route}/page.tsx` | Real placeholder pages | ✓ VERIFIED | All 7 confirmed: graph, runs, config, prompts, registry, finance, settings |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | `auth.protect()` | clerkMiddleware on non-public routes | ✓ WIRED | `if (!isPublicRoute(req)) { await auth.protect() }` confirmed |
| `ConvexClientProvider.tsx` | `@clerk/nextjs useAuth` | ConvexProviderWithClerk useAuth prop | ✓ WIRED | `useAuth={useAuth}` where useAuth is from @clerk/nextjs |
| `runs.py` | `require_clerk_jwt` | Depends() on /dashboard/whoami | ✓ WIRED | `claims: dict = Depends(require_clerk_jwt)` at line 394 |
| `auth.py` | Clerk JWKS | `{CLERK_JWT_ISSUER_DOMAIN}/.well-known/jwks.json` | ✓ WIRED | `f"{domain.rstrip('/')}/.well-known/jwks.json"` confirmed |
| `AppSidebar.tsx` | `lib/nav.ts` | maps NAV_ITEMS to links | ✓ WIRED | `import { NAV_ITEMS } from '@/lib/nav'`; mapped to Link components |
| `app/(dashboard)/page.tsx` | `/graph` | redirect() | ✓ WIRED | `redirect('/graph')` confirmed |
| `convex/users.ts` | `ctx.auth.getUserIdentity().subject` | Clerk identity in mutation | ✓ WIRED | `identity.subject` written as clerkUserId |
| `convex/auth.config.ts` | `CLERK_JWT_ISSUER_DOMAIN` | env-driven provider domain | ✓ WIRED | `process.env.CLERK_JWT_ISSUER_DOMAIN!` in providers domain |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AppSidebar.tsx` | NAV_ITEMS | static lib/nav.ts array | N/A (static config) | ✓ FLOWING |
| `convex/workspace.ts seedEisenbalm` | workspaces table | ctx.db.insert('workspaces', ...) | Yes — real DB write | ✓ FLOWING (code path verified; live DB requires manual proof) |
| `convex/users.ts upsertCurrentUser` | users table | ctx.auth.getUserIdentity() → clerkUserId | Yes — Clerk identity → DB | ✓ FLOWING (code path verified; live auth requires manual proof) |
| `auth.py require_clerk_jwt` | claims dict | JWKS → jwt.decode() → claims | Yes — real RS256 verify | ✓ FLOWING (JWKS mocked in tests; live Clerk requires env var) |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| apps/web has 0 @clerk occurrences | `grep -rc "@clerk" apps/web/ --include=*.ts --include=*.tsx --include=*.json` | 0 matches across all files | ✓ PASS |
| Schema has exactly 11 workspace_id fields | `grep -c "workspace_id: v.string()" convex/schema.ts` | 11 | ✓ PASS |
| Schema has exactly 11 by_workspace indexes | `grep -c "by_workspace'" convex/schema.ts` | 11 | ✓ PASS |
| Total defineTable count grew by 11 (10 → 21) | `grep -c "defineTable" convex/schema.ts` | 21 | ✓ PASS |
| 7 dashboard page.tsx files exist | `ls apps/dispatch-control/app/(dashboard)/` | 7 route dirs + layout.tsx + page.tsx | ✓ PASS |
| 5 root dispatch-control scripts present | grep count | 5 matches | ✓ PASS |
| test_clerk_auth.py has 0 skip markers | `grep -c "@pytest.mark.skip" test_clerk_auth.py` | 0 | ✓ PASS |
| middleware.ts uses middleware.ts not proxy.ts | file presence check | proxy.ts NOT FOUND | ✓ PASS |
| useAuth from @clerk/nextjs (not @clerk/clerk-react) | grep ConvexClientProvider.tsx | `from '@clerk/nextjs'` confirmed | ✓ PASS |
| charities table uses timesFeatured (not timesFeatureD) | grep convex/schema.ts | `timesFeatured` at line 306 | ✓ PASS |
| pipelineRuns not modified (frozen) | grep first field | `runId: v.string()` — no workspace_id | ✓ PASS |
| Sign-in redirect + live shell navigation | pnpm --filter dispatch-control dev + browser | Requires real Clerk credentials | ? SKIP — human_needed |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| AUTH-01 | 21-01, 21-03, 21-05 | Operator can sign in; every dashboard route protected; apps/web unauthenticated | ✓ SATISFIED (code) / ? HUMAN (live flow) | clerkMiddleware wires auth.protect() on all non-/sign-in routes; 7 nav items in correct order; middleware-matcher tests pass (no todos remaining); live browser checkpoint deferred |
| AUTH-02 | 21-01, 21-03 | Unauthenticated request → redirect/401; apps/web zero Clerk dependency | ✓ SATISFIED | isPublicRoute matcher tested; apps-web-no-clerk.test.ts scans package.json + all .ts/.tsx source; 0 @clerk found in apps/web |
| AUTH-03 | 21-01, 21-04 | FastAPI dashboard endpoints verify Clerk JWT; cron path unaffected | ✓ SATISFIED | require_clerk_jwt implemented (RS256, JWKS, lru_cache); applied to /dashboard/whoami; _require_trigger_secret and /run/weekly untouched; 4 pytest tests pass (0 skip markers) |
| AUTH-04 | 21-02 | Actions attributed to signed-in operator | ✓ SATISFIED | audit_log has actorId; runs has triggeredBy; upsertCurrentUser writes identity.subject as clerkUserId; seedEisenbalm writes actorId='system:seed' |
| CFG-05 | 21-02 | Every new table has workspace_id; eisenbalm workspace seeded | ✓ SATISFIED (code/static) / ? HUMAN (live seed) | 11/11 tables have workspace_id: v.string() + by_workspace index; seedEisenbalm inserts workspaces row with workspace_id='eisenbalm'; idempotent branch confirmed in code; live npx convex run x2 proof deferred |

All 5 requirement IDs from plan frontmatter (AUTH-01, AUTH-02, AUTH-03, AUTH-04, CFG-05) are accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 21.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/dispatch-control/__tests__/workspace-upsert.test.ts` | 12-13 | `it.todo('upsertCurrentUser...')` and `it.todo('seedEisenbalm...')` | ℹ️ Info | Intentional placeholder seams per plan (convex-test not installed); documented in 21-02-SUMMARY.md as chosen manual-proof fallback; does NOT block goal |
| All 7 `app/(dashboard)/*/page.tsx` | — | Phase-labeled placeholder pages ("coming in Phase N") | ℹ️ Info | Intentional per D-07; each owning phase (22–28) replaces with real view; explicitly authorized stubs |

No blocker (🛑) or warning (⚠️) anti-patterns found. The two todo seams in workspace-upsert.test.ts are the only non-live assertions for CFG-05 seed idempotency — the static typecheck proves the code compiles correctly, and live verification is the documented fallback path.

---

## Human Verification Required

### 1. Live Clerk Sign-In Flow + Shell Navigation (Plans 03 + 05 Checkpoints)

**Test:**
1. Create JWT template named exactly `"convex"` in Clerk Dashboard (JWT Templates → Add Template → Convex preset)
2. Set in `apps/dispatch-control/.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CONVEX_URL`
3. Set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment: `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-frontend-api.clerk.accounts.dev`
4. Run `pnpm --filter @eisenbalm/convex dev` (once to push auth.config.ts)
5. Run `pnpm --filter dispatch-control dev`
6. Visit http://localhost:3001/graph in an incognito browser

**Expected:**
- Unauthenticated visit redirects to Clerk sign-in page
- After sign-in, redirects back to /graph
- Shell renders left sidebar with exactly 7 nav items in order: Graph, Runs, Config, Prompts, Registry, Finance, Settings
- Clicking each nav item routes to a rendered placeholder page (no 404, no blank)
- Active nav item is visually highlighted
- Clerk UserButton appears in sidebar footer and opens account/sign-out menu
- No Convex 401 error in browser console (confirms Clerk JWT template + auth.config.ts wiring)
- http://localhost:3000/ (apps/web) loads without any sign-in prompt

**Why human:** Requires real Clerk application keys, manual JWT template creation in Clerk Dashboard, and CLERK_JWT_ISSUER_DOMAIN set on a live Convex deployment.

### 2. seedEisenbalm Idempotency (CFG-05 Live Proof)

**Test:**
```bash
# First call
npx convex run workspace:seedEisenbalm
# Second call
npx convex run workspace:seedEisenbalm
```

**Expected:**
- First call returns `{ seeded: true }`
- Second call returns `{ seeded: false, message: "eisenbalm workspace already exists" }`

**Why human:** convex-test not installed as a devDependency in @eisenbalm/convex (documented decision in 21-02-SUMMARY.md). The mutation code and schema are statically verified; live idempotency requires a running Convex deployment.

---

## Gaps Summary

No gaps blocking goal achievement. All automated checks pass. The phase delivers:

1. A working `dispatch-control` Next 15 workspace app with Clerk middleware, provider hierarchy, and sign-in route
2. 7 nav items in correct order with real placeholder pages and nav-coverage automated test
3. 11 workspace-scoped Convex tables (all with workspace_id + by_workspace index)
4. Idempotent seedEisenbalm mutation + JIT upsertCurrentUser keyed by Clerk sub
5. FastAPI require_clerk_jwt dependency guarding /dashboard/whoami; cron path untouched
6. apps/web provably free of @clerk dependency (automated standing guard)
7. pipelineRuns and deliberationEvents frozen tables confirmed untouched

Two items are deferred to a combined manual session per explicit user decision (noted in verification_notes): the live Clerk sign-in flow (Plans 03 + 05 human-verify checkpoints) and the live seedEisenbalm CLI proof. These require real Clerk credentials and a live Convex deployment — neither is a code gap.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
