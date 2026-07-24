/**
 * Quick 260724-i5n (LD-3) — `deriveStoryOutline`/`countWords`/`firstSentence`
 * unit coverage. Pure functions, Node env (no jsdom/mocks needed).
 */
import { describe, it, expect } from 'vitest'
import {
  deriveStoryOutline,
  countWords,
  firstSentence,
  sectionWordCount,
  sectionExcerpt,
  type OutlineUnresolvedFinding,
} from '../app/(dashboard)/review-desk/[runId]/_components/storyOutline'
import type { ContentBlock } from '@/lib/contentPatchClient'
import type { ResolvedAnnotation } from '@/lib/galley/spanResolver'

function block(type: ContentBlock['type'], text: string): ContentBlock {
  return { type, text }
}

function resolvedAt(blockIndex: number, severity: 'error' | 'warning' | 'info'): ResolvedAnnotation {
  return {
    findingId: `resolved-${blockIndex}-${severity}`,
    sectionId: 'originStory',
    blockIndex,
    start: 0,
    end: 4,
    severity,
    reason: 'test finding',
    quotedSpan: 'x',
  }
}

describe('countWords', () => {
  it('trims and collapses whitespace runs when counting', () => {
    expect(countWords('  two   words ')).toBe(2)
  })

  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('returns 0 for a whitespace-only string', () => {
    expect(countWords('   ')).toBe(0)
  })
})

describe('firstSentence', () => {
  it('returns up to and including the first terminal punctuation mark', () => {
    expect(firstSentence('One sentence. Then another.')).toBe('One sentence.')
  })

  it('falls back to the max length when there is no terminal punctuation', () => {
    const text = 'a'.repeat(200)
    expect(firstSentence(text, 160)).toBe('a'.repeat(160))
  })

  it('returns the whole trimmed string when it is shorter than max and has no punctuation', () => {
    expect(firstSentence('  short  ')).toBe('short')
  })
})

describe('sectionWordCount / sectionExcerpt', () => {
  it('sums words across all blocks and excerpts the first paragraph', () => {
    const blocks: ContentBlock[] = [
      block('h2', 'A Heading'),
      block('paragraph', 'Four words right here.'),
      block('paragraph', 'Two more.'),
    ]
    // "A Heading" (2) + "Four words right here." (4) + "Two more." (2) = 8 —
    // sectionWordCount sums every block in range, headings included.
    expect(sectionWordCount(blocks)).toBe(8)
    expect(sectionExcerpt(blocks)).toBe('Four words right here.')
  })

  it('sectionExcerpt returns an empty string when there is no paragraph block', () => {
    expect(sectionExcerpt([block('h2', 'Only a heading')])).toBe('')
  })
})

describe('deriveStoryOutline', () => {
  it('splits a leading run of paragraphs before the first h2 into the lede, with the first beat starting at the h2', () => {
    const blocks: ContentBlock[] = [
      block('paragraph', 'First lede paragraph sentence one.'),
      block('paragraph', 'Second lede paragraph.'),
      block('h2', 'The First Beat'),
      block('paragraph', 'Beat body text here.'),
    ]
    const { lede, beats } = deriveStoryOutline(blocks, [], [])

    expect(lede).not.toBeNull()
    expect(lede?.kind).toBe('lede')
    expect(lede?.blockStart).toBe(0)
    expect(lede?.blockEnd).toBe(2)
    expect(lede?.wordCount).toBe(countWords(blocks[0]!.text) + countWords(blocks[1]!.text))

    expect(beats.length).toBe(1)
    expect(beats[0]!.blockStart).toBe(2)
    expect(beats[0]!.blockEnd).toBe(4)
  })

  it('opens a beat at each h2, with a range up to the next h2 (or the end)', () => {
    const blocks: ContentBlock[] = [
      block('h2', 'Beat One'),
      block('paragraph', 'Beat one body. More text follows.'),
      block('h2', 'Beat Two'),
      block('paragraph', 'Beat two body.'),
    ]
    const { lede, beats } = deriveStoryOutline(blocks, [], [])

    expect(lede).toBeNull()
    expect(beats.length).toBe(2)
    expect(beats[0]).toMatchObject({ label: 'Beat One', blockStart: 0, blockEnd: 2 })
    expect(beats[1]).toMatchObject({ label: 'Beat Two', blockStart: 2, blockEnd: 4 })
    expect(beats[0]!.lead).toBe(firstSentence('Beat one body. More text follows.'))
    // wordCount sums every block in the beat's range, including its own
    // heading block: "Beat One" (2) + "Beat one body. More text follows." (6) = 8.
    expect(beats[0]!.wordCount).toBe(countWords('Beat One') + countWords('Beat one body. More text follows.'))
  })

  it('attaches a resolved finding severity dot to the beat whose range contains its blockIndex, and to the lede when in range', () => {
    const blocks: ContentBlock[] = [
      block('paragraph', 'Lede paragraph.'),
      block('h2', 'Beat One'),
      block('paragraph', 'Beat one body.'),
    ]
    const resolved: ResolvedAnnotation[] = [resolvedAt(0, 'error'), resolvedAt(2, 'warning')]
    const { lede, beats } = deriveStoryOutline(blocks, resolved, [])

    expect(lede?.dots).toEqual(['err'])
    expect(beats[0]!.dots).toEqual(['warn'])
  })

  it('produces a single lede beat with no beats[] when there is no h2', () => {
    const blocks: ContentBlock[] = [
      block('paragraph', 'Only paragraph one.'),
      block('paragraph', 'Only paragraph two.'),
    ]
    const { lede, beats } = deriveStoryOutline(blocks, [], [])

    expect(lede).not.toBeNull()
    expect(lede?.blockStart).toBe(0)
    expect(lede?.blockEnd).toBe(2)
    expect(beats).toEqual([])
  })

  it('an unresolved finding with a valid blockIndexHint attaches to its containing beat; one with no usable hint attaches nowhere', () => {
    const blocks: ContentBlock[] = [
      block('paragraph', 'Lede.'),
      block('h2', 'Beat One'),
      block('paragraph', 'Body.'),
    ]
    const withHint: OutlineUnresolvedFinding = {
      findingId: 'u1',
      sectionId: 'originStory',
      severity: 'error',
      reason: 'has a hint',
      blockIndexHint: 2,
    }
    const noHint: OutlineUnresolvedFinding = {
      findingId: 'u2',
      sectionId: 'originStory',
      severity: 'warning',
      reason: 'no usable hint',
    }
    const { lede, beats } = deriveStoryOutline(blocks, [], [withHint, noHint])

    expect(beats[0]!.dots).toEqual(['err'])
    expect(lede?.dots).toEqual([])
  })

  it('returns a null lede and no beats for an empty block list', () => {
    const { lede, beats } = deriveStoryOutline([], [], [])
    expect(lede).toBeNull()
    expect(beats).toEqual([])
  })
})
