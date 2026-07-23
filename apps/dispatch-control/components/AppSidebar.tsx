'use client'
/**
 * Persistent left sidebar chrome for Dispatch Control (CHR-03, dc.html 1c skin).
 * - Sign-out affordance now lives in the Masthead (Plan 30-04) — no duplicate
 *   UserButton here.
 * - Requires ≥44px tap targets + focus-visible ring on every link (enforced
 *   inside `SidebarNav`).
 * - quick 260722-tv1: `h-screen` clipped the mt-auto bottom block inside the
 *   100vh-52px overflow-hidden shell row — use `h-full` to fit the row instead.
 * - quick 260722-v01: the nav content (NAV_GROUPS mapping, NavLink helper,
 *   NAV_PINNED block, RoleIndicator) was extracted to `SidebarNav.tsx` so the
 *   mobile off-canvas drawer (`MobileNavDrawer.tsx`) can render the identical
 *   nav. This `<aside>` is now `hidden md:flex` — removed from the flow below
 *   md, unchanged 210px in-flow at md+.
 */
import SidebarNav from './SidebarNav'

export default function AppSidebar() {
  return (
    <aside className="hidden h-full w-[210px] flex-col border-r border-[color:var(--color-ink)]/[.13] bg-[color:var(--color-nav)] py-[14px] md:flex">
      <SidebarNav />
    </aside>
  )
}
