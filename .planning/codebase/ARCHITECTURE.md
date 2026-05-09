# Architecture

**Analysis Date:** 2025-02-09

## Pattern Overview

**Overall:** Nine-agent LangGraph pipeline with two execution phases (sequential selection, parallel content production), human-in-the-loop gates, and reactive frontend subscription to real-time pipeline events.

**Key Characteristics:**
- **Orchestration:** LangGraph manages agent handoff, state threading, and conditional branching
- **Human gates:** Two decision points where Andrew reviews (Editor Gate 1 for charity selection, Andrew review via Sanity Studio for final publication)
- **Real-time deliberation:** All pipeline events streamed to Convex for live frontend visualization
- **Canonical content:** Sanity as source-of-truth for published content; pipeline drafts to Sanity as `draft` status
- **Pipeline state:** Supabase holds ephemeral pipeline execution state; Convex holds queryable deliberation events
- **Webhook-triggered finalization:** Sanity webhook on `status === 'published'` triggers Publisher agent asynchronously

---

## Layers

**Orchestration Layer (LangGraph / FastAPI):**
- Purpose: Coordinate the nine-agent pipeline, manage state threading, enforce sequential and parallel execution phases, handle human gates
- Location: `packages/pipeline/` (FastAPI + LangGraph)
- Contains: Agent nodes (Python LangGraph nodes), graph definition, state management, tool integrations
- Depends on: OpenRouter (model routing), Tavily/Brave (web search), Sanity client, Convex HTTP client, Supabase Python client
- Used by: Railway infrastructure (async trigger from HTTP endpoint or Sanity webhook)

**Content Authority (Sanity CMS):**
- Purpose: Store published issues, charities, agent profiles; serve as canonical source for frontend content
- Location: Sanity v3 (cloud-hosted)
- Contains: Document types for `weeklyIssue`, `charity`, `agentProfile` (schemas in `schemas/`)
- Depends on: Nothing (read-only for frontend)
- Used by: Next.js frontend (GROQ reads), pipeline (Python writes on draft completion and PDF upload)

**Real-time Deliberation (Convex):**
- Purpose: Provide queryable, real-time event stream for deliberation layer visualization; store pitch log, agent votes, QA corrections
- Location: `convex/schema.ts`, deployed to Convex cloud
- Contains: Five tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`
- Depends on: Python mutation calls from pipeline via HTTP API
- Used by: Next.js frontend (useQuery hooks for live updates)

**Frontend (Next.js):**
- Purpose: Render magazine experience, display issues, render deliberation layer, handle commerce
- Location: `apps/web/` (Next.js 14+ App Router)
- Contains: Page routes, components, Sanity GROQ query library, Convex subscription components, Stripe integration
- Depends on: Sanity (content), Convex (live deliberation), Stripe (checkout)
- Used by: Browser clients (Vercel-hosted)

**CMS Studio (Sanity Studio):**
- Purpose: Editorial interface where Andrew reviews drafts, edits fields, and publishes
- Location: `apps/studio/`
- Contains: Sanity Studio configuration, schema wiring, custom desk plugins (optional)
- Depends on: Sanity v3
- Used by: Andrew (human editor)

**Commerce (Stripe):**
- Purpose: Payment processing for lip balm sales
- Location: Stripe cloud (payment provider)
- Contains: Product definition, checkout sessions, webhook handler
- Depends on: Nothing
- Used by: Frontend checkout flow, order confirmation

---

## Data Flow

### Phase 1 — Charity Selection (Sequential)

```
Pipeline started (UUID run_id, issue_number created)
↓
Calibrator
  • Input: Current date, previous issue numbers, previous bonus types
  • Output: StyleBrief { voice, constraints, bonusType, visualDirection }
  • Writes: pipelineMetadata.styleBrief to Convex (deliberationEvents: calibrator-brief)
↓
Scout
  • Input: StyleBrief from Calibrator
  • Tool: Web search (Tavily/Brave)
  • Output: CharityCandidate[] (3–5 candidates)
  • Writes: Each candidate to Convex pitchLog, deliberationEvents: scout-finding
  • Writes: Each candidate to Sanity charity documents (write_charity)
↓
Advocate
  • Input: CharityCandidate[] + StyleBrief
  • Cycles: For each candidate, generates argument FOR featuring them
  • Output: Same candidates array with advocateArgument + advocateScore (1–10) added
  • Writes: Each argument to Convex deliberationEvents: advocate-argument
  • Writes: Each vote to Convex agentVotes: advocate (vote='for')
↓
Editor Gate 1 (Selection)
  • Input: All candidates with Scout summaries + Advocate arguments
  • Role: Human logic inside agent
  • Output: 
    • winnerId, winnerName (selected charity)
    • editorDecision (rationale)
    • runnerUpNotes (why others not selected)
    • deliberationTranscript (full Scout+Advocate+Editor text → NotebookLM source)
  • Writes: editorDecision event to Convex deliberationEvents: editor-decision
  • Writes: Marks winning candidate as selected in Convex pitchLog: markSelected()
  • Pauses: If no clear winner, LangGraph pauses state — requires manual Andrew intervention
↓
LangGraph continues (after gate 1 passes)
```

**State update at Phase 1 completion:**
- `state['style_brief']` set
- `state['candidates']` populated
- `state['winning_charity']` selected
- `state['winning_charity_sanity_id']` written to Sanity, retrieved back
- `state['editor_decision']`, `state['runner_up_notes']` populated
- `state['deliberation_transcript']` full text (Scout findings + Advocate arguments + Editor reasoning)

---

### Phase 2 — Content Production (Parallel after Gate 1)

All section agents receive: winning charity data + StyleBrief

```
Researcher
  • Input: Winning charity + StyleBrief
  • Tool: Web search
  • Output: ResearchOutput { foundingMoment, founderName, founderBackground, caseStudySubject, caseStudyOutcome, verifiedFacts }
  • Writes: deliberationEvents: section-draft

Parallel [executes concurrently]:

├─ OriginStoryWriter
│  • Input: ResearchOutput + StyleBrief
│  • Output: SectionContent { headline, body }
│  • Writes: deliberationEvents: section-draft
│
├─ ProblemWriter
│  • Input: ResearchOutput + StyleBrief
│  • Output: SectionContent { headline, body } + pdfContent (structured for PDF generator)
│  • Writes: deliberationEvents: section-draft
│
├─ FounderBioWriter
│  • Input: ResearchOutput + StyleBrief
│  • Output: SectionContent { headline, body }
│  • Writes: deliberationEvents: section-draft
│
├─ CaseStudyWriter
│  • Input: ResearchOutput + StyleBrief
│  • Output: CaseStudyContent { subjectName, headline, body }
│  • Writes: deliberationEvents: section-draft
│
├─ GameWriter
│  • Input: ResearchOutput + StyleBrief + charity mission
│  • Output: GameContent { headline, description, embedCode (self-contained HTML/JS for iframe sandbox) }
│  • Writes: deliberationEvents: section-draft
│
├─ BonusWriter
│  • Input: ResearchOutput + StyleBrief + bonusType
│  • Output: BonusContent (varies by bonusType)
│    - bigBudget: { headline, body, storyboards[] }
│    - jingle: { headline, body, lyrics, sunoPrompt }
│    - specAd: { headline, body }
│  • Writes: deliberationEvents: section-draft
│
└─ DesignAgent
   • Input: StyleBrief + charity
   • Output: Theme { primaryColor, accentColor, backgroundColor, textColor, fontDisplay, fontBody, visualDirection }
   • Validates: Hex colors, Google Fonts names
   • Writes: deliberationEvents: section-draft

All parallel writers complete, state merged
↓
QA Agent
  • Input: Full content object (all sections)
  • Evaluates: Voice consistency (Jesse's dry, precise tone), factual accuracy, tonal consistency, values alignment
  • Output: Corrected full content object + qaCorrections[] { sectionName, fieldName, original, corrected, reason, severity, accepted }
  • Writes: Each correction to Convex qaCorrections: insert
  • Writes: deliberationEvents: qa-correction
↓
Editor Final (second invocation)
  • Input: QA output + full content
  • Reviews: QA corrections, final sequencing, writes connective copy if needed
  • Output: Approved full content object + editor_final_notes
  • Writes: deliberationEvents: editor-final
```

**State update at Phase 2 completion:**
- `state['research']` populated
- `state['origin_story']`, `state['problem_statement']`, `state['founder_bio']`, `state['case_study']`, `state['game']`, `state['bonus']`, `state['theme']` all populated
- `state['qa_corrections']` populated with all corrections made
- `state['editor_final_notes']` populated
- `state['sanity_issue_id']` set after writing to Sanity

---

### After Pipeline Completion

```
Pipeline writes draft to Sanity
  • Creates/updates charity document (write_charity)
  • Creates weeklyIssue document with status='draft' (write_issue_draft)
  • All sections fully populated, pipelineMetadata set with runId
  • Also writes all candidate charities as charity documents
↓
Convex pipelineRuns status → 'awaiting-review'
↓
Andrew reviews in Sanity Studio
  • Opens the draft weeklyIssue
  • Can edit any field
  • When satisfied: changes status → 'published' and publishes
↓
Sanity webhook fires (filter: status == 'published')
  • POST to https://<railway-domain>/webhook/sanity-publish
  • Payload: { _id, issueNumber, runId, status }
↓
FastAPI webhook handler verifies HMAC signature
  • Validates SANITY_WEBHOOK_SECRET
  • Returns 200 immediately (async pattern — do not wait)
  • Enqueues Publisher agent to run in background
↓
Publisher Agent (background task)
  • Triggered by Sanity publish webhook
  • Generates Problem Statement PDF from pdfContent (WeasyPrint)
  • Uploads PDF to Sanity problemPdf field (upload_pdf_to_issue)
  • Triggers Vercel deploy hook (trigger_vercel_deploy)
  • Patches charity.firstFeaturedIn if not already set (set_charity_first_featured)
  • Updates Convex pipelineRuns status → 'complete'
  • Writes deliberationEvents: publisher-deploy
↓
Vercel deployment triggers
  • Frontend pulls latest issue from Sanity
  • Live cache invalidated
↓
New issue live
```

---

## State Management

**LangGraph State Contract:** `DispatchState` TypedDict (defined in `packages/pipeline/types.py` — see `docs/API_CONTRACTS.md` section 7)

**State threading pattern:**
- Each agent reads from `state` and returns updates to `state`
- LangGraph merges agent outputs back to state
- Sequential agents block until previous agent completes
- Parallel agents all run concurrently, then merge results

**Persistence:**
- **Ephemeral:** Pipeline state lives in LangGraph during execution, backed by Supabase `pipeline_state` table (for resumability / restart)
- **Queryable deliberation:** All deliberation events persisted immediately to Convex (not ephemeral — shows to users)
- **Canonical content:** Draft written to Sanity at pipeline end (status='draft'), published by Andrew

---

## Key Abstractions

**CharityCandidate:**
- Purpose: Represents a charity being considered for featuring
- Evolves through: Scout (finds) → Advocate (scores) → Editor Gate 1 (selects one) → phase 2 (winner only)
- Fields: name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked, advocateArgument, advocateScore

**StyleBrief:**
- Purpose: Constraints injected into every subsequent agent's system prompt
- Generated: Once, by Calibrator at pipeline start
- Fields: voice, constraints, bonusType, visualDirection, previousBonusTypes
- Used by: Every agent (Calibrator → all phase 2 agents)

**ResearchOutput:**
- Purpose: Shared research document consumed by all section writers
- Generated: By Researcher (parallel phase 2)
- Consumed by: OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter, GameWriter, BonusWriter, DesignAgent

**Theme:**
- Purpose: CSS variable injection on issue page `<html>` element
- Generated: By DesignAgent (parallel phase 2)
- Consumed by: Next.js issue page component
- Fields: primaryColor (hex), accentColor (hex), backgroundColor (hex), textColor (hex), fontDisplay (Google Font name), fontBody (Google Font name), visualDirection (text)

**Deliberation Event:**
- Purpose: Atomic record of something that happened during the pipeline
- Types: scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy
- Each carries: runId, agentId, eventType, payload (JSON string), timestamp
- Consumed by: Frontend deliberation layer (live subscription via Convex)

---

## Entry Points

**Sanity Studio (Andrew):**
- Location: `apps/studio/`
- Triggers: Andrew edits a draft issue or publishes (status='draft' → 'published')
- Publishes: Sanity webhook POSTs to `https://<railway-domain>/webhook/sanity-publish`
- Responsibility: Human editorial review and approval

**Pipeline HTTP Endpoint (Trigger):**
- Location: `packages/pipeline/api/main.py` (FastAPI app)
- Endpoint: `POST /run` (or `POST /dispatch/run`)
- Triggers: Scheduled job (e.g., weekly cron) or manual trigger
- Responsibility: Start pipeline, initialize run_id, issue_number, launch LangGraph

**Sanity Webhook (Publisher trigger):**
- Location: `packages/pipeline/api/webhooks.py`
- Endpoint: `POST /webhook/sanity-publish`
- Triggers: Sanity fires when `weeklyIssue.status` changes to `published`
- Responsibility: Verify signature, enqueue Publisher agent (background task)

**Frontend (Issue page):**
- Location: `apps/web/app/issue/[slug]/page.tsx`
- Fetches: Issue from Sanity via GROQ (content), runId → Convex queries for live deliberation
- Responsibility: Display magazine layout + live deliberation layer

---

## Error Handling

**Strategy:** Graceful degradation for non-blocking failures; halt and surface for blocking failures.

**Patterns:**

**LangGraph pause (blocking):**
- If Editor Gate 1 cannot select a winner with confidence, LangGraph enters a pause state
- Convex `pipelineRuns` status set to `awaiting-review` (really: awaiting-editor-decision)
- Frontend deliberation layer shows incomplete state; Andrew sees in Sanity that run is stalled
- Andrew can manually intervene in Sanity to force a selection or restart

**Agent failures (blocking):**
- If an agent node raises an exception, LangGraph propagates it
- Catches at top level, updates Convex `pipelineRuns` status to `failed`, logs error message
- Pipeline halts; Andrew notified; run is orphaned

**Convex write failures (non-blocking):**
- If a mutation to Convex fails (e.g., network timeout), log the error but continue
- Deliberation layer may be incomplete, but content pipeline continues
- Sanity write succeeds (content is what matters)

**Sanity write failures (blocking):**
- If `write_issue_draft` fails (malformed Portable Text, schema mismatch, etc.), halt pipeline
- Wraps in try/except, updates Convex status to `failed`, surfaces error to logs

**Stripe webhook (non-blocking):**
- Always returns `200 OK` to Stripe, even on internal processing failures
- Logs failures for manual review
- Stripe retries aggressively if we return `4xx` or `5xx`

**PDF generation failures (blocking but recoverable):**
- If WeasyPrint fails, Publisher agent retries once
- If still fails, logs error, updates Convex `pipelineRuns` to `failed`
- Issue published without PDF (manual fallback: Andrew can re-trigger Publisher)

---

## Cross-Cutting Concerns

**Logging:**
- Pipeline: Python `logging` module with structured logs to stdout (Railway captures)
- Frontend: Browser console + optional Sentry integration
- Approach: All agent decisions logged; all Convex/Sanity writes logged with timing

**Validation:**
- LangGraph state validated at each transition (pydantic TypedDict for `DispatchState`)
- Sanity writes validated against schema (schema.ts defines required fields, types, validation rules)
- GROQ queries typed in TypeScript (API_CONTRACTS.md section 1 defines return shapes)
- Convex mutations accept Convex value validators (`v.string()`, `v.number()`, etc.)

**Authentication:**
- Sanity: `SANITY_API_TOKEN` (pipeline write access)
- Convex: `CONVEX_DEPLOY_KEY` (pipeline mutation calls)
- OpenRouter: `OPENROUTER_API_KEY`
- Stripe: `STRIPE_SECRET_KEY` (webhook handler verifies signature)
- Sanity webhook: `SANITY_WEBHOOK_SECRET` (HMAC verification)

**Rate limiting:**
- OpenRouter: Handled by OpenRouter's own limits (observes usage via API key)
- Tavily/Brave: Rate limiting built into SDKs
- Sanity: CDN reads cached; writes hit API (no aggressive batching)
- Convex: HTTP API has built-in rate limits (Railway cluster size matters)

**Concurrency:**
- LangGraph parallelism: In phase 2, all section agents execute concurrently via `graph.add_conditional_edges` and `asyncio.gather()`
- Supabase: Python async client
- Convex: HTTP client (httpx AsyncClient for concurrent mutations)
- Frontend: React `useQuery` hooks auto-subscribe and handle loading/stale states

**Caching:**
- Sanity CDN: Reads use `useCDN: true` (query cache transparent to app)
- Convex: Subscriptions are real-time (no caching — always fresh)
- Next.js: ISR (incremental static regeneration) on issue pages after Vercel deploy
- Frontend component caching: Agent profiles cached in React state after first GROQ query

---

## System Boundaries (See docs/API_CONTRACTS.md)

1. **Next.js → Sanity (GROQ):** Section 1, queries for latest issue, full issue, archive, charities, agent profiles
2. **Pipeline → Sanity (Python writes):** Section 2, write charity, write issue draft, upload PDF, patch firstFeaturedIn
3. **Pipeline → Convex (mutations):** Section 3, pipelineRuns CRUD, deliberation events, votes, corrections
4. **Next.js → Convex (TypeScript hooks):** Section 4, byRunId queries for deliberation
5. **Sanity → Pipeline (webhook):** Section 5, Andrew publishes → Publisher triggered
6. **Stripe:** Section 6, checkout session, webhook
7. **LangGraph state:** Section 7, DispatchState contract between agents

