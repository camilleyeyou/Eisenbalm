'use client'
/**
 * Shared shell for the past-issues list and the map page (plan 56-10).
 *
 * Renders the sub-page slab ("Nothing here is needed to publish this week's
 * issue.", ghost "Back to behind the scenes") and a plain two-link row. A single
 * issue page ([runId]) owns its own slab, so this shell adds nothing extra there.
 *
 * Root stays `flex min-h-0 flex-1 flex-col` so the map page's `h-full` chain
 * sizes to the space left under the dashboard banner (quick 260722-v01).
 */
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { cn } from '@/lib/utils'
import { COPY } from '@/lib/editorState'
import NextStepSlab from '@/components/editor/NextStepSlab'

const LINKS = [
  { label: 'Every issue', href: '/admin/runs', segment: null },
  { label: 'How the steps connect', href: '/admin/runs/graph', segment: 'graph' },
] as const

export default function RunMonitorLayout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment()

  // A single issue page (segment is its id) brings its own slab and navigation.
  if (segment !== null && segment !== 'graph') {
    return <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-4">
        <NextStepSlab sentence={COPY.subPageSlab} ghost={{ label: COPY.backToBehind, href: '/admin' }} />
      </div>
      <nav
        aria-label="Past issues"
        className="sticky top-0 z-20 flex shrink-0 items-center gap-6 border-b border-[color:var(--color-faint)] bg-[color:var(--color-rail)] px-1"
      >
        {LINKS.map(link => {
          const isActive = segment === link.segment
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex min-h-[48px] items-center font-[family-name:var(--font-ui)] text-[15px] transition-colors editor-focus',
                isActive
                  ? 'font-semibold text-[color:var(--color-ink)] underline'
                  : 'text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
