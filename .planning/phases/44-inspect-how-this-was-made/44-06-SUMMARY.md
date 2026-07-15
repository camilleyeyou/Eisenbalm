---
phase: 44-inspect-how-this-was-made
plan: 06
subsystem: ui
tags: [react, nextjs, convex, inspector, dispatch-control, context-provider, honesty-rules]

# Dependency graph
requires:
  - phase: 44-02
    provides: "agent_run_payloads.inputKeys additive field, the untruncated top-level input-key list this container reads for the missing-inputs diff"
  - phase: 44-03
    provides: "lib/inspectorArtifact.ts's resolveInspectorStep/runKeyToPromptKey -- the pure agentKey/promptKey resolution + editor_gate_1<->editor_gate1 alias this container composes"
  - phase: 44-04
    provides: "lib/inspector/missingInputsDiff.ts (computeMissingInputs) and lib/inspector/outputDivergence.ts (computeOutputDivergence) -- the two pure diagnostics this container feeds real Convex data into"
  - phase: 44-05
    provides: "components/inspector/InspectorPanel.tsx (pure presentation, InspectorArtifact/InspectorPanelProps types) and InspectorFooter.tsx -- the panel this container renders and feeds"
provides:
  - "components/inspector/InspectorProvider.tsx -- the single inspector context/provider (useInspector(), openInspector/closeInspector), exactly one panel instance app-wide"
  - "components/inspector/InspectorContainer.tsx -- the data-fetching container: resolver + on-demand Convex reads + missing-inputs diff + output divergence + Instructions-tab instruction-version mapping + sharedRules assembly -> InspectorArtifact -> InspectorPanel"
  - "app/(dashboard)/layout.tsx wraps the dashboard shell in the one mounted InspectorProvider, covering all six entry points including /my-tasks"
  - "__tests__/InspectorProvider.test.tsx filled with 4 live assertions (was Wave-0 it.todo scaffold)"
affects: [44-07-entry-points-draft-voice-factcheck, 44-08-entry-points-approval-mytasks-org, 44-09-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React context + single-activeKey gate: InspectorProvider renders at most one <InspectorContainer> regardless of how many components call openInspector, because there is exactly one activeKey in the context, never a per-caller instance"
    - "On-demand (non-subscribed) Convex reads in the container, mirroring AgentIOPanel's node-click pattern (Phase 23/37) -- useQuery calls are always made (Rules of Hooks), with args conditionally 'skip'ped, never the hook call itself"
    - "Bonus-variant two-pass resolution: the pure resolver's first-pass promptKey (null for 'bonus') is refined in the container once payload.outputSnapshot.bonusType is in scope, then a second (initially-skipped) getActive query fires for the resolved variant"
    - "Instruction-version mapping is the container's one honesty-critical assembly step: promptVersion.version/content are mapped into artifact.instructionVersion/instructions explicitly, never left unset when a fetched row exists"

key-files:
  created:
    - apps/dispatch-control/components/inspector/InspectorProvider.tsx
    - apps/dispatch-control/components/inspector/InspectorContainer.tsx
  modified:
    - "apps/dispatch-control/app/(dashboard)/layout.tsx"
    - apps/dispatch-control/__tests__/InspectorProvider.test.tsx

key-decisions:
  - "Built InspectorContainer.tsx (nominally Task 2's deliverable) before committing InspectorProvider.tsx (Task 1), because Provider statically imports Container -- Task 1's own test verification could not resolve the import otherwise. Both files existed on disk before either was committed; the two were staged and committed separately (Container's commit landed second in the commit log) so each commit's diff still maps cleanly to its task's stated files_modified scope, mirroring the 44-05 precedent (InspectorFooter built ahead of its literal task slot for the same reason)."
  - "Container passes computeOutputDivergence only { completedAt: agentRun?.completedAt } -- no changedSinceCheck/lastChangeAt signal is fetched for any artifact type. The task's own <action> text scopes this container's Convex reads to agentRuns.byRunId/payloadByRunIdAgentKey/promptVersions.getActive only; wiring the claim_checks changedSinceCheck machinery through here was explicitly marked optional ('if trivially in scope; otherwise pass nothing -> honest unknown', D-11) and was left out to stay within the plan's scoped read list -- divergence renders 'unknown' rather than a false 'unchanged'."
  - "artifact.output uses prettyJson(outputSnapshot) (full/near-full content, truncation-note-eligible) rather than summarize() (a compact one-line key/value list) -- the InspectorArtifact type comment marks asked/result as 'never JSON' but does not carry that restriction for output, and InspectorPanel's own OutputTab already expects an output string long enough to trigger its length>=2000 truncation note."
  - "artifact.title/meta use displayNameForAgentKey(promptKey ?? step.agentKey) from the existing prompt-lab agentList.ts helper (curated display names + humanizeAgentKey fallback) rather than hand-rolling a new title map -- reuses an established, already-tested formatter instead of inventing a second one."

patterns-established:
  - "components/inspector/ now holds the full inspector stack (Provider, Container, Panel, Footer) -- lib/inspector/ stays reserved for pure Convex-free modules; the container is the ONLY inspector file that calls useQuery."

requirements-completed: [INS-01, INS-02, INS-03, INS-04, INS-05, INS-06]

# Metrics
duration: ~25min
completed: 2026-07-15
---

# Phase 44 Plan 06: Inspector Provider + Container + Mount Summary

**Single InspectorProvider context (one panel instance app-wide) plus a Convex-backed InspectorContainer that assembles a real InspectorArtifact -- including the mapped active-version Instructions content and the sharedRules (with the qa rubric fetched) -- mounted once at the (dashboard) root layout so all six entry points, including /my-tasks, share the same openInspector.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-15T13:40:00-07:00 (approx, session start)
- **Completed:** 2026-07-15T13:45:48-07:00
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `InspectorProvider.tsx` exposes `openInspector`/`closeInspector` via `useInspector()`; renders at most one `<InspectorContainer>` regardless of how many components call `openInspector` -- proven by a live test where two independent opener buttons each open a different key and only one container node ever exists, with the second call replacing (not adding to) the first
- `useInspector()` throws a clear error when used outside `<InspectorProvider>` -- no silent `undefined` reads
- `openInspector` accepts either the string-encoded key form (parsed via `parseArtifactKey`) or a structured `InspectorArtifactKey` directly; a malformed string is a no-op, never a crash
- `InspectorContainer.tsx` composes `resolveInspectorStep` (44-03) with three on-demand, non-subscribed Convex reads (`agentRuns.byRunId`, `agentRuns.payloadByRunIdAgentKey`, `promptVersions.getActive` x2 for prompt + qa rubric), mirroring `AgentIOPanel`'s established node-click pattern
- Finalizes the `bonus` artifact's Instructions-tab `promptKey` from the run's own `outputSnapshot.bonusType` (`bonus_big_budget`/`bonus_jingle`/`bonus_spec_ad`), degrading to `null` (never a guess) when the snapshot is absent or malformed
- Maps the fetched active `prompt_versions` row into `artifact.instructionVersion`/`artifact.instructions` -- the exact data the Instructions tab needs to render real content for the 11 externalized agents, closing the "fetched but never assembled" gap (§44.9, INS-04)
- Assembles `artifact.sharedRules` from `NON_EXTERNALIZED_SHARED_RULES` for the 5 non-externalized agents (`VOICE_CONSTRAINTS`/`STRUCTURE_CONTRACT` for the 4 narrative writers, the fetched `rubric` active-version content for `qa`) -- never omitted, never a bare one-liner
- Computes the redefined missing-inputs diff (`computeMissingInputs`) and the output-divergence predicate (`computeOutputDivergence`), and degrades every remaining field honestly (`'not recorded'`, `'—'` via `InspectorPanel`'s own undefined-safe rendering) instead of throwing when a step/row/version is absent
- Mounted the single `<InspectorProvider>` at `app/(dashboard)/layout.tsx`, wrapping the whole dashboard shell so every route under `(dashboard)/` -- all five issue-workspace stages AND `/my-tasks`, which is not under the Issue Workspace frame -- shares one opener and one panel
- Full `pnpm --filter dispatch-control test` (96 files, 825 tests passing, 2 pre-existing unrelated `it.todo`s in `workspace-upsert.test.ts`) and `pnpm --filter dispatch-control build` both pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Build InspectorProvider (context) + fill InspectorProvider.test.tsx** - `86ec119` (feat) -- `InspectorContainer.tsx` was built on disk first (uncommitted at this point) so Task 1's own import/test verification could resolve; only `InspectorProvider.tsx` + the test file were staged/committed here
2. **Task 2: Build InspectorContainer (resolver + Convex reads -> InspectorArtifact -> panel)** - `f58aefd` (feat)
3. **Task 3: Mount the single InspectorProvider at the (dashboard) root layout** - `9f8cd50` (feat)

## Files Created/Modified

- `apps/dispatch-control/components/inspector/InspectorProvider.tsx` - the one inspector context/provider; `useInspector()`, `openInspector`/`closeInspector`, at most one mounted container
- `apps/dispatch-control/components/inspector/InspectorContainer.tsx` - the data-fetching container: resolver + on-demand Convex reads + diff + divergence + Instructions-tab assembly -> `InspectorPanel`
- `apps/dispatch-control/app/(dashboard)/layout.tsx` - wraps the dashboard shell in the one mounted `<InspectorProvider>`
- `apps/dispatch-control/__tests__/InspectorProvider.test.tsx` - 4 live assertions replacing the Wave-0 `it.todo` scaffold (open/close, single-instance-across-callers, malformed-key no-op, throw-outside-provider)

## Decisions Made

- **Built `InspectorContainer.tsx` before committing `InspectorProvider.tsx`, then committed them as two separate task commits.** `InspectorProvider.tsx` statically imports `InspectorContainer` -- Task 1's own `pnpm test` verification would fail to compile without it existing on disk. Rather than fabricate a throwaway stub (which Task 2 would then have to discard/replace), the real container was written first, but only `InspectorProvider.tsx` + its test were `git add`ed for Task 1's commit; `InspectorContainer.tsx` was staged and committed separately immediately after, once Task 2's own `pnpm build` verification passed against it. This keeps each commit's diff scoped to its task's stated `files_modified` while respecting the real dependency direction (Provider depends on Container, not vice versa). Mirrors the 44-05 precedent (`InspectorFooter.tsx` built ahead of its literal Task 3 slot because Task 2's own build verification required it).
- **`computeOutputDivergence` is called with only `{ completedAt: agentRun?.completedAt }` for every artifact type -- no `changedSinceCheck`/`lastChangeAt` signal is fetched.** The plan's own Task 2 text scopes this container's reads to `agentRuns.byRunId`/`payloadByRunIdAgentKey`/`promptVersions.getActive` and explicitly frames the claim/section changed-since wiring as optional ("if trivially in scope; otherwise pass nothing -> honest 'unknown'", D-11's bounding rule). Wiring `claim_checks.changedSinceCheck` through this container would add a new Convex read outside the plan's stated interface list; omitting it keeps the container's scope exact and still satisfies D-11 exactly (divergence renders `'unknown'`, never a false `'unchanged'`).
- **`artifact.output` uses `prettyJson(outputSnapshot)`, not `summarize(outputSnapshot)`.** `InspectorArtifact`'s type comment marks `asked`/`result` as "never JSON" (so those two use `summarize()`, a compact one-line key list) but carries no such restriction for `output`, and `InspectorPanel.tsx`'s own `OutputTab` already expects `artifact.output` to be long enough to trigger its `length >= 2000` truncation note -- `summarize()`'s 120-char one-liner would never reach that threshold, silently breaking the existing truncation-note UI.
- **`artifact.title`/`meta` reuse `displayNameForAgentKey()` from `prompt-lab/_components/agentList.ts`** (curated `AGENT_DISPLAY_NAMES` + `humanizeAgentKey` fallback) instead of a new title-formatting helper -- an already-tested, already-established formatter, applied to `promptKey ?? step.agentKey` so the bonus variant and `editor_gate1` alias both get their nicer curated names when resolved.

## Deviations from Plan

None beyond the build-ordering sequencing documented above (which itself mirrors an established 44-05 precedent, not a new pattern) -- no Rule 1-4 auto-fixes were needed. The container's Convex reads, the missing-inputs diff, the divergence predicate, the instruction-version mapping, the sharedRules assembly, and the single-mount layout wiring all match the plan's `<action>` text and `must_haves` exactly.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useInspector()` (`openInspector`/`closeInspector`) is live at every route under `(dashboard)/` via the one mounted `InspectorProvider` -- Plans 44-07/44-08 can call `openInspector(key)` from any of the remaining five entry points (brief org card, draft passage toolbar, fact-check claim detail, voice finding, approval recommendation) and `/my-tasks`, and the same real, Convex-backed panel will open.
- `InspectorContainer.tsx` already handles all six `InspectorArtifactType`s (`founder`/`claim`/`rec`/`org`/`signal`/`qa`) via the pure resolver -- no per-entry-point container logic is needed in 44-07/44-08, only wiring `openInspector(encodeArtifactKey(...))` calls at each surface.
- No blockers. `pnpm --filter dispatch-control test` (96 files / 825 tests passing) and `pnpm --filter dispatch-control build` both green; exactly one `InspectorProvider` mount exists in `app/`.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/components/inspector/InspectorProvider.tsx
- FOUND: apps/dispatch-control/components/inspector/InspectorContainer.tsx
- FOUND: apps/dispatch-control/app/(dashboard)/layout.tsx
- FOUND: apps/dispatch-control/__tests__/InspectorProvider.test.tsx
- FOUND: .planning/phases/44-inspect-how-this-was-made/44-06-SUMMARY.md
- FOUND: 86ec119 (Task 1 commit)
- FOUND: f58aefd (Task 2 commit)
- FOUND: 9f8cd50 (Task 3 commit)
