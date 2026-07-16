# Phase 45 — Deferred Items (out of scope, logged not fixed)

## `tests/lib/test_vercel_client.py` — missing `respx` module (pre-existing, unrelated to Plan 45-01)

- **Found during:** Plan 45-01 Task 3, running the full pipeline pytest suite to verify Wave-0
  scaffolding kept the suite green.
- **Symptom:** `python -m pytest` (no `--ignore`) fails collection with
  `ModuleNotFoundError: No module named 'respx'` in `tests/lib/test_vercel_client.py`, which
  aborts the whole run (`1 skipped, 1 error`) before any other test executes.
- **Root cause:** `respx>=0.21` is declared in `packages/pipeline/pyproject.toml`'s dependency
  list but is not installed in this environment's Python (`pip show respx` reports "not found").
  `test_vercel_client.py` was added in commit `f5a8542` (an unrelated prior quick task adding
  retry/backoff to `trigger_vercel_deploy`), predating this phase.
- **Scope decision:** Out of scope per CLAUDE.md's SCOPE BOUNDARY — this failure is not caused by
  any Plan 45-01 change and touches an unrelated module (`lib/vercel_client.py`). Not fixed here.
- **Verification workaround used for this plan:** `python -m pytest -q --ignore=tests/lib/test_vercel_client.py`
  confirms the rest of the pipeline suite is green: **575 passed, 40 skipped** (0 failed), plus the
  4 new Wave-0 skips from this plan's `test_revision_endpoints.py` (import-skip) and `test_budget.py`
  (3 skipif'd tests) already included in that count.
- **Suggested fix (future phase/session):** either add `respx` to the environment's installed
  packages (`pip install respx` / re-sync the venv against `pyproject.toml`) or, if `respx` is no
  longer desired, remove the dependency declaration and the test file together.
- **Plan 45-02 re-confirmation:** still present, still unrelated (verified via `git stash` that the
  same `ModuleNotFoundError` occurs on the pre-45-02 tree). `python -m pytest -q
  --ignore=tests/lib/test_vercel_client.py` after Plan 45-02's two tasks: **578 passed, 37 skipped**
  (0 failed) — the +3 passed / -3 skipped delta vs. 45-01's count is exactly `test_budget.py`'s
  3 `run_cap` tests going from skipif'd to green now that `would_exceed_run_cap` lands.

## `apps/dispatch-control` has no ESLint config file (pre-existing, repo-wide, unrelated to Plan 45-04)

- **Found during:** Plan 45-04 Task 3, running the plan's own `<verify>` step
  (`npx eslint components/revision/RevisionFlow.tsx`).
- **Symptom:** `npx eslint <any file>` in `apps/dispatch-control` fails immediately with "ESLint
  couldn't find an eslint.config.(js|mjs|cjs) file" (ESLint 9.39.4, flat-config-only). `npx next
  lint` also fails non-interactively — it only offers to *create* a new config via an interactive
  prompt (Strict/Base/Cancel), which cannot run in this (non-interactive) session.
- **Root cause:** `apps/dispatch-control/eslint.config.js`/`.eslintrc.*` has never existed in git
  history for this app (confirmed via `git log --all` on all conventional config filenames — zero
  hits). Only `apps/web/eslint.config.mjs` exists in this monorepo. No phase before 45 ever invoked
  `npx eslint` against `apps/dispatch-control` (confirmed via `grep -rl "npx eslint"` across every
  prior phase's PLAN.md — zero hits before 45-04/45-05) — this app has simply never had linting
  wired, independent of this plan's changes.
- **Scope decision:** Out of scope per CLAUDE.md's SCOPE BOUNDARY — creating an eslint.config.js for
  the whole app is an architectural/tooling decision (which ruleset, whether it surfaces pre-existing
  lint violations across ~100+ existing files) that a single component-kit task should not make
  unilaterally. Not fixed here.
- **Verification workaround used for this plan:** relied on `./node_modules/.bin/tsc --noEmit -p
  tsconfig.json` (bypassing a broken `npx tsc` — see below) scoped to the new files, plus the full
  `npx vitest run` suite for the plan's three test files, all green. No ESLint pass was possible for
  `components/revision/RevisionFlow.tsx` (or its sibling components) this plan.
- **Related tooling note (same session):** `npx tsc` in this app resolves to an unrelated joke `tsc`
  package from the public npm registry ("This is not the tsc command you are looking for") rather
  than the locally-installed TypeScript compiler — `npx` is not finding `node_modules/.bin/tsc` first
  in this environment. Verification for this plan used `./node_modules/.bin/tsc` directly instead.
  Plan 45-04's Task 1 `<verify>` line (`npx tsc --noEmit -p tsconfig.json | grep -q "revisionClient"`)
  silently degrades to a false "OK" under this condition (grep finds no match either way) — flagging
  so a future plan's verify step prefers the local binary path.
- **Suggested fix (future phase/session):** add a real `eslint.config.js` to `apps/dispatch-control`
  (mirroring `apps/web/eslint.config.mjs`, adjusted for this app's Next.js config) as its own
  dedicated task/plan, then triage whatever pre-existing violations it surfaces separately from any
  single feature plan. Separately, investigate why `npx` doesn't prefer the local
  `node_modules/.bin/tsc` in this environment (`npm config get prefer-offline`, PATH ordering, or a
  stale npx package cache are the likely candidates) and prefer `./node_modules/.bin/tsc` explicitly
  in future plans' verify steps.
