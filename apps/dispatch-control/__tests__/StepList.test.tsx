import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import StepList from '../components/editor/StepList'
import type { StepVM } from '../lib/editorState'

afterEach(cleanup)

const steps: StepVM[] = [
  { key: 'a', name: 'Find charities', word: 'Done', line: 'Done · 9:04' },
  { key: 'b', name: 'Write', word: 'Problem', line: 'Problem' },
  { key: 'c', name: 'Check', word: 'Not yet', line: 'Not yet' },
]

describe('StepList', () => {
  it('renders one li per step with name and line', () => {
    const { container } = render(<StepList steps={steps} label="What happened" />)
    expect(container.querySelectorAll('ol > li').length).toBe(3)
    expect(screen.getByText('Find charities')).toBeTruthy()
    expect(screen.getByText('Done · 9:04')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'What happened' })).toBeTruthy()
  })

  it('Problem step has an svg marker', () => {
    const { container } = render(<StepList steps={steps} label="x" />)
    const li = container.querySelectorAll('ol > li')[1]
    expect(li.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })

  it('renders the footer line', () => {
    render(<StepList steps={steps} label="x" footer="This run cost $1.20." />)
    expect(screen.getByText('This run cost $1.20.')).toBeTruthy()
  })
})
