'use client'
/**
 * Phase 56 — the quiet footer under the parts: Hold this issue (ready) or
 * Stop writing this issue (writing). Stop always asks first (client bug 3).
 */
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { COPY } from '@/lib/editorState'

export interface HoldStopFooterProps {
  mode: 'hold' | 'stop'
  onHold?: () => void
  onStop?: () => void
  busy: boolean
  issueLabel: string
  error?: string | null
}

export default function HoldStopFooter({ mode, onHold, onStop, busy, issueLabel, error }: HoldStopFooterProps) {
  const confirm = useConfirm()

  async function onClick() {
    if (busy) return
    if (mode === 'hold') {
      onHold?.()
      return
    }
    const ok = await confirm({
      title: COPY.stopConfirmTitle,
      body: COPY.stopConfirmBody.replace('{issue}', issueLabel),
      confirmLabel: COPY.stopConfirm,
      cancelLabel: COPY.stopCancel,
      tone: 'default',
    })
    if (ok) onStop?.()
  }

  return (
    <div className="border-t border-[color:var(--color-line-strong)] pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.5] text-[color:var(--color-ink-soft)] max-w-[620px]">
        {mode === 'hold' ? COPY.holdExplanation : COPY.stopExplanation}
      </p>
      <div className="flex flex-col gap-2 sm:items-end">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy ? 'true' : undefined}
          onClick={() => void onClick()}
          className="min-h-[48px] w-full sm:w-auto px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[17px] font-semibold text-[color:var(--color-ink)] editor-focus disabled:opacity-60"
        >
          {mode === 'hold' ? COPY.holdButton : COPY.stopButton}
        </button>
        {error ? (
          <p role="alert" className="font-[family-name:var(--font-ui)] text-[16px] text-[color:var(--color-ink)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
