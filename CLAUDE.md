# Eisenbalm Dispatch

Read these before doing anything else:
- docs/CLAUDE_CODE_BRIEF.md — full project spec, stack, agent pipeline, build sequence
- docs/API_CONTRACTS.md — every interface boundary with exact shapes

Schema files are in schemas/ and convex/schema.ts — do not modify field names 
without checking API_CONTRACTS.md first.

Start every session by confirming which build step you're on.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**The Eisenbalm Dispatch**

A weekly AI-generated editorial website that spotlights an obscure charity each week, sells one product (Jesse A. Eisenbalm lip balm), and donates 100% of proceeds to the featured charity. Editorial content is produced by a nine-agent LangGraph pipeline; a human editor (Andrew) reviews and publishes via Sanity Studio. The site is a destination — it should feel like a magazine that happens to sell one product, not a newsletter.

**Core Value:** Every Thursday, ship a complete, on-voice issue: one obscure charity, eight original sections (origin story, problem, founder bio, case study, game, bonus, deliberation, podcast), and a working shop callout — published only after Andrew's manual review.

### Constraints

- **Tech stack**: Next.js 14+ (App Router) on Vercel · Sanity v3 · FastAPI on Railway · LangGraph · OpenRouter · Supabase · Convex · Stripe · WeasyPrint or Playwright — locked by brief, do not substitute
- **Repository**: monorepo (`apps/web`, `apps/studio`, `packages/pipeline`, `packages/shared`, plus existing `convex/` and `schemas/`) — to be scaffolded in Phase 1
- **Cadence**: weekly issue. Pipeline must complete + Andrew must review + Publisher must deploy within a Thu→Thu window. Slow pipelines or Andrew bottlenecks break the format.
- **Voice**: Jesse's voice is non-negotiable. Voice drift = brand failure. QA + Editor Final are the automated guards; Andrew is the manual guard.
- **AI cost**: 9 agents per run × multiple OpenRouter calls + web search. Per-run cost containment matters.
- **Security**: Game agent emits HTML/JS rendered inside `iframe srcdoc sandbox="allow-scripts"` — must be airtight. Theme injects CSS variables — must validate hex colors and font names.
- **Andrew is single-threaded**: no backup reviewer specified. If Andrew is offline, no issue ships that week.
- **Stripe is custom**: no Shopify, no Commerce.js, no urgency mechanics. Webhook signature verification + idempotency required.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Overview
- **Frontend:** Next.js 14+ on Vercel
- **CMS:** Sanity v3  
- **Pipeline:** FastAPI + LangGraph on Railway
- **Realtime data layer:** Convex
- **Commerce:** Stripe (custom)
- **AI routing:** OpenRouter
- **Pipeline database:** Supabase
## Languages
- **TypeScript** — present in `convex/schema.ts`, `schemas/*.ts` — used for database schemas and type contracts
- **Python** — planned for pipeline implementation (not yet present)
- **Frontend:** TypeScript/JavaScript (Next.js app router)
- **Pipeline:** Python (FastAPI + LangGraph)
- **Shared types:** TypeScript in `packages/shared/`
- **CMS schemas:** TypeScript (Sanity SDK)
## Runtime
- **Node.js 18+** — Next.js frontend, Sanity Studio
- **Python 3.9+** — FastAPI backend on Railway
- **Browser:** Chrome/Safari/Firefox (Next.js)
- **npm/yarn** — JavaScript dependencies (not installed yet)
- **pip** — Python dependencies (not installed yet)
- **uv** — optional, modern Python package manager (mentioned in docs)
- Not yet present (project in scaffolding stage)
## Frameworks
- **Next.js 14+** (App Router) — frontend hosted on Vercel
- **Sanity v3** — headless CMS
- **FastAPI** — pipeline backend
- **LangGraph** — agentic workflow orchestration
- **Convex** — realtime reactive database for frontend subscriptions
- Not specified in brief
- Status: **Not started**
- **Vercel** — hosts Next.js frontend
- **Railway** — hosts FastAPI backend
## Key Dependencies
- **OpenRouter** — AI model routing (Claude via OpenRouter for agents)
- **Supabase** — pipeline database (PostgreSQL)
- **Stripe** — ecommerce (lip balm)
- **Tavily / Brave Search** — web search (for Scout and Researcher agents)
- **Suno** — audio generation (for jingle bonus type)
- **NotebookLM** — podcast generation
- **Sanity** — CMS API (reads via GROQ, writes via Python client)
- **Convex** — realtime subscriptions
- **Vercel** — frontend hosting
- **Railway** — pipeline hosting
- `next` (14+)
- `react` (18+)
- `@sanity/client` (GROQ queries)
- `convex/react` (realtime hooks)
- `stripe` (checkout)
- `@portabletext/react` (render Sanity portable text)
- `fastapi` — HTTP server
- `langgraph` — agentic workflow
- `anthropic` — OpenRouter client
- `supabase-py` — Supabase client
- `sanity-python` — Sanity write client
- `tavily-python` or `brave-search` — web search
- `weasyprint` or `playwright` — PDF generation (for Problem Statement)
- `httpx` — async HTTP (for Convex mutations, Vercel webhooks)
## Configuration
# Sanity
# Convex
# OpenRouter
# Supabase
# Stripe
# Vercel
# Railway (pipeline)
# Search (for Scout and Researcher agents)
# Sanity webhook (pipeline)
- `next.config.js` — not yet created
- `tsconfig.json` — not yet created
- `pyproject.toml` or `requirements.txt` — not yet created (FastAPI)
- `sanity.config.ts` — not yet created (needs to import schemas from `schemas/index.ts`)
- `.env.local` — not yet created
- Wire schemas in `apps/studio/sanity.config.ts`:
- `convex.json` — not yet present
- `convex/tsconfig.json` — auto-generated on deploy
## Platform Requirements
- Node.js 18+
- Python 3.9+
- Sanity CLI (`npm i -g sanity`)
- Vercel CLI (optional)
- Railway CLI (optional)
- **Frontend:** Vercel (serverless Node.js)
- **Pipeline:** Railway (serverless Python with persistent environment vars)
- **CMS:** Sanity Cloud (managed)
- **Realtime data:** Convex (managed)
- **Database (optional):** Supabase PostgreSQL (managed)
- **Ecommerce:** Stripe Checkout (managed)
- **Search:** Tavily or Brave API (managed)
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
## Schema Files Present
- `charity.ts` — Charity document type (11 fields: name, slug, location, website, etc.)
- `weeklyIssue.ts` — Weekly issue document type (27 fields: issue number, sections, theme, metadata)
- `agentProfile.ts` — Agent character profiles (5 fields: agentId, displayName, role, personality, avatar)
- `index.ts` — exports all schema types
- `pipelineRuns` table — 1 per weekly run, tracks status
- `deliberationEvents` table — agent events during run (real-time stream)
- `agentVotes` table — queryable agent votes with reasoning
- `qaCorrections` table — QA corrections with severity and acceptance
- `pitchLog` table — Scout's charity candidates before deliberation
## Type System
- Sanity schema types auto-generated from `schemas/*.ts`
- Convex types auto-generated from `convex/schema.ts`
- Shared types planned in `packages/shared/` (not yet created)
- LangGraph state: `DispatchState` TypedDict (defined in API_CONTRACTS.md section 7)
## Notes on "Planned but not wired"
- Schema files exist and are complete
- No package.json or npm dependencies installed
- No implementation code in `apps/web/`, `apps/studio/`, or `packages/pipeline/`
- No `.env.local` or configuration files
- No API handlers or query builders
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Current Status
## Naming Patterns
- Sanity schema files: `camelCase.ts` — e.g., `charity.ts`, `weeklyIssue.ts`, `agentProfile.ts` (`schemas/` directory)
- Convex schema: `schema.ts` (`convex/schema.ts`)
- Index files: `index.ts` with named exports of types
- `camelCase` throughout: `defineSchema()`, `defineTable()`, `defineField()`, `defineType()`
- Helper functions: `camelCase` — e.g., `editorialSection()` in `schemas/weeklyIssue.ts`
- TypeScript `TypedDict` for schema validation (Convex): `PipelineRuns`, `DeliberationEvents`, `AgentVotes`, `QaCorrections`, `PitchLog`
- Sanity schema objects: inline with `defineField()` calls, no separate type exports
- `camelCase` for all field names: `issueNumber`, `charityId`, `agentId`, `eventType`, `startedAt`, `completedAt`
- Timestamps: `*At` suffix (e.g., `startedAt`, `completedAt`, `timestamp`)
- Status fields: `kebab-case` literal values — e.g., `'running' | 'awaiting-review' | 'complete' | 'failed'`
- Enum-like values: `kebab-case` — e.g., `'scout-finding'`, `'advocate-argument'`, `'editor-decision'`
- Slug fields: `'slug'` field with `{ _type: 'slug', current: 'kebab-case-value' }` structure
## Code Style Observations
- `convex/schema.ts` uses functional builder pattern: `defineSchema()` wrapping `defineTable()` calls
- Field definitions: `v.string()`, `v.number()`, `v.optional()`, `v.union()` — Convex values API
- Literal union types: `v.literal('literal-value')` for enum fields
- Indices defined inline: `.index('by_fieldName', ['fieldName'])` after field definitions
- No explicit type annotations in table definitions — validation happens via Convex values
- `schemas/` files use functional builder pattern: `defineType()` wrapping `defineField()` calls
- Field definitions: `defineField()` for every field, even in nested objects
- Validation: `validation: Rule => Rule.required()` pattern for required fields
- Nested objects: `type: 'object'`, inline `fields: []` array
- References: `type: 'reference', to: [{ type: 'charity' }]` pattern
- Slug generation: `options: { source: 'name', maxLength: 96 }` or dynamic `source: (doc: any) => ...`
- Preview rendering: `preview: { select: {...}, prepare: ({...}) => {...} }` for Studio display
- Comments: section headers using `// ─── Name ──────` ASCII art separators (in `weeklyIssue.ts`)
- Schema exports are default exports: `export default defineType({...})`
- Index file uses named exports: `export const schemaTypes = [...]`
- No utility imports outside of Sanity/Convex SDK
## Import Organization
## Field Design
- Required fields: `validation: Rule => Rule.required()`
- Numeric ranges: `Rule.integer().min(1800).max(currentYear)`
- URL fields: `type: 'url'` (built-in validation)
- Slug fields: `type: 'slug'` with source option
- Convex: `v.optional(v.type())` for optional fields
- Sanity: Absence of validation rule = optional; `validation: Rule => Rule.required()` = required
- `title: 'Human-Readable Label'` — shown in Sanity Studio UI
- `description: 'Help text or guidance'` — shown below field in Studio
- Descriptions use plain English, no code snippets
- Portable Text fields in Sanity: `type: 'array', of: [{ type: 'block' }]`
- JSON-in-string fields: `type: 'text'` with `description: 'JSON: ...'` comment (e.g., `modelVersions` in Convex state)
- File/asset uploads: `type: 'file'` or `type: 'image'` with `options: { accept: '...' }`
## Comments and Documentation
- Used in `schemas/weeklyIssue.ts` to organize large schema definitions
- Pattern: `// ─── Name ──────────────────────────────────────────────────────────────────`
- Sanity schema comments explain editorial intent or constraint — e.g., "Jesse voice, played completely straight"
- Convex table comments explain data model purpose — e.g., "One record per weekly pipeline run"
- No JSDoc/TSDoc annotations observed
- Use `description` field in Sanity `defineField()` to document intent and constraints
- Descriptions in Convex comments above table/field definitions
## Convex-Specific Patterns
- `defineTable({ fieldName: v.validator() })` — all fields declared upfront
- Index naming: `.index('by_fieldName', ['fieldName'])` for single-field indices
- Compound indices: `.index('by_runId_and_type', ['runId', 'eventType'])`
- `v.string()`, `v.number()`, `v.boolean()` — primitive types
- `v.optional(v.type())` — optional fields
- `v.union(v.literal(...), v.literal(...))` — enum-like union types
- `v.any()` — only for JSON payload strings
- Stored as Unix milliseconds: `v.number()`
- Calculated at write time, not query time
- Named consistently: `*At` for datetime-like fields, `timestamp` for event streams
## Sanity-Specific Patterns
- `type: 'document'` for top-level content (charity, weeklyIssue, agentProfile)
- `type: 'object'` for embedded nested structures (theme, caseStudy, bonus, etc.)
- Auto-generated from source field using Sanity's slug type
- Source can be static (`source: 'name'`) or dynamic (`source: (doc) => ...`)
- `maxLength: 96` for slugs
- Deterministic slug generation for charity documents: `f'charity-{slugified-name}'`
- `type: 'reference', to: [{ type: 'documentTypeName' }]`
- Used to link charity → weeklyIssue and charity → agentProfile
- Sanity automatically resolves references in GROQ queries with `->` syntax
- `type: 'array', of: [{ type: 'block' }]` for body text
- Pipeline converts plain text to Portable Text via `text_to_portable_text()` helper function
- Helper generates `_type: 'block'`, `_key` (UUID), `style`, `markDefs`, `children` structure
- `preview: { select: {...}, prepare: (...) => {...} }` controls Studio card display
- Used in all document types to show meaningful summaries
- Example: charity preview shows `name` and `location`
## Brand & Voice Constraints (from brief, implies convention)
- "Dry, precise, and absurdly serious. No winking. No irony signaling."
- Applied to all agent prompts and section content
- Field descriptions in schemas reflect this tone (e.g., "Founder Bio: Jesse voice, Fortune 500 treatment")
- Charities treated with gravity equal to Fortune 500 companies
- Founders treated as visionaries regardless of obscurity
- Question: "Why do you deserve to exist?" — answered without sentiment
- "Jesse was born AI. This is not a gimmick."
- Implies: straightforward implementation, no cutesy naming, no artificial pacing
## REST + Webhook Boundaries (from brief, implies convention)
- Sanity webhook: FastAPI route `POST /webhook/sanity-publish` with HMAC validation
- Signature verification: `hmac.compare_digest(expected, provided)`
- Return `200` immediately, run async tasks in background
- Next.js → Sanity: GROQ read queries (stateless CDN reads)
- Pipeline → Sanity: Python client writes (deterministic document IDs for upserts)
- Pipeline → Convex: HTTP mutation calls (async, non-blocking)
- Next.js → Convex: TypeScript React hooks (real-time subscriptions)
## File Paths Reference
- `convex/schema.ts` — Convex database schema (tables: pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog)
- `schemas/charity.ts` — Sanity document type for charities
- `schemas/weeklyIssue.ts` — Sanity document type for weekly editorial content
- `schemas/agentProfile.ts` — Sanity document type for agent character profiles
- `schemas/index.ts` — Exports all schema types for Sanity Studio integration
- `apps/web/lib/sanity/queries.ts` — GROQ query definitions
- `packages/pipeline/lib/sanity_client.py` — Python Sanity client initialization
- `packages/pipeline/lib/convex_client.py` — Python Convex HTTP mutation caller
- `packages/pipeline/lib/portable_text.py` — Portable Text conversion helper
- `packages/pipeline/types.py` — LangGraph DispatchState TypedDict
- `apps/web/types/issue.ts` — TypeScript types for issue data structure
## Summary
- `camelCase` for code identifiers, `kebab-case` for enum/status literals
- Functional builder pattern for all schemas (Sanity `defineField`/`defineType`, Convex `defineSchema`/`defineTable`)
- Section headers with ASCII separators for large files
- Inline validation rules in schema definitions
- Default export for schema types, named export for index collections
- ESLint configuration (no `.eslintrc` exists)
- Prettier formatting (no `.prettierrc` exists)
- TypeScript strict mode settings (no `tsconfig.json` shared)
- Pre-commit hooks
- Editor config (`.editorconfig`)
- Jesse's dry, precise voice — no winking, no irony
- REST boundaries at Sanity, Convex, and Stripe
- No framework shortcuts; custom integration patterns
- Deterministic document IDs for upserts (no random UUIDs)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Orchestration:** LangGraph manages agent handoff, state threading, and conditional branching
- **Human gates:** Two decision points where Andrew reviews (Editor Gate 1 for charity selection, Andrew review via Sanity Studio for final publication)
- **Real-time deliberation:** All pipeline events streamed to Convex for live frontend visualization
- **Canonical content:** Sanity as source-of-truth for published content; pipeline drafts to Sanity as `draft` status
- **Pipeline state:** Supabase holds ephemeral pipeline execution state; Convex holds queryable deliberation events
- **Webhook-triggered finalization:** Sanity webhook on `status === 'published'` triggers Publisher agent asynchronously
## Layers
- Purpose: Coordinate the nine-agent pipeline, manage state threading, enforce sequential and parallel execution phases, handle human gates
- Location: `packages/pipeline/` (FastAPI + LangGraph)
- Contains: Agent nodes (Python LangGraph nodes), graph definition, state management, tool integrations
- Depends on: OpenRouter (model routing), Tavily/Brave (web search), Sanity client, Convex HTTP client, Supabase Python client
- Used by: Railway infrastructure (async trigger from HTTP endpoint or Sanity webhook)
- Purpose: Store published issues, charities, agent profiles; serve as canonical source for frontend content
- Location: Sanity v3 (cloud-hosted)
- Contains: Document types for `weeklyIssue`, `charity`, `agentProfile` (schemas in `schemas/`)
- Depends on: Nothing (read-only for frontend)
- Used by: Next.js frontend (GROQ reads), pipeline (Python writes on draft completion and PDF upload)
- Purpose: Provide queryable, real-time event stream for deliberation layer visualization; store pitch log, agent votes, QA corrections
- Location: `convex/schema.ts`, deployed to Convex cloud
- Contains: Five tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`
- Depends on: Python mutation calls from pipeline via HTTP API
- Used by: Next.js frontend (useQuery hooks for live updates)
- Purpose: Render magazine experience, display issues, render deliberation layer, handle commerce
- Location: `apps/web/` (Next.js 14+ App Router)
- Contains: Page routes, components, Sanity GROQ query library, Convex subscription components, Stripe integration
- Depends on: Sanity (content), Convex (live deliberation), Stripe (checkout)
- Used by: Browser clients (Vercel-hosted)
- Purpose: Editorial interface where Andrew reviews drafts, edits fields, and publishes
- Location: `apps/studio/`
- Contains: Sanity Studio configuration, schema wiring, custom desk plugins (optional)
- Depends on: Sanity v3
- Used by: Andrew (human editor)
- Purpose: Payment processing for lip balm sales
- Location: Stripe cloud (payment provider)
- Contains: Product definition, checkout sessions, webhook handler
- Depends on: Nothing
- Used by: Frontend checkout flow, order confirmation
## Data Flow
### Phase 1 — Charity Selection (Sequential)
```
```
- `state['style_brief']` set
- `state['candidates']` populated
- `state['winning_charity']` selected
- `state['winning_charity_sanity_id']` written to Sanity, retrieved back
- `state['editor_decision']`, `state['runner_up_notes']` populated
- `state['deliberation_transcript']` full text (Scout findings + Advocate arguments + Editor reasoning)
### Phase 2 — Content Production (Parallel after Gate 1)
```
```
- `state['research']` populated
- `state['origin_story']`, `state['problem_statement']`, `state['founder_bio']`, `state['case_study']`, `state['game']`, `state['bonus']`, `state['theme']` all populated
- `state['qa_corrections']` populated with all corrections made
- `state['editor_final_notes']` populated
- `state['sanity_issue_id']` set after writing to Sanity
### After Pipeline Completion
```
```
## State Management
- Each agent reads from `state` and returns updates to `state`
- LangGraph merges agent outputs back to state
- Sequential agents block until previous agent completes
- Parallel agents all run concurrently, then merge results
- **Ephemeral:** Pipeline state lives in LangGraph during execution, backed by Supabase `pipeline_state` table (for resumability / restart)
- **Queryable deliberation:** All deliberation events persisted immediately to Convex (not ephemeral — shows to users)
- **Canonical content:** Draft written to Sanity at pipeline end (status='draft'), published by Andrew
## Key Abstractions
- Purpose: Represents a charity being considered for featuring
- Evolves through: Scout (finds) → Advocate (scores) → Editor Gate 1 (selects one) → phase 2 (winner only)
- Fields: name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked, advocateArgument, advocateScore
- Purpose: Constraints injected into every subsequent agent's system prompt
- Generated: Once, by Calibrator at pipeline start
- Fields: voice, constraints, bonusType, visualDirection, previousBonusTypes
- Used by: Every agent (Calibrator → all phase 2 agents)
- Purpose: Shared research document consumed by all section writers
- Generated: By Researcher (parallel phase 2)
- Consumed by: OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter, GameWriter, BonusWriter, DesignAgent
- Purpose: CSS variable injection on issue page `<html>` element
- Generated: By DesignAgent (parallel phase 2)
- Consumed by: Next.js issue page component
- Fields: primaryColor (hex), accentColor (hex), backgroundColor (hex), textColor (hex), fontDisplay (Google Font name), fontBody (Google Font name), visualDirection (text)
- Purpose: Atomic record of something that happened during the pipeline
- Types: scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy
- Each carries: runId, agentId, eventType, payload (JSON string), timestamp
- Consumed by: Frontend deliberation layer (live subscription via Convex)
## Entry Points
- Location: `apps/studio/`
- Triggers: Andrew edits a draft issue or publishes (status='draft' → 'published')
- Publishes: Sanity webhook POSTs to `https://<railway-domain>/webhook/sanity-publish`
- Responsibility: Human editorial review and approval
- Location: `packages/pipeline/api/main.py` (FastAPI app)
- Endpoint: `POST /run` (or `POST /dispatch/run`)
- Triggers: Scheduled job (e.g., weekly cron) or manual trigger
- Responsibility: Start pipeline, initialize run_id, issue_number, launch LangGraph
- Location: `packages/pipeline/api/webhooks.py`
- Endpoint: `POST /webhook/sanity-publish`
- Triggers: Sanity fires when `weeklyIssue.status` changes to `published`
- Responsibility: Verify signature, enqueue Publisher agent (background task)
- Location: `apps/web/app/issue/[slug]/page.tsx`
- Fetches: Issue from Sanity via GROQ (content), runId → Convex queries for live deliberation
- Responsibility: Display magazine layout + live deliberation layer
## Error Handling
- If Editor Gate 1 cannot select a winner with confidence, LangGraph enters a pause state
- Convex `pipelineRuns` status set to `awaiting-review` (really: awaiting-editor-decision)
- Frontend deliberation layer shows incomplete state; Andrew sees in Sanity that run is stalled
- Andrew can manually intervene in Sanity to force a selection or restart
- If an agent node raises an exception, LangGraph propagates it
- Catches at top level, updates Convex `pipelineRuns` status to `failed`, logs error message
- Pipeline halts; Andrew notified; run is orphaned
- If a mutation to Convex fails (e.g., network timeout), log the error but continue
- Deliberation layer may be incomplete, but content pipeline continues
- Sanity write succeeds (content is what matters)
- If `write_issue_draft` fails (malformed Portable Text, schema mismatch, etc.), halt pipeline
- Wraps in try/except, updates Convex status to `failed`, surfaces error to logs
- Always returns `200 OK` to Stripe, even on internal processing failures
- Logs failures for manual review
- Stripe retries aggressively if we return `4xx` or `5xx`
- If WeasyPrint fails, Publisher agent retries once
- If still fails, logs error, updates Convex `pipelineRuns` to `failed`
- Issue published without PDF (manual fallback: Andrew can re-trigger Publisher)
## Cross-Cutting Concerns
- Pipeline: Python `logging` module with structured logs to stdout (Railway captures)
- Frontend: Browser console + optional Sentry integration
- Approach: All agent decisions logged; all Convex/Sanity writes logged with timing
- LangGraph state validated at each transition (pydantic TypedDict for `DispatchState`)
- Sanity writes validated against schema (schema.ts defines required fields, types, validation rules)
- GROQ queries typed in TypeScript (API_CONTRACTS.md section 1 defines return shapes)
- Convex mutations accept Convex value validators (`v.string()`, `v.number()`, etc.)
- Sanity: `SANITY_API_TOKEN` (pipeline write access)
- Convex: `CONVEX_DEPLOY_KEY` (pipeline mutation calls)
- OpenRouter: `OPENROUTER_API_KEY`
- Stripe: `STRIPE_SECRET_KEY` (webhook handler verifies signature)
- Sanity webhook: `SANITY_WEBHOOK_SECRET` (HMAC verification)
- OpenRouter: Handled by OpenRouter's own limits (observes usage via API key)
- Tavily/Brave: Rate limiting built into SDKs
- Sanity: CDN reads cached; writes hit API (no aggressive batching)
- Convex: HTTP API has built-in rate limits (Railway cluster size matters)
- LangGraph parallelism: In phase 2, all section agents execute concurrently via `graph.add_conditional_edges` and `asyncio.gather()`
- Supabase: Python async client
- Convex: HTTP client (httpx AsyncClient for concurrent mutations)
- Frontend: React `useQuery` hooks auto-subscribe and handle loading/stale states
- Sanity CDN: Reads use `useCDN: true` (query cache transparent to app)
- Convex: Subscriptions are real-time (no caching — always fresh)
- Next.js: ISR (incremental static regeneration) on issue pages after Vercel deploy
- Frontend component caching: Agent profiles cached in React state after first GROQ query
## System Boundaries (See docs/API_CONTRACTS.md)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
