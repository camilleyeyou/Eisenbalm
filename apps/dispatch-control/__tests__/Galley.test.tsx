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
 *
 * Phase 36 (Plan 36-04, Task 1): Galley promoted to the route-agnostic
 * `components/galley/` so both Review Desk and Voice Pass can import it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { DraftResponse } from '@/lib/contentPatchClient'

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  // Phase 35: ClaimMark calls useMutation(api.claimChecks.setStatus).
  useMutation: vi.fn(() => vi.fn()),
}))

// Phase 33: AnnotationMark/UnresolvedFindingCard now read Clerk's getToken.
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: {
      byRunId: 'qaCorrections:byRunId',
    },
    // Phase 35 (PRV-03): claim_checks subscription + status mutation.
    claimChecks: {
      listByRunId: 'claimChecks:listByRunId',
      setStatus: 'claimChecks:setStatus',
    },
  },
}))

import { useQuery } from 'convex/react'
import Galley from '../components/galley/Galley'
import { VOICE_AXES, FACTUAL_AXES } from '@/lib/galley/axisPartition'

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

// Phase 35 (PRV-03): claim_checks fixture rows -- one sourced (claimId
// present), one unsourced (claimId absent), both anchored via
// sectionName/blockIndexHint in the galley section id vocabulary.
const claimRows = [
  {
    claimIndex: 0,
    text: 'in a garage',
    status: 'pending',
    claimId: 'c-0',
    sourceUrl: 'https://example.com/history',
    retrievedAt: 1700000000000,
    sectionName: 'originStory',
    blockIndexHint: 0,
  },
  {
    claimIndex: 1,
    text: 'the regional bank closed',
    status: 'pending',
    sectionName: 'problemStatement',
    blockIndexHint: 0,
  },
]

// Phase 33 (Plan 33-04): Galley now requires the action-context props.
const noop = () => {}

function mockFindings() {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
    if (queryRef === 'qaCorrections:byRunId') return qaFindings
    if (queryRef === 'claimChecks:listByRunId') return claimRows
    return undefined
  })
}

describe('Galley', () => {
  it('renders all four long-read section headlines', () => {
    mockFindings()
    render(<Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />)

    expect(screen.getByText('A Quiet Beginning')).toBeDefined()
    expect(screen.getByText('The Problem')).toBeDefined()
    expect(screen.getByText('Founder Bio')).toBeDefined()
    expect(screen.getByText('Case Study')).toBeDefined()
  })

  it('renders a <blockquote> for a blockquote row', () => {
    mockFindings()
    const { container } = render(<Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />)

    const blockquote = container.querySelector('blockquote')
    expect(blockquote).not.toBeNull()
    expect(blockquote?.textContent).toContain('We simply kept showing up.')
  })

  it('renders the game inside a sandboxed iframe (srcdoc + sandbox="allow-scripts")', () => {
    mockFindings()
    const { container } = render(<Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />)

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('renders at least one element with a data-severity attribute reflecting a resolved finding', () => {
    mockFindings()
    const { container } = render(<Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />)

    const severityEls = container.querySelectorAll('[data-severity]')
    expect(severityEls.length).toBeGreaterThan(0)
    const severities = Array.from(severityEls).map(el => el.getAttribute('data-severity'))
    expect(severities).toContain('error')
  })

  it('renders the bonus, podcast transcript, and deliberation conversation content', () => {
    mockFindings()
    render(<Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />)

    expect(screen.getByText(/imagine a world where lip balm funds shelters/i)).toBeDefined()
    expect(screen.getByText(/today we cover an obscure charity/i)).toBeDefined()
    expect(screen.getByText(/found a promising candidate/i)).toBeDefined()
  })

  // Phase 35 (PRV-03): provenance wash -- sourced/unsourced claims, the
  // default-ON toggle, and legacy-row safety.
  it('renders a sourced (marigold) wash for a claimId-bearing claim and an unsourced (rust) wash for a claimId-absent claim', () => {
    mockFindings()
    const { container } = render(
      <Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />,
    )

    const sourced = container.querySelectorAll('[data-provenance="sourced"]')
    const unsourced = container.querySelectorAll('[data-provenance="unsourced"]')
    expect(sourced.length).toBeGreaterThan(0)
    expect(unsourced.length).toBeGreaterThan(0)
    sourced.forEach((el) => expect(el.className).toContain('galley-claim'))
  })

  it('renders no galley-claim wash marks when the provenance toggle is off', () => {
    mockFindings()
    const { container } = render(
      <Galley
        runId="r1"
        draft={draft}
        revisionId="rev-1"
        reloadDraft={noop}
        onEditSection={noop}
        showProvenance={false}
      />,
    )

    expect(container.querySelectorAll('.galley-claim').length).toBe(0)
    // Annotations still render even with the provenance layer off.
    expect(container.querySelectorAll('[data-severity]').length).toBeGreaterThan(0)
  })

  it('a legacy claim_checks row with no blockIndexHint/sectionName never crashes the galley', () => {
    ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
      if (queryRef === 'qaCorrections:byRunId') return qaFindings
      if (queryRef === 'claimChecks:listByRunId') {
        return [{ claimIndex: 9, text: 'nonexistent phrase', status: 'pending' }]
      }
      return undefined
    })

    expect(() =>
      render(<Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />),
    ).not.toThrow()
  })
})

// ── Task 2 (Phase 36) — includeAxes filter ──────────────────────────────────
//
// One Galley instance now serves two axis-partitioned surfaces: Review Desk
// (FACTUAL_AXES) and Voice Pass (VOICE_AXES). A finding with no axis at all
// is omitted whenever ANY includeAxes whitelist is passed (only known-axis
// rows pass the filter) — undefined-as-factual is a DecisionRail-level
// concern (Task 4), not a Galley-render concern.

const axisFindings = [
  {
    _id: 'v1',
    runId: 'r1',
    sectionName: 'origin_story',
    severity: 'error',
    axis: 'machine-tell',
    reason: 'Reads like AI-generated prose.',
    accepted: false,
    quotedSpan: 'in a garage',
    blockIndexHint: 0,
  },
  {
    _id: 'f1',
    runId: 'r1',
    sectionName: 'problem',
    severity: 'warning',
    axis: 'precision',
    reason: 'Vague causal claim.',
    accepted: false,
    quotedSpan: 'the regional bank closed',
    blockIndexHint: 0,
  },
]

function mockAxisFindings() {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
    if (queryRef === 'qaCorrections:byRunId') return axisFindings
    if (queryRef === 'claimChecks:listByRunId') return []
    return undefined
  })
}

function markTexts(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('mark.galley-anno')).map(el => el.textContent)
}

describe('Galley includeAxes filter (Phase 36, Task 2)', () => {
  it('includeAxes=VOICE_AXES renders the machine-tell annotation and omits the precision one', () => {
    mockAxisFindings()
    const { container } = render(
      <Galley
        runId="r1"
        draft={draft}
        revisionId="rev-1"
        reloadDraft={noop}
        onEditSection={noop}
        includeAxes={VOICE_AXES}
      />,
    )
    const marks = markTexts(container)
    expect(marks).toContain('in a garage')
    expect(marks).not.toContain('the regional bank closed')
  })

  it('includeAxes=FACTUAL_AXES renders the precision annotation and omits machine-tell', () => {
    mockAxisFindings()
    const { container } = render(
      <Galley
        runId="r1"
        draft={draft}
        revisionId="rev-1"
        reloadDraft={noop}
        onEditSection={noop}
        includeAxes={FACTUAL_AXES}
      />,
    )
    const marks = markTexts(container)
    expect(marks).toContain('the regional bank closed')
    expect(marks).not.toContain('in a garage')
  })

  it('back-compat: no includeAxes renders BOTH findings', () => {
    mockAxisFindings()
    const { container } = render(
      <Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />,
    )
    const marks = markTexts(container)
    expect(marks).toContain('in a garage')
    expect(marks).toContain('the regional bank closed')
  })

  it('a finding with axis === undefined is omitted when includeAxes is set', () => {
    ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
      if (queryRef === 'qaCorrections:byRunId') {
        return [
          {
            _id: 'u1',
            runId: 'r1',
            sectionName: 'origin_story',
            severity: 'error',
            reason: 'Legacy row with no axis at all.',
            accepted: false,
            quotedSpan: 'in a garage',
            blockIndexHint: 0,
          },
        ]
      }
      if (queryRef === 'claimChecks:listByRunId') return []
      return undefined
    })
    const { container } = render(
      <Galley
        runId="r1"
        draft={draft}
        revisionId="rev-1"
        reloadDraft={noop}
        onEditSection={noop}
        includeAxes={FACTUAL_AXES}
      />,
    )
    expect(container.querySelectorAll('mark.galley-anno').length).toBe(0)
  })
})
