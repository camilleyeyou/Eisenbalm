/**
 * quick 260723-4a6 (Task 1) — Configuration skeleton: a heading line + a
 * stack of panel-shaped cards (Automation / Budget Caps / Danger Zone).
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function ConfigLoading() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-6 w-40" />
      <SkeletonCard className="h-32" />
      <SkeletonCard className="h-32" />
      <SkeletonCard className="h-24" />
    </div>
  )
}
