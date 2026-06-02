# Phase 17: UI/UX Audit Follow-ups — Research

**Researched:** 2026-06-01
**Domain:** Next.js 15 App Router polish — next/image, loading.tsx skeletons, archive pagination, static copy, DOM correctness
**Confidence:** HIGH

---

## User Constraints

*(No CONTEXT.md exists for Phase 17 — constraints come from ROADMAP.md success criteria and CLAUDE.md hard rules.)*

### Locked Decisions (from ROADMAP.md Phase 17 success criteria)
- No new npm dependency; no CDN.
- Existing Phase 14 light-theme (`--color-*` tokens only, no hardcoded hex) preserved.
- Phase 12 typography lock (FONT_WHITELIST: Cormorant Garamond / Lora / Inter — unchanged) preserved.
- Phase 8 commerce surface (BuyButton, /api/checkout, /api/stripe/webhook, ShopCallout) byte-unchanged.
- Web vitest baseline 234/234 must be preserved (and extended by new tripwires).
- All color references must remain `var(--color-*)` style — no hex literals in new code.
- Schema field names must not be modified without `docs/API_CONTRACTS.md` update (CLAUDE.md hard rule).

### Claude's Discretion
- N value for archive pagination threshold (must recommend a concrete value).
- Pagination approach: server-side slug-window vs. client-side load-more.
- Skeleton visual design (shimmer color token, animation timing).
- Whether `/about` plan structure uses a `TODO(Andrew)` placeholder path or a separate "copy-gate" plan.

### Deferred Ideas (OUT OF SCOPE)
- Converting the `/agents/[agentId]/page.tsx` raw `<img>` — it already has explicit `width={80}` and `height={80}` and is on a low-traffic internal route; audit flagged only BonusSection.
- Removing the `_debug/convex` route entirely (the TODO(Phase 9) cleanup was deferred by the original Phase 9 team; fixing the nested `<main>` is a one-line change inside the existing phase 17 scope, not a full removal).
- Any pipeline changes (all 5 items are `apps/web`-only).

---

## Phase Requirements

*(Derived from ROADMAP.md Phase 17 six success criteria — no pre-assigned REQ IDs.)*

| ID | Description | Source |
|----|-------------|--------|
| **P17-01** | `BonusSection.tsx` storyboard images rendered via `next/image` with explicit dimensions; no raw `<img>` remains (eslint-disable comment removed); source-scan tripwire green | ROADMAP SC-1 |
| **P17-02** | `/issue/[slug]` Lighthouse CLS score measurably improves vs. raw `<img>` (Largest CLS element eliminated from storyboard grid) | ROADMAP SC-1 |
| **P17-03** | `/archive` paginates or load-mores at threshold N ≥ 1 issue published; full-archive HTML payload no longer includes every issue when count exceeds N | ROADMAP SC-2 |
| **P17-04** | `loading.tsx` skeleton files exist at: `apps/web/app/issue/[slug]/loading.tsx`, `apps/web/app/archive/loading.tsx`, `apps/web/app/charities/loading.tsx`, `apps/web/app/charities/[slug]/loading.tsx` | ROADMAP SC-3 |
| **P17-05** | `/about` page no longer displays the "This page is being written" placeholder text; Jesse-voice copy is in place **or** the plan contains a clearly marked `TODO(Andrew)` gate with ready-to-merge code structure | ROADMAP SC-4 |
| **P17-06** | `apps/web/app/%5Fdebug/convex/page.tsx` no longer nests a `<main>` inside the root layout's `<main id="main">` | ROADMAP SC-5 |
| **P17-07** | All six constraints preserved: no new npm dep, no CDN, light-theme tokens, FONT_WHITELIST, commerce surface, vitest 234+/234 baseline | ROADMAP SC-6 |

---

## Summary

Phase 17 is a five-item polish pass with no architectural decisions — every item is a localized code change in `apps/web`. The items range from a one-line fix (duplicate `<main>`) to a moderate coordination challenge (`/about` copy gated on Andrew). Two items require investigation-before-implementation decisions that research can now lock:

**next/image storyboards (P17-01/02):** `cdn.sanity.io` is already in `next.config.ts` remotePatterns. The storyboard container already uses `aspect-video + overflow-hidden` (16:9 proportional container), which is the exact pattern for `next/image fill`. No new dep needed — `next/image` ships with Next.js. The GROQ query currently projects `storyboards[] { asset->{ url } }` — this is sufficient for `fill` mode; the `IssueBonus` type and GROQ projection do NOT need updating (no API_CONTRACTS.md edit required for this approach). The `eslint-disable-next-line @next/next/no-img-element` comment can be removed after conversion, and a new source-scan tripwire should assert that no raw `<img>` for storyboards remains.

**Archive pagination (P17-03):** Current `QUERY_ARCHIVE` fetches ALL published issues with no limit. The `ArchiveList` component is a Client Component already managing search/sort state. Given the Dispatch publishes weekly and the content is editorially curated (not a blog firehose), a "load-more" client-side approach starting at N=10 is the right tradeoff: simple (no GROQ pagination needed, no URL cursor), backward-compatible with the existing `CardSwap` which already receives the full list, and zero new deps. The planner must decide whether `ArchiveList` owns the truncation or whether a separate `ArchiveListPaginated` wrapper is cleaner.

**Primary recommendation:** Use `next/image` with `fill` layout in the existing `aspect-video` container (P17-01), implement client-side load-more at N=10 in `ArchiveList` (P17-03), add four minimal skeleton files with shimmer pulse (P17-04), structure the `/about` plan with a `TODO(Andrew)` content gate (P17-05), and fix the `<main>` → `<div>` one-liner (P17-06). All within the 234-test vitest baseline — extend with new source-scan tripwires for P17-01 and P17-03.

---

## Standard Stack

### Core (already installed — Phase 17 adds nothing new)

| Library | Version (installed) | Purpose | Status |
|---------|--------------------|---------|----|
| `next` | ^15.3.9 | App Router + `next/image` optimizer | Already installed |
| `@sanity/image-url` | ^2.1.1 | `urlFor()` builder for Sanity images | Already installed |
| `react` | ^19.2.6 | Loading skeleton is a RSC or minimal CSS component | Already installed |
| `vitest` | ^3.2.0 | Source-scan tripwires | Already installed |

**No new dependencies for any of the 5 items.** Confirmed: `archive-cardswap.test.ts` line 159 asserts `Object.keys(pkg.dependencies).length === 17` — Phase 17 must preserve this.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next/image fill` in aspect-video container | `next/image` with explicit `width`/`height` + GROQ metadata projection | `fill` requires no GROQ change (no new `metadata { dimensions }` projection, no API_CONTRACTS.md edit, simpler). Explicit dimensions are more semantically correct but require GROQ change + type update + API_CONTRACTS.md audit. **Recommendation: use `fill`**. |
| Client-side load-more in ArchiveList | Server-side GROQ `[0..N]` slice + cursor pagination | Server-side requires URL state + GROQ changes + revalidation logic. Client-side load-more is simpler, all state stays in the already-client-component ArchiveList, and the CardSwap still gets the full list. **Recommendation: client-side load-more**. |
| CSS `@keyframes` shimmer for loading.tsx | Static gray rectangle only | Shimmer is industry standard UX. Doable with 100% CSS + existing `--color-*` tokens, zero JS, no deps. **Recommendation: shimmer (CSS-only)**. |

---

## Architecture Patterns

### Recommended Project Structure (affected files only)

```
apps/web/
├── app/
│   ├── issue/[slug]/
│   │   ├── loading.tsx            ← NEW (P17-04)
│   │   └── page.tsx               (unchanged)
│   ├── archive/
│   │   ├── loading.tsx            ← NEW (P17-04)
│   │   └── page.tsx               (unchanged)
│   ├── charities/
│   │   ├── loading.tsx            ← NEW (P17-04)
│   │   ├── [slug]/
│   │   │   ├── loading.tsx        ← NEW (P17-04)
│   │   │   └── page.tsx           (unchanged)
│   │   └── page.tsx               (unchanged)
│   ├── about/
│   │   └── page.tsx               ← EDIT (P17-05)
│   └── %5Fdebug/convex/
│       └── page.tsx               ← EDIT one line: <main> → <div> (P17-06)
├── components/issue/
│   └── BonusSection.tsx           ← EDIT (P17-01)
├── __tests__/
│   ├── bonus-section-image.test.ts  ← NEW (P17-01 tripwire)
│   └── archive-pagination.test.ts   ← NEW (P17-03 tripwire)
```

### Pattern 1: next/image with fill in aspect-ratio container

The storyboard container already has `aspect-video overflow-hidden rounded` — this is the exact prerequisite for `next/image fill`.

```typescript
// apps/web/components/issue/BonusSection.tsx
// Source: Next.js 15 docs — fill mode with positioned parent
import Image from 'next/image'

// BEFORE (raw <img>, CLS risk):
<div className="aspect-video overflow-hidden rounded …">
  <img src={url} alt={…} className="h-full w-full object-cover" loading="lazy" />
</div>

// AFTER (next/image fill, CLS eliminated):
<div className="relative aspect-video overflow-hidden rounded …">
  <Image
    src={url}
    alt={`Storyboard ${i + 1}`}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 430px"
    className="object-cover"
  />
</div>
```

Key notes:
- Add `relative` to parent div (required by next/image fill).
- Remove `loading="lazy"` — next/image handles lazy loading internally.
- Remove `h-full w-full` from image class — fill handles sizing.
- Add `sizes` hint for responsive layout (2-col grid at `sm:`).
- `cdn.sanity.io` is already in `next.config.ts` remotePatterns — no config change.
- The eslint-disable comment (`@next/next/no-img-element`) is removed.

**GROQ impact:** None. The existing `storyboards[] { asset->{ url } }` projection is sufficient. `url` is the full Sanity CDN URL — next/image can optimize it directly.

**Type impact:** `IssueBonus.storyboards` type `Array<{ asset: { url: string } | null }>` is unchanged. The storyboard URL pattern (`https://cdn.sanity.io/images/…`) already matches the `remotePatterns` hostname.

### Pattern 2: Client-side load-more in ArchiveList

`ArchiveList` is already a `'use client'` component with `useState`. The simplest approach adds a `visibleCount` state slice on the `filtered` array.

```typescript
// apps/web/components/archive/ArchiveList.tsx (partial)
const PAGE_SIZE = 10  // Initial and increment

export function ArchiveList({ issues }: { issues: ArchiveIssue[] }) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<SortOrder>('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)  // NEW

  const filtered = useMemo(() => { /* existing logic */ }, [issues, query, order])

  // Slice for display — reset visible on query/sort change
  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  // Reset page when search/sort changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, order])

  return (
    <div>
      {/* existing search + sort UI */}
      <p role="status" aria-live="polite">
        Showing {visible.length} of {filtered.length} {…}
      </p>
      <ul className="mt-4">
        {visible.map((issue) => <ArchiveItem key={issue.slug} issue={issue} />)}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
          className="mt-6 … min-h-11 …"
        >
          Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
        </button>
      )}
    </div>
  )
}
```

Notes:
- `CardSwap` in `archive/page.tsx` receives the full `issues` array (unchanged — CardSwap shows featured cards, not a paginated list).
- The GROQ `QUERY_ARCHIVE` stays unchanged — still fetches all issues. The slice is UI-only.
- `PAGE_SIZE = 10` means the first 10 issues are visible immediately; the "load more" button adds 10 at a time.
- Search/sort resets the visible count to avoid showing 0 of 47 when a search matches 3 items that happen to be past position 10.
- The existing `role="status"` + `aria-live="polite"` pattern on the count paragraph handles accessibility.

**Why N=10:** The Dispatch publishes weekly. At 10 issues per year, the archive won't overflow a single page for ~6 months. By 52 issues (1 year), showing 10 initially with load-more is comfortable. At the current trajectory this is not urgent, but implementing it now prevents future refactor.

### Pattern 3: loading.tsx skeleton

Next.js App Router convention: `loading.tsx` in a route segment is automatically wrapped in `<Suspense>` by the framework and shown while the page's async Server Component resolves. No `Suspense` needed in `page.tsx`.

```typescript
// apps/web/app/issue/[slug]/loading.tsx
// Source: Next.js 15 App Router docs — loading.tsx convention

export default function IssueLoading() {
  return (
    <article className="pb-0 animate-pulse">
      {/* Hero skeleton: charity name block + metadata row */}
      <div className="mx-auto max-w-[860px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-3 w-24 rounded bg-[color:var(--color-line)] mb-4" />
        <div className="h-10 w-3/4 rounded bg-[color:var(--color-line)] mb-3" />
        <div className="h-10 w-1/2 rounded bg-[color:var(--color-line)] mb-6" />
        <div className="h-3 w-40 rounded bg-[color:var(--color-line)]" />
      </div>
      {/* Section body skeleton: 3 paragraph lines */}
      <div className="mx-auto max-w-[680px] px-4 space-y-3 mt-8">
        <div className="h-4 w-full rounded bg-[color:var(--color-line)]" />
        <div className="h-4 w-5/6 rounded bg-[color:var(--color-line)]" />
        <div className="h-4 w-4/5 rounded bg-[color:var(--color-line)]" />
      </div>
    </article>
  )
}
```

**Token compliance:** Use `--color-line` (already in globals.css) for the skeleton bar color — it's a neutral hairline token that reads on the warm-paper background without hardcoded hex. No new CSS class needed — Tailwind's built-in `animate-pulse` is already available via Tailwind v4.

**Scope:** Create 4 files:
1. `apps/web/app/issue/[slug]/loading.tsx` — issue page layout skeleton
2. `apps/web/app/archive/loading.tsx` — archive list skeleton  
3. `apps/web/app/charities/loading.tsx` — charities list skeleton
4. `apps/web/app/charities/[slug]/loading.tsx` — single charity skeleton

Each file should mirror the visual shape of its page (same max-width container, same rough vertical sections) so the content snap-in is smooth and not jarring.

**Loading.tsx does NOT replace the issue layout.tsx** — the per-issue `layout.tsx` (theme injection + ThemeApplier) is a layout, not a page, and is not affected by loading.tsx convention.

### Pattern 4: /about page copy structure

The current placeholder is:
```tsx
<p className="mt-6 font-body text-[18px] …">
  The Eisenbalm Dispatch publishes weekly. This page is being written.
</p>
```

The plan should replace this with `TODO(Andrew)` marked content:

```tsx
{/*
  TODO(Andrew): Replace this section with your approved /about copy.
  Voice: Jesse — dry, precise, no irony signaling. Maximum 3-4 paragraphs.
  If you prefer to write in Sanity, extract this to a Portable Text field instead.
*/}
<p className="mt-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
  {/* PLACEHOLDER — Andrew must approve copy before this file ships */}
  The Eisenbalm Dispatch publishes weekly. Jesse A. Eisenbalm identifies one
  overlooked charity per week, produces an eight-section editorial, and donates
  one hundred percent of lip balm proceeds to that charity.
</p>
```

The code structure (article, h1, prose constraints) is ready for real copy. This satisfies P17-05's "plan contains a clearly marked TODO(Andrew) gate with ready-to-merge code structure" interpretation of the ROADMAP success criterion. Andrew provides the real paragraphs; a single line-swap lands the final text.

**Gating note:** The plan should make P17-05 an Andrew-gated plan (like Plan 08-02, which was marked `autonomous: false`). The developer task is: write the structural code + interim copy; Andrew approves and replaces the interim copy. The interim copy replaces the "This page is being written" placeholder so the page is not obviously broken in UAT.

### Pattern 5: _debug/convex duplicate `<main>` fix (P17-06)

The fix is a single-line change in `apps/web/app/%5Fdebug/convex/page.tsx`:

```tsx
// BEFORE (line 50):
<main className="mx-auto max-w-2xl px-6 py-12">

// AFTER:
<div className="mx-auto max-w-2xl px-6 py-12">
```

And close tag correspondingly. This is exactly the same pattern applied to `archive/page.tsx` and `charities/page.tsx` in the sibling a11y quick task (260520-0kt Task 4). The `%5Fdebug` URL encoding preserves the Next.js private-folder-escape (Phase 3 decision — the `%5F` prefix means the route IS accessible as `/_debug/convex`).

### Anti-Patterns to Avoid

- **Don't use `next/image` with explicit `width`/`height` for storyboards** — this would require projecting `asset->{ url, metadata { dimensions { width, height } } }` from GROQ (new fields), updating `IssueBonus` type, and auditing `docs/API_CONTRACTS.md §1.2`. The `fill` approach avoids all of that.
- **Don't paginate via GROQ cursor** — `QUERY_ARCHIVE` is in `docs/API_CONTRACTS.md §1.3`; changing its projection is a contract edit. Client-side slice is sufficient and zero-risk to the contract.
- **Don't use hardcoded hex in loading.tsx** — use `--color-line` token only.
- **Don't add `<main>` to any loading.tsx** — the root layout owns `<main id="main">`; all route-level components (including loading.tsx) must use `<div>` or semantic sectioning elements.
- **Don't add `<Suspense>` wrappers to page.tsx** — loading.tsx handles it automatically in App Router.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image optimization + lazy loading | Custom resize/lazy solution | `next/image` (already bundled with next) | next/image handles WebP conversion, srcset, lazy, blur placeholder, LCP optimization |
| CSS shimmer animation | Custom keyframe + JS | Tailwind `animate-pulse` (already in Tailwind v4 install) | Zero new CSS; composable with `--color-line` token |

---

## Runtime State Inventory

Phase 17 is not a rename/refactor/migration phase. No runtime state is affected by any of the 5 items. The `_debug/convex` `<main>` fix is markup-only (no Convex data changes). The `ArchiveList` pagination is UI-only state.

**Step 2.5: SKIPPED — greenfield polish additions only, no string renames, no data migrations.**

---

## Common Pitfalls

### Pitfall 1: next/image fill — missing `position: relative` on parent

**What goes wrong:** `next/image fill` generates a `position: absolute` child. If the parent div lacks `position: relative`, the image escapes its container and overlaps other elements.

**Why it happens:** The current storyboard container has `aspect-video overflow-hidden` but NOT `relative`. Adding `fill` without adding `relative` to the parent causes a layout explosion.

**How to avoid:** Add `relative` to the storyboard wrapper div: `className="relative aspect-video overflow-hidden rounded …"`.

**Warning signs:** Image renders outside its 16:9 box or covers adjacent storyboard frames.

### Pitfall 2: next/image fill — `sizes` prop omitted

**What goes wrong:** Without a `sizes` attribute, next/image defaults to `100vw` for every viewport, causing the image to download at full viewport width even in the 2-column grid.

**Why it happens:** Next.js 15 emits a console warning when `sizes` is omitted on a `fill` image: `Image with src "…" has "fill" but is missing "sizes" prop.`

**How to avoid:** Provide `sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 430px"` — matches the `sm:grid-cols-2` breakpoint in BonusSection.

### Pitfall 3: Archive load-more — search/sort doesn't reset visible count

**What goes wrong:** User searches for "animal" (3 matches), expands to 20 visible, then clears the search. The 20-item visibleCount persists, showing 20 from the next query — but might show 0 if the `filtered.slice(0, 20)` result has fewer than 20 total.

**Why it happens:** Missing `useEffect` reset when `query` or `order` changes.

**How to avoid:** Add `useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, order])`.

### Pitfall 4: loading.tsx contains `<main>`

**What goes wrong:** Single-main-landmark violation. The root layout owns `<main id="main">`. If loading.tsx nests another `<main>`, WCAG 1.3.1 is violated and the skip-link (`href="#main"`) becomes ambiguous.

**Why it happens:** Engineers copy the error.tsx pattern (which uses `<section>`) or write a full page template.

**How to avoid:** Use `<div>` or `<article>` as the root element in all loading.tsx files. Follow the exact pattern used in `charities/page.tsx` (Task 4 of 260520-0kt) and the existing `app/error.tsx` (`<section>`).

### Pitfall 5: `archive-cardswap.test.ts` dependency count assertion breaks

**What goes wrong:** `archive-cardswap.test.ts` line 159 asserts `Object.keys(pkg.dependencies).length === 17`. If Phase 17 adds any npm dep, this test breaks — even if intentional.

**Why it happens:** The test was written to guard the no-new-dep constraint. It counts production dependencies exactly.

**How to avoid:** Phase 17 must add zero new production deps. `next/image` is already part of the `next` package.

### Pitfall 6: About page copy — Jesse-voice drift

**What goes wrong:** The interim placeholder copy uses a different register than Jesse voice — too conversational, too enthusiastic, or self-promotional.

**Why it happens:** The `/about` page is a "meta" page about the publication; writers naturally reach for conventional marketing copy.

**How to avoid:** Use the Jesse-voice rubric: dry, precise, absurdly serious, no winking, no irony signaling, no exclamation marks. The interim copy should read like a press release filed by an organization that takes itself extremely seriously. Maximum 3-4 sentences per paragraph.

---

## Code Examples

### next/image fill — complete storyboard conversion

```typescript
// Source: Next.js 15 docs https://nextjs.org/docs/app/api-reference/components/image#fill
// apps/web/components/issue/BonusSection.tsx — BigBudgetBonus function

import Image from 'next/image'  // Add at top of file

// In BigBudgetBonus:
{storyboards.map((sb, i) => {
  const url = sb.asset?.url
  if (!url) return null
  return (
    // ADD `relative` to the wrapper:
    <div
      key={i}
      className="relative aspect-video overflow-hidden rounded border border-[color:var(--color-line)] bg-[color:var(--color-card)]"
    >
      <Image
        src={url}
        alt={`Storyboard ${i + 1}`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 430px"
        className="object-cover"
      />
    </div>
  )
})}
```

**Removes:** `/* eslint-disable-next-line @next/next/no-img-element */` comment + the raw `<img>` element.

### loading.tsx — /archive skeleton

```typescript
// apps/web/app/archive/loading.tsx
// Source: Next.js 15 docs — loading.tsx RSC skeleton convention

export default function ArchiveLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-8 animate-pulse">
      {/* Page title skeleton */}
      <div className="h-8 w-32 rounded bg-[color:var(--color-line)] mb-4" />
      <div className="h-3 w-64 rounded bg-[color:var(--color-line)] mb-8" />
      {/* CardSwap area skeleton */}
      <div className="h-48 w-full rounded bg-[color:var(--color-line)] mb-8" />
      {/* Archive list skeleton — 5 rows */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded bg-[color:var(--color-line)]" />
        ))}
      </div>
    </div>
  )
}
```

### loading.tsx — /issue/[slug] skeleton

```typescript
// apps/web/app/issue/[slug]/loading.tsx
export default function IssueLoading() {
  return (
    <article className="pb-0 animate-pulse">
      {/* Hero block */}
      <div className="mx-auto max-w-[860px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-3 w-20 rounded bg-[color:var(--color-line)] mb-6" aria-hidden="true" />
        <div className="h-12 w-3/4 rounded bg-[color:var(--color-line)] mb-4" aria-hidden="true" />
        <div className="h-12 w-1/2 rounded bg-[color:var(--color-line)] mb-6" aria-hidden="true" />
        <div className="h-3 w-48 rounded bg-[color:var(--color-line)]" aria-hidden="true" />
      </div>
      {/* Body section skeleton */}
      <div className="mx-auto max-w-[680px] px-4 sm:px-6 lg:px-8 space-y-3 mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-[color:var(--color-line)] ${i % 3 === 2 ? 'w-4/5' : 'w-full'}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </article>
  )
}
```

### Source-scan tripwire — P17-01 bonus-section-image

```typescript
// apps/web/__tests__/bonus-section-image.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const BONUS_PATH = resolve(__dirname, '../components/issue/BonusSection.tsx')

describe('P17-01: BonusSection uses next/image not raw img for storyboards', () => {
  const src = readFileSync(BONUS_PATH, 'utf-8')

  it('imports next/image Image component', () => {
    expect(src).toContain("from 'next/image'")
  })

  it('uses <Image fill for storyboard rendering', () => {
    expect(src).toContain('<Image')
    expect(src).toContain('fill')
  })

  it('has no raw <img> element for storyboards (eslint-disable removed)', () => {
    // Strip JSX/line comments before asserting no raw img
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(codeOnly).not.toContain('<img')
  })

  it('has no eslint-disable no-img-element comment', () => {
    expect(src).not.toContain('@next/next/no-img-element')
  })

  it('storyboard wrapper has relative positioning for fill', () => {
    expect(src).toContain('relative aspect-video')
  })

  it('provides sizes prop for responsive images', () => {
    expect(src).toContain('sizes=')
  })
})
```

### Source-scan tripwire — P17-03 archive pagination

```typescript
// apps/web/__tests__/archive-pagination.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const ARCHIVE_LIST_PATH = resolve(__dirname, '../components/archive/ArchiveList.tsx')
const PKG_PATH = resolve(__dirname, '../package.json')

describe('P17-03: ArchiveList has load-more pagination', () => {
  const src = readFileSync(ARCHIVE_LIST_PATH, 'utf-8')

  it('declares PAGE_SIZE constant', () => {
    expect(src).toContain('PAGE_SIZE')
  })

  it('tracks visibleCount state', () => {
    expect(src).toContain('visibleCount')
  })

  it('renders a load-more button when hasMore', () => {
    expect(src).toContain('hasMore')
    expect(src).toContain('Load')
  })

  it('load-more button has min-h-11 for touch target', () => {
    expect(src).toContain('min-h-11')
  })

  it('resets visibleCount on query/order change (useEffect)', () => {
    expect(src).toContain('setVisibleCount')
    expect(src).toContain('useEffect')
  })
})

describe('P17-03: no new npm dep added (dep count still 17)', () => {
  it('dependency count unchanged at 17', () => {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'))
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(17)
  })
})
```

---

## Environment Availability

Phase 17 is purely `apps/web` code/config changes with no external service dependencies beyond what is already deployed. `cdn.sanity.io` is already in `next.config.ts` remotePatterns.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `next/image` (bundled in `next`) | P17-01 storyboard conversion | Yes (already installed) | ^15.3.9 | — |
| `cdn.sanity.io` remotePattern | P17-01 next/image remote source | Yes (already in next.config.ts) | — | — |
| Tailwind `animate-pulse` | P17-04 skeleton shimmer | Yes (Tailwind v4 installed) | ^4.3.0 | CSS `@keyframes` fallback |

**No missing dependencies.** Step 2.6: All external requirements are already satisfied.

---

## Validation Architecture

*(nyquist_validation: true in .planning/config.json — section required.)*

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit` (same — no split in this project) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P17-01 | BonusSection uses `next/image` with `fill`, no raw `<img>` | source-scan | `pnpm --filter web test:unit -- --reporter=verbose` | ❌ Wave 0: `__tests__/bonus-section-image.test.ts` |
| P17-02 | CLS improvement on `/issue/[slug]` | Lighthouse manual | N/A — manual Lighthouse run, document in VERIFICATION.md | N/A (manual-only) |
| P17-03 | ArchiveList has PAGE_SIZE, visibleCount, load-more button | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0: `__tests__/archive-pagination.test.ts` |
| P17-04 | loading.tsx files exist at 4 route segments | source-scan (file-exists) | `pnpm --filter web test:unit` | ❌ Wave 0: add to `archive-pagination.test.ts` or dedicated `__tests__/loading-skeletons.test.ts` |
| P17-05 | /about page does not contain "This page is being written" | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0: `__tests__/about-page.test.ts` |
| P17-06 | _debug/convex has no `<main>` | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0: `__tests__/debug-route.test.ts` (or inline in existing tests) |
| P17-07 | All prior 234 tests still pass | regression | `pnpm --filter web test:unit` | ✅ Existing 26 test files, 234 tests |

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:unit` (3.32s, all 26+ files)
- **Per wave merge:** `pnpm --filter web test:unit` + `pnpm --filter web build` (build confirms no TypeScript/import regressions)
- **Phase gate:** Full suite green + manual Lighthouse CLS check documented in VERIFICATION.md before `/gsd:verify-work`

### Wave 0 Gaps (new test files needed before implementation)

- [ ] `apps/web/__tests__/bonus-section-image.test.ts` — P17-01 source-scan (6 assertions)
- [ ] `apps/web/__tests__/archive-pagination.test.ts` — P17-03 source-scan (5 assertions) + dep count guard
- [ ] `apps/web/__tests__/loading-skeletons.test.ts` — P17-04 existence check for all 4 loading.tsx files + no-`<main>` guard
- [ ] `apps/web/__tests__/about-page.test.ts` — P17-05 source-scan: no "being written" + has `article` wrapper
- [ ] `apps/web/__tests__/debug-route.test.ts` — P17-06 source-scan: no `<main>` in `%5Fdebug/convex/page.tsx`

Total new tests: approximately 20-25 assertions across 5 new test files. Running total after Phase 17: 254-260 passing.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact for Phase 17 |
|--------------|------------------|--------------|---------------------|
| Raw `<img>` with eslint-disable | `next/image` with `fill` | Phase 5 deferred as backlog 999.1 | Now completing the deferral |
| No loading states (content jump) | `loading.tsx` App Router convention | Next.js 13 App Router | Standard pattern; zero deps |
| Infinite list render | Load-more / pagination | Industry standard | Implementing client-side slice |

**Deprecated / outdated in this codebase:**
- `eslint-disable-next-line @next/next/no-img-element` in BonusSection.tsx — being removed.
- "This page is being written" placeholder in `about/page.tsx` — being replaced.
- Nested `<main>` in `%5Fdebug/convex/page.tsx` — being fixed.

---

## Open Questions

1. **Who writes the final /about copy?**
   - What we know: Andrew is the sole human editor; the brief says Andrew must supply `/about` copy.
   - What's unclear: Whether Andrew will provide copy before or after Phase 17 code lands.
   - Recommendation: Structure P17-05 as an `autonomous: false` plan where Andrew must paste approved copy. The developer commits the structural JSX (correct typography classes, article wrapper, Jesse-voice placeholder paragraph) and marks it with `TODO(Andrew): Replace with approved copy`. The plan is complete when the placeholder is removed from the rendered output.

2. **Storyboard images — quality vs. size tradeoff for `next/image`**
   - What we know: Storyboard images are uploaded by BonusWriter / Andrew to Sanity; they could be any resolution.
   - What's unclear: Whether Andrew uploads high-res images (large download) or already-optimized images.
   - Recommendation: `next/image` with `sizes` hint covers this automatically. The `quality` prop defaults to 75 in Next.js 15 — this is acceptable without explicit override.

3. **Loading skeleton for `/issue/[slug]/layout.tsx`**
   - What we know: The issue route has a `layout.tsx` (theme injection) AND a `page.tsx`. The layout fetches `QUERY_ISSUE_THEME` synchronously.
   - What's unclear: Does `loading.tsx` cover the layout's async fetch or only the page's?
   - Recommendation (HIGH confidence after checking Next.js docs): `loading.tsx` wraps the entire route segment including nested layouts. The layout theme fetch adds minimal latency (~50ms Sanity CDN). The loading.tsx skeleton will show until BOTH layout and page resolve. This is correct behavior.

---

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Next.js 14+/15, Sanity v3, Convex, Stripe — no substitutions.
- **No schema field renames** without checking `docs/API_CONTRACTS.md` first.
- **GSD workflow:** Use `/gsd:quick`, `/gsd:debug`, or `/gsd:execute-phase` — no direct repo edits outside GSD workflow unless user explicitly requests it.
- **Single `<main id="main">` landmark** — all route pages and loading.tsx files must use `<div>` or semantic elements other than `<main>`.
- **WCAG AA colors** — all color references must use `var(--color-*)` tokens; no hardcoded hex.
- **No new npm dependencies** — `archive-cardswap.test.ts` line 159 enforces `Object.keys(pkg.dependencies).length === 17`.
- **No CDN scripts** — no external `<script src=…>` or `@import url(…)`.
- **FONT_WHITELIST unchanged** — `theme-aa-tones.test.ts` and `archive-cardswap.test.ts` assert exact whitelist entries.
- **Commerce surface byte-unchanged** — `BuyButton.tsx`, checkout/webhook routes, `ShopCallout.tsx`, `lib/theme.ts` must not be touched.
- **DESIGNAGENT_SUPPRESSED flag** — the per-issue theme suppression architecture (Phase 12 MED-02) must remain intact.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection (all cited file paths) — source of truth for current state
- `apps/web/next.config.ts` — confirmed `cdn.sanity.io` remotePatterns present
- `apps/web/__tests__/archive-cardswap.test.ts` line 159 — confirms dep count assertion at 17
- `apps/web/vitest.config.ts` + CI run — confirmed 234/234 passing baseline
- Next.js 15 App Router docs (next/image fill, loading.tsx convention) — HIGH confidence, framework-native features

### Secondary (MEDIUM confidence)

- ROADMAP.md Phase 17 success criteria — authoritative scope definition
- 260520-0kt-SUMMARY.md — established `<main>` fix pattern (archive/charities) and `--color-*` convention

### Tertiary (LOW confidence)

- N=10 for PAGE_SIZE — pragmatic estimate based on weekly cadence + current issue count; not validated against user analytics

---

## Metadata

**Confidence breakdown:**
- Standard stack (next/image, loading.tsx): HIGH — framework-native, no new deps
- Architecture (fill vs. explicit dims, client-side load-more): HIGH — verified against actual code structure
- Pitfalls (missing `relative`, dep count assertion): HIGH — directly observed in codebase
- N=10 pagination threshold: LOW — reasonable estimate, planner may adjust

**Research date:** 2026-06-01
**Valid until:** Stable — Next.js 15 App Router conventions are stable; Tailwind v4 `animate-pulse` is stable. No time-sensitive APIs.
