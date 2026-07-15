# Phase 43: My Tasks & Decision Log - Research

**Researched:** 2026-07-15
**Domain:** Internal projection UI (Next.js/Convex/React) — no external library or service domain; this is a codebase-archaeology research pass, not an ecosystem survey.
**Confidence:** HIGH (every finding below is verified by direct file/line reads and `git log`, not by training-data assumption)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. The My Tasks projection — reuse Phase 40's selector (TSK-01, TSK-02)**
- **D-01:** Reuse the existing `deriveTasks()` selector as-is; do NOT add a tasks table and do NOT fork a second projection. The screen assembles the exact same `DerivationInputs` the Masthead already builds (`components/Masthead.tsx` lines ~200-232) — same Convex queries, zero new subscriptions.
- **D-02:** Extend the selector output ONLY additively, and only for fields the count-only Masthead caller didn't need. Add `age`/`openedAt` (relative age, e.g. "2h ago") derived from the underlying artifact's timestamp. Pure computation, no new data source.
- **D-03:** Severity/ordering/grouping follow the selector verbatim (`isMustFix`, `findingSeverityToTaskSeverity` are shared — never re-derived) — the anti-drift rule extended from Phase 42 D-16.

**B. Projection scope — issue-scoped, matching the locked source set (TSK-01)**
- **D-04:** My Tasks projects over exactly open claims, open findings, missing sign-offs for the current issue's run. No system/Workbench task sources (failed-run recovery, eval regressions) this phase.
- **D-05:** Cross-issue-capable in structure but scoped to the in-progress issue in practice (single-run scope, same as Masthead's `runs.latest`). Do not pre-build multi-issue-in-flight looping.

**C. "Superseded" tasks — session-diff, never a store (TSK-05)**
- **D-06:** Detect supersession at the client/session level — an in-session snapshot of the last-shown task set; when a task id vanishes because the underlying run/step identity changed (a restart), render it struck-through as "superseded" with a link to the new step/stage. No tasks table, no new Convex store.
- **D-07:** Distinguish "superseded" (run/step restarted) from "resolved" (artifact reached terminal state — claim checked, finding resolved, sign-off signed; render "resolved just now" for the session, `sev: 'Done'`, then fall out). Exact detection predicate is planning/research discretion, bounded by: (1) a task never disappears silently, (2) no tasks table.

**D. The Decision Log component — new, human-readable, distinct from the raw audit viewer (TSK-06)**
- **D-08:** Build a NEW `DecisionLog` component; do NOT generalize `AuditLogViewer.tsx` (stays as the Settings raw technical viewer, unchanged). One component used in two places: the Approval context panel and the Issue Workspace "Decision log" control.
- **D-09:** The Decision Log is a curated PROJECTION over the same `audit_log` trail — no separate decision store (Phase 42 D-18 locked this). A row qualifies as a "decision" by the presence of a `reason` (or an explicit `decisionKind` marker).

**E. Decision-row shape — additive-optional fields + a shared write helper (TSK-06)**
- **D-10:** Extend `audit_log` with additive-optional structured decision fields (following the milestone's additive-optional pattern): `reason`, `issueNumber`, `runId`, `instructionVersion`, `actorName`/`actorKind`. Legacy rows omit new fields and render tolerantly (reason parsed from `after` JSON as fallback). Whether to add all these fields or a subset is planning discretion.
- **D-11:** ONE shared decision-write helper that all reason-requiring actions call — wraps `auditLog.write` (internal, Convex-side) / `auditLog.record` (pipeline HTTP) with the structured decision fields. Console actions keep the dashboard → pipeline API → Convex/Sanity → `audit_log` write boundary (EDT-05); pipeline-side actions use `auditLog.record`. Contract-first: amend `docs/API_CONTRACTS.md` BEFORE code.
- **D-12:** Actor rendering resolves `actorId` → display name. Human `actorId` (Clerk sub) → `users` table (`clerkUserId → name`); a named-agent/system id (`pipeline`, an agent key, `cron`, `system:*`) → agent/system display name. Resolution is a rendering concern; the stored id is unchanged.

**F. Retrofit scope — wire shipped actions now; unbuilt ones inherit the shape (TSK-06)**
- **D-13:** Route every ALREADY-SHIPPED reason-requiring action through the D-11 helper: Keep as written (Phase 42 fact-check), Hold issue (Phase 40 `HoldDialog`), Activate-with-regression (Phase 38, `promptVersions`), Do-not-use (Phase 26/34 charity/publish flows), any existing override-a-recommendation surface. Where a row already writes a reason (e.g. hold, activate-override), promote it from `after`-JSON into the structured field.
- **D-14:** The two Stage-1 actions ("remove a lead", org-selection override) are OUT OF SCOPE — Stage 1 doesn't exist until Phases 46-47. Ship the shape + helper; those phases call it.

**G. Nav, routing, and the Masthead handoff**
- **D-15:** Add a `/my-tasks` route and a "My Tasks" nav item in the Editorial group (`lib/nav.ts` — slot reserved). Point the Masthead's `AwaitingYouInbox` dropdown "see all/open" target at the new screen. Count stays live off `deriveTasks(...).length`.
- **D-16:** Deep links use the existing issue-keyed route resolvers (`issueDraftHref`/`issueVoiceHref`/etc., used inside the selector). No new URL scheme. "Inspect context" links to the Phase 44 inspector entry point (mirror how Phase 42 shipped its Inspect entry point without the panel).

**H. Cross-cutting discipline**
- **D-17:** Contract-first — amend `docs/API_CONTRACTS.md` with the extended `audit_log` shape, the decision-write helper contract, and any new decision-log query BEFORE writing code.
- **D-18:** Reuse, do not rebuild — `deriveTasks`, the Masthead's `DerivationInputs` assembly, `convex/auditLog.ts`, existing per-action reason capture, the `content.py`/`_emit_audit` write-boundary pattern.
- **D-19:** Every state renders label + icon, never color alone.

### Claude's Discretion
- Exact age formatting and whether tasks are visually grouped by severity or shown as one sorted list (D-03, D-02).
- The precise superseded-vs-resolved detection predicate and the session-snapshot mechanism (D-06, D-07), bounded by "never disappears silently" + "no tasks table."
- Which subset of `{reason, issueNumber, runId, instructionVersion, actorName, actorKind}` to add to `audit_log` and whether a `decisionKind` marker is worth a field vs deriving decision-hood from `reason` presence (D-09, D-10).
- The Decision Log component's file location, whether the projection is a new Convex query or a client filter over `listForWorkspace`, and issue-scoping via `runId`/`issueNumber` vs `resourceType='run'` join (D-08, D-09).
- Copy for the empty state ("Nothing needs you" + Approval pointer), the superseded/resolved labels, and the decision-log row layout.
- Whether the "Inspect context" control is a visible-but-inert stub or a link to a Phase-44 placeholder route (D-16) — match how Phase 42 shipped its Inspect entry point.

### Deferred Ideas (OUT OF SCOPE)
- Stage-1 reason-requiring actions (remove a lead, override the org recommendation) — Phases 46-47 call the Phase 43 shared helper; not built here.
- The 7-tab "Inspect how this was made" panel — Phase 44 (Phase 43 wires the entry point only).
- Role/permission gating (Collaborator read-only, locked-control rendering) — Phase 49.
- System/Workbench task sources in My Tasks (failed-run recovery, eval regressions) — deferred; lives on Run Details (Phase 50).
- Multi-issue-in-flight My Tasks — structured to loop over issues but scopes to the current issue's run in practice.
- Console-wide nomenclature ripple — Phase 50.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TSK-01 | My Tasks lists everything awaiting human judgment as a derived projection over open claims, open findings, and missing sign-offs — no separate task store. | `deriveTasks()` (derivedState.ts:366-441) already implements exactly this. Confirmed it reads `qaFindings`/`claimRows`/`signOffs` only — no new source needed. See Architecture Patterns §1. |
| TSK-02 | Every task shows plain-language title, issue/area, why, severity, stage, age, agent recommendation when one exists. | `DerivedTask` already carries `title/where/why/sev/stage/rec`. Only `age` is missing — Pitfall/Pattern §2 gives the exact per-source timestamp to add per row type. |
| TSK-03 | Each task's primary action deep-links to the exact claim, passage, or decision; "Inspect context" opens the inspector. | **Confirmed gap** (Pitfall 1): claim tasks currently link to `/draft`, not `/fact-check`; the "facts" sign-off task also links to `/draft` instead of `/approval`. Neither links to the *specific* claim/finding (no query-param selection exists in any stage screen today). See Pitfall 1 + Open Question 1. |
| TSK-04 | Empty state says so explicitly, points to Approval. | No existing precedent for the exact copy; `AwaitingYouInbox`'s existing empty state ("Nothing needs you right now.") is the closest sibling pattern — see Code Examples §3. |
| TSK-05 | A task whose underlying step was restarted shows "superseded" with a link to the new step, never disappears silently. | **Confirmed hard finding** (Pitfall 2): `rerun_agent` (control.py:470-594) does NOT clear/invalidate old `qaCorrections`/`claim_checks` rows for the re-rolled section — so the "vanish on next render" premise in DERIVED-STATE-CONTRACT §2 does not hold for the single-section reroll case, the most common in-scope restart. See Pitfall 2 for the concrete cross-reference mechanism against `audit_log`'s `run.section_rerolled` rows. |
| TSK-06 | Every reason-requiring action writes to one Decision log component: actor, action, time, reason, before/after, instruction version, issue, run. | `audit_log` schema + `auditLog.write`/`record`/`listForWorkspace` fully read (convex/schema.ts:266-277, convex/auditLog.ts). Every current reason-bearing call site read and characterized — see Architecture Patterns §4 and Pitfall 3 (Do-not-use has NO reason capture and NO audit_log write today, contradicting CONTEXT's characterization). |

</phase_requirements>

## Summary

This phase has no external-library research surface — it is 100% internal codebase archaeology. All "research" value here is in confirming exactly what already exists, what CONTEXT.md's characterizations get right vs. slightly wrong, and where the wiring has silently drifted since Phase 40/41/42 shipped. Three findings materially change what the planner needs to account for:

1. **TSK-03's deep-link claim is only half-true today.** `deriveTasks()`'s claim-task href points at `/issues/[n]/draft`, and the "Clear the facts" sign-off task also points at `/draft` — neither points at Fact Check (`/issues/[n]/fact-check`) or Approval (`/issues/[n]/approval`), even though `issueFactCheckHref`/`issueApprovalHref` already exist in `issueRouteResolver.ts` and have existed since the same commit that mis-wired these two hrefs (`14103b4`, "retarget deriveTasks to /draft", written before Phase 42's Fact Check stage existed). This is a one-line, in-place, evidence-backed bug fix the plan should include — not scope creep.

2. **TSK-05's "superseded" premise does not hold for the actual restart mechanism in scope.** DERIVED-STATE-CONTRACT §2 says "superseded needs no lifecycle — a restarted step simply re-derives," implying tasks vanish from the projection when a step restarts. But `rerun_agent` (the only in-scope restart — RUN-05's single-section reroll; failed-run recovery is explicitly deferred to Phase 50) does not touch `qaCorrections` or `claim_checks` at all for the re-rolled section — old findings/claims remain `open`/`pending` and keep showing as active tasks, now silently stale. The only available signal that a reroll happened is the `audit_log` row `action: "run.section_rerolled"`, `resourceId: "{runId}:{agentKey}"`. The plan needs a concrete predicate using this, not just a session-snapshot diff (which won't fire for this restart type).

3. **TSK-06's retrofit list is not uniformly "promote an existing reason."** Hold and Activate-override do write a reason today (into `after` JSON) exactly as CONTEXT.md describes. But **Do-not-use (`charities.setStatus`) currently has NO reason parameter, no confirmation dialog, and — a documented, pre-existing gap per its own code comment — writes NO `audit_log` row at all.** This item needs new reason-capture UI + a new audit emission, not a promotion.

**Primary recommendation:** Reuse `deriveTasks` and `DerivationInputs` exactly as CONTEXT.md prescribes (D-01), but budget explicit tasks for (a) fixing the claim/facts-signoff href mismatch, (b) building the reroll-cross-reference predicate for supersession rather than relying on simple vanish-diffing, and (c) building Do-not-use's reason capture from scratch rather than "promoting" a reason that doesn't exist yet.

## Architecture Patterns

### Pattern 1: `deriveTasks` is already the correct, complete projection — reuse verbatim

`apps/dispatch-control/lib/derivedState.ts:366-441` (`deriveTasks`). Confirmed shape:

```typescript
export interface DerivedTask {
  id: string
  sev: TaskSeverity              // 'must-fix' | 'review-recommended' | 'information'
  title: string
  where: string
  why: string
  rec?: string
  primary: { label: string; href: string }
  insp?: string                  // Phase 44 inspector key — not populated yet
  stage: 1 | 2 | 3 | 4 | 5
}
```

Sources: open `qaFindings` (stage 2 draft / stage 4 voice, split by `isVoiceAxisFinding`), pending `claimRows` (stage 3), missing `facts-cleared`/`sounds-human` sign-offs (stage 5). Severity for QA findings comes from `findingSeverityToTaskSeverity`; for claims from the SHARED `isMustFix` (also used by Stage 3's own summary — Phase 42 D-16 anti-drift). Sorted must-fix → review-recommended → information, then by stage.

`Masthead.tsx:186-232` is the reference `DerivationInputs` assembly: `runs.latest` → `pipelineRuns.byRunId` (issueNumber) → `issues.byIssueNumber` (held/published) + `signOffs.activeByRunId` + `claimChecks.listByRunId` + `qaCorrections.byRunId` + `pitchLog.byRunId`, all keyed off the single resolved `runId`. **This is the only current per-page assembly of `DerivationInputs` that does NOT require an already-known `issueNumber` prop** — it self-resolves "the current issue" from `runs.latest`, exactly what a nav-level `/my-tasks` screen needs (it is not nested under `/issues/[n]/...`).

**Don't-hand-roll note:** `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` ALSO computes `deriveTasks` (line 170), but it requires an `issueNumber` prop already known by its caller and additionally fetches the full draft content (`getDraft`) for `sectionStates` — machinery My Tasks doesn't need. Do not reuse this provider directly for `/my-tasks`; it would pull in an unnecessary Sanity/content-patch round trip. Consider extracting a **shared hook** (e.g. `useCurrentIssueDerivationInputs()`) that both `Masthead.tsx` and the new `/my-tasks` screen call, since after this phase there will be THREE near-identical 5-query assembly blocks (Masthead, WorkspaceStateProvider, My Tasks) if the Masthead's block is merely copy-pasted a third time. This is a `Claude's Discretion` architecture call, not a locked decision — flagging it because CONTEXT D-01 literally says "same Convex queries" (implying copy, not extraction), but extraction is cheap and prevents a 3rd drift point.

### Pattern 2: `age` — per-source timestamp already available, needs threading through `DerivationInputs`

Convex documents always carry `_creationTime` (system field), but `DerivationInputs.qaFindings`/`claimRows` in `derivedState.ts` only type a subset of fields (no `_creationTime`, no `timestamp`). To add `age` additively (D-02):

- **QA findings:** `qaCorrections` schema has `timestamp: v.number()` (schema.ts:103) — already the row's creation time (Phase 5). Thread it through `DerivationInputs.qaFindings` row shape.
- **Claims:** `claim_checks` has no unconditional creation timestamp field in the type today, but Convex's implicit `_creationTime` is always available in the raw query result even though the current `DerivationInputs.claimRows` mapper (Masthead.tsx:212-218, WorkspaceStateProvider.tsx:133-150) doesn't pass it through. Add `_creationTime` (or a mapped `createdAt`) to the claim row shape passed into `DerivationInputs`.
- **Missing sign-offs:** CONTEXT.md's own guidance ("since run start / since the stage became reachable") — use `runRow`/`pipelineRun.startedAt` (already queried) as the anchor since there is no per-sign-off "became eligible at" timestamp stored anywhere.

This is a pure, additive computation — no new Convex query. Both `Masthead.tsx`'s DerivationInputs assembly and `WorkspaceStateProvider.tsx`'s claim-row mapper will need the same two extra passthrough fields (`timestamp` for qaFindings is already selected wholesale since `qaFindings` is passed through unmapped in both places — only `claimRows`' explicit field-picking needs the addition).

### Pattern 3: `audit_log` — the substrate is thin and uniform; every call site funnels through one of two helpers

Two writer paths, confirmed exhaustively:

1. **Convex-side (dashboard mutations):** call `ctx.runMutation(internal.auditLog.write, {...})` directly, inline, in the mutation body. Confirmed call sites: `issues.ts::hold` (line 133), `issues.ts::reopen` (line 174), `promptVersions.ts::activate` (lines 348, 358), `charityCorrections.ts::append` (line 50). **No shared Convex-side wrapper exists today** — each mutation constructs its own `{workspace_id, actorId, action, resourceType, resourceId, before, after}` object inline. D-11's "one shared decision-write helper" therefore needs a genuinely NEW Convex-side function (e.g. `internal.auditLog.writeDecision` or an extension to `write` itself with new optional args) — there is no existing wrapper to extend, only a raw insert to build on top of.

2. **Pipeline-side (FastAPI, Clerk-JWT-guarded endpoints):** call `_emit_audit(...)` (`packages/pipeline/src/eisenbalm_pipeline/api/control.py:137-175`), which POSTs to the public `auditLog:record` Convex mutation via `_cc.convex_mutation`. This helper is imported and reused across `content.py`, `signoffs.py`, `voice_pass.py`, `review.py`, `findings.py`, `factcheck.py`, `webhooks.py` — this IS the existing shared pipeline-side helper, and is the natural place to add new optional kwargs (`reason`, `issue_number`, `run_id`, `instruction_version`, `actor_name`, `actor_kind`) that get forwarded into the `auditLog:record` mutation's args dict only when non-`None` (mirrors the existing `before`/`after` optional-kwarg pattern documented in API_CONTRACTS §31.8).

`audit_log` schema (`convex/schema.ts:266-277`): `workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, timestamp`. Indexes: `by_workspace`, `by_workspace_timestamp`.

**Actor identity today:** every reason-bearing call site's `actorId` is a Clerk `sub` (human) — `claims.get("sub") or "unknown"`. The only non-human actor IDs in the codebase are `"cron"` (control.py:406, an automated trigger — not reason-bearing) and `"webhook"` (webhooks.py — a blocked-bypass log, not reason-bearing). **No shipped reason-requiring action is agent-initiated today** — TSK-06's "actor (human or named agent)" is forward-looking for this retrofit; the `actorKind` field can be trivially `'human'` for every row this phase actually touches, with the agent-kind branch built for future-proofing (Stage 1 phases 46-47, which may log agent-suggested-then-human-confirmed actions).

**`users` table exists but has no read query.** `convex/users.ts` has only `upsertCurrentUser` (a mutation). Schema (`schema.ts:235-245`): `workspace_id, clerkUserId, email, displayName?, role?, createdAt, lastSeenAt`, indexed `by_clerkUserId`. D-12's actor-name resolution needs a NEW query (e.g. `users.listForWorkspace` or `users.byClerkUserId`) — nothing to reuse here, this is genuinely net-new.

### Pattern 4: `DecisionLog` component placement + the existing "Inspect" stub precedent

`AuditLogViewer.tsx` (`app/(dashboard)/settings/_components/`) is the sibling to avoid copying — it's a raw `<table>` over `listForWorkspace`, `actorId` shown as a bare Clerk sub, `before`/`after` as collapsed `<details><pre>` JSON. The new `DecisionLog` component should NOT reuse its markup; it needs actor-name resolution (Pattern 3), a `reason` line as the primary visible field, and issue/run scoping.

For the "Inspect context" entry point (D-16, mirrors Phase 42): `ClaimProvenanceCard.tsx:448-455` already ships an "Inspect" button that is `disabled={disabled || !actions?.onInspect}` — no caller currently passes `onInspect`, so it renders visible-but-permanently-inert today. This is the exact precedent to copy for My Tasks' "Inspect context" control: render the control, leave it inert (or point at a `/issues/[n]/inspect?key=...` placeholder route) until Phase 44 ships the panel.

## Common Pitfalls

### Pitfall 1: Claim and facts-signoff task hrefs point at the wrong stage (confirmed via `git log`)

**What goes wrong:** A "Check claim: ..." task (stage 3) and a "Clear the facts" task (stage 5) both currently resolve their `primary.href` to `issueDraftHref(n)` (`/issues/[n]/draft`) — not `issueFactCheckHref(n)` (`/issues/[n]/fact-check`) or `issueApprovalHref(n)` (`/issues/[n]/approval`), even though both of those href builders already exist in `issueRouteResolver.ts` and route to fully-functional screens (`FactCheckScreen.tsx` has live claim actions; `ApprovalStage.tsx` reuses `DecisionRail` which has the live "Clear the facts" sign-off button).

**Why it happens:** `git show 14103b4` ("feat(41-01): add stage href builders + retarget deriveTasks to /draft") mechanically retargeted every `deriveTasks` href from the old `/review` route to the new `/draft` route in one pass, in the SAME commit that introduced `issueFactCheckHref`/`issueApprovalHref` — but Fact Check (Phase 42) and the Approval stage's live sign-off wiring didn't exist yet at that point in the timeline, so there was nothing more specific to route to at the time. Nobody returned to update these two hrefs once Phase 42 shipped Fact Check.

**How to avoid:** In `deriveTasks`, change the claim-row href from `issueDraftHref(n)` to `issueFactCheckHref(n)`, and the `signoff-facts` task's href from `issueDraftHref(n)` to `issueApprovalHref(n)`. This is in-scope, additive-safe (no signature change, just a same-shape return value with a different string), and directly required for TSK-03 ("deep-links to the exact claim... decision").

**Warning signs:** A test asserting `deriveTasks(...).find(t => t.id.startsWith('claim-')).primary.href` contains `/fact-check` would currently fail — write this as a Wave-0 regression check.

### Pitfall 2: Section reroll (RUN-05) does not invalidate `qaCorrections`/`claim_checks` — "superseded" needs a real predicate, not just vanish-diffing

**What goes wrong:** DERIVED-STATE-CONTRACT §2's premise — "superseded needs no lifecycle, a restarted step simply re-derives" — assumes that when a step restarts, its stale findings/claims disappear from the query results on the next render, and the client's job is just to notice a previously-seen task `id` is now absent. Verified in `packages/pipeline/src/eisenbalm_pipeline/api/control.py:470-594` (`rerun_agent`, the ONLY in-scope restart mechanism — RUN-05's single-section reroll; TSK-05's other conceivable restart, failed-run recovery, is explicitly deferred to Phase 50 per CONTEXT D-04): the reroll rewrites the Sanity draft and updates the LangGraph checkpoint, and separately calls `_revoke_active_signoffs`, but it **never touches `qaCorrections` or `claim_checks` for the re-rolled section**, and never inserts an `agent_runs` row for the reroll either. So a pre-existing open finding/claim tied to that section stays `open`/`pending` forever after a reroll — it does NOT vanish, and `deriveTasks` keeps re-emitting it as if nothing happened, now silently pointing at replaced content.

**Why it happens:** The reroll was scoped (Phase 25/RUN-05) as a surgical, cheap content-only operation — explicitly avoiding re-invoking QA/editor_final/publisher ("Pitfall 2" in that endpoint's own docstring) to keep re-rolls fast and free of side effects on unrelated sections. Nobody has since connected that decision to the My Tasks/"superseded" requirement, because My Tasks didn't exist as a screen until now.

**How to avoid:** The only queryable signal that a section was rerolled is the `audit_log` row `action: "run.section_rerolled"`, `resourceId: "{runId}:{agentKey}"` (emitted by `_emit_audit` in `rerun_agent`, control.py:583-589). Recommended predicate: for each open task tied to a `sectionName` (or `agentKey`, for the pitchRows/story-restart case), look up whether any `run.section_rerolled` audit row for that `runId`+`agentKey` has a `timestamp` newer than the task's own underlying row timestamp (Pattern 2's `age` source). If yes, render "superseded" (struck-through, link to the new step) instead of a normal open task — even though the row is technically still present and still `open`/`pending`. Note the section-id vocabulary mismatch when doing this match: `qaCorrections.sectionName` is snake_case and equals `agentKey` directly (`origin_story`); `claim_checks.sectionName` is camelCase (`originStory`) and needs `qaSectionToGalleyId(agentKey)` (`lib/galley/sectionIdMap.ts`) to convert before comparing.
A simpler, narrower fallback that satisfies "never disappears silently" without the audit cross-reference: treat EVERY reroll as invalidating the *entire* task set for that section by construction going forward (i.e., as part of this phase, also patch `rerun_agent` to clear the stale rows) — but that is pipeline-side scope beyond a "screen + component" phase and should be flagged to the planner as an explicit scope decision, not assumed.

**Warning signs:** A demo/test that re-rolls a section with an open QA finding and expects the finding's task to either disappear or read "superseded" will observe neither — it will keep reading as a normal, undated "must-fix" task pointing at content that no longer exists in the draft.

### Pitfall 3: "Do not use" (charity blocklist) has NO reason capture and NO audit_log write today — contradicts CONTEXT's retrofit characterization

**What goes wrong:** CONTEXT.md D-13 describes Do-not-use as one of the actions that "already writes a reason somewhere" needing only promotion from `after`-JSON. Verified false: `RegistryTable.tsx:84-95` (`handleBlocklist`) calls `setStatus({ workspace_id, charityId, status: 'blocklisted' })` with **no reason argument at all**, and `charities.ts::setStatus` (lines 167-189) has **no `reason` param and never calls `ctx.runMutation(internal.auditLog.write, ...)`** — confirmed by a full read of the handler body (only `ctx.db.patch(charityId, { status })`). This is a pre-existing, self-documented gap: `charityCorrections.ts`'s own file header explicitly calls out "`charities.setStatus`'s no-audit pattern, which is an existing Phase 26 gap out of scope for this phase [39]."

**Why it happens:** `setStatus` was built in Phase 26 as a lightweight registry-status toggle before the audit/decision-log discipline (Phase 23+) was retrofitted everywhere else; Phase 39 (Editorial Memory corrections) explicitly declined to fix it, deferring it.

**How to avoid:** Treat Do-not-use as **net-new reason-capture work**, not a promotion: (1) add a `reason: v.string()` (or optional, enforced at the mutation) param to `charities.setStatus` — or a new dedicated `charities.markDoNotUse` mutation per the Annotations spec's "typed confirmation (org name) + required reason, Editor-in-chief only" — (2) add the `internal.auditLog.write` call (or the new D-11 shared helper) inside it, (3) add a reason-collecting confirmation UI to `RegistryTable.tsx`'s blocklist flow (today it's a bare inline confirm popover with no text input — verify the popover markup before assuming a text field exists to wire up).

**Warning signs:** Querying `audit_log` for `action === 'charity.blocklisted'`-shaped rows today returns zero results — any plan step that says "promote the existing Do-not-use reason" will find nothing to promote.

### Pitfall 4: `TaskSeverity`/`SEVERITY_MINUTES` is a closed, exhaustive `Record` — do not add `'Done'` or `'superseded'` as a `TaskSeverity` value

**What goes wrong:** DERIVED-STATE-CONTRACT §2's prototype vocabulary uses `sev: 'Done'` for resolved tasks. `TaskSeverity` in `derivedState.ts:26` is `'must-fix' | 'review-recommended' | 'information'`, and `SEVERITY_MINUTES: Record<TaskSeverity, number>` (line 47) and `SEVERITY_ORDER` (line 354) are both **exhaustive Records keyed by that exact union** — TypeScript will hard-error if a new member is added without updating both maps, and `estimateWorkMinutes` (consumed by `WorkspaceStateProvider.tsx` for the Stage-5 "est. review time" figure) assumes every task in a `DerivedTask[]` has a "real" severity worth minutes.

**How to avoid:** Keep `resolved`/`superseded` OUT of `DerivedTask`/`TaskSeverity` entirely. Model them as a screen-local wrapper type, e.g. `type DisplayTask = DerivedTask & { sessionState: 'active' | 'resolved' | 'superseded'; supersededBy?: string }`, computed client-side in the My Tasks screen (or a small pure helper module) by diffing the current `deriveTasks()` output against the previous render's snapshot — never inside `derivedState.ts` itself. This is exactly what D-06/D-07 already imply ("client/session memory only") — this pitfall just confirms it is also a *type-safety* necessity, not only a design preference.

### Pitfall 5: `AwaitingYouInbox` is a SEPARATE derivation, not `deriveTasks()` — and has no "see all" link today

**What goes wrong:** CONTEXT.md D-15 says "Phase 43 points the dropdown's 'see all' target at the new screen," implying such a link exists. Verified: `AwaitingYouInbox.tsx` has no "see all" / footer link anywhere in its markup (full file read, 161 lines) — it renders only a list of items or the empty state, with no footer CTA. It is ALSO not built on `deriveTasks`: it computes its own separate item list from `runs.listForWorkspace`, `qaCorrections.byRunId` (unresolved errors only), and `claimChecks.allSignedOff` (a boolean summary, not per-claim rows) — a genuinely different, narrower projection than `deriveTasks`' three-source model.

**How to avoid:** Treat "point the dropdown's see-all at the new screen" as **adding** a footer link to `AwaitingYouInbox.tsx` (e.g. `<Link href="/my-tasks">See all →</Link>`), not repointing an existing one. Do not attempt to make `AwaitingYouInbox` itself consume `deriveTasks` — that would be a larger, unscoped rewrite of an already-shipped, tested (Phase 30) component; D-15 only asks for a navigation link, not a data-model unification.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding which claims/findings/sign-offs need attention | A new "open items" query or a tasks table | `deriveTasks(DerivationInputs)` (derivedState.ts:366) | Already the exact DERIVED-STATE-CONTRACT §2 projection; forking a second one is the single most explicitly forbidden thing in this phase's CONTEXT (D-01, D-18). |
| Severity classification for claims | A new severity function in the screen | `isMustFix` (derivedState.ts:321) — the SAME predicate Stage 3's own summary uses | Phase 42 D-16 anti-drift: if My Tasks re-derives severity independently, it can silently disagree with the stage badge/Stage-3 summary. |
| Resolving "current issue" for a nav-level (non-issue-scoped) screen | A bespoke query chain | Mirror `Masthead.tsx`'s `runs.latest` → `pipelineRuns.byRunId` → `issues.byIssueNumber` chain exactly (Pattern 1) | It's the only existing precedent for "resolve current issue without an issueNumber prop" — `WorkspaceStateProvider` requires the prop already. |
| Actor-friendly audit rendering | A new audit table/view from scratch | `convex/auditLog.ts`'s existing `listForWorkspace` query, filtered client-side (or a new scoped query) for `reason`-bearing rows, rendered by a NEW `DecisionLog` component (not `AuditLogViewer`) | D-09 locks "projection, not new store"; D-08 locks "new component, not a generalization of the raw viewer." |
| Reason-requiring action plumbing | Bespoke per-action audit calls (the status quo) | The D-11 shared decision-write helper (new Convex fn wrapping `write`, new pipeline-side `_emit_audit` kwargs) | Currently EVERY dashboard mutation inlines its own `ctx.runMutation(internal.auditLog.write, {...})` call (4 different shapes across `issues.ts`/`promptVersions.ts`/`charityCorrections.ts`) — this is the exact hand-rolled duplication D-11 exists to end. |

**Key insight:** Nearly everything this phase needs already exists in some form; the actual engineering work is (1) two href corrections, (2) one additive field (`age`), (3) one genuinely new client-side session-diff module (superseded/resolved), (4) one genuinely new Convex query (`users` lookup) + one genuinely new shared write helper, and (5) one genuinely new reason-capture flow (Do-not-use). Nothing here calls for a new library, a new architectural layer, or a new persistence model.

## Open Questions

1. **Should claim-task and finding-task deep links select the SPECIFIC item, or just navigate to the right stage screen?**
   - What we know: `issueFactCheckHref`/`issueDraftHref`/`issueVoiceHref`/`issueApprovalHref` are stage-level-only URLs (no claim/finding-id query param). `FactCheckScreen.tsx` manages the selected claim via local React state (`useState`), not a URL param; `DraftPanelContent.tsx`/`VoicePanelContent.tsx` have no `useSearchParams` at all.
   - What's unclear: TSK-03 says "deep-links to the exact claim, passage, or decision" — literally read, this implies the target item should be pre-selected/scrolled-to on arrival, not just "the right screen is open."
   - Recommendation: Given D-16 explicitly scopes deep links to "the existing issue-keyed route resolvers" (no new URL scheme), treat stage-level navigation (with the Pitfall-1 href fix) as the correct scope for THIS phase, and flag exact-item auto-selection (e.g. `?claim=3` support in `FactCheckScreen.tsx`) as a fast-follow the planner can explicitly descope or include as a stretch task — it's a small, contained addition (one `useSearchParams` read + one `useEffect` calling the existing `selectClaim`) if the planner wants full TSK-03 literalism.

2. **Does the superseded predicate belong in this phase's scope, or does it require a pipeline-side change (clearing stale rows on reroll) that's arguably outside "screen + component"?**
   - What we know: Pitfall 2 shows the audit-log cross-reference approach is buildable entirely client-side (My Tasks screen queries `audit_log` for `run.section_rerolled` rows and compares timestamps) — no pipeline change required.
   - What's unclear: whether the cross-reference is "good enough" fidelity (it only fires for rerolls that happened AFTER My Tasks starts observing, or requires fetching enough audit history to always catch it) vs. whether the design intent expects true real-time vanishing (which would require the pipeline-side fix).
   - Recommendation: Build the audit-log cross-reference (client-side, no backend change) — it satisfies "never disappears silently" without touching `rerun_agent`, matches the phase's stated scope, and is a strictly additive read. Document the pipeline-side alternative as a known non-goal.

3. **What exact subset of `{reason, issueNumber, runId, instructionVersion, actorName, actorKind}` should be added to `audit_log`?**
   - What we know: All six are additive-optional and safe to add per the milestone's established pattern (Phase 35/42 precedent). `instructionVersion` only has a real source for prompt-version-related actions (`promptVersions.activate`) — most other reason-bearing actions (hold, keep-as-written, do-not-use) have no natural "instruction version" to attach.
   - What's unclear: whether `actorName` should be STORED (denormalized at write time) or resolved at READ time via the new `users` query — storing avoids a join but goes stale if a user's Clerk display name changes; resolving at read time is always current but requires the new query to succeed for every row.
   - Recommendation: Store only `reason`/`issueNumber`/`runId`/`instructionVersion` (write-time facts that don't change), and resolve `actorName`/`actorKind` at READ time in the `DecisionLog` component via the new `users` query + a small static system/agent-id label map — this avoids ever storing a name that can drift from the `users` table's current value, and matches D-12's own framing ("resolution is a rendering concern... the stored id is unchanged").

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (apps/dispatch-control), `vitest.config.ts` |
| Config file | `apps/dispatch-control/vitest.config.ts` |
| Quick run command | `pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts __tests__/Masthead.test.tsx` (or the new test file names once created) |
| Full suite command | `pnpm --filter dispatch-control test:unit` (also run `pnpm --filter dispatch-control typecheck` and `pnpm --filter dispatch-control build` before declaring the phase done — per project memory, `vitest` does not type-check) |

Convex-integration tests (anything touching `audit_log`/`users` schema/mutations directly via `convex-test`) MUST run in `edge-runtime`, registered in `vitest.config.ts`'s `environmentMatchGlobs` array (see existing entries for `auditLog.test.ts`, `issues.test.ts`, `claimChecksFactcheck.test.ts` — the exact same pattern applies to any new `audit_log`-schema-touching test file, e.g. `auditLogDecision.test.ts`). React component tests (`*.test.tsx`) need `jsdom`, already globally matched.

**Convex sync requirement:** Per project memory, committing `convex/*.ts` is NOT the same as deploying it. Any change to `convex/schema.ts` (new `audit_log` fields) or `convex/auditLog.ts`/`convex/users.ts` (new functions) MUST be followed by `pnpm --filter @eisenbalm/convex dev:once` (syncs to `dev:modest-magpie-797`) before the dashboard can call the new functions in a live/manual check — a prior phase (39) shipped a prod 500 by skipping this.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TSK-01 | `deriveTasks` still returns exactly open-claims+open-findings+missing-signoffs (no new source added) | unit | `pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts` | ✅ (extend existing `describe('deriveTasks ...')` block) |
| TSK-02 | Each `DerivedTask` (or its screen-level wrapper) carries a non-blank `age` string | unit | same file, new `describe('deriveTasks age (§43)')` | ❌ Wave 0 — new test cases in the existing file |
| TSK-03 | Claim task href resolves to `/issues/{n}/fact-check`; facts-signoff task href resolves to `/issues/{n}/approval` | unit | same file | ❌ Wave 0 — regression assertion for Pitfall 1's fix |
| TSK-04 | My Tasks screen renders explicit empty-state copy + Approval link when `deriveTasks(...).length === 0` | component (jsdom) | `pnpm --filter dispatch-control test:unit -- __tests__/MyTasksScreen.test.tsx` | ❌ Wave 0 |
| TSK-05 | A task whose section was rerolled (audit row `run.section_rerolled` newer than the task's row timestamp) renders as superseded, not silently dropped | unit | new pure predicate module test, e.g. `__tests__/taskSupersession.test.ts` | ❌ Wave 0 |
| TSK-06 | The shared decision-write helper produces a row `DecisionLog` can render with actor/action/time/reason/before-after/instructionVersion/issue/run | convex-test (edge-runtime) | `pnpm --filter dispatch-control test:unit -- __tests__/auditLogDecision.test.ts` | ❌ Wave 0 — register in `vitest.config.ts` `environmentMatchGlobs` |
| TSK-06 (retrofit) | Do-not-use now requires + stores a reason and writes an `audit_log` row | convex-test (edge-runtime) | extend/add a `charities.test.ts`-style file | ❌ Wave 0 — `charities.setStatus` currently has no test file at all (verify before assuming coverage) |

### Sampling Rate
- **Per task commit:** the specific new/modified test file(s) for that task.
- **Per wave merge:** `pnpm --filter dispatch-control test:unit` (full suite).
- **Phase gate:** full suite green + `typecheck` + `build` before `/gsd:verify-work` (per project memory: vitest alone missed 2 latent build-breaking bugs in Phase 27).

### Wave 0 Gaps
- [ ] `__tests__/MyTasksScreen.test.tsx` — new file, covers TSK-02/03/04
- [ ] `__tests__/taskSupersession.test.ts` — new file, covers TSK-05's predicate as a pure function (recommend extracting the predicate into its own small module, e.g. `lib/taskSupersession.ts`, so it's unit-testable without mounting the screen)
- [ ] `__tests__/auditLogDecision.test.ts` — new file, register `edge-runtime` in `vitest.config.ts`, covers TSK-06's shared helper + schema fields
- [ ] `__tests__/DecisionLog.test.tsx` — new file, covers the component's tolerant-rendering-of-legacy-rows requirement (D-10)
- [ ] Verify whether `convex/charities.ts` / `RegistryTable.tsx` have ANY existing test coverage before planning the Do-not-use retrofit — a quick `find`/`grep` at plan time (not found during this research pass) should precede writing that task's verification steps

## Sources

### Primary (HIGH confidence — direct file reads)
- `.planning/phases/43-my-tasks-decision-log/43-CONTEXT.md` — full locked-decision set, canonical refs, discretion areas
- `.planning/REQUIREMENTS.md` (lines 370-376, 820-825) — TSK-01..06 exact wording, traceability rows
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — §1-§3 (task derivation formula, header state systems), §7-§8 (run steps, inspector shape — for the boundary with Phase 44/50)
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — §Screen: My Tasks, §Decision & audit, §Issue Workspace, §State model, §Editorial Memory (Do-not-use spec)
- `apps/dispatch-control/lib/derivedState.ts` — full read, `deriveTasks`/`DerivedTask`/`isMustFix`/`SEVERITY_MINUTES`/`SEVERITY_ORDER`
- `apps/dispatch-control/components/Masthead.tsx` — full read, `DerivationInputs` assembly, `MyTasksTrigger`
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` + its test file — full read, confirmed separate-derivation + no-see-all-link findings
- `apps/dispatch-control/lib/nav.ts`, `apps/dispatch-control/lib/issueRouteResolver.ts` — full reads
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` — full read
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/{fact-check/FactCheckScreen.tsx, voice/{page,VoicePanelContent}.tsx, approval/{ApprovalStage,ApprovalPanelContent,page}.tsx}` — read to confirm which stage screens have live sign-off/claim-action wiring vs. read-only panels
- `convex/auditLog.ts`, `convex/schema.ts` (audit_log lines 265-277, users lines 234-245, claim_checks lines 431-459, qaCorrections lines 68-106), `convex/users.ts`, `convex/issues.ts` (hold/reopen), `convex/promptVersions.ts` (activate), `convex/charityCorrections.ts`, `convex/charities.ts` (setStatus), `convex/reviewActions.ts` — full/targeted reads
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` — read to confirm Do-not-use has no reason capture
- `apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx`, `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` — full reads
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` (`_emit_audit` lines 137-175, `rerun_agent` lines 468-594), `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` (keep-as-written flow, lines 242-390), `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` — targeted reads
- `docs/API_CONTRACTS.md` (§31.8 audit shape, §42.3-42.7 fact-check/claim contracts, explicit "the formal Decision Log component is Phase 43" note) — read to identify the exact amendment point
- `.planning/PROJECT.md` (Current Milestone section) — locked decisions, reconciliation facts
- `git log`/`git show` on `apps/dispatch-control/lib/derivedState.ts` — confirmed the href-retargeting commit history behind Pitfall 1
- `apps/dispatch-control/vitest.config.ts`, `apps/dispatch-control/__tests__/{derivedState,dispatch-control-no-sanity-write,auditLog}.test.ts` — confirmed test patterns/conventions

### Secondary / Tertiary
None — no WebSearch/Context7/external sources were needed or used; this phase's entire research surface is the existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no external library/framework decisions in this phase (pure internal projection work on the existing Next.js/Convex/FastAPI stack)
- Architecture: HIGH — every pattern cited is a direct file read with line numbers, not an inference
- Pitfalls: HIGH — all five are backed by direct code reads (three of them additionally by `git log`/`git show` history or full-file negative-search confirming absence of a claimed capability)

**Research date:** 2026-07-15
**Valid until:** Should be re-verified if Phase 44 (Inspect panel) or any Stage-1 work (Phases 46-47) lands before this phase is planned/executed — both touch adjacent files this research characterizes (`ClaimProvenanceCard.tsx`'s Inspect wiring, `audit_log` schema). Otherwise stable — this is a static snapshot of unchanging shipped code, not a fast-moving external dependency.
