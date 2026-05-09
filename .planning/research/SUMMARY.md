# Project Research Summary

**Project:** The Eisenbalm Dispatch
**Domain:** Weekly AI-generated editorial site + 9-agent LangGraph pipeline + custom one-product Stripe ecommerce
**Researched:** 2026-05-09
**Confidence:** HIGH

## Executive Summary

The Eisenbalm Dispatch is a weekly editorial product driven by a nine-agent LangGraph pipeline (FastAPI on Railway), published via Sanity Studio by a single human editor (Andrew), and deployed to Vercel on publish via webhook. The system couples five distinct services — Sanity (canonical content), Convex (real-time pipeline observability), Supabase/Postgres (LangGraph checkpoint state), Railway (pipeline execution), and Vercel (frontend) — through a single immutable `runId` that must flow identically through every write to every datastore on every weekly run. The stack is entirely locked by the build brief; research validated exact versions, confirmed compatibility matrices, and identified operational failure modes.

The build sequence confirmed by research mirrors the brief's order: schemas first (Sanity + Convex schemas already exist and need wiring into live projects), web shell second, Convex function deployment third, then pipeline skeleton with stubs, then agent quality, then PDF/webhook chain, then game rendering, then Stripe, then deliberation UI, then podcast section. Every ordering constraint is a hard architectural dependency — not a preference.

The three failure modes that can collapse the product are: (1) **voice drift** — Jesse's dry register is the entire brand; QA agent and Editor Final are the only automated guardrails, and Calibrator output structurally contaminates all seven downstream section writers if not isolated; (2) **hallucinated real-person content** — Researcher must require a `sourceUrl` for every named founder or case study subject or fall back to anonymous framing (legal risk with documented defamation precedent); (3) **`runId` mismatch across datastores** — if generated more than once per run, the deliberation layer returns zero events for every issue indefinitely.

## Key Findings

### Recommended Stack

The brief locks the stack and research confirmed compatibility. Detailed versions and companion libraries in `STACK.md`.

**Core technologies:**
- **Next.js 15.3.x (NOT 16)** — `next-sanity@^11` SanityLive has documented 4-10x request overage on Next.js 16; hold at 15 until next-sanity v12 ships
- **Sanity v5.24+** — brief says "v3"; v5 is current stable, React 19 compatible, includes TypeGen GA (auto-generates TS types from schemas + GROQ queries) — enable on day one
- **Convex** — schema already written; deploy as-is; no auth needed for public reads
- **FastAPI + LangGraph 1.x + langgraph-checkpoint-postgres** — `interrupt()` inside Editor gate node (not `interrupt_before`); requires Postgres checkpointer (Supabase) for persistence across Railway restarts
- **OpenRouter via langchain-openai** — pin model versions for voice-critical agents (Calibrator, Editor, QA)
- **WeasyPrint with Dockerfile on Railway** — Nixpacks lacks `libgobject-2.0-0`/`libcairo2`; ship with custom Dockerfile from Phase 4
- **Stripe Checkout + Route Handlers** — raw body via `request.text()` for signature verification; unconditional webhook verification (no dev-mode bypass)
- **Tavily** for Scout/Researcher web search — first-class LangGraph tool integration

**Sharp edges flagged by research:**
- No real Sanity Python SDK (`sanity` PyPI is a stub) — pipeline writes use `httpx` against Sanity Content REST API directly; `API_CONTRACTS.md §2` import is illustrative, not literal
- WeasyPrint Google Fonts via HTTP fails in production (issues #2031, #2126) — fonts must be base64-bundled inline `@font-face`
- Sanity CDN propagation race vs Vercel deploy hooks — fix with `useCdn: false` in build-time client + 30s pre-deploy delay

### Expected Features

Three distinct surfaces with separate feature landscapes. Detail in `FEATURES.md`.

**Must have (table stakes):**

*Editorial:*
- Latest issue at `/`, individual issue at `/issue/[slug]`, archive at `/archive`, charity database at `/charities`
- Per-issue theme switching via CSS variables (genuine differentiator)
- `schema.org/Article` JSON-LD per issue (Google AI Mode citation), Open Graph tags, XML sitemap, RSS feed, mobile-responsive
- Print stylesheet, estimated reading time, per-section anchor copy-link, contrast-validated theme colors

*Deliberation layer:*
- Live `pitchLog` / `agentVotes` / `qaCorrections` / `deliberationEvents` from Convex by `runId`
- Collapsed by default — primary reading experience is editorial, deliberation is optional depth
- Agent identity cards (named characters, not "an LLM") — never expose model names ("written by Claude")

*Ecommerce:*
- `/shop` product page, custom Stripe Checkout, `/shop/thank-you`
- Webhook signature verification, idempotent on `event.id`
- Privacy policy at `/legal/privacy` (required by Stripe TOS + GDPR/CCPA)
- Persistent shop callout on every issue page (one sentence + button — no banner, no modal)

**Should have (differentiators):**
- Per-issue `og:image` rendered from theme + charity name
- Source citations visible in deliberation events (Scout's research links surfaced to readers)
- Charity-page issue history (this charity was featured in issues N1, N2…)

**Defer (v2+):**
- Suno API integration (manual paste in v1)
- NotebookLM podcast generation (manual paste in v1)
- Search/filter on archive beyond "by charity name / focus area"
- User accounts, comments, email subscriptions (out of scope by brief)

### Architecture Approach

Three-store, two-gate architecture with one `runId` threading the entire weekly pipeline. Detail in `ARCHITECTURE.md`.

**Major components:**
1. **Sanity Studio + content** — canonical content; the only store Andrew edits; `weeklyIssue` lifecycle (draft → published) is the editorial workflow
2. **Convex functions + schema** — pipeline observability; immutable run history; one-way write from pipeline; readers subscribe via `useQuery`
3. **Supabase Postgres** — `AsyncPostgresSaver` LangGraph checkpoint backend ONLY (no manual tables); `checkpointer.setup()` runs once at deploy time, never on startup
4. **FastAPI pipeline (Railway)** — `/run/weekly` endpoint; LangGraph graph wires 14 agents (9 named + Researcher + Publisher + 2 editor invocations); fan-out to 7 parallel section writers; `interrupt()` inside Editor gate 1
5. **Next.js web (Vercel)** — App Router; reads from Sanity (`useCdn: true` for runtime, `false` for build-time Publisher webhook); subscribes to Convex; embeds game iframe with `sandbox="allow-scripts"`
6. **Sanity → Publisher webhook** — HMAC-verified, age-checked (5min), idempotency-key deduplicated via Supabase table; triggers PDF render → Sanity asset upload → Vercel deploy hook (30s delay)

**Datastore ownership rules (LOCKED):**
| Data | Owner | Replicated where |
|---|---|---|
| Issue content | Sanity | nowhere |
| Charity records | Sanity | nowhere |
| Agent profiles | Sanity | nowhere |
| Run status | Convex `pipelineRuns` | nowhere |
| Pitch log | Convex `pitchLog` | nowhere |
| Agent votes | Convex `agentVotes` | nowhere |
| Deliberation events | Convex `deliberationEvents` | nowhere |
| QA corrections | Convex `qaCorrections` | nowhere |
| LangGraph checkpoint | Supabase | nowhere |
| `runId` | generated once in pipeline | written to Sanity `pipelineMetadata.runId` + every Convex row |

### Critical Pitfalls

Top 5 from `PITFALLS.md` (26 total cataloged).

1. **Voice drift via shared LangGraph state** — research published April 2026 (arxiv 2604.01350) shows 57-71% benign cross-agent contamination in shared-state pipelines. Scout's enthusiasm bleeds into writers' tone. **Prevention:** structurally isolate Calibrator's voice constants (immutable; not re-generated per node); prompt construction functions; voice audit cadence every 4 issues.

2. **Hallucinated founders / case study subjects** — naming a real person with fabricated biographical details meets defamation elements. **Prevention:** mandatory `sourceUrl` field on every named individual; post-Researcher source-confirmation step (httpx fetch of charity website + string-search for name); anonymous fallback if `founderNameVerified: false`; Sanity Studio warning surfaced to Andrew.

3. **iframe sandbox escape** — `sandbox="allow-scripts allow-same-origin"` completely negates the sandbox. **Prevention:** lint rule blocking `allow-same-origin`; automated HTML/JS validator on every GameWriter output (no `window.parent`, no `fetch`, no `document.cookie`); CSP `<meta>` injected into srcdoc.

4. **Sanity CDN propagation race** — Publisher fires Vercel deploy hook before published issue is on the CDN; Vercel build reads stale data; new issue isn't on the live site after deploy completes. **Prevention:** 30-second pre-deploy delay in Publisher; `useCdn: false` in the build-time Sanity client; Vercel ISR or full rebuild on publish.

5. **`runId` mismatch across datastores** — generated more than once per run; Sanity says runId=A, Convex says runId=B; deliberation layer queries by `runId` and returns nothing forever. **Prevention:** generate exactly once as the first field of `DispatchState`; never call `uuid()` again in any agent; integration test asserting `weeklyIssue.pipelineMetadata.runId == convex.pipelineRuns.runId`.

**Cross-cutting risks every phase must address:**
- Theme injection: hex validation + CSS `setProperty` (NOT template literals — CVE GHSA-97v6-998m-fp4g pattern)
- Webhook idempotency: deterministic `_id`s; Sanity `idempotency-key` deduplication; Stripe `event.id` deduplication
- Cost containment: iteration limits on Scout/Researcher; per-run cost logging; alert if a run exceeds threshold

## Implications for Roadmap

Suggested phase structure: **10 phases**.

### Phase 1: Sanity Foundation
**Rationale:** Schemas exist (`schemas/charity.ts`, `weeklyIssue.ts`, `agentProfile.ts`); nothing else can render or write content until they're live.
**Delivers:** Live Sanity project; `apps/studio/` Studio v5 deployed; schemas wired; TypeGen enabled; one `agentProfile` document seeded per agent (14 total).
**Addresses:** Foundation table stakes from FEATURES.md.
**Avoids:** Late TypeGen retrofit pain; missing agent profiles when pipeline tries to attribute events.

### Phase 2: Web Shell + Theme Engine
**Rationale:** With Sanity content available, the entire reader experience can be scaffolded with mock/seeded data — no pipeline needed yet. Theme injection security must be correct here before any DesignAgent output reaches the frontend.
**Delivers:** All routes (`/`, `/issue/[slug]`, `/archive`, `/charities`, `/charities/[slug]`, `/shop`, `/about`); per-issue theme via CSS `setProperty` with hex validation; `schema.org/Article` JSON-LD; OG tags; sitemap; RSS; print stylesheet; estimated reading time.
**Uses:** Next.js 15 + `next-sanity@^11` + Sanity TypeGen.
**Avoids:** CSS injection via theme (Pitfall 4); CDN race not yet relevant — webhook-driven build is later.

### Phase 3: Convex Deployment
**Rationale:** Convex `_generated/api.d.ts` must exist before pipeline skeleton type-checks against Convex mutations. Frontend deliberation queries can be wired against empty tables now and switched on later.
**Delivers:** Convex deployed (`convex/schema.ts` already exists); query/mutation functions for `pipelineRuns.byRunId`, `pitchLog.byRunId`, `agentVotes.byRunId`, `qaCorrections.byRunId`, `deliberationEvents.byRunId`, plus mutation counterparts; CONVEX_DEPLOY_KEY provisioned; web app verifies subscriptions don't error on empty tables.
**Avoids:** Late binding between pipeline writes and frontend reads; type drift between manually-typed Convex contracts and reality.

### Phase 4: Pipeline Skeleton (LangGraph + Stubs)
**Rationale:** Build the contracts before the content. With all 14 agent stubs returning structurally valid output, the LangGraph state contract, the three-datastore writes, the Editor gate 1 interrupt, and the runId discipline can all be validated cheaply.
**Delivers:** FastAPI on Railway (Dockerfile from day one); `/run/weekly` endpoint; full LangGraph graph wired (Calibrator → Scout → Advocate → Editor[gate 1, `interrupt()`] → Researcher → fan-out{Origin, Problem, FounderBio, CaseStudy, Game, Bonus, Design} → QA → Editor[final]); stub agents emit valid LangGraph state shape; `runId` generated exactly once; Convex writes verified at every step; Sanity weeklyIssue draft written at end; `AsyncPostgresSaver` checkpointer wired with `checkpointer.setup()` as deploy hook.
**Resolves open question:** Supabase role = AsyncPostgresSaver only.
**Avoids:** runId mismatch (Pitfall 5); state contract changes after agent quality work begins; `interrupt()` discipline (no try/except, idempotent pre-interrupt code) tested early.

### Phase 5: Agent Quality (voice + factual safety)
**Rationale:** Densest phase for pitfall prevention. Calibrator/Editor/QA are voice-critical; Researcher gates real-person content; DesignAgent gates theme security. Stubs from Phase 4 become real LLM-driven agents one at a time.
**Delivers:** Calibrator with hardcoded voice constants + bonus-type rotation; Scout with Tavily + iteration limits + incremental `pitchLog` writes; Advocate looping over candidates with score 1-10; Editor (gate 1) with structured deliberation transcript + `interrupt()` on no-winner; Researcher with mandatory `sourceUrl` enforcement and anonymous fallback; OriginStory/Problem/FounderBio/CaseStudy writers in Jesse voice (each rejecting Calibrator brief contamination); Bonus writer with three branches (bigBudget/jingle/specAd); Design with hex validation, Google Fonts API check, WCAG contrast validation; QA voice rubric; Editor Final.
**Resolves open question:** Font whitelist (DesignAgent restricted to ~25 fonts safe for both web + WeasyPrint); factual verification mechanism (httpx + string-search of charity website).
**Avoids:** Voice drift (Pitfall 1); hallucinated founders (Pitfall 2); CSS injection upstream of Phase 2's defenses; runaway agent costs.

### Phase 6: PDF Generation + Publisher Webhook Chain
**Rationale:** WeasyPrint needs real ProblemWriter `pdfContent` and DesignAgent `theme` from Phase 5. Webhook chain is its own surface area (signature, idempotency, retry, deploy hook timing) that's worth isolating.
**Delivers:** WeasyPrint Dockerfile additions; Problem Statement PDF template (themed per issue); fonts bundled as base64 inline `@font-face` (NOT loaded via HTTP); Publisher agent triggered by Sanity webhook (HMAC + 5min age check + idempotency-key deduplication via Supabase table); 30-second pre-delay before Vercel deploy hook; `useCdn: false` in build-time Sanity client; manual `/run/{run_id}/publish` re-trigger fallback endpoint.
**Avoids:** Sanity CDN race (Pitfall 4); WeasyPrint font HTTP failure; webhook replay attacks; Publisher death-by-Railway-restart.

### Phase 7: Game Rendering (sandbox-safe iframe)
**Rationale:** GameWriter exists from Phase 5 but its frontend rendering needs its own security gate. The validator has to be passing before any game reaches a real reader.
**Delivers:** GameWriter prompt mandates inline-only resources (no CDN, no external `<script src=>`); automated HTML/JS validator (rejects `window.parent`, `fetch(`, `document.cookie`, `top.`, `parent.`); CSP `<meta>` in srcdoc; mobile-safe responsive iframe sizing; render fallback if validator fails (re-prompt or skip section with editor note).
**Avoids:** Sandbox escape (Pitfall 3).

### Phase 8: Stripe / Commerce
**Rationale:** Independent of pipeline; depends only on `/shop` route from Phase 2. Can run in parallel with later phases.
**Delivers:** `/shop` with current-issue charity callout (server-rendered, no client-side flicker); Stripe Checkout via `checkout.sessions.create()`; `/shop/thank-you` (static, no DB query); webhook handler with raw-body signature verification (`request.text()`), unconditional verification, idempotency on `event.id`; `/legal/privacy` page (Stripe TOS + GDPR/CCPA); shipping rate config; persistent shop callout on every issue page (one sentence + button only).
**Resolves open question:** Stripe product/price/shipping configured in dashboard before code can complete.
**Avoids:** Webhook signature bypass; double-fulfillment race (idempotent on `event.id`); urgency mechanics / popups (brief explicitly forbids).

### Phase 9: Deliberation Layer (Convex live UI)
**Rationale:** Needs real pipeline runs from Phases 4-5 to display anything meaningful. UI design is judgment-heavy (collapsed by default; what's legible vs cluttered).
**Delivers:** `<DeliberationLayer runId={runId} />` component on issue page; subscriptions via `useQuery` for all 5 Convex tables; advocate score bars; QA severity colors; agent identity cards using `agentProfile` from Sanity; collapsed-by-default accordion; graceful empty states; pitch log timeline.
**Avoids:** Showing model names ("written by Claude") — anti-feature from FEATURES.md research.

### Phase 10: Podcast Section
**Rationale:** Lightweight; depends on `podcast.audioFile` field that Andrew populates manually post-NotebookLM.
**Delivers:** HTML5 `<audio>` player on issue page; collapsible transcript pulling `podcast.deliberationTranscript`; "Audio coming soon" empty state when no audio file uploaded yet.

### Phase Ordering Rationale

Hard dependencies (cannot reorder):
- Phase 1 → Phase 2 (Sanity content before web shell renders anything)
- Phase 3 → Phase 4 (Convex `_generated/api.ts` before pipeline writes Convex)
- Phase 1+2+3 → Phase 4 (pipeline skeleton writes to all three stores)
- Phase 4 → Phase 5 (stubs establish contracts cheaply before LLM cost)
- Phase 5 → Phase 6 (WeasyPrint needs real ProblemWriter + DesignAgent output)
- Phase 5 → Phase 7 (GameWriter exists in Phase 5; rendering security gate is Phase 7)
- Phase 4+5 → Phase 9 (deliberation UI needs real Convex data from a real pipeline run)
- Phase 2 → Phase 8 (Stripe needs `/shop` route)

Parallelism opportunities:
- Phase 8 (Stripe) can run in parallel with Phases 5-7 once Phase 2 is done
- Phase 10 (Podcast) can run in parallel with Phase 8/9
- Within Phase 5, the seven section writers share input shape and can be planned/executed in parallel waves

Avoids:
- Late voice work (voice-critical agents in Phase 5, not buried in skeleton)
- Late security work (theme + sandbox + webhook signatures all in their respective phases, not deferred to "polish")
- Three-datastore drift (pipeline skeleton in Phase 4 validates the contract before content work begins)

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 4:** LangGraph `interrupt()` + `AsyncPostgresSaver` integration patterns (specific version pairing; common pitfalls around resume semantics)
- **Phase 5:** QA voice rubric design specific to Jesse's brand voice (novel; cannot inherit from generic LLM eval libraries)
- **Phase 6:** WeasyPrint font bundling approach + webhook idempotency-key pattern (high-specificity)
- **Phase 7:** Automated HTML/JS validator for LLM-generated game output (novel problem; no off-the-shelf validator)

Phases with standard patterns (skip research-phase):
- **Phase 1:** Sanity Studio v5 setup
- **Phase 2:** Next.js App Router + Server Components + Sanity reads
- **Phase 3:** Convex schema deploy + function wiring
- **Phase 8:** Stripe Checkout + Route Handlers
- **Phase 9:** Convex `useQuery` subscriptions + UI composition
- **Phase 10:** HTML5 audio player

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry + PyPI on 2026-05-09; compatibility matrix confirmed against official docs |
| Features | HIGH (editorial/ecommerce), MEDIUM (deliberation UI) | Editorial + commerce surfaces are well-understood; deliberation UI design (collapsed vs open, agent cards vs lists) is judgment-heavy |
| Architecture | HIGH | LangGraph patterns verified against 1.x docs; three-datastore boundaries explicit; webhook idempotency verified against Sanity official docs |
| Pitfalls | HIGH (technical), MEDIUM (legal/factual) | CSS injection has CVE reference; sandbox breakout is MDN-documented; legal exposure from hallucinated real-person content flagged but not fully scoped |

**Overall confidence:** HIGH

### Gaps to Address

- **Per-run LLM cost** — validate during Phase 5 with real OpenRouter calls; alert threshold should be set after baseline measured
- **WeasyPrint render performance on Railway** — validate during Phase 6 with minimal test render before building full template; if too slow, fallback to Playwright
- **Stripe product/price/shipping config** — Andrew must configure in Stripe dashboard before Phase 8 code can complete (price ID, shipping rates, product description)
- **Convex retention policy** — brief calls Convex "ephemeral" but reader-facing deliberation layer needs all historical issues forever; decision: retain indefinitely (re-evaluate at first cost concern)
- **`/about` page copy** — not specified in brief; Andrew must provide before Phase 2 closes
- **Font whitelist** — DesignAgent must be restricted; Andrew or designer must approve final list of ~25 fonts before Phase 5 closes

## Sources

### Primary (HIGH confidence)
- npm registry / PyPI — all package versions verified 2026-05-09
- Sanity v5 official docs — TypeGen, schema patterns, webhook delivery semantics
- LangGraph 1.x official docs — `interrupt()`, `AsyncPostgresSaver`, fan-out patterns, checkpointer setup
- Stripe official docs — Checkout, webhook signature verification, idempotency
- MDN — `<iframe sandbox>` attribute semantics
- WeasyPrint GitHub issues #2031, #2126, #1581 — font HTTP loading failures
- arxiv 2604.01350 (April 2026) — multi-agent state contamination rates
- CVE GHSA-97v6-998m-fp4g — CSS injection via theme color fields in CMS context

### Secondary (MEDIUM confidence)
- Sanity community post-mortems — Vercel deploy hook CDN race
- OpenRouter production patterns — model routing, fallback logic
- Tavily LangGraph integration docs — first-class tool wiring

### Tertiary (LOW confidence — none load-bearing)
- General industry reports on agentic observability UX patterns (deliberation layer design judgment)

---
*Research completed: 2026-05-09*
*Ready for roadmap: yes*
