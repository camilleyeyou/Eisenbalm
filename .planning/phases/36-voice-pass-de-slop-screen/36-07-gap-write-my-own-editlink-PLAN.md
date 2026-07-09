---
phase: 36-voice-pass-de-slop-screen
plan: 07
type: execute
gap_closure: true
wave: 5
depends_on: [36-04, 36-06]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
  - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
autonomous: true
requirements: [VOX-02]
must_haves:
  truths:
    - "The 'Write my own' voice-tell action on /voice-pass/[runId] navigates the operator into the Phase 31 section editor for that tell's section (D-09: Write my own = Edit inline), instead of being a dead no-op"
    - "The Review Desk section editor can be entered via a deep-link query param (?edit=<sectionId>[&finding=<findingId>]) so a second surface can route into it"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"
      provides: "handleEditSection deep-links to the Review Desk editor"
      contains: "review-desk"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
      provides: "reads ?edit= query param and opens SectionEditorPanel on mount"
      contains: "useSearchParams"
  key_links:
    - from: "voice-pass/[runId]/page.tsx handleEditSection"
      to: "/review-desk/[runId]?edit=<sectionId>"
      via: "router.push with edit query param"
      pattern: "review-desk"
    - from: "review-desk/[runId]/page.tsx mount effect"
      to: "handleEditSection(sectionId, findingId)"
      via: "useSearchParams().get('edit')"
      pattern: "useSearchParams"
---

<objective>
Close the Phase 36 verification gap: the "Write my own" voice-tell action on the Voice Pass screen is a dead no-op (`handleEditSection` is intentionally inert), contradicting 36-CONTEXT.md D-09 ("Write my own = Edit inline (open the section editor)") and leaving VOX-02 partially unmet. Give it a real destination by deep-linking into the EXISTING Phase 31 `SectionEditorPanel` on the Review Desk, keyed by the tell's section.

Purpose: VOX-02 names three tell actions (Accept rewrite / Write my own / Keep-not-a-tell). Two work end-to-end; "Write my own" renders and is clickable but does nothing. Wiring it to the Review Desk editor (rather than building a second editor surface on Voice Pass) is the lowest-cost fix that satisfies D-09 with zero new editing machinery.
Output: Review Desk reads an `?edit=<sectionId>[&finding=<findingId>]` deep-link and opens the section editor on mount; Voice Pass's `handleEditSection(sectionId, findingId)` navigates there; a Voice Pass test proves the button routes (no longer inert).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
@apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
@apps/dispatch-control/__tests__/VoicePassScreen.test.tsx

<interfaces>
<!-- Review Desk edit entry is internal state today (page.tsx:196-209):
     function handleEditSection(sectionId, findingId?) { setSelectedSection(sectionId); setEditFinding({sectionId,findingId}); setViewMode('edit') }
     It does NOT read any URL param. Add a mount effect that reads useSearchParams and calls handleEditSection once. -->
<!-- Voice Pass current dead stub (voice-pass/[runId]/page.tsx ~155-162): function handleEditSection() { /* Intentionally inert. */ }.
     The Galley/AnnotationMark call it as onEditSection(sectionId, findingId?) — same signature Review Desk uses. -->
<!-- next/navigation: useRouter().push + useSearchParams — the app is App Router; other screens (e.g. review-desk/page.tsx redirect) already use useRouter. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Review Desk opens the section editor from an ?edit= deep-link</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (handleEditSection at 196-209; the existing mount/draft effect; imports from 'next/navigation')
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx (existing useRouter/redirect usage pattern in this app)
  </read_first>
  <behavior>
    - After the draft has loaded, if the URL carries `?edit=<sectionId>`, the page enters `viewMode === 'edit'` for that section (and stores `finding` if `?finding=<id>` is present), exactly as if the operator had clicked Edit on that section — fired once, not on every render.
    - With no `?edit=` param, behavior is unchanged (galley default view).
  </behavior>
  <action>
    1. Import `useSearchParams` from `'next/navigation'` in `review-desk/[runId]/page.tsx` (alongside any existing next/navigation imports).
    2. Add a `const searchParams = useSearchParams()` and a `useEffect` that runs after the draft is available (gate on the same `draft`/loaded condition the galley mount uses so `handleEditSection` has a valid section). Use a `useRef` guard (e.g. `deepLinkAppliedRef`) so it fires at most once per mount: read `const editSection = searchParams.get('edit')`; if `editSection` and not yet applied, call `handleEditSection(editSection, searchParams.get('finding') ?? undefined)` and set the ref. Do NOT loop or re-fire when the operator later navigates within the page.
    3. Keep `handleEditSection` itself unchanged.
  </action>
  <acceptance_criteria>
    - `grep -q "useSearchParams" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"`
    - `grep -Eq "get\\('edit'\\)|get\\(\"edit\"\\)" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"`
    - `grep -q "deepLinkApplied" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"` (the once-guard ref)
    - `cd apps/dispatch-control && npx vitest run` exits 0 (no Review Desk regression)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>Review Desk enters the Phase 31 section editor when arrived-at with ?edit=<sectionId>, once per mount, and is otherwise unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire Voice Pass "Write my own" to the Review Desk edit deep-link</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx (the inert handleEditSection stub ~155-162; the runId in scope; whether useRouter is already imported)
    - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx (the mocks — convex/react useQuery, useAuth, getDraft, voicePassClient; add a next/navigation useRouter mock)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (the ?edit= param contract from Task 1)
  </read_first>
  <behavior>
    - Clicking "Write my own" on a voice tell calls the router to navigate to `/review-desk/{runId}?edit={sectionId}&finding={findingId}` (findingId omitted from the query when not provided). The handler is no longer inert.
    - The existing Voice Pass tests (only-voice-axis render, tell count, Run deep check) still pass.
  </behavior>
  <action>
    1. In `voice-pass/[runId]/page.tsx`: import `useRouter` from `'next/navigation'` (if not already), add `const router = useRouter()`.
    2. Replace the inert `handleEditSection()` body with `function handleEditSection(sectionId: string, findingId?: string) { const q = new URLSearchParams({ edit: sectionId }); if (findingId) q.set('finding', findingId); router.push('/review-desk/' + encodeURIComponent(runId) + '?' + q.toString()) }`. Keep the same param signature the Galley/AnnotationMark `onEditSection` calls with. Remove the "Intentionally inert" comment.
    3. In `__tests__/VoicePassScreen.test.tsx`: mock `next/navigation`'s `useRouter` to return a `push` spy (mirror how other dispatch-control tests mock it if a precedent exists), and add a test that triggers the "Write my own" path (or directly asserts the handler builds the expected `/review-desk/{runId}?edit=` URL) — asserting `push` was called with a string containing `review-desk` and `edit=`.
  </action>
  <acceptance_criteria>
    - `grep -q "useRouter" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"`
    - `grep -q "review-desk" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"`
    - `! grep -q "Intentionally inert" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"` (stub comment gone)
    - `grep -Eq "edit=|'edit'" apps/dispatch-control/__tests__/VoicePassScreen.test.tsx`
    - `cd apps/dispatch-control && npx vitest run __tests__/VoicePassScreen.test.tsx` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/VoicePassScreen.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>"Write my own" on Voice Pass deep-links into the Review Desk section editor for the tell's section; the button is live, VOX-02's three actions all function, and D-09 is satisfied.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run` full suite green (no regression).
- `pnpm --filter dispatch-control build` exits 0 (strict type-check).
- Manual (carried in HUMAN-UAT): from /voice-pass, clicking "Write my own" on a tell lands in the Review Desk editor focused on that section.
</verification>

<success_criteria>
The Phase 36 verification gap is closed: "Write my own" is no longer a dead button — it opens the existing section editor via a Review Desk deep-link, fulfilling VOX-02 / D-09 without building a duplicate editor surface.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-07-SUMMARY.md`.
</output>
