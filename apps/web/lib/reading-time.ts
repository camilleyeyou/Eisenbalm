/**
 * Estimated reading time for an issue.
 *
 * Per UI-SPEC §"Reading Time" (LOCKED): 238 words/minute, rounded UP.
 * Counts text nodes in: originStory.body, problemStatement.body,
 * founderBio.body, caseStudy.body, bonus.body. EXCLUDES headlines,
 * game/podcast descriptions, charity metadata.
 */
import type { PortableTextBlock } from '@portabletext/react'

export const WORDS_PER_MINUTE = 238

/**
 * Count words across one or more Portable Text arrays.
 * Each block's children spans are concatenated, then whitespace-split.
 */
export function countWords(
  ...sources: Array<PortableTextBlock[] | null | undefined>
): number {
  let words = 0
  for (const blocks of sources) {
    if (!blocks) continue
    for (const block of blocks) {
      if (!block || (block as { _type?: string })._type !== 'block') continue
      const children = (block as { children?: Array<{ text?: string }> }).children
      if (!Array.isArray(children)) continue
      for (const child of children) {
        if (typeof child?.text !== 'string') continue
        const trimmed = child.text.trim()
        if (!trimmed) continue
        words += trimmed.split(/\s+/u).length
      }
    }
  }
  return words
}

/**
 * Reading time in minutes, rounded up. Returns 1 minimum (never 0) when
 * any words are present. Returns 0 for empty input.
 */
export function readingTime(
  ...sources: Array<PortableTextBlock[] | null | undefined>
): number {
  const words = countWords(...sources)
  if (words === 0) return 0
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}
