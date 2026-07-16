---
status: partial
phase: 46-signal-editor-candidate-verification
source: [46-VERIFICATION.md, 46-VALIDATION.md]
started: 2026-07-16
updated: 2026-07-16
---

## Current Test

[awaiting human testing — requires a Postgres-reachable environment + a real pipeline run against live OpenRouter/Tavily]

## Tests

### 1. SGE-04 — Postgres checkpoint pause/resume across the new nodes
expected: With a REACHABLE `SUPABASE_POSTGRES_URL`, `cd packages/pipeline && SUPABASE_POSTGRES_URL=... uv run pytest tests/test_checkpoint_resume_phase46.py -v` → `test_story_leads_and_verification_records_survive_resume` PASSES: `story_leads` + `verification_records` rows exist in Convex before the `editor_gate_1` interrupt and are unchanged in count after resume, and the run reaches a genuine terminal state (`completedAt` populated, `status != failed`).
why_human: In this sandbox `SUPABASE_POSTGRES_URL` is unset (the test skips cleanly, matching the "615 passed / 37 skipped" suite). The value in `packages/pipeline/.env` points at a Railway-internal-only Postgres host; forcing it and re-running yields a 503 ("Pipeline graph unavailable — Supabase unreachable"). The live-Postgres pause/resume path is written and correct-by-inspection but has never executed successfully anywhere reachable from this environment. Graph structure (20 nodes, correct edges) IS proven by the live-introspection test; only the live Postgres resume is unproven.
result: [pending]

### 2. SGE-04 — `forceNoWinner` actually fires the `editor_gate_1` interrupt in real (non-stub) mode
expected: With live-Postgres access, confirm the `forceNoWinner=True` trigger the SGE-04 test reuses from `test_editor_gate_1_resume.py` genuinely drives the run to `awaiting-review` in real mode.
why_human: The phase's own `deferred-items.md` (written during 46-07) documents a PRE-EXISTING Phase 4/5 gap — `_force_no_winner`/`forceNoWinner` is set into initial state by `api/runs.py` but never read by `agents/editor.py::editor_gate_1` (Phase 5's real-Opus editor drives its interrupt off live LLM confidence + the Advocate score gap). So `forceNoWinner` may not reliably trigger the interrupt this test depends on in real mode. Not introduced by Phase 46 and does not affect Phase 46's own code correctness, but it means the SGE-04 resume path needs a live end-to-end exercise to fully confirm.
result: [pending]

### 3. SGE-03 — obscurity press-hit threshold tuning
expected: After a real pipeline run, well-known organizations are killed by `verify_candidates` as "not obscure" while genuinely obscure organizations pass the press-scan; adjust the threshold constant in `agents/verify_candidates.py` if the cutoff mis-classifies.
why_human: No numeric precedent exists for the "genuinely obscure" cutoff; it is a judgment tuning item (RESEARCH Open Question 1) that requires observing real Tavily hit-counts on real candidates. Non-blocking.
result: [pending]

### 4. SGE-01 — Signal Editor lead quality / Jesse-voice fit
expected: On a real run against live OpenRouter/Tavily, read the 3–5 emitted `StoryLead`s; confirm each `datedPeg` + `pegSourceUrl` is real, dated, and sourced, and the `premise` reads in Jesse's dry, played-straight voice.
why_human: LLM output quality (premise sharpness, peg relevance, voice fit) is not unit-assertable — the unit tests mock the LLM. Requires a real run to evaluate. Non-blocking.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

- SGE-04 live-Postgres pause/resume + `forceNoWinner` trigger (items 1–2) — blocked on a Postgres-reachable environment; not a code defect. Graph structure + JSON-safe state fields are proven; the Postgres checkpointer is unchanged from prior phases that resume in production.
- SGE-03 obscurity threshold + SGE-01 lead voice quality (items 3–4) — inherently manual, need a real pipeline run; non-blocking.
