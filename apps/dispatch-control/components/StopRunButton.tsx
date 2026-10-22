'use client'
/**
 * Quick 261022-cr6 (client bug 3) — "Stop this issue" with an inline confirm.
 *
 * Used on the front page and the Admin run page for a run paused at the
 * Gate-1 interrupt. Calls POST /runs/{id}/cancel (Clerk-guarded FastAPI),
 * which lands a terminal status for a paused run. Any signed-in role may use
 * it, as with HoldControl; the server JWT is the guard. The Convex
 * subscription flips the page on its own once the status lands.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { cancelRun } from '@/lib/pipelineControlClient'

const PRIMARY =
  'min-h-[44px] bg-[color:var(--color-ink)] px-5 font-[family-name:var(--font-ui)] text-[15px] font-medium text-white'
const SECONDARY =
  'min-h-[44px] border border-[color:var(--color-ink)] bg-white px-5 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]'

interface Props {
  runId: string
  onStopped?: () => void
}

export default function StopRunButton({ runId, onStopped }: Props) {
  const { getToken } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await cancelRun(runId, await getToken())
      if (r.stopped || r.alreadyTerminal || r.cancelRequested) {
        setStopped(true)
        setConfirming(false)
        onStopped?.()
      }
    } catch (e) {
      setError(`Could not stop it. ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  if (stopped) {
    return (
      <p role="status" className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        Stopped.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]">
            Stop it? This older issue can&apos;t be resumed. You can start a new one right after.
          </p>
          <button type="button" disabled={busy} onClick={() => void onConfirm()} className={PRIMARY}>
            {busy ? 'Stopping…' : 'Stop it'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={SECONDARY}>
            Keep it
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
            className={SECONDARY}
          >
            Stop this issue
          </button>
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
