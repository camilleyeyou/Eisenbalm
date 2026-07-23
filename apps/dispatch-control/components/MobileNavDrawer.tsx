'use client'
/**
 * quick 260722-v01: below-md off-canvas navigation (audit item 1).
 *
 * Fully self-contained: owns its own `open` state, hamburger trigger, backdrop,
 * and drawer — mounted once from `app/(dashboard)/layout.tsx`, NOT from
 * `Masthead.tsx` (Masthead.test.tsx does not mock `next/navigation` or
 * `@/lib/role`; importing this component into Masthead would pull in
 * `usePathname`/`useRole` and break that test).
 *
 * The hamburger sits fixed over the ink masthead's left edge (`md:hidden`);
 * the drawer renders the SAME `SidebarNav` content the desktop `<aside>`
 * renders, so there is exactly one nav data source for both surfaces.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import SidebarNav from './SidebarNav'

export default function MobileNavDrawer() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const drawerRef = useRef<HTMLElement>(null)

  const close = () => setOpen(false)

  // Route change closes the drawer.
  useEffect(() => {
    close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Escape closes the drawer while open.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Best-effort focus of the first link on open.
  useEffect(() => {
    if (!open) return
    const firstLink = drawerRef.current?.querySelector<HTMLAnchorElement>('a')
    firstLink?.focus()
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className="fixed left-[8px] top-0 z-[60] flex h-[52px] min-h-[44px] min-w-[44px] items-center justify-center text-[color:var(--color-masthead-text)] md:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 cursor-default md:hidden"
            onClick={close}
          />
          <aside
            id="mobile-nav-drawer"
            ref={drawerRef}
            className="fixed left-0 top-[52px] z-50 h-[calc(100%-52px)] w-[240px] overflow-y-auto border-r border-[color:var(--color-ink)]/[.13] bg-[color:var(--color-nav)] py-[14px] md:hidden"
          >
            <SidebarNav onNavigate={close} />
          </aside>
        </>
      )}
    </>
  )
}
