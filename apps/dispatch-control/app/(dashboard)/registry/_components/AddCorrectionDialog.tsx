'use client'
/**
 * Phase 39 — MEM-02: Add Correction form.
 *
 * Per-charity append-only correction entry, mounted inside a Registry row's
 * expanded detail (RegistryTable.tsx). Calls charityCorrections.append
 * (requireOperator-guarded + audit-logged, see 39-01) with the charity's
 * EXISTING dedupKey as charityKey — this component never re-derives a dedup
 * key from a raw name/website pair (Pitfall 5).
 *
 * No edit/delete affordance exists here or anywhere in the corrections UI —
 * corrections are append-only (D-05/D-06).
 */
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'

interface AddCorrectionDialogProps {
  workspace_id: string
  charity: {
    dedupKey?: string
    sanityCharityId?: string
    name: string
  }
}

export default function AddCorrectionDialog({ workspace_id, charity }: AddCorrectionDialogProps) {
  const appendCorrection = useMutation(api.charityCorrections.append)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasKey = Boolean(charity.dedupKey)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasKey || !text.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await appendCorrection({
        workspace_id,
        charityKey: charity.dedupKey!,
        sanityCharityId: charity.sanityCharityId,
        text: text.trim(),
      })
      setText('')
    } catch {
      setError('Could not save the correction. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!hasKey) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[12px] italic text-[color:var(--color-ink-soft)]">
        This charity predates dedup keys; corrections unavailable.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label
        htmlFor={`correction-text-${charity.name}`}
        className="font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-ink-soft)]"
      >
        Add correction
      </label>
      <textarea
        id={`correction-text-${charity.name}`}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe the correction…"
        rows={3}
        className="w-full border border-[color:var(--color-faint)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
      />
      {error && (
        <p role="alert" className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!text.trim() || submitting}
        aria-busy={submitting}
        className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
      >
        {submitting ? 'Saving…' : 'Add correction'}
      </button>
    </form>
  )
}
