/**
 * DEL-02 — QA severity → color token mapping source-scan.
 *
 * Phase 9 original: Asserted that DeliberationSlot.tsx rendered a QA_SEVERITY
 * map with info/warning/error severity colors and text labels (WCAG 1.4.1).
 *
 * Phase 19 UPDATE (Plan 03): DeliberationSlot rewritten as dark-band centerpiece.
 * The QA corrections panel (Zone 3 of the Phase 12 Carousel & Flow) is STAGE B
 * (Plan 05) — it requires live Convex data from qaCorrections.byRunId. Stage A
 * renders scoreboard + chat + confidence bar from MOCK_ISSUE props only; QA
 * corrections are not shown in Stage A.
 *
 * When Plan 05 wires live Convex data, the QA corrections panel will be
 * reintroduced into DeliberationSlot with the severity color mapping.
 * These assertions are deferred to Plan 05.
 *
 * The WCAG 1.4.1 requirement (color + text label) will be re-enforced in Plan 05.
 * The legacy severity name guard (no 'minor'/'moderate'/'major') remains active.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

describe('DEL-02: QA severity rendering (Phase 19 Stage A)', () => {
  it('does NOT contain legacy severity "minor" (stale API_CONTRACTS §3.6)', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(source).not.toContain('minor')
  })

  it('does NOT contain legacy severity "moderate" (stale API_CONTRACTS §3.6)', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(source).not.toContain('moderate')
  })

  it('does NOT contain legacy severity "major" (stale API_CONTRACTS §3.6)', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(source).not.toContain('major')
  })

  it.todo("maps severity 'info' with CSS color token (Plan 05 Stage B — Convex qaCorrections live)")
  it.todo("maps severity 'warning' with CSS color token (Plan 05 Stage B)")
  it.todo("maps severity 'error' with CSS color token (Plan 05 Stage B)")
  it.todo("renders 'Info' text label for WCAG 1.4.1 (Plan 05 Stage B)")
  it.todo("renders 'Warning' text label for WCAG 1.4.1 (Plan 05 Stage B)")
  it.todo("renders 'Error' text label for WCAG 1.4.1 (Plan 05 Stage B)")
})
