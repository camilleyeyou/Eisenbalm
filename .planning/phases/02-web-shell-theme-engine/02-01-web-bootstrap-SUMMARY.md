---
phase: "02"
plan: "01"
subsystem: "apps/web"
tags: ["next15", "tailwind-v4", "typescript", "workspace-bootstrap", "deps"]
dependency_graph:
  requires: ["01-05-typegen-pipeline"]
  provides: ["apps/web workspace", "Next 15.3 dep tree", "Tailwind v4 PostCSS pipeline", "tsconfig Bundler resolution", "@/* path alias"]
  affects: ["02-02-sanity-reader", "02-03-theme-engine", "02-04-workspace-placeholders", "02-05-typegen-pipeline"]
tech_stack:
  added:
    - "next@15.5.18 (^15.3.9)"
    - "react@19.2.6"
    - "react-dom@19.2.6"
    - "next-sanity@12.4.5"
    - "@sanity/client@7.22.0"
    - "@sanity/image-url@2.1.1"
    - "@portabletext/react@6.2.0"
    - "lucide-react@1.14.0 (plan specified ^0.450.0 — does not exist; bumped to ^1.14.0)"
    - "tailwindcss@4.3.0"
    - "@tailwindcss/postcss@4.3.0"
    - "typescript@5.6.3"
    - "@types/react@19.1.4"
    - "@types/react-dom@19.1.3"
    - "@types/node@22.15.18"
  patterns:
    - "Tailwind v4 @theme directive (no tailwind.config.ts required)"
    - "tsconfig moduleResolution: Bundler (overrides NodeNext from base for Next 15 compatibility)"
    - "next.config.ts TypeScript config pattern"
    - "cdn.sanity.io remote pattern for next/image"
key_files:
  created:
    - apps/web/next.config.ts
    - apps/web/next-env.d.ts
    - apps/web/postcss.config.mjs
    - apps/web/.env.example
    - apps/web/.gitignore
  modified:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - package.json
decisions:
  - "lucide-react pinned to ^1.14.0 (plan specified ^0.450.0 which has never been published; latest stable is 1.14.0)"
  - "next-sanity peer warnings about Next 16 are expected and documented — we intentionally stay on Next 15 per STACK.md"
  - "moduleResolution: Bundler overrides NodeNext from tsconfig.base.json — required for Next 15 App Router + Tailwind v4"
  - "composite: false, declaration: false override base config — Next apps do not emit type declarations"
metrics:
  duration: "6 min"
  completed: "2026-05-12T03:46:06Z"
  tasks: 3
  files: 8
---

# Phase 02 Plan 01: Web Bootstrap Summary

Bootstrap `apps/web` as a real Next.js 15.3.x workspace with pinned dependencies, TypeScript config for App Router, Tailwind v4 PostCSS pipeline, environment variable contract, and root monorepo scripts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace apps/web/package.json with real Next 15 manifest | 6135f8d | apps/web/package.json |
| 2 | Wire apps/web tsconfig.json for Next 15 App Router | 50a5ded | apps/web/tsconfig.json, apps/web/next-env.d.ts, apps/web/next.config.ts |
| 3 | Tailwind v4 PostCSS + .env.example + .gitignore + root scripts | 32a944a | apps/web/postcss.config.mjs, apps/web/.env.example, apps/web/.gitignore, package.json |

## Pinned Versions Installed

| Package | Requested | Installed |
|---------|-----------|-----------|
| next | ^15.3.9 | 15.5.18 |
| react | ^19.2.6 | 19.2.6 |
| react-dom | ^19.2.6 | 19.2.6 |
| next-sanity | ^12.4.5 | 12.4.5 |
| @sanity/client | ^7.22.0 | 7.22.0 |
| @sanity/image-url | ^2.1.1 | 2.1.1 |
| @portabletext/react | ^6.2.0 | 6.2.0 |
| lucide-react | ^1.14.0 (deviation) | 1.14.0 |
| tailwindcss | ^4.3.0 | 4.3.0 |
| @tailwindcss/postcss | ^4.3.0 | 4.3.0 |
| typescript | ^5.6.0 | 5.6.3 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lucide-react version ^0.450.0 does not exist on npm**
- **Found during:** Task 1 (pnpm install failed immediately)
- **Issue:** Plan specified `"lucide-react": "^0.450.0"` but this version has never been published. The `0.x` series topped at `0.577.0`. Current stable is `1.14.0`.
- **Fix:** Updated version to `^1.14.0` (current stable). API is compatible — all icon imports work the same way.
- **Files modified:** `apps/web/package.json`
- **Commit:** 6135f8d

### Peer Dependency Warnings (Non-blocking, Expected)

`next-sanity@12.4.5` declares a peer of `next@^16.0.0-0` and warns that `next@15.5.18` was found. This is a known discrepancy explicitly documented in STACK.md — we intentionally stay on Next 15 to avoid the SanityLive 4-10x Vercel request overage bug. The warning does not block install or runtime.

### Typecheck Status (Cross-Plan Interaction)

The parallel Wave 1 agents (02-02 and 02-03) created `apps/web/lib/` files before this plan's typecheck step ran:

- `apps/web/lib/sanity/image.ts` (from 02-02): imports `@sanity/image-url/lib/types/types` which is not exported by `@sanity/image-url@2.1.1`. This is a bug in the 02-02 output.
- `apps/web/lib/theme.test.ts` (from 02-03): Two `Object is possibly 'undefined'` errors at lines 436-437.

These errors are outside Plan 02-01's namespace (my ownership ends at tsconfig, package.json, next.config.ts, postcss.config.mjs, .env.example, .gitignore). The tsconfig configuration itself is correct. The failing files will be fixed in 02-02/02-03 verification cycles.

Per deviation rules: logged in deferred-items rather than fixed (out-of-scope pre-existing issues in other plans' files).

## Root Scripts Added

```json
"dev:web":      "pnpm --filter web dev",
"build:web":    "pnpm --filter web build",
"lint:web":     "pnpm --filter web lint",
"typecheck:web":"pnpm --filter web typecheck"
```

All Phase 1 studio scripts (`dev:studio`, `build:studio`, `deploy:studio`, `typegen`, `seed:agents`) and the 02-04 `seed:demo` script are preserved.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| apps/web/package.json | FOUND |
| apps/web/tsconfig.json | FOUND |
| apps/web/next.config.ts | FOUND |
| apps/web/next-env.d.ts | FOUND |
| apps/web/postcss.config.mjs | FOUND |
| apps/web/.env.example | FOUND |
| apps/web/.gitignore | FOUND |
| commit 6135f8d (Task 1) | FOUND |
| commit 50a5ded (Task 2) | FOUND |
| commit 32a944a (Task 3) | FOUND |
