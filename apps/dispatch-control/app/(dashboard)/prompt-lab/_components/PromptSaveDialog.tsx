'use client'
/**
 * Phase 24 (PRM-03) + Prompt Lab Nomenclature Proposal (quick 260710-k8y) —
 * "Save draft as v{n}" dialog.
 *
 * A small inline panel: a REQUIRED note input (the institutional memory of why
 * an edit was made — see NOM-04) + confirm/cancel. The heading resolves the
 * next version number from api.promptVersions.listForAgent. On confirm it
 * calls api.promptVersions.saveVersion, which inserts a NEW immutable row
 * (never overwrites a prior version, never auto-activates — activation is the
 * explicit, guarded step in Plan 08).
 *
 * On success the parent clears its dirty flag and the version-history list
 * (subscribed via useQuery) updates reactively.
 */
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

interface PromptSaveDialogProps {
  workspaceId: string
  agentKey: string
  content: string
  /** Clerk user id (or undefined when unavailable) — recorded as createdBy. */
  createdBy?: string
  /** Disable confirm (e.g. when unknown variables block the save). */
  disabled?: boolean
  onSaved: () => void
  onCancel: () => void
}

export function PromptSaveDialog({
  workspaceId,
  agentKey,
  content,
  createdBy,
  disabled = false,
  onSaved,
  onCancel,
}: PromptSaveDialogProps) {
  const saveVersion = useMutation(api.promptVersions.saveVersion)
  const versions = useQuery(api.promptVersions.listForAgent, {
    workspace_id: workspaceId,
    agentKey,
  })
  const nextVersion =
    versions === undefined
      ? null
      : versions.length > 0
        ? Math.max(...versions.map(v => v.version)) + 1
        : 1
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const noteEmpty = note.trim().length === 0

  async function handleConfirm() {
    if (disabled || saving || noteEmpty) return
    setSaving(true)
    setError(null)
    try {
      await saveVersion({
        workspace_id: workspaceId,
        agentKey,
        content,
        createdBy,
        note: note.trim(),
      })
      setNote('')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save version')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">
        {nextVersion != null
          ? `Save draft as v${nextVersion}`
          : 'Save draft as new version'}
      </h3>
      <p className="text-xs text-neutral-500">
        Creates a new immutable version of <span className="font-mono">{agentKey}</span>.
        Prior versions are never overwritten and the new version is not activated
        until you roll forward.
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-neutral-600">
          Note (required) — what changed and why
        </span>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What changed and why"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
      </label>
      {noteEmpty && (
        <p className="text-xs text-neutral-500">
          A note is required — record what changed and why.
        </p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || saving || noteEmpty}
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
        >
          {saving ? 'Saving…' : 'Confirm save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
