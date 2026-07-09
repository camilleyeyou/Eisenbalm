---
phase: 36-voice-pass-de-slop-screen
plan: 04
type: execute
wave: 3
depends_on: [36-01, 36-02, 36-03, 36-05]
files_modified:
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/AnnotationMark.tsx
  - apps/dispatch-control/components/galley/GalleryGameSlot.tsx
  - apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx
  - apps/dispatch-control/components/galley/ClaimMark.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx
  - apps/dispatch-control/lib/galley/axisPartition.ts
  - apps/dispatch-control/lib/voicePassClient.ts
  - apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
  - apps/dispatch-control/__tests__/Galley.test.tsx
  - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
autonomous: true
requirements: [VOX-01, VOX-04]
must_haves:
  truths:
    - "Galley/GallerySection/AnnotationMark live in a route-agnostic components/galley/ and are imported by BOTH Review Desk and Voice Pass"
    - "The Voice Pass screen at /voice-pass/[runId] lights ONLY voice-axis findings (gravity/sentiment/irony-signaling/machine-tell) over the draft prose, with a per-screen tell count"
    - "Review Desk continues to light only factual axes (no regression from the shared filter)"
    - "Review Desk's DecisionRail 'Facts cleared' blockers + blocking-items list AND ResolvedFindingsList are scoped to FACTUAL_AXES, so voice/machine-tell findings never block or clutter the factual sign-off (mirrors the server-side facts-cleared narrowing in 36-02)"
    - "A 'Run deep check' control POSTs to voice-recheck and the new judge findings appear reactively"
  artifacts:
    - path: "apps/dispatch-control/lib/galley/axisPartition.ts"
      provides: "VOICE_AXES + FACTUAL_AXES sets"
      exports: ["VOICE_AXES", "FACTUAL_AXES"]
      contains: "machine-tell"
    - path: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"
      provides: "Voice Pass galley screen (VOICE_AXES filter + tell count + deep-check)"
      contains: "VOICE_AXES"
    - path: "apps/dispatch-control/lib/voicePassClient.ts"
      provides: "recheck() → POST /issues/{runId}/voice-recheck"
      exports: ["recheck"]
      contains: "voice-recheck"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"
      to: "components/galley/Galley includeAxes prop"
      via: "includeAxes={VOICE_AXES}"
      pattern: "includeAxes"
    - from: "components/galley/Galley.tsx"
      to: "openFindings filter"
      via: "row.axis in includeAxes before grouping"
      pattern: "includeAxes"
    - from: "voice-pass Run deep check button"
      to: "POST /issues/{runId}/voice-recheck"
      via: "voicePassClient.recheck(runId, token)"
      pattern: "voice-recheck"
---

<objective>
Build the Voice Pass reading surface (VOX-01) and its on-demand judge trigger (VOX-04 client half), reusing the entire Phase 32-35 galley stack via a route-agnostic promotion (research Open Question #4). Three moves: promote the shared galley components out of Review Desk's private `_components/` folder; add an `includeAxes` filter so one `Galley` component serves two axis-partitioned screens; and stand up `/voice-pass/[runId]` mounting that galley filtered to VOICE_AXES with a per-screen tell count and a "Run deep check" button wired to the 36-03 voice-recheck endpoint.

Purpose: Voice Pass is the SECOND consumer of the galley — the low-cost moment to fix the "private folder imported by two routes" smell and give the voice axis its own lit surface without duplicating the resolver/popover/render stack.
Output: `components/galley/*` (6 promoted files); `lib/galley/axisPartition.ts`; `lib/voicePassClient.ts`; `/voice-pass` route (redirect + `[runId]` screen); Review Desk rewired to FACTUAL_AXES; tests + strict build.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
@apps/dispatch-control/app/(dashboard)/review-desk/page.tsx
@apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx
@apps/dispatch-control/lib/galley/findingState.ts
@apps/dispatch-control/lib/galley/sectionIdMap.ts
@apps/dispatch-control/lib/signOffClient.ts
@apps/dispatch-control/__tests__/Galley.test.tsx

<interfaces>
<!-- Galley's finding-grouping seam (Galley.tsx:107-130): after `const openFindings = rawFindings.filter(isOpenFinding)`
     the component groups by galley section. §36.3 filter inserts here:
     const scoped = includeAxes ? openFindings.filter(r => r.axis !== undefined && includeAxes.has(r.axis)) : openFindings -->
<!-- review-desk/[runId]/page.tsx mounts <Galley runId draft revisionId reloadDraft onEditSection showProvenance/> (396-405)
     and imports Galley from './_components/Galley' (40) + DecisionRail from './_components/DecisionRail' (41). -->
<!-- voice-pass/page.tsx is currently a PlaceholderScreen — replace with the review-desk/page.tsx auto-focus redirect
     pattern (useQuery api.runs.listForWorkspace → filter awaiting-review → router.replace(`/voice-pass/${runId}`)). -->
<!-- Draft load: getDraft(runId, token) from '@/lib/contentPatchClient' + useAuth().getToken() (see review-desk/[runId]/page.tsx:217-232). -->
<!-- signOffClient.pipelineBaseUrl() pattern to mirror for voicePassClient (NEXT_PUBLIC_PIPELINE_URL + Bearer token). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Promote the shared galley components to components/galley/</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx (imports GallerySection, GalleryGameSlot)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx (imports AnnotationMark, ClaimMark, UnresolvedFindingCard)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (imports './_components/Galley' + './_components/DecisionRail')
    - apps/dispatch-control/__tests__/Galley.test.tsx and __tests__/AnnotationMark.test.tsx and __tests__/UnresolvedFindingCard.test.tsx (their import paths to update)
    - .planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md (Open Question #4 — promotion recommendation + Pattern 4)
  </read_first>
  <action>
    Move these 6 files from `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/` to a new route-agnostic `apps/dispatch-control/components/galley/`: `Galley.tsx`, `GallerySection.tsx`, `AnnotationMark.tsx`, `GalleryGameSlot.tsx`, `UnresolvedFindingCard.tsx`, `ClaimMark.tsx` (Galley's full dependency closure). Their `@/lib/...` and `@convex/...` absolute imports are unaffected; the inter-file imports among these 6 stay relative (`./AnnotationMark`, `./ClaimMark`, `./UnresolvedFindingCard`, `./GallerySection`, `./GalleryGameSlot`) and move together.
    - Update `review-desk/[runId]/page.tsx`: change the Galley import from `'./_components/Galley'` to `'@/components/galley/Galley'`. Keep `DecisionRail`, `SectionChipList`, `SectionEditorPanel` where they are (NOT promoted — DecisionRail is factual-rail specific).
    - Update any test-file import paths that reference the moved files (`__tests__/Galley.test.tsx`, `__tests__/AnnotationMark.test.tsx`, `__tests__/UnresolvedFindingCard.test.tsx`) to the new `@/components/galley/...` (or matching relative) path.
    - Leave `DecisionRail.tsx`, `ResolvedFindingsList.tsx`, `SourceIndex.tsx`, `SectionChipList.tsx`, `SectionEditorPanel.tsx` in place (they import the promoted ones by absolute `@/` alias if needed — check `ResolvedFindingsList` / `UnresolvedFindingCard` cross-refs and fix any that break).
    Goal: pure move + import-path update, ZERO behavior change. Review Desk renders identically.
  </action>
  <acceptance_criteria>
    - `ls apps/dispatch-control/components/galley/Galley.tsx apps/dispatch-control/components/galley/GallerySection.tsx apps/dispatch-control/components/galley/AnnotationMark.tsx` all exist
    - `test ! -e "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx"` (old path gone)
    - `grep -q "@/components/galley/Galley" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"`
    - `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/AnnotationMark.test.tsx __tests__/UnresolvedFindingCard.test.tsx` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/AnnotationMark.test.tsx __tests__/UnresolvedFindingCard.test.tsx</automated>
  </verify>
  <done>The 6 galley components live in components/galley/; Review Desk imports them from there and renders unchanged; existing galley tests + strict build green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Axis-filter prop on Galley + VOICE_AXES/FACTUAL_AXES partition</name>
  <read_first>
    - apps/dispatch-control/components/galley/Galley.tsx (the openFindings filter + findingsByGalleyId grouping loop, ~107-130)
    - apps/dispatch-control/__tests__/Galley.test.tsx (existing render-with-findings cases to extend)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (the <Galley ...> mount to pass FACTUAL_AXES into)
    - docs/API_CONTRACTS.md §36.3 (the exact axis partition)
  </read_first>
  <behavior>
    - Test 1 (RED→GREEN): `<Galley includeAxes={VOICE_AXES}>` given findings `[{axis:'machine-tell'}, {axis:'precision'}]` renders the machine-tell annotation and OMITS the precision one.
    - Test 2: `<Galley includeAxes={FACTUAL_AXES}>` renders the precision one and omits machine-tell.
    - Test 3 (back-compat): `<Galley>` with no `includeAxes` renders BOTH (undefined = no filter).
    - Test 4: a finding with `axis === undefined` is omitted when `includeAxes` is set (only known-axis rows pass the whitelist).
  </behavior>
  <action>
    1. Create `apps/dispatch-control/lib/galley/axisPartition.ts` exporting `export const VOICE_AXES: ReadonlySet<string> = new Set(['gravity','sentiment','irony-signaling','machine-tell'])` and `export const FACTUAL_AXES: ReadonlySet<string> = new Set(['precision','cross-section-consistency','structural-variety','hard-rule'])` with a comment referencing §36.3.
    2. In `components/galley/Galley.tsx`: add `includeAxes?: ReadonlySet<string>` to `GalleyProps`; right after `const openFindings = rawFindings.filter(isOpenFinding)` insert `const scopedFindings = includeAxes ? openFindings.filter(row => row.axis !== undefined && includeAxes.has(row.axis)) : openFindings`; change the grouping loop to iterate `scopedFindings` instead of `openFindings`. Nothing else changes (GallerySection/spanResolver untouched).
    3. In `review-desk/[runId]/page.tsx`: import `FACTUAL_AXES` and pass `includeAxes={FACTUAL_AXES}` to the `<Galley>` mount (Review Desk stays the factual surface). Also apply the same axis-partition to the page's `chipCounts` tally (filter `openFindings` to FACTUAL_AXES before grouping) so chip badges match.
    4. Extend `__tests__/Galley.test.tsx` with the four behavior tests (import VOICE_AXES/FACTUAL_AXES).
  </action>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/galley/axisPartition.ts` exists and `grep -q "machine-tell" apps/dispatch-control/lib/galley/axisPartition.ts`
    - `grep -q "includeAxes" apps/dispatch-control/components/galley/Galley.tsx`
    - `grep -q "FACTUAL_AXES" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"`
    - `grep -q "includeAxes" apps/dispatch-control/__tests__/Galley.test.tsx`
    - `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx</automated>
  </verify>
  <done>One Galley component now serves two axis-partitioned surfaces; Review Desk is scoped to FACTUAL_AXES; the filter is proven by tests including the undefined-axis and back-compat cases.</done>
</task>

<task type="auto">
  <name>Task 3: /voice-pass/[runId] screen — VOICE_AXES galley + tell count + Run deep check</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx (the auto-focus redirect pattern to mirror for voice-pass/page.tsx)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (draft load via getDraft + useAuth, the qaCorrections useQuery + isOpenFinding, the Galley mount — mirror for the voice-pass screen)
    - apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx (current placeholder to replace)
    - apps/dispatch-control/lib/signOffClient.ts (pipelineBaseUrl + Bearer-token fetch pattern to mirror for voicePassClient)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding) + lib/galley/axisPartition.ts (Task 2)
    - docs/API_CONTRACTS.md §36.4 (voice-recheck response shape)
  </read_first>
  <action>
    1. Create `apps/dispatch-control/lib/voicePassClient.ts` mirroring `signOffClient.ts` (private `pipelineBaseUrl()` reading `NEXT_PUBLIC_PIPELINE_URL`, Bearer token, typed error). Export `async function recheck(runId: string, token: string | null): Promise<{ runId: string; findingCount: number }>` → `POST /issues/{runId}/voice-recheck` (no body). (Also export a stub `rewrite(runId, findingId, token)` signature typed for 36-06 to fill, OR leave rewrite to 36-06 — recheck is the only call this plan needs.)
    2. Replace `voice-pass/page.tsx` body with the review-desk/page.tsx auto-focus redirect pattern: `useQuery(api.runs.listForWorkspace,{workspace_id:DEFAULT_WORKSPACE_ID})` → filter `status==='awaiting-review'` → `router.replace('/voice-pass/'+encodeURIComponent(soleRunId))` when exactly one; switcher when many; empty state otherwise. Copy adjusted to "Voice Pass".
    3. Create `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` (Client Component): load the draft via `getDraft(runId, token)` (useAuth token, reloadDraft callback — same as review-desk), subscribe `useQuery(api.qaCorrections.byRunId,{runId})`, filter `isOpenFinding` then to `VOICE_AXES` (axis-scoped) → compute the **per-screen tell count** (VOX-01) and render it in the header (e.g. "N tells"). Mount the promoted `<Galley runId draft revisionId={draft.revisionId} reloadDraft onEditSection includeAxes={VOICE_AXES} showProvenance={false} />` (provenance off — Voice Pass is voice-only). Add a **"Run deep check"** button that calls `voicePassClient.recheck(runId, await getToken())`, shows a busy/last-run state, and relies on Convex reactivity to surface new findings (no manual refetch of findings needed; `reloadDraft` only for accepted text). `onEditSection` can route to the Review Desk section editor (`/review-desk/[runId]` deep-link) or a local stub — wire it to a no-op-safe handler for now (36-06 finalizes the rewrite/edit actions).
    4. Create `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` (jsdom): mock `convex/react` useQuery (mirror Galley.test.tsx mocks) + `@clerk/nextjs` useAuth + `@/lib/contentPatchClient` getDraft + `@/lib/voicePassClient`; assert (a) only voice-axis findings render, (b) the tell count reflects the voice-scoped open findings, (c) clicking "Run deep check" calls `recheck`.
  </action>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` exists and `grep -q "VOICE_AXES" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"`
    - `grep -q "Run deep check" "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"`
    - `grep -Eq "recheck|voice-recheck" apps/dispatch-control/lib/voicePassClient.ts`
    - `grep -q "router.replace" "apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx"` (no longer a PlaceholderScreen)
    - `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` exists
    - `cd apps/dispatch-control && npx vitest run __tests__/VoicePassScreen.test.tsx` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/VoicePassScreen.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>/voice-pass/[runId] renders the draft with only voice-axis tells lit, shows a per-screen tell count, and a "Run deep check" button triggers the on-demand judge via voice-recheck; strict build passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Axis-scope the Review Desk DecisionRail + ResolvedFindingsList to FACTUAL_AXES</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (the finding query + blockers filter at lines 108-115; the blocking-items jump-link list ~269-283; the "Sign: Facts cleared" disabled gate + blockerReason ~377/406/412)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx (the query + resolved filter at lines 52-55)
    - apps/dispatch-control/lib/galley/axisPartition.ts (FACTUAL_AXES — created in Task 2)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — axis-unaware; the axis scoping is layered ON TOP of it, not inside it)
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (existing rail tests to extend)
    - .planning/phases/36-voice-pass-de-slop-screen/36-02-pipeline-axis-foundations-PLAN.md (the server-side facts-cleared narrowing this client change must mirror)
  </read_first>
  <behavior>
    - Test 1 (RED→GREEN): DecisionRail given open findings `[{axis:'machine-tell',severity:'error'}, {axis:'precision',severity:'error'}]` computes `blockers.length === 1` (only the precision/factual one) — the machine-tell error does NOT block "Facts cleared".
    - Test 2: with ONLY an open `{axis:'machine-tell',severity:'error'}` finding, the "Sign: Facts cleared" button is ENABLED (blockers empty) — proving voice errors no longer gate the factual sign-off (matches 36-02's server narrowing).
    - Test 3: the blocking-items jump-link list contains only FACTUAL_AXES findings (no machine-tell/voice entries pointing at findings absent from the factual galley).
    - Test 4: ResolvedFindingsList shows only resolved FACTUAL_AXES rows (voice-axis resolved rows belong to Voice Pass, not the factual rail).
  </behavior>
  <action>
    Mirror the server-side `facts-cleared` narrowing (36-02) on the client so the Review Desk rail agrees with it. Import `FACTUAL_AXES` from `@/lib/galley/axisPartition` into BOTH files.
    1. `DecisionRail.tsx` — after `const openFindings = rawFindings.filter(isOpenFinding)` (line 112), insert `const factualOpen = openFindings.filter(f => f.axis === undefined || FACTUAL_AXES.has(f.axis))` (undefined axis = factual, per §36.3), then change lines 113-115 to derive `blockers`/`warnings`/`infos` from `factualOpen` instead of `openFindings`. The blocking-items jump-link list (~269-283) must iterate the same `factualOpen`-derived `blockers`. The `warnings`/`infos` COUNTS shown in the rail headline should also come from `factualOpen` so the factual rail's summary excludes voice tells. Do NOT touch the `sign_offs`/claims/hook/verification queries.
    2. `ResolvedFindingsList.tsx` — change line 55 to `const resolved = (rows ?? []).filter(r => !isOpenFinding(r) && (r.axis === undefined || FACTUAL_AXES.has(r.axis)))` so the factual rail's resolved list excludes voice-axis rows.
    3. Extend `__tests__/DecisionRail.test.tsx` with the four behavior tests (import FACTUAL_AXES; mock qaCorrections.byRunId with mixed-axis findings).
    Note (§36.3): a finding whose `axis` is `undefined` counts as FACTUAL (Review Desk / facts-cleared) — legacy rows written before the machine-tell axis existed must still block factual sign-off, so the filter is `axis === undefined || FACTUAL_AXES.has(axis)`, NOT `FACTUAL_AXES.has(axis)` alone.
  </action>
  <acceptance_criteria>
    - `grep -q "FACTUAL_AXES" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"`
    - `grep -q "FACTUAL_AXES" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/ResolvedFindingsList.tsx"`
    - `grep -q "factualOpen" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"`
    - `grep -q "FACTUAL_AXES" apps/dispatch-control/__tests__/DecisionRail.test.tsx`
    - `cd apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx` exits 0
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/DecisionRail.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>The Review Desk "Facts cleared" gate, blocking-items list, headline counts, and resolved list are all scoped to FACTUAL_AXES (undefined-axis = factual), so voice/machine-tell findings no longer block or clutter factual clearance — the client now agrees with 36-02's server narrowing, making the two sign-offs genuinely distinct at the UI layer.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run` full suite green (no regression from the promotion or the axis filter).
- `pnpm --filter dispatch-control build` exits 0 (strict type-check — project memory rule: vitest does not type-check).
- Reconciliation note (Phase 35 lesson / Pitfall 7): this Wave-3 plan moves files that Wave-4 (36-06) edits. Its `components/galley/*` promotion + `voice-pass/[runId]/page.tsx` MUST be on master before Wave 4 begins so 36-06's AnnotationMark voice variant + VoicePassRail edit the promoted files, not the old paths.
</verification>

<success_criteria>
Voice Pass has its own lit reading surface scoped to voice axes with a per-screen tell count (VOX-01) and an on-demand judge trigger (VOX-04); Review Desk is unaffected; the galley stack is shared, not duplicated.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-04-SUMMARY.md`.
</output>
