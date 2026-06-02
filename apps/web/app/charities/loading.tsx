/**
 * /charities — Loading skeleton.
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <div> — never a main landmark (root layout owns main#main).
 *
 * Mirrors charities/page.tsx container (max-w-[1100px]) with a title bar,
 * subtitle bar, and a 3-column grid of 6 CharityCard placeholder blocks.
 *
 * animate-pulse — built into Tailwind v4; no new CSS class.
 * --color-line  — hairline token in globals.css L65 (8% of text color).
 */
export default function CharitiesLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12 animate-pulse">
      {/* Title */}
      <div
        className="h-9 w-40 rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />
      {/* Subtitle */}
      <div
        className="mt-3 h-3 w-72 rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />

      {/* Card grid — mirrors CharityCard grid layout */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 w-full rounded bg-[color:var(--color-line)]"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
