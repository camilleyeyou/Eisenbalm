/**
 * quick 260723-4a6 (Task 1) — Agent Instructions skeleton: a heading line +
 * a grid of prompt-card-shaped blocks.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function PromptLabLoading() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-6 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}
