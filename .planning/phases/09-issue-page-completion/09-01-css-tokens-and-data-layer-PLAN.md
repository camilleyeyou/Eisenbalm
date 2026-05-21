---
phase: 09-issue-page-completion
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/globals.css
  - apps/web/lib/sanity/queries.ts
  - apps/web/lib/sanity/types.ts
  - apps/web/app/issue/[slug]/page.tsx
autonomous: true
requirements: [DEL-01, DEL-02, DEL-06]
must_haves:
  truths:
    - "The :root default palette is the dark house palette; issue pages still override via serializeThemeCss injection"
    - "All new house tokens for secondary text/identity/lines exist as CSS variables, derived via color-mix where the spec requires"
    - "QUERY_AGENT_PROFILES exists in queries.ts and AgentProfile type exists in types.ts"
    - "page.tsx passes runId to DeliberationSlot"
    - "Print stylesheet hides the new dark-chrome surfaces; theme.ts is unmodified"
  artifacts:
    - path: "apps/web/app/globals.css"
      provides: "Dark house palette :root + new tokens + print hide-list extension"
      contains: "--color-text-dim"
    - path: "apps/web/lib/sanity/queries.ts"
      provides: "QUERY_AGENT_PROFILES GROQ query"
      contains: "QUERY_AGENT_PROFILES"
    - path: "apps/web/lib/sanity/types.ts"
      provides: "AgentProfile type"
      contains: "export type AgentProfile"
    - path: "apps/web/app/issue/[slug]/page.tsx"
      provides: "runId prop wiring to DeliberationSlot"
      contains: "DeliberationSlot runId"
  key_links:
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "apps/web/components/issue/DeliberationSlot.tsx"
      via: "runId prop"
      pattern: "<DeliberationSlot runId="
    - from: "apps/web/lib/sanity/queries.ts"
      to: "agentProfile documents in Sanity"
      via: "GROQ query"
      pattern: "_type == \"agentProfile\""
---

<objective>
Lay the non-visual foundation every Phase 9 feature plan depends on: (1) replace the light `:root` defaults in globals.css with the dark HYBRID house palette and add the new secondary/identity/line tokens; (2) extend the print hide-list to the new dark chrome; (3) add `QUERY_AGENT_PROFILES` to queries.ts and the `AgentProfile` type to types.ts; (4) pass `runId` to DeliberationSlot in page.tsx.

This plan touches NO Convex render logic and NO theme.ts security contract. It is the data-layer + token-foundation slice. Plans 09-02..09-05 build on it.

Purpose: Unblock the parallel Wave 2 plans (deliberation rewrite, podcast+route, atmosphere/nav, component restyle) by giving them the tokens, the GROQ query, the type, and the prop wiring they all need.
Output: globals.css dark house palette + print extension; QUERY_AGENT_PROFILES; AgentProfile type; runId prop on DeliberationSlot.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-issue-page-completion/09-UI-SPEC.md
@.planning/phases/09-issue-page-completion/09-RESEARCH.md

<interfaces>
<!-- theme.ts (apps/web/lib/theme.ts) is the security contract — DO NOT MODIFY it.
     serializeThemeCss writes a :root { ... } block that overrides:
       --color-bg, --color-text, --color-primary, --color-accent,
       --font-display, --font-body
     The globals.css :root provides DEFAULTS for those + everything else.
     Issue pages inline that override AFTER globals.css loads (in
     app/issue/[slug]/layout.tsx via <style dangerouslySetInnerHTML>),
     so the override wins on issue pages. -->

API_CONTRACTS §1.6 — QUERY_AGENT_PROFILES (canonical projection):
```groq
*[_type == "agentProfile"] {
  "agentId": agentId.current,
  displayName,
  role,
  personality,
  "avatarUrl": avatar.asset->url,
}
```

AgentProfile type (research §Code Examples, matches the projection):
```typescript
export type AgentProfile = {
  agentId: string         // agentId.current (slug.current string)
  displayName: string
  role: string
  personality: string | null
  avatarUrl: string | null
}
```

page.tsx current line (~232): `<DeliberationSlot />`  → change to `<DeliberationSlot runId={issue.runId ?? null} />`
(issue.runId is already typed `string | null` on the Issue type and projected by QUERY_ISSUE_BY_SLUG.)

Existing globals.css :root has light defaults (#FAFAF8 bg / #1A1A18 text / #2D5016 primary / #8B1A1A accent) plus a prefers-color-scheme dark block and a shadcn shim :root. Phase 10 typography utilities and the reduced-motion guard live below — KEEP them.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace :root with the dark HYBRID house palette and extend the print hide-list</name>
  <read_first>
    - apps/web/app/globals.css (the file being edited — note the :root block at lines 32-48, the prefers-color-scheme dark block 55-61, the shadcn shim :root 144-155, the @media print block 96-141, the reduced-motion guard 272-281, and the Phase 10 utilities 157-260)
    - apps/web/lib/theme.ts (READ ONLY — confirm serializeThemeCss overrides --color-bg/--color-text/--color-primary/--color-accent/--font-display/--font-body; do NOT modify this file)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§HYBRID Theme Model token re-expression table; §Color WCAG AA gate; §Print/PDF)
    - .planning/phases/09-issue-page-completion/09-RESEARCH.md (§CSS token foundation; §Print stylesheet extension)
  </read_first>
  <files>apps/web/app/globals.css</files>
  <action>
Edit the `:root` block in globals.css (the one at ~lines 32-48). Replace the four light brand-default values and add the new house tokens. Use these EXACT values (from 09-UI-SPEC §Token re-expression, with the AA-corrected text-mute):

```css
:root {
  /* Dark HYBRID house defaults (Phase 9). Issue pages override
     --color-bg, --color-text, --color-primary, --color-accent,
     --font-display, --font-body via serializeThemeCss injection. */
  --color-bg: #0C0B0A;
  --color-text: #F0EAD9;
  --color-primary: #CDA434;
  --color-accent: #C2502A;

  /* House surfaces (fixed; the dark structure is the house style) */
  --color-surface: #14110D;
  --color-card: #1A1611;
  --color-card-hover: #221D16;

  /* Secondary text tones — AA-verified on the dark bg (see theme-aa-tones.test.ts) */
  --color-text-dim: #A89F8A;        /* 7.5:1 — AA at all sizes */
  --color-text-mute: #938A77;       /* 5.8:1 — AA. NOT the mockup's #615B4D (2.9:1, fails) */

  /* Accent-layer derivations (track per-issue --color-primary/--color-accent) */
  --color-primary-bright: color-mix(in srgb, var(--color-primary) 78%, white 22%);
  --color-primary-glow: color-mix(in srgb, var(--color-primary) 40%, transparent);

  /* Agent identity colors — HOUSE, never themed */
  --color-scout: #8A9B7A;           /* 6.6:1 */
  --color-advocate: #6E92B8;        /* 6.1:1 */

  /* Hairlines / borders (track --color-text) */
  --color-line: color-mix(in srgb, var(--color-text) 8%, transparent);
  --color-line-strong: color-mix(in srgb, var(--color-text) 16%, transparent);

  /* Existing derived tokens — keep, but re-point --color-surface is now fixed above.
     --color-text-muted and --color-border remain as before for back-compat. */
  --color-text-muted: var(--color-text-mute);
  --color-border: var(--color-line);

  /* Fonts — pending-font fallbacks. --font-ui stays LOCKED (Inter). */
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'Lora', Georgia, serif;
  --font-ui: 'Inter', system-ui, sans-serif;
}
```

Notes:
- `--color-display` was previously `'Playfair Display'`; change the house default to `'Cormorant Garamond'` (it is already whitelisted in theme.ts). Body stays Lora (whitelisted fallback for the PENDING Spectral). UI stays Inter (LOCKED; PENDING IBM Plex Mono not added).
- KEEP `--color-surface` references working: the old `--color-surface` was a color-mix; now it is the fixed `#14110D`. KEEP `--color-text-muted` and `--color-border` aliases so existing components that reference them still resolve (re-point them to the new tokens as shown).
- DELETE the `@media (prefers-color-scheme: dark)` block (the one at ~lines 55-61) — the house default is now dark, so a light-to-dark media flip is wrong and would fight theme injection. Add a one-line comment in its place: `/* Phase 9: house default is dark; no prefers-color-scheme flip (issue themes override via injection). */`
- Do NOT touch the shadcn shim `:root` (lines ~144-155) except confirm it still references `var(--color-bg)` etc. (it does — leave as is).

Then extend the existing `@media print` block (the one at ~lines 96-141). Add the new dark-chrome surfaces to the hide-list selector group (the block that already lists `[data-site-header]`, `[data-game-slot]`, etc.). Append these class selectors to that comma-separated `display: none !important` group:
```
  .aurora,
  .bg-grid,
  .grain,
  .progress,
  .site-nav,
  .section-navigator,
  .agent-chip,
  .confidence-meter,
  .audio-player,
```
This guarantees the dark atmosphere + deliberation chrome is screen-only and the print path stays black-on-white serif (the existing `html, body { background: white !important; color: black !important; }` rules are unchanged). The deliberation transcript and article prose remain printable.

DO NOT modify the Phase 10 typography utilities (.prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block) or the reduced-motion guard at the bottom — they are reused by Wave 2 plans.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "#0C0B0A" apps/web/app/globals.css` >= 1 (dark bg default present)
    - `grep -c -- "--color-text-dim" apps/web/app/globals.css` >= 1 and `grep -c -- "--color-text-mute" apps/web/app/globals.css` >= 1
    - `grep -- "#938A77" apps/web/app/globals.css` matches (AA-corrected mute) AND `grep -- "#615B4D" apps/web/app/globals.css` returns NOTHING (rejected value absent)
    - `grep -c -- "--color-scout" apps/web/app/globals.css` >= 1 and `grep -c -- "--color-advocate" apps/web/app/globals.css` >= 1
    - `grep -c -- "--color-line" apps/web/app/globals.css` >= 1
    - `grep "prefers-color-scheme" apps/web/app/globals.css` returns NOTHING (dark flip removed)
    - `grep -c "\.section-navigator" apps/web/app/globals.css` >= 1 (print hide-list extended) and the additions are inside the `@media print` block
    - `git diff --stat apps/web/lib/theme.ts` shows NO changes (theme.ts untouched)
    - `cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts` exits 0
    - `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` exits 0
  </acceptance_criteria>
  <done>globals.css :root is the dark house palette with all new tokens; print hide-list covers the new dark chrome; theme.ts is unmodified; AA-tone test green.</done>
</task>

<task type="auto">
  <name>Task 2: Add QUERY_AGENT_PROFILES, AgentProfile type, and wire runId into DeliberationSlot</name>
  <read_first>
    - apps/web/lib/sanity/queries.ts (the file being edited — note §1.7 QUERY_ISSUE_RUN_ID is the most recent addition; append after it; the file header says "DO NOT modify field names" — this is an ADDITION, not a modification)
    - apps/web/lib/sanity/types.ts (the file being edited — note IssueRunId is the last export; append AgentProfile after it)
    - apps/web/app/issue/[slug]/page.tsx (the line `<DeliberationSlot />` at ~232; issue.runId is already available)
    - docs/API_CONTRACTS.md §1.6 (canonical QUERY_AGENT_PROFILES projection)
    - apps/studio/schemas/agentProfile.ts (confirms agentId is a slug → .current is the string; avatar is type 'image')
  </read_first>
  <files>apps/web/lib/sanity/queries.ts, apps/web/lib/sanity/types.ts, apps/web/app/issue/[slug]/page.tsx</files>
  <action>
1. In `apps/web/lib/sanity/queries.ts`, append a new exported query AFTER `QUERY_ISSUE_RUN_ID` (this is the §1.6 contract — an addition, not a field-name change):
```typescript
/**
 * §1.6 — Agent profiles for the deliberation layer (DEL-02, DEL-06).
 * Called once per issue page render; the named personas (NEVER model names)
 * back the agent identity cards. Ordered for stable rendering.
 */
export const QUERY_AGENT_PROFILES = groq`
  *[_type == "agentProfile"] | order(agentId.current asc) {
    "agentId": agentId.current,
    displayName,
    role,
    personality,
    "avatarUrl": avatar.asset->url
  }
`
```

2. In `apps/web/lib/sanity/types.ts`, append AFTER the `IssueRunId` export:
```typescript
// ─── §1.6 — Agent profiles (deliberation layer, Phase 9) ───────────────────

export type AgentProfile = {
  agentId: string         // agentId.current from the Sanity slug
  displayName: string
  role: string
  personality: string | null
  avatarUrl: string | null
}
```

3. In `apps/web/app/issue/[slug]/page.tsx`, change the deliberation slot mount from `<DeliberationSlot />` to:
```tsx
<DeliberationSlot runId={issue.runId ?? null} />
```
Do NOT change anything else in page.tsx in this task (Plan 09-04 mounts Atmosphere + SectionNavigator separately; that is its file ownership). Leave the existing imports as-is.

NOTE on type compatibility: DeliberationSlot.tsx is currently a no-prop stub (`export function DeliberationSlot()`). After this edit, page.tsx will pass a `runId` prop that the stub does not declare. TypeScript's excess-property check applies to object literals on JSX too, so this WILL produce a type error until Plan 09-02 rewrites DeliberationSlot to accept `{ runId: string | null }`. That is intentional and expected — Plan 09-02 (Wave 2) closes it. The Vitest unit suite (environment 'node', source-scan only, no tsc) is unaffected and stays green. Do NOT add `// @ts-expect-error` or weaken types to paper over it; the dependency ordering (09-01 → 09-02) resolves it cleanly.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "QUERY_AGENT_PROFILES" apps/web/lib/sanity/queries.ts` >= 1 and the query body contains `_type == "agentProfile"` and `"agentId": agentId.current`
    - `grep -c "export type AgentProfile" apps/web/lib/sanity/types.ts` == 1 and the type contains `agentId: string`, `displayName: string`, `role: string`, `personality: string | null`, `avatarUrl: string | null`
    - `grep -c "<DeliberationSlot runId=" apps/web/app/issue/[slug]/page.tsx` == 1
    - `grep -c "<DeliberationSlot />" apps/web/app/issue/[slug]/page.tsx` == 0 (old propless mount removed)
    - `cd apps/web && npm run test:unit` exits 0 (full unit suite; source-scan tests unaffected by the pending tsc prop mismatch)
  </acceptance_criteria>
  <done>QUERY_AGENT_PROFILES and AgentProfile exist; page.tsx passes runId to DeliberationSlot; the unit suite is green.</done>
</task>

</tasks>

<verification>
- globals.css `:root` is the dark house palette; no `prefers-color-scheme` block; print hide-list extended; theme.ts unmodified (`git diff --stat apps/web/lib/theme.ts` empty).
- QUERY_AGENT_PROFILES present in queries.ts; AgentProfile present in types.ts.
- page.tsx passes `runId={issue.runId ?? null}` to DeliberationSlot.
- `cd apps/web && npm run test:unit` green; theme-aa-tones and game-sandbox green.
</verification>

<success_criteria>
- The dark HYBRID house palette is the default; per-issue theme injection still wins on issue pages (override variables unchanged in theme.ts).
- All new tokens the Wave 2 plans reference exist.
- Data-layer query + type + prop wiring complete.
</success_criteria>

<output>
After completion, create `.planning/phases/09-issue-page-completion/09-01-SUMMARY.md`.
</output>
