---
phase: 32-native-galley-read-only-span-resolver
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/dispatch-control/package.json
  - apps/dispatch-control/__tests__/sectionIdMap.test.ts
  - apps/dispatch-control/__tests__/spanResolver.test.ts
  - apps/dispatch-control/__tests__/syntheticPortableText.test.ts
  - apps/dispatch-control/__tests__/googleFontLoader.test.ts
  - apps/dispatch-control/__tests__/galleyGameValidator.test.ts
  - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx
  - apps/dispatch-control/__tests__/Galley.test.tsx
  - apps/dispatch-control/__tests__/SectionChipList.test.tsx
autonomous: true
requirements: [GLY-01, GLY-02, GLY-05]
must_haves:
  truths:
    - "@portabletext/react is an installed dependency of apps/dispatch-control"
    - "Every Wave 0 test file exists and currently fails (RED) because the module under test does not exist yet"
  artifacts:
    - path: "apps/dispatch-control/__tests__/spanResolver.test.ts"
      provides: "GLY-02 resolver behavior spec (all disambiguation/normalization cases)"
    - path: "apps/dispatch-control/__tests__/sectionIdMap.test.ts"
      provides: "GLY-01/02 QA-sectionName ↔ galley-id bidirectional map spec"
    - path: "apps/dispatch-control/package.json"
      provides: "@portabletext/react ^6.2.0 dependency"
  key_links:
    - from: "apps/dispatch-control/__tests__/*.test.ts(x)"
      to: "apps/dispatch-control/lib/galley/* and _components/*"
      via: "relative import of the not-yet-existing module"
      pattern: "from '.*(galley|_components)/"
---

<objective>
Author the Wave 0 RED test scaffold for Phase 32 and install the one new npm dependency (`@portabletext/react@^6.2.0`). These tests encode the resolver, section-id-map, synthetic-PortableText, font-loader, game-validator-parity, unresolved-card, galley-render, and chip-count contracts BEFORE any implementation exists, so every downstream plan (32-02..32-07) makes a known-failing test go green.

Purpose: Nyquist compliance — every downstream task has an automated verify that already exists.
Output: 8 test files (RED) + 1 dependency added.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md
@.planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md
@.planning/phases/32-native-galley-read-only-span-resolver/32-VALIDATION.md

<interfaces>
<!-- Existing shapes the tests must assert against. -->

Draft-read row shape (apps/dispatch-control/lib/contentPatchClient.ts):
```typescript
interface ContentBlock { type: 'paragraph' | 'h2' | 'h3' | 'blockquote'; text: string }
interface DraftSection { headline?: string; blocks: ContentBlock[]; lossy: boolean }
```

Convex qaCorrections row (convex/schema.ts, the finding shape the resolver consumes):
```
{ _id, runId, agentId?, sectionName, reason, severity: 'info'|'warning'|'error',
  accepted: boolean, axis?, quotedSpan?, suggestedFix?, timestamp,
  blockIndexHint?  /* added by Plan 32-02 */ }
```

QA sectionName vocabulary (snake_case, from packages/pipeline/.../agents/qa/__init__.py::_extract_sections):
  origin_story | problem | founder_bio | case_study | game | bonus

Galley/draft section ids (apps/dispatch-control/.../SectionChipList.tsx EDITABLE_SECTIONS):
  originStory | problemStatement | founderBio | caseStudy | bonus | game |
  deliberation-conversation | podcast | theme

apps/web game validator to achieve parity with (apps/web/lib/game-validator.ts):
  BANNED_PATTERNS (13 entries), validateEmbedCode, injectGameHead, GAME_CSP_POLICY
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install @portabletext/react and register jsdom for new component tests</name>
  <files>apps/dispatch-control/package.json, apps/dispatch-control/vitest.config.ts</files>
  <read_first>
    - apps/dispatch-control/package.json (current deps/scripts — confirm @portabletext/react is NOT present)
    - apps/dispatch-control/vitest.config.ts (environmentMatchGlobs already routes `__tests__/*.test.tsx` → jsdom via the last glob entry)
    - apps/web/package.json (confirm the existing `@portabletext/react` pin to match exactly — it is `^6.2.0`)
  </read_first>
  <action>
    Add `"@portabletext/react": "^6.2.0"` to the `dependencies` block of apps/dispatch-control/package.json (matching apps/web's pin exactly — no version drift). Install it with the workspace-aware command: run `pnpm --filter dispatch-control add @portabletext/react@^6.2.0` from the repo root (this updates package.json AND the root pnpm-lock.yaml). If pnpm rejects the filter name, confirm the workspace package name in apps/dispatch-control/package.json `"name"` field and use that.

    Do NOT change vitest.config.ts unless the existing final `environmentMatchGlobs` entry `['__tests__/*.test.tsx', 'jsdom']` is absent — it is present, so the two new `.test.tsx` files (UnresolvedFindingCard, Galley, SectionChipList) already resolve to jsdom and the `.test.ts` files stay on node. Verify by reading the config; make no edit if the glob is present.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && node -e "const p=require('./package.json'); if(!p.dependencies['@portabletext/react']) { console.error('MISSING dep'); process.exit(1) } console.log('ok', p.dependencies['@portabletext/react'])"</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"@portabletext/react"' apps/dispatch-control/package.json` returns a line pinned `^6.2.0`
    - `pnpm --filter dispatch-control exec node -e "require('@portabletext/react')"` exits 0 (dependency resolves)
    - `apps/dispatch-control/vitest.config.ts` still contains `['__tests__/*.test.tsx', 'jsdom']`
  </acceptance_criteria>
  <done>@portabletext/react ^6.2.0 is installed and importable from apps/dispatch-control; jsdom routing for `.test.tsx` confirmed.</done>
</task>

<task type="auto">
  <name>Task 2: Author the 5 pure-TS RED unit test files</name>
  <files>apps/dispatch-control/__tests__/sectionIdMap.test.ts, apps/dispatch-control/__tests__/spanResolver.test.ts, apps/dispatch-control/__tests__/syntheticPortableText.test.ts, apps/dispatch-control/__tests__/googleFontLoader.test.ts, apps/dispatch-control/__tests__/galleyGameValidator.test.ts</files>
  <read_first>
    - .planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md (§Architecture Patterns 1 & 2, §Common Pitfalls 2 & 5, §Validation Architecture → Test Map — the canonical case list)
    - apps/web/lib/game-validator.ts (BANNED_PATTERNS list to assert parity against)
    - apps/web/lib/theme.ts (FONT_WHITELIST array + validateFont — the whitelist the font loader must enforce)
    - apps/dispatch-control/__tests__/design-tokens.test.ts (a simple existing pure-TS test — copy its import/vitest style: `import { describe, it, expect } from 'vitest'`)
  </read_first>
  <action>
    Write 5 vitest files (`import { describe, it, expect } from 'vitest'`), each importing from the not-yet-existing module so they fail RED now and go green when 32-03/32-04 land.

    1. `sectionIdMap.test.ts` — import `{ qaSectionToGalleyId, galleyIdToQaSection }` from `'../lib/galley/sectionIdMap'`. Assert the exact 6 forward mappings: origin_story→originStory, problem→problemStatement, founder_bio→founderBio, case_study→caseStudy, game→game, bonus→bonus. Assert reverse mapping for those 6. Assert `qaSectionToGalleyId('nonsense')` returns `null` (unknown never silently coerced). Assert galley-only ids with no QA source (`podcast`, `theme`, `deliberation-conversation`) reverse-map to `null` on `galleyIdToQaSection` inverse where no QA name exists.

    2. `spanResolver.test.ts` — import `{ resolveSectionFindings }` from `'../lib/galley/spanResolver'`. Cover every row from RESEARCH's Test Map: (a) exact single match → 1 resolved with correct blockIndex+start+end; (b) no match anywhere → 1 unresolved, 0 resolved; (c) match in 2+ blocks, no hint → unresolved (D-12); (d) match in 2+ blocks, `blockIndexHint` points at one matching block → resolved to hinted block; (e) hint out-of-range (e.g. 99) → falls through to full search, resolves if unique elsewhere (Pitfall 3); (f) hint points at a block that does NOT contain the span → hint ignored, full search runs; (g) normalization: quotedSpan uses curly quotes `“ ” ’` and block uses straight quotes (or extra whitespace) → resolves after narrow normalization; (h) still-ambiguous after normalization → unresolved; (i) cross-block span (quotedSpan straddles block[0]+block[1] joined text) → never falsely resolves (unresolved). Assert resolved objects carry `severity/axis/reason/suggestedFix/quotedSpan/findingId/sectionId`.

    3. `syntheticPortableText.test.ts` — import `{ toSyntheticBlocks }` from `'../lib/galley/syntheticPortableText'`. Assert: a `{type:'paragraph',text}` row with zero annotations → one PT block `{_type:'block', style:'normal', children:[{_type:'span', text, marks:[]}], markDefs:[]}`; `type:'h2'` → `style:'h2'`; `type:'blockquote'` → `style:'blockquote'`; a block with one annotation over `[start,end)` → children split into ≤3 spans where the covered span's `marks` contains the markDef `_key` and `markDefs` has one entry of `_type:'annotation'` carrying `findingId/severity/axis/reason/suggestedFix`; two OVERLAPPING annotations → the overlap-region span's `marks` array contains BOTH markDef keys.

    4. `googleFontLoader.test.ts` — import `{ ensureThemeFont }` from `'../lib/galley/googleFontLoader'` (jsdom-free: it is a `.test.ts` running on node, so guard DOM access — OR make this a `.test.tsx` if the loader needs `document`; use `.test.ts` and mock a minimal `document` via `vi.stubGlobal`). Assert: a whitelisted font name (`'Lora'`, `'Newsreader'`) results in a `<link>` with `href` containing `fonts.googleapis.com/css2?family=Lora`; a non-whitelisted name (`'Comic Sans MS'`, `'red'`, `'"><script>'`) results in NO `<link>` injected and the function returns `false`/`null` (rejected — security); calling twice with the same whitelisted font injects only ONE `<link>` (dedupe).

    5. `galleyGameValidator.test.ts` — import `{ validateEmbedCode, BANNED_PATTERNS }` from `'../lib/galley/galleyGameValidator'`. Assert parity with apps/web: BANNED_PATTERNS has ≥13 entries; `validateEmbedCode('<script>fetch("/x")</script>')` returns `{valid:false}`; `validateEmbedCode('window.parent.location')` → invalid; a benign `'<canvas></canvas><script>let x=1</script>'` → `{valid:true}`; empty string → invalid.

    Every test must currently FAIL because the imported module path does not resolve yet — that is the intended RED state.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/sectionIdMap.test.ts __tests__/spanResolver.test.ts __tests__/syntheticPortableText.test.ts __tests__/googleFontLoader.test.ts __tests__/galleyGameValidator.test.ts 2>&1 | grep -qiE "fail|error|cannot find|no test" && echo "RED-as-expected" || (echo "UNEXPECTED-GREEN" && exit 1)</automated>
  </verify>
  <acceptance_criteria>
    - All 5 files exist under `apps/dispatch-control/__tests__/`
    - Each imports from `../lib/galley/<module>` (grep: `from '../lib/galley/`)
    - Running them fails RED (modules do not exist yet)
    - `spanResolver.test.ts` contains an assertion referencing `blockIndexHint` and a case labelled for ambiguity→unresolved (grep: `blockIndexHint` and `unresolved`)
  </acceptance_criteria>
  <done>5 RED pure-TS unit test files encode the resolver, mapping, synthetic-PT, font-loader, and game-validator contracts.</done>
</task>

<task type="auto">
  <name>Task 3: Author the 3 RED component/render test files (jsdom)</name>
  <files>apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx, apps/dispatch-control/__tests__/Galley.test.tsx, apps/dispatch-control/__tests__/SectionChipList.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx (existing jsdom component test — copy its `@testing-library/react` render style + convex mocking approach)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (current props: `sections`, `selected`, `onSelect`, `dirty` — the test asserts the UPGRADED props Plan 32-07 adds: per-section counts)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md (D-07 severity colors, D-09 unresolved card, D-05 coverage, GLY-05 chip counts)
  </read_first>
  <action>
    Write 3 jsdom tests using `@testing-library/react` (`render`, `screen`) that import the not-yet-existing components so they fail RED:

    1. `UnresolvedFindingCard.test.tsx` — import from `'../app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard'`. Render with a finding `{severity:'error', axis:'gravity', reason:'...', quotedSpan:'the missing text'}`. Assert the card shows the full `reason` text AND the original `quotedSpan` text verbatim (D-09: "showing full reason + original quoted text"), and that it carries an "unresolved" label/marker (grep-visible text `/unresolved/i`).

    2. `Galley.test.tsx` — import `{ Galley }` (or default) from `'../app/(dashboard)/review-desk/[runId]/_components/Galley'`. Mock `convex/react`'s `useQuery` to return a fixed `qaCorrections` array; pass a fixture `DraftResponse` covering all 8 reader sections + a `game.embedCode`. Assert: all long-read section headlines render; a `<blockquote>` renders for a blockquote row; the game renders inside an `<iframe sandbox="allow-scripts">` (D-05); an `info`/`warning`/`error` finding produces at least one element whose class/style encodes the severity (assert an element with a severity data-attribute like `data-severity="error"` exists). Keep assertions structural (data attributes / roles / text), not pixel-exact.

    3. `SectionChipList.test.tsx` — import default from the SAME existing path `'../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'`. Assert the UPGRADED contract Plan 32-07 will add: rendering with a new `counts` prop shaped `Record<sectionId, { open: number; unresolved: number }>` shows the numeric open-finding count on the matching chip, and clicking a chip calls `onSelect` with that section id. This file is RED now because the current component ignores `counts`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/UnresolvedFindingCard.test.tsx __tests__/Galley.test.tsx __tests__/SectionChipList.test.tsx 2>&1 | grep -qiE "fail|error|cannot find|no test" && echo "RED-as-expected" || (echo "UNEXPECTED-GREEN" && exit 1)</automated>
  </verify>
  <acceptance_criteria>
    - All 3 `.test.tsx` files exist
    - `Galley.test.tsx` asserts an `iframe` with `sandbox="allow-scripts"` (grep: `allow-scripts`)
    - `UnresolvedFindingCard.test.tsx` asserts both `reason` and `quotedSpan` render and contains `/unresolved/i`
    - `SectionChipList.test.tsx` references a `counts` prop (grep: `counts`)
    - Running the 3 files fails RED
  </acceptance_criteria>
  <done>3 RED component tests encode the unresolved-card (D-09), full galley render (GLY-01/D-05), and chip-count (GLY-05) contracts.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control exec node -e "require('@portabletext/react')"` resolves.
- All 8 new test files fail RED (their targets don't exist), proving Nyquist coverage is pre-seeded.
</verification>

<success_criteria>
@portabletext/react installed; 8 RED test files exist covering GLY-01/GLY-02/GLY-05; downstream plans each have a pre-existing failing test to turn green.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-01-SUMMARY.md`
</output>
