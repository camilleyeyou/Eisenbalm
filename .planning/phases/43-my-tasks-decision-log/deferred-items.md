# Deferred Items — Phase 43

Out-of-scope discoveries logged during plan execution, per the executor's
scope-boundary rule (fix only what the current task's changes directly
caused). Not fixed here.

## 43-03 (derivetasks-age-deeplink-fix)

- `pnpm --filter dispatch-control typecheck` reports pre-existing errors in
  three files unrelated to this plan's changes (`apps/dispatch-control/lib/derivedState.ts`,
  `apps/dispatch-control/__tests__/derivedState.test.ts`):
  - `__tests__/syntheticPortableText.test.ts` — multiple `TS18048`
    ("possibly undefined") + `TS2769` overload-mismatch errors on
    `SyntheticMarkDef`/`ClaimSpanMarkDef` narrowing.
  - `__tests__/voicePassAxis.test.ts` — `TS2339` (`import.meta.glob` not on
    `ImportMeta`) + `TS2532` ("possibly undefined") errors.
  - `__tests__/WriterExpansion.test.tsx` — `TS2345` (`HTMLElement | undefined`
    not assignable to `Element | Node | Document | Window`).
  - Verified via `git stash` that these errors are byte-identical with and
    without this plan's `derivedState.ts`/test changes — confirmed
    pre-existing, not introduced by 43-03.
  - `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts`
    and the full unit suite are unaffected (vitest does not type-check these
    files the same way `tsc --noEmit` does).
