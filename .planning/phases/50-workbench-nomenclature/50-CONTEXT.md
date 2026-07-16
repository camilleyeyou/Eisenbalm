# Phase 50: Workbench & Nomenclature - Context

**Gathered:** 2026-07-16 (`--auto`: all gray areas selected, recommended defaults chosen)
**Status:** Ready for planning

<domain>
## Phase Boundary

The final v4.0 pass over the **System Workbench** side of the Dispatch Control console: give the four machine screens their v3 names and shape — **Run Monitor → Run Details**, **Prompt Lab → Agent Instructions**, **Eval Center → Quality Tests**, **Registry → Editorial Memory** — and apply the binding **nomenclature table** consistently across every operator-facing surface so no legacy term survives in the copy. It also lands the small genuinely-new bits that ride on the rename: Run Details' **action-named steps + failed-run recovery rail**, and Agent Instructions' **"why this draft exists" bridge**.

This is a **wide-but-shallow** phase: the v3 Workbench is ~80% already shipped (Phases 37–39 built the screens; Phase 30 froze the design system). The work is renaming + copy consistency + a few additive affordances — **not** rebuilding screens, the design system, the publish gate, or the eval/activate gates.

**In scope:** nav-label + screen-heading renames (4 screens); a full nomenclature sweep of operator-facing copy (incl. the `how-to-use` glossary); the signed-in **role indicator** (net-new text); Run Details **action-named steps** + **diamond reconciliation** + **historical-vs-live framing** + **failed-run recovery rail**; Agent Instructions **"why this draft exists"** bridge; removing the automation **switch framing** from the editorial operator surface (WBN-06).

**Out of scope:** renaming route folders/URLs; renaming stored schema enum values / node ids / audit-action strings; rebuilding any screen, the design system, the publish gate, or the Phase 38 eval/activate gates; building a new Administration screen; a net-new arbitrary-node checkpoint-resume engine.

</domain>

<decisions>
## Implementation Decisions

### A. Rename mechanics — display copy vs routes vs stored data
- **D-01:** The nomenclature table maps to **display strings only** — nav labels, screen headings, button/label text, aria-labels, and prose (including the `how-to-use` glossary). Rename operator-facing copy; do **not** touch code identifiers.
- **D-02:** **Route folder paths stay unchanged** (`/run-monitor`, `/prompt-lab`, `/eval-center`, `/registry`). URLs are not "operator-facing copy"; renaming them would cascade into hardcoded hrefs, redirects, layout tabs, back-links, and `__tests__/nav.test.ts` for zero user-visible benefit. (Route rename → Deferred.)
- **D-03:** **Stored values stay unchanged.** `charities.status` keeps the literal `'blocklisted'`; the audit action stays `charity.blocklisted`; `sign_offs.kind`, `eval_scores.source`, `prompt_versions` keys, and node ids (`editor_gate_1`, `verify_research`, …) are untouched. The `blocklisted → "Do not use"` rename is a **display-label swap** (`CharityStatusBadge`, `RegistryTable` filter/buttons) over an unchanged enum. Verified: `charities.status` is a free `v.string()` and `'blocklisted'` is load-bearing across the Scout dedup read (`charities:listForDedup` reads `featured + blocklisted`), API_CONTRACTS §43, and existing data rows — a value rename would be a cross-cutting data+contract+pipeline migration, explicitly avoided. (Consistent with Phase 49's framing: it "keeps the existing field values; only enforces + locks.")

### B. Two-group nav + role indicator + label source-of-truth (WBN-01)
- **D-04:** The Editorial / System Workbench grouping **already exists** in `lib/nav.ts` (`NAV_GROUPS`). Phase 50 **renames the four Workbench nav items** and each screen's heading, keeps the existing groups, and ensures the two groups read as **visibly distinct**. Editorial destinations (Issues, My Tasks, Issue Workspace) were built in Phases 40–48 — assemble/label, don't rebuild.
- **D-05:** **Add the signed-in role indicator** (net-new — role is never shown as text today). Source it from Phase 49's `useRole()` (`lib/role.ts`); render it **bottom-left of the sidebar** per spec §Nav / DERIVED-STATE §6. Presentation-only (server remains the authoritative gate).
- **D-06:** Introduce **one shared nomenclature/label source of truth** for the renamed terms rather than scattering inline JSX strings — reduces the risk a legacy term survives the sweep. Extend the existing humanized-label precedent (`prompt-lab/_components/agentList.ts` already carries `GROUP_LABELS`/`AGENT_DISPLAY_NAMES`). Opportunistically de-duplicate the ≥5 parallel section/agent label maps where cheap; **full consolidation is not required** (→ Deferred).

### C. Run Details — action-named steps + diamonds + framing (WBN-02)
- **D-07:** Add a single **action-name mapping** keyed by node/agent key, using **spec §7's exact labels** ("Find story leads" — Signal Editor, "Verify research" — deterministic check, "Draft sections" — seven writing agents, …). The **action is primary; the agent name is secondary metadata**. Replace the Graph spine's `toDisplayName()` (which just title-cases node ids) and the Runs run-detail table's raw `agentKey` cell with this map. This map should be the D-06 source of truth, retiring the duplicated identity maps where it lands.
- **D-08:** **Reconcile the deterministic-check diamond set to the live 20-node graph.** Diamonds already render for `GATE_KEYS = {verify_research, validate_sections}` (`AgentNode.tsx`); add **`verify_candidates`** (Phase 46's non-LLM bottleneck, spec §7 step 3 "Verify organizations ◆"), align the set to §7's diamonds, and **fix the stale "three deterministic checks" legend copy** in `how-to-use`. Reuse the existing rotated-marigold-diamond vs black-dot rendering — no new visual system.
- **D-09:** The Run Details header **states plainly whether it is a historical record or a live run** — never the word "Monitor" when nothing is running (spec §7 / §Run Details). Step states use the spec vocabulary: Waiting · Running · Complete · Paused — done · Failed · Skipped.

### D. Failed-run recovery rail (WBN-03)
- **D-10:** Build the **plain-language recovery rail** as a real affordance on a failed run: *what happened / what completed successfully / what did not happen / recommended recovery*, with **downstream steps dimmed and labeled "Skipped"**, plus **"Improve this agent"** deep-linking to Agent Instructions (the Flow-C bridge). This is the WBN-03 deliverable and is fully in scope.
- **D-11:** **"Restart from this step" reuses existing primitives** — the per-node re-run (`rerun_agent`, Phase 33/37) and/or `POST /run/{run_id}/resume` (LangGraph AsyncPostgresSaver checkpoint resume). Copy reflects checkpoint reuse ("completed steps are reused, not re-paid") **where the graph/checkpointer actually supports it**. Do **not** build a net-new arbitrary-node checkpoint-resume engine (→ Deferred).
- **D-12:** **Research target:** confirm exactly what "restart from an arbitrary failed step, reusing completed steps" the AsyncPostgresSaver checkpointer already gives us vs. what only per-node re-run covers. If a general reuse-from-node resume isn't available, the control wires to the strongest existing path and the copy states honestly what it does — consistent with the house rule "nothing silent / blank never means done."

### E. Agent Instructions "why this draft exists" + Quality Tests copy (WBN-04)
- **D-13:** The **"why this draft exists" bridge** renders, on a draft instruction, the **specific issue output that motivated it** — carried as a stored **origin back-reference** through the inspector's "Improve this agent →" action (spec §8 Instructions tab). If prompt drafts carry no origin field today, add a **small additive field** — **contract-first** (amend `docs/API_CONTRACTS.md` before the schema touch). No inference engine; a stored reference.
- **D-14:** Apply the Workbench nomenclature to Prompt Lab / Eval Center copy: **shadow run → "Preview next run"**, **golden scenario → "Standard test case"**, **eval/evals → "Quality test" / "Test changes"**, **commit/activate → "Make active"**, **rollback/restore → "Restore version"**, **"despite the red eval gate" → quality-test phrasing**. The Phase 38 eval **commit gate** and the Phase 28/38 **activate flow wiring stay byte-unchanged** — copy only (reconciliation fact: "DO NOT REBUILD the eval commit gate").

### F. Automation toggle relocation + typed-confirmation scope (WBN-06)
- **D-15:** **Typed confirmation is reserved for Mark Do-not-use** (organization name + required reason, Editor-in-chief only). Confirm **Publish carries no typed confirmation** — the Phase 34 reversal is a locked milestone decision (safety = Must fix = 0 ∧ Fact Check complete ∧ Voice approved current); verify no typed-confirm survives on the publish path.
- **D-16:** Remove the automation **switch framing from the editorial operator surface.** The Masthead "Auto-publish ON" chip (`Masthead.tsx:286`) and `AutoPublishBanner` copy reword to the **"Human approval required"** reassurance register (the OFF case was already reworded in Phase 40 — finish the ON chip + banner). The automation **setting itself** stays in the **Config / Operations area** (`/config`, where `AutoPublishToggle` already lives) — treat that as the Administration home. **Do not build a new Administration screen** (→ Deferred); optionally note Config as "Administration."

### Claude's Discretion
- Exact structure/location of the shared nomenclature label module (D-06); how aggressively to consolidate the duplicated label maps.
- Diamond-set final membership against the live topology (D-08) once §7 is mapped to the 20 real nodes; whether `validate_sections`/publisher render as diamonds per §7.
- Recovery-rail layout/wording within the 1c system (D-10); which existing primitive "Restart from this step" binds to (D-11/D-12), pending research.
- The "why this draft exists" origin-ref field shape + where it's captured (D-13), contract-first.
- Whether to rename the "Config"/"Operations" nav label to "Administration" (D-16) or leave it.

### Folded Todos
None — `todo match-phase 50` surfaced no matches to fold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding spec (nomenclature + Workbench screens)
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — §System Workbench (Run Details / Agent Instructions / Quality Tests / Editorial Memory screen specs), the **§Workbench nomenclature table** (Old→product mapping, the WBN-05 source of truth), §Nav (two groups + role indicator), §Global header ("Human approval required" replaces "Auto-publish OFF"), §Nomenclature applied throughout.
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§7** (the 11 action-named Run Details steps + diamonds + step states + failed-run recovery rail + "Restart from this step" — the D-07..D-12 source), **§6** (role labels — informs the D-05 role indicator), **§8** (inspector artifact / Instructions tab + "Improve this agent" — the D-13 bridge), **§3** (header state systems — "Human approval required").
- `docs/design/dispatch-control-v3/README.md` — color semantics (marigold = deterministic-check diamond; vermilion = Must fix/failure); milestone locked decisions (publish drops typed confirmation → D-15).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — WBN-01..WBN-06.
- `.planning/ROADMAP.md` §Phase 50 (line 1084) — goal + 6 success criteria. ⚠️ Read the `### Phase 50:` block directly; the multi-milestone ROADMAP makes `init phase-op`/`roadmap get-phase` misreport `phase_found:false` for v4.0 phases.
- `.planning/PROJECT.md` §Current Milestone — locked decisions + "Reconciliation facts" (design system frozen — DO NOT REBUILD; publish gate = `ready = factDone && voiceDone` reuse; eval commit gate reuse; the 18→20-node graph with Signal Editor + verify_candidates now real).

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — CLAUDE.md hard rule: any additive field or enum/field-value change checked here FIRST. Relevant to D-13 (prompt-draft origin ref) and confirms D-03 (§43 charity `blocklisted` status + `charity.blocklisted` audit action are display-renamed, not migrated).

### Prior phases that built the screens being renamed
- `.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md` — Run Monitor forensic spine (dots vs marigold diamonds, per-node chips, 7-writers expansion, drift strip); the `run-monitor/graph` + `run-monitor/runs` surfaces D-07..D-09 modify.
- `.planning/phases/38-prompt-lab-evals-eval-center/38-CONTEXT.md` — Prompt Lab eval drawer, commit gate + override-with-reason, Eval Center scenario cards, shadow run — the D-14 copy targets (gate wiring stays).
- `.planning/phases/39-registry-coverage-memory-strip/39-CONTEXT.md` — Registry coverage strip + corrections log; the `registry` surface renamed to Editorial Memory (D-03 label swap for `blocklisted`).
- `.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md` — `signal_editor` + `verify_candidates` nodes (confirmed live in `graph/builder.py`); the D-08 diamond reconciliation depends on these.
- `.planning/phases/49-roles-permissions/49-CONTEXT.md` — `lib/role.ts` (`useRole`/`useIsEditor`), `LockedControl.tsx` (shown-with-explanation), the six gated actions; D-05 role indicator + D-15 Do-not-use gating build on this.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Nav is already grouped** — `apps/dispatch-control/lib/nav.ts` `NAV_GROUPS` (Editorial / System Workbench / Operations) + `NAV_PINNED`; rendered by `components/AppSidebar.tsx`. Its own header comment already flags "Run Monitor → Run Details, Registry → Editorial Memory is Phase 50." Rename = `lib/nav.ts` labels + each page heading + `__tests__/nav.test.ts` fixture.
- **Role plumbing exists** — `lib/role.ts` `useRole()`/`useIsEditor()` (Clerk `publicMetadata.role`); `components/LockedControl.tsx` renders locked-with-explanation. Role is **never surfaced as text today** (Masthead shows only Clerk `<UserButton>`) — the D-05 indicator is net-new but has its data source ready.
- **Diamond rendering exists** — `run-monitor/graph/_components/AgentNode.tsx:93-100` renders `GATE_KEYS` nodes as rotated `bg-marigold` diamonds (`data-testid="agent-node-diamond"`), others as dots. `GATE_KEYS` in `pipelineTopology.ts:79` = `{verify_research, validate_sections}` — D-08 adds `verify_candidates` + reconciles.
- **Design tokens frozen** — `app/globals.css` Tailwind v4 `@theme` (`--color-marigold #f2b01e`, `--color-vermilion #e8471d`, `--color-cobalt #253ad4`, `--color-green #148a52`, `--radius: 0`). No token work (reconciliation fact).
- **Humanized-label precedent** — `prompt-lab/_components/agentList.ts` already has `GROUP_LABELS`/`GROUP_DESCRIPTORS`/`AGENT_DISPLAY_NAMES` + `displayNameForAgentKey()` — the seed for the D-06 shared source of truth.

### Established Patterns
- **Nav label ≠ screen heading** — nav says "Prompt Lab"/"Registry"/"Eval Center"/"Run Monitor" while pages render "Prompts"/"Charity Registry"/"Eval Center"/(redirect). A full rename touches **both** `lib/nav.ts` and each page's heading (`prompt-lab/page.tsx:51`, `registry/page.tsx:23`, `eval-center/page.tsx:61`; `run-monitor/runs/_components/RunDetail.tsx:106` already says "Run Details").
- **Copy is inline per component; labels duplicated across ≥5 maps** (section/agent labels in `WriterExpansion.tsx`, `RerollButton.tsx`, `DecisionRail.tsx`, `SourceIndex.tsx`, `agentList.ts`, `DecisionLog.tsx`) — no central nomenclature table today (motivates D-06).
- **Legacy-term hot spots** (operator-facing, for the WBN-05 sweep): `app/(dashboard)/how-to-use/page.tsx` (glossary — "Gate 1", "node", "Re-run from this node", "Run Monitor", "run evals", "golden-scenario", "shadow run", "blocklist", "commit", "auto-publish" — densest single target); `signal-desk/_components/*` ("Gate 1"); `run-monitor/graph/_components/AgentIOPanel.tsx` ("node"); `eval-center/*` ("Eval Center", "Golden scenarios", "Shadow run"); `prompt-lab/_components/{EvalDrawer,VersionHistoryPanel,AssembledPreview}.tsx` ("evals", "commit", "eval gate"); `registry/_components/{RegistryTable,CharityStatusBadge}.tsx` ("Blocklist(ed)"); `components/Masthead.tsx:286` ("Auto-publish ON"); `app/(dashboard)/_components/AutoPublishBanner.tsx`; `config/_components/AutoPublishToggle.tsx`.
- **Step naming is agent-identity-based, not action-based** — `RunDetail.tsx:175` shows raw `agentKey`; Graph `toDisplayName()` (`PipelineGraph.tsx:48`) title-cases node ids; no action map anywhere (D-07 is net-new).
- **Run strict `pnpm --filter dispatch-control build` before declaring frontend work done** (vitest doesn't type-check — [[run-strict-build-before-frontend-phase-done]]).
- **Convex changes need a live sync** — if any Convex function/schema is touched (e.g. D-13 additive field), `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797` ([[convex-functions-need-live-sync]]).

### Integration Points
- `lib/nav.ts` + `components/AppSidebar.tsx` + `__tests__/nav.test.ts` — the WBN-01 nav rename + role indicator.
- `run-monitor/graph/_components/{PipelineGraph,AgentNode,AgentIOPanel,pipelineTopology}.tsx` + `run-monitor/runs/_components/RunDetail.tsx` — WBN-02 action steps + diamonds + framing; the failed-run recovery rail (WBN-03) lands here.
- `prompt-lab/_components/{AgentPromptEditorView,VersionHistoryPanel,EvalDrawer}.tsx` — WBN-04 "why this draft exists" + Agent Instructions copy; `prompt_versions` (+ possible additive origin field, contract-first).
- `eval-center/*` + `registry/_components/{RegistryTable,CharityStatusBadge}.tsx` — Quality Tests / Editorial Memory copy + the `blocklisted`→"Do not use" label swap.
- `components/Masthead.tsx` + `_components/AutoPublishBanner.tsx` + `config/_components/AutoPublishToggle.tsx` — WBN-06 automation reframing.
- `app/(dashboard)/how-to-use/page.tsx` — the glossary sweep (all terms) + stale "three deterministic checks" fix.

</code_context>

<specifics>
## Specific Ideas
- The **§Workbench nomenclature table** and §7 step names are **verbatim contracts** — use the spec's exact strings ("deterministic check" not "gate", "Restart from this step" not "re-run from node", "Make active"/"Restore version", "Standard test case", "Preview next run", "Do not use", "Must fix", "Human approval required"). Do not paraphrase.
- The **action is the step name; the agent is secondary metadata** ("Find story leads — Signal Editor"), inverting today's agent-first labeling.
- "**Improve this agent**" is the recurring bridge verb — from the recovery rail (D-10) and the inspector (D-13), both deep-linking Agent Instructions.
- The `how-to-use` glossary is the **single densest legacy-term target** — a thorough sweep there closes most of SC-6; a source-scan tripwire over operator copy would prove no legacy term survives.

</specifics>

<deferred>
## Deferred Ideas
- **Route folder / URL renames** (`/run-monitor` → `/run-details`, etc.) + redirects — out of scope (D-02); URLs aren't operator copy and the churn isn't worth it. Revisit only if clean URLs become a stated need.
- **Stored enum / node-id / audit-action renames** (`blocklisted`, `editor_gate_1`, `charity.blocklisted`) — out (D-03); would be a data+contract+pipeline migration for a cosmetic gain.
- **Full de-duplication of the ≥5 label maps** — only opportunistic consolidation this phase (D-06); a complete refactor is its own cleanup.
- **A dedicated Administration screen** — out (D-16); the automation toggle stays in Config, which serves as the admin home.
- **A net-new arbitrary-node checkpoint-resume engine** — out (D-11); "Restart from this step" reuses existing rerun/resume primitives.

### Reviewed Todos (not folded)
None — `todo match-phase 50` returned zero matches.

</deferred>

---

*Phase: 50-workbench-nomenclature*
*Context gathered: 2026-07-16*
