---
phase: 02-web-shell-theme-engine
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/tsconfig.json
  - apps/web/next.config.ts
  - apps/web/postcss.config.mjs
  - apps/web/next-env.d.ts
  - apps/web/.env.example
  - apps/web/.gitignore
  - package.json
autonomous: true
requirements: [WEB-01, WEB-02, WEB-03, WEB-04, WEB-05]
must_haves:
  truths:
    - "apps/web installs Next 15.3.x, React 19, Tailwind v4 cleanly via pnpm"
    - "apps/web/tsconfig.json compiles app/, components/, lib/ with strict mode"
    - "Environment variable contract is documented in apps/web/.env.example"
  artifacts:
    - path: apps/web/package.json
      provides: "Pinned Next 15.3.x + supporting deps; preserves @eisenbalm/shared workspace dep"
      contains: "next, react, react-dom, next-sanity, @sanity/client, @sanity/image-url, @portabletext/react, tailwindcss, lucide-react, @eisenbalm/shared"
    - path: apps/web/tsconfig.json
      provides: "TypeScript config extending root base, includes Next.js bundler resolution"
    - path: apps/web/next.config.ts
      provides: "Next 15 config (App Router default)"
    - path: apps/web/postcss.config.mjs
      provides: "Tailwind v4 PostCSS pipeline"
    - path: apps/web/.env.example
      provides: "NEXT_PUBLIC_SANITY_PROJECT_ID + NEXT_PUBLIC_SANITY_DATASET names"
  key_links:
    - from: apps/web/package.json
      to: packages/shared
      via: "workspace:* dependency"
      pattern: "@eisenbalm/shared.*workspace:\\*"
    - from: package.json (root)
      to: apps/web
      via: "pnpm filter scripts (dev:web, build:web, lint:web)"
      pattern: "pnpm --filter web"
---

<objective>
Bootstrap `apps/web` as a real Next.js 15.3.x workspace by replacing the Phase 1 placeholder. Install pinned dependencies (Next 15.3.x, React 19, next-sanity@^12.4.5, Tailwind v4, lucide-react, Portable Text + Sanity image helpers), wire the TypeScript config, add the Tailwind v4 PostCSS pipeline, ship `.env.example`, and add root pnpm scripts so `pnpm --filter web dev` runs once Wave 2 lands `app/layout.tsx`.

Purpose: Every downstream plan in this phase (Sanity client, theme engine, routes, smoke test) depends on a working Next.js workspace with the exact pinned deps. Phase 2 honors STACK.md and CONTEXT.md D-01..D-09 verbatim.
Output: `apps/web/` workspace where `pnpm install` from repo root succeeds and `pnpm --filter web typecheck` succeeds (against the placeholder `app/` directory that Wave 2 will populate).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@.planning/research/STACK.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@apps/web/package.json
@apps/web/tsconfig.json
@apps/web/README.md
@apps/studio/package.json
@tsconfig.base.json
@package.json

<interfaces>
<!-- Pinned versions from STACK.md + CONTEXT.md D-01..D-09. -->
<!-- Executor copies these verbatim into apps/web/package.json. -->

Required runtime deps (exact ranges):
- "next": "^15.3.9"
- "react": "^19.2.6"
- "react-dom": "^19.2.6"
- "@sanity/client": "^7.22.0"
- "next-sanity": "^12.4.5"
- "@portabletext/react": "^6.2.0"
- "@sanity/image-url": "^2.1.1"
- "lucide-react": "^0.450.0"
- "@eisenbalm/shared": "workspace:*"   # PRESERVED from Phase 1 placeholder

Required dev deps:
- "typescript": "^5.6.0"   # matches studio (5.6.x is what apps/studio uses)
- "tailwindcss": "^4.3.0"
- "@tailwindcss/postcss": "^4.3.0"
- "@types/node": "^22.0.0"
- "@types/react": "^19.0.0"
- "@types/react-dom": "^19.0.0"

Per CONTEXT.md D-08: NO additional deps without flagging. shadcn primitives + @sanity/image-url are already covered. Convex, Stripe, zod are explicitly OUT (Phase 8/9).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace apps/web/package.json with real Next 15 manifest</name>
  <read_first>
    - apps/web/package.json (placeholder from Phase 1 — PRESERVE name="web" and @eisenbalm/shared workspace dep)
    - .planning/research/STACK.md (pinned versions; "next-sanity version note")
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-01..D-09)
  </read_first>
  <files>apps/web/package.json</files>
  <action>
    Overwrite `apps/web/package.json` with the following exact structure. Preserve `"name": "web"` and `"private": true`. Preserve the `@eisenbalm/shared: "workspace:*"` dep.

    ```json
    {
      "name": "web",
      "version": "0.0.0",
      "private": true,
      "description": "Next.js 15 reader frontend for The Eisenbalm Dispatch",
      "scripts": {
        "dev": "next dev --port 3000",
        "build": "next build",
        "start": "next start --port 3000",
        "lint": "next lint",
        "typecheck": "tsc --noEmit"
      },
      "dependencies": {
        "@eisenbalm/shared": "workspace:*",
        "@portabletext/react": "^6.2.0",
        "@sanity/client": "^7.22.0",
        "@sanity/image-url": "^2.1.1",
        "lucide-react": "^0.450.0",
        "next": "^15.3.9",
        "next-sanity": "^12.4.5",
        "react": "^19.2.6",
        "react-dom": "^19.2.6"
      },
      "devDependencies": {
        "@tailwindcss/postcss": "^4.3.0",
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "tailwindcss": "^4.3.0",
        "typescript": "^5.6.0"
      }
    }
    ```

    Rationale:
    - Next 15.3.x pinned per STACK.md "Next.js version" row + CONTEXT.md D-01 ("NOT 16"). SanityLive 4-10x overage bug on Next 16.
    - `next-sanity@^12.4.5` per CONTEXT.md D-02 — NOT the `@cache-components` tag.
    - Tailwind v4.3.x + `@tailwindcss/postcss` per CONTEXT.md D-05.
    - `lucide-react` per CONTEXT.md D-06.
    - TypeScript 5.6.x to match `apps/studio/package.json` (no version drift across workspace).
    - shadcn `button` + `tooltip` are NOT installed here — those land in Wave 3 (Plan 02-09) when the shop callout component is built, via `npx shadcn@latest add button tooltip` writing into `apps/web/components/ui/`.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      pnpm install --filter web 2>&1 | tail -5 && \
      test -d apps/web/node_modules/next && \
      test -d apps/web/node_modules/next-sanity && \
      test -d apps/web/node_modules/@sanity/client && \
      test -d apps/web/node_modules/@portabletext/react && \
      test -d apps/web/node_modules/@sanity/image-url && \
      test -d apps/web/node_modules/tailwindcss && \
      test -d apps/web/node_modules/lucide-react && \
      node -e "const p=require('./apps/web/package.json'); if(p.dependencies['@eisenbalm/shared']!=='workspace:*') process.exit(1); if(!p.dependencies.next.startsWith('^15.3')) process.exit(2); if(!p.dependencies['next-sanity'].startsWith('^12.4')) process.exit(3); console.log('package.json shape OK')"
    </automated>
  </verify>
  <done>
    `apps/web/package.json` lists Next 15.3.x, next-sanity 12.4.x, Tailwind v4, and preserves the @eisenbalm/shared workspace dep. `pnpm install` from repo root succeeds without errors or peer warnings that block install.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire apps/web tsconfig.json for Next 15 App Router</name>
  <read_first>
    - apps/web/tsconfig.json (current — extends base, empty include)
    - tsconfig.base.json (root — strict, NodeNext)
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md §"Implementation File Map" (target directories)
  </read_first>
  <files>apps/web/tsconfig.json, apps/web/next-env.d.ts, apps/web/next.config.ts</files>
  <action>
    1. Overwrite `apps/web/tsconfig.json` with:

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "jsx": "preserve",
        "allowJs": false,
        "noEmit": true,
        "incremental": true,
        "composite": false,
        "declaration": false,
        "declarationMap": false,
        "sourceMap": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "plugins": [{ "name": "next" }],
        "paths": {
          "@/*": ["./*"]
        }
      },
      "include": [
        "next-env.d.ts",
        "app/**/*.ts",
        "app/**/*.tsx",
        "components/**/*.ts",
        "components/**/*.tsx",
        "lib/**/*.ts",
        "lib/**/*.tsx",
        ".next/types/**/*.ts"
      ],
      "exclude": ["node_modules", ".next", "out"]
    }
    ```

    Note: This OVERRIDES `moduleResolution: NodeNext` from `tsconfig.base.json` because Next 15 + Tailwind v4 + next-sanity require `Bundler` resolution. Also overrides `composite: true` and `declaration: true` from base (Next apps don't emit declarations). All other strict settings (strict, noUncheckedIndexedAccess, noImplicitOverride, isolatedModules) inherit from base.

    2. Create `apps/web/next-env.d.ts` with the exact Next.js-generated content:

    ```typescript
    /// <reference types="next" />
    /// <reference types="next/image-types/global" />

    // NOTE: This file should not be edited
    // see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
    ```

    3. Create `apps/web/next.config.ts`:

    ```typescript
    import type { NextConfig } from 'next'

    const nextConfig: NextConfig = {
      reactStrictMode: true,
      images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'cdn.sanity.io',
            pathname: '/images/**',
          },
        ],
      },
      experimental: {
        // Phase 2: no experimental features required.
      },
    }

    export default nextConfig
    ```

    The `images.remotePatterns` whitelist for `cdn.sanity.io` is required because Wave 2/3 components (`<CharityCard>`, future per-issue OG images) will use `next/image` with Sanity-hosted assets via `@sanity/image-url`.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/tsconfig.json && \
      test -f apps/web/next-env.d.ts && \
      test -f apps/web/next.config.ts && \
      grep -q '"moduleResolution": "Bundler"' apps/web/tsconfig.json && \
      grep -q '"name": "next"' apps/web/tsconfig.json && \
      grep -q 'cdn.sanity.io' apps/web/next.config.ts && \
      grep -q '"@/\*"' apps/web/tsconfig.json
    </automated>
  </verify>
  <done>
    tsconfig.json overrides NodeNext → Bundler resolution for Next 15, registers the `next` plugin, defines `@/*` path alias, and includes `app/`, `components/`, `lib/`, plus `.next/types/`. next.config.ts whitelists `cdn.sanity.io` for next/image. next-env.d.ts is committed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add Tailwind v4 PostCSS pipeline + apps/web/.env.example + .gitignore + root scripts</name>
  <read_first>
    - .planning/research/STACK.md ("Tailwind CSS 4.3.0")
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-05, D-15, D-28)
    - package.json (root — pnpm@9.15.4 workspaces; already has dev:studio, build:studio, typegen, seed:agents scripts)
  </read_first>
  <files>apps/web/postcss.config.mjs, apps/web/.env.example, apps/web/.gitignore, package.json</files>
  <action>
    1. Create `apps/web/postcss.config.mjs` (Tailwind v4 uses PostCSS plugin, no `tailwind.config.ts` required):

    ```javascript
    /** @type {import('postcss-load-config').Config} */
    const config = {
      plugins: {
        '@tailwindcss/postcss': {},
      },
    }

    export default config
    ```

    2. Create `apps/web/.env.example` (committed; documents env contract for D-28):

    ```bash
    # Public Sanity config (safe to expose — production dataset is public reads only)
    NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf
    NEXT_PUBLIC_SANITY_DATASET=production

    # Site base URL (used in sitemap.xml, feed.xml, JSON-LD, OG canonical URLs)
    # In production, set to https://eisenbalm.com via Vercel env vars.
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```

    No `SANITY_API_TOKEN` in apps/web — the web app is read-only. Writes happen from `apps/studio/scripts/` and (Phase 4+) the Python pipeline.

    3. Create `apps/web/.gitignore` (Next.js standard + workspace specifics):

    ```
    # next.js
    /.next/
    /out/

    # production build
    /build

    # dependencies (handled by root .gitignore + pnpm)
    /node_modules

    # local env
    .env.local
    .env.development.local
    .env.production.local

    # logs
    *.log

    # ts incremental cache
    *.tsbuildinfo
    ```

    4. Update root `package.json` scripts. Read current scripts (`dev:studio`, `build:studio`, `deploy:studio`, `typegen`, `seed:agents`). Add four new scripts AFTER the existing ones, preserving JSON formatting and key ordering:

    Add to the `"scripts"` object:
    - `"dev:web": "pnpm --filter web dev"`
    - `"build:web": "pnpm --filter web build"`
    - `"lint:web": "pnpm --filter web lint"`
    - `"typecheck:web": "pnpm --filter web typecheck"`

    Final root `package.json` "scripts" section should be:

    ```json
    "scripts": {
      "dev:studio": "pnpm --filter studio dev",
      "build:studio": "pnpm --filter studio build",
      "deploy:studio": "pnpm --filter studio deploy",
      "typegen": "pnpm --filter studio typegen",
      "seed:agents": "pnpm --filter studio seed:agents",
      "dev:web": "pnpm --filter web dev",
      "build:web": "pnpm --filter web build",
      "lint:web": "pnpm --filter web lint",
      "typecheck:web": "pnpm --filter web typecheck"
    }
    ```

    Do NOT add `seed:demo` here — that script lands in Plan 02-04 (mounted on `apps/studio/package.json`).
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/postcss.config.mjs && \
      test -f apps/web/.env.example && \
      test -f apps/web/.gitignore && \
      grep -q '@tailwindcss/postcss' apps/web/postcss.config.mjs && \
      grep -q 'NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf' apps/web/.env.example && \
      grep -q 'NEXT_PUBLIC_SANITY_DATASET=production' apps/web/.env.example && \
      grep -q 'NEXT_PUBLIC_SITE_URL' apps/web/.env.example && \
      grep -q '\.env\.local' apps/web/.gitignore && \
      node -e "const p=require('./package.json'); for (const k of ['dev:web','build:web','lint:web','typecheck:web']) { if(!p.scripts[k]) { console.error('missing script: '+k); process.exit(1) } } console.log('root scripts OK')"
    </automated>
  </verify>
  <done>
    Tailwind v4 PostCSS config in place. `apps/web/.env.example` committed with the three env vars (project ID, dataset, site URL). `.env.local` is gitignored. Root `package.json` exposes `pnpm dev:web`, `pnpm build:web`, `pnpm lint:web`, `pnpm typecheck:web` while preserving every Phase 1 studio script.
  </done>
</task>

</tasks>

<verification>
- `pnpm install` from repo root completes without unrelated errors
- `apps/web/node_modules/next/package.json` shows version 15.3.x
- `apps/web/node_modules/next-sanity/package.json` shows version 12.4.x
- `apps/web/.env.example` is committed and lists exactly NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, NEXT_PUBLIC_SITE_URL
- Root `pnpm typecheck:web` runs (will report no input files yet — that's expected; Wave 2 lands them)
</verification>

<success_criteria>
- `apps/web/package.json` exists with all 9 runtime deps and 6 dev deps at the exact pinned versions; preserves `@eisenbalm/shared: "workspace:*"`
- `apps/web/tsconfig.json` overrides moduleResolution to Bundler, registers next plugin, defines @/* alias, and includes the App Router directories
- `apps/web/next.config.ts` whitelists `cdn.sanity.io`
- `apps/web/postcss.config.mjs` wires Tailwind v4
- `apps/web/.env.example` documents the three NEXT_PUBLIC_* vars; no SANITY_API_TOKEN (web is read-only)
- Root `package.json` adds `dev:web`, `build:web`, `lint:web`, `typecheck:web` without removing Phase 1 scripts
</success_criteria>

<output>
After completion, create `.planning/phases/02-web-shell-theme-engine/02-01-web-bootstrap-SUMMARY.md` recording: pinned versions, monorepo script additions, and any deviations (e.g., if pnpm install required a workaround for a peer-dep warning).
</output>
