# Phase 50: Workbench & Nomenclature - Research

**Researched:** 2026-07-16
**Domain:** Copy/nomenclature rename + two additive UI affordances (recovery rail, origin-ref bridge) over an already-95%-shipped Dispatch Control console; zero new external dependencies
**Confidence:** HIGH (every finding below is grounded in direct file reads of the current codebase, not training-data assumption)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The nomenclature table maps to **display strings only** — nav labels, screen headings, button/label text, aria-labels, and prose (including the `how-to-use` glossary). Rename operator-facing copy; do **not** touch code identifiers.
- **D-02:** **Route folder paths stay unchanged** (`/run-monitor`, `/prompt-lab`, `/eval-center`, `/registry`). URLs are not "operator-facing copy." (Route rename → Deferred.)
- **D-03:** **Stored values stay unchanged.** `charities.status` keeps the literal `'blocklisted'`; the audit action stays `charity.blocklisted`; `sign_offs.kind`, `eval_scores.source`, `prompt_versions` keys, and node ids (`editor_gate_1`, `verify_research`, …) are untouched. The `blocklisted → "Do not use"` rename is a **display-label swap** over an unchanged enum.
- **D-04:** The Editorial / System Workbench grouping **already exists** in `lib/nav.ts` (`NAV_GROUPS`). Phase 50 **renames the four Workbench nav items** and each screen's heading, keeps the existing groups, ensures the two groups read as **visibly distinct**.
- **D-05:** **Add the signed-in role indicator** (net-new). Source it from Phase 49's `useRole()` (`lib/role.ts`); render it **bottom-left of the sidebar** per spec §Nav / DERIVED-STATE §6. Presentation-only.
- **D-06:** Introduce **one shared nomenclature/label source of truth** for the renamed terms rather than scattering inline JSX strings. Extend the existing humanized-label precedent (`prompt-lab/_components/agentList.ts` already carries `GROUP_LABELS`/`AGENT_DISPLAY_NAMES`). Opportunistically de-duplicate the ≥5 parallel section/agent label maps where cheap; **full consolidation is not required** (→ Deferred).
- **D-07:** Add a single **action-name mapping** keyed by node/agent key, using **spec §7's exact labels** ("Find story leads" — Signal Editor, "Verify research" — deterministic check, "Draft sections" — seven writing agents, …). The **action is primary; the agent name is secondary metadata**. Replace the Graph spine's `toDisplayName()` and the Runs run-detail table's raw `agentKey` cell with this map. This map should be the D-06 source of truth, retiring the duplicated identity maps where it lands.
- **D-08:** **Reconcile the deterministic-check diamond set to the live 20-node graph.** Diamonds already render for `GATE_KEYS = {verify_research, validate_sections}` (`AgentNode.tsx`); add **`verify_candidates`**, align the set to §7's diamonds, and **fix the stale "three deterministic checks" legend copy** in `how-to-use`. Reuse the existing rotated-marigold-diamond vs black-dot rendering — no new visual system.
- **D-09:** The Run Details header **states plainly whether it is a historical record or a live run** — never the word "Monitor" when nothing is running. Step states use the spec vocabulary: Waiting · Running · Complete · Paused — done · Failed · Skipped.
- **D-10:** Build the **plain-language recovery rail** as a real affordance on a failed run: *what happened / what completed successfully / what did not happen / recommended recovery*, with **downstream steps dimmed and labeled "Skipped"**, plus **"Improve this agent"** deep-linking to Agent Instructions. This is the WBN-03 deliverable and is fully in scope.
- **D-11:** **"Restart from this step" reuses existing primitives** — the per-node re-run (`rerun_agent`, Phase 33/37) and/or `POST /run/{run_id}/resume` (LangGraph AsyncPostgresSaver checkpoint resume). Copy reflects checkpoint reuse ("completed steps are reused, not re-paid") **where the graph/checkpointer actually supports it**. Do **not** build a net-new arbitrary-node checkpoint-resume engine (→ Deferred).
- **D-12:** **Research target:** confirm exactly what "restart from an arbitrary failed step, reusing completed steps" the AsyncPostgresSaver checkpointer already gives us vs. what only per-node re-run covers. If a general reuse-from-node resume isn't available, the control wires to the strongest existing path and the copy states honestly what it does.
- **D-13:** The **"why this draft exists" bridge** renders, on a draft instruction, the specific issue output that motivated it — carried as a stored **origin back-reference** through the inspector's "Improve this agent →" action. If prompt drafts carry no origin field today, add a **small additive field** — **contract-first**. No inference engine; a stored reference.
- **D-14:** Apply the Workbench nomenclature to Prompt Lab / Eval Center copy: **shadow run → "Preview next run"**, **golden scenario → "Standard test case"**, **eval/evals → "Quality test" / "Test changes"**, **commit/activate → "Make active"**, **rollback/restore → "Restore version"**, **"despite the red eval gate" → quality-test phrasing**. The Phase 38 eval commit gate and the Phase 28/38 activate flow wiring stay byte-unchanged — copy only.
- **D-15:** **Typed confirmation is reserved for Mark Do-not-use** (organization name + required reason, Editor-in-chief only). Confirm **Publish carries no typed confirmation** — verify no typed-confirm survives on the publish path.
- **D-16:** Remove the automation **switch framing from the editorial operator surface.** The Masthead "Auto-publish ON" chip (`Masthead.tsx:286`) and `AutoPublishBanner` copy reword to the **"Human approval required"** reassurance register (the OFF case was already reworded in Phase 40 — finish the ON chip + banner). The automation setting itself stays in **Config / Operations** (`/config`) — treat that as the Administration home. **Do not build a new Administration screen** (→ Deferred); optionally note Config as "Administration."

### Claude's Discretion
- Exact structure/location of the shared nomenclature label module (D-06); how aggressively to consolidate the duplicated label maps.
- Diamond-set final membership against the live topology (D-08) once §7 is mapped to the 20 real nodes; whether `validate_sections`/publisher render as diamonds per §7.
- Recovery-rail layout/wording within the 1c system (D-10); which existing primitive "Restart from this step" binds to (D-11/D-12), pending research.
- The "why this draft exists" origin-ref field shape + where it's captured (D-13), contract-first.
- Whether to rename the "Config"/"Operations" nav label to "Administration" (D-16) or leave it.

### Deferred Ideas (OUT OF SCOPE)
- **Route folder / URL renames** (`/run-monitor` → `/run-details`, etc.) + redirects — out of scope (D-02).
- **Stored enum / node-id / audit-action renames** (`blocklisted`, `editor_gate_1`, `charity.blocklisted`) — out (D-03).
- **Full de-duplication of the ≥5 label maps** — only opportunistic consolidation this phase (D-06).
- **A dedicated Administration screen** — out (D-16); Config stays the admin home.
- **A net-new arbitrary-node checkpoint-resume engine** — out (D-11).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WBN-01 | Nav splits into two visibly distinct groups — Editorial and System Workbench — with the signed-in role shown | `lib/nav.ts` groups already exist and only need label renames (confirmed); `useRole()`/`LockedControl.tsx` exist for D-05's role indicator; `AppSidebar.tsx` is the exact mount point (see Code Examples) |
| WBN-02 | Run Details names steps by action, renders deterministic checks as diamonds, states historical-vs-live | Full node-key → §7 action-name → diamond? table built below from `builder.py` (20 nodes) vs. stale `pipelineTopology.ts` (18 nodes, missing `signal_editor`/`verify_candidates`) — this file is the load-bearing blocker for WBN-02 and must be updated before the action-map can render correctly |
| WBN-03 | Failed run shows a plain-language recovery rail with Restart-from-step + Improve-this-agent; downstream steps dim as Skipped | `InspectorFooter.tsx`'s existing "Always RESERVED" `RESTART_TITLE` comment (44-RESEARCH.md Pitfall 6) already diagnosed the exact gap this phase must resolve; `rerun_agent` (writers only), `_resume_paused_run`/`adjudicate` (Gate-1 pause only), and `manual_publish` (Publisher-only, secret-guarded not Clerk-guarded) are the three real primitives — see Pitfall 1 below for the full honesty matrix |
| WBN-04 | Agent Instructions shows why a draft instruction exists, linking to the issue output that motivated it | `prompt_versions` schema confirmed to have no origin/motivated-by field (only free-text `note`); `InspectorFooter.tsx`'s "Improve this agent →" is the confirmed capture/deep-link seam |
| WBN-05 | Nomenclature table applied consistently — no legacy term survives | `how-to-use/page.tsx` confirmed as the densest hot spot (7+ legacy terms); `roleGateInventory.test.ts` (Phase 49) is the exact tripwire pattern to clone for an nomenclature-sweep test; **critical conflict found**: quick-task 260710-k8y already shipped a DIFFERENT, non-binding vocabulary ("Make live", "Rehearsal", "LIVE") that contradicts the binding spec's "Make active"/"Test changes"/"active version" — must be reconciled, not just left alone |
| WBN-06 | Typed confirmation reserved for Mark Do-not-use; automation toggle leaves the operator surface | `RegistryTable.tsx` confirmed to have reason-only confirm (no typed org-name step yet); `charities.ts::setStatus` already server-enforces non-empty `reason` + Editor-in-chief gating (Phase 43/49) — only the typed-name UI step + the Masthead/Banner ON-copy reword are net-new |
</phase_requirements>

## Summary

Phase 50 is a **copy-and-reconciliation** phase layered on top of a console that is ~95% built. There is no new library, no new service, and — for five of its six requirements — no new backend logic; the work is (a) renaming display strings against a verbatim binding table, (b) fixing a **stale static topology file** that undercounts the live pipeline by two nodes, and (c) being **honest in copy** about a checkpoint-resume capability that is much narrower than the binding spec's prose implies.

The single most consequential technical finding is that `apps/dispatch-control/.../pipelineTopology.ts` — the file every Run Details/graph rendering surface reads for node list, edges, and the diamond (`GATE_KEYS`) set — is **stale relative to `packages/pipeline/.../graph/builder.py`**. `builder.py` compiles to 20 nodes (confirmed by Phase 46/48 STATE.md entries and a direct read of the file); `pipelineTopology.ts` still declares 18 nodes and has no entries at all for `signal_editor` or `verify_candidates`, and its own test (`pipelineTopology.test.ts`) pins the stale 18-node count as a passing assertion. WBN-02's action-name map and WBN-02/WBN-03's diamond reconciliation (D-08) **cannot be implemented correctly until this file is updated** — this is Wave-0-shaped prerequisite work, not a side effect of the rename.

The second major finding closes D-11/D-12's explicit research question with high confidence, because a **prior phase (44) already investigated and answered it**: `InspectorFooter.tsx`'s `RESTART_TITLE` constant and its inline comment state plainly that the only resume endpoint is hardcoded to the Gate-1 `interrupt()` payload shape, so "Restart from this step" is rendered **"Always RESERVED, for ALL artifact types"** today. Direct reads of `control.py`/`runs.py` confirm and extend this: `rerun_agent` only knows about the 7 section-writer keys; `_resume_paused_run`/`adjudicate` only fires when the graph is genuinely paused at the one `editor_gate_1` interrupt; and a third primitive, `manual_publish` (`POST /run/{run_id}/publish`, WHK-08), can genuinely re-run the Publisher step by re-invoking `_run_publisher` directly against the already-written Sanity draft — but it is guarded by the server-to-server trigger secret, not Clerk, so it isn't reachable from the operator console today. That gives Phase 50 **three step-types with a real, honest "reuse completed work" story** (Draft sections → `rerun_agent`; Choose recommended story's Gate-1 pause → resume/adjudicate; Prepare publication → a new thin Clerk-guarded wrapper around `manual_publish`, mirroring the Phase 37 adjudication-bridge pattern) and **eight step-types with none** (signal_editor, scout, verify_candidates, advocate, chronicler, researcher, verify_research, qa, editor_final). The recovery rail's copy must not claim universal reuse; the safe, honest posture is to keep "Restart from this step" reserved-with-explanation (the existing `LockedControl`/`InspectorFooter` pattern already proves this UI shape) for the eight unsupported step-types and wire it live only where a real primitive exists.

The third finding is a **direct nomenclature conflict already in the repo**: quick-task `260710-k8y` (2026-07-10) shipped a Prompt Lab rename pass using its own vocabulary — "Rehearsal" (not "Test changes"), "Make live" / "LIVE badge" (not "Make active" / "active version"), "Restore this version" (kept, matches). This predates and contradicts the now-binding §Workbench nomenclature table. The WBN-05 sweep must specifically hunt for and correct these newer-but-still-wrong strings, not just the older "commit"/"rollback"/"eval" terms — a keyword-only sweep for the old terms would sail past this conflict entirely.

**Primary recommendation:** Sequence Phase 50 as (1) fix `pipelineTopology.ts` to the live 20-node graph + reconcile `GATE_KEYS` to §7's diamond set — a prerequisite, not cosmetic; (2) build the D-06 nomenclature/action-name source-of-truth module and wire it into the Graph spine + `RunDetail.tsx` + the recovery rail; (3) build the recovery rail with an honest three-tier "Restart from this step" wiring (writers/gate-1/publisher-wrapper LIVE, everything else RESERVED with an explanation copying the `InspectorFooter` pattern); (4) do the D-13 additive `prompt_versions` origin-ref field, contract-first; (5) sweep every legacy-term hot spot (`how-to-use` densest, then Prompt Lab/Eval Center/Registry/Masthead/Banner), explicitly including the 260710-k8y conflict terms; (6) build a `roleGateInventory.test.ts`-style source-scan tripwire proving no banned term remains in operator-facing copy.

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** direct file edits outside a GSD command (`/gsd:execute-phase`, `/gsd:quick`, `/gsd:debug`) are disallowed by project convention — the planner should assume execution happens through `/gsd:execute-phase`.
- **Contract-first (hard rule):** any additive Convex field, enum/field-value change, or new endpoint shape MUST be checked against `docs/API_CONTRACTS.md` and amended there BEFORE code. This directly gates D-13 (the `prompt_versions` origin-ref field) and any Clerk-guarded wrapper endpoint built for the Publisher-restart primitive.
- **Strict build gate:** `pnpm --filter dispatch-control build` (or the monorepo's `build:dispatch-control` script) must exit 0 before declaring frontend work done — `vitest` alone does not type-check. This has caught latent bugs in at least one prior phase (Phase 27) that only surfaced on `next build`.
- **Convex live sync:** any change to `convex/*.ts` must be followed by `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797` before the phase can be considered deployed-correct (Phase 39 shipped a prod 500 by skipping this) — applies if D-13's additive field requires a Convex mutation-arg change.
- **Never rename stored field values without checking API_CONTRACTS.md first** — directly reiterated by D-03 for the `blocklisted` enum.
- **Security/tech stack is locked** (Next.js 14+, Sanity v3, FastAPI/LangGraph, OpenRouter, Supabase, Convex, Stripe) — not implicated by this phase (no new integration surface).

## Standard Stack

Not applicable in the conventional sense — Phase 50 introduces **zero new libraries, services, or infrastructure**. It is a copy/reconciliation pass over an existing Next.js 14 (App Router) + Convex + FastAPI/LangGraph stack, reusing:

| Existing asset | Role in Phase 50 |
|---|---|
| `@clerk/nextjs` `useUser()` (already wrapped by `lib/role.ts`'s `useRole()`) | D-05 role indicator data source |
| `components/LockedControl.tsx` | Reused verbatim for "Restart from this step" reserved-state rendering on unsupported node types |
| `@xyflow/react` (React Flow) + `dagre` (`useGraphLayout.ts`) | Unchanged — the graph canvas Run Details' step visualization already runs on |
| `vitest` + the project's recursive-fs source-scan test pattern (`dispatch-control-no-sanity-write.test.ts`, `roleGateInventory.test.ts`) | Reused verbatim as the WBN-05 nomenclature-sweep tripwire's test infrastructure |
| LangGraph `AsyncPostgresSaver` (already wired in `packages/pipeline/.../graph/checkpointer.py`) | Not extended — D-11 explicitly forecloses new checkpoint-resume engineering |

**Version verification:** not applicable — no package.json/pyproject.toml dependency changes are anticipated for this phase. If planning surfaces a need for a new dependency (none identified in this research), re-verify against the registry before adding it.

## Architecture Patterns

### Recommended structure for the D-06 nomenclature source of truth
The codebase already has a proven precedent for exactly this kind of module: `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts`, which exports `GROUP_LABELS`, `AGENT_DISPLAY_NAMES`, and a `displayNameForAgentKey()` resolver with a deterministic fallback (`humanizeAgentKey()`). Recommend a **sibling module** (e.g. `apps/dispatch-control/lib/nomenclature.ts` or `lib/actionNames.ts`) exporting at minimum:

```typescript
// Source: pattern mirrors apps/dispatch-control/.../prompt-lab/_components/agentList.ts
export interface RunStep {
  actionLabel: string      // "Find story leads" — primary, per §7
  agentLabel: string       // "Signal Editor" — secondary metadata
  isDeterministicCheck: boolean  // renders as a diamond, never called "gate" in copy
}

export const RUN_STEP_MAP: Record<string, RunStep> = {
  signal_editor:     { actionLabel: 'Find story leads',        agentLabel: 'Signal Editor',      isDeterministicCheck: false },
  scout:             { actionLabel: 'Find organizations',      agentLabel: 'Scout',               isDeterministicCheck: false },
  verify_candidates: { actionLabel: 'Verify organizations',    agentLabel: 'deterministic check',  isDeterministicCheck: true  },
  advocate:          { actionLabel: 'Make the case',            agentLabel: 'Advocate',             isDeterministicCheck: false },
  editor_gate_1:     { actionLabel: 'Choose recommended story', agentLabel: 'Agent Editor',        isDeterministicCheck: false },
  researcher:        { actionLabel: 'Research the issue',      agentLabel: 'Researcher',           isDeterministicCheck: false },
  verify_research:   { actionLabel: 'Verify research',         agentLabel: 'deterministic check',  isDeterministicCheck: true  },
  // 7 writers all collapse to ONE displayed step (see Pitfall 4):
  origin_story:      { actionLabel: 'Draft sections', agentLabel: 'seven writing agents', isDeterministicCheck: false },
  // ...problem/founder_bio/case_study/game/bonus/design mirror origin_story
  qa:                { actionLabel: 'Check the draft',         agentLabel: 'QA',                  isDeterministicCheck: false },
  editor_final:      { actionLabel: 'Recommend publication',   agentLabel: 'Agent Editor Final',  isDeterministicCheck: false },
  publisher:         { actionLabel: 'Prepare publication',     agentLabel: 'Publisher',            isDeterministicCheck: true  },
}
```

Two node keys have **no §7 entry at all** — `calibrator` and `chronicler` — see Pitfall 5 (Open Question) for handling.

### Pattern: reserved-with-explanation controls (already established, Phase 44/49)
`InspectorFooter.tsx`'s `FooterAction` component and `LockedControl.tsx` both implement the exact "visible, disabled, explained — never hidden" pattern the recovery rail's per-step "Restart from this step" needs. Reuse this shape rather than inventing a new one:
```typescript
// Source: apps/dispatch-control/components/inspector/InspectorFooter.tsx:66-67, 112-117
const RESTART_TITLE =
  'Completed steps are reused, not re-paid — general step restart is not yet wired (Gate-1 resume only).'
// ...
return (
  <button type="button" disabled title={disabledTitle} className={RESERVED_CLASSES}>
    <Icon size={13} aria-hidden="true" />
    {label}
  </button>
)
```
Phase 50 should **upgrade** this for the three step-types that now have real primitives (writers, Gate-1 pause, and — if the planner scopes the thin wrapper — Publisher) rather than leave the blanket-reserved posture from Phase 44.

### Pattern: source-scan tripwire test (proven twice — EDT-05, ROL-02)
`dispatch-control-no-sanity-write.test.ts` and `roleGateInventory.test.ts` are the two existing precedents for a recursive-fs regex-scan test that fails CI on a forbidden/required pattern. WBN-05's "no legacy term survives" claim should be proven the same way — see Validation Architecture below for the concrete design.

### Anti-Patterns to Avoid
- **Do not treat "Restart from this step" as a single boolean (available/unavailable) across all step types** — the honest state is per-step-type (3 of 11 wired, 8 of 11 reserved). A single global reserved/live flag would either falsely enable it everywhere or leave the 3 real cases needlessly reserved.
- **Do not sweep only for the OLD legacy terms** ("gate", "node", "eval", "golden scenario", "shadow run", "blocklisted", "commit") — the 260710-k8y conflict proves a *newer* wrong vocabulary ("Make live", "Rehearsal", "LIVE") can already be sitting in the tree, undetected by a sweep keyed only to the historically-known bad words.
- **Do not assume `pipelineTopology.ts`'s 18-node list is current** — it is stale as of this research (missing `signal_editor`/`verify_candidates`); treat it as a known-stale artifact requiring an update, not read-only reference data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disabled-with-visible-explanation control | A new "locked pill" component | `components/LockedControl.tsx` (accepts any single interactive child, clones it disabled + `aria-describedby`) | Already a11y-correct (WCAG AA, no CSS-only-inert trap) and used across Phase 49's six role-gated actions |
| Role-aware rendering | A new client role fetch | `lib/role.ts`'s `useRole()`/`useIsEditor()` | Already presentation-only-labeled and wired to Clerk `publicMetadata.role` |
| Source-of-truth for editable agent keys | A new hand-maintained agent list | `listEditableAgentKeys()` in `agentList.ts` (unions `VARIABLE_REGISTRY` + `PIPELINE_NODES`) | Already brand-agnostic/data-driven; extend it, don't duplicate it — but note it currently MISSES `signal_editor` (Pitfall 6) |
| Checkpoint-resume for an arbitrary failed node | A new "resume from node N" LangGraph wrapper | Nothing — deliberately out of scope (D-11) | The three existing primitives (`rerun_agent`, `_resume_paused_run`, `manual_publish`) cover the only cases that can honestly claim reuse; building a fourth, generic mechanism is explicitly deferred |

**Key insight:** almost everything Phase 50 needs to *render* already exists as a component or pattern in the codebase; the actual net-new engineering surface is small (one Convex field, one thin Clerk-guarded wrapper endpoint if the planner chooses to wire the Publisher-restart case, one topology-file fix, one nomenclature module). Most of the phase is careful, verbatim, discretely-tested copy work plus one honest scoping decision about what "Restart from this step" can truthfully promise.

## Common Pitfalls

### Pitfall 1: "Restart from this step" has real backing for only 3 of 11 named steps
**What goes wrong:** The recovery rail's copy (per D-11's exact wording: "completed steps are reused, not re-paid") gets applied uniformly to every failed step, when only three step-types have a primitive that actually reuses completed work.
**Why it happens:** The binding spec (§7) describes "Restart from this step" as a single named affordance without step-by-step distinguishing which steps support real reuse; a literal reading suggests it's universal.
**How to avoid:** Use this concrete honesty matrix (grounded in direct reads of `control.py`/`runs.py`):

| §7 step | Node key(s) | Existing primitive | Real reuse? |
|---|---|---|---|
| Find story leads | `signal_editor` | none | No — full re-run only |
| Find organizations | `scout` | none | No |
| Verify organizations ◆ | `verify_candidates` | none | No |
| Make the case | `advocate` | none | No |
| Choose recommended story | `editor_gate_1` (+ `chronicler`) | `POST /run/{run_id}/resume` / `POST /issues/{run_id}/adjudicate` — but ONLY fires for the deliberate `interrupt()` pause on an ambiguous winner, not a genuine node failure | Yes, for the pause case only |
| Research the issue | `researcher` | none | No |
| Verify research ◆ | `verify_research` | none | No |
| Draft sections | `origin_story`/`problem`/`founder_bio`/`case_study`/`game`/`bonus`/`design` | `POST /runs/{run_id}/agents/{agent_key}/rerun` (`rerun_agent`) — re-runs the bare node fn and overlays checkpoint state so siblings are genuinely preserved | Yes |
| Check the draft | `qa` | none | No |
| Recommend publication | `editor_final` | none | No |
| Prepare publication ◆ | `publisher` | `POST /run/{run_id}/publish` (`manual_publish`, WHK-08) re-invokes `_run_publisher` directly against the Sanity draft — genuinely reuses all upstream work since it needs no graph state at all — but is `_require_trigger_secret`-guarded (server-to-server), NOT Clerk-guarded, so it is unreachable from the dashboard today | Yes, if a thin Clerk-guarded wrapper is added (mirrors the Phase 37 `adjudicate` bridge pattern exactly) |

**Warning signs:** any recovery-rail copy or component that renders "Restart from this step" as live/clickable for `scout`, `verify_candidates`, `advocate`, `researcher`, `verify_research`, `qa`, or `editor_final` failures without a new backing endpoint is over-claiming. `InspectorFooter.tsx`'s existing `RESTART_TITLE` string is the honest template to reuse for these eight.

### Pitfall 2: `pipelineTopology.ts` is stale — missing `signal_editor` and `verify_candidates` entirely
**What goes wrong:** D-08's diamond reconciliation and D-07's action-name map are both specified as edits *on top of* the existing topology/graph rendering — but that file (`apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts`) still declares `PIPELINE_NODES` with exactly 18 entries and `PIPELINE_EDGES` with no `signal_editor`/`verify_candidates` edges, while `packages/pipeline/.../graph/builder.py` compiles to a confirmed 20 nodes (Phase 46 STATE.md: "graph compiles to exactly 20 nodes"). `pipelineTopology.test.ts` currently PASSES an assertion pinning the stale 18-node count (`expect(PIPELINE_NODES).toHaveLength(18)`), so this drift is silent to CI.
**Why it happens:** Phase 46/48 (backend-only tracks, explicitly "independent of the console phases") grew the graph without a corresponding frontend topology update — a legitimate, called-out gap (`PROJECT.md` line 44 itself says "The prototype's Run Details step list is aspirational on exactly these two points" (Signal Editor + verify-candidates), written before Phase 46 shipped and now itself stale).
**How to avoid:** Treat updating `pipelineTopology.ts` (add both nodes + their real edges from `builder.py`'s conditional-edge routing + update `pipelineTopology.test.ts`'s node count and any "does NOT introduce a third gate" assertion) as a **prerequisite task**, not an optional nice-to-have folded into the diamond work. Without it, the Run Details step list simply cannot render `signal_editor`/`verify_candidates` at all, regardless of how good the D-06/D-07 label map is.
**Warning signs:** `grep -c` for `signal_editor`/`verify_candidates` in `pipelineTopology.ts` returning zero (confirmed at research time).

### Pitfall 3: 260710-k8y already shipped a conflicting Prompt Lab vocabulary
**What goes wrong:** A prior quick-task (`260710-k8y`, 2026-07-10) renamed Prompt Lab UI strings to its own vocabulary, independently of the (later-ratified) binding Workbench nomenclature table. Confirmed still live in the tree:
- `TestRunPanel.tsx:195` renders heading `"Rehearsal"` — binding spec says the workflow label is **"Test changes"**.
- `VersionHistoryPanel.tsx:232` renders badge text `"LIVE"` and buttons `"Make live"` / `"Making live…"` (line 273/281) — binding spec's verbatim table says **"Make active"**, never "commit"/"rollback" — and "LIVE" as a state name isn't in the spec's "active version, draft, tested/not-yet-tested" vocabulary either.
- `TestRunPanel.tsx:314` renders `"Draft vs. live"` compare action — spec vocabulary is "Compare results".
**Why it happens:** the quick-task's own PROPOSAL.md was an ad-hoc, un-coordinated nomenclature effort that predates Phase 50's binding spec; nothing forced reconciliation at the time.
**How to avoid:** the WBN-05 sweep must explicitly include these THREE newer strings (`Rehearsal`, `Make live` / `LIVE`, `Draft vs. live`) in its search-and-replace / tripwire list — a sweep keyed only to the spec's own "old" column (gate/node/commit/eval/golden scenario/shadow run/blocklisted) will not catch them, because they are not old-old, they are recently-wrong.
**Warning signs:** any grep for the literal strings `"Rehearsal"`, `"Make live"`, `>LIVE<` inside `apps/dispatch-control/app/(dashboard)/prompt-lab/` returning hits post-Phase-50 is a regression.

### Pitfall 4: the seven parallel writers collapse into ONE displayed step, but the current UI shows them as separate rows
**What goes wrong:** §7's step 8 ("Draft sections — seven writing agents") is a single named step, but today's `RunDetail.tsx` per-agent table renders one row per `agentKey` (so `origin_story`, `problem`, `founder_bio`, etc. each get their own row with the raw key), and `pipelineTopology.ts`/`PipelineGraph.tsx` render them as 7 separate graph nodes. Phase 37 (D-05/D-06) already built a "7-writers node expansion" pattern (`WriterExpansion.tsx`) that groups them into one expandable unit with per-section strength scores — this is the right precedent to extend, not a new grouping to invent.
**Why it happens:** the underlying data model is genuinely 7 separate `agent_runs` rows; the display grouping is a presentation-layer decision already partially solved in the Graph view but NOT yet applied to `RunDetail.tsx`'s flat per-agent table.
**How to avoid:** when implementing D-07's action-name map for `RunDetail.tsx`, either (a) reuse/adapt `WriterExpansion.tsx`'s pattern so the per-agent table also collapses the 7 writers under one "Draft sections" row, or (b) if the flat-table format is kept, ensure each of the 7 rows still shows "Draft sections — {agent}" (action-primary, agent-secondary) rather than 7 differently-labeled top-level steps — but do not present them as 7 distinct §7 steps.

### Pitfall 5: `calibrator` and `chronicler` have no §7 action name at all
**What goes wrong:** §7's 11-step table starts at "Find story leads" (`signal_editor`) and ends at "Prepare publication" (`publisher`) — it has no entry for `calibrator` (which runs before `signal_editor`) or `chronicler` (which runs between `editor_gate_1` and `researcher`, dramatizing the deliberation transcript). A literal reading of D-07 ("a single action-name mapping keyed by node/agent key") implies every node needs an entry, but these two genuinely have none in the binding table.
**Why it happens:** §7 is scoped to the *editorially visible* steps; calibrator (style-brief setup) and chronicler (transcript narration) are considered supporting/internal machinery in the prototype's mental model, not steps an editor "watches happen."
**How to avoid:** this is a genuine open question for planning (not resolvable from the spec alone) — recommend either (a) fold `calibrator` into step 1 as pre-step setup metadata (not a separate row) and fold `chronicler` into step 5 ("Choose recommended story") as a sub-step, or (b) give both a plain humanized fallback label (matching the existing `toDisplayName()`/`humanizeAgentKey()` behavior) clearly outside the 11 "named" steps, so nothing renders blank. Do NOT invent new verbatim-sounding action names for these two that aren't in the spec — that would violate the "verbatim contract" instruction in CONTEXT's Specific Ideas.

### Pitfall 6: `signal_editor` is not yet reachable from Agent Instructions (Prompt Lab) at all
**What goes wrong:** `signal_editor` has a real prompt file and is registered in the pipeline's `config_loader.py` (`AGENT_KEY_TO_PROMPT_FILE`), but it is **absent** from `VariableRegistry.ts` and from the (stale) `PIPELINE_NODES` list that `listEditableAgentKeys()` unions against. Since that function is the actual left-nav source for Prompt Lab/Agent Instructions, `signal_editor` is currently NOT selectable/editable in that UI — even though Run Details' step 1 ("Find story leads — Signal Editor") will, after D-07, link to it via "Improve this agent →".
**Why it happens:** Phase 46 was an explicitly backend-only, console-independent track; the Prompt Lab editable-agent registry was never updated to include the new agent.
**How to avoid:** flag this as an open question for the planner — closing it (adding `signal_editor` to `VariableRegistry.ts`) is a small, contained fix but is arguably outside "rename only" scope; leaving it open means the D-07 "Improve this agent" deep-link for step 1 would 404/dead-end. Recommend at minimum documenting the gap even if the planner descopes fixing it, since a dead "Improve this agent" link on a HIGH-visibility step (the very first one) would be a visible regression against the phase's own goals.

### Pitfall 7: `verify_candidates` and the Convex `agents` config-at-rest table
**What goes wrong:** `PipelineGraph.tsx`'s node-config panel reads `api.agents.listForWorkspace` (a real, seeded Convex table) for model/enabled/description at rest. There is no confirmed seed row for `signal_editor` or `verify_candidates` in `convex/agents.ts`'s seed data (not found in this research pass). If absent, once the topology fix (Pitfall 2) makes these nodes render, their at-rest config card may show blank/default values rather than real model info (though `verify_candidates` is a non-LLM deterministic check, so "no model" is arguably correct for it — only `signal_editor`, an LLM agent, would be an actual gap).
**How to avoid:** verify at planning time whether `convex/agents.ts` (or its seed script) has rows for both keys; if `signal_editor` is missing, either seed it or accept/flag the config-at-rest card showing a graceful "not configured" state rather than crashing.

### Pitfall 8: publish typed-confirmation removal (D-15) needs verification, not assumption
**What goes wrong:** D-15 states Publish "carries no typed confirmation" per a Phase 34 reversal decision, and asks Phase 50 to "verify no typed-confirm survives on the publish path." This is a verification task, not a known-clean state — do not skip checking `DecisionRail.tsx`/`ReviewDecisionPanel.tsx` (there are TWO publish surfaces per Phase 49's own code_context: `review-desk/[runId]/_components/DecisionRail.tsx` and the legacy sibling `run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx`) for any leftover typed-confirmation UI.
**How to avoid:** grep both publish call sites for a typed-confirmation input pattern (mirroring `RegistryTable.tsx`'s Do-not-use reason input) before declaring D-15 satisfied.

### Pitfall 9: a stray "(Phase 47)" comment in `RegistryTable.tsx` anticipates this exact D-15 work
**What it is (not a blocker, a breadcrumb):** `RegistryTable.tsx` line 272-275 has a comment reading "the typed-confirmation + reason flow (Phase 47) stays unreachable behind this lock" — this appears to be a stale/incorrect phase-number reference (Phase 47 was Story & Brief Stage, unrelated); the actual typed-confirmation work is Phase 50's D-15. Worth a one-line comment fix while touching this file, not a functional issue.

## Code Examples

### The 20-node graph (authoritative — `builder.py`, confirmed current)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
# 20 nodes in build order (design always present per suppression-flag convention):
calibrator, signal_editor, scout, verify_candidates, advocate, editor_gate_1,
chronicler, researcher, verify_research,
origin_story, problem, founder_bio, case_study, game, bonus, design,  # 7-way fan-out
validate_sections, qa, editor_final, publisher
```

### The stale frontend topology (needs updating — confirmed 18 nodes, no signal_editor/verify_candidates)
```typescript
// Source: apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
export const PIPELINE_NODES: string[] = [
  'calibrator', 'scout', 'advocate', 'editor_gate_1', 'chronicler', 'researcher',
  'verify_research', 'origin_story', 'problem', 'founder_bio', 'case_study',
  'game', 'bonus', 'design', 'validate_sections', 'qa', 'editor_final', 'publisher',
]  // 18 — missing signal_editor, verify_candidates

export const GATE_KEYS: Set<string> = new Set<string>([
  'verify_research', 'validate_sections',
])  // per §7, should become {verify_candidates, verify_research, publisher} — see Discretion note below
```

### The existing "restart" honesty precedent (reuse this shape)
```typescript
// Source: apps/dispatch-control/components/inspector/InspectorFooter.tsx:66-67
const RESTART_TITLE =
  'Completed steps are reused, not re-paid — general step restart is not yet wired (Gate-1 resume only).'
```

### The real per-writer reuse primitive
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/control.py:653 rerun_agent
# Guards: agent_key not in RE_ROLLABLE -> 422; run.status=='running' -> 409
# Overlays checkpoint state (graph.aget_state) as current_state, re-runs ONE
# bare node fn, then graph.aupdate_state(config, new_output, as_node=agent_key)
# — genuinely reuses sibling writer state from the checkpoint.
```

### The Gate-1-only resume primitive
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/runs.py:507 _resume_paused_run
# Only meaningful when the graph is actually paused at editor_gate_1's interrupt().
# graph.ainvoke(Command(resume={"editorSelection": charity_name}), config)
```

### The Publisher-only reuse primitive (secret-guarded, not yet Clerk-reachable)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/runs.py:582 manual_publish
# _require_trigger_secret(request)  # server-to-server only today
# Re-invokes _run_publisher directly against the Sanity issue doc — no graph
# state needed at all, so it inherently "reuses" everything upstream.
# A Clerk-guarded wrapper (mirroring api/control.py:786 adjudicate's bridge
# pattern around _resume_paused_run) would make this operator-reachable.
```

### `prompt_versions` schema — confirmed no origin field (D-13 gap)
```typescript
// Source: convex/schema.ts:306-318
prompt_versions: defineTable({
  workspace_id: v.string(), agentKey: v.string(), version: v.number(),
  content: v.string(), isActive: v.boolean(), createdAt: v.number(),
  createdBy: v.optional(v.string()), note: v.optional(v.string()),
  // no originRef / motivatedBy / sourceIssueOutput field exists
})
```

### The existing "Improve this agent" capture/deep-link seam (D-13's wiring point)
```typescript
// Source: apps/dispatch-control/components/inspector/InspectorFooter.tsx:120-138
const promptHref = promptKey ? `/prompt-lab/${encodeURIComponent(promptKey)}` : undefined
// LIVE when promptKey !== null. D-13 needs this link to CARRY an origin
// reference (e.g. runId + sectionName + a short excerpt) so the destination
// prompt-lab draft editor can render "why this draft exists."
```

## State of the Art

| Old Approach | Current/Required Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `toDisplayName()` title-cases node ids for the Graph spine | D-07's `RUN_STEP_MAP` renders action-primary/agent-secondary per §7's verbatim labels | This phase | Every node label on the Graph spine + `RunDetail.tsx` changes |
| `RunDetail.tsx` shows raw `agentKey` per row | Same action-name map applied; 7 writers ideally collapse to one "Draft sections" unit (reusing Phase 37's `WriterExpansion.tsx`) | This phase | Table becomes editorially legible, not technically legible |
| `GATE_KEYS = {verify_research, validate_sections}` | Reconciled to §7's diamond set — likely `{verify_candidates, verify_research, publisher}` (validate_sections drops out since §7 doesn't name it as a step; publisher gains ◆ despite doing real work, because §7 marks it) | This phase (D-08) | Diamond rendering + the `how-to-use` "three deterministic checks" copy both change together — they must be reconciled as ONE decision, not two |
| "Restart from this step" — Always RESERVED for all artifact types (Phase 44 posture) | Live for writers (via `rerun_agent`) + Gate-1 pause (via resume/adjudicate) + optionally Publisher (via a new thin wrapper); Reserved-with-explanation for the other 8 | This phase | The InspectorFooter + the new recovery rail both need this three-way distinction, not a single flag |
| Prompt Lab vocabulary: "Rehearsal" / "Make live" / "LIVE" (260710-k8y) | Binding spec vocabulary: "Test changes" / "Make active" / "active version" | This phase (must correct, not just leave) | A second, coordinated rename pass over the SAME files 260710-k8y touched |
| Masthead ON-chip: "Auto-publish ON"; Banner: "Auto-publish is enabled. Runs will publish automatically without review." | "Human approval required"-register copy for both ON states (OFF was already fixed in Phase 40) | This phase (D-16) | Two small string changes, `Masthead.tsx:286` + `AutoPublishBanner.tsx:52` |
| `charities.setStatus` reason-only confirm (Phase 43) | Typed org-name confirmation added on top (D-15), reusing the existing reason-input UI shape | This phase | Client-only UI addition; backend `setStatus` mutation is unchanged (already reason-required + Editor-gated) |

**Deprecated/outdated:**
- The `how-to-use` page's entire "weekly loop" narrative describes the pre-Phase-40 five-SCREEN model (Signal Desk / Run Monitor / Review Desk / Voice Pass / Prompt Lab+Eval Center as separate destinations). Since Phase 40/41, these are STAGES inside one Issue Workspace, and Signal Desk/Review Desk/Voice Pass left the top-level nav entirely (`lib/nav.ts`'s own header comment confirms this). A pure term-swap on this page (e.g. "Run Monitor" → "Run Details" in the loop text) would leave a structurally wrong narrative in place. This is a scope question for the planner — see Open Questions.

## Open Questions

1. **Should the `how-to-use` "weekly loop" narrative be rewritten to reflect the current 5-stage Issue Workspace architecture, or only term-swapped?**
   - What we know: the page's structure (5 numbered "screens": Signal Desk, Run Monitor, Review Desk, Voice Pass, Prompt Lab+Eval Center) predates Phase 40's restructuring into Issue Workspace stages; a literal term-swap would leave a stale mental model in "operator-facing prose" that WBN-05 is supposed to fix.
   - What's unclear: whether "prose" in D-01's scope extends to restructuring this narrative, or whether Phase 50 should treat the loop's *shape* as out of scope and only fix its *vocabulary*.
   - Recommendation: at minimum, rename `screen:` labels in `WEEKLY_LOOP` to the closest current stage/screen name and fix the individual banned terms (Gate 1, node, Re-run from this node, run evals, golden-scenario, shadow, blocklist, commit); flag to the user during planning whether a fuller narrative rewrite is wanted, since it's a bigger lift than the rest of the phase.

2. **What should the final `GATE_KEYS` diamond set be — and does `publisher` really belong there?**
   - What we know: §7 marks Publisher with ◆ alongside Verify organizations and Verify research; the current code-level definition of a "gate"/diamond is a non-LLM deterministic check node — `publisher` IS non-LLM (it renders PDF + writes Sanity + fires the webhook chain), so it technically qualifies as "deterministic," but it does real irreversible work, not a pass/fail check, which is a different semantic than the other two.
   - What's unclear: whether treating Publisher as visually identical (diamond) to the two true gates could mislead an operator into thinking it's a checkpoint rather than the actual publish action.
   - Recommendation: honor the spec literally (add `publisher` to the diamond set, drop `validate_sections` since §7 doesn't name it as a distinct step) — this is explicitly flagged as Claude's Discretion in CONTEXT, but the research here resolves the ambiguity toward "follow §7's table exactly," since it's stated as a verbatim contract.

3. **Does `validate_sections` disappear from the visible Run Details step list entirely, or fold into "Draft sections"?**
   - What we know: §7's 11 steps have no separate entry for the fan-in join node `validate_sections` — it isn't named at all.
   - What's unclear: whether it should render as an internal/hidden sub-step of "Draft sections" (consistent with the 7 writers collapsing into that same step) or be dropped from the operator-facing step list but still exist as a real graph node with its own `agent_runs` row.
   - Recommendation: fold it into "Draft sections" as the join point (not a separate visible step, not a diamond) — this keeps the visible step count at 11 exactly matching §7, and is consistent with how the 7 writers already collapse.

4. **Is closing the `signal_editor` Agent-Instructions-unreachable gap (Pitfall 6) in scope for this phase?**
   - What we know: it's a small, contained fix (`VariableRegistry.ts` + updated `pipelineTopology.ts` per Pitfall 2 would resolve it together).
   - What's unclear: whether it counts as "rename only" or crosses into new capability.
   - Recommendation: fix it as part of the Pitfall 2 topology update — it's nearly free once that file is being touched anyway, and leaving "Improve this agent" dead on Run Details' very first step undermines WBN-04's own goal.

5. **Should the Publisher-restart Clerk-guarded wrapper (the third real "Restart from this step" case) be built this phase, or deferred?**
   - What we know: `manual_publish` already does the real work; only a thin Clerk-guarded wrapper (mirroring the `adjudicate` bridge, ~20-30 lines) is missing, and D-11 only forbids a *net-new arbitrary-node* resume engine — a wrapper around an *existing, single-purpose* endpoint arguably isn't that.
   - What's unclear: whether the phase's "wide but shallow, not rebuilding" framing intends this as in-scope net-new work.
   - Recommendation: treat as **in-scope, low-risk** (it's the same shape as an already-shipped pattern) — including it upgrades the recovery rail from "2 of 11 honest" to "3 of 11 honest" for a small, well-precedented cost; if the planner descopes it, the Publisher step should render Reserved like the other 8, not silently omitted.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend framework | Vitest (`apps/dispatch-control`) |
| Backend framework | pytest (`packages/pipeline`) |
| Config file | `apps/dispatch-control/vitest.config.ts`; `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `pnpm --filter dispatch-control test:unit -- <pattern>` |
| Full suite command | `pnpm --filter dispatch-control test` (baseline: 959 passing as of Phase 49) + `cd packages/pipeline && uv run pytest -x -q` (baseline: 692 passed / 38 skipped as of Phase 49) |
| Strict type/build gate | `pnpm --filter dispatch-control build` (CLAUDE.md hard rule — vitest alone does not type-check) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WBN-01 | Nav renders two visibly distinct groups + role indicator | unit (DOM) | `vitest run __tests__/AppSidebar.test.tsx` (or `nav.test.ts` extended) | ❌ Wave 0 — extend existing `__tests__/nav.test.ts` fixture |
| WBN-02 | `pipelineTopology.ts` matches the live 20-node graph; action-name map renders §7 labels; diamonds match reconciled `GATE_KEYS` | unit | `vitest run __tests__/pipelineTopology.test.ts` (update node-count assertion to 20 + add signal_editor/verify_candidates edge assertions) | ✅ exists, needs updating — treat as RED-then-GREEN Wave 0 target |
| WBN-02 | Historical-vs-live framing never says "Monitor" when idle | unit (source-scan or DOM) | new test asserting the string "Monitor" does not appear in the idle-state render path | ❌ Wave 0 |
| WBN-03 | Recovery rail renders what-happened/completed/not-happened/recommended-recovery + Skipped downstream steps | unit (DOM) | new `RecoveryRail.test.tsx` | ❌ Wave 0 |
| WBN-03 | "Restart from this step" is live for exactly {writers, Gate-1 pause, [Publisher if scoped]} and reserved-with-explanation for the rest | unit (source-scan + DOM) | new test enumerating the 11 step-types and asserting live/reserved per the honesty matrix (Pitfall 1) | ❌ Wave 0 |
| WBN-04 | A draft instruction created via "Improve this agent" carries and renders an origin reference | unit + pytest (if Convex arg changes) | new `promptVersions` test (mirrors `PromptSaveDialog.test.tsx`'s Convex-mock pattern) | ❌ Wave 0 |
| WBN-05 | No banned legacy term (old OR 260710-k8y-conflict terms) survives in operator-facing copy | source-scan tripwire | new `nomenclatureSweep.test.ts` (see design below) | ❌ Wave 0 — model directly on `roleGateInventory.test.ts`/`dispatch-control-no-sanity-write.test.ts` |
| WBN-06 | Typed org-name confirmation gates Mark Do-not-use; no typed-confirm on either publish surface; automation toggle absent from operator surface | unit (DOM) + source-scan | extend `RegistryTable` tests + a source-scan asserting no typed-confirm pattern in `DecisionRail.tsx`/`ReviewDecisionPanel.tsx` | Partial — `charitiesDoNotUse.test.ts` covers the backend reason-gate; the typed-name UI + publish-surface negative-check are net-new |

### Sampling Rate
- **Per task commit:** targeted `vitest run <file>` / `pytest <file>` for the touched surface.
- **Per wave merge:** full `pnpm --filter dispatch-control test` + `cd packages/pipeline && uv run pytest -x -q`.
- **Phase gate:** full suite green + `pnpm --filter dispatch-control build` exit 0 + (if Convex touched) `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797`, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/pipelineTopology.test.ts` — update the frozen 18-node/2-gate assertions to the reconciled 20-node/N-diamond reality (Pitfall 2) — this MUST land before any Run Details rendering work, since it is the executable spec for the topology file.
- [ ] `apps/dispatch-control/__tests__/nomenclatureSweep.test.ts` — new source-scan tripwire (design below).
- [ ] `apps/dispatch-control/__tests__/RecoveryRail.test.tsx` — new component test for the WBN-03 rail + the per-step-type Restart honesty matrix.
- [ ] A Convex test for the D-13 origin-ref field (mirrors `PromptSaveDialog.test.tsx`'s `convex-test` pattern).
- [ ] `apps/dispatch-control/__tests__/nav.test.ts` — extend for the renamed 4 Workbench items + the role indicator.

### Recommended design for the WBN-05 nomenclature-sweep tripwire
Model directly on `roleGateInventory.test.ts` and `dispatch-control-no-sanity-write.test.ts` (both recursive-fs regex scans). Key design decisions surfaced by this research:
1. **Scan operator-facing files only** (`app/`, `components/`, excluding `__tests__/`, `.next/`, `node_modules/`) — this naturally excludes code identifiers like `charities.status === 'blocklisted'` (a Convex/API string comparison, not copy) while still catching JSX text and `title`/`aria-label`/comment strings.
2. **Distinguish operator-facing strings from code identifiers** by scanning for the banned word **as it would appear in prose** (e.g. `/\bGate\s*1\b/i`, `/\bnode\b/i` in JSX text — NOT `editor_gate_1` or `verify_candidates` as bare identifiers) with an explicit allowlist for known code-identifier contexts (route paths `/run-monitor`, `/prompt-lab`, `/eval-center`, `/registry`; Convex/API literal `'blocklisted'`; node keys like `verify_research`). The existing `FORBIDDEN_IMPORTS`-array pattern (regex list + violation collector) generalizes cleanly to a `FORBIDDEN_COPY_TERMS` array.
3. **Include the 260710-k8y conflict terms** (`Rehearsal`, `Make live`, `>LIVE<`, `Draft vs. live`) in the banned list, not just the spec's own "old" column — this is the single highest-value addition this research surfaces, since a sweep keyed only to the spec's literal table would miss them.
4. **Allowlist legitimate non-copy occurrences** — e.g. `node_modules`, `.next/`, this RESEARCH.md itself, and code comments that *reference* the old term while explaining the rename (e.g. "renamed from X" prose) may need a narrower per-file exception list; recommend scanning only rendered JSX text nodes + string literal props (`title=`, `aria-label=`, `placeholder=`) rather than raw file content if false positives from doc-comments become noisy — verify chosen approach against real occurrences during planning by running a first-pass scan.

## Sources

### Primary (HIGH confidence — direct file reads of this codebase)
- `.planning/phases/50-workbench-nomenclature/50-CONTEXT.md` — locked decisions, canonical refs, code_context
- `.planning/REQUIREMENTS.md` §Milestone v4.0 — WBN-01..06 verbatim
- `.planning/STATE.md` — Phase 46/48/49 completion notes (20-node graph confirmation, test-count baselines)
- `.planning/PROJECT.md` — locked v4.0 decisions, Phase 49 completion summary, the "18 nodes today" pre-Phase-46 note
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — full §System Workbench + nomenclature tables (read in full)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — §6/§7/§8 (read in full)
- `docs/design/dispatch-control-v3/README.md` — color semantics + milestone decisions (read in full)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — the live 20-node graph (read in full)
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` + its test — confirmed stale (read in full)
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx` — diamond/dot rendering (read in full)
- `apps/dispatch-control/components/inspector/InspectorFooter.tsx` — the Phase 44 "Restart from this step" honesty precedent (read in full)
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `rerun_agent`, `adjudicate`, `_require_editor` (read relevant sections)
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `_resume_paused_run`, `manual_publish`, `_execute_run` exception handling (read relevant sections)
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` — `wrap_agent_node` exception re-raise behavior (read relevant section)
- `convex/schema.ts` — `prompt_versions`, `agents`, confirmed no origin field (read relevant sections)
- `convex/promptVersions.ts`, `convex/charities.ts`, `convex/agents.ts` — mutation signatures (read relevant sections)
- `apps/dispatch-control/lib/nav.ts`, `apps/dispatch-control/lib/role.ts`, `apps/dispatch-control/components/{AppSidebar,LockedControl,Masthead}.tsx` — read in full/relevant sections
- `apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` — read in full, confirmed legacy-term hot spot
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` — confirmed reason-only confirm, no typed org-name step (read relevant sections)
- `apps/dispatch-control/__tests__/{dispatch-control-no-sanity-write,roleGateInventory,charitiesDoNotUse,pipelineTopology}.test.ts` — precedent patterns (read in full/relevant sections)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/{agentList,TestRunPanel,VersionHistoryPanel}.tsx` — confirmed 260710-k8y conflict terms live in tree (read relevant sections)
- `.planning/quick/260710-k8y-implement-prompt-lab-nomenclature-propos/260710-k8y-SUMMARY.md` — confirmed the conflicting rename's scope and intent (read in full)
- `.planning/phases/{37,38,39,49}-*/*-CONTEXT.md` — prior-phase decisions and confirmed code seams (read in full)
- `/Users/user/.claude/CLAUDE.md` (project) — GSD workflow + contract-first + strict-build + Convex-sync rules

### Secondary (MEDIUM confidence)
- None — this phase required no external/web research; every claim above is verifiable directly against the repository at the stated file/line.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; confirmed by absence of any package.json/pyproject.toml need in this scope.
- Architecture (nomenclature module, action-name map, recovery-rail honesty matrix): HIGH — grounded in direct reads of `builder.py`, `pipelineTopology.ts`, `control.py`, `runs.py`, `InspectorFooter.tsx`.
- Pitfalls (stale topology, restart-honesty, 260710-k8y conflict): HIGH — each is a direct code-level confirmation, not inference.
- Open Questions (§7 gaps for calibrator/chronicler/validate_sections, publisher-diamond semantics): MEDIUM — the spec itself is ambiguous here; recommendations given, but genuinely require a planning/discretion call, not a factual resolution.

**Research date:** 2026-07-16
**Valid until:** 30 days (stable internal codebase; re-verify `pipelineTopology.ts`'s node count and the 260710-k8y conflict strings haven't already been partially fixed by an intervening quick-task before planning begins)
