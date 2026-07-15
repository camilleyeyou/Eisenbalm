# Phase 44: Inspect How This Was Made - Research

**Researched:** 2026-07-15
**Domain:** Internal codebase archaeology (read-side projection + entry-point wiring over existing Convex/pipeline substrate) — no external library research surface
**Confidence:** HIGH (every finding below is a direct file/line citation, not inference from training data)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Artifact → step/agent resolution — one pure resolver, step-anchored (INS-01, §8)**
- **D-01:** Build ONE pure resolver module (e.g. `lib/inspectorArtifact.ts`) that maps an artifact key `{ type, runId, locator }` → an `InspectorArtifact`, assembled from existing Convex rows. Anchors to a **step** (an `agentKey` + its `agent_runs`/`agent_run_payloads` rows), NOT a span. No new store, no span-level tracking.
- **D-02:** The six artifact types resolve to agentKeys: `founder` (drafted section) → `sectionName → writer` (origin_story, problem, founder_bio_*, case_study_*, game, bonus_*); `claim` → the producing writer/researcher recorded on the claim_checks row; `rec` → `editor_final`; `qa` → `qa`; `signal` → `signal_editor`; `org` → `scout`/`editor_gate1`. Each joins `agent_runs` + `agent_run_payloads` by `(runId, agentKey)`. **The exact `sectionName → writer` mapping table is planning/research discretion, sourced from the pipeline's real wiring.** Must degrade gracefully for `signal`/`org` when the run has no such step.
- **D-03:** `signal` and `org` artifacts render structurally but degrade gracefully (no `signal_editor`/first-class `org` step exists until Phases 46-47) — explicit "not recorded in this run" states, never blank, never a crash.

**B. The missing-inputs diff (INS-03 — the headline) + truncation honesty**
- **D-04:** Compute `missing = declared − supplied`. `declared` = union of `VARIABLE_REGISTRY[agentKey]` (system tokens) and `VARIABLE_REGISTRY[{agentKey}_user]` (user-template tokens). `supplied` = top-level keys parsed from `agent_run_payloads.inputSnapshot` JSON for `(runId, agentKey)`. Each missing variable renders with its `VARIABLE_DESCRIPTIONS` gloss.
- **D-05 (non-negotiable watch-item):** the input snapshot is truncated ~2000 chars server-side, so a naive key-parse can drop keys and falsely report a supplied key as "missing." **Recommended:** persist an untruncated top-level input KEY LIST (`agent_run_payloads.inputKeys: v.optional(v.array(v.string()))`, additive), diff against that exact set; when absent, fall back to parsing truncated `inputSnapshot` and render an explicit "approximate" note. Hard rule: **the diff must never assert a variable is missing when truncation could have hidden it.**

**C. Panel shell — one shared instance, one opener, tab defaults (INS-01, INS-02)**
- **D-06:** ONE shared side-panel component + a single inspector context/provider exposing `openInspector(artifactKey)`/`closeInspector()`. Exactly one panel instance mounted (Issue Workspace frame level). Right-side slide-over, reusing `AgentIOPanel`'s slide-over structure + `summarize()`/`prettyJson()` helpers.
- **D-07:** Seven tabs are client state; default tab is Summary; Technical (raw JSON) is NEVER the default on any tab. Every field renders an explicit non-blank state when its source is absent. Every state uses label + icon, never color alone.

**D. Footer actions — live deep-links vs reserved controls (INS-06, criterion 6)**
- **D-08:** Footer offers all six actions on every artifact type; wire the ones targeting ALREADY-SHIPPED surfaces as live deep-links, render the rest as visible-but-reserved with explanatory title. Live now: Improve this agent → (Agent Instructions/prompt-lab), Compare instruction versions → (`VersionHistoryPanel`), Related quality tests → (eval-center scenarios), Prior & downstream steps → (`PIPELINE_EDGES`). Reserved: Ask agent to revise → Phase 45; Restart from this step → wire it if the existing resume endpoint cleanly supports "restart from step," otherwise render reserved with plain-language explanation.
- **D-09:** The inspector performs no mutations. Read-only panel; footer actions navigate or deep-link only.

**E. Tab data sourcing — Instructions (INS-04) & Output divergence (INS-05)**
- **D-10:** Instructions tab shows the exact active `prompt_versions` row for the agentKey (via `promptVersions.getActive`), shared editorial rules referenced (derivable from `VARIABLE_REGISTRY`), section guidance where applicable, and "Improve this agent →." Note: the active version is not necessarily the version that produced the artifact — render active per spec, note divergence where recoverable, never imply the shown instructions produced the output when unverifiable.
- **D-11:** Output tab shows full human-readable output (from `outputSnapshot`, truncation noted) plus a divergence note when the issue text has since diverged. Recommended: reuse the "changed since" / `founderApplied` machinery. **Exact predicate is planning/research discretion**, bounded by: never assert "unchanged" when unverifiable — render "unknown whether this still matches" instead.

**F. Cross-cutting discipline**
- **D-12:** Reuse, do not rebuild — `agentRuns.byRunId`/`payloadByRunIdAgentKey`, `promptVersions.getActive`, `VARIABLE_REGISTRY`/`VARIABLE_DESCRIPTIONS`, `PIPELINE_EDGES`, `AgentIOPanel`'s helpers/slide-over, `ClaimProvenanceCard`'s `onInspect?` prop, `MyTasksScreen`'s reserved stub. Do not fork `ClaimProvenanceCard` (Phase 42 D-09 three-copies ban).
- **D-13:** Contract-first — amend `docs/API_CONTRACTS.md` with §44 (InspectorArtifact shape, resolver contract, missing-inputs diff, additive `inputKeys` field if taken, `openInspector(artifactKey)` contract) BEFORE code.
- **D-14:** Every state renders label + icon, never color alone.

### Claude's Discretion
- The exact `sectionName → writer agentKey` mapping table (D-02) — **RESOLVED below with hard evidence, see Architecture Patterns.**
- Whether to persist `agent_run_payloads.inputKeys` vs a truncation-note-only fallback (D-05) — **research surfaces a bigger problem than truncation; see Pitfall 1, which the planner must resolve before D-05 is even the binding constraint.**
- The precise Output-divergence detection predicate and the Instructions producing-vs-active version note (D-10/D-11) — see Architecture Patterns.
- Whether "Restart from this step" wires to the existing resume endpoint now or renders reserved (D-08) — **RESOLVED below: the existing endpoint cannot support it; recommend reserved.**
- Panel styling, tab iconography, keyboard/focus behavior, copy for reserved-control titles and empty/degraded states.
- The panel component file location and whether the inspector context lives at the Workspace-frame level or higher (bounded by "one instance, not six").

### Deferred Ideas (OUT OF SCOPE)
- "Ask agent to revise" verb + direction chips + claim-delta comparison card — Phase 45 (REV-01..05).
- Live `signal` (story leads) and `org` (organization selection) artifact data from a real Signal Editor/verify_candidates step — Phase 46/47.
- Role/permission gating (Collaborator read-only, locked-control rendering) — Phase 49.
- General "Restart from this step" step-restart semantics beyond the existing Gate-1 resume endpoint.
- Console-wide nomenclature ripple / Workbench rename — Phase 50.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INS-01 | One inspector panel reachable from 6 places (brief org card, draft passage toolbar, fact-check claim detail, voice finding, approval recommendation, My Tasks). | Architecture Patterns §"Six entry points" maps each place to its exact current component + the minimal wiring needed. 4 of 6 already have a reuse point (`ClaimProvenanceCard.onInspect`, `MyTasksScreen` stub, `DecisionRail`'s recommendation section, `StoryPanelContent`'s org card); 2 need a small net-new affordance (`AnnotationMark`/`UnresolvedFindingCard` for draft+voice — same shared component, one prop). |
| INS-02 | 7 tabs, human-readable first, raw JSON never default. | `AgentIOPanel.tsx` already establishes this exact pattern (`summarize()`/`prettyJson()`, `showRawJson` toggle) — directly reusable. |
| INS-03 | Inputs tab missing-expected-inputs diff = declared template vars − supplied run-payload keys. | Pitfall 1 (critical): `agent_run_payloads.inputSnapshot`'s top-level keys are **DispatchState field names** (`research`, `winning_charity`, `style_brief`), not `{token}` names (`charity_name`, `VOICE_CONSTRAINTS`) — the two vocabularies almost never intersect. D-04's literal recipe will not produce a meaningful diff as written. Resolved recommendation below. |
| INS-04 | Instructions tab: active version + shared rules + "Improve this agent →." | Pitfall 2: 5 of the pipeline's `agent_runs` keys (`origin_story`, `problem`, `founder_bio`, `case_study`, `qa`) have **no `prompt_versions` row at all** — `promptVersions.getActive` will return `null` for them by design, not by bug. Must degrade explicitly for these (not an edge case — it's the default case for 4 of 7 section writers). |
| INS-05 | Output tab: full output + divergence note. | `outputSnapshot` truncation pattern already established in `AgentIOPanel`; divergence predicate recommendation in Architecture Patterns (reuse `changedSinceCheck`/content-patch-applied signal per section, same mechanism Phase 42/43 use). |
| INS-06 | Footer: 6 actions, live vs reserved. | `VersionHistoryPanel.tsx` and eval-center `ScenarioCard.tsx` both already exist and are agentKey-keyed — live deep-link targets confirmed. `POST /run/{run_id}/resume` is confirmed Gate-1-specific (hardcoded `editorSelection` payload) — cannot serve generic step-restart; recommend reserved. |
</phase_requirements>

## Summary

This phase has almost no external-library surface — it is entirely internal codebase archaeology, wiring one new read-side panel over data five prior phases (23/24/26/35/37/38/42/43) already shipped. The value of this research is in what it corrects and specifies precisely, because direct inspection of the pipeline source materially changes what the planner can safely assume from CONTEXT.md's characterizations alone.

**The single most important finding** is that the phase's headline diagnostic — the missing-inputs diff (INS-03) — cannot be computed as D-04 literally describes. `agent_run_payloads.inputSnapshot` is built in `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py::_snapshot_input()` from a **per-agent whitelist of `DispatchState` top-level field names** (e.g. `founder_bio` → `["research", "winning_charity", "style_brief"]`). `VARIABLE_REGISTRY` (`apps/dispatch-control/.../prompt-lab/_components/VariableRegistry.ts`) enumerates **fine-grained `{token}` names actually substituted into a prompt string** (e.g. `charity_name`, `VOICE_CONSTRAINTS`, `mission_statement`). These are two different vocabularies that structurally never intersect by name — diffing them directly means every declared token shows up as "missing" for every agent, always, regardless of what was actually supplied. This is not the truncation edge case D-05 flags (which is real, but secondary); it is a systematic vocabulary mismatch that exists **before** truncation ever becomes relevant. A second, corroborating instance of the same landmine already exists live in the codebase: `packages/pipeline/src/eisenbalm_pipeline/api/agents.py::_load_prior_input()` (PRM-05's "test with a prior run's real input" mode) makes the exact same assumption and appears to hit the exact same mismatch. The design spec's own canonical example (`characterization_examples`) does not exist anywhere in the real system — it is illustrative flavor text from the prototype mockup, not a real token. The recommended resolution (below) redefines "declared"/"supplied" onto a vocabulary that is actually computable from data that exists today, and flags the fine-grained token-level diff as a heavier, likely out-of-scope follow-up.

Three further corrections matter for planning:
1. Four of the seven section writers (`origin_story`, `problem`, `founder_bio`, `case_study`) plus `qa` have **no `prompt_versions` row at all** — they were never externalized to the config/prompt-lab system (`config_loader.py`'s `SYSTEM_PROMPT_KEYS` explicitly excludes them, "deliberately ABSENT"). The Instructions tab must degrade for these as the *default* case, not a corner case.
2. `agent_runs`'s literal graph-node key for Gate 1 is `editor_gate_1` (underscore before 1); `prompt_versions`/`VARIABLE_REGISTRY`/`acomplete`'s `agent_id` all use `editor_gate1` (no underscore). No existing code reconciles these two namespaces for the same key — Phase 44 is the first feature that needs both simultaneously.
3. `agent_runs` has no `model` field — the Diagnostics tab's spec'd "model" value has no live Convex source; `model_versions` today reaches only Sanity's `weeklyIssue.modelVersions` JSON blob.

None of this blocks the phase — it is exactly the kind of finding a "read-side projection" phase should surface *before* planning, so the plan's Wave 0 correctly scopes the resolver and the schema-additive work.

**Primary recommendation:** Build the resolver in two layers — a cheap, always-correct "declared state inputs" diff (reusing/porting `agent_wrapper.py`'s `_INPUT_KEYS` whitelist to TypeScript) as the actual INS-03 deliverable, and treat true `{token}`-level substitution-gap detection as an explicit non-goal for this phase (documented in API_CONTRACTS §44 as a known limitation, not silently glossed over).

## Standard Stack

Not applicable in the conventional sense — this phase adds zero new npm/pip packages. It is a projection over already-shipped Convex tables, already-shipped Python pipeline state, and already-shipped React/Next.js components in `apps/dispatch-control`. No version verification needed; every dependency is already pinned by prior phases.

## Architecture Patterns

### The resolver's `sectionName → writer agentKey` mapping — ALREADY EXISTS, reuse it

`apps/dispatch-control/lib/galley/sectionIdMap.ts` is the exact table D-02 asks the planner to "source... from the pipeline's real section→writer wiring, not invent." It is a bidirectional map between QA's snake_case `sectionName` vocabulary (which is **identical to the `agent_runs`/`agent_run_payloads` agentKey** for 6 of 7 writers) and the galley/draft camelCase section id vocabulary (which is what `claim_checks.sectionName` and the draft-passage UI use):

```typescript
// apps/dispatch-control/lib/galley/sectionIdMap.ts
const QA_TO_GALLEY: Record<string, string> = {
  origin_story: 'originStory',
  problem: 'problemStatement', // NOTE: problem !== problemStatement (not a naive transform)
  founder_bio: 'founderBio',
  case_study: 'caseStudy',
  game: 'game',
  bonus: 'bonus',
}
export function qaSectionToGalleyId(qaName: string): string | null { ... }
export function galleyIdToQaSection(galleyId: string): string | null { ... } // the direction the resolver needs
```

Confirmed exhaustive against `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py::_extract_sections()` (the 6 keys it emits are exactly these 6). `design` is deliberately absent from this map — it has no galley/draft section (it's the theme, not prose) and no `claim_checks`/QA anchor point; the `founder` artifact type for `design` output is only reachable, if at all, via a future Run Details surface, not via any of the six canonical entry points in this phase.

**Resolver recommendation:** `founder` artifact resolution is `galleyIdToQaSection(locator) → agentKey`, reusing this file directly — do not build a second table. `bonus` needs one extra step: the graph node's `agent_runs.agentKey` is literally `"bonus"` (not `bonus_big_budget`/`bonus_jingle`/`bonus_spec_ad`), but `prompt_versions` only has rows for the three *variant* keys. The bonus type actually used is recorded in the node's own `outputSnapshot.bonusType` (`packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py:317` — `out_dict["bonusType"] = bonus_type`), so the resolver reads `agent_run_payloads` for `agentKey="bonus"` first, then uses `outputSnapshot.bonusType` to pick `bonus_big_budget`/`bonus_jingle`/`bonus_spec_ad` when querying `prompt_versions` for the Instructions tab specifically (Diagnostics/Inputs/Output tabs stay keyed on `"bonus"`).

### The `editor_gate_1` / `editor_gate1` naming split — the resolver's one hard alias

Confirmed via direct grep across both layers:
- `agent_runs`, `agent_run_payloads`, `PIPELINE_EDGES`, `PIPELINE_NODES`, the LangGraph node itself (`graph/builder.py:105`) — all use **`editor_gate_1`** (underscore before 1).
- `prompt_versions`, `VARIABLE_REGISTRY`, `config_loader.py`'s `SYSTEM_PROMPT_KEYS`, `acomplete(agent_id=...)` in `agents/editor.py:277`, `AGENT_DISPLAY_NAMES`, eval-center `ScenarioCard.agentKey` — all use **`editor_gate1`** (no underscore).

No existing code translates between the two — every prior feature (prompt-lab, eval-center, run-monitor graph) has only ever needed ONE of the two namespaces at a time. Phase 44 is the first place both are needed together for the same artifact (Diagnostics tab reads `agent_runs`/`agent_run_payloads` keyed `editor_gate_1`; Instructions tab reads `prompt_versions`/footer deep-links keyed `editor_gate1`). The resolver needs one explicit alias entry (e.g. a 1-2 entry `AGENT_RUNS_KEY_TO_PROMPT_KEY` map, or a single `if (agentKey === 'editor_gate_1') promptKey = 'editor_gate1'`) — do not assume the keys are interchangeable elsewhere in new code.

### `org` and `claim` artifact resolution — the CONTEXT's characterization is slightly optimistic

- **`org`:** The "brief organization card" entry point already exists and is **not blocked on Phase 46/47** — it is `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx`, driven by `pitchLog` rows (Scout's real output for every run to date). The winner/candidate cards there resolve to agentKey `scout` today (not `editor_gate1`, since the winning-selection reasoning lives in `editor_decision`/`deliberationEvents`, but the pitch/candidate data itself is Scout's). Recommend the `org` artifact resolve to `scout` primarily, with `editor_gate1` reachable as the "decision" context (matches D-02's "scout / editor_gate1" phrasing — both are legitimate, `scout` for "what was found," `editor_gate1` for "why this one won").
- **`claim`:** CONTEXT.md's D-02 says the producing agent is "recorded on the claim_checks row (Phase 35/42 already carry sectionName/agent)." **This is incorrect** — `claim_checks` (`convex/schema.ts:442-466`) has `sectionName` but **no `agent` field at all**. The only evidence of a producing agent is structural: `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:570` shows "Ask agent for better evidence" is executed by `agent_id="researcher"` — claim sourcing (`sourceUrl`/`retrievedAt`, Phase 35 PRV-01) is a Researcher-owned operation. Recommend `claim` artifact resolves primarily to `researcher` (its `agent_run_payloads` carries the actual search results / verified-facts the claim was sourced from — far more useful for provenance than any single writer), with `sectionName` (already confirmed "ALREADY galley vocabulary" per `factcheck.py:68`'s own comment) surfaced as contextual metadata ("appears in: Founder Bio," reusing `galleyIdToQaSection` again) rather than as the resolution target itself.

### Panel shell, entry points, and the one genuinely reusable multi-entry-point win

`AgentIOPanel.tsx` (`apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx`) is a complete, working precedent for D-06/D-07: on-demand (non-subscribed) payload query, `summarize()`/`prettyJson()` helpers, `showRawJson` toggle defaulting closed, graceful "no snapshot stored" / "no upstream node" degradation, truncation notice. The new panel should structurally mirror this file (7 tabs instead of one collapsed view), and its `summarize()`/`prettyJson()` functions should be extracted to a shared module both components import — do not duplicate them.

**Six entry points — current state, verified:**

| # | Place | Current component | State today |
|---|---|---|---|
| 1 | Brief org card | `StoryPanelContent.tsx` (winner/candidate cards) | Real, live, unblocked by Phase 46/47 (see above). No `onInspect` prop yet — net-new, small. |
| 2 | Draft passage toolbar | `GallerySection.tsx` → `AnnotationMark.tsx` (in-paragraph findings) + `UnresolvedFindingCard.tsx` (orphaned-anchor findings) | Both already have a Phase 33 D-11 conditional-action-row pattern (`onEditSection?`, `canEdit`/`canDismiss` gates). No true "select-any-passage" toolbar exists (`GallerySection.tsx` has no selection listener) — the prototype's full toolbar (Edit text / Ask agent to revise / Compare / Restore / Related facts / Inspect) is mostly Phase 45 territory. **Recommend:** add `onInspect?` to `AnnotationMark`/`UnresolvedFindingCard` (covers passages with an attached finding) AND a lightweight per-section "Inspect how this was made" affordance in `GallerySection`'s header (covers sections with no open finding) — both cheap, no new interaction model, consistent with D-01's step/section-level anchoring (not span-level). |
| 3 | Fact-check claim detail | `ClaimProvenanceCard.tsx` | Already has `onInspect?: () => void` prop (line 131), wired-but-inert (button disabled when the callback is absent, lines 451-452). Phase 44 just supplies the callback. |
| 4 | Voice finding | Same `AnnotationMark.tsx` as #2 — Voice Pass reuses it with different action labels (confirmed via its own header comment: "Voice Pass passes `{ accept: 'Accept ... }`"). | Same fix as #2 covers this entry point simultaneously — one prop addition, two entry points satisfied. |
| 5 | Approval recommendation | `DecisionRail.tsx`, section `aria-label="Agent editor's recommendation"` (lines 386-401), sourced from `editor_final` `deliberationEvents` payload key `notes` | Real, live, already resolves unambiguously to agentKey `editor_final`. Needs only a small "Inspect" button next to the existing memo render. |
| 6 | My Tasks | `MyTasksScreen.tsx` "Inspect context" button (lines 176-183) | Disabled, `title="Inspect panel arrives in a future phase — this entry point is reserved (D-16)."` **Two things needed, not one:** (a) enable the button + wire `openInspector`, AND (b) populate `DerivedTask.insp` in `lib/derivedState.ts::deriveTasks()` — confirmed the field is declared in the interface (`insp?: string`, line 47) but **never assigned** anywhere in the function body (qaFindings/claimRows/sign-off task-push blocks all omit it). Sign-off tasks (`signoff-facts`/`signoff-voice`) have no natural single artifact to inspect — recommend they either omit `insp` (button stays reserved for just these two rows) or map to the `rec`/`qa` artifact loosely; this is a genuine open point for the planner (see Open Questions). |

### Diagnostics tab — the "model" field needs a schema decision the planner must make explicitly

`agent_runs` (`convex/schema.ts:346-361`) carries `status`/`costUsd`/`durationMs`/`tokensIn`/`tokensOut`/`error`/`retryCount` — **no `model` field.** The resolved LLM model per agent (`usage["resolved_model"]`, set via `openrouter_client.py::_record_model_version()`) is written only into `state["model_versions"]`, which reaches Convex **never** and reaches Sanity only as a JSON-stringified blob at publish time (`sanity_client.py:269`, `weeklyIssue.modelVersions`). There is no live per-run, per-agent, Convex-queryable "which model produced this" today. Two honest options, either is fine, but the plan must pick one explicitly:
1. Render "model" as "—" / "not recorded" on the Diagnostics tab for this phase (zero schema change, matches the "blank never means verified" honesty rule already established elsewhere).
2. Add `agent_runs.model: v.optional(v.string())` (additive, mirrors the `inputKeys`/`retryCount` precedent) and populate it in `agent_wrapper.py`'s `completed` mutation call by reading `result.get("model_versions", {}).get(agent_key)` from the just-returned `fn(state)` result (available before the LangGraph reducer merge — no extra plumbing needed, the value is already sitting in the return dict for every agent that calls `acomplete`).

Given D-13 already budgets one additive schema change (`inputKeys`) for this phase, recommend documenting option 1 as the Phase 44 default and flagging option 2 as a fast, low-risk follow-up if the planner has schema-change budget to spare — but do not silently assume "model" just works.

### Output divergence (INS-05) and Instructions active-vs-producing version (D-10/D-11) — recommended predicates

Both should reuse the **exact same signal already used by Phase 42/43**: a content-patch applied to a section/claim after the run in question. `claim_checks.changedSinceCheck` (Phase 42, §42.5) is stamped by `_reset_touched_claims` whenever a block-level revision lands — this is precisely "the issue text has since diverged from [the recorded output]" for the sections/claims it covers. For sections with no matching `claim_checks` row touched (i.e. no revision has landed since the run), render "unchanged since this run" only when there is direct positive evidence (a content-patch audit trail with no entries after the run's `completedAt`); otherwise render "unknown whether this still matches the issue" per D-11's bounding rule — never assert "current" from silence alone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `sectionName → writer agentKey` mapping | A new lookup table | `apps/dispatch-control/lib/galley/sectionIdMap.ts` (`galleyIdToQaSection`/`qaSectionToGalleyId`) | Already exhaustive against QA's real 6-section vocabulary; hand-building a second one risks drifting from `problem ≠ problemStatement`. |
| Human-readable JSON summarization | A new summarizer | `AgentIOPanel.tsx`'s `summarize()`/`prettyJson()` (extract to a shared module) | Byte-identical behavior already relied on by Run Details; extracting avoids two summarizers drifting apart. |
| Claim provenance rendering | A second provenance card for the inspector's Sources tab | `ClaimProvenanceCard.tsx` (already has `onInspect?`) | Phase 42 D-09 explicitly forbids a third copy; the component's own header comment already anticipates Phase 44 reuse. |
| Prior/downstream step resolution | A new topology walk | `PIPELINE_EDGES` (`pipelineTopology.ts`) + `AgentIOPanel`'s upstream/downstream filter logic | Exact behavior already correct for fan-out/fan-in (verify_research → 7 writers → validate_sections). |
| Per-finding action-row wiring | A new toolbar component for draft/voice | `AnnotationMark.tsx` + `UnresolvedFindingCard.tsx`'s existing conditional-prop action-row pattern (`onEditSection?`, `canEdit`) | Both components already implement "actions render only when the callback prop is supplied" — add `onInspect?` following the identical pattern, don't invent a new one. |

**Key insight:** almost every piece of this phase already has a half-built home in the codebase (a stub prop, a reserved button, a declared-but-unpopulated field). The actual net-new surface is small: the resolver module, the missing-inputs diff (redefined per Pitfall 1), the 7-tab panel shell, and ~6 one-line wiring changes. The risk in this phase is not under-building — it's over-building things that already half-exist, or trusting CONTEXT.md's field-name characterizations (`claim_checks.agent`, a naive `inputSnapshot` diff) without checking them against the schema.

## Common Pitfalls

### Pitfall 1 (CRITICAL): `inputSnapshot`'s vocabulary does not match `VARIABLE_REGISTRY`'s vocabulary — the naive D-04 diff will not work

**What goes wrong:** Implementing D-04 literally — "supplied = the top-level keys parsed from `agent_run_payloads.inputSnapshot` JSON," diffed against `VARIABLE_REGISTRY[agentKey]` — produces a diff where every declared token appears "missing" for every agent, always, because the two key sets are drawn from different abstraction layers and essentially never share names.

**Why it happens:** `_snapshot_input()` (`packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py:71-82`) captures a **whitelist slice of `DispatchState` top-level fields** per agent (`_INPUT_KEYS`, lines 33-53) — e.g. for `game`: `["research", "winning_charity", "style_brief"]`. `VARIABLE_REGISTRY["game"]` (`VariableRegistry.ts:42`) is `['charity_name', 'VOICE_CONSTRAINTS', 'FORBIDDEN_CONSTRUCTS']` and `game_user` is `['charity_name', 'mission_statement']` — the actual `.replace("{token}", value)` substitution names used inside `agents/game.py` (confirmed at `game.py:65-81`), derived from *nested* state values (`charity.get("name", "")`), not top-level state keys. No agent in the codebase has `_INPUT_KEYS` values that equal its `VARIABLE_REGISTRY` values.

**Corroborating evidence this is a live, known-shaped risk, not a hypothetical:** `packages/pipeline/src/eisenbalm_pipeline/api/agents.py::_load_prior_input()` (PRM-05's "test-run with a prior run's real input" feature) makes exactly this same assumption — it loads `inputSnapshot`, treats its top-level keys as `{token}` substitution values (`api/agents.py:181-190`'s `_substitute()`), and feeds them into a template `.replace()` chain. Given the vocabulary mismatch above, this pre-existing feature's "prior-real" input mode likely renders templates with unsubstituted `{token}` placeholders whenever exercised against a real prior run — worth a quick manual check before the planner assumes this pattern is safe to imitate.

**Also:** the design spec's canonical demo (`characterization_examples` — DERIVED-STATE-CONTRACT.md §8, Annotations.md §Inputs) does not exist anywhere in the real codebase (confirmed by grep across `packages/pipeline` and `apps/dispatch-control`). It is illustrative flavor text from the prototype mockup's fictional data, not a real token to reproduce in tests or demos.

**How to avoid — recommended redefinition:** Ship a coarser, but actually-correct and immediately achievable, diagnostic:
- Port `_INPUT_KEYS` (agent_wrapper.py) to a parallel TypeScript constant (e.g. `lib/inspector/declaredStateInputs.ts`), mirroring how `VariableRegistry.ts`'s own header comment already documents that it was hand-derived from Python source. Use THIS as "declared" for the Inputs tab's coarse diagnostic: "expected state input `research` — present" / "expected state input `winning_charity` — **absent from this run's captured input**." This is directly computable from `inputSnapshot`'s real top-level keys, requires no pipeline behavior change beyond the additive `inputKeys` field (D-05), and never produces a false "missing."
- Treat true `{token}`-level substitution-gap detection (the prototype's literal `characterization_examples` framing) as an explicit, documented non-goal for Phase 44 — note it in API_CONTRACTS §44 as a known limitation rather than silently attempting and shipping a diagnostic that is wrong by construction. If the planner wants the fine-grained version, it requires either capturing the actually-resolved token→value map at prompt-build time (a real `agent_wrapper.py` change, bigger than this phase's stated scope) or a per-agent nested-path lookup table connecting each `VARIABLE_DESCRIPTIONS` entry to where in the captured state slice it is sourced from (significant new authored content, not "derived over stored").

**Warning signs during planning:** if a plan task says "diff `VARIABLE_REGISTRY[agentKey]` against `JSON.parse(inputSnapshot)`'s keys" without addressing this, it will ship a diagnostic that always shows every declared variable as missing — the exact opposite of a useful "highest-leverage diagnostic in the design."

### Pitfall 2: Four narrative section writers + `qa` have no `prompt_versions` row — Instructions tab must degrade by default, not by exception

**What goes wrong:** Assuming `promptVersions.getActive({agentKey})` returns a row for every artifact type's resolved agentKey (as D-10 implicitly assumes) leads to an Instructions tab that silently renders empty/broken for `founder` artifacts pointing at `origin_story`/`problem`/`founder_bio`/`case_study`, and for every `qa` artifact — likely the MOST common artifact types operators will inspect.

**Why it happens:** `config_loader.py`'s `SYSTEM_PROMPT_KEYS` (the 11 agentKeys with real `prompt_versions` rows: `scout`, `advocate`, `editor_gate1`, `editor_final`, `calibrator`, `researcher`, `design`, `game`, `bonus_big_budget`, `bonus_jingle`, `bonus_spec_ad`) explicitly excludes `chronicler`/`qa`/`origin_story`/`problem`/`founder_bio`/`case_study` — its own comment says "deliberately ABSENT — no .md migrated this phase." These agents build their prompts via direct Python f-string interpolation (`lib/voice.py::build_section_writer_prompt()`, confirmed at `founder_bio.py:173-183`), not `.replace()` on an externalized template, and are not editable via Agent Instructions/prompt-lab at all today.

**How to avoid:** For these 5 agentKeys, `getActive` returning `null` is the *expected, permanent* state, not a loading/error state. Render an explicit "this agent's instructions are not yet externalized — code-defined, not editable here" message (distinct from "no active version yet" for agents that DO support prompt-lab but haven't been seeded). For "shared rules referenced" on these 5, fall back to a hardcoded list derived from source inspection: the 4 narrative writers always receive `VOICE_CONSTRAINTS` (via `style_brief.get("voice") or VOICE_CONSTRAINTS`) and `STRUCTURE_CONTRACT` (appended to `GUIDANCE_VERIFIED`/`GUIDANCE_ANONYMOUS`, confirmed `founder_bio.py:43-66`); `qa` references `rubric` (a real `SINGLETON_ASSET_KEYS` entry, fetchable via `promptVersions.getActive({agentKey: 'rubric'})`).

**Warning signs:** a plan task that treats "Instructions tab" as uniform across all 6 artifact types without a per-agentKey degradation branch.

### Pitfall 3: `editor_gate_1` vs `editor_gate1` — silently wrong prompt-lab/eval-center deep-links for the Gate-1 artifact

**What goes wrong:** Using the `agent_runs`/`PIPELINE_EDGES` key (`editor_gate_1`) directly as the `agentKey` prop passed to `VersionHistoryPanel`/`ScenarioCard`/prompt-lab routes (which all expect `editor_gate1`) silently returns empty/404 results for the `org` artifact type's footer actions — a `rec`-adjacent gap that's easy to miss in manual testing if the tester never happens to inspect a Gate-1-related artifact.

**Why it happens:** confirmed dual-namespace split — `graph/builder.py:105` / `pipelineTopology.ts:24` use `editor_gate_1`; `config_loader.py:91`, `VariableRegistry.ts:35`, `agents/editor.py:277` (`acomplete(agent_id="editor_gate1", ...)`), `agentList.ts:83` all use `editor_gate1`. No prior feature needed to cross both namespaces for the same key at once.

**How to avoid:** One explicit alias in the resolver (both directions) — do not assume string equality holds.

### Pitfall 4: `claim_checks` has no `agent` field — CONTEXT.md's D-02 characterization is optimistic

**What goes wrong:** Planning a resolver step that reads `claim.agent` from `claim_checks` (as D-02's phrasing "recorded on the claim_checks row" implies) will fail — the field doesn't exist (`convex/schema.ts:442-466`).

**How to avoid:** Resolve `claim` artifacts to `researcher` (the agent that owns claim sourcing/evidence, confirmed via `factcheck.py:570`'s `agent_id="researcher"`), using `sectionName` (confirmed galley-vocabulary per `factcheck.py:68`'s own comment) as contextual "appears in" metadata via `galleyIdToQaSection`, not as the primary resolution key.

### Pitfall 5: `MyTasksScreen`'s "Inspect context" needs two changes, not one

**What goes wrong:** Wiring `openInspector` into the disabled button (removing `disabled`) without also populating `DerivedTask.insp` in `lib/derivedState.ts::deriveTasks()` ships a button that opens the panel with no artifact key to resolve.

**How to avoid:** `insp?: string` is declared on `DerivedTask` (`derivedState.ts:47`) but never assigned in any of the three task-construction blocks (qaFindings/claimRows/sign-offs, lines 396-462). Both the button-enable AND the `insp` population are Phase 44 work. Sign-off tasks (`signoff-facts`/`signoff-voice`) have no single natural artifact — flagged as an open question below.

### Pitfall 6: The existing resume endpoint cannot serve generic "Restart from this step"

**What goes wrong:** Assuming `POST /run/{run_id}/resume` can be parameterized to restart from an arbitrary step.

**Why it happens:** confirmed at `packages/pipeline/src/eisenbalm_pipeline/api/runs.py:435-498` — `_resume_paused_run` is hardcoded to `Command(resume={"editorSelection": charity_name})`, built exclusively for the Gate-1 `interrupt()` (the one and only `interrupt()` call site in the graph). There is no generic "resume graph execution from node X" mechanism.

**How to avoid:** Render "Restart from this step" as a reserved control (D-08's explicit fallback) for all 6 artifact types in this phase — do not attempt to wire it to the resume endpoint, which would either silently no-op or misfire a Gate-1-shaped payload at a non-Gate-1 step.

## Code Examples

### The truncation boundary the missing-inputs diff must respect (D-05)

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py:64-82
def _truncate(s: str) -> str:
    """Truncate long strings to 2000 characters."""
    if len(s) <= 2000:
        return s
    return s[:2000] + "...[truncated]"

def _snapshot_input(agent_key: str, state: dict) -> str:
    keys = _INPUT_KEYS.get(agent_key, ["run_id"])
    slice_: dict[str, Any] = {k: state.get(k) for k in keys if k in state}
    try:
        return _truncate(json.dumps(slice_, default=str))
    except Exception as exc:
        return json.dumps({"_snapshot_error": repr(exc)})
```

If the planner takes the `inputKeys` additive-field route (D-05), it should be emitted alongside this call — `list(slice_.keys())`, computed BEFORE `_truncate()` — in the same `savePayload` mutation call at `agent_wrapper.py:176-185`.

### The reusable section↔agentKey bridge (do not reinvent)

```typescript
// apps/dispatch-control/lib/galley/sectionIdMap.ts
export function galleyIdToQaSection(galleyId: string): string | null {
  return GALLEY_TO_QA[galleyId] ?? null   // e.g. 'founderBio' -> 'founder_bio'
}
```

### The human-readable-first pattern to mirror exactly (INS-02, D-06/D-07)

```typescript
// apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx:60-80
function summarize(raw: string | undefined): string {
  if (!raw) return '—'
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed as Record<string, unknown>).slice(0, 6)
      return keys.length > 0 ? keys.join(', ') : '(empty object)'
    }
    if (Array.isArray(parsed)) return `array (${parsed.length} items)`
    return String(parsed).slice(0, 120)
  } catch {
    return raw.slice(0, 120)
  }
}
```

### The existing conditional-action-prop pattern to follow for the draft/voice entry points

```typescript
// apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx:25-31, 76-97
interface UnresolvedFindingCardProps {
  finding: UnresolvedFinding
  runId?: string
  sectionId?: string
  onEditSection?: (sectionId: string, findingId?: string) => void
  // Phase 44: add `onInspect?: (sectionId: string) => void` following this exact
  // optional-callback-prop convention — the render gate is `Boolean(onInspect)`,
  // matching `canEdit`/`canDismiss` above.
}
```

## State of the Art

Not applicable as a library-evolution table (no external libraries). The relevant "state of the art" for this phase is **the codebase's own state as of 2026-07-15 vs. what CONTEXT.md characterizes** — the reconciliation table below is the load-bearing equivalent for a pure-internal phase.

| CONTEXT.md characterization | Verified reality | Impact |
|---|---|---|
| "supplied = top-level keys parsed from `inputSnapshot`" is a workable diff against `VARIABLE_REGISTRY` | The two vocabularies (DispatchState field names vs. `{token}` names) essentially never intersect — see Pitfall 1 | Diff must be redefined onto declared-state-inputs, not declared-prompt-tokens, or it produces a false-positive on every agent |
| "the canonical `characterization_examples` example" | Does not exist anywhere in the real pipeline or console code — prototype-only flavor text | Do not use it as a literal test fixture; pick a real missing-state-input example instead |
| claim → "the producing writer/researcher recorded on the claim_checks row (Phase 35/42 already carry sectionName/agent)" | `claim_checks` has `sectionName` but **no `agent` field** (`convex/schema.ts:442-466`) | Resolve `claim` → `researcher` structurally (via `factcheck.py`'s `agent_id="researcher"`), not via a row field that isn't there |
| `signal`/`org` degrade gracefully because Phase 46/47 haven't shipped | True for `signal`; **false for `org`** — `StoryPanelContent.tsx`'s org/candidate cards are real, live, and resolvable to `scout` today | `org` entry point should ship as a LIVE deep-link in Phase 44, not a degraded stub |
| "Reuse `AgentIOPanel`'s... slide-over structure and its `summarize()`/`prettyJson()` helpers" | Confirmed present and directly reusable, verbatim | No correction — this one holds exactly as characterized |

## Open Questions

1. **Do sign-off tasks (`signoff-facts`/`signoff-voice`) in My Tasks get an `insp` value?**
   - What we know: `DerivedTask.insp` is unpopulated for all task types today; sign-off tasks have `where: 'Approval'` and no natural single agentKey (facts-cleared touches many claims/agents; sounds-human touches the whole issue).
   - What's unclear: whether "Inspect context" should stay reserved for just these two rows, or loosely map to `rec`/`qa`.
   - Recommendation: leave `insp` unset for sign-off tasks specifically (button naturally stays disabled/reserved for just those two rows, per the existing conditional-prop convention) — this is honest, not a regression, since there is no single artifact a sign-off gate is "about."

2. **Should the new panel also supersede `AgentIOPanel` inside Run Details (System Workbench)?**
   - What we know: Annotations.md §Run Details says "Selecting any step opens the same inspector used everywhere else" — but Run Details/Workbench screens are introduced as "phase 2" scope in the same document's intro, and CONTEXT.md's six canonical entry points do not include Run Details.
   - What's unclear: whether this is in-scope for Phase 44 or a natural (but separate) follow-up once the new panel exists.
   - Recommendation: out of scope for Phase 44's required six entry points; note as a natural DRY follow-up (`AgentIOPanel` and the new panel would then share even more code) rather than silently expanding scope.

3. **Does the "prior-real" input mode in `api/agents.py::_load_prior_input` actually mis-substitute today?**
   - What we know: the vocabulary mismatch (Pitfall 1) structurally predicts unsubstituted `{token}` placeholders whenever `prior_run_id` is used against a real run for an agent with `_INPUT_KEYS` ≠ `VARIABLE_REGISTRY` names.
   - What's unclear: whether this has been observed/reported, or whether some intermediate transformation exists that this research pass didn't surface (`test_test_run.py` wasn't fully read end-to-end).
   - Recommendation: flag for the planner as a "worth a 10-minute manual check" item, not a blocking dependency of Phase 44 — it corroborates Pitfall 1's severity but fixing it (if broken) is out of this phase's scope.

## Environment Availability

Skipped — this phase has no external service/tool/runtime dependencies. It is entirely internal TypeScript (Convex queries, React components) and one small, additive Python change (the `inputKeys` field, if taken) inside the already-running pipeline package.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Console framework | Vitest (`apps/dispatch-control`) |
| Config file | `apps/dispatch-control/vitest.config.ts` |
| Pipeline framework | pytest (`packages/pipeline`) |
| Pipeline config | `packages/pipeline/pyproject.toml` (`testpaths = ["tests"]`) |
| Quick run command (console) | `pnpm --filter dispatch-control test -- __tests__/inspectorArtifact.test.ts` (or whatever the resolver test file is named) |
| Full suite command (console) | `pnpm --filter dispatch-control test` (= `vitest run`) |
| Quick run command (pipeline, only if `inputKeys` additive field is taken) | `cd packages/pipeline && pytest tests/test_agent_wrapper.py -x` |
| Full suite command (pipeline) | `cd packages/pipeline && pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INS-01 | Resolver maps all 6 artifact types (including `editor_gate_1`/`editor_gate1` alias, `bonus` variant selection, `founder_bio` sectionId round-trip) to the correct agentKey | unit | `vitest run __tests__/inspectorArtifact.test.ts` | ❌ Wave 0 |
| INS-01 | Each of the 6 entry points calls the same `openInspector` (one panel instance, not six) | unit/integration | `vitest run __tests__/InspectorProvider.test.tsx` | ❌ Wave 0 |
| INS-02 | Technical tab never renders as the default tab; every other tab has non-JSON content first | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ Wave 0 |
| INS-03 | Missing-inputs diff never falsely reports a supplied (but truncated-away) key as missing | unit | `vitest run __tests__/missingInputsDiff.test.ts` (feed a >2000-char captured state slice, assert no false "missing") | ❌ Wave 0 |
| INS-03 | Diff degrades honestly for agents whose `_INPUT_KEYS`/declared-state-inputs constant is empty/unknown | unit | same file as above | ❌ Wave 0 |
| INS-04 | Instructions tab renders "not externalized" (not blank/broken) for `origin_story`/`problem`/`founder_bio`/`case_study`/`qa` | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ Wave 0 |
| INS-04 | `editor_gate_1` artifact correctly deep-links using the `editor_gate1` alias | unit | `vitest run __tests__/inspectorArtifact.test.ts` | ❌ Wave 0 |
| INS-05 | Output tab never asserts "unchanged"/"current" without positive evidence | unit | `vitest run __tests__/outputDivergence.test.ts` | ❌ Wave 0 |
| INS-06 | "Restart from this step" renders reserved (not wired to `/run/{id}/resume`) for all artifact types | unit | `vitest run __tests__/InspectorPanel.test.tsx` (assert button disabled + explanatory title) | ❌ Wave 0 |
| INS-06 | Live footer actions (Improve this agent, Compare versions, Related tests, Prior/downstream) deep-link with the correct agentKey namespace | unit | `vitest run __tests__/InspectorPanel.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant single test file from the table above.
- **Per wave merge:** `pnpm --filter dispatch-control test` (full console vitest suite — must stay green across all prior-phase tripwires, e.g. `claimProvenance.test.ts`, `sectionIdMap.test.ts`, `derivedState.test.ts`).
- **Phase gate:** full console vitest suite green, plus `cd packages/pipeline && pytest tests/test_agent_wrapper.py` green if the `inputKeys` schema change is taken, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/inspectorArtifact.test.ts` — covers INS-01 (resolver correctness, including the `editor_gate_1`/`editor_gate1` alias and `bonus` variant selection)
- [ ] `apps/dispatch-control/__tests__/missingInputsDiff.test.ts` — covers INS-03 (truncation-honesty, the redefined declared-state-inputs diff)
- [ ] `apps/dispatch-control/__tests__/InspectorPanel.test.tsx` — covers INS-02/INS-04/INS-06 (tab defaults, degradation states, footer live-vs-reserved)
- [ ] `apps/dispatch-control/__tests__/outputDivergence.test.ts` — covers INS-05
- [ ] `apps/dispatch-control/__tests__/InspectorProvider.test.tsx` — covers the one-instance/`openInspector` context contract
- [ ] No pipeline-side test gap unless the `inputKeys` additive field is taken, in which case extend the existing `packages/pipeline/tests/test_agent_wrapper.py` (already tests `savePayload` emission end-to-end) rather than creating a new file.

## Sources

### Primary (HIGH confidence — direct file reads, this repository)
- `.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md` — locked decisions, canonical refs.
- `.planning/REQUIREMENTS.md` (INS-01..06, lines 378-384).
- `.planning/PROJECT.md` (milestone framing, reconciliation facts, lines 1-50).
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §8 (InspectorArtifact contract), §7 (11 action-named steps), §9 (Ask agent to revise, deferred).
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` (§Inspect how this was made, §Screen: Draft/Fact Check/Voice/Approval/My Tasks, §Run Details).
- `docs/API_CONTRACTS.md` lines 4148, 4270-4470 (§40/§42 — provenance card shape, `insp?` forward references).
- `convex/schema.ts` lines 295-517 (`prompt_versions`, `agent_runs`, `agent_run_payloads`, `claim_checks`, `sign_offs`, `issues`).
- `convex/agentRuns.ts`, `convex/promptVersions.ts` (full read).
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` (full read — `_INPUT_KEYS`, `_truncate`, `_snapshot_input`/`_snapshot_output`, `wrap_agent_node`).
- `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` lines 83-220 (`AGENT_KEY_TO_PROMPT_FILE`, `SYSTEM_PROMPT_KEYS`, `SECTION_GUIDANCE_KEYS`).
- `packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py`, `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` (`build_section_writer_prompt`), `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py`, `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` (`_extract_sections`).
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` (node registration, `editor_gate_1`).
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` (PRM-05 test-run endpoint, `_load_prior_input`, `SAMPLE_FIXTURES`).
- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` lines 68, 148-211, 502-611 (`sectionName` galley-vocabulary comment, `agent_id="researcher"`).
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` lines 435-503 (`_resume_paused_run`, Gate-1-specific resume).
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` (`AgentCost` TypedDict — confirmed no `model` field).
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` line 269 (`modelVersions` only reaches Sanity).
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` (full read).
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` (full read).
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` (full read).
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts` (full read).
- `apps/dispatch-control/lib/galley/sectionIdMap.ts` (full read).
- `apps/dispatch-control/lib/derivedState.ts` (full read — `DerivedTask.insp`, `deriveTasks`).
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` (grep for `onInspect`).
- `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` (grep + read, lines 140-210).
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` (Phase 41 Issue Workspace frame, full read).
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` (full read).
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx` (full read).
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` (grep for "recommendation").
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx` (grep for sectionName/finding).
- `apps/dispatch-control/components/galley/UnresolvedFindingCard.tsx`, `AnnotationMark.tsx`, `GallerySection.tsx` (full/partial reads).
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx`, `apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx` (grep for agentKey props, confirming footer deep-link targets exist).
- `apps/dispatch-control/vitest.config.ts`, `packages/pipeline/pyproject.toml`, `packages/pipeline/tests/test_agent_wrapper.py`, `packages/pipeline/tests/test_test_run.py` (test infra confirmation).

No Secondary/Tertiary sources — this phase required zero WebSearch/Context7/external documentation lookups; every claim above is a direct citation against the repository as of 2026-07-15.

## Metadata

**Confidence breakdown:**
- Resolver mapping (D-01/D-02) — HIGH: sourced directly from `sectionIdMap.ts` + QA's `_extract_sections`, both fully read.
- Missing-inputs diff (D-04/D-05, Pitfall 1) — HIGH: both vocabularies (`_INPUT_KEYS` and `VARIABLE_REGISTRY`) fully read and directly compared; the mismatch is exact, not inferred.
- Panel shell reuse (D-06/D-07) — HIGH: `AgentIOPanel.tsx` fully read, directly reusable.
- Entry-point wiring (INS-01) — HIGH for 5 of 6 (direct component reads); MEDIUM for the "draft passage toolbar" full-toolbar interpretation (the section-level-affordance recommendation is a judgment call, clearly flagged as such, not a verified fact).
- Diagnostics "model" field gap — HIGH: `agent_runs` schema fully read, `cost.py`'s `AgentCost` TypedDict fully read, confirms no field exists.
- Footer deep-link targets (INS-06) — HIGH: `VersionHistoryPanel.tsx`/`ScenarioCard.tsx` confirmed to exist and take `agentKey` props; `/run/{id}/resume` confirmed Gate-1-specific by reading its full implementation.

**Research date:** 2026-07-15
**Valid until:** Stable — this is internal codebase state, not external library currency. Re-verify only if Phase 45/46/47 land first and change any of the cited files (unlikely given phase ordering, but `claim_checks`, `agent_runs`, or `VariableRegistry.ts` schema changes in an intervening phase would invalidate specific line citations above).
