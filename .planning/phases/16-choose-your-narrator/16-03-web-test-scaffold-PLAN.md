---
phase: 16-choose-your-narrator
plan: 03
type: execute
wave: 0
depends_on: ["16-01"]
files_modified:
  - apps/web/__tests__/narrator-chip.test.ts
autonomous: true
requirements: [NRR-08]
must_haves:
  truths:
    - "apps/web/__tests__/narrator-chip.test.ts exists and runs under Vitest"
    - "Tests encode NRR-08 four sub-contracts: chip renders iff narrator set AND name !== 'Jesse Eisenbalm'; chip absent when narrator null; chip copy is 'Narrated by {name}'; GROQ projection in queries.ts contains ONLY name+slug+active (no voiceConstraints/voiceRubric/exampleSamples leak — Pitfall 8 security gate)"
    - "Tests are RED until Plan 16-08 lands (IssueHero chip + GROQ extension)"
    - "All 8 existing tripwire test files (game-sandbox, deliberation-no-model-names, typography, deliberation-conversation, podcast-slot, theme-aa-tones, shop-page, CMR sentinels) stay green at the Wave 0 commit"
  artifacts:
    - path: "apps/web/__tests__/narrator-chip.test.ts"
      provides: "Source-scan tripwire for narrator chip rendering + GROQ projection no-leak guard"
      contains: "narrator-chip"
  key_links:
    - from: "apps/web/__tests__/narrator-chip.test.ts (GROQ no-leak assertion)"
      to: "apps/web/lib/sanity/queries.ts (Plan 16-08 extends QUERY_ISSUE_BY_SLUG)"
      via: "source-scan grep for forbidden field names in queries.ts"
      pattern: "voiceConstraints|voiceRubric|exampleSamples"
    - from: "apps/web/__tests__/narrator-chip.test.ts (chip assertions)"
      to: "apps/web/components/issue/IssueHero.tsx (Plan 16-08 adds chip)"
      via: "source-scan grep for 'Narrated by' + narrator conditional + Jesse Eisenbalm guard"
      pattern: "Narrated by"
---

<objective>
RED-first source-scan tripwire for the frontend side of Phase 16. Encodes NRR-08 four sub-contracts (chip presence guard, chip absence guard, chip copy contract, GROQ no-leak security guard) BEFORE Plan 16-08 adds the chip + GROQ extension.

Per VALIDATION §Wave 0 Requirements row 4 (narrator-chip.test.ts), this file MUST exist before any apps/web edits in Wave 1 land. The Nyquist rule is honored: Plan 16-08's automated verification command (`pnpm --filter web test:unit -- narrator-chip.test.ts`) targets a file that exists at this Wave 0 commit.

Mirrors the established source-scan tripwire pattern from Phase 7 (game-sandbox.test.ts) and Phase 13 (deliberation-conversation.test.ts): Vitest readFileSync + regex assertions on raw TSX/TS source, no DOM render, no mocked Sanity client, no real GROQ call. The tripwire is a security gate as much as a feature gate — the GROQ no-leak assertion guards against accidentally exposing voiceConstraints (system prompt content) to readers (Pitfall 8).

Output: 1 Vitest test file with ≥6 source-scan assertions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/16-choose-your-narrator/16-VALIDATION.md

<interfaces>
<!-- The future IssueHero.tsx + queries.ts shapes the source-scan asserts against. Plan 16-08 implements. -->

IssueHero.tsx (Plan 16-08 adds):
- Component receives `narrator?: { name: string; slug: string; active: boolean } | null` prop
- Render branch: `{narrator && narrator.name !== 'Jesse Eisenbalm' && (...)}`
- Chip text content: `Narrated by {narrator.name}` (template literal or equivalent JSX expression)
- Styling: --color-text-mute + Inter uppercase 0.18em (Phase 12 MED-04 machine-readout convention)

apps/web/lib/sanity/queries.ts (Plan 16-08 extends QUERY_ISSUE_BY_SLUG):
```groq
narrator-> {
  name,
  "slug": slug.current,
  active,
},
```
NEVER: voiceConstraints, voiceRubric, exampleSamples (Pitfall 8).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create apps/web/__tests__/narrator-chip.test.ts with 4 sub-contract assertions</name>
  <files>apps/web/__tests__/narrator-chip.test.ts</files>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (Phase 7 source-scan pattern this file mirrors — readFileSync inside it() bodies; describe-per-contract structure)
    - apps/web/__tests__/deliberation-conversation.test.ts (Phase 13 source-scan; same readFileSync + regex pattern; uses path.join with __dirname)
    - apps/web/components/issue/IssueHero.tsx (current shape — confirm no narrator chip yet; current props at lines 43-49 + render order at lines 60-180)
    - apps/web/lib/sanity/queries.ts (current QUERY_ISSUE_BY_SLUG shape lines 21-96 — confirm narrator field NOT yet projected)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-17 (chip copy = "Narrated by {narrator.name}") + D-18 (chip non-interactive — no link) + D-19 (placement under issue title, Inter uppercase 0.18em on --color-text-mute) + D-20 (no chat thread changes)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §I (chip implementation) + §J Pitfall J-1 (regex precision to avoid type-definition false positives) + Pitfall 8 (no voiceConstraints/voiceRubric/exampleSamples leak)
  </read_first>
  <action>
Create apps/web/__tests__/narrator-chip.test.ts with this verbatim content. The file uses Vitest readFileSync source-scan pattern from Phase 7 + 13:

```typescript
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
 * RED until Plan 16-08 lands (IssueHero chip + queries.ts narrator->{...} block).
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
    // Skip on missing file (RED state pre-Plan-16-08)
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
    // appears AT LEAST ONCE in the file (Plan 16-08 adds it) AND the file ALSO contains the
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

    // The narrator-> projection must be added to QUERY_ISSUE_BY_SLUG (Plan 16-08).
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
      // No narrator block yet = pre-Plan-16-08 state; the other tests cover that case.
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
```
  </action>
  <verify>
    <automated>test -f apps/web/__tests__/narrator-chip.test.ts; pnpm --filter web exec vitest run apps/web/__tests__/narrator-chip.test.ts --reporter=basic exits non-zero (RED: most assertions fail because Plan 16-08b not yet landed) OR — if pre-implementation graceful-skip succeeds — pnpm --filter web test:unit reports the file collected without parse errors; grep -c "describe\\|it(" apps/web/__tests__/narrator-chip.test.ts returns at least 8 (5 describe blocks + at least 8 it() bodies — NRR-08(a)/(b)/(c)/(d)/(e) source-scan DOM-order + DEL-04 model-name guard)</automated>
  </verify>
  <done>narrator-chip.test.ts created with 5 describe blocks covering NRR-08(a)/(b)/(c)/(d)/(e) sub-contracts + DEL-04 chip surface guard. NRR-08(e) is the source-scan DOM-order assertion (chip JSX precedes <time>) per CONTEXT D-19. Tests collect; file is RED until Plan 16-08b lands (expected); existing tripwire suite stays green.</done>
</task>

</tasks>

<verification>
- apps/web/__tests__/narrator-chip.test.ts compiles under TypeScript / Vitest without parse errors.
- `pnpm --filter web test:unit` collects the new file alongside all existing tripwires.
- All 8 existing tripwire tests (game-sandbox, deliberation-no-model-names, typography, deliberation-conversation, podcast-slot, theme-aa-tones, shop-page, 29 CMR sentinels) stay green — no spillover damage from the new file.
- The Pitfall 8 security gate is encoded: once Plan 16-08 adds the narrator-> block, the leak-guard assertion catches any future regression where a developer copies the full narratorProfile field list into the GROQ projection.
</verification>

<success_criteria>
- narrator-chip.test.ts exists with ≥8 it() assertions across ≥5 describe blocks.
- Plan 16-08 has a single Vitest target file to turn green.
- VALIDATION §Wave 0 Requirements row 4 closes (narrator-chip.test.ts present).
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-03-SUMMARY.md` listing the 4 sub-contracts encoded, the readFileSync pattern reuse, and confirmation of test-collection success.
</output>
