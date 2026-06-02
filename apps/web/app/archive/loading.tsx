/**
 * /archive — Loading skeleton.
 *
 * App Router auto-wraps this in <Suspense>; do NOT add <Suspense> here.
 * Root element is <div> — never a main landmark (root layout owns main#main).
 *
 * Mirrors archive/page.tsx container (max-w-[1100px]) with a title bar,
 * subtitle bar, CardSwap-area block, and 5 ArchiveList row bars.
 *
 * animate-pulse — built into Tailwind v4; no new CSS class.
 * --color-line  — hairline token in globals.css L65 (8% of text color).
 */
export default function ArchiveLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-8 animate-pulse">
      {/* Title */}
      <div
        className="h-8 w-32 rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />
      {/* Subtitle */}
      <div
        className="mt-3 h-3 w-64 rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />

      {/* CardSwap area block */}
      <div
        className="mt-8 h-48 w-full rounded bg-[color:var(--color-line)]"
        aria-hidden="true"
      />

      {/* ArchiveList rows */}
      <div className="mt-8 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full rounded bg-[color:var(--color-line)]"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
