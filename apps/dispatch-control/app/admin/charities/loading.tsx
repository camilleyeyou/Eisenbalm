/**
 * quick 260723-4a6 (Task 1) — Editorial Memory skeleton: a heading line + a
 * table-shaped stack of rows.
 */
import { SkeletonLine } from '@/components/ui/Skeleton'

export default function RegistryLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <SkeletonLine className="h-6 w-48" />
        <SkeletonLine className="h-9 w-32" />
      </div>
      <div className="flex flex-col gap-2 rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLine key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}
