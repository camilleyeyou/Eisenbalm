/**
 * quick 260723-4a6 (Task 1) — Signal Desk skeleton: a heading line + a grid
 * of candidate-card-shaped blocks.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function SignalDeskLoading() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-6 w-40" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="h-40" />
        ))}
      </div>
    </div>
  )
}
