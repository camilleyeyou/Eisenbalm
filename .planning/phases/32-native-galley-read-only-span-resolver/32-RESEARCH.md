# Phase 32: Native Galley (read-only) + Span-Resolver - Research

**Researched:** 2026-07-07
**Domain:** Portable-Text-shaped custom rendering in React + client-side text-anchor resolution (no new backend/infra)
**Confidence:** HIGH (all findings are code-verified against this repo, not framework trivia)

## Summary

This phase is almost entirely a **frontend composition problem** inside `apps/dispatch-control` — no new pipeline endpoints, no new Convex tables beyond one optional field. The two things that make it non-trivial were both hiding in code, not in `@portabletext/react` docs:

1. **The draft-read endpoint does NOT return real Portable Text.** `GET /issues/{run_id}/draft` (`get_issue_draft()` in `lib/sanity_client.py`) round-trips Sanity's real PT blocks through `pt_to_blocks()`, which flattens every block to `{type, text}` — a single joined string per block, marks and multi-span structure already lost (that's what `lossy` flags). So "render via `@portabletext/react`" (D-06) means **synthesizing single-span PT blocks client-side** from these flat rows, not passing real Sanity content through unmodified. This is good news for the resolver (block text is already flat, no marks to fight with) but it means the plan must include a small "flatten row → synthetic PortableTextBlock" adapter step, not just a `<PortableText value={draft.blocks}>` call.
2. **QA's `sectionName` values don't match the galley's section ids.** The QA agent (`agents/qa/__init__.py::_extract_sections`) writes Convex `qaCorrections.sectionName` as `origin_story | problem | founder_bio | case_study | game | bonus` (snake_case, and `problem` ≠ `problemStatement`) — while the draft-read/editor/chip-list world uses `originStory | problemStatement | founderBio | caseStudy | game | bonus | podcast | theme | deliberation-conversation`. Nothing in the codebase currently bridges these two vocabularies (the only other qaCorrections consumer, `AwaitingYouInbox.tsx`, never needs to join `sectionName` against a UI section id). The plan must introduce this mapping as new, explicitly-tested code.

Beyond those two findings, the rest of the phase is straightforward: `@portabletext/react` is already a proven, pinned dependency in this monorepo (`apps/web` uses `^6.2.0`, confirmed current on npm), the game-sandbox pattern is a small (131-line) pure module easy to duplicate, `qaCorrections.byRunId` is the only Convex query needed (no new query required — group client-side), and dispatch-control's vitest setup already supports pure-TS unit tests plus jsdom component tests with zero config changes.

**Primary recommendation:** Build the resolver as annotation-**markDef** injection into synthesized single-span PortableText blocks (not a custom flattening `block` component) — this lets `@portabletext/react`'s native mark-component API render (and even stack/nest) severity-colored spans with zero fighting against the library's model, and it naturally forces cross-block `quotedSpan` matches to fail closed into "unresolved" (D-12) because the resolver searches per-block text only, never the whole concatenated section.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Galley is the default view at `/review-desk/[runId]`. Each section has an Edit affordance that swaps into the Phase 31 section editor for that section, returning to the galley on save/cancel. Exact mechanics (inline swap vs panel) are Claude's discretion.
- **D-02:** The Phase 31 in-desk iframe toggle stays for the soak cycle. The Phase 26 review page (`/run-monitor/runs/[runId]/review`) remains byte-untouched.
- **D-03:** The existing `SectionChipList` upgrades in place: per-section finding counts (severity-aware, open findings only), click = scroll-to-section. One chip strip serves both galley jump-nav and editor section selection.
- **D-04:** Theme fonts + accent color only inside the galley (issue's display/body Google Fonts + accent color for flavor), plus the design spec's own galley type scale (Newsreader 52px headline, italic 22px deck, 16.5px/1.7 body) and the console's paper background. Full color-theme checking remains the iframe's job.
- **D-05:** Coverage = all reader-visible content Andrew signs off on: all 8 sections in reader order with headlines/decks, the game as a sandboxed iframe (`srcdoc` + `sandbox="allow-scripts"`, reuse the apps/web GameSlot sandbox pattern), the bonus in its stored variant, the podcast (player if audio exists, transcript), and the deliberation conversation. Skip pure furniture: shop callout, mission band, site header/footer, hero decorations.
- **D-06:** Galley-own renderer — new PortableText components in `apps/dispatch-control`, styled to the galley spec. Do NOT extract or import apps/web's `PortableTextRenderer`.
- **D-07:** Tiered 1c severity colors: `error` → rust/vermilion underline + tint, `warning` → marigold underline, `info` → cobalt dotted underline.
- **D-08:** Accepted findings (`accepted: true`) are hidden from galley spans and chip counts — chips count open findings only.
- **D-09:** Unresolved findings = section-end card + chip badge. A finding whose anchor fails renders as a visible "unresolved" card at the end of its section (showing full reason + original quoted text), and the section's chip carries an unresolved marker.
- **D-10:** Read-only popover this phase: clicking an annotation opens a popover with axis · severity · reason · suggested fix — no action buttons (Phase 33 adds them into the same component).
- **D-11:** This phase adds `blockIndexHint` end-to-end: new optional field on Convex `qaCorrections` (`v.optional(v.number())`) AND the QA agent records the block ordinal when generating findings. New runs resolve with the hint; legacy findings resolve hint-less (hint is optional and never authoritative).
- **D-12:** Ambiguous match → unresolved. If a `quotedSpan` matches more than once in the section and the hint can't disambiguate, the finding goes to the section-end unresolved card — never guess a span.
- **D-13:** Client-side resolver — a pure TypeScript module in dispatch-control that resolves Convex findings (live `useQuery`) against the draft from `GET /issues/{run_id}/draft` at render time. Fresh on every content change, no new pipeline endpoints, unit-testable in isolation. Phase 33's post-patch re-resolution reuses this module directly.

### Claude's Discretion
- Edit-affordance mechanics (inline section swap vs side panel vs modal).
- quotedSpan match normalization (exact-first, then whitespace/curly-quote-normalized fallback) — design for resolution rate, but ambiguity always resolves per D-12.
- Chip strip stickiness/scroll-spy behavior, popover positioning library/mechanics.
- How the QA agent computes the block ordinal (which agent output field, plumbing through the Convex mutation).
- Podcast/deliberation/bonus galley presentation details within D-05's coverage.

### Deferred Ideas (OUT OF SCOPE)
- Annotation actions (Accept/Edit/Dismiss) + dismissal reasons — Phase 33 (EDT-04).
- Post-patch annotation re-resolution + orphan review flow — Phase 33 (EDT-06), reusing this phase's resolver module.
- Decision rail (blockers-first, editor memo, verification summary) — Phase 33 (GLY-04).
- Iframe toggle retirement + Phase 26 review page retirement — after the soak cycle.
- Sourced/unsourced claim highlighting (marigold/rust provenance states) — Phase 35, rendered by this galley.
- Full-theme-fidelity galley mode — not chosen (D-04); revisit only if the iframe retires.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GLY-01 | Native render of the Sanity draft (all sections incl. sandboxed game), replacing the preview iframe as primary read surface | §Draft shape/gaps below defines exactly what data exists per section; §Renderer architecture defines the synthetic-PT-block + custom components approach; §Game sandbox reuse defines the duplication plan |
| GLY-02 | QA findings render as inline severity-colored span annotations resolved via quotedSpan + blockIndexHint; unresolved findings surfaced, never dropped/mis-rendered | §Resolver algorithm gives the exact per-block search + disambiguation logic; §Section-id mapping gap is the precondition the resolver depends on; §blockIndexHint emission traces the minimal QA-agent + Convex change |
| GLY-05 | Section-status chips show per-section finding counts and jump-navigate | §Chip strip upgrade covers the SectionChipList extension (counts + scroll-to-section), reusing the resolver's per-section grouping output |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@portabletext/react` | `^6.2.0` (verified current on npm; matches `apps/web`'s pin exactly) | Renders block-array content with custom component overrides per block style / mark type | Already the project's chosen PT renderer (apps/web); using the same major version avoids two different mental models of the same library in one monorepo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@portabletext/toolkit` | `^5.0.2` (optional) | Provides `toPlainText()` and low-level PT traversal helpers | Not required — this phase's blocks are already flat single-span text (see below), so no traversal helper is needed. Only pull this in if a later phase (Phase 35 provenance) needs generic multi-span PT walking. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@portabletext/react` custom `block`/`marks` components (chosen) | A hand-rolled string-splitting renderer (regex/`String.prototype.split` directly on `blocks[i].text`, no PT library at all) | Hand-rolling would work today (blocks are flat strings) but throws away `@portabletext/react`'s mark-stacking/nesting behavior for free, and diverges further from apps/web's established rendering vocabulary. Since PT is already a locked project dependency and D-06 explicitly frames this as "PortableText components," staying inside the library is the right call. |
| Client-side resolver (chosen, D-13) | Server-side resolver (pipeline computes resolved spans at draft-read time) | Explicitly rejected by CONTEXT — draft-read must stay a dumb data fetch; resolution must be "fresh on every content change" via Convex reactivity, which is a client-side concern (Convex `useQuery` push, not a new pipeline round-trip per keystroke). |

**Installation:**
```bash
cd apps/dispatch-control
npm install @portabletext/react@^6.2.0
```

**Version verification:** `npm view @portabletext/react version` → `6.2.0` (confirmed live during this research, 2026-07-07). This is the same version already vendored in `apps/web/package.json`, so no cross-app version drift is introduced.

## Architecture Patterns

### Recommended Project Structure
```
apps/dispatch-control/
├── lib/
│   ├── galley/
│   │   ├── sectionIdMap.ts        # QA sectionName <-> galley/draft section id (new)
│   │   ├── spanResolver.ts        # D-13 pure resolver module (new)
│   │   ├── spanResolver.test.ts   # unit tests (new) — or __tests__/spanResolver.test.ts per convention
│   │   ├── syntheticPortableText.ts  # flat {type,text} row -> minimal PT block w/ annotation markDefs (new)
│   │   └── googleFontLoader.ts    # dynamic <link> injection for theme fonts, validated (new)
│   └── contentPatchClient.ts      # unchanged (existing §31.7 client)
└── app/(dashboard)/review-desk/[runId]/
    ├── page.tsx                    # existing shell; galley becomes the default body (D-01)
    └── _components/
        ├── Galley.tsx              # new: orchestrates sections + resolver + chip strip
        ├── GallerySection.tsx      # new: one section's headline/deck/body render + unresolved cards
        ├── AnnotationMark.tsx      # new: @portabletext/react mark component (D-07 colors + D-10 popover)
        ├── UnresolvedFindingCard.tsx  # new: D-09 section-end card
        ├── GalleryGameSlot.tsx     # new: duplicated GameSlot sandbox pattern (not imported)
        ├── SectionChipList.tsx     # existing — upgraded in place (D-03)
        ├── SectionEditorPanel.tsx  # existing — becomes the Edit-affordance target (D-01)
        └── ... (BlockEditor, StructuredFieldEditor, TurnListEditor, AssetUploadSlot unchanged)
```

### Pattern 1: Synthetic single-span PortableTextBlock + annotation markDef injection
**What:** Convert each draft `ContentBlock = {type, text}` row into a minimal valid `PortableTextBlock`:
```ts
{
  _type: 'block',
  _key: `row-${sectionId}-${index}`,
  style: type === 'paragraph' ? 'normal' : type,   // 'h2' | 'h3' | 'blockquote' pass through
  markDefs: [ /* one entry per resolved annotation touching this block */ ],
  children: [ /* one or more spans, split at annotation boundaries, each carrying the markDef keys covering it */ ],
}
```
For a block with zero resolved annotations, `children` is just the original single span with `marks: []` — cheap, common case.
For a block with N resolved annotations (possibly overlapping — two QA axes flagging overlapping text), compute the union of all `(start, end)` breakpoints, slice the text into contiguous runs at every breakpoint, and give each run's span a `marks: []` array containing the `_key` of every annotation markDef whose range covers that run. `@portabletext/react` renders nested/stacked mark components automatically when a span carries multiple mark keys — no extra code needed for the overlap case.

**When to use:** Every galley section body (`originStory`, `problemStatement`, `founderBio`, `caseStudy`, `bonus.body` when specAd). Game/podcast/theme/deliberation are NOT rendered through this path (they're not `ContentBlock[]`, and QA does not currently emit findings against podcast/theme/deliberation-conversation section names — see Section-id mapping table below).

**Example:**
```tsx
// Source: @portabletext/react README + apps/web/components/issue/PortableTextRenderer.tsx (v6 API, verified in this repo)
import { PortableText, type PortableTextReactComponents } from '@portabletext/react'

const components: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children }) => <p className="galley-body">{children}</p>,
    h2: ({ children }) => <h2 className="galley-h2">{children}</h2>,
    blockquote: ({ children }) => <blockquote className="galley-pullquote">{children}</blockquote>,
  },
  marks: {
    // keyed by markDef._type — receives the FULL markDef object as `value`,
    // so each instance can carry its own findingId/severity/reason/quotedSpan
    annotation: ({ value, children }) => (
      <AnnotationMark finding={value} >{children}</AnnotationMark>
    ),
  },
}

<PortableText value={syntheticBlocks} components={components} />
```
This is the mechanism that makes D-07's severity coloring + D-10's popover possible: `value` on the mark component is the actual markDef object, so it can carry `{ _type: 'annotation', _key, findingId, severity, axis, reason, suggestedFix }` — a full per-instance payload, which a plain decorator mark (`marks: ['strong']`-style, matched by string) cannot carry.

### Pattern 2: Per-block, per-section quotedSpan resolution (never whole-section concatenation)
**What:** The resolver searches for `quotedSpan` inside ONE block's text at a time — never the section's blocks joined together. This is both correct and convenient:
- It matches how QA actually produces `quotedSpan` today: QA's own view of a section is a single flattened string (`_body_to_text` joins all block children with `' '`), so a `quotedSpan` that happens to straddle two blocks' boundary is a possible (if rare) LLM artifact. Searching per-block only means such a straddling quote naturally finds zero matches in either block → falls to "unresolved," satisfying D-12's "never guess" without any special-case code.
- It gives `blockIndexHint` real disambiguating power: if a raw substring match is ambiguous across two OTHER blocks but the hinted block contains a match too, prefer the hinted block's match, but ONLY if the hinted block's own text contains the match at least once — never trust the hint blindly if the hint is stale/out of range.

**When to use:** Every quotedSpan resolution, exact-first then normalized-fallback (see Common Pitfalls → normalization below).

### Anti-Patterns to Avoid
- **Concatenating section text and searching once:** Reintroduces cross-block ambiguity and defeats the whole point of `blockIndexHint`. Always search block-by-block.
- **Trusting `blockIndexHint` unconditionally:** D-11 explicitly says the hint is "never authoritative." A stale hint (section edited since the finding was generated, or a legacy pre-D-11 row with no hint) must fall through to full search, not short-circuit to "unresolved because index out of range."
- **Rendering QA findings via a custom flattening `block` component that re-splits `children` text with regex at render time:** Works but throws away Portable Text's native mark-stacking for overlapping annotations, and re-implements what markDef injection already gives for free. Prefer preprocessing the block tree before it reaches `<PortableText>` (Pattern 1).
- **Importing `apps/web/components/issue/PortableTextRenderer.tsx` or `apps/web/lib/game-validator.ts` directly:** D-06 explicitly forbids the renderer import (cross-app coupling); the game-validator module is small (131 lines, zero external deps) and should be duplicated for the same reason, not imported.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering block-styled prose with inline decorations | A custom AST/HTML-string renderer | `@portabletext/react`'s `block`/`marks` component maps (already proven in this repo) | Handles nesting, unknown-mark warnings, and children composition correctly; matches the vocabulary the rest of the codebase already uses |
| WCAG-safe hex/font validation for theme flavor | A new validator | Duplicate the existing `validateHex`/`validateFont`/`FONT_WHITELIST` pattern from `apps/web/lib/theme.ts` (small, pure, already battle-tested) | Security-critical (CSS/font injection); re-deriving the regex or whitelist risks silently diverging from the canonical list |
| Popover positioning | A hand-rolled absolute-position + resize-observer implementation | Any lightweight, already-common popover primitive (e.g. Radix `Popover` or CSS anchor positioning) — Claude's discretion per CONTEXT | Popover edge-collision/scroll handling is a solved, fiddly problem; not worth hand-rolling for a read-only (D-10) popover |

**Key insight:** Nothing in this phase needs a new third-party string-diffing or fuzzy-matching library — D-12's "ambiguous → unresolved" rule specifically avoids fuzzy matching (which would make ambiguity worse, not better). Exact-substring search (with a narrow, explicit normalization fallback) is sufficient and matches the design intent ("a wrong highlight is worse than an honest miss").

## Runtime State Inventory

Not applicable — this is a net-new read surface, not a rename/refactor/migration. Skipped per the greenfield-phase exemption.

## Common Pitfalls

### Pitfall 1: Assuming the draft-read returns real Portable Text
**What goes wrong:** Passing `draft.sections.originStory.blocks` directly into `<PortableText value={...}>` will fail or render garbage — those rows are `{type, text}` objects, not `{_type:'block', style, children, markDefs}` objects.
**Why it happens:** `pt_to_blocks()` (in `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py`) deliberately flattens real Sanity PT blocks into the simple shape the Phase 31 `BlockEditor` needs (a plain textarea-per-block editor, not WYSIWYG). The galley inherits this same flattened shape because it reads from the same endpoint (`GET /issues/{run_id}/draft`), by design (D-13: "no new pipeline endpoints").
**How to avoid:** Always synthesize a minimal single-span PT block from each row before handing it to `@portabletext/react` (Pattern 1 above). Treat `lossy: true` on a section (already returned by the endpoint) as a signal the galley could optionally surface (e.g. a small "formatting simplified" note) — not required by any of GLY-01/02/05, but cheap to expose if useful.
**Warning signs:** TypeScript errors on `PortableTextBlock` shape mismatches, or a blank render with a console warning about missing `_type`.

### Pitfall 2: QA section-name vocabulary mismatch (the section-id mapping gap)
**What goes wrong:** Grouping `qaCorrections` by `sectionName` and joining directly against `draft.sections` keys or `SectionChipList`'s `EDITABLE_SECTIONS` ids silently drops every finding — because they use different vocabularies.
**Why it happens:** QA's `_extract_sections()` (in `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py`) was written against the internal `DispatchState` field names, not the Sanity/editor section ids:

| QA `sectionName` (Convex) | Galley/draft-read section id |
|---|---|
| `origin_story` | `originStory` |
| `problem` | `problemStatement` |
| `founder_bio` | `founderBio` |
| `case_study` | `caseStudy` |
| `game` | `game` |
| `bonus` | `bonus` |
| *(never emitted)* | `podcast`, `theme`, `deliberation-conversation` |

No existing code bridges these two vocabularies today — `AwaitingYouInbox.tsx` (the only other `qaCorrections` consumer in dispatch-control) only counts by severity/accepted, never joins against a section id.
**How to avoid:** Build one small, explicitly-tested lookup table/function (`lib/galley/sectionIdMap.ts`) as new code in this phase; do not assume any existing mapping exists.
**Warning signs:** Chip counts of 0 for sections that visibly have QA findings in the Phase 26 review page or Convex dashboard.

### Pitfall 3: blockIndexHint drift after edits
**What goes wrong:** A `blockIndexHint` computed by QA at pipeline-run time refers to a block ordinal in the section's body *as QA saw it*. If Andrew edits/reorders that section afterward (Phase 31 `patchSection`), the hint may point at the wrong block or be out of range by the time the galley reads the current draft.
**Why it happens:** The hint is a snapshot, not a live pointer; nothing recomputes it on edit (that's explicitly Phase 33's job — EDT-06 "annotation anchors re-resolved after any content patch").
**How to avoid:** Treat an out-of-range or non-matching hint exactly like a missing hint — always fall through to the full per-block search (already covered by the resolver algorithm's design; just don't special-case a hint-miss as an automatic "unresolved," since the full search might still find a unique match elsewhere).
**Warning signs:** A finding that resolved correctly right after a pipeline run stops resolving (or resolves to the wrong-looking block) after an operator edits that section — expected in isolation this phase (Phase 33 fixes it), but the resolver should degrade to "unresolved," never to a silently wrong span.

### Pitfall 4: No dynamic Google Fonts loading mechanism exists anywhere in this codebase yet
**What goes wrong:** Assuming `next/font/google` can render whichever `theme.fontDisplay`/`theme.fontBody` string comes back from the draft (D-04). It cannot — `next/font/google` requires a static, build-time import per font; it cannot take a runtime string.
**Why it happens:** Checked `apps/web/app/layout.tsx`: only 3 of the 9 `FONT_WHITELIST` fonts (Fraunces, Newsreader, IBM Plex Mono) are actually preloaded via `next/font/google` sitewide. `apps/web/lib/theme.ts::applyTheme()` sets `--font-display`/`--font-body` CSS variables to whatever whitelisted name the issue's theme carries, but there is **no `<link>` tag or other loading mechanism anywhere in the repo** for the other 6 whitelisted fonts (Playfair Display, Lora, Inter, Cormorant Garamond, Merriweather, DM Serif Display) — confirmed via repo-wide grep for `fonts.googleapis`/`fonts.gstatic`, zero hits. This is a pre-existing, out-of-scope gap in `apps/web` itself, not something this phase needs to fix there — but it means dispatch-control cannot copy an existing "load an arbitrary theme font" pattern, because none exists yet.
**How to avoid:** Build a small new client util (`lib/galley/googleFontLoader.ts`) that: (1) validates the incoming font name against a duplicated `FONT_WHITELIST` (same list, same reasoning as `apps/web/lib/theme.ts` — do not trust the draft's `theme.fontDisplay` string directly), (2) injects a `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...">` tag for that font family if not already present (dedupe by font name so re-renders don't stack `<link>` tags), (3) applies the `--font-display`/`--font-body` CSS variables via `element.style.setProperty` exactly like `applyTheme` — reusing the same security invariants (hex regex for accent color, whitelist membership for fonts, `setProperty`-only injection), duplicated rather than imported per D-06's cross-app-decoupling rationale. Note: dispatch-control already `next/font`-loads Newsreader + Lora for its OWN 1c chrome (`app/globals.css`) — that is unrelated to and does not cover the issue's own theme fonts, which vary per issue.
**Warning signs:** Galley renders in a generic system serif regardless of which font the issue's theme actually specifies.

### Pitfall 5: normalization must stay narrow or it undermines D-12
**What goes wrong:** An overly aggressive normalization fallback (fuzzy matching, Levenshtein distance, stemming) could "resolve" a quotedSpan against text the QA agent never actually quoted, silently mis-anchoring an annotation — exactly what GLY-02 and D-12 forbid.
**Why it happens:** Tempting to maximize resolution rate.
**How to avoid:** Keep the normalization fallback narrow and deterministic per CONTEXT's own suggestion: exact substring match first; on failure, retry with a whitespace-collapse (`\s+` → single space) + curly-quote/apostrophe normalization (`’‘“”` → `'"`) pass on both the quotedSpan and the block text, still requiring an exact substring match after normalization — never fuzzy/approximate matching. If normalized search is still ambiguous (>1 match) or empty (0 matches), unresolved.
**Warning signs:** A design review or QA sees an annotation underlining text that doesn't actually match the finding's stated `quotedSpan`.

## Code Examples

### Resolver shape (D-13 pure module)
```ts
// Source: derived from CONTEXT D-11/D-12/D-13 + code-verified draft/finding shapes above.
// lib/galley/spanResolver.ts

export interface ResolvedAnnotation {
  findingId: string          // Convex _id
  sectionId: string          // galley/draft section id (post-mapping)
  blockIndex: number
  start: number               // char offset into blocks[blockIndex].text
  end: number
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan: string
}

export interface UnresolvedFinding {
  findingId: string
  sectionId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

export function resolveSectionFindings(
  blocks: { type: string; text: string }[],
  findings: QaCorrectionRow[],   // already filtered: this section, !accepted
): { resolved: ResolvedAnnotation[]; unresolved: UnresolvedFinding[] } {
  // For each finding: try hinted block (if in range) -> full per-block search
  // (exact, then normalized) -> unresolved. Never search concatenated text.
}
```

### Annotation markDef injection into a synthesized block
```ts
// lib/galley/syntheticPortableText.ts
// Splits a flat row's text at every resolved annotation's [start,end), producing
// span children whose `marks` arrays reference the covering annotation markDef keys,
// and a `markDefs` array with one entry (full finding payload) per annotation.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Preview-only iframe render of the reader site for review (Phase 26/31) | Native in-console render (this phase), iframe kept as a parallel fallback | This phase (Phase 32), soak-cycle retirement in a later phase (D-02) | Andrew reviews in a purpose-built surface that can also show QA findings inline; the iframe remains for full-theme-fidelity spot checks until D-02's soak period ends |

**Deprecated/outdated:** None yet — the iframe is explicitly kept, not deprecated, by D-02.

## Open Questions

1. **Should `blockIndexHint` be computed inside `agents/qa/__init__.py::qa()` (post-hoc string search against the same block lists QA already extracted) or inside `rules.py`/`judge.py` (each finding-producer computes its own index)?**
   - What we know: `_extract_sections()` currently flattens each section's body to ONE joined string per section for both Layer-1 rules and Layer-2 judge input — block boundaries are already lost before either layer sees the text. The raw block lists (`state['origin_story']['body']`, etc.) are still available in `DispatchState` at the point `qa()` runs, untouched by that flattening.
   - What's unclear: whether to compute the hint via a single post-hoc pass in `qa()` (search each raw block list for each finding's `quotedSpan`, using the same unique-match-only rule the client resolver will apply) or to teach `rules.py`/`judge.py` to see per-block boundaries and emit the ordinal directly.
   - Recommendation: compute it post-hoc in `qa()`, once, after `layer1`/`layer2` findings exist and before the Convex write loop — this requires zero changes to `rules.py`'s predicates or `judge.py`'s prompt/rubric, keeps the LLM judge's output schema unchanged (lower cost/regression risk per Phase 18 MEL-07's precedent of guarding writer-prompt cost deltas), and reuses the exact same "unique substring match" logic the client resolver needs anyway (one algorithm, two call sites: server-side hint computation and client-side full resolution). This is Claude's discretion per CONTEXT, but the trace strongly favors this option — flag it for the planner to confirm/lock in Wave 0.

2. **Does the podcast audio URL and any bigBudget-bonus storyboard image URLs actually resolve to usable URLs today?**
   - What we know: `_DRAFT_GROQ` (the GROQ query behind `get_issue_draft()`) does NOT dereference Sanity asset references — no `asset->url` projection anywhere in the query, unlike `apps/web/lib/sanity/queries.ts` which explicitly does `"audioUrl": audioFile.asset->url` and `storyboards[] { asset->{ url } }` for the exact same fields. As returned today, `draft.podcast.audioFile` and `draft.bonus.storyboards[]` (bigBudget bonus type only) would be raw Sanity reference objects (`{_type:'file', asset:{_type:'reference', _ref:'file-abc123'}}`), not resolvable URLs.
   - What's unclear: whether this has simply never been exercised yet (Phase 31's editors don't render audio/images, only edit structured text fields) or whether it's a genuine contract gap this phase must close.
   - Recommendation: this is very likely a real gap that blocks D-05's "podcast (player if audio exists)" and bigBudget-bonus storyboard display. Per CLAUDE.md's contract-first rule, amend `docs/API_CONTRACTS.md` §31.7 AND the `_DRAFT_GROQ` query (add `audioFile.asset->{url}` and `storyboards[]{ asset->{url} }` projections, mirroring `apps/web`'s existing query) BEFORE building the podcast player / storyboard display. This is a small, mechanical GROQ change with no risk to existing Phase 31 consumers (the new fields are additive).

## Environment Availability

No new external service/tool dependencies — this phase adds one npm package (`@portabletext/react`, already used elsewhere in the monorepo) and one optional Convex schema field. Skipped per the no-external-dependency exemption.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.0` (dispatch-control's existing setup) |
| Config file | `apps/dispatch-control/vitest.config.ts` |
| Quick run command | `cd apps/dispatch-control && npx vitest run __tests__/spanResolver.test.ts` |
| Full suite command | `cd apps/dispatch-control && npx vitest run` (or `pnpm --filter dispatch-control test` if that script exists — confirm in `package.json`) |

The existing `environmentMatchGlobs` config already routes `*.test.tsx` files to `jsdom` and leaves `*.test.ts` on the default `node` environment — no config changes needed for either a pure-TS resolver test file or a jsdom component-render test file.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GLY-01 | Galley renders all 8 sections + game (sandboxed) natively from draft-read data | component (jsdom) | `npx vitest run __tests__/Galley.test.tsx` | ❌ Wave 0 |
| GLY-01 | Section-id mapping table covers every QA sectionName + every draft section id, both directions tested | unit | `npx vitest run __tests__/sectionIdMap.test.ts` | ❌ Wave 0 |
| GLY-02 | Resolver: exact single match resolves to correct block+offset | unit | `npx vitest run __tests__/spanResolver.test.ts` | ❌ Wave 0 |
| GLY-02 | Resolver: no match anywhere → unresolved | unit | same file | ❌ Wave 0 |
| GLY-02 | Resolver: match in 2+ blocks, no hint or hint doesn't disambiguate → unresolved (D-12) | unit | same file | ❌ Wave 0 |
| GLY-02 | Resolver: match in 2+ blocks, hint correctly disambiguates → resolved to hinted block | unit | same file | ❌ Wave 0 |
| GLY-02 | Resolver: stale/out-of-range hint falls through to full search (Pitfall 3) | unit | same file | ❌ Wave 0 |
| GLY-02 | Resolver: normalization fallback (curly quotes / whitespace) resolves a near-exact match; still-ambiguous-after-normalization → unresolved | unit | same file | ❌ Wave 0 |
| GLY-02 | Resolver: cross-block quotedSpan (straddles two blocks' joined text) never falsely resolves | unit | same file | ❌ Wave 0 |
| GLY-02 | Accepted findings (`accepted: true`) excluded from resolver input entirely (D-08) | unit | same file or a thin wrapper test | ❌ Wave 0 |
| GLY-02 | Unresolved finding renders as section-end card with full reason + quoted text (D-09) | component (jsdom) | `npx vitest run __tests__/UnresolvedFindingCard.test.tsx` | ❌ Wave 0 |
| GLY-05 | SectionChipList shows severity-aware open-finding counts per section, click scrolls to section | component (jsdom) | `npx vitest run __tests__/SectionChipList.test.tsx` | ❌ Wave 0 (extends existing file if one exists — check for a Phase 31 chip test first) |
| GLY-01 | Google Fonts loader validates against whitelist before injecting `<link>`; rejects unknown font names | unit | `npx vitest run __tests__/googleFontLoader.test.ts` | ❌ Wave 0 |
| GLY-01 | Game sandbox: duplicated embed-code validator rejects the same banned constructs as `apps/web/lib/game-validator.ts` (parity test) | unit | `npx vitest run __tests__/galleyGameValidator.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single changed test file (quick run command per row above)
- **Per wave merge:** `cd apps/dispatch-control && npx vitest run`
- **Phase gate:** full dispatch-control vitest suite green, plus `pnpm --filter dispatch-control build` (strict build — per the standing project rule that vitest alone doesn't catch type errors that only fail on `next build`) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/spanResolver.test.ts` — covers GLY-02 (resolver algorithm, all disambiguation/normalization cases above)
- [ ] `apps/dispatch-control/__tests__/sectionIdMap.test.ts` — covers GLY-01/GLY-02 (QA sectionName ↔ galley section id bidirectional mapping)
- [ ] `apps/dispatch-control/__tests__/Galley.test.tsx` — covers GLY-01 (renders all sections + game sandbox from a fixture draft)
- [ ] `apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx` — covers GLY-02 / D-09
- [ ] `apps/dispatch-control/__tests__/SectionChipList.test.tsx` (extend if a Phase 31 file already exists — check first) — covers GLY-05
- [ ] `apps/dispatch-control/__tests__/googleFontLoader.test.ts` — covers D-04 font-flavor loading + whitelist security
- [ ] `apps/dispatch-control/__tests__/galleyGameValidator.test.ts` — covers D-05 sandbox parity with `apps/web/lib/game-validator.ts`
- [ ] Framework install: `npm install @portabletext/react@^6.2.0 --workspace=apps/dispatch-control` (or the monorepo's equivalent workspace-add command — confirm against existing `package.json`/lockfile conventions before running)

## Sources

### Primary (HIGH confidence — code-verified in this repo)
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` (L780-792) — `GET /issues/{run_id}/draft` route, confirms it's a thin wrapper over `get_issue_draft()`, no audit row
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` (L576-618) — `_DRAFT_GROQ` query text (no asset dereference) and `get_issue_draft()` return shape
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` (L184-207) — `pt_to_blocks()`, the exact flattening logic that produces `lossy` and confirms blocks are single-joined-string per row
- `apps/dispatch-control/lib/contentPatchClient.ts` (L148-174) — `DraftResponse`/`DraftSection`/`ContentBlock` TS types, confirms the client-side shape matches the Python return
- `convex/schema.ts` (L70-98) — `qaCorrections` table definition, exact optional/required fields
- `convex/qaCorrections.ts` — confirms only `byRunId` (no `by_runId_and_section` query function exists despite the index)
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` (L38-217) — `_extract_sections()` (flattening + section-name vocabulary), `qa()` (Convex write loop, where `blockIndexHint` would be added)
- `apps/studio/schemas/weeklyIssue.ts` — full field inventory for every section (podcast, bonus variants, game, theme, selectionDeliberation.conversation)
- `apps/web/lib/sanity/queries.ts` (L63-90, L223-250) — confirms `asset->url` dereference pattern used elsewhere for the SAME fields the draft-read omits
- `apps/web/lib/theme.ts` — `FONT_WHITELIST`, `validateHex`, `validateFont`, `applyTheme` (setProperty-only pattern) to duplicate
- `apps/web/app/layout.tsx` — confirms only 3 of 9 whitelisted fonts are next/font-preloaded; repo-wide grep confirms zero `fonts.googleapis`/`fonts.gstatic` `<link>` tags anywhere
- `apps/web/components/issue/PortableTextRenderer.tsx` — confirms `@portabletext/react` v6 API usage pattern (block/marks component maps) already proven in this codebase
- `apps/web/components/issue/GameSlot.tsx` + `apps/web/lib/game-validator.ts` (131 lines) — sandbox iframe pattern + validator to duplicate
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` + `_components/SectionChipList.tsx` — current screen composition, `EDITABLE_SECTIONS` id list, dirty-state handling to preserve
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx` — the exact iframe component reused per D-02
- `apps/dispatch-control/vitest.config.ts` — test environment/glob conventions
- `apps/dispatch-control/package.json` — confirms `@portabletext/react` NOT yet a dependency; `convex ^1.38.0`, `next ^15.3.9`, `react ^19.2.6`, `vitest ^3.2.0` currently pinned
- `npm view @portabletext/react version` / `npm view @portabletext/toolkit version` (live registry check, 2026-07-07) — confirms `6.2.0` / `5.0.2` current, matching the existing `apps/web` pin exactly (no drift)

### Secondary (MEDIUM confidence)
None used — all findings above were verifiable directly against this repository or the live npm registry, so no unverified web-search claims were needed for this phase's core recommendations.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@portabletext/react` version and API confirmed both via live npm registry and existing in-repo usage
- Architecture: HIGH — the synthetic-block/markDef-injection design is derived directly from the actual (flattened) draft-read shape, code-verified, not assumed from PT docs
- Pitfalls: HIGH — all five pitfalls (lossy blocks, section-id mismatch, hint drift, missing font-loading mechanism, normalization scope) are confirmed by reading the actual producing code, not inferred

**Research date:** 2026-07-07
**Valid until:** 30 days (stable internal-codebase research; re-verify if Phase 31/§31.7 contract or the QA agent's section extraction changes before this phase executes)
