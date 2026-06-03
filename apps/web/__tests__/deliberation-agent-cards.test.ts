/**
 * DEL-06 (chip side) — Agent identity card links source-scan.
 *
 * Phase 9 original: Asserted that DeliberationSlot.tsx rendered agent identity
 * chips with /agents/[agentId] links, displayName, and role from agent profiles.
 *
 * Phase 19 UPDATE (Plan 03): DeliberationSlot rewritten as dark-band centerpiece.
 * Agent identity chip links to /agents/ are not rendered in Stage A — the Phase 19
 * design uses avatar circles (S/A/E) with inline DEL-04-compliant display names
 * (The Scout / The Advocate / The Editor) in DelibChat.tsx. The /agents/ links
 * are not part of the dark-band chat-style design from 19-PROTOTYPE.html.
 *
 * DEL-04 model-name prohibition remains fully active — checked in both
 * deliberation-no-model-names.test.ts and this file.
 *
 * The /agents/ link pattern was a Phase 9/12 deliberation panel feature.
 * It may or may not return in Stage B (Plan 05) depending on the live data design.
 * For now, deferred. DEL-04 negative assertions remain active.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PATH      = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
const CHAT_PATH = resolve(__dirname, '../components/issue/DelibChat.tsx')

/**
 * Strip block, JSX block, and line comments.
 */
function codeOnly(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('DEL-06: agent identity display (Phase 19 Stage A)', () => {
  it('does not expose modelVersions in the render path (DEL-04 extension)', () => {
    const source = readFileSync(PATH, 'utf-8')
    expect(source).not.toContain('modelVersions')
  })

  it('contains no model-name literals in DeliberationSlot (comment-stripped)', () => {
    const source = readFileSync(PATH, 'utf-8')
    const code = codeOnly(source).toLowerCase()
    for (const modelName of ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter']) {
      expect(code).not.toContain(modelName)
    }
  })

  it('contains no model-name literals in DelibChat (comment-stripped)', () => {
    const source = readFileSync(CHAT_PATH, 'utf-8')
    const code = codeOnly(source).toLowerCase()
    for (const modelName of ['claude', 'gpt', 'sonnet', 'haiku', 'openrouter']) {
      expect(code).not.toContain(modelName)
    }
  })

  it('DelibChat renders DEL-04 compliant display names only', () => {
    const source = readFileSync(CHAT_PATH, 'utf-8')
    expect(source).toContain('The Scout')
    expect(source).toContain('The Advocate')
    expect(source).toContain('The Editor')
  })

  it.todo("constructs /agents/[agentId] href (Plan 05 Stage B — live Convex deliberation events)")
  it.todo("uses agentId in the href construction (Plan 05 Stage B)")
  it.todo("renders displayName from agent profile (Plan 05 Stage B)")
  it.todo("renders role from agent profile (Plan 05 Stage B)")
})
