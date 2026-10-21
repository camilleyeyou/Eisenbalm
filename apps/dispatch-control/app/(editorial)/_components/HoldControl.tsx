'use client'
/**
 * Quick 261021-j83 (D-2) — Hold / Release on the front door. Any signed-in
 * role may hold and release (server uses requireOperator). Logic copied from
 * the retired WorkspaceControls: hold first, then cancel the run only when
 * asked, tolerating a cancel failure.
 */
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { useAuth } from '@clerk/nextjs'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { cancelRun } from '@/lib/pipelineControlClient'
import type { HomeFooter } from '@/lib/homeSections'
import HoldDialog from './HoldDialog'
import { relativeTime } from './HeldIssueRow'

interface Props {
  footerKind: HomeFooter['kind']
  issueNumber: number | null
  runId: string | null
  held: boolean | undefined
  heldReason?: string
  heldBy?: string
  heldAt?: number
}

const BTN =
  'flex min-h-[44px] items-center border border-[color:var(--color-ink)] bg-white px-5 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]'

export default function HoldControl(props: Props) {
  const { footerKind, issueNumber: n, runId, held, heldReason, heldBy, heldAt } = props
  const { getToken } = useAuth()
  const holdMutation = useMutation(api.issues.hold)
  const reopenMutation = useMutation(api.issues.reopen)
  const [showDialog, setShowDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (n == null || held === undefined) return null
  if (footerKind === 'none' || footerKind === 'loading' || footerKind === 'published') return null

  async function handleHold({ reason, stopRun }: { reason: string; stopRun: boolean }) {
    setBusy(true)
    setError(null)
    try {
      await holdMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n as number, reason })
      if (stopRun && runId) {
        try {
          await cancelRun(runId, await getToken())
        } catch {
          // Tolerated: the issue is already held either way.
        }
      }
      setShowDialog(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleRelease() {
    setError(null)
    try {
      await reopenMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n as number })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {held ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--color-faint)] bg-white p-4">
          <span className="font-[family-name:var(--font-ui)] text-[14px] text-[color:var(--color-ink)]">
            Held · {heldReason ?? '—'} · {heldBy ?? '—'} · {relativeTime(heldAt)}
          </span>
          <button type="button" onClick={() => void handleRelease()} className={BTN}>
            Release hold
          </button>
        </div>
      ) : showDialog ? (
        <HoldDialog
          issueNumber={n}
          onHold={args => void handleHold(args)}
          onCancel={() => {
            setShowDialog(false)
            setError(null)
          }}
          busy={busy}
        />
      ) : (
        <div>
          <button type="button" onClick={() => setShowDialog(true)} className={BTN}>
            Hold issue
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
