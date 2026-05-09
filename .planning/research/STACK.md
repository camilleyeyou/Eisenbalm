# Stack Research

**Domain:** Weekly AI-generated editorial website with multi-agent pipeline, headless CMS, real-time subscriptions, and e-commerce
**Researched:** 2026-05-09
**Confidence:** HIGH (all versions verified against npm registry and PyPI; library choices verified against official docs and current community patterns)

> NOTE: The stack is **locked by the build brief**. This document does NOT recommend alternatives to locked technologies. It specifies exact versions, companion libraries within each locked layer, sharp edges to avoid, and 2026 best practices for each locked tool.

---

## Core Technologies (Locked — Do Not Substitute)

### Frontend Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| Next.js | **15.x** (latest stable: `15.3.9`) | App Router frontend, API routes, Stripe webhook handler | `apps/web/` |
| React | `19.2.6` | UI framework (required by Next.js 15+) | `apps/web/` |
| TypeScript | `6.0.3` | Type safety across all TS packages | all TS packages |
| Tailwind CSS | `4.3.0` | Utility-first styling | `apps/web/` |

**Version decision on Next.js:** Pin to **Next.js 15** (`15.x`), NOT 16. Next.js 16 is current latest (`16.2.6`) but `next-sanity` v11 (the current stable Sanity integration) has a documented 4–10x request overage bug with `<SanityLive>` on Next.js 16. Sanity recommends staying on Next.js 15 until `next-sanity` v12 ships. The `next-14` dist-tag (`14.2.35`) is fully supported but misses stable Turbopack; Next.js 15 is the sweet spot. Source: [Sanity docs on Next.js 16 compatibility](https://www.sanity.io/docs/help/nextjs-16-sanitylive-status).

---

### CMS Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| sanity (Studio) | **5.24.0** | Sanity Studio v5 — Andrew's editorial interface | `apps/studio/` |
| @sanity/client | **7.22.0** | TypeScript GROQ queries from Next.js | `apps/web/lib/sanity/` |

**Version note on Sanity:** The brief specifies "Sanity v3" but the ecosystem has since shipped v4 and v5. The `latest` npm tag is `5.24.0`. Schema API is backward-compatible: `defineType`, `defineField`, `defineArrayMember` from `'sanity'` are unchanged. No breaking changes to Studio schema authoring between v3 and v5 — v4 added Node 20 as minimum, v5 added React 19 requirement. The existing schemas in `/schemas/*.ts` are fully compatible with v5. Use v5 for React 19 support and the integrated TypeGen GA feature.

---

### Pipeline Backend Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| FastAPI | **0.136.1** | HTTP server, webhook handler, pipeline trigger endpoint | `packages/pipeline/` |
| uvicorn[standard] | **0.46.0** | ASGI server for FastAPI | `packages/pipeline/` |
| LangGraph | **1.1.10** | 9-agent workflow orchestration with StateGraph | `packages/pipeline/` |
| pydantic | **2.13.4** | Data validation for API payloads and agent outputs | `packages/pipeline/` |
| httpx | **0.28.1** | Async HTTP client (Convex mutations, Vercel deploy hook) | `packages/pipeline/` |
| Python | **3.11+** | Runtime (3.11 recommended for Railway; 3.9 is LangGraph minimum) | Railway |

---

### AI Routing Layer

| Technology | Version / approach | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| OpenRouter | HTTP API | Routes all 9 agent LLM calls to Claude and other models | `packages/pipeline/lib/openrouter_client.py` |
| langchain-openai | **1.2.1** | `ChatOpenAI` pointed at OpenRouter base URL — the standard LangGraph integration pattern | `packages/pipeline/` |
| langsmith | **0.8.3** | Tracing, observability, run replay for all 9 agents | `packages/pipeline/` |

**OpenRouter integration pattern:** OpenRouter exposes an OpenAI-compatible API. Do NOT use a standalone `openrouter` SDK. Use `langchain-openai`'s `ChatOpenAI` with `base_url="https://openrouter.ai/api/v1"` and `api_key=OPENROUTER_API_KEY`. This is the officially documented LangChain integration pattern and is compatible with LangGraph's node system. Source: [OpenRouter LangChain docs](https://openrouter.ai/docs/guides/community/langchain).

---

### Real-time Data Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| convex | **1.38.0** | Real-time subscriptions for deliberation layer; pipeline status | `convex/` + `apps/web/` |

Convex is used via two interfaces:
- **TypeScript queries/mutations** in `convex/*.ts` — auto-generates types from schema
- **HTTP API** from Python pipeline — `POST /api/mutation` with `Authorization: Convex {DEPLOY_KEY}`

No auth configuration needed for this project. The site has no logged-in readers; Convex queries are public reads. The pipeline uses the deploy key (server-to-server), not user identity.

---

### Pipeline Database Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| supabase (Python SDK) | **2.30.0** | Optional persistent store for pipeline run history | `packages/pipeline/lib/supabase_client.py` |

**Scope:** The brief lists Supabase as a pipeline database but does not specify what schema or data is stored there. Primary state lives in the LangGraph `DispatchState` TypedDict and is written to Sanity/Convex on completion. Supabase is available for long-term run archiving or audit logging if needed. No Supabase schema is defined yet — treat as optional until a clear use case emerges in the pipeline build phase.

---

### Commerce Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| stripe | **22.1.1** | Checkout session creation, webhook event construction | `apps/web/app/api/checkout/` + `apps/web/app/api/webhooks/stripe/` |

Stripe is used in two API routes defined in `docs/API_CONTRACTS.md`:
- `POST /api/checkout` — creates a `checkout.sessions` and returns redirect URL
- `POST /api/webhooks/stripe` — verifies `stripe-signature` header, handles `checkout.session.completed`

No Stripe SDK is used client-side. The client redirects to `session.url`. `stripe.webhooks.constructEvent()` handles all HMAC verification — no separate webhook validation library needed.

---

### PDF Generation Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| WeasyPrint | **68.1** | Render Problem Statement HTML template → PDF | `packages/pipeline/agents/publisher.py` |

**Railway deployment warning (HIGH priority):** WeasyPrint requires system libraries (`libgobject-2.0-0`, `libcairo2`, `libpango-1.0-0`, `libgdk-pixbuf2.0-0`) that are NOT present in Railway's default Python environment. There are multiple open Railway issues about this. Use a Dockerfile for the pipeline service rather than Railway's Nixpacks auto-detect. The Dockerfile must install these system deps via `apt-get` before `pip install weasyprint`. Source: [WeasyPrint Railway issue #2461](https://github.com/Kozea/WeasyPrint/issues/2461) and [Railway station thread](https://station.railway.com/questions/cant-install-weasyprint-dependencies-d742101d).

Required Dockerfile system packages:
```
libpango1.0-0 libpangoft2-1.0-0 libharfbuzz0b libcairo2 libgdk-pixbuf2.0-0
libffi-dev libgobject-2.0-0 libjpeg62-turbo-dev libpangocairo-1.0-0
```

---

### Web Search Layer

| Technology | Version (verified) | Purpose | Monorepo location |
|------------|-------------------|---------|-------------------|
| tavily-python | **0.7.24** | Scout and Researcher agent web search (charity discovery + deep dives) | `packages/pipeline/lib/search_client.py` |
| langchain-tavily | **0.2.18** | LangChain tool wrapper for Tavily (for LangGraph tool nodes) | `packages/pipeline/` |

**Decision: Tavily over Brave.** The brief says "Tavily or Brave" but Tavily is the clear choice for this use case:
- `langchain-tavily` provides a first-class LangGraph tool integration (`TavilySearch`, `TavilyResearch`)
- Tavily has a dedicated charity/nonprofit domain filter and structured result objects
- `langchain-tavily 0.2.18` requires Python ≥ 3.10 — use Python 3.11 on Railway
- Brave Search would require custom LangChain tool wrapping and returns raw HTML

---

## Supporting Libraries

### TypeScript / Next.js Frontend

| Library | Version (verified) | Purpose | Use in this project |
|---------|-------------------|---------|-------------------|
| next-sanity | **12.4.5** | Sanity integration for Next.js App Router (sanityFetch, defineLive) | `apps/web/lib/sanity/` |
| @sanity/client | `7.22.0` | GROQ query client with CDN support | `apps/web/lib/sanity/client.ts` |
| @portabletext/react | **6.2.0** | Render Sanity Portable Text blocks in React | Issue page section bodies |
| @sanity/image-url | **2.1.1** | Build image URLs from Sanity asset references | Charity and issue images |
| zod | **4.4.3** | Runtime validation for API route payloads (checkout, webhooks) | `apps/web/app/api/` |

**next-sanity version note:** `next-sanity` is currently at `12.4.5`. Do NOT use the `@cache-components` pre-release tag — that is the in-progress v12 experimental build for Next.js 16 compatibility. With Next.js 15, `next-sanity` v11/v12 stable both work correctly.

### Sanity Studio

| Library | Version (verified) | Purpose | Use in this project |
|---------|-------------------|---------|-------------------|
| sanity (Studio) | `5.24.0` | Core Studio runtime, schema types, defineConfig | `apps/studio/sanity.config.ts` |
| @sanity/vision | `5.24.0` | GROQ query playground in Studio (dev tool for Andrew) | `apps/studio/` (dev only) |

**TypeGen (built into Sanity v5):** Enable in `sanity.cli.ts` to auto-generate TypeScript types from schemas. This produces `sanity.types.ts` importable in `apps/web/`. No third-party type generator (like `groq-builder`) is needed — Sanity TypeGen GA (v5.10+) handles GROQ query types via `defineQuery()`.

### Python / FastAPI Pipeline

| Library | Version (verified) | Purpose | Use in this project |
|---------|-------------------|---------|-------------------|
| langsmith | `0.8.3` | LangGraph tracing and observability | Set `LANGSMITH_API_KEY` env var; LangGraph auto-traces |
| langgraph-checkpoint-postgres | **3.0.5** | Postgres-backed checkpointer for LangGraph human-in-the-loop | Editor gate 1 pause/resume |
| python-slugify | **8.0.4** | Deterministic slug generation for Sanity document IDs | `write_charity()`, `write_issue_draft()` |
| python-multipart | latest | FastAPI file upload support (PDF upload to Sanity) | `packages/pipeline/api/` |
| psycopg[binary] | `3.x` | Postgres driver for `langgraph-checkpoint-postgres` | Supabase connection |

**LangGraph checkpoint note:** The brief requires the Editor gate 1 to pause the pipeline if no winner is selectable and surface the pause to Andrew via Convex. This is implemented using `interrupt()` from LangGraph 1.x with a Postgres checkpointer backed by Supabase. `MemorySaver` is development-only — it loses state on Railway restart. Use `langgraph-checkpoint-postgres 3.0.5` with Supabase's connection string.

### Development Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| uv | Python package manager for Railway and local dev | `uv init --python 3.11` in `packages/pipeline/` |
| Sanity CLI | Schema deploy, TypeGen, Studio dev server | `npx sanity@latest` or install globally |
| Convex CLI | Schema deploy, function codegen | `npx convex@latest dev` |
| TypeScript compiler | Type checking across `apps/web/` and `packages/shared/` | `tsconfig.json` at monorepo root with path aliases |

---

## Installation

### `apps/web/` (Next.js frontend)

```bash
npm install next@^15.3.9 react@^19.2.6 react-dom@^19.2.6
npm install @sanity/client@^7.22.0 next-sanity@^12.4.5
npm install @portabletext/react@^6.2.0 @sanity/image-url@^2.1.1
npm install convex@^1.38.0
npm install stripe@^22.1.1
npm install zod@^4.4.3
npm install -D typescript@^6.0.3 tailwindcss@^4.3.0 @types/node @types/react
```

### `apps/studio/` (Sanity Studio)

```bash
npm install sanity@^5.24.0 @sanity/vision@^5.24.0
```

### `packages/pipeline/` (FastAPI + LangGraph)

```bash
# Using uv (recommended for Railway)
uv init --python 3.11
uv add fastapi==0.136.1 "uvicorn[standard]==0.46.0"
uv add langgraph==1.1.10 langsmith==0.8.3
uv add langchain-openai==1.2.1 langchain-tavily==0.2.18 tavily-python==0.7.24
uv add langgraph-checkpoint-postgres==3.0.5 "psycopg[binary]>=3.1"
uv add supabase==2.30.0
uv add httpx==0.28.1 pydantic==2.13.4
uv add weasyprint==68.1
uv add python-slugify==8.0.4 python-multipart
```

---

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `next@^15.3.9` | `next-sanity@^12.4.5` | Stable. Do NOT use next@16 — SanityLive overage bug |
| `next@^15.3.9` | `react@^19.2.6` | React 19 is required for Next.js 15+ |
| `sanity@^5.24.0` | `react@^19.2.6` | Sanity v5 requires React 19 |
| `langgraph@1.1.10` | `langchain-openai@1.2.1` | LangGraph 1.x works with langchain-openai 1.x |
| `langgraph@1.1.10` | `langgraph-checkpoint-postgres@3.0.5` | Major versions must align; 1.x → 3.x is correct pairing |
| `langchain-tavily@0.2.18` | Python `>=3.10` | Use Python 3.11 on Railway |
| `weasyprint@68.1` | Python `>=3.9` | Requires system libs on Railway (use Dockerfile) |
| `stripe@22.1.1` | Next.js App Router Route Handlers | Use `await request.text()` (not `.json()`) for webhook body |

---

## Monorepo Layout — Library Assignments

```
eisenbalm/
├── apps/
│   ├── web/                    # next, react, @sanity/client, next-sanity,
│   │   │                       # @portabletext/react, convex, stripe, zod,
│   │   │                       # tailwindcss
│   │   ├── lib/sanity/         # @sanity/client, next-sanity (sanityFetch)
│   │   ├── app/api/checkout/   # stripe
│   │   └── app/api/webhooks/   # stripe (constructEvent)
│   └── studio/                 # sanity, @sanity/vision
├── packages/
│   ├── pipeline/               # fastapi, uvicorn, langgraph, langchain-openai,
│   │   │                       # langsmith, langchain-tavily, tavily-python,
│   │   │                       # langgraph-checkpoint-postgres, supabase,
│   │   │                       # httpx, pydantic, weasyprint, python-slugify
│   │   ├── lib/                # sanity_client.py, convex_client.py,
│   │   │                       # openrouter_client.py, search_client.py,
│   │   │                       # supabase_client.py, portable_text.py
│   │   └── agents/             # calibrator.py, scout.py, advocate.py,
│   │                           # editor.py, researcher.py, origin_story.py,
│   │                           # problem.py, founder_bio.py, case_study.py,
│   │                           # game.py, bonus.py, design.py, qa.py,
│   │                           # publisher.py
│   └── shared/                 # TypeScript shared types (DispatchState mirror,
│                               # issue types used by both web and studio)
├── convex/                     # convex schema + query/mutation functions
│   │                           # (auto-generated types via `npx convex dev`)
│   ├── schema.ts               # already present and complete
│   ├── pipelineRuns.ts         # to be created
│   ├── pitchLog.ts             # to be created
│   ├── deliberationEvents.ts   # to be created
│   ├── agentVotes.ts           # to be created
│   └── qaCorrections.ts        # to be created
└── schemas/                    # Sanity schemas (already complete)
    ├── charity.ts
    ├── weeklyIssue.ts
    ├── agentProfile.ts
    └── index.ts
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next@^16` | `next-sanity` SanityLive causes 4–10x Vercel/Sanity request overage. Active bug as of May 2026. | `next@^15.3.9` |
| `sanity@^3.x` or `^4.x` | Outdated dist-tags. v5 is stable, required for React 19, and enables TypeGen GA. | `sanity@^5.24.0` |
| `MemorySaver` (LangGraph) | In-process memory only — state is lost on Railway restart or deploy. Editor gate 1 pause would not survive. | `langgraph-checkpoint-postgres` with Supabase |
| Brave Search SDK | No first-class LangChain tool integration. Requires custom wrapping. | `langchain-tavily` + `tavily-python` |
| Vercel AI SDK (`ai` package) | Brief explicitly locks the stack. Also architecturally wrong: pipeline is Python/FastAPI, not Next.js server-side. | `langchain-openai` + OpenRouter on the pipeline side |
| `sanity` Python package on PyPI | Version `0.2.5` — unmaintained stub. Incompatible with Sanity v3+. | Use `@sanity/client` HTTP API directly or the documented REST API patterns in `API_CONTRACTS.md` section 2 |
| `groq-builder` or `sanity-typed` | Third-party type generators now superseded by Sanity TypeGen (built into v5). Extra dep with stale maintenance. | `sanity typegen generate` (built-in CLI) |
| `shopify`, `Commerce.js` | Brief explicitly forbids. One product, custom Stripe only. | `stripe@22.1.1` |
| Playwright for PDF generation | WeasyPrint is specified in the brief. Playwright would add ~600MB to the Railway container. | `weasyprint@68.1` (with Dockerfile system deps) |

---

## Sharp Edges for 2026

### 1. Sanity Python Client — No Maintained Official SDK
**Severity: HIGH.** The `sanity` package on PyPI (`0.2.5`) is an unmaintained stub. The brief's `API_CONTRACTS.md` already accounts for this: section 2 uses direct REST calls against the Sanity Content API (`https://<projectId>.api.sanity.io/v2024-01-01/data/mutate/<dataset>`). The Python integration must use `httpx` with a `SANITY_API_TOKEN` header — NOT a Python SDK. The patterns in `API_CONTRACTS.md §2` are correct and complete.

### 2. Next.js 15 vs 16 — Hold at 15 Until next-sanity v12 Ships
**Severity: HIGH.** As of May 2026, Sanity officially recommends NOT upgrading to Next.js 16 if using `<SanityLive>` or `defineLive`. The `next-sanity@cache-components` tag is experimental. Watch the [next-sanity GitHub releases](https://github.com/sanity-io/next-sanity/releases) for the public v12 announcement before upgrading Next.js.

### 3. LangGraph Interrupt() Rules — Not Negotiable
**Severity: HIGH.** Editor gate 1 uses `interrupt()` to pause the graph. LangGraph 1.x `interrupt()` has strict rules that will silently break if violated:
- Do NOT wrap `interrupt()` calls in `try/except`
- All code BEFORE an `interrupt()` must be idempotent (the node reruns from scratch on resume)
- Only pass JSON-serializable values to `interrupt()`
- A Postgres-backed checkpointer is REQUIRED — `MemorySaver` loses state on Railway restart

### 4. WeasyPrint on Railway — Requires Dockerfile
**Severity: HIGH.** Railway's auto-detected Nixpacks environment does NOT include the system libraries WeasyPrint requires. Deploying without a custom Dockerfile causes an `OSError: cannot load library 'libgobject-2.0-0'` at runtime. The pipeline service must use a Dockerfile with explicit `apt-get install` for the required system packages.

### 5. Stripe Webhook — Raw Body Required
**Severity: MEDIUM.** `stripe.webhooks.constructEvent()` requires the raw request body as bytes/string. Next.js App Router Route Handlers must use `await request.text()` — NOT `await request.json()`. Calling `.json()` first will cause signature verification to fail.

### 6. Convex Deliberation Queries — No Auth Layer
**Severity: LOW.** The site has no reader authentication (explicitly out of scope per brief). All Convex queries serving the deliberation layer are public reads. The pipeline writes using the `CONVEX_DEPLOY_KEY` in the HTTP API header. This is the correct architecture for this project — do not add Convex Auth unless the brief changes.

### 7. Sanity TypeGen — Enable from Day One
**Severity: MEDIUM.** TypeGen produces TypeScript types from schemas AND GROQ queries. Enable it in `apps/studio/sanity.cli.ts` when the Studio is first configured. Retrofitting types after queries are written is significantly harder. The generated `sanity.types.ts` should be imported in `apps/web/types/issue.ts` to satisfy the `API_CONTRACTS.md` type definitions.

---

## 2026 Best Practices Per Layer

### Next.js App Router
- Use Server Components for all Sanity GROQ reads (no client-side fetching for editorial content)
- Use `sanityFetch` from `next-sanity` for automatic cache/revalidation — it switches between CDN and draft mode automatically
- Define `generateStaticParams()` on `/issue/[slug]` and `/charities/[slug]` for static generation
- Use Route Handlers (not `pages/api/`) for `/api/checkout` and `/api/webhooks/stripe`
- CSS variables for theme injection: set on `<html>` element in the issue layout, not in a `<style>` tag inside body

### Sanity Studio v5
- Use `defineType`, `defineField`, `defineArrayMember` imports from `'sanity'` — they enable IDE autocomplete and TypeGen inference
- Enable TypeGen in `sanity.cli.ts`: `{ schemaExtraction: { enabled: true }, typegen: { enabled: true } }`
- Do NOT construct Portable Text manually in the pipeline — use the `text_to_portable_text()` helper from `API_CONTRACTS.md §2.4`
- Use deterministic `_id` values (`charity-{slug}`, `issue-{number}`) to make pipeline writes idempotent

### LangGraph 1.x
- Define one `StateGraph` with `DispatchState` TypedDict as the state type
- Phase 2 parallel section writers (OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design) run as `Send()` fan-out from a single dispatch node, not as branching conditions
- Use `interrupt()` (not `breakpoint` / `NodeInterrupt`) for Editor gate 1 — `interrupt()` is the current LangGraph 1.x API
- Set `LANGSMITH_API_KEY` in Railway env vars for automatic LangGraph tracing — no code changes needed
- Pin `OPENROUTER_API_KEY` to the Railway service, not to individual agents; instantiate the LLM client once per graph invocation

### Convex
- Query functions that serve the deliberation layer are public (no `ctx.auth` check needed)
- The pipeline uses the HTTP API (`POST /api/mutation`) with `Authorization: Convex {DEPLOY_KEY}` — not the TypeScript SDK
- Convex auto-generates `convex/_generated/api.ts` on `npx convex dev` — never hand-edit this file
- All mutation calls from the pipeline are non-blocking for the pipeline (fire-and-forget with error logging per `API_CONTRACTS.md` error handling rules)

### FastAPI on Railway
- Use `BackgroundTasks` (built into FastAPI) for the Sanity publish webhook — return 200 immediately, run Publisher agent async
- Use `uv` as the package manager; Railway supports `pyproject.toml` with uv lock
- HMAC verification for the Sanity webhook uses `hmac.compare_digest()` — already specified in `API_CONTRACTS.md §5.3`
- Expose a `/health` endpoint for Railway health checks

### Stripe
- Use `stripe.checkout.sessions.create()` with `mode: 'payment'` and a pre-created Stripe Price ID
- Always use `stripe.webhooks.constructEvent(body, signature, secret)` — never manually parse `stripe-signature`
- Return `200` from the webhook handler even on processing failure (Stripe retries aggressively on 4xx/5xx)
- `STRIPE_PRICE_ID` is a required env var — create the product and price in the Stripe dashboard before the Stripe phase

---

## Sources

- npm registry (`npm view <package> version`) — all version numbers verified 2026-05-09
- PyPI (`pip index versions <package>`) — all Python version numbers verified 2026-05-09
- [Sanity docs: Next.js 16 and SanityLive](https://www.sanity.io/docs/help/nextjs-16-sanitylive-status) — Next.js 15 hold recommendation (HIGH confidence)
- [Sanity blog: Studio v5 and React 19](https://www.sanity.io/blog/sanity-studio-v5) — v5 compatibility notes (HIGH confidence)
- [Sanity TypeGen GA](https://www.sanity.io/blog/sanity-typegen-ga) — TypeGen built-in to v5.10+ (HIGH confidence)
- [LangGraph interrupts docs](https://docs.langchain.com/oss/python/langgraph/interrupts) — interrupt() rules (HIGH confidence)
- [OpenRouter LangChain integration](https://openrouter.ai/docs/guides/community/langchain) — ChatOpenAI pattern (HIGH confidence)
- [WeasyPrint Railway issue #2461](https://github.com/Kozea/WeasyPrint/issues/2461) — system deps requirement (HIGH confidence)
- [Railway WeasyPrint help station](https://station.railway.com/questions/cant-install-weasyprint-dependencies-d742101d) — Nixpacks vs Dockerfile (HIGH confidence)
- [LangSmith observability docs](https://docs.langchain.com/langsmith/observability) — LANGSMITH_API_KEY pattern (HIGH confidence)
- [Convex auth docs](https://docs.convex.dev/auth) — no-auth public reads pattern (HIGH confidence)
- `docs/API_CONTRACTS.md` — constrains all library choices at every boundary (authoritative)

---
*Stack research for: The Eisenbalm Dispatch — AI editorial website*
*Researched: 2026-05-09*
