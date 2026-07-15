---
phase: 41-issue-workspace-frame
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/__tests__/derivedState.test.ts
  - apps/dispatch-control/lib/issueRouteResolver.ts
  - apps/dispatch-control/__tests__/issueRouteResolver.test.ts
autonomous: true
requirements: [WSP-01, WSP-02, WSP-07]
must_haves:
  truths:
    - "A pure selector returns a per-section state for every editable section using the 5-state vocabulary"
    - "The outline can render 'not generated' for any section absent from the draft"
    - "'Generated vs not-generated' is decided from the authoritative draft content (non-empty blocks), the SAME source the Stage-2 canvas uses — outline and canvas cannot disagree"
    - "Every stage segment (story/draft/fact-check/voice/approval) has a pure href builder"
  artifacts:
    - path: "apps/dispatch-control/lib/derivedState.ts"
      provides: "deriveSectionStates section-level selector (5-state vocabulary) + draftSectionIdsFromDraft (the single 'which sections are generated' source, shared with the Stage-2 canvas)"
      contains: "export function deriveSectionStates"
    - path: "apps/dispatch-control/lib/issueRouteResolver.ts"
      provides: "issueStoryHref / issueDraftHref / issueFactCheckHref / issueApprovalHref"
      contains: "export function issueDraftHref"
    - path: "apps/dispatch-control/__tests__/derivedState.test.ts"
      provides: "section-state selector coverage incl. the changed-since-review invariant + the SAME-source anti-regression (clean generated section is not mislabeled not-generated)"
  key_links:
    - from: "deriveSectionStates"
      to: "EDITABLE_SECTIONS + qaSectionToGalleyId + isOpenFinding"
      via: "per-section open-finding tally reusing the shipped primitives"
      pattern: "deriveSectionStates"
    - from: "draftSectionIdsFromDraft"
      to: "DraftResponse.sections[id].blocks (authoritative draft content)"
      via: "the SAME non-empty-blocks presence check the Stage-2 canvas uses (41-08 Task 2)"
      pattern: "draftSectionIdsFromDraft"
---

<objective>
Build the two pure-TS foundations every downstream plan consumes: a NEW section-level
state selector (`deriveSectionStates`) with the WSP-02 5-state vocabulary, and the
four stage href builders (`issueStoryHref`, `issueDraftHref`, `issueFactCheckHref`,
`issueApprovalHref`). No Convex, no React — pure functions + their unit tests, so
Wave 2+ can build the outline, tabs, and stage wrappers against a stable contract.

Also ship the single "which sections are generated" source-of-truth,
`draftSectionIdsFromDraft(draft)`, so the outline provider (41-05) and the Stage-2
canvas (41-08) both decide presence from the SAME authoritative draft content
(non-empty section blocks) and can never contradict each other.

Purpose: The outline (WSP-02/WSP-07) and the frame tabs (WSP-01) both need a
per-section state grain that `deriveStageStates` does NOT provide (it is stage-level,
5 results, 4-value vocabulary). This plan adds the missing sibling selector, the
draft-presence source-of-truth, and the missing route helpers WITHOUT touching the
existing exports those screens already use.
Output: `deriveSectionStates`, `draftSectionIdsFromDraft`, four stage hrefs, and their
tests — all green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/41-issue-workspace-frame/41-CONTEXT.md
@.planning/phases/41-issue-workspace-frame/41-RESEARCH.md
@.planning/phases/41-issue-workspace-frame/41-VALIDATION.md

<interfaces>
<!-- Existing exports in lib/derivedState.ts the new selector must sit beside (DO NOT change): -->
- `StageState = 'not-generated' | 'in-progress' | 'needs-you' | 'clean'` (stage-level — different vocabulary)
- `DerivationInputs` (issueNumber, runId, issue, signOffs, claimRows, qaFindings, pitchRows, runStatus)
- `deriveStageStates(i): [StageStateResult, ×5]`, `deriveTasks(i)`, `deriveIssueStatus(i)`
- helpers already imported: `isOpenFinding` (from ./galley/findingState), `VOICE_AXES` (from ./galley/axisPartition)
- `deriveTasks` currently builds hrefs with `issueReviewHref` / `issueVoiceHref`.

<!-- Section identity source (import from here — do NOT re-list sections): -->
- `EDITABLE_SECTIONS` from `app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx`:
  ids = originStory, problemStatement, founderBio, caseStudy, bonus, game,
  deliberation-conversation, podcast, theme
- `qaSectionToGalleyId(qaName)` from `lib/galley/sectionIdMap.ts` — maps a QA `sectionName` to a galley id.

<!-- Draft-presence source-of-truth (NEW, shared with the Stage-2 canvas): -->
- `DraftResponse` from `lib/contentPatchClient.ts` (type-only import): `sections: Record<string, {blocks: ContentBlock[]}>`
  plus top-level `bonus`/`game`/`podcast`/`conversation`/`theme`. The Stage-2 canvas (41-08 Task 2) marks a
  long-read section "not generated" when `(draft.sections[id]?.blocks ?? []).length === 0`; `draftSectionIdsFromDraft`
  MUST encode the identical rule so the outline and canvas share one presence source.

<!-- Existing route helpers (lib/issueRouteResolver.ts) — additive only: -->
- `issueHref(n)='/issues/${n}'`, `issueReviewHref(n)='/issues/${n}/review'` (KEEP — page.tsx still imports it until 41-06),
  `issueVoiceHref(n)='/issues/${n}/voice'`, `issueRunHref`, `legacyRedirectTarget`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add deriveSectionStates selector + draftSectionIdsFromDraft source (WSP-02/WSP-07)</name>
  <files>apps/dispatch-control/lib/derivedState.ts, apps/dispatch-control/__tests__/derivedState.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts (full — the module the new fn joins; mirror deriveDraftStage's per-section-finding style)
    - apps/dispatch-control/__tests__/derivedState.test.ts (the baseInputs(overrides) fixture pattern to extend)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (EDITABLE_SECTIONS — the section identity list)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (qaSectionToGalleyId)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — the ONE shared open predicate)
    - apps/dispatch-control/lib/contentPatchClient.ts (DraftResponse shape: sections[id].blocks + top-level bonus/game/podcast/conversation/theme — the canvas's draft source)
    - .planning/phases/41-issue-workspace-frame/41-08-stage2-draft-recomposition-PLAN.md Task 2 (the canvas's `(section?.blocks ?? []).length === 0` not-generated check draftSectionIdsFromDraft must match byte-for-byte)
    - .planning/phases/41-issue-workspace-frame/41-RESEARCH.md §Pattern 5 + §Open Questions #3 (the changed-since-review resolution)
  </read_first>
  <behavior>
    - Test: a section with an open error-severity finding → 'must-fix'
    - Test: a section with an open warning/info finding (no error) → 'review'
    - Test: a section present in draft with zero open findings → 'clean'
    - Test: a section absent from `draftSectionIds` → 'not-generated'
    - Test (SAME-SOURCE anti-regression, the blocker): given a `DraftResponse` fixture where a section
      has NON-EMPTY blocks but ZERO claims and ZERO open findings, `deriveSectionStates(i,
      draftSectionIdsFromDraft(draft))` reports that section 'clean' — NOT 'not-generated'. A clean,
      claim-less, finding-less GENERATED section must never be mislabeled absent (the presence signal
      comes from real draft blocks, not from side-tables a clean section legitimately lacks).
    - Test: a section whose draft blocks are empty/absent → `draftSectionIdsFromDraft` omits it →
      `deriveSectionStates` reports 'not-generated' (canvas parity).
    - Test (INVARIANT, WSP-07 + Open Q3): deriveSectionStates NEVER returns 'changed-since-review'
      in Phase 41 — no content-patch-touch data source exists; the value is a reserved legend
      label only. A section whose state is unknown MUST fall through to one of the four reachable
      states, and MUST NOT be silently reported 'clean' when it is actually absent (absent → 'not-generated').
    - Test: resolved (accepted/dismissed) findings are excluded (via isOpenFinding), matching deriveDraftStage.
  </behavior>
  <action>
    Add a new export to lib/derivedState.ts — do NOT modify any existing export:

      export type SectionState =
        | 'clean' | 'review' | 'must-fix' | 'changed-since-review' | 'not-generated'
      export interface SectionStateResult { state: SectionState; openCount: number }

    Add `export function deriveSectionStates(i: DerivationInputs, draftSectionIds: ReadonlySet<string>):
    Record<string, SectionStateResult>` that, for each `EDITABLE_SECTIONS` entry (import
    EDITABLE_SECTIONS from the SectionChipList module):
      1. If the section id is NOT in `draftSectionIds` → { state: 'not-generated', openCount: 0 }.
         (This is the WSP-07 first-class "not generated" grain.)
      2. Else group `i.qaFindings` (filtered by `isOpenFinding`) to this section via
         `qaSectionToGalleyId(row.sectionName) === section.id`; count them.
      3. If any open finding has severity 'error' → { state: 'must-fix', openCount: n }.
      4. Else if openCount > 0 → { state: 'review', openCount: n }.
      5. Else → { state: 'clean', openCount: 0 }.
    Add a header comment: `'changed-since-review'` is a RESERVED legend value with NO Phase-41
    data source (per 41-RESEARCH Open Q3) — it is intentionally never produced here; Phase 42+
    content-patch-touch tracking will drive it. Cite Pitfall 4 (do NOT feed deriveStageStates
    output into the outline — this is the per-section sibling).

    ALSO add `export function draftSectionIdsFromDraft(draft: DraftResponse): ReadonlySet<string>` —
    the SINGLE source-of-truth for "which sections are generated," consumed by the outline provider
    (41-05) AND the Stage-2 canvas (41-08). For each galley section id, include it iff the draft holds
    generated content, using the SAME per-section presence check the canvas renders:
      - long-reads (originStory / problemStatement / founderBio / caseStudy):
        `(draft.sections[id]?.blocks ?? []).length > 0` — byte-identical to 41-08 Task 2's not-generated predicate.
      - bonus / game / podcast / deliberation-conversation / theme: their corresponding top-level draft
        payload present/non-empty (draft.bonus / draft.game / draft.podcast / draft.conversation / draft.theme).
    Use a TYPE-ONLY import (`import type { DraftResponse } from '@/lib/contentPatchClient'`) so the module
    stays pure (no runtime Convex/React/fetch coupling). This closes the blocker: presence is read from
    real draft content, never inferred from side-tables (claims/findings) a clean section legitimately lacks —
    and the outline and canvas now derive presence from ONE function so they cannot diverge.

    Extend derivedState.test.ts with the behavior cases above, reusing the existing
    `baseInputs(overrides)` helper. Build a minimal `DraftResponse` fixture for the SAME-source cases
    (drive `draftSectionIds` via `draftSectionIdsFromDraft(fixture)`, not a hand-built Set, for those two
    assertions specifically), and keep hand-built Sets for the isolated deriveSectionStates cases.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- derivedState.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function deriveSectionStates" apps/dispatch-control/lib/derivedState.ts` succeeds
    - `grep -q "export function draftSectionIdsFromDraft" apps/dispatch-control/lib/derivedState.ts` succeeds
    - `grep -q "changed-since-review" apps/dispatch-control/lib/derivedState.ts` succeeds (value present in the union)
    - derivedState.test.ts asserts a non-empty-blocks, claim-less, finding-less section (via `draftSectionIdsFromDraft`) → 'clean', NOT 'not-generated'
    - derivedState.test.ts contains an assertion that `deriveSectionStates` output values never include `'changed-since-review'`
    - `pnpm --filter dispatch-control test -- derivedState.test.ts` exits 0
    - existing `deriveStageStates`/`deriveTasks`/`deriveIssueStatus` exports are unchanged (grep still finds each)
  </acceptance_criteria>
  <done>deriveSectionStates + SectionState type + draftSectionIdsFromDraft (canvas-parity presence source) exist, tests green, no existing export altered.</done>
</task>

<task type="auto">
  <name>Task 2: Add stage href builders to issueRouteResolver (WSP-01, D-05/D-06)</name>
  <files>apps/dispatch-control/lib/issueRouteResolver.ts, apps/dispatch-control/__tests__/issueRouteResolver.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/issueRouteResolver.ts (full — the pure module to extend)
    - apps/dispatch-control/__tests__/issueRouteResolver.test.ts (the existing test cases to extend — do NOT create a new file)
    - apps/dispatch-control/lib/derivedState.ts (deriveTasks uses issueReviewHref — retarget the draft-stage tasks to issueDraftHref)
  </read_first>
  <action>
    In lib/issueRouteResolver.ts ADD (do NOT remove `issueReviewHref` — page.tsx still imports it
    until Plan 41-06 guts it; removing it now breaks the build in Waves 1–2):
      export function issueStoryHref(n: number): string { return `/issues/${n}/story` }
      export function issueDraftHref(n: number): string { return `/issues/${n}/draft` }
      export function issueFactCheckHref(n: number): string { return `/issues/${n}/fact-check` }
      export function issueApprovalHref(n: number): string { return `/issues/${n}/approval` }
    Keep `issueVoiceHref` (= `/issues/${n}/voice`) as-is (D-06: /voice stays).
    In lib/derivedState.ts, change ONLY the `deriveTasks` draft/QA-finding + claim + facts-signoff
    hrefs that currently call `issueReviewHref` to call `issueDraftHref` (the live post-Phase-41
    route). Leave `issueVoiceHref` usages untouched. Update the import line accordingly.
    Extend issueRouteResolver.test.ts with a case per new helper asserting exact strings
    (e.g. `expect(issueDraftHref(7)).toBe('/issues/7/draft')`).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- issueRouteResolver.test.ts derivedState.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "issueDraftHref" apps/dispatch-control/lib/issueRouteResolver.ts` and same for issueStoryHref/issueFactCheckHref/issueApprovalHref
    - `grep -q "issueReviewHref" apps/dispatch-control/lib/issueRouteResolver.ts` STILL succeeds (kept for back-compat)
    - `grep -q "issueDraftHref" apps/dispatch-control/lib/derivedState.ts` succeeds (deriveTasks retargeted)
    - `pnpm --filter dispatch-control test -- issueRouteResolver.test.ts derivedState.test.ts` exits 0
  </acceptance_criteria>
  <done>Four stage hrefs added + tested; deriveTasks points draft tasks at /draft; issueReviewHref retained.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- derivedState.test.ts issueRouteResolver.test.ts` green.
- No existing export removed (issueReviewHref, deriveStageStates, deriveTasks all still present).
- `draftSectionIdsFromDraft` is the ONE presence source the outline (41-05) and canvas (41-08) both consume.
</verification>

<success_criteria>
deriveSectionStates + SectionState (5-value vocabulary, changed-since-review reserved-and-never-produced),
`draftSectionIdsFromDraft` (canvas-parity "generated" source), and the four stage href builders exist with
green tests — including the anti-regression that a clean, claim-less, finding-less GENERATED section reads
'clean', not 'not-generated'. Only a type-only DraftResponse import is added (no Convex/React runtime coupling).
</success_criteria>

<output>
After completion, create `.planning/phases/41-issue-workspace-frame/41-01-SUMMARY.md`
</output>
