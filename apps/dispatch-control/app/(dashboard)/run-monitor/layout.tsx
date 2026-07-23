'use client'
/**
 * Run Monitor tab shell (Phase 30 D-05).
 *
 * Renders the "Runs" / "Graph" tab bar above whichever sub-route is active,
 * so both /run-monitor/runs and /run-monitor/graph share one nav slot.
 * Active tab underlines in cobalt per the 1c token system. Tab mechanics are
 * intentionally minimal — Phase 37 replaces the interior of this shell.
 *
 * quick 260722-tv1: the tab bar is now `sticky top-0` (with an opaque rail
 * background) so it stays visible while a sub-route (e.g. the long Runs
 * table) scrolls underneath it.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Runs', href: '/run-monitor/runs' },
  { label: 'Graph', href: '/run-monitor/graph' },
]

export default function RunMonitorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 flex shrink-0 items-center gap-6 border-b border-[color:var(--color-faint)] bg-[color:var(--color-rail)] px-1">
        {TABS.map(tab => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'inline-flex min-h-[44px] items-center border-b-2 px-1 text-sm font-medium transition-colors',
                isActive
                  ? 'border-[color:var(--color-cobalt)] text-[color:var(--color-ink)]'
                  : 'border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
