---
phase: 51
slug: section-read-and-fix-in-place
status: draft
shadcn_initialized: true
preset: default / neutral (apps/dispatch-control/components.json — pre-existing, not (re)initialized this phase)
created: 2026-07-31
---

# Phase 51 — UI Design Contract

> Visual and interaction contract for `/s/[section]` — an editor reads one section of the current issue as full-width prose and fixes a factual, voice, or unsourced-claim problem without leaving the paragraph.

> **Read this first:** this phase is 90% composition, 10% new surface. The 1c design system (Phase 30) and the galley/annotation/finding system (Phases 32/33/35/36/41/42/44/45) are locked and are **not** redesigned here. This contract exists to specify the handful of genuinely new things — the reading-surface layout, the Fact/Voice/Source tag, the recurring-correction group-accept UI, the in-place block editor, and every new string of copy — and to pin down how they compose with what already ships. Every value below traces to a `.planning/phases/51-section-read-and-fix-in-place/51-CONTEXT.md` decision (cited as `D-XX`) or is marked `(new, this phase)`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `apps/dispatch-control/components.json` present; not re-run this phase) |
| Preset | style: `default`, baseColor: `neutral`, cssVariables: `true` — pre-existing project preset |
| Component library | Radix primitives (`@radix-ui/react-switch`) + hand-rolled 1c components. The galley/annotation/finding system this phase reuses (`Galley`, `AnnotationMark`, `ClaimMark`, `GallerySection`, `PassageToolbar`, `ClaimProvenanceCard`, `UnresolvedFindingCard`) is **not** shadcn — it is bespoke, token-driven markup. No shadcn UI blocks are introduced by this phase. |
| Icon library | `lucide-react` (project dependency; not used by the galley system today). This phase needs **zero new icons** — the existing convention in this exact code area is plain-text labels and unicode glyphs (`✓ ✕ ○ △ ⟳` in `ClaimProvenanceCard`, `←`/`→` for prev/next per the pattern below), and D-07 requires a *text* label, not an icon. Do not introduce lucide icons into the galley/annotation surfaces. |
| Font | Newsreader (`--font-display`), Lora (`--font-body`/`--font-lora`), Space Grotesk (`--font-ui`), IBM Plex Mono (`--font-mono`) — all wired via `next/font/google` in `app/layout.tsx`. No new font. |

---

## Spacing Scale

Declared values (must be multiples of 4) — applies to every **new** element this phase introduces (slim header, Fact/Voice/Source tag, prev/next nav block, in-place editor chrome, group-accept row). Reused components keep their existing (pre-1c-audit) inline spacing unchanged.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tag-to-span gap, icon/glyph gaps |
| sm | 8px | Compact element spacing (button gaps, dirty-dot offset) |
| md | 16px | Default element spacing (between prose paragraphs and adjacent chrome) |
| lg | 24px | Reading-column horizontal padding at narrow widths; section-to-nav gap |
| xl | 32px | Slim header to prose gap; prose to end-of-section nav-block gap |
| 2xl | 48px | Section-to-section vertical rhythm (unchanged, inherited from `.galley-section`) |
| 3xl | 64px | Not used this phase |

Exceptions:
- **44px minimum touch target** on every interactive control (buttons, the Fact/Voice/Source tag if it becomes clickable, textarea focus target, prev/next links) — carries forward the project-wide convention already enforced in `AnnotationMark`, `ClaimMark`, `UnresolvedFindingCard`, and `BlockEditor` (`minHeight: 44`). Non-negotiable; do not shrink for density.
- **760px reading measure** (D-04) is a layout dimension, not a spacing token — see Layout Contract below.

---

## Typography

Exactly 4 sizes, exactly 2 weights, spanning both the **reused** galley type scale (unchanged, D-04 forbids touching it) and the **new** scoped reading type this phase adds.

| Role | Size | Weight | Line Height | Source |
|------|------|--------|-------------|--------|
| Display (section prose headline) | `clamp(30px, 4vw, 52px)` | 400 | 0.98 | Reused verbatim — `.galley-headline` (Newsreader). **Unchanged.** Renders the section name as the prose headline per D-05. |
| Heading (in-prose H2/H3) | 28px desktop / `clamp(20px, 3cqi, 26px)` in a containered context | 400 | ~1.2 (browser default) | Reused verbatim — `.galley-h2` (Newsreader). **Unchanged.** |
| Body (reading prose) | **17.5px** | 400 | 1.7 | **New, scoped** (D-04). Lora. Scope it under a new wrapper class, e.g. `.section-reader .galley-body { font-size: 17.5px; }` — **never edit `.galley-body` itself** (stays 16.5px/1.7 globally so Review Desk and Voice Pass are untouched). Line-height stays 1.7 to match the established Lora reading rhythm — only the size changes. |
| Label (UI chrome: tags, buttons, nav, header) | **11px** | 600 | 1 | **New for this phase's additions**, but pixel-matched to the *existing* `actionButtonStyle` convention already shipping in `AnnotationMark`/`ClaimMark`/`UnresolvedFindingCard` (`fontSize: 11, fontWeight: 600`). Space Grotesk. Two case treatments, same size/weight (see below) — this is a styling detail, not a new size. |

**Label-role case treatments (both 11px/600):**
- **Uppercase, tracked** (`letter-spacing: .04em`) — Accept suggestion / Edit myself / Dismiss / Save / Cancel / prev-next nav buttons / the Fact-Voice-Source tag text (rendered uppercase via CSS `text-transform: uppercase`, but the DOM text itself stays sentence-case `Fact`/`Voice`/`Source` so screen readers announce a word, not letter-spaced shouting).
- **Normal case, no tracking** — the slim header's issue-title link only (a real magazine title reads wrong in tracked caps).

**Scroll-margin override (D-04):** the shared `[id^='galley-'] { scroll-margin-top: 88px }` rule was tuned for the v4 sticky stage-tab nav, which this surface does not have (D-05: header is not sticky). Add a scoped override — `.section-reader [id^='galley-'] { scroll-margin-top: 16px }` — do not edit the shared rule (Review Desk / Voice Pass still need 88px).

---

## Color

Reuses the shipped 1c palette (`docs/design/dispatch-control-v3/README.md` "Color semantics" table) wholesale. No new colors are introduced.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-paper` `#e9eaec` (= `--background`) | Page/reading-surface background — reused from `.galley-root { background: var(--background) }`, unchanged. |
| Secondary (30%) | `--color-card` `#ffffff`, with `--color-card-alt` `#fbfaf6` as the hover/alt state | Popover surfaces, the in-place editor's textarea, all buttons — reused verbatim from every existing galley action element. |
| Accent (10%) | `--color-cobalt` `#253ad4` | **Reserved for:** the slim header's "back to issue" link (default + hover), the pullquote left border (existing, unchanged), and any "Inspect" / provenance-adjacent affordance already using cobalt. **Do not** use cobalt for the Fact/Voice/Source tag — see rationale below. |
| Destructive | `--color-vermilion` `#e8471d` | Dismiss action, error-severity underline/wash (existing), unsourced-claim wash (existing), and the numeric "still need you" count in the group-accept partial-failure sentence (D-13) — text color only, the sentence itself always carries the words too (never color alone). |

**Fact/Voice/Source tag color rule (D-07, decided this phase):** the tag renders in **`--color-ink-soft`** (`#55514a`) regardless of axis. It is deliberately **not** color-coded per kind. Rationale: `data-severity` (error/warning/info → vermilion/marigold/cobalt underline) is already the color-bearing signal on every mark; layering a *second*, independently-colored axis-based system on the same span would imply a second severity scale that doesn't exist and would visually compete with it. The tag's job (READ-02, D-07) is to be **readable as a word without opening the popover** — a quiet, uniform ink-soft label does that without inventing a color collision. This also means the label is never the *sole* carrier of anything — severity still carries color, the tag still carries text — satisfying "distinguishable by label as well as colour, never colour alone" from both directions.

**Focus ring:** `2px solid var(--color-ink)` on every new interactive element (matches `.galley-anno:focus-visible` / `.galley-claim:focus-visible` exactly — do not introduce a cobalt or other-color focus ring here).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (per-finding) | **"Accept suggestion"** — the D-08 neutral vocabulary, supplied via `Galley`'s existing `labels` prop: `{ accept: 'Accept suggestion', editInline: 'Edit myself', dismiss: 'Dismiss' }`. Leave `dismissReasonDefault` **unset** on this surface (a single fixed default reason can't fit both factual and voice findings meaningfully — see Interaction Contract). |
| Primary CTA (recurring correction, D-04/D-11/D-12) | **"Accept suggestion (applies to N places)"** when a finding is part of a group of 2+. Clicking it is the one action — no separate confirmation dialog (Claude's Discretion, decided: the count-in-label already discloses scope; a second modal would violate D-04's "one action" and this surface's low-chrome premise). |
| Empty state — Not generated | **"— Not generated. The {section label} will appear here once the agents write it."** Byte-identical to the existing WSP-07 `NotGeneratedBlock` copy (`components/galley/Galley.tsx`) — D-21 requires lockstep, do not reword. |
| Empty state — Clean (open findings = 0, section is one of the five annotated ones) | **"No open findings in this section."** New copy (D-21 requires an *explicit* line, never inferred from absence of marks). Renders once, at the end of the prose, immediately before the prev/next nav block. |
| Empty state — Structurally exempt sections (D-14) | Template: **"{plain description of what this is} — it carries no inline findings to review here."** See exact fills in the Navigation & Section States Contract below. |
| Loading state | No visible copy (skeleton render, D-21) — but give the skeleton container `aria-busy="true"` and a visually-hidden `aria-label="Loading section…"` so it doesn't read as a silent blank page to assistive tech. |
| Error state — accept-fix 409 (existing, reused verbatim) | **"Draft changed — re-open this finding and retry."** (`AnnotationMark`'s existing copy — unchanged.) |
| Error state — in-place edit save 409 (new, D-19) | **"This passage changed since you started editing — reload and try again."** Same tone/length as the existing accept-fix message; names the problem and the one recovery action, satisfying D-19's "obvious owner, obvious retry." |
| Destructive confirmation — Dismiss (existing, reused verbatim) | Prompt: **"Why dismiss this finding?"** Confirm button: **"Confirm dismiss"** — one-line reason required before the button enables (existing mechanic, D-06 does not change it). |
| Group-accept partial failure (D-13, locked pattern) | **"{X} of {Y} applied — {Z} still need you."** e.g. "3 of 5 applied — 2 still need you." Failed findings stay marked and openable; no rollback, no stop-at-first-failure. |
| In-place editor actions (D-18/D-19, new) | **"Save"** / **"Cancel"**. Dirty-state indicator: a small dot next to the block (reuses the existing `dirty`-dot visual vocabulary already defined in `SectionChipList.tsx`, not a new pattern) — visible the moment the textarea value differs from the original. |
| Prev/Next navigation (D-15, new) | **"← {previous section label}"** / **"{next section label} →"** — always names the destination (e.g. "← Origin Story", "Problem →"), never a bare "Previous"/"Next". First section: render only the Next control. Last section: render only the Previous control. Never a disabled/greyed placeholder, never wrap silently (D-15). |
| "Still need you" count (READ-08, D-16, new) | N > 0: **"{N} of 9 sections still need you."** N = 0: **"All 9 sections are clean — nothing needs you."** Placed at the end-of-prose nav block, alongside prev/next (see Layout Contract — placement rationale). |
| Slim header (D-05, new) | The issue's real derived title, rendered as a plain link, **not** shouty caps: e.g. *"← {Issue Title}"*. See Interaction Contract for link target. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new — this phase reuses only hand-rolled 1c components (`Galley`, `AnnotationMark`, `ClaimMark`, `GallerySection`, `PassageToolbar`, `ClaimProvenanceCard`, `UnresolvedFindingCard`) and the existing `components/ui/switch.tsx` primitive is not touched | not required |

No third-party registries declared. No vetting gate needed.

---

## Layout Contract

- **Reading column:** `max-width: 760px; margin-inline: auto; padding-inline: 24px` (spacing token `lg`) at every viewport — a simple max-width + padding approach, not a container-query reflow (unlike Voice Pass's two-column rail, there is nothing to reflow here: no side content exists at any width, per READ-01's "no side rails"). Claude's Discretion resolved: no separate mobile breakpoint value needed; 24px padding is already comfortable down to ~360px viewports.
- **Chrome:** one slim header (D-05) — issue title link only, `32px` (token `xl`) below it before the prose headline starts. **Not sticky** — it scrolls away with the page. Nothing else above the prose: no rails, no tabs, no stage nav, no form fields, no `AppSidebar`, no `Masthead` (D-01).
- **Route group:** `app/(editorial)/s/[section]/` with its own minimal layout, sibling-ready for Phases 52/54. `app/(dashboard)/` stays byte-unchanged (D-01).
- **End-of-prose nav block:** appears once, after the last paragraph (and after the Clean-state "No open findings" line, when applicable). Contains, top to bottom or left-to-right (executor's call within the 44px-target/spacing-scale rules above): the "still need you" sentence, then Previous/Next.

---

## Fact / Voice / Source Tag Contract (READ-02, D-07)

A small, always-visible, uppercase 11px/600 ink-soft text tag sits adjacent to every marked span — readable without opening the popover. Implemented as an **additive** change to `AnnotationMark` (for QA findings) and `ClaimMark` (for unsourced claims), not a new component.

| Finding source | Axis value | Tag text |
|---|---|---|
| QA finding | `axis` ∈ `FACTUAL_AXES` (`precision`, `cross-section-consistency`, `structural-variety`, `hard-rule`) | **Fact** |
| QA finding | `axis` ∈ `VOICE_AXES` (`gravity`, `sentiment`, `irony-signaling`, `machine-tell`) | **Voice** |
| QA finding | `axis` is `undefined` (legacy row) | **Fact** — conservative default, matching the existing `axisPartition.ts` convention that an axis-less row counts as factual for gating purposes. Never a blank or third catch-all label. |
| Claim mark | `provenance === 'unsourced'` | **Source** |
| Claim mark | `provenance === 'sourced'` | *(no tag — sourced/checked claims render as plain prose per D-09; only unsourced claims are marked at all)* |

---

## Recurring Correction / Group-Accept Contract (READ-04, D-10 – D-13)

- A "group" = same `axis` + byte-identical `suggestedFix`, computed client-side as a derived selector over the findings already loaded for the section (no new query, no stored grouping state).
- The popover's Accept action shows the group-aware CTA copy above when the group size is ≥ 2, plain "Accept suggestion" when it is 1.
- Execution is **sequential**: accept → `reloadDraft()` → re-resolve spans → accept the next member with the freshly-returned `revisionId`. Never fire the group in parallel against one `revisionId` (would 409 most of the group against the Phase 33 D-06 guard).
- **Progress affordance while a group is running:** disable the CTA and show inline progress text, e.g. "Applying 2 of 5…" — reusing the existing `busy`/spinner-free pattern already used for single accepts (no new loading component).
- **Partial failure** renders the exact D-13 sentence above; failed group members remain individually marked and individually openable — no batch retry control, the editor retries each remaining one normally.

---

## In-Place Editing Contract (READ-05, D-18/D-19)

- **Implementation: `<textarea>`, not `contenteditable`.** Matches the existing precedent in `app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx` (the only other free-text block editor in the codebase already uses a controlled `<textarea>`). Avoids `contenteditable`'s cross-browser selection/paste inconsistency and keeps the Save/Cancel dirty-state model trivial to implement correctly.
- **Text only.** No block-type change, no add/delete/reorder controls on this surface (D-18) — this is not `BlockEditor`'s full toolbar, just the one flagged block's text.
- **Entry points (both route to the same editor):** `AnnotationMark`'s "Edit myself" action, and `PassageToolbar`'s "Edit text" action (fires on any deliberate text selection, D-22). `Galley`'s existing required `onEditSection` prop is wired directly to this in-place editor — no deep-link to `SectionEditorPanel`/`BlockEditor`, no escape hatch into the old console mid-read (D-18).
- **Save:** patches the one block through the existing content-patch API with the same `ifRevisionID` guard already used elsewhere. Explicit button — no save-on-blur, no debounced autosave (D-19).
- **Cancel:** reverts to the original text, closes the editor, no network call.
- **Keyboard:** `Escape` = Cancel (matches `AnnotationMark`'s existing Escape-closes-popover convention exactly). `Cmd/Ctrl+Enter` = Save (standard textarea submit shortcut, additive to the Save button, not a replacement for it).
- **Dirty state:** visible the instant the textarea's value differs from the original — small dot, reusing `SectionChipList`'s existing dirty-dot visual vocabulary (no new indicator design).
- **409 conflict:** show the new copy above; the retry path is "reload the section, re-open the editor, re-type or re-apply the change" — same shape as the existing accept-fix 409 recovery, never a silent overwrite.

---

## Navigation & Section States Contract (READ-07/READ-08, D-14 – D-17)

All 9 `EDITABLE_SECTIONS` get a `/s/[section]` destination. Four of the nine are **structurally exempt** from inline findings (no QA `sectionName` mapping exists for them in `lib/galley/sectionIdMap.ts`, and/or their content isn't renderable prose) — each states this plainly rather than looking empty or broken (D-14):

| Section id | Render | Exempt copy (fills the template above) |
|---|---|---|
| `game` | Sandboxed iframe (`GalleryGameSlot`, existing) | "This section renders as an interactive game — it carries no inline findings to review here." |
| `podcast` | Audio player | "This section is an audio player — it carries no inline findings to review here." |
| `theme` | Color/font swatches | "This section sets the issue's color and font palette — it carries no inline findings to review here." |
| `deliberation-conversation` | The existing deliberation-as-conversation view | "This section shows the agents' deliberation as a conversation — it carries no inline findings to review here." |

> **Flagged gap, resolved this phase:** D-14's own decision text names only game/podcast/theme by example, but `deliberation-conversation` has no QA `sectionName` mapping either (`GALLEY_TO_QA` in `lib/galley/sectionIdMap.ts` covers only `origin_story`/`problem`/`founder_bio`/`case_study`/`game`/`bonus`) — it is structurally identical to the other three. Grouped with them here so no section is left silently unaddressed.

> **`bonus` is conditional, not exempt:** `Galley.tsx` only resolves findings for `bonusType === 'specAd'` (prose + inline findings, same treatment as the four long-read sections, including the Clean-state line). For `bonusType === 'jingle'` (audio), apply the same exempt template: "This week's bonus is an audio jingle — it carries no inline findings to review here." (Claude's Discretion — the CONTEXT.md deferred list flags bonus-variant rendering as undiscussed; resolved here from the existing `Galley.tsx` conditional rather than left ambiguous.)

- **Prev/Next** live at the end of the prose only (not in the header, not both) — order follows `EDITABLE_SECTIONS`, first/last degrade honestly (omit the missing side entirely).
- **READ-08 count** is `deriveSectionStates`'s `openCount > 0` tally across all 9 sections (D-16/D-17) — not must-fix-only, not a two-number split. `lib/derivedState.ts` is the single source of truth; Phase 52's table of contents reads the same selector. The required cleanup this phase must also make: promote `EDITABLE_SECTIONS`/`SectionMeta` out of `app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` into shared `lib/`, re-exported from the old path so Review Desk keeps compiling unchanged (D-17).

---

## Slim Header Link Target (D-05, resolved this phase)

D-05 requires the header link back to "the issue," but Phase 52 (which will own the editorial `/`) has not shipped, and D-01 explicitly forbids Phase 51 from adding a page at `/` in the new `(editorial)` group. **Decision: the header link points to `/`** (not `/run`, not any deeper operational route).

Rationale: today `/` (`app/(dashboard)/page.tsx`) redirects to `/run`, so the link is honest right now. The moment Phase 52 ships and claims `/` for the new editorial front door, this same link starts resolving correctly with **zero code change in Phase 51** — the forward-compatible, no-rework choice. Do not point the header link at `/run` directly (that would pin it to the old console permanently and require a Phase 52 follow-up edit) and never at any deeper operational surface (Run Details, Agent Instructions, Signal Desk, Finance, etc. — DOOR-03).

---

## Popover Evidence Rendering — Known Constraint (READ-03, D-20)

`ClaimProvenanceCard` mounts inside `AnnotationMark`'s popover when a finding links to a tracked claim. The popover is **phrasing content only** (it renders inside the galley's `<p>` elements) — spans with `display:block`, buttons, inputs; never a block-level container, never a nested `<p>`.

**Flagged, not resolved here (research item, carried from CONTEXT.md):** `ClaimProvenanceCard`'s current markup uses block-level `<div>`/`<p>` elements throughout (confirmed: `components/provenance/ClaimProvenanceCard.tsx` returns nested `<div>`s with `<p>` children). It needs a phrasing-safe render mode before it can legally mount inside `AnnotationMark`'s popover. The **visual target** for that mode is unchanged from today's card — same fields, same layout rhythm, same 1c token classes — only the element types change (`<div>`→`<span style={{display:'block'}}>`, `<p>`→`<span style={{display:'block'}}>`), mirroring the phrasing-safe pattern `AnnotationMark`'s own popover already uses for its action row.

---

## Composition Note — Voice-Tell Accept Trigger (D-08, flagged)

`AnnotationMark`'s on-demand-rewrite path (generate a `suggestedFix` via `voicePassClient.rewrite` when none is stored, Phase 36 VOX-02) is currently triggered by string-matching the label: `isRewriteVariant = labels?.accept === 'Accept rewrite'`. D-08 replaces that label with the single neutral "Accept suggestion" on this surface, so the trigger **must** be re-based onto something label-independent before this surface can ship voice-finding accepts correctly. Recommended shape (for planner/research, not decided as a visual matter): an explicit optional boolean, e.g. `generateFixOnAccept?: boolean`, threaded through `Galley` → `GallerySection` → `AnnotationMark`, set `true` whenever a finding's `axis` is in `VOICE_AXES` and it has no stored `suggestedFix` — never inferred from `labels`.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
