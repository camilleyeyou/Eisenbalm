'use client'
/**
 * Phase 47 (BRF-05, docs/API_CONTRACTS.md §47.1/§47.5) — BriefFieldTable: the
 * editable six-field Brief table.
 *
 * Pure, props-driven component (mirrors LeadCard.tsx's presentational
 * discipline) — takes the current Brief (from `ws.brief`,
 * `WorkspaceStateProvider`'s Phase-47 subscription) and `runId` as props; no
 * `useQuery` of its own. Renders premise, currentPeg, centralClaim,
 * readerEffect, knownRisks, and voiceIntention as editable rows; saving a
 * row calls `patchBrief(runId, field, value, token)` — the guarded content
 * boundary (Clerk -> `briefs:patch` -> `audit_log`, D-12) — never a bare
 * dashboard `useMutation`.
 *
 * `brief === undefined` (still loading/skipped) renders a loading state;
 * `brief === null` (Gate 1 hasn't resolved yet, so `editor_gate_1` hasn't
 * generated a Brief row) renders an honest "not yet generated" empty state
 * — never a blank table (the never-silent-empty-state discipline used
 * throughout this app).
 *
 * `patch_brief` (api/brief.py) emits its `audit_log` row WITHOUT a
 * `reason=` kwarg — a content edit, not a reason-required decision (§47.5)
 * — so a direct field save does NOT project into the shared
 * `DecisionLog`/`auditLog:listDecisions` (`isDecisionRow` requires a
 * `reason`/`heldReason` key). A save instead surfaces an inline
 * confirmation message per-row (the "nothing silent" discipline applied at
 * the UI level) — `BriefFieldStrengthen.tsx` (BRF-06) is the action that
 * DOES carry a reason and DOES surface in the Decision log.
 */
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { patchBrief, type BriefField } from '@/lib/briefClient'

export interface Brief {
  premise: string
  currentPeg: string
  centralClaim: string
  readerEffect: string
  knownRisks: string
  voiceIntention: string
}

export interface BriefFieldTableProps {
  runId: string
  /**
   * `undefined` while `briefs:byRunId` is loading/skipped; `null` once
   * loaded when `editor_gate_1` hasn't generated a Brief row yet for this
   * run.
   */
  brief: Brief | null | undefined
}

const FIELD_ROWS: { field: BriefField; label: string }[] = [
  { field: 'premise', label: 'Premise' },
  { field: 'currentPeg', label: 'Current peg' },
  { field: 'centralClaim', label: 'Central claim' },
  { field: 'readerEffect', label: 'Reader effect' },
  { field: 'knownRisks', label: 'Known risks' },
  { field: 'voiceIntention', label: 'Voice intention' },
]

interface BriefFieldRowProps {
  runId: string
  field: BriefField
  label: string
  value: string
}

function BriefFieldRow({ runId, field, label, value }: BriefFieldRowProps) {
  const { getToken } = useAuth()
  const [editValue, setEditValue] = useState(value)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const dirty = editValue !== value

  async function handleSave() {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      await patchBrief(runId, field, editValue, token)
      setMessage('Saved.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid={`brief-field-row-${field}`}
      className="flex flex-col gap-1.5 border-b border-[color:var(--color-faint)] pb-3 last:border-b-0 last:pb-0"
    >
      <label
        htmlFor={`brief-field-${field}`}
        className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]"
      >
        {label}
      </label>
      <textarea
        id={`brief-field-${field}`}
        data-testid={`brief-field-input-${field}`}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        rows={2}
        className="w-full border border-[color:var(--color-faint)] bg-white p-2 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={handleSave}
          className="min-h-[36px] w-fit border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        {message && (
          <p role="status" className="text-[12px] text-[color:var(--color-ink-soft)]">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export function BriefFieldTable({ runId, brief }: BriefFieldTableProps) {
  if (brief === undefined) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[13px] italic text-[color:var(--color-ink-soft)]">
        Loading Brief…
      </p>
    )
  }

  if (brief === null) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
        The Brief is generated after a story is selected — it hasn&rsquo;t been produced for this
        run yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="brief-field-table">
      {FIELD_ROWS.map(({ field, label }) => (
        <BriefFieldRow key={field} runId={runId} field={field} label={label} value={brief[field]} />
      ))}
    </div>
  )
}
