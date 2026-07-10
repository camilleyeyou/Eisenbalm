/**
 * Prompt Lab Nomenclature Proposal (quick 260710-k8y) — PromptSaveDialog tests.
 *
 * Covers the required-note save gate (NOM-02/NOM-04):
 *   - The heading resolves the next version number from
 *     api.promptVersions.listForAgent ("Save draft as v{n}")
 *   - "Confirm save" is DISABLED while the note is empty or whitespace-only
 *   - "Confirm save" is ENABLED once a non-whitespace note is typed
 *   - Clicking "Confirm save" with a real note calls saveVersion exactly once
 *     with the trimmed, non-empty note
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('convex/react', () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    promptVersions: {
      saveVersion: 'promptVersions:saveVersion',
      listForAgent: 'promptVersions:listForAgent',
    },
  },
}))

import { useMutation, useQuery } from 'convex/react'
import { PromptSaveDialog } from '../app/(dashboard)/prompt-lab/_components/PromptSaveDialog'

afterEach(() => {
  cleanup()
})

let saveSpy: Mock

beforeEach(() => {
  vi.clearAllMocks()
  saveSpy = vi.fn(async () => 'v-id')
  ;(useMutation as unknown as Mock).mockReturnValue(saveSpy)
  ;(useQuery as unknown as Mock).mockReturnValue([
    { version: 1 },
    { version: 2 },
  ])
})

describe('PromptSaveDialog', () => {
  it('shows "Save draft as v3" — one past the max existing version', () => {
    render(
      <PromptSaveDialog
        workspaceId="eisenbalm"
        agentKey="game"
        content="prompt body"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByText('Save draft as v3')).toBeDefined()
  })

  it('disables Confirm save while the note is empty', () => {
    render(
      <PromptSaveDialog
        workspaceId="eisenbalm"
        agentKey="game"
        content="prompt body"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    const confirmButton = screen.getByRole('button', {
      name: /confirm save/i,
    }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('enables Confirm save once a non-empty note is typed', () => {
    render(
      <PromptSaveDialog
        workspaceId="eisenbalm"
        agentKey="game"
        content="prompt body"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    const noteInput = screen.getByPlaceholderText(/what changed and why/i)
    fireEvent.change(noteInput, { target: { value: 'Tightened the tone' } })

    const confirmButton = screen.getByRole('button', {
      name: /confirm save/i,
    }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)
  })

  it('disables Confirm save again when the note is set to whitespace only', () => {
    render(
      <PromptSaveDialog
        workspaceId="eisenbalm"
        agentKey="game"
        content="prompt body"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    const noteInput = screen.getByPlaceholderText(/what changed and why/i)
    fireEvent.change(noteInput, { target: { value: 'Tightened the tone' } })
    fireEvent.change(noteInput, { target: { value: '   ' } })

    const confirmButton = screen.getByRole('button', {
      name: /confirm save/i,
    }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('calls saveVersion once with the trimmed note when confirmed with a real note', async () => {
    render(
      <PromptSaveDialog
        workspaceId="eisenbalm"
        agentKey="game"
        content="prompt body"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    const noteInput = screen.getByPlaceholderText(/what changed and why/i)
    fireEvent.change(noteInput, {
      target: { value: '  Tightened the tone  ' },
    })

    fireEvent.click(screen.getByRole('button', { name: /confirm save/i }))

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1)
    })
    expect(saveSpy).toHaveBeenCalledWith({
      workspace_id: 'eisenbalm',
      agentKey: 'game',
      content: 'prompt body',
      createdBy: undefined,
      note: 'Tightened the tone',
    })
  })
})
