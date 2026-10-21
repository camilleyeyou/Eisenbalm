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
      <p className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-faint)]">
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
                'min-h-[44px] border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] ' +
                (isUnused
                  ? 'border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] text-[color:var(--color-faint)]'
                  : 'border-[color:var(--color-green)] bg-[color:var(--color-green)]/[0.07] text-[color:var(--color-green)] hover:bg-[color:var(--color-green)]/[0.15]')
              }
            >
              {`{${name}}`}
            </button>
          )
        })}
      </div>
      {unused.length > 0 && (
        <p className="font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-faint)]">
          Allowed but not used: {unused.join(', ')}
        </p>
      )}
    </div>
  )
}
