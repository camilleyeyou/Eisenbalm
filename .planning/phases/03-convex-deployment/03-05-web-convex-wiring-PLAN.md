---
phase: 03-convex-deployment
plan: 05
type: execute
wave: 5
depends_on:
  - "03-04"
files_modified:
  - apps/web/package.json
  - apps/web/tsconfig.json
  - apps/web/components/providers/ConvexClientProvider.tsx
  - apps/web/app/layout.tsx
autonomous: true
requirements:
  - CVX-04
  - CVX-05
must_haves:
  truths:
    - "apps/web/package.json includes convex@^1.38.0 in dependencies"
    - "apps/web/tsconfig.json has the @convex/* path alias mapping to ../../convex/*"
    - "apps/web/components/providers/ConvexClientProvider.tsx is a 'use client' wrapper that constructs ConvexReactClient at module scope using NEXT_PUBLIC_CONVEX_URL with graceful fallback when env is missing (D-16)"
    - "apps/web/app/layout.tsx wraps children in <ConvexClientProvider> while remaining a Server Component"
    - "`pnpm --filter web typecheck` exits 0 with the alias active (no @convex/* import yet — that's Plan 03-06's job; this plan just adds the alias and provider scaffolding)"
    - "`pnpm --filter web build` succeeds even when NEXT_PUBLIC_CONVEX_URL is unset (D-16 fallback)"
  artifacts:
    - path: "apps/web/components/providers/ConvexClientProvider.tsx"
      provides: "'use client' wrapper that mounts ConvexProvider with a module-scope ConvexReactClient"
      contains: "ConvexReactClient"
    - path: "apps/web/tsconfig.json"
      provides: "@convex/* path alias for cross-workspace TS imports"
      contains: "@convex/*"
    - path: "apps/web/package.json"
      provides: "convex dep declaration"
      contains: "\"convex\":"
  key_links:
    - from: "apps/web/app/layout.tsx"
      to: "apps/web/components/providers/ConvexClientProvider.tsx"
      via: "Direct import + JSX wrap of children"
      pattern: "ConvexClientProvider"
    - from: "ConvexClientProvider.tsx"
      to: "Convex Cloud deployment"
      via: "process.env.NEXT_PUBLIC_CONVEX_URL → ConvexReactClient → websocket"
      pattern: "new ConvexReactClient"
---

<objective>
Wire `apps/web` to Convex: add `convex@^1.38.0` as a dependency, add the `@convex/*` TS path alias, create the `'use client'` wrapper component that mounts ConvexProvider at module scope (with D-16's no-op fallback when `NEXT_PUBLIC_CONVEX_URL` is missing), and mount the provider in the root layout while keeping it as a Server Component.

This plan does NOT create the `/_debug/convex` page (Plan 03-06 does that) and does NOT modify `DeliberationSlot.tsx` (Phase 9's territory). It only sets up the provider scaffolding so Plan 03-06's `useQuery` calls work.

Purpose: Honors D-14 (add `convex` dep), D-15 (provider mounts in root layout via 'use client' wrapper), D-16 (graceful fallback for missing env — mirrors `apps/web/lib/sanity/client.ts` placeholder pattern), D-17 (Client Component island, no Suspense added in Phase 3), D-19 (`@convex/*` path alias).
Output: The web app can import the typed `api` object and use `useQuery` from descendants, with a stable, FOUC-free provider chain.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
@.planning/phases/03-convex-deployment/03-RESEARCH.md
@apps/web/package.json
@apps/web/tsconfig.json
@apps/web/app/layout.tsx
@apps/web/lib/sanity/client.ts
@convex/_generated/api.d.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add convex@^1.38.0 dep to apps/web/package.json and run pnpm install</name>
  <files>apps/web/package.json</files>
  <read_first>
    - apps/web/package.json (current content — preserve every existing dependency byte-for-byte)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-14 (only one dep: `convex`, no separate `convex/react` package)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Standard Stack "Installation (extend apps/web/package.json dependencies)"
  </read_first>
  <action>
    Edit `apps/web/package.json` to add `convex@^1.38.0` to the `dependencies` block. Insert alphabetically — between `class-variance-authority` and `clsx`, OR at the end of the block; either is acceptable but be consistent with the current alphabetical ordering pattern.

    Final `dependencies` block (preserving every existing entry):

    ```json
    "dependencies": {
      "@eisenbalm/shared": "workspace:*",
      "@portabletext/react": "^6.2.0",
      "@radix-ui/react-slot": "^1.2.4",
      "@radix-ui/react-tooltip": "^1.2.8",
      "@sanity/client": "^7.22.0",
      "@sanity/image-url": "^2.1.1",
      "class-variance-authority": "^0.7.1",
      "clsx": "^2.1.1",
      "convex": "^1.38.0",
      "lucide-react": "^1.14.0",
      "next": "^15.3.9",
      "next-sanity": "^12.4.5",
      "react": "^19.2.6",
      "react-dom": "^19.2.6",
      "tailwind-merge": "^3.6.0",
      "tailwindcss-animate": "^1.0.7"
    }
    ```

    Do not touch `devDependencies`, `scripts`, `name`, `version`, `private`, `description`.

    Then run `pnpm install` from the repo root to resolve the new dep:

    ```bash
    pnpm install
    ```

    Expected: `pnpm install` exits 0 and `apps/web/node_modules/convex` (or the hoisted `node_modules/.pnpm/convex@1.38.0`) exists.
  </action>
  <verify>
    <automated>grep -q '"convex": "\^1.38.0"' apps/web/package.json && node -e "const p=JSON.parse(require('fs').readFileSync('apps/web/package.json','utf8')); if(!p.dependencies.convex)process.exit(1); if(!p.dependencies['@sanity/client'])process.exit(1); if(!p.dependencies.next)process.exit(1);" && (test -d apps/web/node_modules/convex || test -d node_modules/.pnpm)</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/package.json` parses as valid JSON
    - `apps/web/package.json` `dependencies.convex` equals `"^1.38.0"`
    - Every previous dependency entry (`@eisenbalm/shared`, `@portabletext/react`, `@radix-ui/*`, `@sanity/*`, `class-variance-authority`, `clsx`, `lucide-react`, `next`, `next-sanity`, `react`, `react-dom`, `tailwind-merge`, `tailwindcss-animate`) is still present with unchanged version
    - `pnpm install` succeeded (convex package is resolvable — verifiable by `node -e "console.log(require.resolve('convex/react', { paths: ['apps/web'] }))"`)
  </acceptance_criteria>
  <done>
    `convex@^1.38.0` is now a runtime dep of `apps/web`. Both subpath imports (`convex/react`, `convex/values`) resolve via the single npm package per D-14.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add @convex/* path alias to apps/web/tsconfig.json</name>
  <files>apps/web/tsconfig.json</files>
  <read_first>
    - apps/web/tsconfig.json (current content — preserve every existing field)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-19 (`"@convex/*": ["../../convex/*"]`)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §7 (verbatim path alias diff)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Pitfall 2 (path alias may need verification under Next 15 bundler — fallback is relative import)
  </read_first>
  <action>
    Edit `apps/web/tsconfig.json` to add the `@convex/*` path alias inside `compilerOptions.paths`. The current `paths` block has only `"@/*": ["./*"]`. After the edit, `paths` MUST contain BOTH aliases.

    Final `compilerOptions.paths` block:

    ```json
    "paths": {
      "@/*": ["./*"],
      "@convex/*": ["../../convex/*"]
    }
    ```

    Do not touch `target`, `module`, `moduleResolution`, `lib`, `jsx`, `allowJs`, `noEmit`, `incremental`, `composite`, `declaration`, `declarationMap`, `sourceMap`, `resolveJsonModule`, `isolatedModules`, `plugins`, `include`, `exclude`, or `extends`. Preserve byte-for-byte except the `paths` block.

    Verify by running TypeScript check after the edit:

    ```bash
    pnpm --filter web typecheck
    ```

    Expected: exits 0. (No `@convex/*` import exists in the codebase yet — that comes in Plan 03-06 — so this just validates the alias parses without breaking existing imports.)
  </action>
  <verify>
    <automated>grep -q '"@convex/\*"' apps/web/tsconfig.json && grep -q '"\.\./\.\./convex/\*"' apps/web/tsconfig.json && grep -q '"@/\*"' apps/web/tsconfig.json && node -e "const c=JSON.parse(require('fs').readFileSync('apps/web/tsconfig.json','utf8').replace(/\/\/.*/g,'').replace(/\/\*[\s\S]*?\*\//g,'')); if(!c.compilerOptions.paths['@convex/*'])process.exit(1);" && cd apps/web && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/tsconfig.json` parses as valid JSON-with-comments (existing extends still works)
    - `compilerOptions.paths` contains both `"@/*": ["./*"]` and `"@convex/*": ["../../convex/*"]`
    - All other compilerOptions are unchanged from the pre-edit state
    - `pnpm --filter web typecheck` exits 0 (alias does not break existing imports)
  </acceptance_criteria>
  <done>
    The `@convex/*` alias is wired. Plan 03-06 can `import { api } from '@convex/_generated/api'` and Next 15's bundler + tsc will resolve to `convex/_generated/api`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create apps/web/components/providers/ConvexClientProvider.tsx ('use client' wrapper)</name>
  <files>apps/web/components/providers/ConvexClientProvider.tsx</files>
  <read_first>
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §1 (verbatim ConvexClientProvider content)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-15, D-16, D-17 (mount in root layout; graceful fallback; no Suspense)
    - apps/web/lib/sanity/client.ts (reference pattern for missing-env fallback — `apps/web/lib/sanity/client.ts` uses `projectIdOrPlaceholder = SANITY_PROJECT_ID || 'placeholder'`; we use a similar but null-check pattern for Convex)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Pitfall 1 (Vercel preview builds must not crash with `TypeError: Invalid URL`)
  </read_first>
  <action>
    Create the directory `apps/web/components/providers/` if it does not exist, then write `apps/web/components/providers/ConvexClientProvider.tsx` with EXACTLY this content (verbatim from 03-RESEARCH §Code Examples §1, with the explanatory comment block preserved):

    ```tsx
    /**
     * ConvexClientProvider — 'use client' wrapper that mounts <ConvexProvider>.
     *
     * Mirrors Convex's official Next.js App Router pattern:
     *   https://docs.convex.dev/quickstart/nextjs
     *
     * Module-scope client construction (one ConvexReactClient per browser
     * session, one websocket per client). Do NOT instantiate inside the
     * component — re-creating per render leaks websockets.
     *
     * D-16: handle missing NEXT_PUBLIC_CONVEX_URL gracefully so Vercel preview
     * builds without Convex env still pass. Pattern mirrors
     * apps/web/lib/sanity/client.ts (Phase 2) — log + soft-fail rather than
     * throw at module load.
     *
     * Phase 9 will introduce <Suspense> boundaries around the actual
     * <DeliberationSlot> subscription. Phase 3 has no consuming UI yet other
     * than /_debug/convex (Plan 03-06).
     */
    'use client'

    import { ConvexProvider, ConvexReactClient } from 'convex/react'
    import type { ReactNode } from 'react'

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

    if (!convexUrl) {
      // Log once at module init when env is missing. Mirrors the
      // console.error in apps/web/lib/sanity/client.ts for SANITY_PROJECT_ID.
      console.error(
        '[convex] NEXT_PUBLIC_CONVEX_URL is not set. ' +
          'Copy apps/web/.env.example to apps/web/.env.local and run ' +
          '`pnpm --filter @eisenbalm/convex exec convex dev --once --configure` ' +
          'to provision a deployment. The app will render without Convex ' +
          'subscriptions until this is set.',
      )
    }

    // Module-scope: one client per browser session. When the env var is missing
    // we skip client construction entirely (D-16) and render children without a
    // provider — any descendant calling useQuery will throw with a clear
    // "no provider" message, which is the correct loud failure in dev.
    const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

    export function ConvexClientProvider({ children }: { children: ReactNode }) {
      if (!convex) {
        return <>{children}</>
      }
      return <ConvexProvider client={convex}>{children}</ConvexProvider>
    }
    ```

    Critical:
    - The file is a Client Component (`'use client'` directive on line 1 of executable code).
    - `convex` is constructed at MODULE scope (top-level `const`), not inside the component body. Re-creating per render would leak websockets.
    - When `NEXT_PUBLIC_CONVEX_URL` is unset, the provider passes children through without wrapping — this prevents Vercel preview builds from crashing (D-16 + Pitfall 1) and lets the rest of the site (Sanity reads, Stripe in Phase 8, etc.) render.
    - No `setDebug` call (research §Discretion: "skip; default is already off in production").

    **Critical ordering requirement:** The `'use client'` directive must be the FIRST executable line — it may be preceded ONLY by comment lines (the JSDoc block above). NO `import` line may appear before `'use client'`. This is a Next.js App Router requirement: the directive must precede all imports.
  </action>
  <verify>
    <automated>test -f apps/web/components/providers/ConvexClientProvider.tsx && awk '/^import / {print "FAIL: import before use client"; exit 1} /^'\''use client'\''/ {found=1; exit 0} END {if(!found){print "FAIL: no use client directive"; exit 1}}' apps/web/components/providers/ConvexClientProvider.tsx && grep -q "import { ConvexProvider, ConvexReactClient } from 'convex/react'" apps/web/components/providers/ConvexClientProvider.tsx && grep -q "process.env.NEXT_PUBLIC_CONVEX_URL" apps/web/components/providers/ConvexClientProvider.tsx && grep -q "new ConvexReactClient" apps/web/components/providers/ConvexClientProvider.tsx && grep -q "export function ConvexClientProvider" apps/web/components/providers/ConvexClientProvider.tsx && cd apps/web && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `apps/web/components/providers/ConvexClientProvider.tsx`
    - File starts with `'use client'` directive (only comment lines may precede it — NO `import` line may appear before `'use client'`; this is asserted by the awk one-liner in `<verify>`)
    - File imports `ConvexProvider` and `ConvexReactClient` from `'convex/react'` (subpath export of the `convex` package — D-14)
    - File imports `ReactNode` type from `'react'`
    - `const convex = convexUrl ? new ConvexReactClient(convexUrl) : null` appears at module scope (NOT inside the function component)
    - The component returns `<>{children}</>` when `convex === null` and `<ConvexProvider client={convex}>{children}</ConvexProvider>` otherwise
    - `apps/web` TypeScript compiles: `cd apps/web && pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>
    The provider component is ready to mount. Module-scope client construction means one websocket per session. D-16 fallback prevents build crashes on missing env. The `'use client'` directive precedes all imports per Next.js App Router rules.
  </done>
</task>

<task type="auto">
  <name>Task 4: Mount <ConvexClientProvider> in apps/web/app/layout.tsx</name>
  <files>apps/web/app/layout.tsx</files>
  <read_first>
    - apps/web/app/layout.tsx (current content — preserve fonts, metadata, viewport, the `<style dangerouslySetInnerHTML>` block, and the SiteHeader/main/SiteFooter structure)
    - apps/web/components/providers/ConvexClientProvider.tsx (just created in Task 3)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §2 (root layout integration)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-15, D-17 (provider mounts inside the existing TooltipProvider chain; order doesn't matter — both are React Context)
  </read_first>
  <action>
    Edit `apps/web/app/layout.tsx`:

    **Step 1.** Add the import near the top of the import block (after the `TooltipProvider` import):

    ```tsx
    import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'
    ```

    **Step 2.** In the JSX returned by `RootLayout`, wrap the `<TooltipProvider>` block with `<ConvexClientProvider>`. The current structure is:

    ```tsx
    <body className="flex min-h-screen flex-col font-body text-[color:var(--color-text)]">
      <TooltipProvider delayDuration={0}>
        <SiteHeader />
        <main className="flex-1" id="main">
          {children}
        </main>
        <SiteFooter />
      </TooltipProvider>
    </body>
    ```

    Change to:

    ```tsx
    <body className="flex min-h-screen flex-col font-body text-[color:var(--color-text)]">
      <ConvexClientProvider>
        <TooltipProvider delayDuration={0}>
          <SiteHeader />
          <main className="flex-1" id="main">
            {children}
          </main>
          <SiteFooter />
        </TooltipProvider>
      </ConvexClientProvider>
    </body>
    ```

    Do NOT touch:
    - The `metadata` export
    - The `viewport` export
    - The three `next/font/google` imports and configurations (`fontDisplay`, `fontBody`, `fontUi`)
    - The `serializeThemeCss(null)` call
    - The `<html lang="en" className=...>` wrapper
    - The `<head>` with its `<style dangerouslySetInnerHTML>` block
    - The `<body>` className
    - The `id="main"` attribute on `<main>`

    The provider is OUTSIDE the existing TooltipProvider (so the Convex context wraps the entire tree). Both are React Context providers and don't conflict.

    Important: `RootLayout` remains a Server Component. `ConvexClientProvider` is the Client Component island that creates the boundary. Do NOT add `'use client'` to `layout.tsx`.
  </action>
  <verify>
    <automated>grep -q "import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'" apps/web/app/layout.tsx && grep -q "<ConvexClientProvider>" apps/web/app/layout.tsx && grep -q "</ConvexClientProvider>" apps/web/app/layout.tsx && grep -q "TooltipProvider" apps/web/app/layout.tsx && grep -q "serializeThemeCss" apps/web/app/layout.tsx && ! grep -q "^'use client'" apps/web/app/layout.tsx && cd apps/web && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/app/layout.tsx` imports `ConvexClientProvider` from the correct relative path via the `@/` alias
    - JSX contains exactly one `<ConvexClientProvider>` opening tag and one matching `</ConvexClientProvider>` closing tag
    - `<ConvexClientProvider>` wraps `<TooltipProvider>` (Convex context outside Tooltip context)
    - `RootLayout` is still a Server Component (no `'use client'` directive added to layout.tsx)
    - `metadata`, `viewport`, the three fonts, and the `serializeThemeCss` inline style block are all preserved unchanged
    - `cd apps/web && pnpm typecheck` exits 0
    - The plan-level `<verification>` block (below) runs `pnpm build` as the single integration check — production build is NOT verified per-task to avoid duplicating the ~30s build twice within this plan
  </acceptance_criteria>
  <done>
    The provider is mounted. Plan 03-06's `/_debug/convex` page can call `useQuery` from anywhere in the tree. The root layout remains an RSC. The end-of-plan `pnpm build` (run in `<verification>`) is the single integration check.
  </done>
</task>

</tasks>

<verification>
End-of-plan integration check — run ONCE after all four tasks complete. This is the single, authoritative production-build verification for this plan; individual tasks do NOT run `pnpm build`.

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: both exit 0. The build must succeed even when `NEXT_PUBLIC_CONVEX_URL` is unset (proves the D-16 fallback in `ConvexClientProvider.tsx` works at build time — Vercel preview deploys depend on this).

Additional checks:
- `apps/web/package.json` has `"convex": "^1.38.0"` in dependencies
- `apps/web/tsconfig.json` has both `@/*` and `@convex/*` path aliases
- `apps/web/components/providers/ConvexClientProvider.tsx` exists with module-scope client construction + D-16 fallback
- `apps/web/components/providers/ConvexClientProvider.tsx` has `'use client'` as the first non-comment line (no `import` precedes it)
- `apps/web/app/layout.tsx` wraps `<TooltipProvider>` in `<ConvexClientProvider>`
- `apps/web/app/layout.tsx` is still a Server Component (no `'use client'` directive)
- DeliberationSlot.tsx is NOT modified (Phase 9's territory)
- The five convex/*.ts function files are NOT modified
</verification>

<success_criteria>
- CVX-04 partially satisfied: NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY are present in apps/web/.env.local (from Plan 03-02) and used by the provider; remote provisioning (Vercel + Railway) is Andrew's manual step in the final smoke test
- CVX-05 unblocked: the next plan (03-06) can call `useQuery` because the provider is mounted and the path alias resolves
- Build does not crash when env is missing (Vercel preview deploy resilience per Pitfall 1)
- Phase 9 cleanup is preserved: DeliberationSlot.tsx untouched, no Convex calls added to its placeholder
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-05-SUMMARY.md` recording:
  (a) the exact `convex` version pnpm resolved (target: `1.38.0`; note any drift),
  (b) the four files touched and a one-line summary of each change,
  (c) confirmation that `pnpm build` succeeds with `NEXT_PUBLIC_CONVEX_URL` UNSET (test by temporarily renaming `apps/web/.env.local` and rebuilding — then restore — this proves Pitfall 1 fallback works),
  (d) `apps/web/app/layout.tsx` line count before and after (sanity check that nothing else was modified),
  (e) confirmation that DeliberationSlot.tsx is unchanged (`git diff apps/web/components/issue/DeliberationSlot.tsx` shows no output).
</output>
</content>
</invoke>