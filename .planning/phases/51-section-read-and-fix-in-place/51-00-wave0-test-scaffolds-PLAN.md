---
phase: 51-section-read-and-fix-in-place
plan: 00
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
  - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
  - apps/dispatch-control/__tests__/ClaimMark.test.tsx
  - apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx
  - apps/dispatch-control/__tests__/Galley.test.tsx
autonomous: true
requirements: [READ-01, READ-02, READ-03, READ-04, READ-05, READ-07]

must_haves:
  truths:
    - "Every Phase 51 requirement has an automated command that exists before its implementation lands"
    - "A Voice-Pass regression case for the label-independent accept trigger exists and is green today"
    - "A sourced claim renders no mark at all when the caller opts out, and still renders one on Review Desk"
    - "The full existing Vitest suite is still green after the scaffolds land"
  artifacts:
    - path: "apps/dispatch-control/__tests__/SectionReaderPage.test.tsx"
      provides: "READ-01/04/05/07 + Pitfall 3 coverage for the new page"
      contains: "describe"
    - path: "apps/dispatch-control/__tests__/AnnotationMark.test.tsx"
      provides: "Fact/Voice tag cases + generateFixOnAccept regression case"
      contains: "generateFixOnAccept"
    - path: "apps/dispatch-control/__tests__/ClaimMark.test.tsx"
      provides: "phrasing-safe structural assertion"
      contains: "galley-popover div"
  key_links:
    - from: "apps/dispatch-control/__tests__/SectionReaderPage.test.tsx"
      to: "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
      via: "dynamic import under a describe.skipIf guard"
      pattern: "editorial/s"
---

<objective>
Create the Wave 0 test scaffolding named in `51-VALIDATION.md` so every subsequent plan has a real automated verify command that exists before the code it checks.

Purpose: this app's Vitest suite does not type-check and there is no test today for the two riskiest changes (Pitfall 2's label-keyed accept trigger, Pitfall 1's block-in-phrasing nesting). Writing them first is what makes those fixes provably safe rather than hopefully safe.

Output: one new test file (`__tests__/SectionReaderPage.test.tsx`) plus targeted case additions to three existing test files. Nothing under `app/`, `components/`, or `lib/` is touched by this plan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/51-section-read-and-fix-in-place/51-VALIDATION.md
@.planning/phases/51-section-read-and-fix-in-place/51-RESEARCH.md
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

Test infra (apps/dispatch-control/vitest.config.ts):
- default `environment: 'node'`; `environmentMatchGlobs` routes `*.test.tsx` → `jsdom`
- quick run: `cd apps/dispatch-control && npx vitest run __tests__/<File>.test.tsx`
- full suite: `pnpm --filter dispatch-control test`
- `test`/`test:unit` map to `vitest run` ONLY — no `tsc` step

The page under test will live at `app/(editorial)/s/[section]/page.tsx` (created in plan 51-04)
and will be a client component reading:
```typescript
const { state, runId, issueNumber, title, derivationInputs, qaFindings } = useCurrentRun()
// state.kind === 'loading' | 'none' | 'run'
```
and loading the draft with `getDraft(runId, token)` from `@/lib/contentPatchClient`.

DraftResponse shape (lib/contentPatchClient.ts):
```typescript
export interface ContentBlock { type: 'paragraph' | 'h2' | 'h3' | 'blockquote'; text: string }
export interface DraftSection { headline?: string; blocks: ContentBlock[]; lossy: boolean }
export interface DraftResponse {
  revisionId: string
  sections: Record<string, DraftSection>
  theme: Record<string, any>
  game: Record<string, any>
  bonus: Record<string, any>
  bonusType: 'specAd' | 'bigBudget' | 'jingle'
  podcast: Record<string, any>
  conversation: { speaker: string; text: string }[]
}
```

AnnotationMark's mark def and the two props being added in plan 51-01:
```typescript
export interface AnnotationMarkDef {
  findingId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}
// new in 51-01: generateFixOnAccept?: boolean ; showAxisTag?: boolean
```

VOICE_AXES = gravity, sentiment, irony-signaling, machine-tell
FACTUAL_AXES = precision, cross-section-consistency, structural-variety, hard-rule
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the Pitfall-1 and Pitfall-2 cases to the three existing galley test files</name>
  <files>apps/dispatch-control/__tests__/AnnotationMark.test.tsx, apps/dispatch-control/__tests__/ClaimMark.test.tsx, apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx, apps/dispatch-control/__tests__/Galley.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx (full — reuse its existing mock scaffold, fixture shape and render helper verbatim; do not re-derive a mocking strategy)
    - apps/dispatch-control/__tests__/ClaimMark.test.tsx (full)
    - apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx (full)
    - apps/dispatch-control/components/galley/AnnotationMark.tsx (the `isRewriteVariant` line, the accept-availability gate and the "Accept unavailable — no suggested fix." branch)
    - apps/dispatch-control/components/galley/ClaimMark.tsx (the `<span role="dialog" className="galley-popover">` popover)
    - apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx (the block-level markup that gains a `phrasingSafe` mode in 51-01, and its `ClaimProvenanceView` prop shape)
    - apps/dispatch-control/__tests__/Galley.test.tsx (its `showProvenance` / claim-row fixtures — the sourced-vs-unsourced cases below extend them)
    - apps/dispatch-control/app/globals.css lines 266-271 (`.galley-claim[data-provenance="sourced"]` marigold wash and `[data-provenance="unsourced"]` rust wash — BOTH are visible marks today, which is what D-09 forbids on the new surface)
  </read_first>
  <action>
Add cases to the three existing files. Do NOT restructure or rename anything already there — every existing test must keep passing byte-for-byte.

**`__tests__/AnnotationMark.test.tsx` — add a `describe('Phase 51 — label-independent accept trigger (Pitfall 2)')` block with exactly these three cases.** Fixture for all three: a finding with `axis: 'machine-tell'`, `severity: 'warning'`, `reason: 'Machine tell.'`, and NO `suggestedFix`.

1. `'Voice Pass regression: Accept rewrite label still offers Accept with no stored suggestedFix'` — render with `labels={{ accept: 'Accept rewrite', editInline: 'Write my own', dismiss: 'Keep (not a tell)' }}` and NO `generateFixOnAccept`. Open the popover. Assert `screen.getByRole('button', { name: 'Accept rewrite' })` exists and `screen.queryByText(/Accept unavailable/)` is null. **This case must be GREEN before plan 51-01 lands** — it is the regression guard, not a new feature.
2. `'neutral label plus generateFixOnAccept still offers Accept with no stored suggestedFix'` — render with `labels={{ accept: 'Accept suggestion', editInline: 'Edit myself', dismiss: 'Dismiss' }}` AND `generateFixOnAccept`. Assert `screen.getByRole('button', { name: 'Accept suggestion' })` exists and `screen.queryByText(/Accept unavailable/)` is null. This case will FAIL until 51-01 Task 3 lands — that is intended and correct.
3. `'neutral label without generateFixOnAccept keeps the Review Desk unavailable message'` — render with `labels={{ accept: 'Accept suggestion' }}` and NO `generateFixOnAccept`. Assert `screen.getByText('Accept unavailable — no suggested fix.')` exists.

**Also add a `describe('Phase 51 — Fact/Voice tag (READ-02, D-07)')` block with four cases** (all will fail until 51-01 Task 3 lands):
- `showAxisTag` + `axis: 'precision'` → `screen.getByText('Fact')` exists
- `showAxisTag` + `axis: 'machine-tell'` → `screen.getByText('Voice')` exists
- `showAxisTag` + `axis: undefined` → `screen.getByText('Fact')` exists
- no `showAxisTag` + `axis: 'precision'` → `screen.queryByText('Fact')` is null and `screen.queryByText('Voice')` is null

The tag must be assertable WITHOUT opening the popover — assert immediately after render, never after a click. That is literally what READ-02 requires ("readable without opening the popover").

**`__tests__/ClaimMark.test.tsx` — add a `describe('Phase 51 — phrasing-safe popover (Pitfall 1)')` block with two cases** (both fail until 51-01 Task 2 lands):
1. `'the open claim popover contains no block-level elements'` — open the popover, then:
```ts
const popover = container.querySelector('.galley-popover')
expect(popover).not.toBeNull()
expect(popover!.querySelector('div')).toBeNull()
expect(popover!.querySelector('p')).toBeNull()
expect(popover!.querySelector('h3')).toBeNull()
```
Add a comment in the file stating that jsdom does NOT validate HTML content models, so this structural assertion is a PROXY for DOM validity, not a proof of it (51-VALIDATION Manual-Only Verifications row 3).
2. `'Source tag renders for an unsourced claim only when showAxisTag is set'` — with `showAxisTag` and `provenance: 'unsourced'`, `screen.getByText('Source')` exists; with `provenance: 'sourced'`, `screen.queryByText('Source')` is null; without `showAxisTag`, `screen.queryByText('Source')` is null.

**`__tests__/ClaimProvenanceCard.test.tsx` — add a `describe('Phase 51 — phrasingSafe mode')` block with two cases:**
1. `'phrasingSafe renders no div, p, h3, ul or li'` — render with `phrasingSafe` and assert each of `container.querySelector('div' | 'p' | 'h3' | 'ul' | 'li')` is null. (Fails until 51-01 Task 2.)
2. `'default mode is unchanged'` — render WITHOUT `phrasingSafe` and assert `container.querySelector('div')` is NOT null, proving the default branch keeps today's block markup. (Green today and after.)

**`__tests__/Galley.test.tsx` — add a `describe('Phase 51 — D-09 only unsourced claims are marked')` block with two cases.** Fixture: one section carrying two claim rows, one WITH a `claimId` (→ `provenance: 'sourced'`) and one WITHOUT (→ `provenance: 'unsourced'`).
1. `'markSourcedClaims false renders no mark element for a sourced claim'` — render `<Galley … showProvenance markSourcedClaims={false} />` and assert `container.querySelector('.galley-claim[data-provenance="sourced"]')` is null while `container.querySelector('.galley-claim[data-provenance="unsourced"]')` is NOT null. The sourced claim must be plain prose — no `<mark>` in the DOM and none in the accessibility tree, not merely an invisible one. (Fails until 51-01 Task 3f.)
2. `'Review Desk default still marks both provenances'` — render `<Galley … showProvenance />` with NO `markSourcedClaims` and assert BOTH `.galley-claim[data-provenance="sourced"]` and `.galley-claim[data-provenance="unsourced"]` are present. **This case must be GREEN before 51-01 lands** — it is the D-24 regression guard proving the default is bit-for-bit today's behaviour.

**`__tests__/AnnotationMark.test.tsx` — also add a `describe('Phase 51 — evidence in the finding popover (READ-03, D-20)')` block with three cases** (all fail until plan 51-07 lands):
- `'renders the claim provenance card beneath the reason when the finding links to a claim'` — pass a `claim` prop shaped as `ClaimProvenanceView` (`{ text, importance, status, sourceUrl, supportingPassage, retrievedAt, sectionName }`), open the popover, assert the claim's `text` and its `sourceUrl` are both visible in the same popover as `value.reason`.
- `'renders no card when no claim is supplied'` — omit the prop, assert the reason renders and the claim text does not.
- `'the evidence card inside the popover contains no block-level elements'` — with the claim supplied, assert `container.querySelector('.galley-popover')!.querySelector('div')`, `'p'` and `'h3'` are all null (the `phrasingSafe` mount, Pitfall 1).

Use `@ts-expect-error` on the not-yet-existing props ONLY if TypeScript blocks the file from running — Vitest does not type-check, so plain prop passing normally works fine; prefer no suppression comments so the strict build catches a mis-spelled prop.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx -t "Voice Pass regression"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "generateFixOnAccept" apps/dispatch-control/__tests__/AnnotationMark.test.tsx` matches at least twice
    - `grep -n "Accept rewrite" apps/dispatch-control/__tests__/AnnotationMark.test.tsx` matches (the Voice Pass regression fixture)
    - `grep -n "showAxisTag" apps/dispatch-control/__tests__/AnnotationMark.test.tsx apps/dispatch-control/__tests__/ClaimMark.test.tsx` matches in both files
    - `grep -n "galley-popover" apps/dispatch-control/__tests__/ClaimMark.test.tsx` matches
    - `grep -n "phrasingSafe" apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx` matches
    - `grep -n "markSourcedClaims" apps/dispatch-control/__tests__/Galley.test.tsx` matches at least twice
    - `grep -n 'data-provenance="sourced"' apps/dispatch-control/__tests__/Galley.test.tsx` matches
    - `grep -n "ClaimProvenanceView\|supportingPassage" apps/dispatch-control/__tests__/AnnotationMark.test.tsx` matches
    - `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx -t "Review Desk default still marks both"` exits 0 (green BEFORE 51-01)
    - `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx -t "Voice Pass regression"` exits 0 (this case is green BEFORE 51-01)
    - `cd apps/dispatch-control && npx vitest run __tests__/ClaimProvenanceCard.test.tsx -t "default mode is unchanged"` exits 0
  </acceptance_criteria>
  <done>Four existing test files carry the Pitfall-1/Pitfall-2/READ-02/READ-03/D-09 cases; the Voice-Pass regression case, the default-mode case and the Review-Desk-marks-both case are green today; the rest are red and go green in plans 51-01 and 51-07.</done>
</task>

<task type="auto">
  <name>Task 2: Create __tests__/SectionReaderPage.test.tsx with skip-guarded specs for the new page</name>
  <files>apps/dispatch-control/__tests__/SectionReaderPage.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/Galley.test.tsx (full — copy its mock scaffold VERBATIM: `vi.mock('convex/react', …)`, `vi.mock('@clerk/nextjs', …)`, `vi.mock('@convex/_generated/api', …)`, and its `DraftResponse` fixture)
    - apps/dispatch-control/lib/useCurrentRun.ts lines 31-50 (UseCurrentRunResult — what the page consumes and the test must mock)
    - apps/dispatch-control/lib/contentPatchClient.ts lines 62-80 and 149-175 (ContentBlock, PatchResult, DraftResponse) and lines 224-240, 301-318, 349-360 (patchSection, patchBonus, getDraft)
    - apps/dispatch-control/lib/findingsClient.ts (acceptFinding / dismissFinding / FindingsError signatures)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § Copywriting Contract (every asserted string below is quoted from it)
  </read_first>
  <action>
Create `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx`.

Because the page does not exist yet, guard the whole suite so it is SKIPPED (never failing) until plan 51-04 lands, and becomes live automatically the moment the file appears:

```ts
import { existsSync } from 'node:fs'
import path from 'node:path'

// Wave 0 (51-VALIDATION): these specs are written BEFORE the page exists.
// They skip cleanly until app/(editorial)/s/[section]/page.tsx lands (plan
// 51-04), then run for real with no edit to this guard.
const PAGE_PATH = path.resolve(__dirname, '../app/(editorial)/s/[section]/page.tsx')
const pageExists = existsSync(PAGE_PATH)
const d = pageExists ? describe : describe.skip
```

Mocks (copy the scaffold shape from `Galley.test.tsx`, then add):
- `vi.mock('@/lib/useCurrentRun', () => ({ useCurrentRun: () => mockCurrentRun }))` where `mockCurrentRun` is a mutable `let` the individual tests reassign — default `{ state: { kind: 'run' }, runId: 'run_1', issueNumber: 7, title: 'The Quiet Ledger', derivationInputs: {...}, qaFindings: [...] }`
- `vi.mock('@/lib/contentPatchClient', …)` exposing `getDraft`, `patchSection`, `patchBonus` as `vi.fn()`
- `vi.mock('@/lib/findingsClient', …)` exposing `acceptFinding`, `dismissFinding` as `vi.fn()` plus a real `FindingsError` class
- `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }))`

Draft fixture: `originStory` with three `{ type: 'paragraph', text: … }` blocks, `revisionId: 'rev_1'`, `bonusType: 'specAd'`.

Write these `d('…')` describes and cases — each name is what the plan-level `-t` filters target, so use these exact substrings:

`d('renders')`:
- `'renders the section as prose inside a .section-reader wrapper'` — assert `container.querySelector('.section-reader')` is not null (Pitfall 6 — the CSS override silently no-ops without this class) and the first paragraph's text is present.
- `'renders no side rails, tabs or form fields'` — assert `container.querySelector('aside')` is null, `container.querySelector('form')` is null, and `container.querySelector('input')` is null in the initial read state.
- `'renders a skeleton, never a clean-looking page, while loading'` — with `state.kind === 'loading'`, assert `container.querySelector('[aria-busy="true"]')` is not null and `screen.queryByText('No open findings in this section.')` is null (D-21).
- `'states plainly that an exempt section carries no inline findings'` — for `/s/game`, assert the exact string `'This section renders as an interactive game — it carries no inline findings to review here.'`.

`d('nav')`:
- `'renders only Next on the first section'` — for `originStory` (index 0), assert `screen.getByText(/Problem/)` is present in the nav block and no `←` previous control exists.
- `'renders only Previous on the last section'` — for `theme` (index 8), assert a `←` control exists and no next control.
- `'names the destination section, never a bare Previous/Next'` — assert `screen.queryByText('Next')` is null and `screen.queryByText('Previous')` is null.
- `'renders the derived still-need-you sentence'` — with two sections carrying open findings, assert the exact string `'2 of 9 sections still need you.'`; with none, assert `'All 9 sections are clean — nothing needs you.'`.

`d('in-place edit')`:
- `'Edit myself opens a textarea on the flagged block with Save edit / Cancel edit'`
- `'Save edit calls patchSection with the current ifRevisionID for a long-read section'` — assert `patchSection` called with `('run_1', 'originStory', expect.objectContaining({ ifRevisionID: 'rev_1' }), expect.anything())`.
- `'Save edit calls patchBonus, never patchSection, for the bonus section'` — Pitfall 5. Assert `patchBonus` was called and `patchSection` was NOT.
- `'a 409 shows the reload-and-retry copy'` — make `patchSection` reject with a `ContentPatchError`-shaped error whose `reason` is `'revision_mismatch'`; assert the exact string `'This passage changed since you started editing — reload and try again.'`.
- `'Cancel edit makes no network call and restores the original text'`

`d('group accept')`:
- `'a finding in a group of 2+ shows the count in the accept label'` — assert `'Accept suggestion (applies to 3 places)'`.
- `'a lone finding shows the plain accept label'` — assert `'Accept suggestion'` and no `(applies to`.
- `'group accept calls acceptFinding once per member, each with the previous call\'s revisionId'` — make `acceptFinding` resolve `{ revisionId: 'rev_2' … }` then `{ revisionId: 'rev_3' … }`; assert call 1 used `ifRevisionID: 'rev_1'` and call 2 used `ifRevisionID: 'rev_2'` (D-12 — never the same revisionId twice).
- `'partial failure applies what worked and says so'` — 5 members, 2 rejections; assert the exact string `'3 of 5 applied — 2 still need you.'` (D-13).

`d('inspect')`:
- `'renders without throwing useInspector must be used within an InspectorProvider'` — render the page inside the real `(editorial)` layout's provider stack and assert no error is thrown (Pitfall 3). If importing the layout is impractical, assert instead that `app/(editorial)/layout.tsx` exists and its source contains `InspectorProvider` via `readFileSync` — a source-level assertion is acceptable here and is explicitly better than no coverage of a runtime-only failure `tsc` cannot catch.

Every asserted copy string above is quoted verbatim from `51-UI-SPEC.md § Copywriting Contract` — do not paraphrase any of them.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` exists
    - `grep -c "d('" apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` returns at least 5 (renders / nav / in-place edit / group accept / inspect)
    - `grep -n "describe.skip" apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` matches (the existsSync guard)
    - `grep -n "section-reader" apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` matches
    - `grep -n "3 of 5 applied — 2 still need you." apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` matches
    - `grep -n "This passage changed since you started editing — reload and try again." apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` matches
    - `grep -n "patchBonus" apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` matches
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx` exits 0 (all specs SKIPPED, none failing, while the page is absent)
    - `pnpm --filter dispatch-control test` exits 0
  </acceptance_criteria>
  <done>`__tests__/SectionReaderPage.test.tsx` exists with skip-guarded specs whose names match every `-t` filter used by later plans; the full suite is green.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx` exits 0 (skipped, not failing)
- `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx -t "Voice Pass regression"` exits 0
- `pnpm --filter dispatch-control test` exits 0 — no pre-existing test was broken
- `git diff --name-only` lists ONLY files under `apps/dispatch-control/__tests__/`
</verification>

<success_criteria>
- Every `-t` filter named in `51-VALIDATION.md`'s Per-Task Verification Map resolves to a real spec name.
- The Voice-Pass on-demand-rewrite regression case exists and is green before the fix that could break it.
- No production source file was touched.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-00-SUMMARY.md`
</output>
