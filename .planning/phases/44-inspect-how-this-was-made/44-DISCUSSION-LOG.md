# Phase 44: Inspect How This Was Made - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 44-inspect-how-this-was-made
**Mode:** `--auto` (recommended defaults auto-selected, no interactive questions)
**Areas discussed:** Artifact→step resolution · Missing-inputs diff + truncation · Panel shell · Footer actions · Tab data sourcing

---

## Auto-mode selections

`[auto]` No existing CONTEXT.md and no plans for Phase 44 → proceeded directly to context capture.
`[auto]` `todo match-phase 44` → 0 matches → nothing folded, nothing reviewed.
`[auto]` Selected ALL gray areas (no `AskUserQuestion` under `--auto`): Artifact→step resolution, Missing-inputs diff + truncation, Panel shell, Footer actions, Tab data sourcing.
`[auto]` For each area, chose the recommended (first) option. Logged below.

---

## A. Artifact → step/agent resolution

| Option | Description | Selected |
|--------|-------------|----------|
| One pure resolver, step-anchored | `lib/inspectorArtifact.ts` maps `{type,runId,locator}` → `InspectorArtifact` over existing rows; anchors to step not span (§8, PROJECT.md lock) | ✓ |
| Per-surface bespoke resolution | Each of the six entry points assembles its own artifact | |
| New span-level provenance store | Track sub-section span provenance for finer granularity | |

**Auto-selected:** One pure resolver, step-anchored (recommended).
**Rationale:** DERIVED-STATE-CONTRACT §8 and PROJECT.md line 24 lock "anchors to a *step*, not a span — section-level granularity, `sectionName → writer → agent_runs`." A span store would be scope creep against an explicit lock; per-surface resolution would fork logic six ways. The resolver is a selector, matching the Phase 40/42/43 derived-over-stored discipline. → D-01, D-02, D-03.

---

## B. The missing-inputs diff (INS-03, headline) + truncation honesty

| Option | Description | Selected |
|--------|-------------|----------|
| `declared − supplied`, honest under truncation | declared = `VARIABLE_REGISTRY` union (system + `_user`); supplied = `inputSnapshot` keys; persist untruncated `inputKeys` OR note approximation | ✓ |
| Parse truncated snapshot only | Compute the diff from `inputSnapshot` keys with no truncation handling | |
| Defer the diff | Ship the Inputs tab without the missing-inputs call-out | |

**Auto-selected:** `declared − supplied`, honest under truncation (recommended).
**Rationale:** INS-03 IS the phase's headline ("the single highest-leverage item in the design"). Option 2 risks a false "missing" when the 2000-char `agent_run_payloads` truncation drops a supplied key — the worst possible failure on the highest-value field. Option 3 guts the phase. The recommended path persists a cheap untruncated `inputKeys` list (additive-optional) or renders an explicit "approximate under truncation" note on legacy rows, bounded by "never assert missing when truncation could have hidden it." → D-04, D-05.

---

## C. Panel shell — instance, opener, tab defaults

| Option | Description | Selected |
|--------|-------------|----------|
| One shared instance + `openInspector`, Summary default | Single slide-over at Workspace-frame level; all 6 entry points call one opener; Technical never default | ✓ |
| One component, mounted per surface | Six mounts of the same component, each locally stated | |
| Modal / full-route inspector | Render as a dialog or dedicated route instead of a side panel | |

**Auto-selected:** One shared instance + `openInspector`, Summary default (recommended).
**Rationale:** Annotations specify "Side panel, seven tabs" and "the same inspector used everywhere else" — one instance is the literal design. INS-02 makes Summary-first / Technical-never-default a hard rule. Reuses `AgentIOPanel`'s slide-over + `summarize()`/`prettyJson()` helpers rather than reinventing. → D-06, D-07.

---

## D. Footer actions — live vs reserved

| Option | Description | Selected |
|--------|-------------|----------|
| Live deep-links to shipped surfaces; reserved controls for the rest | Improve-agent / Compare-versions / Related-tests / Prior-downstream live; Ask-to-revise + Restart reserved with explanatory titles | ✓ |
| All six live now | Build/route every footer action this phase | |
| All six reserved stubs | Render all six inert until later phases | |

**Auto-selected:** Live deep-links to shipped surfaces; reserved for the rest (recommended).
**Rationale:** Criterion 6 says the footer *offers* all six on every artifact type — "offers" is satisfied by a rendered control, exactly how Phases 42/43 shipped Inspect entry points as stubs. Four actions target already-shipped surfaces (prompt-lab, `VersionHistoryPanel`, eval-center, `PIPELINE_EDGES`) and go live; "Ask agent to revise" is Phase 45 and "Restart from this step" beyond Gate-1 resume is out of scope — both rendered reserved with plain-language titles. Building all six (Option 2) reaches into unbuilt Phase 45; all-reserved (Option 3) needlessly under-delivers shipped capability. → D-08, D-09.

---

## E. Tab data sourcing — Instructions (INS-04) & Output divergence (INS-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Active prompt version + shared rules; divergence note via changed-since signal | Instructions shows `getActive` + shared-rule keys + Improve link; Output notes divergence via existing content-patch/changed-since machinery | ✓ |
| Producing-version reconstruction | Recover and render the exact prompt version that produced each artifact | |
| Skip divergence note | Show output without an issue-text-divergence marker | |

**Auto-selected:** Active version + shared rules; divergence via changed-since signal (recommended).
**Rationale:** INS-04 asks for the *active* instruction version (`promptVersions.getActive`) + shared rules + "Improve this agent →" — all present. INS-05's divergence note reuses the `founderApplied` / changed-since-check signal Phases 42/43 already track, rather than building version-reconstruction (Option 2, heavier, no store for it) or skipping the honesty note (Option 3, violates "never assert unchanged when unverifiable"). Where the producing version diverges from active, note it honestly. → D-10, D-11.

---

## Claude's Discretion
- Exact `sectionName → writer agentKey` mapping table (from real pipeline wiring).
- Persist `inputKeys` field vs truncation-note fallback for the diff.
- Precise Output-divergence predicate + Instructions producing-vs-active version note.
- Whether "Restart from this step" wires to the existing resume endpoint now or renders reserved.
- Panel styling/iconography, keyboard/focus, reserved-control + degraded-state copy, component file location, inspector-context mount level.

## Deferred Ideas
- "Ask agent to revise" verb + comparison card — Phase 45.
- Live `signal`/`org` artifact data — Phases 46–47.
- Role/permission gating on footer controls — Phase 49.
- General step-restart semantics beyond Gate-1 resume — later.
- Nomenclature ripple / Workbench rename — Phase 50.
