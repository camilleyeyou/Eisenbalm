/**
 * AppSidebar.test.tsx — Phase 50 Plan 50-01 (WBN-01, D-05) role-indicator
 * render test.
 *
 * `nav.test.ts` stays a plain `.ts` file (node environment, no DOM) and only
 * asserts the NAV_GROUPS data shape. Mounting the real `<AppSidebar>` needs
 * jsdom (environmentMatchGlobs '*.test.tsx' -> jsdom), so this file covers
 * the DOM-level role-indicator contract:
 *   - `useRole()` resolved ('Editor-in-chief' / 'Collaborator') -> the
 *     bottom-left "Signed in as {role}" readout is visible.
 *   - `useRole()` undefined (Clerk still loading) -> nothing renders, so an
 *     Editor-in-chief is never flashed a wrong/default role mid-load.
 *
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/run-monitor',
}))

const { useRoleMock } = vi.hoisted(() => ({ useRoleMock: vi.fn() }))
vi.mock('@/lib/role', () => ({ useRole: useRoleMock }))

import AppSidebar from '../components/AppSidebar'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppSidebar role indicator (WBN-01, D-05)', () => {
  it('shows "Signed in as Editor-in-chief" bottom-left when useRole() resolves', () => {
    useRoleMock.mockReturnValue('Editor-in-chief')
    render(<AppSidebar />)

    expect(screen.getByText('Signed in as Editor-in-chief')).toBeDefined()
  })

  it('shows "Signed in as Collaborator" bottom-left when useRole() resolves to Collaborator', () => {
    useRoleMock.mockReturnValue('Collaborator')
    render(<AppSidebar />)

    expect(screen.getByText('Signed in as Collaborator')).toBeDefined()
  })

  it('renders nothing while useRole() is undefined (Clerk still loading) — never flashes a wrong role', () => {
    useRoleMock.mockReturnValue(undefined)
    render(<AppSidebar />)

    expect(screen.queryByTestId('role-indicator')).toBeNull()
    expect(screen.queryByText(/^Signed in as/)).toBeNull()
  })
})
