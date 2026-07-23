/**
 * quick 260723-4a6 (Task 1) — My Tasks skeleton: a heading line + a stack of
 * task-row-shaped blocks.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function MyTasksLoading() {
  return (
    <div className="space-y-4">
      <SkeletonLine className="h-6 w-48" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-20" />
        ))}
      </div>
    </div>
  )
}
