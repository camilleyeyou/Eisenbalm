# Deferred Items — Phase 49

## Plan 49-04 (convex-editor-gate)

### Pre-existing `pnpm typecheck:dispatch-control` failures (out of scope)

While verifying Plan 49-04, `pnpm typecheck:dispatch-control` was run as an extra safety check
(beyond the plan's specified `pnpm vitest run` commands). It fails with ~30 pre-existing TS errors,
none of which are in any file this plan touches
(`convex/lib/auth.ts`, `convex/promptVersions.ts`, `convex/charities.ts`,
`activate.test.ts`, `charitiesDoNotUse.test.ts`, `convexAuthLockdown.test.ts`,
`promptVersionsEvalGate.test.ts`). The failures are in:

- `__tests__/StageContextPanels.test.tsx` (2 errors — possibly-undefined object access)
- `__tests__/StoryBriefScreen.test.tsx` (1 error — spread-argument tuple typing)
- `__tests__/syntheticPortableText.test.ts` (~25 errors — possibly-undefined + `SyntheticMarkDef`/
  `ClaimSpanMarkDef` type-narrowing mismatches)
- `__tests__/voicePassAxis.test.ts` (3 errors — `ImportMeta.glob` typing + possibly-undefined)
- `__tests__/WriterExpansion.test.tsx` (1 error — `HTMLElement | undefined` argument)

Per the deviation-rules scope boundary ("Only auto-fix issues DIRECTLY caused by the current
task's changes"), these are NOT fixed by this plan. `pnpm vitest run` (the plan's actual verify
command, and the full `pnpm test` suite) both pass cleanly — vitest does not run `tsc`, so these
latent `tsc --noEmit` errors do not block test execution. Flagging per the project memory note
("vitest doesn't type-check ...") for whichever future phase/plan owns `dispatch-control` test-file
type hygiene.

## Plan 49-07 (wire-locked-controls) — Task 4

### `pnpm --filter dispatch-control typecheck` — much larger pre-existing debt than 49-04 recorded (out of scope)

Task 4's actual verify gate, `pnpm --filter dispatch-control build`, **passes cleanly (exit 0,
no type/lint errors)** with all seven files wrapped in `<LockedControl>` — this is the gate the
plan specifies (Next's build type-checks the app graph; vitest doesn't type-check at all).

As an extra safety check (mirroring 49-04's practice), `pnpm --filter dispatch-control typecheck`
(bare `tsc --noEmit`, which additionally walks every file matched by `__tests__/**/*.ts(x)` per
`tsconfig.json`'s `include`, regardless of whether Next's build graph reaches it) was also run.
It now reports **232 errors across 30 files** — substantially more than the ~30 errors across 5
files that 49-04 recorded. None of the affected files were touched by this plan (confirmed by
diff): the 9 files this plan modifies/creates
(`RevisionFlow.tsx`, `RevisionComparisonCard.tsx`, `FactCheckScreen.tsx`, `VoicePassRail.tsx`,
`DecisionRail.tsx`, `ReviewDecisionPanel.tsx`, `VersionHistoryPanel.tsx`, `RegistryTable.tsx`,
`RevisionFlow.test.tsx`, `DecisionRail.test.tsx`, `VoicePassRail.test.tsx`,
`VoicePassScreen.test.tsx`, plus the two new `*.roleGate.test.tsx` files) introduce **zero** new
`tsc` errors.

The growth appears to be cumulative test-infrastructure debt picked up across the phases executed
since 49-04 (e.g. `comments.test.ts` from 49-05 alone contributes 11), dominated by two repeating
patterns, neither related to roles/permissions:
- `Property 'glob' does not exist on type 'ImportMeta'` — the `convex-test` harness's
  `import.meta.glob(...)` call, used at the top of nearly every Convex mutation test file, isn't
  covered by this tsconfig's `ImportMeta` typing (`activate.test.ts`, `charitiesDoNotUse.test.ts`,
  `charityCorrections.test.ts`, `runs.test.ts`, `agentRuns.test.ts`, `auditLog.test.ts`,
  `auditLogDecision.test.ts`, `auditViewer.test.ts`, `comments.test.ts`, `evalScores.test.ts`,
  `costRollup.test.ts`, `scoreClient.test.ts`, `saveVersion.test.ts`, `issues.test.ts`,
  `convexAuthLockdown.test.ts`, `promptVersionsEvalGate.test.ts`,
  `qaCorrectionsResolution.test.ts`, `claimChecksFactcheck.test.ts`,
  `setLastVisitedStage.test.ts`, `voicePassAxis.test.ts`, and more)
- `noUncheckedIndexedAccess`-style possibly-undefined fixture/array access in test bodies
  (`spanResolver.test.ts`, `syntheticPortableText.test.ts`, `EvalDrawer.test.tsx`,
  `AwaitingYouInbox.test.tsx`, `CreatePanel.test.tsx`, `review-desk-editors.test.tsx`, etc.)

Per the deviation-rules scope boundary, these are NOT fixed by this plan — none are directly
caused by the LockedControl wiring, and `pnpm --filter dispatch-control build` (the plan's actual
Task 4 gate) is green. Flagging the updated, larger count for whichever future phase/plan takes on
`dispatch-control` test-file type hygiene as a dedicated task (likely worth a shared
`import.meta.glob` type shim rather than per-file fixes).

## Plan 49-08 (comments-affordance-mount) — Task 3

### `pnpm --filter dispatch-control typecheck` (bare `tsc --noEmit`) — 4 new errors in the new test file, same pre-existing class

Task 3's actual verify gate, `pnpm --filter dispatch-control build`, **passes cleanly (exit 0)**
with `IssueComments.tsx` created and mounted in both `layout.tsx` and `MyTasksScreen.tsx` — this is
the gate the plan specifies.

As an extra safety check (mirroring 49-04's/49-07's practice), bare `pnpm --filter dispatch-control
typecheck` was also run. `__tests__/IssueComments.test.tsx` contributes 4 of its errors:

```
__tests__/IssueComments.test.tsx(50,44): error TS2345: Argument of type 'Mock<Procedure>' is not
  assignable to parameter of type 'ReactMutation<FunctionReference<"mutation">>'.
(+3 more, same shape, lines 62/72/96)
```

This is the exact same error class `EvalDrawer.test.tsx` (and others) already contribute today —
`vi.mocked(useMutation).mockReturnValue(...)`'s return type doesn't satisfy Convex's
`ReactMutation<FunctionReference<"mutation">>` under bare `tsc --noEmit`, a mismatch vitest itself
never surfaces (mocks are untyped at runtime) and Next's build type-checker doesn't reach (it only
walks the app's real import graph, not `__tests__/**`). Not a new category of debt — adding to the
existing count rather than deviating from the established `vi.mocked(useQuery/useMutation)` mocking
idiom used by every other component test in this codebase. No fix applied, per the deviation-rules
scope boundary and 49-04/49-07 precedent.
