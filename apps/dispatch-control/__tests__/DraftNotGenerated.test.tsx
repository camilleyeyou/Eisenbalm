/**
 * Phase 41 (WSP-07, Plan 41-08 Task 2) — the "Not generated" Editor's-note
 * canvas block.
 *
 * A long-read section absent from the draft (`draft.sections[id]` missing,
 * or present with an empty `blocks` array) renders a visible Editor's-note
 * block inside its `galley-{id}` anchor instead of a blank/skipped section
 * — the anchor still exists so the workspace outline's jump-to-section
 * still lands somewhere. A section WITH blocks renders its content
 * normally and never shows the Not-generated block.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { DraftResponse } from '@/lib/contentPatchClient'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => []),
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

import Galley from '../components/galley/Galley'

afterEach(() => {
  cleanup()
})

const noop = () => {}

function baseDraft(overrides: Partial<DraftResponse['sections']> = {}): DraftResponse {
  return {
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
      ...overrides,
    },
    theme: {},
    game: {},
    bonus: {},
    bonusType: 'specAd',
    podcast: { transcript: 'Host: Today we cover an obscure charity.' },
    conversation: [],
  } as DraftResponse
}

describe('Galley "Not generated" Editor\'s-note (WSP-07)', () => {
  it('renders the Not-generated block inside #galley-founderBio when founderBio is absent', () => {
    const draft = baseDraft()
    delete (draft.sections as Record<string, unknown>).founderBio

    const { container } = render(
      <Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />,
    )

    const anchor = container.querySelector('#galley-founderBio')
    expect(anchor).not.toBeNull()
    expect(anchor?.textContent).toMatch(/not generated/i)
  })

  it('does NOT render the Not-generated block when founderBio has blocks', () => {
    const draft = baseDraft()

    const { container } = render(
      <Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />,
    )

    const anchor = container.querySelector('#galley-founderBio')
    expect(anchor).not.toBeNull()
    expect(anchor?.textContent).not.toMatch(/not generated/i)
    expect(screen.getByText('Founder Bio')).toBeDefined()
    expect(screen.getByText(/she trained as an engineer/i)).toBeDefined()
  })

  it('renders the Not-generated block when a section is present but has an empty blocks array', () => {
    const draft = baseDraft({
      caseStudy: { headline: 'Case Study', blocks: [], lossy: false },
    })

    const { container } = render(
      <Galley runId="r1" draft={draft} revisionId="rev-1" reloadDraft={noop} onEditSection={noop} />,
    )

    const anchor = container.querySelector('#galley-caseStudy')
    expect(anchor?.textContent).toMatch(/not generated/i)
  })
})
