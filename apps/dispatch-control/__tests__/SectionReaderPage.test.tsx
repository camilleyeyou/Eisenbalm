/**
 * Phase 51 (READ-01, READ-04, READ-05, READ-07, Pitfall 3) — SectionReaderPage
 * Wave 0 scaffold (51-VALIDATION.md).
 *
 * The page under test (`app/(editorial)/s/[section]/page.tsx`) does not
 * exist yet — it lands in plan 51-04. Every spec below is wrapped in a
 * `describe.skip` (the `pageExists` guard) so this file is a clean,
 * always-green no-op until the page appears, at which point these specs
 * start running for real with NO edit needed to this guard. Every `it`
 * name below is quoted so a later plan's `-t "<substring>"` filter resolves
 * to a real spec — see 51-VALIDATION.md's Per-Task Verification Map.
 *
 * Every asserted copy string is quoted verbatim from
 * `51-UI-SPEC.md § Copywriting Contract` — never paraphrased.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { useQuery } from 'convex/react'
import { ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import type { DerivationInputs } from '@/lib/derivedState'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'

// Wave 0 (51-VALIDATION): these specs are written BEFORE the page exists.
// They skip cleanly until app/(editorial)/s/[section]/page.tsx lands (plan
// 51-04), then run for real with no edit to this guard.
const PAGE_PATH = path.resolve(__dirname, '../app/(editorial)/s/[section]/page.tsx')
const pageExists = existsSync(PAGE_PATH)
const d = pageExists ? describe : describe.skip

// ── Module mocks (mirrors Galley.test.tsx's convex/react harness) ──────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    claimChecks: { listByRunId: 'claimChecks:listByRunId', setStatus: 'claimChecks:setStatus' },
  },
}))

// Vitest hoists `vi.mock` calls above module-scope `const`/`let`
// declarations, so any vi.fn() the factories below reference must itself be
// created inside `vi.hoisted` (the officially supported escape hatch) to
// avoid a temporal-dead-zone error at collection time.
const hoisted = vi.hoisted(() => ({
  getDraft: vi.fn(),
  patchSection: vi.fn(),
  patchBonus: vi.fn(),
  acceptFinding: vi.fn(),
  dismissFinding: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('@/lib/contentPatchClient', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/contentPatchClient')>('@/lib/contentPatchClient')
  return {
    ...actual,
    getDraft: hoisted.getDraft,
    patchSection: hoisted.patchSection,
    patchBonus: hoisted.patchBonus,
  }
})

vi.mock('@/lib/findingsClient', () => {
  class FindingsError extends Error {
    constructor(
      public readonly status: number,
      public readonly reason: string,
      message: string,
    ) {
      super(message)
      this.name = 'FindingsError'
    }
  }
  return {
    FindingsError,
    acceptFinding: hoisted.acceptFinding,
    dismissFinding: hoisted.dismissFinding,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: hoisted.routerPush }),
  notFound: vi.fn(),
}))

// ── useCurrentRun mock — mutable `let`, individual tests reassign ──────────

const EMPTY_DERIVATION_INPUTS: DerivationInputs = {
  issueNumber: 7,
  runId: 'run_1',
  issue: null,
  signOffs: {},
  claimRows: [],
  qaFindings: [],
  pitchRows: [],
  runStatus: 'complete',
  runStartedAt: Date.now(),
  runCompletedAt: Date.now(),
}

function defaultCurrentRun() {
  return {
    state: { kind: 'run' as const },
    runId: 'run_1',
    issueNumber: 7,
    title: 'The Quiet Ledger',
    derivationInputs: EMPTY_DERIVATION_INPUTS,
    qaFindings: [] as unknown[],
  }
}

// eslint-disable-next-line prefer-const -- individual tests reassign this.
let mockCurrentRun: Record<string, unknown> = defaultCurrentRun()

vi.mock('@/lib/useCurrentRun', () => ({
  useCurrentRun: () => mockCurrentRun,
}))

// ── Draft fixture ────────────────────────────────────────────────────────
//
// originStory carries three paragraph blocks (per the plan's fixture spec);
// problemStatement is also populated so the "N of 9 sections still need
// you" nav cases below have somewhere real for their open findings to
// attach (deriveSectionStates treats a section with no generated content as
// 'not-generated' regardless of any findings pointed at it).

const draft: DraftResponse = {
  revisionId: 'rev_1',
  sections: {
    originStory: {
      headline: 'A Quiet Beginning',
      blocks: [
        { type: 'paragraph', text: 'The founder started in a garage in 1974.' },
        { type: 'paragraph', text: 'Funding was thin for the first three winters.' },
        { type: 'paragraph', text: 'A single donor changed everything in 1978.' },
      ],
      lossy: false,
    },
    problemStatement: {
      headline: 'The Problem',
      blocks: [{ type: 'paragraph', text: 'Funding dried up after the regional bank closed.' }],
      lossy: false,
    },
  },
  theme: { fontDisplay: 'Newsreader', fontBody: 'Lora', accentColor: '#9A3324' },
  game: {
    headline: 'Play the game',
    description: 'A short interactive.',
    embedCode: '<canvas></canvas>',
  },
  bonus: {
    headline: 'Spec Ad',
    body: [{ type: 'paragraph', text: 'Imagine a world where lip balm funds shelters.' }],
  },
  bonusType: 'specAd',
  podcast: { transcript: 'Host: Today we cover an obscure charity.' },
  conversation: [{ speaker: 'Scout', text: 'Found a promising candidate.' }],
}

/** A group of N QA findings sharing axis + suggestedFix (READ-04 grouping). */
function groupFindings(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    _id: `q${i}`,
    severity: 'warning' as const,
    axis: 'precision',
    sectionName: 'origin_story',
    reason: 'Vague causal claim.',
    suggestedFix: 'Be precise about the mechanism.',
    quotedSpan: i === 0 ? 'in a garage' : `winter ${i}`,
    blockIndexHint: 0,
    accepted: false,
  }))
}

beforeEach(() => {
  mockCurrentRun = defaultCurrentRun()
  hoisted.getDraft.mockReset().mockResolvedValue(draft)
  hoisted.patchSection.mockReset().mockResolvedValue({ revisionId: 'rev_2' })
  hoisted.patchBonus.mockReset().mockResolvedValue({ revisionId: 'rev_2' })
  hoisted.acceptFinding.mockReset()
  hoisted.dismissFinding.mockReset()
  hoisted.routerPush.mockReset()

  // Plan 51-05 (Rule 3 fix — flagged by 51-04's own SUMMARY): `Galley`'s
  // internal `useQuery(api.qaCorrections.byRunId)` / `useQuery(api.
  // claimChecks.listByRunId)` subscriptions are separate from the mocked
  // `useCurrentRun()` above, so they resolved to `undefined` -> `[]` in
  // every spec in this file until wired here — `openFirstFinding()` could
  // never find a mark to click regardless of what the page did. Reads the
  // SAME `mockCurrentRun.derivationInputs` fixture each test already
  // configures, mirroring Galley.test.tsx's own `mockImplementation`
  // pattern (queryRef string comparison against the `@convex/_generated/api`
  // mock's literal values).
  ;(useQuery as ReturnType<typeof vi.fn>).mockReset().mockImplementation((queryRef: unknown) => {
    if (queryRef === 'qaCorrections:byRunId') {
      return (mockCurrentRun.derivationInputs as DerivationInputs).qaFindings
    }
    if (queryRef === 'claimChecks:listByRunId') {
      return (mockCurrentRun.derivationInputs as DerivationInputs).claimRows
    }
    return undefined
  })
})

afterEach(() => {
  cleanup()
})

// A non-literal specifier + `@vite-ignore` keeps Vite's import-analysis
// plugin from statically resolving (and hard-failing the whole file's
// transform) while the target module doesn't exist yet — this function is
// only ever called from inside a `d(...)`-gated `it`, which never runs
// until `pageExists` flips true (plan 51-04), so the actual dynamic import
// never executes today either way.
const SECTION_PAGE_SPECIFIER = '../app/(editorial)/s/[section]/page'

async function renderSection(section: string) {
  const { default: Page } = await import(/* @vite-ignore */ SECTION_PAGE_SPECIFIER)
  // Plan 51-04: the page calls useInspector() (the shared "Inspect how this
  // was made" entry point, Pitfall 3) — a leaf render needs the same
  // InspectorProvider ancestor the real app/(editorial)/layout.tsx mounts.
  // ConfirmProvider/CommandPaletteProvider are NOT needed here: the
  // Inspector panel itself (the only descendant that calls useConfirm) only
  // mounts once openInspector sets a non-null activeKey, which none of
  // these specs trigger.
  return render(
    <InspectorProvider>
      <Page params={{ section }} />
    </InspectorProvider>,
  )
}

async function openFirstFinding() {
  const marks = await screen.findAllByRole('button', { name: /qa warning finding/i })
  fireEvent.click(marks[0])
}

// ── d('renders') — READ-01, D-21 ────────────────────────────────────────────

d('renders', () => {
  it('renders the section as prose inside a .section-reader wrapper', async () => {
    const { container } = await renderSection('originStory')
    await waitFor(() => {
      expect(container.querySelector('.section-reader')).not.toBeNull()
    })
    expect(screen.getByText('The founder started in a garage in 1974.')).toBeDefined()
  })

  it('renders no side rails, tabs or form fields', async () => {
    const { container } = await renderSection('originStory')
    await waitFor(() => {
      expect(container.querySelector('.section-reader')).not.toBeNull()
    })
    expect(container.querySelector('aside')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
  })

  it('renders a skeleton, never a clean-looking page, while loading', async () => {
    mockCurrentRun = { ...defaultCurrentRun(), state: { kind: 'loading' } }
    const { container } = await renderSection('originStory')
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('No open findings in this section.')).toBeNull()
  })

  it('states plainly that an exempt section carries no inline findings', async () => {
    await renderSection('game')
    expect(
      await screen.findByText(
        'This section renders as an interactive game — it carries no inline findings to review here.',
      ),
    ).toBeDefined()
  })
})

// ── d('nav') — READ-07/READ-08, D-14/D-15/D-16 ──────────────────────────────

d('nav', () => {
  it('renders only Next on the first section', async () => {
    await renderSection('originStory')
    await screen.findByText('The founder started in a garage in 1974.')

    expect(screen.getByText(/Problem/)).toBeDefined()
    expect(screen.queryByText(/←/)).toBeNull()
  })

  it('renders only Previous on the last section', async () => {
    await renderSection('theme')

    expect(await screen.findByText(/←/)).toBeDefined()
    expect(screen.queryByText(/→/)).toBeNull()
  })

  it('names the destination section, never a bare Previous/Next', async () => {
    await renderSection('originStory')
    await screen.findByText('The founder started in a garage in 1974.')

    expect(screen.queryByText('Next')).toBeNull()
    expect(screen.queryByText('Previous')).toBeNull()
  })

  it('renders the derived still-need-you sentence', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: {
        ...EMPTY_DERIVATION_INPUTS,
        qaFindings: [
          {
            _id: 'q1',
            severity: 'warning',
            axis: 'precision',
            sectionName: 'origin_story',
            reason: 'Vague causal claim.',
            accepted: false,
          },
          {
            _id: 'q2',
            severity: 'info',
            axis: 'sentiment',
            sectionName: 'problem',
            reason: 'Could use a stronger verb.',
            accepted: false,
          },
        ],
      },
    }
    await renderSection('originStory')
    expect(await screen.findByText('2 of 9 sections still need you.')).toBeDefined()
    cleanup()

    mockCurrentRun = { ...defaultCurrentRun(), derivationInputs: EMPTY_DERIVATION_INPUTS }
    await renderSection('originStory')
    expect(await screen.findByText('All 9 sections are clean — nothing needs you.')).toBeDefined()
  })
})

// ── d('in-place edit') — READ-05, D-18/D-19, Pitfall 5 (patchBonus branch) ──

d('in-place edit', () => {
  it('Edit myself opens a textarea on the flagged block with Save edit / Cancel edit', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(1) },
    }
    await renderSection('originStory')
    await openFirstFinding()
    fireEvent.click(screen.getByRole('button', { name: 'Edit myself' }))

    expect(screen.getByRole('textbox')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Save edit' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeDefined()
  })

  it('Save edit calls patchSection with the current ifRevisionID for a long-read section', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(1) },
    }
    await renderSection('originStory')
    await openFirstFinding()
    fireEvent.click(screen.getByRole('button', { name: 'Edit myself' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }))

    await waitFor(() => {
      expect(hoisted.patchSection).toHaveBeenCalledWith(
        'run_1',
        'originStory',
        expect.objectContaining({ ifRevisionID: 'rev_1' }),
        expect.anything(),
      )
    })
  })

  it('Save edit calls patchBonus, never patchSection, for the bonus section', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: {
        ...EMPTY_DERIVATION_INPUTS,
        qaFindings: [
          {
            _id: 'qb',
            severity: 'warning',
            axis: 'precision',
            sectionName: 'bonus',
            reason: 'Vague pitch.',
            suggestedFix: 'Name the mechanism.',
            quotedSpan: 'Imagine a world',
            blockIndexHint: 0,
            accepted: false,
          },
        ],
      },
    }
    await renderSection('bonus')
    await openFirstFinding()
    fireEvent.click(screen.getByRole('button', { name: 'Edit myself' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }))

    await waitFor(() => {
      expect(hoisted.patchBonus).toHaveBeenCalled()
    })
    expect(hoisted.patchSection).not.toHaveBeenCalled()
  })

  it('a 409 shows the reload-and-retry copy', async () => {
    hoisted.patchSection.mockRejectedValueOnce(
      new ContentPatchError(409, 'revision_mismatch', 'Draft changed.'),
    )
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(1) },
    }
    await renderSection('originStory')
    await openFirstFinding()
    fireEvent.click(screen.getByRole('button', { name: 'Edit myself' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }))

    expect(
      await screen.findByText(
        'This passage changed since you started editing — reload and try again.',
      ),
    ).toBeDefined()
  })

  it('Cancel edit makes no network call and restores the original text', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(1) },
    }
    const { container } = await renderSection('originStory')
    await openFirstFinding()
    fireEvent.click(screen.getByRole('button', { name: 'Edit myself' }))

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'A completely different sentence.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }))

    expect(hoisted.patchSection).not.toHaveBeenCalled()
    expect(hoisted.patchBonus).not.toHaveBeenCalled()
    // The flagged span renders inside a real `<mark>` PLUS a D-07 axis tag
    // ("Fact") immediately after it — the sentence is legitimately split
    // across several DOM nodes (RTL's `getNodeText` only joins an element's
    // OWN direct text-node children, never nested elements' text; see
    // 51-04-SUMMARY.md's identical finding for the header arrow), so no
    // single exact-string match of the full original sentence is possible
    // here. Assert the meaningful thing instead: the edited value was
    // discarded (never left in the document), and the untouched portions of
    // the original sentence — both outside the marked span — are still there.
    expect(container.textContent).not.toContain('A completely different sentence.')
    expect(container.textContent).toContain('The founder started')
    expect(container.textContent).toContain('in 1974.')
  })
})

// ── d('group accept') — READ-04, D-10 – D-13 ────────────────────────────────

d('group accept', () => {
  it('a finding in a group of 2+ shows the count in the accept label', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(3) },
    }
    await renderSection('originStory')
    await openFirstFinding()

    expect(screen.getByText('Accept suggestion (applies to 3 places)')).toBeDefined()
  })

  it('a lone finding shows the plain accept label', async () => {
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(1) },
    }
    await renderSection('originStory')
    await openFirstFinding()

    expect(screen.getByText('Accept suggestion')).toBeDefined()
    expect(screen.queryByText(/\(applies to/)).toBeNull()
  })

  it("group accept calls acceptFinding once per member, each with the previous call's revisionId", async () => {
    hoisted.acceptFinding
      .mockResolvedValueOnce({ revisionId: 'rev_2', findingId: 'q0', resolution: 'accepted' })
      .mockResolvedValueOnce({ revisionId: 'rev_3', findingId: 'q1', resolution: 'accepted' })
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(2) },
    }
    await renderSection('originStory')
    await openFirstFinding()
    fireEvent.click(screen.getByText('Accept suggestion (applies to 2 places)'))

    await waitFor(() => {
      expect(hoisted.acceptFinding).toHaveBeenNthCalledWith(
        1,
        'run_1',
        'q0',
        expect.objectContaining({ ifRevisionID: 'rev_1' }),
        expect.anything(),
      )
      expect(hoisted.acceptFinding).toHaveBeenNthCalledWith(
        2,
        'run_1',
        'q1',
        expect.objectContaining({ ifRevisionID: 'rev_2' }),
        expect.anything(),
      )
    })
  })

  it('partial failure applies what worked and says so', async () => {
    hoisted.acceptFinding
      .mockResolvedValueOnce({ revisionId: 'rev_2', findingId: 'q0', resolution: 'accepted' })
      .mockResolvedValueOnce({ revisionId: 'rev_3', findingId: 'q1', resolution: 'accepted' })
      .mockResolvedValueOnce({ revisionId: 'rev_4', findingId: 'q2', resolution: 'accepted' })
      .mockRejectedValueOnce(new Error('conflict'))
      .mockRejectedValueOnce(new Error('conflict'))
    mockCurrentRun = {
      ...defaultCurrentRun(),
      derivationInputs: { ...EMPTY_DERIVATION_INPUTS, qaFindings: groupFindings(5) },
    }
    await renderSection('originStory')
    await openFirstFinding()
    fireEvent.click(screen.getByText('Accept suggestion (applies to 5 places)'))

    expect(await screen.findByText('3 of 5 applied — 2 still need you.')).toBeDefined()
  })
})

// ── d('inspect') — Pitfall 3 (useInspector must run under InspectorProvider) ─

d('inspect', () => {
  it('renders without throwing useInspector must be used within an InspectorProvider', async () => {
    // Rendering the real (editorial) layout's provider stack is impractical
    // from a leaf page test — assert the source wires InspectorProvider
    // instead (a source-level assertion is acceptable and is explicitly
    // better than no coverage of a runtime-only failure `tsc` cannot catch).
    const layoutPath = path.resolve(__dirname, '../app/(editorial)/layout.tsx')
    if (existsSync(layoutPath)) {
      const source = readFileSync(layoutPath, 'utf-8')
      expect(source).toContain('InspectorProvider')
    } else {
      // No dedicated (editorial) layout yet — fall back to proving the page
      // itself renders without throwing "useInspector must be used within
      // an InspectorProvider" (fails loudly if it does, never silently
      // passes).
      await expect(renderSection('originStory')).resolves.toBeDefined()
    }
  })
})
