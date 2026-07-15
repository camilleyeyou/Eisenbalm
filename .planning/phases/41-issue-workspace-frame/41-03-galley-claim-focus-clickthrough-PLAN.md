---
phase: 41-issue-workspace-frame
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/components/galley/ClaimMark.tsx
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/app/globals.css
  - apps/dispatch-control/__tests__/ClaimMark.test.tsx
autonomous: true
requirements: [WSP-04]
must_haves:
  truths:
    - "A checked claim reveals its source popover on keyboard focus, not only on hover"
    - "An unchecked (pending) claim in Draft is clickable through to Fact Check via a threaded callback"
    - ".galley-claim has a :focus-visible outline matching .galley-anno"
  artifacts:
    - path: "apps/dispatch-control/components/galley/ClaimMark.tsx"
      provides: "onFocus/onBlur source reveal + onUnsourcedClaimClick click-through"
      contains: "onUnsourcedClaimClick"
    - path: "apps/dispatch-control/__tests__/ClaimMark.test.tsx"
      provides: "focus-parity + click-through coverage (net-new file, closes pre-existing gap)"
  key_links:
    - from: "Galley.tsx onUnsourcedClaimClick prop"
      to: "GallerySection.tsx claimSpan mark render"
      to2: "ClaimMark.tsx onClick when status === 'pending'"
      via: "optional callback threaded through all three files"
      pattern: "onUnsourcedClaimClick"
---

<objective>
Close the WSP-04 accessibility + navigation gaps on the shipped provenance claim marks
WITHOUT rebuilding them (D-20). Two surgical additions, both verified-absent today:
(1) keyboard-focus source reveal — `.galley-claim` has no `:focus-visible` rule and the
native `title` tooltip only shows on mouse hover, so a keyboard user must press Enter/Space
to see a source (research Pattern 8); (2) an optional `onUnsourcedClaimClick` callback
threaded `Galley → GallerySection → ClaimMark` so Draft (Stage 2) can route an unchecked
claim click to the Fact Check tab (D-12). Undefined callback = today's popover-only behavior
(back-compat for every other caller). This is the WSP-04 primitive Stage 2 (Plan 41-08) wires.

Purpose: deliver "source on hover AND keyboard focus; unchecked rust-tinted and clickable
through to Fact Check" as reusable component capability.
Output: focus-parity CSS + onFocus/onBlur reveal + a threaded click-through prop + ClaimMark.test.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-RESEARCH.md

<interfaces>
<!-- ClaimMark.tsx (verified) — the <mark className="galley-claim"> already has tabIndex=0,
     role=button, aria-expanded, onClick={toggle}, onKeyDown (Enter/Space toggles popover,
     Escape closes). value: ClaimSpanMarkDef carries { status, provenance, sourceUrl, retrievedAt, claimIndex }.
     isChecked = value.status !== 'pending'. -->
<!-- GallerySection.tsx claimSpan render (verified, line ~126):
       claimSpan: ({ value, children }) => (<ClaimMark value={value as ClaimSpanMarkDef} runId={runId}>{children}</ClaimMark>)
     The PortableText `components` are memoized over [runId, sectionId, revisionId, reloadDraft, onEditSection, labels]. -->
<!-- Galley.tsx GalleyProps (verified) has: runId, draft, revisionId, reloadDraft, onEditSection,
     showProvenance?, includeAxes?, labels?. NO navigation callback exists anywhere in the chain. -->
<!-- globals.css: `.galley-anno:focus-visible { outline: 2px solid var(--color-ink); }` exists (line ~106);
     `.galley-claim` block (lines ~222–234) has NO :focus-visible rule. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ClaimMark focus-parity + click-through prop + CSS (WSP-04)</name>
  <files>apps/dispatch-control/components/galley/ClaimMark.tsx, apps/dispatch-control/app/globals.css, apps/dispatch-control/__tests__/ClaimMark.test.tsx</files>
  <read_first>
    - apps/dispatch-control/components/galley/ClaimMark.tsx (full — the <mark> element, toggle(), handleKeyDown, open state)
    - apps/dispatch-control/app/globals.css lines 85–234 (.galley-anno:focus-visible rule to mirror; .galley-claim block)
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx (the sibling component-test harness: vi.mock('convex/react'), RTL render pattern to copy — ClaimMark.test.tsx does NOT exist yet)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 8 (exact focusOpen guidance)
  </read_first>
  <behavior>
    - Test: rendering a claim and firing `focus` on the `<mark>` opens the source popover
      (role="dialog"); firing `blur` closes it. (New capability — hover-equivalent for keyboard.)
    - Test: a click-opened popover is NOT force-closed by an unrelated blur (separate `focusOpen`
      boolean OR-ed with the existing `open` state when deciding to render the popover).
    - Test: when `value.status === 'pending'` (unchecked) AND `onUnsourcedClaimClick` is provided,
      clicking the mark calls `onUnsourcedClaimClick(value.claimIndex)` (instead of only toggling).
    - Test: when `onUnsourcedClaimClick` is undefined, clicking preserves today's toggle-popover behavior.
    - Test: a checked (status !== 'pending') claim click still toggles the popover even if the
      callback is provided (click-through is unsourced/unchecked-only).
  </behavior>
  <action>
    In ClaimMark.tsx:
      - Add `onUnsourcedClaimClick?: (claimIndex: number) => void` to `ClaimMarkProps`.
      - Add `const [focusOpen, setFocusOpen] = useState(false)`. Render the popover when
        `open || focusOpen` (do NOT collapse the two — a click-open must survive a stray blur).
      - Add `onFocus={() => setFocusOpen(true)}` and `onBlur={() => setFocusOpen(false)}` to the `<mark>`.
      - In the click handler: if `value.status === 'pending' && onUnsourcedClaimClick` →
        call `onUnsourcedClaimClick(value.claimIndex)` and return (do not toggle). Else keep `toggle()`.
    In globals.css, add — mirroring `.galley-anno:focus-visible`:
      `.galley-claim:focus-visible { outline: 2px solid var(--color-ink); outline-offset: 1px; }`
    Create apps/dispatch-control/__tests__/ClaimMark.test.tsx covering the five behaviors, copying
    the AnnotationMark.test.tsx mock harness (mock convex/react useMutation so setStatus is a no-op).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- ClaimMark.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "onUnsourcedClaimClick" apps/dispatch-control/components/galley/ClaimMark.tsx` succeeds
    - `grep -q "focusOpen" apps/dispatch-control/components/galley/ClaimMark.tsx` succeeds
    - `grep -q ".galley-claim:focus-visible" apps/dispatch-control/app/globals.css` succeeds
    - `apps/dispatch-control/__tests__/ClaimMark.test.tsx` exists and exits 0 under vitest
    - the popover render condition uses `open || focusOpen` (grep for `focusOpen` near the popover JSX)
  </acceptance_criteria>
  <done>Focus reveal + focus-visible CSS + unchecked click-through prop added to ClaimMark; test green.</done>
</task>

<task type="auto">
  <name>Task 2: Thread onUnsourcedClaimClick through GallerySection and Galley</name>
  <files>apps/dispatch-control/components/galley/GallerySection.tsx, apps/dispatch-control/components/galley/Galley.tsx</files>
  <read_first>
    - apps/dispatch-control/components/galley/GallerySection.tsx (GallerySectionProps + the claimSpan render fn + the components useMemo dep array)
    - apps/dispatch-control/components/galley/Galley.tsx (GalleyProps + both GallerySection mount sites — LONG_READ_SECTIONS map + the specAd bonus mount)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (the new prop name from Task 1)
  </read_first>
  <action>
    GallerySection.tsx:
      - Add optional `onUnsourcedClaimClick?: (claimIndex: number) => void` to GallerySectionProps.
      - Pass it into `<ClaimMark ... onUnsourcedClaimClick={onUnsourcedClaimClick}>` in the
        `claimSpan` mark component.
      - Add `onUnsourcedClaimClick` to the `components` useMemo dependency array so a changed
        callback re-binds the mark renderer.
    Galley.tsx:
      - Add optional `onUnsourcedClaimClick?: (claimIndex: number) => void` to GalleyProps.
      - Forward it, unmodified, to EVERY `<GallerySection ...>` mount (the LONG_READ_SECTIONS
        map AND the specAd `bonus` section) — same way `labels`/`showProvenance` are forwarded.
      - Undefined (Review-Desk/Voice default) leaves today's popover-only behavior intact.
    No test file needed here (Task 1's ClaimMark.test.tsx proves the leaf behavior; Plan 41-08's
    Draft page proves the wired navigation). Confirm typecheck via the wave build.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- ClaimMark.test.tsx AnnotationMark.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "onUnsourcedClaimClick" apps/dispatch-control/components/galley/GallerySection.tsx` succeeds
    - `grep -q "onUnsourcedClaimClick" apps/dispatch-control/components/galley/Galley.tsx` succeeds
    - the prop is forwarded to every GallerySection mount in Galley.tsx (grep count ≥ 2 mount sites carry it)
    - `onUnsourcedClaimClick` appears in GallerySection's `components` useMemo dep array
    - existing galley tests (AnnotationMark) still pass
  </acceptance_criteria>
  <done>The optional click-through callback is threaded Galley→GallerySection→ClaimMark; back-compat preserved.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- ClaimMark.test.tsx AnnotationMark.test.tsx` green.
- Grep confirms the full prop chain + the focus-visible CSS rule.
</verification>

<success_criteria>
Checked claims reveal their source on keyboard focus (focus-visible outline + focus-open popover);
unchecked claims accept an optional click-through callback threaded through all three galley files;
no mark component rebuilt; all default (undefined-callback) behavior unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-03-SUMMARY.md`
</output>
