# Phase 43: My Tasks & Decision Log - Context

**Gathered:** 2026-07-15 (`--auto` mode — recommended defaults auto-selected; see DISCUSSION-LOG.md)
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables, both **read-side projections over substrate that already exists** — no new stores.

**(A) The My Tasks screen.** The `deriveTasks()` projection was already built in Phase 40 (`apps/dispatch-control/lib/derivedState.ts`) and is consumed today only as a **count** in the Masthead. Phase 43 builds the actual screen that renders that projection: a cross-issue "what needs me right now" list where every open claim, open finding, and missing sign-off appears as a derived task (TSK-01), each row showing plain-language title · issue/area affected · why human judgment is required · severity (Must fix / Review recommended / Information) · stage · age · the agent's recommendation when one exists (TSK-02), with a primary action that deep-links to the exact claim/passage/decision plus an "Inspect context" entry point (TSK-03), an explicit "Nothing needs you → Approval" empty state (TSK-04), and a "superseded" state for a task whose underlying step was restarted (TSK-05). The Masthead `My Tasks · N` readout and its dropdown already exist (Phase 40 D-25); this phase swaps the dropdown's "see all" target for the real screen and adds the nav item to the Editorial group (slot reserved by Phase 40 D-31).

**(B) The Decision Log.** One shared, human-readable component that projects the **reason-bearing subset** of the existing `audit_log` trail — recording actor (human *or* named agent), action, time, reason, before/after, instruction version, issue + run (TSK-06). It renders in the Approval context panel and as the persistent Issue Workspace "Decision log" control (a control the Phase 41 frame already lists). Phase 43 also ensures every **already-shipped** reason-requiring action writes a complete decision row via a shared helper.

**This is a projection + component phase, not a new-capability phase.** The task selector, the `audit_log` table, the sign-off / finding / claim substrate, and the Masthead readouts all exist. Phase 43 turns them into two operator surfaces.

**Not in this phase (deferred):**
- **Stage-1 reason-requiring actions** — "remove a lead" and the org-selection "override a recommendation" live on Stage 1, which does not exist until Phases 46–47. Phase 43 defines the decision shape + shared helper so those phases plug in; it does not reach into unbuilt Stage 1.
- **The 7-tab "Inspect how this was made" panel** — Phase 44. Phase 43 wires the "Inspect context" *entry point* on each task (mirroring how Phase 42 shipped an Inspect entry point without the panel); the panel itself is Phase 44.
- **Role/permission gating** (Collaborator read-only, locked-control rendering) — Phase 49. Phase 43 builds the screen and controls for the editor and structures them so §6 gating wraps them; it does not hide or lock controls.
- **Console-wide nomenclature ripple** — Phase 50.

</domain>

<decisions>
## Implementation Decisions

*(All eight gray areas were auto-selected under `--auto`; each resolved to its recommended default. Rationale + alternatives in DISCUSSION-LOG.md.)*

### A. The My Tasks projection — reuse Phase 40's selector (TSK-01, TSK-02)

- **D-01: Reuse the existing `deriveTasks()` selector as-is; do NOT add a tasks table and do NOT fork a second projection.** `apps/dispatch-control/lib/derivedState.ts::deriveTasks(DerivationInputs)` already emits the DERIVED-STATE-CONTRACT §2 `DerivedTask` shape (`id, sev, title, where, why, rec?, primary{label,href}, insp?, stage`) over open QA findings, open claims, and missing sign-offs, already severity-sorted. The screen assembles the **exact same `DerivationInputs`** the Masthead already builds (`components/Masthead.tsx` lines ~200-232 are the reference assembly) — same Convex queries, zero new subscriptions. "Superseded needs no lifecycle — a restarted step re-derives" (§2) is honored by construction.
- **D-02: Extend the selector output ONLY additively, and only for fields the count-only Masthead caller didn't need.** The screen needs **age** (TSK-02), which `DerivedTask` does not yet carry. Add an `age`/`openedAt` source derived from the underlying artifact's timestamp: QA finding `_creationTime`, claim `_creationTime`/`checkedAt`, and for a missing sign-off, "since run start / since the stage became reachable." Rendered as relative age ("2h ago"). This is an additive field on `DerivedTask` + a pure computation in the selector — no new data source. The existing `insp?` field is populated as the Phase 44 inspector key; Phase 43 only wires the entry point (D-11).
- **D-03: Severity, ordering, and grouping follow the selector and the state model verbatim.** Severity tiers are Must fix / Review recommended / Information (`TaskSeverity`), already derived (finding severity → task severity; `isMustFix` for claims; missing sign-offs = must-fix). Order = severity-first then stage (the selector's existing sort). Every row carries **label + icon, never color alone** (State & Icon Contract §Attention). The screen may visually group by severity but must not re-invent the severity math — it shares `isMustFix` and `findingSeverityToTaskSeverity` from the selector so My Tasks, the stage badges, and the Stage-3 summary can never silently disagree (the Phase 42 D-16 anti-drift rule, extended).

### B. Projection scope — issue-scoped, matching the locked source set (TSK-01)

- **D-04: My Tasks projects over exactly the three sources TSK-01 names — open claims, open findings, missing sign-offs — for the current issue's run.** It does NOT introduce system/Workbench task sources (failed-run recovery, eval regressions) this phase. The Annotations' "stage or **Workbench area**" is honored by *labeling* each task's `where`, not by projecting new sources. System-level recovery tasks live on Run Details (Phase 50). The selector already reads exactly this source set; keep it.
- **D-05: The screen is cross-issue-capable in structure but scoped to the in-progress issue in practice.** Today there is one active run/issue at a time (Masthead resolves `runs.latest`). The screen assembles tasks for the current issue's run — the same single-run scope the Masthead uses. If a future multi-issue-in-flight reality arrives it becomes a loop over issues; do not pre-build that. TSK-01's "regardless of where it came from" is satisfied by spanning all five stages of the current issue, which the selector already does.

### C. "Superseded" tasks — session-diff, never a store (TSK-05)

- **D-06: Detect supersession at the client/session level, not with a stored task lifecycle.** Because tasks are a pure re-derivation, a restarted step's task simply disappears on the next render. TSK-05 forbids that silent disappearance. Recommended mechanism: the screen keeps an **in-session snapshot** of the task set it last showed; when a task id vanishes *because the underlying run/step identity changed* (a restart), render it struck-through as **"superseded"** with a link to the new step/stage, rather than dropping it. No tasks table, no new Convex store — this is client/session memory only (mirrors the "resolved just now" in-session behavior below).
- **D-07: Distinguish "superseded" from "resolved."** A task that vanished because its underlying artifact reached a terminal state (claim checked, finding resolved, sign-off signed) is **resolved**: render struck-through with "resolved just now" (`sev: 'Done'`, `age: 'resolved just now'`, per §2) for the session, then fall out. A task that vanished because its run/step was restarted is **superseded**: struck-through + link to the new step. The discriminator is whether the underlying run/step identity changed vs the artifact terminating. **Exact detection predicate is planning/research discretion**, bounded by two hard rules: (1) a task never disappears silently (TSK-05), and (2) no tasks table (§2).

### D. The Decision Log component — new, human-readable, distinct from the raw audit viewer (TSK-06)

- **D-08: Build a NEW purpose-built `DecisionLog` component; do NOT generalize the existing `AuditLogViewer`.** `settings/_components/AuditLogViewer.tsx` is a raw technical table (actorId, action, resourceType, before/after as collapsed JSON) — the developer's view of the *entire* `audit_log`. It stays as the Settings audit view, unchanged. The Decision Log is a different surface: **human-readable, reason-first, actor-as-name, issue-scoped**, showing only reason-bearing *decisions* (not every mutation). One component (e.g. `apps/dispatch-control/components/decision-log/DecisionLog.tsx`), used in two places per the spec: the **Approval context panel** and the persistent Issue Workspace **"Decision log"** control (Phase 41 frame lists it).
- **D-09: The Decision Log is a curated PROJECTION over the same `audit_log` trail — no separate decision store** (Phase 42 D-18 locked this: "Phase 43 builds the shared Decision Log as a projection over this same trail — do NOT build a separate decision store"). A row qualifies as a *decision* (vs a plain audit row like `run.triggered`) by the presence of a **`reason`** (or an explicit `decisionKind` marker) — that is the projection's filter. A new issue/run-scoped query (or a client-side filter over `listForWorkspace`) returns the reason-bearing subset newest-first.

### E. Decision-row shape — additive-optional fields + a shared write helper (TSK-06)

- **D-10: Extend `audit_log` with additive-optional structured decision fields** so decisions render cleanly and are issue-scopable, following the milestone's additive-optional schema-evolution pattern (every Phase 35/42 field is `v.optional`). Recommended fields: `reason: v.optional(v.string())`, `issueNumber: v.optional(v.number())`, `runId: v.optional(v.string())`, `instructionVersion: v.optional(v.string())`, and an actor **display** hint (`actorName`/`actorKind`) so a **named agent** vs a **human** renders correctly (TSK-06 requires "actor (human or named agent)"). Existing `action`, `before`, `after`, `timestamp`, `actorId` are reused. Legacy rows omit the new fields and the projection renders them tolerantly (reason parsed from `after` JSON as a fallback; a missing field renders explicitly — the "blank never means verified" honesty rule extended to the log). **Whether to add all these fields or a subset is planning discretion**, bounded by: the Decision Log must be able to show the full TSK-06 record (actor, action, time, reason, before/after, instruction version, issue, run) for rows produced going forward.
- **D-11: Add ONE shared decision-write helper that all reason-requiring actions call**, so the TSK-06 record shape is produced identically everywhere and future phases inherit it by construction. It wraps the existing `auditLog.write` (internal) / `auditLog.record` (pipeline HTTP) emission with the structured decision fields. Console actions keep going through the **dashboard → pipeline API → Convex/Sanity → `audit_log`** write boundary (EDT-05); pipeline-side actions use `auditLog.record`. Contract-first: amend `docs/API_CONTRACTS.md` for the extended `audit_log` shape + the decision-write contract BEFORE code (the established Ph35/38/39/42 pattern).
- **D-12: Actor rendering resolves `actorId` → display name.** Human `actorId` (Clerk sub) → user's name via the `users` table (`clerkUserId → name`); a named-agent/system id (`pipeline`, an agent key, `cron`, `system:*`) → the agent/system display name. This makes the Annotations' "actor (human or named agent)" literal. Resolution is a rendering concern in the component; the stored id is unchanged.

### F. Retrofit scope — wire shipped actions now; unbuilt ones inherit the shape (TSK-06)

- **D-13: Route every ALREADY-SHIPPED reason-requiring action through the D-11 helper to emit a complete decision row:** Keep as written (Phase 42 fact-check), Hold issue (Phase 40 `HoldDialog`, already writes a required reason to `audit_log` — Phase 40 D-16 called this "the record Phase 43's Decision log reads back"), Activate-with-regression / override-with-reason (Phase 38, `promptVersions` already stores `reason` in `after`), Do-not-use (Phase 26/34 charity/publish flows), and any override-a-recommendation surface that exists today. Where a row already writes a reason (e.g. hold, activate-override), the retrofit promotes that reason from `after`-JSON into the structured field so the Decision Log renders it uniformly.
- **D-14: The two Stage-1 actions are OUT OF SCOPE.** "Remove a lead — add reason" and the org-selection "override the agent editor's recommendation" belong to Stages 1's leads/orgs, which do not exist until Phases 46–47. Phase 43 ships the shape + helper; those phases call it. TSK-06's "every reason-requiring action **console-wide**" is satisfied as **contract + shared helper + retrofit of all shipped actions**, with unbuilt actions inheriting it — not by building Stage 1 early.

### G. Nav, routing, and the Masthead handoff

- **D-15: Add a `/my-tasks` route and a "My Tasks" nav item in the Editorial group** (`apps/dispatch-control/lib/nav.ts` — the slot is reserved with a `Phase 43` comment). The Masthead `My Tasks · N` readout and its `AwaitingYouInbox` dropdown already exist (Phase 40 D-25); Phase 43 points the dropdown's "see all / open" at the new screen. No dead button, no capability lost — the count stays live off `deriveTasks(...).length` exactly as today.
- **D-16: Deep links use the existing issue-keyed route resolvers.** Task `primary.href` already resolves via `issueDraftHref` / `issueVoiceHref` (used inside the selector). The screen adds no new URL scheme; per-stage deep links (`/issues/[n]/draft`, `/fact-check`, `/voice`, `/approval`) are the ones Phase 40 D-06 made linkable. "Inspect context" links to the Phase 44 inspector entry point (D-11 above / §8 `sectionName → writer → agent_runs`).

### H. Cross-cutting discipline

- **D-17: Contract-first.** Amend `docs/API_CONTRACTS.md` with the extended `audit_log` shape, the decision-write helper contract, and any new decision-log query BEFORE writing code.
- **D-18: Reuse, do not rebuild.** Consume `lib/derivedState.ts::deriveTasks` (My Tasks projection), the Masthead's `DerivationInputs` assembly, `convex/auditLog.ts` (`write`/`record`/`listForWorkspace`), the existing per-action reason capture (hold, keep-as-written, activate-override), and the `content.py`/`_emit_audit` write-boundary pattern. Net-new is small: the My Tasks screen, the `age`/superseded additions, the `DecisionLog` component + its projection query, the additive `audit_log` fields, and the shared decision-write helper.
- **D-19: Every state renders label + icon, never color alone** (design-system rule) — the task severities, the empty/superseded/resolved states, and the decision-log entries all follow it.

### Claude's Discretion
- Exact age formatting and whether tasks are visually grouped by severity or shown as one sorted list (D-03, D-02).
- The precise superseded-vs-resolved detection predicate and the session-snapshot mechanism (D-06, D-07), bounded by "never disappears silently" + "no tasks table."
- Which subset of `{reason, issueNumber, runId, instructionVersion, actorName, actorKind}` to add to `audit_log` and whether a `decisionKind` marker is worth a field vs deriving decision-hood from `reason` presence (D-09, D-10).
- The Decision Log component's file location, whether the projection is a new Convex query or a client filter over `listForWorkspace`, and issue-scoping via `runId`/`issueNumber` vs `resourceType='run'` join (D-08, D-09).
- Copy for the empty state ("Nothing needs you" + Approval pointer), the superseded/resolved labels, and the decision-log row layout.
- Whether the "Inspect context" control is a visible-but-inert stub or a link to a Phase-44 placeholder route (D-16) — match how Phase 42 shipped its Inspect entry point.

### Folded Todos
None — `todo match-phase 43` returned no matches (the multi-milestone CLI quirk applies; no relevant todos surfaced).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (v4.0 milestone)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§2** (My Tasks is DERIVED — `taskCount` formula, "do not add a tasks table," each task's `sev/title/where/why/rec/primary/insp` shape, "superseded needs no lifecycle," resolved-struck-through-then-falls-out), **§1** (the four booleans + `ready = factDone && voiceDone` — what missing sign-offs project as tasks), **§3** (the header's four separated state systems — the My Tasks count readout is one), **§6** (role gating — Collaborator read-only; Phase 49 renders locked, but structure the screen/controls for it).
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — **§Screen: My Tasks** (the full row spec: title · issue/area · why · severity · stage/Workbench area · age · recommendation · primary action · "Inspect context"; empty state → Approval; superseded on restart; Collaborator read-only + comment; resolved-stays-then-archives-to-decision-log), **§Decision & audit** (the reason-requiring action list + the one Decision log component recording actor/action/time/reason/before-after/instruction-version/issue+run; "Approval context panel shows it"), **§Issue Workspace (shared frame)** ("Decision log" as a persistent control), **§State model (as implemented)** (Attention tier = Must fix / Review recommended / Information; label+icon never color alone), **header** demo path (My Tasks → Fact Check claim detail → Ask agent for better evidence → …).
- `docs/design/dispatch-control-v3/README.md` — milestone locked decisions + color semantics (every state label + icon, never color alone).

### Contracts & schema
- `docs/API_CONTRACTS.md` — the `audit_log` shape + `auditLog.write`/`record`/`listForWorkspace` contracts; the EDT-05 write boundary (dashboard → pipeline API → Convex/Sanity → `audit_log`) and the `dispatch-control-no-sanity-write.test.ts` source-scan tripwire. **Amend BEFORE code (D-17)** with the extended `audit_log` decision fields + the shared decision-write helper contract + any new decision-log query.
- `convex/schema.ts` — `audit_log` table (lines 265-277: `workspace_id, actorId, action, resourceType, resourceId, before, after, timestamp` + `by_workspace` / `by_workspace_timestamp` indexes). Add additive-optional decision fields here (D-10).
- `convex/auditLog.ts` — `write` (internal), `record` (public/pipeline HTTP, `requirePipelineSecret`), `listForWorkspace` (newest-first query). The read/write substrate the Decision Log projects over and the helper wraps.

### The projection this phase renders (already built)
- `apps/dispatch-control/lib/derivedState.ts` — **`deriveTasks(DerivationInputs)`** (lines ~352-441, the DERIVED-STATE-CONTRACT §2 projection Phase 43 renders as a screen), `DerivedTask` / `TaskSeverity` / `DerivationInputs` types, `isMustFix`, `findingSeverityToTaskSeverity`, `SEVERITY_MINUTES`/`estimateWorkMinutes`, and the `SEVERITY_ORDER` sort. Extend additively for `age` (D-02); do not fork.
- `apps/dispatch-control/components/Masthead.tsx` — the reference `DerivationInputs` assembly (the exact Convex queries: `runs.latest`, `issues.byIssueNumber`, `signOffs.activeByRunId`, `claimChecks.listByRunId`, `qaCorrections.byRunId`, `pitchLog.byRunId`), the `MyTasksTrigger` readout, and the `AwaitingYouInbox` dropdown the screen becomes the "see all" target of (D-15).
- `apps/dispatch-control/lib/nav.ts` — the Editorial nav group with the reserved "My Tasks joins this group in Phase 43" comment (D-15).

### Existing reason-capture call sites to route through the shared helper (D-13)
- `apps/dispatch-control/app/(dashboard)/issues/_components/HoldDialog.tsx` + `convex/issues.ts` (hold reason → `audit_log`, Phase 40 D-16).
- `convex/promptVersions.ts` (activate-with-regression override reason, lines ~273/294/354 — reason currently in `after` JSON).
- The Phase 42 fact-check "Keep as written — add reason" action (`api/factcheck.py` / `api/content.py` + `convex/claimChecks.ts`).
- Do-not-use / charity-corrections flows (`convex/reviewActions.ts`, `__tests__/charityCorrections.test.ts`).

### The raw audit viewer to leave UNCHANGED (D-08)
- `apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx` — the technical Settings audit table; the Decision Log is a NEW sibling, not a refactor of this.

### Project constraints
- `.planning/PROJECT.md` §Current Milestone — locked decisions + reconciliation facts (write boundary; RBAC unbuilt → Phase 49; DO NOT REBUILD the design system; "My Tasks — a derived projection … Not a new table (see DERIVED-STATE-CONTRACT §2)").

### Prior-phase context this phase builds on
- `.planning/phases/40-issue-entity-issues-home/40-CONTEXT.md` — **D-21** (My Tasks projection built here, rendered as a count), **D-23** (the pure selector module), **D-25** (the Awaiting-you inbox → My Tasks readout; "Phase 43 swaps the dropdown's target for the real screen"), **D-16** (hold reason → `audit_log`, the record the Decision log reads back), **D-18** (issue-status derivation the screen's context shares), **D-31** (nav restructure reserving the My Tasks slot).
- `.planning/phases/42-fact-check-stage/42-CONTEXT.md` — **D-16** (all four surfaces are derived selectors — one mutation propagates via reactivity, so My Tasks needs no fan-out wiring), **D-18** (the Decision Log is a projection over `audit_log`; no separate decision store — the locked constraint for this phase), **D-11** (structure controls for Phase 49 §6 role-gating).
- `.planning/phases/41-issue-workspace-frame/41-CONTEXT.md` — the Issue Workspace frame's persistent "Decision log" control + the shared context panel the Approval-panel Decision Log renders into.

</canonical_refs>

<code_context>
## Existing Code Insights

*(Console: `apps/dispatch-control/`, Next.js App Router, route group `app/(dashboard)/`. Convex: `convex/`. Pipeline: `packages/pipeline/src/eisenbalm_pipeline/`. Confirmed via codebase scan 2026-07-15.)*

### Reusable Assets
- **`lib/derivedState.ts::deriveTasks`** — the My Tasks projection, ALREADY BUILT and matching DERIVED-STATE-CONTRACT §2. Returns severity-sorted `DerivedTask[]` over open QA findings (stages 2/4), open claims (stage 3), and missing `facts-cleared`/`sounds-human` sign-offs (stage 5). Phase 43 renders it; extends only `age` additively.
- **`components/Masthead.tsx`** — the reference `DerivationInputs` assembly + the live `deriveTasks(...).length` count + the `MyTasksTrigger` readout + the `AwaitingYouInbox` dropdown. The screen reuses this exact assembly (no new subscriptions).
- **`convex/auditLog.ts`** — `write` (internal, from other mutations), `record` (public, pipeline HTTP via `requirePipelineSecret`), `listForWorkspace` (newest-first, `by_workspace_timestamp`). The Decision Log projects over this; the shared helper wraps `write`/`record`.
- **`convex/schema.ts` `audit_log`** (265-277) — `actorId/action/resourceType/resourceId/before/after/timestamp`. Additive-optional decision fields slot in like every Phase 35/42 field.
- **Existing reason capture** — `HoldDialog.tsx`+`issues.ts` (hold), `promptVersions.ts` (activate override), Phase 42 keep-as-written, `reviewActions.ts` (Do-not-use). Each already writes a reason somewhere; D-13 routes them through the shared helper to unify the shape.
- **`AuditLogViewer.tsx`** — the raw technical Settings audit table; leave unchanged, build the Decision Log as a distinct human-readable sibling.
- **`lib/issueRouteResolver.ts`** (`issueDraftHref`/`issueVoiceHref`) — the deep-link resolvers the tasks already use.

### Established Patterns
- **Derived over stored:** counters, tasks, issue status, stage states, fact-check summary are all pure selectors over Convex data (Phase 40/42). My Tasks is the canonical example — a screen over a selector, no store.
- **Additive-optional schema evolution:** every provenance/fact-check field is `v.optional`; legacy rows omit them and render an explicit non-blank state. The `audit_log` decision fields follow suit.
- **Write boundary + audit:** dashboard → pipeline API (`_require_clerk_jwt_control`) → Convex/Sanity, one truncated `audit_log` row per mutation; `dispatch-control-no-sanity-write.test.ts` forbids direct console→Sanity writes.
- **Contract-first:** amend `docs/API_CONTRACTS.md` before code.
- **Anti-drift:** My Tasks, stage badges, and the Stage-3 summary share the SAME severity predicates (`isMustFix`) so they cannot disagree (Phase 42 D-16).

### Integration Points
- **`app/(dashboard)/my-tasks/`** (new route) — the screen; assembles `DerivationInputs` + renders `deriveTasks`.
- **`lib/derivedState.ts`** — additive `age` field on `DerivedTask` + the superseded/resolved session logic lives in the screen (client), not the selector.
- **`lib/nav.ts`** — add the Editorial "My Tasks" item (reserved slot).
- **`components/Masthead.tsx`** — point the inbox dropdown "see all" at `/my-tasks`.
- **`components/decision-log/DecisionLog.tsx`** (new) — the shared component; mounted in the Approval context panel + the Issue Workspace "Decision log" control.
- **`convex/schema.ts` + `convex/auditLog.ts`** — additive decision fields + the shared write helper + (optionally) an issue/run-scoped decision query.
- **`docs/API_CONTRACTS.md`** — extended `audit_log` shape + decision-write contract.

### Watch-items (net-new inside a projection-reuse phase)
1. **Do NOT add a tasks table** — the whole design rests on My Tasks being a re-derivation (§2). Superseded/resolved are session-level, not stored.
2. **Do NOT generalize `AuditLogViewer`** — the Decision Log is a distinct human-readable, reason-first, issue-scoped surface; the raw viewer stays in Settings.
3. **Decision-hood is a filter, not a new store** — the Decision Log shows only reason-bearing `audit_log` rows; do not create a parallel decision table (Phase 42 D-18).
4. **Legacy `audit_log` rows must render tolerantly** — additive fields are optional; missing values render explicitly ("blank never means verified" extended to the log), reason falls back to parsing `after` JSON.
5. **Stage-1 reason actions are Phases 46–47** — ship the shape + helper, don't reach into unbuilt Stage 1.

</code_context>

<specifics>
## Specific Ideas

- The load-bearing user question My Tasks answers (Annotations §Screen: My Tasks): **"what needs me right now, regardless of where it came from?"** — a cross-stage list, not a per-screen to-do. The empty state is a *designed* state: explicit "Nothing needs you" pointing to Approval, never a bare empty list (TSK-04).
- The Decision Log is the same **one component everywhere** (Annotations §Decision & audit): the Approval context panel shows it, and the Issue Workspace lists it as a persistent control. Actor is rendered as a **name** — human or named agent — not a Clerk id (TSK-06).
- "Resolved" tasks stay visible struck-through ("resolved just now") for the session and then **archive to the decision log** (Annotations §After action) — the two deliverables connect: a resolved task's reasoned action is exactly a Decision Log entry.

</specifics>

<deferred>
## Deferred Ideas

- **Stage-1 reason-requiring actions** (remove a lead, override the org recommendation) — Phases 46–47 call the Phase 43 shared helper; not built here.
- **The 7-tab "Inspect how this was made" panel** — Phase 44 (Phase 43 wires the "Inspect context" entry point only).
- **Role/permission gating** (Collaborator read-only, locked-control rendering) — Phase 49 (Phase 43 builds for the editor + structures controls for §6 wrapping).
- **System/Workbench task sources in My Tasks** (failed-run recovery, eval regressions) — deferred; My Tasks stays scoped to open claims/findings/sign-offs (TSK-01). Failed-run recovery lives on Run Details (Phase 50).
- **Multi-issue-in-flight My Tasks** — the screen is structured to loop over issues but scopes to the current issue's run in practice (one active run today, D-05).
- **Console-wide nomenclature ripple** — Phase 50.

### Reviewed Todos (not folded)
None — `todo match-phase 43` surfaced no relevant todos.

</deferred>

---

*Phase: 43-my-tasks-decision-log*
*Context gathered: 2026-07-15*
