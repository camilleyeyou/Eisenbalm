---
phase: 50-workbench-nomenclature
plan: 05
type: execute
wave: 2
depends_on: ["50-02", "50-04"]
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/tests/test_publish_bridge.py
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx
  - apps/dispatch-control/components/inspector/InspectorFooter.tsx
  - apps/dispatch-control/__tests__/RecoveryRail.test.tsx
autonomous: true
requirements: [WBN-03]

must_haves:
  truths:
    - "A failed run shows a plain-language recovery rail: what happened / what completed successfully / what did not happen / recommended recovery"
    - "Downstream steps after the failure dim and read 'Skipped'"
    - "'Restart from this step' is LIVE only for the 3 backed step-types and reserved-with-explanation for the other 8"
    - "'Improve this agent' deep-links to Agent Instructions from the failed step"
    - "Restart-reuse copy ('completed steps are reused, not re-paid') appears only where a real primitive backs it"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx"
      provides: "4-part plain-language recovery rail + per-step honest Restart + Improve-this-agent"
      min_lines: 40
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/control.py"
      provides: "Clerk-guarded Publisher-restart bridge (mirrors adjudicate)"
      contains: "_require_editor"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx"
      to: "RerollButton (rerun_agent) / adjudicate (resume) / publish-manual bridge"
      via: "per-step-type Restart wiring by the honesty matrix"
      pattern: "Restart from this step"
    - from: "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx"
      to: "/prompt-lab/{agentKey}"
      via: "Improve this agent deep link"
      pattern: "Improve this agent"
---

<objective>
WBN-03 (D-10/D-11/D-12). Build the failed-run recovery rail as a real affordance: a plain-language "what happened / what completed successfully / what did not happen / recommended recovery," downstream steps dimmed and labeled "Skipped," an honest per-step "Restart from this step," and "Improve this agent" deep-linking to Agent Instructions.

Purpose: RESEARCH resolves D-12's open question decisively — only 3 of 11 step-types have a real reuse primitive (writers → `rerun_agent`; Gate-1 pause → resume/`adjudicate`; Publisher → a thin Clerk-guarded wrapper around `manual_publish`). The rail's "completed steps are reused, not re-paid" copy must be honest per-step, not a blanket claim — reserved-with-explanation (the existing `InspectorFooter`/`LockedControl` pattern) for the other 8. This plan also adds the small Publisher Clerk-bridge (in-scope per RESEARCH Open Q #5) so the rail can claim 3-of-11 honestly rather than 2.
Output: a RecoveryRail component wired into failed-run Run Details, the Publisher bridge (contract-first), an upgraded InspectorFooter Restart, and tests pinning the honesty matrix.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@.planning/phases/50-workbench-nomenclature/50-RESEARCH.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
@docs/API_CONTRACTS.md
@apps/dispatch-control/components/inspector/InspectorFooter.tsx
@apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx
@apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RerollButton.tsx
@apps/dispatch-control/lib/nomenclature.ts
@packages/pipeline/src/eisenbalm_pipeline/api/control.py

<interfaces>
<!-- Restart honesty matrix (RESEARCH Pitfall 1) — Restart-from-step reuse backing per §7 step: -->
  LIVE (real reuse):
    Draft sections        (origin_story/problem/founder_bio/case_study/game/bonus/design) → rerun_agent (RerollButton, control.py:653; RE_ROLLABLE = 7 writers)
    Choose recommended story (editor_gate_1, ONLY when paused at interrupt)               → resume/adjudicate (control.py:786 adjudicate → _resume_paused_run)
    Prepare publication   (publisher)                                                     → NEW Clerk-guarded bridge around manual_publish (_run_publisher), Task 1
  RESERVED-with-explanation (no reuse primitive — 8 step-types):
    signal_editor, scout, verify_candidates, advocate, researcher, verify_research, qa, editor_final

<!-- Existing honesty precedent to reuse (InspectorFooter.tsx:66): -->
const RESTART_TITLE = 'Completed steps are reused, not re-paid — general step restart is not yet wired (Gate-1 resume only).'
// RESERVED_CLASSES = disabled button; FooterAction renders disabled+title when no href/onClick.

<!-- adjudicate bridge to mirror (control.py:786): @router.post("/issues/{run_id}/adjudicate") → _require_editor(...) → _resume_paused_run(...) -->
<!-- manual_publish to wrap (runs.py:583): @router.post("/run/{run_id}/publish") _require_trigger_secret → _run_publisher. New bridge = SAME _run_publisher call, but _require_editor (Clerk) instead of trigger-secret. -->

<!-- §7 recovery-rail contract + step states: Waiting · Running · Complete · Paused — done · Failed · Skipped. Failed step in vermilion; downstream dim + "Skipped". -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add the Clerk-guarded Publisher-restart bridge (contract-first)</name>
  <files>docs/API_CONTRACTS.md, packages/pipeline/src/eisenbalm_pipeline/api/control.py, packages/pipeline/tests/test_publish_bridge.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (:786 adjudicate — the exact bridge pattern: @router.post + _require_editor + audit + call into runs.py helper)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (:583 manual_publish + _run_publisher — the real reuse work to wrap)
    - docs/API_CONTRACTS.md (the pipeline endpoints section to amend FIRST)
    - .planning/phases/50-RESEARCH.md §"Pitfall 1" + §"Open Questions #5" (bridge is in-scope, ~20-30 lines, mirrors adjudicate)
  </read_first>
  <action>
    CONTRACT FIRST — amend `docs/API_CONTRACTS.md` to document a new Clerk-guarded operator endpoint that re-runs the Publisher step for a run: e.g. `POST /issues/{run_id}/publish-manual` (Editor-in-chief Clerk JWT required), which re-invokes the existing `_run_publisher` against the already-written Sanity draft — reusing all upstream work (no graph state needed). Note it is the operator-reachable sibling of the server-to-server `POST /run/{run_id}/publish` (`manual_publish`, WHK-08), differing only in auth (Clerk `_require_editor` vs `_require_trigger_secret`).
    Then in `control.py`, add the endpoint mirroring `adjudicate` EXACTLY:
      - `@router.post("/issues/{run_id}/publish-manual")`, `Depends(_require_editor)` (Clerk), audit-log the action (e.g. `action="publisher.manual_restart"`, actor from claims), then call the SAME publisher work `manual_publish` uses (`_run_publisher` from runs.py). Reuse the existing helper import path; do NOT duplicate `_run_publisher`.
      - Do NOT touch the cron/trigger-secret `manual_publish` path (runs.py:583) — it stays intact.
    Create `packages/pipeline/tests/test_publish_bridge.py` (mirror the adjudicate test):
      - Assert the endpoint requires a valid Editor Clerk claim (401/403 without; a Collaborator claim rejected — reuse the role-gate test fixtures from test_role_gate.py).
      - Assert an Editor claim invokes the publisher path (mock `_run_publisher`, assert called with the run_id) and writes an audit row.
  </action>
  <acceptance_criteria>
    - `grep -n "publish-manual\|publish_manual" docs/API_CONTRACTS.md packages/pipeline/src/eisenbalm_pipeline/api/control.py` hits in both (contract documented + endpoint added).
    - `grep -n "_require_editor" packages/pipeline/src/eisenbalm_pipeline/api/control.py` shows the new endpoint uses the Clerk editor gate.
    - The trigger-secret `manual_publish` (runs.py) is unchanged: `grep -n "_require_trigger_secret" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` still shows it guarding `/run/{run_id}/publish`.
    - `cd packages/pipeline && uv run pytest -x -q tests/test_publish_bridge.py` passes.
  </acceptance_criteria>
  <verify><automated>cd packages/pipeline && uv run pytest -x -q tests/test_publish_bridge.py</automated></verify>
  <done>An Editor-only `publish-manual` bridge re-runs the Publisher via the existing `_run_publisher` (reusing all upstream work); documented contract-first; the server-to-server path untouched; pytest green.</done>
</task>

<task type="auto">
  <name>Task 2: Build the RecoveryRail (4-part rail + Skipped dimming + honest per-step Restart + Improve this agent) + wire into failed RunDetail</name>
  <files>apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx, apps/dispatch-control/__tests__/RecoveryRail.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx (where the rail mounts; step-state rendering from 50-02)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RerollButton.tsx (the writer rerun client for "Draft sections" restart)
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx (RESTART_TITLE + RESERVED_CLASSES reserved-button pattern to reuse verbatim)
    - apps/dispatch-control/lib/nomenclature.ts (runStepFor — action labels + named flag)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §7 (recovery-rail contract + step states) + Annotations §Run Details
  </read_first>
  <action>
    Create `RecoveryRail.tsx` in `run-monitor/runs/_components/`. On a FAILED run it renders four plain-language sections in this order (verbatim §7 framing):
      - **What happened** — the failed step (action name via `runStepFor`, agent secondary) in vermilion + a plain reason.
      - **What completed successfully** — the steps with state Complete (listed by action name).
      - **What did not happen** — the downstream steps, dimmed and labeled **Skipped** (never blank).
      - **Recommended recovery** — the guidance, with the two bridge actions below.
    Two actions per the failed step:
      - **Restart from this step** — wired by the honesty matrix. For `origin_story/problem/founder_bio/case_study/game/bonus/design` → LIVE via `RerollButton`/`rerun_agent`; for `editor_gate_1` when the run is paused-at-interrupt → LIVE via the resume/adjudicate path; for `publisher` → LIVE via the new `publish-manual` bridge (Task 1). For the other 8 step-types (signal_editor, scout, verify_candidates, advocate, researcher, verify_research, qa, editor_final) → RESERVED, rendered disabled with the honest `RESTART_TITLE`-style explanation reused from `InspectorFooter` (do NOT invent a new locked component). Where LIVE and reuse is real, show the copy "completed steps are reused, not re-paid"; where RESERVED, do NOT show that reuse claim.
      - **Improve this agent** — deep-links `/prompt-lab/{agentKey}` (reuse the InspectorFooter promptHref shape; carry origin params if available, per 50-04).
    Wire `RecoveryRail` into `RunDetail.tsx` so it appears when the run status is failed (or behind the §Run Details "Failed-run recovery" demo toggle top-right, matching the prototype). Downstream steps in the main step list also dim + read "Skipped" (reuse the 50-02 step-state vocabulary).
    Create `apps/dispatch-control/__tests__/RecoveryRail.test.tsx`:
      - Assert all four labeled sections render for a failed run (what happened / what completed successfully / what did not happen / recommended recovery).
      - Assert downstream steps render dimmed + "Skipped".
      - Assert the per-step honesty matrix: enumerate the 11 step-types and assert Restart is LIVE (enabled/clickable) for {the 7 writers, editor_gate_1-when-paused, publisher} and RESERVED (disabled + explanation, no reuse claim) for {signal_editor, scout, verify_candidates, advocate, researcher, verify_research, qa, editor_final}.
      - Assert "Improve this agent" renders a link to `/prompt-lab/{agentKey}` for the failed step.
  </action>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx` exists and renders the four §7 sections + "Skipped" downstream dimming.
    - `pnpm --filter dispatch-control test -- --run RecoveryRail` passes, including the per-step honesty matrix (3 live categories, 8 reserved).
    - `grep -n "reused, not re-paid" apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx` appears only in the LIVE branches (test asserts reserved steps do NOT show the reuse claim).
    - `grep -n "Improve this agent" apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx` hits.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run RecoveryRail</automated></verify>
  <done>The failed-run recovery rail renders the 4-part plain-language explanation, dims downstream steps as "Skipped", offers an honest per-step Restart (3 live / 8 reserved), and an Improve-this-agent deep link.</done>
</task>

<task type="auto">
  <name>Task 3: Upgrade InspectorFooter "Restart from this step" from blanket-reserved to per-step honesty</name>
  <files>apps/dispatch-control/components/inspector/InspectorFooter.tsx</files>
  <read_first>
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx (the "Restart from this step" FooterAction, currently always RESERVED per Phase 44; RESTART_TITLE at :66)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RerollButton.tsx (writer rerun wiring)
    - .planning/phases/50-RESEARCH.md §"State of the Art" (the three-way distinction the InspectorFooter + rail both need) + §"Pitfall 1"
  </read_first>
  <action>
    In `InspectorFooter.tsx`, upgrade the "Restart from this step" footer action from the Phase-44 blanket-reserved posture to the SAME three-tier honesty matrix used by the RecoveryRail (Task 2). Given the inspector artifact's `agentKey`:
      - LIVE (onClick/href) for the 7 writers (rerun_agent), the Gate-1 pause case (resume/adjudicate), and publisher (the new publish-manual bridge) — reuse the existing LIVE FooterAction rendering.
      - RESERVED (disabled + explanatory title) for the other 8 step-types, keeping the honest `RESTART_TITLE` copy ("general step restart is not yet wired") — do NOT falsely enable it everywhere, and do NOT leave the 3 real cases needlessly reserved.
    Keep the "Improve this agent →" action (and its 50-04 origin params) intact — do not regress it. Extend/adjust the InspectorFooter test (or add to RecoveryRail.test) to assert the footer's Restart is live for a writer artifact and reserved-with-explanation for a `qa` artifact.
  </action>
  <acceptance_criteria>
    - `grep -n "Restart from this step" apps/dispatch-control/components/inspector/InspectorFooter.tsx` hits and the action is no longer unconditionally disabled (per-agentKey branching present).
    - A test asserts InspectorFooter Restart is LIVE for a writer artifact (e.g. `origin_story`) and RESERVED-with-title for a `qa` artifact.
    - The "Improve this agent →" origin params from 50-04 still present (`grep -n "fromRun" InspectorFooter.tsx` hits).
    - `pnpm --filter dispatch-control build` exits 0 and `pnpm --filter dispatch-control test -- --run` full suite green.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run InspectorFooter RecoveryRail && pnpm --filter dispatch-control build</automated></verify>
  <done>InspectorFooter's Restart honestly reflects the 3-live/8-reserved matrix (matching the rail), preserving the 50-04 Improve-this-agent origin wiring.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -x -q tests/test_publish_bridge.py` green.
- `pnpm --filter dispatch-control test -- --run RecoveryRail InspectorFooter` green.
- `pnpm --filter dispatch-control build` exits 0.
- Full suites before phase gate: `pnpm --filter dispatch-control test -- --run` + `cd packages/pipeline && uv run pytest -x -q`.
</verification>

<success_criteria>
- Failed run shows a 4-part plain-language recovery rail with downstream steps dimmed as "Skipped".
- "Restart from this step" is LIVE for exactly the 3 backed step-types (writers, Gate-1 pause, publisher via the new bridge) and reserved-with-explanation for the other 8; reuse copy appears only where real.
- "Improve this agent" deep-links Agent Instructions from the failed step.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-05-SUMMARY.md`.
</output>
