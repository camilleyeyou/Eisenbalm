import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/ui/Toast'

function Harness() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.done('Saved.', 'Your change is in this issue.')}>do-done</button>
      <button onClick={() => toast.problem('Nope.', 'Try again.')}>do-problem</button>
      <button onClick={() => toast.info('Working…')}>do-info</button>
      <button
        onClick={() => {
          toast.done('One')
          toast.done('Two')
          toast.done('Three')
          toast.done('Four')
        }}
      >
        do-four
      </button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Toast layer', () => {
  it('renders a done toast with title and detail as a status', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-done'))
    const t = screen.getByTestId('toast')
    expect(t.getAttribute('role')).toBe('status')
    expect(screen.getByText('Saved.')).toBeTruthy()
    expect(screen.getByText('Your change is in this issue.')).toBeTruthy()
  })

  it('problem toast is an alert; info toast is a status', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-problem'))
    expect(screen.getByTestId('toast').getAttribute('role')).toBe('alert')
    fireEvent.click(screen.getByText('do-info'))
    const toasts = screen.getAllByTestId('toast')
    expect(toasts[1]!.getAttribute('role')).toBe('status')
  })

  it('done toast dismisses after 5000 ms, not before', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-done'))
    act(() => {
      vi.advanceTimersByTime(4900)
    })
    expect(screen.queryByTestId('toast')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('problem toast survives 5000 ms and dismisses by 9000 ms', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-problem'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByTestId('toast')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(4100)
    })
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('hover pauses the timer and leaving resumes it', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-done'))
    const t = screen.getByTestId('toast')
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.mouseEnter(t)
    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(screen.queryByTestId('toast')).toBeTruthy()
    fireEvent.mouseLeave(screen.getByTestId('toast'))
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('Dismiss button removes the toast', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-done'))
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('dedups identical tone+title within 1500 ms, allows after', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-done'))
    fireEvent.click(screen.getByText('do-done'))
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    fireEvent.click(screen.getByText('do-done'))
    expect(screen.getAllByTestId('toast')).toHaveLength(2)
  })

  it('keeps at most 3 toasts, dropping the oldest', () => {
    renderWithProvider()
    fireEvent.click(screen.getByText('do-four'))
    const toasts = screen.getAllByTestId('toast')
    expect(toasts).toHaveLength(3)
    expect(screen.queryByText('One')).toBeNull()
    expect(screen.getByText('Four')).toBeTruthy()
  })

  it('useToast without a provider is a silent no-op', () => {
    render(<Harness />)
    expect(() => {
      fireEvent.click(screen.getByText('do-done'))
      fireEvent.click(screen.getByText('do-problem'))
      fireEvent.click(screen.getByText('do-info'))
    }).not.toThrow()
    expect(screen.queryByTestId('toast')).toBeNull()
  })
})
