---
phase: 44-inspect-how-this-was-made
plan: 01
subsystem: docs
tags: [contract-first, vitest, convex, inspector, dispatch-control]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    provides: ClaimProvenanceCard.onInspect stub, claim_checks substrate
  - phase: 43-my-tasks-decision-log
    provides: DerivedTask.insp field, My Tasks "Inspect context" stub
provides:
  - "docs/API_CONTRACTS.md §44 — the full InspectorArtifact contract (shape, artifact-key encoding, pure resolver, redefined missing-inputs diff, additive inputKeys field, openInspector contract, footer live-vs-reserved table, NON_EXTERNALIZED_SHARED_RULES map + instruction-version mapping)"
  - "Five Wave-0 vitest scaffold files (it.todo per VALIDATION.md case) for plans 44-03 through 44-06"
affects: [44-02, 44-03, 44-04, 44-05, 44-06, 44-07, 44-08, 44-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first (CLAUDE.md hard rule) — §44 written before any resolver/panel/schema code, mirroring §31/§35/§40/§42/§43"
    - "Wave-0 it.todo scaffolding — test files enumerate every VALIDATION.md case as a placeholder before implementation, keeping the suite green across waves"
    - "Vocabulary redefinition over literal-spec diffing — when a design-spec diff computation is broken by construction (two vocabularies that never intersect), the contract documents the coarser-but-correct substitute and marks the literal version an explicit non-goal rather than shipping a diagnostic that is wrong by construction"

key-files:
  created:
    - apps/dispatch-control/__tests__/inspectorArtifact.test.ts
    - apps/dispatch-control/__tests__/missingInputsDiff.test.ts
    - apps/dispatch-control/__tests__/outputDivergence.test.ts
    - apps/dispatch-control/__tests__/InspectorPanel.test.tsx
    - apps/dispatch-control/__tests__/InspectorProvider.test.tsx
  modified:
    - docs/API_CONTRACTS.md

key-decisions:
  - "Redefined the missing-inputs diff onto DECLARED_STATE_INPUTS (a TypeScript port of agent_wrapper.py's _INPUT_KEYS) instead of the CONTEXT D-04 literal VARIABLE_REGISTRY-vs-inputSnapshot diff, which is broken by construction (44-RESEARCH Pitfall 1) — the fine-grained {token}-level diff is documented as an explicit non-goal for this phase"
  - "NON_EXTERNALIZED_SHARED_RULES map ships so the Instructions tab never renders a bare one-liner for the 5 agents with no prompt_versions row (origin_story/problem/founder_bio/case_study -> VOICE_CONSTRAINTS+STRUCTURE_CONTRACT; qa -> rubric, fetchable)"
  - "editor_gate_1 (agent_runs namespace) vs editor_gate1 (prompt_versions/VARIABLE_REGISTRY namespace) is the resolver's one explicit alias, pinned in runKeyToPromptKey"
  - "claim artifacts resolve to agentKey 'researcher', not a claim_checks.agent field (which does not exist) — corrects CONTEXT.md D-02's optimistic characterization"
  - "Restart from this step renders reserved for ALL six artifact types — POST /run/{id}/resume is hardcoded to the Gate-1 interrupt shape and cannot serve generic step-restart"
  - "Diagnostics 'model' renders 'not recorded' (zero schema change) — agent_runs has no model field; the inputKeys additive field is where this phase's one schema-change budget line item goes"

patterns-established:
  - "Per-agent declared-state-inputs vocabulary (DECLARED_STATE_INPUTS) as the correct 'declared' side of a missing-inputs diagnostic when the fine-grained prompt-token vocabulary doesn't intersect with the captured payload's key vocabulary"
  - "Shared-rules label+content row shape ({ label, content? }[]) for surfacing code-defined constants alongside fetchable prompt-lab rows on the same tab, never blank either way"

requirements-completed: [INS-01, INS-02, INS-03, INS-04, INS-05, INS-06]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 44 Plan 01: Contract and Wave-0 Test Stubs Summary

**Wrote docs/API_CONTRACTS.md §44 (the full InspectorArtifact contract, redefining the missing-inputs diff onto a computable declared-state-inputs vocabulary) and scaffolded five Wave-0 vitest files enumerating every 44-VALIDATION.md test case as it.todo.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 6 (1 modified, 5 created)

## Accomplishments
- `docs/API_CONTRACTS.md` gained a new `## §44 — Inspect How This Was Made (Phase 44)` section with 9 numbered sub-sections plus a `§44.RECONCILIATION` note — the InspectorArtifact shape (verbatim from DERIVED-STATE-CONTRACT §8, plus the additive `sharedRules` field), the artifact-key string encoding, the pure resolver contract including the `editor_gate_1`/`editor_gate1` alias and bonus-variant selection, the REDEFINED missing-inputs diff (`DECLARED_STATE_INPUTS`, ported from `agent_wrapper.py::_INPUT_KEYS`), the additive `agent_run_payloads.inputKeys` schema field, the `openInspector` one-instance contract, the footer live-vs-reserved action table, the Diagnostics "model: not recorded" decision, and the `NON_EXTERNALIZED_SHARED_RULES` map + externalized instruction-version mapping.
- Five Wave-0 vitest scaffold files created under `apps/dispatch-control/__tests__/`, each enumerating the exact `it.todo` cases from `44-VALIDATION.md`'s Per-Task Verification Map, with zero imports of not-yet-existing inspector modules so the suite stays green through every subsequent wave.
- Full console vitest suite verified green after both tasks: 91 test files passed / 6 skipped (the 5 new scaffolds + one pre-existing todo file), 786 tests passed / 29 todo.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/API_CONTRACTS.md §44 — the full inspector contract** - `1981cad` (docs)
2. **Task 2: Create the five Wave-0 vitest scaffold files (it.todo per VALIDATION case)** - `5aa5484` (test)

_No TDD tasks in this plan — both were `type="auto"` non-TDD tasks per the plan frontmatter._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - Appended §44 (9 sub-sections + reconciliation note), the phase's binding contract for all downstream 44-xx plans
- `apps/dispatch-control/__tests__/inspectorArtifact.test.ts` - INS-01 resolver test scaffold (8 `it.todo` cases)
- `apps/dispatch-control/__tests__/missingInputsDiff.test.ts` - INS-03 diff/truncation-honesty test scaffold (5 `it.todo` cases)
- `apps/dispatch-control/__tests__/outputDivergence.test.ts` - INS-05 divergence test scaffold (3 `it.todo` cases)
- `apps/dispatch-control/__tests__/InspectorPanel.test.tsx` - INS-02/INS-04/INS-06 panel test scaffold (9 `it.todo` cases)
- `apps/dispatch-control/__tests__/InspectorProvider.test.tsx` - INS-01 one-instance/openInspector test scaffold (2 `it.todo` cases)

## Decisions Made
- **Missing-inputs diff redefinition (44-RESEARCH Pitfall 1, non-negotiable):** the plan's own `must_haves` required documenting this reconciliation; §44.4 states the rejected literal recipe plainly, then specifies `DECLARED_STATE_INPUTS` (mirroring `_INPUT_KEYS`) as the shipped diagnostic, with the fine-grained `{token}`-level version marked an explicit non-goal (grep-verified: `non-goal` appears in the contract).
- **Instructions-tab honesty for non-externalized agents (44-RESEARCH Pitfall 2):** rather than letting the Instructions tab go blank for `origin_story`/`problem`/`founder_bio`/`case_study`/`qa` (the 5 agents with no `prompt_versions` row), §44.9 pins `NON_EXTERNALIZED_SHARED_RULES` and the instruction-version mapping so every artifact type's Instructions tab renders real content — either the active version+content for the 11 externalized agents, or the shared-rules labels (+ fetchable `rubric` content for `qa`) for the 5 that aren't.
- **`org` artifact stays resolvable to `scout` primarily** (not gated behind Phase 46/47) per 44-RESEARCH's correction that the brief org card / `StoryPanelContent.tsx` is real and live today — this was already CONTEXT.md D-02's phrasing ("scout / editor_gate1") and is preserved as-is in §44.3's resolution table.
- **`Restart from this step` reserved for all artifact types, no exceptions** — confirmed via direct read of `api/runs.py:435-498`'s `_resume_paused_run` that the endpoint is hardcoded to the Gate-1 `interrupt()` payload shape; wiring it generically would misfire.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria for both tasks were verified via the automated grep/test commands specified in the plan itself, with no auto-fixes needed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan is documentation + test scaffolding only.

## Next Phase Readiness
- `docs/API_CONTRACTS.md §44` is the complete, self-contained specification downstream plans (44-02 through 44-09) implement from — no field name, function name, or predicate needs to be invented by a later plan.
- `agent_run_payloads.inputKeys` (§44.5) is specified and ready for Plan 44-02 to add to `convex/schema.ts` + emit from `agent_wrapper.py::_snapshot_input()`.
- The five Wave-0 test scaffolds give plans 44-03 (resolver), 44-04 (diff/divergence), 44-05 (panel), and 44-06 (provider) a concrete, pre-agreed assertion checklist to convert from `it.todo` to live assertions.
- No blockers. The `§44.RECONCILIATION` note flags two corrections to CONTEXT.md's D-02 characterization (the `editor_gate_1`/`editor_gate1` alias and the `claim_checks` "no agent field" correction) that all downstream plans must honor as binding, not CONTEXT.md's original phrasing.

---
*Phase: 44-inspect-how-this-was-made*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: `docs/API_CONTRACTS.md`
- FOUND: `apps/dispatch-control/__tests__/inspectorArtifact.test.ts`
- FOUND: `apps/dispatch-control/__tests__/missingInputsDiff.test.ts`
- FOUND: `apps/dispatch-control/__tests__/outputDivergence.test.ts`
- FOUND: `apps/dispatch-control/__tests__/InspectorPanel.test.tsx`
- FOUND: `apps/dispatch-control/__tests__/InspectorProvider.test.tsx`
- FOUND commit: `1981cad` (docs(44-01): add §44 inspector contract)
- FOUND commit: `5aa5484` (test(44-01): scaffold Wave-0 inspector test files)
