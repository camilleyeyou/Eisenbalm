'use client'
/**
 * Phase 26 — REG-01: Add Charity dialog.
 *
 * Triggered by the "Add Charity" primary button on the registry page.
 * Calls charities:upsertCandidate — manual adds enter as candidates.
 *
 * Non-modal inline panel pattern (matches PromptSaveDialog precedent in Phase 24).
 * On success: closes the form. On failure: shows error copy from UI-SPEC.
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
      className="rounded-lg border border-neutral-200 bg-white p-5 space-y-4 shadow-md"
    >
      <div className="flex items-center justify-between">
        <h2
          id="add-charity-heading"
          className="text-base font-semibold text-neutral-900"
        >
          Add Charity
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close add charity dialog"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="charity-name" className="text-sm font-medium text-neutral-700">
            Name <span aria-hidden="true" className="text-red-600">*</span>
          </label>
          <input
            id="charity-name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Charity name"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="charity-website" className="text-sm font-medium text-neutral-700">
            Website <span className="text-neutral-400 text-xs font-normal">(optional)</span>
          </label>
          <input
            id="charity-website"
            type="url"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="https://example.org"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            aria-busy={submitting}
            className="min-h-[44px] rounded bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          >
            {submitting ? 'Adding…' : 'Add Charity'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] rounded border border-neutral-300 px-4 text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
