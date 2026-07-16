/**
 * Phase 44 Plan 44-05 (INS-02/INS-04/INS-06, docs/API_CONTRACTS.md
 * §44.2/§44.7/§44.9) — live assertions replacing the Wave-0 (44-01)
 * placeholder scaffold (every case below was a stubbed pending test there).
 *
 * `InspectorPanel` is pure presentation (no Convex hooks) — it is rendered
 * directly against hand-built `InspectorArtifact` mocks, exactly like
 * `MyTasksList` (__tests__/MyTasksScreen.test.tsx) is tested against
 * `DisplayTask` fixtures. No `convex/react` mocking required.
 *
 * Runs in jsdom (environmentMatchGlobs '__tests__/*.test.tsx' -> jsdom).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  InspectorPanel,
  type InspectorArtifact,
  type InspectorPanelProps,
} from '../components/inspector/InspectorPanel'
import type { MissingInputsResult } from '../lib/inspector/missingInputsDiff'

afterEach(() => {
  cleanup()
})

// ── fixtures ─────────────────────────────────────────────────────────────

function makeArtifact(overrides: Partial<InspectorArtifact> = {}): InspectorArtifact {
  return {
    title: 'Founder Bio',
    meta: 'step: founder_bio · agent: founder_bio · run #7',
    asked: 'Draft the founder bio section.',
    result: 'A founder bio section was produced.',
    confidence: 'high',
    warning: '',
    upstream: 'verify_research',
    downstream: 'validate_sections',
    inputs: '',
    missing: '',
    instructionVersion: '',
    instructions: '',
    sectionGuidance: '',
    sharedRules: [],
    output: 'The founder bio body text.',
    outputNote: '',
    sources: [],
    model: '',
    timing: '1.2s',
    cost: '$0.0231',
    latency: '1.2s',
    validation: 'passed',
    json: '{"technicalMarker":"deadbeef4405"}',
    ...overrides,
  }
}

function makeMissing(overrides: Partial<MissingInputsResult> = {}): MissingInputsResult {
  return {
    supplied: ['research', 'winning_charity', 'style_brief'],
    missing: [],
    approximate: false,
    ...overrides,
  }
}

function makeProps(overrides: Partial<InspectorPanelProps> = {}): InspectorPanelProps {
  return {
    artifact: makeArtifact(),
    agentKey: 'founder_bio',
    promptKey: null,
    runId: 'run-1',
    missing: makeMissing(),
    instructionsExternalized: false,
    divergence: 'unknown',
    onClose: () => {},
    ...overrides,
  }
}

describe('InspectorPanel (§44.2/§44.7/§44.9)', () => {
  it('default active tab is Summary; Technical is never the default', () => {
    render(<InspectorPanel {...makeProps()} />)

    const summaryTab = screen.getByRole('button', { name: 'Summary' })
    const technicalTab = screen.getByRole('button', { name: 'Technical' })
    expect(summaryTab.getAttribute('aria-current')).toBe('page')
    expect(technicalTab.getAttribute('aria-current')).toBeNull()

    // The raw JSON marker is not visible until the operator chooses Technical.
    expect(screen.queryByText(/deadbeef4405/)).toBeNull()
    // The Summary tab's human-readable prose IS visible by default.
    expect(screen.getByText(/Draft the founder bio section\./)).toBeDefined()
  })

  it("every non-Technical tab leads with human-readable content; raw JSON sits behind a 'Show raw JSON' toggle", () => {
    render(<InspectorPanel {...makeProps()} />)

    // Summary (default) shows prose, never JSON.
    expect(screen.getByText(/Draft the founder bio section\./)).toBeDefined()
    expect(screen.queryByText(/deadbeef4405/)).toBeNull()

    // Only the Technical tab renders the raw JSON — it is a destination the
    // operator chooses, never a fallback for another tab.
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }))
    expect(screen.getByText(/deadbeef4405/)).toBeDefined()
  })

  it("Instructions tab renders 'not externalized — code-defined' for origin_story/problem/founder_bio/case_study/qa", () => {
    render(<InspectorPanel {...makeProps({ instructionsExternalized: false })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))
    expect(screen.getByText(/code-defined, not editable here/i)).toBeDefined()
  })

  it('Instructions tab renders the shared rules referenced (VOICE_CONSTRAINTS + STRUCTURE_CONTRACT) for a non-externalized narrative writer, and the rubric shared rule for qa — never a bare one-liner', () => {
    const { unmount } = render(
      <InspectorPanel
        {...makeProps({
          agentKey: 'founder_bio',
          instructionsExternalized: false,
          artifact: makeArtifact({
            sharedRules: [{ label: 'VOICE_CONSTRAINTS' }, { label: 'STRUCTURE_CONTRACT' }],
          }),
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))
    // Never a bare one-liner: the "code-defined" state AND the shared rules
    // both render together.
    expect(screen.getByText(/code-defined, not editable here/i)).toBeDefined()
    expect(screen.getByText('VOICE_CONSTRAINTS')).toBeDefined()
    expect(screen.getByText('STRUCTURE_CONTRACT')).toBeDefined()
    unmount()

    render(
      <InspectorPanel
        {...makeProps({
          agentKey: 'qa',
          instructionsExternalized: false,
          artifact: makeArtifact({
            sharedRules: [{ label: 'rubric', content: '…rubric text…' }],
          }),
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))
    expect(screen.getByText('rubric')).toBeDefined()
    expect(screen.getByText(/…rubric text…/)).toBeDefined()
  })

  it('Instructions tab renders REAL active-version content + version number when instructionsExternalized === true (externalized agent), never a blank tab', () => {
    render(
      <InspectorPanel
        {...makeProps({
          agentKey: 'scout',
          promptKey: 'scout',
          instructionsExternalized: true,
          artifact: makeArtifact({
            instructionVersion: 'v4',
            instructions: 'REAL ACTIVE CONTENT',
          }),
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))
    expect(screen.getByText(/REAL ACTIVE CONTENT/)).toBeDefined()
    expect(screen.getByText(/v4/)).toBeDefined()
  })

  it("Diagnostics 'model' renders 'not recorded' with a label+icon, never blank", () => {
    render(<InspectorPanel {...makeProps()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }))
    expect(screen.getByText(/not recorded/i)).toBeDefined()
  })

  it("footer 'Restart from this step' is disabled with an explanatory title for all artifact types", () => {
    render(<InspectorPanel {...makeProps()} />)

    const button = screen.getByRole('button', { name: /Restart from this step/i })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('title')).toMatch(/not yet wired/i)
  })

  it("footer 'Ask agent to revise' is reserved when no revisable passage is derivable (no sectionBlocks/sectionName/onRequestRevision, Phase 45 D-18)", () => {
    render(<InspectorPanel {...makeProps()} />)

    const button = screen.getByRole('button', { name: /Ask agent to revise/i })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('title')).toMatch(/no revisable passage/i)
  })

  it("footer 'Ask agent to revise' goes LIVE and calls onRequestRevision with a REAL, non-empty quotedText when sectionBlocks/sectionName/onRequestRevision are all derivable (Phase 45, D-18 — never a dead button)", () => {
    const onRequestRevision = vi.fn()
    render(
      <InspectorPanel
        {...makeProps({
          sectionBlocks: [{ text: 'A former county clerk built this organization from nothing.' }],
          sectionName: 'founderBio',
          onRequestRevision,
        })}
      />,
    )

    const button = screen.getByRole('button', { name: /Ask agent to revise/i })
    expect(button.hasAttribute('disabled')).toBe(false)

    fireEvent.click(button)
    expect(onRequestRevision).toHaveBeenCalledTimes(1)
    const passage = onRequestRevision.mock.calls[0]![0]
    expect(passage.sectionName).toBe('founderBio')
    expect(typeof passage.quotedText).toBe('string')
    expect(passage.quotedText.length).toBeGreaterThan(0)
  })

  it("footer 'Ask agent to revise' stays reserved when sectionBlocks derive an empty excerpt, even with sectionName + onRequestRevision provided (never seeds quotedText: '')", () => {
    const onRequestRevision = vi.fn()
    render(
      <InspectorPanel
        {...makeProps({
          sectionBlocks: [{ text: '' }],
          sectionName: 'founderBio',
          onRequestRevision,
        })}
      />,
    )

    const button = screen.getByRole('button', { name: /Ask agent to revise/i })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button)
    expect(onRequestRevision).not.toHaveBeenCalled()
  })

  it('live footer actions deep-link using the promptKey namespace (editor_gate1, not editor_gate_1)', () => {
    render(
      <InspectorPanel
        {...makeProps({
          agentKey: 'editor_gate_1',
          promptKey: 'editor_gate1',
        })}
      />,
    )

    const link = screen.getByRole('link', { name: /Improve this agent/i })
    expect(link.getAttribute('href')).toBe('/prompt-lab/editor_gate1')
  })
})
