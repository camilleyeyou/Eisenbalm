'use client'
/**
 * Quick 261021-j83 (D-5) — the ONE "Start issue" control, on the front door.
 *
 * Enabled when no issue is in flight (none / published / failed) or when the
 * current issue is held. Any signed-in role may start (the server route only
 * requires a Clerk JWT). One click opens an inline confirm; confirming calls
 * POST /pipeline/run once and latches busy until the result arrives.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { triggerRun } from '@/lib/pipelineControlClient'
import type { HomeFooter } from '@/lib/homeSections'

export const START_BUSY_REASON = 'An issue is already in progress.'
export const START_CONFLICT_MESSAGE =
  'Another issue is already being written, or the monthly budget is used up.'

const ENABLED =
  'min-h-[44px] bg-[color:var(--color-cobalt)] px-6 font-[family-name:var(--font-ui)] text-[15px] font-medium text-white'
const DISABLED =
  'min-h-[44px] cursor-not-allowed bg-[#d6d3cb] px-6 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]'
const SECONDARY =
  'min-h-[44px] border border-[color:var(--color-ink)] bg-white px-5 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]'

export function canStartIssue(kind: HomeFooter['kind'], held: boolean | undefined): boolean {
  if (kind === 'none' || kind === 'published' || kind === 'failed' || kind === 'stopped') return true
  return held === true && kind !== 'loading'
}

export function startErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const m = /\((\d{3})\)(?::\s*(.*))?$/s.exec(msg)
  if (m && m[1] === '409') {
    return m[2] ? `${START_CONFLICT_MESSAGE} (${m[2]})` : START_CONFLICT_MESSAGE
  }
  return msg
}

interface Props {
  footerKind: HomeFooter['kind']
  held: boolean | undefined
}

export default function StartIssueButton({ footerKind, held }: Props) {
  const { getToken } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (footerKind === 'loading') return null
  const enabled = canStartIssue(footerKind, held)

  async function onConfirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await triggerRun({}, await getToken())
      setConfirming(false)
    } catch (e) {
      setError(startErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {confirming && enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]">
            Start a new issue now?
          </p>
          <button type="button" disabled={busy} onClick={() => void onConfirm()} className={busy ? DISABLED : ENABLED}>
            {busy ? 'Starting…' : 'Start'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={SECONDARY}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!enabled}
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
            className={enabled ? ENABLED : DISABLED}
          >
            Start issue
          </button>
          {!enabled ? (
            <span className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
              {START_BUSY_REASON}
            </span>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="font-[family-name:var(--font-ui)] text-[13px] text-[#c43a14]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
