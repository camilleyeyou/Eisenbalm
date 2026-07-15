// Phase 44 Wave-0 scaffold (44-01), filled in by 44-06 (INS-01, D-06,
// docs/API_CONTRACTS.md §44.6) — the one-instance/openInspector context
// contract.
//
// `InspectorContainer` is replaced with a test double here (not the real
// Convex-backed container built alongside this test) so this stays a plain
// jsdom unit test of the CONTEXT contract itself — one activeKey, one
// opener, one mounted container regardless of caller count. The real
// container's own Convex-reads + artifact-assembly behavior is exercised by
// its own build verification (Task 2 of 44-06-PLAN.md), not here.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { InspectorProvider, useInspector } from '../components/inspector/InspectorProvider'

vi.mock('../components/inspector/InspectorContainer', () => ({
  InspectorContainer: ({
    artifactKey,
    onClose,
  }: {
    artifactKey: { type: string; runId: string; locator: string }
    onClose: () => void
  }) => (
    <div data-testid="inspector-container">
      <span>{`${artifactKey.type}:${artifactKey.runId}:${artifactKey.locator}`}</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
})

function OpenerButton({ label, artifactKey }: { label: string; artifactKey: string }) {
  const { openInspector } = useInspector()
  return (
    <button type="button" onClick={() => openInspector(artifactKey)}>
      {label}
    </button>
  )
}

describe('InspectorProvider / openInspector (§44.6)', () => {
  it('openInspector(key) sets the active artifact key; closeInspector clears it', () => {
    render(
      <InspectorProvider>
        <OpenerButton label="Open founder" artifactKey="founder:run-1:founderBio" />
      </InspectorProvider>,
    )

    expect(screen.queryByTestId('inspector-container')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open founder' }))
    expect(screen.getByTestId('inspector-container')).toBeDefined()
    expect(screen.getByText('founder:run-1:founderBio')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('inspector-container')).toBeNull()
  })

  it('exactly one panel instance renders regardless of how many entry points call openInspector', () => {
    render(
      <InspectorProvider>
        <OpenerButton label="Open founder" artifactKey="founder:run-1:founderBio" />
        <OpenerButton label="Open claim" artifactKey="claim:run-1:claim-42" />
      </InspectorProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open founder' }))
    expect(screen.getAllByTestId('inspector-container')).toHaveLength(1)
    expect(screen.getByText('founder:run-1:founderBio')).toBeDefined()

    // A second entry point calling openInspector with a DIFFERENT key
    // replaces the single active artifact — it never adds a second panel.
    fireEvent.click(screen.getByRole('button', { name: 'Open claim' }))
    expect(screen.getAllByTestId('inspector-container')).toHaveLength(1)
    expect(screen.getByText('claim:run-1:claim-42')).toBeDefined()
    expect(screen.queryByText('founder:run-1:founderBio')).toBeNull()
  })

  it('an unparseable string key is a no-op — never a crash, never a guessed key', () => {
    render(
      <InspectorProvider>
        <OpenerButton label="Open malformed" artifactKey="not-a-valid-key" />
      </InspectorProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open malformed' }))
    expect(screen.queryByTestId('inspector-container')).toBeNull()
  })

  it('useInspector() throws when used outside InspectorProvider', () => {
    function Bare() {
      useInspector()
      return null
    }
    // Suppress the expected React error-boundary console.error noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Bare />)).toThrow('useInspector must be used within an InspectorProvider')
    spy.mockRestore()
  })
})
