---
phase: 43-my-tasks-decision-log
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
autonomous: true
requirements: [TSK-02, TSK-03, TSK-05, TSK-06]

must_haves:
  truths:
    - "docs/API_CONTRACTS.md has a new §43 section that fully specifies: the additive-optional audit_log decision fields, the shared decision-write helper (Convex writeDecision + record/write extension + pipeline _emit_audit kwargs), the reason-bearing decision projection query, the users actor-name read query, the derivedState openedAt/href corrections, and the audit-log cross-reference superseded predicate"
    - "The contract states the exact TSK-06 decision record (actor, action, time, reason, before/after, instructionVersion, issue, run) and which fields are stored at write-time vs resolved at read-time"
    - "The contract documents the two OVERRIDING research corrections: the claim/facts-signoff href retarget, and that Do-not-use has NO reason capture and NO audit row today (net-new work, not a promotion)"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§43 My Tasks & Decision Log contract (schema/helper/query/selector amendments), before any code"
      contains: "## §43"
  key_links:
    - from: "docs/API_CONTRACTS.md §43"
      to: "convex/schema.ts audit_log + convex/auditLog.ts + lib/derivedState.ts"
      via: "the contract every downstream plan implements verbatim"
      pattern: "writeDecision"
---

<objective>
Amend docs/API_CONTRACTS.md with a new §43 section that specifies the entire Phase 43 data contract BEFORE any code lands (CLAUDE.md contract-first hard rule / D-17, mirroring §31-§42). This is the single source of truth the six downstream implementation plans transcribe.

Purpose: Every schema change and shared helper in this phase must be pinned in the contract first so the additive-optional audit_log decision fields, the one shared decision-write helper, the decision projection query, and the derivedState corrections cannot drift between the Convex, console, and pipeline plans.
Output: docs/API_CONTRACTS.md §43 (additive; no existing field renamed or removed).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/43-my-tasks-decision-log/43-CONTEXT.md
@.planning/phases/43-my-tasks-decision-log/43-RESEARCH.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md

<interfaces>
<!-- Verified from the current repo tree. -->

docs/API_CONTRACTS.md TODAY:
  - Ends at §42 (Fact Check). §31.8 (line 2688) is the existing "Audit shape (D-09)" note for the pipeline _emit_audit path. §40.6 (line 4127) is the derivedState.ts contract.
  - Each §NN section ends with an "All Phase NN changes are additive" reconciliation paragraph — match that convention.

convex/schema.ts audit_log (lines 266-277) TODAY:
  { workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, timestamp }
  indexes: by_workspace, by_workspace_timestamp

convex/auditLog.ts TODAY:
  write (internalMutation), record (public mutation w/ pipelineSecret), listForWorkspace (query, newest-first). No structured decision fields, no decision-scoped query.

lib/derivedState.ts::deriveTasks TODAY (verified):
  - claim task primary.href = issueDraftHref(n)  -> MUST become issueFactCheckHref(n)
  - signoff-facts task primary.href = issueDraftHref(n) -> MUST become issueApprovalHref(n)
  - DerivedTask has NO age field. issueFactCheckHref/issueApprovalHref already exist in issueRouteResolver.ts.

Research corrections that OVERRIDE CONTEXT optimism (43-RESEARCH Pitfalls 1-3):
  1. TSK-03: claim/facts-signoff hrefs point at /draft today (git 14103b4), not the working /fact-check and /approval screens.
  2. TSK-05: rerun_agent (control.py:470-594) does NOT clear qaCorrections/claim_checks; the only queryable reroll signal is the audit_log row action:"run.section_rerolled", resourceId:"{runId}:{agentKey}".
  3. TSK-06: charities.setStatus has NO reason param and writes ZERO audit_log rows today — Do-not-use is net-new, not a promotion.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author §43 (My Tasks & Decision Log) in API_CONTRACTS.md</name>
  <files>docs/API_CONTRACTS.md</files>
  <read_first>
    - docs/API_CONTRACTS.md §31.8 (lines 2688-2698, the existing pipeline audit shape) and §40.6 (lines 4127-4218, the derivedState contract) and §42.7 (lines 4463-4482, the closing reconciliation-paragraph convention to mirror)
    - .planning/phases/43-my-tasks-decision-log/43-RESEARCH.md (Architecture Patterns §3, the two writer paths; Pitfalls 1-3; Open Question 3, the store-vs-resolve field decision)
    - .planning/phases/43-my-tasks-decision-log/43-CONTEXT.md (D-08..D-13, D-16, D-17)
    - convex/schema.ts (audit_log lines 266-277), convex/auditLog.ts (write/record/listForWorkspace)
  </read_first>
  <action>
Append a new `## §43 — My Tasks & Decision Log (Phase 43)` section at the END of docs/API_CONTRACTS.md (after §42), with these subsections. Write it as prose+code the way §40/§42 are written. No code is written in this plan — only the contract.

§43.1 — `audit_log` additive-optional decision fields (amends convex/schema.ts in place):
  Add four optional fields, additive-only (legacy rows omit them): `reason: v.optional(v.string())`, `issueNumber: v.optional(v.number())`, `runId: v.optional(v.string())`, `instructionVersion: v.optional(v.string())`. State explicitly: actor display name is NOT stored — it is resolved at read time (see §43.4), so no `actorName`/`actorKind` column is added (Open Question 3 recommendation: store write-time facts, resolve names at read). No new index required — decisions are read via the existing `by_workspace_timestamp` order then filtered.

§43.2 — Shared decision-write helper (the ONE helper D-11 mandates), two writer paths:
  - Convex-side: extend `auditLog.write` AND `auditLog.record` args additively with the four optional decision fields (forwarded into the insert only when provided), and add a new `internal.auditLog.writeDecision` internalMutation that all reason-requiring DASHBOARD mutations call — it wraps `write` and takes `{ workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, reason, issueNumber?, runId?, instructionVersion? }`.
  - Pipeline-side: extend `_emit_audit` (api/control.py:137-175) additively with optional kwargs `reason`, `issue_number`, `run_id`, `instruction_version`, each forwarded into the `auditLog:record` args dict only when non-None (mirrors the existing before/after optional-kwarg pattern documented in §31.8).
  Content-touching actions keep the dashboard → pipeline API → Convex/Sanity → audit_log write boundary (EDT-05); status-only dashboard actions call `writeDecision` directly (operator-guarded Convex mutation).

§43.3 — Decision projection query (D-09 — a projection, NOT a new store): add `auditLog.listDecisions({ workspace_id, runId?, issueNumber?, limit? })` returning the reason-bearing subset newest-first. Define the "is a decision" predicate: a row qualifies if it has the structured `reason` field OR its `after` JSON parses to an object containing a reason-like key (`reason`/`heldReason`) — so legacy reason-in-after rows (hold, activate-override) project as decisions BEFORE retrofit and after. Non-reason rows (`run.triggered`, `run.section_rerolled`) are excluded. When `runId`/`issueNumber` are given, scope to rows carrying the matching new field (falling back to workspace-wide for legacy rows that lack them). The raw Settings `AuditLogViewer` and `listForWorkspace` are UNCHANGED.

§43.4 — Actor-name resolution (D-12, read-time): add a `users` read query (`users.byClerkUserId({ clerkUserId })` or `users.listForWorkspace({ workspace_id })`) so the DecisionLog resolves a human `actorId` (Clerk sub) → `users.displayName`/`email`, and a system/agent id (`pipeline`, `cron`, an agent key, `system:*`) → a static display-name map. The stored `actorId` is never changed.

§43.5 — `lib/derivedState.ts` amendments (amends §40.6 in place — reference it):
  - Additive `openedAt?: number` on `DerivedTask` (raw ms timestamp), computed in `deriveTasks`: QA finding `timestamp`; claim `_creationTime` (mapped as `createdAt`); missing sign-off = run `startedAt` (new additive `runStartedAt?` / per-row `timestamp?`/`createdAt?` passthroughs on `DerivationInputs`). Relative age string is rendered by a pure `formatTaskAge(openedAt, now)`, NOT inside the pure selector.
  - HREF CORRECTIONS (Pitfall 1): claim task href → `issueFactCheckHref(n)`; `signoff-facts` task href → `issueApprovalHref(n)`. Note that `signoff-voice`'s target is verified against where the sounds-human sign-off control lives.

§43.6 — Superseded predicate (D-06/D-07, TSK-05, client-side, NO pipeline change — Pitfall 2 + Open Question 2): a screen-local `DisplayTask = DerivedTask & { sessionState: 'active'|'resolved'|'superseded'; supersededBy?: string }`. `superseded` when an `audit_log` row `action:"run.section_rerolled"`, `resourceId:"{runId}:{agentKey}"` has a `timestamp` newer than the task's `openedAt` (section vocab: `qaCorrections.sectionName` === agentKey; `claim_checks.sectionName` needs `qaSectionToGalleyId`). `resolved` = artifact reached a terminal state in-session (vanished from the projection without a matching reroll). Explicitly forbid adding `resolved`/`superseded`/`Done` to `TaskSeverity` (Pitfall 4 — closed exhaustive Record).

§43.7 — Do-not-use retrofit is NET-NEW (Pitfall 3): document that `charities.setStatus` today has no `reason` param and emits no audit row; Phase 43 adds a required reason for the blocklist transition + a `writeDecision` emission (`action: 'charity.blocklisted'`) + reason-capture UI — NOT a promotion of an existing reason.

Close with a reconciliation paragraph in the §42.7 style: "All Phase 43 changes are additive — audit_log gains four optional fields; auditLog gains writeDecision + listDecisions + record/write arg extensions; users gains one read query; _emit_audit gains four optional kwargs; derivedState gains openedAt + two href corrections; a new My Tasks screen, DecisionLog component, and taskSupersession module are introduced. No existing field is renamed or removed; the Settings AuditLogViewer and listForWorkspace are unchanged."
  </action>
  <verify>
    <automated>grep -nE "## §43|§43\.1|§43\.2|§43\.3|§43\.4|§43\.5|§43\.6|§43\.7" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "## §43" docs/API_CONTRACTS.md` matches exactly once
    - `grep -n "writeDecision" docs/API_CONTRACTS.md` matches (helper specified)
    - `grep -n "listDecisions" docs/API_CONTRACTS.md` matches (projection query specified)
    - `grep -n "run.section_rerolled" docs/API_CONTRACTS.md` matches (superseded predicate specified)
    - `grep -n "issueFactCheckHref\|issueApprovalHref" docs/API_CONTRACTS.md` matches (href correction specified)
    - `grep -n "charity.blocklisted" docs/API_CONTRACTS.md` matches (Do-not-use net-new specified)
    - `grep -niE "additive" docs/API_CONTRACTS.md | tail -1` shows the closing reconciliation paragraph exists
  </acceptance_criteria>
  <done>§43 fully specifies the schema fields, the two-path shared decision-write helper, the reason-bearing projection query, read-time actor resolution, the derivedState openedAt+href corrections, the superseded predicate, and the Do-not-use net-new retrofit — every downstream plan can implement verbatim.</done>
</task>

</tasks>

<verification>
- `git diff --stat docs/API_CONTRACTS.md` shows only additions (no §31-§42 lines removed).
- §43 is self-contained: a reader can build the audit_log fields, writeDecision, listDecisions, and the derivedState corrections from it alone.
</verification>

<success_criteria>
docs/API_CONTRACTS.md §43 exists and specifies all TSK-06 decision-record fields, the shared helper (both writer paths), the projection query, actor resolution, and the TSK-02/03/05 derivedState corrections — contract-first, before any code.
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-01-SUMMARY.md`.
</output>
