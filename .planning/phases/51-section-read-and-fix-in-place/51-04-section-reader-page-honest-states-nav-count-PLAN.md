---
phase: 51-section-read-and-fix-in-place
plan: 04
type: execute
wave: 3
depends_on: ["51-01", "51-02"]
files_modified:
  - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx
autonomous: true
requirements: [READ-01, READ-02, READ-03, READ-06, READ-07, READ-08]

must_haves:
  truths:
    - "Editor opens /s/originStory and reads the section as full-width prose with no rails, tabs or form fields"
    - "Fact, voice and unsourced-claim problems all appear in one read, each carrying a text label"
    - "A sourced claim renders as plain prose — no mark element in the DOM or the accessibility tree"
    - "Opening a marked problem shows the agent's reasoning and, when the finding links to a tracked claim, its evidence — without leaving the paragraph"
    - "Dismissing a finding still requires the one-line reason the existing annotation system enforces"
    - "Editor moves to the previous or next section from the end of the prose and sees how many sections still need them"
    - "Loading, not-generated and clean are three visibly different renders"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
      provides: "the /s/[section] reading surface"
      min_lines: 120
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"
      provides: "prev/next + the derived still-need-you sentence"
      contains: "sections still need you"
  key_links:
    - from: "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
      to: "apps/dispatch-control/components/galley/Galley.tsx"
      via: "single-section mount with the sections whitelist"
      pattern: "sections=\\{\\[sectionId\\]\\}"
    - from: "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
      to: "apps/dispatch-control/lib/useCurrentRun.ts"
      via: "runs.latest -> pipelineRuns.byRunId -> issueNumber"
      pattern: "useCurrentRun"
    - from: "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"
      to: "apps/dispatch-control/lib/derivedState.ts"
      via: "deriveSectionStates openCount tally"
      pattern: "deriveSectionStates"
---

<objective>
Build `/s/[section]` — the reading surface itself: current-run resolution, draft load, a single-section `Galley` mount with all axes merged, the three honest states, the exempt-section notes, and the end-of-prose prev/next plus derived count.

Purpose: this is the phase's whole point. Fact Check and Voice stop being destinations; the editor reads one section and every kind of problem is marked in the sentence it affects.

Output: `app/(editorial)/s/[section]/page.tsx` plus three small local components.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/51-section-read-and-fix-in-place/51-CONTEXT.md
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md
@.planning/phases/51-section-read-and-fix-in-place/51-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

lib/useCurrentRun.ts — THE hook for D-02 (never max(issueNumber)):
  export interface UseCurrentRunResult {
    state: CurrentRunState           // { kind: 'loading' } | { kind: 'none' } | { kind: 'run'; runId; issueNumber }
    runId: string | null
    issueNumber: number | null
    title: string | null | undefined // undefined === still loading; MUST branch before treating null as "no subject"
    derivationInputs: DerivationInputs
    issueStatus: IssueStatus
    qaFindings: DerivationInputs['qaFindings']
    claimRows: DerivationInputs['claimRows']
    // …plus claimSummary, signOffs, runRow, runCostUsd, capUsd, configRows
  }

lib/contentPatchClient.ts:
  export async function getDraft(runId: string, token: string | null): Promise<DraftResponse>
  export interface DraftResponse {
    revisionId: string
    sections: Record<string, { headline?: string; blocks: ContentBlock[]; lossy: boolean }>
    theme: Record<string, any>; game: Record<string, any>; bonus: Record<string, any>
    bonusType: 'specAd' | 'bigBudget' | 'jingle'
    podcast: Record<string, any>
    conversation: { speaker: string; text: string }[]
  }

lib/derivedState.ts:
  export function deriveSectionStates(i: DerivationInputs, draftSectionIds: ReadonlySet<string>): Record<string, { state; openCount }>
  export function draftSectionIdsFromDraft(draft: DraftResponse): ReadonlySet<string>

lib/editableSections.ts (created in 51-01) — the nine, in reading order:
  originStory "Origin Story" | problemStatement "Problem" | founderBio "Founder Bio" |
  caseStudy "Case Study" | bonus "Bonus" | game "Game" |
  deliberation-conversation "Deliberation" | podcast "Podcast" | theme "Theme"

components/galley/Galley.tsx props (after 51-01 adds the last two):
  runId, draft, revisionId, reloadDraft, onEditSection (all REQUIRED)
  onInspect?, onRevise?, onRelatedFacts?, showProvenance? (default true),
  includeAxes?, labels?, onUnsourcedClaimClick?, sections?,
  generateFixOnAccept?, showAxisTag?

Galley's own render coverage (verified): it renders originStory / problemStatement /
founderBio / caseStudy / bonus(specAd|bigBudget|jingle) / game / podcast /
deliberation-conversation. It does NOT render a `theme` section at all, and its
deliberation anchor id is `galley-deliberation`, not `galley-deliberation-conversation`.

components/revision/RevisionFlow.tsx — surface-agnostic: { runId, passage, onApplied, onClose }.
It self-gates its Apply action via useRole(), so D-23 needs no extra LockedControl wrapper.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build the page shell — current run, draft load, slim header, honest states</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/page.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx (the draft-load + reloadDraft + error/loading pattern to mirror — read it as precedent, do NOT import from it)
    - apps/dispatch-control/lib/useCurrentRun.ts (full)
    - apps/dispatch-control/lib/currentRun.ts (the `CurrentRunState` union and `resolveCurrentRun`)
    - apps/dispatch-control/lib/contentPatchClient.ts lines 149-180 and 349-360 (DraftResponse, getDraft)
    - apps/dispatch-control/lib/editableSections.ts (created in 51-01)
    - apps/dispatch-control/components/galley/Galley.tsx lines 340-470 (which sections it actually renders, and the `included()` whitelist gate)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § Copywriting Contract, § Layout Contract, § Slim Header Link Target
  </read_first>
  <action>
Create `app/(editorial)/s/[section]/page.tsx` as a `'use client'` component.

**Section id validation (D-03).** `params.section` IS the internal galley id, verbatim — no slug↔id map exists and none may be introduced. Validate against `EDITABLE_SECTIONS` from `@/lib/editableSections`:
```ts
const meta = EDITABLE_SECTIONS.find(s => s.id === params.section)
if (!meta) notFound()   // next/navigation — never guess a section
```
Valid paths are exactly: `/s/originStory`, `/s/problemStatement`, `/s/founderBio`, `/s/caseStudy`, `/s/bonus`, `/s/game`, `/s/deliberation-conversation`, `/s/podcast`, `/s/theme`.

**Current run (D-02).** `const { state, runId, title, derivationInputs } = useCurrentRun()`. Never `max(issueNumber)`, no `?issue=` override, no issue number in the path.

**Draft load.** Mirror `ReviewDeskRunView`'s shape exactly:
```ts
const [draft, setDraft] = useState<DraftResponse | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const reloadDraft = useCallback(async () => {
  if (!runId) return
  try { setDraft(await getDraft(runId, await getToken())) }
  catch (e) { setError(e instanceof Error ? e.message : 'Failed to load draft.') }
  finally { setLoading(false) }
}, [runId, getToken])
```

**The three honest states (D-21) — three visibly different renders, never collapsed:**
- **Loading** — `state.kind === 'loading'` OR `loading` OR `title === undefined` OR `derivationInputs.qaFindings === undefined` OR `derivationInputs.claimRows === undefined`. Render a skeleton (grey block placeholders in the reading column), with `aria-busy="true"` on the container and a visually-hidden `aria-label="Loading section…"`. **Never render "clean" until findings AND claims have both resolved** — this is the locked rule; branch on both being defined, not just on the draft.
- **Not generated** — the section id is absent from `draftSectionIdsFromDraft(draft)`. Do NOT write new copy: `Galley` already renders the WSP-07 Editor's-note block ("— Not generated. The {label} will appear here once the agents write it.") and D-21 requires byte-identical lockstep. Just mount `Galley` and let it render that block.
- **Clean** — findings and claims resolved, section present, zero open findings for this section. Render the prose PLUS an explicit line, exact copy: `No open findings in this section.` — rendered once, at the end of the prose, immediately before the end-of-section nav block. Absence of marks is stated, never inferred.
- **Run absent** — `state.kind === 'none'`: render a plain honest line rather than an empty page, and no nav actions that cannot be honoured.

**Slim header (D-05) — create `_components/SectionHeader.tsx`.** One line only: the issue's real derived `title` rendered as a plain `<Link href="/">` prefixed with `←`, normal case, no tracking, 11px/600 Space Grotesk, `var(--color-cobalt)`. Target is `/` — locked by UI-SPEC § Slim Header Link Target; do NOT point it at `/run` and never at a deeper operational surface (DOOR-03). **Not sticky** — it scrolls away. `32px` gap below it before the prose. Nothing else above the prose: no rails, no tabs, no stage nav, no form fields, no search. If `title` is `null` (confirmed no subject), render `← Current issue` rather than an empty link.

The section name renders as the prose headline — that is `Galley`'s own `.galley-headline`, not a second heading in the header. Do not add an `<h1>` above the galley.

**The reading wrapper (Pitfall 6).** The element wrapping the galley MUST literally carry `className="section-reader"` — the 760px measure, the 17.5px body and the corrected `scroll-margin-top` from 51-02 all key off that exact class and silently no-op without it.

Leave a clearly-marked `TODO(51-05)` stub for `onEditSection` — plan 51-05 replaces it with the real in-place editor. For this plan it may be a no-op function so `Galley`'s required prop is satisfied.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "renders"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(editorial)/s/[section]/page.tsx` exists and starts with `'use client'`
    - `grep -n "useCurrentRun" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -rn "max(issueNumber)\|Math.max" "apps/dispatch-control/app/(editorial)/s/"` returns NO matches
    - `grep -n "notFound" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n 'className="section-reader"\|section-reader' "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n 'aria-busy="true"' "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "No open findings in this section." "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n 'href="/"' "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx"` matches
    - `grep -rn '"/run"\|/issues/\|/review-desk\|/voice-pass' "apps/dispatch-control/app/(editorial)/s/"` returns NO matches
    - `grep -n "Not generated" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` returns NO matches (Galley owns that copy)
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "renders"` exits 0
  </acceptance_criteria>
  <done>`/s/[section]` resolves the current run the locked way, validates the segment against EDITABLE_SECTIONS, loads the draft, and renders three visibly distinct states inside a `.section-reader` wrapper under a non-sticky one-line header linking to `/`.</done>
</task>

<task type="auto">
  <name>Task 2: Mount Galley for the one section with all axes merged, neutral labels and the axis tags</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/page.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx</files>
  <read_first>
    - apps/dispatch-control/components/galley/Galley.tsx (full — the `sections` whitelist gate, the `includeAxes` filter it must NOT receive here, the label threading, and every section render branch including the three `bonusType` variants)
    - apps/dispatch-control/components/galley/PassageToolbar.tsx (the four actions D-22 requires: Edit text, Inspect how this was made, Ask agent to revise, Related facts)
    - apps/dispatch-control/components/revision/RevisionFlow.tsx (props `{ runId, passage, onApplied, onClose }`; it self-gates Apply via useRole — D-23 needs no extra wrapper)
    - apps/dispatch-control/components/inspector/InspectorProvider.tsx (`useInspector()` — now safe inside the (editorial) layout from plan 51-02)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (`GALLEY_TO_QA` — proves which sections can carry findings at all)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § Navigation & Section States Contract (the exact exempt copy strings)
  </read_first>
  <action>
Mount `Galley` inside the `.section-reader` wrapper with EXACTLY this prop set:

```tsx
<Galley
  runId={runId}
  draft={draft}
  revisionId={draft.revisionId}
  reloadDraft={reloadDraft}
  sections={[sectionId]}                    /* the LD-4 whitelist — never a new single-section renderer */
  /* includeAxes is DELIBERATELY OMITTED (D-06) — fact, voice and claim
     problems all render in one read. Do not pass FACTUAL_AXES or VOICE_AXES. */
  labels={{ accept: 'Accept suggestion', editInline: 'Edit myself', dismiss: 'Dismiss' }}
  generateFixOnAccept
  showAxisTag
  showProvenance
  markSourcedClaims={false}          /* D-09 — sourced claims render as plain prose, not a marigold wash */
  onEditSection={openInPlaceEditor}         /* TODO(51-05) stub for now */
  onInspect={(id) => openInspector({ type: 'founder', runId, locator: id })}
  onRevise={setRevisePassage}               /* page-local useState, NOT the shared context */
  onRelatedFacts={setRelatedFacts}          /* page-local useState */
/>
```

Notes that are load-bearing:
- `labels.dismissReasonDefault` stays UNSET (UI-SPEC: a single fixed reason cannot fit both factual and voice findings). The one-line dismiss reason remains required — READ-06 is satisfied by reusing `AnnotationMark`'s shipped dismiss flow verbatim; write no new dismiss code.
- `showProvenance` is on so claims resolve at all, and `markSourcedClaims={false}` (added in plan 51-01 Task 3f) is what makes D-09 literally true. **This is NOT already the default behaviour:** `app/globals.css:266-271` gives `data-provenance='sourced'` a marigold wash and `'unsourced'` a rust wash, so today `showProvenance` marks BOTH. Passing `markSourcedClaims={false}` stops sourced claims being resolved at all, so they emit no `<mark>` element and nothing in the accessibility tree — genuinely plain prose, not merely un-styled. Add no provenance toggle control to this surface (D-09).
- `onRevise` / `onRelatedFacts` are driven by page-local `useState`, exactly like `ReviewDeskRunView` does for related facts. Mount `<RevisionFlow runId={runId} passage={revisePassage} onApplied={reloadDraft} onClose={() => setRevisePassage(null)} />` when a passage is set. Do NOT route these through the inspector context.
- `onInspect` uses `useInspector()`, which is safe now that 51-02 mounted a provider in `app/(editorial)/layout.tsx`.

**Exempt sections (D-14) — create `_components/ExemptSectionNote.tsx`.** Four of the nine carry no QA `sectionName` mapping and therefore no inline findings. Render `Galley` (so the real artifact still shows — the game iframe, the podcast player, the deliberation turns) and beneath it this note, with these EXACT strings:

| section id | note |
|---|---|
| `game` | `This section renders as an interactive game — it carries no inline findings to review here.` |
| `podcast` | `This section is an audio player — it carries no inline findings to review here.` |
| `theme` | `This section sets the issue's color and font palette — it carries no inline findings to review here.` |
| `deliberation-conversation` | `This section shows the agents' deliberation as a conversation — it carries no inline findings to review here.` |

`bonus` is CONDITIONAL, not exempt: `draft.bonusType === 'specAd'` gets the full prose + inline findings + the Clean-state line, identical to the four long-reads. `draft.bonusType === 'jingle'` gets the exempt note `This week's bonus is an audio jingle — it carries no inline findings to review here.` `draft.bonusType === 'bigBudget'` renders its storyboards with the same jingle-shaped note wording adapted to storyboards (`This week's bonus is a storyboard set — it carries no inline findings to review here.`).

**`theme` needs special handling:** `Galley` renders NO `theme` section at all (verified — there is no `included('theme')` branch). For `/s/theme`, do not mount `Galley`; render the theme swatches directly from `draft.theme` (primaryColor / accentColor / backgroundColor / textColor / fontDisplay / fontBody as labelled colour chips and font names) plus the exempt note above. Never render a blank page.

Zero new icons — `lucide-react` must not appear anywhere under `app/(editorial)/`. Text labels and existing unicode glyphs only (UI-SPEC Design System).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "renders"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "sections={\[" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "includeAxes" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` returns NO matches (D-06)
    - `grep -n "Accept suggestion" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "Edit myself" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "generateFixOnAccept" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "showAxisTag" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "markSourcedClaims={false}" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches (D-09)
    - `grep -n "dismissReasonDefault" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` returns NO matches
    - `grep -c "it carries no inline findings to review here." "apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx"` returns at least 5
    - `grep -rn "lucide-react" "apps/dispatch-control/app/(editorial)/"` returns NO matches
    - `grep -n "RevisionFlow" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
  </acceptance_criteria>
  <done>One `Galley` renders the single section with fact, voice and unsourced-claim marks merged, neutral action labels, axis tags on, provenance on and sourced claims suppressed to plain prose; the four exempt sections and both non-specAd bonus variants state plainly what they are; theme renders swatches rather than nothing.</done>
</task>

<task type="auto">
  <name>Task 3: End-of-prose prev/next nav and the derived still-need-you sentence</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx, apps/dispatch-control/app/(editorial)/s/[section]/page.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts lines 270-345 (`deriveSectionStates` returns `{ state, openCount }` per section; `draftSectionIdsFromDraft` supplies the presence set)
    - apps/dispatch-control/lib/editableSections.ts (the nine, in order — index math source)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StoryFocusView.tsx lines 165-180 and 430-445 (the index±1 boundary pattern — read as precedent, do NOT import from this file)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § Copywriting Contract rows "Prev/Next navigation" and "Still need you count"
  </read_first>
  <action>
Create `_components/SectionEndNav.tsx` and render it once, after the last paragraph and after the Clean-state line, with `32px` (token `xl`) above it. It is NOT in the header and NOT duplicated anywhere (D-15).

**Prev/Next (READ-07, D-15).** Order follows `EDITABLE_SECTIONS`:
```ts
const i = EDITABLE_SECTIONS.findIndex(s => s.id === sectionId)
const prev = i > 0 ? EDITABLE_SECTIONS[i - 1] : null
const next = i >= 0 && i < EDITABLE_SECTIONS.length - 1 ? EDITABLE_SECTIONS[i + 1] : null
```
Copy is exactly `← {previous section label}` and `{next section label} →` — always naming the destination, e.g. `← Origin Story`, `Problem →`. NEVER a bare "Previous"/"Next". First section renders only Next; last section renders only Previous. Never a disabled or greyed placeholder and never wrap silently. Each control is a `next/link` `<Link href={`/s/${target.id}`}>` with a 44px minimum touch target, 11px/600 Space Grotesk uppercase with `.04em` tracking, and a `2px solid var(--color-ink)` focus ring (matching `.galley-anno:focus-visible`).

**Still-need-you count (READ-08, D-16/D-17).** Computed in the page and passed in — from the ONE shared selector, never a second one and never `deriveRunSections`:
```ts
const draftSectionIds = draftSectionIdsFromDraft(draft)
const states = deriveSectionStates(derivationInputs, draftSectionIds)
const needCount = Object.values(states).filter(s => s.openCount > 0).length
```
Copy, exact:
- `needCount > 0` → `{needCount} of 9 sections still need you.`
- `needCount === 0` → `All 9 sections are clean — nothing needs you.`

One plain sentence. Not must-fix-only, not two numbers side by side (D-16). Placed in this nav block, above the prev/next controls. It must NOT render while findings or claims are still loading (D-21) — the page already gates on that; do not render `SectionEndNav`'s sentence in the loading branch.

The numeral `9` is `EDITABLE_SECTIONS.length` — derive it, do not hard-code, so it cannot drift.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "nav"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "deriveSectionStates" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "deriveRunSections" "apps/dispatch-control/app/(editorial)/s/"` returns NO matches
    - `grep -n "sections still need you." "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"` matches
    - `grep -n "All 9 sections are clean — nothing needs you.\|sections are clean — nothing needs you." "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"` matches
    - `grep -n "EDITABLE_SECTIONS.length" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"` matches
    - `grep -n ">Previous<\|>Next<" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"` returns NO matches
    - `grep -n "disabled" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"` returns NO matches
    - `grep -n "/s/\${" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx"` matches
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "nav"` exits 0
  </acceptance_criteria>
  <done>The end of the prose offers the named previous/next section (only the ones that exist) and one plain sentence counting sections with open findings, computed from `deriveSectionStates`.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx` exits 0 with the `renders`, `nav` and `inspect` describes now LIVE (no longer skipped)
- `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/AnnotationMark.test.tsx __tests__/ClaimMark.test.tsx` exits 0 — Review Desk / Voice Pass behaviour is unregressed
- `grep -rn "localStorage" "apps/dispatch-control/app/(editorial)/"` returns no matches — no bookkeeping anywhere
</verification>

<success_criteria>
- `/s/originStory` renders full-width prose in a `.section-reader` wrapper, with no side rails, tabs or form fields.
- Fact, voice and unsourced-claim problems appear in one read, each carrying a text tag.
- The finding popover shows the agent's reasoning; dismiss still requires a reason.
- The end of the prose offers the named prev/next section and one derived count sentence.
- Loading, not-generated and clean render as three visibly different things, and "clean" never renders before findings and claims have both resolved.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-04-SUMMARY.md`
</output>
