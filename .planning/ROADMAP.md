# Roadmap: The Eisenbalm Dispatch

## Overview

Nine phases take The Eisenbalm Dispatch from bare schemas to a live weekly editorial product. Phase 1 wires Sanity Studio into a deployable project; Phase 2 builds the full reader experience against mock data; Phase 3 deploys Convex functions; Phase 4 builds the pipeline skeleton with stub agents that validate every datastore contract; Phase 5 replaces stubs with real LLM-driven agents (the densest, most brand-critical phase); Phase 6 wires the PDF generation and the Sanity-to-Vercel webhook chain; Phase 7 adds the iframe game with its security validator; Phase 8 (parallel to 5-7 once Phase 2 is done) completes the Stripe commerce surface; Phase 9 finishes the issue page with the live Convex deliberation layer and the podcast section.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Sanity Foundation** - Wire existing schemas into a live Sanity v5 Studio with TypeGen, seeded agent profiles, and Andrew's editorial access
- [x] **Phase 2: Web Shell + Theme Engine** - All reader-facing routes on Next.js 15 reading from Sanity, with secure per-issue CSS-variable theming and full SEO metadata
- [ ] **Phase 3: Convex Deployment** - Deploy schema, wire all query/mutation functions, provision keys, and verify empty-table subscriptions from the web app
- [ ] **Phase 4: Pipeline Skeleton** - FastAPI on Railway with the full LangGraph graph wired, all 14 stub agents, runId discipline, three-datastore writes, and Editor gate 1 interrupt validated cheaply before LLM cost
- [ ] **Phase 5: Agent Quality** - Replace every stub with a real LLM-driven agent; enforce voice isolation, factual verification, bonus branching, hex/font validation, and Jesse-voice QA rubric
- [ ] **Phase 6: PDF + Webhook Chain** - WeasyPrint PDF from real ProblemWriter output; Sanity-to-Railway webhook with HMAC, age check, idempotency, 30s delay, and Vercel deploy hook
- [ ] **Phase 7: Game Rendering** - iframe sandbox with automated HTML/JS validator, CSP meta injection, mobile sizing, and render fallback wired to Andrew notification
- [ ] **Phase 8: Stripe / Commerce** - `/shop` product page, Stripe Checkout, `/shop/thank-you`, raw-body webhook with idempotency, legal pages, and persistent shop callout
- [ ] **Phase 9: Issue Page Completion** - Live Convex deliberation UI (subscriptions, agent identity cards, collapsed accordion) and podcast audio player + transcript, completing the full reading experience

## Phase Details

### Phase 1: Sanity Foundation
**Goal**: Andrew can log into a live Sanity Studio, edit any field of a weekly issue draft, and the project generates TypeScript types from schemas so the web app can consume Sanity content with full type safety
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04
**Success Criteria** (what must be TRUE):
  1. Andrew can open Sanity Studio at the deployed URL, navigate to each schema type (`charity`, `weeklyIssue`, `agentProfile`), and edit every field without errors
  2. Running `sanity typegen generate` produces a `sanity.types.ts` file with no missing types for any schema field
  3. All 14 named agent profiles (`calibrator`, `scout`, `advocate`, `editor`, `researcher`, `origin-story`, `problem-statement`, `founder-bio`, `case-study`, `game`, `bonus`, `design`, `qa`, `publisher`) exist as seeded documents visible in Studio
  4. Andrew can create a new `weeklyIssue` draft, fill any field, and save without a schema validation error
**Plans**: 7 plans
- [x] 01-01-repo-bootstrap-PLAN.md — Monorepo skeleton (root package.json, pnpm-workspace.yaml, tsconfig.base.json, .gitignore, .env.example)
- [x] 01-02-sanity-init-checkpoint-PLAN.md — Andrew runs `npx sanity@latest init` and populates apps/studio/.env.local (manual step)
- [x] 01-03-studio-scaffold-PLAN.md — Stand up apps/studio with Sanity v5, relocate schemas, apply D-11 agentProfile description fix
- [x] 01-04-workspace-placeholders-PLAN.md — packages/shared (with Sanity-types re-export hook) plus apps/web and packages/pipeline placeholders
- [x] 01-05-typegen-pipeline-PLAN.md — Wire Sanity TypeGen end-to-end and re-export through @eisenbalm/shared
- [x] 01-06-agent-seed-PLAN.md — Idempotent seed of all 14 canonical agentProfile documents
- [x] 01-07-readme-and-smoke-test-PLAN.md — apps/studio/README.md onboarding doc + Andrew's end-to-end smoke test

### Phase 2: Web Shell + Theme Engine
**Goal**: A reader can navigate all issue pages, the archive, the charity database, and the about page; each issue page applies a per-issue theme via validated CSS variables; the site emits correct SEO metadata, JSON-LD, sitemap, and RSS feed
**Depends on**: Phase 1
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08, WEB-09, WEB-10, WEB-11, WEB-12, WEB-13, WEB-14, WEB-15, WEB-16
**Success Criteria** (what must be TRUE):
  1. A reader landing on `/` is redirected to the latest published issue (or a graceful "no issue yet" state); `/issue/[slug]`, `/archive`, `/charities`, `/charities/[slug]`, `/about`, and `/shop` (shell only, no Stripe yet) all resolve without 404 or console errors
  2. An issue page seeded with a theme that has an invalid hex string (e.g. `"red"`) renders the fallback colors without crashing; a theme with a passing hex string injects those values as CSS variables on `<html>` using `element.style.setProperty` (not template literals)
  3. WCAG AA contrast is checked at render time for any theme; a low-contrast theme pair triggers the fallback without a JS exception
  4. Viewing source of any published issue page shows `schema.org/Article` JSON-LD with charity name, founder, publish date, and `author=Jesse`; Open Graph and Twitter card tags are present; `/sitemap.xml` and `/feed.xml` return valid XML listing published issues
  5. A reader printing any issue page gets clean output without theme background colors bleeding into the print view; estimated reading time is visible on each issue page; every section has a working anchor copy-link button
**Plans**: 11 plans
- [x] 02-01-web-bootstrap-PLAN.md — Install Next 15.3.x + Tailwind v4 + supporting deps; wire tsconfig, next.config, PostCSS, env.example, root scripts
- [x] 02-02-sanity-reader-PLAN.md — Sanity client (runtime + build-time) + 6 canonical GROQ queries + result types + urlFor image helper
- [x] 02-03-theme-engine-PLAN.md — Hex/font/WCAG-validated theme engine; serializeThemeCss + applyTheme; node-test smoke tests
- [x] 02-04-demo-content-seed-PLAN.md — Idempotent demo charity + published issue seed (warm-cream theme for theme-engine visibility)
- [x] 02-05-root-layout-globals-PLAN.md — Root layout + globals.css + Tailwind v4 @theme + print stylesheet + SiteHeader/SiteFooter + JsonLd + reading-time + not-found + error
- [x] 02-06-issue-route-PLAN.md — /issue/[slug] 10-section render + theme injection + JSON-LD Article + reading time + anchor copy + slot placeholders
- [x] 02-07-archive-route-PLAN.md — /archive list with client-side search + sort + ArchiveItem
- [x] 02-08-charities-routes-PLAN.md — /charities + /charities/[slug] with JSON-LD NGO + external link safety
- [x] 02-09-home-about-shop-PLAN.md — Homepage redirect + empty state + /about placeholder + /shop Phase 2 shell
- [x] 02-10-sitemap-rss-og-PLAN.md — sitemap.ts (dynamic) + feed.xml Route Handler (RSS 2.0) + robots.txt + og-default.png placeholder
- [x] 02-11-readme-and-smoke-test-PLAN.md — apps/web/README.md onboarding doc + Andrew's manual WEB-* smoke test (autonomous: false)
**UI hint**: yes

### Phase 3: Convex Deployment
**Goal**: Convex is deployed with the existing schema, all query and mutation functions exist and type-check, environment keys are provisioned, and the web app's `useQuery` subscriptions return empty arrays without errors against empty tables
**Depends on**: Phase 1
**Requirements**: CVX-01, CVX-02, CVX-03, CVX-04, CVX-05
**Success Criteria** (what must be TRUE):
  1. `npx convex dev` completes without errors, deploys the schema, and generates `convex/_generated/api.ts` matching the five tables in `convex/schema.ts`
  2. Calling each of the five query functions (`pipelineRuns.byRunId`, `pitchLog.byRunId`, `agentVotes.byRunId`, `qaCorrections.byRunId`, `deliberationEvents.byRunId`) via the Convex dashboard against a non-existent `runId` returns an empty array rather than an error
  3. `CONVEX_DEPLOY_KEY` is stored in both Vercel and Railway environment configurations; a `useQuery` call on the live web app returns without an authentication error even when the table is empty
**Plans**: 8 plans
- [x] 03-01-convex-workspace-bootstrap-PLAN.md — Promote convex/ to @eisenbalm/convex pnpm workspace, pin convex@^1.38.0, root scripts, env.example entries
- [x] 03-02-convex-init-checkpoint-PLAN.md — Andrew runs `pnpm --filter @eisenbalm/convex exec convex dev --once --configure` (manual, autonomous: false)
- [x] 03-03-query-mutation-functions-PLAN.md — Five Convex function files (verbatim from API_CONTRACTS §4.1–4.5)
- [x] 03-04-codegen-and-deploy-PLAN.md — `convex deploy` pushes schema + functions; commits convex/_generated/ (autonomous: false)
- [x] 03-05-web-convex-wiring-PLAN.md — apps/web Convex dep, @convex/* TS alias, ConvexClientProvider mount with D-16 fallback
- [x] 03-06-debug-route-and-exclusions-PLAN.md — /_debug/convex evidence route + robots.txt + sitemap/RSS exclusions + TODO(Phase 9)
- [x] 03-07-documentation-PLAN.md — convex/README.md (new) + apps/web/README.md Convex section + Phase 9 cleanup contract
- [x] 03-08-smoke-test-PLAN.md — Andrew runs end-of-phase 6-step smoke test (autonomous: false)

### Phase 4: Pipeline Skeleton
**Goal**: A FastAPI app on Railway runs a full LangGraph graph where all 14 stub agents return structurally valid outputs, the `runId` is generated exactly once and threaded to every Convex write and the Sanity draft, the Editor gate 1 interrupt surfaces correctly to Convex, and per-run cost and duration are logged — all verified cheaply before any LLM spend
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: PIP-01, PIP-02, PIP-03, PIP-04, PIP-05, PIP-06, PIP-07, PIP-08, PIP-09, PIP-10, PIP-11, PIP-12, OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. `POST /run/weekly` on the Railway-deployed FastAPI app completes a full stub pipeline run and returns `{runId}` without raising an exception; the Railway logs show each of the 14 agent nodes executing in the correct sequence (Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → fan-out → QA → Editor[final] → Publisher)
  2. After a stub run, the `weeklyIssue` draft on Sanity has `pipelineMetadata.runId` equal to the `runId` on every row in every Convex table written during that run (enforced by the integration test asserted in PIP-06)
  3. Triggering a stub run with the Editor gate 1 "no winner" condition sets `pipelineRuns.status = "awaiting-review"` in Convex and the graph pauses; `POST /run/{runId}/resume` with a selection re-injects the checkpoint and the graph continues to completion
  4. An agent that deliberately raises an exception during a stub run results in `pipelineRuns.status = "failed"` in Convex with the failed agent ID and error message visible; `GET /run/{runId}/status` returns the current state
  5. `pipelineRuns.cost` contains a per-agent token count and USD total; `pipelineRuns.durationMs` contains the wall-clock time from pipeline start to draft-written
**Plans**: 12 plans
- [x] 04-01-python-project-bootstrap-PLAN.md — Bootstrap packages/pipeline/ (uv + pyproject.toml + uv.lock + Dockerfile + railway.toml + .env.example + pnpm workspace bridge); delete tsconfig.json
- [x] 04-02-dispatch-state-and-lib-modules-PLAN.md — DispatchState (API_CONTRACTS §7 verbatim) + portable_text + sanity_client + convex_client + cost + ids
- [x] 04-03-convex-schema-patch-PLAN.md — Add durationMs + cost optional fields to convex/schema.ts pipelineRuns + extend updateStatus mutation; redeploy (autonomous: false)
- [x] 04-04-sanity-schema-patch-PLAN.md — Add pipelineMetadata.cost text field to apps/studio/schemas/weeklyIssue.ts; regenerate sanity.types.ts
- [x] 04-05-pytest-infrastructure-PLAN.md — conftest.py + 6 test file skeletons with pytest.mark.skip placeholders (Wave 0 validation infrastructure)
- [x] 04-06-stub-fixtures-and-wrapper-PLAN.md — @agent_node decorator (Phase 4→5 stable contract) + 14 deterministic fixtures + fake OpenRouter
- [x] 04-07-stub-agents-PLAN.md — 14 stub agent modules (calibrator, scout, advocate, editor[gate 1 + final], researcher, 7 section writers, qa, publisher)
- [x] 04-08-graph-builder-and-checkpointer-PLAN.md — StateGraph builder (fan-out + validate_sections) + AsyncPostgresSaver factory + setup-checkpointer CLI
- [x] 04-09-fastapi-app-and-routers-PLAN.md — FastAPI app (lifespan + 4 routers: runs/webhooks/health + main) with asyncio.create_task background execution
- [x] 04-10-integration-tests-PLAN.md — Replace Plan 05 skip skeletons with real assertions (PIP-04/06/10 + OPS-01)
- [x] 04-11-documentation-PLAN.md — Rewrite packages/pipeline/README.md (canonical onboarding doc); cross-link apps/web/README.md + root .env.example
- [x] 04-12-smoke-test-PLAN.md — Andrew provisions Railway + Supabase + runs 8-step smoke test (autonomous: false)
**Research flag**: Phase 4 — LangGraph `interrupt()` + `AsyncPostgresSaver` integration patterns (specific version pairing; resume semantics with Railway restart)

### Phase 5: Agent Quality
**Goal**: Every stub agent is replaced by a real LLM-driven agent: Calibrator enforces voice isolation and bonus rotation; Scout finds real charities with Tavily; Advocate scores candidates; Editor gate 1 produces structured deliberation transcripts; Researcher enforces source verification with anonymous fallback; all seven section writers produce content in Jesse's voice with isolated `voiceConstraints`; QA audits every section against a Jesse-voice rubric; DesignAgent emits validated hex colors and whitelisted fonts
**Depends on**: Phase 4
**Requirements**: AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07, AGT-08, AGT-09, AGT-10, AGT-11, AGT-12, AGT-13, AGT-14, AGT-15, AGT-16, AGT-17, AGT-18
**Success Criteria** (what must be TRUE):
  1. A real pipeline run selects a charity that is not in the Sanity `charity` archive; the Scout writes 3-5 candidates to `pitchLog` incrementally (one write per find, not batch-at-end); the Advocate writes a scored argument for every candidate; the Editor gate 1 writes an `editor-decision` event with `editorDecision`, `runnerUpNotes`, and `deliberationTranscript` fields all populated
  2. The Jesse-voice rubric (QA) passes on all section writers' output for a real run — specifically: no exclamation marks, no winking irony, no sentiment, Fortune 500 gravity throughout; QA corrections are written to Convex `qaCorrections` with severity and acceptance status
  3. Every named founder in `founderName` and every case study subject in `subjectName` has a `founderNameSourceUrl` (or `subjectNameVerified=true`) confirmed by httpx fetch of the charity's own website; if source confirmation fails, the section falls back to anonymous framing and `founderNameVerified=false` is written to the draft
  4. Running two pipeline runs back-to-back: the second run's `bonusType` differs from the first; DesignAgent output contains only 6-digit hex strings (verified programmatically, not by eye) and only font names from the approved whitelist
  5. The iteration limit on Scout and Researcher is respected: the integration test confirms neither agent exceeds the configured max tool calls; a simulated overrun raises a controlled error written to `deliberationEvents` rather than an infinite loop
**Plans**: TBD
**Research flag**: Phase 5 — QA voice rubric design for Jesse's brand voice (novel; no off-the-shelf library; must be authored from the CLAUDE_CODE_BRIEF.md voice notes)

### Phase 6: PDF Generation + Webhook Chain
**Goal**: The Publisher renders the Problem Statement to a themed PDF using WeasyPrint with base64-bundled fonts, uploads it to Sanity, and the full Sanity-to-Vercel webhook chain fires on Andrew's publish action with HMAC verification, age-check, idempotency-key deduplication, 30-second CDN delay, and a manual re-trigger fallback
**Depends on**: Phase 5
**Requirements**: PDF-01, PDF-02, PDF-03, PDF-04, WHK-01, WHK-02, WHK-03, WHK-04, WHK-05, WHK-06, WHK-07, WHK-08
**Success Criteria** (what must be TRUE):
  1. After Andrew publishes an issue in Sanity Studio, the `weeklyIssue.problemPdf` field is populated with a Sanity asset URL; the PDF is downloadable from the `/issue/[slug]` page and renders the Problem Statement with the issue's theme colors and font (not default browser fonts, not HTTP-loaded Google Fonts)
  2. Sending a webhook request with a tampered HMAC signature returns a non-200 response and does NOT trigger the Publisher; sending a valid webhook with a `sanity-transaction-time` older than 5 minutes is rejected; sending the same `idempotency-key` twice triggers the Publisher exactly once (not twice)
  3. After a valid publish webhook, the Vercel deploy hook fires at least 30 seconds after the webhook is received; `pipelineRuns.status` in Convex updates to `complete`; `POST /run/{runId}/publish` as a manual fallback triggers the same Publisher flow without a Sanity webhook
**Plans**: TBD
**Research flag**: Phase 6 — WeasyPrint base64 font bundling approach (documented failures #2031, #2126) and Supabase webhook idempotency-key deduplication table pattern

### Phase 7: Game Rendering
**Goal**: GameWriter output renders inside a correctly-sandboxed iframe with no `allow-same-origin`; an automated validator rejects any unsafe HTML/JS patterns before the output reaches a reader; a CSP meta tag is injected into the srcdoc; the game is mobile-responsive; a fallback "Game unavailable" placeholder appears when validation fails and Andrew is notified via Convex
**Depends on**: Phase 5
**Requirements**: GAM-01, GAM-02, GAM-03, GAM-04, GAM-05, GAM-06
**Success Criteria** (what must be TRUE):
  1. An iframe rendering GameWriter output on any issue page uses exactly `sandbox="allow-scripts"` (never `allow-same-origin`); a codebase-level ESLint rule or test fails if `allow-same-origin` appears anywhere in the game rendering component
  2. The automated validator rejects embedCode containing any of: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>`, external `<link href=...>`; a CSP `<meta>` tag restricting external resources is injected into every srcdoc
  3. A game produced by GameWriter renders correctly at 360px viewport width without horizontal scroll or broken layout; when the validator rejects a game, the issue page shows "Game unavailable" and a `qaCorrections` entry is written to Convex with the rejection reason
**Plans**: TBD
**Research flag**: Phase 7 — Automated HTML/JS validator for LLM-generated game output (novel problem; no off-the-shelf validator exists for this iframe sandbox threat model)
**UI hint**: yes

### Phase 8: Stripe / Commerce
**Goal**: A reader can view the lip balm product at `/shop` (server-rendered, no client flicker), complete a Stripe Checkout purchase, and land on `/shop/thank-you`; the webhook handler verifies signatures unconditionally with raw body, deduplicates on `event.id`, and the persistent shop callout appears on every issue page
**Depends on**: Phase 2
**Requirements**: CMR-01, CMR-02, CMR-03, CMR-04, CMR-05, CMR-06, CMR-07, CMR-08, CMR-09, CMR-10
**Success Criteria** (what must be TRUE):
  1. A reader lands on `/shop`, sees the lip balm product with the current charity callout rendered server-side (no client-side loading flicker), and can click through to a Stripe Checkout session; after completing payment they land on `/shop/thank-you` (no DB query on that page)
  2. Sending a Stripe webhook with a forged signature returns a non-200 response and no order processing occurs; sending the same `event.id` twice triggers order handling exactly once; there is no code path that bypasses signature verification regardless of environment variable
  3. The shop callout (one sentence + button) appears at the bottom of every issue page with no banner, no modal, no popup, no countdown timer; `/legal/privacy` and `/legal/terms` pages exist and load without 404
**Plans**: TBD
**UI hint**: yes

### Phase 9: Issue Page Completion
**Goal**: The issue page is fully complete: the deliberation layer subscribes live to all five Convex tables, renders advocate score bars, QA severity colors, and named agent identity cards (no model names exposed) in a collapsed-by-default accordion; the podcast section renders an audio player and collapsible transcript when Andrew has uploaded audio, and shows "Audio coming soon" when he hasn't
**Depends on**: Phase 4, Phase 5, Phase 8
**Requirements**: DEL-01, DEL-02, DEL-03, DEL-04, DEL-05, DEL-06, POD-01, POD-02, POD-03
**Success Criteria** (what must be TRUE):
  1. An issue page for a run that has Convex data shows the deliberation accordion collapsed by default; expanding it renders advocate score bars, QA severity color-coding, and an agent identity card for each event that links to the correct `agentProfile` page — with no model names ("written by Claude" or similar) visible anywhere in the UI
  2. An issue page for a run with no Convex data (pre-Convex issues or empty state) shows a graceful empty state in the deliberation section rather than an error or broken UI
  3. An issue page where `podcast.audioFile` is populated renders an HTML5 audio player and a collapsible transcript; an issue page where `podcast.audioFile` is empty shows "Audio coming soon" without a broken player element
  4. Deliberation events update in real time (within Convex's subscription latency) while the pipeline is running — no page refresh required
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases 1 → 2 → 3 → 4 → 5 → 6 and 7 (post-Phase 5) and 8 (parallel to 5-7, post-Phase 2) → 9

**Parallelism notes (parallelization=true):**
- Phase 8 (Stripe) can begin immediately after Phase 2 completes; it does not need to wait for Phases 3-7
- Phase 6 and Phase 7 both depend on Phase 5 and can be planned/executed in parallel after Phase 5 closes
- Phase 9 depends on Phases 4 + 5 (for real Convex data) and Phase 8 (for shop callout integration)
- Within Phase 5, the seven section writers share input shape and can be planned in parallel waves

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Sanity Foundation | 7/7 | In Progress | 2026-05-11 |
| 2. Web Shell + Theme Engine | 11/11 | Complete | 2026-05-12 |
| 3. Convex Deployment | 7/8 | In Progress | - |
| 4. Pipeline Skeleton | 0/12 | Not started | - |
| 5. Agent Quality | 9/15 | In Progress|  |
| 6. PDF + Webhook Chain | 0/TBD | Not started | - |
| 7. Game Rendering | 0/TBD | Not started | - |
| 8. Stripe / Commerce | 0/TBD | Not started | - |
| 9. Issue Page Completion | 0/TBD | Not started | - |
