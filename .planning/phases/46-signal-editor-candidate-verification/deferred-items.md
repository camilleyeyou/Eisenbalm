# Phase 46 — Deferred Items

Out-of-scope discoveries logged during plan execution (per execute-plan scope-boundary
rules — not fixed, not blocking this phase's acceptance).

## `_force_no_winner` / `forceNoWinner` toggle is unwired (discovered in 46-07)

- **Where:** `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` (`DispatchState._force_no_winner`,
  a Phase-4-era test-only field), set from `api/runs.py`/`api/control.py`'s `forceNoWinner` request
  body field into initial state, but never read by `agents/editor.py::editor_gate_1` or any other node.
- **Why it matters:** `test_editor_gate_1_resume.py` (pre-existing, Phase 4/5) and the new
  `test_checkpoint_resume_phase46.py` (46-07) both use `forceNoWinner=True` as their interrupt-trigger
  mechanism, mirroring that precedent. Since Phase 5's D-18 replaced the Phase-4 stub editor with the
  real Opus-driven `editor_gate_1`, the interrupt condition (`score_gap < 1.0 AND confidence < 0.7 AND
  requiresHumanInput`) is driven entirely by the live LLM call's own judgment plus the real Advocate
  score spread — `forceNoWinner` no longer forces anything. In real (non-stub) mode, both resume tests
  may not reliably trigger the interrupt they're designed to test.
- **Why not fixed here:** Pre-existing gap, not introduced by any Phase 46 change, and does not block
  46-07's acceptance criteria — both resume tests skip cleanly in this environment (no reachable
  `SUPABASE_POSTGRES_URL`; the phase-38/39-era Railway Postgres is on Railway's private network,
  unreachable from a local dev shell). Fixing it is either an architectural question (should
  `forceNoWinner` synthesize a canned low-confidence `EditorDecision` bypassing the LLM call entirely,
  mirroring the D-14 all-candidates-killed recovery path?) or a live-environment-only debugging task —
  out of scope for a phase-gate plan.
- **Suggested follow-up:** Whoever next runs a live Postgres+Convex+Sanity+OpenRouter integration pass
  (Andrew's manual smoke test, or a future phase's live-mode plan) should decide whether to (a) wire
  `_force_no_winner` into `editor_gate_1` to force `interrupt_triggered=True` deterministically for
  test/demo purposes, or (b) retire the toggle and rewrite both resume tests to trigger the interrupt
  via a controlled near-tied Advocate score fixture instead.
