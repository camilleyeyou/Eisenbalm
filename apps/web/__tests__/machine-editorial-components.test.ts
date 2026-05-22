/**
 * Phase 12 — Machine Editorial Design Adoption: source-scan tripwires.
 *
 * MED-04 (SectionNavigator Vertical Timeline) + MED-05 (DeliberationSlot
 * Carousel & Flow). Same pattern as game-sandbox.test.ts (Phase 7 GAM-03)
 * and issue-page-typography.test.ts (Phase 10): readFileSync at test
 * runtime + grep-style assertions. NO DOM, NO React render, NO Convex mock.
 *
 * Purpose: Lock the four contracts that Wave 04/05 component rebuilds MUST
 * preserve. Assertions are GREEN against the CURRENT (pre-rebuild) source
 * and will continue to be GREEN after Waves 04/05 rebuild the components.
 *
 * If a test fails, DO NOT delete it or weaken the assertion. Fix the
 * source instead. These tests ARE the codebase-level guards for MED-04/05.
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

const NAV_PATH = resolve(__dirname, '../components/issue/SectionNavigator.tsx')
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

// ─── MED-04: SectionNavigator Vertical Timeline tripwires ───────────────────

describe('MED-04: SectionNavigator Vertical Timeline tripwires', () => {
  const navSrc = readFileSync(NAV_PATH, 'utf-8')

  it('preserves all 8 canonical anchor ids', () => {
    const ids = [
      '#origin-story',
      '#problem',
      '#founder-bio',
      '#case-study',
      '#game',
      '#bonus',
      '#deliberation',
      '#podcast',
    ]
    for (const id of ids) {
      expect(navSrc).toContain(id)
    }
  })

  it('preserves the prefers-reduced-motion early-return', () => {
    expect(navSrc).toContain('prefers-reduced-motion')
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
