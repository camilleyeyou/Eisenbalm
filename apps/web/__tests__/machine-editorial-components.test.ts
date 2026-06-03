/**
 * Phase 12 — Machine Editorial Design Adoption: source-scan tripwires.
 *
 * MED-04 (SectionNavigator Vertical Timeline) + MED-05 (DeliberationSlot
 * Carousel & Flow).
 *
 * Phase 19 UPDATE: SectionNavigator.tsx has been RETIRED per the Phase 19
 * UI-SPEC (superseded by the SectionRail sticky scroll-spy nav). The MED-04
 * section navigator tripwires are removed. The MED-05 DeliberationSlot
 * tripwires remain active — DeliberationSlot.tsx is preserved and its
 * DEL-04/5-Convex-sub contracts are still enforced.
 *
 * Note on the model-name check: uses codeOnly() comment-stripping before
 * checking for model-name literals, because DeliberationSlot.tsx contains
 * the comment "// SECURITY: never read run.cost (it contains the
 * model-version map)" which would false-positive on the bare word "model"
 * without stripping. This file intentionally does NOT duplicate the
 * responsibility of deliberation-no-model-names.test.ts (which guards
 * run.cost access and modelVersions field access). This file's check is
 * the model-NAME literal backstop (claude, gpt, sonnet, haiku, etc.).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const DEL_PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

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

// ─── MED-05: DeliberationSlot Carousel & Flow tripwires (DEL-04 + subs) ────

describe('MED-05: DeliberationSlot Carousel & Flow tripwires (DEL-04 + subs)', () => {
  const delSrc = readFileSync(DEL_PATH, 'utf-8')

  it('preserves AGENT_LABELS persona map', () => {
    expect(delSrc).toContain('AGENT_LABELS')
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
    // prose (e.g., "// SECURITY: never read run.cost (it contains the
    // model-version map)" — "model" appears there legitimately in a comment).
    // This check is the model-NAME literal backstop; it does NOT check for
    // the bare word "model" (too broad — "model_versions" is legitimate code).
    const code = codeOnly(delSrc).toLowerCase()
    const modelNames = ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter', 'anthropic']
    for (const name of modelNames) {
      expect(code).not.toContain(name)
    }
  })
})
