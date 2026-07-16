---
phase: 49-roles-permissions
plan: 05
type: execute
wave: 2
depends_on: ["49-01"]
files_modified:
  - convex/comments.ts
  - apps/dispatch-control/__tests__/comments.test.ts
autonomous: true
requirements: [ROL-04]

must_haves:
  truths:
    - "Both an Editor-in-chief and a Collaborator identity can call comments.add and it succeeds (commenting is the one write a Collaborator may perform)."
    - "A call to comments.add with NO identity rejects (comments require some authenticated user, just not a specific role)."
    - "listByIssueNumber is unguarded and returns rows for the issue, oldest-first, with authorId set from the verified identity — never client-supplied."
  artifacts:
    - path: "convex/comments.ts"
      provides: "add + listByIssueNumber implementing §49.3 verbatim"
      contains: "export const add"
    - path: "apps/dispatch-control/__tests__/comments.test.ts"
      provides: "both-roles-add + no-identity-reject + list coverage"
      contains: "listByIssueNumber"
  key_links:
    - from: "convex/comments.ts add"
      to: "ctx.auth.getUserIdentity()"
      via: "inline any-authenticated-identity check (NOT requireOperator/requireEditor)"
      pattern: "getUserIdentity"
---

<objective>
Implement the flat comment capability declared in §49.3: `convex/comments.ts` with `add` (any authenticated identity — the one write BOTH roles may make) and `listByIssueNumber` (unguarded read). Test-first with `comments.test.ts`, then live-sync.

Purpose: ROL-04's positive capability. The `comments` table already exists (Plan 49-01). This is a THIRD auth lane — neither requireOperator nor requireEditor fits ("any authenticated user"), so inline `ctx.auth.getUserIdentity()` (mirroring users.ts::upsertCurrentUser). Flat only — no threading/mentions/notifications (D-13).
Output: `convex/comments.ts`; `comments.test.ts`; dev deployment synced.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
From docs/API_CONTRACTS.md §49.3 (the shapes to implement verbatim):
  add({ workspace_id, issueNumber, stage?, anchorRef?, text }): Promise<Id<'comments'>>
  listByIssueNumber({ workspace_id, issueNumber, stage? }): Promise<Doc<'comments'>[]>
Comments table (already in convex/schema.ts from Plan 49-01):
  fields: workspace_id, issueNumber, stage?, anchorRef?, text, authorId, createdAt
  indices: by_workspace_issueNumber, by_workspace
Closest existing precedent to mirror (guarded-append + unguarded-read): convex/charityCorrections.ts (§39.2).
Test harness: apps/dispatch-control/__tests__/setup.ts exports { convexTest, schema };
  modules glob: import.meta.glob('../../../convex/**/*.*s')
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write comments.test.ts (RED)</name>
  <files>apps/dispatch-control/__tests__/comments.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/charityCorrections.test.ts (the closest existing test — convexTest setup, withIdentity, seeding, list assertions)
    - apps/dispatch-control/__tests__/setup.ts (convexTest + schema exports + the required import.meta.glob pattern)
    - docs/API_CONTRACTS.md §49.3
  </read_first>
  <behavior>
    - Editor-in-chief identity → `comments.add({workspace_id:'eisenbalm', issueNumber:42, text:'hi'})` resolves to an Id; the row is readable via `listByIssueNumber`.
    - Collaborator identity → `comments.add(...)` ALSO resolves (positive proof of ROL-04's one-write-a-collaborator-can-make).
    - No identity (`t.mutation(api.comments.add, {...})` with no withIdentity) → rejects.
    - `listByIssueNumber({workspace_id, issueNumber})` with no identity → returns rows (unguarded read), oldest-first by createdAt; `authorId` equals the verified subject that added it (NOT any client-supplied value).
    - `stage` filter: rows added with stage='draft' are returned when stage='draft' is passed and excluded otherwise.
  </behavior>
  <action>
    Create apps/dispatch-control/__tests__/comments.test.ts mirroring charityCorrections.test.ts's structure. Import `{ convexTest, schema }` from './setup', `api` from '../../../convex/_generated/api', and pass `import.meta.glob('../../../convex/**/*.*s')` as modules. RED now (convex/comments.ts does not exist yet → api.comments.add/listByIssueNumber are undefined).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/comments.test.ts ; test $? -ne 0</automated>
  </verify>
  <acceptance_criteria>
    - File exists and references `api.comments.add` and `api.comments.listByIssueNumber`.
    - Encodes: both-roles-add-succeeds, no-identity-add-rejects, unguarded-list, authorId-from-identity, stage-filter.
    - Running it now FAILS (RED — module absent).
  </acceptance_criteria>
  <done>comments.test.ts exists, is RED, encodes the ROL-04 behaviors.</done>
</task>

<task type="auto">
  <name>Task 2: Implement convex/comments.ts (GREEN)</name>
  <files>convex/comments.ts</files>
  <read_first>
    - convex/charityCorrections.ts (§39.2 implementation — the guarded-append + unguarded-list pattern to mirror in structure, differing only in the auth lane)
    - convex/users.ts::upsertCurrentUser (the inline `ctx.auth.getUserIdentity()` any-identity precedent — do NOT call requireOperator/requireEditor)
    - docs/API_CONTRACTS.md §49.2 + §49.3
  </read_first>
  <action>
    Create convex/comments.ts with exactly two functions:
    ```typescript
    export const add = mutation({
      args: {
        workspace_id: v.string(),
        issueNumber: v.number(),
        stage: v.optional(v.string()),
        anchorRef: v.optional(v.string()),
        text: v.string(),
      },
      handler: async (ctx, { workspace_id, issueNumber, stage, anchorRef, text }) => {
        // THIRD auth lane: ANY authenticated identity (NOT requireOperator/requireEditor).
        // Commenting is the one write BOTH roles may make (ROL-04).
        const identity = await ctx.auth.getUserIdentity()
        if (!identity) throw new Error('Unauthorized')
        return await ctx.db.insert('comments', {
          workspace_id,
          issueNumber,
          stage,
          anchorRef,
          text,
          authorId: identity.subject,   // verified — NEVER client-supplied
          createdAt: Date.now(),
        })
      },
    })

    export const listByIssueNumber = query({
      args: { workspace_id: v.string(), issueNumber: v.number(), stage: v.optional(v.string()) },
      handler: async (ctx, { workspace_id, issueNumber, stage }) => {
        const rows = await ctx.db
          .query('comments')
          .withIndex('by_workspace_issueNumber', q =>
            q.eq('workspace_id', workspace_id).eq('issueNumber', issueNumber))
          .collect()
        const filtered = stage === undefined ? rows : rows.filter(r => r.stage === stage)
        return filtered.sort((a, b) => a.createdAt - b.createdAt)  // oldest-first
      },
    })
    ```
    Import `mutation, query` from `./_generated/server` and `v` from `convex/values` (match charityCorrections.ts's import style). Define NO update/patch/remove/delete (append-only invariant, §49.2).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/comments.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export const add" convex/comments.ts` == 1 AND `grep -c "export const listByIssueNumber" convex/comments.ts` == 1.
    - `grep -Ec "export const (update|remove|patch|del|delete)" convex/comments.ts` == 0 (append-only).
    - `grep -c "requireOperator\|requireEditor" convex/comments.ts` == 0 (inline any-identity lane, per §49.3).
    - `cd apps/dispatch-control && pnpm vitest run __tests__/comments.test.ts` exits 0 (GREEN).
  </acceptance_criteria>
  <done>comments.ts implements add + listByIssueNumber verbatim to §49.3; comments.test.ts is GREEN.</done>
</task>

<task type="auto">
  <name>Task 3: Sync comments functions to the dev Convex deployment</name>
  <files>convex/comments.ts</files>
  <read_first>
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entry "Convex functions need live sync"
  </read_first>
  <action>
    Run `pnpm --filter @eisenbalm/convex dev:once` so the comments.add/listByIssueNumber functions are actually deployed to dev:modest-magpie-797 (the frontend affordance in Plan 49-08 calls them live).
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex dev:once</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter @eisenbalm/convex dev:once` exits 0.
    - `grep -c "comments" convex/_generated/api.d.ts` ≥ 1 (codegen picked up the new module).
  </acceptance_criteria>
  <done>comments functions deployed to dev; codegen exposes api.comments.*.</done>
</task>

</tasks>

<verification>
- comments.add succeeds for both roles, rejects with no identity; authorId comes from the verified subject.
- listByIssueNumber is unguarded, oldest-first, stage-filterable.
- Append-only (no mutation function other than add); functions deployed to dev.
</verification>

<success_criteria>
A Collaborator can leave a comment and anyone can read the issue's comments (ROL-04 backend). No role gate on commenting; author identity is verified server-side.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-05-SUMMARY.md`.
</output>
