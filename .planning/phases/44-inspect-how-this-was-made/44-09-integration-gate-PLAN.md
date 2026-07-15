---
phase: 44-inspect-how-this-was-made
plan: 09
type: execute
wave: 6
depends_on: ["44-01", "44-02", "44-03", "44-04", "44-05", "44-06", "44-07", "44-08"]
files_modified:
  - .planning/phases/44-inspect-how-this-was-made/44-UAT.md
autonomous: false
requirements: [INS-01, INS-02, INS-03, INS-04, INS-05, INS-06]
must_haves:
  truths:
    - "The full console vitest suite is green, including every Wave-0 test now filled (inspectorArtifact, missingInputsDiff, outputDivergence, InspectorPanel, InspectorProvider) and every prior-phase tripwire (claimProvenance, sectionIdMap, derivedState, dispatch-control-no-sanity-write)."
    - "The strict Next build passes (vitest does not type-check — MEMORY note: run the build before declaring any frontend phase done)."
    - "The additive inputKeys field is deployed to Convex (committing convex/*.ts is not deploying — MEMORY note) and pipeline pytest is green."
    - "The six entry points open the SAME single panel on a real run — persisted as human-verification UAT items."
  artifacts:
    - path: ".planning/phases/44-inspect-how-this-was-made/44-UAT.md"
      provides: "the manual cross-surface verification checklist (the three VALIDATION manual-only items)"
  key_links:
    - from: "the whole console app"
      to: "one InspectorProvider + six entry points"
      via: "full suite + strict build + Convex sync + live UAT"
      pattern: "InspectorProvider"
---

<objective>
The phase gate (mirroring Phase 43's 43-09 integration-gate). Prove the whole inspector feature holds together: the full console suite green (all Wave-0 tests filled + all prior tripwires), the strict Next build green (vitest does not type-check), the additive `inputKeys` Convex field actually deployed (committing convex/*.ts ≠ deployed), pipeline pytest green, the no-Sanity-write tripwire intact (the inspector is read-only, D-09/EDT-05), and the cross-surface behavior captured as human-verification UAT items that jsdom cannot assert.

Purpose: Nothing latent ships to Vercel/Convex; the "same panel from six places" claim is verified on a real run.
Output: green gates + a persisted 44-UAT.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/44-inspect-how-this-was-made/44-VALIDATION.md
@.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md
@docs/API_CONTRACTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full-suite + strict-build + Convex-sync + pipeline gate</name>
  <read_first>
    - .planning/phases/44-inspect-how-this-was-made/44-VALIDATION.md (the Sampling Rate "Phase gate" row + the Validation Sign-Off checklist)
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entries "Run strict build before frontend phase done" and "Convex functions need live sync" (the two failure modes this gate exists to catch)
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (the read-only tripwire — must stay green; the inspector performs no mutations)
  </read_first>
  <action>
    Run, in order, and fix any failure before proceeding:
    1. `pnpm --filter dispatch-control test` — the FULL console vitest suite. Must be green, including inspectorArtifact / missingInputsDiff / outputDivergence / InspectorPanel / InspectorProvider (all Wave-0 stubs now filled) AND the prior tripwires claimProvenance.test.ts, sectionIdMap.test.ts, derivedState.test.ts, dispatch-control-no-sanity-write.test.ts.
    2. `pnpm --filter dispatch-control build` — strict Next/TS build (catches Linux/Vercel-only type errors vitest misses).
    3. `cd packages/pipeline && pytest tests/test_agent_wrapper.py -x` — the inputKeys emission + truncation-honesty test.
    4. Convex sync of the additive `inputKeys` field so it is live (not just committed): `pnpm --filter @eisenbalm/convex dev:once` (deploy to dev:modest-magpie-797, per the MEMORY "Convex functions need live sync" note) — confirm no schema push error on `agent_run_payloads`.
    5. Confirm the no-Sanity-write tripwire passed in step 1 (the inspector is read-only — no console→Sanity write was introduced).
    Record the pass/fail of each in the plan summary.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test && pnpm build && cd ../../packages/pipeline && pytest tests/test_agent_wrapper.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test` exits 0 with the five inspector test files present and passing (no it.todo remain: `grep -rc "it.todo" apps/dispatch-control/__tests__/inspector*.ts* apps/dispatch-control/__tests__/missingInputsDiff.test.ts apps/dispatch-control/__tests__/outputDivergence.test.ts apps/dispatch-control/__tests__/InspectorPanel.test.tsx` all return 0).
    - `pnpm --filter dispatch-control build` exits 0.
    - `cd packages/pipeline && pytest tests/test_agent_wrapper.py -x` exits 0.
    - The Convex `dev:once` sync completes without a schema-push error.
    - `dispatch-control-no-sanity-write.test.ts` is green (read-only boundary intact).
  </acceptance_criteria>
  <done>All automated gates green and the inputKeys field is live in Convex.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Cross-surface live verification (the six entry points, one panel)</name>
  <read_first>
    - .planning/phases/44-inspect-how-this-was-made/44-VALIDATION.md § "Manual-Only Verifications" (the three items: same panel from six surfaces; human-readable-first reads correctly; missing-inputs call-out is genuinely useful)
  </read_first>
  <what-built>The universal 7-tab inspector, one instance at the (dashboard) root, reachable from six entry points (brief org card, draft passage/finding, fact-check claim, voice finding, approval recommendation, My Tasks), with the redefined missing-state-inputs diff on the Inputs tab.</what-built>
  <action>Pause for the operator to perform the cross-surface live verification steps in how-to-verify on a real run. This is a human-verify checkpoint — the executor runs no code here; it presents the steps, waits for the resume signal, and records the pass/fail outcomes into `.planning/phases/44-inspect-how-this-was-made/44-UAT.md` (mirroring Phase 43's UAT persistence). Any failure is recorded as a gap for a follow-up `--gaps` plan, never silently marked pass.</action>
  <how-to-verify>
    On a real run in the console:
    1. Open the inspector from ALL SIX surfaces and confirm it is the SAME panel each time with the correct artifact:
       - brief org card (Story stage) → org/scout artifact;
       - a draft passage finding + a section header (Draft stage) → founder artifact;
       - a fact-check claim's Inspect button (Fact Check stage) → claim/researcher artifact;
       - a voice finding (Voice stage) → founder artifact;
       - the agent editor's recommendation Inspect (Approval) → rec/editor_final artifact;
       - a qa/claim task's "Inspect context" (My Tasks) → the same artifact its deep-link targets (and confirm the two sign-off rows' button stays reserved/disabled).
    2. On each tab, confirm human-readable content leads and raw JSON only appears on Technical (default is Summary).
    3. Inspect a real drafted section and confirm the "Missing expected inputs" call-out is meaningful (real state-input names with glosses, or "all supplied") — NOT every declared variable flagged (the Pitfall-1 failure mode).
    4. Confirm "Improve this agent →" deep-links to the agent's prompt-lab page; "Restart from this step" and "Ask agent to revise" are visibly reserved/disabled with explanatory titles.
    Persist the outcomes into `.planning/phases/44-inspect-how-this-was-made/44-UAT.md` (pass/fail per item, mirroring Phase 43's UAT persistence).
  </how-to-verify>
  <verify>Human confirms per the how-to-verify steps; the outcomes are written to 44-UAT.md.</verify>
  <acceptance_criteria>
    - `.planning/phases/44-inspect-how-this-was-made/44-UAT.md` exists and records a pass/fail line for each of the three VALIDATION manual-only items + the six-surface check.
    - Any failure is captured as a gap (for a follow-up `--gaps` plan), not silently marked pass.
  </acceptance_criteria>
  <done>44-UAT.md records a pass/fail per manual-only item + the six-surface check; the operator has approved.</done>
  <resume-signal>Type "approved" when all six surfaces open the same panel with correct artifacts and the missing-inputs call-out is meaningful; otherwise describe the failing surface(s).</resume-signal>
</task>

</tasks>

<verification>
- Full console suite, strict build, and pipeline pytest all green; Convex inputKeys field synced; no-Sanity-write tripwire intact.
- 44-UAT.md persists the cross-surface human verification.
</verification>

<success_criteria>
- The phase is provably whole: every INS requirement's automated test passes, the build/type-check is clean, the schema change is live, and the "same inspector from six places with a trustworthy missing-inputs diff" behavior is human-verified on a real run.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-09-SUMMARY.md` and ensure `.planning/phases/44-inspect-how-this-was-made/44-UAT.md` is persisted.
</output>
