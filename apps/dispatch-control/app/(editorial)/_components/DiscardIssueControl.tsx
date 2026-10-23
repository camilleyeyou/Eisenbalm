'use client'
/**
 * Quick 261022-x8y — quiet "Discard this issue" control under the parts.
 * Bordered, never primary. Always asks first.
 */
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { COPY } from '@/lib/editorState'

export interface DiscardIssueControlProps {
  onDiscard: () => void
  issueLabel: string
  busy: boolean
  pending: boolean
  error?: string | null
}

export default function DiscardIssueControl({ onDiscard, issueLabel, busy, pending, error }: DiscardIssueControlProps) {
  const confirm = useConfirm()

  async function onClick() {
    if (busy || pending) return
    const ok = await confirm({
      title: COPY.discardIssueConfirmTitle.replaceAll('{issue}', issueLabel),
      body: COPY.discardIssueConfirmBody.replaceAll('{issue}', issueLabel),
      confirmLabel: COPY.discardIssueConfirm,
      cancelLabel: COPY.discardIssueCancel,
      tone: 'default',
    })
    if (ok) onDiscard()
  }

  return (
    <div className="border-t border-[color:var(--color-line-strong)] pt-6 mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.5] text-[color:var(--color-ink-soft)] max-w-[620px]">
        {COPY.discardIssueExplanation}
      </p>
      <div className="flex flex-col gap-2 sm:items-end">
        <button
          type="button"
          disabled={busy || pending}
          aria-busy={busy ? 'true' : undefined}
          onClick={() => void onClick()}
          className="min-h-[48px] w-full sm:w-auto px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[17px] font-semibold text-[color:var(--color-ink)] editor-focus disabled:opacity-60"
        >
          {COPY.discardIssueButton}
        </button>
        {pending ? (
          <p role="status" className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]">
            {COPY.discardIssuePending.replaceAll('{issue}', issueLabel)}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
