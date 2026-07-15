# Phase 44: Inspect How This Was Made - Context

**Gathered:** 2026-07-15 (`--auto` mode — recommended defaults auto-selected; see DISCUSSION-LOG.md)
**Status:** Ready for planning

<domain>
## Phase Boundary

One universal **"Inspect how this was made" side panel** with **seven tabs** (Summary, Inputs, Instructions, Output, Sources, Diagnostics, Technical), reachable from **six existing editorial surfaces** — the brief organization card, the draft passage toolbar, the fact-check claim detail, a voice finding, the approval recommendation, and My Tasks' "Inspect context" (INS-01). The panel resolves an `InspectorArtifact` (DERIVED-STATE-CONTRACT §8) from substrate **that already exists** and renders human-readable content first, with raw JSON never the default anywhere (INS-02). Its headline is the **missing-expected-inputs diff** (INS-03): declared template variables minus the keys actually supplied in the run's input payload — "the single highest-leverage item in the design" (§8, PROJECT.md line 24).

**This is a read-side projection + entry-point-wiring phase — no new pipeline behavior, no new stores.** Every tab draws from already-shipped tables and code constants:
- `agent_runs` (Phase 23) — status, cost, duration, tokens, error, retryCount → **Diagnostics** tab.
- `agent_run_payloads` (Phase 23, OBS-05) — `inputSnapshot` / `outputSnapshot` (JSON, truncated ~2000 chars) → **Inputs** / **Output** tabs.
- `prompt_versions` (Phase 24) — active version content + version number → **Instructions** tab.
- `VARIABLE_REGISTRY` + `VARIABLE_DESCRIPTIONS` (Phase 24/28, code constants) — the **declared** set for the missing-inputs diff.
- `PIPELINE_EDGES` / `pipelineTopology` (Phase 37) — prior & downstream steps.
- `claim_checks` / provenance (Phase 35/42) — the **Sources** tab.

Net-new is small: the panel component (7 tabs), one pure artifact→step resolver, the missing-inputs diff computation, and the six entry-point wirings.

**Anchoring granularity (locked by PROJECT.md + §8):** artifacts anchor to a **step, not a span** — section-level granularity, resolvable via `sectionName → writer → agent_runs`. No span-level provenance tracking is introduced.

**Not in this phase (deferred):**
- **The "Ask agent to revise" verb + comparison card** — Phase 45. The inspector footer *offers* it (INS-06 / criterion 6) as a visible-but-reserved control here, mirroring how Phases 42/43 shipped Inspect entry points as stubs before this panel existed. This phase does not build the revision flow.
- **Live `signal` (story leads) and `org` (organization selection) artifact data** — these steps do not exist in the pipeline until Phase 46 (Signal Editor + `verify_candidates`) and Phase 47 (Story & Brief). The inspector renders these artifact *types* structurally and **degrades gracefully** when the current run has no such step, never crashes.
- **Role/permission gating** (Collaborator read-only, locked-control rendering) — Phase 49. Phase 44 builds the panel for the editor and structures the footer controls so §6 gating can wrap them; it does not hide or lock controls.
- **Console-wide nomenclature ripple / Workbench rename** — Phase 50.

</domain>

<decisions>
## Implementation Decisions

*(All five gray areas were auto-selected under `--auto`; each resolved to its recommended default. Alternatives + rationale in DISCUSSION-LOG.md. `todo match-phase 44` returned zero matches — nothing folded.)*

### A. Artifact → step/agent resolution — one pure resolver, step-anchored (INS-01, §8)

- **D-01: Build ONE pure resolver module (e.g. `lib/inspectorArtifact.ts`) that maps an artifact key `{ type, runId, locator }` → an `InspectorArtifact`** assembled from existing Convex rows. It anchors to a **step** (an `agentKey` + its `agent_runs` / `agent_run_payloads` rows for the run), NOT to a span — section-level granularity is sufficient and is the locked design (PROJECT.md line 24, DERIVED-STATE-CONTRACT §8). No new store, no span-level tracking. The resolver is a selector over data the six callers already have in scope, mirroring the Phase 40/42/43 "derived over stored" discipline.
- **D-02: The six artifact types resolve to agentKeys as follows.** `founder` (a drafted section) → the section's writer agentKey via `sectionName → writer` (e.g. `origin_story`, `problem`, `founder_bio_*`, `case_study_*`, `game`, `design`, `bonus_*`); `claim` → the producing writer/researcher recorded on the `claim_checks` row (Phase 35/42 already carry `sectionName`/`agent`); `rec` (agent editor recommendation) → `editor_final`; `qa` → `qa`; `signal` (story leads) → `signal_editor`; `org` (organization selection) → `scout` / `editor_gate1`. Each then joins `agent_runs` + `agent_run_payloads` by `(runId, agentKey)`. **The exact `sectionName → writer agentKey` mapping table is planning/research discretion** (source it from the pipeline's section→writer wiring, not invented), bounded by: it must cover the six artifact types and degrade gracefully for `signal`/`org` when the run has no such step (Phases 46–47).
- **D-03: `signal` and `org` artifacts render structurally but degrade gracefully.** Until Phases 46–47 add the Signal Editor and Story & Brief stage, a run has no `signal_editor` step and no first-class `org` step, so those payload rows may be absent. The inspector renders the artifact type with explicit "not recorded in this run" states (the honesty rule below), never a blank and never a crash — exactly how `AgentIOPanel` already degrades for nodes with no snapshot.

### B. The missing-inputs diff (INS-03 — the headline) + truncation honesty

- **D-04: Compute `missing = declared − supplied`.** `declared` = the agent's full declared template-variable set — the **union** of `VARIABLE_REGISTRY[agentKey]` (system-prompt tokens) and `VARIABLE_REGISTRY[`{agentKey}`_user]` (user-template tokens) where the agent has both, since a writer's declared inputs span both templates (VariableRegistry.ts documents these as distinct token sets). `supplied` = the top-level keys parsed from `agent_run_payloads.inputSnapshot` JSON for `(runId, agentKey)`. Each missing variable renders **explicitly, with its `VARIABLE_DESCRIPTIONS` gloss** (Phase 28), so a bad sentence maps to a concrete prompt fix (the canonical `characterization_examples` example, §8 / Annotations §Inputs).
- **D-05 (non-negotiable watch-item): the input snapshot is truncated ~2000 chars server-side (Phase 23), so a naive key-parse can drop keys and falsely report a supplied key as "missing" — on the single highest-leverage diagnostic in the whole design.** Handle this honestly. **Recommended: the pipeline persists an untruncated top-level input KEY LIST** (keys only, not values — cheap and small) as an additive-optional field on `agent_run_payloads` (e.g. `inputKeys: v.optional(v.array(v.string()))`), and the diff is computed against that exact set. When `inputKeys` is absent (legacy rows), fall back to parsing the truncated `inputSnapshot` **and render an explicit "snapshot was truncated — this diff is approximate" note** so the panel never silently asserts a false "missing." The choice between persisting `inputKeys` vs a truncation-note-only fallback is bounded by one hard rule: **the diff must never assert a variable is missing when truncation could have hidden it.** This is a contract-first schema decision (§D-13).

### C. Panel shell — one shared instance, one opener, tab defaults (INS-01, INS-02)

- **D-06: ONE shared side-panel component + a single inspector context/provider** exposing `openInspector(artifactKey)` / `closeInspector()`. All six entry points call the same opener; exactly **one** panel instance is mounted (at the Issue Workspace frame level, alongside the Phase 41 context panel), never six copies. Right-side slide-over, reusing `AgentIOPanel`'s slide-over structure and its `summarize()` / `prettyJson()` helpers rather than reinventing them.
- **D-07: Seven tabs are client state; the default tab is Summary; Technical (raw JSON) is NEVER the default on any tab (INS-02).** Every tab leads with human-readable content; raw JSON lives behind a "Show raw JSON" toggle (the established `AgentIOPanel` pattern) and is the whole point of the Technical tab (copy/download), never a fallback for another tab. **Every field renders an explicit non-blank state when its source is absent** ("not recorded" / "no snapshot stored") — the milestone's "blank never means verified" honesty rule, extended to the inspector. Every state uses label + icon, never color alone.

### D. Footer actions — live deep-links vs reserved controls (INS-06, criterion 6)

- **D-08: The footer offers all six actions on every artifact type; wire the ones that target ALREADY-SHIPPED surfaces as live deep-links, render the rest as visible-but-reserved controls with an explanatory title** (matching how Phases 42/43 shipped Inspect entry points). Live now:
  - **Improve this agent →** → Agent Instructions / prompt-lab (Phase 24/28) for the resolved `agentKey`.
  - **Compare instruction versions** → the `prompt_versions` history surface (Phase 38 `VersionHistoryPanel`).
  - **Related quality tests** → the agent's eval scenarios (Phase 38 eval-center).
  - **Prior & downstream steps** → resolved from `PIPELINE_EDGES` (the `AgentIOPanel` upstream→downstream mechanism already does this).
  Reserved (rendered, explained, not wired into unbuilt work):
  - **Ask agent to revise** → Phase 45 (the revision verb + comparison card). Rendered as a reserved control with a "arrives in Phase 45" title.
  - **Restart from this step** → the pipeline interrupt/resume path (`POST /run/{id}/resume` exists for Gate 1; general step-restart semantics are Phase 44 discretion — wire it if the existing resume endpoint cleanly supports "restart from step," otherwise render reserved with a plain-language explanation). "Completed steps are reused, not re-paid" copy per §7.
- **D-09: The inspector performs no mutations.** It is a read-only panel (like `AgentIOPanel`); footer actions navigate or deep-link. Mutating verbs (Ask agent to revise → apply a content patch) belong to Phase 45 and are only *offered* here.

### E. Tab data sourcing — Instructions (INS-04) & Output divergence (INS-05)

- **D-10: Instructions tab (INS-04)** shows the exact **active** `prompt_versions` row for the `agentKey` (content + version number, via `promptVersions.getActive`), the **shared editorial rules** referenced (rubric / voice-constraints / shared-rule keys the agent uses, derivable from `VARIABLE_REGISTRY`), section guidance where applicable, and an **"Improve this agent →"** deep-link to Agent Instructions. Note: the *active* version is not necessarily the version that *produced* the artifact; render the active version per the spec, and where the producing version is recoverable, **note the divergence** rather than implying the shown instructions produced the output.
- **D-11: Output tab (INS-05)** shows the full human-readable output (from `agent_run_payloads.outputSnapshot`, with the truncation noted exactly as `AgentIOPanel` does) plus a **divergence note when the current issue text has since diverged from it.** Recommended detection: reuse the existing "changed since" signal — a content-patch applied to the section/claim after the run (the `founderApplied` / changed-since-check machinery Phases 42/43 already track) — and render the note when that signal is set. **Exact divergence-detection predicate is planning/research discretion**, bounded by: never assert "unchanged" when we cannot verify it (render "unknown whether this still matches the issue" rather than a false "current").

### F. Cross-cutting discipline

- **D-12: Reuse, do not rebuild.** Consume `agent_runs` + `agent_run_payloads` and their Convex queries (`agentRuns.byRunId`, `agentRuns.payloadByRunIdAgentKey`), `prompt_versions` (`promptVersions.getActive`), `VARIABLE_REGISTRY` + `VARIABLE_DESCRIPTIONS`, `PIPELINE_EDGES`, `AgentIOPanel`'s `summarize()`/`prettyJson()` helpers and slide-over pattern, `ClaimProvenanceCard`'s already-present `onInspect?` prop, and `MyTasksScreen`'s already-reserved "Inspect context" stub. The `ClaimProvenanceCard` is the same provenance component the Sources/claim view reuses (Phase 42 D-09 forbade three copies) — the inspector does not fork it.
- **D-13: Contract-first.** Amend `docs/API_CONTRACTS.md` with a **§44** capturing the `InspectorArtifact` shape (from DERIVED-STATE-CONTRACT §8), the artifact→step resolver contract, the missing-inputs diff computation, the additive `agent_run_payloads.inputKeys` field (D-05) if taken, and the shared `openInspector(artifactKey)` entry-point contract — BEFORE writing code (the established Phase 35/38/39/42/43 pattern). No direct console→Sanity writes; the panel is read-only so the EDT-05 write boundary is not exercised here.
- **D-14: Every state renders label + icon, never color alone** (design-system rule) — tab states, the missing-input flags, the divergence/truncation notes, and the degraded "not recorded" states all follow it.

### Claude's Discretion
- The exact `sectionName → writer agentKey` mapping table (D-02), sourced from the pipeline's real section→writer wiring, not invented.
- Whether to persist an additive `agent_run_payloads.inputKeys` field vs a truncation-note-only fallback for the missing-inputs diff (D-05) — bounded by "never falsely assert missing under truncation."
- The precise Output-divergence detection predicate and the Instructions producing-vs-active version note (D-10, D-11) — bounded by "never assert unchanged/current when unverifiable."
- Whether "Restart from this step" wires to the existing resume endpoint now or renders reserved (D-08).
- Panel styling within the 1c design system, tab iconography, keyboard/focus behavior, copy for the reserved-control titles and the empty/degraded states.
- The panel component file location and whether the inspector context lives at the Workspace-frame level or a higher app shell (bounded by "one instance, not six").

### Folded Todos
None — `todo match-phase 44` returned zero matches (the multi-milestone CLI quirk applies; no relevant todos surfaced).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (v4.0 milestone) — the inspector contract lives here
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§8 Inspector artifact contract** (THE spec: the six artifact types `founder`/`claim`/`rec`/`org`/`signal`/`qa`, the full `InspectorArtifact` interface — `title/meta/asked/result/confidence/warning/upstream/downstream/inputs/missing/instructionVersion/instructions/sectionGuidance/output/outputNote/sources/model/timing/cost/latency/validation/json` —, "anchors to a step, not a span," `sectionName → writer → agent_runs`, and `missing = declared template variables − keys actually supplied` as "the single highest-leverage item in the design"), **§7** (the 11 action-named run steps + step states — the artifact→step mapping and the "Restart from this step / completed steps reused, not re-paid" copy), **§9** (Ask agent to revise — the Phase 45 footer-action target this phase only *offers*), **§10** (known prototype bugs — the divergence/voice-revocation note the Output tab surfaces).
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — **§Inspect how this was made (universal)** (the seven tabs enumerated with their human-readable-first content + the footer's six actions + "Never the default anywhere" for Technical), **§Screen: Draft** / **§Fact Check** / **§Voice** / **§Approval** / **§Screen: My Tasks** (the six entry points and the exact toolbar/detail control each Inspect hangs off), **§System Workbench → Run Details** ("Selecting any step opens the same inspector used everywhere else"), **§State model** (label + icon never color alone).
- `docs/design/dispatch-control-v3/README.md` — milestone locked decisions + color/label semantics.

### Contracts & schema
- `docs/API_CONTRACTS.md` — **write a new §44** (D-13): the `InspectorArtifact` shape, the resolver contract, the missing-inputs diff, the additive `agent_run_payloads.inputKeys` field if taken, and the `openInspector(artifactKey)` opener contract. Forward-references already present: **line ~4148** (`insp?` field — "inspector target (Phase 44 consumes; may be omitted)"), **line ~4286 / ~4448** (the shared provenance card "reused across Draft/Approval/the inspector — do NOT fork three copies").
- `convex/schema.ts` — **`agent_runs`** (lines 345-361: status/costUsd/durationMs/tokensIn/tokensOut/error/retryCount + `by_runId`), **`agent_run_payloads`** (lines 363-372: `inputSnapshot`/`outputSnapshot` truncated ~2000 chars + `by_runId_agentKey`), **`prompt_versions`** (lines 302-315: agentKey/version/content/isActive). Any `inputKeys` field (D-05) slots in additive-optional, like every Phase 35/42 field.
- `convex/agentRuns.ts` — `byRunId` (line 221), `payloadByRunIdAgentKey` (line 237) — the reads the Inputs/Output/Diagnostics tabs project over.
- `convex/promptVersions.ts` — `getActive` (line 171) — the read the Instructions tab uses for the active version.

### Reusable code assets (the proto-inspector + the entry points already reserved)
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` — the Phase 23/37 handoff inspector: on-demand (non-subscribed) `agent_run_payloads` query, human-readable-first + raw-JSON-toggle, `summarize()`/`prettyJson()` helpers, cost/duration/token metrics block, graceful degradation for no-snapshot nodes, and the upstream→downstream resolution the "Prior & downstream steps" footer action reuses.
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` — `PIPELINE_EDGES` (prior & downstream steps).
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` — **`VARIABLE_REGISTRY`** (`Record<agentKey, string[]>`, the declared template-variable sets, system vs `_user` distinguished — D-04) + **`VARIABLE_DESCRIPTIONS`** (line 111, the gloss each missing variable renders with).
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` — the shared provenance card (its header comment already cites "Phase 44 inspector (Plan 42-07+). D-09 forbids three copies"); its `onInspect?` prop (lines ~131/451-454) is the fact-check claim entry point waiting for this panel.
- `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` — the "Inspect context" reserved disabled stub (lines ~179-182: "Inspect panel arrives in a future phase — this entry point is reserved (D-16)") — the My Tasks entry point to wire.
- `apps/dispatch-control/app/(dashboard)/prompt-lab/` — Agent Instructions / prompt-lab surfaces (the "Improve this agent →" + "Compare instruction versions" footer targets).

### Project constraints
- `.planning/PROJECT.md` §Current Milestone — **line 17** (the binding-spec pointer + "inspector artifact shape" in DERIVED-STATE-CONTRACT), **line 24** (the inspector lock: one universal 7-tab panel, 6 artifact types, 6 places, "anchors to *steps*, not spans (`sectionName → writer → agent_runs`)", the missing-expected-input diff as the highest-leverage item), and the reconciliation facts (write boundary; RBAC unbuilt → Phase 49; DO NOT REBUILD the design system).

### Prior-phase context this phase builds on
- `.planning/phases/42-fact-check-stage/42-CONTEXT.md` — the shared `ClaimProvenanceCard` reuse discipline (D-09, "reused in Draft, Approval, and the inspector — do not fork three copies") and how Phase 42 shipped an Inspect entry point without the panel (the pattern this phase completes).
- `.planning/phases/43-my-tasks-decision-log/43-CONTEXT.md` — the My Tasks "Inspect context" entry point wired as a stub (D-16, "the panel itself is Phase 44"); the `insp?` inspector-key field carried on each `DerivedTask`.
- `.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md` — the `AgentIOPanel` handoff inspector (MON-02) this phase generalizes into the universal panel, and the `agent_runs.retryCount` / truncation-note precedents.

</canonical_refs>

<code_context>
## Existing Code Insights

*(Console: `apps/dispatch-control/`, Next.js App Router, route group `app/(dashboard)/`. Convex: `convex/`. Pipeline: `packages/pipeline/src/eisenbalm_pipeline/`. Confirmed via codebase scan 2026-07-15.)*

### Reusable Assets
- **`AgentIOPanel.tsx`** (Phase 23/37) — a working proto-inspector: on-demand `agent_run_payloads` query, human-readable-first with a raw-JSON toggle, cost/duration/token metrics, upstream→downstream handoff, graceful no-snapshot degradation, `summarize()`/`prettyJson()` helpers. The universal panel is its generalization from graph-node-keyed to artifact-keyed.
- **`agent_runs` + `agent_run_payloads`** (convex/schema.ts 345-372) + queries `agentRuns.byRunId` / `agentRuns.payloadByRunIdAgentKey` — Diagnostics (metrics) + Inputs/Output (snapshots). **Snapshots are truncated ~2000 chars** — the load-bearing constraint for the missing-inputs diff (D-05).
- **`prompt_versions`** (schema 302-315) + `promptVersions.getActive` — the Instructions tab's active version + content.
- **`VARIABLE_REGISTRY` + `VARIABLE_DESCRIPTIONS`** (prompt-lab/VariableRegistry.ts) — a CODE constant enumerating each agent's declared template variables (system + `_user` sets distinguished) + their descriptions. This IS the "declared" side of `missing = declared − supplied`.
- **`ClaimProvenanceCard`** (components/provenance) — the shared provenance card with a live-but-inert `onInspect?` callback (the fact-check claim entry point) — reused for the Sources tab, not forked.
- **`MyTasksScreen`** — the "Inspect context" reserved disabled stub, ready to point at `openInspector`.
- **`PIPELINE_EDGES`** (run-monitor/graph/pipelineTopology.ts) — prior & downstream step resolution.

### Established Patterns
- **Derived/projected over stored:** counters, tasks, issue status, fact-check summary are pure selectors over Convex data (Phase 40/42/43). The inspector artifact resolver is the same — a selector over `agent_runs`/`agent_run_payloads`/`prompt_versions`, no new store.
- **Human-readable first, raw JSON behind a toggle:** `AgentIOPanel` (MON-02) established it; INS-02 makes it a hard rule (Technical tab is the only place raw JSON leads, and it is never a tab's default).
- **On-demand (non-subscribed) payload reads:** `AgentIOPanel` queries payloads on click, not via a live subscription, to keep subscriptions lean (Phase 23 Pattern 4). The panel follows suit — it opens on a user action.
- **Truncation is noted, never hidden:** `AgentIOPanel` prints "Snapshots truncated to ~2000 characters." The missing-inputs diff must extend this honesty (D-05).
- **Additive-optional schema evolution:** any new `agent_run_payloads.inputKeys` field is `v.optional`; legacy rows omit it and the diff falls back with an explicit note.
- **Contract-first:** amend `docs/API_CONTRACTS.md` (a new §44) before code.
- **Entry points shipped as reserved stubs first:** Phase 42 (claim `onInspect`) and Phase 43 (My Tasks "Inspect context") both shipped the *entry point* before the panel — Phase 44 completes them and applies the same "reserved control" treatment to its own not-yet-wired footer actions.

### Integration Points
- **`lib/inspectorArtifact.ts`** (new) — the pure artifact→step resolver (D-01/D-02) + the missing-inputs diff (D-04).
- **A shared inspector context/provider + one panel instance** at the Issue Workspace frame level (Phase 41 frame) — `openInspector(artifactKey)` (D-06).
- **`components/inspector/InspectorPanel.tsx`** (new, name TBD) — the 7-tab slide-over (D-06/D-07), reusing `AgentIOPanel` helpers.
- **Six entry points to wire to `openInspector`:** brief org card (Stage 1, degrades pre-Phase-47), draft passage toolbar (Stage 2), `ClaimProvenanceCard.onInspect` (Stage 3), voice finding (Stage 4), approval recommendation (Stage 5), `MyTasksScreen` "Inspect context."
- **`convex/schema.ts` + the pipeline payload writer** — the optional `inputKeys` field if D-05 takes the persist route (`packages/pipeline/.../` where `agent_run_payloads` is written).
- **`docs/API_CONTRACTS.md`** — new §44 (D-13).

### Watch-items (net-new inside a projection-reuse phase)
1. **The missing-inputs diff must not lie under truncation** (D-05) — the 2000-char cap can drop input keys; a false "missing" on the headline diagnostic is the worst failure mode in the phase. Persist `inputKeys` or note approximation.
2. **`signal`/`org` artifacts have no live pipeline source until Phases 46–47** — render structurally, degrade gracefully, never crash (D-03).
3. **Do NOT fork `ClaimProvenanceCard`** — the Sources/claim view reuses it (Phase 42 D-09, three-copies ban).
4. **One panel instance, not six** — all entry points call the same `openInspector` (D-06).
5. **Technical (raw JSON) is never a tab's default** (INS-02, D-07) — human-readable first everywhere.
6. **Footer actions targeting Phase 45 (Ask agent to revise) / unbuilt step-restart are reserved controls, not reaches into unbuilt phases** (D-08) — mirror the Phase 42/43 stub pattern.

</code_context>

<specifics>
## Specific Ideas

- The load-bearing user question the inspector answers (Annotations §Inspect how this was made): **"how was this made, and if it's wrong, how do I fix it at the source?"** — the panel is the bridge from a bad sentence to a prompt fix, and the **missing-inputs diff is that bridge** (the `characterization_examples` → inflated phrase example, §8 / Annotations §Inputs, is the canonical demo — "the Flow C bridge").
- The **same inspector opens from everywhere** — six editorial surfaces plus every Run Details step (Annotations §Run Details: "Selecting any step opens the same inspector used everywhere else"). One component, six (really N) entry points; this is the phase's defining constraint.
- **"Technical" is a destination, not a default** — raw JSON + copy/download is a first-class tab, but no other tab may fall back to it; every tab has human-readable content first (INS-02). Truncation and absence are stated in plain language, never hidden behind blanks.

</specifics>

<deferred>
## Deferred Ideas

- **"Ask agent to revise" verb + direction chips + claim-delta comparison card** — Phase 45 (REV-01..05). Phase 44 renders the footer control as reserved; DERIVED-STATE-CONTRACT §9 is that phase's spec.
- **Live `signal` (story leads) and `org` (organization selection) artifact data** — Phase 46 (Signal Editor + `verify_candidates`) + Phase 47 (Story & Brief). Phase 44 renders the artifact types structurally and degrades gracefully.
- **Role/permission gating** (Collaborator read-only, locked-control rendering on footer actions) — Phase 49. Phase 44 builds for the editor and structures controls for §6 wrapping.
- **General "Restart from this step" step-restart semantics** beyond the existing Gate-1 `POST /run/{id}/resume` — wired now only if the existing resume endpoint cleanly supports it, otherwise reserved (D-08).
- **Console-wide nomenclature ripple / Workbench rename** — Phase 50.

### Reviewed Todos (not folded)
None — `todo match-phase 44` surfaced no relevant todos.

</deferred>

---

*Phase: 44-inspect-how-this-was-made*
*Context gathered: 2026-07-15*
