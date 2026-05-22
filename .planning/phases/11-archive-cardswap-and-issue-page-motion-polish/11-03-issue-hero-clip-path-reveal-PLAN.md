---
phase: 11-archive-cardswap-and-issue-page-motion-polish
plan: 03
type: execute
wave: 2
depends_on: ["11-01"]
files_modified:
  - apps/web/components/issue/IssueHero.tsx
autonomous: true
requirements: [MOT-01]

must_haves:
  truths:
    - "The issue hero charity name reveals word-by-word via a clip-path + translateY + opacity @keyframes animation on load"
    - "IssueHero stays a Server Component — no 'use client', no React hooks added"
    - "Under prefers-reduced-motion the existing globals.css guard collapses the animation to ~0ms and the name shows instantly — never trapped at opacity:0 or clipped"
    - "opacity:0 and clip-path appear ONLY inside @keyframes from{}, never as base styles on the word spans"
    - "IssueHero still has ≥2 .eyebrow usages (DES-04 inheritance stays green)"
  artifacts:
    - path: "apps/web/components/issue/IssueHero.tsx"
      provides: "Charity-name <h1> split into animated word spans with component-scoped @keyframes heroWordReveal"
      contains: "heroWordReveal"
  key_links:
    - from: "apps/web/components/issue/IssueHero.tsx <h1>"
      to: "charity.name word spans"
      via: "charity.name.split(' ').map(...) with per-span animationDelay"
      pattern: "\\.split\\("
---

<objective>
Implement MOT-01: add a line-by-line (word-by-word) clip-path reveal to the charity-name `<h1>` in `apps/web/components/issue/IssueHero.tsx`. The reveal must be CSS-only (component-scoped `@keyframes` + per-span inline `animationDelay`) so IssueHero stays a Server Component — adding hooks/`'use client'` is explicitly forbidden by RESEARCH (lines 137, 323). Under `prefers-reduced-motion`, the existing globals.css guard collapses the animation to ~0ms; the content must NEVER be trapped invisible, which requires `opacity:0`/`clip-path` to live ONLY inside `@keyframes from{}`.

Purpose: The hero name "develops" on load like the Machine Editorial spec, without any JS, any new dependency, or any FONT_WHITELIST change — and degrades to instant under reduced-motion.
Output: 1 modified component; turns `issue-hero-motion.test.ts` MOT-01 assertions GREEN; `issue-page-typography.test.ts` DES-04 eyebrow assertion stays GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md
@.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md

<interfaces>
<!-- Current IssueHero <h1> — extracted from live source (lines 88-98). Extend, do not rewrite the surrounding component. -->
```tsx
<h1
  className="mb-10 max-w-[14ch] font-display font-normal leading-[0.92] tracking-[-0.02em] text-[color:var(--color-primary)]"
  style={{
    fontSize: 'clamp(56px,10.5vw,148px)',
    textShadow: '0 0 80px var(--color-primary-glow, rgba(205,164,52,.12))',
  }}
>
  {charity.name}
</h1>
```
- `IssueHero.tsx` is a Server Component: NO `'use client'`, NO hooks (confirmed RESEARCH line 367, line 137).
- `charity.name` is a `string` (IssueCharity type).
- Eyebrow usages are at line 83 (`<p className="eyebrow ...">`) and lines 121-138 (four `<span className="eyebrow">`). DES-04 tripwire requires ≥2 matches of `["']eyebrow`; currently 5. These spans are NOT touched by this change — count stays 5.

Reduced-motion guard already in globals.css (lines 293-302) — DO NOT duplicate it:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
This collapses `heroWordReveal` to ~0ms so the `to{}` end-state (fully visible) applies immediately.

Animation spec (UI-SPEC MOT-01 lines 303-348): duration 600ms per span; 80ms stagger; easing `cubic-bezier(0.4, 0, 0.2, 1)`; `clip-path: inset(0 0 100% 0)` → `inset(0 0 0% 0)`, `translateY(12px)` → `translateY(0)`, `opacity 0` → `opacity 1` — all ONLY in @keyframes.

React 19 + Next 15 support `<style>` tags inside Server Component JSX (hoisted to <head>, deduplicated). RESEARCH line 183 confirms this is the correct pattern for component-scoped keyframes.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Split charity name into animated word spans with scoped @keyframes</name>
  <files>apps/web/components/issue/IssueHero.tsx</files>
  <read_first>
    - apps/web/components/issue/IssueHero.tsx (FULL file — confirm it has no 'use client', read the <h1> at lines 88-98 and the eyebrow usages at 83 + 121-138)
    - apps/web/app/globals.css (the @media (prefers-reduced-motion: reduce) guard at lines 293-302 — relied upon, NOT duplicated)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md (Pattern 2 lines 135-183; the word-span code example lines 152-176; Pitfall 1 lines 486-494; Anti-Patterns lines 321-328)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (MOT-01 lines 294-348; Motion Contract opacity/clip-path trap warning lines 518-522)
    - apps/web/__tests__/issue-hero-motion.test.ts (the assertions this task must satisfy — created in Plan 01)
  </read_first>
  <action>
Modify ONLY the charity-name `<h1>` block in `apps/web/components/issue/IssueHero.tsx`. Do NOT add `'use client'`. Do NOT import or use `useState`/`useEffect`/`useRef`. Do NOT touch the eyebrow `<p>` (line 83), the mission `<p>`, the meta-row eyebrow spans, the ghost numeral, or the PDF link.

Above the `<h1>` return (or just inside it as the first child), derive the word list: `const nameWords = charity.name.split(' ')`.

Replace the `<h1>` body. Keep the existing `className` and `style` on the `<h1>` exactly as-is (font, clamp, text-shadow, color). Inside the `<h1>`:

1. Render a component-scoped `<style>` tag with the keyframes and the span class. CRITICAL: `opacity`, `clip-path`, and the initial `transform` appear ONLY inside `@keyframes heroWordReveal from{}`. The `.hero-word-span` base rule has `display: inline-block` and the `animation` shorthand with `both` fill mode — and NO `opacity`/`clip-path`/`transform` base values:
```tsx
<style>{`
  @keyframes heroWordReveal {
    from { clip-path: inset(0 0 100% 0); transform: translateY(12px); opacity: 0; }
    to   { clip-path: inset(0 0 0% 0);   transform: translateY(0);    opacity: 1; }
  }
  .hero-word-span {
    display: inline-block;
    animation: heroWordReveal 600ms cubic-bezier(0.4, 0, 0.2, 1) both;
  }
`}</style>
```

2. Render each word as a span with a per-word `animationDelay` inline style (80ms stagger). Preserve the space between words so the rendered name reads identically:
```tsx
{nameWords.map((word, i) => (
  <span
    key={i}
    className="hero-word-span"
    style={{ animationDelay: `${i * 80}ms` }}
  >
    {word}{i < nameWords.length - 1 ? ' ' : ''}
  </span>
))}
```

Do NOT set `opacity: 0`, `clip-path: inset(...)`, or `transform: translateY(...)` anywhere as a base/inline style on the spans or the `<h1>` — only inside the `@keyframes from{}` (Pitfall 1, UI-SPEC lines 518-522). The `animation ... both` fill mode handles the pre-animation visual state during the animation; when the guard collapses duration to ~0ms, the `to{}` end-state (fully visible) applies.

Do not add `aria-hidden` to the spans (the name must remain readable to screen readers — UI-SPEC line 539). The `<h1>` text content is unchanged semantically; only its inline structure changes from one text node to N spans.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit run __tests__/issue-hero-motion.test.ts 2>&1 | tail -25 && pnpm test:unit run __tests__/issue-page-typography.test.ts 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep "charity.name.split(" apps/web/components/issue/IssueHero.tsx` matches (word split)
    - `grep "animationDelay" apps/web/components/issue/IssueHero.tsx` matches
    - `grep "@keyframes heroWordReveal" apps/web/components/issue/IssueHero.tsx` matches
    - `grep "hero-word-span" apps/web/components/issue/IssueHero.tsx` matches
    - `apps/web/components/issue/IssueHero.tsx` does NOT contain `'use client'` (first non-blank line is not the directive) and does NOT contain `useState`, `useEffect`, or `useRef`
    - Stripping the `@keyframes ... }` block from the file leaves NO `opacity: 0`, `opacity:0`, `clip-path: inset`, or `clipPath:` as inline/base styles (Pitfall 1)
    - `grep -o "[\"']eyebrow" apps/web/components/issue/IssueHero.tsx | wc -l` returns ≥2 (DES-04 inheritance)
    - `issue-hero-motion.test.ts` is fully GREEN
    - `issue-page-typography.test.ts` stays GREEN (DES-04 eyebrow + all other DES assertions)
  </acceptance_criteria>
  <done>Charity name reveals via component-scoped @keyframes word-span animation; IssueHero stays a Server Component; reduced-motion shows it instantly; eyebrow tripwire unchanged.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit run __tests__/issue-hero-motion.test.ts` is GREEN.
- `pnpm --filter web test:unit run __tests__/issue-page-typography.test.ts` is GREEN (DES-04 eyebrow count ≥2 preserved).
- `pnpm --filter web build` exits 0.
- Manual (HUMAN-UAT): load /issue/issue-999 — name reveals word-by-word; enable OS Reduce Motion + reload — name appears instantly.
</verification>

<success_criteria>
- charity.name split into word spans with staggered animationDelay.
- @keyframes heroWordReveal defined in a component-scoped <style> tag.
- opacity/clip-path only inside @keyframes from{}.
- No 'use client', no hooks — IssueHero remains a Server Component.
- DES-04 eyebrow tripwire stays green.
</success_criteria>

<output>
After completion, create `.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-03-SUMMARY.md`
</output>
