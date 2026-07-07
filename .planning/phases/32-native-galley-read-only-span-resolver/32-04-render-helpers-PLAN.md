---
phase: 32-native-galley-read-only-span-resolver
plan: 04
type: execute
wave: 1
depends_on: [32-01]
files_modified:
  - apps/dispatch-control/lib/galley/syntheticPortableText.ts
  - apps/dispatch-control/lib/galley/googleFontLoader.ts
  - apps/dispatch-control/lib/galley/galleyGameValidator.ts
autonomous: true
requirements: [GLY-01]
must_haves:
  truths:
    - "A flat {type,text} draft row with N resolved annotations becomes one PortableText block whose spans carry the covering annotation markDef keys"
    - "The galley loads only whitelisted Google Fonts for the issue's theme; unknown/malicious font names are rejected and never injected"
    - "The galley game validator rejects the same banned constructs as apps/web/lib/game-validator.ts (parity)"
  artifacts:
    - path: "apps/dispatch-control/lib/galley/syntheticPortableText.ts"
      provides: "toSyntheticBlocks(rows, annotationsByBlock) -> PortableTextBlock[]"
      exports: ["toSyntheticBlocks"]
    - path: "apps/dispatch-control/lib/galley/googleFontLoader.ts"
      provides: "whitelist-validated dynamic <link> font loader"
      exports: ["ensureThemeFont", "FONT_WHITELIST"]
    - path: "apps/dispatch-control/lib/galley/galleyGameValidator.ts"
      provides: "duplicated embed-code validator (parity w/ apps/web)"
      exports: ["validateEmbedCode", "injectGameHead", "BANNED_PATTERNS", "GAME_CSP_POLICY"]
  key_links:
    - from: "syntheticPortableText.ts markDefs"
      to: "@portabletext/react marks component (AnnotationMark, Plan 32-05)"
      via: "markDef _type:'annotation' carrying the full finding payload"
      pattern: "_type: 'annotation'"
---

<objective>
Build the three pure render-helper modules the galley composes from (GLY-01), TDD against the RED tests from Plan 32-01. All three deliberately DUPLICATE (never import) apps/web code per D-06's cross-app-decoupling rule.

Purpose: convert flat draft rows into annotate-able PortableText, load theme fonts safely, and sandbox the galley game with proven parity.
Output: `syntheticPortableText.ts`, `googleFontLoader.ts`, `galleyGameValidator.ts` — turning their three unit tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md

<interfaces>
@portabletext/react v6 block shape:
```ts
{ _type:'block', _key:string, style:'normal'|'h2'|'h3'|'blockquote',
  markDefs: { _type:string, _key:string, ...payload }[],
  children: { _type:'span', text:string, marks:string[] }[] }
```
marks component API: keyed by markDef._type; receives the FULL markDef object as `value`.

ResolvedAnnotation (from spanResolver.ts, Plan 32-03): { findingId, blockIndex, start, end, severity, axis?, reason, suggestedFix?, quotedSpan }

apps/web/lib/theme.ts FONT_WHITELIST (duplicate verbatim):
  'Playfair Display','Lora','Inter','Cormorant Garamond','Merriweather',
  'DM Serif Display','Fraunces','Newsreader','IBM Plex Mono'

apps/web/lib/game-validator.ts: BANNED_PATTERNS (13 entries), validateEmbedCode,
  injectGameHead, GAME_CSP_POLICY — the parity source.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: syntheticPortableText.ts — flat row + annotations → PT block with markDef injection</name>
  <files>apps/dispatch-control/lib/galley/syntheticPortableText.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/syntheticPortableText.test.ts (RED spec — implement to it exactly)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md (§Pattern 1 — the full synthesis + breakpoint-slicing algorithm, incl. the overlapping-annotation union rule)
    - apps/web/components/issue/PortableTextRenderer.tsx (reference for the v6 block/span shape — do NOT import)
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/galley/syntheticPortableText.ts` exporting `toSyntheticBlocks(rows, annotationsByBlockIndex)` where `rows: {type,text}[]` and `annotationsByBlockIndex: Map<number, ResolvedAnnotation[]>` (annotations already resolved to THIS section by the resolver). For each row at index `i`:
    - `style = row.type === 'paragraph' ? 'normal' : row.type` (h2/h3/blockquote pass through).
    - `_key = \`row-${sectionId}-${i}\`` (accept `sectionId` as a param so keys are stable + unique across sections).
    - Let `anns = annotationsByBlockIndex.get(i) ?? []`.
    - If `anns` is empty → `children: [{ _type:'span', _key:..., text: row.text, marks: [] }]`, `markDefs: []`.
    - Else: build `markDefs` = one `{ _type:'annotation', _key: \`ann-${findingId}\`, findingId, severity, axis, reason, suggestedFix, quotedSpan }` per annotation. Compute the sorted set of all breakpoints `{0, ...each ann.start, ...each ann.end, row.text.length}`; slice `row.text` into contiguous runs at every adjacent breakpoint pair; for each run `[s,e)` emit a span `{ _type:'span', text: row.text.slice(s,e), marks: [<keys of every markDef whose [start,end) covers [s,e)>] }`. Drop empty runs. Overlapping annotations → the overlap run's `marks` array carries BOTH keys (@portabletext/react stacks them automatically).
    Pure module, no imports beyond the `ResolvedAnnotation` type (import from `./spanResolver` — types only).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/syntheticPortableText.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `syntheticPortableText.test.ts` passes (zero-annotation, h2, blockquote, single-annotation-split, overlapping-annotation cases)
    - Every markDef has `_type: 'annotation'` and carries `findingId/severity/reason` (grep: `_type: 'annotation'`)
    - A covered span's `marks` array references the markDef `_key`; overlapping region carries both keys
  </acceptance_criteria>
  <done>Flat rows become annotate-able PortableText blocks with per-instance finding payloads on markDefs.</done>
</task>

<task type="auto">
  <name>Task 2: googleFontLoader.ts — whitelist-validated dynamic font <link> injection</name>
  <files>apps/dispatch-control/lib/galley/googleFontLoader.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/googleFontLoader.test.ts (RED spec)
    - apps/web/lib/theme.ts (FONT_WHITELIST + validateFont + validateHex + the `element.style.setProperty` pattern in applyTheme — duplicate the security invariants, do NOT import per D-06)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md (§Pitfall 4 — no dynamic font-loading mechanism exists yet; build one)
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/galley/googleFontLoader.ts`. Duplicate `FONT_WHITELIST` verbatim from apps/web/lib/theme.ts (the 9-name frozen array) and a `validateFont(name): string | null` (returns the name iff whitelisted, else null) and `validateHex(value): string | null` (the 6-digit `/^#[0-9A-Fa-f]{6}$/` check). Export:
    ```ts
    // Injects a Google Fonts <link> for `fontName` iff whitelisted; deduped by
    // font family. Returns true if a valid font was applied (already-present or
    // newly injected), false if rejected. Never trusts the raw theme string.
    export function ensureThemeFont(fontName: unknown): boolean
    ```
    Behavior: `const font = validateFont(fontName); if (!font) return false;` Build `href = \`https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g,'+')}:ital,wght@0,400;0,600;1,400&display=swap\``. Dedupe: if a `<link data-galley-font="${font}">` already exists in `document.head`, return true without re-injecting; else create `<link rel="stylesheet" href=... data-galley-font=font>` and append to `document.head`, return true. Guard `typeof document === 'undefined'` (SSR) → return false. Also export a small `applyThemeAccent(accent: unknown, el: HTMLElement)` that validates via `validateHex` and, only on pass, calls `el.style.setProperty('--galley-accent', accent)` (setProperty-only injection — D-04 accent flavor). Do NOT import anything from apps/web.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/googleFontLoader.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `googleFontLoader.test.ts` passes: whitelisted → one `<link>` with `fonts.googleapis.com/css2?family=`; non-whitelisted/malicious → no `<link>`, returns false; double-call → single `<link>` (dedupe via `data-galley-font`)
    - Source duplicates FONT_WHITELIST inline (grep: `Newsreader` and `Cormorant Garamond` present) and imports NOTHING from `apps/web` (grep -c "apps/web" == 0)
    - Accent application uses `setProperty` after `validateHex` (grep: `setProperty` and a `#` hex regex)
  </acceptance_criteria>
  <done>Theme fonts + accent load safely from a whitelist-validated loader; injection is deduped and setProperty-only.</done>
</task>

<task type="auto">
  <name>Task 3: galleyGameValidator.ts — duplicated embed-code validator (parity with apps/web)</name>
  <files>apps/dispatch-control/lib/galley/galleyGameValidator.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/galleyGameValidator.test.ts (RED spec + parity assertions)
    - apps/web/lib/game-validator.ts (the ENTIRE 131-line module — copy BANNED_PATTERNS, validateEmbedCode, GAME_CSP_POLICY, injectGameHead verbatim; D-06 says duplicate, not import)
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/galley/galleyGameValidator.ts` by copying `apps/web/lib/game-validator.ts` verbatim (all exports: `BANNED_PATTERNS`, `ValidationResult`, `validateEmbedCode`, `GAME_CSP_POLICY`, `injectGameHead`, `GAME_HEAD`). Update the header docstring to note it is the dispatch-control galley duplicate (D-06 cross-app decoupling — KEEP IN SYNC with apps/web/lib/game-validator.ts if either changes). Do NOT import from apps/web. Do NOT add or remove any banned pattern (parity is the contract).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/galleyGameValidator.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `galleyGameValidator.test.ts` passes (≥13 BANNED_PATTERNS; fetch/window.parent rejected; benign accepted; empty rejected)
    - `injectGameHead` prepends the CSP meta tag (grep: `Content-Security-Policy` and `connect-src 'none'`)
    - Zero imports from `apps/web` (grep -c "apps/web" == 0)
  </acceptance_criteria>
  <done>The galley has its own sandbox validator with proven parity to the live reader site's.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/syntheticPortableText.test.ts __tests__/googleFontLoader.test.ts __tests__/galleyGameValidator.test.ts` green.
</verification>

<success_criteria>
The galley's three composition helpers exist, are pure/duplicated (no apps/web coupling), and pass their unit specs — ready for the components in Plan 32-05/06.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-04-SUMMARY.md`
</output>
