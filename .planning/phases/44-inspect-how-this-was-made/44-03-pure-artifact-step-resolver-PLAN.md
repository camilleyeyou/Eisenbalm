---
phase: 44-inspect-how-this-was-made
plan: 03
type: execute
wave: 2
depends_on: ["44-01"]
files_modified:
  - apps/dispatch-control/lib/inspectorArtifact.ts
  - apps/dispatch-control/__tests__/inspectorArtifact.test.ts
autonomous: true
requirements: [INS-01, INS-04]
must_haves:
  truths:
    - "A single pure resolver maps any of the six artifact types {type, runId, locator} to the correct agent_runs agentKey AND the correct prompt_versions/prompt-lab promptKey, reusing the existing sectionIdMap bridge (never a second table)."
    - "The resolver bridges the editor_gate_1 (runs namespace) / editor_gate1 (prompt namespace) split with one explicit alias — no other new code assumes the keys are interchangeable."
    - "bonus resolves to agent_runs key 'bonus'; the prompt-lab variant (bonus_jingle/…) is selected from the run's bonusType, and non-externalized agents (origin_story/problem/founder_bio/case_study/qa) resolve to promptKey null."
    - "signal and org degrade with degraded=true when the run has no such step, never throwing."
  artifacts:
    - path: "apps/dispatch-control/lib/inspectorArtifact.ts"
      provides: "resolveInspectorStep + runKeyToPromptKey + encode/parse artifact-key helpers (pure, no useQuery)"
      exports: ["resolveInspectorStep", "runKeyToPromptKey", "encodeArtifactKey", "parseArtifactKey"]
  key_links:
    - from: "lib/inspectorArtifact.ts"
      to: "lib/galley/sectionIdMap.ts"
      via: "galleyIdToQaSection reuse for founder/claim section normalization"
      pattern: "galleyIdToQaSection"
---

<objective>
Build the ONE pure resolver module (CONTEXT D-01/D-02) that maps an `InspectorArtifactKey { type, runId, locator }` to the exact step it anchors to — an `agent_runs` agentKey plus the `prompt_versions`/prompt-lab promptKey — with NO Convex hooks (the panel container does the fetching in 44-06). This is a selector, section-anchored not span-anchored, mirroring the Phase 40/42/43 "derived over stored" discipline.

It reconciles three verified codebase facts (RESEARCH):
- The `sectionName → writer agentKey` bridge ALREADY EXISTS (`lib/galley/sectionIdMap.ts`) — reuse `galleyIdToQaSection`, do NOT rebuild (`problem !== problemStatement`).
- `editor_gate_1` (runs) vs `editor_gate1` (prompt) is a real namespace split with no existing reconciler — the resolver owns the one alias.
- `bonus` is a single graph node keyed `"bonus"` whose prompt-lab variant is chosen at runtime from `outputSnapshot.bonusType`; four narrative writers + qa have NO prompt_versions row at all (promptKey null is their permanent state, not an error).

Purpose: Every entry point and the panel container get the correct step + both namespaces from one tested function.
Output: `lib/inspectorArtifact.ts` and the filled `inspectorArtifact.test.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md
@.planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- lib/galley/sectionIdMap.ts — REUSE, do not fork -->
export function galleyIdToQaSection(galleyId: string): string | null  // 'founderBio'->'founder_bio', 'problemStatement'->'problem', 'game'->'game', 'bonus'->'bonus'; unknown->null

<!-- §44.1/§44.3 contract this plan implements -->
type InspectorArtifactType = 'founder' | 'claim' | 'rec' | 'org' | 'signal' | 'qa'
interface InspectorArtifactKey { type: InspectorArtifactType; runId: string; locator: string }
interface ResolvedStep { agentKey: string; promptKey: string | null; degraded: boolean; sectionContext?: string }

<!-- Ground-truth namespaces (RESEARCH, direct grep) -->
// agent_runs / agent_run_payloads keys for writers: origin_story, problem, founder_bio, case_study, game, bonus, design
// Gate 1: agent_runs key = 'editor_gate_1'  |  prompt_versions key = 'editor_gate1'
// bonus variants (prompt_versions only): bonus_big_budget, bonus_jingle, bonus_spec_ad
// non-externalized (no prompt_versions row): origin_story, problem, founder_bio, case_study, qa
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build the resolver + namespace helpers + artifact-key encoding</name>
  <read_first>
    - apps/dispatch-control/lib/galley/sectionIdMap.ts (the exact export names + the `problem !== problemStatement` note)
    - docs/API_CONTRACTS.md §44.1 and §44.3 (the InspectorArtifactKey encoding + ResolvedStep + resolveInspectorStep + runKeyToPromptKey specs written in 44-01)
    - .planning/phases/44-inspect-how-this-was-made/44-RESEARCH.md § "Architecture Patterns" (the sectionIdMap reuse, the editor_gate_1/editor_gate1 alias, the bonus variant selection, the claim→researcher correction)
  </read_first>
  <behavior>
    - Test 1: `resolveInspectorStep({type:'founder', runId:'r', locator:'founderBio'})` → `{ agentKey:'founder_bio', promptKey:null, degraded:false }`.
    - Test 2: `resolveInspectorStep({type:'founder', runId:'r', locator:'game'})` → `{ agentKey:'game', promptKey:'game', degraded:false }`.
    - Test 3: founder with a snake_case locator already in the run vocabulary, `locator:'origin_story'` → `{ agentKey:'origin_story', promptKey:null }` (accepts either vocabulary).
    - Test 4: `resolveInspectorStep({type:'founder',...,locator:'bonus'}, { bonusType:'jingle' })` → `{ agentKey:'bonus', promptKey:'bonus_jingle' }`; without bonusType → promptKey null.
    - Test 5: `runKeyToPromptKey('editor_gate_1')` === `'editor_gate1'`; `runKeyToPromptKey('scout')` === `'scout'`; `runKeyToPromptKey('founder_bio')` === `null`.
    - Test 6: `resolveInspectorStep({type:'claim',...})` → `{ agentKey:'researcher', ... }` with `sectionContext` derived from the locator when it is a galley id; `rec` → `editor_final`; `qa` → `{agentKey:'qa', promptKey:null}`.
    - Test 7: `resolveInspectorStep({type:'signal',...})` and `{type:'org',...}` return without throwing; `signal` → `{agentKey:'signal_editor', degraded:true}`, `org` → `{agentKey:'scout', promptKey:'scout', degraded:false}`.
    - Test 8: `parseArtifactKey(encodeArtifactKey(k))` deep-equals `k` for empty locator and a locator containing `':'`.
  </behavior>
  <action>
    Create `apps/dispatch-control/lib/inspectorArtifact.ts` (pure, no `convex/react` import). Implement exactly per §44.1/§44.3:

    - `export type InspectorArtifactType = 'founder' | 'claim' | 'rec' | 'org' | 'signal' | 'qa'`
    - `export interface InspectorArtifactKey { type: InspectorArtifactType; runId: string; locator: string }`
    - `export interface ResolvedStep { agentKey: string; promptKey: string | null; degraded: boolean; sectionContext?: string }`
    - `const KNOWN_RUN_KEYS = new Set(['origin_story','problem','founder_bio','case_study','game','bonus'])`
    - `const NON_EXTERNALIZED = new Set(['origin_story','problem','founder_bio','case_study','qa'])`
    - `const BONUS_VARIANT: Record<string,string> = { bigBudget:'bonus_big_budget', jingle:'bonus_jingle', specAd:'bonus_spec_ad' }`
    - `export function runKeyToPromptKey(agentKey: string, bonusType?: string): string | null` — `editor_gate_1 → 'editor_gate1'`; `bonus → BONUS_VARIANT[bonusType] ?? null`; `NON_EXTERNALIZED.has(agentKey) → null`; else identity.
    - `export function resolveInspectorStep(key, opts?): ResolvedStep`:
        - `founder`: `const runKey = galleyIdToQaSection(key.locator) ?? (KNOWN_RUN_KEYS.has(key.locator) ? key.locator : null)`. If null → `{ agentKey: key.locator, promptKey: null, degraded: true }` (unknown section, honest degrade). Else `{ agentKey: runKey, promptKey: runKeyToPromptKey(runKey, opts?.bonusType), degraded: false }`.
        - `claim`: `{ agentKey:'researcher', promptKey:'researcher', degraded:false, sectionContext: galleyIdToQaSection(key.locator) ?? key.locator || undefined }` (locator is a claimId here; sectionContext is best-effort "appears in" — leave undefined if not derivable).
        - `rec`: `{ agentKey:'editor_final', promptKey:'editor_final', degraded:false }`.
        - `qa`: `{ agentKey:'qa', promptKey:null, degraded:false }`.
        - `org`: `{ agentKey:'scout', promptKey:'scout', degraded:false }`.
        - `signal`: `{ agentKey:'signal_editor', promptKey:'signal_editor', degraded:true }` (no such step in any current run).
    - `export function encodeArtifactKey(k): string` → `` `${k.type}:${k.runId}:${k.locator}` ``.
    - `export function parseArtifactKey(s): InspectorArtifactKey` → split on `:` into `[type, runId, ...rest]`; `locator = rest.join(':')` (tolerates `:` inside a locator); validate `type` against the 6 literals (throw a clear error on an unknown type).

    Do NOT import anything from `convex/react` or fetch data — all row data is fetched later by the container (44-06). Keep the file dependency-light (only `sectionIdMap`).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/inspectorArtifact.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `lib/inspectorArtifact.ts` exports `resolveInspectorStep`, `runKeyToPromptKey`, `encodeArtifactKey`, `parseArtifactKey` (`grep -n "export function" apps/dispatch-control/lib/inspectorArtifact.ts` shows all four).
    - The file imports `galleyIdToQaSection` from `sectionIdMap` and does NOT import from `convex/react` (`grep -q "convex/react" apps/dispatch-control/lib/inspectorArtifact.ts` exits 1).
    - `runKeyToPromptKey('editor_gate_1')` returns `'editor_gate1'` and `runKeyToPromptKey('founder_bio')` returns `null` (asserted by the test).
  </acceptance_criteria>
  <done>The pure resolver + namespace alias + bonus-variant selection + artifact-key encoding exist, importing the existing sectionIdMap.</done>
</task>

<task type="auto">
  <name>Task 2: Convert inspectorArtifact.test.ts todos into live assertions</name>
  <read_first>
    - apps/dispatch-control/__tests__/inspectorArtifact.test.ts (the it.todo scaffold from 44-01)
    - apps/dispatch-control/lib/inspectorArtifact.ts (the module just built)
  </read_first>
  <action>
    Replace every `it.todo(...)` in `inspectorArtifact.test.ts` with a real `it(...)` that imports from `@/lib/inspectorArtifact` and asserts the Behavior cases from Task 1 (all 8). Include the edge cases explicitly: the bonus-variant with/without bonusType, the `editor_gate_1 → editor_gate1` alias, the `founder_bio → null` promptKey, the `claim → researcher` resolution, the `signal/org` degrade flags, and the encode/parse round-trip with an empty locator and a locator containing `:`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- __tests__/inspectorArtifact.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "it.todo" apps/dispatch-control/__tests__/inspectorArtifact.test.ts` returns 0 (all converted).
    - `pnpm --filter dispatch-control test -- __tests__/inspectorArtifact.test.ts` exits 0 with ≥ 8 passing assertions.
  </acceptance_criteria>
  <done>All INS-01/INS-04 resolver cases pass as live assertions.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/inspectorArtifact.test.ts` passes.
- `pnpm --filter dispatch-control build` still passes (no type regressions).
</verification>

<success_criteria>
- One pure, tested resolver maps all six artifact types to the correct runs-namespace agentKey and prompt-namespace promptKey, reusing sectionIdMap, bridging the editor_gate_1/editor_gate1 split, selecting the bonus variant, and degrading signal/org — the single source of truth the container and every footer deep-link consume.
</success_criteria>

<output>
After completion, create `.planning/phases/44-inspect-how-this-was-made/44-03-SUMMARY.md`.
</output>
