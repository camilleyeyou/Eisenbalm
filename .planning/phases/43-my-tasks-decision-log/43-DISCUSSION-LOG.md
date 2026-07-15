# Phase 43: My Tasks & Decision Log - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 43-my-tasks-decision-log
**Mode:** discuss (`--auto` — all gray areas auto-selected; recommended default chosen per area)
**Areas discussed:** My Tasks projection strategy, Projection scope, Superseded handling, Decision Log component strategy, Decision-row data shape, Retrofit scope, Nav/routing/actor-name, Age & ordering

---

## Note on the CLI quirk

`init phase-op 43` reported `phase_found: false` — the known multi-milestone ROADMAP.md quirk for v4.0 phases 40–50 (memory: "Roadmap multi-milestone CLI quirk"). Phase 43 was read directly from the `### Phase 43:` block (ROADMAP.md L936) and its requirements TSK-01..TSK-06 from REQUIREMENTS.md L370-376. Phase dir created manually as `43-my-tasks-decision-log`.

## Pre-analysis finding that shaped every area

`apps/dispatch-control/lib/derivedState.ts::deriveTasks()` **already implements the My Tasks projection** (built Phase 40, DERIVED-STATE-CONTRACT §2), and the Masthead already renders it as a live count. So Phase 43 is a **screen + component** phase over existing substrate, not a new-projection phase. This reframed the gray areas from "how to build the projection" to "how to render it and how to build the Decision Log."

---

## My Tasks projection strategy (D-01, D-02, D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `deriveTasks` as-is, extend additively for `age` | Render the shipped selector; add only the fields the count-only caller lacked | ✓ |
| Fork a new richer projection for the screen | Build a screen-specific task builder | |
| Add a tasks table to persist richer task metadata | Store tasks so age/superseded are queryable | |

**Choice:** Reuse + additive `age`. **Rationale:** §2 forbids a tasks table; the selector already emits the exact §2 shape and is severity-sorted; reusing it keeps My Tasks, the Masthead count, the stage badges, and the Stage-3 summary from ever disagreeing (shared `isMustFix`). Age is the only genuinely missing TSK-02 field.

## Projection scope (D-04, D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Issue-scoped: open claims/findings/sign-offs only | Exactly TSK-01's source set; label `where` for Workbench-area tasks | ✓ |
| Add system/Workbench sources (failed runs, eval regressions) | Project recovery + eval tasks too | |

**Choice:** Issue-scoped. **Rationale:** TSK-01 locks the source set to "open claims, open findings, missing sign-offs"; the selector already reads exactly this; Workbench/system tasks (failed-run recovery) live on Run Details (Phase 50). "Workbench area" is honored via the task's `where` label, not new sources.

## Superseded handling (D-06, D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Client/session snapshot diff | Screen remembers last-shown task set; a task that vanishes due to a run/step restart renders "superseded" + link | ✓ |
| Stored task lifecycle with a superseded status | Persist tasks so supersession is a state transition | |
| Ignore — let the re-derivation drop it | Simplest; violates TSK-05 | |

**Choice:** Session-diff. **Rationale:** §2 says "superseded needs no lifecycle — a restarted step re-derives," but TSK-05 forbids *silent* disappearance. Session memory (no store) reconciles both: distinguish resolved (artifact terminated → struck-through "resolved just now" → falls out) from superseded (run/step identity changed → struck-through + link to new step). Exact predicate left to research.

## Decision Log component strategy (D-08, D-09)

| Option | Description | Selected |
|--------|-------------|----------|
| New human-readable `DecisionLog`, projection over reason-bearing `audit_log` | Distinct from the raw Settings audit table | ✓ |
| Generalize/rename the existing `AuditLogViewer` | One component for both raw audit + decisions | |
| New `decisions` store + component | Separate decision table | |

**Choice:** New component, projection over `audit_log`. **Rationale:** `AuditLogViewer` is a raw JSON developer table (all mutations) — the Decision Log is human-readable, reason-first, actor-as-name, issue-scoped, showing only reasoned decisions; different audience, different surface. Phase 42 D-18 explicitly locked "projection over the same trail — no separate decision store."

## Decision-row data shape (D-10, D-11, D-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Add additive-optional decision fields + shared write helper; tolerant projection for legacy rows | `reason`/`issueNumber`/`runId`/`instructionVersion`/actor-name optional on `audit_log`; one helper all actions call | ✓ |
| Parse everything out of existing `action`/`before`/`after` JSON only | No schema change; projection reverse-engineers reasons | |
| Require the full shape (breaking) on every row | Non-optional fields | |

**Choice:** Additive-optional fields + shared helper, tolerant legacy rendering. **Rationale:** matches the milestone's additive-optional evolution pattern (every Phase 35/42 field is `v.optional`); the helper makes the TSK-06 record identical everywhere so future phases inherit it; legacy rows render tolerantly (reason falls back to `after` JSON; missing fields render explicitly, never blank). Actor resolves id → display name (human or named agent) at render time.

## Retrofit scope (D-13, D-14)

| Option | Description | Selected |
|--------|-------------|----------|
| Wire all SHIPPED reason actions now; Stage-1 actions inherit the shape later | keep-as-written, hold, activate-override, Do-not-use routed through the helper; remove-lead/override-rec are Phases 46-47 | ✓ |
| Wire everything including Stage-1 actions | Build Stage-1 reason capture early | |
| Read-side only; assume producers already write reasons | Build the projection, retrofit nothing | |

**Choice:** Retrofit shipped actions + define shape for unbuilt ones. **Rationale:** TSK-06's "console-wide" is satisfied as contract + shared helper + retrofit of all existing surfaces; Stage 1 (leads/orgs) does not exist until Phases 46–47, so those actions plug into the helper then — reaching into unbuilt Stage 1 would be scope creep.

## Nav, routing, actor-name (D-15, D-16, D-12)

| Option | Description | Selected |
|--------|-------------|----------|
| New `/my-tasks` route in Editorial nav; Masthead dropdown targets it; deep links reuse existing resolvers; actor id → name | Phase 40 reserved the slot + the inbox handoff | ✓ |
| Render My Tasks inside the issue workspace only (no top-level route) | | |

**Choice:** Top-level `/my-tasks` in Editorial. **Rationale:** Annotations lists My Tasks as a top-level Editorial nav item; Phase 40 D-31 reserved the nav slot and D-25 set up the inbox → screen handoff; deep links use the shipped `issueDraftHref`/`issueVoiceHref` resolvers.

## Age & ordering (D-02, D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Relative age from underlying artifact timestamp; severity-first then stage sort; label+icon | Age from finding/claim `_creationTime`, sign-off since run start; the selector's existing sort | ✓ |
| Absolute timestamps; custom ordering | | |

**Choice:** Relative age + selector's severity/stage sort. **Rationale:** TSK-02 requires age; the selector already sorts severity-first then stage; every state renders label + icon (never color alone).

## Claude's Discretion

- Age formatting; visual grouping vs single sorted list.
- Superseded-vs-resolved detection predicate + session-snapshot mechanism.
- Exact subset of decision fields to add + whether a `decisionKind` marker is worth a field.
- Decision Log file location; new Convex query vs client filter; issue-scoping join.
- Empty/superseded/resolved copy; decision-row layout.
- "Inspect context" as inert stub vs Phase-44 placeholder link (match Phase 42's Inspect entry point).

## Deferred Ideas

- Stage-1 reason actions (remove lead, override org rec) — Phases 46–47.
- The 7-tab Inspect panel — Phase 44.
- Role/permission gating — Phase 49.
- System/Workbench task sources in My Tasks — deferred (Run Details, Phase 50).
- Multi-issue-in-flight My Tasks — structured for it, scoped to current issue in practice.
- Console-wide nomenclature ripple — Phase 50.
