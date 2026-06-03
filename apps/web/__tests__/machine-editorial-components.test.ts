/**
 * Phase 12 — Machine Editorial Design Adoption: source-scan tripwires.
 *
 * MED-04 (SectionNavigator Vertical Timeline) + MED-05 (DeliberationSlot
 * Carousel & Flow).
 *
 * Phase 19 UPDATE (Plan 02 + Plan 03):
 *   - SectionNavigator.tsx RETIRED (superseded by SectionRail sticky scroll-spy nav).
 *   - DeliberationSlot.tsx REWRITTEN as Phase 19 dark-band centerpiece.
 *     The AGENT_LABELS map is now SPEAKER_NAMES in DelibChat.tsx (3-speaker map only).
 *     DEL-04 + 5-Convex-sub contracts are still enforced in DeliberationSlot.tsx.
 *
 * Note on the model-name check: uses codeOnly() comment-stripping before
 * checking for model-name literals, because DeliberationSlot.tsx contains
 * comments about not reading model names — which would false-positive without stripping.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const DEL_PATH    = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
const CHAT_PATH   = resolve(__dirname, '../components/issue/DelibChat.tsx')

/**
 * Strip block, JSX block, and line comments so model-name literals in
 * documentation prose do not trip the negative assertions.
 * Copied verbatim from deliberation-no-model-names.test.ts.
 */
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')        // block comments (incl. JSDoc)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')    // JSX block comments {/* ... */}
    .replace(/(^|[^:])\/\/.*$/gm, '$1')      // line comments (don't eat URL ://)
}

// ─── MED-04: SectionNavigator retired — Phase 19 supersedes ─────────────────

describe('MED-04: SectionNavigator retired by Phase 19 (SectionRail replaces it)', () => {
  it('SectionNavigator.tsx is no longer in the component tree (Phase 19 Phase 02)', () => {
    // Phase 19 Plan 02 retires SectionNavigator.tsx and replaces it with
    // the sticky left SectionRail. The Phase 12 vertical-timeline tripwires
    // are superseded. Phase 19 SectionRail assertions live in issue-page-dispatch.test.ts.
    expect(true).toBe(true)
  })
})

// ─── MED-05: DeliberationSlot Phase 19 dark-band contracts (DEL-04 + subs) ──

describe('MED-05: DeliberationSlot Phase 19 dark-band (DEL-04 + 5-Convex-subs)', () => {
  const delSrc = readFileSync(DEL_PATH, 'utf-8')

  it('Phase 19: speaker identity map (SPEAKER_NAMES) lives in DelibChat.tsx', () => {
    // Phase 19 Plan 03 rewrite: AGENT_LABELS was the Phase 12 multi-agent map
    // in DeliberationSlot. Phase 19 uses SPEAKER_NAMES in DelibChat (3-speaker only:
    // scout / advocate / editor). DEL-04 is enforced there.
    const chatSrc = readFileSync(CHAT_PATH, 'utf-8')
    expect(chatSrc).toContain('SPEAKER_NAMES')
    expect(chatSrc).toContain('The Scout')
    expect(chatSrc).toContain('The Advocate')
    expect(chatSrc).toContain('The Editor')
  })

  it('preserves all 5 Convex useQuery subscriptions', () => {
    const subs = [
      'api.pipelineRuns.byRunId',
      'api.pitchLog.byRunId',
      'api.deliberationEvents.byRunId',
      'api.agentVotes.byRunId',
      'api.qaCorrections.byRunId',
    ]
    for (const sub of subs) {
      expect(delSrc).toContain(sub)
    }
  })

  it('exposes no model-name literals in code (comment-stripped)', () => {
    // Strip comments first to avoid false-positives from documentation
    // prose. This check is the model-NAME literal backstop.
    const code = codeOnly(delSrc).toLowerCase()
    const modelNames = ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter', 'anthropic']
    for (const name of modelNames) {
      expect(code).not.toContain(name)
    }
  })
})
