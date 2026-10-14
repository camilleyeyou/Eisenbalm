// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  groupFindingRows,
  jumpToFinding,
  focusFieldContainingQuote,
  applyFixToGroup,
  dismissGroup,
  SUPERSEDED_REASON,
  type FindingRowInput,
} from '../app/(dashboard)/review-desk/[runId]/_components/storyFindingActions'
import { acceptFinding, dismissFinding, FindingsError } from '@/lib/findingsClient'

vi.mock('@/lib/findingsClient', async orig => ({
  ...((await orig()) as object),
  acceptFinding: vi.fn(),
  dismissFinding: vi.fn(),
}))

const accept = vi.mocked(acceptFinding)
const dismiss = vi.mocked(dismissFinding)
const getToken = async () => 'tok'

function row(o: Partial<FindingRowInput> & { findingId: string }): FindingRowInput {
  return { sectionId: 'game', severity: 'error', reason: 'r-' + o.findingId, ...o }
}

beforeEach(() => {
  accept.mockReset()
  dismiss.mockReset()
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('groupFindingRows', () => {
  it('merges same quote with case/whitespace/quote differences', () => {
    const g = groupFindingRows(
      [row({ findingId: 'a', quotedSpan: 'operating in that watershed since 2009', severity: 'warning' })],
      [row({ findingId: 'b', quotedSpan: '  “Operating in that  watershed since 2009” ' })],
    )
    expect(g).toHaveLength(1)
    expect(g[0].findingIds).toEqual(['b', 'a'])
    expect(g[0].reasons).toHaveLength(2)
    expect(g[0].severity).toBe('error')
    expect(g[0].anchoredFindingId).toBe('a')
  })
  it('dedupes identical reasons', () => {
    const g = groupFindingRows([], [
      row({ findingId: 'a', quotedSpan: 'x', reason: 'Same  reason' }),
      row({ findingId: 'b', quotedSpan: 'x', reason: 'same reason' }),
    ])
    expect(g[0].reasons).toHaveLength(1)
  })
  it('does not merge across sections or without quote', () => {
    const g = groupFindingRows([], [
      row({ findingId: 'a', quotedSpan: 'x', sectionId: 's1' }),
      row({ findingId: 'b', quotedSpan: 'x', sectionId: 's2' }),
      row({ findingId: 'c' }),
      row({ findingId: 'd' }),
    ])
    expect(g).toHaveLength(4)
  })
  it('axis/suggestedFix/ordering', () => {
    const g = groupFindingRows([], [
      row({ findingId: 'a', quotedSpan: 'x', severity: 'info', axis: 'gravity', suggestedFix: 'fix-a' }),
      row({ findingId: 'b', quotedSpan: 'x', severity: 'error', axis: 'voice' }),
      row({ findingId: 'c', quotedSpan: 'y' }),
    ])
    expect(g[0].axis).toBe('voice')
    expect(g[0].suggestedFix).toBe('fix-a')
    expect(g[0].anchoredFindingId).toBeUndefined()
    expect(g[1].findingIds).toEqual(['c'])
  })
})

describe('jumpToFinding', () => {
  it('clicks the mark when present', () => {
    document.body.innerHTML = '<mark id="finding-f1"></mark>'
    const click = vi.fn()
    document.getElementById('finding-f1')!.addEventListener('click', click)
    const fb = vi.fn()
    expect(jumpToFinding('f1', fb)).toBe(true)
    expect(click).toHaveBeenCalled()
    expect(fb).not.toHaveBeenCalled()
  })
  it('falls back when missing', () => {
    const fb = vi.fn()
    expect(jumpToFinding('f1', fb)).toBe(false)
    expect(fb).toHaveBeenCalledWith('f1')
  })
})

describe('focusFieldContainingQuote', () => {
  it('focuses and selects in the matching textarea', () => {
    document.body.innerHTML =
      '<div id="c"><input type="text" value="Headline"><textarea>Foo Operating In That Watershed bar</textarea></div>'
    const c = document.getElementById('c')!
    expect(focusFieldContainingQuote(c, 'operating in that watershed')).toBe(true)
    const ta = c.querySelector('textarea')!
    expect(document.activeElement).toBe(ta)
    expect(ta.selectionStart).toBe(4)
    expect(ta.selectionEnd).toBe(4 + 'operating in that watershed'.length)
  })
  it('returns false with no match', () => {
    document.body.innerHTML = '<div id="c"><textarea>nothing</textarea></div>'
    expect(focusFieldContainingQuote(document.getElementById('c')!, 'zzz')).toBe(false)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('applyFixToGroup', () => {
  const m2 = [
    { findingId: 'a', suggestedFix: 'x' },
    { findingId: 'b', suggestedFix: 'y' },
  ]
  it('threads revisionId sequentially', async () => {
    accept.mockResolvedValueOnce({ revisionId: 'rev-2', findingId: 'a', resolution: 'accepted' })
    accept.mockResolvedValueOnce({ revisionId: 'rev-3', findingId: 'b', resolution: 'accepted' })
    const r = await applyFixToGroup({ runId: 'r', revisionId: 'rev-1', members: m2, getToken })
    expect(accept).toHaveBeenCalledTimes(2)
    expect(accept.mock.calls[1][2].ifRevisionID).toBe('rev-2')
    expect(r).toMatchObject({ applied: 2, superseded: 0, failed: [] })
  })
  it('dismisses superseded siblings', async () => {
    accept.mockResolvedValueOnce({ revisionId: 'rev-2', findingId: 'a', resolution: 'accepted' })
    accept.mockRejectedValueOnce(new FindingsError(409, 'span_not_resolved', 'm'))
    dismiss.mockResolvedValue({ findingId: 'b', resolution: 'dismissed' })
    const r = await applyFixToGroup({ runId: 'r', revisionId: 'rev-1', members: m2, getToken })
    expect(dismiss).toHaveBeenCalledWith('r', 'b', { reason: SUPERSEDED_REASON }, 'tok')
    expect(r).toMatchObject({ applied: 1, superseded: 1, failed: [] })
  })
  it('member without fix is dismissed only if applied > 0', async () => {
    accept.mockResolvedValue({ revisionId: 'rev-2', findingId: 'a', resolution: 'accepted' })
    dismiss.mockResolvedValue({ findingId: 'n', resolution: 'dismissed' })
    const members = [{ findingId: 'a', suggestedFix: 'x' }, { findingId: 'n' }]
    const r = await applyFixToGroup({ runId: 'r', revisionId: 'v', members, getToken })
    expect(accept).toHaveBeenCalledTimes(1)
    expect(r.superseded).toBe(1)
    accept.mockClear()
    const r2 = await applyFixToGroup({ runId: 'r', revisionId: 'v', members: [{ findingId: 'n' }], getToken })
    expect(accept).not.toHaveBeenCalled()
    expect(r2.failed).toEqual(['n'])
  })
  it('stops on revision_mismatch', async () => {
    accept.mockRejectedValueOnce(new FindingsError(409, 'revision_mismatch', 'm'))
    const r = await applyFixToGroup({ runId: 'r', revisionId: 'v', members: m2, getToken })
    expect(accept).toHaveBeenCalledTimes(1)
    expect(r.failed).toEqual(['a', 'b'])
    expect(r.note).toMatch(/draft changed/)
  })
})

describe('dismissGroup', () => {
  it('dismisses each id with trimmed reason, returns failures', async () => {
    dismiss.mockResolvedValueOnce({ findingId: 'a', resolution: 'dismissed' })
    dismiss.mockRejectedValueOnce(new Error('x'))
    const failed = await dismissGroup('r', ['a', 'b'], '  nope ', getToken)
    expect(dismiss).toHaveBeenCalledWith('r', 'a', { reason: 'nope' }, 'tok')
    expect(failed).toEqual(['b'])
  })
})
