---
phase: 11-archive-cardswap-and-issue-page-motion-polish
plan: 02
type: execute
wave: 2
depends_on: ["11-01"]
files_modified:
  - apps/web/components/archive/CardSwap.tsx
  - apps/web/app/archive/page.tsx
autonomous: true
requirements: [ARC-01]

must_haves:
  truths:
    - "On /archive a CSS-3D card stack of REAL past issues sits above the existing ArchiveList, bound to the ArchiveIssue[] already fetched by the server page"
    - "Cards auto-advance every ~6s, pause on hover, and clicking the front card navigates to /issue/{slug}"
    - "Indicator dots and prev/next chevron controls have aria-labels, aria-current on the active dot, and ≥44px touch targets"
    - "Under prefers-reduced-motion the auto-cycle timer never starts and card transitions are 'none' (static, keyboard-accessible)"
    - "No new npm dependency, no CDN <script>, no @import, no external SVG, no hardcoded issue content"
  artifacts:
    - path: "apps/web/components/archive/CardSwap.tsx"
      provides: "CSS-3D CardSwap client component bound to ArchiveIssue[]"
      min_lines: 90
      contains: "ArchiveIssue"
    - path: "apps/web/app/archive/page.tsx"
      provides: "Archive page mounting <CardSwap issues={issues}> above ArchiveList"
      contains: "CardSwap"
  key_links:
    - from: "apps/web/app/archive/page.tsx"
      to: "apps/web/components/archive/CardSwap.tsx"
      via: "import { CardSwap } and <CardSwap issues={issues} />"
      pattern: "<CardSwap\\s+issues="
    - from: "apps/web/components/archive/CardSwap.tsx"
      to: "@/lib/format"
      via: "import { formatMonthYear }"
      pattern: "formatMonthYear"
    - from: "apps/web/components/archive/CardSwap.tsx"
      to: "@/lib/sanity/types ArchiveIssue"
      via: "props typed as { issues: ArchiveIssue[] }"
      pattern: "ArchiveIssue\\[\\]"
---

<objective>
Implement ARC-01: a new CSS-3D "CardSwap" client component at `apps/web/components/archive/CardSwap.tsx` that stacks REAL past published issues (bound to the `ArchiveIssue[]` already fetched by `apps/web/app/archive/page.tsx`'s `QUERY_ARCHIVE`) as 3D cards auto-advancing on a 6000ms timer, pausing on hover, with click-to-open, indicator dots, prev/next chevron controls, and a "N issues" badge. Mount it above the existing `<ArchiveList>` in the archive page. Under `prefers-reduced-motion`, disable the auto-cycle and all transitions, leaving a static, keyboard-accessible stack.

Purpose: Turn the static archive into the magazine-shelf "deck of past issues" from the Machine Editorial spec — fully data-bound, zero hardcoded content, within all locked constraints (no new npm dep, no CDN, no FONT_WHITELIST change, single `<main>`, ≥44px targets, WCAG AA, print-hidden).
Output: 1 new component + 1 modified page; turns the `archive-cardswap.test.ts` CardSwap/archive-page assertions GREEN.
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
<!-- Contracts the executor needs — extracted from live source. Use directly; no exploration needed. -->

ArchiveIssue type (apps/web/lib/sanity/types.ts lines 134-146):
```typescript
export type ArchiveIssue = {
  issueNumber: number
  publishDate: string          // ISO-8601 e.g. "2025-06-05"
  slug: string                 // href = `/issue/${slug}`
  bonusType: BonusType
  charity: {
    name: string
    slug: string               // available, NOT displayed
    location: string           // available, NOT displayed in compact card
    focusArea: string | null   // displayed as meta line
    assetRange: string | null  // displayed as meta line
  }
}
```

Date helper (apps/web/lib/format.ts line 28) — REUSE, do not reimplement:
```typescript
export function formatMonthYear(input: string | Date): string  // returns e.g. "June 2025"
```
For the CardSwap eyebrow label "ISSUE 9 · JUNE 2025", call `formatMonthYear(issue.publishDate).toUpperCase()`.

lucide-react (already a dep, `^1.14.0`) — import `ChevronLeft, ChevronRight` for prev/next controls. NO Iconify.

Archive page current render (apps/web/app/archive/page.tsx lines 31-53) — Server Component:
```tsx
export default async function ArchivePage() {
  const issues = await sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE)
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-8">
      <h1 ...>Archive</h1>
      <p ...>Every issue of The Eisenbalm Dispatch.</p>
      <div className="mt-8">
        {issues && issues.length > 0 ? (<ArchiveList issues={issues} />) : (<p>Nothing to read yet.</p>)}
      </div>
    </div>
  )
}
```
CardSwap mounts INSIDE the `max-w-[1100px]` wrapper, BEFORE the `<div className="mt-8">` that wraps ArchiveList (RESEARCH Open Question 2 recommendation). The `issues` variable is already in scope — no new fetch.

Existing tokens to reuse (globals.css :root — do NOT redeclare): `--color-bg #0C0B0A`, `--color-card #1A1611`, `--color-card-hover #221D16`, `--color-surface #14110D`, `--color-text #F0EAD9`, `--color-text-dim`, `--color-text-mute #938A77`, `--color-primary #CDA434`, `--color-primary-glow`, `--color-line`, `--color-line-strong`, `--font-display`, `--font-body`, `--font-ui`.

Reduced-motion pattern (same as SectionNavigator.tsx / Atmosphere.tsx): read `window.matchMedia('(prefers-reduced-motion: reduce)').matches` inside a useEffect at mount; store in state.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build CardSwap.tsx (CSS-3D card stack, data-bound, reduced-motion-safe)</name>
  <files>apps/web/components/archive/CardSwap.tsx</files>
  <read_first>
    - apps/web/components/archive/ArchiveList.tsx ('use client' pattern, ArchiveIssue prop usage, existing component conventions to match)
    - apps/web/components/archive/ArchiveItem.tsx (how formatMonthYear is already imported/called for archive cards)
    - apps/web/lib/format.ts (formatMonthYear signature — reuse it)
    - apps/web/lib/sanity/types.ts (ArchiveIssue type, lines 134-146)
    - apps/web/components/issue/SectionNavigator.tsx (matchMedia reduced-motion pattern, useRef/useEffect cleanup pattern to mirror)
    - apps/web/components/issue/Atmosphere.tsx (matchMedia at-mount pattern reference)
    - apps/web/app/globals.css (--color-* tokens, .section-card hover-glow rule lines 484-527, print [data-print-hide] rule)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (ARC-01 geometry table lines 218-291; indicator dots lines 248-256; badge lines 258-261; reduced-motion fallback lines 273-290; a11y lines 530-540)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md (Pattern 1 lines 107-134; getCardStyle code example lines 532-569; Pitfalls 2/5/6 lines 496-526)
  </read_first>
  <action>
Create `apps/web/components/archive/CardSwap.tsx` with `'use client'` as line 1.

Imports: `import { useState, useEffect, useRef } from 'react'`; `import { ChevronLeft, ChevronRight } from 'lucide-react'`; `import type { ArchiveIssue } from '@/lib/sanity/types'`; `import { formatMonthYear } from '@/lib/format'`.

Props: `type Props = { issues: ArchiveIssue[] }`. Export `export function CardSwap({ issues }: Props) {`.

Guard: if `issues.length === 0` return `null` (the page-level empty state handles it).

State + refs:
- `const [activeIndex, setActiveIndex] = useState(0)`
- `const [reducedMotion, setReducedMotion] = useState(false)`
- `const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)`

Reduced-motion gate (useEffect at mount): `setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)`.

Auto-advance timer (separate useEffect, deps `[reducedMotion, issues.length]`):
- If `reducedMotion || issues.length <= 1` → do nothing (timer never starts) and return.
- Else `intervalRef.current = setInterval(() => setActiveIndex(i => (i + 1) % issues.length), 6000)`.
- Cleanup return: `if (intervalRef.current) clearInterval(intervalRef.current)`. (Pitfall 2: always clear.)

Pause-on-hover: `function pause() { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }` and `function resume() { if (reducedMotion || issues.length <= 1 || intervalRef.current) return; intervalRef.current = setInterval(..., 6000) }`. Attach `onMouseEnter={pause}` / `onMouseLeave={resume}` to the scene wrapper.

Card style calculator (copy from RESEARCH lines 532-569 verbatim — `getCardStyle(relativeIndex, isTransitioning)`):
- relativeIndex 0: `transform: 'translateZ(0) rotateX(0deg)'`, opacity 1, zIndex 3
- relativeIndex 1: `transform: 'translateZ(-50px) translateY(18px) rotateX(2deg)'`, opacity 0.55, zIndex 2
- relativeIndex 2: `transform: 'translateZ(-100px) translateY(36px) rotateX(4deg)'`, opacity 0.35, zIndex 1
- relativeIndex > 2: opacity 0, pointerEvents 'none', zIndex 0
- `transition`: when `reducedMotion` → `'none'`; else `'transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 500ms ease'`. (Pass `!reducedMotion` as the isTransitioning arg.)

Render structure (single `<section>`, NEVER `<main>`):
```
<section aria-label="Archive preview" data-print-hide="true" className="...">
  {/* "N issues" badge — top, aligned right */}
  <div className="...badge..."> {issues.length} ISSUES </div>

  {/* Scene */}
  <div
    className="cardswap-scene relative mx-auto max-w-full"
    style={{ perspective: '1200px', width: '500px', height: '400px' }}
    onMouseEnter={pause}
    onMouseLeave={resume}
  >
    {issues.map((issue, i) => {
      const relativeIndex = (i - activeIndex + issues.length) % issues.length
      const isFront = relativeIndex === 0
      const cardInner = (... card face JSX ...)
      const style = { position: 'absolute', width: '100%', height: '100%', transformStyle: 'preserve-3d', ...getCardStyle(relativeIndex, !reducedMotion) }
      // Front card is the link; back cards are non-interactive
      return isFront ? (
        <a
          key={issue.slug}
          href={`/issue/${issue.slug}`}
          aria-label={`Issue ${issue.issueNumber}: ${issue.charity.name}`}
          className="cardswap-card ..."
          style={style}
        >{cardInner}</a>
      ) : (
        <div key={issue.slug} aria-hidden="true" className="cardswap-card ..." style={{ ...style, pointerEvents: 'none' }}>{cardInner}</div>
      )
    })}
  </div>

  {/* Prev / Next chevron controls — siblings of the cards, not children (Pitfall 5) */}
  <div className="...flex justify-between...">
    <button type="button" aria-label="Previous issue" onClick={() => setActiveIndex(i => (i - 1 + issues.length) % issues.length)} className="flex min-h-11 min-w-11 items-center justify-center ..."><ChevronLeft aria-hidden="true" /></button>
    <button type="button" aria-label="Next issue" onClick={() => setActiveIndex(i => (i + 1) % issues.length)} className="flex min-h-11 min-w-11 items-center justify-center ..."><ChevronRight aria-hidden="true" /></button>
  </div>

  {/* Indicator dots */}
  <div className="flex items-center justify-center gap-1" role="tablist">
    {issues.map((issue, i) => (
      <button
        key={issue.slug}
        type="button"
        aria-label={`Issue ${issue.issueNumber}`}
        aria-current={i === activeIndex ? 'true' : undefined}
        onClick={() => setActiveIndex(i)}
        className="flex min-h-11 min-w-11 items-center justify-center"
      >
        <span style={{ width: i === activeIndex ? 8 : 3, height: i === activeIndex ? 8 : 3, borderRadius: '9999px', backgroundColor: i === activeIndex ? 'var(--color-primary)' : 'var(--color-text-mute)', opacity: i === activeIndex ? 1 : 0.5 }} />
      </button>
    ))}
  </div>
</section>
```

Card face (`cardInner`) — bind to real fields ONLY (NO hardcoded content):
- Eyebrow label: `ISSUE {issue.issueNumber} · {formatMonthYear(issue.publishDate).toUpperCase()}` — `font-ui text-[11px] uppercase tracking-[0.1em]` in `--color-text-mute`.
- Charity name: `<span className="font-display text-[22px] font-normal leading-[1.2]" style={{ color: 'var(--color-text)' }}>{issue.charity.name}</span>`.
- Two meta lines (only render when non-null): `issue.charity.focusArea` and `issue.charity.assetRange` — `font-ui text-[11px]` in `--color-text-mute`. Do NOT render read time (not in ArchiveIssue per UI-SPEC lines 212-216) and do NOT render `charity.location` / `charity.slug`.

Card face styling: bg `var(--color-card)`; border `1px solid` → front card uses `var(--color-primary)`, back cards `var(--color-line)`; padding 16px; border-radius 2px. Hover bg `var(--color-card-hover)` (use a Tailwind `hover:` arbitrary or replicate the `.section-card` glow inline). Cards are flat (no backface content) so `transform-style: preserve-3d` on each card is harmless/optional.

Badge styling: `--color-primary` text; bg `color-mix(in srgb, var(--color-primary) 14%, transparent)`; `1px solid var(--color-line-strong)`; border-radius 2px; `font-ui text-[9px] font-medium uppercase tracking-[0.1em]`.

ZERO hardcoded issue content. Do NOT use any literal "Issue 042", "Project Solitude", "Atacama", "$45", or sample copy. Every visible string derives from `issue.*` fields or is a structural label ("ISSUES", "ISSUE", aria labels).

NO `<script>` tag, NO `@import`, NO external URL, NO `gsap`/`framer-motion` import.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | grep -A2 "ARC-01: CardSwap source-scan"; cd apps/web && pnpm test:unit run __tests__/archive-cardswap.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/components/archive/CardSwap.tsx` exists, line 1 is `'use client'`, ≥90 lines
    - `grep -c "ArchiveIssue\[\]" apps/web/components/archive/CardSwap.tsx` returns ≥1 (typed prop)
    - `grep "formatMonthYear" apps/web/components/archive/CardSwap.tsx` matches (no duplicate date formatter)
    - `grep "data-print-hide=\"true\"" apps/web/components/archive/CardSwap.tsx` matches
    - `grep "prefers-reduced-motion" apps/web/components/archive/CardSwap.tsx` matches AND `grep "matchMedia" CardSwap.tsx` matches
    - `grep "<section" apps/web/components/archive/CardSwap.tsx` matches AND `grep "<main" apps/web/components/archive/CardSwap.tsx` returns NO match
    - `grep "aria-current" apps/web/components/archive/CardSwap.tsx` matches AND `grep "aria-label=\"Issue" CardSwap.tsx` matches
    - `grep "min-h-11" apps/web/components/archive/CardSwap.tsx` matches (≥44px touch targets on controls/dots)
    - `grep "6000" apps/web/components/archive/CardSwap.tsx` matches (auto-advance 6s) AND `grep "clearInterval" CardSwap.tsx` matches (cleanup)
    - `grep -E "<script|@import|cdnjs|gsap|framer-motion" apps/web/components/archive/CardSwap.tsx` returns NO match
    - `grep -E "Project Solitude|Issue 042|Atacama" apps/web/components/archive/CardSwap.tsx` returns NO match (no hardcoded content)
    - The `ARC-01: CardSwap source-scan` describe block in archive-cardswap.test.ts is GREEN
  </acceptance_criteria>
  <done>CardSwap renders a data-bound CSS-3D stack with reduced-motion guard, hover-pause, click-to-open, accessible dots/controls; all CardSwap source-scan assertions pass.</done>
</task>

<task type="auto">
  <name>Task 2: Mount CardSwap in archive/page.tsx</name>
  <files>apps/web/app/archive/page.tsx</files>
  <read_first>
    - apps/web/app/archive/page.tsx (current full file — extend, do not rewrite the fetch or metadata)
    - apps/web/components/archive/CardSwap.tsx (the component just created — confirm its prop signature)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (Component Inventory line 474; ARC-01 location lines 194-200; RESEARCH Open Question 2 lines 741-744)
  </read_first>
  <action>
Modify `apps/web/app/archive/page.tsx` (it remains a Server Component — do NOT add 'use client', do NOT change the `QUERY_ARCHIVE` fetch or the `metadata` export).

Add import near the existing `ArchiveList` import (line 5): `import { CardSwap } from '@/components/archive/CardSwap'`.

Inside the returned JSX, INSIDE the existing `<div className="mx-auto max-w-[1100px] ...">` wrapper, render `<CardSwap issues={issues} />` AFTER the `<p>Every issue...</p>` description and BEFORE the existing `<div className="mt-8">` that wraps `<ArchiveList>`. Only render it when there are issues — wrap in `{issues && issues.length > 0 && <CardSwap issues={issues} />}` so the empty-state path is unaffected.

The existing `<ArchiveList>` block stays exactly as-is below CardSwap (it is the reduced-motion-accessible fallback and the searchable/sortable full view). Do not delete or modify ArchiveList.

Resulting order inside the wrapper: `<h1>` → `<p>` → `{CardSwap}` → `<div className="mt-8">{ArchiveList | empty state}</div>`.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit run __tests__/archive-cardswap.test.ts 2>&1 | tail -20 && pnpm --filter web build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `grep "import { CardSwap }" apps/web/app/archive/page.tsx` matches
    - `grep -E "<CardSwap\s+issues=" apps/web/app/archive/page.tsx` matches
    - `apps/web/app/archive/page.tsx` still contains `<ArchiveList issues={issues}` (fallback preserved) and still contains `QUERY_ARCHIVE` (fetch unchanged)
    - `apps/web/app/archive/page.tsx` does NOT contain `'use client'` (stays a Server Component)
    - The `ARC-01: archive page wires CardSwap` describe block in archive-cardswap.test.ts is GREEN
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>Archive page mounts CardSwap above the preserved ArchiveList; build passes; archive-page wiring assertions green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` — entire `archive-cardswap.test.ts` is GREEN (CardSwap + archive-page + no-new-dep + FONT_WHITELIST blocks).
- `pnpm --filter web build` exits 0 (TypeScript + Next build).
- All five existing tripwires stay green (no source touched outside CardSwap.tsx + archive/page.tsx).
- `git diff --stat apps/web/package.json` shows no change to dependencies.
</verification>

<success_criteria>
- New CardSwap.tsx is a 'use client' CSS-3D component bound to ArchiveIssue[], no hardcoded content.
- Auto-advance 6s, pause-on-hover, click-to-open front card, prev/next + indicator dots with aria + ≥44px targets.
- prefers-reduced-motion disables the timer and transitions.
- Archive page mounts it above the preserved ArchiveList; build green.
</success_criteria>

<output>
After completion, create `.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-02-SUMMARY.md`
</output>
