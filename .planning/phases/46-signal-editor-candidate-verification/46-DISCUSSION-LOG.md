# Phase 46: Signal Editor & Candidate Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 46-signal-editor-candidate-verification
**Mode:** discuss (`--auto` — all areas auto-selected, recommended default locked per question)
**Areas discussed:** Graph wiring & node placement, Story-lead contract, Brand-risk routing, verify_candidates design, Editorial Memory read & repetition warning, Signal Editor agent implementation

---

## Graph wiring & node placement

| Option | Description | Selected |
|--------|-------------|----------|
| `calibrator → signal_editor → scout → verify_candidates → advocate` | Calibrator stays config/style-brief anchor; Signal Editor is display step 1; verify_candidates the ◆ check | ✓ |
| `START → signal_editor → calibrator → scout` | Signal Editor before calibrator | |
| `verify_candidates` as an LLM `@agent_node` | Treat verification as an agent | |

**Auto-selected:** insert `signal_editor` (LLM `@agent_node`) after calibrator; `verify_candidates` (plain non-LLM node, mirroring `verify_research`) between scout and advocate; node count → 20; bump `test_builder_wiring.py`.
**Notes:** Matches ROADMAP §46 SC-4 and DERIVED-STATE-CONTRACT §7 step order (step 1 leads, step 3 ◆ verify-orgs). Least-disruptive: replaces the two existing edges only.

## Story-lead contract (SGE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| New `StoryLead` TypedDict + `story_leads` state field, contract-first | Exact SGE-01 fields; JSON-safe list; amend API_CONTRACTS §7 first | ✓ |
| Reuse `CharityCandidate`/pitchLog for leads | Avoid a new type | |
| Store leads only in Convex, not in state | Skip the state field | |

**Auto-selected:** dedicated `StoryLead` (premise, datedPeg, pegSourceUrl, readerEnergy, charitableAngle, category, confidence, brandRiskFlag+reason, repetitionWarning, recommended) + `story_leads: Optional[list[StoryLead]]`; contract-first; emit to the deliberation layer as the `signal` artifact.
**Notes:** JSON-serializable list mirrors `featured_charity_keys`/`claims` so it survives the Postgres checkpoint (SGE-04). Convex emission shape resolved in RESEARCH.

## Brand-risk routing (SGE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| `recommended` never true on a brand-risk lead; surface with reason for human | No auto-select; flag travels to Phase 47 | ✓ |
| Suppress brand-risk leads entirely | Drop risky leads | |
| Build a selection/adjudication step now | Over-builds Phase 47 | |

**Auto-selected:** Signal Editor may recommend a non-risky lead, never a brand-risk one; brand-risk leads carry `brandRiskReason` and are surfaced, not suppressed, not auto-chosen. Flag is the Signal Editor's own LLM judgment; no downstream override.
**Notes:** In a phase with no selection UI, "routes to the human" = no auto-select + flag persists for Phase-47 adjudication.

## verify_candidates design (SGE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic non-LLM (mirror verify.py); kill only on definitive failure; persist per-org record | httpx + Tavily; transient errors ⇒ `unverified`, keep candidate | ✓ |
| Hard-kill on any check failure incl. transient | Simpler but kills good orgs on a blip | |
| LLM-driven verification | Not deterministic; contradicts SC-3 "deterministic check" | |

**Auto-selected:** three checks (domain-live via httpx; registration-ID reachability reusing `charityNavigatorUrl`/`guidestarUrl`; obscurity press-scan via Scout's `web_search`). Kill only definitive failures; transient/ambiguous ⇒ keep + `unverified`. Per-org `VerificationRecord` persisted to state + Convex; all-killed ⇒ degraded/needs-human, never crash. Contract-first.
**Notes:** Reconciles "kill candidates that fail" with `verify_research`'s false-negative-safe posture. Exact registration source + obscurity threshold = RESEARCH; prefer no paid/gov API.

## Editorial Memory read & repetition warning (SGE-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Scout's `charities:listForDedup` + Phase-39 recent-coverage; attach advisory `repetitionWarning`; never drop | Surface-not-suppress; empty fallback on Convex-down | ✓ |
| Compute a diversity score | Rejected — Phase 39 D-04 kept it visible, not scored | |
| Drop/re-rank repetitive leads | Violates SGE-05 (must surface) | |

**Auto-selected:** reuse the Scout Convex read for avoid-list + recent coverage; attach `repetitionWarning` to overlapping leads; never suppress; `[]`-on-failure fallback mirrors `_load_registry_keys`.
**Notes:** Exact query (reuse `listForDedup` vs. a dedicated recent-coverage read joined to Sanity focusArea/location) = RESEARCH; prefer reuse.

## Signal Editor agent implementation

| Option | Description | Selected |
|--------|-------------|----------|
| LLM `@agent_node` + externalized prompt in config_loader + web_search budget + JSON-safe state | Mirrors the other 9 agents; capable editorial-tier model | ✓ |
| Hardcode the prompt inline | Breaks the externalized-prompt convention | |
| No web search (invent pegs) | Pegs wouldn't be real/dated/sourced | |

**Auto-selected:** `prompts/signal_editor.md` + `_user.md`, registered in `config_loader` (`SYSTEM_PROMPT_KEYS`/`USER_PROMPT_KEYS`/map/`MAX_TOKENS_BY_AGENT`) + seeded via `verify_prompt_seed.py`; `web_search` + `max_tool_calls` budget for dated pegs; all new state JSON-serializable for checkpoint resume; add a pause/resume test spanning the new nodes.
**Notes:** Exact model tier (Advocate/Editor class, not Haiku) = RESEARCH via `llm_config`.

## Claude's Discretion

- Signal Editor model tier; prompt/rubric wording for leads, brand-risk judgment, repetition phrasing.
- Convex store field names/indexes for leads + verification records (within the contract-first amendment).
- Obscurity press-hit threshold; registration-ID reachability scoring.
- Whether leads emit per-lead as `deliberationEvents` or into a dedicated table.

## Deferred Ideas

- All Stage-1 UI (lead cards, org options, "Needs your decision", editable Brief) → Phase 47.
- "Start from my brief" second entry point → Phase 48.
- Live government/paid registration API → out of scope.
- Algorithmic diversity score; auto-acting on the repetition warning → rejected/out of scope.
