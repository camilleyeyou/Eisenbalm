---
phase: 31-content-patch-endpoints-full-editing
plan: 05
type: execute
wave: 3
depends_on: [4]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/TurnListEditor.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StructuredFieldEditor.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AssetUploadSlot.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/__tests__/review-desk-editors.test.tsx
autonomous: true
requirements: [EDT-01, EDT-02, EDT-03]
user_setup: []

must_haves:
  truths:
    - "The long-read block editor supports edit-text, change-type, add, delete, and up/down reorder (D-06)"
    - "The turn-list editor edits deliberation {speaker,text} turns; textareas edit podcast transcript and jingle lyrics (D-04)"
    - "Structured-field editors edit headline/theme/game/PDF fields; theme font is a whitelist dropdown; save round-trips via contentPatchClient"
    - "Asset upload slots upload inline with overwrite confirmation and post-upload preview (D-11/D-12/D-13)"
    - "Each section has explicit Save with a dirty indicator + unsaved-changes nav warning; a 409 revision_mismatch prompts reload (D-07/D-10)"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx"
      provides: "long-read block-row editor (D-06)"
      contains: "reorder"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AssetUploadSlot.tsx"
      provides: "inline upload + confirm-overwrite + preview (D-11/12/13)"
      contains: "uploadAsset"
    - path: "apps/dispatch-control/__tests__/review-desk-editors.test.tsx"
      provides: "editor unit tests (block ops, dirty state, save wiring)"
      contains: "BlockEditor"
  key_links:
    - from: "SectionEditorPanel.tsx save handlers"
      to: "lib/contentPatchClient (patchSection/patchTheme/uploadAsset)"
      via: "explicit Save button with ifRevisionID from loaded draft"
      pattern: "patchSection|patchTheme|uploadAsset"
    - from: "SectionEditorPanel 409 handling"
      to: "reload-and-reapply prompt"
      via: "ContentPatchError.reason === 'revision_mismatch'"
      pattern: "revision_mismatch"
---

<objective>
Build the per-section editors and wire them to Plan 04's client behind the section-chip list: a full-featured long-read `BlockEditor` (D-06 block ops), a `TurnListEditor` for the deliberation conversation, textarea editors for transcript/lyrics (D-04), `StructuredFieldEditor` for headline/theme/game/PDF fields (EDT-02, with a whitelist font dropdown), and an `AssetUploadSlot` with overwrite-confirm + inline preview (EDT-03, D-11/12/13). A `SectionEditorPanel` dispatches by selected section and owns the explicit-save / dirty-state / unsaved-nav-warning / 409-reload harness (D-07/D-10). Re-point the Awaiting-you inbox to `/review-desk/[runId]`. Close with the strict build gate.

Purpose: Complete the operator-facing editing surface — the console can now edit every prose + structured field and upload every asset, entirely through the pipeline API.
Output: 5 editor components + dispatcher panel + [runId] page wiring + inbox re-point + editor tests + green build.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md
@.planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- From Plan 04 (contentPatchClient.ts): -->
patchSection(runId, section, {ifRevisionID, blocks}, token) -> {revisionId, warnings}
patchHeadline / patchTheme / patchGame / patchPdfDataPoints / patchBonus /
patchDeliberationConversation / patchPodcastTranscript(...)
getDraft(runId, token) -> { revisionId, sections:{<name>:{headline,blocks,lossy}}, theme, game, bonus, bonusType, podcast, conversation }
uploadAsset(runId, slot, file: Blob, {filename, contentType, ifRevisionID}, token) -> {assetUrl, assetId, revisionId}
class ContentPatchError extends Error { status; reason }   // reason: 'revision_mismatch' | 'validation_failed' | ...

<!-- Block row shape (matches BodyBlock): { type: 'paragraph'|'h2'|'h3'|'blockquote', text: string } -->
<!-- Canonical font whitelist for the theme dropdown (apps/web/lib/theme.ts FONT_WHITELIST — 9): -->
['Playfair Display','Lora','Inter','Cormorant Garamond','Merriweather','DM Serif Display','Fraunces','Newsreader','IBM Plex Mono']

<!-- Awaiting-you inbox routing (Phase 30 CHR-04 / D-11): re-point awaiting-review items to /review-desk/[runId]. Locate the inbox route mapping in lib/nav.ts or the masthead inbox component. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: BlockEditor (D-06 full block ops) + TurnListEditor + textarea editors</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/TurnListEditor.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (Plan 04 — the parent + getDraft data shape)
    - .planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md (D-04, D-06 exact requirements)
    - docs/design/dispatch-control-v2/Dispatch Control.dc.html (1c tokens/type for the editor surfaces)
  </read_first>
  <action>
Create three presentational client components (state lifted to `SectionEditorPanel` in Task 3, or local with `onChange` callbacks — pick the onChange-callback pattern so the panel owns dirty state):

**`BlockEditor.tsx`** — props `{ blocks: Block[]; lossy?: boolean; onChange: (blocks: Block[]) => void }`. For each block row: a `<textarea>` for `text`, a type `<select>` with options `paragraph | h2 | h3 | blockquote` (D-06 change-type), and row controls: **Add** (insert paragraph below), **Delete**, **Move up**, **Move down** (D-06 reorder via up/down buttons — NO drag library). All controls ≥44px, keyboard accessible. When `lossy` is true, render a visible banner: "This section had rich formatting that the block editor can't fully represent — saving will flatten it." (surfacing the pt_to_blocks lossy flag from §31.7, not silent).

**`TurnListEditor.tsx`** — props `{ turns: {speaker,text}[]; onChange }`. Row = speaker `<input>` + text `<textarea>`, with Add/Delete/Move up/down. (D-04 deliberation conversation.)

**Textarea editors** — a small `<PlainTextEditor label value onChange rows>` reused for podcast transcript and jingle lyrics (D-04). May live inside SectionEditorPanel; keep it trivial.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- --run review-desk-editors 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `BlockEditor.tsx` exists and supports all 5 ops: `grep -qi "delete" ...BlockEditor.tsx`, `grep -qi "move\|reorder\|up\|down" ...BlockEditor.tsx`, a type `<select>` with `blockquote` option present
    - `BlockEditor` renders the lossy banner conditionally (`grep -qi "flatten\|lossy\|rich formatting" ...BlockEditor.tsx`)
    - `TurnListEditor.tsx` exists with speaker + text fields and add/delete/reorder
    - No drag-and-drop library imported (`grep -q "@dnd-kit\|react-beautiful-dnd" apps/dispatch-control/app/(dashboard)/review-desk` returns NO hits)
    - the editor test file asserts a block add/delete/reorder changes the emitted blocks array (test green)
  </acceptance_criteria>
  <done>BlockEditor supports edit/change-type/add/delete/up-down reorder with a lossy banner; TurnListEditor + textarea editors cover the remaining prose surfaces; no drag library; editor tests green.</done>
</task>

<task type="auto">
  <name>Task 2: StructuredFieldEditor (headline/theme/game/PDF) + AssetUploadSlot (upload+confirm+preview)</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StructuredFieldEditor.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AssetUploadSlot.tsx</files>
  <read_first>
    - .planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md (Field Inventory — every structured field path + editor type; theme font = whitelist dropdown NOT free text)
    - .planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md (D-05 bonus variants, D-08 hard-validation surfaces, D-11/12/13 asset UX)
    - apps/dispatch-control/lib/contentPatchClient.ts (Plan 04 — uploadAsset signature, patchTheme/patchGame)
    - apps/web/lib/theme.ts (FONT_WHITELIST — the 9 dropdown options)
  </read_first>
  <action>
**`StructuredFieldEditor.tsx`** — a variant-driven form covering EDT-02:
- Headline: text input (per section).
- Theme: 4 hex `<input>`s (with a color swatch preview), `fontDisplay`/`fontBody` as `<select>` dropdowns constrained to the 9-font whitelist (D-08 — dropdowns prevent invalid submissions client-side; the server still HARD-validates), `visualDirection` textarea. Show inline field errors when the server returns `validation_failed` with `fields[]`.
- Game: `headline`, `description` inputs + `embedCode` textarea with a live byte-count and a red state when > 50000 bytes (mirrors the server cap).
- PDF data points: `problemStatement` textarea, exactly 3 fixed `{stat,source}` rows (NO add/remove — schema `Rule.length(3)`), `interventionMechanism` textarea.
- Bonus (D-05): switch on the draft's top-level `bonusType` field (returned by getDraft, §31.7) — specAd -> render `BlockEditor`; bigBudget -> per-storyboard structured fields + an `AssetUploadSlot slot={`storyboard-${i}`} kind="image"` per storyboard; jingle -> lyrics textarea + `sunoPrompt` textarea + an `AssetUploadSlot slot="suno-audio" kind="audio"` (this slot saves a plain CDN URL into `bonus.sunoAudioUrl` server-side — §31.6 exception; the preview still plays from the returned assetUrl).

**`AssetUploadSlot.tsx`** (D-11/12/13) — props `{ runId, slot, currentAssetUrl?, kind: 'audio'|'image', ifRevisionID, onUploaded }`:
- File `<input type="file">` (accept audio/* or image/*).
- On select, if `currentAssetUrl` exists -> show a confirm dialog ("Replace the existing asset? The current file stays in Sanity but this slot will point to the new one." — D-12) BEFORE calling `uploadAsset`.
- Call `uploadAsset(runId, slot, file, {filename, contentType, ifRevisionID}, token)` (raw binary via the client).
- After success, render inline preview from the returned CDN `assetUrl`: native `<audio controls src>` for audio, `<img>` thumbnail for images (D-13). Call `onUploaded(result)` so the panel refreshes the revision id.
- Show upload errors (incl. `revision_mismatch`) inline.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `StructuredFieldEditor.tsx` renders theme font as `<select>` options from the 9-font whitelist (`grep -q "Fraunces" ...StructuredFieldEditor.tsx` and it is inside a select/option, not a free text input)
    - game embed shows a byte-count/over-cap state referencing 50000 (`grep -q "50000\|50 KB\|50KB" ...StructuredFieldEditor.tsx`)
    - PDF data points render exactly 3 fixed rows with no add/remove control
    - bonus editor branches on variant (specAd/bigBudget/jingle) — `grep -qi "specAd\|bigBudget\|jingle" ...StructuredFieldEditor.tsx`
    - `AssetUploadSlot.tsx` calls `uploadAsset`, gates overwrite behind a confirm, and renders `<audio` or `<img` preview from `assetUrl` (`grep -q "uploadAsset" ...AssetUploadSlot.tsx`, `grep -qi "replace\|confirm\|overwrite" ...AssetUploadSlot.tsx`, `grep -q "<audio" ...AssetUploadSlot.tsx`)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Every structured field (headline/theme/game/PDF/bonus variants) is editable with client-side guards mirroring the server, and asset slots upload inline with overwrite-confirm + CDN preview; the app builds.</done>
</task>

<task type="auto">
  <name>Task 3: SectionEditorPanel dispatch + save/dirty/unsaved-nav/409 harness + inbox re-point + build gate</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx, apps/dispatch-control/lib/nav.ts, apps/dispatch-control/__tests__/review-desk-editors.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (Plan 04 shell — wire the panel into the right pane)
    - apps/dispatch-control/lib/contentPatchClient.ts (all patch fns + ContentPatchError)
    - apps/dispatch-control/lib/nav.ts (and/or the masthead Awaiting-you inbox component — locate awaiting-review routing to re-point, Phase 30 CHR-04/D-11)
    - .planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md (D-07 explicit save + dirty + unsaved warning; D-10 revision guard reload)
  </read_first>
  <action>
**(A)** Create `SectionEditorPanel.tsx` — given `selectedSection` + the loaded draft, dispatch to the right editor (BlockEditor for the 4 long-reads, StructuredFieldEditor for theme/game/headline/PDF, TurnListEditor for deliberation, textareas for transcript/lyrics, AssetUploadSlot for asset fields). The PODCAST section editor renders BOTH the transcript textarea AND `<AssetUploadSlot slot="podcast-audio" kind="audio" ...>` (D-11 — upload control inline in the owning section's editor, with the D-13 `<audio>` preview after upload). Own the save harness (D-07/D-10):
- Local working copy + `dirty` boolean per section (compare to loaded value).
- An explicit **Save** button (disabled when not dirty); on click call the matching `contentPatchClient` fn with `ifRevisionID = currentRevisionId`.
- On success: update `currentRevisionId` from the response, clear dirty, surface any returned `warnings` (structural floor) as a non-blocking notice.
- On `ContentPatchError` with `reason === 'revision_mismatch'` (D-10): show a reload-and-reapply prompt (button re-runs `getDraft` and re-seeds the editor, warning the operator their unsaved edits will be replaced). On `reason === 'validation_failed'`: surface `fields[]` inline.
- Wire `dirty` back up to `SectionChipList` (unsaved-dot).
- Unsaved-changes nav warning: a `beforeunload` handler + intercept in-app nav (the section-chip `onSelect`) when dirty — confirm before switching.

**(B)** Wire `SectionEditorPanel` into `review-desk/[runId]/page.tsx`'s right pane; pass `currentRevisionId`, `selectedSection`, `dirty` map to `SectionChipList`.

**(C)** Re-point the Awaiting-you inbox (Phase 30 CHR-04/D-11): awaiting-review run items now route to `/review-desk/[runId]` (previously the Phase 26 review page or a placeholder). Locate the mapping (lib/nav.ts or the inbox component) and update the awaiting-review target only — do NOT change other inbox item routes.

**(D)** Extend `apps/dispatch-control/__tests__/review-desk-editors.test.tsx` with: a dirty-state test (editing marks dirty, Save clears it via a mocked patch fn) and a 409 test (a mocked `patchSection` throwing `ContentPatchError('revision_mismatch')` triggers the reload prompt).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- --run review-desk-editors 2>&1 | tail -8 && cd apps/dispatch-control && pnpm build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `SectionEditorPanel.tsx` dispatches to BlockEditor/TurnListEditor/StructuredFieldEditor/AssetUploadSlot by selected section
    - explicit Save calls the matching contentPatchClient fn with `ifRevisionID` and is disabled when not dirty (`grep -qi "dirty" ...SectionEditorPanel.tsx`, `grep -q "ifRevisionID\|revisionId" ...SectionEditorPanel.tsx`)
    - `revision_mismatch` handling triggers a reload path (`grep -q "revision_mismatch" ...SectionEditorPanel.tsx`)
    - an unsaved-changes guard exists (`grep -qi "beforeunload\|unsaved" ...SectionEditorPanel.tsx`)
    - the Awaiting-you inbox awaiting-review target is `/review-desk/` (`grep -rq "/review-desk/" apps/dispatch-control/lib/nav.ts apps/dispatch-control/components 2>/dev/null` or the located inbox file)
    - the podcast editor instantiates the audio upload slot: `grep -rq 'slot="podcast-audio"' "apps/dispatch-control/app/(dashboard)/review-desk"` returns >= 1 match
    - the dirty-state + 409 editor tests pass
    - `pnpm --filter dispatch-control build` exits 0 AND `pnpm --filter dispatch-control test -- --run` passes (incl. the EDT-05 tripwire from Plan 04)
  </acceptance_criteria>
  <done>The panel dispatches to every editor, enforces explicit-save with dirty state + unsaved-nav guard + 409 reload, the inbox routes awaiting-review to /review-desk/[runId], and both the strict build and the full vitest suite (incl. EDT-05 tripwire) are green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run` — editor tests + EDT-05 tripwire green
- `pnpm --filter dispatch-control build` — exits 0 (strict build required before frontend phase done — Phase 27 latent-bug memory)
- Manual (documented in SUMMARY): edit a section + save against a real Sanity dataset, confirm the change lands + audit row appears; upload a podcast audio + confirm inline playback
</verification>

<success_criteria>
- All prose surfaces editable (block editor + turn list + textareas); all structured fields editable; all asset slots upload with confirm + preview
- Explicit save + dirty state + unsaved-nav warning + 409 revision reload all wired via contentPatchClient
- Awaiting-you inbox routes awaiting-review to /review-desk/[runId]
- Strict dispatch-control build + full vitest suite (incl. EDT-05) green
</success_criteria>

<output>
After completion, create `.planning/phases/31-content-patch-endpoints-full-editing/31-05-SUMMARY.md`
</output>
