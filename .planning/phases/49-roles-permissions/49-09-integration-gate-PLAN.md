---
phase: 49-roles-permissions
plan: 09
type: execute
wave: 4
depends_on: ["49-02", "49-03", "49-04", "49-05", "49-07", "49-08"]
files_modified:
  - apps/dispatch-control/__tests__/roleGateInventory.test.ts
autonomous: false
requirements: [ROL-01, ROL-02, ROL-03, ROL-04]

must_haves:
  truths:
    - "Exactly six actions are role-gated — a source-scan asserts _require_editor at the 3 Depends routes + the sounds-human in-handler branch + requireEditor at the 2 Convex mutations, and NO other handler/mutation is newly gated."
    - "Both full suites (pipeline pytest + dispatch-control vitest) and the strict Next build are green, and the Convex dev deployment is synced."
    - "The empirical claim-propagation gate (Plan 49-02) is recorded, and a Collaborator visibly sees locked controls + a reachable comment affordance across the workspace."
  artifacts:
    - path: "apps/dispatch-control/__tests__/roleGateInventory.test.ts"
      provides: "the exactly-six-gated source-scan tripwire (SC-2 proof)"
      contains: "requireEditor"
  key_links:
    - from: "roleGateInventory.test.ts"
      to: "the 6 gated handlers"
      via: "source-scan counting the gate call sites across both backends"
      pattern: "_require_editor|requireEditor"
---

<objective>
Prove the phase's cross-cutting invariants and gate completion: a source-scan test that the gate is on EXACTLY six actions (SC-2), both full suites + strict build green, dev Convex synced, and a final human-verify that a Collaborator sees the locked controls + comment affordance as intended (plus the empirical claim-propagation gate from Plan 49-02 is on record).

Purpose: ROL-01..04 acceptance in aggregate. This is the integration/build gate wave — the repo's established final step (memory: run the strict build before declaring any frontend phase done; sync Convex before declaring done).
Output: `roleGateInventory.test.ts`; green full suites + build + sync; recorded human sign-off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-VALIDATION.md
@docs/API_CONTRACTS.md

<interfaces>
The exact six gate call sites the inventory test must find (and no others):
  FastAPI Depends swap (3):  revision.py, factcheck.py, review.py  → `Depends(_require_editor)`
  FastAPI in-handler (1):    signoffs.py record_sign_off → `body.kind == "sounds-human"` role branch
  Convex swap (2):           promptVersions.ts, charities.ts → `requireEditor(ctx)`
Source-scan precedent to model: apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (fs recursive scan + FORBIDDEN/EXPECTED regex arrays).
Full-suite commands (49-VALIDATION.md): `cd packages/pipeline && uv run pytest -x -q`; `cd apps/dispatch-control && pnpm test`; `pnpm --filter dispatch-control build`; `pnpm --filter @eisenbalm/convex dev:once`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write roleGateInventory.test.ts — the exactly-six-gated tripwire (SC-2)</name>
  <files>apps/dispatch-control/__tests__/roleGateInventory.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (the fs recursive source-scan pattern to mirror)
    - docs/API_CONTRACTS.md §49.4 (the authoritative six-action inventory + which mechanism each uses)
    - packages/pipeline/src/eisenbalm_pipeline/api/{revision,factcheck,signoffs,review}.py and convex/{promptVersions,charities}.ts (confirm the gate call sites landed)
  </read_first>
  <action>
    Create apps/dispatch-control/__tests__/roleGateInventory.test.ts (vitest, node fs — it reads the repo tree, no convex-test needed). Assert:
    - Across `packages/pipeline/src/eisenbalm_pipeline/api/`: `Depends(_require_editor)` appears in EXACTLY these files — revision.py, factcheck.py, review.py — and in NO other api/*.py file. (Scan each file; count files containing the string == 3, and the set of matching filenames == {revision.py, factcheck.py, review.py}.)
    - signoffs.py contains a role check guarded by `kind == "sounds-human"` (the in-handler branch) AND does NOT contain `Depends(_require_editor)` (it gates in-handler, not at the route).
    - Across `convex/` (excluding _generated and lib/auth.ts where the helper is DEFINED): `requireEditor(ctx)` appears in EXACTLY promptVersions.ts and charities.ts, and NO other convex mutation file. (convex/lib/auth.ts defines `requireEditor` — exclude the definition file from the call-site count.)
    - Guard against scope creep: no OTHER FastAPI route file gained `_require_editor` and no other Convex mutation gained `requireEditor(ctx)`.
    Write it as a durable tripwire (like the no-sanity-write test): if a future change gates a 7th action or ungates one of the six, this test fails.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/roleGateInventory.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - The test asserts exactly 3 FastAPI files carry `Depends(_require_editor)` (revision, factcheck, review) and signoffs uses the in-handler sounds-human branch.
    - The test asserts exactly 2 Convex mutation files carry `requireEditor(ctx)` (promptVersions, charities), excluding the definition in lib/auth.ts.
    - `cd apps/dispatch-control && pnpm vitest run __tests__/roleGateInventory.test.ts` exits 0.
  </acceptance_criteria>
  <done>A durable source-scan proves the gate is on exactly the six actions — no more, no fewer.</done>
</task>

<task type="auto">
  <name>Task 2: Full suites + strict build + Convex sync (phase gate)</name>
  <files>apps/dispatch-control/__tests__/roleGateInventory.test.ts</files>
  <read_first>
    - .planning/phases/49-roles-permissions/49-VALIDATION.md "## Test Infrastructure" + "Full suite command"
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entries "Run strict build before frontend phase done" and "Convex functions need live sync"
  </read_first>
  <action>
    Run the entire phase gate, fix anything that regressed (fix code, never weaken tests):
    1. `cd packages/pipeline && uv run pytest -x -q` (baseline 679 + test_role_gate.py cases).
    2. `cd apps/dispatch-control && pnpm test` (baseline 939 + the new comments/LockedControl/IssueComments/roleGateInventory tests + the updated Convex negatives).
    3. `pnpm --filter dispatch-control build` (strict Next build — vitest does not type-check).
    4. `pnpm --filter @eisenbalm/convex dev:once` (final sync so dev:modest-magpie-797 carries requireEditor + comments).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -x -q && cd /Users/user/Desktop/Eisenbalm/apps/dispatch-control && pnpm test && cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build && pnpm --filter @eisenbalm/convex dev:once</automated>
  </verify>
  <acceptance_criteria>
    - Full pipeline pytest exits 0.
    - Full dispatch-control vitest exits 0.
    - `pnpm --filter dispatch-control build` exits 0.
    - `pnpm --filter @eisenbalm/convex dev:once` exits 0.
  </acceptance_criteria>
  <done>Both full suites, the strict build, and the Convex sync all pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human-verify — Collaborator UX + empirical gate on record</name>
  <files>.planning/phases/49-roles-permissions/49-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/49-roles-permissions/49-VALIDATION.md "## Manual-Only Verifications"
    - .planning/phases/49-roles-permissions/49-VERIFICATION.md (confirm the "Empirical claim-propagation gate" entry from Plan 49-02 exists)
  </read_first>
  <what-built>
    The full role system: six server-gated actions, six locked-with-explanation controls, and a comment affordance across the workspace. Everything automatable has been automated and is green.
  </what-built>
  <how-to-verify>
    Signed in as a Collaborator (publicMetadata.role = "Collaborator") in a running env:
    1. Visit Story/Draft/Fact Check/Voice/Approval + a review-desk + prompt-lab + registry: confirm each of the six controls RENDERS, is disabled/locked, and shows its verbatim §6 explanation (Apply revision 🔒 editor only; Voice approval 🔒 Editor-in-chief only; Collaborators can review and comment, not publish.; Make active 🔒 Editor-in-chief only; 🔒 editor only) — none hidden.
    2. Confirm the Comments affordance is reachable + legible on My Tasks and each of the 5 stages, and that leaving a comment works.
    3. Confirm the "Empirical claim-propagation gate (ROL-01)" entry exists in 49-VERIFICATION.md (recorded in Plan 49-02) — the proof that role actually propagates to both backends in a real env.
  </how-to-verify>
  <action>
    Perform the three Collaborator-session checks above in a running env. Record the outcome (pass/issues) in 49-VERIFICATION.md alongside the empirical-gate entry. If any of the six controls is hidden (rather than locked) or shows a paraphrased label, that is a ROL-03 defect — file it back to Plan 49-07, do not sign off.
  </action>
  <verify>
    <automated>grep -c "Empirical claim-propagation gate" .planning/phases/49-roles-permissions/49-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - All six controls verified present-but-locked with the verbatim labels for a Collaborator.
    - Comment affordance reachable + functional on My Tasks + the 5 stages.
    - `grep -c "Empirical claim-propagation gate" .planning/phases/49-roles-permissions/49-VERIFICATION.md` ≥ 1.
  </acceptance_criteria>
  <resume-signal>Type "approved" once the locked controls + comment affordance read correctly as a Collaborator and the empirical gate is on record, or describe the issue.</resume-signal>
  <done>Collaborator UX verified (locked controls + comment affordance); empirical gate confirmed on record.</done>
</task>

</tasks>

<verification>
- Source-scan proves exactly six gated actions.
- Full pytest + full vitest + strict build + Convex sync all green.
- Human-verified Collaborator UX; empirical claim-propagation gate on record.
</verification>

<success_criteria>
All four success criteria hold together: server-side enforcement of exactly six actions (SC-1/SC-2), locked-with-explanation rendering never hidden (SC-3), and read-everything-and-comment (SC-4) — proven by green automated suites, a source-scan tripwire, and a human sign-off.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-09-SUMMARY.md`.
</output>
