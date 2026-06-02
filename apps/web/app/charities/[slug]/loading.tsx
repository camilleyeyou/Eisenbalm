/**
 * /charities/[slug] — Loading skeleton.
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <div> — never a main landmark (root layout owns main#main).
 *
 * Mirrors the CharityDetail layout with a name bar, meta row, and 5 prose
 * lines inside a max-w-[760px] container.
 *
 * animate-pulse — built into Tailwind v4; no new CSS class.
 * --color-line  — hairline token in globals.css L65 (8% of text color).
 */
export default function CharityDetailLoading() {
  return (
    <div className="mx-auto max-w-[760px] px-4 md:px-6 lg:px-8 py-16 animate-pulse">
      {/* Charity name */}
      <div
        className="h-10 w-2/3 rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />
      {/* Meta row (location / focus area) */}
      <div
        className="mt-4 h-3 w-40 rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />

      {/* Prose lines */}
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-[color:var(--color-line)] ${i === 4 ? 'w-3/4' : 'w-full'}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
