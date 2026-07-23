/**
 * quick 260723-4a6 (Task 1) — Run Details skeleton. The bare `/run-monitor`
 * route redirects to `/run-monitor/runs`; this paints instantly during that
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
