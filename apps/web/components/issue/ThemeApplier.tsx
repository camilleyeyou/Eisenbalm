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
 * MED-02: when suppressed={true}, the useEffect early-returns without calling
 * applyTheme. globals.css :root dark palette is the sole source of colors/fonts.
 * The prop is optional so no existing caller needs updating.
 *
 * Returns null — no DOM output.
 */

import { useEffect } from 'react'
import { applyTheme } from '@/lib/theme'
import type { IssueTheme } from '@/lib/sanity/types'

interface ThemeApplierProps {
  theme: IssueTheme
  suppressed?: boolean
}

export function ThemeApplier({ theme, suppressed }: ThemeApplierProps) {
  useEffect(() => {
    if (suppressed) return  // globals.css :root wins; setProperty not called (MED-01/MED-02)
    applyTheme(document.documentElement, theme)
  }, [theme, suppressed])

  return null
}
