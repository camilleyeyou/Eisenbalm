/**
 * Phase 24 Wave 0 — RED test for the side-by-side DiffViewer (PRM-04).
 *
 * Runs in jsdom (matched by environmentMatchGlobs *.test.tsx → jsdom).
 *
 * The two-column diff (24-RESEARCH Pattern 4) must:
 *   - show removed-only lines on the LEFT with an empty RIGHT cell
 *   - show added-only lines on the RIGHT with an empty LEFT cell
 *   - show context lines on BOTH columns
 *   - render two distinct [data-side] columns (left + right)
 *
 * RED until Plan 08 lands
 * app/(dashboard)/prompts/_components/DiffViewer. The import is guarded so the
 * file import-executes; the render test runs only when the module exists, and
 * fails (RED) until then.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

// Guard the not-yet-existing component.
let DiffViewer: React.ComponentType<{
  left: { label: string; content: string }
  right: { label: string; content: string }
}> | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DiffViewer = require('../app/(dashboard)/prompts/_components/DiffViewer').DiffViewer
} catch {
  DiffViewer = undefined
}

describe('DiffViewer side-by-side columns (PRM-04)', () => {
  it('renders two [data-side] columns for left and right', () => {
    expect(DiffViewer).toBeDefined()

    // Alias the require-guarded component to a capitalized const so it can be
    // used as a JSX element (a non-null assertion in tag position —
    // `<DiffViewer!>` — is invalid TS syntax and never compiles).
    const Diff = DiffViewer!
    const { container } = render(
      <Diff
        left={{ label: 'v1', content: 'line A\nremoved line\nshared\n' }}
        right={{ label: 'v2', content: 'line A\nadded line\nshared\n' }}
      />,
    )

    const sides = container.querySelectorAll('[data-side]')
    const sideValues = new Set(
      Array.from(sides).map((el) => el.getAttribute('data-side')),
    )
    expect(sideValues.has('left')).toBe(true)
    expect(sideValues.has('right')).toBe(true)
  })

  it('shows removed-only text in the left column and added-only in the right', () => {
    const Diff = DiffViewer!
    const { container } = render(
      <Diff
        left={{ label: 'v1', content: 'shared\nremoved line\n' }}
        right={{ label: 'v2', content: 'shared\nadded line\n' }}
      />,
    )

    const left = container.querySelector('[data-side="left"]')
    const right = container.querySelector('[data-side="right"]')
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    expect(left!.textContent).toContain('removed line')
    expect(right!.textContent).toContain('added line')
  })
})
