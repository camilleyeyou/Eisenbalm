/**
 * Quick task 260710-iwy — PreviewIframe load-timeout regression tests.
 *
 * Bug: the load-timeout useEffect used to have a `[]` dep array, freezing a
 * stale `loaded=false` closure. After a successful onLoad, the still-pending
 * 30s timer would fire and flip the component to the "Preview unavailable."
 * error state, replacing a good preview. The fix depends the effect on
 * [loaded] and early-returns once loaded, so the timer is cancelled by the
 * cleanup on the next render after load.
 *
 * Runs in jsdom (environmentMatchGlobs *.test.tsx -> jsdom).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

import PreviewIframe from '../app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('PreviewIframe load-timeout (stale closure fix)', () => {
  it('a loaded iframe stays visible past the timeout', () => {
    render(<PreviewIframe previewUrl="https://example.test/preview" />)

    fireEvent.load(screen.getByTitle('Issue preview'))

    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    expect(screen.queryByText('Preview unavailable.')).toBeNull()
    expect(screen.getByTitle('Issue preview')).toBeDefined()
  })

  it('a never-loading iframe shows the error state after the timeout', () => {
    render(<PreviewIframe previewUrl="https://example.test/preview" />)

    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    expect(screen.getByText('Preview unavailable.')).toBeDefined()
  })
})
