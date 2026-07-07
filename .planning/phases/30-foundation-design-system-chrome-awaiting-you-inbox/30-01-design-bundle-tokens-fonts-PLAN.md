---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/design/dispatch-control-v2/
  - apps/dispatch-control/app/globals.css
  - apps/dispatch-control/app/layout.tsx
  - apps/dispatch-control/__tests__/design-tokens.test.ts
autonomous: true
requirements: [CHR-01]
must_haves:
  truths:
    - "The 7-file design handoff bundle is readable in-repo at docs/design/dispatch-control-v2/"
    - "The 1c color tokens and 4 fonts are defined as CSS variables the whole console can reference"
    - "The Phase 24 CodeMirror variable-highlight styles still work after the retheme"
  artifacts:
    - path: "docs/design/dispatch-control-v2/Dispatch Control.dc.html"
      provides: "Binding 1c visual spec, in-repo for phases 30-39"
    - path: "apps/dispatch-control/app/globals.css"
      provides: "1c @theme token block + preserved .cm-prompt-editor rules + hard edges"
      contains: "--color-ink: #17140e"
    - path: "apps/dispatch-control/app/layout.tsx"
      provides: "4 next/font/google loaders as CSS variables on <body>"
      contains: "Space_Grotesk"
  key_links:
    - from: "apps/dispatch-control/app/layout.tsx"
      to: "apps/dispatch-control/app/globals.css"
      via: "font CSS variables (--font-space-grotesk etc.) referenced in @theme"
      pattern: "var\\(--font-"
---

<objective>
Lay the CHR-01 foundation: commit the binding design handoff bundle into the repo (D-12, an early task every downstream phase depends on), then wire the 1c design tokens and the four Google fonts as CSS variables the entire `apps/dispatch-control` console can consume.

Purpose: This is the substrate the chrome, nav, masthead, inbox, and per-screen token swaps all build on. Nothing visual in Phase 30 works without it.
Output: In-repo design bundle; `globals.css` with the full 1c `@theme` token block (hard-edged, `.cm-prompt-editor` preserved); `layout.tsx` loading Newsreader / Lora / Space Grotesk / IBM Plex Mono via `next/font/google`; a source-scan test locking the tokens and fonts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-CONTEXT.md
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@apps/dispatch-control/app/globals.css
@apps/dispatch-control/app/layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit the design handoff bundle into the repo (D-12)</name>
  <read_first>
    - .planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-CONTEXT.md (D-12 + canonical_refs)
  </read_first>
  <files>docs/design/dispatch-control-v2/ (7 files)</files>
  <action>
    Create the directory `docs/design/dispatch-control-v2/` and copy ALL 7 files from the source location `~/Downloads/design_handoff_dispatch_control/` into it, preserving filenames exactly:
    - `Dispatch Control.dc.html` (the committed 1c visual spec — 82KB)
    - `Dispatch Control - Audit.dc.html`
    - `Dispatch Control - Review Desk Directions.dc.html`
    - `DECISIONS.md`
    - `README.md`
    - `4 - Design Brief - Dispatch Control v2.md`
    - `4 - Wireframe - Dispatch Control v2.html`
    Use `cp` with the exact source paths (filenames contain spaces — quote them). Do NOT rename, reformat, or edit the files — commit them verbatim so downstream phases (30-39) read the binding spec.
  </action>
  <verify>
    <automated>test $(ls "docs/design/dispatch-control-v2/" | wc -l) -eq 7 && test -f "docs/design/dispatch-control-v2/Dispatch Control.dc.html"</automated>
  </verify>
  <acceptance_criteria>
    - `ls docs/design/dispatch-control-v2/ | wc -l` outputs `7`
    - `docs/design/dispatch-control-v2/Dispatch Control.dc.html` exists and is non-empty
    - `docs/design/dispatch-control-v2/DECISIONS.md` and `README.md` both exist
    - `grep -c "disp_howto" "docs/design/dispatch-control-v2/Dispatch Control.dc.html"` returns ≥1 (the How-to-use source content Plan 30-07 will draw from is present)
  </acceptance_criteria>
  <done>All 7 handoff files are committed under docs/design/dispatch-control-v2/ with original names.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: 1c token block in globals.css (hard-edged, cm-prompt-editor preserved)</name>
  <read_first>
    - apps/dispatch-control/app/globals.css (current shadcn shim + Phase 24 .cm-prompt-editor rules)
    - .planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md (Pattern 1 exact token values)
  </read_first>
  <files>apps/dispatch-control/app/globals.css, apps/dispatch-control/__tests__/design-tokens.test.ts</files>
  <behavior>
    - design-tokens.test.ts reads globals.css and asserts every 1c token literal is present (--color-ink: #17140e, --color-cobalt: #253ad4, --color-vermilion: #e8471d, --color-marigold: #f2b01e, --color-green: #148a52)
    - Asserts --radius is 0 (hard edges) — grep `--radius: 0`
    - Asserts the Phase 24 .cm-prompt-editor .cm-var-known / .cm-var-unknown rules still exist
    - design-tokens.test.ts reads layout.tsx and asserts all 4 next/font imports present (Task 3 makes this green)
  </behavior>
  <action>
    Add a Tailwind v4 `@theme` block to `globals.css` (after `@import "tailwindcss"`) declaring the 1c tokens VERBATIM from RESEARCH Pattern 1:
    ```css
    @theme {
      --font-display: var(--font-newsreader), serif;
      --font-body: var(--font-lora), Georgia, serif;
      --font-ui: var(--font-space-grotesk), sans-serif;
      --font-mono: var(--font-ibm-plex-mono), monospace;
      --color-ink: #17140e;
      --color-ink-soft: #55514a;
      --color-faint: #8b8778;
      --color-paper: #e9eaec;
      --color-nav: #e3e5e8;
      --color-rail: #f1f0ea;
      --color-card: #ffffff;
      --color-card-alt: #fbfaf6;
      --color-cobalt: #253ad4;
      --color-cobalt-dark: #1b2ba6;
      --color-vermilion: #e8471d;
      --color-marigold: #f2b01e;
      --color-marigold-text: #9a6f04;
      --color-green: #148a52;
      --color-masthead-text: #f4f2ec;
      --color-masthead-muted: #c9c3b5;
    }
    ```
    In the existing `:root` shadcn shim, set `--radius: 0` (hard-edged anti-SaaS — was `0.5rem`) and remap the shadcn neutral vars to 1c equivalents so the one shadcn primitive (`switch.tsx`) reads 1c: `--background: #e9eaec; --foreground: #17140e; --card: #ffffff; --card-foreground: #17140e; --primary: #17140e; --primary-foreground: #f4f2ec; --border: rgba(20,20,26,0.13); --ring: #253ad4; --destructive: #e8471d;` (keep the remaining shadcn keys, remapped toward these values).
    PRESERVE the two `.cm-prompt-editor .cm-var-known` / `.cm-var-unknown` rule blocks BYTE-UNCHANGED (Phase 24 PRM-02 — Claude's Discretion note in CONTEXT).
    Author `__tests__/design-tokens.test.ts` per the behavior block (source-scan, read file contents with node:fs, no rendering).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run design-tokens</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "\-\-color-ink: #17140e" apps/dispatch-control/app/globals.css` succeeds
    - `grep -q "\-\-color-vermilion: #e8471d" apps/dispatch-control/app/globals.css` succeeds
    - `grep -q "\-\-radius: 0" apps/dispatch-control/app/globals.css` succeeds (no `0.5rem`)
    - `grep -q "cm-var-known" apps/dispatch-control/app/globals.css` succeeds (Phase 24 styles preserved)
    - The token-presence assertions in design-tokens.test.ts pass
  </acceptance_criteria>
  <done>globals.css carries the full 1c token block, hard edges, remapped shadcn vars, preserved cm-prompt-editor styles; design-tokens token assertions green.</done>
</task>

<task type="auto">
  <name>Task 3: Load the 4 fonts via next/font/google in layout.tsx</name>
  <read_first>
    - apps/dispatch-control/app/layout.tsx (current root layout — Server Component, do NOT add 'use client')
    - apps/web/app/layout.tsx (proven multi-font next/font/google precedent)
    - .planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md (Pattern 1 font config)
  </read_first>
  <files>apps/dispatch-control/app/layout.tsx</files>
  <action>
    Import and configure four `next/font/google` loaders VERBATIM from RESEARCH Pattern 1:
    - `Newsreader` → `variable: '--font-newsreader'`, `axes: ['opsz']`, `style: ['normal','italic']`, `subsets: ['latin']`, `display: 'swap'` (variable font — omit `weight`)
    - `Lora` → `variable: '--font-lora'`, `weight: ['400','500','600']`, `subsets: ['latin']`, `display: 'swap'`
    - `Space_Grotesk` → `variable: '--font-space-grotesk'`, `weight: ['400','500','600','700']`, `subsets: ['latin']`, `display: 'swap'`
    - `IBM_Plex_Mono` → `variable: '--font-ibm-plex-mono'`, `weight: ['400','500']`, `subsets: ['latin']`, `display: 'swap'`
    Apply all four `.variable` classes to `<body>`: `<body className={`${fontDisplay.variable} ${fontBody.variable} ${fontUi.variable} ${fontMono.variable}`}>`. Also set the body base font to the UI font (add `font-[family-name:var(--font-ui)]` or set `body { font-family: var(--font-ui) }` in globals.css) so the console defaults to Space Grotesk chrome type. Keep the ClerkProvider + ConvexClientProvider wrapping unchanged. Do NOT add `'use client'`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run design-tokens && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Space_Grotesk" apps/dispatch-control/app/layout.tsx` succeeds
    - `grep -q "IBM_Plex_Mono" apps/dispatch-control/app/layout.tsx` succeeds
    - `grep -q "Newsreader" apps/dispatch-control/app/layout.tsx` and `grep -q "Lora" apps/dispatch-control/app/layout.tsx` succeed
    - layout.tsx contains all four `.variable` interpolations on the `<body>` className
    - `pnpm --filter dispatch-control build` exits 0
    - design-tokens.test.ts fully green (token + font assertions)
  </acceptance_criteria>
  <done>All 4 fonts load via next/font/google with no CDN; body exposes the 4 font CSS variables; build green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run design-tokens` green
- `pnpm --filter dispatch-control build` exits 0
- Design bundle present (7 files) under docs/design/dispatch-control-v2/
</verification>

<success_criteria>
CHR-01 foundation: 1c tokens + 4 fonts defined as CSS variables; design bundle committed; Phase 24 editor styles intact; build clean.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-01-SUMMARY.md`
</output>
