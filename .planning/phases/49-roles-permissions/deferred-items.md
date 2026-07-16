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
