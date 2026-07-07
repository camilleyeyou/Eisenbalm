---
phase: 32-native-galley-read-only-span-resolver
plan: 03
type: tdd
wave: 1
depends_on: [32-01]
files_modified:
  - apps/dispatch-control/lib/galley/sectionIdMap.ts
  - apps/dispatch-control/lib/galley/spanResolver.ts
autonomous: true
requirements: [GLY-02]
must_haves:
  truths:
    - "A QA finding whose quotedSpan uniquely matches one block resolves to that block with correct char offsets"
    - "A quotedSpan that matches 2+ blocks with no disambiguating hint resolves to UNRESOLVED (never guessed)"
    - "A stale/out-of-range blockIndexHint falls through to full search rather than short-circuiting to unresolved"
    - "QA snake_case section names map to galley section ids; unknown names return null (never silently coerced)"
  artifacts:
    - path: "apps/dispatch-control/lib/galley/spanResolver.ts"
      provides: "pure resolveSectionFindings(blocks, findings) -> {resolved, unresolved}"
      exports: ["resolveSectionFindings", "ResolvedAnnotation", "UnresolvedFinding"]
      min_lines: 60
    - path: "apps/dispatch-control/lib/galley/sectionIdMap.ts"
      provides: "qaSectionToGalleyId / galleyIdToQaSection bidirectional map"
      exports: ["qaSectionToGalleyId", "galleyIdToQaSection"]
  key_links:
    - from: "spanResolver.ts"
      to: "a single block's text (never concatenated section text)"
      via: "per-block substring search"
      pattern: "resolveSectionFindings"
---

<objective>
Build the two pure-TypeScript modules at the heart of GLY-02, TDD against the RED tests authored in Plan 32-01. These have zero React/Convex/DOM dependencies and are unit-testable in isolation (D-13), and Phase 33's post-patch re-resolution reuses `spanResolver.ts` directly.

Purpose: correct, honest span anchoring — a wrong highlight is worse than an honest miss (D-12).
Output: `sectionIdMap.ts` + `spanResolver.ts`, making `sectionIdMap.test.ts` + `spanResolver.test.ts` green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md

<interfaces>
Draft row shape (from contentPatchClient.ts): `{ type: 'paragraph'|'h2'|'h3'|'blockquote'; text: string }`

Convex qaCorrections finding (the resolver's finding input; group client-side by sectionName):
```
{ _id, sectionName, severity:'info'|'warning'|'error', axis?, reason,
  suggestedFix?, quotedSpan?, accepted:boolean, blockIndexHint? }
```

QA sectionName → galley id map (RESEARCH §Pitfall 2 table — the ONLY authority):
  origin_story→originStory · problem→problemStatement · founder_bio→founderBio ·
  case_study→caseStudy · game→game · bonus→bonus
  (podcast / theme / deliberation-conversation are galley-only; QA never emits them)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: sectionIdMap.ts — bidirectional QA↔galley section-name map</name>
  <files>apps/dispatch-control/lib/galley/sectionIdMap.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/sectionIdMap.test.ts (the RED spec authored in 32-01 — implement exactly to it)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md (§Pitfall 2 mapping table)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (EDITABLE_SECTIONS — the galley id vocabulary)
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/galley/sectionIdMap.ts` exporting:
    ```ts
    // QA (snake_case, Convex) -> galley/draft section id (camelCase). RESEARCH §Pitfall 2.
    const QA_TO_GALLEY: Record<string, string> = {
      origin_story: 'originStory',
      problem: 'problemStatement',   // NOTE: problem !== problemStatement
      founder_bio: 'founderBio',
      case_study: 'caseStudy',
      game: 'game',
      bonus: 'bonus',
    }
    export function qaSectionToGalleyId(qaName: string): string | null {
      return QA_TO_GALLEY[qaName] ?? null   // unknown -> null, never coerced
    }
    const GALLEY_TO_QA: Record<string, string> =
      Object.fromEntries(Object.entries(QA_TO_GALLEY).map(([k, v]) => [v, k]))
    export function galleyIdToQaSection(galleyId: string): string | null {
      return GALLEY_TO_QA[galleyId] ?? null  // podcast/theme/deliberation-conversation -> null
    }
    ```
    Keep it dependency-free and pure. Do not add fuzzy/normalization here — exact keys only.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/sectionIdMap.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `sectionIdMap.test.ts` passes (green)
    - `qaSectionToGalleyId('problem')` returns `'problemStatement'` and `qaSectionToGalleyId('nonsense')` returns `null` (grep the source for the `?? null` guards)
    - Module has zero imports (pure)
  </acceptance_criteria>
  <done>The QA↔galley vocabulary bridge exists and is proven by its unit test.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: spanResolver.ts — per-block quotedSpan resolution with hint + normalization</name>
  <files>apps/dispatch-control/lib/galley/spanResolver.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/spanResolver.test.ts (the RED spec — every case is enumerated there; implement to pass ALL of them)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md (§Pattern 2 per-block search; §Code Examples resolver shape; §Pitfalls 3 hint-drift & 5 narrow-normalization)
  </read_first>
  <behavior>
    - Exact single-block match → 1 resolved {blockIndex, start, end, severity, axis, reason, suggestedFix, quotedSpan, findingId, sectionId}
    - No match in any block → unresolved (carries full reason + quotedSpan)
    - Match in 2+ blocks, no usable hint → unresolved (D-12, never guess)
    - Match in 2+ blocks, blockIndexHint in-range AND that block contains the span → resolved to hinted block
    - Hint out-of-range OR hint block lacks the span → ignore hint, fall through to full search (Pitfall 3)
    - Normalization fallback (whitespace collapse + curly→straight quotes on BOTH sides), still requiring exact substring after normalization; still-ambiguous-after-normalization → unresolved (Pitfall 5)
    - Cross-block span (only matches the joined text of two blocks) → matches no single block → unresolved
    - Accepted findings are excluded by the caller, but resolver must also tolerate an `accepted:true` finding by treating it as excluded input (defensive)
  </behavior>
  <action>
    Create `apps/dispatch-control/lib/galley/spanResolver.ts` (pure, no imports). Export the interfaces `ResolvedAnnotation` and `UnresolvedFinding` (shapes per RESEARCH §Code Examples: ResolvedAnnotation has findingId, sectionId, blockIndex, start, end, severity, axis?, reason, suggestedFix?, quotedSpan; UnresolvedFinding drops blockIndex/start/end and makes quotedSpan optional) and:
    ```ts
    export function resolveSectionFindings(
      blocks: { type: string; text: string }[],
      findings: QaFinding[],   // already filtered to this section; accepted excluded by caller
    ): { resolved: ResolvedAnnotation[]; unresolved: UnresolvedFinding[] }
    ```
    Algorithm per finding:
    1. Guard: no `quotedSpan` → unresolved. `accepted === true` → skip entirely (not even unresolved).
    2. Compute exact per-block match set: `matches = blocks.map((b,i)=>({i, idx:b.text.indexOf(quoted)})).filter(m=>m.idx>=0)`.
    3. If exactly one exact match → resolve to it (`start=idx`, `end=idx+quoted.length`).
    4. If 2+ exact matches: if `blockIndexHint` is a number in `[0, blocks.length)` AND `blocks[hint].text.indexOf(quoted) >= 0` → resolve to the hinted block. Else → unresolved (never pick arbitrarily).
    5. If 0 exact matches → run the normalization fallback: define `norm(s)` = collapse `\s+`→single space, map `’‘` → `'` and `“”` → `"`, trim. Recompute matches on `norm(block.text).indexOf(norm(quoted))`. Apply the SAME single/hint/ambiguous rules. When a normalized match resolves, map the offset back conservatively — if exact offset mapping is non-trivial, set `start`/`end` to the normalized-text offsets and document that the AnnotationMark consumer splits on the SAME normalized text (keep it simple: store the block's normalized text handling in the resolver output only if your span-injection consumer needs it — otherwise, resolve on the ORIGINAL block by locating the nearest exact-or-normalized substring; prefer resolving against original text offsets whenever the exact pass already matched). Keep normalization NARROW — never fuzzy/Levenshtein.
    6. Otherwise → unresolved.

    Define the `QaFinding` input type locally (or import from a shared types file) with fields `{ findingId: string; sectionId: string; quotedSpan?: string; blockIndexHint?: number; severity; axis?; reason; suggestedFix?; accepted?: boolean }`. The caller (Galley, Plan 32-06) maps Convex rows → this shape and groups by resolved galley sectionId via `qaSectionToGalleyId`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/spanResolver.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `spanResolver.test.ts` passes ALL enumerated cases green (exact/none/ambiguous/hint/stale-hint/normalization/cross-block)
    - Source never concatenates all blocks into one string before searching (grep confirms search is per-block: `blocks[` or `.map(` over blocks, no `blocks.map(b=>b.text).join`)
    - `resolveSectionFindings` returns both `resolved` and `unresolved` arrays; every unresolved carries `reason` and (when present) `quotedSpan`
    - Module has zero React/Convex imports (pure)
  </acceptance_criteria>
  <done>The resolver anchors spans correctly, disambiguates with the hint only when safe, and fails closed to unresolved on ambiguity — proven by the full unit spec.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/spanResolver.test.ts __tests__/sectionIdMap.test.ts` green.
</verification>

<success_criteria>
GLY-02's resolution core is correct, pure, and reusable by Phase 33; ambiguity always resolves to unresolved (D-12); the section-name vocabulary gap is bridged and tested.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-03-SUMMARY.md`
</output>
