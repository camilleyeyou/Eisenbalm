---
phase: 50-workbench-nomenclature
plan: 06
type: execute
wave: 3
depends_on: ["50-01", "50-02", "50-03", "50-04", "50-05"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AssembledPreview.tsx
  - apps/dispatch-control/app/(dashboard)/eval-center/_components
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components
  - apps/dispatch-control/__tests__/nomenclature.test.ts
autonomous: true
requirements: [WBN-05]

must_haves:
  truths:
    - "The how-to-use glossary uses product nomenclature; no legacy term (gate, node, eval, golden scenario, shadow run, blocklist, commit, auto-publish, Run Monitor) survives"
    - "The stale 'three deterministic checks' legend is corrected to the reconciled diamond semantics"
    - "The 260710-k8y conflict terms (Rehearsal, Make live, LIVE badge, Draft vs. live) are corrected to the binding vocabulary"
    - "Prompt Lab / Eval Center copy reads Test changes / Make active / Restore version / Standard test case / Preview next run / Quality test"
    - "The nomenclature source-scan tripwire is un-skipped and green"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx"
      provides: "swept glossary + corrected deterministic-check legend"
      contains: "deterministic check"
    - path: "apps/dispatch-control/__tests__/nomenclature.test.ts"
      provides: "active (un-skipped) banned-term tripwire proving no legacy term survives"
      contains: "FORBIDDEN_COPY_TERMS"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx"
      to: "binding nomenclature (Make active / active version)"
      via: "260710-k8y 'Make live'/'LIVE' corrected"
      pattern: "Make active"
    - from: "apps/dispatch-control/__tests__/nomenclature.test.ts"
      to: "operator-facing copy under app/ + components/"
      via: "recursive source-scan, allowlisted for identifiers/routes/enums"
      pattern: "describe\\('nomenclature"
---

<objective>
WBN-05. Sweep every remaining legacy term out of operator-facing copy against the binding nomenclature table — the how-to-use glossary (the densest hot spot), the Prompt Lab / Eval Center copy, and the already-live 260710-k8y conflict vocabulary — then un-skip the Wave-0 tripwire so "no legacy term survives" is proven green.

Purpose: The renames in 50-01..50-05 covered nav/headings/Run Details/automation/Registry. This plan closes the long tail: the glossary's ~9 legacy terms + stale "three deterministic checks" legend, the Prompt Lab / Eval Center prose, and — critically — the three newer-but-wrong strings (Rehearsal / Make live / Draft vs. live) that a sweep keyed only to the spec's "old" column would miss (RESEARCH Pitfall 3). This is the phase's WBN-05 close-out.
Output: swept copy across all hot spots + a green, un-skipped nomenclature tripwire.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@.planning/phases/50-workbench-nomenclature/50-RESEARCH.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
@apps/dispatch-control/lib/nomenclature.ts
@apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
@apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx
@apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
@apps/dispatch-control/__tests__/nomenclature.test.ts

<interfaces>
<!-- BINDING nomenclature table (Annotations §Workbench nomenclature) — Old → In the product: -->
  Gate / code gate                 → deterministic check
  Node, re-run from node           → step, Restart from this step
  Monitor (idle)                   → Run Details — historical record
  Prompt / asset                   → Instructions (asset key secondary)
  Seeded / never seeded            → has a starting version / no starting version
  Commit / rollback                → Make active / Restore version
  Eval, run evals                  → Quality test, Test changes
  Golden scenario                  → Standard test case
  Shadow run                       → Preview next run
  Blocklisted                      → Do not use
  Coverage memory / registry record→ Recent coverage / Organization history

<!-- 260710-k8y conflict terms (RESEARCH Pitfall 3) — newer-but-wrong, MUST correct: -->
  "Rehearsal"        → "Test changes"       (TestRunPanel.tsx:195, :10, :43)
  "Make live"/"Making live…" → "Make active" (VersionHistoryPanel.tsx:273/278/281, :11)
  ">LIVE<" badge / "LIVE badge" → "active version" (VersionHistoryPanel.tsx:232, :6)
  "Draft vs. live"   → "Compare results"    (TestRunPanel.tsx:314, :21, :148)

<!-- how-to-use legacy terms confirmed (grep): Gate 1(:19), Run Monitor(:29), node(:34), Re-run from this node(:36), Eval Center(:73), run evals(:76), commit(:77), blocklist(:123), auto-publish(:123). -->
<!-- Reconciled diamond legend: exactly TWO deterministic checks — Verify organizations (verify_candidates) + Verify research (verify_research); publisher's diamond marks Prepare publication (a real action, not a check). Do NOT say "three deterministic checks." -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sweep the how-to-use glossary + correct the deterministic-check legend</name>
  <files>apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx (the full glossary + WEEKLY_LOOP + the "three deterministic checks" legend)
    - apps/dispatch-control/lib/nomenclature.ts (PRODUCT_TERMS + WORKBENCH_NAV_LABELS + RUN_STEP_MAP)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Workbench nomenclature + §Nomenclature applied throughout
    - .planning/phases/50-RESEARCH.md §"Open Questions #1" (term-swap the WEEKLY_LOOP screen labels + fix banned terms; a fuller narrative rewrite is OUT of scope this phase)
  </read_first>
  <action>
    Sweep `how-to-use/page.tsx` term-by-term using the binding table:
      "Gate 1" → "Choose recommended story" (the Gate-1 decision) or "deterministic check" depending on context; "code gate"/"gate" → "deterministic check".
      "node"/"Re-run from this node" → "step"/"Restart from this step".
      "Run Monitor" → "Run Details"; "Eval Center" → "Quality Tests".
      "run evals"/"evals"/"eval" (prose) → "Test changes"/"Quality test".
      "commit" → "Make active"; "rollback"/"restore" → "Restore version".
      "golden scenario"/"golden-scenario" → "Standard test case"; "shadow run" → "Preview next run".
      "blocklist"/"blocklisted" → "Do not use"; "auto-publish" → "Human approval required" (and reference Administration for the setting).
    Correct the stale legend: replace any "three deterministic checks" claim with the reconciled truth — there are TWO deterministic checks (Verify organizations, Verify research); the marigold diamond also marks Prepare publication (the Publisher), which is a real action, not a check. Name the two checks explicitly; never call any of them a "gate."
    Update the WEEKLY_LOOP `screen:` labels to the closest current stage/screen names (Story & Brief / Draft / Fact Check / Voice Pass / Approval inside the Issue Workspace, and the renamed Workbench screens) — a term-swap of the labels, NOT a full narrative rewrite (the deeper 5-stage-architecture rewrite is explicitly deferred; note this in the SUMMARY).
    Prefer referencing `PRODUCT_TERMS`/`WORKBENCH_NAV_LABELS` constants where the copy is dynamic; verbatim strings are fine for prose.
  </action>
  <acceptance_criteria>
    - `grep -oniE "gate 1|\bcode gate\b|\bnode\b|re-run from this node|run evals|golden.?scenario|shadow run|blocklist|\bcommit\b|auto-publish|Run Monitor|Eval Center" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` returns NO operator-facing prose hits (allowlisted identifiers/route paths excluded).
    - `grep -n "three deterministic checks" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` returns nothing; the legend names Verify organizations + Verify research as the two checks.
    - `grep -n "deterministic check\|Restart from this step\|Quality test\|Standard test case\|Preview next run\|Do not use\|Make active\|Restore version" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` shows product terms present.
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control build</automated></verify>
  <done>The glossary uses product nomenclature throughout; the deterministic-check legend is corrected to two checks + the Publisher diamond; WEEKLY_LOOP screen labels term-swapped (fuller narrative rewrite deferred).</done>
</task>

<task type="auto">
  <name>Task 2: Sweep Prompt Lab + Eval Center copy incl. the 260710-k8y conflict terms</name>
  <files>apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx, apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx, apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx, apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AssembledPreview.tsx, apps/dispatch-control/app/(dashboard)/eval-center/_components, apps/dispatch-control/app/(dashboard)/signal-desk/_components</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx (:10, :43, :195 "Rehearsal"; :21, :148, :314 "Draft vs. live")
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx (:6, :11, :232 "LIVE"; :273/278/281 "Make live"/"Making live…")
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx + AssembledPreview.tsx ("evals", "commit", "eval gate")
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/* + signal-desk/_components/* ("Golden scenarios", "Shadow run", "Gate 1")
    - .planning/phases/50-RESEARCH.md §"Pitfall 3" (the exact conflict strings) + §"State of the Art" (Prompt Lab vocabulary rows)
  </read_first>
  <action>
    Correct the 260710-k8y conflict vocabulary to the binding table (these are the highest-value catches — a term-swap keyed only to the spec's "old" column misses them):
      "Rehearsal" (heading + descriptors + comments) → "Test changes".
      "Make live" / "Making live…" / "Make live v{n}" → "Make active" / "Making active…" / "Make active v{n}".
      ">LIVE<" badge text / "LIVE badge" → "active version" (badge reads "Active").
      "Draft vs. live" (compare action + comments) → "Compare results".
    Then the spec's own "old" column across Prompt Lab / Eval Center / Signal Desk:
      "eval"/"evals"/"run evals"/"eval gate"/"eval drawer" copy → "Quality test"/"Test changes"/"quality-test gate" (the Phase 38 commit-gate WIRING stays byte-unchanged — copy only, per D-14).
      "commit"/"rollback"/"restore" prose → "Make active"/"Restore version".
      "Golden scenario"/"Golden scenarios" → "Standard test case(s)".
      "Shadow run" → "Preview next run".
      "Gate 1" (signal-desk) → "Choose recommended story" (the Gate-1 decision) / "deterministic check" per context.
      "despite the red eval gate" style phrasing → quality-test phrasing (e.g. "despite the failing quality test").
    Do NOT change any handler names, endpoints, `eval_scores`/`evalScores` identifiers, route paths, component names (EvalDrawer), or the commit-gate/activate logic — copy only. Where copy is dynamic, prefer `PRODUCT_TERMS` from `lib/nomenclature.ts`.
  </action>
  <acceptance_criteria>
    - `grep -rn "Rehearsal\|Make live\|Making live\|Draft vs\. live" apps/dispatch-control/app/(dashboard)/prompt-lab/` returns NOTHING.
    - `grep -rn ">LIVE<\|LIVE badge" apps/dispatch-control/app/(dashboard)/prompt-lab/` returns NOTHING (badge now reads "Active"/"active version").
    - `grep -rniE "golden.?scenario|shadow run|run evals" apps/dispatch-control/app/(dashboard)/eval-center apps/dispatch-control/app/(dashboard)/prompt-lab` returns no operator-facing prose hits.
    - The Phase 38 commit-gate / activate wiring is unchanged (grep the mutation/gate call sites show no logic edits — only labels).
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control build</automated></verify>
  <done>Prompt Lab / Eval Center / Signal Desk copy uses the binding vocabulary; the 260710-k8y conflict strings are gone; the commit-gate/activate wiring is byte-unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Un-skip the nomenclature tripwire + phase gate (full suites + strict build)</name>
  <files>apps/dispatch-control/__tests__/nomenclature.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/nomenclature.test.ts (the skip-guarded scaffold from 50-00 — flip .skip→active)
    - apps/dispatch-control/__tests__/rename-preservation.test.ts (must still be green — routes/enums preserved)
    - .planning/phases/50-VALIDATION.md §"Sampling Rate" + §"Validation Sign-Off"
    - .planning/phases/50-RESEARCH.md §"Validation Architecture" (allowlist tuning against real occurrences)
  </read_first>
  <action>
    Un-skip `nomenclature.test.ts`: change `describe.skip('nomenclature sweep', …)` → `describe('nomenclature sweep', …)`. Run it; for any REMAINING violation it reports, either (a) fix the operator copy (the intended path — extends the sweep to whatever the scans in Tasks 1-2 missed), or (b) if it is a genuine false-positive on a code identifier/route/enum/component name, add a NARROW allowlist entry (never broaden so far it stops catching real prose). Iterate until the tripwire is green with the full FORBIDDEN_COPY_TERMS set (spec "old" column + the 260710-k8y conflict terms) active. Do NOT weaken the banned set to force green.
    Then run the phase gate:
      - Full frontend suite: `pnpm --filter dispatch-control test -- --run` (all green, including nomenclature + rename-preservation + pipelineTopology + runDetailActionNames + registryDoNotUse + publishNoTypedConfirm + promptVersionOrigin + RecoveryRail + nav).
      - Strict build: `pnpm --filter dispatch-control build` exits 0 (CLAUDE.md hard rule — vitest does not type-check).
      - Backend (bridge from 50-05): `cd packages/pipeline && uv run pytest -x -q` green.
    Record the final banned set + allowlist decisions in the SUMMARY.
  </action>
  <acceptance_criteria>
    - `grep -n "describe.skip" apps/dispatch-control/__tests__/nomenclature.test.ts` returns NOTHING (un-skipped).
    - `pnpm --filter dispatch-control test -- --run nomenclature` passes with the full FORBIDDEN_COPY_TERMS set active (incl. Rehearsal, Make live, Draft vs. live).
    - `pnpm --filter dispatch-control test -- --run` full suite green; `pnpm --filter dispatch-control build` exits 0.
    - `cd packages/pipeline && uv run pytest -x -q` green.
    - rename-preservation stays green (no route/enum was renamed to satisfy the sweep).
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run && pnpm --filter dispatch-control build</automated></verify>
  <done>The nomenclature tripwire is active and green — no legacy term survives in operator copy — with the full suite + strict build + backend pytest all passing and routes/enums preserved.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run` (full suite incl. active nomenclature + rename-preservation) green.
- `pnpm --filter dispatch-control build` exits 0.
- `cd packages/pipeline && uv run pytest -x -q` green.
- No legacy term (gate, node, eval, golden scenario, shadow run, blocklist, commit, auto-publish, Rehearsal, Make live, Draft vs. live) in operator-facing copy; routes + 'blocklisted' enum preserved.
</verification>

<success_criteria>
- Every renamed term from the binding table appears consistently; no legacy or 260710-k8y-conflict term remains in operator-facing copy.
- The how-to-use deterministic-check legend is corrected.
- The nomenclature source-scan tripwire is un-skipped and green; the phase gate (full suites + strict build) passes.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-06-SUMMARY.md`.
</output>
