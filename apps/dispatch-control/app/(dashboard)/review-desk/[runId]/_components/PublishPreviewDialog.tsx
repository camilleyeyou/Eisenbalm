'use client'
/**
 * Phase 41 Plan 41-09 (WSP-06, D-15) — the publish exact-preview interstitial.
 *
 * There is no typed-confirmation step to remove anywhere in this codebase
 * (verified — 41-RESEARCH Pitfall 1): `DecisionRail.handlePublish()` calls
 * `publishIssue(token, runId)` directly today, with zero confirmation of any
 * kind. This dialog is NET-NEW UI sitting between the Publish button and
 * that SAME unchanged function — an exact preview (destination / title /
 * time / consequences) plus one confirmation click. There is deliberately
 * NO typed-input anywhere in this component: "routine weekly approval is
 * deliberately not scary" (PROJECT.md milestone locked decision #2).
 */
interface PublishPreviewDialogProps {
  issueNumber?: number
  charityName?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export default function PublishPreviewDialog({
  issueNumber,
  charityName,
  onConfirm,
  onCancel,
  busy,
}: PublishPreviewDialogProps) {
  const issueLabel = issueNumber ?? '?'
  const title = `Issue ${issueLabel} — ${charityName ?? '(charity)'}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Publish preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-[420px] flex-col gap-4 border border-[color:var(--color-faint)] bg-white p-5">
        <h2 className="font-[family-name:var(--font-display,inherit)] text-[17px] font-semibold text-[color:var(--color-ink)]">
          Publish this issue?
        </h2>
        <dl className="flex flex-col gap-2 text-[13px] text-[color:var(--color-ink)]">
          <div>
            <dt className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
              Destination
            </dt>
            <dd>the public Dispatch site</dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
              Title
            </dt>
            <dd>{title}</dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
              Time
            </dt>
            <dd>Now — publishes immediately</dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
              Consequences
            </dt>
            <dd>Publishes Issue {issueLabel} to the live site and locks further edits.</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-[44px] flex-1 bg-[color:var(--color-ink)] px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-paper,#f4f2ec)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publish now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] flex-1 border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.06em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
