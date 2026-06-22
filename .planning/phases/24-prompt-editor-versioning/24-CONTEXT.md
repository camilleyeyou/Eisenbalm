# Phase 24: Prompt Editor + Versioning - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the operator a **write-capable prompt console** in `apps/dispatch-control` — the
first write/control surface on the dashboard (Phases 21–23 were read-only). Deliver:

- A **CodeMirror** editor (new dependency) for each agent's prompt(s) with `{variable}`
  highlighting and an unknown/mangled-variable warning before save (PRM-01, PRM-02).
- **Save-as-immutable-version**: every save creates a new `prompt_versions` row
  (incrementing `version`, never overwriting), with author + timestamp + optional note
  (PRM-03).
- **Diff** any two versions side-by-side (PRM-04).
- **Activate / rollback** a chosen version in one click; activation is **blocked** while a
  run is in progress, with a visible explanation (PRM-04).
- **Single-agent test-run**: run one agent against supplied input and see output + cost,
  without running the whole pipeline (PRM-05) — brief flags this as priority.
- **`VOICE_CONSTRAINTS`** becomes a versioned first-class config entry, edited via the same
  save-as-version flow (PRM-06).

**Explicitly in scope (full editable corpus — see D-01):**
- System prompts (already migrated to `prompt_versions` as v1 in Phase 22) — add the
  versioning/diff/rollback/activate UI on top.
- **User-prompt templates** — externalize the currently code-built templates (the
  `str.replace("{token}", …)` strings) into versioned `prompt_versions` entries and switch
  the call sites to read them.
- **Section-writer guidance** — migrate the inline `SECTION_GUIDANCE` strings
  (`origin_story`, `problem`, `founder_bio`, `case_study`) into versioned rows (Phase 22
  deferred these here).
- **`qa/rubric.md`** — versioned, editable entry (Phase 22 deferred here).
- **`VOICE_CONSTRAINTS`** — versioned first-class entry (PRM-06).
- New convex mutations for versioning (`saveVersion`, `activate`, list/get-by-version) +
  in-progress-run guard on activation.
- New pipeline backend endpoint for single-agent test-run (`POST /agents/{key}/test-run`).
- Per-agent variable registry (canonical source of valid template variables) driving
  highlight + warning.
- Audit-log emissions for save/activate/rollback (audit infra exists from Phase 23).

**Explicitly NOT in scope (later phases):**
- Run control / scheduler / kill switch / cancel / re-roll / budget caps — Phase 25.
- Review gate / charity registry — Phase 26.
- Stripe reconciliation / notifications — Phase 27.
- Editable graph topology ("graph-as-data" edges from DB) — Phase 28 / productization.
- Model/temperature/tokens/enabled editing UI is NOT the focus of this phase (those rows
  exist on `agents` from Phase 22); this phase is about **prompt text** editing +
  versioning. If a model picker is trivially co-located it's Claude's discretion, but the
  versioned-prompt corpus is the deliverable.

</domain>

<decisions>
## Implementation Decisions

### Editable scope (discussed in detail) — FULL CORPUS
- **D-01: Everything becomes editable + versioned this phase.** All of: system prompts,
  user-prompt templates, section-writer `SECTION_GUIDANCE`, `qa/rubric.md`, and
  `VOICE_CONSTRAINTS`. This fully satisfies the roadmap goal ("system prompt AND
  user-prompt template") and clears both Phase 22 deferrals (section guidance, rubric). It
  is a large phase — the planner should split into multiple plans (e.g. versioning
  data-layer + convex mutations → editor UI + variable awareness → diff/activate/rollback →
  test-run backend+UI → user-template externalization → section-guidance/rubric migration →
  VOICE_CONSTRAINTS versioning). Each newly-externalized asset follows the Phase 22 pattern:
  migrate the existing on-disk/in-code text into `prompt_versions` as a v1 active row with
  **byte-verification (zero diff)**, switch the call site to read from the active version,
  and retain the disk/code original as fallback (CFG-03 fallback discipline carries forward).

### Activation while a run is in progress (discussed)
- **D-02: Block with explanation — do NOT queue.** When a run is in progress, the Activate
  control is disabled and shows a clear reason (e.g. "A run is in progress — activation will
  be available when it finishes"). No pending-activation queue, no deferred-apply state.
  Activating when no run is in progress takes effect immediately for the next run. Rationale:
  the Phase 22 run-start snapshot already makes editing mid-run safe; blocking activation is
  the simplest, most predictable guard and avoids building/maintaining queue state. The
  in-progress check reads run status (`runs` / `pipelineRuns`).

### Single-agent test-run (discussed) — PRIORITIZED
- **D-03: Test-run executes the CURRENT unsaved editor draft**, not only saved versions, so
  the operator can iterate on a prompt and test it before committing a version. This is the
  high-value workflow.
- **D-04: Support all four input-sourcing modes:**
  - **Pull prior-real input** — operator picks a past run; the agent's actual input is
    loaded from `agent_run_payloads` (Phase 23 OBS-05 store).
  - **Edit unsaved draft** — covered by D-03 (the prompt under test is the live editor
    buffer).
  - **Manual variable entry** — a form to fill each template variable by hand.
  - **Canned sample fixture** — a built-in sample input per agent for one-click testing with
    no setup.
- Test-run returns the agent's output **and cost** (read from the same OpenRouter
  token/USD capture path as the pipeline — no second cost recorder). It must NOT run the
  full pipeline and must NOT mutate any real run/issue.

### Variable awareness (discussed)
- **D-05: Canonical per-agent variable registry is the source of truth.** A map of
  `agentKey → allowed variable names` drives both the distinct-color highlight and the
  unknown/mangled-variable warning shown before save (PRM-02). Where the registry lives
  (code constant vs Convex row vs derived-at-build) is **Claude's discretion**, but it must
  be authoritative enough that "unknown variable" is a real validation, not a guess. The
  registry must be populated from the actual variables each agent substitutes today (e.g.
  `{VOICE_CONSTRAINTS}`, `{FORBIDDEN_CONSTRUCTS}`, `{charity_name}`, `{issue_number}`,
  `{featured_keys}`, `{previous_bonus_types}`, `{chosen_bonus_type}`,
  `{EDITOR_INTERRUPT_THRESHOLD}`, `{EDITOR_CONFIDENCE_THRESHOLD}`, `{display_list}`,
  `{body_list}`, `{STRUCTURE_CONTRACT}`, … — see call sites in canonical_refs).

### Claude's Discretion
- Exact convex mutation signatures for `saveVersion` / `activate` / version-list/get, and
  whether rollback is just `activate(olderVersion)` (likely yes — rollback == activate a
  prior version).
- Diff rendering library/approach (success criterion requires **side-by-side**).
- Where the variable registry physically lives (D-05).
- Test-run endpoint shape, isolation mechanism (how to invoke a single agent node outside
  the graph), and how the unsaved-draft prompt is passed in.
- CodeMirror integration specifics (which `@codemirror`/`@uiw/react-codemirror` packages,
  the custom highlight extension for `{variable}` tokens).
- Editor layout, version-history list presentation, empty states, mobile behavior.
- Whether non-prompt agent config (model/temp/tokens) editing is co-located (not required).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & reconciliation (read first)
- `docs/MISSION_CONTROL_BRIEF.md` — §2 ("editing never overwrites — new version; activate
  flips live"; run-start snapshot protects in-flight runs), §3A (Agent control & prompt
  editing: system + user template, variable awareness, **test-run prioritized**, versioning
  + diff + one-click rollback/activate), §5 (data model: `prompt_versions`, `audit_log`;
  API surface incl. `POST /agents/{key}/test-run`), §8/Phase 2 roadmap entry.
- `docs/CURRENT_STATE.md` — Phase 0: prompts already file-externalized (loader swap, not
  string extraction). Confirms what's already migrated vs. what this phase newly
  externalizes (user-templates, section guidance, rubric).

### Research (v2.0 milestone)
- `.planning/research/SUMMARY.md` — versioning model; migration seeds files as v1 active
  rows; loader-swap-with-fallback discipline.
- `.planning/research/ARCHITECTURE.md` — config-in-Convex; `state["config"]` read path;
  snapshot-before-invoke (why mid-run editing is safe → D-02).
- `.planning/research/PITFALLS.md` — prompt-DB fallback (keep disk/code originals); no
  second cost recorder (test-run cost reads the existing capture path); `workspace_id`
  discipline; byte-equivalence on migrated assets.

### Prior phase context (the foundation this phase builds on)
- `.planning/phases/22-config-externalization/22-CONTEXT.md` — `prompt_versions` seeded v1
  (system prompts only); user-templates, section guidance, rubric, VOICE_CONSTRAINTS **all
  explicitly deferred to Phase 24**; loader-swap + byte-verification pattern; CFG-03
  fallback granularity; agentKey canonical mapping (`editor`/`editor-final` .md vs
  `editor_gate1`/`editor_final` keys).
- `.planning/phases/23-node-wrappers-read-only-dashboard/23-CONTEXT.md` — read-only
  dashboard + `agent_runs` / `agent_run_payloads` (prior-real I/O store for test-run D-04)
  + audit-log infrastructure (this phase emits the prompt save/activate audit rows).
- `.planning/phases/21-auth-app-shell-convex-schema/21-CONTEXT.md` — dispatch-control shell,
  Clerk auth, `prompt_versions`/`audit_log` table origins.

### Existing code / contracts (edit/migration targets)
- `convex/schema.ts` — `prompt_versions` (workspace_id, agentKey, version, content,
  isActive, createdAt, createdBy, note) + `by_workspace_agentKey` index; `agent_runs` /
  `agent_run_payloads` (test-run prior-real input source); `audit_log`; `runs` /
  `pipelineRuns` status (in-progress detection for D-02). Read
  `convex/_generated/ai/guidelines.md` first. Do NOT modify frozen
  `pipelineRuns`/`deliberationEvents`.
- `convex/promptVersions.ts` — current `upsertActive` (idempotent v1 seed) + `getActive`
  (loader read). **Add** `saveVersion` (increment version, never overwrite), `activate`
  (flip isActive, with in-progress-run guard), version list/get-by-version queries.
- `convex/auditLog.ts` — shared audit-write helper (actor + timestamp + before/after) to
  call on save/activate/rollback.
- `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py` — `load_prompt()` + `_extract()`
  (byte-exact marker extraction) — the byte-verification oracle for newly-migrated assets.
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `VOICE_CONSTRAINTS` (PRM-06).
  ⚠️ Subtlety: Phase 16 decomposed it into two parts and there are import-time
  byte-equivalence sentinels + `test_voice.py` invariants (`assemble_voice(None) ==
  VOICE_CONSTRAINTS`). Versioning this must preserve those invariants — research how the
  active version feeds `assemble_voice` without breaking the sentinel.
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — fallback model/temp set
  (Phase 22 D-05); cost capture path lives alongside the agent call layer.
- Section guidance to migrate: `agents/origin_story.py`, `agents/problem.py` (inline
  `SECTION_GUIDANCE`) — and confirm `founder_bio`/`case_study` equivalents.
- User-template call sites to externalize (the `str.replace("{token}", …)` corpus — source
  for D-05 variable registry): `agents/game.py`, `agents/scout.py`, `agents/bonus.py`,
  `agents/calibrator.py`, `agents/editor.py` (×2), `agents/researcher.py`,
  `agents/design/__init__.py`.
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — existing FastAPI router pattern
  (`/run/weekly`, `/run/{id}/status`, dashboard auth) — model the new
  `POST /agents/{key}/test-run` endpoint here.
- `apps/dispatch-control/app/(dashboard)/prompts/page.tsx` — the placeholder this phase
  replaces with the real editor.
- `apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx`,
  `graph/_components/AgentIOPanel.tsx` — existing read patterns to reuse (I/O panel ↔
  test-run output display; audit viewer ↔ save/activate rows).
- `docs/API_CONTRACTS.md` — amend BEFORE code (CLAUDE.md hard rule) for any new
  `prompt_versions` mutation contracts, the test-run endpoint contract, and any
  `DispatchState`/config additions. Frozen `pipelineRuns` (§4) unchanged.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prompt_versions` table + `promptVersions.ts` (`upsertActive`/`getActive`) — extend with
  versioning mutations; the seed/migration idempotent-upsert pattern carries to the newly
  externalized assets.
- `agent_run_payloads` (Phase 23) — the store for "pull prior-real input" (D-04).
- `auditLog.ts` write helper + `AuditLogViewer.tsx` — audit emissions + display already
  exist; wire prompt save/activate/rollback into them.
- `cost.py` / OpenRouter token+USD capture — test-run reads cost from the same path (no
  second recorder, per PITFALLS).
- `load_prompt()` / `_extract()` byte-exact extraction — the verification oracle for
  migrating user-templates, section guidance, rubric, and VOICE_CONSTRAINTS to v1 rows.
- `AgentIOPanel.tsx` — output-display pattern reusable for the test-run result panel.

### Established Patterns
- Prompt token substitution is `str.replace("{token}", value)`, NOT `str.format()` —
  preserve when reading externalized templates from the active version.
- Convex: `defineTable` + `v.*` + `by_workspace*` indexes; deterministic/idempotent upserts;
  `workspace_id: v.string()` ("eisenbalm"); per-table file (`promptVersions.ts`, etc.).
- Config read path: pipeline reads active prompts at run start into `state["config"]` and
  snapshots them (Phase 22) — newly externalized assets join this same loader/snapshot path.
- Voice byte-equivalence is contract-tested (`test_voice.py`,
  `test_section_writer_voice_propagation.py`) — migrations must keep assembled strings
  byte-identical when the active version equals the seeded default.

### Integration Points
- `convex/promptVersions.ts` — new versioning/activation mutations + in-progress guard.
- `apps/dispatch-control/.../prompts/page.tsx` — the real editor replaces the placeholder;
  CodeMirror dependency added to `apps/dispatch-control/package.json`.
- `api/runs.py` (or a new `api/agents.py` router) — `POST /agents/{key}/test-run`.
- The agent call sites + `lib/voice.py` — switch to reading externalized active versions
  with disk/code fallback.
- `agentKey` join must stay canonical across `prompt_versions`, `agents`, `llm_config`, and
  the variable registry (mind `editor`/`editor-final` vs `editor_gate1`/`editor_final`).

</code_context>

<specifics>
## Specific Ideas

- "Prioritize the test-run" (brief §3A) — and make it test the **unsaved draft** so the
  operator's iterate→test→save loop is tight (D-03).
- Each newly-externalized asset must migrate with **zero byte-diff** against its current
  on-disk/in-code source, exactly like the Phase 22 system-prompt migration — this is the
  safety rail that keeps voice/output identical until someone deliberately edits.
- Keep the control plane brand-agnostic: the editor operates on whatever agents/variables
  the data defines, not Eisenbalm-hardcoded labels.

</specifics>

<deferred>
## Deferred Ideas

- Run control (trigger, cancel, scheduler/kill switch, single-agent re-roll within a real
  run, budget caps) — Phase 25.
- Review gate / charity registry — Phase 26.
- Stripe reconciliation / notifications / `model_pricing` staleness — Phase 27.
- Editable graph topology ("graph-as-data") — Phase 28 / productization.
- A pending-activation queue (rejected in favor of block-with-explanation, D-02) — revisit
  only if operators find blocking too restrictive.

</deferred>

---

*Phase: 24-prompt-editor-versioning*
*Context gathered: 2026-06-22*
