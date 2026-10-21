/**
 * quick 260723-4a6 (Task 1) — Settings skeleton: a heading line + a stack of
 * panel-shaped cards.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <SkeletonLine className="h-6 w-32" />
      <SkeletonCard className="h-32" />
      <SkeletonCard className="h-40" />
    </div>
  )
}
