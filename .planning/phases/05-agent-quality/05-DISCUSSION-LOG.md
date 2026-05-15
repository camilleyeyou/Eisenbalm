# Phase 5: Agent Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 05-agent-quality
**Areas discussed:** Jesse-voice QA rubric design, Model selection + cost containment, Scout strategy + Researcher verification

---

## Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Jesse-voice QA rubric design | Mechanics of voice judgment; corrections action; scope; severity semantics | ✓ |
| Model selection + cost containment | Per-agent tiering, dollar caps, pinning, sampling | ✓ |
| Scout strategy + Researcher verification | Search provider, dedup, founder-name verification, anonymous fallback | ✓ |
| Voice isolation + section-writer prompt architecture | Prompt scaffolding, output validation | (not selected — recommended defaults captured as Claude's Discretion in CONTEXT.md) |

---

## Jesse-Voice QA Rubric Design

### Q1: How should QA mechanically judge voice?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-rule checklist + LLM judge (Recommended) | Two-layer: regex predicates + LLM-as-judge with structured output | ✓ |
| Pure LLM-as-judge | Single LLM call with rubric in system prompt | |
| Pure regex checklist | No LLM; cheap, deterministic, but misses tonal subtlety | |
| Multi-pass LLM | Cheap pass flags, deep pass judges; lower cost but more complex | |

**User's choice:** Hard-rule checklist + LLM judge.
**Notes:** Two-layer defense provides deterministic floor for hard rules (no exclamation marks, no sentimentality keywords) plus LLM-judge for tonal subtleties (gravity, irony-signaling, Fortune-500-treatment). Hard rules auto-fire `error`; LLM-judge returns structured `{ findings: [{ severity, axis, quotedSpan, reasoning, suggestedFix }] }`.

### Q2: What should QA do with corrections?

| Option | Description | Selected |
|--------|-------------|----------|
| Annotation only — Andrew rewrites in Studio (Recommended) | QA writes findings to Convex; Sanity draft from writers' output verbatim | ✓ |
| Auto-rewrite inline | QA replaces writer output before Sanity write | |
| Editor Final merges | QA flags; Editor Final accepts/rejects | |
| Section writer regenerates | QA flags hand back to writer; double token spend | |

**User's choice:** Annotation only.
**Notes:** Keeps Andrew as the single editorial voice. Auto-rewrite compounds model risk. PROJECT.md "Andrew is the manual guard" is the load-bearing principle.

### Q3: Scope of each QA pass?

| Option | Description | Selected |
|--------|-------------|----------|
| One holistic pass over all sections after fan-out (Recommended) | Single LLM call with all section bodies; cross-section consistency check | ✓ |
| Per-section parallel QA passes | Seven parallel calls; faster, no cross-section check | |
| Two-stage: per-section + holistic | Most thorough; ~8× QA cost | |

**User's choice:** One holistic pass.
**Notes:** Cross-section consistency matters (Founder Bio adoring + Problem Statement neutral = drift). Matches `@agent_node` single-agent pattern.

### Q4: What does QA severity mean operationally?

| Option | Description | Selected |
|--------|-------------|----------|
| Andrew-facing only — never blocks (Recommended) | All severities annotation; pipeline always proceeds | ✓ |
| Error blocks draft write | `error` halts pipeline | |
| Error triggers section-writer regenerate | `error` auto-retries that section | |

**User's choice:** Andrew-facing only.
**Notes:** Weekly cadence > automated guard severity. Andrew is the publish gate — QA surfaces, Andrew decides.

---

## Model Selection + Cost Containment

### Q1: Which OpenRouter model tiering?

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered by voice-criticality (Recommended) | Opus voice-critical / Sonnet writers / Haiku mechanical | ✓ |
| Opus everywhere | Highest cost, safest brand outcome | |
| Sonnet baseline + Opus QA/Editor only | Calibrator drift risk | |
| Mixed providers | Claude voice-critical, Gemini/GPT cheap | |

**User's choice:** Tiered by voice-criticality.
**Notes:** Opus for Calibrator, Editor (gate 1 + final), QA. Sonnet for section writers + Researcher. Haiku for Scout, Advocate, DesignAgent. Estimated $3–6/run.

### Q2: Cost containment policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft alert + hard cap (Recommended) | Per-run dollar cap with 70% warning and 100% halt | ✓ |
| Soft alerting only | No hard cap; logs only | |
| Per-agent token cap only | No run-level cap | |
| No cost guardrails | Just record; Phase 5 deferred | |

**User's choice:** Soft alert + hard cap.
**Notes:** `PIPELINE_COST_CAP_USD` default $10. Soft alert at 70% emits `cost-warning` event; hard cap raises `CostCapExceeded` → `pipelineRuns.status='failed'` with descriptive errorMessage.

### Q3: Model pinning discipline?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin voice-critical only; latest-stable for others (Recommended) | Calibrator/Editor/QA pinned; others use OpenRouter aliases | ✓ |
| Pin every agent | Full reproducibility; brittle | |
| No pinning | Cheapest maintenance; brand-voice exposure | |

**User's choice:** Pin voice-critical only.
**Notes:** Pinned model+revision string for Calibrator, Editor, QA. Section writers + mechanical use latest-stable aliases. Resolved model recorded into `modelVersions` JSON regardless.

### Q4: Sampling defaults per tier?

| Option | Description | Selected |
|--------|-------------|----------|
| Cold for voice-critical, warm for writers (Recommended) | Voice-critical 0.2; writers 0.7; factual 0.3 | ✓ |
| Uniform low temperature (0.2) | Maximum determinism; writers sound mechanical | |
| Per-agent tuning during execution (no defaults) | Risks inconsistency | |

**User's choice:** Cold for voice-critical, warm for writers.
**Notes:** Defaults captured in `lib/llm_config.py` `SAMPLING_BY_AGENT` map; agent code reads from this map.

---

## Scout Strategy + Researcher Verification

### Q1: Tavily or Brave?

| Option | Description | Selected |
|--------|-------------|----------|
| Tavily (Recommended) | Brief lists first; LangChain integration; structured snippets | ✓ |
| Brave Search | Larger free tier; two-call snippet pattern | |
| Abstraction layer for both | Premature abstraction | |

**User's choice:** Tavily.
**Notes:** `TAVILY_API_KEY` reserved by Phase 4 D-31. No abstraction layer.

### Q2: How does Scout cross-check Sanity charity archive?

| Option | Description | Selected |
|--------|-------------|----------|
| Single GROQ query at Scout start, in-memory dedup (Recommended) | One round-trip; in-memory filter on name/slug/domain | ✓ |
| Per-candidate Sanity lookup | N round-trips per run | |
| Dedup deferred to Editor gate 1 | Loses literal AGT-04 reading | |

**User's choice:** Single GROQ at Scout start.
**Notes:** `featured_charity_keys` set added to `DispatchState`; Scout filters candidates against this before writing to `pitchLog`.

### Q3: Researcher founder-name verification match strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive substring + last-name fallback (Recommended) | httpx fetch; HTML strip; substring search; conservative | ✓ |
| Exact-string match only | Strictest; high false-negative rate | |
| Fuzzy match (Levenshtein) | Adds rapidfuzz dep; false-positive risk | |
| Fetch + LLM verifier | Most accurate; extra LLM call cost | |

**User's choice:** Case-insensitive substring + last-name fallback.
**Notes:** 10s httpx timeout; follows redirects; desktop User-Agent. HTML stripped via lxml/selectolax (planner picks). httpx failure → `founderNameVerified=false` with `verificationError`. Same pattern for CaseStudyWriter `subjectName`.

### Q4: Anonymous-fallback framing?

| Option | Description | Selected |
|--------|-------------|----------|
| Founder referred to by role/title (Recommended) | "The founder, a former actuary…"; voice intact | ✓ |
| First name + 'Person' marker | Visible low-confidence; weakens brand | |
| Section skipped entirely | Breaks issue completeness | |
| Researcher retries with secondary sources | Exceeds iteration limit risk | |

**User's choice:** Founder referred to by role/title.
**Notes:** FounderBioWriter receives `{ founderName: null, founderRole: <Researcher-emitted role> }`. CaseStudyWriter same shape. Output validation rejects first-name tokens when verified=false. Sanity `founderName` left empty; Andrew can fill if he can verify.

---

## Claude's Discretion

- Exact directory split inside `agents/qa/` (one file vs `rules.py` + `judge.py` + `prompt.md`)
- LangChain Tavily integration vs thin httpx wrapper around Tavily REST API
- OpenRouter JSON-mode vs function-calling vs instructor-style retry for structured output
- Exact `deliberationTranscript` format (Markdown vs JSON-in-string vs serialized TypedDict)
- `verify_research` as standalone node vs hook inside Researcher's wrapper
- Font whitelist exact entries (pending Andrew approval)
- LangSmith tracing inclusion vs hold for v2
- Few-shot vs zero-shot writer prompts

## Deferred Ideas

- LangSmith tracing
- Per-section retry on QA `error`
- Auto-rewrite by QA
- Cron-triggered weekly runs (V2-03)
- Suno API integration (V2-01)
- NotebookLM API integration (V2-02)
- Voice-drift dashboard (V2-06)
- Multi-pass QA
- Fuzzy founder-name match
- LLM verifier for founder name
- Section writer few-shot examples
- Researcher secondary-source fetches
- OpenRouter prompt caching
- `/dev/replay` endpoint
