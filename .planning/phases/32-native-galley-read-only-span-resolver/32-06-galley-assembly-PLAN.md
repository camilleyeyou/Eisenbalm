---
phase: 32-native-galley-read-only-span-resolver
plan: 06
type: execute
wave: 3
depends_on: [32-03, 32-04, 32-05]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx
autonomous: true
requirements: [GLY-01]
must_haves:
  truths:
    - "The galley renders all 8 reader-visible sections (headlines/decks/prose) natively from the draft-read data"
    - "The game renders inside a sandboxed iframe (srcdoc + sandbox='allow-scripts') validated by the galley's own validator"
    - "Live QA findings (useQuery) are resolved per section, drawn inline where resolved and as section-end cards where unresolved"
    - "Accepted findings are hidden from the galley (open findings only)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx"
      provides: "orchestrates sections + resolver + live findings + theme fonts"
      exports: ["default"]
      min_lines: 60
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx"
      provides: "one section: headline/deck/PortableText body + unresolved cards"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx"
      provides: "sandboxed-iframe game render (validator + CSP)"
  key_links:
    - from: "Galley.tsx"
      to: "convex qaCorrections.byRunId (live findings)"
      via: "useQuery"
      pattern: "useQuery\\(.*qaCorrections"
    - from: "Galley.tsx"
      to: "spanResolver.resolveSectionFindings"
      via: "per-section resolution at render time"
      pattern: "resolveSectionFindings"
    - from: "GallerySection.tsx"
      to: "@portabletext/react <PortableText>"
      via: "synthetic blocks + AnnotationMark marks component"
      pattern: "PortableText"
---

<objective>
Assemble the galley (GLY-01): render every reader-visible section natively from the draft-read data (D-05 coverage), overlay live QA findings via the Plan 32-03 resolver + Plan 32-05 annotation primitives, and render the game in a sandboxed iframe using the Plan 32-04 validator. This turns `Galley.test.tsx` green.

Purpose: Andrew reads the issue as the reader will, with findings inline — the native replacement for the preview iframe as primary read surface.
Output: `GalleryGameSlot.tsx`, `GallerySection.tsx`, `Galley.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md
@.planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md

<interfaces>
DraftResponse (apps/dispatch-control/lib/contentPatchClient.ts):
  { revisionId, sections: Record<id,{headline?,blocks:ContentBlock[],lossy}>,
    theme, game, bonus, bonusType, podcast, conversation }
  ContentBlock = { type:'paragraph'|'h2'|'h3'|'blockquote'; text:string }

Convex query: api.qaCorrections.byRunId, args { runId } -> qaCorrections rows
  (each { _id, sectionName, severity, axis?, reason, suggestedFix?, quotedSpan?, accepted, blockIndexHint? })

Plan 32-03: qaSectionToGalleyId(qaName) -> galleyId|null ; resolveSectionFindings(blocks, findings) -> {resolved, unresolved}
Plan 32-04: toSyntheticBlocks(rows, annotationsByBlockIndex, sectionId) ; ensureThemeFont(name) / applyThemeAccent(hex, el) ; validateEmbedCode / injectGameHead
Plan 32-05: AnnotationMark (marks.annotation component) ; UnresolvedFindingCard

D-05 coverage (reader order): originStory, problemStatement, founderBio, caseStudy,
  game (sandboxed iframe), bonus (stored variant), podcast (player if audioUrl else transcript),
  deliberation-conversation (turns). SKIP furniture: shop callout, mission band, header/footer, hero decorations.

apps/web GameSlot pattern (reference only, do NOT import): iframe sandbox="allow-scripts" srcDoc={injectGameHead(embedCode)} after validateEmbedCode passes; else a "Game unavailable" fallback.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: GalleryGameSlot.tsx — sandboxed-iframe game render</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx</files>
  <read_first>
    - apps/web/components/issue/GameSlot.tsx (the sandbox pattern to REPLICATE, not import — note the exact `sandbox="allow-scripts"` string and the validate→injectGameHead→srcDoc flow)
    - apps/dispatch-control/lib/galley/galleyGameValidator.ts (Plan 32-04 — the validator + injectGameHead to use here)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md (D-05 game coverage)
  </read_first>
  <action>
    Create `GalleryGameSlot.tsx` (`'use client'`). Props: `{ game: { headline?: string; description?: string; embedCode?: string } }`. Run `validateEmbedCode(game.embedCode)` from `@/lib/galley/galleyGameValidator`. If `embedCode` present AND valid → render `<iframe sandbox="allow-scripts" srcDoc={injectGameHead(game.embedCode)} title={game.headline ?? 'Game'} className="galley-game-frame" style={{width:'100%',minHeight:'360px',border:'1px solid var(--color-ink)'}} />`. If invalid → render a plain "Game unavailable" fallback box (no Convex write here — the galley is read-only; the reader-site GameSlot already reports validation failures to Convex). If no embedCode → "Game coming soon." SECURITY: the `sandbox` attribute is EXACTLY `"allow-scripts"` — never add `allow-same-origin` or any other token. Render the game headline above the frame with `.galley-h2`.
  </action>
  <verify>
    <automated>grep -rq 'sandbox="allow-scripts"' "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx" && ! grep -rq 'allow-same-origin' "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GalleryGameSlot.tsx" && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - GalleryGameSlot renders `<iframe sandbox="allow-scripts" srcDoc={...}>` only after `validateEmbedCode` passes
    - The string `allow-same-origin` appears NOWHERE in the file
    - Uses `injectGameHead` from the galley validator (grep: `injectGameHead`); imports nothing from `apps/web`
    - Invalid/empty embedCode renders a fallback box (no crash, no Convex write)
  </acceptance_criteria>
  <done>The game renders sandboxed inside the galley with the same validator+CSP guarantees as the reader site.</done>
</task>

<task type="auto">
  <name>Task 2: GallerySection.tsx — one section's native render + unresolved cards</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/galley/syntheticPortableText.ts (Plan 32-04 — `toSyntheticBlocks`)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx (Plan 32-05 — the marks.annotation component)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx (Plan 32-05)
    - apps/web/components/issue/PortableTextRenderer.tsx (reference for the @portabletext/react v6 `components` map — block.normal/h2/h3/blockquote + marks — do NOT import)
  </read_first>
  <action>
    Create `GallerySection.tsx` (`'use client'`). Props: `{ sectionId: string; headline?: string; deck?: string; rows: ContentBlock[]; resolved: ResolvedAnnotation[]; unresolved: UnresolvedFinding[] }`. Render:
    - `<h2 className="galley-headline">{headline}</h2>` (when present) and `<p className="galley-deck">{deck}</p>` (when present).
    - Group `resolved` by `blockIndex` into a `Map<number, ResolvedAnnotation[]>`, call `toSyntheticBlocks(rows, map, sectionId)`, and render `<PortableText value={syntheticBlocks} components={components} />` from `@portabletext/react`. Define `components: Partial<PortableTextReactComponents>` with `block: { normal: ({children})=><p className="galley-body">{children}</p>, h2: ({children})=><h2 className="galley-h2">{children}</h2>, h3: ({children})=><h3 className="galley-h2">{children}</h3>, blockquote: ({children})=><blockquote className="galley-pullquote">{children}</blockquote> }` and `marks: { annotation: ({value,children})=><AnnotationMark value={value}>{children}</AnnotationMark> }`.
    - After the body, render each `unresolved` finding via `<UnresolvedFindingCard key=... finding=... />` so anchor-failures stay in section context (D-09).
    Wrap in `<section id={\`galley-${sectionId}\`}>` so chip jump-nav (Plan 32-07) can `scrollIntoView`.
  </action>
  <verify>
    <automated>grep -rq "PortableText" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx" && grep -rq "UnresolvedFindingCard" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx" && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - GallerySection renders `<PortableText value={...} components={...}>` with `marks.annotation` → AnnotationMark and block styles normal/h2/h3/blockquote
    - Unresolved findings render via `UnresolvedFindingCard` after the body
    - The section wrapper has `id={\`galley-${sectionId}\`}` (grep: `galley-`)
  </acceptance_criteria>
  <done>One section renders natively with inline resolved annotations and section-end unresolved cards.</done>
</task>

<task type="auto">
  <name>Task 3: Galley.tsx — orchestrate sections, live findings, resolver, theme fonts</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/Galley.test.tsx (the RED spec — implement to its fixture + assertions)
    - apps/dispatch-control/lib/galley/spanResolver.ts + sectionIdMap.ts (Plan 32-03)
    - apps/dispatch-control/lib/galley/googleFontLoader.ts (Plan 32-04 — ensureThemeFont / applyThemeAccent)
    - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx (existing `useQuery(api.*.*)` + `@convex/_generated/api` import pattern to mirror)
    - apps/dispatch-control/lib/contentPatchClient.ts (DraftResponse shape)
  </read_first>
  <action>
    Create `Galley.tsx` (`'use client'`). Props: `{ runId: string; draft: DraftResponse }`. Steps:
    1. Live findings: `const findings = useQuery(api.qaCorrections.byRunId, { runId }) ?? []` (import `api` from `@convex/_generated/api`). Filter OUT `accepted === true` (D-08 — open findings only).
    2. Group findings by galley section id: for each row, `const galleyId = qaSectionToGalleyId(row.sectionName)`; skip when null; map row → the resolver's finding input `{ findingId: row._id, sectionId: galleyId, quotedSpan, blockIndexHint, severity, axis, reason, suggestedFix, accepted }`.
    3. Theme fonts + accent (D-04): in a `useEffect`, call `ensureThemeFont(draft.theme?.fontDisplay)` and `ensureThemeFont(draft.theme?.fontBody)` and `applyThemeAccent(draft.theme?.accentColor, containerRef.current)` — all whitelist/hex-validated inside those helpers (a bad value is a no-op).
    4. Render sections in reader order (D-05): for each of `originStory, problemStatement, founderBio, caseStudy` → resolve via `resolveSectionFindings(draft.sections[id].blocks, findingsForId)` and render `<GallerySection sectionId=... headline={draft.sections[id].headline} rows={draft.sections[id].blocks} resolved=... unresolved=... />`. Then `<GalleryGameSlot game={draft.game} />`. Then the bonus in its stored variant (`draft.bonusType`: specAd → render `draft.bonus.body` rows via a GallerySection-style body with `bonus` findings; bigBudget → headline + storyboards `<img src={sb.asset?.url}>`; jingle → headline + lyrics). Then podcast: if `draft.podcast?.audioUrl` render `<audio controls src={audioUrl}>` else the transcript text; then a "Deliberation" block rendering `draft.conversation` turns as `speaker: text`. SKIP furniture (shop callout, mission band, header/footer).
    5. Wrap everything in a `<div ref={containerRef} className="galley-root">`. Handle `useQuery` returning `undefined` (loading) gracefully (findings default `[]`).
    Keep the resolver call per section (never concatenate). Do NOT write to Convex or Sanity from the galley (read-only phase).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `Galley.test.tsx` passes green (all 8 sections render, game iframe sandboxed, severity-encoded annotation present)
    - Galley calls `useQuery(api.qaCorrections.byRunId, { runId })` and filters `accepted` (grep: `accepted`)
    - Galley calls `resolveSectionFindings` per long-read section and `qaSectionToGalleyId` for grouping
    - `ensureThemeFont` + `applyThemeAccent` are invoked in a `useEffect`; podcast renders `<audio>` when `audioUrl` present
    - No Convex mutation / Sanity write call anywhere in the file
  </acceptance_criteria>
  <done>The full native galley renders every reader section with live, resolved QA annotations and theme flavor — read-only.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx` green.
- `cd apps/dispatch-control && npx vitest run` full suite green.
</verification>

<success_criteria>
GLY-01 satisfied: a native, annotate-able render of the entire reader-visible issue (incl. sandboxed game), driven by live findings + the resolver, with theme fonts/accent — no iframe.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-06-SUMMARY.md`
</output>
