'use client'

/**
 * Client-side theme re-validation — defense-in-depth. CONTEXT.md D-10 / D-11.
 *
 * The issue layout already injects a validated <style> block server-side
 * (serializeThemeCss) to prevent FOUC. This component runs after hydration
 * and re-applies the same validated values via element.style.setProperty(),
 * guarding against any client-side mutation that might bypass the server style.
 *
 * Security invariants (WEB-07, WEB-08, WEB-09):
 *   1. applyTheme() validates every hex value before setProperty().
 *   2. Only element.style.setProperty() is used — never cssText, never innerHTML.
 *   3. WCAG AA contrast check runs inside applyTheme(); fallback applied if fails.
 *
 * Returns null — no DOM output.
 */

import { useEffect } from 'react'
import { applyTheme } from '@/lib/theme'
import type { IssueTheme } from '@/lib/sanity/types'

interface ThemeApplierProps {
  theme: IssueTheme
}

export function ThemeApplier({ theme }: ThemeApplierProps) {
  useEffect(() => {
    applyTheme(document.documentElement, theme)
  }, [theme])

  return null
}
