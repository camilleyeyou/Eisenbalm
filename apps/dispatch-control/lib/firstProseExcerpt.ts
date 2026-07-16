/**
 * Phase 45 (REV-01, D-18, Plan 45-05 Task 3) — derives a REAL, non-empty
 * `quotedText` for the Phase-44 inspector footer's "Ask agent to revise"
 * entry point.
 *
 * The checker-mandated fix: seeding `quotedText: ''` would 409
 * `span_not_resolved` the instant an operator picked a direction chip,
 * because `RevisionFlow` has no passage-picker step of its own — it always
 * sends whatever `quotedText` it was scoped with straight through to
 * `revise/preview`/`revise/apply`, which re-resolve it against the
 * section's CURRENT prose via `lib/span_resolver.py::resolve_span`
 * (`packages/pipeline/src/eisenbalm_pipeline/api/content.py::_patch_prose_span`).
 * An empty string can never resolve. `firstProseExcerpt` instead returns a
 * contiguous, UNMODIFIED leading substring (first sentence, capped ~140
 * chars) of the section's first prose block — real text that, absent an
 * intervening edit, resolves cleanly.
 */

export interface ProseBlockLike {
  text?: string
}

const MAX_EXCERPT_LENGTH = 140

/**
 * Returns a leading verbatim excerpt of the FIRST block with non-empty
 * `text` — capped at the first sentence boundary, or `MAX_EXCERPT_LENGTH`
 * characters when no sentence-ending punctuation appears within the cap.
 * Always a CONTIGUOUS substring of the original text (never rewritten,
 * reordered, or synthesized) so server-side span resolution can locate it
 * against the current draft.
 *
 * Returns `''` ONLY when there is genuinely no prose text to excerpt (an
 * empty/absent `blocks` array, or every block's `text` is blank) — e.g. a
 * `game`/non-prose artifact. Callers MUST treat `''` as "no revisable
 * passage available here", never seed it as `quotedText` (that is exactly
 * the `span_not_resolved` 409 this helper exists to prevent).
 */
export function firstProseExcerpt(blocks: ReadonlyArray<ProseBlockLike> | undefined): string {
  if (!blocks || blocks.length === 0) return ''

  const first = blocks.find((block) => typeof block.text === 'string' && block.text.trim().length > 0)
  if (!first || typeof first.text !== 'string') return ''

  const text = first.text
  const capped = text.length > MAX_EXCERPT_LENGTH ? text.slice(0, MAX_EXCERPT_LENGTH) : text

  // First sentence boundary within the cap (a run of non-terminator
  // characters followed by ./!/? and either whitespace or end-of-string).
  const sentenceMatch = capped.match(/^[\s\S]*?[.!?](?=\s|$)/)
  const excerpt = sentenceMatch ? sentenceMatch[0] : capped

  return excerpt.trim()
}
