/**
 * Phase 50-03 (D-03/D-15, WBN-05/WBN-06) — Mark Do-not-use typed-name confirm
 * + "Do not use" label tests.
 *
 * Covers:
 *   - The Mark Do-not-use confirm button stays disabled until BOTH the typed
 *     organization name matches the charity's exact name AND the reason is
 *     non-empty (D-15).
 *   - Confirming calls charities:setStatus with the UNCHANGED stored value
 *     `status: 'blocklisted'` (D-03 — label swap only, never the enum).
 *   - CharityStatusBadge renders "Do not use" (not "Blocklisted") for a
 *     'blocklisted' charity.
 *   - No operator-facing "Blocklist"/"Blocklisted" copy survives anywhere in
 *     the rendered RegistryTable output (the `'blocklisted'` value literal in
 *     code/attributes is fine — this checks visible text only).
 *
 * Named `.test.ts` per the plan's file list. Uses `React.createElement`
 * instead of JSX because esbuild's `.ts` loader (unlike `.tsx`) does not
 * parse JSX syntax under this project's vite/esbuild config — see
 * vitest.config.ts. Explicitly routed to jsdom via environmentMatchGlobs
 * (React Testing Library needs a DOM). Mirrors the mocking pattern from
 * CorrectionsList.test.tsx / DecisionRail.roleGate.test.tsx (convex/react +
 * @convex/_generated/api + @/lib/role mocked; render the real component
 * tree).
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import * as React from 'react'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

vi.mock('@convex/_generated/api', () => ({
  api: {
    charities: {
      listByWorkspace: 'charities:listByWorkspace',
      setStatus: 'charities:setStatus',
    },
  },
}))

vi.mock('@/lib/role', () => ({ useRole: () => 'Editor-in-chief' }))

import { useQuery, useMutation } from 'convex/react'
import RegistryTable from '../app/(dashboard)/registry/_components/RegistryTable'
import CharityStatusBadge from '../app/(dashboard)/registry/_components/CharityStatusBadge'

afterEach(() => {
  cleanup()
})

const candidateCharity = {
  _id: 'c1',
  name: 'Acme Org',
  website: 'https://acme.example',
  status: 'candidate',
  timesFeatured: 0,
  lastFeaturedAt: undefined,
  dedupKey: 'acme-org',
}

const blocklistedCharity = {
  _id: 'c2',
  name: 'Old Charity',
  website: undefined,
  status: 'blocklisted',
  timesFeatured: 2,
  lastFeaturedAt: undefined,
  dedupKey: 'old-charity',
}

let setStatusMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  setStatusMock = vi.fn(async () => undefined)
  ;(useMutation as unknown as Mock).mockReturnValue(setStatusMock)
  ;(useQuery as unknown as Mock).mockImplementation((query: unknown) => {
    if (query === 'charities:listByWorkspace') return [candidateCharity, blocklistedCharity]
    return undefined
  })
})

describe('CharityStatusBadge — Do not use label (D-03)', () => {
  it('renders "Do not use" for a blocklisted charity, never "Blocklisted"', () => {
    render(React.createElement(CharityStatusBadge, { status: 'blocklisted' }))
    expect(screen.getByText('Do not use')).toBeDefined()
    expect(screen.queryByText('Blocklisted')).toBeNull()
  })
})

describe('RegistryTable — Mark Do-not-use typed-name confirm (D-15)', () => {
  it('the confirm button is disabled until the typed name matches the charity name AND reason is non-empty', () => {
    render(React.createElement(RegistryTable, { workspace_id: 'ws1' }))

    // Open the confirm popover on the candidate row.
    fireEvent.click(screen.getByRole('button', { name: /^mark do not use$/i }))

    const confirmButton = screen.getByRole('button', { name: /^mark do not use$/i }) as HTMLButtonElement
    const typedNameInput = screen.getByPlaceholderText('Acme Org') as HTMLInputElement
    const reasonInput = screen.getByPlaceholderText(
      'Required — this reason is recorded in the Decision Log.',
    ) as HTMLTextAreaElement

    // Neither field filled — disabled.
    expect(confirmButton.disabled).toBe(true)

    // Reason only — still disabled (name not typed).
    fireEvent.change(reasonInput, { target: { value: 'Website is defunct.' } })
    expect(confirmButton.disabled).toBe(true)

    // Reason + a MISMATCHED typed name — still disabled.
    fireEvent.change(typedNameInput, { target: { value: 'Acme' } })
    expect(confirmButton.disabled).toBe(true)

    // Reason + the EXACT typed name — enabled.
    fireEvent.change(typedNameInput, { target: { value: 'Acme Org' } })
    expect(confirmButton.disabled).toBe(false)
  })

  it('confirming calls charities:setStatus with the unchanged stored value status: "blocklisted"', async () => {
    render(React.createElement(RegistryTable, { workspace_id: 'ws1' }))

    fireEvent.click(screen.getByRole('button', { name: /^mark do not use$/i }))

    const typedNameInput = screen.getByPlaceholderText('Acme Org') as HTMLInputElement
    const reasonInput = screen.getByPlaceholderText(
      'Required — this reason is recorded in the Decision Log.',
    ) as HTMLTextAreaElement

    fireEvent.change(typedNameInput, { target: { value: 'Acme Org' } })
    fireEvent.change(reasonInput, { target: { value: 'Website is defunct.' } })

    const confirmButton = screen.getByRole('button', { name: /^mark do not use$/i })
    fireEvent.click(confirmButton)

    expect(setStatusMock).toHaveBeenCalledWith({
      workspace_id: 'ws1',
      charityId: 'c1',
      status: 'blocklisted',
      reason: 'Website is defunct.',
    })
  })

  it('renders no operator-facing "Blocklist"/"Blocklisted" copy anywhere in the table', () => {
    const { container } = render(React.createElement(RegistryTable, { workspace_id: 'ws1' }))
    expect(container.textContent).not.toMatch(/blocklist/i)
  })
})
