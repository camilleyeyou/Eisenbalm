---
phase: 40-issue-entity-issues-home
plan: 09
type: execute
wave: 5
depends_on: ["40-02", "40-03", "40-04", "40-05", "40-06", "40-07", "40-08"]
files_modified:
  - apps/dispatch-control/vitest.config.ts
autonomous: false
requirements: [ISS-01, ISS-02, ISS-03, ISS-04, ISS-05, ISS-06]

must_haves:
  truths:
    - "The Convex schema + issues functions are DEPLOYED (not just committed) to dev:modest-magpie-797 — committing convex/*.ts is not deploying it"
    - "The full vitest suite is GREEN and `next build` (strict type-check) exits 0 — vitest does not type-check, so the build is a mandatory separate gate"
    - "The one-shot issues backfill has run, so Recently Published renders real history and there is exactly one code path for 'what is an issue'"
    - "All six of ISS-01..ISS-06 are provably satisfied by an automated test or a completed manual verification"
  artifacts:
    - path: "apps/dispatch-control/vitest.config.ts"
      provides: "final confirmation the edge-runtime + jsdom env globs cover every Phase 40 test file"
      contains: "issues.test.ts"
  key_links:
    - from: "convex/issues.ts + convex/schema.ts"
      to: "dev:modest-magpie-797"
      via: "pnpm --filter @eisenbalm/convex dev:once"
      pattern: "dev:once"
---

<objective>
The phase-completion gate. Deploy the Convex functions (committing is not deploying — Phase 39 shipped a prod 500 by skipping this), run the full vitest suite AND `next build` strict type-check (vitest does not type-check — Phase 27 shipped two latent bugs by skipping the build), run the one-shot issues backfill, and confirm every ISS requirement is proven.

Purpose: Nothing in Phase 40 is "done" until Convex is synced, the strict build is clean, and the backfill has populated Recently Published. This plan is the single explicit gate for those three locked project conventions.
Output: a green suite, a clean build, a deployed Convex schema, a populated issues table, and a checkpoint confirming the six success criteria.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-issue-entity-issues-home/40-VALIDATION.md
@.planning/phases/40-issue-entity-issues-home/40-RESEARCH.md

<interfaces>
Locked project conventions (40-VALIDATION.md, project memory):
- Convex deploy: `pnpm --filter @eisenbalm/convex dev:once` (→ `convex dev --once`) against `dev:modest-magpie-797`. Committing `convex/*.ts` ≠ deploying.
- Strict type gate: `pnpm --filter dispatch-control build` (→ `next build`). vitest does NOT type-check.
- Full suite: `pnpm --filter dispatch-control test` (→ `vitest run`, ~70 files) + pipeline `cd packages/pipeline && uv run pytest`.
- Backfill: `cd packages/pipeline && uv run python scripts/backfill_issues.py` (Plan 40-03, idempotent — safe to re-run; requires `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `SANITY_API_TOKEN`).
Per-req test map (40-VALIDATION.md): ISS-01 → issues.test.ts + derivedState.test.ts + IssueCard.test.tsx; ISS-02 → issueRouteResolver.test.ts + nav.test.ts; ISS-03 → test_repetition_note.py + ScheduledSlotCard.test.tsx; ISS-04 → issues.test.ts + HoldDialog.test.tsx; ISS-05 → Masthead.test.tsx; ISS-06 → IssueCard.test.tsx (error-state case).
Manual-only (40-VALIDATION.md): the live Next.js `redirect()` 307 (ISS-02) and the greyscale four-readout legibility (ISS-05).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Deploy Convex + green the full suite + strict build</name>

  <read_first>
    - apps/dispatch-control/vitest.config.ts (confirm every Phase 40 test file is covered: `issues.test.ts` → edge-runtime; the three new `.tsx` → the existing `*.test.tsx` jsdom glob; the node-env tests need no entry)
    - convex/package.json (the `dev:once` script)
    - apps/dispatch-control/package.json (the `test` and `build` scripts)
    - .planning/phases/40-issue-entity-issues-home/40-VALIDATION.md (the sampling/gate rules)
  </read_first>

  <action>
Run the three locked gates in order, fixing any failure before proceeding:

1. **Convex deploy (MANDATORY — Convex changed in 40-02):**
   `pnpm --filter @eisenbalm/convex dev:once`
   This pushes `convex/schema.ts` (issues table) + `convex/issues.ts` + the two new `pipelineRuns` queries to `dev:modest-magpie-797` and regenerates `convex/_generated/api.*` so `api.issues.*` and `api.pipelineRuns.byIssueNumber` resolve at runtime. If it errors on schema validation, fix the schema/function before continuing — a committed-but-unsynced function is the exact Phase 39 prod-500 failure.
   Confirm codegen: `grep -q "issues" convex/_generated/api.d.ts` should now succeed.

2. **Full dashboard suite:** `pnpm --filter dispatch-control test`. Every Phase 40 test file must pass: `issues.test.ts`, `derivedState.test.ts`, `issueRouteResolver.test.ts`, `IssueCard.test.tsx`, `ScheduledSlotCard.test.tsx`, `HoldDialog.test.tsx`, `Masthead.test.tsx`, `nav.test.ts` — plus no regression in the ~62 pre-existing files (notably `dispatch-control-no-sanity-write.test.ts`, the EDT-05 tripwire — `issues` is Convex-only operational state, so it must stay green).

3. **Pipeline suite:** `cd packages/pipeline && uv run pytest -q`. `test_repetition_note.py` passes; `test_registry_coverage.py`, `test_control.py`, `test_test_run.py` show no regression.

4. **Strict type-check (MANDATORY — vitest does not type-check):** `pnpm --filter dispatch-control build`. This `next build` catches Server/Client Component boundary violations and Convex-result type mismatches the mocked/edge-runtime tests do not exercise (e.g. a `'use client'` state leaking into a Server Component page under the new `/issues/` tree). Exit 0 is required.

If `vitest.config.ts` is missing an env entry for any Phase 40 convex-test file (only `issues.test.ts` needs edge-runtime; the `.tsx` files are covered by the existing glob), add it here.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter @eisenbalm/convex dev:once && grep -q "issues" convex/_generated/api.d.ts && pnpm --filter dispatch-control test && (cd packages/pipeline && uv run pytest -q) && pnpm --filter dispatch-control build</automated>
  </verify>

  <acceptance_criteria>
    - `pnpm --filter @eisenbalm/convex dev:once` completes without error and `convex/_generated/api.d.ts` references `issues`
    - `pnpm --filter dispatch-control test` exits 0 (full suite — all 8 Phase 40 files GREEN, no regression, EDT-05 tripwire still green)
    - `cd packages/pipeline && uv run pytest` exits 0 (repetition-note GREEN, coverage/control/test-run no regression)
    - `pnpm --filter dispatch-control build` exits 0 (strict `next build`)
  </acceptance_criteria>

  <done>Convex is deployed, the full dashboard + pipeline suites are green, and the strict Next.js build passes.</done>
</task>

<task type="auto">
  <name>Task 2: Run the one-shot issues backfill (D-05)</name>

  <read_first>
    - packages/pipeline/scripts/backfill_issues.py (Plan 40-03 — the idempotent backfill; confirm the required env vars are set before running)
    - .planning/phases/40-issue-entity-issues-home/40-RESEARCH.md § Runtime State Inventory (the D-05 backfill rationale: one issues row per distinct existing issueNumber, published derived from Sanity)
  </read_first>

  <action>
With the Convex functions now deployed (Task 1), run the one-shot backfill so `Recently Published` renders real history and there is exactly one code path for "what is an issue":

`cd packages/pipeline && uv run python scripts/backfill_issues.py`

It is idempotent (`ensureByNumber` no-ops existing rows; `markPublished` is idempotent) — safe to re-run. Confirm the summary line reports the ensured/published counts. If it 404s on a mutation, Task 1's Convex deploy did not land — re-run Task 1 first. If `SANITY_API_TOKEN` is unset in this environment, the script runs in dry-run mode for the published-state step; note that in the SUMMARY so the operator knows to re-run it once the token is available (the `ensureByNumber` half still completes).
  </action>

  <verify>
    <automated>cd packages/pipeline && test -f scripts/backfill_issues.py && uv run python -c "import ast; ast.parse(open('scripts/backfill_issues.py').read()); print('BACKFILL-PARSE-OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `scripts/backfill_issues.py` was executed (its summary line printed the ensured/published counts) OR — if a required env var is unavailable in this environment — the SUMMARY explicitly records that the backfill must be run manually once the credential is present, and the `ensureByNumber` half completed
    - After the backfill, `issues:listForWorkspace` returns at least one row for each distinct existing `issueNumber` (verify via the Convex dashboard or a one-off query)
  </acceptance_criteria>

  <done>The issues table is backfilled from existing pipelineRuns + Sanity published state (or the remaining manual step is documented), so Recently Published renders real history.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verification of the live Phase 40 surface (ISS-02 redirect, ISS-05 greyscale, ISS-01/03/06, ISS-04)</name>
  <action>Pause for the operator to verify the running app. This confirms the two manual-only verifications from 40-VALIDATION.md (the live Next.js 307 redirect and the greyscale four-readout legibility) plus a smoke pass of the home card, the status-unknown error state, and the hold/reopen flow. Do not mark the phase done until the operator responds "approved".</action>
  <what-built>The full Phase 40 surface: Issues home (/issues) with the in-progress card + 5-stage strip, scheduled slot with repetition note + Start-early, held/recently-published rows; issue-keyed routing (/issues/[n], /issues/[n]/review, /issues/[n]/voice, /issues/[n]/runs/[runId]) with old run-keyed URLs redirecting; hold/reopen with a required reason; the four-readout header; the restructured nav.</what-built>
  <how-to-verify>
    Run `pnpm --filter dispatch-control dev` and, signed in:
    1. **ISS-02 redirect (manual — the live 307):** visit an old `/review-desk/{runId}` URL for a real run and confirm the browser lands on `/issues/{n}/review`. Visit `/voice-pass/{runId}` → `/issues/{n}/voice`. Visit `/` → `/issues`.
    2. **ISS-05 greyscale (manual):** load the console, apply a greyscale filter (browser devtools rendering emulation), and confirm all FOUR header readouts (issue status, system activity, My Tasks, cost) stay distinguishable by label + icon alone — no readout relies on color.
    3. **ISS-01/03/06:** on `/issues`, confirm the in-progress card shows the 5-stage strip + all readouts; the scheduled slot shows a repetition note (or none, gracefully); force a status-load failure (e.g. offline the Convex socket briefly) and confirm the card reads `State unknown — refresh`, never a stale "Ready".
    4. **ISS-04:** on `/issues/{n}`, click `Hold issue`, submit with an empty reason (rejected: `A reason is required to hold this issue.`), then with a reason + the default-checked stop-run box; confirm the held banner shows reason/who/when on the home, and `Reopen` clears it in one click.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any readout that blends, any redirect that loops, or any stale status.</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter @eisenbalm/convex dev:once` deployed the schema + functions; `convex/_generated/api.d.ts` references `issues`.
- `pnpm --filter dispatch-control test` + `cd packages/pipeline && uv run pytest` + `pnpm --filter dispatch-control build` all exit 0.
- The backfill ran (or the remaining manual step is documented); the issues table has one row per distinct existing issueNumber.
- The human checkpoint confirms the live redirect (ISS-02), greyscale readout legibility (ISS-05), and the hold/reopen flow (ISS-04).
</verification>

<success_criteria>
- Every ISS-01..ISS-06 is proven by an automated test (per the 40-VALIDATION map) plus the two manual-only verifications.
- Convex is deployed, the strict build is clean, and the issues table is backfilled — the three locked conventions are satisfied, closing the phase.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-09-SUMMARY.md`.
</output>
