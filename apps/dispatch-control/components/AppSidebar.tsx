'use client'
/**
 * Persistent left sidebar chrome for Dispatch Control (CHR-03, dc.html 1c skin).
 * - Renders NAV_GROUPS as three labeled sections, then NAV_PINNED ("How to use")
 *   pinned at the bottom via mt-auto.
 * - Active-state formula (RESEARCH, verbatim from dc.html): 3px vermilion left
 *   border + ink background + masthead-text color when active; faint text +
 *   transparent border when inactive.
 * - Sign-out affordance now lives in the Masthead (Plan 30-04) — no duplicate
 *   UserButton here.
 * - Requires ≥44px tap targets + focus-visible ring on every link.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, NAV_PINNED } from '@/lib/nav'

function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-[44px] items-center gap-[11px] border-l-[3px] px-4 py-2',
        'font-[family-name:var(--font-ui)] text-[12.5px] tracking-[.01em] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1',
        active
          ? 'border-[color:var(--color-vermilion)] bg-[color:var(--color-ink)] font-semibold text-[color:var(--color-masthead-text)]'
          : 'border-transparent font-medium text-[#4a453b] hover:bg-[color:var(--color-ink)]/[.05]',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span>{label}</span>
    </Link>
  )
}

export default function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[210px] flex-col border-r border-[color:var(--color-ink)]/[.13] bg-[color:var(--color-nav)] py-[14px]">
      <nav className="flex flex-1 flex-col overflow-y-auto" aria-label="Main navigation">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label}>
            <p
              className={cn(
                'px-4 font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[.14em] text-[color:var(--color-faint)]',
                groupIndex === 0 ? 'pb-2 pt-1' : 'pb-2 pt-4',
              )}
            >
              {group.label}
            </p>
            <ul className="space-y-0" role="list">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href} label={item.label} active={isActiveHref(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-auto pt-4">
          <NavLink
            href={NAV_PINNED.href}
            label={NAV_PINNED.label}
            active={isActiveHref(pathname, NAV_PINNED.href)}
          />
        </div>
      </nav>
    </aside>
  )
}
