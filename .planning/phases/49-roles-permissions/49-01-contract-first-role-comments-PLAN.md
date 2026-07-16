---
phase: 49-roles-permissions
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
autonomous: true
requirements: [ROL-01, ROL-02, ROL-04]
user_setup: []

must_haves:
  truths:
    - "docs/API_CONTRACTS.md has a new §49 section declaring the users.role vocabulary change, the comments table, the comments.ts signatures, the six-action gate inventory, and the verbatim §6 locked labels — written BEFORE any enforcement code (contract-first)."
    - "convex/schema.ts users.role comment reads the new Editor-in-chief | Collaborator vocabulary (no longer 'admin | operator — RBAC deferred')."
    - "convex/schema.ts has a comments table with the exact fields + two indices, synced to the dev deployment."
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§49 contract-first section"
      contains: "## §49"
    - path: "convex/schema.ts"
      provides: "comments table + updated role comment"
      contains: "comments: defineTable"
  key_links:
    - from: "docs/API_CONTRACTS.md §49"
      to: "convex/schema.ts comments table"
      via: "table shape declared in contract, implemented verbatim in schema"
      pattern: "by_workspace_issueNumber"
---

<objective>
Write the Phase 49 API contract FIRST (CLAUDE.md hard rule), then land the two schema-level shapes it declares: the `users.role` value-vocabulary change and the new `comments` table. No enforcement/behavior yet — this plan is the contract + the shapes every downstream plan implements against.

Purpose: CLAUDE.md forbids any schema field rename / new payload shape / vocab change without checking `docs/API_CONTRACTS.md` FIRST. Both the `users.role` vocab change (D-02) and the net-new `comments` table (D-12) trip that rule. Modeled on §39 (`charity_corrections`), the closest existing precedent.
Output: `docs/API_CONTRACTS.md` §49 section; `convex/schema.ts` updated role comment + new `comments` table; dev deployment synced.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-CONTEXT.md
@.planning/phases/49-roles-permissions/49-RESEARCH.md

<interfaces>
<!-- The §39 precedent this contract is modeled on (charity_corrections) -->
From docs/API_CONTRACTS.md §39.1 — `charity_corrections` table shape:
```typescript
charity_corrections: defineTable({
  workspace_id: v.string(),
  charityKey: v.string(),
  sanityCharityId: v.optional(v.string()),
  text: v.string(),
  author: v.string(),      // Clerk actorId — NEVER client-supplied
  createdAt: v.number(),
})
  .index('by_workspace_charityKey', ['workspace_id', 'charityKey'])
  .index('by_workspace', ['workspace_id']),
```
Append-only invariant: "No update/patch/remove/delete function is ever defined against this table."

From convex/schema.ts:234 — the existing users table (role field to re-vocabulary, NOT rename):
```typescript
users: defineTable({
  workspace_id: v.string(),
  clerkUserId: v.string(),
  email: v.string(),
  displayName: v.optional(v.string()),
  role: v.optional(v.string()),  // "admin" | "operator" — RBAC deferred to Phase 28   ← line 240, comment to update
  createdAt: v.number(),
  lastSeenAt: v.number(),
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write docs/API_CONTRACTS.md §49 (contract-first)</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md lines 3869-3946 (§39 — the table + functions template to mirror exactly)
    - docs/API_CONTRACTS.md lines 5769-5959 (§48 — the most recent section + the "Additive-only summary" close it ends with)
    - .planning/phases/49-roles-permissions/49-RESEARCH.md section "## API_CONTRACTS.md registration" (the two required registrations) and "## Comment Capability" (the data model)
    - .planning/phases/49-roles-permissions/49-CONTEXT.md §decisions D-02, D-06, D-09, D-12
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §6 (lines 79-90 — the verbatim locked labels)
  </read_first>
  <action>
    Append a new `## §49 — Roles & Permissions (Phase 49)` section to the END of docs/API_CONTRACTS.md, after §48, following the §39/§48 contract-first template verbatim (opening paragraph stating "written BEFORE any enforcement code exists (CLAUDE.md contract-first hard rule)... Plans 49-03/49-04/49-05 implement these shapes verbatim"). Include these subsections with these EXACT contents:

    §49.1 — `users.role` value-vocabulary change (D-02). State: the FIELD NAME `role` is unchanged; only the string VALUES change from `"admin" | "operator"` to `"Editor-in-chief" | "Collaborator"`. Source of truth = Clerk `publicMetadata.role`, exposed as a JWT claim named `role` on BOTH the default session token AND the named `"convex"` JWT template (see §49.4). `users.role` remains an optional future mirror (the JIT upsert in convex/users.ts is not live-wired today), NOT the live read path.

    §49.2 — `comments` Convex table (NEW). Declare verbatim:
    ```typescript
    comments: defineTable({
      workspace_id: v.string(),
      issueNumber: v.number(),           // PRIMARY target key (issue-keyed, §40)
      stage: v.optional(v.string()),     // 'story'|'draft'|'fact-check'|'voice'|'approval'|undefined
      anchorRef: v.optional(v.string()), // opaque free-form (claim index / section name) — screen-level granularity only, NOT re-anchored
      text: v.string(),
      authorId: v.string(),              // Clerk subject from ctx.auth.getUserIdentity() — NEVER client-supplied
      createdAt: v.number(),
    })
      .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
      .index('by_workspace', ['workspace_id']),
    ```
    State the APPEND-ONLY invariant for this phase: `add` only; no update/patch/remove/delete function defined (mirror §39.1's wording). Flat comments only — no threading/mentions/notifications.

    §49.3 — `convex/comments.ts` functions (NEW):
    - `add({ workspace_id, issueNumber, stage?, anchorRef?, text }): Promise<Id<'comments'>>` — auth lane = ANY authenticated identity (inline `ctx.auth.getUserIdentity()`, NOT requireOperator, NOT requireEditor — commenting is the one write BOTH roles may perform). authorId = identity.subject. createdAt = Date.now().
    - `listByIssueNumber({ workspace_id, issueNumber, stage? }): Promise<Doc<'comments'>[]>` — UNGUARDED read (matches charity_corrections:listByCharityKey), by_workspace_issueNumber index, sorted createdAt ASC; when `stage` supplied, return only rows with that stage.

    §49.4 — Six-action editor gate (D-06, D-07). Table listing exactly the six gated actions, the surface, the handler file:line, and the enforcement mechanism:
    | Action | Surface | Handler | Mechanism |
    |---|---|---|---|
    | Apply revision | FastAPI | revision.py:355 apply_passage_revision | `Depends(_require_editor)` swap |
    | Confirm evidence replacement | FastAPI | factcheck.py:546 apply_claim_evidence | `Depends(_require_editor)` swap |
    | Approve the Voice Pass | FastAPI | signoffs.py:55 record_sign_off (kind=="sounds-human" ONLY) | in-handler branch, NOT route Depends |
    | Publish issue | FastAPI | review.py:67 publish_issue | `Depends(_require_editor)` swap |
    | Make instruction active | Convex | promptVersions.ts:267 activate | `requireEditor(ctx)` swap |
    | Mark Do not use | Convex | charities.ts:176 setStatus (status=='blocklisted') | `requireEditor(ctx)` swap |
    Declare the rejection shapes: FastAPI → `HTTPException(403, detail={"reason": "forbidden_role", "message": "Editor-in-chief only."})`; Convex → `throw new ConvexError({ code: 'forbidden_role', message: 'Editor-in-chief only.' })`. State the local-dev sentinel `{"sub":"local-dev-operator"}` resolves to Editor-in-chief on the FastAPI side (D-04); Convex fails closed on absent/undefined role.

    §49.5 — Verbatim locked labels (from DERIVED-STATE-CONTRACT §6, D-09) — reproduce EXACTLY, do not paraphrase:
    - Apply revision → `Apply revision 🔒 editor only`
    - Confirm evidence replacement → (no distinct label; shares the Apply lock — server still gates per §49.4)
    - Approve the Voice Pass → `Voice approval 🔒 Editor-in-chief only`
    - Publish issue → `Collaborators can review and comment, not publish.`
    - Make instruction active → `Make active 🔒 Editor-in-chief only`
    - Mark Do not use → `🔒 editor only`

    Close with an "Additive-only summary" paragraph (mirror §48's closing): no field renamed/removed; `users.role` field name untouched (values only); `comments` is a wholly new additive table; the six gates are additive authorization on top of existing authentication; no new `deliberationEvents.eventType` literal is added (denials are not audited per D-08; comments are their own table).
  </action>
  <verify>
    <automated>grep -c "## §49" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "## §49" docs/API_CONTRACTS.md` returns exactly one match.
    - `grep -c "Collaborators can review and comment, not publish." docs/API_CONTRACTS.md` ≥ 1 (verbatim publish label present).
    - `grep -c "forbidden_role" docs/API_CONTRACTS.md` ≥ 1.
    - `grep -c "by_workspace_issueNumber" docs/API_CONTRACTS.md` ≥ 1.
    - The §49.4 table names exactly six actions and their file:line handlers.
  </acceptance_criteria>
  <done>API_CONTRACTS.md §49 exists with subsections §49.1–§49.5 and the additive-only summary; every string above appears verbatim.</done>
</task>

<task type="auto">
  <name>Task 2: Implement the two declared schema shapes in convex/schema.ts</name>
  <files>convex/schema.ts</files>
  <read_first>
    - convex/schema.ts lines 226-246 (workspaces + users tables — the surrounding style, comment format, index syntax)
    - docs/API_CONTRACTS.md §49.1 and §49.2 (just written in Task 1)
  </read_first>
  <action>
    Two edits to convex/schema.ts, both additive shapes (no behavior):

    1. Update the `users.role` comment on line 240 FROM:
       `role: v.optional(v.string()),  // "admin" | "operator" — RBAC deferred to Phase 28`
       TO:
       `role: v.optional(v.string()),  // "Editor-in-chief" | "Collaborator" (Phase 49, §49.1) — live source is the Clerk JWT 'role' claim; this field is an optional future mirror`
       The field type `v.optional(v.string())` is UNCHANGED — only the comment vocabulary changes (D-02: field name untouched, values re-vocabularied).

    2. Add a new `comments` table (place it near the other Phase 4x tables; keep the existing `// ── name ──` comment-banner style). Use the EXACT shape declared in §49.2:
       ```typescript
       // ── comments: flat read+comment capability (Phase 49 ROL-04, §49.2) ──────────
       comments: defineTable({
         workspace_id: v.string(),
         issueNumber: v.number(),
         stage: v.optional(v.string()),
         anchorRef: v.optional(v.string()),
         text: v.string(),
         authorId: v.string(),      // Clerk subject — NEVER client-supplied
         createdAt: v.number(),
       })
         .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
         .index('by_workspace', ['workspace_id']),
       ```
    Do NOT add any comments.ts functions here (that is Plan 49-05). Table shape only.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/dispatch-control-no-sanity-write.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "comments: defineTable" convex/schema.ts` returns one match.
    - `grep -c "by_workspace_issueNumber" convex/schema.ts` == 1.
    - `grep -c "admin\" | \"operator\" — RBAC deferred" convex/schema.ts` == 0 (old comment gone).
    - `grep -c "Editor-in-chief\" | \"Collaborator\"" convex/schema.ts` == 1.
    - The existing vitest suite still parses (no schema syntax error): `cd apps/dispatch-control && pnpm vitest run __tests__/dispatch-control-no-sanity-write.test.ts` exits 0.
  </acceptance_criteria>
  <done>schema.ts has the new comments table (two indices) and the re-vocabularied role comment; the field type is unchanged; suite still green.</done>
</task>

<task type="auto">
  <name>Task 3: Sync the schema change to the dev Convex deployment</name>
  <files>convex/schema.ts</files>
  <read_first>
    - /Users/user/.claude/projects/-Users-user-Desktop-Eisenbalm/memory/MEMORY.md entry "Convex functions need live sync"
    - convex/package.json (confirm the `dev:once` script name)
  </read_first>
  <action>
    Committing convex/*.ts ≠ deployed (memory: Phase 39 shipped a prod 500 by skipping this). Run the live-sync so the dev deployment (dev:modest-magpie-797) actually carries the new `comments` table before downstream plans build functions against it:
    `pnpm --filter @eisenbalm/convex dev:once`
    If the exact script name differs, read convex/package.json and use the project's canonical one-shot Convex codegen/deploy script. This is an additive schema change (new table + a comment) — safe, no data migration.
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex dev:once</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter @eisenbalm/convex dev:once` exits 0 (schema pushed; `comments` table registered in the dev deployment).
    - Convex codegen updated: `grep -rc "comments" convex/_generated/api.d.ts` may still be 0 (no functions yet) but schema push reports success.
  </acceptance_criteria>
  <done>The dev Convex deployment carries the new comments table; codegen ran without error.</done>
</task>

</tasks>

<verification>
- `docs/API_CONTRACTS.md` has one §49 section covering all five subsections + additive summary.
- `convex/schema.ts` has the comments table with both indices and the updated role comment; field types unchanged.
- Dev Convex deployment synced.
</verification>

<success_criteria>
The Phase 49 contract exists BEFORE any enforcement code (CLAUDE.md hard rule satisfied). The two schema shapes (role vocab comment, comments table) are declared in the contract and implemented verbatim in schema.ts, and synced to dev.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-01-SUMMARY.md`.
</output>
