/**
 * /issue/[slug] — Loading skeleton.
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <article> (mirrors page.tsx root) — never a main landmark
 * (root layout owns the single main#main; WCAG 1.3.1).
 *
 * Skeleton mirrors the page's hero + body container widths so there is
 * no content jump when the Server Component resolves.
 *
 * animate-pulse — built into Tailwind v4; no new CSS class.
 * --color-line  — hairline token in globals.css L65 (8% of text color).
 */
export default function IssueLoading() {
  return (
    <article className="pb-0 animate-pulse">
      {/* Hero block — mirrors IssueHero max-w-[860px] container */}
      <div className="mx-auto max-w-[860px] px-4 py-16 sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <div
          className="h-3 w-20 rounded bg-[color:var(--color-line)]"
          aria-hidden="true"
        />
        {/* Title line 1 */}
        <div
          className="mt-4 h-12 w-3/4 rounded bg-[color:var(--color-line)]"
          aria-hidden="true"
        />
        {/* Title line 2 */}
        <div
          className="mt-3 h-12 w-1/2 rounded bg-[color:var(--color-line)]"
          aria-hidden="true"
        />
        {/* Meta (date / reading time) */}
        <div
          className="mt-6 h-3 w-48 rounded bg-[color:var(--color-line)]"
          aria-hidden="true"
        />
      </div>

      {/* Body block — mirrors body container max-w-[680px] */}
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
