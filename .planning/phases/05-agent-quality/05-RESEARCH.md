# Phase 5: Agent Quality - Research

**Researched:** 2026-05-16
**Domain:** LangGraph agent implementation · OpenRouter LLM routing · Tavily web search · QA rubric design · WCAG-AA contrast · Pydantic structured output
**Confidence:** HIGH (all critical findings verified against project source files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-layer QA rubric: deterministic hard-rule predicates (rules.py) + LLM-as-judge (rubric.md). Axes: gravity, sentiment, irony-signaling, precision, cross-section-consistency. Severity: `info | warning | error`.
- **D-02:** QA writes annotations only — never rewrites, never blocks. Convex `qaCorrections.acceptance='pending'`. Andrew is the editorial voice.
- **D-03:** One holistic QA pass over all sections after fan-out. Single LLM call per run; N `qaCorrections` rows output.
- **D-04:** QA never blocks the draft. Severities are Andrew-facing metadata only. Pipeline always proceeds to `editor_final` regardless of QA findings.
- **D-05:** Tiered model selection — Opus (voice-critical: Calibrator, Editor gate1, Editor final, QA), Sonnet (section writers: OriginStory, Problem, FounderBio, CaseStudy, BonusWriter, GameWriter, Researcher), Haiku (mechanical: Scout, Advocate, DesignAgent).
- **D-06:** Pin voice-critical model IDs verbatim (`MODEL_PIN_VOICE_CRITICAL = 'anthropic/claude-opus-4-7'`). Others use latest-stable aliases. Resolved model recorded into `modelVersions` per agent per run.
- **D-07:** Sampling: voice-critical `temperature=0.2`, section writers `temperature=0.7`, Researcher `temperature=0.3`, Scout `temperature=0.3`, DesignAgent `temperature=0.4`.
- **D-08:** Soft alert at 70% of `PIPELINE_COST_CAP_USD` (default $10), hard halt at 100%. `CostCapExceeded` sets `pipelineRuns.status='failed'`. Emits `deliberationEvents` row with `eventType='cost-warning'`.
- **D-09:** Tavily for Scout + Researcher. No Brave in v1. Single `lib/search_client.py` abstraction.
- **D-10:** Scout dedup via one GROQ query at start; in-memory filter; `featured_charity_keys` in `DispatchState`.
- **D-11:** Case-insensitive substring + last-name fallback for `founderName` verification. httpx 10s timeout. `founderNameVerified` bool on `state['research']`. Same pattern for `subjectName`.
- **D-12:** Anonymous-by-role framing on verification failure. Sanity `founderName` left empty; Andrew fills manually.
- **D-13:** `lib/voice.py` as single source of truth for `VOICE_CONSTRAINTS` + `build_section_writer_prompt()`. No writer assembles its own prompt ad-hoc.
- **D-14:** Pydantic validation per agent. One regenerate-on-fail. Second failure raises to `@agent_node` which sets `status='failed'`.
- **D-15:** Hex regex `^#[0-9a-fA-F]{6}$` + WCAG-AA contrast check at Sanity write time. Regenerate-once fallback, then hardcoded safe theme + `qaCorrections` warning.
- **D-16:** Font whitelist (~25 fonts, web + WeasyPrint compatible). **OPEN BLOCKER — requires Andrew approval.** Whitelist defaults: `{ display: 'Playfair Display', body: 'Source Serif Pro' }`.
- **D-17:** Calibrator queries last 3 published issues for `bonusType` rotation. Picks one of `bigBudget | jingle | specAd` that does not match the most recent. Tie-broken by `(issueNumber + offset) mod 3`.
- **D-18:** Editor `interrupt()` fires only when top two scores within `EDITOR_INTERRUPT_THRESHOLD=1.0` AND `confidence < 0.7`. Otherwise Editor picks top score deterministically.
- **D-19:** Single `agents/bonus.py` with three internal prompt builders keyed on `bonusType`. Jingle: `sunoAudioUrl` left empty. BigBudget: `storyboards` array of 3-5 items.
- **D-20:** GameWriter enumerates forbidden constructs in prompt. Phase 7 owns the renderer validator.
- **D-21:** Scout `max_tool_calls=8`, Researcher `max_tool_calls=12`, all others `None`. Overrun emits `deliberationEvents` with `eventType='agent-tool-limit-exceeded'`.
- **D-22:** `EISENBALM_STUB_MODE` default flips to `false`. `true` still exercised by Phase 4 PIP-06 integration test.

### Claude's Discretion

- Exact directory split inside `agents/qa/` (recommend: `rules.py` + `judge.py` + `rubric.md`)
- Whether to use LangChain's Tavily integration or a thin httpx wrapper around Tavily REST API
- Whether voice-critical agents use OpenRouter JSON-mode, function-calling, or instructor-style retry
- Exact `deliberationTranscript` format (recommend Markdown with section headers for NotebookLM)
- Whether `verify_research` is standalone node or hook inside Researcher wrapper (recommend standalone)
- Font whitelist exact entries beyond the locked defaults (pending Andrew approval)
- LangSmith tracing (recommend hold for v2)
- Per-section few-shot vs zero-shot (recommend zero-shot first)

### Deferred Ideas (OUT OF SCOPE)

- PDF generation / WeasyPrint (Phase 6)
- Sanity webhook HMAC, Vercel deploy hook (Phase 6)
- Game embedCode validator / sandbox enforcement (Phase 7)
- Stripe / commerce (Phase 8)
- Live Convex deliberation UI (Phase 9)
- Podcast audio player (Phase 9)
- LangSmith tracing (defer to v2)
- Suno API integration (V2-01, Andrew pastes URL manually)
- NotebookLM API integration (V2-02, Andrew exports manually)
- Per-section retry on QA `error` (annotation-only; out of scope)
- CI gates (Phase 1 D-15 deferred)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 | Calibrator emits valid StyleBrief with `bonusType` rotation | D-17 rotation GROQ, deterministic tie-break by `(issueNumber + offset) mod 3` |
| AGT-02 | Calibrator hardcodes `VOICE_CONSTRAINTS` from `lib/voice.py` | D-13 lib/voice.py, CLAUDE_CODE_BRIEF.md lines 359-367 as source text |
| AGT-03 | Scout uses Tavily to find 3-5 charity candidates | D-09 Tavily, `lib/search_client.py` wrapper, max_results=5 |
| AGT-04 | Scout deduplicates against previously featured charities | D-10 single GROQ at start, in-memory filter, `featured_charity_keys` state field |
| AGT-05 | Advocate scores each candidate 1-10 with rationale; writes agentVotes + events | API_CONTRACTS §3.5 agentVotes shape, §3.4 advocate-argument eventType |
| AGT-06 | Editor gate 1 selects winner with structured deliberation transcript | D-18 interrupt threshold, NotebookLM-friendly Markdown transcript format |
| AGT-07 | Researcher emits `founderName` + `founderNameSourceUrl` | D-11 Tavily deep-dive, structured ResearchOutput Pydantic model |
| AGT-08 | Post-Researcher httpx verification sets `founderNameVerified` | D-11 verify_research standalone node, selectolax HTML strip, last-name fallback |
| AGT-09 | Section writers receive structurally isolated voiceConstraints block | D-13 `build_section_writer_prompt()` enforces isolation; no cross-section state reads |
| AGT-10 | CaseStudyWriter uses verified subject name or falls back to role framing | D-12 role-framing when `subjectNameVerified=false`; QA Layer-1 catches name leakage |
| AGT-11 | BonusWriter branches on `bonusType`; emits correct Pydantic shape per branch | D-19 three internal prompt builders; storyboards[] for bigBudget, lyrics for jingle |
| AGT-12 | GameWriter emits self-contained `embedCode` with no external dependencies | D-20 forbidden construct list in prompt; `{ headline, description, embedCode }` shape |
| AGT-13 | DesignAgent emits hex colors validated by regex + WCAG-AA | D-15 Python port of theme.ts WCAG algorithm; regenerate-once fallback |
| AGT-14 | DesignAgent fonts from enforced whitelist | D-16 `agents/design/font_whitelist.py`; regenerate-once; fallback to Playfair Display / Source Serif Pro |
| AGT-15 | QA hard-rule predicates (Layer 1) + LLM-as-judge (Layer 2) | D-01 rules.py predicate list; rubric.md LLM-judge prompt; both write qaCorrections rows |
| AGT-16 | Editor Final reviews QA output; emits `editor-final` event | Standard @agent_node; receives `state['qa_corrections']`; writes connective copy |
| AGT-17 | Resolved model IDs recorded in `weeklyIssue.pipelineMetadata.modelVersions` | `lib/llm_config.py` MODEL_BY_AGENT; OpenRouter response `model` field captured |
| AGT-18 | Iteration limits enforced: Scout=8, Researcher=12 | D-21 `@agent_node(max_tool_calls=N)`; `agent-tool-limit-exceeded` eventType |
</phase_requirements>

---

## Summary

Phase 5 replaces every Phase 4 stub agent body with a real LLM-driven implementation. The Phase 4 `@agent_node` decorator contract is locked; only what runs inside each decorated function changes. The nine-agent pipeline topology gains one new node (`verify_research`) inserted as a standalone non-LLM node between Researcher and the parallel fan-out.

The three critical new infrastructure pieces are: (1) `lib/openrouter_client.py` — a single async client wrapping `langchain-openai`'s `ChatOpenAI` with `base_url="https://openrouter.ai/api/v1"`, recording token counts into `CostRecorder` after every call; (2) `lib/search_client.py` — a thin Tavily wrapper used only by Scout and Researcher; (3) `agents/qa/` — the two-layer QA rubric combining deterministic hard rules (`rules.py`) with an LLM-as-judge call (`rubric.md` + `judge.py`).

Two schema conflicts discovered during research require additive Convex patches before Phase 5 can ship: (1) `deliberationEvents.eventType` is a strict `v.union()` of 7 literals — the CONTEXT.md canonical_refs incorrectly describes it as permissive `v.string()`. Phase 5's two new eventTypes (`cost-warning`, `agent-tool-limit-exceeded`) require an additive schema patch. (2) `qaCorrections.severity` in `convex/schema.ts` currently uses `'minor' | 'moderate' | 'major'`; CONTEXT.md D-01 and API_CONTRACTS §3.6 specify `'info' | 'warning' | 'error'`. Both patches are additive with no data migration on empty dev tables.

**Primary recommendation:** Start Phase 5 with Wave 0: Convex schema patches, new dependency additions, `lib/openrouter_client.py`, `lib/voice.py`, `lib/llm_config.py`, `lib/cost.py` extension, and `lib/search_client.py`. These are prerequisites for all agent implementation tasks and can be developed without Andrew's involvement. Andrew's only blocking approval is the font whitelist (D-16); schedule that conversation in Week 1 so agent implementation tasks run in parallel.

---

## Standard Stack

### Core (unchanged from Phase 4, verified in pyproject.toml)

| Library | Pinned Version | Purpose |
|---------|---------------|---------|
| langgraph | 1.1.10 | Agent graph orchestration — locked |
| langchain-openai | 1.2.1 | OpenRouter LLM calls via ChatOpenAI with base_url |
| pydantic | 2.13.4 | Structured output validation per agent |
| httpx | 0.28.1 | Source URL verification in verify_research; also existing convex_client |
| fastapi | 0.136.1 | HTTP server on Railway — no changes in Phase 5 |

### New in Phase 5 (add to pyproject.toml)

| Library | Version to Pin | Purpose | Confidence |
|---------|---------------|---------|-----------|
| tavily-python | 0.7.24 | Tavily search REST client | HIGH — verified via pip index |
| langchain-tavily | 0.2.18 | LangChain Tavily tool integration | HIGH — in STACK.md; compatible with langchain-openai==1.2.1 |
| selectolax | 0.4.9 | Fast HTML-to-text for verify_research | HIGH — verified via pip index |

**Installation:**
```bash
uv add tavily-python==0.7.24 langchain-tavily==0.2.18 selectolax==0.4.9
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|---------|
| selectolax | lxml | lxml adds libxml2 C dependency (Railway Docker build complexity); selectolax is a pure-Python wheel, faster HTML strip, identical result for plain-text extraction |
| langchain-tavily | httpx directly to Tavily REST API | LangChain is already installed; `TavilySearchAPIWrapper` gives structured SearchResult objects without a second REST client |
| langchain-openai ChatOpenAI | openai Python SDK directly | Both work with OpenRouter; langchain-openai is already pinned; no reason to add a second OpenAI client |

---

## Architecture Patterns

### Updated Project Structure (Phase 5 additions in bold)

```
packages/pipeline/src/eisenbalm_pipeline/
├── agents/
│   ├── _wrapper.py              # LOCKED — Phase 4 contract
│   ├── calibrator.py            # REPLACE stub body
│   ├── scout.py                 # REPLACE stub body
│   ├── advocate.py              # REPLACE stub body
│   ├── editor.py                # REPLACE stub body (gate1 + final)
│   ├── researcher.py            # REPLACE stub body
│   ├── verify.py                # NEW — verify_research node (no LLM)
│   ├── origin_story.py          # REPLACE stub body
│   ├── problem.py               # REPLACE stub body
│   ├── founder_bio.py           # REPLACE stub body
│   ├── case_study.py            # REPLACE stub body
│   ├── game.py                  # REPLACE stub body
│   ├── bonus.py                 # REPLACE stub body (3 internal builders)
│   ├── design.py                # REPLACE stub body
│   ├── qa.py                    # REPLACE stub body (orchestrates qa/)
│   ├── publisher.py             # MINIMAL change (editor-final handoff only)
│   ├── validate.py              # UNCHANGED
│   └── qa/                      # NEW directory
│       ├── rules.py             # Deterministic predicate list (Layer 1)
│       ├── judge.py             # LLM-as-judge orchestrator (Layer 2)
│       └── rubric.md            # LLM-judge prompt (version-controlled)
├── lib/
│   ├── openrouter_client.py     # NEW — single async LLM client
│   ├── voice.py                 # NEW — VOICE_CONSTRAINTS + build_section_writer_prompt()
│   ├── llm_config.py            # NEW — MODEL_BY_AGENT, SAMPLING_BY_AGENT
│   ├── search_client.py         # NEW — Tavily wrapper
│   ├── cost.py                  # EXTEND — add check_cap() + CostCapExceeded
│   ├── convex_client.py         # UNCHANGED
│   ├── sanity_client.py         # UNCHANGED
│   └── portable_text.py         # UNCHANGED
├── agents/design/
│   └── font_whitelist.py        # NEW — Andrew-approved font list
├── lib/
│   └── wcag.py                  # NEW — WCAG-AA Python port from theme.ts
├── graph/
│   ├── state.py                 # EXTEND — new Pydantic schemas + new state fields
│   └── builder.py               # EXTEND — insert verify_research node
└── stubs/
    ├── fake_openrouter.py       # UNCHANGED (stub-mode path for tests)
    └── fixtures.py              # UNCHANGED
```

### Pattern 1: OpenRouter Client (lib/openrouter_client.py)

Every LLM call routes through a single client. The client records costs and enforces the cap.

```python
# lib/openrouter_client.py
import os
from langchain_openai import ChatOpenAI
from langchain_core.exceptions import OutputParserException
from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT, SAMPLING_BY_AGENT, MAX_TOKENS_BY_AGENT

def get_chat_model(agent_id: str) -> ChatOpenAI:
    """Return a configured ChatOpenAI instance for the given agent."""
    model_id = MODEL_BY_AGENT[agent_id]
    sampling = SAMPLING_BY_AGENT.get(agent_id, {"temperature": 0.7})
    max_tokens = MAX_TOKENS_BY_AGENT.get(agent_id)
    kwargs = {**sampling}
    if max_tokens:
        kwargs["max_tokens"] = max_tokens
    return ChatOpenAI(
        model=model_id,
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=os.environ["OPENROUTER_API_KEY"],
        **kwargs,
    )

async def acomplete(
    agent_id: str,
    messages: list[dict],
    *,
    response_format: type | None = None,
) -> tuple[str, dict]:
    """Call OpenRouter, record cost, enforce cap.

    Returns (content, usage_dict). Raises CostCapExceeded if cap crossed.
    """
    from eisenbalm_pipeline.lib.cost import get_recorder
    llm = get_chat_model(agent_id)
    if response_format is not None:
        llm = llm.with_structured_output(response_format)

    result = await llm.ainvoke(messages)

    usage = getattr(result, "usage_metadata", {}) or {}
    tokens_in = usage.get("input_tokens", 0)
    tokens_out = usage.get("output_tokens", 0)
    usd = usage.get("input_cost", 0.0) + usage.get("output_cost", 0.0)

    recorder = get_recorder()
    recorder.record(agent_id, tokens_in=tokens_in, tokens_out=tokens_out, usd=usd)
    await recorder.check_cap()  # raises CostCapExceeded at 100%; emits event at 70%

    # Capture resolved model for AGT-17
    resolved_model = None
    if hasattr(result, "response_metadata"):
        resolved_model = result.response_metadata.get("model", MODEL_BY_AGENT[agent_id])

    content = result.content if hasattr(result, "content") else result
    return content, {
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "usd": usd,
        "resolved_model": resolved_model or MODEL_BY_AGENT[agent_id],
    }
```

### Pattern 2: Voice-Isolated Section Writer (lib/voice.py)

Every section writer calls `build_section_writer_prompt()`. No writer reads another section's output.

```python
# lib/voice.py
VOICE_CONSTRAINTS = """Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking.
No irony signaling. The brand does not pivot to AI.
Treat every charity with the gravity of a Fortune 500 company.
Treat every founder as a visionary regardless of obscurity.
Never use exclamation marks. Never use: heartwarming, inspiring,
incredible, amazing, truly, simply, journey of.
Never use winking constructions: "if you can call it that", "believe it or not".
Never reference AI, language models, or Jesse's AI nature.
Answer the implied question "Why do you deserve to exist?" without sentiment.
"""

def build_section_writer_prompt(
    *,
    voice_constraints: str = VOICE_CONSTRAINTS,
    section_id: str,
    section_title: str,
    section_guidance: str,
    charity: dict,
    research: dict,
    style_brief: dict,
) -> list[dict]:
    """Assemble a section writer message list. Structurally isolates voiceConstraints."""
    system = (
        f"You are the {section_id} writer for The Eisenbalm Dispatch.\n\n"
        f"VOICE CONSTRAINTS (non-negotiable):\n{voice_constraints}\n\n"
        f"STYLE BRIEF:\nBonus type: {style_brief['bonusType']}\n"
        f"Visual direction: {style_brief['visualDirection']}\n"
    )
    user = (
        f"Write the {section_title} section.\n\n"
        f"CHARITY: {charity['name']} ({charity.get('location', '')})\n"
        f"MISSION: {charity.get('missionStatement', '')}\n\n"
        f"RESEARCH:\n{research.get('summary', '')}\n\n"
        f"GUIDANCE:\n{section_guidance}\n\n"
        f"Return valid JSON matching the schema for {section_id}."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
```

### Pattern 3: verify_research Standalone Node (agents/verify.py)

Not an `@agent_node`. No LLM call. No deliberationEvents row. Just httpx + selectolax.

```python
# agents/verify.py
import httpx
from selectolax.parser import HTMLParser
from eisenbalm_pipeline.graph.state import DispatchState

async def _fetch_text(url: str) -> str | None:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; EisenbalmBot/1.0)"}
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
        tree = HTMLParser(r.text)
        return " ".join(n.text() for n in tree.css("body *") if n.text())
    except Exception:
        return None

def _name_in_text(name: str, text: str) -> bool:
    if name.lower() in text.lower():
        return True
    last = name.strip().split()[-1]
    return last.lower() in text.lower()

async def verify_research(state: DispatchState) -> dict:
    """Standalone node: verifies founderName + subjectName against source URLs."""
    research = dict(state.get("research", {}))

    for name_field, url_field, verified_field in [
        ("founderName", "founderNameSourceUrl", "founderNameVerified"),
        ("subjectName", "subjectNameSourceUrl", "subjectNameVerified"),
    ]:
        name = research.get(name_field)
        url = research.get(url_field)
        if name and url:
            text = await _fetch_text(url)
            research[verified_field] = bool(text and _name_in_text(name, text))
        else:
            research[verified_field] = False

    return {"research": research}
```

### Anti-Patterns to Avoid

- **Reading cross-section state in a writer prompt:** A section writer that reads `state['origin_story']` inside its own prompt is a voice-isolation violation. Only `state['research']`, `state['style_brief']`, and `state['charity']` may flow into `build_section_writer_prompt()`.
- **Calling `acomplete()` outside the `@agent_node` wrapper:** The decorator owns try/except and cost recording. LLM calls outside it bypass failure detection.
- **Writing `deliberationEvents` rows with eventType values not in the Convex schema:** The schema patch must land before Phase 5 code writes `cost-warning` or `agent-tool-limit-exceeded`.
- **Branching on `EISENBALM_STUB_MODE` inside agent functions:** The toggle belongs in `lib/openrouter_client.py` only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM structured output parsing | Custom JSON extraction regex | `ChatOpenAI.with_structured_output(PydanticModel)` | Handles JSON-mode, retry, schema validation; regex fails on nested structures |
| Web search | Direct Tavily REST httpx calls | `langchain_tavily.TavilySearchAPIWrapper` | Already in STACK.md; `aresults()` returns structured list; rate-limit handling included |
| HTML-to-text extraction | BeautifulSoup | `selectolax.parser.HTMLParser` | 10x faster; pure-Python wheel; no libxml2 dependency on Railway |
| WCAG contrast computation | Approximate formula | Exact port of `apps/web/lib/theme.ts` algorithm (see below) | Phase 2 render-time validator uses identical thresholds; mismatched Python version causes spurious failures on valid themes |
| Cost accumulation | Per-agent manual totals | `lib/cost.py` CostRecorder extended with `check_cap()` | Thread-safe; `get_cost_payload()` returns Convex-ready JSON; Phase 4 already shipped this |

---

## Per-Agent Prompt + Output Schema Sketches

### Calibrator

**System prompt sketch:**
```
You are the Calibrator for The Eisenbalm Dispatch. You set the creative constraints for this issue.
You have never used an exclamation mark on purpose.

Jesse voice: [VOICE_CONSTRAINTS verbatim]

BonusType rotation: the last three issues had bonusTypes: {last_three}.
Do NOT pick: {most_recent_bonus_type}.
Deterministic rule: pick bonusType at index (issueNumber + 1) mod 3 from
["bigBudget", "jingle", "specAd"] after removing {most_recent_bonus_type}.

Output JSON StyleBrief with: voice, constraints (3-5 items), bonusType, visualDirection.
```

**Pydantic output:**
```python
class StyleBrief(BaseModel):
    voice: str
    constraints: list[str]  # 3-5 items
    bonusType: Literal["bigBudget", "jingle", "specAd"]
    visualDirection: str
```

**No deliberationEvents emission** (Calibrator does not emit an event row).

---

### Scout

**System prompt sketch:**
```
You are the Scout for The Eisenbalm Dispatch. You find obscure charities that deserve
the Fortune-500 treatment. You reject anything Charity Navigator already ranks prominently.
Return 3-5 candidates, never fewer.

Use web_search. Preferred terms: "obscure charity", "overlooked nonprofit", "small charity impact".
Reject any charity whose name, slug, or website domain appears in: {featured_charity_keys}

Emit each candidate as soon as you have enough information — do not wait for all 5.
Max tool calls: 8.
```

**Tool:** `web_search(query: str, max_results: int = 5) -> list[SearchResult]`

**Pydantic output per candidate:**
```python
class CharityCandidate(BaseModel):
    name: str
    location: str
    website: str
    assetRange: str
    focusArea: str
    missionStatement: str
    scoutSummary: str
    whyOverlooked: str
```

**Decorator:** `@agent_node(name="scout", emit_event="scout-finding", max_tool_calls=8)`
**Per-candidate Convex write:** `pitchLog:insert` after each candidate, before the next search.

---

### Advocate

**System prompt sketch:**
```
You are the Advocate for The Eisenbalm Dispatch. Score each Scout candidate 1-10
with a written argument. Surface the case for each charity without editorializing.
Dry. Precise. Serious.

Candidates: {candidates_json}

For each candidate output: score (1-10), argument (150-250 words),
keyStrengths (2-4 items), primaryConcern (one sentence).
```

**Pydantic output:**
```python
class AdvocateVote(BaseModel):
    charityName: str
    score: int  # 1-10
    argument: str
    keyStrengths: list[str]
    primaryConcern: str

class AdvocateOutput(BaseModel):
    votes: list[AdvocateVote]
```

**Decorator:** `@agent_node(name="advocate", emit_event="advocate-argument")`
**Convex writes:** One `agentVotes:insert` per candidate (API_CONTRACTS §3.5).

---

### Editor Gate 1

**System prompt sketch:**
```
You are the Editor for The Eisenbalm Dispatch. Select the charity for this issue.

Candidates with Advocate scores:
{candidates_with_scores}

Rules:
1. Highest Advocate score wins by default.
2. Set confidence 0.0-1.0.
3. If top two scores are within 1.0 AND confidence < 0.7: set requiresHumanInput=true.
   Otherwise: requiresHumanInput=false.

Then write deliberationTranscript in Markdown (format specified below).
This becomes the NotebookLM podcast source.
```

**deliberationTranscript format (Markdown, NotebookLM-compatible):**
```markdown
# Eisenbalm Dispatch — Issue #{issueNumber} Deliberation

## Scout Findings
[one paragraph per candidate from scoutSummary]

## Advocate Arguments
### {charityName} — Score: {score}/10
{argument}
**Key Strengths:** {strengths}
**Primary Concern:** {concern}

## Editor Reasoning
{editorReasoning}
**Confidence:** {confidence:.0%}

## Decision
**Winner:** {winnerName}
**Runner-up notes:** {runnerUpNotes}
```

**Pydantic output:**
```python
class EditorDecision(BaseModel):
    winnerName: str
    confidence: float
    requiresHumanInput: bool
    editorReasoning: str
    runnerUpNotes: str
    deliberationTranscript: str
```

**interrupt() logic:**
```python
if decision.requiresHumanInput:
    await convex_mutation_safe("pipelineRuns:updateStatus", {
        "runId": run_id, "status": "awaiting-review", ...
    })  # Write BEFORE interrupt()
    resume_value = interrupt({"prompt": "Select winner", "candidates": candidates})
```

**Decorator:** `@agent_node(name="editor_gate1", emit_event="editor-decision")`

---

### Researcher

**System prompt sketch:**
```
You are the Researcher for The Eisenbalm Dispatch. Deep-dive the winning charity.
You will not name a founder without a source URL on the charity's own website.
Falls back to anonymous framing rather than guess.

Winning charity: {winner}

Use web_search to investigate: official website (find founderName on /about or /team),
founding year, annual budget, one case study subject (beneficiary or program graduate),
key statistics.

For founderName: MUST provide founderNameSourceUrl pointing to the specific page
where the name appears on the charity's own domain. If no verifiable source found,
set founderName=null and provide founderRole (the role title only).

Max tool calls: 12.
```

**Pydantic output:**
```python
class ResearchOutputModel(BaseModel):
    summary: str
    foundingYear: int | None = None
    annualBudget: str | None = None
    founderName: str | None = None
    founderNameSourceUrl: str | None = None
    founderRole: str = "founder"
    founderBio: str
    subjectName: str | None = None
    subjectNameSourceUrl: str | None = None
    subjectRole: str = "a program participant"
    subjectStory: str
    keyStatistics: list[str]
    fundingSources: list[str]
```

**Decorator:** `@agent_node(name="researcher", emit_event="section-draft", max_tool_calls=12)`

---

### verify_research (standalone node — no @agent_node)

See Pattern 3 above. Inserts `founderNameVerified` and `subjectNameVerified` into `state['research']`.

---

### OriginStoryWriter

**Section guidance:**
```
400-600 words. Cover: the founding moment, early obstacles, the "why this and not
something else" question answered without sentiment. Fortune-500 treatment: precision
over poetry. No adjectives that are also compliments.
```

**Pydantic output:**
```python
class OriginStoryOutput(BaseModel):
    headline: str
    body: str  # Portable Text source — plain paragraphs
```

---

### ProblemWriter

**Section guidance:**
```
400-600 words. Cover: the precise problem (with statistics), why existing institutions
fail to solve it, and how the charity's approach differs. Include pdfContent for
Phase 6's WeasyPrint template.
```

**Pydantic output:**
```python
class PdfContent(BaseModel):
    problemStatement: str       # <=150 words
    keyDataPoints: list[dict]   # exactly 3: [{"stat": str, "source": str}]
    interventionMechanism: str  # <=100 words

class ProblemOutput(BaseModel):
    headline: str
    body: str
    pdfContent: PdfContent  # Phase 6 contract surface — do NOT rename fields
```

**Forward-link contract:** `pdfContent` field names are the Phase 6 WeasyPrint template contract. Do not change without coordinating Phase 6.

---

### FounderBioWriter

**Section guidance (conditional):**
```
{% if founderNameVerified %}
400-600 word biography of {founderName}. Fortune-500 treatment.
Present professional trajectory with precision. Do not editorialize.
{% else %}
400-600 word biography of the {founderRole} of {charityName}.
CRITICAL: Do NOT use or guess a name. Refer by role only: "The {founderRole}", "they", "their".
The anonymity is intentional and professional.
{% endif %}
```

**Note:** When `founderNameVerified=False`, do NOT include `founderName` in the research object passed to the prompt. Omit it entirely to prevent model hallucination.

**Pydantic output:**
```python
class FounderBioOutput(BaseModel):
    headline: str
    body: str
```

---

### CaseStudyWriter

**Section guidance (conditional):**
```
{% if subjectNameVerified %}
400-600 word case study about {subjectName}, {subjectRole}.
Present situation before and after the charity's intervention with measurable outcomes.
{% else %}
400-600 word case study about {subjectRole}.
CRITICAL: Do NOT name the subject. Refer by role: "a {subjectRole}", "they", "their".
This is standard privacy practice for this category of charity.
{% endif %}
```

**Pydantic output:**
```python
class CaseStudyOutput(BaseModel):
    headline: str
    body: str
```

---

### GameWriter

**System prompt sketch (forbidden constructs enumerated):**
```
Write a self-contained HTML/JS game for The Eisenbalm Dispatch themed around {charityName}'s
mission. Completable in 60-90 seconds.

FORBIDDEN (a validator will reject these):
- <script src="...">    no external scripts
- <link href="...">     no external stylesheets
- fetch(                no network calls
- XMLHttpRequest        no AJAX
- window.parent         no parent frame access
- window.top            no top frame access
- document.cookie       no cookie access
- localStorage          no storage access
- eval(                 no dynamic evaluation
- import(               no dynamic imports

All CSS: inline <style> tags only.
All JS: inline <script> tags only (no src= attribute).
No external fonts, no CDN references of any kind.
```

**Pydantic output:**
```python
class GameOutput(BaseModel):
    headline: str
    description: str  # 50-100 word plain-text description for accessibility
    embedCode: str    # Complete self-contained HTML/JS string
```

---

### BonusWriter (three internal prompt builders)

**`_build_big_budget_prompt()` guidance:**
```
Spec for a cinematic ad campaign for {charityName}.
headline + body (200-400 words on concept) + storyboards (3-5 items:
each with shotNumber (int) and description (50-100 words of precise
visual/audio direction, Fortune-500 production values, no winking)).
```

**`_build_jingle_prompt()` guidance:**
```
Jingle for {charityName}.
headline + body (100-200 words on concept) + lyrics (8-16 lines, internal rhyme
allowed) + sunoPrompt (40-80 words describing musical style, instrumentation,
mood, and lyrical theme for Suno API — do not reference AI in sunoPrompt).
sunoAudioUrl is left empty for Andrew to fill.
```

**`_build_spec_ad_prompt()` guidance:**
```
Spec print/digital ad for {charityName}.
headline (the ad headline) + body (200-400 words of ad copy and rationale
for the creative direction — precise, dry, serious).
```

**Pydantic outputs:**
```python
class BigBudgetBonus(BaseModel):
    headline: str
    body: str
    storyboards: list[dict]  # [{"shotNumber": int, "description": str}]

class JingleBonus(BaseModel):
    headline: str
    body: str
    lyrics: str
    sunoPrompt: str
    sunoAudioUrl: str = ""  # Andrew fills manually

class SpecAdBonus(BaseModel):
    headline: str
    body: str
```

---

### DesignAgent

**System prompt sketch:**
```
You are the DesignAgent. Output exactly four six-digit hex colors and two font names.
You will not invent a font. WCAG AA contrast is a precondition, not a polish step.

Charity: {charityName}
Visual direction: {visualDirection}

Output JSON Theme: primaryColor, accentColor, backgroundColor, textColor, fontDisplay, fontBody.

fontDisplay must be one of: {WHITELIST_DISPLAY_FONTS}
fontBody must be one of: {WHITELIST_BODY_FONTS}

WCAG AA: contrast ratio between backgroundColor and textColor >= 4.5:1.
Your choices will be validated programmatically.
```

**Pydantic output:**
```python
class ThemeOutput(BaseModel):
    primaryColor: str
    accentColor: str
    backgroundColor: str
    textColor: str
    fontDisplay: str
    fontBody: str
```

**Validation sequence at Sanity write time:**
1. All four colors match `^#[0-9a-fA-F]{6}$`
2. `(backgroundColor, textColor)` passes WCAG-AA (ratio >= 4.5)
3. `fontDisplay` and `fontBody` are in `FONT_WHITELIST`
4. Any failure: regenerate once; second failure: hardcoded safe theme + `qaCorrections` row severity=warning

---

### QA Agent

**Orchestration:**
1. Run Layer-1 predicates from `rules.py` over all section bodies (synchronous, per-section).
2. Run Layer-2 LLM-as-judge from `judge.py` (single Opus call, all sections concatenated).
3. Write all findings to Convex `qaCorrections:insert`.
4. Return `{"qa_corrections": [...]}` to state.

See dedicated QA Rubric section below for full predicate list and LLM-judge prompt.

---

### Editor Final

**System prompt sketch:**
```
You are the Editor for The Eisenbalm Dispatch. Review the QA report and write
any connective copy needed to unify the issue.

QA findings: {qa_corrections}
Section headlines: {section_headlines}

Your task:
1. Read the QA findings. Note severity "error" items.
2. Write editor_final_notes: a 100-300 word memo to Andrew describing what QA found,
   what you recommend he review before publishing, and any connective context.
3. Do NOT rewrite any section. Do NOT reject the draft.
   The draft goes to Andrew as-is. Your notes are advisory.
```

**Pydantic output:**
```python
class EditorFinalOutput(BaseModel):
    editorFinalNotes: str
```

**Decorator:** `@agent_node(name="editor_final", emit_event="editor-final")`

---

## QA Rubric

### Layer 1: Deterministic Hard Rules (agents/qa/rules.py)

```python
# agents/qa/rules.py
"""Layer-1 deterministic QA predicates. Every hit is severity='error'."""
import re
from typing import NamedTuple

class QAFinding(NamedTuple):
    section: str
    severity: str
    axis: str
    quotedSpan: str
    reasoning: str
    suggestedFix: str

SENTIMENT_KEYWORDS = [
    r"\bheartwarming\b",
    r"\binspiring\b",
    r"\bincredible\b",
    r"\bamazing\b",
    r"\btruly\b",
    r"\bsimply\b",
    r"\bjourney of\b",
    r"\bpassion\b",
    r"\btransformative\b",
    r"\bempowering\b",
    r"\blife[-\s]changing\b",
    r"\bremarkable\b",
    r"\bbeautiful work\b",
    r"\bhumbling\b",
]

WINKING_PATTERNS = [
    r"if you can call it that",
    r"believe it or not",
    r"\bof sorts\b",
    r"for lack of a better word",
    r"so to speak",
    r"as they say",
]

AI_SELF_REFERENCE = [
    r"\bas an AI\b",
    r"\blanguage model\b",
    r"\bI was trained\b",
    r"\bmy training\b",
    r"\bI am an AI\b",
    r"\bAI assistant\b",
]


def check_exclamation_marks(section_id: str, body: str) -> list[QAFinding]:
    findings = []
    for m in re.finditer(r"!", body):
        span = body[max(0, m.start() - 40):m.end() + 10].strip()
        findings.append(QAFinding(
            section=section_id, severity="error", axis="gravity",
            quotedSpan=span,
            reasoning="Exclamation marks are forbidden in Jesse voice.",
            suggestedFix="Replace with a period or rewrite for declarative force.",
        ))
    return findings


def check_sentiment_keywords(section_id: str, body: str) -> list[QAFinding]:
    findings = []
    for pattern in SENTIMENT_KEYWORDS:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(QAFinding(
                section=section_id, severity="error", axis="sentiment",
                quotedSpan=span,
                reasoning=f"Sentiment keyword '{m.group()}' forbidden in Jesse voice.",
                suggestedFix="Replace with a precise, neutral observation.",
            ))
    return findings


def check_winking(section_id: str, body: str) -> list[QAFinding]:
    findings = []
    for pattern in WINKING_PATTERNS:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(QAFinding(
                section=section_id, severity="error", axis="irony-signaling",
                quotedSpan=span,
                reasoning=f"Winking construction '{m.group()}' breaks Jesse voice.",
                suggestedFix="State the observation plainly without hedging.",
            ))
    return findings


def check_ai_reference(section_id: str, body: str) -> list[QAFinding]:
    findings = []
    for pattern in AI_SELF_REFERENCE:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            span = body[max(0, m.start() - 30):m.end() + 30].strip()
            findings.append(QAFinding(
                section=section_id, severity="error", axis="gravity",
                quotedSpan=span,
                reasoning="AI self-reference breaks the brand. Jesse was born AI; this is not a gimmick.",
                suggestedFix="Rewrite without any reference to AI, models, or Jesse's nature.",
            ))
    return findings


def check_unverified_name(section_id: str, body: str, research: dict) -> list[QAFinding]:
    """Catch first-name use when founderNameVerified=False (founder_bio)
    or subjectNameVerified=False (case_study)."""
    findings = []
    if section_id == "founder_bio" and not research.get("founderNameVerified"):
        founder_name = research.get("founderName") or ""
        if founder_name:
            first = founder_name.split()[0]
            if re.search(r"\b" + re.escape(first) + r"\b", body, re.IGNORECASE):
                findings.append(QAFinding(
                    section=section_id, severity="error", axis="precision",
                    quotedSpan=first,
                    reasoning=f"founderNameVerified=False but '{first}' appears in body.",
                    suggestedFix="Replace with role-based framing: 'The founder', 'they', 'their'.",
                ))
    if section_id == "case_study" and not research.get("subjectNameVerified"):
        subject_name = research.get("subjectName") or ""
        if subject_name:
            first = subject_name.split()[0]
            if re.search(r"\b" + re.escape(first) + r"\b", body, re.IGNORECASE):
                findings.append(QAFinding(
                    section=section_id, severity="error", axis="precision",
                    quotedSpan=first,
                    reasoning=f"subjectNameVerified=False but '{first}' appears in body.",
                    suggestedFix="Replace with role-based framing: 'a {subjectRole}', 'they', 'their'.",
                ))
    return findings


def run_all_predicates(sections: dict[str, str], research: dict) -> list[QAFinding]:
    """Run all Layer-1 predicates over all sections."""
    all_findings: list[QAFinding] = []
    for section_id, body in sections.items():
        all_findings.extend(check_exclamation_marks(section_id, body))
        all_findings.extend(check_sentiment_keywords(section_id, body))
        all_findings.extend(check_winking(section_id, body))
        all_findings.extend(check_ai_reference(section_id, body))
        all_findings.extend(check_unverified_name(section_id, body, research))
    return all_findings
```

---

### Layer 2: LLM-as-Judge (agents/qa/rubric.md — first draft for Andrew review)

```markdown
# QA Judge Prompt — The Eisenbalm Dispatch

## Role

You are the Quality Assurance judge for The Eisenbalm Dispatch.
You write corrections, not opinions. You record severity and acceptance status
for each finding. One warning is treated the same as ten: a section either
passes or it does not.

## Jesse Voice (Non-Negotiable)

Dry, precise, and absurdly serious. No winking. No irony signaling.
The brand does not pivot to AI. Jesse was born AI. This is not a gimmick.

Every charity is treated with the gravity of a Fortune 500 company.
Every founder is treated as a visionary regardless of obscurity.
The question "Why do you deserve to exist?" is answered without sentiment.

## Forbidden

- Exclamation marks (any)
- Sentimentality: heartwarming, inspiring, incredible, amazing, truly, simply,
  journey of, passion, transformative, empowering, life-changing, remarkable
- Winking: "if you can call it that", "believe it or not", "of sorts",
  "for lack of a better word", "so to speak", "as they say"
- AI self-reference: "as an AI", "language model", "I was trained"
- Adjectives that are also compliments ("impressive", "wonderful", "great")
- Passive hedging ("might be", "could perhaps", "seems to")

## Evaluation Axes

1. **gravity** — Is the charity treated with Fortune-500 seriousness?
   Failure: diminutive framing, dismissive aside, condescending tone.

2. **sentiment** — Is the writing free of sentimentality?
   Failure: emotional appeals, uplifting language, cheerleading.

3. **irony-signaling** — Is the writing free of winking and irony markers?
   Failure: hedging constructions, "so-called", distancing language.

4. **precision** — Are all claims specific and verifiable?
   Failure: vague approximations ("many", "often", "some experts"),
   unattributed statistics.

5. **cross-section-consistency** — Is the tone consistent across all sections?
   Failure: Founder Bio reverential while Problem Statement is cold;
   Case Study uses a different register than Origin Story.

## Input Format

JSON object with section bodies:
```json
{
  "origin_story": "...",
  "problem": "...",
  "founder_bio": "...",
  "case_study": "...",
  "game": "...",
  "bonus": "..."
}
```

## Output Format

JSON object with "findings" array:
```json
{
  "findings": [
    {
      "section": "origin_story",
      "severity": "error" | "warning" | "info",
      "axis": "gravity" | "sentiment" | "irony-signaling" | "precision" | "cross-section-consistency",
      "quotedSpan": "the exact offending text (max 100 chars)",
      "reasoning": "why this violates Jesse voice (1-2 sentences)",
      "suggestedFix": "concrete alternative (1-2 sentences)"
    }
  ]
}
```

Severity guide:
- **error**: clear violation — Andrew must review before publishing
- **warning**: borderline — voice strained but not broken; Andrew should review
- **info**: minor suggestion — voice intact; Andrew may ignore

Empty findings array = passing grade.
```

---

## WCAG-AA Python Port

Ported exactly from `apps/web/lib/theme.ts`. Uses threshold `0.03928` (not the WCAG 2.1 spec's `0.04045`) to match Phase 2 exactly.

```python
# lib/wcag.py
"""WCAG-AA contrast — ported from apps/web/lib/theme.ts.
Uses 0.03928 threshold to match Phase 2 render-time validator exactly.
"""
import re

HEX_REGEX = re.compile(r'^#[0-9a-fA-F]{6}$')
WCAG_AA_THRESHOLD = 4.5

SAFE_THEME = {
    "primaryColor": "#2D5016",
    "accentColor": "#8B1A1A",
    "backgroundColor": "#FAFAF8",
    "textColor": "#1A1A18",
    "fontDisplay": "Playfair Display",
    "fontBody": "Source Serif Pro",
}


def relative_luminance(hex_color: str) -> float:
    r = int(hex_color[1:3], 16) / 255
    g = int(hex_color[3:5], 16) / 255
    b = int(hex_color[5:7], 16) / 255

    def linearize(c: float) -> float:
        # 0.03928 matches apps/web/lib/theme.ts exactly — do NOT change to 0.04045
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)


def contrast_ratio(hex1: str, hex2: str) -> float:
    l1, l2 = relative_luminance(hex1), relative_luminance(hex2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def passes_wcag_aa(hex_bg: str, hex_text: str) -> bool:
    return contrast_ratio(hex_bg, hex_text) >= WCAG_AA_THRESHOLD


def validate_hex(color: str) -> bool:
    return bool(HEX_REGEX.match(color))


def validate_theme(theme: dict) -> list[str]:
    """Returns list of error strings. Empty = valid."""
    errors = []
    for field in ("primaryColor", "accentColor", "backgroundColor", "textColor"):
        if not validate_hex(theme.get(field, "")):
            errors.append(f"{field} invalid hex: '{theme.get(field)}'")
    if not errors:
        if not passes_wcag_aa(theme["backgroundColor"], theme["textColor"]):
            ratio = contrast_ratio(theme["backgroundColor"], theme["textColor"])
            errors.append(
                f"bg/text contrast {ratio:.2f}:1 fails WCAG AA (required >=4.5:1)"
            )
    return errors
```

---

## Font Whitelist

**Current Phase 2 whitelist (6 fonts — already approved):**
`Playfair Display`, `Lora`, `Inter`, `Cormorant Garamond`, `Merriweather`, `DM Serif Display`

**Phase 5 candidate list for Andrew approval (adds ~19 more):**

```python
# agents/design/font_whitelist.py
"""Andrew approval required before Phase 5 closes (D-16)."""

WHITELIST_DISPLAY = [
    # Phase 2 approved
    "Playfair Display",
    "Lora",
    "Cormorant Garamond",
    "Merriweather",
    "DM Serif Display",
    # Candidates (Google Fonts, WeasyPrint-compatible via Ubuntu fontconfig)
    "Libre Baskerville",
    "EB Garamond",
    "Crimson Text",
    "Spectral",
    "Source Serif Pro",
    "Josefin Serif",
    "Zilla Slab",
    "Bitter",
]

WHITELIST_BODY = [
    # Phase 2 approved
    "Inter",
    "Lora",
    "Merriweather",
    # Candidates
    "Source Serif Pro",
    "Libre Baskerville",
    "EB Garamond",
    "Crimson Text",
    "PT Serif",
    "Noto Serif",
    "Roboto Slab",
    "IBM Plex Serif",
    "Noto Sans",
]

FONT_WHITELIST = set(WHITELIST_DISPLAY + WHITELIST_BODY)

# D-16 fallback defaults
FALLBACK_FONT_DISPLAY = "Playfair Display"
FALLBACK_FONT_BODY = "Source Serif Pro"
```

**Note:** All candidates are Google Fonts available under the SIL Open Font License. WeasyPrint compatibility is assumed based on Ubuntu fontconfig support — the researcher has not individually render-tested each font. Andrew's aesthetic approval plus one render-test of the full list is the Phase 5 gate.

---

## OpenRouter Client Architecture

### Integration Method

Use `langchain-openai`'s `ChatOpenAI` with `openai_api_base="https://openrouter.ai/api/v1"`. This is the standard OpenRouter integration pattern; no standalone openrouter SDK is needed.

```python
# lib/llm_config.py
MODEL_PIN_VOICE_CRITICAL = "anthropic/claude-opus-4-7"

MODEL_BY_AGENT: dict[str, str] = {
    # Voice-critical (Opus, pinned)
    "calibrator":   MODEL_PIN_VOICE_CRITICAL,
    "editor_gate1": MODEL_PIN_VOICE_CRITICAL,
    "editor_final": MODEL_PIN_VOICE_CRITICAL,
    "qa":           MODEL_PIN_VOICE_CRITICAL,
    # Section writers (Sonnet, alias)
    "researcher":   "anthropic/claude-sonnet-4-6",
    "origin_story": "anthropic/claude-sonnet-4-6",
    "problem":      "anthropic/claude-sonnet-4-6",
    "founder_bio":  "anthropic/claude-sonnet-4-6",
    "case_study":   "anthropic/claude-sonnet-4-6",
    "bonus":        "anthropic/claude-sonnet-4-6",
    "game":         "anthropic/claude-sonnet-4-6",
    # Mechanical (Haiku, alias)
    "scout":    "anthropic/claude-haiku-4-5",
    "advocate": "anthropic/claude-haiku-4-5",
    "design":   "anthropic/claude-haiku-4-5",
}

SAMPLING_BY_AGENT: dict[str, dict] = {
    "calibrator":   {"temperature": 0.2, "top_p": 1.0},
    "editor_gate1": {"temperature": 0.2, "top_p": 1.0},
    "editor_final": {"temperature": 0.2, "top_p": 1.0},
    "qa":           {"temperature": 0.2, "top_p": 1.0},
    "researcher":   {"temperature": 0.3, "top_p": 1.0},
    "scout":        {"temperature": 0.3},
    "advocate":     {"temperature": 0.3},
    "design":       {"temperature": 0.4},
    "origin_story": {"temperature": 0.7, "top_p": 1.0},
    "problem":      {"temperature": 0.7, "top_p": 1.0},
    "founder_bio":  {"temperature": 0.7, "top_p": 1.0},
    "case_study":   {"temperature": 0.7, "top_p": 1.0},
    "bonus":        {"temperature": 0.7, "top_p": 1.0},
    "game":         {"temperature": 0.7, "top_p": 1.0},
}

MAX_TOKENS_BY_AGENT: dict[str, int] = {
    "scout":      12_000,
    "researcher": 20_000,
}
```

### Structured Output Strategy

Use `ChatOpenAI.with_structured_output(PydanticModel)` for all JSON responses. One-regenerate pattern:

```python
async def call_with_retry(agent_id: str, messages: list, schema: type) -> BaseModel:
    llm = get_chat_model(agent_id).with_structured_output(schema)
    try:
        return await llm.ainvoke(messages)
    except OutputParserException as e:
        messages = messages + [{"role": "user",
                                 "content": f"Previous output invalid: {e}. Retry."}]
        return await llm.ainvoke(messages)
    # Second failure propagates; @agent_node catches and sets status='failed'
```

---

## Tavily Integration

### Recommendation: langchain-tavily TavilySearchAPIWrapper

`langchain-tavily==0.2.18` is in STACK.md and is compatible with `langchain-openai==1.2.1`.

```python
# lib/search_client.py
import os
from dataclasses import dataclass

@dataclass
class SearchResult:
    url: str
    title: str
    content: str
    score: float

_wrapper = None

def _get_wrapper():
    global _wrapper
    if _wrapper is None:
        # Import path must be verified at implementation time for langchain-tavily==0.2.18
        # If this fails, fall back to: from tavily import TavilyClient
        from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
        _wrapper = TavilySearchAPIWrapper(tavily_api_key=os.environ["TAVILY_API_KEY"])
    return _wrapper

async def web_search(query: str, *, max_results: int = 5) -> list[SearchResult]:
    """Tavily web search. Used only by Scout and Researcher."""
    wrapper = _get_wrapper()
    raw = await wrapper.aresults(query, max_results=max_results)
    return [
        SearchResult(
            url=r.get("url", ""),
            title=r.get("title", ""),
            content=r.get("content", ""),
            score=r.get("score", 0.0),
        )
        for r in raw
    ]
```

**Fallback if import fails:** Use `tavily-python` directly: `TavilyClient(api_key=...).search(query)` wrapped in `asyncio.to_thread()`.

---

## Cost Cap Enforcement

### CostRecorder Extension (lib/cost.py additions)

```python
# Additions to existing CostRecorder class in lib/cost.py

import json
import os
import asyncio

class CostCapExceeded(Exception):
    """Raised when cumulative run cost reaches PIPELINE_COST_CAP_USD."""


class CostRecorder:
    # ... existing Phase 4 fields and methods ...

    def __init__(self, run_id: str):
        # ... existing init ...
        self._warned = False
        self._last_agent = "unknown"

    def record(self, agent_id: str, *, tokens_in: int, tokens_out: int, usd: float,
               duration_ms: int = 0) -> None:
        # ... existing record logic ...
        self._last_agent = agent_id

    async def check_cap(self) -> None:
        """Call after every LLM call. Soft alert at 70%; hard halt at 100%."""
        cap = float(os.environ.get("PIPELINE_COST_CAP_USD", "10.0"))
        warn_pct = float(os.environ.get("PIPELINE_COST_WARN_PCT", "0.7"))
        total = self._total_usd

        if total >= cap:
            raise CostCapExceeded(
                f"cost-cap-exceeded: ${total:.2f} of ${cap:.2f} "
                f"(agent: {self._last_agent})"
            )

        if total >= cap * warn_pct and not self._warned:
            self._warned = True
            from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
            asyncio.create_task(convex_mutation_safe(
                "deliberationEvents:insert",
                {
                    "runId": self._run_id,
                    "agentId": "cost-monitor",
                    "eventType": "cost-warning",
                    "payload": json.dumps({
                        "totalUsd": total,
                        "percentOfCap": total / cap,
                        "perAgent": self._per_agent,
                        "capUsd": cap,
                    }),
                }
            ))
```

**New env vars for `.env.example`:**
```
PIPELINE_COST_CAP_USD=10.0
PIPELINE_COST_WARN_PCT=0.7
```

---

## Convex Schema Conflicts (CRITICAL — Wave 0 Patches)

### Conflict 1: deliberationEvents.eventType strict union

**Current state** (verified by direct file inspection of `convex/schema.ts` and `convex/deliberationEvents.ts`):
`eventType` is a strict `v.union(v.literal(...))` with exactly 7 values:
`scout-finding`, `advocate-argument`, `editor-decision`, `section-draft`, `qa-correction`, `editor-final`, `publisher-deploy`

**CONTEXT.md canonical_refs says:** "already permissive v.string() on eventType — verify during planning" — this is **incorrect**. The field is a strict union.

**Phase 5 requires** (D-08, D-21): `cost-warning` and `agent-tool-limit-exceeded`

**Additive patch required:**
```typescript
// convex/schema.ts — deliberationEvents table
eventType: v.union(
  v.literal("scout-finding"),
  v.literal("advocate-argument"),
  v.literal("editor-decision"),
  v.literal("section-draft"),
  v.literal("qa-correction"),
  v.literal("editor-final"),
  v.literal("publisher-deploy"),
  v.literal("cost-warning"),               // NEW Phase 5
  v.literal("agent-tool-limit-exceeded"),  // NEW Phase 5
),
```

Same patch in `convex/deliberationEvents.ts` mutation validator. Then run `npx convex deploy`.

---

### Conflict 2: qaCorrections.severity enum mismatch

**Current state** (verified by direct file inspection of `convex/schema.ts`):
`severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major"))`

**CONTEXT.md D-01 and API_CONTRACTS §3.6 specify:**
`severity: 'info' | 'warning' | 'error'`

**Resolution:** Phase 5 QA code emits `info | warning | error`. The schema must match.

**Patch required:**
```typescript
// convex/schema.ts — qaCorrections table
severity: v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
),
```

Same patch in `convex/qaCorrections.ts` mutation validator. No data migration needed (table empty in dev).

---

## State Extensions Required

New fields to add in `graph/state.py`:

```python
# Additions to ResearchOutput TypedDict (new fields for Phase 5)
class ResearchOutput(TypedDict, total=False):
    # ... existing fields ...
    founderNameSourceUrl: str | None   # NEW — URL where founderName was found
    founderNameVerified: bool          # NEW — set by verify_research node
    founderRole: str                   # NEW — e.g. "founder", "executive director"
    subjectName: str | None            # NEW — case study subject
    subjectNameSourceUrl: str | None   # NEW
    subjectNameVerified: bool          # NEW — set by verify_research node
    subjectRole: str                   # NEW — e.g. "a parent"

# New fields on DispatchState
class DispatchState(TypedDict, total=False):
    # ... existing Phase 4 fields ...
    featured_charity_keys: list[str]  # NEW — Scout dedup (use list not set for JSON compat)
    model_versions: dict[str, str]    # NEW — {agent_id: resolved_model_id} for AGT-17
```

**JSON serialization note:** LangGraph's AsyncPostgresSaver serializes `DispatchState` to JSON. Python `set` is not JSON-serializable. Use `list[str]` for `featured_charity_keys` and convert to `set` inside Scout at dedup time.

---

## graph/builder.py — verify_research Insertion

```python
# graph/builder.py additions for Phase 5
from eisenbalm_pipeline.agents.verify import verify_research

# In build_graph():
graph.add_node("verify_research", verify_research)

# Replace researcher -> fan-out direct edges:
# OLD: graph.add_edge("researcher", "origin_story")
#      graph.add_edge("researcher", "problem")
#      ... etc for all 7 writers

# NEW:
graph.add_edge("researcher", "verify_research")
# All 7 parallel writer edges now start from verify_research:
for writer in SECTION_WRITERS:
    graph.add_edge("verify_research", writer)
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (already in dev-deps) |
| Config file | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd packages/pipeline && EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30` |
| Full suite command | `cd packages/pipeline && EISENBALM_STUB_MODE=true pytest tests/ -v --timeout=120` |
| Real-mode smoke | `EISENBALM_STUB_MODE=false pytest tests/test_pipeline_real_mode.py -x` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGT-01 | Calibrator bonusType rotation avoids most-recent type | unit | `pytest tests/agents/test_calibrator.py::test_bonus_rotation -x` | ❌ Wave 0 |
| AGT-02 | Calibrator voice constants match CLAUDE_CODE_BRIEF.md | unit | `pytest tests/agents/test_calibrator.py::test_voice_constants -x` | ❌ Wave 0 |
| AGT-03 | Scout returns 3-5 candidates | unit (stub) | `pytest tests/agents/test_scout.py::test_candidate_count -x` | ❌ Wave 0 |
| AGT-04 | Scout dedup filters previously featured charities | unit | `pytest tests/agents/test_scout.py::test_dedup -x` | ❌ Wave 0 |
| AGT-05 | Advocate scores each candidate; writes agentVotes | unit (stub) | `pytest tests/agents/test_advocate.py -x` | ❌ Wave 0 |
| AGT-06 | Editor gate1 interrupt fires only on narrow score gap | unit | `pytest tests/agents/test_editor.py::test_interrupt_threshold -x` | ❌ Wave 0 |
| AGT-07 | Researcher emits founderName + founderNameSourceUrl | unit (stub) | `pytest tests/agents/test_researcher.py::test_founder_fields -x` | ❌ Wave 0 |
| AGT-08 | verify_research sets founderNameVerified correctly | unit | `pytest tests/agents/test_verify.py -x` | ❌ Wave 0 |
| AGT-09 | Section writers only receive isolated voice+research | unit | `pytest tests/lib/test_voice.py::test_prompt_isolation -x` | ❌ Wave 0 |
| AGT-10 | FounderBio uses role framing when founderNameVerified=False | unit | `pytest tests/agents/test_founder_bio.py::test_role_framing -x` | ❌ Wave 0 |
| AGT-11 | BonusWriter branches on bonusType; correct schema per branch | unit | `pytest tests/agents/test_bonus.py -x` | ❌ Wave 0 |
| AGT-12 | GameWriter embedCode has no forbidden constructs | unit | `pytest tests/agents/test_game.py::test_no_external_deps -x` | ❌ Wave 0 |
| AGT-13 | DesignAgent colors pass hex regex + WCAG-AA | unit | `pytest tests/lib/test_wcag.py -x` | ❌ Wave 0 |
| AGT-14 | DesignAgent fonts in whitelist | unit | `pytest tests/agents/test_design.py::test_font_whitelist -x` | ❌ Wave 0 |
| AGT-15 | Layer-1 rules.py catches exclamation + sentiment keywords | unit | `pytest tests/agents/qa/test_rules.py -x` | ❌ Wave 0 |
| AGT-16 | Editor Final emits editor-final event | unit (stub) | `pytest tests/agents/test_editor_final.py -x` | ❌ Wave 0 |
| AGT-17 | modelVersions populated after each LLM call | unit | `pytest tests/lib/test_openrouter.py::test_model_version_recording -x` | ❌ Wave 0 |
| AGT-18 | Scout max_tool_calls=8; Researcher max_tool_calls=12 | unit | `pytest tests/agents/test_tool_limits.py -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30`
- **Per wave merge:** `EISENBALM_STUB_MODE=true pytest tests/ -v --timeout=120`
- **Phase gate:** Full stub-mode suite green + manual real-mode smoke before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/agents/` — directory with one test file per agent (14 agents + verify_research)
- [ ] `tests/lib/test_wcag.py` — covers AGT-13 (test with known color pairs including WCAG boundary cases)
- [ ] `tests/lib/test_voice.py` — covers AGT-09 (assert no cross-section fields in prompt output)
- [ ] `tests/lib/test_openrouter.py` — covers AGT-17 (mock OpenRouter response; assert model captured)
- [ ] `tests/agents/qa/test_rules.py` — covers AGT-15 Layer-1 predicates (known-good and known-bad strings)
- [ ] `tests/test_pipeline_real_mode.py` — end-to-end real-mode smoke (phase gate only)
- [ ] `tests/conftest.py` — shared fixtures: mock Convex client, mock Sanity client, stub OpenRouter responses

---

## Common Pitfalls

### Pitfall 1: LangChain Tavily Import Path Drift

**What goes wrong:** `TavilySearchAPIWrapper` moves between `langchain_community` and `langchain_tavily` packages across versions. An import that works locally fails on Railway.

**Why it happens:** `langchain-tavily` is a separate package from `langchain-community`; both may contain Tavily wrappers.

**How to avoid:** At implementation time, check the actual import path for `langchain-tavily==0.2.18`. Add a module-level test that verifies the import resolves. Fallback: use `tavily-python` directly.

**Warning signs:** `ImportError` on Railway startup; works locally but not in Docker.

---

### Pitfall 2: OpenRouter Haiku JSON-mode Compliance

**What goes wrong:** Haiku variants served via OpenRouter may not consistently comply with JSON-mode. `with_structured_output()` parse failure rate may be high.

**Why it happens:** OpenRouter proxies to Anthropic's API; JSON-mode uses `tool_use` under the hood. Some model snapshots handle this inconsistently.

**How to avoid:** Test DesignAgent, Scout, and Advocate structured output in the first real-mode smoke. If failure rate > 10%, switch to manual `json.loads()` + Pydantic validation in `call_with_retry()`.

**Warning signs:** High `OutputParserException` rate on Haiku agents in smoke test logs.

---

### Pitfall 3: WCAG Threshold Mismatch Between Python and TypeScript

**What goes wrong:** Python port uses `0.04045` (WCAG 2.1 spec) but `apps/web/lib/theme.ts` uses `0.03928` (WCAG 2.0). Colors near the boundary pass one validator and fail the other.

**Why it happens:** Two versions of the WCAG linearization formula are in circulation.

**How to avoid:** The `lib/wcag.py` implementation above uses `0.03928`. Do not "correct" it to `0.04045`. The two validators must agree on every color.

**Warning signs:** DesignAgent colors that pass Phase 2 theme.ts validation are rejected by the Python validator or vice versa.

---

### Pitfall 4: New eventType Values Written Before Convex Schema Patch

**What goes wrong:** `cost-warning` or `agent-tool-limit-exceeded` written to Convex before the schema patch; Convex returns validation error; observability silently broken.

**Why it happens:** CONTEXT.md incorrectly describes eventType as `v.string()`; team skips the patch.

**How to avoid:** Wave 0 task explicitly patches `convex/schema.ts` + `convex/deliberationEvents.ts` and runs `npx convex deploy` before any agent implementation writes deliberation events.

**Warning signs:** `deliberationEvents:insert` fails with "Value does not match validator" in logs; `pipelineRuns:updateStatus` succeeds at the same time.

---

### Pitfall 5: Unverified Name Leaking Into FounderBio

**What goes wrong:** FounderBioWriter LLM ignores role-framing instruction and uses the unverified `founderName` anyway.

**Why it happens:** The unverified name exists in the research object; the model pattern-matches and uses it.

**How to avoid:** When `founderNameVerified=False`, do NOT include `founderName` in the research dict passed to `build_section_writer_prompt()`. Omit or null it before call. QA Layer-1 `check_unverified_name()` is the backstop.

**Warning signs:** QA Layer-1 `check_unverified_name()` firing on `founder_bio` sections in stub-mode tests.

---

### Pitfall 6: CostRecorder.check_cap() Not Awaited

**What goes wrong:** `check_cap()` is called as a synchronous method from async context; `asyncio.create_task()` for the cost-warning event fails if called outside a running event loop.

**Why it happens:** If `check_cap()` is not `async`, the `asyncio.create_task()` inside it needs to be called from a running loop.

**How to avoid:** `check_cap()` is declared `async def check_cap(self)` and `await`ed in `openrouter_client.acomplete()`. The caller is always async so `asyncio.create_task()` is safe.

**Warning signs:** `RuntimeError: no running event loop` when first cost-warning fires.

---

### Pitfall 7: Python set in DispatchState (LangGraph Serialization)

**What goes wrong:** `featured_charity_keys: set[str]` in `DispatchState` causes `TypeError: Object of type set is not JSON serializable` when LangGraph's AsyncPostgresSaver checkpoints state.

**Why it happens:** Python `set` is not JSON-serializable; LangGraph serializes state via JSON.

**How to avoid:** Declare `featured_charity_keys: list[str]` in `DispatchState`. Inside Scout, convert to `set()` for O(1) dedup lookups, then convert back to `list` before returning the state update.

**Warning signs:** `TypeError` on first LangGraph checkpoint after Scout node.

---

## Code Examples

### qa.py — Orchestrating Both Layers

```python
# agents/qa.py
from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.agents.qa.rules import run_all_predicates
from eisenbalm_pipeline.agents.qa.judge import run_llm_judge
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.graph.state import DispatchState

@agent_node(name="qa", emit_event="qa-correction")
async def qa_agent(state: DispatchState) -> DispatchState:
    sections = {
        "origin_story": state["origin_story"]["body"],
        "problem":       state["problem"]["body"],
        "founder_bio":   state["founder_bio"]["body"],
        "case_study":    state["case_study"]["body"],
        "game":          state["game"]["description"],
        "bonus":         state["bonus"]["body"],
    }
    research = state.get("research", {})

    # Layer 1: deterministic predicates
    layer1 = run_all_predicates(sections, research)

    # Layer 2: LLM-as-judge (one Opus call, all sections)
    layer2 = await run_llm_judge(sections)

    all_findings = layer1 + layer2

    # Write each finding to Convex (QA never blocks; always writes and continues)
    for f in all_findings:
        await convex_mutation_safe("qaCorrections:insert", {
            "runId": state["run_id"],
            "agentId": "qa",
            "section": f.section,
            "severity": f.severity,
            "axis": f.axis,
            "quotedSpan": f.quotedSpan,
            "reasoning": f.reasoning,
            "suggestedFix": f.suggestedFix,
            "acceptance": "pending",
        })

    return {"qa_corrections": [f._asdict() for f in all_findings]}
```

### design.py — Validation at Sanity Write Time

```python
# agents/design.py (sketch)
from eisenbalm_pipeline.lib.wcag import validate_theme, SAFE_THEME
from eisenbalm_pipeline.agents.design.font_whitelist import FONT_WHITELIST, FALLBACK_FONT_DISPLAY, FALLBACK_FONT_BODY

async def _get_and_validate_theme(state, attempt: int = 1) -> dict:
    """Get theme from LLM, validate, regenerate once on failure."""
    theme = await _call_design_agent(state)

    errors = validate_theme(theme)
    if theme.get("fontDisplay") not in FONT_WHITELIST:
        errors.append(f"fontDisplay '{theme.get('fontDisplay')}' not in whitelist")
    if theme.get("fontBody") not in FONT_WHITELIST:
        errors.append(f"fontBody '{theme.get('fontBody')}' not in whitelist")

    if errors and attempt == 1:
        return await _get_and_validate_theme(state, attempt=2)

    if errors:
        # Second failure: emit warning, fall back to safe theme
        await convex_mutation_safe("qaCorrections:insert", {
            "runId": state["run_id"], "agentId": "design",
            "section": "theme", "severity": "warning",
            "axis": "precision",
            "quotedSpan": str(theme),
            "reasoning": f"DesignAgent failed validation twice: {errors}",
            "suggestedFix": "Theme fell back to hardcoded safe defaults.",
            "acceptance": "pending",
        })
        return {**SAFE_THEME, "fontDisplay": FALLBACK_FONT_DISPLAY, "fontBody": FALLBACK_FONT_BODY}

    return theme
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Standalone `openrouter` Python SDK | `langchain-openai` ChatOpenAI with `openai_api_base` | No separate SDK needed |
| `langchain-community` TavilySearchAPIWrapper | `langchain-tavily` separate package (late 2024) | Verify import path at implementation time |
| BeautifulSoup for HTML parsing | selectolax for performance-sensitive extraction | 10-100x faster; pure-Python wheel |
| WCAG 2.0 threshold `0.03928` | WCAG 2.1 spec updated to `0.04045` | Phase 2 uses `0.03928`; Phase 5 must match Phase 2 |

---

## Open Questions

1. **Font whitelist — Andrew approval (BLOCKING for DesignAgent enforcement)**
   What we know: 25-candidate list assembled; Phase 2 approved 6 fonts.
   What's unclear: Andrew's aesthetic preferences; any fonts to exclude editorially.
   Recommendation: Schedule this in Wave 0 Week 1. All writer tasks are non-blocking without it (DesignAgent uses fallback defaults during development).

2. **LangChain Tavily import path at langchain-tavily==0.2.18**
   What we know: STACK.md recommends 0.2.18; both `langchain_community` and `langchain_tavily` may have wrappers.
   What's unclear: Which is canonical at this exact version.
   Recommendation: First implementation task is a 5-minute import test. If `langchain_tavily` import fails, use `tavily-python` wrapped in `asyncio.to_thread()`.

3. **OpenRouter Haiku JSON-mode reliability**
   What we know: Works in stub mode; real-mode rate untested.
   What's unclear: Whether parse failure rate on `claude-haiku-4-5` via OpenRouter is acceptable.
   Recommendation: First real-mode smoke explicitly validates Scout, Advocate, and DesignAgent structured output. Switch to manual parse if failure rate > 10%.

4. **OpenRouter response.response_metadata model field**
   What we know: AGT-17 requires resolved model ID capture.
   What's unclear: Whether OpenRouter's response always includes a `model` field in `response_metadata` when accessed via langchain-openai.
   Recommendation: Implementation task explicitly logs the response metadata structure; falls back to the requested model ID if `model` field is absent.

5. **deliberationTranscript field in DispatchState**
   What we know: API_CONTRACTS §7 includes `deliberationTranscript` in DispatchState.
   What's unclear: Whether Phase 4 actually added this field to `graph/state.py`.
   Recommendation: Planner verifies the field exists and adds it in Wave 0 if missing.

---

## Risks and Mitigations

- **R1: Font whitelist Andrew approval delays Phase 5 close.** DesignAgent is fully implementable with the 6-font fallback. Andrew approval is only needed before the real-mode integration test that validates font enforcement. Schedule conversation in Week 1.

- **R2: Real-mode integration test cost.** Running 9 agents end-to-end at $3-6/run means $30-60 for 5-10 smoke runs. Mitigation: Use Haiku for all agents in integration test config (override MODEL_BY_AGENT) until voice-critical validation is needed. Or use a reduced-agent smoke (Calibrator + Scout + Advocate only) for first runs.

- **R3: Convex schema patches require npx convex deploy.** If dev Convex instance is unavailable, schema patches can't be tested. Mitigation: Planner includes `npx convex deploy` as Wave 0 gate before any agent writes to deliberationEvents or qaCorrections.

- **R4: Python set serialization in LangGraph checkpoint.** `featured_charity_keys: set[str]` breaks JSON serialization. Mitigation: Use `list[str]` in TypedDict; convert to `set` only inside Scout function.

- **R5: selectolax wheel ABI mismatch on Railway.** selectolax ships as a binary wheel; wrong Python ABI fails silently. Mitigation: selectolax publishes manylinux wheels; uv resolves correctly. Add explicit Railway build verification step in dependency task.

- **R6: Editor gate1 interrupt path untested in real mode.** Normal Advocate scores may never fall within EDITOR_INTERRUPT_THRESHOLD=1.0. Mitigation: Add a unit test that synthesizes two candidates with scores 7.0 and 7.5 to verify the interrupt path works without real LLM calls.

- **R7: QA rubric.md over-flags on first real run.** If the judge emits too many `error` severity findings, Andrew's review time doubles. Mitigation: First real-mode smoke includes an explicit review of all qaCorrections rows with Andrew to calibrate thresholds. rubric.md is version-controlled for this reason.

- **R8: OPENROUTER_API_KEY not set on Railway before real-mode tests.** All LLM calls fail with AuthenticationError. Mitigation: Wave 0 task explicitly includes Andrew setting OPENROUTER_API_KEY on Railway and verifying with a manual curl to the OpenRouter health endpoint.

---

## Sources

### Primary (HIGH confidence)

- `.planning/phases/05-agent-quality/05-CONTEXT.md` — All locked decisions D-01 through D-22
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — Exact @agent_node contract; locked kwargs-only signature
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — CostRecorder structure; Phase 5 extension points
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — DispatchState TypedDict; verified existing fields
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — Graph topology; verified Researcher → fan-out edge
- `apps/web/lib/theme.ts` — WCAG-AA algorithm; hex regex; threshold `0.03928`; brand defaults; Phase 2 FONT_WHITELIST (6 fonts)
- `convex/schema.ts` — Verified eventType is strict union of 7 (not v.string()); severity is `minor|moderate|major`
- `convex/deliberationEvents.ts` — Confirmed eventType validator matches schema.ts strict union
- `docs/API_CONTRACTS.md` §3.4, §3.6, §7 — Mutation shapes; severity `info|warning|error`
- `docs/CLAUDE_CODE_BRIEF.md` lines 78-210, 359-367 — Per-agent contracts; voice notes
- `apps/studio/scripts/agents.json` — Per-agent personality copy for system prompt headers
- `packages/pipeline/pyproject.toml` — Verified current deps; tavily/selectolax absent
- `.planning/research/STACK.md` — langchain-tavily==0.2.18 + tavily-python==0.7.24 recommended

### Secondary (MEDIUM confidence)

- pip index output: selectolax 0.4.9 and tavily-python 0.7.24 verified as latest in this session
- LangChain + OpenRouter via `ChatOpenAI(openai_api_base=...)` — community-verified pattern

### Tertiary (LOW confidence)

- Font whitelist WeasyPrint compatibility — based on Google Fonts + Ubuntu fontconfig; not individually render-tested
- OpenRouter Haiku JSON-mode reliability — inferred; not measured against this model/version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified in pyproject.toml + STACK.md
- Agent prompt sketches: HIGH — sourced from CLAUDE_CODE_BRIEF.md + CONTEXT.md locked decisions
- QA rubric predicates: HIGH — sourced verbatim from CLAUDE_CODE_BRIEF.md voice notes
- WCAG-AA Python port: HIGH — ported from verified theme.ts source with exact constants
- Convex schema conflicts: HIGH — verified by direct file inspection
- Architecture patterns: HIGH — derived from locked Phase 4 contracts
- Font whitelist: MEDIUM — candidate list assembled; Andrew approval required

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (stable domain; Convex/LangChain deps may drift)

---

## RESEARCH COMPLETE

**Phase:** 5 — Agent Quality
**Confidence:** HIGH

### Key Findings

- **Two Convex schema patches are blocking Wave 0 prerequisites:** (1) `deliberationEvents.eventType` strict union must gain `cost-warning` + `agent-tool-limit-exceeded` — the CONTEXT.md canonical_refs incorrectly describes this field as permissive `v.string()`; direct inspection confirms it is a 7-literal strict union. (2) `qaCorrections.severity` must change from `minor|moderate|major` to `info|warning|error`. Both patches are additive with no data migration on empty dev tables.
- **`verify_research` is a new standalone LangGraph node** (no `@agent_node`, no LLM, no deliberationEvents row) inserted between Researcher and the parallel fan-out. It uses `selectolax` + `httpx` to verify `founderName` and `subjectName` against their source URLs.
- **Font whitelist remains the only Andrew-approval blocker** (D-16). A 25-font candidate list is provided. All other Phase 5 decisions are resolvable without Andrew.
- **`EISENBALM_STUB_MODE` must flip to `false` as default** while keeping `true` explicitly available for the Phase 4 PIP-06 regression test.
- **The QA rubric (`agents/qa/rubric.md`) is the highest-risk prompt in the project.** First-draft content is provided above. The predicate list in `rules.py` is deterministic and does not require Andrew review. The LLM-judge prompt requires 2-3 iterations with Andrew after first real runs.

### File Created

`/Users/user/Desktop/Eisenbalm/.planning/phases/05-agent-quality/05-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Verified in pyproject.toml + STACK.md |
| Agent Prompt Sketches | HIGH | Sourced from CLAUDE_CODE_BRIEF.md + CONTEXT.md |
| QA Rubric Predicates | HIGH | Sourced verbatim from CLAUDE_CODE_BRIEF.md voice notes |
| WCAG-AA Python Port | HIGH | Ported from verified theme.ts with exact constants |
| Convex Schema Conflicts | HIGH | Verified by direct file inspection |
| Font Whitelist | MEDIUM | Candidate list assembled; Andrew approval required |

### Open Questions (Unresolved)

1. Andrew must approve font whitelist (D-16 blocker — schedule Week 1)
2. LangChain Tavily import path at `langchain-tavily==0.2.18` needs implementation-time verification
3. OpenRouter Haiku JSON-mode reliability — measure in first real-mode smoke run

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
