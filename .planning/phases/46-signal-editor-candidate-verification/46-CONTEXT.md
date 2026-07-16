# Phase 46: Signal Editor & Candidate Verification - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (`--auto`) — all six areas auto-selected, recommended default locked per area

<domain>
## Phase Boundary

The v3.0 deferral (V3-DEF-02) comes due. Two nodes are added to the existing pipeline graph, growing it from 18 to 20 nodes, so that Stage 1 (built in Phases 47–48) has **real leads and verification records** to render:

1. A **Signal Editor** LLM agent that runs *before* Scout and emits 3–5 dated story leads, each with premise, dated peg + source link, reader energy, charitable angle, category, confidence, and a brand-risk flag where applicable (SGE-01). It never self-selects a brand-risk-flagged lead — that routes to the human (SGE-02). It reads Editorial Memory (recent coverage + avoid-list, from Phase 39) and *surfaces* a repetition warning alongside a lead rather than silently suppressing it (SGE-05).
2. A **`verify_candidates`** deterministic (non-LLM) check that runs *after* Scout and produces a verification record per organization — domain live, registration ID, obscurity/press scan — killing candidates that definitively fail (SGE-03).
3. The graph runs **20 nodes end-to-end** — `signal_editor` before `scout`, `verify_candidates` between `scout` and `advocate` — and the Postgres checkpointer resumes correctly across a pause/resume cycle spanning the new nodes (SGE-04).

Requirements: **SGE-01, SGE-02, SGE-03, SGE-04, SGE-05.**

**This is a self-contained BACKEND track.** It depends on Phase 39 (existing 18-node graph, Postgres checkpointer, Editorial Memory) and is **independent of Phases 40–45** — it has no dispatch-control / console dependency.

**Explicitly NOT in scope:**
- Any Stage-1 UI — lead cards, organization options, "Needs your decision" adjudication, the editable Brief (all **Phase 47**).
- The "Start from my brief" second entry point (**Phase 48**).
- Human *selection* among leads / among organizations — this phase produces the leads and records; humans adjudicate them in Phase 47's UI. SGE-02 here means the Signal Editor never *auto-selects* a brand-risk lead, not that it builds a selection UI.
- Changing Scout's discovery logic or the existing dedup/registry behavior beyond adding the read the Signal Editor needs.
- Any new paid/government verification API (see Deferred).

</domain>

<decisions>
## Implementation Decisions

### Graph wiring & node placement
- **D-01: Insert order is `calibrator → signal_editor → scout → verify_candidates → advocate`.** Calibrator stays the run-config anchor (it sets `style_brief` + resolves `narrator` first); `signal_editor` reads that context and is display **step 1** ("Find story leads") on the Run Details rail. Current `calibrator → scout` and `scout → advocate` edges are replaced with the chain above. (`.planning/ROADMAP.md` §46 SC-4; `DERIVED-STATE-CONTRACT.md` §7 step table.)
- **D-02: `signal_editor` is an LLM `@agent_node`; `verify_candidates` is a plain non-LLM node** wired directly with `add_edge`, exactly mirroring the existing `verify_research` precedent (added by `builder.py` as a bare `wrap_agent_node(...)` bottleneck, not an LLM agent). `verify_candidates` is the `◆` deterministic check ("Verify organizations", step 3).
- **D-03: Node count becomes 20.** Update `tests/test_builder_wiring.py` node/edge expectations. Both new nodes sit on the sequential pre-fan-out spine — no change to the 7-writer fan-out or the `validate_sections` join.

### Story-lead contract (SGE-01)
- **D-04: Add a `StoryLead` TypedDict** with exactly the SGE-01 fields: `premise`, `datedPeg`, `pegSourceUrl`, `readerEnergy`, `charitableAngle`, `category`, `confidence`, `brandRiskFlag: bool`, `brandRiskReason: Optional[str]` (populated only when flagged), plus `repetitionWarning: Optional[str]` (SGE-05) and `recommended: bool` (SGE-02 gate). A Pydantic model enforces the shape at the agent boundary (the `body: list[dict]` / `claims` precedent in `state.py`).
- **D-05: Add `story_leads: Optional[list[StoryLead]]` to `DispatchState`.** JSON-serializable `list[dict]` (mirror the `featured_charity_keys` "list NOT set" and `claims: list[dict]` precedents so it survives the Postgres checkpoint — SGE-04).
- **D-06: Contract-first.** Amend `docs/API_CONTRACTS.md` §7 (DispatchState + the `StoryLead` shape) **before** touching `state.py` — CLAUDE.md hard rule: "do not modify field names without checking API_CONTRACTS.md first." Also record the `signal` inspector artifact / `signal_editor` step there (§ derived-state, already stubbed at API_CONTRACTS ~L4883 "no Signal Editor exists until Phase 46").
- **D-07: Emit leads to the deliberation layer** so Phase 47 can render them (as the `signal` artifact type — `DERIVED-STATE-CONTRACT.md` §8). Persist via a new `deliberationEvents` event type (e.g. `signal-lead`) and/or a dedicated store — the exact Convex shape is contract-first and resolved in RESEARCH, reusing the `pitchLog:insert` / `deliberationEvents` emission precedent Scout already uses. "Nothing silent."

### Brand-risk routing (SGE-02)
- **D-08: `recommended` is never `true` when `brandRiskFlag` is `true`.** The Signal Editor may mark a single non-risky lead as recommended, but a brand-risk-flagged lead is always surfaced with its `brandRiskReason` and left for the human to adjudicate (in Phase 47). It is **never suppressed and never auto-chosen** — "routes the decision to the human" means no auto-select, given there is no selection UI in this phase.
- **D-09: Brand-risk detection is the Signal Editor's own LLM judgment**, driven by its prompt/rubric, and it must attach a concrete `brandRiskReason`. No downstream node overrides or re-derives the flag.

### verify_candidates design (SGE-03)
- **D-10: Deterministic, non-LLM, conservative — mirror `agents/verify.py`.** `httpx` (≈10s timeout, follow_redirects, desktop UA) + reuse Scout's `web_search` client for the press scan. No LLM call, no cost recording. Operates on `state['candidates']` (`list[CharityCandidate]`).
- **D-11: Three checks per organization:**
  - **domain live** — `httpx` GET the candidate `website`; DNS-resolves + 2xx/3xx (after redirects) ⇒ live.
  - **registration ID** — presence + reachability of a registration record, reusing the fields already on `CharityCandidate` (`charityNavigatorUrl`, `guidestarUrl`). A reachable registration URL/identifier ⇒ pass. The exact authoritative source (EIN lookup vs. Charity Navigator / GuideStar page reachability) is a RESEARCH question — **prefer no new paid/government API**.
  - **obscurity / press scan** — a bounded search (reuse Scout's Tavily `web_search`) on the org name; a low hit-count ⇒ genuinely obscure (pass); heavy mainstream coverage ⇒ fail "not obscure enough."
- **D-12: Kill only on DEFINITIVE failure.** Domain does not resolve, no registration found at all, or clearly not-obscure ⇒ candidate killed. **Transient/ambiguous errors** (timeout, 5xx, SSL/DNS blip, rate-limit) ⇒ candidate KEPT with that check marked `unverified` — the `verify_research` conservative posture, so a network blip never kills a good org. This reconciles SC-3 ("kill candidates that fail") with the "false-negative-safe" fetch posture.
- **D-13: `VerificationRecord` per org** — approximately `{domainLive: bool, registrationId: str|None, registrationVerified: bool, obscurity: {pressHits: int, verdict}, status: 'pass'|'fail'|'unverified', killed: bool, killReason: str|None, checkedAt}`. Persisted to `DispatchState` (checkpointed, JSON-safe) **and** to Convex for Phase-47 rendering. Killed candidates are recorded with their `killReason` — never silently dropped. Contract-first (amend API_CONTRACTS before the store lands).
- **D-14: Kill mechanism = filter `state['candidates']` to survivors before Advocate.** If **all** candidates are killed, do **not** crash — surface a degraded / needs-human state (mirror the existing `error` / editor-gate pause posture), so a run with zero survivors is recoverable rather than fatal.

### Editorial Memory read & repetition warning (SGE-05)
- **D-15: Reuse the Scout Convex read precedent** (`charities:listForDedup` → featured + blocklisted dedup keys) as the avoid-list source, plus the Phase-39 recent-coverage data (last-8 featured charities' cause/geo). Prefer reusing an existing query over inventing a new one; whether the Signal Editor calls `listForDedup` directly or a dedicated recent-coverage read (joined to Sanity `focusArea`/`location`) is a RESEARCH question — prefer reuse.
- **D-16: Surface, never suppress.** Attach an advisory `repetitionWarning` string to any lead that overlaps recent coverage or the avoid-list (e.g. "avoid US-SE · avoid weather"). The lead is still emitted. No lead is dropped or hidden on repetition grounds (SGE-05 explicit).
- **D-17: Empty fallback when Convex is unavailable** — mirror Scout's `_load_registry_keys` `[]`-on-failure behavior. The Signal Editor still emits its leads; it simply omits repetition warnings that run. First-run safety.

### Signal Editor agent implementation
- **D-18: Externalized prompt, like the other 9 agents.** Add `prompts/signal_editor.md` + `prompts/signal_editor_user.md`; register the keys in `lib/config_loader.py` (`SYSTEM_PROMPT_KEYS`, `USER_PROMPT_KEYS`, the prompt-key map, and `MAX_TOKENS_BY_AGENT`), and seed them via the existing prompt-seed script (`scripts/verify_prompt_seed.py` / `prompt_versions`). Contract-first for the new keys.
- **D-19: Web-search tool budget for dated pegs.** The Signal Editor needs current, dated news to produce a real "dated peg + source link," so give it the same `web_search` + `max_tool_calls` budget pattern Scout uses (AGT-18). Pegs must be real and sourced, not invented.
- **D-20: JSON-serializable everything for checkpoint resume (SGE-04).** `story_leads` and the verification records are `list[dict]` (never sets/objects), following the `featured_charity_keys` precedent, so the Postgres checkpointer resumes cleanly across `signal_editor → scout → verify_candidates`. Add a pause/resume test spanning the new nodes.

### Claude's Discretion
- The Signal Editor's exact model tier (RESEARCH): a capable **editorial/reasoning** model in the Advocate/Editor class — **not** Scout's Haiku — resolved through the existing `llm_config` / `MAX_TOKENS_BY_AGENT` system.
- Exact prompt wording/rubric for lead generation, brand-risk judgment, and repetition-warning phrasing.
- The precise field names/indexes of the Convex store(s) for leads + verification records (within the contract-first amendment).
- The exact obscurity threshold (press-hit count) and how registration-ID reachability is scored — tune in RESEARCH against real candidates.
- Whether leads are emitted per-lead as `deliberationEvents` or into a dedicated table (match whichever fits the Phase-47 render + existing emission precedent best).

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 46 (~L1002) — goal + 5 success criteria; §Phase 47/48 (~L1014, L1028) for what consumes this phase's output (do NOT build it here).
- `.planning/REQUIREMENTS.md` — SGE-01..05 (~L394); V3-DEF-02 promotion note (~L435).
- `.planning/PROJECT.md` §Current Milestone — locked v4.0 decisions.

### Contract boundary (HARD RULE — amend BEFORE code)
- `docs/API_CONTRACTS.md` §7 — `DispatchState` + nested TypedDicts (the `StoryLead` + `story_leads` + verification-record additions land here first); ~L4883 the `signal` step "no Signal Editor exists until Phase 46" note; §33.7 (~L2902) the `hookClaim`/`hookVerified` verification-card model to stay consistent with.

### Design intent (binding)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §7 (11 action-named steps: "Find story leads — Signal Editor" #1, "Verify organizations — ◆ deterministic check" #3) + §8 (Inspector artifact contract — `signal` = story leads, `org` = organization selection).
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` §Story & Brief (~L50 lead fields: premise, dated peg + source, reader energy, angle, category, brand-risk warning, confidence) + §Editorial Memory (~L138 recent coverage last-8 + #8 repetition warning "avoid US-SE · avoid weather").
- `docs/CLAUDE_CODE_BRIEF.md` — nine-agent pipeline framing + Jesse voice/gravity constraints the Signal Editor's leads must honor.

### Editorial Memory dependency (Phase 39)
- `.planning/phases/39-registry-coverage-memory-strip/39-CONTEXT.md` — recent-coverage (last-8 featured) + `charity_corrections` + the Scout `charities:listForDedup` read path the Signal Editor's avoid-list reuses (D-15).

### Existing code (build on these)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — the 18-node wiring; insert `signal_editor` + `verify_candidates` here (D-01/D-02).
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` + `CharityCandidate` + the `featured_charity_keys`/`claims` JSON-safe precedents (D-04/D-05/D-20).
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py` — the deterministic non-LLM node precedent `verify_candidates` mirrors (D-10/D-11/D-12).
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` — `@agent_node` pattern, `_load_registry_keys` (`charities:listForDedup`), Tavily `web_search`, `pitchLog:insert` emission, `max_tool_calls` budget (D-15/D-18/D-19).
- `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` — `SYSTEM_PROMPT_KEYS` / `USER_PROMPT_KEYS` / prompt-key map / `MAX_TOKENS_BY_AGENT` to register the Signal Editor prompts (D-18).
- `packages/pipeline/src/eisenbalm_pipeline/prompts/` — externalized prompt dir; add `signal_editor.md` + `signal_editor_user.md`.
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — pipeline→Convex read/write path for the avoid-list read + lead/record emission.
- `packages/pipeline/scripts/verify_prompt_seed.py` — prompt-seed path for the new prompt keys.
- `packages/pipeline/tests/test_builder_wiring.py` — node/edge assertions to bump to 20 nodes (D-03).
- `convex/schema.ts` — `deliberationEvents` (typed event literals ~L29; a new `signal-lead`/verification type lands here), `pitchLog` (~L110), `charities` registry (~L367) — the emission + read homes (D-07/D-13/D-15).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`verify_research` is the exact template** for `verify_candidates` — a standalone non-LLM node, httpx-based, conservative (fetch failure ⇒ not-verified), no deliberationEvent, no cost. `verify_candidates` extends the pattern by *persisting* records (they're a rendered artifact) and *killing* definitive failures.
- **Scout already proves every path the Signal Editor needs**: `@agent_node` wiring, externalized prompt via `config_loader`, Tavily `web_search`, `max_tool_calls` budget, the `charities:listForDedup` Convex read (avoid-list), and `pitchLog:insert` emission.
- **`CharityCandidate` already carries `charityNavigatorUrl` + `guidestarUrl`** — the registration-ID check (D-11) reuses these; no schema change needed on the candidate for registration source.
- **JSON-safe list precedent** (`featured_charity_keys` "list NOT set", `claims: list[dict]`) — how `story_leads` + verification records stay checkpoint-safe (SGE-04).
- **Editorial Memory (Phase 39)** — last-8 featured coverage + `charity_corrections` + the registry read path already exist; the Signal Editor reads, it does not rebuild.

### Established Patterns
- **Contract-first** (CLAUDE.md hard rule): amend `docs/API_CONTRACTS.md` §7 before `state.py`, before the Convex store shapes.
- **"Nothing silent"**: killed candidates + verification records are recorded with reasons and emitted, never dropped.
- **Conservative determinism**: false negatives acceptable, false positives are not — a blip marks `unverified`, it does not kill (D-12).
- **Empty/degraded fallbacks over crashes**: Convex-down ⇒ empty avoid-list; all-candidates-killed ⇒ needs-human, not a fatal error.
- **Sequential-in-main-checkout execution** (Phases 36–39) — no worktrees, avoids the Phase 35 strand problem.
- **Convex functions need live sync** (memory `[[convex-functions-need-live-sync]]`): any `convex/*.ts` change must be synced to `dev:modest-magpie-797` (`pnpm --filter @eisenbalm/convex dev:once`) — committing ≠ deployed.

### Integration Points
- `graph/builder.py` — two new nodes on the pre-fan-out spine (`calibrator → signal_editor → scout → verify_candidates → advocate`).
- `graph/state.py` / `docs/API_CONTRACTS.md` §7 — `StoryLead` + `story_leads` + verification-record fields.
- `agents/signal_editor.py` (new) + `agents/verify_candidates.py` (new) — the two nodes.
- `prompts/signal_editor*.md` + `config_loader.py` + `scripts/verify_prompt_seed.py` — the new prompt registration + seed.
- `convex/schema.ts` + `convex_client.py` — the lead/record emission home + the avoid-list read.
- `tests/test_builder_wiring.py` + a new checkpointer pause/resume test spanning the new nodes.

</code_context>

<specifics>
## Specific Ideas

- The v3 Run Details rail (`DERIVED-STATE-CONTRACT.md` §7) is the north star: this phase makes steps **1 ("Find story leads — Signal Editor")** and **3 ("Verify organizations — ◆ deterministic check")** real. Everything else on the rail already exists.
- The phase's operative contrast is "**Stage 1 has real leads and verification records to render**" — the acceptance is that Phase 47 can render genuine data, so the leads must be sourced/dated and the verification records must be persisted, not just computed and discarded.
- SGE-02's "routes the decision to the human" is subtle in a phase with no selection UI: it means **no auto-select of a brand-risk lead**, plus the flag+reason travels with the lead for Phase-47 adjudication. Do not over-build a selection mechanism here.
- SGE-05 is a *surface-not-suppress* requirement by design — the human wants to *see* the repetition and decide, mirroring Phase 39's "repetition is visible, not computed-into-a-score."
- Keep the deterministic check honestly conservative: SC-3 says "kill candidates that fail," but a good obscure org must not die on a transient timeout (D-12).

</specifics>

<deferred>
## Deferred Ideas

- **All Stage-1 UI** — lead cards (premise/peg/energy/angle/category/confidence/brand-risk shown in full), organization options grouped under a lead, "Needs your decision" adjudication, the editable Brief → **Phase 47** (Story & Brief Stage).
- **"Start from my brief" second entry point** (human premise skips discovery, enters at Researcher) → **Phase 48**.
- **Live government / paid registration API** (real-time EIN lookup, official charity-registry API) → out of scope; use reachable registration URLs + existing `CharityCandidate` fields unless RESEARCH surfaces a free, reliable source.
- **Algorithmic "diversity score" for repetition** — considered and rejected (SGE-05 keeps it a visible warning, consistent with Phase 39 D-04).
- **Auto-acting on the repetition warning** (dropping/re-ranking leads) — out of scope; the Signal Editor surfaces, the human decides.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 46-signal-editor-candidate-verification*
*Context gathered: 2026-07-15 via smart discuss (`--auto`)*
