/**
 * Phase 41 Plan 41-05 (WSP-03, D-19) — ContextPanel tests.
 *
 * The shared collapsible context-panel shell: content renders when shown,
 * "Hide panel" hides it behind a "Show panel" affordance (never a blank
 * region), and the hidden state persists to `localStorage` across mounts.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ContextPanel, {
  CONTEXT_PANEL_HIDDEN_STORAGE_KEY,
} from '../app/(dashboard)/issues/_components/ContextPanel'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('ContextPanel content (WSP-03)', () => {
  it('renders the title and injected content when shown', () => {
    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )
    expect(screen.getByText('Stage detail')).toBeDefined()
    expect(screen.getByText('Open QA items')).toBeDefined()
    expect(screen.getByRole('button', { name: /hide panel/i })).toBeDefined()
  })

  it('renders never-blank placeholder copy when children is empty', () => {
    render(<ContextPanel title="Stage detail">{null}</ContextPanel>)
    expect(screen.getByText(/nothing to show for this stage yet/i)).toBeDefined()
  })
})

describe('ContextPanel Hide/Show toggle', () => {
  it('hides the content and shows a "Show panel" affordance on click — never a blank region', () => {
    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )
    fireEvent.click(screen.getByRole('button', { name: /hide panel/i }))

    expect(screen.queryByText('Open QA items')).toBeNull()
    expect(screen.queryByText('Stage detail')).toBeNull()
    const showButton = screen.getByRole('button', { name: /show panel/i })
    expect(showButton).toBeDefined()
  })

  it('shows the content again after clicking "Show panel"', () => {
    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )
    fireEvent.click(screen.getByRole('button', { name: /hide panel/i }))
    fireEvent.click(screen.getByRole('button', { name: /show panel/i }))

    expect(screen.getByText('Open QA items')).toBeDefined()
    expect(screen.getByRole('button', { name: /hide panel/i })).toBeDefined()
  })
})

describe('ContextPanel localStorage persistence (D-19)', () => {
  it('persists the hidden state under dc.workspace.contextPanel.hidden on hide', () => {
    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )
    fireEvent.click(screen.getByRole('button', { name: /hide panel/i }))

    expect(window.localStorage.getItem(CONTEXT_PANEL_HIDDEN_STORAGE_KEY)).toBe('true')
  })

  it('clears the persisted hidden state on show', () => {
    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )
    fireEvent.click(screen.getByRole('button', { name: /hide panel/i }))
    fireEvent.click(screen.getByRole('button', { name: /show panel/i }))

    expect(window.localStorage.getItem(CONTEXT_PANEL_HIDDEN_STORAGE_KEY)).toBe('false')
  })

  it('round-trips a previously persisted hidden=true value on a fresh mount', () => {
    window.localStorage.setItem(CONTEXT_PANEL_HIDDEN_STORAGE_KEY, 'true')

    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )

    expect(screen.getByRole('button', { name: /show panel/i })).toBeDefined()
    expect(screen.queryByText('Open QA items')).toBeNull()
  })

  it('degrades to shown on a fresh mount with no persisted value', () => {
    render(
      <ContextPanel title="Stage detail">
        <p>Open QA items</p>
      </ContextPanel>,
    )

    expect(screen.getByText('Open QA items')).toBeDefined()
    expect(screen.getByRole('button', { name: /hide panel/i })).toBeDefined()
  })
})
