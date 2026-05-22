---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: 03
type: execute
wave: 1
depends_on: [01]
files_modified:
  - apps/web/app/issue/[slug]/layout.tsx
  - apps/web/components/issue/ThemeApplier.tsx
autonomous: true
requirements: [MED-01, MED-02]
user_setup:
  - service: vercel
    why: "DESIGNAGENT_SUPPRESSED env var must be set in Vercel for the Next.js Server Component read (default v1 = true/suppressed). Must NOT be NEXT_PUBLIC_ prefixed."
    env_vars:
      - name: DESIGNAGENT_SUPPRESSED
        source: "Vercel dashboard → apps/web project → Settings → Environment Variables → add DESIGNAGENT_SUPPRESSED=true (NOT NEXT_PUBLIC_; server-only). Also add to apps/web/.env.local for local dev."

must_haves:
  truths:
    - "When DESIGNAGENT_SUPPRESSED=true, the issue page emits NO per-issue theme CSS override — the globals.css :root house palette wins on every issue"
    - "When suppressed, the inline <style> injects an empty string (NOT the light BRAND_DEFAULTS palette)"
    - "When suppressed, ThemeApplier.useEffect early-returns without calling applyTheme"
    - "When the flag is unset/false, per-issue theming behaves exactly as before (serializeThemeCss + applyTheme run)"
    - "theme.ts validation logic (validateHex/validateFont/WCAG/setProperty) is byte-unchanged"
  artifacts:
    - path: "apps/web/app/issue/[slug]/layout.tsx"
      provides: "server-side DESIGNAGENT_SUPPRESSED gate emitting empty themeCss when suppressed"
      contains: "DESIGNAGENT_SUPPRESSED"
    - path: "apps/web/components/issue/ThemeApplier.tsx"
      provides: "suppressed prop that early-returns from the applyTheme useEffect"
      contains: "suppressed"
  key_links:
    - from: "layout.tsx (Server Component)"
      to: "ThemeApplier (client)"
      via: "suppressed boolean prop (no NEXT_PUBLIC_, server-read process.env)"
      pattern: "suppressed"
---

<objective>
Implement the web half of the reversible suppression flag (MED-02 web) and lock the fixed Machine Editorial palette on the live site (MED-01). The issue layout is a Server Component that reads `process.env.DESIGNAGENT_SUPPRESSED` at request time (NOT `NEXT_PUBLIC_` — that would bake at build time). When suppressed, it emits an EMPTY CSS string for the inline `<style>` (NOT `serializeThemeCss(null)`, which emits the light BRAND_DEFAULTS palette — the documented pitfall) and passes `suppressed={true}` to `ThemeApplier`, which early-returns without calling `applyTheme`. The result: `globals.css :root` dark palette wins the cascade on every issue. theme.ts is READ-ONLY.

Purpose: Stop per-issue DesignAgent theme overrides from changing the live site's colors/fonts, reversibly, with no code change (flip env var + redeploy).
Output: layout.tsx gated on the flag; ThemeApplier with an optional `suppressed` prop.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-CONTEXT.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md

@apps/web/app/issue/[slug]/layout.tsx
@apps/web/components/issue/ThemeApplier.tsx

<interfaces>
<!-- theme.ts is READ-ONLY. These are the signatures the gate consumes. -->
From apps/web/lib/theme.ts:
```typescript
export function serializeThemeCss(theme: IssueTheme): string  // serializeThemeCss(null) emits the LIGHT BRAND_DEFAULTS palette — DO NOT call when suppressed
export function applyTheme(element: HTMLElement, theme: IssueTheme): void
export const BRAND_DEFAULTS  // light palette — must NOT be emitted as a :root override
```
From apps/web/lib/sanity/types: `type IssueTheme = ... | null`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add suppressed prop to ThemeApplier (MED-02 web client)</name>
  <files>apps/web/components/issue/ThemeApplier.tsx</files>
  <read_first>
    - apps/web/components/issue/ThemeApplier.tsx (current: 'use client'; ThemeApplierProps { theme: IssueTheme }; useEffect calls applyTheme(document.documentElement, theme))
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Code Examples "ThemeApplier with suppressed prop"; Open Question 2 — make the prop OPTIONAL with `?` so no other caller breaks)
  </read_first>
  <action>
Edit `apps/web/components/issue/ThemeApplier.tsx`:
- Extend the props interface to add an OPTIONAL `suppressed` boolean:
  ```typescript
  interface ThemeApplierProps {
    theme: IssueTheme
    suppressed?: boolean
  }
  ```
- Update the component to early-return from the effect when suppressed:
  ```typescript
  export function ThemeApplier({ theme, suppressed }: ThemeApplierProps) {
    useEffect(() => {
      if (suppressed) return  // globals.css :root wins; setProperty not called (MED-01/MED-02)
      applyTheme(document.documentElement, theme)
    }, [theme, suppressed])
    return null
  }
  ```
- Keep `'use client'` as line 1 and preserve the existing security docstring (add a one-line note that `suppressed` short-circuits the override per MED-02). Do NOT import or call any theme.ts symbol other than the existing `applyTheme`.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit -- machine-editorial-components && pnpm --filter web exec tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <acceptance_criteria>
    - ThemeApplier.tsx contains `suppressed?: boolean` in the props interface
    - ThemeApplier.tsx contains `if (suppressed) return` inside the useEffect, BEFORE the applyTheme call
    - The useEffect dependency array is `[theme, suppressed]`
    - `'use client'` remains the first line; applyTheme is still the only theme.ts call
    - TypeScript compiles with no error (`tsc --noEmit` exits 0)
  </acceptance_criteria>
  <done>ThemeApplier accepts an optional suppressed prop and skips applyTheme when true; no existing caller breaks (prop is optional).</done>
</task>

<task type="auto">
  <name>Task 2: Gate the inline <style> + ThemeApplier in layout.tsx (MED-01 / MED-02 web server)</name>
  <files>apps/web/app/issue/[slug]/layout.tsx</files>
  <read_first>
    - apps/web/app/issue/[slug]/layout.tsx (current Server Component: fetches QUERY_ISSUE_THEME, calls serializeThemeCss(theme) at line ~60, inlines <style dangerouslySetInnerHTML={{ __html: themeCss }} />, renders <ThemeApplier theme={theme} />)
    - apps/web/lib/theme.ts (confirm serializeThemeCss(null) emits BRAND_DEFAULTS light palette — DO NOT call it when suppressed; theme.ts stays READ-ONLY)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pattern 1 + Pitfall 1 + Pitfall 6 + Code Examples "ENV flag read in Server Component")
  </read_first>
  <action>
Edit `apps/web/app/issue/[slug]/layout.tsx` (Server Component — no `'use client'`). Read the flag server-side and gate BOTH theme layers.

- Add the request-time flag read inside `IssueLayout`, BEFORE computing `themeCss`:
  ```typescript
  // MED-02: request-time server read. NEVER NEXT_PUBLIC_ (that bakes at build time).
  const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'
  ```
- Replace the unconditional `const themeCss = serializeThemeCss(theme)` with the gated form. CRITICAL: when suppressed, emit `''` — do NOT call `serializeThemeCss(null)` (Pitfall 1: that emits the light BRAND_DEFAULTS palette and regresses the dark look):
  ```typescript
  // MED-01: when suppressed, emit empty string so globals.css :root dark palette
  // wins the cascade. NOT serializeThemeCss(null) — that emits the LIGHT palette.
  const themeCss = suppressed ? '' : serializeThemeCss(theme)
  ```
- Keep the `<style dangerouslySetInnerHTML={{ __html: themeCss }} />` element UNCONDITIONAL (per RESEARCH Open Question 3 — rendering `<style>` with an empty `__html` is valid and the safest approach). When suppressed `themeCss === ''`, so the style element injects nothing.
- Pass the flag to ThemeApplier: `<ThemeApplier theme={theme} suppressed={suppressed} />`.
- Optionally skip the Sanity theme fetch when suppressed (micro-optimization, planner's discretion): if you skip it, still pass `theme` as the existing value (`null` when not fetched) to `ThemeApplier` — but since `suppressed` short-circuits the effect, the theme value is unused when suppressed. Keep the existing try/catch fetch fallback intact for the non-suppressed path. Do NOT change QUERY_ISSUE_THEME.
- Update the file's top docstring with a short note: "MED-01/MED-02: when DESIGNAGENT_SUPPRESSED is set, themeCss is '' and ThemeApplier is suppressed — the globals.css :root house palette is the sole source of colors/fonts." Do NOT reintroduce BRAND_DEFAULTS anywhere.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit -- theme.test && pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - layout.tsx contains `process.env.DESIGNAGENT_SUPPRESSED === 'true'` (server read; no NEXT_PUBLIC_ prefix anywhere in the file)
    - layout.tsx contains `const themeCss = suppressed ? '' : serializeThemeCss(theme)`
    - layout.tsx does NOT contain `serializeThemeCss(null)` and does NOT import or reference `BRAND_DEFAULTS`
    - layout.tsx renders `<ThemeApplier theme={theme} suppressed={suppressed} />`
    - apps/web/lib/theme.ts is unmodified (git diff shows no change to theme.ts)
    - `pnpm --filter web test:unit -- theme.test` exits 0 (theme.test.ts suppression-contract block green) and `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>layout.tsx reads the flag server-side, emits empty themeCss + suppressed ThemeApplier when ON, and preserves per-issue theming when OFF; theme.ts untouched.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web build` exits 0 (Server Component env read compiles; empty inline style is valid)
- `pnpm --filter web test:unit` exits 0 (theme.test.ts suppression contract + no regression)
- git diff shows apps/web/lib/theme.ts unchanged (READ-ONLY contract honored)
- layout.tsx never calls serializeThemeCss(null) and never references BRAND_DEFAULTS
</verification>

<success_criteria>
- MED-01: with DESIGNAGENT_SUPPRESSED=true the issue page emits no per-issue theme override; globals.css :root wins
- MED-02 (web): flipping the env var false (Vercel dashboard + redeploy) restores per-issue theming with no code change
- ThemeApplier `suppressed` prop is optional — no other caller needs updating
- theme.ts validation/security logic byte-unchanged
</success_criteria>

<output>
After completion, create `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-03-SUMMARY.md`
</output>
