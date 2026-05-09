# External Integrations

**Analysis Date:** 2026-05-09

## Overview

The Eisenbalm Dispatch integrates with **10+ external services** across the pipeline, CMS, frontend, and commerce layers. All integration boundaries are **documented in `docs/API_CONTRACTS.md`** with exact payload shapes, client instantiation, and error handling rules.

This document maps each integration to its contract definition, specifies which boundaries are **documented vs. unimplemented**, and provides file paths for implementation.

---

## APIs & External Services

### OpenRouter (AI Model Routing)

**Purpose:** Route all agent LLM calls through OpenRouter to access Claude and other models

**What it's used for:**
- All 9 agents use Claude via OpenRouter
- Agents: Calibrator, Scout, Advocate, Editor (x2), Researcher, 7 content writers, QA, Publisher

**SDK/Client:**
- Python: direct HTTP requests or `openrouter` SDK (TBD)
- Planned location: `packages/pipeline/lib/openrouter_client.py`

**Auth:**
- Environment variable: `OPENROUTER_API_KEY`
- Passed in request headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`

**Implementation status:**
- Contract: Not specified in API_CONTRACTS.md (agent contracts are in brief)
- Implementation: **Not started**
- Notes: Brief specifies model selection per agent, no alternate routing documented

**Integration points:**
- Called by: each of 9 agents via LangGraph nodes
- Expected to return: structured outputs (text, JSON per agent task)

---

### Tavily or Brave Search (Web Search)

**Purpose:** Enable Scout and Researcher agents to search for charity information and facts

**What it's used for:**
- Scout: searches Charity Navigator, GuideStar, general web for candidate charities (§ Phase 1, Scout agent)
- Researcher: deep dives winning charity for founding story, founder background, case studies

**SDK/Client:**
- Python: `tavily-python` or `brave-search` SDK (one chosen)
- Planned location: `packages/pipeline/lib/search_client.py`

**Auth:**
- Environment variable: `TAVILY_API_KEY` or `BRAVE_API_KEY`
- Passed per SDK requirements

**Implementation status:**
- Contract: Not specified in API_CONTRACTS.md
- Implementation: **Not started**
- Notes: Choice between Tavily and Brave not yet locked (brief says "Tavily or Brave")

**Integration points:**
- Called by: Scout (Phase 1) and Researcher (Phase 2) agents
- Expected to return: search results, URLs, summaries

---

### Suno (Audio Generation for Jingles)

**Purpose:** Generate audio for jingle bonus type

**What it's used for:**
- BonusWriter agent (when bonusType == 'jingle')
- Creates audio from lyrics and style prompt

**SDK/Client:**
- Suno API (TBD — check if public API exists)
- Planned location: `packages/pipeline/lib/suno_client.py`

**Auth:**
- Status: **Not decided** — brief indicates Andrew performs this manually until API is wired
- Would need: Suno API token or session

**Implementation status:**
- Contract: Not specified in API_CONTRACTS.md
- Implementation: **Not started — currently manual**
- Workaround: `bonus.sunoPrompt` field populated by agent, Andrew runs Suno manually and pastes result into `bonus.sunoAudioUrl`
- File path: `schemas/weeklyIssue.ts` lines 219-237 (bonus section with Suno fields)

**Integration points:**
- Called by: BonusWriter agent (optional, blocked until API wired)
- Expected to return: audio URL or file

---

## Data Storage

### Sanity CMS (Content Storage)

**Purpose:** Store all editorial content (charity info, issue sections, metadata)

**What it's used for:**
- Charity documents (created by Scout, updated by pipeline)
- Weekly issue drafts (created by pipeline, edited/published by Andrew)
- Agent profiles (seeded once, display-only)

**Client:**
- **Frontend:** `@sanity/client` (TypeScript, GROQ reads)
  - Planned location: `apps/web/lib/sanity/client.ts`
- **Pipeline:** Python Sanity client (`sanity`)
  - Planned location: `packages/pipeline/lib/sanity_client.py`

**Authentication:**
- Frontend reads: Public (CDN reads via `@sanity/client` with `useCDN: true`)
- Pipeline writes: Private token
  - Environment variable: `SANITY_API_TOKEN`
  - Passed to client: token parameter

**Endpoints & Contracts:**

**1. GROQ Queries (Frontend reads)** — documented in API_CONTRACTS.md § 1

| Query | Purpose | Location |
|-------|---------|----------|
| `QUERY_LATEST_ISSUE_SLUG` | Get newest published issue for homepage redirect | `apps/web/lib/sanity/queries.ts` |
| `QUERY_ISSUE_BY_SLUG` | Get full issue data by slug (includes theme, sections, podcast, deliberation) | `apps/web/lib/sanity/queries.ts` |
| `QUERY_ARCHIVE` | List all published issues (paginated) | `apps/web/lib/sanity/queries.ts` |
| `QUERY_ALL_CHARITIES` | Get charity database (sorted by name) | `apps/web/lib/sanity/queries.ts` |
| `QUERY_CHARITY_BY_SLUG` | Get single charity detail page | `apps/web/lib/sanity/queries.ts` |
| `QUERY_AGENT_PROFILES` | Get all agent profiles for deliberation layer | `apps/web/lib/sanity/queries.ts` |
| `QUERY_ISSUE_RUN_ID` | Get runId for Convex deliberation queries | `apps/web/lib/sanity/queries.ts` |

**Implementation status:** All query shapes fully documented in API_CONTRACTS.md § 1.1–1.7. Code not implemented.

**2. Python Writes (Pipeline writes)** — documented in API_CONTRACTS.md § 2

| Operation | Agent | Location |
|-----------|-------|----------|
| `write_charity()` | Scout (per candidate), Pipeline (final) | `packages/pipeline/lib/sanity_client.py` |
| `write_issue_draft()` | Pipeline (after QA/Editor final) | `packages/pipeline/lib/sanity_client.py` |
| `upload_pdf_to_issue()` | Publisher agent | `packages/pipeline/lib/sanity_client.py` |
| `set_charity_first_featured()` | Publisher agent | `packages/pipeline/lib/sanity_client.py` |
| `text_to_portable_text()` | All writers (helper) | `packages/pipeline/lib/portable_text.py` |

**Critical notes:**
- All body text must use `text_to_portable_text()` helper (converts plain text to Sanity Portable Text blocks)
- Charity writes use deterministic `_id` based on slug: `charity-${slugify(name)}`
- Issue writes use deterministic `_id`: `issue-${issue_number}`
- Portable Text helper at API_CONTRACTS.md § 2.4 (lines 432-470)

**Implementation status:** All payload shapes, field mappings, and error handling fully documented in API_CONTRACTS.md § 2.1–2.5. Code not implemented.

**Environment variables:**
- `NEXT_PUBLIC_SANITY_PROJECT_ID` — project ID
- `NEXT_PUBLIC_SANITY_DATASET` — always "production"
- `SANITY_API_TOKEN` — write-only token (pipeline)

---

### Convex (Realtime Frontend Data)

**Purpose:** Stream deliberation events, votes, and corrections to frontend in real-time

**What it's used for:**
- Live agent deliberation during pipeline run (badges, event timeline)
- Pitch log (Scout's candidates as found)
- Agent votes (Advocate voting breakdown)
- QA corrections (what was fixed and why)
- Pipeline run status (running/awaiting-review/complete/failed)

**Client:**
- **Frontend:** `convex/react` hooks (`useQuery`, `useMutation`)
  - Planned location: `apps/web/components/DeliberationLayer.tsx`
- **Pipeline:** Convex HTTP API (Python)
  - Planned location: `packages/pipeline/lib/convex_client.py`

**Authentication:**
- Frontend: Automatic via `ConvexProvider` in layout
- Pipeline: HTTP API with `Authorization: Convex ${CONVEX_DEPLOY_KEY}` header

**Schema & Tables** — documented in `convex/schema.ts`

| Table | Purpose | Indexes | Write sources |
|-------|---------|---------|---|
| `pipelineRuns` | One row per weekly run (status tracking) | `by_runId`, `by_issueNumber` | Pipeline (create, update status) |
| `deliberationEvents` | All agent events (scout findings, advocate args, editor decisions, etc.) | `by_runId`, `by_runId_and_type` | Pipeline (9 agents emit events) |
| `agentVotes` | Explicit votes (currently Advocate only) | `by_runId`, `by_runId_and_charity` | Pipeline (Advocate votes) |
| `qaCorrections` | QA flagged issues and fixes | `by_runId`, `by_runId_and_section` | Pipeline (QA agent) |
| `pitchLog` | Scout's candidates as found (live feed) | `by_runId`, `by_runId_and_selected` | Pipeline (Scout finds, Editor marks selected) |

**Mutations** — documented in API_CONTRACTS.md § 3 (Python HTTP API)

| Mutation | Called by | Location |
|----------|-----------|----------|
| `pipelineRuns:create` | Pipeline (start) | `packages/pipeline/lib/convex_client.py` |
| `pipelineRuns:updateStatus` | Pipeline (status changes) | `packages/pipeline/lib/convex_client.py` |
| `pitchLog:insert` | Scout agent (live) | `packages/pipeline/lib/convex_client.py` |
| `pitchLog:markSelected` | Pipeline (after Editor gate 1) | `packages/pipeline/lib/convex_client.py` |
| `deliberationEvents:insert` | All 9 agents (event stream) | `packages/pipeline/lib/convex_client.py` |
| `agentVotes:insert` | Advocate agent | `packages/pipeline/lib/convex_client.py` |
| `qaCorrections:insert` | QA agent (per correction) | `packages/pipeline/lib/convex_client.py` |

**Queries** — documented in API_CONTRACTS.md § 4 (TypeScript implementations)

| Query | Args | Returns |
|-------|------|---------|
| `pipelineRuns.byRunId` | `{ runId: string }` | `PipelineRun \| null` |
| `pitchLog.byRunId` | `{ runId: string }` | `PitchLog[]` |
| `deliberationEvents.byRunId` | `{ runId: string }` | `DeliberationEvent[]` |
| `deliberationEvents.byRunIdAndType` | `{ runId, eventType }` | `DeliberationEvent[]` |
| `agentVotes.byRunId` | `{ runId: string }` | `AgentVote[]` |
| `qaCorrections.byRunId` | `{ runId: string }` | `QACorrection[]` |

**Implementation status:**
- Schema: **Present and complete** (`convex/schema.ts`)
- Query/mutation functions: **Not implemented** (need to be created in `convex/`)
- Frontend hooks: **Not implemented** (need to be wired in components)
- Python client: **Not implemented** (need HTTP API wrapper in pipeline)

**Environment variables:**
- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL (public)
- `CONVEX_DEPLOY_KEY` — API key for mutation calls (secret, for pipeline)

**HTTP API contract** — documented in API_CONTRACTS.md § 3 (lines 498-521)

```python
async def convex_mutation(path: str, args: dict) -> dict:
    """Path format: 'table:function' e.g. 'pipelineRuns:create'"""
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            f'{CONVEX_URL}/api/mutation',
            json={'path': path, 'args': args},
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Convex {CONVEX_KEY}',
            },
        )
        r.raise_for_status()
        return r.json()
```

---

## Authentication & Identity

**Auth approach:**
- Editorial access: Sanity Studio (managed by Sanity)
- Frontend users: No authentication (read-only public site)
- Pipeline: Token-based (Sanity token, Convex deploy key, OpenRouter key, etc.)
- Commerce: Stripe (passwordless checkout)

---

## Monitoring & Observability

**Error tracking:**
- Not specified in brief
- Status: **Not implemented**

**Logs:**
- Pipeline: stdout (Railway captures)
- Frontend: Browser console + optional service

---

## CI/CD & Deployment

### Vercel (Frontend hosting)

**Purpose:** Host Next.js app

**What it's used for:**
- Deploy Next.js frontend on every git push
- Serve GROQ queries to Sanity
- Handle Stripe checkout and webhooks
- Display deliberation layer

**Deployment trigger:**
- Git push (automatic)
- Deploy hook (triggered by Publisher agent)

**Deploy hook:**
- Environment variable: `VERCEL_DEPLOY_HOOK_URL`
- Called by: Publisher agent (after issue published)
- Documented in: API_CONTRACTS.md § 5.4 (lines 1083-1088)
- Implementation: HTTP POST to hook URL
- Location: `packages/pipeline/api/publishers.py` (Publisher agent)

**Implementation status:**
- Basic setup: **Planned** (create `next.config.js`, `.vercelignore`)
- Deploy hook integration: **Not implemented**

---

### Railway (Pipeline hosting)

**Purpose:** Run FastAPI backend for pipeline execution

**What it's used for:**
- Serve Sanity publish webhook
- Run pipeline orchestrator (LangGraph graph)
- Call Convex mutations
- Upload PDFs to Sanity
- Trigger Vercel deploy

**Environment variables:**
- All pipeline secrets stored here (`SANITY_API_TOKEN`, `CONVEX_DEPLOY_KEY`, etc.)
- `RAILWAY_TOKEN` for deployments

**Webhook endpoint:**
- URL: `https://<railway-domain>/webhook/sanity-publish`
- Receives: Sanity publish webhook payload
- Response: 200 immediately, runs Publisher async

**Implementation status:**
- Service setup: **Planned**
- Webhook endpoint: **Not implemented** (contract in API_CONTRACTS.md § 5)

---

## Webhooks & Callbacks

### Sanity → Pipeline (Publish event)

**Trigger:** Andrew publishes an issue in Sanity Studio (status → "published")

**Endpoint:** `POST https://<railway-domain>/webhook/sanity-publish`

**Configuration:**
- Sanity project settings → API → Webhooks
- Filter: `_type == "weeklyIssue" && status == "published"`
- Secret: `SANITY_WEBHOOK_SECRET` (verify signature with HMAC-SHA256)

**Payload shape** — documented in API_CONTRACTS.md § 5.2 (lines 1034-1041)

```typescript
type SanityPublishWebhookPayload = {
  _id: string              // e.g. "issue-12"
  _type: "weeklyIssue"
  status: "published"
  issueNumber: number
  runId: string            // from pipelineMetadata.runId
}
```

**Handler logic** — documented in API_CONTRACTS.md § 5.3 (lines 1047-1079)

1. Verify HMAC signature
2. Parse payload
3. Guard: only trigger on `status === 'published'`
4. Trigger Publisher agent async (background task)
5. Return 200 immediately (never wait for async work)

**Publisher Agent actions:**
- Generate Problem Statement PDF (WeasyPrint from `problemStatement.pdfContent`)
- Upload PDF to Sanity `weeklyIssue.problemPdf`
- Trigger Vercel deploy hook
- Update Convex `pipelineRuns` status to `'complete'`
- Write `publisher-deploy` event to Convex

**Implementation status:**
- Webhook configuration: **Documented in brief**
- Handler: **Not implemented** (`packages/pipeline/api/webhooks.py`)
- Publisher agent: **Not implemented**

**Files needed:**
- `packages/pipeline/api/webhooks.py` — webhook endpoint with HMAC verification
- `packages/pipeline/agents/publisher.py` — Publisher agent implementation

---

### Stripe → Frontend (Payment events)

**Trigger:** Payment completed or failed

**Endpoint:** `POST /api/webhooks/stripe` in Next.js

**Signature verification:**
- Use Stripe SDK to construct event: `stripe.webhooks.constructEvent(body, signature, secret)`
- Header: `stripe-signature`

**Handled events:**
- `checkout.session.completed` — log order (no fulfillment needed)
- `payment_intent.payment_failed` — log (no action)

**Implementation status:**
- Handler contract: **Documented** (API_CONTRACTS.md § 6.2, lines 1135-1170)
- Implementation: **Not started** (`apps/web/app/api/webhooks/stripe/route.ts`)

**Files needed:**
- `apps/web/app/api/webhooks/stripe/route.ts` — webhook handler
- `apps/web/app/api/checkout/route.ts` — create checkout session (contract in § 6.1)

---

## Commerce Integration

### Stripe (Payment processing)

**Purpose:** Process purchases of Jesse A. Eisenbalm lip balm

**Product:**
- Single SKU: "Jesse A. Eisenbalm Lip Balm"
- One-time payment (no subscriptions)
- Pre-created in Stripe dashboard

**Client:**
- Frontend: Redirect to Stripe Checkout
- Backend: `stripe` npm package

**Endpoints:**

**1. Create Checkout Session** — documented in API_CONTRACTS.md § 6.1 (lines 1097-1129)

Endpoint: `POST /api/checkout`

Request:
```typescript
{ quantity: number }  // optional, defaults to 1
```

Response:
```typescript
{ url: string }  // redirect to this URL
```

**2. Stripe Webhook** — documented in API_CONTRACTS.md § 6.2 (lines 1135–1170)

Endpoint: `POST /api/webhooks/stripe`

Handled events: `checkout.session.completed`, `payment_intent.payment_failed`

**Implementation status:**
- Stripe account setup: **Planned** (need price ID)
- Checkout endpoint: **Not implemented** (`apps/web/app/api/checkout/route.ts`)
- Webhook handler: **Not implemented** (`apps/web/app/api/webhooks/stripe/route.ts`)
- Product page: **Not implemented** (`apps/web/app/shop/page.tsx`)
- Thank you page: **Not implemented** (`apps/web/app/shop/thank-you/page.tsx`)

**Environment variables:**
- `STRIPE_SECRET_KEY` — secret key for server
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — public key for frontend
- `STRIPE_WEBHOOK_SECRET` — webhook signing secret
- `STRIPE_PRICE_ID` — product price ID (from Stripe dashboard)

**Configuration:**
- One product, one price
- Custom checkout (no Shopify, no Commerce.js)
- No fulfillment automation
- Order confirmation: simple page redirect

---

## Supabase (Optional Pipeline Database)

**Purpose:** Persistent database for pipeline (optional — state can live in LangGraph state dict)

**What it's used for:**
- Optional: store pipeline run history, agent outputs, search indexes
- Python SDK: `supabase-py`

**Client:**
- Planned location: `packages/pipeline/lib/supabase_client.py`

**Implementation status:**
- Status: **Planned but optional**
- Brief mentions "Supabase (Python SDK)" but primary state lives in LangGraph
- May be used for long-term storage of runs
- No schema specified yet

**Environment variables:**
- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_KEY` — service role key

---

## API Contracts Summary Table

| Boundary | Direction | Documented | Implemented | Location |
|----------|-----------|------------|-------------|----------|
| Next.js → Sanity (GROQ) | Read | ✓ § 1 | ✗ | `apps/web/lib/sanity/queries.ts` |
| Pipeline → Sanity (Python) | Write | ✓ § 2 | ✗ | `packages/pipeline/lib/sanity_client.py` |
| Pipeline → Convex (HTTP API) | Mutation | ✓ § 3 | ✗ | `packages/pipeline/lib/convex_client.py` |
| Convex → Frontend (React) | Query/Subscribe | ✓ § 4 | ✗ | `convex/` + `apps/web/` |
| Sanity → Pipeline (Webhook) | Event | ✓ § 5 | ✗ | `packages/pipeline/api/webhooks.py` |
| Stripe → Frontend (Webhook) | Event | ✓ § 6.2 | ✗ | `apps/web/app/api/webhooks/stripe/route.ts` |
| Frontend → Stripe (Checkout) | Request | ✓ § 6.1 | ✗ | `apps/web/app/api/checkout/route.ts` |
| LangGraph (inter-agent state) | Internal | ✓ § 7 | ✗ | `packages/pipeline/types.py` |

---

## Environment Configuration

All integrations require environment variables. See STACK.md § Configuration for the full list.

**Secret management:**
- Railway stores pipeline secrets (Sanity token, Convex key, etc.)
- Vercel stores frontend secrets (Sanity token, Stripe publishable key, etc.)
- Local `.env.local` for development

**API keys required:**
- `OPENROUTER_API_KEY` — AI routing
- `TAVILY_API_KEY` or `BRAVE_API_KEY` — web search
- `SANITY_API_TOKEN` — Sanity writes
- `CONVEX_DEPLOY_KEY` — Convex mutations
- `STRIPE_SECRET_KEY` + webhook secret — commerce
- `SUPABASE_SERVICE_KEY` — optional DB

---

## Known Gaps & Future Work

**Suno integration:**
- Currently manual (Andrew uses web UI)
- API integration blocked until Suno public API available
- Workaround: `bonus.sunoPrompt` field ready for Andrew

**NotebookLM integration:**
- Currently manual (Andrew uploads transcript to NotebookLM web UI)
- No API integration documented
- Future: check if NotebookLM API exists

**Observability:**
- Error tracking not specified
- Logging strategy not detailed beyond "Railway captures stdout"

**Stripe order fulfillment:**
- Single SKU, no real fulfillment needed
- Future: email confirmation, order tracking

---

*Integration audit: 2026-05-09*
