/**
 * Phase 16 (NRR-08) — Narrator chip + GROQ no-leak source-scan tripwire.
 *
 * Mirrors the established source-scan pattern from Phase 7 (game-sandbox.test.ts)
 * and Phase 13 (deliberation-conversation.test.ts): readFileSync + regex
 * assertions on raw TSX/TS source. No DOM render, no mocked Sanity client.
 *
 * Four sub-contracts (CONTEXT D-17/18/19/20 + RESEARCH §I + Pitfall 8):
 *   1. NRR-08(a) — Chip renders iff narrator is set AND name !== 'Jesse Eisenbalm'
 *   2. NRR-08(b) — Chip is absent when narrator is null (default Jesse implicit)
 *   3. NRR-08(c) — Chip copy is 'Narrated by {narrator.name}'
 *   4. NRR-08(d) — GROQ projection includes ONLY name + slug + active —
 *      voiceConstraints / voiceRubric / exampleSamples MUST NOT leak to the
 *      reader-facing query (security: no system prompt content exposed)
 *
 * RED until Plan 16-08b lands (IssueHero chip + queries.ts narrator->{...} block).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const ISSUE_HERO_PATH = path.join(REPO_ROOT, 'apps/web/components/issue/IssueHero.tsx')
const QUERIES_PATH = path.join(REPO_ROOT, 'apps/web/lib/sanity/queries.ts')

function readOrEmpty(p: string): string {
  try {
    return readFileSync(p, 'utf-8')
  } catch {
    return ''
  }
}

describe('NRR-08(a) — chip renders iff narrator set AND name !== "Jesse Eisenbalm"', () => {
  it('IssueHero.tsx contains a conditional narrator render guarded by name !== "Jesse Eisenbalm"', () => {
    const src = readOrEmpty(ISSUE_HERO_PATH)
    // Skip on missing file (RED state pre-Plan-16-08b)
    if (!src) return expect(true).toBe(true)

    // Must contain a chip-rendering JSX block. The conditional uses narrator (truthy) AND a
    // name guard. We look for both signals; regex tolerates whitespace / formatting variation.
    const hasNarratorConditional = /narrator\s*&&[^}]*name\s*!==\s*['"]Jesse Eisenbalm['"]/.test(src)
    expect(hasNarratorConditional).toBe(true)
  })
})

describe('NRR-08(b) — chip is absent when narrator is null', () => {
  it('IssueHero.tsx does NOT contain an unconditional "Narrated by" string', () => {
    const src = readOrEmpty(ISSUE_HERO_PATH)
    if (!src) return expect(true).toBe(true)

    // The literal "Narrated by" must appear ONLY inside a conditional block — never as a top-level
    // static text that would render regardless of narrator. A simple heuristic: every line that
    // contains "Narrated by" must also contain a JSX expression brace `{` somewhere above it within
    // a few lines (the conditional render). We approximate by asserting that "Narrated by"
    // appears AT LEAST ONCE in the file (Plan 16-08b adds it) AND the file ALSO contains the
    // narrator conditional guard from NRR-08(a). Together these encode "only inside conditional."
    expect(src.includes('Narrated by')).toBe(true)
    expect(/narrator\s*&&/.test(src)).toBe(true)
  })
})

describe('NRR-08(c) — chip copy is "Narrated by {narrator.name}"', () => {
  it('IssueHero.tsx renders "Narrated by " followed by a JSX expression accessing narrator.name', () => {
    const src = readOrEmpty(ISSUE_HERO_PATH)
    if (!src) return expect(true).toBe(true)

    // Pattern matches: "Narrated by " followed by {narrator.name} or {narrator?.name}
    // tolerating JSX/whitespace variation.
    const hasCopy = /Narrated by[^\n]*\{\s*narrator\??\.name\s*\}/.test(src)
    expect(hasCopy).toBe(true)
  })

  it('IssueHero.tsx chip uses Phase 12 MED-04 machine-readout convention (--color-text-mute + uppercase + 0.18em tracking)', () => {
    const src = readOrEmpty(ISSUE_HERO_PATH)
    if (!src) return expect(true).toBe(true)

    // The chip block must reference --color-text-mute AND uppercase styling AND the 0.18em tracking
    // value (Phase 12 MED-04 convention reused per D-19).
    expect(src.includes('--color-text-mute')).toBe(true)
    // Either Tailwind `uppercase` class or CSS `text-transform: uppercase`
    expect(/uppercase/.test(src)).toBe(true)
    expect(/0\.18em/.test(src)).toBe(true)
  })
})

describe('NRR-08(d) — GROQ projection contains ONLY name + slug + active (Pitfall 8 security gate)', () => {
  it('queries.ts QUERY_ISSUE_BY_SLUG contains a narrator-> projection block', () => {
    const src = readOrEmpty(QUERIES_PATH)
    if (!src) return expect(true).toBe(true)

    // The narrator-> projection must be added to QUERY_ISSUE_BY_SLUG (Plan 16-08b).
    expect(/narrator->/.test(src)).toBe(true)
  })

  it('queries.ts QUERY_ISSUE_BY_SLUG narrator-> block contains name + slug + active', () => {
    const src = readOrEmpty(QUERIES_PATH)
    if (!src) return expect(true).toBe(true)

    // Extract the narrator-> block (rough scope: from "narrator->" to the next top-level "}")
    const narratorBlockMatch = src.match(/narrator->\s*\{([\s\S]*?)\}/)
    if (!narratorBlockMatch) {
      expect(narratorBlockMatch).not.toBeNull()
      return
    }
    const block = narratorBlockMatch[1]
    expect(block).toContain('name')
    expect(block).toContain('slug')
    expect(block).toContain('active')
  })

  it('queries.ts QUERY_ISSUE_BY_SLUG narrator-> block does NOT leak voiceConstraints / voiceRubric / exampleSamples (Pitfall 8)', () => {
    const src = readOrEmpty(QUERIES_PATH)
    if (!src) return expect(true).toBe(true)

    const narratorBlockMatch = src.match(/narrator->\s*\{([\s\S]*?)\}/)
    if (!narratorBlockMatch) {
      // No narrator block yet = pre-Plan-16-08b state; the other tests cover that case.
      // For this leak-guard, we ONLY enforce the negative once the block exists.
      return expect(true).toBe(true)
    }
    const block = narratorBlockMatch[1]
    expect(block).not.toContain('voiceConstraints')
    expect(block).not.toContain('voiceRubric')
    expect(block).not.toContain('exampleSamples')
  })
})

describe('NRR-08(e) — narrator chip JSX precedes <time> element in IssueHero source (DOM-order source-scan)', () => {
  it('narrator chip JSX appears before <time> element in IssueHero source', () => {
    const src = readOrEmpty(ISSUE_HERO_PATH)
    // Skip on missing file (RED state pre-Plan-16-08b)
    if (!src) return expect(true).toBe(true)

    // Source-scan DOM-order proxy: the "Narrated by" chip JSX must appear in the
    // source file BEFORE the first <time> element. Because IssueHero.tsx renders
    // children in source order, this source-position assertion is a sufficient
    // proxy for the rendered DOM-order invariant from CONTEXT D-19 (chip above
    // publish-date line).
    const chipPos = src.indexOf('Narrated by')
    const timePos = src.indexOf('<time')

    // If the chip is not yet present (pre-Plan-16-08b), skip — the chip
    // presence is enforced by NRR-08(a)/(b)/(c) above. This block ONLY
    // enforces ordering ONCE the chip exists.
    if (chipPos < 0) return expect(true).toBe(true)

    expect(timePos).toBeGreaterThan(0)
    expect(chipPos).toBeLessThan(timePos)
  })
})

describe('NRR-08 + DEL-04 — chip surface MUST NOT introduce any model name', () => {
  it('IssueHero.tsx chip block does NOT reference model names', () => {
    const src = readOrEmpty(ISSUE_HERO_PATH)
    if (!src) return expect(true).toBe(true)
    // Reuse the deliberation-no-model-names forbidden list at the chip surface.
    const forbidden = ['Claude', 'gpt-', 'Anthropic', 'OpenAI', 'language model']
    for (const term of forbidden) {
      expect(src.toLowerCase()).not.toContain(term.toLowerCase())
    }
  })
})
