---
phase: 49-roles-permissions
plan: 04
type: execute
wave: 2
depends_on: ["49-01"]
files_modified:
  - convex/lib/auth.ts
  - convex/promptVersions.ts
  - convex/charities.ts
  - apps/dispatch-control/__tests__/activate.test.ts
  - apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts
  - apps/dispatch-control/__tests__/convexAuthLockdown.test.ts
  - apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts
autonomous: true
requirements: [ROL-01, ROL-02]

must_haves:
  truths:
    - "A Collaborator-role identity calling promptVersions.activate or charities.setStatus throws a ConvexError with code 'forbidden_role'."
    - "An Editor-in-chief-role identity reaches both mutations' normal path."
    - "A call with NO identity at all still rejects (authentication still gates before role does) — the existing lockdown case stays green."
    - "Every existing withIdentity() call exercising the two gated mutations carries role:'Editor-in-chief' so the pre-existing suites stay green."
  artifacts:
    - path: "convex/lib/auth.ts"
      provides: "requireEditor(ctx) sibling to requireOperator"
      contains: "export async function requireEditor"
    - path: "apps/dispatch-control/__tests__/activate.test.ts"
      provides: "editor-positive + collaborator-negative coverage for activate"
      contains: "forbidden_role"
  key_links:
    - from: "promptVersions.activate / charities.setStatus handlers"
      to: "requireEditor(ctx)"
      via: "requireOperator(ctx) → requireEditor(ctx) one-line swap"
      pattern: "requireEditor\\(ctx\\)"
---

<objective>
Add role authorization to the two Convex-gated mutations. Add `requireEditor(ctx)` alongside `requireOperator` in `convex/lib/auth.ts`, swap it into `promptVersions.activate` and `charities.setStatus`, and — critically — update the four enumerated existing test files so their `withIdentity()` calls carry `role:'Editor-in-chief'` (they break otherwise, RESEARCH Pitfall 3) plus add Collaborator-rejection cases. Then live-sync.

Purpose: ROL-01/ROL-02 on the Convex surface. This introduces the repo's first `ConvexError` usage (deliberate per D-06). Convex has NO local-dev sentinel — an absent/undefined role must fail closed.
Output: `requireEditor`; two mutations swapped; four test files updated with role + negatives; dev deployment synced.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
From convex/lib/auth.ts:52 — the sibling to add requireEditor beside (returns identity.subject, no role):
```typescript
export async function requireOperator(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')
  return identity.subject
}
```
Swap points:
```typescript
// convex/promptVersions.ts:280 (inside activate handler)
const actor = await requireOperator(ctx)   // → requireEditor(ctx)
// convex/charities.ts:185 (inside setStatus handler)
const actor = await requireOperator(ctx)   // → requireEditor(ctx)
```
convex-test harness: apps/dispatch-control/__tests__/setup.ts exports { convexTest, schema };
tests call `t.withIdentity({ subject: 'user_operator' }).mutation(api.X, {...})`.
Existing withIdentity call sites to update (grep-confirmed):
  activate.test.ts:62, :109
  convexAuthLockdown.test.ts:69, :146
  charitiesDoNotUse.test.ts:44, :67, :95
  promptVersionsEvalGate.test.ts:93,128,158,193,243,282
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requireEditor(ctx) to convex/lib/auth.ts</name>
  <files>convex/lib/auth.ts</files>
  <read_first>
    - convex/lib/auth.ts (whole file — the requireOperator sibling + the "never trust an incoming actorId" discipline)
    - docs/API_CONTRACTS.md §49.4 (the ConvexError shape: `{ code: 'forbidden_role', message: 'Editor-in-chief only.' }`)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pattern 1" Convex example + "### Pitfall 3" (fail closed on undefined role) + "### Pitfall 4" (`role` is a safe, non-reserved claim name)
  </read_first>
  <action>
    Add `import { ConvexError } from 'convex/values'` (this is the repo's FIRST ConvexError usage — deliberate per D-06). Add, as a sibling to `requireOperator`:
    ```typescript
    /**
     * Editor-in-chief lane (Phase 49 ROL-01/ROL-02). Sibling to requireOperator,
     * NOT a wrapper — both independently call getUserIdentity(). Fails CLOSED:
     * no identity OR role !== 'Editor-in-chief' both reject (Convex has no
     * local-dev sentinel; an absent/unmigrated role must never grant editor).
     */
    export async function requireEditor(ctx: MutationCtx): Promise<string> {
      const identity = await ctx.auth.getUserIdentity()
      if (!identity) throw new ConvexError({ code: 'unauthorized', message: 'Not authenticated' })
      if ((identity as { role?: string }).role !== 'Editor-in-chief') {
        throw new ConvexError({ code: 'forbidden_role', message: 'Editor-in-chief only.' })
      }
      return identity.subject
    }
    ```
    Do NOT touch requireOperator, requirePipelineSecret, requireOperatorOrPipeline, requireWebhookSecret, or constantTimeEqual.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/convexAuthLockdown.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export async function requireEditor" convex/lib/auth.ts` == 1.
    - `grep -c "from 'convex/values'" convex/lib/auth.ts` ≥ 1 (ConvexError imported).
    - The mutations are not yet swapped, so the existing lockdown test still passes: command exits 0.
  </acceptance_criteria>
  <done>requireEditor exists, fails closed on missing/undefined role, throws ConvexError({code:'forbidden_role'}).</done>
</task>

<task type="auto">
  <name>Task 2: Swap the two mutations + update existing tests + add Collaborator negatives</name>
  <files>convex/promptVersions.ts, convex/charities.ts, apps/dispatch-control/__tests__/activate.test.ts, apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts, apps/dispatch-control/__tests__/convexAuthLockdown.test.ts, apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts</files>
  <read_first>
    - convex/promptVersions.ts lines 267-300 (activate handler — the requireOperator call at :280, actorId intentionally ignored)
    - convex/charities.ts lines 176-200 (setStatus handler — requireOperator at :185)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pitfall 3" (the exhaustive file list + why each breaks) and "### Testing the rejection (Convex)" example
    - Each of the 4 test files' current withIdentity call sites (line numbers in the interfaces block above)
  </read_first>
  <action>
    Swap (one line each): promptVersions.ts:280 `requireOperator(ctx)` → `requireEditor(ctx)`; charities.ts:185 `requireOperator(ctx)` → `requireEditor(ctx)`. Update the import in each file to pull `requireEditor` from `./lib/auth` (they already import `requireOperator` from there). The `charities.setStatus` swap gates ALL status transitions incl. `blocklisted` ("Do not use") — that satisfies the six-action gate for Mark Do-not-use; the reason/validation logic below the guard is unchanged.

    Then update the FOUR test files (RESEARCH Pitfall 3 — they carry NO role and WILL break under a fail-closed requireEditor):
    - Add `role: 'Editor-in-chief'` to EVERY existing `t.withIdentity({ subject: '...' })` call that exercises `promptVersions.activate` or `charities.setStatus`:
      - activate.test.ts:62, :109
      - convexAuthLockdown.test.ts:69, :146 (Lane 1 — the activate calls; leave the "rejects with NO identity" case unchanged — it has no identity at all, and must still reject)
      - charitiesDoNotUse.test.ts:44, :67, :95 (the `asOperator` helper — change its withIdentity to include role)
      - promptVersionsEvalGate.test.ts: the 6 sites (:93,128,158,193,243,282) IF they call the mutation directly (verify at execution — sites that only read eval-gate state need no change; sites that call activate need the role).
    - Add a NEW negative case in activate.test.ts AND charitiesDoNotUse.test.ts (and optionally convexAuthLockdown.test.ts): `t.withIdentity({ subject: 'user_collab', role: 'Collaborator' }).mutation(api.X, {...})` → `await expect(...).rejects.toThrow(/forbidden_role|Editor-in-chief/)`. This is the direct SC-1 proof on the Convex side.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/activate.test.ts __tests__/charitiesDoNotUse.test.ts __tests__/convexAuthLockdown.test.ts __tests__/promptVersionsEvalGate.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "requireEditor(ctx)" convex/promptVersions.ts` == 1 AND `grep -c "requireEditor(ctx)" convex/charities.ts` == 1.
    - `grep -c "requireOperator(ctx)" convex/promptVersions.ts` == 0 AND `grep -c "requireOperator(ctx)" convex/charities.ts` == 0.
    - Each of the 4 test files contains `role: 'Editor-in-chief'` on its activate/setStatus withIdentity calls.
    - activate.test.ts AND charitiesDoNotUse.test.ts each contain a Collaborator-negative case asserting `rejects.toThrow(/forbidden_role|Editor-in-chief/)`.
    - The quick command exits 0 (all four files green).
  </acceptance_criteria>
  <done>Both mutations gated by requireEditor; the 4 enumerated test files updated with role + Collaborator negatives; the no-identity lockdown case still rejects.</done>
</task>

<task type="auto">
  <name>Task 3: Sync the mutation changes to the dev Convex deployment</name>
  <files>convex/lib/auth.ts</files>
  <read_first>
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entry "Convex functions need live sync"
  </read_first>
  <action>
    Committing convex/*.ts ≠ deployed. Run `pnpm --filter @eisenbalm/convex dev:once` so dev:modest-magpie-797 carries the new requireEditor guard on activate/setStatus (otherwise the live console would still run the old requireOperator behavior).
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex dev:once</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter @eisenbalm/convex dev:once` exits 0.
  </acceptance_criteria>
  <done>Dev Convex deployment runs the requireEditor-gated mutations.</done>
</task>

</tasks>

<verification>
- `requireEditor` fails closed; both mutations swapped to it.
- Collaborator identity → ConvexError forbidden_role; Editor identity → success; no-identity → still rejects.
- The four enumerated existing test files pass (role added) and carry new Collaborator negatives.
- Dev deployment synced.
</verification>

<success_criteria>
The two Convex-gated actions reject a Collaborator's direct mutation server-side (thrown ConvexError), an Editor passes, and the pre-existing suites are green (ROL-01/ROL-02, Convex surface).
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-04-SUMMARY.md`.
</output>
