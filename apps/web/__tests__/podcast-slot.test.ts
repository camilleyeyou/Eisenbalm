/**
 * POD-02 reader-facing transcript render superseded by Phase 13 D-10;
 * deliberationTranscript data retained for NotebookLM (D-17).
 *
 * POD-01 / POD-02 (superseded) / POD-03 — PodcastSlot source-scan.
 *
 * Phase 9 Plan 09-03: all assertions active (no skipped blocks).
 * Phase 13 D-10: POD-02 render assertions flipped to unconditional absence checks.
 *   The <pre>{transcript}</pre> collapsible block has been removed from
 *   PodcastSlot.tsx. The deliberationTranscript field + GROQ projection are
 *   retained (D-17 — NotebookLM source).
 *
 * readFileSync is at module scope (file exists at scaffold time).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/PodcastSlot.tsx')
const source = readFileSync(PATH, 'utf-8')

// ─── Un-skipped: POD-01, POD-03 ──────────────────────────────────────────────

describe('POD-01/03: PodcastSlot', () => {
  // POD-01: HTML5 audio element gated on audioUrl

  it('POD-01: renders an <audio> element', () => {
    expect(source).toContain('<audio')
  })

  it('POD-01: audio element has controls attribute', () => {
    expect(source).toContain('controls')
  })

  it('POD-01: audio element is gated on audioUrl', () => {
    expect(source).toContain('audioUrl')
  })

  it('POD-01: <audio> player retained after D-10 transcript removal', () => {
    expect(source).toContain('<audio')
  })

  // POD-02 (superseded by D-10): reader-facing transcript render removed

  it('POD-02 (superseded by D-10): PodcastSlot no longer reads deliberationTranscript', () => {
    expect(source).not.toContain('deliberationTranscript')
  })

  it('POD-02 (superseded by D-10): no <details>/<pre> transcript render in PodcastSlot', () => {
    expect(source).not.toContain('<details')
    expect(source).not.toContain('<pre')
  })

  // POD-03: empty-state copy is exactly "Audio coming soon." (period, no exclamation)

  it('POD-03: renders "Audio coming soon." with a period', () => {
    expect(source).toContain('Audio coming soon.')
  })

  it('POD-03: empty-state copy does NOT use an exclamation mark', () => {
    expect(source).not.toContain('Audio coming soon!')
  })
})

// ─── POD-02 restyled transcript label (superseded by D-10) ───────────────────
// D-10 removes the "Read full deliberation transcript" toggle from PodcastSlot.
// Readers now see the deliberation as the inline chat thread (DEL-CONV-04).

describe('POD-02 (superseded by D-10): transcript toggle label removed', () => {
  it('POD-02 (superseded by D-10): transcript toggle label removed', () => {
    expect(source).not.toContain('Read full deliberation transcript')
  })
})
