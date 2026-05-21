---
phase: 09-issue-page-completion
plan: 00
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/__tests__/deliberation-subscriptions.test.ts
  - apps/web/__tests__/deliberation-advocate-scores.test.ts
  - apps/web/__tests__/deliberation-qa-severity.test.ts
  - apps/web/__tests__/deliberation-no-model-names.test.ts
  - apps/web/__tests__/deliberation-agent-cards.test.ts
  - apps/web/__tests__/agents-route.test.ts
  - apps/web/__tests__/site-header-nav.test.ts
  - apps/web/__tests__/podcast-slot.test.ts
  - apps/web/__tests__/theme-aa-tones.test.ts
autonomous: true
requirements: [DEL-01, DEL-02, DEL-04, DEL-05, DEL-06, POD-01, POD-02, POD-03]
must_haves:
  truths:
    - "Running the unit suite executes 9 new Phase 9 test files"
    - "theme-aa-tones test passes immediately (asserts house tones against contrastRatio from theme.ts)"
    - "The deliberation/podcast/agents-route/site-header test files are RED (skipped) until their feature plans land, then go GREEN"
    - "game-sandbox.test.ts stays green throughout"
  artifacts:
    - path: "apps/web/__tests__/deliberation-subscriptions.test.ts"
      provides: "DEL-01/DEL-05 source-scan + helper assertions"
      contains: "skip"
    - path: "apps/web/__tests__/deliberation-advocate-scores.test.ts"
      provides: "DEL-02 advocate-score-extraction assertions"
      contains: "advocate-argument"
    - path: "apps/web/__tests__/deliberation-qa-severity.test.ts"
      provides: "DEL-02 severity→color map assertions"
      contains: "warning"
    - path: "apps/web/__tests__/deliberation-no-model-names.test.ts"
      provides: "DEL-04 source-scan tripwire"
      contains: "modelVersions"
    - path: "apps/web/__tests__/deliberation-agent-cards.test.ts"
      provides: "DEL-06 agentId→href assertions (chip side)"
      contains: "/agents/"
    - path: "apps/web/__tests__/agents-route.test.ts"
      provides: "DEL-06 route-file source-scan (query name, notFound, no model names)"
      contains: "notFound"
    - path: "apps/web/__tests__/site-header-nav.test.ts"
      provides: "Mobile-nav disclosure source-scan (aria-expanded/controls, Escape, Open/Close menu)"
      contains: "aria-expanded"
    - path: "apps/web/__tests__/podcast-slot.test.ts"
      provides: "POD-01/02/03 source-scan assertions"
      contains: "Audio coming soon."
    - path: "apps/web/__tests__/theme-aa-tones.test.ts"
      provides: "WCAG AA tone assertions using contrastRatio"
      contains: "contrastRatio"
  key_links:
    - from: "apps/web/__tests__/theme-aa-tones.test.ts"
      to: "apps/web/lib/theme.ts"
      via: "import { contrastRatio }"
      pattern: "from '@/lib/theme'"
---

<objective>
Create the 9 Wave-1 Vitest test files that the Phase 9 feature plans must drive green. This is the validation substrate per 09-VALIDATION.md and 09-RESEARCH.md §Validation Architecture. It establishes the Nyquist feedback signal BEFORE any feature code is written. (This plan is the "test scaffold" wave — VALIDATION.md labels it Wave 1 (test scaffold); the executor coerces wave:0 to wave:1, so it is `wave: 1`.)

Purpose: Every Phase 9 requirement (DEL-01..06, POD-01..03) gets a failing-or-skipped test that its feature plan turns green. The AA-tones test passes immediately because the house palette values are fixed constants. The DEL-06 deliverable now has TWO tests — the chip-side href test (deliberation-agent-cards) AND the route-file test (agents-route) — so a missing/broken /agents route or a model-name leak on the profile page is caught. The LOCKED mobile-nav disclosure gets its own source-scan guard (site-header-nav).
Output: 9 new files in apps/web/__tests__/. Seven are source-scan / behavior tests for the deliberation + podcast + agents-route + site-header surfaces (RED via pending skip markers until features land); one (theme-aa-tones) and one (deliberation-no-model-names) are GREEN on creation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-issue-page-completion/09-VALIDATION.md
@.planning/phases/09-issue-page-completion/09-RESEARCH.md

<interfaces>
<!-- These tests are SOURCE-SCAN style (readFileSync + grep) like the existing
     game-sandbox.test.ts and issue-page-typography.test.ts. They assert on the
     CONTENT of component source files, plus pure-function/constant assertions.
     They do NOT render React or mock Convex (vitest env is 'node', not jsdom). -->

Vitest config (apps/web/vitest.config.ts):
- environment: 'node'  (NO jsdom — do NOT write tests that render React)
- include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx']
- globals: false  (import { describe, it, expect } from 'vitest' explicitly)
- run command: `vitest run` (NEVER watch)

Canonical source-scan pattern (apps/web/__tests__/game-sandbox.test.ts):
```typescript
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
const PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')
describe('...', () => {
  const source = readFileSync(PATH, 'utf-8')
  it('...', () => { expect(source).toContain('...') })
})
```

IMPORTANT — files that do not exist yet: `apps/web/app/agents/[agentId]/page.tsx`
  does NOT exist until Plan 09-03 creates it. So agents-route.test.ts MUST place its
  `readFileSync` INSIDE the `describe.skip(...)` callback so collection never throws.
  `apps/web/components/SiteHeader.tsx` DOES exist but lacks the mobile-nav attrs until
  Plan 09-04, so site-header-nav.test.ts is `describe.skip` (reading inside the callback
  is still the safe pattern).

contrastRatio signature (apps/web/lib/theme.ts):
```typescript
export function contrastRatio(fg: string, bg: string): number
// contrastRatio('#A89F8A', '#0C0B0A') ≈ 7.5
// Returns 0 on invalid hex.
```

QA severity values (convex/schema.ts — TRUTH, NOT API_CONTRACTS §3.6 which is stale):
  'info' | 'warning' | 'error'

Advocate score source (API_CONTRACTS §3 + convex/deliberationEvents.ts):
  deliberationEvents WHERE eventType === 'advocate-argument',
  payload JSON = { charityName, argument, score: number | null }
  agentVotes has NO score field.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the four deliberation source-scan / contract test files</name>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (the source-scan pattern to mirror EXACTLY)
    - apps/web/__tests__/issue-page-typography.test.ts (second example of the readFileSync+grep + codeOnly() comment-strip pattern)
    - convex/schema.ts (QA severity = info|warning|error; agentVotes has no score field)
    - .planning/phases/09-issue-page-completion/09-VALIDATION.md (per-requirement test map)
    - .planning/phases/09-issue-page-completion/09-RESEARCH.md (§Advocate score extraction; §QA severity color mapping)
  </read_first>
  <files>apps/web/__tests__/deliberation-subscriptions.test.ts, apps/web/__tests__/deliberation-advocate-scores.test.ts, apps/web/__tests__/deliberation-qa-severity.test.ts, apps/web/__tests__/deliberation-no-model-names.test.ts</files>
  <action>
Create four Vitest source-scan test files following the EXACT pattern in game-sandbox.test.ts (readFileSync of `../components/issue/DeliberationSlot.tsx` at module scope, then `describe`/`it`/`expect` with `import { describe, it, expect } from 'vitest'`). The component does not yet have its Phase 9 implementation, so each describe MUST be wrapped in `describe.skip(...)` with a `// UNSKIP in Plan 09-02` comment so the suite is GREEN now and Plan 09-02 unskips them when the feature lands. Do NOT render React. Do NOT use jsdom.

1. `deliberation-subscriptions.test.ts` (DEL-01, DEL-05) — `describe.skip('DEL-01/DEL-05: DeliberationSlot Convex subscriptions', ...)`. Assert the DeliberationSlot.tsx source:
   - contains `'use client'`
   - contains `useQuery` (Convex subscription hook)
   - contains the `"skip"` sentinel expression — assert source matches the regex `/runId\s*\?\s*\{\s*runId\s*\}\s*:\s*['"]skip['"]/` (the null-runId guard)
   - references all five query functions: `api.pitchLog.byRunId`, `api.deliberationEvents.byRunId`, `api.agentVotes.byRunId`, `api.qaCorrections.byRunId`, `api.pipelineRuns.byRunId`
   - contains the empty-state copy literal `This issue predates the open deliberation record.`

2. `deliberation-advocate-scores.test.ts` (DEL-02) — `describe.skip('DEL-02: advocate score extraction', ...)`. Assert DeliberationSlot.tsx source:
   - contains the literal `'advocate-argument'` (extraction is keyed on eventType)
   - contains `JSON.parse` (payload is a JSON string)
   - contains the null-score fallback copy literal `Scores did not complete this cycle.`
   - does NOT read a `.score` property off agentVotes — assert source does NOT match `/agentVotes?\W+\.?score/` style; concretely assert `expect(source).not.toMatch(/votes?\.score\b/)` and `expect(source).not.toMatch(/agentVote\.score\b/)`

3. `deliberation-qa-severity.test.ts` (DEL-02) — `describe.skip('DEL-02: QA severity color map', ...)`. Assert DeliberationSlot.tsx source:
   - maps all three schema severities: contains `'info'`, `'warning'`, `'error'`
   - maps to the three tokens: contains `var(--color-text-dim)`, `var(--color-primary)`, `var(--color-accent)`
   - renders text labels (no color-only signal): contains `Info`, `Warning`, `Error`
   - does NOT use the stale legacy severities — `expect(source).not.toContain('minor')`, `expect(source).not.toContain('moderate')`, `expect(source).not.toContain('major')` (guard against API_CONTRACTS §3.6 drift)

4. `deliberation-no-model-names.test.ts` (DEL-04 — SECURITY tripwire, mirror game-sandbox.test.ts intent) — this one is NOT skipped (it must guard the file at all times). `describe('DEL-04: no model names in DeliberationSlot render path', ...)`. Read DeliberationSlot.tsx. Strip comments first with a `codeOnly()` helper (copy the 3-substitution comment-stripping helper from issue-page-typography.test.ts: block `/\/\*[\s\S]*?\*\//g`, JSX block `/\{\/\*[\s\S]*?\*\/\}/g`, line `/\/\/.*$/gm`). Then assert the code-only source:
   - does NOT contain `modelVersions`
   - does NOT contain `.cost` access nor the word `cost` as a parsed field — assert `expect(codeOnly(source)).not.toMatch(/run[?.]*\.cost\b/)` and `expect(codeOnly(source)).not.toContain('modelVersions')`
   - does NOT contain any model-name literal: assert none of `claude`, `gpt`, `sonnet`, `haiku`, `openrouter` (case-insensitive) appear — `for (const m of ['claude','gpt','sonnet','haiku','openrouter']) expect(codeOnly(source).toLowerCase()).not.toContain(m)`
   Because the current stub DeliberationSlot.tsx contains none of these strings, this describe is GREEN immediately and STAYS green through the 09-02 rewrite.

For the three skipped files: because `describe.skip` does not execute the body, the `readFileSync` MUST be INSIDE the describe callback (not at module top-level) OR guarded so a missing implementation does not throw at collection time. Place `const source = readFileSync(PATH, 'utf-8')` inside the `describe.skip` callback body so skipped suites never read stale content. DeliberationSlot.tsx already exists (it is the stub), so readFileSync will not throw — but keeping the read inside the callback is the safe pattern for unskip.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/deliberation-subscriptions.test.ts` exists and contains `describe.skip` and the string `This issue predates the open deliberation record.`
    - `apps/web/__tests__/deliberation-advocate-scores.test.ts` exists and contains `advocate-argument` and `Scores did not complete this cycle.`
    - `apps/web/__tests__/deliberation-qa-severity.test.ts` exists and contains `var(--color-text-dim)`, `var(--color-primary)`, `var(--color-accent)`
    - `apps/web/__tests__/deliberation-no-model-names.test.ts` exists, contains `modelVersions`, and is NOT skipped (no `describe.skip` for the DEL-04 block)
    - `cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts` exits 0 (the current stub has no model strings)
    - `cd apps/web && npm run test:unit` exits 0 (skipped suites do not fail the run)
  </acceptance_criteria>
  <done>Four deliberation test files exist; DEL-04 tripwire is green against the current stub; the three skipped suites collect without error.</done>
</task>

<task type="auto">
  <name>Task 2: Create agent-cards, podcast-slot, and theme-aa-tones test files</name>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (source-scan pattern)
    - apps/web/components/issue/PodcastSlot.tsx (current functional logic — POD-01/02/03 already work; tests assert the restyled contract)
    - apps/web/lib/theme.ts (contrastRatio export to import)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Color WCAG AA gate: house tones and their required ratios)
  </read_first>
  <files>apps/web/__tests__/deliberation-agent-cards.test.ts, apps/web/__tests__/podcast-slot.test.ts, apps/web/__tests__/theme-aa-tones.test.ts</files>
  <action>
Create three Vitest files. `import { describe, it, expect } from 'vitest'`, `import { readFileSync } from 'node:fs'`, `import { resolve } from 'node:path'`.

1. `deliberation-agent-cards.test.ts` (DEL-06 — chip side) — `describe.skip('DEL-06: agent identity card links', ...)` with `// UNSKIP in Plan 09-02`. readFileSync DeliberationSlot.tsx inside the callback. Assert source:
   - constructs the agent-profile href: matches `/\/agents\/\$\{[^}]*agentId/` OR contains the literal substring `/agents/` together with `agentId` — concretely `expect(source).toMatch(/\/agents\//)` and `expect(source).toContain('agentId')`
   - renders `displayName` and `role` from the agent profile (contains `displayName` and `role`)
   - does NOT expose a model string (contains neither `modelVersions` nor any of claude/gpt/sonnet/haiku — reuse the same lowercase-not-contain loop as Task 1)

2. `podcast-slot.test.ts` (POD-01/02/03) — NOT skipped (the current PodcastSlot already satisfies the behavior; the restyle in Plan 09-03 must keep these green). readFileSync `../components/issue/PodcastSlot.tsx` at module scope (the file exists). `describe('POD-01/02/03: PodcastSlot', ...)`. Assert source:
   - POD-01: renders an HTML5 audio element gated on audioUrl — contains `<audio` and `controls` and `audioUrl`
   - POD-02: collapsible transcript — contains `deliberationTranscript` and `<details` (or `aria-expanded`); contains the toggle copy `Read full deliberation transcript`
   - POD-03: empty-state copy is exactly `Audio coming soon.` (period, no exclamation) — `expect(source).toContain('Audio coming soon.')` and `expect(source).not.toContain('Audio coming soon!')`
   NOTE: the CURRENT PodcastSlot.tsx uses the label `Read the deliberation transcript` (not `Read full deliberation transcript`). So the POD-02 transcript-label assertion will be RED until Plan 09-03 updates the label. To keep the suite green now, put ONLY the POD-02 transcript-LABEL assertion inside a separate `describe.skip('POD-02: restyled transcript label', ...)` block; the POD-01, POD-03, and "transcript disclosure exists" assertions stay in the un-skipped `describe` (they already pass against the current file). This makes the file partially green now and fully green after 09-03.

3. `theme-aa-tones.test.ts` (WCAG AA constraint) — NOT skipped; GREEN on creation. `import { contrastRatio } from '@/lib/theme'`. `describe('Phase 9 house secondary tones pass WCAG AA on dark bg', ...)`. Define `const BG = '#0C0B0A'`. Assert:
   - `contrastRatio('#A89F8A', BG)` >= 4.5 (text-dim)
   - `contrastRatio('#938A77', BG)` >= 4.5 (text-mute — the SPEC-CORRECTED value)
   - `contrastRatio('#615B4D', BG)` < 4.5 (regression guard — the REJECTED mockup value must NOT be used; if a future edit reintroduces #615B4D as a text tone this documents why it fails)
   - `contrastRatio('#8A9B7A', BG)` >= 4.5 (scout) and `contrastRatio('#6E92B8', BG)` >= 4.5 (advocate) and `contrastRatio('#CDA434', BG)` >= 4.5 (primary/editor)
   - ember is AA-large-only: `contrastRatio('#C2502A', BG)` >= 3.0 AND `contrastRatio('#C2502A', BG)` < 4.5 (documents the large-text-only constraint)
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/deliberation-agent-cards.test.ts` exists, contains `/agents/`, and is `describe.skip`
    - `apps/web/__tests__/podcast-slot.test.ts` exists and contains `Audio coming soon.` and `<audio`
    - `apps/web/__tests__/theme-aa-tones.test.ts` exists and contains `import { contrastRatio }` from `'@/lib/theme'`
    - `cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts` exits 0 (all tone assertions pass with the spec-corrected values)
    - `cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts` exits 0 (un-skipped POD-01/03 assertions pass against the current PodcastSlot)
    - `cd apps/web && npm run test:unit` exits 0 over the full suite (no Phase 9 file fails collection; game-sandbox.test.ts still green)
  </acceptance_criteria>
  <done>deliberation-agent-cards, podcast-slot, and theme-aa-tones test files exist; theme-aa-tones and podcast-slot (non-skipped portions) and deliberation-no-model-names are green; the full suite passes.</done>
</task>

<task type="auto">
  <name>Task 3: Create the agents-route and site-header-nav source-scan test files</name>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (source-scan pattern; the readFileSync-inside-skip technique)
    - apps/web/__tests__/issue-page-typography.test.ts (the codeOnly() comment-strip helper to copy for the no-model-names assertions)
    - apps/web/components/SiteHeader.tsx (EXISTS but currently has NO mobile-nav attrs — confirms site-header-nav must be describe.skip until Plan 09-04)
    - .planning/phases/09-issue-page-completion/09-CONTEXT.md (LOCKED: mobile nav must NOT disappear; aria-labels "Open menu"/"Close menu"; Escape closes)
    - .planning/phases/09-issue-page-completion/09-VALIDATION.md (Wave 1 test-scaffold list — these two files must be registered here too)
  </read_first>
  <files>apps/web/__tests__/agents-route.test.ts, apps/web/__tests__/site-header-nav.test.ts</files>
  <action>
Create two Vitest source-scan files. `import { describe, it, expect } from 'vitest'`, `import { readFileSync } from 'node:fs'`, `import { resolve } from 'node:path'`. Both are `describe.skip` until their feature plans land (the target files either do not exist yet or lack the asserted content), and BOTH place `readFileSync` INSIDE the describe callback so collection never throws.

1. `agents-route.test.ts` (DEL-06 — ROUTE side; the deliverable the chip links to) — `describe.skip('DEL-06: /agents/[agentId] route', ...)` with a `// UNSKIP in Plan 09-03` comment. The target file `apps/web/app/agents/[agentId]/page.tsx` does NOT exist yet, so the `readFileSync` MUST be inside the skipped callback. `const PATH = resolve(__dirname, '../app/agents/[agentId]/page.tsx')`. Inside the callback, `const source = readFileSync(PATH, 'utf-8')`. Copy the 3-substitution `codeOnly()` comment-stripping helper from issue-page-typography.test.ts (block `/\/\*[\s\S]*?\*\//g`, JSX block `/\{\/\*[\s\S]*?\*\/\}/g`, line `/\/\/.*$/gm`). Assert:
   - (a) the route uses the agent-profile query name: `expect(source).toMatch(/QUERY_AGENT_PROFILE_BY_ID|QUERY_AGENT_PROFILES/)` (Plan 09-03 uses `QUERY_AGENT_PROFILE_BY_ID`)
   - (b) `expect(source).toContain('notFound(')` (graceful 404 for unknown/synthetic ids)
   - (c) NO model-name literal in the code path — `for (const m of ['modelversions','claude','sonnet','haiku','gpt','openrouter']) expect(codeOnly(source).toLowerCase()).not.toContain(m)` (case-insensitive, comment-stripped — mirrors game-sandbox.test.ts source-scan style)
   - (d) `expect(codeOnly(source)).not.toMatch(/run[?.]*\.cost\b/)` (the route must never read pipelineRuns.cost)

2. `site-header-nav.test.ts` (LOCKED mobile-nav disclosure guard) — `describe.skip('SiteHeader mobile-nav disclosure', ...)` with a `// UNSKIP in Plan 09-04` comment. `const PATH = resolve(__dirname, '../components/SiteHeader.tsx')`. Inside the callback, `const source = readFileSync(PATH, 'utf-8')`. Assert source:
   - contains `aria-expanded`
   - contains `aria-controls`
   - contains an Escape-key handler: `expect(source).toMatch(/'Escape'|"Escape"|key === 'Escape'/)`
   - contains BOTH aria-labels: `expect(source).toContain('Open menu')` and `expect(source).toContain('Close menu')`
   The current SiteHeader.tsx has none of these, so the skip keeps the suite green until Plan 09-04 unskips and turns it green.

Both files: NO React render, NO jsdom, NO watch flags.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/agents-route.test.ts` exists, is `describe.skip`, references `app/agents/[agentId]/page.tsx`, asserts `QUERY_AGENT_PROFILE_BY_ID|QUERY_AGENT_PROFILES`, `notFound(`, and the model-name + `.cost` not-contain loop; readFileSync is INSIDE the skip callback
    - `apps/web/__tests__/site-header-nav.test.ts` exists, is `describe.skip`, references `components/SiteHeader.tsx`, and asserts `aria-expanded`, `aria-controls`, `Escape`, `Open menu`, `Close menu`; readFileSync is INSIDE the skip callback
    - `cd apps/web && npm run test:unit` exits 0 (both new files collect as skipped without throwing; full suite green; game-sandbox.test.ts still green)
  </acceptance_criteria>
  <done>agents-route.test.ts and site-header-nav.test.ts exist as skipped source-scan guards; collection does not throw on the not-yet-existent route file; full suite green.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npm run test:unit` exits 0 with 9 new Phase 9 files collected.
- `theme-aa-tones.test.ts`, `deliberation-no-model-names.test.ts`, and `podcast-slot.test.ts` (non-skip blocks) pass.
- `game-sandbox.test.ts` remains green.
- The deliberation, agents-route, and site-header test files use `describe.skip` for behavior not yet implemented and carry an `// UNSKIP in Plan 09-0X` marker; their readFileSync is inside the skip callback so collection never throws (esp. agents-route, whose target file does not exist yet).
</verification>

<success_criteria>
- 9 test files exist at the exact paths in files_modified.
- No watch-mode flags anywhere (all runs are `vitest run` via `npm run test:unit`).
- Full suite green; skipped suites collect without throwing.
</success_criteria>

<output>
After completion, create `.planning/phases/09-issue-page-completion/09-00-SUMMARY.md`.
</output>
</content>
</invoke>
