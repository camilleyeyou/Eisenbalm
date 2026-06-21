---
phase: 21-auth-app-shell-convex-schema
plan: "03"
subsystem: apps/dispatch-control
tags: [auth, clerk, convex, middleware, next15]
dependency_graph:
  requires: ["21-01", "21-02"]
  provides: ["AUTH-01", "AUTH-02"]
  affects: ["apps/dispatch-control"]
tech_stack:
  added: ["@clerk/nextjs@^7.5.7"]
  patterns:
    - "clerkMiddleware + createRouteMatcher (Clerk Core 3 / Next.js 15 pattern)"
    - "ClerkProvider (Server) → ConvexClientProvider (Client) provider hierarchy"
    - "ConvexProviderWithClerk from convex/react-clerk with useAuth from @clerk/nextjs"
    - "Catch-all [[...sign-in]] route for Clerk <SignIn /> component"
key_files:
  created:
    - apps/dispatch-control/middleware.ts
    - apps/dispatch-control/components/ConvexClientProvider.tsx
    - apps/dispatch-control/app/sign-in/[[...sign-in]]/page.tsx
  modified:
    - apps/dispatch-control/app/layout.tsx
    - apps/dispatch-control/__tests__/middleware-matcher.test.ts
    - apps/dispatch-control/__tests__/apps-web-no-clerk.test.ts
    - apps/dispatch-control/.env.example
    - apps/dispatch-control/package.json
decisions:
  - "Used middleware.ts (not proxy.ts) — Next.js 15 pattern; proxy.ts is Next.js 16+"
  - "isPublicRoute exported as named export so unit tests import the real matcher"
  - "useAuth imported from @clerk/nextjs (not @clerk/clerk-react) per anti-pattern avoidance"
  - "Recursive @clerk source scan added to no-leak guard (not just package.json)"
metrics:
  duration: "5 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 5
---

# Phase 21 Plan 03: Clerk Auth Wiring — Summary

One-liner: Clerk ^7.5.7 wired into dispatch-control with clerkMiddleware + ConvexProviderWithClerk hierarchy, /sign-in route, and automated AUTH-01/02 tests.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Install Clerk + middleware + provider hierarchy + sign-in route | bee8e7e |
| 2 | Fill AUTH-01 middleware matcher tests + AUTH-02 no-leak source guard | f2faa27 |

## What Was Built

### Task 1: Clerk Auth Wiring

**`apps/dispatch-control/middleware.ts`** — `clerkMiddleware` protecting all routes except `/sign-in(.*)`. Uses `createRouteMatcher` per Clerk Core 3 API (not deprecated `authMiddleware`). Exports `isPublicRoute` as a named export so tests can import the real matcher.

**`apps/dispatch-control/components/ConvexClientProvider.tsx`** — `'use client'` wrapper that constructs a single `ConvexReactClient` at module scope (no per-render websocket leak) and wraps children in `ConvexProviderWithClerk client={convex} useAuth={useAuth}`. `useAuth` is from `@clerk/nextjs` (not `@clerk/clerk-react` — anti-pattern avoided).

**`apps/dispatch-control/app/layout.tsx`** — Server Component with `ClerkProvider` → `ConvexClientProvider` hierarchy. No `'use client'` directive on the layout (avoids Pitfall 3).

**`apps/dispatch-control/app/sign-in/[[...sign-in]]/page.tsx`** — Catch-all route rendering Clerk's `<SignIn />` component centered on screen.

**`apps/dispatch-control/.env.example`** — Updated with Pitfall 6 (separate Vercel project) and Pitfall 7 (NEXT_PUBLIC_CLERK_SIGN_IN_URL required) warnings.

### Task 2: Test Coverage

**`__tests__/middleware-matcher.test.ts`** — Replaced `it.todo` stubs with 9 unit assertions using `NextRequest` objects. Verifies `/sign-in` and `/sign-in/factor-*` are public; `/`, `/graph`, `/runs`, `/config`, `/prompts`, `/settings` are protected.

**`__tests__/apps-web-no-clerk.test.ts`** — Extended with a recursive source file scan (apps/web/app/ + apps/web/components/ `.ts`/`.tsx`) for any `@clerk` string. Previously only checked package.json.

## Verification Results

- `pnpm --filter dispatch-control typecheck` — exit 0
- `pnpm --filter dispatch-control test:unit` — 12 passed, 2 todo (workspace-upsert todos from Plan 21-02 scope)
- `grep -rc "@clerk" apps/web/` — zero matches (apps/web untouched)

## Checkpoint State

Plan 03 reached `checkpoint:human-verify` (Task 3) after completing Tasks 1 and 2. The checkpoint requires Andrew to verify the live sign-in flow with real Clerk API keys before the plan is marked complete.

### Checkpoint prerequisites (manual setup required):

1. In Clerk Dashboard: create a JWT template named exactly `"convex"` (Clerk Dashboard → JWT Templates → Add Template → Choose "Convex")
2. Set in `apps/dispatch-control/.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CONVEX_URL`
3. Set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment: `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-frontend-api.clerk.accounts.dev`
4. Run `pnpm --filter @eisenbalm/convex dev` once to push auth.config.ts

### Checkpoint verification steps:

1. Run `pnpm --filter dispatch-control dev` + `pnpm --filter @eisenbalm/convex dev`
2. Visit http://localhost:3001/graph in incognito → expect redirect to Clerk sign-in
3. Sign in → expect to land back in app with no Convex 401 in console
4. Confirm http://localhost:3000/ (apps/web) still loads without sign-in prompt

### Resume signal:

Type `"approved"` to continue to the next plan, or describe what failed (redirect, Convex 401, or apps/web broke).

## Deviations from Plan

None — plan executed exactly as written. The `.env.example` was already pre-populated with Clerk keys (from Plan 21-01); this plan added Pitfall 6/7 commentary to the existing entries.

## Known Stubs

None — all files created are functional, not placeholder stubs.

## Self-Check: PASSED

- `apps/dispatch-control/middleware.ts` — exists and contains `clerkMiddleware`, `isPublicRoute`, `auth.protect`
- `apps/dispatch-control/components/ConvexClientProvider.tsx` — exists, starts with `'use client'`, contains `ConvexProviderWithClerk`
- `apps/dispatch-control/app/layout.tsx` — contains `ClerkProvider`, no `'use client'`
- `apps/dispatch-control/app/sign-in/[[...sign-in]]/page.tsx` — exists, contains `SignIn`
- Commits bee8e7e and f2faa27 exist in git log
- `pnpm --filter dispatch-control typecheck` exits 0
- `pnpm --filter dispatch-control test:unit` — 12 passing
