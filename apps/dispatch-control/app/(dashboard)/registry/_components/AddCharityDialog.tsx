'use client'
/**
 * Phase 26 — REG-01: Add Charity dialog.
 *
 * Triggered by the "Add Charity" primary button on the registry page.
 * Calls charities:upsertCandidate — manual adds enter as candidates.
 *
 * Non-modal inline panel pattern (matches PromptSaveDialog precedent in Phase 24).
 * On success: closes the form. On failure: shows error copy from UI-SPEC.
 *
 * quick 260724-lp1: token/radius hygiene — 1c tokens, hard edges. Same
 * fields, handlers, and mutation call.
 */
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { X } from 'lucide-react'
import { api } from '@convex/_generated/api'

interface AddCharityDialogProps {
  workspace_id: string
  onClose: () => void
}

export default function AddCharityDialog({ workspace_id, onClose }: AddCharityDialogProps) {
  const upsertCandidate = useMutation(api.charities.upsertCandidate)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await upsertCandidate({
        workspace_id,
        name: name.trim(),
        website: website.trim() || undefined,
        runId: 'manual',
      })
      onClose()
    } catch {
      setError('Could not update the registry. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-charity-heading"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5 space-y-4 shadow-md"
    >
      <div className="flex items-center justify-between">
        <h2
          id="add-charity-heading"
          className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[color:var(--color-ink)]"
        >
          Add Charity
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close add charity dialog"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="charity-name" className="font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-ink-soft)]">
            Name <span aria-hidden="true" className="text-[color:var(--color-vermilion)]">*</span>
          </label>
          <input
            id="charity-name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Charity name"
            className="w-full border border-[color:var(--color-faint)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="charity-website" className="font-[family-name:var(--font-ui)] text-[13px] font-medium text-[color:var(--color-ink-soft)]">
            Website <span className="text-[color:var(--color-faint)] text-[11px] font-normal">(optional)</span>
          </label>
          <input
            id="charity-website"
            type="url"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="https://example.org"
            className="w-full border border-[color:var(--color-faint)] px-3 py-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          />
        </div>

        {error && (
          <p role="alert" className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-vermilion)]">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            aria-busy={submitting}
            className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            {submitting ? 'Adding…' : 'Add Charity'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] border border-[color:var(--color-faint)] px-4 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
