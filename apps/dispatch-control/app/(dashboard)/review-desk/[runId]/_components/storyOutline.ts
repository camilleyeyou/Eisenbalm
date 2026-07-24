/**
 * Quick 260724-i5n (LD-3) — pure outline derivation for the Story Desk's
 * per-story Outline tab.
 *
 * `deriveStoryOutline` reads NOTHING but the draft's own block structure: the
 * leading run of paragraphs before the first `h2` is the lede; each `h2`
 * after that opens a new beat running to the next `h2` (or the end of the
 * section). Severity dots are placed by mapping a resolved annotation's
 * `blockIndex` (or an unresolved finding's `blockIndexHint`, when it carries
 * one) into whichever group's `[blockStart, blockEnd)` range contains it —
 * this is the SAME per-block resolution `resolveSectionFindings`
 * (`lib/galley/spanResolver.ts`) already produces; this module never
 * re-matches text, it only buckets already-resolved indices.
 *
 * Pure, dependency-free (no React/DOM imports) — only TYPES are imported
 * from `@/lib/contentPatchClient` and `@/lib/galley/spanResolver`.
 */
import type { ContentBlock } from '@/lib/contentPatchClient'
import type { ResolvedAnnotation, UnresolvedFinding } from '@/lib/galley/spanResolver'

/**
 * `resolveSectionFindings`'s `UnresolvedFinding` never actually carries a
 * `blockIndexHint` (it is dropped when a finding fails to anchor) — but the
 * design calls for placing a dot when an unresolved finding DOES carry a
 * valid hint (e.g. a caller passing the raw pre-resolution finding list
 * instead). This intersection keeps the parameter accepting the real
 * `UnresolvedFinding[]` the span resolver returns (the hint is simply absent
 * there, so no dot is ever placed for those) while also accepting a richer
 * shape that does carry the hint.
 */
export type OutlineUnresolvedFinding = UnresolvedFinding & { blockIndexHint?: number }

/** Trims, splits on whitespace runs, and drops empties. */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

/**
 * Up to and including the first `.`, `!`, or `?`, or `max` characters,
 * whichever is shorter. Returns `''` for blank input.
 */
export function firstSentence(text: string, max = 160): string {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  const match = trimmed.match(/[.!?]/)
  const punctIndex = match && match.index !== undefined ? match.index : -1
  const sentenceEnd = punctIndex === -1 ? trimmed.length : punctIndex + 1
  return trimmed.slice(0, Math.min(sentenceEnd, max))
}

/** Sum of `countWords` across every block's text — used by callers needing a whole-section count. */
export function sectionWordCount(blocks: ContentBlock[]): number {
  return blocks.reduce((total, b) => total + countWords(b.text), 0)
}

/** First paragraph's text in a draft's blocks, or `''` when there is none (e.g. a structured section). */
export function sectionExcerpt(blocks: ContentBlock[]): string {
  const para = blocks.find(b => b.type === 'paragraph')
  return para ? para.text : ''
}

export interface OutlineBeat {
  kind: 'lede' | 'beat'
  label: string
  lead: string
  wordCount: number
  dots: Array<'err' | 'warn' | 'info'>
  /** Inclusive block index this beat's range starts at. */
  blockStart: number
  /** Exclusive block index this beat's range ends at. */
  blockEnd: number
}

const SEVERITY_TO_DOT: Record<'error' | 'warning' | 'info', 'err' | 'warn' | 'info'> = {
  error: 'err',
  warning: 'warn',
  info: 'info',
}

interface Group {
  kind: 'lede' | 'beat'
  label: string
  start: number
  end: number
}

function buildGroups(blocks: ContentBlock[]): Group[] {
  const groups: Group[] = []
  const h2Indices: number[] = []
  blocks.forEach((b, i) => {
    if (b.type === 'h2') h2Indices.push(i)
  })

  const firstH2 = h2Indices.length > 0 ? h2Indices[0] : undefined
  const ledeEnd = firstH2 ?? blocks.length
  if (ledeEnd > 0) {
    groups.push({ kind: 'lede', label: '', start: 0, end: ledeEnd })
  }

  for (const start of h2Indices) {
    const end = h2Indices.find(idx => idx > start) ?? blocks.length
    const headingBlock = blocks.slice(start, start + 1)[0]
    groups.push({ kind: 'beat', label: headingBlock ? headingBlock.text : '', start, end })
  }

  return groups
}

function wordCountForRange(blocks: ContentBlock[], start: number, end: number): number {
  return sectionWordCount(blocks.slice(start, end))
}

function firstParagraphTextIn(blocks: ContentBlock[], start: number, end: number): string | undefined {
  return blocks.slice(start, end).find(b => b.type === 'paragraph')?.text
}

function dotsForRange(
  start: number,
  end: number,
  resolved: ResolvedAnnotation[],
  unresolved: ReadonlyArray<OutlineUnresolvedFinding>,
): Array<'err' | 'warn' | 'info'> {
  const dots: Array<'err' | 'warn' | 'info'> = []
  for (const r of resolved) {
    if (r.blockIndex >= start && r.blockIndex < end) dots.push(SEVERITY_TO_DOT[r.severity])
  }
  for (const u of unresolved) {
    const hint = u.blockIndexHint
    if (typeof hint === 'number' && hint >= start && hint < end) dots.push(SEVERITY_TO_DOT[u.severity])
  }
  return dots
}

/**
 * A paragraph's text AFTER its lead sentence, or the paragraph itself when
 * the sentence already covers it (a short paragraph with no meaningful
 * remainder) — never returns an empty string when the paragraph itself is
 * non-empty.
 */
function leadTextAfterSentence(paragraph: string, sentence: string): string {
  const trimmed = paragraph.trim()
  if (sentence === '' || trimmed.length <= sentence.length) return trimmed
  const rest = trimmed.slice(sentence.length).trim()
  return rest.length > 0 ? rest : trimmed
}

/**
 * Derives the reading-order shape of one section's draft: the lede (the
 * leading run of blocks before the first `h2`, if any) and one beat per
 * `h2`. Never mutates `blocks`/`resolved`/`unresolved`.
 */
export function deriveStoryOutline(
  blocks: ContentBlock[],
  resolved: ResolvedAnnotation[],
  unresolved: ReadonlyArray<OutlineUnresolvedFinding>,
): { lede: OutlineBeat | null; beats: OutlineBeat[] } {
  const groups = buildGroups(blocks)

  let lede: OutlineBeat | null = null
  const beats: OutlineBeat[] = []

  for (const group of groups) {
    const wordCount = wordCountForRange(blocks, group.start, group.end)
    const dots = dotsForRange(group.start, group.end, resolved, unresolved)

    if (group.kind === 'lede') {
      const paraText = firstParagraphTextIn(blocks, group.start, group.end) ?? ''
      const sentence = paraText ? firstSentence(paraText) : ''
      lede = {
        kind: 'lede',
        label: sentence,
        lead: paraText ? leadTextAfterSentence(paraText, sentence) : '',
        wordCount,
        dots,
        blockStart: group.start,
        blockEnd: group.end,
      }
    } else {
      const paraText = firstParagraphTextIn(blocks, group.start, group.end)
      beats.push({
        kind: 'beat',
        label: group.label,
        lead: paraText ? firstSentence(paraText) : '',
        wordCount,
        dots,
        blockStart: group.start,
        blockEnd: group.end,
      })
    }
  }

  return { lede, beats }
}
