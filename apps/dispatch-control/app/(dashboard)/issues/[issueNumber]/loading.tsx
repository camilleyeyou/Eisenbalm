/**
 * quick 260723-4a6 (Task 1) — Issue Workspace frame skeleton.
 *
 * Fires on EVERY stage switch (Story/Draft/Fact Check/Voice/Approval are
 * sibling routes under this segment), so it must mirror the frame
 * (`layout.tsx`'s FrameChrome) closely enough that navigating between
 * stages paints an instant, layout-matched placeholder instead of a blank
 * frame: a back-link line, an "Issue —" heading, a row of 5 tab-shaped
 * blocks, then the 3-column (outline / canvas / context) grid.
 */
import { Skeleton, SkeletonLine, SkeletonCard } from '@/components/ui/Skeleton'

export default function IssueWorkspaceLoading() {
  return (
    <div className="min-h-full bg-[color:var(--color-rail)] py-2">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <SkeletonLine className="h-4 w-32" />
        <SkeletonLine className="h-7 w-56" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[232px_minmax(0,1fr)_320px]">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-64" />
        </div>
      </div>
    </div>
  )
}
