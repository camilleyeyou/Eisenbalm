# Phase 28: Prompt Console — Editorial Authoring - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the existing `dispatch-control` `/prompts` console — Phase 24's
editor/versioning/diff/activate/test-run plus the recent view-first quick task
(260624-4ru) — into a **best-in-class editorial authoring console for Jesse's
voice**. Andrew must be able to understand, safely edit, and validate any agent
prompt before it ships. Voice-drift guardrails are the throughline.

Four capability areas (all in scope this phase):
1. **Editorial context + safety** — agent role/description on cards + detail, an
   "edited since seed" drift badge, an unsaved-changes guard, and search/filter.
2. **Variable tooling** — click-to-insert variable chips with descriptions, an
   assembled-with-sample-values preview, and unused-variable hints.
3. **The authoring loop** — a draft-vs-active side-by-side test-run with real
   cost + token count + a voice-rubric **score** on the output.
4. **Prompt source-of-truth sync** — surface DB-vs-`.md` divergence and reconcile
   per the locked canonical-source decision below.

**Builds on (do not rebuild):** the Phase 24 CodeMirror editor, save-as-immutable-
version, diff, activate/rollback (+ in-progress-run guard), the four-mode
test-run (`TestRunPanel` + `POST /agents/{key}/test-run`), the
`VARIABLE_REGISTRY`, and the view-first read→Edit toggle.

**Out of scope (later / productization):** editable graph topology
("graph-as-data" edges), RBAC (`users.role` admin/operator), any new run-control
or money surfaces.

</domain>

<decisions>
## Implementation Decisions

### Canonical source of truth (OPEN DECISION 2 — locked)
- **D-01: DB is authoritative.** `prompt_versions` is the canonical source going
  forward. The `.md`/code files become **seed-only** (initial migration) **+ the
  runtime fallback** (CFG-03 discipline carries forward — the pipeline still falls
  back to disk/code when Convex is unreachable). The dashboard is the real editing
  home.
- **D-02: The client's Google-Docs / `.docx` round-trip is retired for prompts.**
  The console replaces it as the single place to author agent prompts. The
  `docs/client-editable/EISENBALM-EDITABLE-COPY.docx`/`.md` artifact remains only
  for non-prompt editorial **site copy** if still needed — it is NOT a prompt
  source and there is no import-from-Doc path for prompts.
- **D-03: Drift surface = badge + copyable export.** Per prompt, show an "edited
  since seed / diverged from `.md`" **drift badge**, plus a button that renders the
  active version's exact `.md`-marker content (the `<!-- PROMPT START -->` /
  `<!-- PROMPT END -->` byte form that `load_prompt`/`_extract` expects) for the
  operator to **copy into the repo and commit**. This keeps the git fallback
  current and code-reviewable. **No direct repo write** — the dashboard runs on
  Vercel and cannot write repo files; the export is copy-to-clipboard, honest about
  that boundary. (A pipeline-side CI sync script was considered and deferred.)

### Voice-rubric scoring (OPEN DECISION 1 — locked)
- **D-04: Standalone scoring call, loading the real rubric.** A new lightweight
  scoring endpoint/call takes `(agent output + the active rubric content)` and
  returns a score. It is purpose-built for a **single arbitrary agent output**
  (works for scout/game/calibrator/etc., not just the six narrative section
  bodies) and is **brand-agnostic**. It MUST load the same rubric text the QA judge
  uses (active `rubric` version, disk `rubric.md` fallback) so the score reflects
  the live voice guard — but it is NOT the QA judge's six-section batch shape.
- **D-05: Score shape = per-axis breakdown + overall + rationale.** Surface each
  voice axis (gravity, sentiment, irony-signaling, precision, …) as a pass/score,
  a single headline number, and a 1–2 line rationale, so Andrew sees WHICH axis
  drifted.
- **D-06: Advisory only — never gates.** The score informs Andrew but never blocks
  save or activate, consistent with the QA judge's D-04 ("never blocks the draft").
  Andrew is the human guard; the score is a tool.

### The authoring loop — side-by-side (capability area 3)
- **D-07: Draft by default, active on-demand.** Keep running the unsaved draft as
  the primary Run (1× cost — preserves Phase 24 D-03). Add a "compare against
  active" action that runs the active version too and shows the two outputs (+ cost
  + token counts) side-by-side. Avoids doubling OpenRouter cost on every iteration.
- **D-08: Score whichever side(s) ran; show the delta when both ran.** The draft is
  always scored; when the operator compares against active, score active too and
  display the score delta.

### Editorial context + safety (capability area 1)
- **D-09: Console-side descriptions map for ALL editable keys.** One brand-agnostic
  map keyed by `agentKey` (lives next to `VARIABLE_REGISTRY`/`agentList.ts`)
  covering every editable key — agent system prompts, `*_user` templates, the six
  section-guidance keys, and the `rubric`/`voice_constraints` assets. Uniform
  coverage (no half-covered keys), one place to edit. May seed initial text from
  `agents.description` where it exists. NOT Sanity `agentProfile` (Eisenbalm-
  specific + only covers narrative agents — violates the brand-agnostic rule).
- **D-10: Drift badge** = "edited since the seeded v1" — i.e. the active version's
  content differs from the original migrated seed (equivalently active `version` >
  1, but compare content to be exact since rollback can re-activate v1). This is
  the same badge surfaced in D-03 and filterable per D-12.
- **D-11: In-app unsaved-changes guard.** Confirm dialog when the operator
  navigates away from the editor, switches to another `agentKey`, or toggles back
  to the view-first pane with a dirty draft; plus a visible "unsaved changes"
  indicator. No native `beforeunload` prompt (uncustomizable, heavy).
- **D-12: List search/filter = text + group + drift.** Filter the prompt list by
  name text, by group (`system` / `user-template` / `section-guidance` / `asset` —
  the existing `groupForAgentKey` taxonomy), and by drift ("edited since seed").
  The drift filter reuses the D-10 badge so Andrew can audit divergence.

### Variable tooling (capability area 2)
- **D-13: Global `{variable} → description` map keyed by variable NAME.** A
  console-side map (DRY — a shared variable like `{VOICE_CONSTRAINTS}` /
  `{charity_name}` means the same thing everywhere, defined once). Pairs with the
  existing names-only `VARIABLE_REGISTRY` WITHOUT changing its `Record<agentKey,
  string[]>` shape (so the highlight extension + unknown-var save gate keep
  working unchanged). Descriptions drive the click-to-insert chip tooltips.
- **D-14: Client-side `{variable} → sampleValue` map for the assembled preview.**
  The "assembled with sample values" preview substitutes sample values into the
  draft instantly, no server call — it is a readability aid, NOT an execution, so
  it need not match a test-run byte-for-byte. (Reusing the server `SAMPLE_FIXTURES`
  via an endpoint was considered and rejected: fixtures are per-agent input dicts,
  not per-variable strings, and it adds a fetch.)
- **D-15: Unused-variable hint = passive advisory.** A variable allowed for the
  agent (in `VARIABLE_REGISTRY[agentKey]`) that does not appear in the draft text
  shows a non-blocking "unused" hint. It is the complement of the existing
  Phase 24 unknown/mangled-variable **save gate** (which stays the only gate).

### Claude's Discretion
- Exact scoring endpoint shape and where it lives (new `POST /agents/{key}/score`
  vs folding a `score: true` option into the existing test-run endpoint); whether
  the standalone scorer uses `with_structured_output` like the judge.
- How active-side test-run reuses the existing `/agents/{key}/test-run` path for
  the side-by-side compare.
- Drift detection implementation (content-compare vs version-number heuristic per
  D-10) and the exact `.md`-marker rendering for the copyable export.
- Layout of the side-by-side comparison, the assembled-preview pane, the chip
  tooltips, drift badge styling, and the search/filter controls.
- The unsaved-guard mechanism (Next route interception vs in-component confirm).
- Whether descriptions/sample maps are one file or split; initial copy text.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & reconciliation (read first)
- `docs/MISSION_CONTROL_BRIEF.md` — §3A (Agent control & prompt editing: variable
  awareness, **test-run prioritized**, versioning/diff/rollback), §5 (data model:
  `prompt_versions`, `audit_log`; API surface incl. `POST /agents/{key}/test-run`),
  §8/Phase 2 roadmap. The source-of-truth + voice-drift framing lives here.
- `docs/CURRENT_STATE.md` — Phase 0: prompts already file-externalized (loader
  swap); per-call cost capture already exists (test-run/score read the same path).

### Prior phase context (the foundation this phase extends)
- `.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md` — the editor,
  versioning, diff, activate/rollback (+ in-progress guard D-02), four-mode
  test-run (D-03/D-04), `VARIABLE_REGISTRY` (D-05), byte-zero-diff migration +
  disk/code fallback (D-01). **This phase builds directly on it — read it fully.**
- `.planning/quick/260624-4ru/260624-4ru-PLAN.md` — the view-first read→Edit
  toggle, `listActiveForWorkspace` query, `humanizeAgentKey`, `PromptsListClient`
  card layout. The new editorial context attaches to these surfaces.
- `.planning/phases/22-config-externalization/22-CONTEXT.md` — `prompt_versions`
  seed, loader-swap + CFG-03 fallback granularity, agentKey canonical mapping
  (`editor`/`editor-final` .md vs `editor_gate1`/`editor_final` keys).
- `.planning/phases/23-node-wrappers-read-only-dashboard/23-CONTEXT.md` —
  `agent_runs` / `agent_run_payloads` (test-run prior-real input) + audit-log
  infra (emit save/activate/score-relevant audit rows).

### Research (v2.0 milestone)
- `.planning/research/SUMMARY.md` — versioning model; seed-as-v1; loader-swap-with-
  fallback discipline (informs D-01/D-03).
- `.planning/research/PITFALLS.md` — prompt-DB fallback (keep disk/code originals →
  D-01/D-03); **no second cost recorder** (score/test-run read the existing capture
  path); `workspace_id` discipline; byte-equivalence on migrated assets.

### Existing code (edit/extend targets)
- `apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx`
  — the view-first detail pane + Edit toggle; attach role/description, drift badge,
  unsaved guard, assembled preview, side-by-side compare here.
- `apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx` — the
  four-mode draft test-run; extend with the active-side compare (D-07) + score
  display (D-05/D-08).
- `apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx` —
  the list cards (live previews via `listActiveForWorkspace`); add description,
  drift badge, and search/group/drift filter (D-09/D-10/D-12).
- `apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts` —
  `groupForAgentKey` taxonomy + `listEditableAgentKeys` + `humanizeAgentKey`; the
  descriptions map (D-09) lives alongside.
- `apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts` —
  names-only `VARIABLE_REGISTRY` (keep shape); add the global descriptions map +
  sample-values map next to it (D-13/D-14).
- `apps/dispatch-control/app/(dashboard)/prompts/_components/variableHighlightExtension.ts`
  + `PromptEditor.tsx` — existing highlight + unknown-var save gate; unused-var hint
  (D-15) attaches without changing the gate.
- `apps/dispatch-control/lib/testRunClient.ts` — the typed client for
  `/agents/{key}/test-run`; mirror for the score call.
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` — the test-run endpoint
  (`TestRunRequest`/`TestRunResponse`, `_substitute`, `_load_prior_input`,
  `_require_operator`); model the scoring endpoint here.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` +
  `.../agents/qa/rubric.md` (mirror `prompts/rubric.md`) — the rubric the scorer
  must load (active version → disk fallback); the JudgeFinding axes are the score-
  axis reference (D-05). Reuse the rubric, NOT the six-section batch shape (D-04).
- `convex/promptVersions.ts` — `getActive` / `listActiveForWorkspace` / `saveVersion`
  / `activate` / version list/get; drift compares active content to the seed.
- `convex/schema.ts` — `prompt_versions`, `agents.description`, `agent_runs` /
  `agent_run_payloads`, `audit_log`, `runs`/`pipelineRuns`. Do NOT modify frozen
  `pipelineRuns`/`deliberationEvents`. Read `convex/_generated/ai/guidelines.md`.
- `docs/API_CONTRACTS.md` — **amend BEFORE code** (CLAUDE.md hard rule) for the new
  scoring endpoint contract and any test-run request additions (compare/score flags).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- View-first detail pane (`AgentPromptEditorView`) + list cards
  (`PromptsListClient`, `listActiveForWorkspace`, `humanizeAgentKey`) — the editorial-
  context surfaces attach here, no rebuild.
- `TestRunPanel` + `POST /agents/{key}/test-run` + `testRunClient.ts` — extend for
  active-side compare and score (no second cost recorder — reuse the OpenRouter
  token/USD capture path, per PITFALLS).
- `VARIABLE_REGISTRY` + `variableHighlightExtension` + the unknown-var save gate —
  descriptions/sample maps + unused-var hint layer ON TOP without changing shapes.
- `rubric.md` / `judge.py` axes — the scorer's rubric source + axis reference.
- `agents.description` (Convex, optional) — seed text for the D-09 descriptions map.
- `auditLog.ts` + `AuditLogViewer.tsx` — audit emissions/display already exist.
- `groupForAgentKey` taxonomy — drives the D-12 group filter.

### Established Patterns
- Token substitution is `str.replace("{token}", value)`, NOT `str.format()` —
  preserve in the assembled-preview substitution AND any server-side score input.
- Convex: per-table file, `workspace_id: v.string()` ("eisenbalm"), `by_workspace*`
  indexes, idempotent upserts.
- Pipeline reads active prompts at run start with disk/code fallback (CFG-03) — D-01
  keeps this; drift is "active DB content ≠ original seed".
- FastAPI dashboard endpoints gate on Clerk operator (`_require_operator`) — the
  score endpoint follows the same auth.
- Voice byte-equivalence is contract-tested (`test_voice.py`,
  `test_section_writer_voice_propagation.py`) — the scorer must not perturb the
  judge/voice paths.

### Integration Points
- `api/agents.py` — new scoring endpoint (or `score` option on test-run).
- `prompts/_components/*` — descriptions map, sample map, drift badge, search/filter,
  unsaved guard, side-by-side + score UI.
- `docs/API_CONTRACTS.md` — contract-first amendment for the scoring endpoint.
- `agentKey` join stays canonical across `prompt_versions` / `agents` /
  `VARIABLE_REGISTRY` / descriptions map (mind `editor`/`editor_gate1` etc.).

</code_context>

<specifics>
## Specific Ideas

- "Voice-drift guardrails are the throughline" — the score (advisory), the drift
  badge, the assembled preview, and the unsaved guard all serve safe authoring.
- The export must render the EXACT `.md`-marker byte form so a copy→commit keeps
  `load_prompt`/`_extract` byte-verification passing (the fallback stays valid).
- Keep the control plane brand-agnostic — the descriptions/sample maps and scorer
  operate on whatever the data/registry defines, not Eisenbalm-hardcoded labels.
- The scorer is purpose-built for a single output so it works across ALL agents,
  not only the six narrative section writers the QA judge targets.

</specifics>

<deferred>
## Deferred Ideas

- Pipeline-side CI sync script that writes active DB versions back to `.md`
  (considered for D-03; deferred in favor of dashboard copy-export).
- Reusing server `SAMPLE_FIXTURES` for the assembled preview (rejected for D-14 —
  revisit only if the client-side sample map drifts from reality).
- Hard/soft gating of save on a low voice score (rejected for D-06 — advisory only).
- Native `beforeunload` guard (rejected for D-11).
- Editable graph topology ("graph-as-data") — productization, not this phase.
- RBAC (`users.role` admin/operator) — deferred (schema comment references Phase 28
  but it is not in this phase's goal).

</deferred>

---

*Phase: 28-prompt-console*
*Context gathered: 2026-06-24*
