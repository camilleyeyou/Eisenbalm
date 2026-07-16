/**
 * Phase 45 Plan 45-01 Task 2 (REV-01) — pure helper reversing the synthetic
 * block `_key` construction (`lib/galley/syntheticPortableText.ts:143`:
 * `` `row-${sectionId}-${blockIndex}` ``) back into its numeric block index.
 *
 * DOM-independent by design: the selection-capture integration (Plan 45-05)
 * calls this on a `data-block-index`-adjacent `_key` string, never
 * re-implementing the parse inline.
 */
export function blockIndexFromKey(key: string): number | null {
  if (!key.startsWith('row-')) return null

  const lastDash = key.lastIndexOf('-')
  if (lastDash === -1) return null

  const tail = key.slice(lastDash + 1)
  if (tail === '') return null

  const index = Number(tail)
  if (!Number.isInteger(index)) return null

  return index
}
