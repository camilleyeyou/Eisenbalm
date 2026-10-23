/**
 * quick 260723-4a6 (Task 1) — Past issues skeleton. The old `/run-monitor`
 * route redirects to `/admin/runs`; this paints instantly during that
 * hop instead of a blank frame.
 */
import { SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function RunMonitorLoading() {
  return (
    <div className="space-y-4">
      <SkeletonLine className="h-6 w-40" />
      <SkeletonCard className="h-64" />
    </div>
  )
}
