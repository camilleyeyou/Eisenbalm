# Phase 16 — Deferred Items (out of scope for Plan 16-09 audit layer)

Per CLAUDE.md SCOPE BOUNDARY rule: only auto-fix issues DIRECTLY caused by the current plan's work. Items listed here surfaced during Plan 16-09 verification gates but are pre-existing on master, not regressions caused by this phase. Each item names its root-cause phase and the next plan that should own it.

## 1. `pnpm --filter web lint` hangs on interactive Next.js 15 ESLint migration prompt

- **Discovered:** Plan 16-09 Gate 3 (lint regression check)
- **Root cause:** Next.js 15 deprecated `next lint` in favor of the ESLint CLI. Running `next lint` against the apps/web package now prompts: "How would you like to configure ESLint?" with options Strict / Base / Cancel. Non-interactive CI invocations hang forever waiting on input.
- **First seen on master at:** Next 15 upgrade (pre-Phase 16; pre-existing baseline)
- **Phase 16 impact:** None. This is a build-tooling migration that affects every phase post-Next-15, not a regression from Phase 16 code changes.
- **Suggested owner:** A future "tooling-modernization" plan (likely Phase 17 or beyond). Either migrate to the ESLint CLI per Next 15 docs (`npx @next/codemod@canary next-lint-to-eslint-cli .`) OR pin the legacy lint workflow with an explicit non-interactive flag.

## 2. `pnpm --filter studio lint` — no lint script

- **Discovered:** Plan 16-09 Gate 3 (lint regression check)
- **Root cause:** `apps/studio/package.json` never had a `lint` script defined since the original Phase 1 scaffolding.
- **First seen on master at:** Phase 01 close (pre-existing baseline)
- **Phase 16 impact:** None.
- **Suggested owner:** Future tooling plan, low priority. Studio is editorially maintained (TypeScript schema files only); ESLint adds limited value here.

## 3. `uv run ruff check packages/pipeline/src packages/pipeline/tests` — 19 pre-existing errors + 1 from Plan 16-07

Triage of the 20 ruff errors found during Gate 3:

| # | File | Rule | Last modified by | Notes |
|---|---|---|---|---|
| 1 | `agents/_wrapper.py:28` | F401 (unused import `typing.Any`) | Phase 4 | Pre-existing |
| 2-5 | `agents/publisher/__init__.py:104-112` | E402 (module-level imports not at top) | Phase 6 | Intentional late-binding for monkeypatch pattern — see Phase 6 SUMMARYs |
| 6 | `api/runs.py:128` | F841 (unused variable `graph`) | Phase 4 | Pre-existing |
| 7 | `stubs/fixtures.py:38` | F401 (unused import `typing.Any`) | Phase 4 | Pre-existing |
| 8 | `tests/agents/test_calibrator.py:10` | F401 (unused import `pytest`) | Phase 5 | Pre-existing |
| 9 | `tests/agents/test_case_study.py:14` | F401 | Phase 5 | Pre-existing |
| 10 | `tests/agents/test_founder_bio.py:14` | F401 | Phase 5 | Pre-existing |
| 11-12 | `tests/api/test_webhook_sanity.py:9, 13` | F401 | Phase 6 | Pre-existing |
| 13-14 | `tests/conftest.py:298-299` | WPS433 invalid noqa | Phase 4/5 | Pre-existing — noqa codes reference a plugin we don't ship |
| 15 | `tests/lib/test_idempotency.py:10` | F401 | Phase 6 | Pre-existing |
| 16 | `tests/lib/test_vercel_client.py:7` | F401 | Phase 6 | Pre-existing |
| 17-18 | `tests/test_pipeline_real_mode.py:26, 594` | F401 / F841 | Phase 6 | Pre-existing |
| 19 | `tests/test_qa_judge_narrator.py:18` | F401 (unused `AsyncMock`) | **Phase 16-07** | Introduced by Plan 16-07 — out of scope for Plan 16-09 (audit layer) but a 1-line fix candidate for a follow-up |

- **Phase 16-09 changes (test_narrator_seed_sentinel.py, test_narrator_cost_budget.py):** Zero ruff errors. Verified by running `ruff check` against only those two files after the fixes landed.
- **Suggested owner:** A small "lint-hygiene" quick task can clean up items 1, 6-12, 15-19 (`ruff check --fix` autofixes 12 of them). Items 2-5 and 13-14 require code review (E402 intentional + WPS433 noqa cleanup).

---

*Authored: 2026-05-30 — Plan 16-09 Task 1.*
