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
