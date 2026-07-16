/**
 * Phase 45 Plan 45-05 Task 1 (REV-01, docs/API_CONTRACTS.md §45.6) — live
 * assertions replacing the Wave-0 (45-01) `it.todo` scaffold.
 *
 * `PassageToolbar` reads `window.getSelection()` on `selectionchange`/
 * `mouseup` — this suite mocks `window.getSelection` directly (jsdom does
 * not implement real text-selection layout) and dispatches the DOM event,
 * exactly the mechanism the real component listens for.
 *
 * "Edit text" and "Related facts & sources" are, at THIS layer, prop-firing
 * contracts only — the toolbar itself does not render `BlockEditor` or
 * `ClaimProvenanceCard` (those are wired by the surface, Plan 45-05 Task 2);
 * this suite proves the toolbar hands back the exact selection shape the
 * surface needs to route into them.
 */
import { useRef } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import {
  PassageToolbar,
  type PassageToolbarProps,
} from '../components/galley/PassageToolbar'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const SIX_ACTIONS_IN_ORDER = [
  'Edit text',
  'Ask agent to revise',
  'Compare with previous',
  'Restore previous',
  'Related facts & sources',
  'Inspect how this was made',
]

/** A minimal `Selection`-shaped test double — only the members the component reads. */
function mockSelection(anchorNode: Node, text: string) {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    rangeCount: 1,
    anchorNode,
    toString: () => text,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    }),
  } as unknown as Selection)
}

function mockEmptySelection() {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: true,
    rangeCount: 0,
    anchorNode: null,
    toString: () => '',
  } as unknown as Selection)
}

function fireSelectionChange() {
  act(() => {
    document.dispatchEvent(new Event('selectionchange'))
  })
}

/** Renders a galley-shaped container (root + one stamped block) around the toolbar. */
function Harness(props: Partial<PassageToolbarProps> = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={containerRef} className="galley-root">
      <section id="galley-founderBio">
        <p data-block-index={1} data-testid="target-block">
          The quick brown fox jumps over the lazy dog.
        </p>
      </section>
      <PassageToolbar containerRef={containerRef} {...props} />
    </div>
  )
}

describe('PassageToolbar (§45.6)', () => {
  it('renders nothing without an active in-container selection', () => {
    mockEmptySelection()
    render(<Harness />)
    fireSelectionChange()

    expect(screen.queryByRole('toolbar', { name: 'Passage actions' })).toBeNull()
  })

  it('renders all six actions, in REV-01 order, on a passage selection', () => {
    render(<Harness />)
    const block = screen.getByTestId('target-block')
    mockSelection(block.firstChild as Node, 'brown fox')
    fireSelectionChange()

    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(SIX_ACTIONS_IN_ORDER)
  })

  it('Compare with previous and Restore previous render reserved-with-title (D-17, no shipped content-version endpoint)', () => {
    render(<Harness />)
    const block = screen.getByTestId('target-block')
    mockSelection(block.firstChild as Node, 'brown fox')
    fireSelectionChange()

    const compare = screen.getByRole('button', { name: 'Compare with previous' }) as HTMLButtonElement
    const restore = screen.getByRole('button', { name: 'Restore previous' }) as HTMLButtonElement
    expect(compare.disabled).toBe(true)
    expect(compare.title).toMatch(/not yet wired|arrives later/i)
    expect(restore.disabled).toBe(true)
    expect(restore.title).toMatch(/not yet wired|deferred/i)
  })

  it('Ask agent to revise fires onRevise with the selected passage', () => {
    const onRevise = vi.fn()
    render(<Harness onRevise={onRevise} />)
    const block = screen.getByTestId('target-block')
    mockSelection(block.firstChild as Node, 'brown fox')
    fireSelectionChange()

    screen.getByRole('button', { name: 'Ask agent to revise' }).click()

    expect(onRevise).toHaveBeenCalledWith({
      sectionName: 'founderBio',
      quotedText: 'brown fox',
      blockIndexHint: 1,
    })
  })

  it('Edit text fires onEditText with the block/section-resolved selection (the surface routes this into BlockEditor)', () => {
    const onEditText = vi.fn()
    render(<Harness onEditText={onEditText} />)
    const block = screen.getByTestId('target-block')
    mockSelection(block.firstChild as Node, 'brown fox')
    fireSelectionChange()

    screen.getByRole('button', { name: 'Edit text' }).click()

    expect(onEditText).toHaveBeenCalledWith({
      sectionId: 'founderBio',
      blockIndex: 1,
      quotedText: 'brown fox',
    })
  })

  it('Related facts & sources fires onRelatedFacts with the selection (the surface renders the shared ClaimProvenanceCard)', () => {
    const onRelatedFacts = vi.fn()
    render(<Harness onRelatedFacts={onRelatedFacts} />)
    const block = screen.getByTestId('target-block')
    mockSelection(block.firstChild as Node, 'brown fox')
    fireSelectionChange()

    screen.getByRole('button', { name: 'Related facts & sources' }).click()

    expect(onRelatedFacts).toHaveBeenCalledWith({
      sectionId: 'founderBio',
      blockIndex: 1,
      quotedText: 'brown fox',
    })
  })

  it('Inspect how this was made calls the Phase 44 onInspect prop with the section id', () => {
    const onInspect = vi.fn()
    render(<Harness onInspect={onInspect} />)
    const block = screen.getByTestId('target-block')
    mockSelection(block.firstChild as Node, 'brown fox')
    fireSelectionChange()

    screen.getByRole('button', { name: 'Inspect how this was made' }).click()

    expect(onInspect).toHaveBeenCalledWith('founderBio')
  })
})
