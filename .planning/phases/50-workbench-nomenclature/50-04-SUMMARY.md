---
phase: 50-workbench-nomenclature
plan: 04
subsystem: ui
tags: [convex, nextjs, react, prompt-lab, inspector, schema-migration]

# Dependency graph
requires:
  - phase: 50-workbench-nomenclature (50-00)
    provides: nomenclature label source-of-truth + WBN scope groundwork
  - phase: 44-inspection-panel
    provides: "InspectorFooter/InspectorPanel/InspectorContainer — the 'Improve this agent →' deep-link seam and the sectionName/output artifact fields this plan forwards"
  - phase: 24-prompt-console-versioning
    provides: "prompt_versions table + saveVersion/getActive/listForAgent mutations this plan extends additively"
provides:
  - "prompt_versions.originRef — additive, optional {runId, sectionName, excerpt, issueNumber?} back-reference"
  - "InspectorFooter 'Improve this agent →' deep link carrying fromRun/section/excerpt query params"
  - "AgentPromptEditorView 'why this draft exists' render (OriginBanner) reading either the deep-link params or the persisted originRef"
  - "saveVersion mutation persists originRef when supplied, from a deep-linked save"
affects: [prompt-lab, run-monitor-inspector, agent-instructions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive/optional Convex fields documented in API_CONTRACTS.md BEFORE the schema edit (contract-first), then convex/schema.ts + the mutation, then a live dev:once sync — same order as prior additive-field plans"
    - "Named .test.ts (not .test.tsx) files that render React components get an explicit jsdom entry in vitest.config.ts's environmentMatchGlobs + use React.createElement instead of JSX (mirrors 50-03's registryDoNotUse.test.ts precedent)"
    - "Heavy client views split a small, dependency-free named export (OriginBanner) out of the main default-exported component specifically so it can be unit-tested without mocking the view's full dependency tree (Clerk, VersionHistoryPanel's useRole, EvalDrawer, etc.)"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/promptOrigin.ts
    - apps/dispatch-control/__tests__/promptVersionOrigin.test.ts
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/promptVersions.ts
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx
    - apps/dispatch-control/components/inspector/InspectorPanel.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/[agentKey]/page.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptSaveDialog.tsx
    - apps/dispatch-control/vitest.config.ts

key-decisions:
  - "originRef is captured only from InspectorPanel's ALREADY-derived sectionName + firstProseExcerpt(sectionBlocks) — no new Convex query, no inference; matches D-13's 'a stored reference, never a guess'"
  - "Only 'Improve this agent →' carries the origin query params; 'Compare instruction versions' keeps the unmodified promptHref (plan explicitly scoped the change to one action)"
  - "AgentPromptEditorView prefers the persisted active.originRef over the session's deep-link params once a version has actually been saved with one, so the banner stays accurate after the deep-linked save lands"
  - "Only the deep-link's OWN originRef is forwarded to saveVersion on save (not the merged/displayed originRef) — prevents re-stamping an old origin onto later, unrelated edits of the same prompt"
  - "why this draft exists' extracted into a standalone named export (OriginBanner) so the round-trip test doesn't need to mock Clerk/useRole/EvalDrawer/VersionHistoryPanel just to prove a banner renders"

patterns-established:
  - "Contract-first additive Convex field: API_CONTRACTS.md commit precedes the schema.ts + mutation commit, which is followed by a verified `dev:once` live sync — every step is its own commit"

requirements-completed: [WBN-04]

# Metrics
duration: ~35min
completed: 2026-07-17
---

# Phase 50 Plan 04: Why This Draft Exists (Origin Back-Reference) Summary

**Additive `prompt_versions.originRef` + inspector deep-link + Agent Instructions "why this draft exists" render, contract-first and Convex-synced**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-17T01:45:00Z (approx.)
- **Completed:** 2026-07-17T02:21:00Z
- **Tasks:** 2
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- `prompt_versions` gained an additive, optional `originRef` field (`{runId, sectionName, excerpt, issueNumber?}`), documented in `docs/API_CONTRACTS.md` §4A.2c BEFORE the schema/mutation edit (separate, earlier commit), then landed in `convex/schema.ts` + `convex/promptVersions.ts::saveVersion`, then synced live via `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797`
- The inspector's "Improve this agent →" (`InspectorFooter.tsx`) now carries `fromRun`/`section`/`excerpt` query params into `/prompt-lab/[agentKey]`, sourced from data `InspectorPanel` already derives (`sectionName` prop + `firstProseExcerpt` over the artifact's output) — no new fetch, no new subscription
- `AgentPromptEditorView` renders a "why this draft exists" banner (`OriginBanner`) from either the deep-link params or a persisted `active.originRef`, linking back to `/run-monitor/runs/[runId]`; on save from a deep-linked session, the origin is forwarded through `PromptEditor` → `PromptSaveDialog` → `saveVersion` and persists
- `promptVersionOrigin.test.ts` proves the full loop: the deep link's query params, the `saveVersion` call receiving `originRef` (and NOT receiving it for ordinary saves), and `OriginBanner` reading back that same object (and rendering nothing when absent)

## Task Commits

Each task was committed atomically:

1. **Contract-first: amend API_CONTRACTS.md §4A.2c** - `e27d083` (docs)
2. **Task 1: add originRef to schema.ts + promptVersions.ts, live-sync Convex** - `5a9aec2` (feat)
3. **Task 2: inspector deep-link + Agent Instructions render + test** - `030a14f` (feat)

_Note: the contract-first requirement made this effectively a 3-commit sequence (docs → schema → feature) rather than 2 — the plan's own hard rule required the extra split._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §4A.2c documents the additive `originRef` field + `saveVersion`'s new optional arg, written BEFORE any code change
- `convex/schema.ts` - `prompt_versions.originRef: v.optional(v.object({runId, sectionName, excerpt, issueNumber?}))`
- `convex/promptVersions.ts` - `saveVersion` accepts + persists `originRef` when supplied; all other versioning behavior unchanged
- `apps/dispatch-control/components/inspector/InspectorFooter.tsx` - new `sectionName`/`excerpt` props; a separate `improveHref` (only for "Improve this agent →") carries the origin params
- `apps/dispatch-control/components/inspector/InspectorPanel.tsx` - forwards `sectionName` + the already-derived `quotedText` (as `excerpt`) to `InspectorFooter`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/[agentKey]/page.tsx` - reads `fromRun`/`section`/`excerpt` search params into a `deepLinkOrigin` prop
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx` - new exported `OriginBanner`; computes `originRef = active?.originRef ?? deepLinkOrigin`; forwards `deepLinkOrigin` (not the merged value) to `PromptEditor` on save
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx` - new optional `originRef` prop, forwarded to `PromptSaveDialog`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptSaveDialog.tsx` - new optional `originRef` prop, included in the `saveVersion` call when present
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/promptOrigin.ts` - shared `PromptOriginRef` type (created — avoids leaf save-side components importing from their own parent view)
- `apps/dispatch-control/vitest.config.ts` - `environmentMatchGlobs` entry forcing jsdom for `promptVersionOrigin.test.ts`
- `apps/dispatch-control/__tests__/promptVersionOrigin.test.ts` - new test file (created)

## Decisions Made
- Reused `InspectorPanel`'s existing `firstProseExcerpt(sectionBlocks)` derivation (already computed for "Ask agent to revise") as the origin excerpt, rather than adding a second excerpt-derivation path — one real, verbatim substring of the run's actual output, gated to only exist for drafted-section artifacts (the same honest-degrade the panel already relies on)
- `originRef` display precedence: persisted (`active.originRef`) over session deep-link params, so the banner reflects the durable fact once a save has landed rather than the ephemeral URL state
- On save, forward ONLY `deepLinkOrigin` (the session's own origin) to `saveVersion`, not the merged/displayed `originRef` — prevents a later, unrelated edit under the same URL from silently re-stamping an old origin
- Extracted `OriginBanner` as its own named export purely for testability — it has zero Convex/Clerk dependencies, so the round-trip test never needs to mock `useRole`/`useUser`/`EvalDrawer`/`VersionHistoryPanel`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Threaded `originRef` through `PromptEditor.tsx` and `PromptSaveDialog.tsx` (not in the plan's file list)**
- **Found during:** Task 2
- **Issue:** The plan's Task 2 action requires "when a draft is CREATED from this deep link, pass the assembled originRef object to the version-creating mutation" — but the actual `saveVersion` call site lives in `PromptSaveDialog.tsx`, reached via `PromptEditor.tsx`, neither of which the plan's `<files>` tag listed for Task 2.
- **Fix:** Added an optional `originRef` prop to both components, forwarded verbatim from `AgentPromptEditorView` down to the `saveVersion` call. Necessary wiring to fulfill the plan's own stated action — no behavior change for the 99% non-deep-linked case (the prop is simply absent).
- **Files modified:** `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx`, `.../PromptSaveDialog.tsx`
- **Verification:** `promptVersionOrigin.test.ts` (insert side) + full `PromptSaveDialog.test.tsx`/`PromptEditor.test.tsx` suites still green
- **Commit:** `030a14f`

**2. [Rule 3 - Blocking] Forwarded `sectionName`/`excerpt` through `InspectorPanel.tsx` (not in the plan's file list)**
- **Found during:** Task 2
- **Issue:** `InspectorFooter`'s new `sectionName`/`excerpt` props have no real data source unless the caller (`InspectorPanel.tsx`) passes them through — without this the deep-link params could never be populated from a live artifact.
- **Fix:** Passed the panel's existing `sectionName` prop and its already-computed `quotedText` (aliased as `excerpt`) straight into `<InspectorFooter>`.
- **Files modified:** `apps/dispatch-control/components/inspector/InspectorPanel.tsx`
- **Verification:** `InspectorPanel.test.tsx` (11/11) unaffected/green
- **Commit:** `030a14f`

**3. [Rule 3 - Blocking] Added a `promptOrigin.ts` module + a `vitest.config.ts` jsdom override (not in the plan's file list)**
- **Found during:** Task 2
- **Issue:** (a) `PromptEditor.tsx`/`PromptSaveDialog.tsx` needed the `PromptOriginRef` type without creating a reverse import from their own parent (`AgentPromptEditorView.tsx`). (b) `promptVersionOrigin.test.ts` is named `.test.ts` (per the plan's own file list) but renders React components — without an explicit jsdom override it would run in the default `node` environment and fail on DOM APIs.
- **Fix:** (a) extracted the shared type into a new `promptOrigin.ts`. (b) added a `vitest.config.ts` entry, mirroring the exact precedent Phase 50-03 already set for `registryDoNotUse.test.ts` (including its documented `React.createElement`-not-JSX workaround for `.test.ts` files).
- **Files modified:** `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/promptOrigin.ts` (new), `apps/dispatch-control/vitest.config.ts`
- **Verification:** `promptVersionOrigin.test.ts` — 7/7 green; full suite — 123 files / 1003 tests green
- **Commit:** `030a14f`

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking, necessary wiring/tooling to fulfill the plan's own stated action and test requirement)
**Impact on plan:** No scope creep — every deviation is plumbing required to make the plan's two stated tasks actually work end-to-end. No architectural changes, no new tables, no behavior change for the non-deep-linked save path.

## Issues Encountered
- `saveSpy.mock.calls[0][0]` triggered a pre-existing TS `noUncheckedIndexedAccess`-style error under `tsc --noEmit` for the "no originRef" assertion; rewritten as `expect(saveSpy).toHaveBeenCalledWith(expect.not.objectContaining({ originRef: expect.anything() }))` to avoid the indexing type issue entirely. `pnpm --filter dispatch-control typecheck` still reports many PRE-EXISTING, unrelated errors across other test files (evalScores.test.ts, spanResolver.test.ts, syntheticPortableText.test.ts, etc. — none touched by this plan); confirmed none of this plan's files appear in that output, and `pnpm --filter dispatch-control build` (the plan's actual gate, and the one CLAUDE.md/memory mandates before declaring a frontend plan done) exits 0 clean.

## User Setup Required
None - no external service configuration required (Convex was already synced as part of Task 1).

## Next Phase Readiness
- WBN-04's "why this draft exists" bridge is fully wired end-to-end (capture → persist → render); ready for the remaining Phase 50 plans (WBN-01/02/03/05/06) which touch nav labels, Run Details, and the nomenclature sweep — none of which depend on this plan's surfaces.
- No blockers. The origin banner degrades gracefully (renders nothing) for the overwhelming majority of prompt-lab visits that aren't deep-linked from the inspector — verified via the "renders nothing when no origin is present" test case.

---
*Phase: 50-workbench-nomenclature*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 13 created/modified files verified present on disk; all 3 task commits (`e27d083`, `5a9aec2`, `030a14f`) verified in git history.
