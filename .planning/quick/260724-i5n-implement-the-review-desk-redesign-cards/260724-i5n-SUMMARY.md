---
phase: quick-260724-i5n
plan: 01
subsystem: ui
tags: [dispatch-control, review-desk, draft-stage, galley, nextjs, vitest, tailwind]

# Dependency graph
requires:
  - phase: phase-32-native-galley-read-only-span-resolver
    provides: "The Galley component, span resolver (resolveSectionFindings), and axis partition (FACTUAL_AXES) this redesign reuses unmodified"
  - phase: phase-41-workspace-frame-outline-context-panel
    provides: "WorkspaceStateProvider (brief, useWorkspaceState) and the Issue Workspace frame ReviewDeskRunView mounts inside"
provides:
  - "StoryDeskGrid — the CARDS-variant Draft-stage landing: a 3-up grid of the 9 editable sections with status-colored top rules, chip/dot/word-count footers, and a 'N of 9 reviewed' progress header"
  - "StoryFocusView — per-story focus shell: crumbs, header actions (Mark reviewed / Edit story), folder Outline/Draft tabs, footer prev/next-unreviewed nav"
  - "StoryOutlineTab + deriveStoryOutline (storyOutline.ts) — a DERIVED outline (lede + h2 beats, word counts, block-position finding dots) plus a Brief/claims/open-findings side rail"
  - "Galley `sections?` whitelist prop — lets one section render via the SAME annotation/claim/provenance rendering, reused by the Draft tab instead of a forked renderer"
  - "useReviewedSections — localStorage-only 'Mark reviewed' nav aid, keyed by runId, changes no publish gate"
  - "ReviewDeskRunView rewired into a URL-driven (?story=&tab=) desk<->story orchestrator, including a hashchange-and-mount receiver that lands DecisionRail/WorkspaceOutline jump-nav on a story's Draft tab"
affects: [dispatch-control, review-desk, issues-draft-stage, voice-pass]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-scoped Galley reuse via an additive `sections?: ReadonlyArray<string>` whitelist prop — undefined renders everything (back-compat); every render branch gated on membership"
    - "URL-as-state for a two-level nav (desk grid <-> per-story focus) via useSearchParams()/router.push()/router.replace(), with a small buildHref() helper composing ?story=&tab="
    - "Pure derivation module (storyOutline.ts) with zero React/DOM imports, only type imports from the app's existing draft/span-resolver types — unit-testable in Node env"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyOutline.ts"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryDeskGrid.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryOutlineTab.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx"
    - "apps/dispatch-control/__tests__/storyOutline.test.ts"
  modified:
    - "apps/dispatch-control/components/galley/Galley.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"

key-decisions:
  - "Deliberation counts toward word count (not a 'Structured'/'Transcript' label) — the locked-decisions recap (LD-7) text listed deliberation alongside game/theme/podcast as structured, but the APPROVED mockup (02-story-desk-cards.html) literally shows '890 words' for the Deliberation card; followed the concrete mockup over the summary text since conversation turns are genuinely proseable, unlike a game embed or theme color fields"
  - "Retired the iframe preview toggle (Phase 31 D-02's 'Show preview'/PreviewIframe mount) — the plan's Task 2E action explicitly says to 'replace the viewMode galley/edit/iframe body' and its 'Keep' list enumerates draft-load/subscriptions/chipCounts/revise-panels/showProvenance but never PreviewIframe; PreviewIframe.tsx and the preview-url route are untouched (PreviewIframe.test.tsx still passes) but are no longer mounted from this page"
  - "'Next unreviewed' does not wrap around — first EDITABLE_SECTIONS entry strictly AFTER the current one that isn't reviewed; when none remain, the footer nav shows an honest 'All caught up — back to desk' link instead of wrapping to section 1"
  - "The 'QA pass 14:32' timestamp shown in the mockup's meta line was omitted (not fabricated) — no QA-pass-timestamp data source is wired into this plan's props; word count / must-fix / warning / reviewed status are shown instead"

patterns-established:
  - "New multi-section galley consumers add themselves to Galley's `sections` whitelist rather than forking GallerySection/annotation rendering"

requirements-completed: [QUICK-260724-i5n]

# Metrics
duration: ~50 min
completed: 2026-07-24
commits:
  - "ab3d242 feat(quick-260724-i5n): add pure outline derivation + reviewed-state hook"
  - "f71796f feat(quick-260724-i5n): replace Draft galley with Story Desk cards + focus view"
---

# Quick Task 260724-i5n: Review Desk redesign — cards

**One-liner:** Replaced the Draft stage's single scrolling all-sections galley with an approved CARDS-variant Story Desk (3-up card grid + per-story Outline/Draft focus view), reusing the existing Galley's annotation rendering for one section at a time via a new additive `sections` prop.

## What shipped

1. **`storyOutline.ts`** (pure, tested) — `deriveStoryOutline(blocks, resolved, unresolved)` splits a section's draft blocks into a lede (the run of blocks before the first `h2`) and one beat per `h2`, with per-beat word counts and severity dots placed by block-position. Plus `countWords`, `firstSentence`, `sectionWordCount`, `sectionExcerpt` helpers. 14 vitest cases (RED→GREEN via TDD), covering lede/beat splitting, dot placement for both resolved findings and hinted-unresolved findings, and edge cases (no `h2`, empty blocks).
2. **`useReviewedSections.ts`** — SSR-safe hook backed by `localStorage['reviewDesk:reviewed:<runId>']`; `{ reviewed, isReviewed, toggle, count }`. Purely a client nav aid — nothing downstream (Approval stage, DecisionRail, the server publish gate) ever reads this key.
3. **`Galley.tsx`** — added an additive `sections?: ReadonlyArray<string>` prop. Every render branch (4 long-reads, game, all 3 bonus variants, podcast, deliberation) is now gated on membership when the prop is set; `undefined` still renders everything (Voice Pass and any other full mount are unaffected).
4. **`StoryDeskGrid.tsx`** — the CARDS desk (mockup `02-story-desk-cards.html`): header with "N of 9 reviewed · X must fix · Y in review" + a progress meter, and a 3-up grid of the 9 `EDITABLE_SECTIONS`, each card showing kicker/numeral/headline/2-line excerpt/status chip/severity dots/word-count-or-Structured-or-Transcript, with a "✓ Reviewed" tick and status-colored top rule (green/vermilion/marigold/default-hover-cobalt).
5. **`StoryOutlineTab.tsx`** — the derived Outline tab (mockup `03`): lede+beat rows from `deriveStoryOutline` (numeral, title, lead sentence, word count, severity dots) plus a side rail (Brief central-claim/reader-effect/known-risks with an honest "No brief yet." fallback, sourced/unsourced claim counts, and an "Open findings · N" list with "Jump to line" links). Structured sections (no prose blocks) show an honest "This section has no prose outline — see the Draft tab." message instead of an empty outline.
6. **`StoryFocusView.tsx`** — the per-story shell (mockups `03`/`04`): crumbs (back-to-desk, "Story X of 9", prev/next steppers), header (kicker/headline/meta line, Mark reviewed + Edit story actions), folder Outline/Draft tabs (Draft carries the open-finding count badge), and footer prev + Next-unreviewed nav. The Draft tab's non-editing body mounts the SAME `<Galley sections={[sectionId]}>` every other surface uses (no fork); editing mounts the existing `SectionEditorPanel` unchanged; `theme` (which the galley never renders) shows an honest structured summary of its color/font fields plus "Edit story to change the theme."
7. **`ReviewDeskRunView.tsx`** rewired into the orchestrator: `?story=&tab=` URL state drives desk↔story; `useReviewedSections(runId)` supplies the reviewed set; a `hashchange`-and-mount listener replaces the old one-shot `#galley-<id>` scroll receiver so DecisionRail's/WorkspaceOutline's jump-nav lands on a story's Draft tab; the `?edit=<sectionId>[&finding=]` deep link now enters `?story=<id>&tab=draft` with local `editing=true`; dirty-editor guards (`useConfirm`) cover desk/story/tab navigation that would abandon unsaved `SectionEditorPanel` state. `chipCounts`/`findingsByGalleyId`/`bonusRows` were refactored into their own memos so the Outline tab's per-section `resolveSectionFindings` call reuses the exact same resolution the single-section galley lights (no drift between what a card's dots show and what opening it shows).

## Verification

- `storyOutline.test.ts`: 14/14 passing (TDD RED confirmed before implementation, then GREEN).
- Targeted suite (`Galley`, `SectionChipList`, `WorkspaceOutline`, `DraftNotGenerated`, `review-desk-editors`, `sectionIdMap`, `storyOutline`): 84/84 passing.
- Full `pnpm --filter dispatch-control test`: 137 test files passed, 1 skipped (pre-existing), 1101 tests passed, 2 todo (pre-existing) — zero regressions.
- `pnpm --filter dispatch-control build`: strict Next.js production build compiles, type-checks, and lints clean; all 12 routes (including `/issues/[issueNumber]/draft`) generate successfully.
- `pnpm --filter dispatch-control typecheck` (raw `tsc --noEmit`, includes `__tests__/**`) surfaces ~130 pre-existing errors in unrelated test files (`import.meta.glob` typing, `noUncheckedIndexedAccess` gaps in older spec files, etc.) that exist independently of this plan's files — confirmed none of the touched/created files appear in that error list, and the plan's authoritative gate (`next build`) is clean. Logged for awareness, not fixed (out of scope per the deviation rules' scope boundary).

## Deviations

None requiring auto-fix rules — see **key-decisions** above for the two plan-text-vs-mockup interpretation calls (deliberation word count, iframe-preview retirement) and the two honesty-over-fabrication calls (no-wraparound "next unreviewed", omitted QA-pass timestamp). All were resolved by favoring the concrete approved mockup / the plan's explicit instructions / never fabricating data with no source, and are documented for the reviewer's visibility.

## Known Stubs

None. Every card/tab/rail reads from data already available to the component tree (`draft`, `chipCounts`, `claimRows`, `useWorkspaceState().brief`) and renders an honest empty/loading state (never a blank or fake value) when that data is absent.

## Self-Check: PASSED

All 9 created/modified files verified present on disk; both task commits (`ab3d242`, `f71796f`) verified present in `git log`.
