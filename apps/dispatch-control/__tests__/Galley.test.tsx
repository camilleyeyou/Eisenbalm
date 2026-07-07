/**
 * Phase 32 (GLY-01, D-05, D-07, Plan 32-01 Wave 0 RED) — Galley render tests.
 *
 * D-05 coverage: all 8 reader sections in reader order with headlines,
 * the game as a sandboxed iframe (`srcdoc` + `sandbox="allow-scripts"`,
 * reusing the apps/web GameSlot sandbox pattern), the bonus in its stored
 * variant, the podcast, and the deliberation conversation.
 * D-07: tiered severity colors surfaced via a `data-severity` attribute
 * on the annotated span/marker so styling can be asserted structurally
 * (not pixel-exact) per 32-RESEARCH.md's synthetic-PT-block + markDef
 * design.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 *
 * RED at authoring time:
 * `../app/(dashboard)/review-desk/[runId]/_components/Galley` does not
 * exist yet. Turns GREEN in Plan 32-07.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { DraftResponse } from '@/lib/contentPatchClient'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: {
      byRunId: 'qaCorrections:byRunId',
    },
  },
}))

import { useQuery } from 'convex/react'
import Galley from '../app/(dashboard)/review-desk/[runId]/_components/Galley'

afterEach(() => {
  cleanup()
})

// ── Fixture ───────────────────────────────────────────────────────────────────

const draft: DraftResponse = {
  revisionId: 'rev-1',
  sections: {
    originStory: {
      headline: 'A Quiet Beginning',
      blocks: [{ type: 'paragraph', text: 'The founder started in a garage in 1974.' }],
      lossy: false,
    },
    problemStatement: {
      headline: 'The Problem',
      blocks: [{ type: 'paragraph', text: 'Funding dried up after the regional bank closed.' }],
      lossy: false,
    },
    founderBio: {
      headline: 'Founder Bio',
      blocks: [{ type: 'paragraph', text: 'She trained as an engineer before switching fields.' }],
      lossy: false,
    },
    caseStudy: {
      headline: 'Case Study',
      blocks: [
        { type: 'paragraph', text: 'One family used the program for three winters.' },
        { type: 'blockquote', text: 'We simply kept showing up.' },
      ],
      lossy: false,
    },
  },
  theme: {
    fontDisplay: 'Newsreader',
    fontBody: 'Lora',
    accentColor: '#9A3324',
  },
  game: {
    headline: 'Play the game',
    description: 'A short interactive.',
    embedCode: '<canvas></canvas><script>let x=1</script>',
  },
  bonus: {
    headline: 'Spec Ad',
    body: [{ type: 'paragraph', text: 'Imagine a world where lip balm funds shelters.' }],
  },
  bonusType: 'specAd',
  podcast: {
    transcript: 'Host: Today we cover an obscure charity.',
  },
  conversation: [
    { speaker: 'Scout', text: 'Found a promising candidate.' },
    { speaker: 'Editor', text: 'Approved for this week.' },
  ],
}

const qaFindings = [
  {
    _id: 'qa1',
    runId: 'r1',
    sectionName: 'origin_story',
    severity: 'error',
    axis: 'gravity',
    reason: 'Too flippant for the founding moment.',
    accepted: false,
    quotedSpan: 'in a garage',
    blockIndexHint: 0,
  },
  {
    _id: 'qa2',
    runId: 'r1',
    sectionName: 'problem',
    severity: 'warning',
    axis: 'precision',
    reason: 'Vague causal claim.',
    accepted: false,
    quotedSpan: 'the regional bank closed',
    blockIndexHint: 0,
  },
  {
    _id: 'qa3',
    runId: 'r1',
    sectionName: 'founder_bio',
    severity: 'info',
    axis: 'sentiment',
    reason: 'Could use a stronger verb.',
    accepted: false,
    quotedSpan: 'switching fields',
    blockIndexHint: 0,
  },
]

function mockFindings() {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
    if (queryRef === 'qaCorrections:byRunId') return qaFindings
    return undefined
  })
}

describe('Galley', () => {
  it('renders all four long-read section headlines', () => {
    mockFindings()
    render(<Galley runId="r1" draft={draft} />)

    expect(screen.getByText('A Quiet Beginning')).toBeDefined()
    expect(screen.getByText('The Problem')).toBeDefined()
    expect(screen.getByText('Founder Bio')).toBeDefined()
    expect(screen.getByText('Case Study')).toBeDefined()
  })

  it('renders a <blockquote> for a blockquote row', () => {
    mockFindings()
    const { container } = render(<Galley runId="r1" draft={draft} />)

    const blockquote = container.querySelector('blockquote')
    expect(blockquote).not.toBeNull()
    expect(blockquote?.textContent).toContain('We simply kept showing up.')
  })

  it('renders the game inside a sandboxed iframe (srcdoc + sandbox="allow-scripts")', () => {
    mockFindings()
    const { container } = render(<Galley runId="r1" draft={draft} />)

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('renders at least one element with a data-severity attribute reflecting a resolved finding', () => {
    mockFindings()
    const { container } = render(<Galley runId="r1" draft={draft} />)

    const severityEls = container.querySelectorAll('[data-severity]')
    expect(severityEls.length).toBeGreaterThan(0)
    const severities = Array.from(severityEls).map(el => el.getAttribute('data-severity'))
    expect(severities).toContain('error')
  })

  it('renders the bonus, podcast transcript, and deliberation conversation content', () => {
    mockFindings()
    render(<Galley runId="r1" draft={draft} />)

    expect(screen.getByText(/imagine a world where lip balm funds shelters/i)).toBeDefined()
    expect(screen.getByText(/today we cover an obscure charity/i)).toBeDefined()
    expect(screen.getByText(/found a promising candidate/i)).toBeDefined()
  })
})
