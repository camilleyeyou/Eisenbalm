'use client'
/**
 * Persistent left sidebar chrome for Dispatch Control.
 * - Maps NAV_ITEMS to accessible nav links with active-route highlighting.
 * - Clerk <UserButton /> pinned in footer for sign-out affordance (D-10).
 * - Requires ≥44px tap targets + focus-visible ring on every link.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/nav'

export default function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-neutral-200 bg-white">
      {/* Brand header */}
      <div className="flex h-14 items-center border-b border-neutral-200 px-4">
        <span className="text-sm font-semibold tracking-wide text-neutral-900">
          Dispatch Control
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    // Base: min 44px height, full-width, rounded, flex row with icon + label
                    'flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-3 py-2.5',
                    'text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1',
                    isActive
                      ? 'bg-neutral-100 text-neutral-900'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User button pinned at bottom */}
      <div className="border-t border-neutral-200 p-3">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-8 w-8',
            },
          }}
        />
      </div>
    </aside>
  )
}
