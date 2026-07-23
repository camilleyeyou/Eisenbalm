'use client'
/**
 * quick 260723-4a6 (Task 1) — per-route browser-tab title for CLIENT-only
 * pages/frames that cannot export a static `metadata` object (Server
 * Components should prefer `export const metadata = { title: '…' }`
 * instead — see app/layout.tsx's `%s — Dispatch Control` template, which
 * this composes with).
 *
 * Renders nothing; only sets `document.title` on mount and whenever `title`
 * changes. Safe to mount anywhere below the root layout.
 */
import { useEffect } from 'react'

export default function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} — Dispatch Control`
  }, [title])

  return null
}
