/**
 * quick 260723-4a6 (Task 1) — Issues home skeleton: a heading line + a grid
 * of issue-card-shaped blocks, painted instantly on navigation instead of a
 * blank frame.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function IssuesLoading() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-6 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}
