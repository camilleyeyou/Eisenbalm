# Technology Stack

**Analysis Date:** 2026-05-09

## Overview

The Eisenbalm Dispatch is a weekly AI-generated editorial website. The stack is **locked per the build brief** and combines multiple external platforms with a three-tier architecture:

- **Frontend:** Next.js 14+ on Vercel
- **CMS:** Sanity v3  
- **Pipeline:** FastAPI + LangGraph on Railway
- **Realtime data layer:** Convex
- **Commerce:** Stripe (custom)
- **AI routing:** OpenRouter
- **Pipeline database:** Supabase

This document describes the **planned stack** (most not yet wired), the **schema files present** (Sanity and Convex), and the **status of each component** (planned, designed, or implemented).

---

## Languages

**Detected:**
- **TypeScript** — present in `convex/schema.ts`, `schemas/*.ts` — used for database schemas and type contracts
- **Python** — planned for pipeline implementation (not yet present)

**By Layer:**
- **Frontend:** TypeScript/JavaScript (Next.js app router)
- **Pipeline:** Python (FastAPI + LangGraph)
- **Shared types:** TypeScript in `packages/shared/`
- **CMS schemas:** TypeScript (Sanity SDK)

---

## Runtime

**Environment:**
- **Node.js 18+** — Next.js frontend, Sanity Studio
- **Python 3.9+** — FastAPI backend on Railway
- **Browser:** Chrome/Safari/Firefox (Next.js)

**Package Manager:**
- **npm/yarn** — JavaScript dependencies (not installed yet)
- **pip** — Python dependencies (not installed yet)
- **uv** — optional, modern Python package manager (mentioned in docs)

**Lockfiles:**
- Not yet present (project in scaffolding stage)

---

## Frameworks

**Core:**
- **Next.js 14+** (App Router) — frontend hosted on Vercel
  - Status: **Planned, not wired**
  - Will live in `apps/web/`
  - Uses Vercel deploy hooks (triggered by Publisher agent)
  
- **Sanity v3** — headless CMS
  - Status: **Schema files present in `/schemas/`**
  - Schemas exist: `weeklyIssue.ts`, `charity.ts`, `agentProfile.ts` (ready to wire into Studio)
  - File paths: `schemas/charity.ts`, `schemas/weeklyIssue.ts`, `schemas/agentProfile.ts`, `schemas/index.ts`
  - Studio will live in `apps/studio/`

- **FastAPI** — pipeline backend
  - Status: **Planned, not wired**
  - Will live in `packages/pipeline/`
  - Hosted on Railway
  - Handles Sanity webhooks at `/webhook/sanity-publish`

- **LangGraph** — agentic workflow orchestration
  - Status: **Planned**
  - Coordinates 9 sequential + parallel agents
  - Manages state (see LangGraph State Contract in API_CONTRACTS.md)

**Data Layer:**
- **Convex** — realtime reactive database for frontend subscriptions
  - Status: **Schema deployed to `convex/schema.ts`**
  - File path: `convex/schema.ts`
  - Tables defined: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`
  - Mutation/query functions: **not yet implemented**

**Testing:**
- Not specified in brief
- Status: **Not started**

**Build/Dev:**
- **Vercel** — hosts Next.js frontend
  - Deploy hooks triggered by Publisher agent
  - Status: **Planned**
  
- **Railway** — hosts FastAPI backend
  - Status: **Planned**
  - Environment variables managed here

---

## Key Dependencies

**Critical (external services):**
- **OpenRouter** — AI model routing (Claude via OpenRouter for agents)
  - ENV: `OPENROUTER_API_KEY`
  - Used by: all 9 agents (Calibrator, Scout, Advocate, Editor, Researcher, section writers, QA, Publisher)
  - Status: **Planned, requires integration**

- **Supabase** — pipeline database (PostgreSQL)
  - ENV: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
  - Used by: Pipeline agents for state persistence (optional — primary state lives in LangGraph state dict)
  - Python SDK: `supabase`
  - Status: **Planned**

- **Stripe** — ecommerce (lip balm)
  - ENV: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Used by: `/shop` page and webhook handler
  - Status: **Planned**
  - One product: "Jesse A. Eisenbalm lip balm"
  - Webhook handler: `apps/web/app/api/webhooks/stripe/route.ts` (contract in API_CONTRACTS.md)

- **Tavily / Brave Search** — web search (for Scout and Researcher agents)
  - ENV: `TAVILY_API_KEY` or `BRAVE_API_KEY`
  - Used by: Scout agent (find charity candidates), Researcher agent (deep dive)
  - Status: **Planned**
  - Choice not yet locked (Tavily or Brave, one of them)

- **Suno** — audio generation (for jingle bonus type)
  - Used by: BonusWriter agent (when bonusType == 'jingle')
  - Status: **Planned, manual step for Andrew** (API integration not wired yet)
  - Field in schema: `bonus.sunoPrompt` (robot-readable), `bonus.sunoAudioUrl` (human fills in)

- **NotebookLM** — podcast generation
  - Input: `deliberationTranscript` (Scout + Advocate + Editor reasoning)
  - Output: audio file uploaded to `podcast.audioFile`
  - Status: **Planned, manual step for Andrew** (no API, NotebookLM used via web UI)

**Infrastructure:**
- **Sanity** — CMS API (reads via GROQ, writes via Python client)
  - ENV: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_TOKEN`, `NEXT_PUBLIC_SANITY_DATASET`
  - Python client: `sanity` (for pipeline writes)
  - TypeScript client: `@sanity/client` (for frontend reads)
  - Status: **Schema present, client integration planned**

- **Convex** — realtime subscriptions
  - ENV: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`
  - Used by: frontend (React hooks), pipeline (HTTP API mutations)
  - Status: **Schema present (`convex/schema.ts`), query/mutation implementations planned**

- **Vercel** — frontend hosting
  - Deploy hook: `VERCEL_DEPLOY_HOOK_URL`
  - Triggered by: Publisher agent after publishing
  - Status: **Planned**

- **Railway** — pipeline hosting
  - ENV: `RAILWAY_TOKEN` (for deployments)
  - Status: **Planned**

**Frontend libraries (planned, not installed):**
- `next` (14+)
- `react` (18+)
- `@sanity/client` (GROQ queries)
- `convex/react` (realtime hooks)
- `stripe` (checkout)
- `@portabletext/react` (render Sanity portable text)

**Pipeline libraries (planned, not installed):**
- `fastapi` — HTTP server
- `langgraph` — agentic workflow
- `anthropic` — OpenRouter client
- `supabase-py` — Supabase client
- `sanity-python` — Sanity write client
- `tavily-python` or `brave-search` — web search
- `weasyprint` or `playwright` — PDF generation (for Problem Statement)
- `httpx` — async HTTP (for Convex mutations, Vercel webhooks)

---

## Configuration

**Environment variables required (from brief section § "Environment variables required"):**

```bash
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=            # write access for pipeline

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=

# OpenRouter
OPENROUTER_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Vercel
VERCEL_DEPLOY_HOOK_URL=      # triggered by Publisher agent

# Railway (pipeline)
RAILWAY_TOKEN=

# Search (for Scout and Researcher agents)
TAVILY_API_KEY=              # or BRAVE_API_KEY

# Sanity webhook (pipeline)
SANITY_WEBHOOK_SECRET=
```

**Build configuration files:**
- `next.config.js` — not yet created
- `tsconfig.json` — not yet created
- `pyproject.toml` or `requirements.txt` — not yet created (FastAPI)
- `sanity.config.ts` — not yet created (needs to import schemas from `schemas/index.ts`)
- `.env.local` — not yet created

**Sanity configuration:**
- Wire schemas in `apps/studio/sanity.config.ts`:
  ```typescript
  import { schemaTypes } from './schemas'
  export default defineConfig({
    // ...existing config
    schema: { types: schemaTypes },
  })
  ```
  - Source: `docs/CLAUDE_CODE_BRIEF.md` (line 56-61)

**Convex configuration:**
- `convex.json` — not yet present
- `convex/tsconfig.json` — auto-generated on deploy

---

## Platform Requirements

**Development:**
- Node.js 18+
- Python 3.9+
- Sanity CLI (`npm i -g sanity`)
- Vercel CLI (optional)
- Railway CLI (optional)

**Production:**
- **Frontend:** Vercel (serverless Node.js)
- **Pipeline:** Railway (serverless Python with persistent environment vars)
- **CMS:** Sanity Cloud (managed)
- **Realtime data:** Convex (managed)
- **Database (optional):** Supabase PostgreSQL (managed)
- **Ecommerce:** Stripe Checkout (managed)
- **Search:** Tavily or Brave API (managed)

---

## Status Summary

| Component | Type | Status | Path | Notes |
|-----------|------|--------|------|-------|
| Next.js frontend | Framework | Planned | `apps/web/` | App Router, not wired |
| Sanity CMS | Framework | Schemas present | `schemas/` | Ready to wire into Studio |
| FastAPI backend | Framework | Planned | `packages/pipeline/` | Not wired |
| LangGraph | Framework | Planned | `packages/pipeline/` | Not wired |
| Convex schema | Database | Present | `convex/schema.ts` | Schema complete, queries/mutations not implemented |
| Stripe | Service | Planned | `apps/web/app/api/checkout` | Not wired |
| OpenRouter | Service | Planned | Pipeline | Not wired |
| Sanity reads | Integration | Planned | `apps/web/` | GROQ queries not implemented |
| Sanity writes | Integration | Planned | `packages/pipeline/` | Python client not implemented |
| Convex HTTP API | Integration | Planned | `packages/pipeline/` | Mutation calls not implemented |
| Vercel deploy hook | Integration | Planned | Publisher agent | Not wired |
| Sanity webhook | Integration | Planned | Railway endpoint | Handler stub in brief |
| Tavily/Brave search | Service | Planned | Scout + Researcher | Not wired |
| WeasyPrint/Playwright | Service | Planned | Publisher agent | PDF generation not implemented |
| Suno | Service | Planned | BonusWriter | Manual for Andrew (no API yet) |
| NotebookLM | Service | Planned | Manual step | Andrew uploads transcript, exports audio |

---

## Schema Files Present

**Sanity schemas** (TypeScript, `schemas/` directory):
- `charity.ts` — Charity document type (11 fields: name, slug, location, website, etc.)
- `weeklyIssue.ts` — Weekly issue document type (27 fields: issue number, sections, theme, metadata)
- `agentProfile.ts` — Agent character profiles (5 fields: agentId, displayName, role, personality, avatar)
- `index.ts` — exports all schema types

**Convex schema** (TypeScript, `convex/schema.ts`):
- `pipelineRuns` table — 1 per weekly run, tracks status
- `deliberationEvents` table — agent events during run (real-time stream)
- `agentVotes` table — queryable agent votes with reasoning
- `qaCorrections` table — QA corrections with severity and acceptance
- `pitchLog` table — Scout's charity candidates before deliberation

All schema definitions are **complete and ready to deploy** but the corresponding query/mutation functions and frontend integrations are **not yet implemented**.

---

## Type System

**TypeScript:**
- Sanity schema types auto-generated from `schemas/*.ts`
- Convex types auto-generated from `convex/schema.ts`
- Shared types planned in `packages/shared/` (not yet created)

**Python:**
- LangGraph state: `DispatchState` TypedDict (defined in API_CONTRACTS.md section 7)
  - Contains: run identity, Phase 1 selection data, Phase 2 content sections, QA corrections, error handling
  - 40+ fields representing full pipeline state

---

## Notes on "Planned but not wired"

The entire stack is **defined in the brief** but **nothing is connected yet**. This is the scaffolding stage:

- Schema files exist and are complete
- No package.json or npm dependencies installed
- No implementation code in `apps/web/`, `apps/studio/`, or `packages/pipeline/`
- No `.env.local` or configuration files
- No API handlers or query builders

The build brief provides a comprehensive roadmap (§ "Build sequence") that specifies the order of implementation:

1. Sanity schema + Studio
2. Next.js shell
3. Convex setup
4. Pipeline skeleton
5. Agent quality (iterative)
6. PDF generation
7. Game rendering
8. Stripe integration
9. Deliberation layer
10. Podcast section

---

*Stack analysis: 2026-05-09*
