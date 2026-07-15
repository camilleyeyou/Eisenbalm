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

## 43-04 (superseded-resolved-session-logic)

- `pnpm --filter dispatch-control typecheck` still exits non-zero — confirmed
  via `git stash` that the full error set (now ~28 files, `error TS` count
  210) is byte-identical with and without this plan's new
  `lib/taskSupersession.ts` / `__tests__/taskSupersession.test.ts`. Neither
  new file appears anywhere in the error output (`grep -c taskSupersession`
  on the typecheck output returns 0). This is the same pre-existing,
  repo-wide `noUncheckedIndexedAccess`/strictness drift noted under 43-03,
  just visible across a wider file set than that plan's narrower check
  surfaced — unrelated to Phase 43 and out of scope for this plan's Rule-1/2/3
  auto-fix boundary.
  - `pnpm --filter dispatch-control test -- __tests__/taskSupersession.test.ts`
    is green (8/8) and is the plan's actual gating verification command.

## 43-07 (retrofit-reason-actions-shared-helper)

- `cd packages/pipeline && python -m pytest -k "audit or factcheck"` fails
  COLLECTION (not this plan's tests) with `ModuleNotFoundError: No module
  named 'respx'` from `tests/lib/test_vercel_client.py`. Pre-existing,
  already logged under Phase 28-03's deferred-items.md — a missing dev
  dependency unrelated to this plan's `control.py`/`factcheck.py` changes.
  Ran with `--ignore=tests/lib/test_vercel_client.py` instead: 37 passed, 0
  failed.
