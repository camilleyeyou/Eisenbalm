'use client'
/**
 * Quick 260724-i5n (LD-5) — "Mark reviewed" is a client-only nav aid, NOT a
 * publish gate: state lives entirely in `localStorage`, keyed per run
 * (`reviewDesk:reviewed:<runId>`), and is read/written here only. Nothing in
 * this hook talks to Convex or the pipeline API, and nothing downstream
 * (Approval stage, DecisionRail, the server publish gate) ever reads this
 * key — reviewing a story here changes no gate.
 *
 * SSR-safe: the lazy initializer guards `typeof window === 'undefined'` so
 * this hook never throws during a server render; `toggle` similarly guards
 * before touching `window.localStorage`.
 */
import { useCallback, useState } from 'react'

function storageKey(runId: string): string {
  return `reviewDesk:reviewed:${runId}`
}

function readReviewed(runId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(runId))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    // Malformed/inaccessible storage — degrade to "nothing reviewed yet",
    // never a crash.
    return new Set()
  }
}

function writeReviewed(runId: string, reviewed: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(runId), JSON.stringify(Array.from(reviewed)))
  } catch {
    // Best-effort persistence only — a full/blocked localStorage must never
    // break the nav aid itself.
  }
}

export interface UseReviewedSectionsResult {
  reviewed: Set<string>
  isReviewed: (id: string) => boolean
  toggle: (id: string) => void
  count: number
}

export function useReviewedSections(runId: string): UseReviewedSectionsResult {
  const [reviewed, setReviewed] = useState<Set<string>>(() => readReviewed(runId))

  const toggle = useCallback(
    (id: string) => {
      setReviewed(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        writeReviewed(runId, next)
        return next
      })
    },
    [runId],
  )

  const isReviewed = useCallback((id: string) => reviewed.has(id), [reviewed])

  return { reviewed, isReviewed, toggle, count: reviewed.size }
}
