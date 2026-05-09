# Codebase Structure

**Analysis Date:** 2025-02-09

## Current State vs. Planned State

This codebase is in **early scaffolding stage**. Only planning artifacts and schema definitions exist. The app directories and main implementation code do not yet exist.

### What Exists Now

```
/Users/user/Desktop/Eisenbalm/
├── convex/
│   └── schema.ts                # Convex database schema (complete, ready to deploy)
├── schemas/                      # Sanity schema definitions (complete, ready to wire in)
│   ├── charity.ts
│   ├── weeklyIssue.ts
│   ├── agentProfile.ts
│   └── index.ts
└── docs/
    ├── CLAUDE_CODE_BRIEF.md      # Full build brief with 9-agent pipeline spec
    └── API_CONTRACTS.md          # All 7 system boundaries with exact payload shapes
```

### What Doesn't Exist Yet (Planned)

```
eisenbalm/                       # ← To be created at project root or monorepo root
├── apps/
│   ├── web/                     # Next.js 14+ frontend (NOT CREATED)
│   │   ├── app/                 # App Router pages
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── sanity/
│   │   │       └── queries.ts   # GROQ queries (contract in API_CONTRACTS.md section 1)
│   │   ├── types/
│   │   │   └── issue.ts
│   │   ├── public/
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   └── studio/                  # Sanity Studio (NOT CREATED)
│       ├── sanity.config.ts     # Wire in schemas/ (charity.ts, weeklyIssue.ts, agentProfile.ts)
│       ├── schemas/             # Copy schemas/ here or import from packages/shared
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── pipeline/                # FastAPI + LangGraph agents (NOT CREATED)
│   │   ├── api/
│   │   │   ├── main.py          # FastAPI app, POST /run endpoint
│   │   │   └── webhooks.py      # Sanity webhook handler: POST /webhook/sanity-publish
│   │   ├── agents/              # Nine agent node definitions
│   │   │   ├── calibrator.py
│   │   │   ├── scout.py
│   │   │   ├── advocate.py
│   │   │   ├── editor_gate1.py  # Selection gate
│   │   │   ├── researcher.py
│   │   │   ├── origin_story.py
│   │   │   ├── problem_statement.py
│   │   │   ├── founder_bio.py
│   │   │   ├── case_study.py
│   │   │   ├── game.py
│   │   │   ├── bonus.py
│   │   │   ├── design.py
│   │   │   ├── qa.py
│   │   │   ├── editor_final.py  # Final editor
│   │   │   └── publisher.py     # Triggered by Sanity webhook
│   │   ├── graph.py             # LangGraph graph definition (orchestration)
│   │   ├── lib/
│   │   │   ├── sanity_client.py # Sanity Python SDK init + write helpers
│   │   │   ├── convex_client.py # Convex HTTP API client for mutations
│   │   │   ├── portable_text.py # text_to_portable_text() helper (critical)
│   │   │   └── tools.py         # Tool definitions (web search, PDF generation)
│   │   ├── types.py             # DispatchState TypedDict (contract in API_CONTRACTS.md section 7)
│   │   ├── requirements.txt      # Python dependencies (FastAPI, LangGraph, Sanity SDK, OpenRouter, etc.)
│   │   ├── Dockerfile           # For Railway deployment
│   │   └── pyproject.toml
│   │
│   └── shared/                  # TypeScript shared types (NOT CREATED)
│       ├── types/
│       │   ├── issue.ts         # Matches Sanity weeklyIssue schema
│       │   ├── charity.ts       # Matches Sanity charity schema
│       │   └── dispatch.ts      # Pipeline state types (mirrored from Python)
│       ├── package.json
│       └── tsconfig.json
│
├── convex/                      # ← Already exists, ready to deploy
│   ├── schema.ts                # Convex schema (5 tables)
│   ├── pipelineRuns.ts          # Query/mutation functions (to be created)
│   ├── pitchLog.ts              # (to be created)
│   ├── deliberationEvents.ts    # (to be created)
│   ├── agentVotes.ts            # (to be created)
│   ├── qaCorrections.ts         # (to be created)
│   ├── tsconfig.json
│   └── package.json
│
├── schemas/                     # ← Already exists, to be moved to apps/studio/schemas/
│   ├── charity.ts
│   ├── weeklyIssue.ts
│   ├── agentProfile.ts
│   └── index.ts
│
├── docs/                        # ← Already exists
│   ├── CLAUDE_CODE_BRIEF.md     # Build specification
│   └── API_CONTRACTS.md         # All system boundaries
│
├── .planning/
│   └── codebase/
│       ├── ARCHITECTURE.md      # (this document)
│       └── STRUCTURE.md         # (this document)
│
├── package.json                 # Monorepo root (NOT CREATED)
├── pnpm-workspace.yaml          # or yarn workspaces / npm workspaces (NOT CREATED)
├── tsconfig.json                # Root TypeScript config (NOT CREATED)
├── .env.example                 # Environment variables template
└── .gitignore
```

---

## Directory Purposes

### `convex/` (Exists)

**Purpose:** Convex schema and queries. Defines the real-time event streaming infrastructure.

**Key files:**
- `convex/schema.ts` — Five tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`
  - Each table has specific indexes for query optimization (by_runId, by_runId_and_type, etc.)
  - All timestamps are Unix milliseconds
  - No authentication required on Convex; access controlled by frontend env var (`NEXT_PUBLIC_CONVEX_URL`)

**To create (in progress):**
- `convex/pipelineRuns.ts` — Queries: `byRunId`, mutations: `create`, `updateStatus`
- `convex/pitchLog.ts` — Queries: `byRunId`, mutations: `insert`, `markSelected`
- `convex/deliberationEvents.ts` — Queries: `byRunId`, `byRunIdAndType`, mutations: `insert`
- `convex/agentVotes.ts` — Queries: `byRunId`, `byRunIdAndCharity`, mutations: `insert`
- `convex/qaCorrections.ts` — Queries: `byRunId`, mutations: `insert`

**Dependencies:** Convex CLI (`npx convex deploy`)

---

### `schemas/` (Exists)

**Purpose:** Sanity document type definitions. Currently in project root; will be moved to `apps/studio/schemas/`.

**Key files:**
- `schemas/charity.ts` — Document type for featured charities
  - Fields: name (required), slug (required), location, website, foundingYear, assetRange, focusArea, missionStatement, scoutNotes, firstFeaturedIn (reference back to weeklyIssue)

- `schemas/weeklyIssue.ts` — Document type for weekly editorial issues
  - Fields: issueNumber (required), slug (required), publishDate, status (draft|published), charity (reference), theme (object), bonusType, originStory, problemStatement, founderBio, caseStudy, game, bonus, podcast, selectionDeliberation, pipelineMetadata
  - Each editorial section is an object with { headline (string), body (portable text array) }

- `schemas/agentProfile.ts` — Character profiles for deliberation layer
  - Fields: agentId (slug, required), displayName, role, personality (text), avatar (image)
  - Seeded once per agent; IDs must match pipeline agent names (calibrator, scout, advocate, editor, researcher, origin-story, problem-statement, founder-bio, case-study, game, bonus, design, qa, publisher)

- `schemas/index.ts` — Exports array `schemaTypes`

**Wire into:** `apps/studio/sanity.config.ts`
```typescript
import { schemaTypes } from './schemas'
export default defineConfig({
  // ...
  schema: { types: schemaTypes },
})
```

---

### `apps/web/` (Not Yet Created)

**Purpose:** Next.js 14+ frontend. Renders magazine experience, displays issues, handles commerce, displays live deliberation layer.

**Structure:**
```
apps/web/
├── app/
│   ├── layout.tsx               # Root layout, theme injection, Convex provider
│   ├── page.tsx                 # Homepage (redirect to latest issue or hero)
│   ├── issue/
│   │   ├── [slug]/
│   │   │   └── page.tsx         # Issue detail page (renders 10 sections + deliberation)
│   │   └── layout.tsx
│   ├── archive/
│   │   └── page.tsx             # All issues searchable
│   ├── charities/
│   │   ├── page.tsx             # Charity database
│   │   └── [slug]/
│   │       └── page.tsx         # Single charity page
│   ├── shop/
│   │   ├── page.tsx             # Lip balm product page + checkout
│   │   ├── thank-you/
│   │   │   └── page.tsx         # Order confirmation
│   │   └── layout.tsx
│   ├── about/
│   │   └── page.tsx             # Jesse's about page
│   ├── api/
│   │   ├── checkout/
│   │   │   └── route.ts         # POST /api/checkout (Stripe session creation)
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts     # POST /api/webhooks/stripe (webhook handler)
│   └── globals.css
├── components/
│   ├── issue/
│   │   ├── IssueHero.tsx        # Charity header
│   │   ├── Section.tsx          # Reusable editorial section (headline + body)
│   │   ├── GameEmbed.tsx        # Iframe sandbox for game
│   │   ├── PodcastPlayer.tsx    # Audio player + transcript toggle
│   │   ├── DeliberationLayer.tsx # Live Convex subscriptions
│   │   └── ShopCallout.tsx      # Bottom-of-page shop link
│   ├── archive/
│   │   └── IssueGrid.tsx        # Archive grid layout
│   ├── shop/
│   │   ├── ProductCard.tsx      # Lip balm product display
│   │   └── CheckoutButton.tsx   # Stripe redirect
│   └── common/
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── ThemeProvider.tsx    # Injects CSS variables from theme object
├── lib/
│   ├── sanity/
│   │   ├── client.ts            # Sanity client init (@sanity/client)
│   │   └── queries.ts           # All GROQ queries (contract: API_CONTRACTS.md section 1)
│   │       • QUERY_LATEST_ISSUE_SLUG
│   │       • QUERY_ISSUE_BY_SLUG
│   │       • QUERY_ARCHIVE
│   │       • QUERY_ALL_CHARITIES
│   │       • QUERY_CHARITY_BY_SLUG
│   │       • QUERY_AGENT_PROFILES
│   │       • QUERY_ISSUE_RUN_ID
│   ├── stripe.ts                # Stripe client init
│   └── utils.ts                 # Helpers (slugify, formatDate, etc.)
├── types/
│   ├── issue.ts                 # TypeScript types matching Sanity schema + GROQ queries
│   ├── charity.ts
│   └── dispatch.ts              # Mirror of Python DispatchState (optional, for type safety)
├── public/
│   ├── fonts/                   # Google Fonts (dynamic import in next.config.js)
│   └── images/
├── package.json
├── next.config.js               # Custom webpack config for Google Fonts dynamic import
├── tsconfig.json
└── .env.local (gitignored)      # NEXT_PUBLIC_* and server-side secrets
```

**Dependencies:**
- `next`, `react`, `react-dom` — Framework
- `@sanity/client` — Sanity GROQ queries (useCDN: true for reads)
- `convex/react` — useQuery hooks for deliberation
- `stripe` (browser SDK) — Checkout redirect
- `@stripe/react-stripe-js` — Optional Stripe React components

**Key patterns:**
- GROQ queries in `lib/sanity/queries.ts` (never inline queries)
- TypeScript types match Sanity schema exactly
- Theme CSS variables injected on issue page: `--color-primary`, `--color-text`, `--font-display`, etc.
- Convex subscriptions in deliberation layer component
- Stripe checkout via `fetch(/api/checkout)` then `window.location.href = url`

---

### `apps/studio/` (Not Yet Created)

**Purpose:** Sanity Studio — editorial interface where Andrew reviews, edits, and publishes drafts.

**Structure:**
```
apps/studio/
├── sanity.config.ts             # Main config (wire in schemas)
├── schemas/                     # Copy or symlink from ../../schemas/
│   ├── charity.ts
│   ├── weeklyIssue.ts
│   ├── agentProfile.ts
│   └── index.ts
├── plugins/
│   ├── document-status.ts       # (optional) Custom plugin to show pipeline status in Studio
│   └── readonly-metadata.ts     # (optional) Mark pipelineMetadata as readonly
├── structure.ts                 # (optional) Custom desk structure for Studio sidebar
├── package.json
├── tsconfig.json
└── .env.local (gitignored)      # SANITY_STUDIO_* env vars
```

**Key settings:**
- `SANITY_STUDIO_PROJECT_ID` → matches NEXT_PUBLIC_SANITY_PROJECT_ID
- `SANITY_STUDIO_DATASET` → 'production' (locked)
- `SANITY_STUDIO_URL` → e.g., https://studio.eisenbalm.dev (or Vercel-hosted)

**Plugins to consider:**
- Document status indicator (shows pipelineMetadata.status)
- Readonly shield for auto-generated fields (pipelineMetadata, pdfContent)
- Custom input for color fields (color picker)

---

### `packages/pipeline/` (Not Yet Created)

**Purpose:** FastAPI + LangGraph orchestration of the nine-agent pipeline.

**Structure:**
```
packages/pipeline/
├── api/
│   ├── main.py                  # FastAPI app
│   │   @router.post('/run') — Initialize pipeline, launch LangGraph
│   │   @router.get('/health') — Health check endpoint
│   │   @router.get('/run/{run_id}') — Get run status
│   │
│   └── webhooks.py              # Sanity webhook handler
│       @router.post('/webhook/sanity-publish') — Verify HMAC, enqueue Publisher
│
├── agents/                       # Nine agent node implementations (see CLAUDE_CODE_BRIEF.md)
│   ├── calibrator.py            # Phase 1: Generate StyleBrief
│   ├── scout.py                 # Phase 1: Find 3–5 candidate charities
│   ├── advocate.py              # Phase 1: Score each candidate
│   ├── editor_gate1.py          # Phase 1: Select winner (human gate)
│   ├── researcher.py            # Phase 2: Deep research on winner
│   ├── origin_story.py          # Phase 2 parallel
│   ├── problem_statement.py     # Phase 2 parallel
│   ├── founder_bio.py           # Phase 2 parallel
│   ├── case_study.py            # Phase 2 parallel
│   ├── game.py                  # Phase 2 parallel
│   ├── bonus.py                 # Phase 2 parallel
│   ├── design.py                # Phase 2 parallel
│   ├── qa.py                    # Phase 2: Quality assurance
│   ├── editor_final.py          # Phase 2: Final edit + sequencing
│   └── publisher.py             # Triggered by webhook: generate PDF + deploy
│
├── graph.py                     # LangGraph graph definition
│   • Nodes: Researcher + all parallel section agents
│   • Conditional branches: Editor gate 1 pass/fail, error handling
│   • Parallel execution: Section agents run together with asyncio.gather()
│   • State threading: DispatchState passed through all nodes
│
├── lib/
│   ├── sanity_client.py         # Sanity Python client init
│   │   • Helpers: write_charity(), write_issue_draft(), upload_pdf_to_issue(), set_charity_first_featured()
│   │   • All decorated with error handling + logging
│   │
│   ├── convex_client.py         # Convex HTTP API client (async)
│   │   • Helper: convex_mutation(path, args) — calls Convex mutations via HTTP
│   │   • All calls use CONVEX_DEPLOY_KEY auth header
│   │
│   ├── portable_text.py         # CRITICAL: text_to_portable_text() helper
│   │   • Converts plain text (paragraphs = \n\n) → Sanity Portable Text blocks
│   │   • Must be used for ALL body text writes to Sanity
│   │   • Never inline Portable Text construction
│   │
│   ├── tools.py                 # Tool implementations
│   │   • web_search(query) — Tavily or Brave API
│   │   • generate_pdf(html, css) — WeasyPrint or Playwright
│   │
│   ├── openrouter.py            # OpenRouter SDK wrapper
│   │   • Model routing logic (which model for which agent)
│   │   • Rate limiting / fallback models
│   │
│   └── logging.py               # Structured logging setup
│       • All agent decisions → logs
│       • All Sanity/Convex writes → logs with timing
│
├── types.py                     # Python TypedDicts (contract: API_CONTRACTS.md section 7)
│   • StyleBrief
│   • CharityCandidate
│   • ResearchOutput
│   • SectionContent
│   • CaseStudyContent
│   • GameContent
│   • BonusContent
│   • Theme
│   • QACorrection
│   • DispatchState (main state contract)
│
├── requirements.txt             # Python dependencies
│   • fastapi
│   • uvicorn
│   • langgraph
│   • langchain-core, langchain-openai
│   • sanity
│   • httpx
│   • supabase
│   • tavily-python (or brave-search)
│   • weasyprint (or playwright)
│   • pydantic
│   • python-dotenv
│   • python-slugify
│
├── Dockerfile                   # For Railway deployment
├── pyproject.toml               # Poetry or other package manager config
├── .env.example                 # Template for environment variables
├── main.py                      # Alternative entry point for Railway
└── README.md                    # Setup instructions
```

**Environment Variables Required:**
```
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID
SANITY_API_TOKEN

# Convex
NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOY_KEY

# OpenRouter
OPENROUTER_API_KEY

# Supabase (optional, for pipeline state backup)
SUPABASE_URL
SUPABASE_SERVICE_KEY

# Search tools
TAVILY_API_KEY  (or BRAVE_API_KEY)

# Webhooks
SANITY_WEBHOOK_SECRET
VERCEL_DEPLOY_HOOK_URL

# Server
RAILWAY_TOKEN (if using Railway CLI for deploy)
PORT (default 8000 for FastAPI)
```

---

### `packages/shared/` (Not Yet Created)

**Purpose:** Shared TypeScript types used by both frontend and backend (optional but recommended).

**Structure:**
```
packages/shared/
├── types/
│   ├── issue.ts                 # Issue = weekly editorial
│   ├── charity.ts               # Charity = featured nonprofit
│   └── dispatch.ts              # Mirror of Python DispatchState for type safety
├── package.json
├── tsconfig.json
└── README.md
```

**Usage:**
- `apps/web` imports from `@eisenbalm/shared` types
- `packages/pipeline` can reference TypeScript types (for documentation, not runtime)

**Note:** This is optional. Types can also live in `apps/web/types/` and be hand-kept in sync with Python types.

---

## Naming Conventions

### Files

**Agent implementations:** `{agent_id}.py` in `packages/pipeline/agents/`
- Examples: `calibrator.py`, `scout.py`, `editor_gate1.py`, `origin_story.py`
- Naming rule: kebab-case agent IDs map to snake_case file names

**GROQ queries:** Uppercase snake_case prefixed with `QUERY_`
- Examples: `QUERY_LATEST_ISSUE_SLUG`, `QUERY_ISSUE_BY_SLUG`, `QUERY_ARCHIVE`

**Sanity document types:** camelCase, lowercase first letter
- Examples: `weeklyIssue`, `charity`, `agentProfile`
- In code: `_type: 'weeklyIssue'`, `_type: 'charity'`

**Convex tables:** camelCase, lowercase first letter
- Examples: `pipelineRuns`, `deliberationEvents`, `agentVotes`

**TypeScript types:** PascalCase
- Examples: `Issue`, `Charity`, `StyleBrief`, `DispatchState`

**Python TypedDicts:** PascalCase
- Examples: `StyleBrief`, `CharityCandidate`, `DispatchState`

**Agent IDs:** kebab-case (lowercase, dash-separated)
- Examples: `calibrator`, `scout`, `advocate`, `editor`, `researcher`, `origin-story`, `problem-statement`, `founder-bio`, `case-study`, `game`, `bonus`, `design`, `qa`, `publisher`
- Used in: `agentProfile.agentId`, `deliberationEvents.agentId`, agent system prompts

**Routes:** kebab-case in URLs
- Examples: `/issue/[slug]`, `/api/checkout`, `/api/webhooks/stripe`

**CSS variables:** kebab-case prefixed with `--color-` or `--font-`
- Examples: `--color-primary`, `--color-text`, `--font-display`, `--font-body`

---

## Where to Add New Code

**New Next.js page (e.g., `/press`):**
- Create: `apps/web/app/press/page.tsx`
- Component: `apps/web/components/press/PressKit.tsx`
- Query: Add to `apps/web/lib/sanity/queries.ts` if needed
- Type: Add to `apps/web/types/`

**New agent (if pipeline extends beyond 9):**
- Create: `packages/pipeline/agents/{agent_id}.py`
- Register: Add node to `packages/pipeline/graph.py`
- Update: `docs/CLAUDE_CODE_BRIEF.md` (brief specifies all agents)
- Sanity: Create corresponding `agentProfile` document with matching `agentId`

**New section type (if you need more than origin, problem, bio, case study, game, bonus):**
- Sanity: Add field to `schemas/weeklyIssue.ts`
- Python: Add field to `types.py` `DispatchState` TypedDict
- Agent: Create new writer agent in `packages/pipeline/agents/`
- Frontend: Add component in `apps/web/components/issue/` and render in issue page

**New Convex table (if you need to track something not in current schema):**
- Schema: Add table to `convex/schema.ts` with indexes
- Mutations: Create corresponding file in `convex/` (e.g., `newTable.ts`)
- Python client: Add helper in `packages/pipeline/lib/convex_client.py`
- Frontend: Add `useQuery` hook in issue deliberation component

**New utility function:**
- Shared logic: `packages/shared/` or `packages/pipeline/lib/`
- Frontend-only: `apps/web/lib/utils.ts`
- Backend-only: `packages/pipeline/lib/`

**New environment variable:**
- Add to: `.env.example`
- Document in: This STRUCTURE.md or ARCHITECTURE.md
- Access in code: `os.environ['VAR_NAME']` (Python) or `process.env.VAR_NAME` (Node)

---

## Special Directories

**`.planning/codebase/`**
- Purpose: GSD (good small documentation) codebase analysis and planning
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Generated: By `/gsd:map-codebase` command
- Consumed: By `/gsd:plan-phase` and `/gsd:execute-phase` commands
- Committed: Yes

**`docs/`**
- Purpose: High-level build specification and API contracts
- Contents: CLAUDE_CODE_BRIEF.md (9-agent spec), API_CONTRACTS.md (all system boundaries)
- Committed: Yes

**`schemas/`** (will move to `apps/studio/schemas/`)
- Purpose: Sanity document type definitions
- Wired into: `apps/studio/sanity.config.ts`
- Version-controlled: Yes
- Note: Currently at project root; should move to `apps/studio/schemas/` once studio app created

**`convex/` (ready)**
- Purpose: Convex database schema + query/mutation handlers
- Deployed: Via `npx convex deploy` (integrates with Railway or vercel)
- Version-controlled: Yes
- Note: Can exist at project root and be deployed independently of apps

---

## Build Sequence (See CLAUDE_CODE_BRIEF.md section "Build sequence")

1. **Sanity schema + Studio** — Wire schemas into studio, seed agentProfile docs
2. **Next.js shell** — Create `apps/web/`, pages, components, routing, mock data
3. **Convex setup** — Deploy schema, create query/mutation files
4. **Pipeline skeleton** — FastAPI + LangGraph wired, all 9 agents exist (stubs)
5. **Agent quality** — Implement agent logic (Calibrator, Scout, Editor first)
6. **PDF generation** — WeasyPrint template, Publisher uploads
7. **Game rendering** — Iframe sandbox, GameWriter HTML/JS
8. **Stripe integration** — Checkout, webhook
9. **Deliberation layer** — Convex subscriptions, live event display
10. **Podcast section** — Audio player, NotebookLM integration

---

## Key Commits / Milestones

**Scaffolding (done):**
- `convex/schema.ts` ✓
- `schemas/*.ts` ✓
- `docs/CLAUDE_CODE_BRIEF.md` ✓
- `docs/API_CONTRACTS.md` ✓

**Phase 1 — Infrastructure setup:**
- Create monorepo root (`package.json`, `pnpm-workspace.yaml`)
- Create `apps/web/` with Next.js setup
- Create `apps/studio/` with Sanity Studio
- Wire schemas into Studio
- Deploy Convex schema

**Phase 2 — Frontend shell:**
- Next.js routing (/, /issue/[slug], /archive, /shop, etc.)
- GROQ queries
- Theme CSS variable injection
- Mock issue data for testing

**Phase 3 — Pipeline skeleton:**
- FastAPI app with `/run` endpoint
- LangGraph graph definition
- All 9 agent nodes (stubs returning mock data)
- Sanity + Convex + Supabase client integration

**Phase 4 — Agent implementation:**
- Calibrator (style brief generation)
- Scout (web search, candidate finding)
- Advocate (scoring)
- Editor gate 1 (selection)
- Researcher + section writers (content generation)
- QA (review)
- Editor final (polish)
- Publisher (PDF + deploy)

**Phase 5 — Frontend integration + polish:**
- Convex subscriptions in deliberation layer
- Stripe checkout
- Podcast player
- PDF download button
- Game iframe rendering
- Theme switching per issue

