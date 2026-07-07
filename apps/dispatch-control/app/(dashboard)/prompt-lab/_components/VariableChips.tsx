'use client'
/**
 * Phase 28 (PRC-05/PRC-07, CONTEXT D-13/D-15) — click-to-insert variable chips.
 *
 * Renders one button chip per allowed variable. Clicking inserts `{name}` via the
 * `onInsert` callback (the host appends to the draft). Each chip carries its
 * description as a native `title` + `aria-label` so the tooltip is accessible
 * without a new dependency (PRC-05).
 *
 * A variable allowed for the agent but absent from the draft is flagged with a
 * passive visual hint (dashed border + muted text) plus a one-line advisory note
 * (PRC-07). This is ADVISORY ONLY — it never gates save. The Phase 24
 * unknown/mangled-variable gate (in PromptEditor) stays the only save gate; this
 * component intentionally adds no unknown-variable save-disable logic.
 */
import { descriptionForVariable, findUnusedVariables } from './VariableRegistry'

interface VariableChipsProps {
  allowed: string[]
  draft: string
  onInsert: (token: string) => void
}

export default function VariableChips({
  allowed,
  draft,
  onInsert,
}: VariableChipsProps) {
  if (allowed.length === 0) {
    return (
      <p className="text-xs text-neutral-400">
        No variables for this prompt.
      </p>
    )
  }

  const unused = findUnusedVariables(draft, allowed)
  const unusedSet = new Set(unused)

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {allowed.map(name => {
          const description = descriptionForVariable(name)
          const isUnused = unusedSet.has(name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => onInsert('{' + name + '}')}
              title={description}
              aria-label={description ? `${name}: ${description}` : name}
              className={
                'min-h-[44px] rounded px-1.5 py-0.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ' +
                (isUnused
                  ? 'border border-dashed border-neutral-300 bg-white text-neutral-400'
                  : 'bg-green-50 text-green-800 hover:bg-green-100')
              }
            >
              {`{${name}}`}
            </button>
          )
        })}
      </div>
      {unused.length > 0 && (
        <p className="text-[11px] text-neutral-400">
          Allowed but not used: {unused.join(', ')}
        </p>
      )}
    </div>
  )
}
