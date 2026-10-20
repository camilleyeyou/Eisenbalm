'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

// '/index' is how Next reports the root path when Vercel ISR regenerates '/'.
export function isDispatchRoute(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === '/' || pathname === '/index' || pathname.startsWith('/issue/'))
}

/**
 * Swaps header/footer slots by route. Renders slots only; the root layout keeps
 * the single `<main id="main">` (WCAG 1.3.1). The footer slot sits outside main
 * so it is a contentinfo landmark.
 */
export function ChromeSwitch({ site, dispatch = null }: { site: ReactNode; dispatch?: ReactNode }) {
  const pathname = usePathname()
  return <>{isDispatchRoute(pathname) ? dispatch : site}</>
}
