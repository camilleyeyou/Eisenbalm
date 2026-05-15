# Phase 5: Agent Quality - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace every Phase 4 stub agent body with a real LLM-driven implementation while preserving the `@agent_node` decorator contract Phase 4 locked. The pipeline shape, the three-datastore write order, the runId discipline, the `interrupt()` / `resume` mechanics, the `validate_sections` gate, the `CostRecorder` flush — all stay. Phase 5 changes only what's *inside* each agent function: prompts, model calls, web-search tool use, source verification, structured output parsing, voice judgment.

**In scope:**

- Real OpenRouter integration in `lib/openrouter_client.py` (replaces `stubs/fake_openrouter.py` usage when `EISENBALM_STUB_MODE=false`); single client wrapper that records token counts into `CostRecorder` after every call
- Real **Calibrator**: emits styleBrief with hardcoded `voice` constants module + `bonusType` rotation (queries Sanity for previous N issues' `bonusType` via GROQ, picks one of `bigBudget | jingle | specAd` excluding last week's) — AGT-01, AGT-02
- Real **Scout**: Tavily tool use, returns 3–5 candidates, in-memory dedup against a single GROQ-loaded set of previously-featured charities, iteration-limit enforced, per-candidate `pitchLog` write as found — AGT-03, AGT-04, AGT-18
- Real **Advocate**: scores each Scout candidate 1–10 with rationale, writes per-candidate `agentVotes` + `advocate-argument` events — AGT-05
- Real **Editor gate 1**: structured deliberation transcript (Scout findings + Advocate arguments + Editor reasoning), winner selection with `editorDecision` + `runnerUpNotes`, `interrupt()` only when score gap is below a configured threshold AND human signal needed — AGT-06
- Real **Researcher**: Tavily tool use to deep-dive winning charity, returns structured research object including `founderName` + `founderNameSourceUrl`, then post-Researcher `httpx` verification step (case-insensitive substring + last-name fallback) sets `founderNameVerified` — AGT-07, AGT-08, AGT-18
- Real **OriginStoryWriter**, **ProblemWriter**, **FounderBioWriter**, **CaseStudyWriter** (and **BonusWriter**, **GameWriter** — voice-isolated): each receives a structurally isolated `voiceConstraints` block (not concatenated with prior agent state); CaseStudyWriter consumes `subjectNameVerified` and falls back to role-based framing when false — AGT-09, AGT-10
- **BonusWriter** branching on `bonusType`: emits `{ headline, body, storyboards[] }` for bigBudget, `{ headline, body, lyrics, sunoPrompt }` for jingle, `{ headline, body }` for specAd — AGT-11
- **GameWriter**: emits `{ headline, description, embedCode }` where `embedCode` is self-contained HTML/JS (no external CDNs, no `<script src=…>`). Game validator itself is Phase 7 — Phase 5 only enforces the *no external dependency* constraint at the prompt level — AGT-12
- **DesignAgent**: emits 6-digit hex colors validated programmatically before Sanity write; fonts from an enforced whitelist (~25 fonts, web + WeasyPrint compatible) — AGT-13, AGT-14
- Real **QA**: hard-rule deterministic checklist + LLM-as-judge structured output per Jesse voice rubric; one holistic pass over all section bodies after fan-out; emits per-finding `qaCorrections` rows with `severity` ∈ `info | warning | error`; never blocks the draft — AGT-10, AGT-15
- Real **Editor Final**: reviews QA output, writes any connective copy, emits `editor-final` event — AGT-16
- **Model pinning** for voice-critical agents (Calibrator, Editor[gate 1 + final], QA); resolved model recorded into `weeklyIssue.pipelineMetadata.modelVersions` JSON per run — AGT-17
- **Iteration limits** enforced on every tool-using agent via the existing `@agent_node` decorator wrapper; controlled error written to `deliberationEvents` on overrun — AGT-18
- **Cost containment**: soft alert at 70% of per-run cap, hard cap halts the run with `pipelineRuns.status='failed'` + descriptive `errorMessage`; per-agent token + USD records flushed to `pipelineRuns.cost` (JSON) at run end (mechanism already shipped by Phase 4 D-22)
- Real **Publisher**: only the LLM-touched parts of Publisher change in Phase 5 — currently stub Publisher writes `publisher-deploy` event and sets `awaiting-review`. Phase 5 keeps this exactly the same; **real PDF generation is Phase 6**. Phase 5 Publisher updates may add the `editor-final` connective-copy hand-off if Editor Final emits new fields.
- **`EISENBALM_STUB_MODE` toggle flipped to `false` as the new default**; `true` remains supported for the existing PIP-06 integration test
- **Voice-isolation prompt scaffolding**: a single `lib/voice.py` module exports the canonical Jesse voice constants + a `build_section_writer_prompt(voiceConstraints, sectionContext, researchObject)` helper that every section writer calls — guarantees the "structurally isolated" requirement is enforced by code, not convention
- **Output validation per agent**: Pydantic models in `graph/state.py` (already present from Phase 4) — Phase 5 adds per-agent input/output Pydantic schemas; malformed model output triggers one regeneration attempt before falling back to a controlled error
- **Per-run integration test** that exercises the real pipeline end-to-end against a dev dataset (small token budget, voice-critical agents pointed at a cheap stand-in for the live runs) — proves AGT-* criteria mechanically before Andrew's smoke

**Strictly NOT in this phase:**

- PDF generation / WeasyPrint integration — Phase 6
- Sanity → Pipeline webhook (HMAC, age check, idempotency, 30s delay, Vercel deploy hook) — Phase 6
- Game embedCode validator + sandbox enforcement on the rendered page — Phase 7
- Stripe / commerce — Phase 8
- Live Convex deliberation UI on the issue page — Phase 9
- Podcast audio player — Phase 9
- LangSmith tracing — defer (Phase 4 D deferred-ideas held; revisit only if debugging needs force it)
- Suno API integration — V2-01 (manual `sunoAudioUrl` paste by Andrew stays)
- NotebookLM API integration — V2-02 (manual transcript export by Andrew stays)
- Per-section retry on QA `error` — out of scope per QA decision below (annotation-only, never blocks; never re-invokes the writer)
- CI gates — Phase 1 D-15 deferred; Phase 5 holds the line

</domain>

<decisions>
## Implementation Decisions

### QA voice rubric mechanics

- **D-01: Two-layer rubric — deterministic hard-rule checklist + LLM-as-judge.** Layer 1 in `agents/qa/rules.py` is a list of deterministic predicates over each section body: no exclamation marks, no sentimentality keywords (`heartwarming`, `inspiring`, `incredible`, `amazing`, `truly`, `simply`, `journey of`, etc. — list authored from CLAUDE_CODE_BRIEF.md voice notes), no winking constructions (`if you can call it that`, `believe it or not`), no AI self-reference (`as an AI`, `I'm Jesse, an AI`). Each hit emits a `qaCorrections` row with `severity='error'` and the offending quoted span. Layer 2 is one LLM call per run with the full Jesse voice rubric in the system prompt and all section bodies in the user prompt; returns structured JSON `{ findings: [{ section, severity, axis, quotedSpan, reasoning, suggestedFix }] }` keyed against axes: `gravity` (Fortune-500 treatment maintained), `sentiment` (no sentimentality), `irony-signaling` (no winks), `precision` (no vague claims), `cross-section-consistency` (founder bio tone matches case-study tone). Why two layers: hard rules catch the obvious; LLM-judge catches subtlety; deterministic floor under model lapses.
  - **Why:** PROJECT.md "Voice drift is the highest-impact failure mode (the brand collapses)" + AGT-15. A single LLM judge call is insufficient defense; a pure regex is insufficient sophistication.
  - **How to apply:** Planner ships `agents/qa/rules.py` (deterministic predicates), `agents/qa/rubric.md` (the LLM judge prompt — checked-in, version-controlled, edited by Andrew when voice drifts), `agents/qa.py` (orchestrates both layers and writes to Convex). Both layers' findings go into the same `qaCorrections` table — readers/Andrew can't tell which layer caught what without reading `axis`.

- **D-02: QA writes annotations only — never rewrites, never blocks.** Every QA finding lands in Convex `qaCorrections` with `acceptance='pending'`. The Sanity draft is written from the section writers' output verbatim. Andrew sees QA flags in Studio (v1: raw Convex panel adjacent to the draft; richer UI ships in Phase 9). Andrew is the single editorial voice — QA surfaces concerns, Andrew decides what to fix.
  - **Why:** PROJECT.md "Andrew is the manual guard" + REQUIREMENTS Out of Scope "Automatic publishing without Andrew." Auto-rewrite compounds model risk and removes Andrew's edit primacy.
  - **How to apply:** `agents/qa.py` MUST NOT mutate any field on `state` other than `qa_corrections`. Pydantic schema for `qaCorrections` row matches the existing Convex `qaCorrections:insert` mutation contract (see [[d-08]] below for severity semantics).

- **D-03: One holistic QA pass over all sections after fan-out.** Single LLM-as-judge call per run, scoped to all six section writer outputs at once (OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus). DesignAgent and the gate-1 deliberation are NOT in QA's scope (Design has its own hex/font validators; gate-1 already shipped its transcript). One LLM call → N `qaCorrections` rows.
  - **Why:** Cross-section consistency (Founder Bio adoring + Problem Statement neutral = voice drift). Per-section parallel QA misses this entirely. Matches the existing `@agent_node` single-agent pattern Phase 4 locked.
  - **How to apply:** QA node in `graph/builder.py` runs after the `validate_sections` join, before `editor_final`. Receives all section bodies in `state`. Layer-1 hard rules run section-by-section (per section parallel allowed); layer-2 LLM judge runs once across all sections concatenated with section markers.

- **D-04: QA never blocks the draft.** Severities (`info | warning | error`) are Andrew-facing only — the pipeline always proceeds to `editor_final` → Sanity write → `pipelineRuns.status='awaiting-review'`. QA `error` does NOT halt the pipeline, does NOT auto-regenerate any section, does NOT set `pipelineRuns.status='failed'`.
  - **Why:** Weekly cadence > automated guard severity. Andrew sees errors in Convex `qaCorrections` before publishing. Brand failure surfaces in Sanity Studio review, not in the pipeline run.
  - **How to apply:** `agents/qa.py` always returns success state; the `@agent_node` wrapper never sees an exception from QA unless it's a literal infrastructure failure. Severity is metadata on each `qaCorrections` row, nothing more in v1.

### Model selection, pinning, and sampling

- **D-05: Tiered model selection by voice-criticality.**
  - **Voice-critical (Opus):** Calibrator, Editor[gate 1], Editor[final], QA → `anthropic/claude-opus-4-7` (or latest stable Opus at planning time)
  - **Section writers (Sonnet):** OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter, BonusWriter, GameWriter, Researcher → `anthropic/claude-sonnet-4-6`
  - **Mechanical (Haiku):** Scout, Advocate, DesignAgent → `anthropic/claude-haiku-4-5-20251001` (Publisher stays on its Phase 4 no-LLM shape until Phase 6)
  - **Why:** Brief says "Claude (via OpenRouter)" for voice-critical agents — locked. Tiering keeps per-run cost in the $3–6 range (vs. ~$15+ for Opus-everywhere) while preserving brand integrity where it matters.
  - **How to apply:** Per-agent model IDs centralised in `lib/llm_config.py` as `MODEL_BY_AGENT: dict[str, str]`. Resolved model + revision recorded into `state['model_versions'][agent_id]` after every call; flushed to `weeklyIssue.pipelineMetadata.modelVersions` JSON at pipeline end.

- **D-06: Pin voice-critical model IDs verbatim; section writers + mechanical use latest-stable OpenRouter aliases.** Opus pin lives in `lib/llm_config.py` as `MODEL_PIN_VOICE_CRITICAL = 'anthropic/claude-opus-4-7'` (no `:latest` suffix; OpenRouter alias resolves to a specific snapshot OpenRouter records). Section writers use `'anthropic/claude-sonnet-4-6'` (latest-stable alias accepted). Mechanical use `'anthropic/claude-haiku-4-5'` (alias accepted). The resolved snapshot returned by OpenRouter is recorded into `modelVersions` regardless of whether the request used a pin or an alias — `modelVersions` is the observability surface.
  - **Why:** AGT-17 + PITFALLS.md §1.4 (OpenRouter alias drift). Pinning every agent is brittle (alias retirements force per-agent edits); pinning nothing exposes brand voice to silent upgrades. Tiered pinning is the literal AGT-17 reading.
  - **How to apply:** Planner edits `lib/llm_config.py` to use exact OpenRouter model identifiers. If a pinned model is retired, the OpenRouter call fails fast and Andrew is paged — easier debug surface than silent drift.

- **D-07: Sampling defaults by tier (single source of truth in `lib/llm_config.py`).**
  - Voice-critical: `temperature=0.2`, `top_p=1.0`
  - Section writers: `temperature=0.7`, `top_p=1.0`
  - Researcher (factual): `temperature=0.3`, `top_p=1.0`
  - Scout (factual, tool-using): `temperature=0.3`
  - DesignAgent: `temperature=0.4`
  - **Why:** Voice consistency requires low temperature on judging/calibrating agents; section writers need creative range within Jesse voice (deterministic writers sound mechanical).
  - **How to apply:** `SAMPLING_BY_AGENT: dict[str, dict]` in `lib/llm_config.py`. Agent code reads from this map — no agent hardcodes its own sampling.

### Cost containment

- **D-08: Soft alert at 70% of per-run cap + hard halt at 100%.** Per-run dollar cap default `PIPELINE_COST_CAP_USD=10.0` (env-overridable). `CostRecorder` (already shipped by Phase 4 D-22) checks the cumulative USD total after every LLM call. At 70%, emits a `deliberationEvents` row with `eventType='cost-warning'` and `payload={ totalUsd, percentOfCap, perAgent }`. At 100%, raises `CostCapExceeded` exception inside the next LLM call's wrapper — `@agent_node` catches and sets `pipelineRuns.status='failed'` with `errorMessage='cost-cap-exceeded: $X.XX of $Y.YY (agent: Z)'`. Per-agent token budgets also enforced (e.g. Scout=12k completion, Researcher=20k completion) via OpenRouter's `max_tokens` field on each request.
  - **Why:** PITFALLS.md §1.5 (per-run cost runaway). Without a hard cap, a single recursive tool-use bug burns the monthly budget in one weekend.
  - **How to apply:** Extend `lib/cost.py` `CostRecorder` with `check_cap()` method and `CostCapExceeded` exception. New env vars in `.env.example`: `PIPELINE_COST_CAP_USD`, `PIPELINE_COST_WARN_PCT` (default `0.7`).

### Scout strategy

- **D-09: Tavily for Scout + Researcher web search.** `TAVILY_API_KEY` env var already reserved by Phase 4 D-31. Use LangChain's `TavilySearchAPIWrapper` (or a thin httpx wrapper if LangChain integration is unstable at planning time — verify via research step). Brave NOT used in v1; abstraction layer NOT built.
  - **Why:** Brief lists Tavily first; LangChain integration is well-trodden; one less surface area than abstracting both. Premature abstraction violates the project's "don't design for hypothetical future requirements" stance.
  - **How to apply:** `lib/search_client.py` exports `async def web_search(query: str, *, max_results: int = 5) -> list[SearchResult]`. Scout and Researcher both call this — no other call sites.

- **D-10: Scout dedup against Sanity charity archive — single GROQ at Scout start, in-memory filter.** Scout's first action is one GROQ query: `*[_type == "charity"]{ name, slug, website }`. Holds the result set in memory. Each candidate Scout finds is filtered (case-insensitive name match OR slug match OR website-domain match) before writing to `pitchLog`. One Sanity round-trip per run.
  - **Why:** AGT-04. Per-candidate Sanity lookups add round-trip latency for no v1 benefit (no concurrent runs in v1). Read-once mirrors Phase 1/2 patterns.
  - **How to apply:** Add `featured_charity_keys` to `DispatchState` (set of name|slug|domain tuples) populated by Scout before its first Tavily call; Scout's candidate-emit step checks against this set.

### Researcher source verification (AGT-07, AGT-08)

- **D-11: Case-insensitive substring match + last-name fallback for `founderName` verification.** Researcher emits `founderName` + `founderNameSourceUrl` (the URL where Researcher's tool use found the name). Post-Researcher verification node fetches the URL via `httpx` (10s timeout, follows redirects, sets a desktop User-Agent header), strips HTML to text (use `lxml` or `selectolax`), normalizes whitespace, searches for `founderName` case-insensitive. If no match, retry with last-name-only. If still no match — or if `httpx` raises (timeout, 4xx/5xx, SSL, connection error) — set `state['research']['founderNameVerified'] = false`. Successful match sets `founderNameVerified = true`. Same pattern for CaseStudyWriter's `subjectName` against `subjectNameSourceUrl`.
  - **Why:** AGT-07 + AGT-08. Conservative — false negatives (true founders flagged unverified) are acceptable because the fallback framing reads as deliberate Fortune-500 anonymity. False positives (wrong name confirmed) are not — they ship a factual error.
  - **How to apply:** New node in `graph/builder.py` between Researcher and the fan-out: `verify_research`. Lives in `agents/verify.py` or inline; not an `@agent_node` because it makes no LLM call and emits no `deliberationEvents` row. Verification result goes into `state['research']`.

- **D-12: Anonymous-by-role framing on verification failure.** When `founderNameVerified=false`, FounderBioWriter receives `{ founderName: null, founderNameVerified: false, founderRole: <Researcher-emitted role string e.g. 'founder' or 'executive director'> }` and writes in the role frame: "The founder, a former actuary, started the work in 2003 after…" Voice stays intact — anonymity reads as deliberate. Same for CaseStudyWriter: `{ subjectName: null, subjectRole: <e.g. 'a parent'>, subjectNameVerified: false }`. The Sanity draft `founderName` field is left empty; Andrew can fill it manually if he can verify the name himself.
  - **Why:** AGT-07/09 explicitly say "falls back to anonymous framing." Skipping the section breaks issue completeness (8 sections every issue). Visible "name withheld" markers leak low-confidence to readers.
  - **How to apply:** Section-writer prompts include a conditional system block: "If `subjectNameVerified` is false, the subject MUST be referred to by role only; do not invent or guess a name." Output validation rejects any first-name token in body when `subjectNameVerified=false` (Layer-1 hard rule in QA also catches this as a backstop).

### Voice isolation, prompt scaffolding, output validation (Claude's Discretion)

Planner has flexibility here, but the architectural intent is captured below for the researcher and planner agents to honor:

- **D-13:** `lib/voice.py` is the single source of truth for Jesse voice constants. Exports `VOICE_CONSTRAINTS: str` (the canonical Jesse voice block from CLAUDE_CODE_BRIEF.md "Voice and tone notes"), plus `build_section_writer_prompt(*, voice_constraints, section_id, research_object, style_brief, charity)`. Every section writer calls this helper — no writer assembles its own prompt from `state` ad-hoc. Guarantees AGT-10's "structurally isolated voiceConstraints block (not concatenated with prior agent state)" by code, not convention.
- **D-14:** Per-agent output validation via Pydantic models (already present from Phase 4 in `graph/state.py` for the section shapes). Phase 5 adds strict response-parsing: each writer's LLM call uses OpenRouter's JSON-mode (or instructor-style retry) to coerce model output into the Pydantic shape. On parse failure, retry once with the parse error appended to the prompt; on second failure, raise — `@agent_node` wrapper catches and sets `pipelineRuns.status='failed'` with `errorMessage='<agent>: malformed-output: <pydantic error>'`. Same regenerate-on-fail policy applies to QA's structured findings output.

### DesignAgent constraints

- **D-15:** Hex validation: regex `^#[0-9a-fA-F]{6}$` programmatically before Sanity write. Layer-2 WCAG-AA contrast check on (background, text) and (background, primary) pairs at Sanity-write time using the same algorithm Phase 2's theme engine ships (`apps/web/src/lib/theme/contrast.ts` — port the formula to Python, or re-emit ratios so values land in the issue page's existing fallback path). Failure ⇒ DesignAgent regenerates once; second failure ⇒ falls back to a hardcoded safe theme + `qaCorrections` row severity=warning.
- **D-16:** Font whitelist (~25 fonts, web + WeasyPrint compatible) — **OPEN ITEM, flagged in STATE.md as Phase 5 blocker.** Planner produces a candidate list in `agents/design/font_whitelist.py` (sourced from Google Fonts → WeasyPrint compatibility verified by test render of each); Andrew approves before Phase 5 closes. Whitelist enforced at write time in `agents/design.py` — any font outside the list ⇒ regenerate once ⇒ second failure ⇒ fall back to whitelist defaults `{ display: 'Playfair Display', body: 'Source Serif Pro' }`.

### Calibrator bonus rotation (AGT-01)

- **D-17:** Calibrator queries Sanity for `*[_type == "weeklyIssue" && status == "published"] | order(issueNumber desc)[0..2]{ bonusType }` — last 3 published issues' bonus types. Picks one of `bigBudget | jingle | specAd` that does not match the most recent issue's `bonusType`. Tie-broken deterministically by `(issueNumber + offset) mod 3` so re-runs of the same `issueNumber` always pick the same `bonusType`.

### Editor gate 1 winner selection (Claude's Discretion within these constraints)

- **D-18:** Editor receives Scout candidates with Advocate scores and arguments. Selection rule: highest Advocate score wins by default. `interrupt()` fires only when the top two scores are within `EDITOR_INTERRUPT_THRESHOLD=1.0` of each other AND Editor's own structured-output reasoning emits `confidence < 0.7`. Otherwise Editor picks the top score and produces `editorDecision`, `runnerUpNotes`, and a structured `deliberationTranscript` (Scout findings + Advocate arguments + Editor reasoning concatenated in NotebookLM-friendly format — the source for the podcast). Phase 4 D-13 mechanics for `interrupt()` + `Command(resume=...)` resume path stay unchanged.

### Bonus branching (AGT-11)

- **D-19:** Single `agents/bonus.py` module with three internal prompt builders keyed on `state['style_brief']['bonusType']`. Each branch produces output that satisfies its Pydantic schema (defined in `graph/state.py` already from Phase 4). For `jingle`: `sunoPrompt` is a 40-80 word description of musical style, instrumentation, mood, and lyrical theme; `sunoAudioUrl` left empty (Andrew populates manually per V2-01 deferred). For `bigBudget`: `storyboards` is an array of 3-5 `{ shotNumber, description }` items.

### GameWriter shape (AGT-12, Phase 7 owns the validator)

- **D-20:** GameWriter prompts explicitly enumerate forbidden constructs (`<script src=…>`, `<link href=…>`, `fetch(`, `XMLHttpRequest`, `window.parent`, etc. — Phase 7's validator list mirrored at the prompt level). Output JSON: `{ headline, description, embedCode }`. Phase 5 ships a *prompt-level* defense; Phase 7 ships the *renderer-level* validator. If the prompt-level defense fails (validator rejects in Phase 7), reader sees "Game unavailable" fallback (GAM-05).

### Iteration limits (AGT-18)

- **D-21:** Existing `@agent_node(max_tool_calls=N)` decorator enforces. Phase 5 sets explicit limits: Scout=8, Researcher=12, all others=None. Overrun raises a controlled error (`AgentToolCallLimitExceeded`) caught by the wrapper; emits `deliberationEvents` with `eventType='agent-tool-limit-exceeded'`, `payload={ agentId, attempts, limit }`, sets `pipelineRuns.status='failed'`.

### Stub-mode toggle

- **D-22:** `EISENBALM_STUB_MODE` env var default flips to `false`. `true` still supported and exercised by the Phase 4 PIP-06 integration test (re-runs verbatim in Phase 5 CI-ish smoke). The toggle remains in `lib/openrouter_client.py` (or its successor): on `true`, calls return canned `stubs/fixtures.py` outputs and record zero tokens; on `false`, calls hit OpenRouter live. Agent code never branches on the toggle.

### Claude's Discretion

Planner has flexibility on:
- Exact directory split inside `agents/qa/` (one file vs `rules.py` + `judge.py` + `prompt.md`) — recommendation noted in D-01
- Whether to use LangChain's Tavily integration or a thin httpx wrapper around the Tavily REST API — confirm during researcher step which is most stable for `langchain==<phase4-pin>` × `tavily-python==<latest>`
- Whether voice-critical agents use OpenRouter's JSON-mode, function-calling, or instructor-style retry for structured output — pick whichever has the most reliable parse rate at planning time
- Exact `deliberationTranscript` format (Markdown vs structured JSON-in-string vs structured TypedDict serialized) — must be NotebookLM-ingestion-friendly; recommend Markdown with section headers
- Whether `verify_research` is a standalone node or a hook inside Researcher's wrapper — recommend standalone node so the wrapper stays generic
- Font whitelist exact entries (within the constraint of web + WeasyPrint compatibility) — pending Andrew approval per D-16
- Whether to add LangSmith tracing in Phase 5 or hold for v2 — recommend hold unless the planner's research turns up a clear debugging blocker
- Per-section few-shot examples vs zero-shot in writer prompts — recommend zero-shot first, add few-shot only if voice drift surfaces in QA

### Folded Todos

(None — `gsd-tools todo match-phase 5` returned 0 matches.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 contract surfaces (read first)

- `docs/CLAUDE_CODE_BRIEF.md` lines 78–210 ("The nine-agent pipeline") — canonical per-agent input/output contract; Phase 5 implementations realize these contracts
- `docs/CLAUDE_CODE_BRIEF.md` lines 359–367 ("Voice and tone notes for agent prompts") — the source for `lib/voice.py` `VOICE_CONSTRAINTS` constant + the LLM-judge rubric prompt in `agents/qa/rubric.md`
- `docs/API_CONTRACTS.md` §2.2 — `weeklyIssue` Sanity write shape; every section writer's Pydantic output must serialize to a slice of this
- `docs/API_CONTRACTS.md` §3.3 — `pitchLog:insert` mutation (Scout per-candidate write)
- `docs/API_CONTRACTS.md` §3.4 — `deliberationEvents:insert` mutation (all `eventType` values used in Phase 5: `scout-finding`, `advocate-argument`, `editor-decision`, `section-draft`, `qa-correction`, `editor-final`, `cost-warning`, `agent-tool-limit-exceeded`, `publisher-deploy`)
- `docs/API_CONTRACTS.md` §3.5 — `agentVotes:insert` mutation (Advocate per-candidate write)
- `docs/API_CONTRACTS.md` §3.6 — `qaCorrections:insert` mutation (QA per-finding write); `severity` enum locked at `info | warning | error`
- `docs/API_CONTRACTS.md` §7 — `DispatchState` TypedDict (Phase 4 D-02 copied verbatim from this section; Phase 5 expands per-agent Pydantic input/output schemas inside the same module)

### Existing pipeline scaffolding (Phase 4 — Phase 5 swaps bodies, not contracts)

- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — `@agent_node` decorator. **Locked contract.** Phase 5 only changes function bodies.
- `packages/pipeline/src/eisenbalm_pipeline/agents/{calibrator,scout,advocate,editor,researcher,origin_story,problem,founder_bio,case_study,game,bonus,design,qa,publisher}.py` — Phase 4 stub bodies; Phase 5 replaces each body
- `packages/pipeline/src/eisenbalm_pipeline/agents/validate.py` — `validate_sections` join node; stays as-is
- `packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py` + `stubs/fake_openrouter.py` — stub-mode path. **Stays for tests.** Phase 5 adds a real path; toggle is `EISENBALM_STUB_MODE`.
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `CostRecorder`. Phase 5 extends with `check_cap()` per D-08.
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`, `lib/sanity_client.py`, `lib/portable_text.py` — already shipped; Phase 5 only consumes
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` shape; Phase 5 adds per-agent Pydantic input/output schemas in same module or sibling
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — `StateGraph` topology. Phase 5 inserts the `verify_research` node between Researcher and the fan-out (D-11)

### Schemas (read; do NOT modify unless explicitly noted)

- `convex/schema.ts` — Phase 4 patches landed (`pipelineRuns.cost`, `pipelineRuns.durationMs`). Phase 5 does NOT add fields; uses existing tables
- `convex/qaCorrections.ts` — `qaCorrections:insert` mutation; `severity` enum verbatim
- `convex/deliberationEvents.ts` — `deliberationEvents:insert` mutation; new `eventType` values `cost-warning` and `agent-tool-limit-exceeded` are accepted (already permissive `v.string()` on `eventType` — verify during planning)
- `apps/studio/schemas/weeklyIssue.ts` — `pipelineMetadata` open object; `modelVersions` JSON-text field accepts the resolved per-agent model map
- `apps/studio/schemas/charity.ts` — Scout writes new candidates via `create_or_replace` with deterministic `_id = charity-{slugify(name)}`; Researcher's verified `founderName` goes onto the `weeklyIssue` (not `charity`)
- `apps/studio/sanity.types.ts` — regenerated only if schemas change; Phase 5 should NOT need a regen

### Research artifacts (auto-loaded; Phase 5 planner should re-read)

- `.planning/research/STACK.md` "Pipeline Backend Layer" — pinned Python deps (Phase 4 used these); Phase 5 may add `tavily-python`, `lxml` (HTML parsing for verification), `selectolax` (alternative HTML parser); planner confirms exact pins
- `.planning/research/PITFALLS.md` §1.3 — Parallel phase partial failure → `validate_sections` already shipped
- `.planning/research/PITFALLS.md` §1.4 — OpenRouter alias drift → D-06 (voice-critical pinning) addresses
- `.planning/research/PITFALLS.md` §1.5 — Per-run cost runaway → D-08 (soft alert + hard cap) addresses
- `.planning/codebase/INTEGRATIONS.md` "OpenRouter / Tavily / Suno / NotebookLM" — integration points; Phase 5 lights up OpenRouter + Tavily (Suno/NotebookLM stay manual per V2-01/V2-02)

### Prior CONTEXT.md files (consumed)

- `.planning/phases/01-sanity-foundation/01-CONTEXT.md` — deterministic `_id` patterns (`charity-{slug}`, `agent-{agentId}`); manual external-service init checkpoint pattern (carry forward for any new Phase 5 service); env wiring discipline
- `.planning/phases/02-web-shell-theme-engine/02-CONTEXT.md` — theme engine validators (hex regex, WCAG contrast, font names) — Phase 5 DesignAgent must produce outputs compatible with Phase 2's render-time validators
- `.planning/phases/03-convex-deployment/03-CONTEXT.md` — Convex HTTP API pathway (`Authorization: Convex {key}`, `POST /api/mutation`); already exercised by Phase 4 stub pipeline
- `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` — **Phase 5's parent context.** Carries forward: `@agent_node` decorator (D-15 in Phase 4), three-datastore write order (D-18 in Phase 4), runId discipline (D-09 in Phase 4), `CostRecorder` flush mechanics (D-22 in Phase 4), `EISENBALM_STUB_MODE` toggle semantics (D-17 in Phase 4), iteration-limit decorator parameter (D-25 in Phase 4)

### Phase 5 dedicated research flag (planner will spawn `gsd-phase-researcher`)

- **Jesse-voice QA rubric design** (per ROADMAP.md "Research flag" on Phase 5). Researcher must produce `agents/qa/rubric.md` candidate prompt + `agents/qa/rules.py` candidate predicate list, both authored from `docs/CLAUDE_CODE_BRIEF.md` "Voice and tone notes." This is the single most load-bearing prompt in the project; expect 2–3 review iterations with Andrew before the rubric lands.

### Forward-link contracts owed by Phase 5

- **Phase 6 (PDF + webhook):** ProblemWriter's `pdfContent` output shape must satisfy WeasyPrint template input — Phase 6 owns the template, Phase 5 ships the shape. Confirm contract during planning.
- **Phase 7 (Game):** GameWriter `embedCode` must pass Phase 7's validator (no `<script src>`, no `fetch(`, no `window.parent`, etc.). Phase 5 enforces at the prompt level (D-20); Phase 7 enforces at the renderer level. The validator's deny-list is the authoritative reference Phase 5 prompts mirror.
- **Phase 9 (Deliberation UI):** every `deliberationEvents` row Phase 5 writes is consumed by Phase 9's live subscription; row shapes must match `docs/API_CONTRACTS.md §3.4` and `§4.3` exactly. Phase 5 introduces two new `eventType` strings (`cost-warning`, `agent-tool-limit-exceeded`) — Phase 9 UI must render them gracefully (degrade-to-`info`-style row if unknown).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — `@agent_node` decorator. Phase 5 only writes inside decorated functions
- `packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py` — the stub-mode call-site Phase 5 mirrors into `lib/openrouter_client.py` for real-mode (same async interface; toggle via `EISENBALM_STUB_MODE`)
- `packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py` — deterministic per-agent fixtures Phase 5 keeps for regression tests; real-mode outputs will resemble (but not equal) these shapes
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `CostRecorder` context manager. Phase 5 extends with `.check_cap()` (D-08) — no new module needed
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` and section-output TypedDicts. Phase 5 adds per-agent Pydantic input schemas alongside
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — `StateGraph` topology; Phase 5 inserts `verify_research` node between Researcher and the fan-out
- Phase 2 `apps/web/src/lib/theme/contrast.ts` — WCAG-AA algorithm; Phase 5 DesignAgent re-implements in Python for write-time contrast check (D-15)
- Phase 1 agent-profile seed at `apps/studio/seeds/agents.json` — every agent's `personality`/`role` copy is the canonical voice source for that agent's system prompt header (in addition to `lib/voice.py`)
- Phase 4 PIP-06 integration test harness — Phase 5 re-runs verbatim with `EISENBALM_STUB_MODE=true`; adds a parallel `test_pipeline_real_mode.py` against a tiny token budget for AGT-* mechanical proof

### Established Patterns

- **One wrapper decorator owns the agent lifecycle** (Phase 4 D-15) — Phase 5 keeps; agent bodies are pure async functions returning `DispatchState` updates
- **Deterministic `_id`s for inserts** (Phase 1 D-17, Phase 2 D-17) — Scout new-candidate writes use `charity-{slugify(name)}`; idempotent
- **Three-datastore write order** (Phase 4 D-18) — Phase 5 follows verbatim; only adds the `verify_research` no-write node and the two new `deliberationEvents.eventType` values
- **Schema patches are additive, never breaking** (Phase 3 → Phase 4 pattern) — Phase 5 does not patch Convex or Sanity schemas; only consumes
- **Pin major+minor** for npm; **pin exact patch** for Python (Phase 4 D-04) — Phase 5 holds; adds `tavily-python` + `lxml`/`selectolax` (planner confirms)
- **Single production deployment per environment** — one Railway, one Supabase, one Convex, one Sanity dataset
- **No CI gates in v1** (Phase 1 D-15) — Phase 5 holds; integration tests run locally + against Railway URL
- **Field names locked across schemas + contracts + types** — Phase 5 honors; `DispatchState` shape unchanged from Phase 4
- **Manual interactive CLI checkpoints by Andrew for external services** — Phase 5 has no new external service to provision (Tavily key issuance done by Andrew once, env-set on Railway)

### Integration Points

- `lib/openrouter_client.py` (new in Phase 5) — single async client; every agent's LLM call routed through it; records cost into `CostRecorder`; honors `EISENBALM_STUB_MODE`
- `lib/search_client.py` (new in Phase 5) — Tavily wrapper used by Scout + Researcher only
- `agents/qa/` directory (new in Phase 5) — `rules.py` (deterministic predicates), `rubric.md` (LLM-as-judge prompt, version-controlled), `qa.py` (orchestrates both layers)
- `lib/voice.py` (new in Phase 5) — `VOICE_CONSTRAINTS` constant + `build_section_writer_prompt(...)` helper; every section writer consumes
- `lib/llm_config.py` (new in Phase 5) — `MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, `MODEL_PIN_VOICE_CRITICAL` — single source of truth
- `agents/design/font_whitelist.py` (new in Phase 5) — Andrew-approved list; enforced at write time
- `agents/verify.py` (new in Phase 5) — `verify_research` node; `httpx` fetch + HTML strip + name search

### Constraints from Existing Code

- Phase 4 `@agent_node` signature is kwargs-only (`name`, `emit_event`, `payload_builder`, `max_tool_calls`) — Phase 5 agent declarations must match this signature exactly
- `validate_sections` join node already enforces "every section field populated" — Phase 5 writers must satisfy it; missing fields are still a hard failure
- Convex `qaCorrections.severity` is exact enum (`info | warning | error`) — D-01 + D-02 + D-04 must use those exact strings
- Sanity `pipelineMetadata.modelVersions` is `text` (JSON-stringified) — Phase 5 serializes the per-agent map into this; no schema change
- Phase 2 theme engine validates hex + fonts at render time — DesignAgent must produce outputs that pass these validators (D-15, D-16)

</code_context>

<specifics>
## Specific Ideas

- **The QA rubric in `agents/qa/rubric.md` is the most important prompt in the project.** Treat it like a configuration artifact: version-controlled, reviewable by Andrew, edited (not regenerated) when voice drift surfaces in production. Researcher must produce a first draft authored from CLAUDE_CODE_BRIEF.md voice notes lines 359–367 + the seeded agent-profile `personality` copy from Phase 1's `apps/studio/seeds/agents.json` for the `qa` agent.

- **Andrew remains the single editorial voice.** QA writes annotations; QA never rewrites. The Sanity draft Andrew reviews is what the writers produced, not what QA wished they'd produced. This is a deliberate brand choice (PROJECT.md "Andrew is the manual guard") that the planner must NOT optimize away by adding auto-rewrite or auto-regenerate paths.

- **Phase 5's real-mode integration test is the proof.** A single `test_pipeline_real_mode.py` run that completes within the cost cap, writes a Sanity draft with `pipelineMetadata.modelVersions` populated, and produces zero `qaCorrections` rows with `severity='error'` from Layer-1 hard rules — that's the bar.

- **`modelVersions` JSON in `pipelineMetadata` is the observability surface for AGT-17.** Andrew (or any engineer) opens Sanity Studio, reads the JSON, knows exactly which model version produced each agent's output for that issue. If voice drift surfaces in a later issue, this is the diff target.

- **Cost cap default of $10/run is conservative.** First real run measures actuals (PROJECT.md context: "Per-run LLM cost baseline unknown until first real OpenRouter runs"). After ~5 runs, Andrew can adjust `PIPELINE_COST_CAP_USD` based on observed P95.

- **The font whitelist is the only true blocker.** Every other Phase 5 decision can be made without Andrew; the font list (D-16) is the explicit STATE.md blocker. Planner schedules the font-list decision early in the phase so writing/code work proceeds in parallel with Andrew's approval.

- **Voice isolation is a code requirement, not a convention.** `build_section_writer_prompt()` is the only path to assemble a section writer's prompt. If a writer tries to read `state['origin_story']` (i.e., another section's output) inside its own prompt assembly, it's a code bug. Reviewer should catch this; planner specs it.

- **Editor gate 1's `interrupt()` is rare by design.** With a deterministic top-score winner default (D-18), most runs never trigger the human gate. The gate exists for genuine ties (score gap < 1.0 + low Editor confidence) — both must hold. This protects the weekly cadence.

</specifics>

<deferred>
## Deferred Ideas

- **LangSmith tracing** — moved from Phase 4 deferred to Phase 5 deferred; revisit only if real-run debugging surfaces opacity that logs can't solve
- **Per-section retry on QA `error`** — D-04 explicitly rejects this; Andrew is the single editorial voice. If the model fails to produce Jesse voice on second pass, that's an Andrew-review moment, not an auto-correct moment
- **Auto-rewrite by QA** — same reasoning as above
- **Cron-triggered weekly `/run/weekly`** — V2-03 from REQUIREMENTS.md; v1 is manually triggered
- **Suno API integration** — V2-01; Phase 5 emits `sunoPrompt`; Andrew pastes `sunoAudioUrl` manually
- **NotebookLM API integration** — V2-02; Phase 5 produces `deliberationTranscript`; Andrew runs NotebookLM manually
- **Per-developer Supabase Postgres databases** — single production matches Phases 2/3/4
- **Voice-drift dashboard** — V2-06; surfaces QA rubric scores across issues over time
- **Source citations from Scout's research surfaced in deliberation events** — V2-08; v1 deliberation shows arguments without external links
- **Multi-pass QA (cheap pass + deep pass)** — D-01 picks single-pass two-layer; revisit only if QA cost runs high relative to the per-run cap
- **Build a search-provider abstraction** — D-09 picks Tavily; revisit only if Tavily's terms become a problem
- **Fuzzy founder-name match (Levenshtein/rapidfuzz)** — D-11 picks case-insensitive substring + last-name fallback; revisit only if false-negative rate exceeds ~30% on real runs
- **LLM verifier for founder name** — D-11 picks substring; an LLM verifier would add cost for marginal accuracy gain
- **Section writer few-shot examples** — Claude's Discretion item; planner ships zero-shot first, adds few-shot only if voice drift surfaces
- **Researcher fetches secondary sources before fallback (Charity Navigator, GuideStar)** — D-11 picks single-source verification; planner notes for v2 if accuracy demands
- **Per-Convex-row retry on transient failure** — Phase 4 D-21 holds: log + continue; Convex is on Railway VPC, retries add complexity for marginal benefit
- **OpenRouter prompt caching** — explore if cost cap is consistently approached; Claude prompt caching is a real cost lever (~50% savings on cached system prompts). Defer to a planner-discretion optimization if cost runs tight on first real runs.
- **`/dev/replay` endpoint** — useful debug surface; defer to ad-hoc Phase 5+ work

### Reviewed Todos (not folded)

(None — `gsd-tools todo match-phase 5` returned 0 matches.)

</deferred>

---

*Phase: 05-agent-quality*
*Context gathered: 2026-05-15*
