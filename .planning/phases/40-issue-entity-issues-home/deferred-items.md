# Deferred Items — Phase 40

Out-of-scope discoveries logged during plan execution (not fixed per the
executor's scope boundary — pre-existing issues unrelated to the current
task's changes).

## 40-04 — pre-existing `tsc --noEmit` errors, unrelated to this plan's files

`pnpm --filter dispatch-control exec tsc --noEmit` reports pre-existing type
errors in files this plan did not touch:

- `__tests__/spanResolver.test.ts` — several `TS18048`/`TS2532` possibly-undefined errors
- `__tests__/syntheticPortableText.test.ts` — several `TS18048`/`TS2532`/`TS2339`/`TS2769` errors, including a `SyntheticMarkDef`/`ClaimSpanMarkDef` type mismatch
- `__tests__/voicePassAxis.test.ts` — `TS2339: Property 'glob' does not exist on type 'ImportMeta'` and `TS2532` possibly-undefined errors
- `__tests__/VoicePassScreen.test.tsx` — `TS5097` import-extension error
- `__tests__/WriterExpansion.test.tsx` — `TS2345` type-mismatch error

Confirmed none of these originate in `lib/derivedState.ts`,
`lib/issueRouteResolver.ts`, or `lib/repetitionNoteClient.ts` (the three
files 40-04 created) — verified via
`tsc --noEmit -p tsconfig.json 2>&1 | grep -E "derivedState|issueRouteResolver|repetitionNoteClient"`
returning no matches. Not fixed here; flagged for a future cleanup pass.

## 40-05 — broader pre-existing `tsc --noEmit` error surface (unmasked after the Convex codegen fix)

After fixing the `convex codegen` blocker (see "Blocking-issue fix" below) and
regenerating `convex/_generated/api.d.ts`, a full untruncated
`pnpm --filter dispatch-control exec tsc --noEmit` run shows a much wider
pre-existing set of test-file errors than 40-04 logged (40-04's own tail
was truncated to 100 lines and never saw the full list). None of these
originate in this plan's files
(`app/(dashboard)/issues/page.tsx` or `app/(dashboard)/issues/_components/*`)
— confirmed via
`tsc --noEmit -p tsconfig.json 2>&1 | grep -E "app/\(dashboard\)/issues/(page|_components)"`,
which returns only the pre-existing 40-01 RED scaffold reference to
`HoldDialog.tsx` (Plan 40-07 scope, not yet built):

- `__tests__/HoldDialog.test.tsx` — `TS2307: Cannot find module '.../HoldDialog'` (expected — RED scaffold for Plan 40-07)
- Widespread `TS2339: Property 'glob' does not exist on type 'ImportMeta'` across most `convex-test`-backed suites (`issues.test.ts`, `evalScores.test.ts`, `runs.test.ts`, `saveVersion.test.ts`, `activate.test.ts`, `promptVersionsEvalGate.test.ts`, `qaCorrectionsResolution.test.ts`, `charityCorrections.test.ts`, `auditLog.test.ts`, `auditViewer.test.ts`, `agentRuns.test.ts`, `convexAuthLockdown.test.ts`) — a tsconfig `lib`/`types` gap unrelated to any single plan's files
- Assorted pre-existing `TS2532`/`TS18048` possibly-undefined and `TS2345`/`TS2493`/`TS2769` type-mismatch errors in `EvalCenter.test.tsx`, `EvalDrawer.test.tsx`, `AgentNode.test.tsx`, `AwaitingYouInbox.test.tsx`, `costRollup.test.ts`, `googleFontLoader.test.ts`, `review-desk-editors.test.tsx`, `scoreClient.test.ts`

Not fixed here (out of scope per the executor's scope boundary — none of
these files were touched by this plan). Flagged for a future cleanup pass.

## 40-05 — Blocking-issue fix (Rule 3): `convex codegen` failed on an unrelated script

`convex codegen`/`convex dev` bundles every file under `convex/` as a
potential Convex function. `convex/scripts/check-deploy-parity.mjs`
(added Phase-unrelated, commit `5895732`) is a standalone Node CLI
diagnostic that uses `node:child_process`/`node:fs`/`node:path`/`node:url`
without a `"use node"` directive — this made `convex codegen` fail with
an esbuild bundling error, which meant `convex/_generated/api.d.ts` could
never be regenerated locally, which meant the new `issues` module (Plan
40-02) never appeared in the generated types, which blocked this plan's
own `tsc --noEmit` acceptance check (`api.issues.*` calls in
`page.tsx`/`_components/*.tsx`). Moved the script to repo-root
`scripts/check-deploy-parity.mjs` (updated its internal path derivation,
`package.json`'s `check:convex-parity` script, and `convex/README.md`'s
reference) — it was never meant to be a Convex function (it shells out to
`npx convex function-spec` itself). Ran `pnpm --filter @eisenbalm/convex
codegen` after the move; it regenerated `convex/_generated/api.d.ts`
(2-line diff — the `issues` module import/entry) LOCALLY, which is what
this plan's `tsc --noEmit` needs. It does NOT, by itself, satisfy the
live-deploy sync 40-02 deferred to Plan 40-09: running
`node scripts/check-deploy-parity.mjs` immediately afterward still
reports `issues:ensureByNumber` and `issues:markPublished` as called by
the pipeline but absent from the live `dev:modest-magpie-797` function
spec. Plan 40-09 still needs its own
`pnpm --filter @eisenbalm/convex dev:once` to actually deploy `issues.ts`
before any dashboard `useQuery`/`useMutation` call against `api.issues.*`
will work in the browser — unchanged from 40-02's own note.
