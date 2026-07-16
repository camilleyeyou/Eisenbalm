# Phase 49: Roles & Permissions - Context

**Gathered:** 2026-07-16 (--auto: all gray areas selected, recommended defaults chosen)
**Status:** Ready for planning

<domain>
## Phase Boundary

Add **server-side-enforced role authorization** (`Editor-in-chief` vs `Collaborator`) over the **six existing mutating actions** across the dispatch-control workspace, render those six controls **locked-with-explanation** (never hidden) for a Collaborator, and let a Collaborator **read every screen and leave comments**.

This phase **wraps existing actions** — it adds authorization on top of authentication that already exists. It does **not** add new mutating capabilities, does not rename any nomenclature (Phase 50), and does not build a role-assignment admin UI (roles come from Clerk out-of-band).

**In scope:** role model + resolution, server-side gate on the six actions (across both FastAPI and Convex), locked-control rendering, a minimal comment capability for Collaborators.
**Out of scope:** the `blocklisted`→"Do not use" term rename and nav role-indicator polish (Phase 50), threaded/mention/notification comments, a role-management screen.

</domain>

<decisions>
## Implementation Decisions

### Role model & source of truth
- **D-01:** Exactly two roles: `Editor-in-chief` and `Collaborator`. `isEditor = role === 'Editor-in-chief'` (spec §6). Collaborator = read + comment; everything else is Editor-in-chief only.
- **D-02:** Reuse the **existing `convex/schema.ts` `users.role` field** (`users` table, JIT-upserted on first auth — Phase 21 AUTH-04, `convex/users.ts`). It currently holds `"admin" | "operator"` with a `// RBAC deferred` comment — repurpose/migrate its vocabulary to `Editor-in-chief | Collaborator`. **Do NOT add a second role field.** ⚠️ Changing this field's value vocabulary must be checked against `docs/API_CONTRACTS.md` first (CLAUDE.md hard rule).
- **D-03:** **Clerk is the identity source.** Store role in Clerk (publicMetadata) and expose it as a **JWT claim** so both backends read it without a DB round-trip. ⚠️ **The `users.role` field is not viable as the live source today**: `convex/users.ts::upsertCurrentUser` is called only by tests, so the `users` table is effectively unpopulated by app code and `role` is never written/read. Recommended: read role from the **Clerk publicMetadata claim** on both backends; treat `users.role` as an optional mirror **only if** the JIT upsert is also activated to run on load. Researcher must pin down the exact claim path + Clerk JWT template edit.
- **D-04:** The **local-dev sentinel** (`{"sub":"local-dev-operator"}` returned by `_require_clerk_jwt_control` when `CLERK_JWT_ISSUER_DOMAIN` is unset, and the parallel sentinel in `agents.py::_require_operator`) resolves to **Editor-in-chief**, so local dev and the existing header-free isolation tests keep working.

### Server-side enforcement (ROL-01, ROL-02 — the core requirement)
- **D-05:** Enforcement is **server-side and additive**. The six actions already authenticate; Phase 49 adds an authorization (role) check. Do not regress the existing write-boundary / audit / sign-off-revocation pattern.
- **D-06:** The six actions split across **two enforcement surfaces — gate both:**
  - **FastAPI (4 actions)** — add a new `_require_editor` dependency layered on `_require_clerk_jwt_control` (reads role from the Clerk `claims`), applied to: apply revision, confirm evidence replacement (fact-check), approve Voice Pass (sign-off), publish. Rejection = **HTTP 403 `{reason:"forbidden_role"}`**.
  - **Convex (2 actions)** — both `promptVersions.activate` and `charities.setStatus` already call `requireOperator(ctx)` (`convex/lib/auth.ts:52`), which verifies the Clerk identity and **ignores the client-supplied `actorId`** — so they are authenticated but **not role-authorized**. Add a `requireEditor(ctx)` helper alongside `requireOperator` in `convex/lib/auth.ts` (verify identity → resolve role → throw if not Editor-in-chief) and swap it in at both mutations. Rejection = thrown `ConvexError`. (The role check is the *only* gap here — do not reintroduce any client-`actorId` trust.)
- **D-07:** Gate **exactly these six, no more, no fewer** (ROL-02) — see `<code_context>` for confirmed handler paths. Per-screen UX-only hides the spec calls for (Issues: Create/Reopen hidden; My Tasks: primary actions disabled) are honored as presentation but are **not** among the six server-gated actions.
- **D-08:** A Collaborator's **direct** API call / Convex mutation is **rejected server-side** (SC-1), independent of the client. Rejection is structured and testable (`403` / `ConvexError`). Recommended: **no audit row for a denied attempt** — keep the denial a clean rejection; revisit only if research surfaces a compliance need.

### Locked-control rendering (ROL-03)
- **D-09:** **Never hide** the six controls for a Collaborator — render them disabled + locked using the **exact labels from DERIVED-STATE-CONTRACT §6**:
  | Action | Locked label |
  |---|---|
  | Apply revision | `Apply revision 🔒 editor only` |
  | Confirm evidence replacement | (no distinct label — shares the Draft/Apply lock; the fact-check apply surface is covered by the Apply-revision lock. Server still gates it — D-06.) |
  | Approve the Voice Pass | `Voice approval 🔒 Editor-in-chief only` |
  | Publish issue | `Collaborators can review and comment, not publish.` |
  | Make instruction active | `Make active 🔒 Editor-in-chief only` |
  | Mark Do not use | `🔒 editor only` |
- **D-10:** Build **one reusable wrapper** (`<LockedControl>` / `RoleGate`) that the existing action components opt into — Phases 41/42/45/47 deliberately structured these controls to be *wrapped, not rewritten* (see their CONTEXT deferrals to Phase 49). The explanation renders as **visible adjacent text** (accessible), not tooltip-only. Preserve existing a11y invariants (WCAG AA, ≥44px targets, single `<main>`).
- **D-11:** Client role for presentation comes from Clerk `useUser()` publicMetadata, but the client gate is **presentation only** — the server (D-06) is the authoritative gate. The client hint must never be the sole guard.

### Comment capability (ROL-04)
- **D-12:** **No comment system exists today — build a minimal, uniform one.** A single Convex `comments` table keyed to a target (issueNumber/runId + optional stage/anchor ref), with `add`/`list` available to **both roles** (commenting is the one write a Collaborator *can* do). Surface a **consistent** comment affordance across workspace screens (My Tasks + the 5 stages), not bespoke per-screen threads.
- **D-13:** This is the phase's **largest unknown and primary research target**: comment data shape, anchor granularity (screen-level vs claim/passage-level), and render placement. Scope stays at "read everywhere + leave comments." Threading, @mentions, and comment notifications are deferred.

### Claude's Discretion
- **D-14:** No role-assignment UI in this phase. Roles are assigned out-of-band via Clerk publicMetadata, mirrored to `users.role`; the "assignable Editor-in-chief seat" (V3-DEF-04) is satisfied by Clerk metadata for now. Exact `_require_editor` / `requireEditor` naming, the 403 reason-code string, and comment-affordance placement are left to planning/implementation within the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Role gating spec (binding)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §6 — role gating: `isEditor` rule, the exact six actions, and the exact locked labels (source of D-09). Also §1 (publish unlock = the two-sign-off gate) and §5 (the fact-check six actions).
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — per-screen Permissions notes: Issues (Create/Reopen hidden for Collaborator), My Tasks (read-only + comment, primary actions disabled with explanation), Stage 2 Draft (Apply revision locked with a label), Stage 4 Voice (approval Editor-in-chief only), Agent Instructions (Make active locked; Collaborator sees it locked), Editorial Memory (Mark Do-not-use = typed confirmation + reason, Editor-in-chief only); Nav role indicator bottom-left.

### Requirements
- `.planning/REQUIREMENTS.md` — ROL-01, ROL-02, ROL-03, ROL-04 (and V3-DEF-04 provenance).

### Contract guard (hard rule)
- `docs/API_CONTRACTS.md` — CLAUDE.md hard rule: any schema field rename / new eventType / new payload shape checked here FIRST. Relevant to the `users.role` vocabulary change (D-02) and the new `comments` table (D-12).

### Prior phases that structured the controls for this one
- `.planning/phases/41-issue-workspace-frame/41-CONTEXT.md` (D-02; "controls render for the editor, locked-state rendering is 49").
- `.planning/phases/42-fact-check-stage/42-CONTEXT.md` (D-11; the six fact-check actions structured for §6 wrapping, EDT-05 write boundary).
- `.planning/phases/45-agent-revision/45-CONTEXT.md` (D-03; Apply revision behind `_require_clerk_jwt_control`, structured for §6, 409 on `ifRevisionID`).
- `.planning/phases/47-story-brief-stage/47-CONTEXT.md` (Do-not-use "gated the same way"; the guarded write pattern).

</canonical_refs>

<code_context>
## Existing Code Insights

### The six gated actions — confirmed handlers (verified by codebase map)
All auth today is **identity-only, no role**. Frontend call site → client helper → server handler:
- **a. Apply revision** → `packages/pipeline/.../api/revision.py:355 apply_passage_revision` (`POST /issues/{run_id}/revise/apply`, `_require_clerk_jwt_control`). Client: `components/revision/RevisionFlow.tsx:138` → `applyRevision` (`lib/revisionClient.ts:190`).
- **b. Confirm evidence replacement** → `packages/pipeline/.../api/factcheck.py:546 apply_claim_evidence` (`POST /issues/{run_id}/claims/{claim_index}/evidence/apply`, `_require_clerk_jwt_control`). *(This is the agent-rewrite-with-new-source preview→apply — NOT the metadata-only `replace_claim_source` at :349.)* Client: `.../fact-check/FactCheckScreen.tsx:277` → `evidenceApply` (`lib/factCheckClient.ts:262`).
- **c. Approve the Voice Pass** → `packages/pipeline/.../api/signoffs.py:55 record_sign_off` with `kind="sounds-human"` (`POST /issues/{run_id}/sign-off`, `_require_clerk_jwt_control`). Client: `.../voice-pass/[runId]/_components/VoicePassRail.tsx:107` → `recordSignOff(...,'sounds-human')` (`lib/signOffClient.ts:106`).
- **d. Publish** → `packages/pipeline/.../api/review.py:67 publish_issue` (`POST /issues/{run_id}/publish`, `_require_clerk_jwt_control`; calls `_flip_sanity_published`). Client: `.../review-desk/[runId]/_components/DecisionRail.tsx:230` → `publishIssue` (`lib/reviewClient.ts:111`). *(Legacy sibling path: `run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx:84` — check it's gated too.)*
- **e. Make instruction active** → `convex/promptVersions.ts:267 activate` (mutation, `requireOperator(ctx)` at :280). Client: `.../prompt-lab/_components/VersionHistoryPanel.tsx:70,98` → `useMutation(api.promptVersions.activate)`.
- **f. Mark Do not use** → `convex/charities.ts:176 setStatus` with `status='blocklisted'` (mutation, `requireOperator(ctx)` at :185; `blocklisted` = legacy term for "Do not use", renamed Phase 50). Client: `.../registry/_components/RegistryTable.tsx:63,93` → `useMutation(api.charities.setStatus)`.

### Established patterns (reuse, don't reinvent)
- **Auth seam (FastAPI):** canonical verifier `packages/pipeline/.../api/auth.py:128 require_clerk_jwt` (RS256 vs Clerk JWKS); the six-action routes use the control-plane variant `packages/pipeline/.../api/control.py:83 _require_clerk_jwt_control` → returns `claims`, and every mutation does `claims.get("sub")` for the audit actor. **Both fail-open in local dev (sentinel `{"sub":"local-dev-operator"}`) and fail-closed when deployed** (`_deployed()` via `RAILWAY_ENVIRONMENT_NAME`). The role lookup belongs **inside/on top of** these (`_require_editor`). Threaded through `brief.py`, `factcheck.py`, `findings.py`, `leads.py`, `registry.py`, `revision.py`, `signoffs.py`, `review.py`, `voice_pass.py`.
- **Auth seam (Convex):** `convex/lib/auth.ts` holds `requireOperator(ctx)` (:52 — throws if no Clerk identity, returns `identity.subject`, **no role**), plus `requirePipelineSecret`, `requireOperatorOrPipeline`, `requireWebhookSecret`. Add `requireEditor(ctx)` here. `convex/auth.config.ts` wires Clerk (applicationID `"convex"`).
- **Write boundary + audit:** dashboard → pipeline API (`_require_clerk_jwt_control`) → Convex/Sanity, one truncated `_emit_audit` before/after row, active sign-offs revoked (`_revoke_active_signoffs`). The `dispatch-control-no-sanity-write.test.ts` source-scan tripwire forbids direct console→Sanity writes. Do not regress.
- **Not authorization (name traps):** `agents.py:58 _require_operator` (FastAPI) and `convex/lib/auth.ts requireOperator` are both *authentication*, not role checks despite the "operator" name — don't mistake either for existing RBAC. `control.py:222 _enforce_start_gates` is a *workflow* precondition gate (one-run/budget), not permissions.

### Integration points
- **Console is `apps/dispatch-control`** (Clerk-gated: `middleware.ts` `auth.protect()` on all but `/sign-in`; `ClerkProvider` in `app/layout.tsx`; `ConvexProviderWithClerk` bridge). `apps/web` (public site) has **no Clerk** — nothing to gate there.
- `convex/schema.ts:234 users` table (`role` field, indices `by_workspace`, `by_clerkUserId`) — the intended role store, but **not live-populated today** (see D-03).
- **Frontend gating is greenfield:** `useUser()` appears in only 3 components, used solely for `user?.id` (which the server ignores) — there is **no role prop/context/hook** to hang UI gating on; the `<LockedControl>` wrapper + a role hook are net-new (D-10/D-11). Current button `disabled` conditions are workflow-state + `busy` only — role gating is *additive* to them.
- **No comments infrastructure** anywhere (convex schema or frontend) — the `comments` table + mutations + affordance are net-new (D-12).

</code_context>

<specifics>
## Specific Ideas

- Locked labels are **verbatim** from DERIVED-STATE-CONTRACT §6 — do not paraphrase (D-09).
- The publish lock deliberately reads as a sentence (`Collaborators can review and comment, not publish.`) rather than the `🔒 editor only` shorthand — keep that distinction.
- "Read everything and comment" (ROL-04) is the *positive* capability for Collaborators — comments are the single write they're allowed; treat the comment path as available to both roles, not editor-gated.

</specifics>

<deferred>
## Deferred Ideas

- **`blocklisted` → "Do not use" term rename** and the nav role-indicator / nomenclature ripple → **Phase 50** (nomenclature pass). Phase 49 keeps the existing field values; it only enforces + locks.
- **Role-management / assignment UI** → out of scope; belongs in Administration (Phase 50 moves admin-only controls there). Roles assigned via Clerk metadata.
- **Threaded comments, @mentions, comment notifications** → future; Phase 49 ships flat "leave a comment" only.
- **Auditing denied attempts** → not built now (D-08); revisit if a compliance need appears.

### Reviewed Todos (not folded)
None — `todo match-phase 49` returned zero matches.

</deferred>

---

*Phase: 49-roles-permissions*
*Context gathered: 2026-07-16*
