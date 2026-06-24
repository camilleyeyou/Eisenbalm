/**
 * Phase 28 (PRC-09) — scoreClient unit test.
 *
 * Fetch-mocked: asserts scoreOutput POSTs to `/agents/{key}/score` with the
 * §3A.2 request body { workspace_id: 'eisenbalm', agent_key, output } and parses
 * a ScoreResult (overall / axes / rationale / rubric_source + cost fields).
 *
 * Runs in the default node environment (no Convex / no jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// scoreClient reads NEXT_PUBLIC_PIPELINE_URL via pipelineBaseUrl(); set it before import.
process.env.NEXT_PUBLIC_PIPELINE_URL = 'https://pipeline.test'

import { scoreOutput, type ScoreResult } from '@/lib/scoreClient'

const SAMPLE: ScoreResult = {
  overall: 7.4,
  axes: [
    { axis: 'gravity', score: 8, pass: true, note: 'treated with full seriousness' },
    { axis: 'irony-signaling', score: 6, pass: false, note: 'a faint wink in line 3' },
  ],
  rationale: 'Mostly on-voice; one irony slip.',
  rubric_source: 'convex',
  cost_usd: 0.0012,
  tokens_in: 320,
  tokens_out: 88,
  model: 'anthropic/claude-3.5-sonnet',
  duration_ms: 1400,
}

describe('scoreClient.scoreOutput', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /agents/{key}/score with the §3A.2 body and parses a ScoreResult', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => SAMPLE,
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    const result = await scoreOutput('scout', 'some agent output', 'jwt-token')

    // URL ends in /agents/scout/score
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(String(url)).toBe('https://pipeline.test/agents/scout/score')
    expect((init as RequestInit).method).toBe('POST')

    // Bearer header present
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-token')

    // Body has workspace_id / agent_key / output
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({
      workspace_id: 'eisenbalm',
      agent_key: 'scout',
      output: 'some agent output',
    })

    // Parsed ScoreResult
    expect(result.overall).toBe(7.4)
    expect(result.axes).toHaveLength(2)
    expect(result.axes[0].axis).toBe('gravity')
    expect(result.rationale).toBe('Mostly on-voice; one irony slip.')
    expect(result.rubric_source).toBe('convex')
    expect(result.cost_usd).toBe(0.0012)
  })

  it('omits the Authorization header when token is null', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => SAMPLE,
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    await scoreOutput('game', 'output', null)

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('throws with status + detail on a non-ok response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => 'scorer unavailable',
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    await expect(scoreOutput('scout', 'out', null)).rejects.toThrow(
      /score failed \(503\): scorer unavailable/,
    )
  })
})
