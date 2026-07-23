/**
 * quick 260723-4a6 (Task 1) — the shared shimmer skeleton primitive.
 *
 * Server Component (no 'use client') — a plain `<div>` with Tailwind's
 * built-in `animate-pulse`, so it works identically inside Server Component
 * `loading.tsx` segments and inside 'use client' screens swapping an inline
 * "Loading…" string for a shape-matched placeholder. Sizing is entirely
 * caller-driven via `className` (e.g. `h-4 w-40`) — this file stays tiny and
 * carries no layout opinions of its own.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[2px] bg-[color:var(--color-card-alt)] ${className}`}
    />
  )
}

/** One text-line-shaped block — the most common skeleton unit. */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-3 w-full ${className}`} />
}

/** A bordered card containing 3 varied-width lines — stands in for a summary
 * card, a table row, or any small content block while it loads. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4 ${className}`}
    >
      <div className="flex flex-col gap-2">
        <SkeletonLine className="w-3/4" />
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-1/2" />
      </div>
    </div>
  )
}
