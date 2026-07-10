'use client'
/**
 * Phase 28 (PRC-06, CONTEXT D-14) — assembled-with-sample-values preview.
 *
 * Substitutes the per-VARIABLE sample values (VARIABLE_SAMPLES) into the draft
 * INSTANTLY, client-side, with NO server call. This is a readability aid — NOT
 * a test-run / execution — so it need not match the real run byte-for-byte.
 *
 * Substitution uses the canonical replace-all chain (split/join emulates
 * `str.replace`-all), NEVER `str.format`, preserving D-14 + the agents' own
 * substitution convention (safe against literal braces in prose). A variable
 * with no sample leaves its `{placeholder}` intact.
 */
import { useState } from 'react'
import { VARIABLE_SAMPLES } from './VariableRegistry'

/**
 * Replace every `{name}` for each allowed variable with its sample value via the
 * canonical replace-all chain. Absent samples leave the placeholder intact.
 */
export function assembleWithSamples(draft: string, allowed: string[]): string {
  let out = draft
  for (const name of allowed) {
    out = out.split('{' + name + '}').join(VARIABLE_SAMPLES[name] ?? '{' + name + '}')
  }
  return out
}

interface AssembledPreviewProps {
  draft: string
  allowed: string[]
}

export default function AssembledPreview({ draft, allowed }: AssembledPreviewProps) {
  const [open, setOpen] = useState(false)
  const assembled = assembleWithSamples(draft, allowed)

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-lg border border-neutral-200 bg-neutral-50"
    >
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-medium text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
        What the agent sees
      </summary>
      <div className="border-t border-neutral-200 px-4 py-3">
        <p className="mb-2 text-[11px] text-neutral-400">
          The final assembled text — your prompt plus filled variables —
          exactly as the model receives it. Readability aid only — not a
          test-run.
        </p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-neutral-200 bg-white p-3 font-mono text-xs text-neutral-800">
          {assembled}
        </pre>
      </div>
    </details>
  )
}
