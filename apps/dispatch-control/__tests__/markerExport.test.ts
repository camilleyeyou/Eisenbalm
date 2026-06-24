/**
 * Phase 28 (PRC-10) — byte-form tests for the .md marker export builder.
 *
 * Runs in node. Guards the not-yet-existing module so collection succeeds.
 * Asserts the exact byte form AND a round-trip: stripping one leading + one
 * trailing newline from between the markers returns the original content
 * verbatim (matches prompts.py::_extract).
 */
import { describe, it, expect } from 'vitest'

const PROMPT_START = '<!-- PROMPT START -->'
const PROMPT_END = '<!-- PROMPT END -->'

let buildMarkerExport: ((content: string) => string) | undefined

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../app/(dashboard)/prompts/_components/PromptMarkerExport')
  buildMarkerExport = mod.buildMarkerExport
} catch {
  buildMarkerExport = undefined
}

/**
 * Mirror prompts.py::_extract: take the bytes between the markers, strip exactly
 * one leading newline and exactly one trailing newline.
 */
function extract(md: string): string {
  const startIdx = md.indexOf(PROMPT_START)
  const endIdx = md.indexOf(PROMPT_END)
  let content = md.slice(startIdx + PROMPT_START.length, endIdx)
  if (content.startsWith('\n')) content = content.slice(1)
  if (content.endsWith('\n')) content = content.slice(0, -1)
  return content
}

describe('buildMarkerExport (PRC-10 exact byte form)', () => {
  it('wraps content in the exact PROMPT START/END byte form', () => {
    expect(buildMarkerExport).toBeDefined()
    expect(buildMarkerExport!('hello')).toBe(
      '<!-- PROMPT START -->\nhello\n<!-- PROMPT END -->',
    )
  })

  it('round-trips: extract() returns the original content verbatim', () => {
    expect(buildMarkerExport).toBeDefined()
    for (const original of [
      'hello',
      'line one\nline two',
      'has {token} placeholders',
      'trailing space  ',
    ]) {
      expect(extract(buildMarkerExport!(original))).toBe(original)
    }
  })
})
