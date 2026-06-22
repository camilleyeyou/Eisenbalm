---
phase: 24-prompt-editor-versioning
plan: 02
type: execute
wave: 2
depends_on: [24-01]
files_modified:
  - convex/schema.ts
  - convex/promptVersions.ts
autonomous: false
requirements: [PRM-03, PRM-04]
must_haves:
  truths:
    - "Saving a prompt creates a new version row and never overwrites a prior version"
    - "Activating a version flips exactly one isActive row; activation is blocked while a run is running"
    - "Every save and activate emits an audit_log row"
    - "Operator can list all versions and fetch any specific version"
  artifacts:
    - path: "convex/promptVersions.ts"
      provides: "saveVersion, activate, listForAgent, getByVersion"
      contains: "export const saveVersion"
    - path: "convex/schema.ts"
      provides: "by_workspace_agentKey_version compound index on prompt_versions"
      contains: "by_workspace_agentKey_version"
  key_links:
    - from: "convex/promptVersions.ts activate"
      to: "convex/auditLog.ts write"
      via: "ctx.runMutation(internal.auditLog.write, ...)"
      pattern: "internal.auditLog.write"
    - from: "convex/promptVersions.ts activate"
      to: "runs table status"
      via: "in-progress guard"
      pattern: "status.*running"
---

<objective>
Build the versioning data layer on top of the existing `prompt_versions` table: the
`saveVersion`, `activate`, `listForAgent`, and `getByVersion` Convex functions, plus the
`by_workspace_agentKey_version` compound index. This is the write/control surface that the
Wave 2 UI and the migration plans depend on.

Purpose: PRM-03 (immutable versioning) + PRM-04 (diff source data + activate/rollback +
in-progress guard).
Output: extended convex/promptVersions.ts + schema index; the Plan 01 Convex tests go GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@docs/API_CONTRACTS.md
@convex/promptVersions.ts
@convex/auditLog.ts

<interfaces>
Existing upsertActive/getActive in convex/promptVersions.ts (do NOT remove — migration seeds use upsertActive).
auditLog.write is internalMutation: `ctx.runMutation(internal.auditLog.write, { workspace_id, actorId, action, resourceType?, resourceId?, before?, after? })`.
runs table (convex/schema.ts line 220): has `status: v.string()` + `.index('by_workspace', ['workspace_id'])`.
import internal from `./_generated/api`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add by_workspace_agentKey_version index to prompt_versions</name>
  <files>convex/schema.ts</files>
  <read_first>
    - convex/_generated/ai/guidelines.md (MANDATORY per CLAUDE.md before schema edits)
    - convex/schema.ts lines 265-277 (prompt_versions table definition)
  </read_first>
  <action>
    In the `prompt_versions` defineTable block (lines ~266-277), add a third index AFTER the existing
    two indexes, keeping the existing two unchanged:
    `.index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'version'])`
    Do NOT modify any field, the existing `by_workspace` / `by_workspace_agentKey` indexes, or any
    frozen table (`pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`).
    This is a purely additive index — backward-compatible with existing getActive/upsertActive queries.
  </action>
  <verify>
    <automated>grep -q "by_workspace_agentKey_version" convex/schema.ts && grep -q "by_workspace_agentKey'" convex/schema.ts && echo INDEX_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "by_workspace_agentKey_version" convex/schema.ts` returns 1
    - The existing `by_workspace_agentKey` index line is still present (grep matches both index names)
    - `git diff convex/schema.ts` shows only an added index line inside prompt_versions (no other table touched)
  </acceptance_criteria>
  <done>Compound index added; schema otherwise unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Implement saveVersion, activate, listForAgent, getByVersion mutations/queries</name>
  <files>convex/promptVersions.ts</files>
  <read_first>
    - convex/_generated/ai/guidelines.md
    - convex/promptVersions.ts (full — extend, don't rewrite)
    - convex/auditLog.ts (internal write signature)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 3 — copy mutation bodies verbatim)
    - convex/schema.ts runs table (status field for the guard)
  </read_first>
  <action>
    Add to convex/promptVersions.ts (keep upsertActive + getActive). Add `import { internal } from './_generated/api'`.

    `saveVersion` mutation — args `{ workspace_id: v.string(), agentKey: v.string(), content: v.string(),
    createdBy: v.optional(v.string()), note: v.optional(v.string()) }`:
    - collect all rows for (workspace_id, agentKey) via `by_workspace_agentKey`;
    - `maxVersion = rows.length ? Math.max(...rows.map(r => r.version)) : 0`;
    - insert new row `{ workspace_id, agentKey, version: maxVersion+1, content, isActive: false,
      createdAt: Date.now(), createdBy, note }`;
    - emit `ctx.runMutation(internal.auditLog.write, { workspace_id, actorId: createdBy ?? 'unknown',
      action: 'prompt_version.saved', resourceType: 'prompt_version',
      resourceId: \`${agentKey}:${maxVersion+1}\`, after: JSON.stringify({ agentKey, version: maxVersion+1 }) })`;
    - return the inserted id.
    NEVER patch/overwrite an existing row. New version is NOT auto-activated.

    `activate` mutation — args `{ workspace_id, agentKey, version: v.number(), actorId: v.string() }`:
    - In-progress guard (D-02): query `runs` via `by_workspace` filtered `status === 'running'`, `.first()`;
      if found return `{ blocked: true, reason: 'A run is in progress — activation will be available when it finishes.' }`.
    - else: collect all rows for the agentKey; record `previousActive = rows.find(r => r.isActive)?.version`;
      patch every currently-active row `isActive: false`; find target by version (throw if not found);
      patch target `isActive: true`;
    - emit audit `action: 'prompt_version.activated'`, `resourceId: \`${agentKey}:${version}\``,
      `before: JSON.stringify({ agentKey, previousActive })`, `after: JSON.stringify({ agentKey, version })`;
    - return `{ blocked: false }`.
    (Rollback uses this same mutation with an older version — no separate function.)

    `listForAgent` query — args `{ workspace_id, agentKey }`: collect via `by_workspace_agentKey`,
    return sorted `(a,b) => b.version - a.version` (newest-first).

    `getByVersion` query — args `{ workspace_id, agentKey, version: v.number() }`: query via the new
    `by_workspace_agentKey_version` index `.eq(workspace_id).eq(agentKey).eq(version)` `.first()`,
    return row ?? null.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/saveVersion.test.ts __tests__/activate.test.ts 2>&1 | grep -Eq "passed|PASS" && echo CONVEX_TESTS_GREEN</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/saveVersion.test.ts` and `activate.test.ts` PASS (the run command above reports passing)
    - `grep -c "export const saveVersion" convex/promptVersions.ts` returns 1; same for `activate`, `listForAgent`, `getByVersion`
    - `grep -q "isActive: false" convex/promptVersions.ts` (new versions not auto-active) and `grep -q "prompt_version.saved" convex/promptVersions.ts`
    - `grep -q "blocked: true" convex/promptVersions.ts` and `grep -q "'running'" convex/promptVersions.ts` (in-progress guard)
    - `grep -q "by_workspace_agentKey_version" convex/promptVersions.ts` (getByVersion uses the new index)
    - upsertActive + getActive still exported (grep matches both)
  </acceptance_criteria>
  <done>Four versioning functions implemented; Plan 01 Convex tests green; audit emitted on save+activate.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Deploy Convex schema index + codegen the new functions</name>
  <action>Andrew runs the Convex dev deploy so the new compound index materializes and `_generated/api` exposes saveVersion/activate/listForAgent/getByVersion.</action>
  <verify>convex dev --once completes without schema errors</verify>
  <done>New index live; _generated/api includes the four new functions.</done>
  <what-built>New compound index + four prompt_versions functions. Convex requires a deploy/codegen for the new index + `_generated/api` to include the new functions.</what-built>
  <how-to-verify>
    Run `pnpm --filter @eisenbalm/convex exec convex dev --once` (against the dev deployment used by all consumers).
    Confirm it completes without schema errors and regenerates `convex/_generated/api.d.ts` containing
    `promptVersions.saveVersion`, `activate`, `listForAgent`, `getByVersion`.
  </how-to-verify>
  <resume-signal>Type "deployed" once convex dev --once succeeds, or paste the error.</resume-signal>
</task>

</tasks>

<verification>
- New index live; four functions in _generated/api.
- saveVersion never overwrites; activate guarded + audited; rollback == activate(older).
</verification>

<success_criteria>
The versioning control surface exists and is tested; downstream UI + migrations can call it.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-02-SUMMARY.md`
</output>
