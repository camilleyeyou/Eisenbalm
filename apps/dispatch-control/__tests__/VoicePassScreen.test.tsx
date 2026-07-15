/**
 * Phase 36 (VOX-01/VOX-04, Plan 36-04 Task 3) — Voice Pass screen tests.
 *
 * (a) only voice-axis findings render (VOICE_AXES scoping, through the full
 *     screen mount — not just the Galley unit)
 * (b) the per-screen tell count reflects the voice-scoped OPEN findings
 * (c) clicking "Run deep check" calls voicePassClient.recheck(runId, token)
 *
 * Phase 36 (VOX-02, D-09, Plan 36-07 Task 2) also covers:
 * (d) clicking "Write my own" on a voice tell pushes a Review Desk
 *     `?edit=<sectionId>&finding=<findingId>` deep-link (no longer inert).
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { DraftResponse } from '@/lib/contentPatchClient'

// ── Module mocks ─────────────────────────────────────────────────────────────

// Plan 36-07 Task 2: handleEditSection ("Write my own") now navigates via
// next/navigation's useRouter — hoisted so the spy is available inside the
// vi.mock factory below (which runs before this file's other top-level code).
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  // Galley's ClaimMark calls useMutation(api.claimChecks.setStatus).
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    claimChecks: {
      listByRunId: 'claimChecks:listByRunId',
      setStatus: 'claimChecks:setStatus',
    },
    // Phase 36 (Plan 36-06 Task 2): the mounted VoicePassRail subscribes to
    // the same sign-offs query DecisionRail already reads.
    signOffs: { activeByRunId: 'signOffs:activeByRunId' },
  },
}))

// Phase 36 (Plan 36-06 Task 2): VoicePassRail's "Sign: Sounds human" button.
vi.mock('@/lib/signOffClient', () => {
  class SignOffApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'SignOffApiError'
    }
  }
  return {
    SignOffApiError,
    recordSignOff: vi.fn(async () => ({
      runId: 'r1',
      kind: 'sounds-human',
      signedAt: Date.now(),
    })),
  }
})

vi.mock('@/lib/contentPatchClient', () => ({
  ContentPatchError: class ContentPatchError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'ContentPatchError'
    }
  },
  getDraft: vi.fn(),
}))

vi.mock('@/lib/voicePassClient', () => ({
  VoicePassApiError: class VoicePassApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'VoicePassApiError'
    }
  },
  recheck: vi.fn(async () => ({ runId: 'r1', findingCount: 2 })),
}))

import { useQuery } from 'convex/react'
import { getDraft } from '@/lib/contentPatchClient'
import { recheck } from '@/lib/voicePassClient'
import { VoicePassScreen } from '../app/(dashboard)/voice-pass/[runId]/VoicePassRunView'
import { InspectorProvider } from '../components/inspector/InspectorProvider'

afterEach(() => {
  cleanup()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

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
      blocks: [{ type: 'paragraph', text: 'One family used the program for three winters.' }],
      lossy: false,
    },
  },
  theme: { fontDisplay: 'Newsreader', fontBody: 'Lora', accentColor: '#9A3324' },
  game: {},
  bonus: {},
  bonusType: 'specAd',
  podcast: { transcript: 'Host: Today we cover an obscure charity.' },
  conversation: [],
}

// One voice-axis (machine-tell) finding, one factual-axis (precision)
// finding — Voice Pass must light only the former.
const mixedFindings = [
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

function mockFindings(findings: unknown[] = mixedFindings) {
  ;(useQuery as ReturnType<typeof vi.fn>).mockImplementation((queryRef: string) => {
    if (queryRef === 'qaCorrections:byRunId') return findings
    if (queryRef === 'claimChecks:listByRunId') return []
    // VoicePassRail's sign-offs subscription — no sign-off active by default.
    if (queryRef === 'signOffs:activeByRunId') return {}
    return undefined
  })
}

beforeEach(() => {
  vi.mocked(getDraft).mockReset()
  vi.mocked(getDraft).mockResolvedValue(draft)
  vi.mocked(recheck).mockClear()
  pushMock.mockClear()
})

async function renderScreen() {
  // Render the named VoicePassScreen (runId already unwrapped) directly —
  // the default export's `use(params)` wrapper is a thin, untested Next.js
  // 15 async-params adapter around this same component.
  //
  // Phase 44 (INS-01, Plan 44-07 Task 1): the screen now calls
  // `useInspector()` (the voice finding entry point), so it must render
  // inside an `<InspectorProvider>` — mirroring
  // `InspectorProvider.test.tsx`'s own wrapping convention. `activeKey`
  // stays null throughout (no test here clicks Inspect).
  const utils = render(
    <InspectorProvider>
      <VoicePassScreen runId="r1" />
    </InspectorProvider>,
  )
  await waitFor(() => {
    expect(screen.queryByText(/loading draft/i)).toBeNull()
  })
  return utils
}

describe('Voice Pass screen (VOX-01, VOX-04)', () => {
  it('renders only the voice-axis (machine-tell) annotation, omitting the factual (precision) one', async () => {
    mockFindings()
    const { container } = await renderScreen()

    const marks = Array.from(container.querySelectorAll('mark.galley-anno')).map(el => el.textContent)
    expect(marks).toContain('in a garage')
    expect(marks).not.toContain('the regional bank closed')
  })

  it('shows a per-screen tell count reflecting the voice-scoped OPEN findings', async () => {
    mockFindings()
    await renderScreen()

    expect(screen.getByLabelText(/tell count/i).textContent).toMatch(/1 tell/i)
  })

  it('excludes a resolved (dismissed) voice finding from the tell count', async () => {
    mockFindings([
      { ...mixedFindings[0], resolution: 'dismissed' as const },
      mixedFindings[1],
    ])
    await renderScreen()

    expect(screen.getByLabelText(/tell count/i).textContent).toMatch(/0 tells/i)
  })

  it('clicking "Run deep check" calls voicePassClient.recheck(runId, token)', async () => {
    mockFindings()
    await renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /run deep check/i }))

    await waitFor(() => {
      expect(recheck).toHaveBeenCalledWith('r1', 'tok-clerk')
    })
  })

  it('shows the returned finding count after a successful deep check', async () => {
    mockFindings()
    await renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /run deep check/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/2 findings/i)
    })
  })
})

// ── Plan 36-07 gap-closure test ──────────────────────────────────────────────

describe('Voice Pass screen — "Write my own" deep-link (VOX-02, D-09)', () => {
  it('clicking "Write my own" on a voice tell pushes a Review Desk ?edit= deep-link', async () => {
    mockFindings()
    const { container } = await renderScreen()

    const mark = Array.from(container.querySelectorAll('mark.galley-anno')).find(
      el => el.textContent === 'in a garage',
    )
    expect(mark).toBeDefined()
    fireEvent.click(mark as Element)

    fireEvent.click(screen.getByRole('button', { name: /write my own/i }))

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = pushMock.mock.calls[0]?.[0] as string
    expect(url).toContain('/review-desk/r1')
    expect(url).toContain('edit=')
    expect(url).toContain('finding=v1')
  })
})
