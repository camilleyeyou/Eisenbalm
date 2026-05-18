# The Eisenbalm Dispatch

## What This Is

A weekly AI-generated editorial website that spotlights an obscure charity each week, sells one product (Jesse A. Eisenbalm lip balm), and donates 100% of proceeds to the featured charity. Editorial content is produced by a nine-agent LangGraph pipeline; a human editor (Andrew) reviews and publishes via Sanity Studio. The site is a destination — it should feel like a magazine that happens to sell one product, not a newsletter.

## Core Value

Every Thursday, ship a complete, on-voice issue: one obscure charity, eight original sections (origin story, problem, founder bio, case study, game, bonus, deliberation, podcast), and a working shop callout — published only after Andrew's manual review.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**Foundation (Phase 1 — 2026-05-11)**
- ✓ Sanity v5 Studio renders all schema types (`charity`, `weeklyIssue`, `agentProfile`) with all fields editable — verified live in `6h1vd9mf/production`
- ✓ Sanity TypeGen produces `apps/studio/sanity.types.ts` (Charity / WeeklyIssue / AgentProfile / AllSanitySchemaTypes), re-exported via `packages/shared/src/sanity-types.ts`
- ✓ All 14 canonical agent profiles seeded with deterministic `agent-{agentId}` IDs (idempotent createOrReplace)
- ✓ Andrew can create and save a `weeklyIssue` draft with no schema validation error
- ✓ pnpm monorepo skeleton: `apps/{studio,web}` + `packages/{shared,pipeline}` workspaces resolve
- ✓ `agentProfile.ts` agentId list reconciled to brief's canonical 14 (D-11)

**Web Shell + Theme Engine (Phase 2 — 2026-05-12)**
- ✓ All 7 reader routes resolve: `/`, `/issue/[slug]`, `/archive`, `/charities`, `/charities/[slug]`, `/about`, `/shop` (shell)
- ✓ Issue page renders the 10 sections in locked order with slot placeholders for game / deliberation / podcast (Phases 7 / 9)
- ✓ Per-issue theme injected as CSS variables with hex regex validation + font whitelist + WCAG AA contrast fallback + `setProperty`-only (security-correct)
- ✓ Two-layer theme injection: server `serializeThemeCss()` inline `<style>` for FOUC + client `<ThemeApplier>` re-validation on hydration
- ✓ SEO surface: schema.org/Article JSON-LD, OG + Twitter cards, `/sitemap.xml`, `/feed.xml` (RSS 2.0), `/robots.txt`, og-default.png placeholder
- ✓ Reading time (238 WPM), anchor copy-link buttons (shadcn Tooltip + 1.5s fade), print stylesheet (no theme bleed)
- ✓ Demo content seed script (`pnpm seed:demo` → "The Quiet Foundation" + Issue 1) idempotent via deterministic `_id`s
- ✓ Andrew confirmed all 16 WEB-* requirements via smoke test

**Convex Deployment (Phase 3 — 2026-05-13)**
- ✓ Convex deployment `modest-magpie-797` live (dev tier as v1 single environment) with all 5 tables (`pipelineRuns`, `pitchLog`, `deliberationEvents`, `agentVotes`, `qaCorrections`) and 11 query/mutation functions deployed
- ✓ `convex/` promoted to `@eisenbalm/convex` workspace; `convex@^1.38.0` pinned; `convex/_generated/` committed (mirrors Phase 1 sanity-types pattern)
- ✓ Five function files byte-for-byte match `docs/API_CONTRACTS.md §4.1-4.5` (server-side `Date.now()` timestamps, `v.literal()` enum unions matching schema, `updateStatus` throws on missing run)
- ✓ `apps/web` Convex wiring: dep, `@convex/*` TS alias, `ConvexClientProvider` mounted in root layout with no-op fallback for missing env (D-16)
- ✓ `/_debug/convex` evidence route renders 5-row table proving `useQuery` returns `[]`/`null` against empty tables without error; live reactivity confirmed via dashboard insert → page update
- ✓ HTTP API mutation pathway verified (`Authorization: Convex <key>` works against `/api/mutation`) — Phase 4 Python pipeline unblocked
- ✓ Three-layer exclusion contract for `/_debug/*`: `robots.txt` Disallow, sitemap+RSS comment markers, page-level `noindex,nofollow` meta
- ✓ Phase 9 cleanup contract locked in 4 greppable locations (page TODO + 2 READMEs + convex/README footer)
- ✓ Andrew confirmed all 5 CVX-* requirements via 5-step smoke test (CVX-04 Vercel/Railway provisioning documented but deferred — projects don't yet exist)

### Active

<!-- Hypotheses until shipped. Grouped by build-brief sequence. -->

**Web shell (reads from Sanity, displays mock issue)**
- [ ] Reader can land on `/` and be redirected/routed to the latest published issue
- [ ] Reader can view a full issue at `/issue/[slug]` with all sections in correct order (charity header → origin story → problem → founder bio → case study → game → bonus → deliberation → podcast → shop callout)
- [ ] Reader can browse the archive at `/archive`, sortable by issue number, searchable by charity name / focus area
- [ ] Reader can browse the charity database at `/charities` and view individual charities at `/charities/[slug]`
- [ ] Each issue page injects `theme.{primary,accent,background,text}Color` and `theme.{fontDisplay,fontBody}` as CSS variables on `<html>` so typography and color change per issue while grid stays constant

**Pipeline skeleton (LangGraph + 9 agents, stub outputs)**
- [ ] FastAPI app deploys to Railway and exposes a "trigger weekly run" endpoint
- [ ] LangGraph graph wires all nine agents in correct sequence (Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → parallel{OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design} → QA → Editor[final])
- [ ] Each agent returns a structurally valid stub matching the LangGraph state contract
- [ ] Pipeline writes a complete `weeklyIssue` draft to Sanity at end of run
- [ ] Pipeline writes `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog` rows to Convex during/after run
- [ ] Editor gate 1 (no winner selectable) surfaces a pause to Andrew via Convex run state

**Agent quality (Calibrator, Scout, Editor are voice-critical)**
- [ ] Calibrator selects a `bonusType` (bigBudget | jingle | specAd) that never repeats two weeks in a row
- [ ] Scout uses web search (Tavily or Brave) to find 3-5 charity candidates per run with verifiable assets/focus area, writing each to `pitchLog` as it finds them
- [ ] Advocate produces an argument and 1-10 score for every Scout candidate, writing each to `deliberationEvents` as `advocate-argument`
- [ ] Editor (gate 1) selects exactly one winner with reasoning + runner-up notes + full deliberation transcript, writing `editor-decision` to `deliberationEvents`
- [ ] All section writers (OriginStory, Problem, FounderBio, CaseStudy) produce output in Jesse's voice as defined in CLAUDE_CODE_BRIEF.md
- [ ] QA agent reviews voice/factual accuracy/tone and writes corrections to `qaCorrections` with severity + acceptance status
- [ ] DesignAgent emits valid hex colors and valid Google Fonts names for the per-issue theme

**PDF generation**
- [ ] Publisher renders the Problem Statement to PDF via WeasyPrint (or Playwright) using `problemStatement.pdfContent`, themed to the issue's colors/fonts
- [ ] PDF uploads back to Sanity as `weeklyIssue.problemPdf` and is downloadable from the issue page

**Game rendering**
- [ ] GameWriter outputs self-contained HTML/JS (no external CDN, no dependencies) that renders inside `<iframe srcdoc={embedCode} sandbox="allow-scripts">`
- [ ] Game gamifies the specific charity's mission (not a generic quiz)

**Stripe / commerce**
- [ ] Reader can view the lip balm product at `/shop`
- [ ] Reader can complete a checkout via Stripe (custom integration, no Shopify)
- [ ] Reader lands on `/shop/thank-you` after successful checkout
- [ ] Stripe webhook updates order state on payment confirmation (signature-verified, idempotent)
- [ ] A small persistent shop callout appears at the bottom of every issue page (one sentence + button — no banner, no modal)

**Deliberation layer (live Convex subscriptions on issue page)**
- [ ] Issue page subscribes to `pitchLog` / `agentVotes` / `qaCorrections` / `deliberationEvents` by `runId` and renders them live
- [ ] Deliberation UI presents agent arguments with attribution to specific agent profiles

**Podcast section**
- [ ] Issue page renders an audio player and collapsible transcript pulling `podcast.audioFile` and `podcast.deliberationTranscript` from Sanity

**Andrew's editorial workflow**
- [ ] Andrew can review every field of a `weeklyIssue` draft in Sanity Studio and edit any of them
- [ ] Andrew must manually flip `status` from `draft` to `published` (no accidental publish path)
- [ ] On publish, a Sanity webhook triggers the Publisher agent (PDF generation → Vercel deploy → Convex `pipelineRuns.complete`)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Multi-product catalog or Shopify** — brief locks: one product (lip balm), custom Stripe only. Adding a catalog dilutes "magazine that happens to sell one product."
- **User accounts / login on the marketing site** — readers don't need accounts to read issues or buy lip balm. Adds auth surface area for no value.
- **Newsletter / email subscriptions** — brief explicitly: "the site is a destination, not a newsletter." Email distribution is anti-thesis of the brand.
- **AI-positioned marketing on the site** — brief: "the brand does not pivot to AI — Jesse was born AI. This is not a gimmick." No "powered by AI" badges, no model disclaimers in the editorial UI.
- **Automatic publishing without Andrew** — brief: only Andrew can flip `status` to `published`. The human gate is intentional.
- **Suno API integration in v1** — manual step for Andrew until API integration is decided. Pipeline emits `sunoPrompt`; Andrew pastes `sunoAudioUrl`.
- **Popups, urgency mechanics, countdown timers, modal upsells on /shop** — brief explicitly forbids these. The shop is one page, one button.
- **NotebookLM podcast generation in v1** — `deliberationTranscript` is the source; podcast audio production is a manual step (Andrew runs NotebookLM, pastes audio file). Automating it is post-v1.
- **Stack substitutions** — brief locks Next.js/Sanity/FastAPI/LangGraph/OpenRouter/Supabase/Convex/Stripe/WeasyPrint. No swapping (e.g. don't propose Astro, Strapi, Inngest, Vercel AI SDK).

## Context

**Brand voice (fragile, voice-critical):** Jesse's voice is dry, precise, absurdly serious. No winking. No irony signaling. The joke is that everything is played completely straight. Charities are treated with Fortune 500 gravity. The editorial question is always "Why do you deserve to exist?" — answered without sentiment. Voice drift is the highest-impact failure mode (the brand collapses), and the QA agent is the only automated guardrail.

**Three datastores, three roles:**
- **Sanity** — canonical content. Everything Andrew edits and publishes. The source of truth for the public site.
- **Convex** — live, ephemeral pipeline observability. The deliberation layer on the issue page reads directly from Convex.
- **Supabase** — pipeline state for the FastAPI/LangGraph backend (per Python SDK).

**Two human gates:**
- Editor gate 1 (in-pipeline) — pauses LangGraph if no winner can be selected; surfaces to Andrew via Convex run state.
- Andrew gate (terminal) — Sanity Studio review before publish. Single point of human control over what ships.

**Existing scaffolding:** `convex/schema.ts` and `schemas/{charity,weeklyIssue,agentProfile,index}.ts` are written and complete. They land in `apps/studio/schemas/` (Sanity) and the existing `convex/` directory (Convex). No package.json, no apps/, no packages/ — Phase 1 is wiring these schemas into a live Studio + Convex deployment.

**Reference docs (must remain consistent):**
- `docs/CLAUDE_CODE_BRIEF.md` — the canonical project spec (stack, agent pipeline, build sequence, voice notes)
- `docs/API_CONTRACTS.md` — exact shapes for every interface boundary (Next→Sanity GROQ, Pipeline→Sanity, Pipeline→Convex, Next→Convex, Sanity→Pipeline webhook, Stripe, LangGraph state)
- Field names in schemas must not be changed without updating these contracts.

## Constraints

- **Tech stack**: Next.js 14+ (App Router) on Vercel · Sanity v3 · FastAPI on Railway · LangGraph · OpenRouter · Supabase · Convex · Stripe · WeasyPrint or Playwright — locked by brief, do not substitute
- **Repository**: monorepo (`apps/web`, `apps/studio`, `packages/pipeline`, `packages/shared`, plus existing `convex/` and `schemas/`) — to be scaffolded in Phase 1
- **Cadence**: weekly issue. Pipeline must complete + Andrew must review + Publisher must deploy within a Thu→Thu window. Slow pipelines or Andrew bottlenecks break the format.
- **Voice**: Jesse's voice is non-negotiable. Voice drift = brand failure. QA + Editor Final are the automated guards; Andrew is the manual guard.
- **AI cost**: 9 agents per run × multiple OpenRouter calls + web search. Per-run cost containment matters.
- **Security**: Game agent emits HTML/JS rendered inside `iframe srcdoc sandbox="allow-scripts"` — must be airtight. Theme injects CSS variables — must validate hex colors and font names.
- **Andrew is single-threaded**: no backup reviewer specified. If Andrew is offline, no issue ships that week.
- **Stripe is custom**: no Shopify, no Commerce.js, no urgency mechanics. Webhook signature verification + idempotency required.

## Key Decisions

<!-- Decisions that constrain future work. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lock the stack (Next/Sanity/Convex/FastAPI/LangGraph/OpenRouter/Supabase/Stripe/WeasyPrint) | Brief explicitly: "do not substitute." Avoids stack-shopping rabbit holes during build. | ✓ Good (Phase 1) |
| Sanity v5 (not brief's v3) | Brief was written before v5 stabilized; v5 is current stable with TypeGen GA + React 19. | ✓ Good (Phase 1) |
| Next.js 15.3.x (not 16) | `next-sanity@^12.4.5` has documented overage bug on Next.js 16; @cache-components tag forbidden. | ✓ Good (Phase 2) |
| Tailwind v4 with `@theme` directives | Native CSS-variable theming pairs cleanly with per-issue theme injection. | ✓ Good (Phase 2) |
| shadcn primitives (button + tooltip) for shop/anchor only; editorial surfaces all custom | Official registry only, no third-party. Custom editorial keeps magazine feel. | ✓ Good (Phase 2) |
| Two-layer theme injection (server `<style>` + client ThemeApplier) | Server prevents FOUC; client re-validates on hydration as defense-in-depth. | ✓ Good (Phase 2) |
| Three datastores (Sanity canonical, Convex live, Supabase pipeline state) | Each store has a distinct role; merging would compromise either editorial workflow or real-time observability. | — Pending |
| Andrew is the only publish gate | Brief: editorial control over what ships. Trades cadence robustness for brand integrity. | — Pending |
| 9 named agents (not "an LLM call") | Each agent has a profile in Sanity (`agentProfile`) and shows up by name in the deliberation UI. The agents are part of the editorial product, not infrastructure. | — Pending |
| Game rendered inside `iframe srcdoc sandbox` | Untrusted LLM HTML/JS isolated from main page. Must be self-contained (no CDN). | — Pending |
| Custom Stripe (no Shopify) | Brief: no Shopify. One product, no catalog, no carts. | — Pending |
| Build order from brief: Studio → Web shell → Convex → Pipeline skeleton → Agent quality → PDF → Game → Stripe → Deliberation → Podcast | Each step is independently testable. Voice-critical agents (Calibrator, Scout, Editor) get focused phase rather than buried under skeleton work. | — Pending |
| Suno integration deferred (manual paste) | API integration not decided; pipeline emits prompt + Andrew pastes audio URL. | — Pending |
| NotebookLM podcast generation deferred (manual) | Same as Suno — out of v1 to keep weekly cadence achievable. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-18 after Phase 5 (Agent Quality) completion — all 14 stub agents replaced by real LLM-driven implementations; first real-mode end-to-end run succeeded on issue 999 (155s, awaiting-review, Andrew-approved Sanity content, 0 QA violations); 7 production defects caught and fixed during Plan 05-15 smoke test. One carry-forward to Phase 6: langchain-openai `with_structured_output` does not expose usage_metadata, so PIPELINE_COST_CAP_USD enforcement is non-functional until the metadata capture is fixed.*
