/**
 * quick 260723-4a6 (Task 1) — Quality Tests skeleton: a heading line + a
 * grid of scenario-card-shaped blocks.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function EvalCenterLoading() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-6 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}
