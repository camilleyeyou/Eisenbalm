---
phase: 48-brief-entry-point
plan: 07
type: execute
wave: 4
depends_on: ["48-03", "48-04", "48-05", "48-06"]
files_modified:
  - packages/pipeline/tests/test_pipeline_e2e.py
autonomous: true
requirements: [ENT-02, ENT-03, ENT-04]

must_haves:
  truths:
    - "A brief-started run produces the same downstream artifacts (research, 7 sections, QA, claims) and reaches publisher as a discovery run"
    - "A brief-started run has NO deliberation events (the D-12 honest divergence) — no scout/advocate/gate-1 debate fabricated"
    - "A brief run's verificationRecords table has ≥1 row (ENT-04)"
    - "Both full test suites are green and the strict next build passes and Convex is live-synced before verify-work"
  artifacts:
    - path: "packages/pipeline/tests/test_pipeline_e2e.py"
      provides: "activated brief-mode end-to-end assertion"
      contains: "brief"
  key_links:
    - from: "packages/pipeline/tests/test_pipeline_e2e.py::test_pipeline_e2e_brief_mode"
      to: "POST /pipeline/run/brief → full graph → Sanity/Convex"
      via: "brief run reaches awaiting-review with all artifacts, minus deliberation"
      pattern: "/pipeline/run/brief"
---

<objective>
The phase integration gate. Activate the brief-mode end-to-end test (the 48-02 scaffold), then run BOTH full suites + the strict `next build` + the Convex live-sync confirmation — the exact pre-`/gsd:verify-work` gate `48-VALIDATION.md` prescribes. This proves ENT-03 (a brief run is indistinguishable at Stages 2-5 — same research/sections/QA/claims, reaches publisher) with the one honest divergence (ENT-03 scope / D-12: no deliberation), and re-confirms ENT-04 (verification record present) across the whole assembled pipeline.

Purpose: prove the four requirements hold end-to-end on the assembled system; catch any Linux/type-only regression vitest can't (strict build).
Output: an activated brief-mode e2e test + a documented green phase gate.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-brief-entry-point/48-VALIDATION.md
@packages/pipeline/tests/test_pipeline_e2e.py

<interfaces>
<!-- The e2e scaffold (from 48-02) that this plan activates. -->

test_pipeline_e2e.py is module-skip-guarded on SUPABASE_POSTGRES_URL (the full graph needs the live
AsyncPostgresSaver checkpointer). `test_pipeline_e2e_brief_mode` (scaffolded in 48-02) POSTs to
/pipeline/run/brief, polls `_poll_until_terminal` to `awaiting-review`, and asserts the 7 section
fields + qaCorrections + verificationRecords + the deliberation-absence. Now that 48-03/48-04 exist,
its local "route not registered" skip-guard resolves and it can run in a provisioned env.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Activate + finalize the brief-mode e2e test</name>
  <files>packages/pipeline/tests/test_pipeline_e2e.py</files>
  <read_first>
    - packages/pipeline/tests/test_pipeline_e2e.py (the scaffolded test_pipeline_e2e_brief_mode + the runId-threaded precedent it clones)
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (the /pipeline/run/brief route it exercises)
    - .planning/phases/48-brief-entry-point/48-VALIDATION.md §Per-Task Verification Map (ENT-03 e2e row) + §Manual-Only Verifications
  </read_first>
  <action>
    Remove the local "route not registered" skip-guard on `test_pipeline_e2e_brief_mode` (now that 48-04 registered `/pipeline/run/brief`) — the module-level `SUPABASE_POSTGRES_URL` skip stays (unchanged, shared by every e2e test). Finalize its assertions against the assembled pipeline:
      - POST `/pipeline/run/brief` with a full brief body (premise, peg, organization {name, website}, sourceMaterial) and a unique issueNumber; assert 200 `{runId}`.
      - `_poll_until_terminal` → status `awaiting-review` (stub Publisher leaves it there, same as the discovery precedent).
      - Sanity draft exists with all 7 section fields present (origin_story/problem/founder_bio/case_study/game/bonus/theme) — ENT-03 same artifacts.
      - `qaCorrections:byRunId` returns rows; `claim_checks`/claims present per the discovery precedent — ENT-03.
      - `verificationRecords:byRunId` returns ≥1 row for the human org — ENT-04.
      - `deliberationEvents:byRunId` contains NO `scout-finding` / `advocate-argument` / `editor-decision` events — the D-12 honest divergence (a brief run has no deliberation to fabricate). Assert this explicitly so the divergence is enforced, not accidental.
    Keep the discovery e2e tests unchanged. If run in an unprovisioned env, the test still SKIPS via the module guard (acceptable — this is the existing e2e reality; the assertion body is exercised in a provisioned env).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_pipeline_e2e.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep "/pipeline/run/brief" packages/pipeline/tests/test_pipeline_e2e.py` matches inside `test_pipeline_e2e_brief_mode`.
    - The local route-not-registered skip-guard is removed from that test (only the module-level SUPABASE_POSTGRES_URL guard remains).
    - The test asserts BOTH the presence of the 7 section fields + verificationRecords ≥1 AND the ABSENCE of scout/advocate/editor deliberation events.
    - `cd packages/pipeline && uv run pytest tests/test_pipeline_e2e.py` exits 0 (green in a provisioned env; cleanly skipped otherwise — no collection error).
  </acceptance_criteria>
  <done>The assembled brief pipeline is proven to produce the same downstream artifacts as discovery, minus deliberation, with the verification record present. (ENT-02/ENT-03/ENT-04.)</done>
</task>

<task type="auto">
  <name>Task 2: Phase gate — full suites + strict build + Convex live-sync confirmation</name>
  <files>none — verification-only (runs full pipeline + dispatch-control suites, strict next build, convex dev:once)</files>
  <read_first>
    - .planning/phases/48-brief-entry-point/48-VALIDATION.md §Sampling Rate ("Before /gsd:verify-work") + §Strict build gate
    - CLAUDE.md (the strict-build + convex-live-sync + write-boundary constraints)
  </read_first>
  <action>
    Run the full phase gate exactly as 48-VALIDATION.md prescribes and record the results in the SUMMARY:
      - `cd packages/pipeline && uv run pytest` — full pipeline suite green (all Phase 48 tests + every prior test; confirm the ENT-04 advisory characterization + the graph-fork + _start_run + endpoint tests are green and no prior test regressed).
      - `pnpm --filter dispatch-control test:unit` — full dispatch-control suite green.
      - `pnpm --filter dispatch-control build` — strict `next build` exits 0 (vitest does NOT type-check; this is the memory [[run-strict-build-before-frontend-phase-done]] gate — it validates `ws.entryMode` against the generated `Doc<'runs'>` type, which requires 48-01's live-synced schema).
      - `pnpm --filter @eisenbalm/convex dev:once` — confirm the Convex deployment is in sync (idempotent; catches any drift since 48-01, [[convex-functions-need-live-sync]]).
    If the strict build surfaces a type error the unit tests missed (the classic Phase 27 latent-bug scenario), fix it within this plan's files or escalate the specific file to the owning plan. Do NOT declare the phase done until all four commands are green.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest && cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control build && pnpm --filter @eisenbalm/convex dev:once</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest` exits 0 (full pipeline suite green).
    - `pnpm --filter dispatch-control test:unit` exits 0 (full dispatch-control suite green).
    - `pnpm --filter dispatch-control build` exits 0 (strict next build — no type errors).
    - `pnpm --filter @eisenbalm/convex dev:once` exits 0 (Convex in sync, no schema validation error).
  </acceptance_criteria>
  <done>Both full suites are green, the strict next build passes, and Convex is confirmed live-synced — the phase meets its pre-verify-work gate. (Phase-level ENT-01..04 integration.)</done>
</task>

</tasks>

<verification>
- Full pipeline suite (`uv run pytest`) + full dispatch-control suite (`pnpm --filter dispatch-control test:unit`) + strict build (`pnpm --filter dispatch-control build`) + Convex sync (`dev:once`) all exit 0.
- The brief-mode e2e asserts the D-12 divergence (no deliberation) — no task in this phase fabricated a deliberation for brief runs.
- Manual UAT (from 48-VALIDATION §Manual-Only): open a brief run and a discovery run at Stages 2-5 and confirm they are indistinguishable; confirm the brief-started reader page's DeliberationSlot renders its absent state without error. (Recorded for /gsd:verify-work; not automatable — no DOM-diff harness exists.)
</verification>

<success_criteria>
The assembled system proves all four requirements: two equal Create paths landing at Stage 1 (ENT-01), a brief run that skips Signal Editor/Scout/Advocate/Gate 1 and enters at the Researcher (ENT-02), the same downstream artifacts indistinguishable at Stages 2-5 with the single honest deliberation divergence (ENT-03), and the human org's verification record never absent (ENT-04) — with both full suites green, the strict build passing, and Convex live-synced.
</success_criteria>

<output>
After completion, create `.planning/phases/48-brief-entry-point/48-07-SUMMARY.md`
</output>
