'use client'
/**
 * Persistent left sidebar chrome for Dispatch Control (CHR-03, dc.html 1c skin).
 * - Renders NAV_GROUPS as three labeled sections, then NAV_PINNED ("How to use")
 *   pinned at the bottom via mt-auto, followed by the Phase 50 (WBN-01, D-05)
 *   signed-in role indicator.
 * - Active-state formula (RESEARCH, verbatim from dc.html): 3px vermilion left
 *   border + ink background + masthead-text color when active; faint text +
 *   transparent border when inactive.
 * - Sign-out affordance now lives in the Masthead (Plan 30-04) — no duplicate
 *   UserButton here.
 * - Requires ≥44px tap targets + focus-visible ring on every link.
 * - quick 260722-tv1: `h-screen` clipped the mt-auto bottom block inside the
 *   100vh-52px overflow-hidden shell row — use `h-full` to fit the row instead.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, NAV_PINNED } from '@/lib/nav'
import { useRole } from '@/lib/role'

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

/**
 * Phase 50 (WBN-01, D-05) — the signed-in role indicator, bottom-left of the
 * sidebar (Annotations §Nav). Presentation-only: `useRole()` (Phase 49,
 * `lib/role.ts`) is a client rendering hint, never a security boundary — the
 * server dependency (`_require_editor` / `requireEditor`) remains the
 * authoritative gate.
 *
 * Renders nothing while `useRole()` returns undefined (Clerk still loading),
 * so an Editor-in-chief is never flashed a "Collaborator" readout mid-load.
 */
function RoleIndicator() {
  const role = useRole()
  if (!role) return null

  return (
    <p
      data-testid="role-indicator"
      className="px-4 pt-3 font-[family-name:var(--font-ui)] text-[11px] text-[color:var(--color-faint)]"
    >
      Signed in as {role}
    </p>
  )
}

export default function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-[210px] flex-col border-r border-[color:var(--color-ink)]/[.13] bg-[color:var(--color-nav)] py-[14px]">
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
          <RoleIndicator />
        </div>
      </nav>
    </aside>
  )
}
