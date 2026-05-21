/**
 * POD-01 / POD-02 / POD-03 — PodcastSlot source-scan.
 *
 * Phase 9 Plan 09-03: all assertions active (no skipped blocks).
 *
 * POD-01/POD-03 and structural POD-02 (disclosure element) were active since
 * Phase 2. The POD-02 label assertion ("Read full deliberation transcript")
 * was unskipped in Plan 09-03 after the label was updated.
 *
 * readFileSync is at module scope (file exists at scaffold time).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/PodcastSlot.tsx')
const source = readFileSync(PATH, 'utf-8')

// ─── Un-skipped: POD-01, POD-03, and transcript-structure POD-02 ─────────────

describe('POD-01/02/03: PodcastSlot', () => {
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

  // POD-02: collapsible transcript disclosure exists (structural check)

  it('POD-02: references deliberationTranscript', () => {
    expect(source).toContain('deliberationTranscript')
  })

  it('POD-02: uses <details> element for collapsible transcript', () => {
    expect(source).toContain('<details')
  })

  // POD-03: empty-state copy is exactly "Audio coming soon." (period, no exclamation)

  it('POD-03: renders "Audio coming soon." with a period', () => {
    expect(source).toContain('Audio coming soon.')
  })

  it('POD-03: empty-state copy does NOT use an exclamation mark', () => {
    expect(source).not.toContain('Audio coming soon!')
  })
})

// ─── POD-02 restyled transcript label (unskipped in Plan 09-03) ──────────────
// Label updated to "Read full deliberation transcript" by Plan 09-03.

describe('POD-02: restyled transcript label', () => {
  it('POD-02: transcript toggle reads "Read full deliberation transcript"', () => {
    expect(source).toContain('Read full deliberation transcript')
  })
})
