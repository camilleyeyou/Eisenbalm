'use client'
/**
 * Phase 45 (REV-02, docs/API_CONTRACTS.md §45.1) — the seven fixed-copy
 * "Ask agent to revise" direction chips.
 *
 * Renders EXACTLY the seven §45.1-locked identifiers/copy — NEVER a single
 * bare catch-all rewrite chip (REV-02). `custom` reveals a free-text input
 * whose value is sent verbatim as `customDirection` (D-06). When the cost
 * guard has 409ed (`costCapped`, REV-05/D-14), every chip renders disabled with an
 * explanatory `title` — mirroring InspectorFooter's disabled
 * reserved-control pattern (never a silent failure, §6 locked-render
 * philosophy).
 *
 * Surface-agnostic (D-18): this component knows nothing about the galley or
 * inspector — RevisionFlow.tsx (Task 3) mounts it; 45-05 wires RevisionFlow
 * into the actual entry-point surfaces.
 */
import { useState } from 'react'
import type { DirectionChip } from '@/lib/revisionClient'

export interface DirectionChipsProps {
  onSelect: (direction: DirectionChip, customText?: string) => void
  /** True once `revise/preview` has 409ed with `cost_cap_exceeded` (§45.5). */
  costCapped?: boolean
  capInfo?: { spentUsd: number; capUsd: number }
}

/** §45.1 — the seven locked identifier/copy pairs, in fixed display order. */
const CHIPS: { id: DirectionChip; label: string }[] = [
  { id: 'make_clearer', label: 'Make clearer' },
  { id: 'make_more_specific', label: 'Make more specific' },
  { id: 'tighten', label: 'Tighten' },
  { id: 'match_brief', label: 'Match the brief' },
  { id: 'reduce_repetition', label: 'Reduce repetition' },
  { id: 'try_another_approach', label: 'Try another approach' },
  { id: 'custom', label: 'Custom' },
]

const CHIP_BUTTON =
  'min-h-[36px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

const INLINE_INPUT =
  'min-h-[60px] w-full rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs text-[color:var(--color-ink)]'

export function DirectionChips({ onSelect, costCapped, capInfo }: DirectionChipsProps) {
  const [customizing, setCustomizing] = useState(false)
  const [customText, setCustomText] = useState('')

  const capTitle = costCapped
    ? `Revision paused — $${(capInfo?.spentUsd ?? 0).toFixed(2)} of $${(capInfo?.capUsd ?? 0).toFixed(2)} used`
    : undefined

  function handleChipClick(id: DirectionChip) {
    if (costCapped) return
    if (id === 'custom') {
      setCustomizing(true)
      return
    }
    onSelect(id)
  }

  return (
    <div className="flex flex-col gap-2" data-testid="direction-chips">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ask agent to revise — direction">
        {CHIPS.map(chip => (
          <button
            key={chip.id}
            type="button"
            className={CHIP_BUTTON}
            disabled={costCapped}
            title={capTitle}
            onClick={() => handleChipClick(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {customizing && !costCapped && (
        <span className="flex w-full flex-col gap-2">
          <textarea
            aria-label="Custom direction"
            placeholder="Describe how the agent should revise this passage…"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            className={INLINE_INPUT}
          />
          <span className="flex gap-2">
            <button
              type="button"
              className={CHIP_BUTTON}
              disabled={customText.trim() === ''}
              onClick={() => {
                onSelect('custom', customText.trim())
                setCustomizing(false)
                setCustomText('')
              }}
            >
              Use this direction
            </button>
            <button
              type="button"
              className={CHIP_BUTTON}
              onClick={() => {
                setCustomizing(false)
                setCustomText('')
              }}
            >
              Cancel
            </button>
          </span>
        </span>
      )}
    </div>
  )
}
