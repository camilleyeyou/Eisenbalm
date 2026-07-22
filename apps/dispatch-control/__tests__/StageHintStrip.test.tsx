/**
 * Quick 260721-qdx (Task 3) — StageHintStrip.
 *
 * Runs in jsdom (environmentMatchGlobs `*.test.tsx` -> jsdom). Mocks
 * `useOnboarding()` directly (StageHintStrip's only onboarding-context read
 * is `onboarding.dismissedStageHints`) and `convex/react`'s `useMutation` +
 * `@convex/_generated/api` — mirrors the `CreatePanel.test.tsx` /
 * `StartHereCard.test.tsx` scaffolding.
 *
 * The second describe block is a source-scan skip-guard (mirrors the
 * `SECOND_CARD_SHIPPED` idiom in `CreatePanel.test.tsx`) — it reads
 * `StageHintStrip.tsx`'s own source and asserts it does NOT reference
 * `useWorkspaceState`/`setPanelContent`, encoding the CONTEXT's critical
 * render-loop-discipline rule (260721-pmn/-ohu) so a future edit can't
 * silently wire the strip into the `WorkspaceStateProvider` publish cycle.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// ── Module mocks ─────────────────────────────────────────────────────────

const dismissStageHintMock = vi.fn(async () => ({ ok: true }))
vi.mock('convex/react', () => ({
  useMutation: () => (...args: unknown[]) => dismissStageHintMock(...args),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    userOnboarding: {
      dismissStageHint: 'userOnboarding:dismissStageHint',
    },
  },
}))

let onboardingFixture: { dismissedStageHints?: string[] } | null | undefined = {
  dismissedStageHints: [],
}
vi.mock('@/components/onboarding/OnboardingProvider', () => ({
  useOnboarding: () => ({ onboarding: onboardingFixture }),
}))

import StageHintStrip from '../components/onboarding/StageHintStrip'
import { STAGE_HINTS } from '../components/onboarding/onboardingCopy'

beforeEach(() => {
  vi.clearAllMocks()
  onboardingFixture = { dismissedStageHints: [] }
})

afterEach(() => {
  cleanup()
})

describe('StageHintStrip', () => {
  it('renders the correct copy for a given stage', () => {
    render(<StageHintStrip issueNumber={7} stage="fact-check" />)
    expect(screen.getByText(STAGE_HINTS['fact-check'].label)).toBeDefined()
    expect(screen.getByText(new RegExp(STAGE_HINTS['fact-check'].body.slice(0, 20)))).toBeDefined()
  })

  it('clicking "Dismiss" calls the dismissStageHint mutation with that stage', () => {
    render(<StageHintStrip issueNumber={7} stage="voice" />)
    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }))
    expect(dismissStageHintMock).toHaveBeenCalledWith({ stage: 'voice' })
  })

  it('clicking the ✕ close also calls the dismissStageHint mutation with that stage', () => {
    render(<StageHintStrip issueNumber={7} stage="approval" />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss hint/i }))
    expect(dismissStageHintMock).toHaveBeenCalledWith({ stage: 'approval' })
  })

  it('renders nothing when the stage is already present in dismissedStageHints', () => {
    onboardingFixture = { dismissedStageHints: ['story'] }
    const { container } = render(<StageHintStrip issueNumber={7} stage="story" />)
    expect(container.firstChild).toBeNull()
  })

  it('still renders when a DIFFERENT stage is dismissed', () => {
    onboardingFixture = { dismissedStageHints: ['story'] }
    render(<StageHintStrip issueNumber={7} stage="draft" />)
    expect(screen.getByTestId('stage-hint-strip')).toBeDefined()
  })

  it('renders when onboarding is null/undefined (not yet provisioned/loading)', () => {
    onboardingFixture = null
    render(<StageHintStrip issueNumber={7} stage="story" />)
    expect(screen.getByTestId('stage-hint-strip')).toBeDefined()
  })
})

// ── Render-loop discipline source-scan (260721-pmn/-ohu) ────────────────────
//
// NOTE: StageHintStrip.tsx's OWN doc-comment deliberately explains the
// `useWorkspaceState`/`setPanelContent` rule it must never violate — matching
// on the raw file text would false-positive on that comment (the same trap
// CreatePanel.test.tsx's SECOND_CARD_SHIPPED note calls out). Strip comments
// before scanning so this only checks real code.

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const STAGE_HINT_STRIP_SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/onboarding/StageHintStrip.tsx'),
  'utf-8',
)
const STAGE_HINT_STRIP_CODE = stripComments(STAGE_HINT_STRIP_SRC)

describe('StageHintStrip — render-loop discipline (source-scan)', () => {
  it('never imports or calls useWorkspaceState', () => {
    expect(STAGE_HINT_STRIP_CODE).not.toMatch(/useWorkspaceState/)
  })

  it('never calls setPanelContent', () => {
    expect(STAGE_HINT_STRIP_CODE).not.toMatch(/setPanelContent/)
  })
})
