---
phase: 02-web-shell-theme-engine
plan: 11
type: execute
wave: 4
depends_on: ["02-01", "02-02", "02-03", "02-04", "02-05", "02-06", "02-07", "02-08", "02-09", "02-10"]
files_modified:
  - apps/web/README.md
  - .planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md
autonomous: false
requirements: [WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11, WEB-12, WEB-13, WEB-14, WEB-15, WEB-16]
must_haves:
  truths:
    - "Andrew can follow apps/web/README.md from scratch to a running dev server in < 5 minutes"
    - "Every WEB-* success criterion has a manual verification step Andrew can perform"
    - "Theme injection security path is empirically verified: invalid hex falls back, low-contrast falls back, client-side ThemeApplier re-validates devtools tampering"
    - "Build, typecheck, sitemap.xml, feed.xml, and JSON-LD all confirmed working"
  artifacts:
    - path: apps/web/README.md
      provides: "Onboarding doc replacing Phase 1 placeholder; covers install, env, demo seed, dev, build, deploy notes, troubleshooting"
      min_lines: 100
    - path: .planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md
      provides: "Andrew's filled-in PASS/FAIL table covering all 16 WEB-* requirements + UI-SPEC extras"
  key_links:
    - from: apps/web/README.md
      to: vercel link (Andrew's manual deploy step per D-27)
      via: "documented in 'Deploying to Vercel' section"
      pattern: "vercel link"
---

<objective>
Close Phase 2 with (a) a real `apps/web/README.md` Andrew can follow from scratch, and (b) a full manual smoke test of every WEB-* success criterion against the running dev server. This plan is `autonomous: false` — Andrew must run the smoke test and report results back before Phase 2 is marked complete.

Purpose: A planned phase isn't shipped until a human has walked the route tree, viewed JSON-LD in page source, opened sitemap.xml in a browser, tested an invalid-hex theme, and printed an issue page. Anything that fails here becomes a follow-up plan.
Output: README + a documented smoke-test report (`02-11-SMOKE-TEST.md`).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md
@.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@apps/web/README.md
@apps/web/package.json
@apps/studio/README.md

<interfaces>
<!-- Phase 1 README pattern (apps/studio/README.md) to mirror tone + structure: -->
- Sections used: Status, What this is, Prerequisites, Setup, Scripts, Troubleshooting

<!-- Phase 1 outputs Andrew is familiar with (so README can reference them): -->
- pnpm install from repo root
- apps/studio/.env.local for Sanity Studio
- pnpm seed:agents (already run; not Phase 2's concern)
- pnpm typegen (already wired)

<!-- Phase 2 success criteria (must each be verified by smoke test): -->
1. / redirects to latest published issue OR shows graceful empty state
   /issue/[slug], /archive, /charities, /charities/[slug], /about, /shop all resolve
2. Theme with invalid hex (e.g. 'red') renders fallback without crash
3. WCAG AA contrast: low-contrast pair triggers fallback without exception
4. Issue page source contains schema.org/Article JSON-LD with charity name, founder, publish date, author=Jesse
   OG + Twitter card tags present
   /sitemap.xml + /feed.xml return valid XML
5. Print preview of issue page is clean (no theme bleed); reading time visible; anchor copy buttons functional
6. <ThemeApplier> client-side re-validation: post-hydration devtools tampering with --color-primary
   triggers a console warning and reapplies the fallback within one tick (CONTEXT.md D-10/D-11)

<!-- Smoke-test mechanics: -->
- Live dev server at http://localhost:3000
- The demo seed (Plan 02-04) must have been run so /issue/issue-1 exists
- For theme-fallback test: Andrew can temporarily edit the demo charity's theme via Sanity Studio
  OR the executor can use the Sanity API token to mutate the theme programmatically and revert.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace apps/web/README.md with the Phase 2 onboarding doc</name>
  <read_first>
    - apps/web/README.md (current Phase 1 placeholder)
    - apps/studio/README.md (Phase 1 reference for tone + section pattern)
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (D-27 Vercel manual step, D-28 env vars)
  </read_first>
  <files>apps/web/README.md</files>
  <action>
    Overwrite `apps/web/README.md`:

    ```markdown
    # apps/web — Next.js reader frontend

    **Status:** Phase 2 active. The reader-facing magazine.
    **Stack:** Next.js 15.3 (App Router) · React 19 · Tailwind v4 · next-sanity 12.4 · @portabletext/react.
    **Reads from:** Sanity dataset `6h1vd9mf/production` (wired in Phase 1).
    **Writes:** none — apps/web is read-only at runtime.

    ---

    ## Routes

    | Route | Source | Notes |
    |---|---|---|
    | `/` | `QUERY_LATEST_ISSUE_SLUG` → redirect | Falls back to a graceful empty state if no issue is published |
    | `/issue/[slug]` | `QUERY_ISSUE_BY_SLUG` | 10 sections in locked order; per-issue theme injected via validated CSS variables |
    | `/archive` | `QUERY_ARCHIVE` | Searchable by charity name / focus area; sortable newest/oldest |
    | `/charities` | `QUERY_ALL_CHARITIES` | Alphabetical list (filtering deferred to v2) |
    | `/charities/[slug]` | `QUERY_CHARITY_BY_SLUG` | Schema.org/NGO JSON-LD; external links carry `rel="noopener noreferrer"` |
    | `/about` | static | Placeholder copy until Andrew supplies the real /about content |
    | `/shop` | `groq` inline | Phase 2 shell; Phase 8 wires Stripe Checkout |
    | `/sitemap.xml` | dynamic (`app/sitemap.ts`) | Lists static pages + all published issues + all charities |
    | `/feed.xml` | dynamic Route Handler | RSS 2.0; link only (no full content — site is destination) |
    | `/robots.txt` | static | Allows `/`, disallows `/api/` and `/_next/` |

    ---

    ## Prerequisites

    - Node `>=18.18.0`, pnpm `9.x` (matches root `package.json`)
    - Live Sanity project (Phase 1 used `6h1vd9mf`)
    - Optional: a write-scoped `SANITY_API_TOKEN` in `apps/studio/.env.local` if you want to seed demo content

    ---

    ## Setup

    From the **repo root**:

    ```bash
    # 1. Install dependencies (resolves the workspace including apps/web).
    pnpm install

    # 2. Configure web env (the demo dataset is public, so no token needed on this side).
    cp apps/web/.env.example apps/web/.env.local
    # Edit apps/web/.env.local — defaults are correct for the production dataset.

    # 3. (Optional) Seed demo content so /issue/issue-1 renders against real data.
    #    Requires apps/studio/.env.local with SANITY_API_TOKEN already populated.
    pnpm seed:demo

    # 4. Start the dev server.
    pnpm dev:web
    # → http://localhost:3000
    ```

    The demo seed creates one charity (`The Quiet Foundation`) and one published issue (`issue-1`).
    It is idempotent — re-running `pnpm seed:demo` won't duplicate documents.

    ---

    ## Scripts

    All scripts are exposed from the repo root via `pnpm <name>`:

    | Script | Effect |
    |---|---|
    | `dev:web` | Run `next dev` on port 3000 |
    | `build:web` | Production build (`next build`) |
    | `lint:web` | `next lint` |
    | `typecheck:web` | `tsc --noEmit` against `apps/web` |
    | `seed:demo` | Idempotent demo charity + issue seed |
    | `typegen` | Phase 1: regenerate `apps/studio/sanity.types.ts` from schemas |

    ---

    ## Architecture notes

    ### Sanity reader

    - All GROQ queries live at [`apps/web/lib/sanity/queries.ts`](./lib/sanity/queries.ts). They are byte-for-byte aligned with [`docs/API_CONTRACTS.md §1`](../../docs/API_CONTRACTS.md). **Do not modify field names** without updating both files together.
    - Two clients: `sanityClient` (CDN-on, runtime reads) and `sanityBuildClient` (CDN-off, used by Phase 6's Publisher webhook). Both in [`apps/web/lib/sanity/client.ts`](./lib/sanity/client.ts).

    ### Theme engine (security-critical)

    - [`apps/web/lib/theme.ts`](./lib/theme.ts) is the single point where Sanity-supplied colors and fonts become CSS variables. Every value passes a strict hex regex `/^#[0-9a-fA-F]{6}$/` and a font whitelist before injection. Low-contrast pairs (WCAG AA < 4.5:1) fall back to the brand defaults.
    - Theme injection runs in TWO layers per CONTEXT.md D-10/D-11:
      - **Server-side (FOUC prevention):** `serializeThemeCss()` produces an inline `<style>` block in `/issue/[slug]/layout.tsx` for first paint.
      - **Client-side (defense-in-depth):** `<ThemeApplier>` runs `applyTheme(document.documentElement, theme)` inside `useEffect` on hydration so any post-mount mutation that bypasses the inline style is re-validated.
    - Smoke tests live at [`apps/web/lib/theme.test.ts`](./lib/theme.test.ts).
    - Phase 5's DesignAgent will produce real per-issue themes against this engine. Phase 2 ships a 6-font whitelist that Phase 5 extends after Andrew/designer approval.

    ### Routes

    - All routes are Server Components by default. Client components (`AnchorCopyButton`, `ArchiveList`, `ThemeApplier`, `error.tsx`) declare `'use client'` at the top.
    - `/issue/[slug]` uses `generateStaticParams()` against `QUERY_ARCHIVE` so every published issue is statically generated at build time. ISR with `revalidate = 60` keeps content fresh.
    - SEO: `generateMetadata()` per page emits OG + Twitter cards. `<JsonLd>` server component emits `schema.org/Article` (issue pages) and `schema.org/NGO` (charity pages).

    ### Print stylesheet

    - Defined in [`apps/web/app/globals.css`](./app/globals.css) under `@media print`.
    - Hides chrome (header, footer, shop callout, anchor buttons, game/deliberation/podcast slots) via `data-*` attribute selectors.
    - Forces black-on-white serif output.

    ---

    ## Deploying to Vercel

    Phase 2 ships the code; provisioning is Andrew's manual step.

    ```bash
    # From repo root:
    cd apps/web
    npx vercel link        # link this workspace to a Vercel project (one-time)
    npx vercel             # deploy preview
    npx vercel --prod      # production deploy
    ```

    In the Vercel project settings, set:

    - `NEXT_PUBLIC_SANITY_PROJECT_ID = 6h1vd9mf`
    - `NEXT_PUBLIC_SANITY_DATASET = production`
    - `NEXT_PUBLIC_SITE_URL = https://eisenbalm.com` (or your chosen domain)

    No write tokens needed on the web side. Phase 8 will add Stripe env vars to this list.

    ---

    ## Troubleshooting

    - **`Module not found: @sanity/client` after install** — make sure you ran `pnpm install` from the repo root, not from `apps/web/`. Workspaces require the root install.
    - **Theme variables aren't applying on `/issue/[slug]`** — check the page source; look for the inline `<style>:root{ ... }</style>` block emitted by the issue layout. If it's there but values are the brand defaults, the issue's `theme.*Color` fields probably contain a value that failed hex validation. The console will log a `[theme]` warning.
    - **`/sitemap.xml` returns 500** — usually means Sanity reads are timing out. Confirm `NEXT_PUBLIC_SANITY_PROJECT_ID` is set correctly in `.env.local`.
    - **OG image 404** — confirm `apps/web/public/og-default.png` exists. Plan 02-10 ships a placeholder; replace with real artwork at the same path.

    ---

    *Phase 2 owner: gsd-planner.*
    *Next phase (Phase 3): Convex deployment + functions.*
    ```

    Replace the entire Phase 1 placeholder content. Mirror the tone Andrew is used to from `apps/studio/README.md`.
  </action>
  <verify>
    <automated>
      cd /Users/user/Desktop/Eisenbalm && \
      test -f apps/web/README.md && \
      [ $(wc -l < apps/web/README.md) -gt 100 ] && \
      grep -q "## Routes" apps/web/README.md && \
      grep -q "## Setup" apps/web/README.md && \
      grep -q "## Scripts" apps/web/README.md && \
      grep -q "## Architecture notes" apps/web/README.md && \
      grep -q "## Deploying to Vercel" apps/web/README.md && \
      grep -q "## Troubleshooting" apps/web/README.md && \
      grep -q "pnpm seed:demo" apps/web/README.md && \
      grep -q "vercel link" apps/web/README.md && \
      grep -q "NEXT_PUBLIC_SANITY_PROJECT_ID" apps/web/README.md && \
      grep -q "NEXT_PUBLIC_SITE_URL" apps/web/README.md && \
      grep -q "lib/theme.ts" apps/web/README.md && \
      grep -q "ThemeApplier" apps/web/README.md
    </automated>
  </verify>
  <done>
    apps/web/README.md replaces the Phase 1 placeholder with a real onboarding doc. Sections: status, routes table, prerequisites, setup, scripts, architecture notes (Sanity reader, theme engine with two-layer injection note, routes, print), Vercel deploy, troubleshooting. Length > 100 lines.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew runs end-to-end smoke test of all WEB-* success criteria</name>
  <read_first>
    - apps/web/README.md (the doc just written in Task 1)
    - .planning/REQUIREMENTS.md (WEB-01 through WEB-16)
    - .planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md (Security Contract — for the theme-injection negative tests)
  </read_first>
  <files>.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md</files>
  <action>
    **What was built (executor restates so Andrew has full context):**

    Phase 2 ships:
    - apps/web Next.js 15 workspace (Plan 02-01)
    - Sanity reader plumbing (Plan 02-02)
    - Theme engine with hex/font/WCAG validation (Plan 02-03)
    - Demo content seed (Plan 02-04)
    - Root layout + globals + fonts + print stylesheet + JSON-LD primitive + reading-time helper + shadcn button/tooltip primitives (Plan 02-05)
    - Issue route with 10 sections + theme injection (server + client ThemeApplier) + JSON-LD Article + shadcn Tooltip on AnchorCopyButton (Plan 02-06)
    - Archive route with client-side search + sort (Plan 02-07)
    - Charities list + detail with JSON-LD NGO (Plan 02-08)
    - Homepage redirect + About + Shop shell (shadcn Button) (Plan 02-09)
    - Sitemap + RSS + robots + OG default image (Plan 02-10)

    **Action: Andrew runs the smoke test and writes the result to** `.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md`.

    **Setup** (Andrew, ~2 minutes):

    1. Pull `master`. From repo root: `pnpm install`.
    2. Confirm `apps/web/.env.local` exists (copy from `.env.example` if not).
    3. Confirm demo content is seeded: `pnpm seed:demo`. Expect "Seeded 2/2".
    4. Run `pnpm dev:web`. Confirm dev server boots at `http://localhost:3000` without errors.

    **Verification checklist** (Andrew, ~10 minutes):

    Open the listed URLs in a browser. For each item, mark PASS or FAIL with a one-line note in `02-11-SMOKE-TEST.md`.

    | # | Requirement | URL / Action | Expected |
    |---|---|---|---|
    | 1 | WEB-01 | `/` | 307 redirect to `/issue/issue-1` (dev seed). View `view-source:` on the destination — should show full issue HTML. |
    | 2 | WEB-02 | `/issue/issue-1` | Sections in order: hero, origin-story, problem, founder-bio, case-study, game, bonus, deliberation, podcast, shop-callout. Use `Ctrl+F` to find `id="origin-story"`, `id="problem"`, `id="founder-bio"`, `id="case-study"`, `id="game"`, `id="bonus"`, `id="deliberation"`, `id="podcast"` — all eight present. |
    | 3 | WEB-03 | `/archive` | One row visible (The Quiet Foundation). Type "quiet" — row stays visible. Type "asdf" — see "No issues match that search." Toggle sort buttons — no console errors. |
    | 4 | WEB-04 | `/charities` then `/charities/the-quiet-foundation` | List shows one charity; detail page shows name, location, mission, scout notes, external links. |
    | 5 | WEB-05 | `/about` | Page renders with placeholder copy "The Eisenbalm Dispatch publishes weekly. This page is being written." |
    | 6 | WEB-06 | `/issue/issue-1`, inspect `<head>` | Find inline `<style>` with `:root { --color-bg: #F5EEDC; --color-text: #1A1A18; --color-primary: #14213D; --color-accent: #FCA311; --font-display: 'DM Serif Display', serif; --font-body: 'Merriweather', serif; }` (color/font order may vary). |
    | 7 | WEB-07 | Manual: in Sanity Studio (`pnpm dev:studio`), open the demo issue, change `theme.primaryColor` to `red` (literal string), Save. Refresh `/issue/issue-1`. | Primary color falls back to `#2D5016` (forest green from brand defaults). No crash. Console may show `[theme]` warning. Revert the field afterward. |
    | 8 | WEB-08 | View source of `/issue/issue-1` AND test client-side defense-in-depth | (a) Page source has the `<style>` tag built by `serializeThemeCss` — that's the only inline theme CSS in `<head>` (no template-literal CSS strings, no `style="..."` attribute on `<html>` containing theme values). (b) Open DevTools console on the loaded page and run `document.documentElement.style.setProperty('--color-primary', 'red')` — within one tick the `<ThemeApplier>` `useEffect` should NOT re-run (it only fires on theme prop change), so to force re-validation, navigate to a different page and back, OR reload. After reload, confirm `--color-primary` is the valid theme hex (not `red`). EXTRA: temporarily mutate the rendered `<style>` content via DevTools to inject an invalid hex; reload — `<ThemeApplier>` runs on mount and reapplies validated values via `element.style.setProperty`. A `[theme]` console warning should log when an invalid value was rejected. |
    | 9 | WEB-09 | In Sanity Studio: set `theme.backgroundColor` to `#FFFFFF` and `theme.textColor` to `#CCCCCC` (contrast 1.6:1, fails AA). Save. Refresh page. | Background reverts to `#FAFAF8`, text reverts to `#1A1A18`. No page crash. Revert. |
    | 10 | WEB-10 | View source of `/issue/issue-1` | Find `<script type="application/ld+json">`. JSON includes `"@type":"Article"`, `"headline":"<origin story headline>"`, `"datePublished":"2026-06-05"`, `"author":{"@type":"Organization","name":"Jesse A. Eisenbalm"}`, and `"about":{"@type":"NGO","name":"The Quiet Foundation"...}`. |
    | 11 | WEB-11 | View source of `/issue/issue-1` AND `/archive` | Both have `<meta property="og:title">`, `<meta property="og:image">`, `<meta name="twitter:card" content="summary_large_image">`. |
    | 12 | WEB-12 | `/sitemap.xml` | Returns XML. Contains entries for `/`, `/archive`, `/charities`, `/about`, `/shop`, `/issue/issue-1`, `/charities/the-quiet-foundation`. |
    | 13 | WEB-13 | `/feed.xml` | Returns RSS 2.0 XML. Channel title is "The Eisenbalm Dispatch". One `<item>` with title "The Quiet Foundation — Issue 1". Try opening in [NetNewsWire](https://netnewswire.com) — the feed should parse. |
    | 14 | WEB-14 | On `/issue/issue-1`, browser `Cmd+P` / `Ctrl+P` to open print preview | Header, footer, anchor buttons, game/deliberation/podcast slots, and shop callout are hidden. Theme background is white. Body text is black serif. |
    | 15 | WEB-15 | `/issue/issue-1` | Reading time visible in the hero metadata row: "{N} min read" (single-digit number for the demo seed; not 0). |
    | 16 | WEB-16 | On `/issue/issue-1`, click the link icon next to any section label | shadcn `<Tooltip>` shows "Copied" microtext briefly (1500ms). Paste into the address bar — URL ends with `#origin-story` (or whichever section). |

    **Extras** (not WEB-* but UI-SPEC):

    - Confirm `/not-found` (visit any garbage URL) renders "This page does not exist."
    - Confirm the shop callout at the bottom of `/issue/issue-1` says "Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's featured charity." and the button (shadcn `<Button asChild>`) reads "Buy the lip balm" linking to `/shop`.
    - Confirm `/shop` shows the charity callout: "This week's proceeds benefit The Quiet Foundation." and the disabled shadcn `<Button>` reads "Coming soon".

    **Reporting** (Andrew):

    Write `.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md` with the table above filled in PASS/FAIL plus one-line notes per row. Any FAIL becomes a follow-up plan or `--gaps` cycle.

    Resume signal: Type "approved" if all 16 WEB-* items pass plus the three extras. Otherwise list the failures.
  </action>
  <verify>
    <automated>
      test -f /Users/user/Desktop/Eisenbalm/.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md && \
      grep -q "WEB-01" /Users/user/Desktop/Eisenbalm/.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md && \
      grep -q "WEB-16" /Users/user/Desktop/Eisenbalm/.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md && \
      grep -qE "(PASS|FAIL)" /Users/user/Desktop/Eisenbalm/.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md
    </automated>
  </verify>
  <done>
    `.planning/phases/02-web-shell-theme-engine/02-11-SMOKE-TEST.md` exists with one PASS/FAIL line per WEB-* requirement (16 rows minimum). WEB-08 row specifically verifies BOTH the server-rendered `<style>` tag AND the client-side `<ThemeApplier>` defense-in-depth path (devtools tampering re-validation). Andrew has resumed with "approved" (all 16 PASS) OR has listed failures that trigger a gap closure cycle before phase close.
  </done>
</task>

</tasks>

<verification>
- apps/web/README.md replaces placeholder (>100 lines, sections present, mentions ThemeApplier two-layer injection)
- Andrew completes the 16-item smoke test; SMOKE-TEST.md is committed
- WEB-08 smoke step verifies both server and client theme injection paths
- Any FAIL items either trigger a gap closure plan or a one-line Edit in this phase before approval
</verification>

<success_criteria>
- Every WEB-* requirement empirically verified by Andrew via the smoke test
- apps/web/README.md is the single source of truth for getting a new developer running
- Vercel deploy steps documented (manual, per D-27)
- Phase 2 marked complete in STATE.md only after Andrew's "approved" signal
</success_criteria>

<output>
After Andrew's approval, create:
- `.planning/phases/02-web-shell-theme-engine/02-11-readme-and-smoke-test-SUMMARY.md` recording: README sections, smoke test results table (mirroring or referencing 02-11-SMOKE-TEST.md), and any deviations or follow-ups Andrew flagged.
- Update `.planning/STATE.md` to mark Phase 2 complete (move "Current focus" forward; flip ROADMAP.md Phase 2 from `[ ]` to `[x]`).

If Andrew reports ANY failures: do NOT mark the phase complete. Instead, file the failure list as the basis for either a Phase 2 gap closure or follow-up plan, and report back.
</output>
