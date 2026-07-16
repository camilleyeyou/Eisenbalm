---
phase: 46-signal-editor-candidate-verification
plan: 07
type: execute
wave: 5
depends_on: ["46-06"]
files_modified:
  - packages/pipeline/tests/test_checkpoint_resume_phase46.py
autonomous: true
requirements: [SGE-04]

must_haves:
  truths:
    - "A pause/resume cycle spanning signal_editor→scout→verify_candidates carries story_leads + verification_records across the resume (Postgres checkpointer)"
    - "The full pipeline suite is green with both new nodes wired"
    - "The two new Convex tables/functions are confirmed deployed to dev (parity guard passes)"
  artifacts:
    - path: "packages/pipeline/tests/test_checkpoint_resume_phase46.py"
      provides: "SGE-04 checkpoint resume assertions"
      contains: "story_leads"
  key_links:
    - from: "packages/pipeline/tests/test_checkpoint_resume_phase46.py"
      to: "final state after resume"
      via: "assert story_leads + verification_records survive"
      pattern: "verification_records"
---

<objective>
Fill the SGE-04 checkpoint pause/resume test (spanning the two new nodes) and run the phase integration gate: full suite green, Convex parity confirmed, live-sync verified.

Purpose: SGE-04's acceptance is that the Postgres checkpointer resumes correctly across the new nodes — the state written by signal_editor (story_leads) and verify_candidates (verification_records) BEFORE the editor_gate_1 interrupt must survive the resume. This plan closes the phase.
Output: the filled test_checkpoint_resume_phase46.py + a green integration gate.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@.planning/phases/46-signal-editor-candidate-verification/46-VALIDATION.md
@packages/pipeline/tests/test_editor_gate_1_resume.py
@packages/pipeline/tests/test_checkpoint_resume_phase46.py
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fill test_checkpoint_resume_phase46.py (SGE-04)</name>
  <files>packages/pipeline/tests/test_checkpoint_resume_phase46.py</files>
  <read_first>
    - packages/pipeline/tests/test_checkpoint_resume_phase46.py — the Wave-0 stub (from 46-01) with the `SUPABASE_POSTGRES_URL` skip-guard already in place
    - packages/pipeline/tests/test_editor_gate_1_resume.py — the interrupt→awaiting-review→resume→terminal cycle it mirrors (the interrupt fires at editor_gate_1, AFTER signal_editor/scout/verify_candidates have already written their state pre-interrupt)
    - RESEARCH Validation Architecture SGE-04 row — "state populated pre-interrupt survives post-resume"
  </read_first>
  <behavior>
    - With SUPABASE_POSTGRES_URL set: trigger a run that interrupts at editor_gate_1 (forceNoWinner or the all-killed path), poll to awaiting-review, resume, then assert the final resumed state carries story_leads (non-empty list) AND verification_records (present) — proving the AsyncPostgresSaver persisted the two new nodes' output across the pause/resume
    - Without SUPABASE_POSTGRES_URL: the module skips cleanly (unchanged guard)
  </behavior>
  <action>
    Replace the `pytest.skip("filled by 46-07")` stub with a real integration test named `test_story_leads_and_verification_records_survive_resume`, mirroring test_editor_gate_1_resume.py's interrupt/resume flow. Keep the module-level `SUPABASE_POSTGRES_URL` skip-guard. After the resume completes, fetch the final DispatchState (via the run's status/checkpoint read path the existing resume test uses, or a direct checkpointer read) and assert `final.get("story_leads")` is a non-empty list AND `final.get("verification_records")` is present — i.e. the state signal_editor + verify_candidates wrote BEFORE the editor_gate_1 interrupt survived the Postgres checkpoint round-trip. If the existing resume harness only exposes Sanity/status (not raw state), assert the resumed run reaches terminal without losing the leads by reading them back via the Convex `storyLeads:byRunId` / `verificationRecords:byRunId` queries for that runId (both were written pre-interrupt and must be present post-resume).
  </action>
  <acceptance_criteria>
    - `grep -q "def test_story_leads_and_verification_records_survive_resume" packages/pipeline/tests/test_checkpoint_resume_phase46.py` matches
    - `grep -q "story_leads" packages/pipeline/tests/test_checkpoint_resume_phase46.py` and `grep -q "verification_records" ...` both match
    - `grep -q "SUPABASE_POSTGRES_URL" packages/pipeline/tests/test_checkpoint_resume_phase46.py` still matches (guard intact)
    - `cd packages/pipeline && uv run pytest tests/test_checkpoint_resume_phase46.py -q` exits 0 (SKIPPED in CI without Postgres; PASSED when SUPABASE_POSTGRES_URL is set)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_checkpoint_resume_phase46.py -q</automated>
  </verify>
  <done>The SGE-04 resume test asserts story_leads + verification_records survive the pause/resume; it skips cleanly without live Postgres.</done>
</task>

<task type="auto">
  <name>Task 2: Phase integration gate — full suite + Convex parity + live-sync</name>
  <files>packages/pipeline/tests/test_checkpoint_resume_phase46.py</files>
  <read_first>
    - .planning/phases/46-signal-editor-candidate-verification/46-VALIDATION.md — the Phase-gate sampling command
    - .planning/phases/46-RESEARCH.md Pitfall 8 — `pnpm check:convex-parity` + `pnpm --filter @eisenbalm/convex dev:once` (committing convex/*.ts ≠ deployed); project memory `convex-functions-need-live-sync`
  </read_first>
  <action>
    Run the phase gate and record results in the SUMMARY (no code change beyond confirming green):
    1. `cd packages/pipeline && uv run pytest -q` — the FULL pipeline suite must be green with both new nodes wired (this is the primary gate).
    2. Confirm the two new Convex tables/functions are live on dev:modest-magpie-797: run `pnpm --filter @eisenbalm/convex dev:once` (idempotent re-sync) and, if the repo has it, `pnpm check:convex-parity` (diffs pipeline convex string-literal call sites vs the live deployment spec — must exit 0; this catches the storyLeads:insert / verificationRecords:insert / charities:listRecentFeatured call sites drifting from the deployment).
    3. Record the two manual tuning items from 46-VALIDATION.md as pending UAT (NOT blockers): (a) the obscurity press-hit threshold (OBSCURITY_PASS_MAX_HITS / OBSCURITY_FAIL_MIN_HITS) has no numeric precedent — spot-check on a real run that well-known orgs are killed as "not obscure" and genuinely obscure orgs pass; (b) Signal Editor lead quality / Jesse-voice fit — read the 3-5 emitted leads on a real run and confirm pegs are real+dated+sourced and the premise reads on-voice.
    If any full-suite test is red, fix it within this plan (it will be a wiring/mock gap, not new feature scope) before declaring the gate passed.
  </action>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest -q` exits 0 (full suite green)
    - `pnpm --filter @eisenbalm/convex dev:once` completes without a schema/validator error
    - If present, `pnpm check:convex-parity` exits 0
    - The SUMMARY records the two manual tuning items as pending UAT
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -q</automated>
  </verify>
  <done>Full pipeline suite green with the 20-node graph; Convex tables/functions confirmed deployed; manual tuning items logged as pending UAT.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q` — full suite green
- Checkpoint resume test asserts story_leads + verification_records survive (skips cleanly without live Postgres)
- Convex parity/live-sync confirmed
</verification>

<success_criteria>
- SGE-04: the Postgres checkpointer resumes correctly across the new nodes (story_leads + verification_records survive the pause/resume)
- Full pipeline suite green with all 20 nodes wired
- The two new Convex tables/functions are live on dev; parity guard passes
- Manual tuning items (obscurity threshold, lead voice-fit) recorded as pending UAT
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-07-SUMMARY.md`
</output>
