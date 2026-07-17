/**
 * Phase 38 (EVL-02/EVL-03) Plan 38-05 — EvalDrawer tests.
 *
 * Task 1 (D-04/D-05): auto-select by agentKey, N-scenario draft-vs-active
 * scoreboard on explicit click only, eval_scores persistence per scored side.
 *
 * Task 3 (closes plan-review Blocker 1) appends a second describe block below
 * covering VersionHistoryPanel's "Run evals for v{N}" freshness-producer
 * affordance, which mounts THIS component with a `targetVersion` prop.
 *
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn(async () => 'tok-clerk') }),
  useUser: () => ({ user: { id: 'user_1' } }),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    promptVersions: {
      getActive: 'promptVersions:getActive',
      listForAgent: 'promptVersions:listForAgent',
      activate: 'promptVersions:activate',
    },
    evalScores: { record: 'evalScores:record' },
    runs: { latest: 'runs:latest' },
  },
}))

vi.mock('@/lib/evalScenarioClient', () => ({
  fetchScenarios: vi.fn(),
}))

vi.mock('@/lib/testRunClient', () => ({
  runAgentTest: vi.fn(),
  runActiveVersionTest: vi.fn(),
}))

vi.mock('@/lib/scoreClient', () => ({
  scoreOutput: vi.fn(),
}))

import { useQuery, useMutation } from 'convex/react'
import { fetchScenarios } from '@/lib/evalScenarioClient'
import { runAgentTest, runActiveVersionTest } from '@/lib/testRunClient'
import { scoreOutput } from '@/lib/scoreClient'
import EvalDrawer from '../app/(dashboard)/prompt-lab/_components/EvalDrawer'
import VersionHistoryPanel from '../app/(dashboard)/prompt-lab/_components/VersionHistoryPanel'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'scout_normal_week',
    agentKey: 'scout',
    description: 'A routine week with no red flags.',
    whatItCatches: 'catches normal-week complacency',
    input: { featured_keys: '[]' },
    scoringTarget: { min_overall: 7 },
  },
  {
    id: 'scout_dry_well',
    agentKey: 'scout',
    description: 'No viable candidates surface.',
    whatItCatches: 'catches dry-well overreach',
    input: { featured_keys: '["a","b"]' },
    scoringTarget: { min_overall: 6.5 },
  },
]

const recordMock = vi.fn(async () => 'row-id')
const activateMock = vi.fn(async () => ({ blocked: false }))

function mockConvex({
  active = null,
  versions,
  latestRun = null,
}: {
  active?: { version: number; content: string } | null
  versions?: unknown[]
  latestRun?: unknown
} = {}) {
  vi.mocked(useQuery).mockImplementation((ref: unknown) => {
    if (ref === 'promptVersions:getActive') return active
    if (ref === 'promptVersions:listForAgent') return versions
    if (ref === 'runs:latest') return latestRun
    return undefined
  })
  vi.mocked(useMutation).mockImplementation((ref: unknown) => {
    if (ref === 'evalScores:record') return recordMock
    if (ref === 'promptVersions:activate') return activateMock
    return vi.fn()
  })
}

function mockRunAndScore() {
  vi.mocked(runAgentTest).mockResolvedValue({
    output: 'draft-out',
    cost_usd: 0.01,
    tokens_in: 10,
    tokens_out: 10,
    model: 'test-model',
    duration_ms: 100,
  })
  vi.mocked(runActiveVersionTest).mockResolvedValue({
    output: 'active-out',
    cost_usd: 0.02,
    tokens_in: 10,
    tokens_out: 10,
    model: 'test-model',
    duration_ms: 100,
  })
  vi.mocked(scoreOutput).mockImplementation(async (_agentKey: string, output: string) => ({
    overall: output === 'draft-out' ? 8.5 : 7.0,
    axes: [{ axis: 'gravity', score: output === 'draft-out' ? 8.5 : 7.0, pass: true, note: '' }],
    rationale: 'ok',
    rubric_source: 'disk',
    cost_usd: 0.001,
    tokens_in: 5,
    tokens_out: 5,
    model: 'judge-model',
    duration_ms: 50,
  }))
}

beforeEach(() => {
  vi.mocked(fetchScenarios).mockReset()
  vi.mocked(fetchScenarios).mockResolvedValue(SCENARIOS)
  vi.mocked(runAgentTest).mockReset()
  vi.mocked(runActiveVersionTest).mockReset()
  vi.mocked(scoreOutput).mockReset()
  recordMock.mockClear()
  activateMock.mockClear()
  mockConvex({ active: { version: 3, content: 'ACTIVE PROMPT' } })
})

afterEach(() => {
  cleanup()
})

async function waitForScenarios() {
  await waitFor(() => {
    expect(screen.getByTestId('eval-row-scout_normal_week')).toBeDefined()
  })
}

// ── Task 1 ───────────────────────────────────────────────────────────────────

describe('EvalDrawer — auto-select + N-scenario scoreboard (D-04/D-05, Plan 38-05 Task 1)', () => {
  it('Test 1: auto-selects by agentKey — renders exactly the 2 mocked scout scenarios, no manual picker', async () => {
    render(<EvalDrawer workspaceId="eisenbalm" agentKey="scout" draftPrompt="draft text" />)

    await waitForScenarios()
    expect(screen.getByTestId('eval-row-scout_dry_well')).toBeDefined()
    expect(fetchScenarios).toHaveBeenCalledWith('scout', 'tok-clerk')
  })

  it('Test 4: does NOT auto-run on mount or on a draftPrompt prop change — only the explicit click scores anything', async () => {
    mockRunAndScore()
    const { rerender } = render(
      <EvalDrawer workspaceId="eisenbalm" agentKey="scout" draftPrompt="draft v1" />,
    )
    await waitForScenarios()

    rerender(<EvalDrawer workspaceId="eisenbalm" agentKey="scout" draftPrompt="draft v2 — edited" />)

    expect(runAgentTest).not.toHaveBeenCalled()
    expect(scoreOutput).not.toHaveBeenCalled()
  })

  it('Test 2: clicking "Run evals" shows draft/active/delta per row + an aggregate summary on top', async () => {
    mockRunAndScore()
    render(<EvalDrawer workspaceId="eisenbalm" agentKey="scout" draftPrompt="draft text" />)
    await waitForScenarios()

    fireEvent.click(screen.getByRole('button', { name: /test changes/i }))

    await waitFor(() => {
      expect(screen.getByTestId('eval-row-draft-scout_normal_week')).toBeDefined()
    })

    const row = within(screen.getByTestId('eval-row-scout_normal_week'))
    expect(row.getByTestId('eval-row-draft-scout_normal_week').textContent).toMatch(/8\.5/)
    expect(row.getByTestId('eval-row-active-scout_normal_week').textContent).toMatch(/7\.0/)
    expect(row.getByTestId('eval-row-delta-scout_normal_week').textContent).toMatch(/\+1\.5/)

    const aggregate = within(screen.getByTestId('eval-aggregate'))
    expect(aggregate.getByTestId('eval-aggregate-draft').textContent).toMatch(/8\.5/)
    expect(aggregate.getByTestId('eval-aggregate-active').textContent).toMatch(/7\.0/)
    expect(aggregate.getByTestId('eval-aggregate-delta').textContent).toMatch(/\+1\.5/)
  })

  it('Test 3: persists eval_scores once per scored side per scenario (source "drawer", no targetVersion)', async () => {
    mockRunAndScore()
    render(<EvalDrawer workspaceId="eisenbalm" agentKey="scout" draftPrompt="draft text" />)
    await waitForScenarios()

    fireEvent.click(screen.getByRole('button', { name: /test changes/i }))

    await waitFor(() => {
      expect(recordMock).toHaveBeenCalledTimes(4) // 2 scenarios x (draft + active)
    })

    const draftCalls = recordMock.mock.calls.filter(([args]) => args.promptVersion === 'draft')
    expect(draftCalls).toHaveLength(2)
    draftCalls.forEach(([args]) => expect(args.source).toBe('drawer'))

    const activeCalls = recordMock.mock.calls.filter(([args]) => args.promptVersion === '3')
    expect(activeCalls).toHaveLength(2)
    activeCalls.forEach(([args]) => expect(args.source).toBe('drawer'))
  })

  it('Test 5: targetVersion tags the DRAFT side promptVersion=String(N) source="commit"; active side stays "drawer"', async () => {
    mockRunAndScore()
    render(
      <EvalDrawer
        workspaceId="eisenbalm"
        agentKey="scout"
        draftPrompt="v2 saved content"
        targetVersion={{ version: 2 }}
      />,
    )
    await waitForScenarios()

    fireEvent.click(screen.getByRole('button', { name: /test changes/i }))

    await waitFor(() => {
      expect(recordMock).toHaveBeenCalledTimes(4)
    })

    const draftCalls = recordMock.mock.calls.filter(([args]) => args.promptVersion === '2')
    expect(draftCalls).toHaveLength(2)
    draftCalls.forEach(([args]) => expect(args.source).toBe('commit'))

    // Active side is untouched by targetVersion — still tagged to the real
    // active version + source 'drawer'.
    const activeCalls = recordMock.mock.calls.filter(([args]) => args.promptVersion === '3')
    expect(activeCalls).toHaveLength(2)
    activeCalls.forEach(([args]) => expect(args.source).toBe('drawer'))
  })
})

// ── Task 3 ───────────────────────────────────────────────────────────────────

describe('VersionHistoryPanel — "Run evals for v{N}" freshness producer (Plan 38-05 Task 3)', () => {
  const VERSIONS = [
    {
      _id: 'pv1',
      version: 1,
      content: 'v1 content',
      isActive: false,
      createdAt: 1000,
      createdBy: 'user_1',
      note: undefined,
    },
    {
      _id: 'pv2',
      version: 2,
      content: 'v2 content',
      isActive: true,
      createdAt: 2000,
      createdBy: 'user_1',
      note: undefined,
    },
  ]

  it('shows "Test changes for v{N}" on the non-active row only — not on the active row', () => {
    mockConvex({ active: { version: 2, content: 'v2 content' }, versions: VERSIONS })
    render(<VersionHistoryPanel workspaceId="eisenbalm" agentKey="scout" />)

    expect(screen.getByRole('button', { name: /test changes for v1/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /test changes for v2/i })).toBeNull()
  })

  it("clicking it mounts EvalDrawer with draftPrompt = that version's content + targetVersion set, writing commit-tagged eval_scores", async () => {
    mockRunAndScore()
    mockConvex({ active: { version: 2, content: 'v2 content' }, versions: VERSIONS })
    render(<VersionHistoryPanel workspaceId="eisenbalm" agentKey="scout" />)

    fireEvent.click(screen.getByRole('button', { name: /test changes for v1/i }))

    await waitForScenarios()

    fireEvent.click(screen.getByRole('button', { name: /test changes \(/i }))

    await waitFor(() => {
      expect(recordMock).toHaveBeenCalledTimes(4)
    })

    // v1's SAVED content flowed through as the draft-side run input.
    expect(runAgentTest).toHaveBeenCalledWith(
      'scout',
      expect.objectContaining({ draft_prompt: 'v1 content' }),
      'tok-clerk',
    )

    const draftCalls = recordMock.mock.calls.filter(([args]) => args.promptVersion === '1')
    expect(draftCalls).toHaveLength(2)
    draftCalls.forEach(([args]) => expect(args.source).toBe('commit'))
  })
})
