---
phase: 03-convex-deployment
plan: 05
subsystem: web
tags:
  - convex
  - nextjs
  - app-router
  - client-component
  - provider
  - rsc-boundary
requires:
  - "Plan 03-04: convex/_generated/ committed (api.d.ts present for typed useQuery)"
  - "Phase 2 D-15: apps/web Next 15 App Router root layout exists"
provides:
  - "ConvexClientProvider mounted in root layout — useQuery hooks usable from any descendant"
  - "@convex/* TS path alias resolves to ../../convex/* for cross-workspace imports"
  - "convex@^1.38.0 npm dep installed (subpath exports: convex/react, convex/values)"
  - "D-16 no-op fallback: build succeeds when NEXT_PUBLIC_CONVEX_URL is unset"
affects:
  - "apps/web/app/layout.tsx (Server Component wrapper, +3 lines net)"
  - "apps/web/package.json (+1 dep entry)"
  - "apps/web/tsconfig.json (+1 path alias)"
  - "apps/web/components/providers/ConvexClientProvider.tsx (new file)"
tech-stack:
  added:
    - "convex@1.38.0 (resolved from ^1.38.0 spec)"
  patterns:
    - "Module-scope ConvexReactClient construction (single websocket per browser session)"
    - "'use client' wrapper as client island inside Server Component root layout"
    - "D-16 graceful env-missing fallback (mirrors apps/web/lib/sanity/client.ts)"
    - "@convex/* path alias for cross-workspace TS imports (mirrors @/* convention)"
key-files:
  created:
    - "apps/web/components/providers/ConvexClientProvider.tsx — 'use client' wrapper that constructs ConvexReactClient at module scope and renders <ConvexProvider> (or children unwrapped when env missing)"
  modified:
    - "apps/web/package.json — added convex@^1.38.0 to dependencies (alphabetical insert between clsx and lucide-react)"
    - "apps/web/tsconfig.json — added \"@convex/*\": [\"../../convex/*\"] alongside existing \"@/*\""
    - "apps/web/app/layout.tsx — imported ConvexClientProvider, wrapped <TooltipProvider> at <body> root; remains a Server Component"
decisions:
  - "Module-scope (eager) ConvexReactClient construction per Convex official quickstart — re-creating per render would leak websockets (D-15 + Research §Pattern 2)"
  - "Children-unwrapped fallback rather than placeholder URL — useQuery in dev throws a clear 'no provider' message; production always has the env (D-16, Research §Pattern 3)"
  - "ConvexClientProvider wraps TooltipProvider (Convex context outside Tooltip) — both are React Context, order is irrelevant but this matches Research §Code Examples §2"
  - "No Suspense boundary added (D-17) — Phase 9 introduces loading states with real DeliberationSlot"
metrics:
  duration: "6m"
  tasks: 4
  files: 4
  completed: "2026-05-13"
---

# Phase 3 Plan 05: web-convex-wiring Summary

One-liner: Wired `apps/web` to Convex with module-scope `ConvexReactClient`, `@convex/*` TS path alias, and a `'use client'` provider island that gracefully no-ops when `NEXT_PUBLIC_CONVEX_URL` is missing.

## What Shipped

Four atomic commits across four files. The provider scaffold is now in place so Plan 03-06's `/_debug/convex` page (and Phase 9's real `DeliberationSlot`) can call `useQuery` from any descendant of the root layout.

### Task 1 — `convex@^1.38.0` dep (commit `ebe8ce3`)

Inserted `"convex": "^1.38.0"` into `apps/web/package.json` dependencies, alphabetically between `clsx` and `lucide-react`. `pnpm install` resolved version **1.38.0** exactly (matches D-01 pin target). All subpath exports (`convex/react`, `convex/values`, `convex/server`) now resolve from the single npm package per D-14 — no separate `convex/react` install.

Verification: `require.resolve('convex/react', { paths: ['apps/web'] })` returned `/Users/user/Desktop/Eisenbalm/node_modules/.pnpm/convex@1.38.0_react@19.2.6/node_modules/convex/dist/cjs/react/index.js`.

### Task 2 — `@convex/*` TS path alias (commit `04dbf0c`)

Added `"@convex/*": ["../../convex/*"]` to `apps/web/tsconfig.json#compilerOptions.paths` alongside the existing `"@/*": ["./*"]`. Resolved path: `apps/web/tsconfig.json` + `../../convex/*` → `<repo>/convex/*`. `pnpm --filter web typecheck` exits 0 (no `@convex/*` import in the tree yet — that's Plan 03-06's debug page).

### Task 3 — `ConvexClientProvider` (commit `9089a04`)

Created `apps/web/components/providers/ConvexClientProvider.tsx`. The file:

- Starts with a JSDoc block, then `'use client'` on line 20, then imports. Per Next.js App Router rules, the directive must precede all imports — verified by the plan's awk one-liner.
- Reads `process.env.NEXT_PUBLIC_CONVEX_URL` once at module load.
- If missing: logs an informative `console.error` (mirroring `apps/web/lib/sanity/client.ts`) and sets `convex = null`. The component then renders `<>{children}</>` — D-16 no-op fallback.
- If present: constructs `new ConvexReactClient(convexUrl)` at module scope (one websocket per browser session per D-15 + Research §Pattern 2). Component renders `<ConvexProvider client={convex}>{children}</ConvexProvider>`.

No Suspense, no `setDebug`, no lazy initialization. Direct match to Research §Code Examples §1.

### Task 4 — Root layout mount (commit `1765bec`)

Added import of `ConvexClientProvider` to `apps/web/app/layout.tsx`. Wrapped the existing `<TooltipProvider>` in `<ConvexClientProvider>` inside `<body>`. `RootLayout` remains a Server Component — no `'use client'` directive added to `layout.tsx`. The wrap is the only JSX change; `metadata`, `viewport`, fonts, `serializeThemeCss`, `<head>` inline style, `<body>` className, `id="main"` on `<main>` are all preserved byte-for-byte.

## Output Spec Confirmations (per plan `<output>` block)

(a) **Resolved convex version:** `1.38.0` (verified via `cd apps/web && node -e "require('convex/package.json').version"`). No drift from D-01 target.

(b) **Four files touched:**
  - `apps/web/package.json` — +1 dep `convex@^1.38.0`
  - `apps/web/tsconfig.json` — +1 path alias `@convex/* → ../../convex/*`
  - `apps/web/components/providers/ConvexClientProvider.tsx` — new (50 lines)
  - `apps/web/app/layout.tsx` — +1 import, wrapped `<TooltipProvider>` in `<ConvexClientProvider>`

(c) **Build succeeds with `NEXT_PUBLIC_CONVEX_URL` UNSET:** Confirmed. Temporarily stripped only `NEXT_PUBLIC_CONVEX_URL` from `apps/web/.env.local` (Sanity env retained so unrelated Sanity GROQ reads still resolve), ran `pnpm build`, and `next build` exited 0 with all 13 routes generated (`/`, `/_not-found`, `/about`, `/archive`, `/charities`, `/charities/[slug]` × 2 SSG params, `/feed.xml`, `/issue/[slug]` × 1 SSG param, `/shop`, `/sitemap.xml`). The provider's module-init `console.error` fired exactly once during build, then children rendered unwrapped — confirming D-16 + Pitfall 1 fallback works. `.env.local` was restored after the test.

  Note on the full-env-stripped variant: removing ALL env vars (including Sanity) causes build failure at the Sanity layer (`Dataset "production" not found for project ID "placeholder"`) — this is pre-existing Phase 2 behavior unrelated to Plan 03-05's Convex changes. The targeted `NEXT_PUBLIC_CONVEX_URL`-only strip is the correct D-16 isolation test.

(d) **`apps/web/app/layout.tsx` line count:** before 118 → after 121 (+3 net: 1 new import + 2 wrapping tag lines around `<TooltipProvider>`). No other modifications.

(e) **`DeliberationSlot.tsx` unchanged:** `git diff HEAD~4 -- apps/web/components/issue/DeliberationSlot.tsx` produces no output. Phase 9's territory remains locked.

## Plan-Level Integration Check

Final run from the plan's `<verification>` block:

```
cd apps/web && pnpm typecheck && pnpm build
```

Result: both exit 0. Production build generates all 13 static routes, first load JS shared baseline 103 kB (unchanged from Phase 2 — Convex client code is tree-shaken out of route bundles because no `useQuery` call exists in the tree yet).

## Deviations from Plan

None — plan executed exactly as written. No deviation rules (1-3) triggered; no architectural decisions surfaced. The Tailwind canonical-class lint warning on `apps/web/app/layout.tsx:108` (`text-[color:var(--color-text)]` → `text-text`) was reported by the IDE during the Task 4 edit but is pre-existing Phase 2 code, not touched by this plan, and out of scope (logged as a pre-existing warning, not a deferred item).

## Requirements Satisfied

- **CVX-04 (partial):** `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` are present in `apps/web/.env.local` from Plan 03-02 and consumed by the provider. Remote Vercel + Railway provisioning is Andrew's manual step per D-22 — out of this plan's automatable scope.
- **CVX-05 (unblocked):** Plan 03-06 can now `import { useQuery } from 'convex/react'` and `import { api } from '@convex/_generated/api'` from any Client Component descendant of the root layout, and `useQuery` will subscribe via the module-scope `ConvexReactClient`.

## Self-Check: PASSED

- File `apps/web/components/providers/ConvexClientProvider.tsx` — FOUND (50 lines, `'use client'` on line 20 after JSDoc, imports follow)
- File `apps/web/package.json` — FOUND (contains `"convex": "^1.38.0"`)
- File `apps/web/tsconfig.json` — FOUND (contains `"@convex/*": ["../../convex/*"]`)
- File `apps/web/app/layout.tsx` — FOUND (contains `<ConvexClientProvider>` wrapping `<TooltipProvider>`, no `'use client'` at top)
- Commit `ebe8ce3` — FOUND (Task 1: convex dep)
- Commit `04dbf0c` — FOUND (Task 2: tsconfig alias)
- Commit `9089a04` — FOUND (Task 3: provider file)
- Commit `1765bec` — FOUND (Task 4: layout mount)
