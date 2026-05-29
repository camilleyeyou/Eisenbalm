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
- [x] **Phase 5: Agent Quality** (completed 2026-05-18) - Replace every stub with a real LLM-driven agent; enforce voice isolation, factual verification, bonus branching, hex/font validation, and Jesse-voice QA rubric
- [ ] **Phase 6: PDF + Webhook Chain** - WeasyPrint PDF from real ProblemWriter output; Sanity-to-Railway webhook with HMAC, age check, idempotency, 30s delay, and Vercel deploy hook
- [ ] **Phase 7: Game Rendering** - iframe sandbox with automated HTML/JS validator, CSP meta injection, mobile sizing, and render fallback wired to Andrew notification
- [ ] **Phase 8: Stripe / Commerce** - `/shop` product page, Stripe Checkout, `/shop/thank-you`, raw-body webhook with idempotency, legal pages, and persistent shop callout
- [x] **Phase 9: Issue Page Completion** - Live Convex deliberation UI (subscriptions, agent identity cards, collapsed accordion) and podcast audio player + transcript, completing the full reading experience (completed 2026-05-21)

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
**Plans**: 8 plans
- [ ] 06-01-test-infrastructure-PLAN.md — Wave 0 test surface (skeletons + fixtures + tiny.ttf + conftest helpers)
- [ ] 06-02-schema-and-writethrough-PLAN.md — Sanity schema adds problemStatement.pdfContent + write_issue_draft passthrough (autonomous: false — Andrew runs typegen)
- [ ] 06-03-fonts-deps-and-idempotency-cli-PLAN.md — weasyprint+jinja2 deps; vendor 4 TTFs; setup-webhook-idempotency CLI; railway preDeployCommand chain
- [ ] 06-04-webhook-and-idempotency-libs-PLAN.md — lib/sanity_webhook (corrected HMAC), lib/idempotency, lib/vercel_client; unskip Plan 06-01 lib tests
- [ ] 06-05-publisher-package-and-pdf-renderer-PLAN.md — promote agents/publisher.py to package; add pdf.py + fonts.py + Jinja2 template; unskip pdf/fonts tests
- [x] 06-06-api-contracts-doc-update-PLAN.md — amend docs/API_CONTRACTS §5.3 with corrected signature algorithm + cross-link to lib/sanity_webhook
- [x] 06-07-webhook-and-publisher-wiring-PLAN.md — _run_publisher coroutine + real webhook handler + manual fallback wiring; unskip publisher+webhook+manual tests
- [ ] 06-08-readme-and-smoke-test-PLAN.md — README Phase 6 section + opt-in real-mode test + Andrew's 6-step smoke (autonomous: false)
**Research flag**: Phase 6 — WeasyPrint base64 font bundling approach (documented failures #2031, #2126) and Supabase webhook idempotency-key deduplication table pattern

### Phase 7: Game Rendering
**Goal**: GameWriter output renders inside a correctly-sandboxed iframe with no `allow-same-origin`; an automated validator rejects any unsafe HTML/JS patterns before the output reaches a reader; a CSP meta tag is injected into the srcdoc; the game is mobile-responsive; a fallback "Game unavailable" placeholder appears when validation fails and Andrew is notified via Convex
**Depends on**: Phase 5
**Requirements**: GAM-01, GAM-02, GAM-03, GAM-04, GAM-05, GAM-06
**Success Criteria** (what must be TRUE):
  1. An iframe rendering GameWriter output on any issue page uses exactly `sandbox="allow-scripts"` (never `allow-same-origin`); a codebase-level ESLint rule or test fails if `allow-same-origin` appears anywhere in the game rendering component
  2. The automated validator rejects embedCode containing any of: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>`, external `<link href=...>`; a CSP `<meta>` tag restricting external resources is injected into every srcdoc
  3. A game produced by GameWriter renders correctly at 360px viewport width without horizontal scroll or broken layout; when the validator rejects a game, the issue page shows "Game unavailable" and a `qaCorrections` entry is written to Convex with the rejection reason
**Plans**: 5 plans
- [x] 07-01-test-infrastructure-PLAN.md — Wave 0: install Vitest + vite-tsconfig-paths, add test:unit script, seed empty test stubs (no GAM-* — prerequisite infra for Plans 02/03/04)
- [x] 07-02-validator-and-csp-PLAN.md — Wave 1: apps/web/lib/game-validator.ts (BANNED_PATTERNS, GAME_CSP_POLICY, validateEmbedCode, injectGameHead) + full unit tests (GAM-02, GAM-04, GAM-06 substrate)
- [x] 07-03-gameslot-wiring-PLAN.md — Wave 2: convert GameSlot.tsx to Client Component, conditional iframe/fallback render, useRef-guarded Convex qaCorrections write, thread issue.runId from page.tsx (GAM-01, GAM-05, GAM-06)
- [x] 07-04-sandbox-source-scan-PLAN.md — Wave 3: Vitest source-scan tripwire that fails if allow-same-origin appears anywhere in GameSlot.tsx (GAM-03)
- [x] 07-05-readme-and-smoke-test-PLAN.md — Wave 4: apps/web/README.md Phase 7 section + Andrew's manual GAM-05/GAM-06 smoke (autonomous: false)
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
**Plans**: 8 plans
- [x] 08-01-test-infrastructure-PLAN.md — Wave 0 Vitest stubs (8 files) for CMR-01..CMR-10
- [ ] 08-02-stripe-dashboard-checkpoint-PLAN.md — Andrew creates Stripe Product, Price, Shipping Rate, Webhook Endpoint, populates apps/web/.env.local (autonomous: false)
- [x] 08-03-schema-and-deps-PLAN.md — Convex stripeEvents + stripeOrders tables + claim/insert mutations; install stripe@<pinned-major>; document env vars
- [x] 08-04-stripe-client-and-checkout-api-PLAN.md — lib/stripe/{server,constants}.ts + /api/checkout/create-session route + BuyButton Client Component (CMR-02, CMR-10)
- [x] 08-05-webhook-handler-and-idempotency-PLAN.md — /api/stripe/webhook route with raw-body signature verify + Convex claim atomic dedup + source-scan tripwire (CMR-04, CMR-05, CMR-06)
- [x] 08-06-shop-page-rewrite-PLAN.md — Replace Phase 2 placeholder with server-rendered /shop + dynamic charity callout (CMR-01)
- [x] 08-07-thank-you-and-legal-pages-PLAN.md — /shop/thank-you (no DB query) + /legal/privacy + /legal/terms placeholders + STATE.md blocker (CMR-03, CMR-07, CMR-08, CMR-09 reconfirm)
- [ ] 08-08-readme-and-smoke-test-PLAN.md — apps/web/README.md Phase 8 section + Andrew's manual UAT (autonomous: false)
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
**Plans**: 6 plans
- [x] 09-00-validation-test-scaffold-PLAN.md — Wave 1 (test scaffold): author the 9 missing Vitest files (deliberation subscriptions/scores/severity/no-model-names/agent-cards, agents-route, site-header-nav, podcast-slot, theme-aa-tones)
- [x] 09-01-css-tokens-and-data-layer-PLAN.md — Dark HYBRID house palette in globals.css + print hide-list; QUERY_AGENT_PROFILES + AgentProfile type; pass runId to DeliberationSlot
- [x] 09-02-deliberation-layer-PLAN.md — Rewrite DeliberationSlot: 5 live Convex subscriptions (skip-safe), advocate bars, QA severity, editor confidence, persona agent chips, empty state, no model names (DEL-01..05)
- [x] 09-03-podcast-and-agent-route-PLAN.md — Dark PodcastSlot (POD-01..03) + minimal /agents/[agentId] route (DEL-06 link target)
- [x] 09-04-atmosphere-nav-navigator-PLAN.md — Atmosphere layer + SectionNavigator + SiteHeader mobile disclosure; mount in page.tsx (reduced-motion safe, single main)
- [x] 09-05-component-restyle-PLAN.md — Dark restyle of Hero/EditorialSection/CaseStudy/PortableText/GameSlot/GameFallback/Bonus/ShopCallout; pull-quote from body blockquote; game sandbox preserved
**UI hint**: yes

### Phase 10: Editorial Design Pass (Issue Page)
**Goal**: The issue page reads like a serious editorial magazine (New Yorker / longform reference): serif display + body typography pair via Google Fonts, narrow comfortable measure (~62-68ch) for prose, generous vertical rhythm, a drop cap on the first paragraph of the lead section, ornament/rule dividers between sections, masthead-style metadata block (issue number, date, byline), and footnote-style metadata treatment for the case study — all while preserving Phase 2's per-issue theme injection (charity-driven primary/accent/background/text colors override layout defaults but do not break the typographic hierarchy)
**Depends on**: Phase 2
**Requirements**: DES-01, DES-02, DES-03, DES-04, DES-05, DES-06
**Success Criteria** (what must be TRUE):
  1. The issue page at `/issue/issue-1` (and any other issue) renders with a serif display headline for the charity name and a serif body face for paragraph text, both loaded from Google Fonts via Next.js `next/font/google` — no FOUT, no client-side font flash; the typographic hierarchy is visible at a glance (display >> section header >> body)
  2. The lead paragraph of the Origin Story (or the first prose section per the issue) renders with a drop cap (initial letter scaled ~3x, baseline-aligned, hanging if achievable); subsequent paragraphs do not get drop caps; the drop cap renders correctly on mobile (≥320px) without layout collapse
  3. The body prose column is constrained to a comfortable measure (60-68ch) on screens ≥768px; on mobile it uses full width with proper padding; line-height is generous (≥1.55); paragraphs have proper indent or blank-line separation consistent throughout the page
  4. Section transitions use an ornament or rule divider (not just a `<hr>` default) and a consistent section-header treatment (e.g. small-caps label + serif title); the case study renders with footnote-style metadata (founded/AUM/focus) visually distinct from prose
  5. Phase 2's per-issue theme injection still works: the charity's primaryColor/accentColor/backgroundColor/textColor still drive page colors via CSS variables; switching to a different issue with a different theme visibly changes accent colors without breaking the typographic hierarchy or layout
  6. Visual regression: the Phase 7 game iframe still renders inside its sandboxed container with no layout overflow; the shop callout still appears at the bottom (Phase 2 ShopCallout component unchanged); the deliberation accordion stub (if present) still renders without overlap
**Plans**: 4 plans
- [x] 10-01-fonts-and-globals-PLAN.md — Lock paired Google Fonts (Playfair Display + Lora) via next/font/google with extended weight subsets; add .prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block utilities to globals.css
- [x] 10-02-issue-page-redesign-PLAN.md — Refactor EditorialSection (lead-prop drop cap), CaseStudySection (.metadata-block dl), IssueHero (masthead), PortableTextRenderer (19px/1.7 body, accent blockquote), and wire `lead` onto Origin Story in page.tsx; ShopCallout + GameSlot byte-unchanged
- [x] 10-03-visual-regression-tests-PLAN.md — Source-scan tripwire test __tests__/issue-page-typography.test.ts with 6 describe blocks (one per DES-01..DES-06) following Phase 7 game-sandbox.test.ts pattern
- [x] 10-04-readme-and-uat-PLAN.md — apps/web/README.md Phase 10 section + Andrew's manual UAT against deployed issue page (autonomous: false) (completed 2026-05-19)
**UI hint**: yes

### Phase 11: Archive CardSwap + Issue-Page Motion Polish
**Goal**: The `/archive` page features a CSS-3D "CardSwap" component that cycles through REAL past published issues (from Sanity via the existing archive GROQ query), and the dark issue page gains reduced-motion-safe motion polish drawn from the "Machine Editorial" design language — hero charity-name clip-path reveal, section-navigator magnetic gold cursor-glow, and a deliberation confidence count-up + scroll-snap pitch-card carousel — all data-bound (no hardcoded content) and entirely within the locked constraints: approved fonts only (FONT_WHITELIST unchanged), no new npm dependencies, no CDN scripts, single `<main>`, ≥44px touch targets, WCAG AA, `prefers-reduced-motion` on all motion, and the game-sandbox + theme.ts security contracts untouched
**Depends on**: Phase 9
**Requirements**: ARC-01, MOT-01, MOT-02, MOT-03
**Success Criteria** (what must be TRUE):
  1. `/archive` shows a CSS-only 3D CardSwap cycling real past issues from Sanity (no GSAP / no CDN / no new deps), pauses on hover, click opens the issue; under `prefers-reduced-motion` it renders a static, keyboard-accessible list with no auto-cycle
  2. The issue hero charity name reveals via clip-path on load and renders instantly (no animation) under `prefers-reduced-motion`
  3. Section-navigator cards show the gold magnetic/hover glow with NO JS cursor tracking under `prefers-reduced-motion`; interactive targets stay ≥44px
  4. The deliberation confidence meter animates 0→its real value on scroll-into-view (final value shown instantly under `prefers-reduced-motion`); pitch cards use scroll-snap; no model names are exposed and the live Convex subscriptions remain intact
  5. No new npm dependencies are added; FONT_WHITELIST is unchanged; exactly one `<main>` per page; AA contrast holds; `game-sandbox.test.ts` + theme security tests stay green; `pnpm --filter web build` passes
**Plans**: 4 plans
- [x] 11-01-wave0-test-stubs-PLAN.md — Wave 0: author 3 source-scan test files (archive-cardswap, issue-hero-motion, motion-polish) encoding ARC-01/MOT-01/MOT-02/MOT-03 + FONT_WHITELIST + no-new-dep contracts (RED until Wave 2)
- [x] 11-02-archive-cardswap-PLAN.md — Wave 2: new CSS-3D CardSwap.tsx bound to ArchiveIssue[] + mount above ArchiveList in archive/page.tsx (ARC-01)
- [x] 11-03-issue-hero-clip-path-reveal-PLAN.md — Wave 2: IssueHero charity-name word-span @keyframes clip-path reveal, Server-Component-only, reduced-motion-safe (MOT-01)
- [x] 11-04-navigator-and-deliberation-motion-PLAN.md — Wave 2: globals.css section-card hover translate + pitch-card scroll-snap; DeliberationSlot confidence count-up (IntersectionObserver+rAF); SectionNavigator early-return preserved (MOT-02, MOT-03)
**UI hint**: yes

### Phase 12: Machine Editorial Design Adoption + DesignAgent Suppression
**Goal**: Lock the live site to the single fixed "Machine Editorial" dark aesthetic from the superdesign board (canvas `#0C0B0A`, cream `#F0EAD9`, gold `#CDA434`, ember `#C2502A`) — the web app stops applying per-issue DesignAgent theme overrides and always uses the fixed house dark palette. Rebuild `SectionNavigator` and `DeliberationSlot` to faithfully match a chosen board variant (high-fidelity layout/color/motion) using only existing FONT_WHITELIST fonts (Cormorant Garamond / Lora / Inter — the board's IBM Plex Mono machine-readout labels are approximated with Inter + wide uppercase letter-spacing; NO Spectral/IBM Plex Mono, theme.ts FONT_WHITELIST unchanged). Add a reversible config flag that skips the `design` LangGraph node (packages/pipeline) and makes apps/web ignore per-issue `theme`, and encode the Machine Editorial design language into the DesignAgent system prompt so it generates within this aesthetic when re-enabled ("learn from this design") — all within the locked constraints: `prefers-reduced-motion` on all motion, single `<main>`, ≥44px touch targets, WCAG AA, game-sandbox + theme.ts security contracts untouched, DEL-04 (no model names) + the 5 live Convex subscriptions in DeliberationSlot intact, no new npm dependencies, no CDN scripts. Source design reference: superdesign board "Eisenbalm dispatch" (https://app.superdesign.dev/share/7d2cb9d17c275d5d9d4cfae3cd7d8cc11cdb69c1c9531bcf5d49258ae2fede88).
**Depends on**: Phase 11
**Requirements**: MED-01, MED-02, MED-03, MED-04, MED-05
**Success Criteria** (what must be TRUE):
  1. Every issue page renders in the single fixed Machine Editorial dark palette — per-issue DesignAgent `theme` no longer changes colors/fonts on the web (the fixed house palette wins)
  2. A reversible config flag exists that (a) skips the `design` node in the LangGraph build and (b) makes apps/web ignore per-issue `theme`; flipping it back restores prior per-issue theming with no code change
  3. The DesignAgent system prompt encodes the Machine Editorial design language so re-enabled output stays within the aesthetic; existing hex/font/WCAG validation + SAFE_THEME fallback unchanged
  4. `SectionNavigator` is rebuilt to the chosen board variant (high fidelity) using only FONT_WHITELIST fonts; reduced-motion-safe; ≥44px targets; single `<main>`
  5. `DeliberationSlot` is rebuilt to the chosen board variant with the confidence meter + pitch log; DEL-04 (no model names) and the 5 live Convex subscriptions intact; reduced-motion-safe
  6. No new npm dependencies; FONT_WHITELIST unchanged; `game-sandbox.test.ts` + theme security tests stay green; `pnpm --filter web build` passes; pipeline tests stay green
**Plans**: 5 plans
- [x] 12-01-wave0-test-stubs-PLAN.md — Wave 0: 4 web source-scan tripwires (anchor ids, reduced-motion, AGENT_LABELS, no-model-names) + theme suppression-contract assertion + 3 pipeline test cases (validate suppressed, suppressed graph, envelope phrase)
- [x] 12-02-pipeline-suppression-and-prompt-PLAN.md — Pipeline: builder.py SECTION_WRITERS + validate.py REQUIRED_FIELDS gated on DESIGNAGENT_SUPPRESSED (atomic lockstep) + DesignAgent Machine Editorial prompt envelope (MED-02 pipeline, MED-03)
- [x] 12-03-web-theme-suppression-PLAN.md — Web: layout.tsx server-side flag → empty themeCss + ThemeApplier suppressed prop early-return; globals.css :root house palette wins (MED-01, MED-02 web)
- [x] 12-04-section-navigator-timeline-PLAN.md — SectionNavigator Vertical Timeline rebuild + Phase 12 globals.css blocks (navigator + flow-line) (MED-04)
- [x] 12-05-deliberation-carousel-flow-PLAN.md — DeliberationSlot Carousel & Flow rebuild; 5 Convex subs + AGENT_LABELS + DEL-04 + count-up preserved (MED-05)
**UI hint**: yes

### Phase 13: Deliberation as Conversation
**Goal**: Transform the issue's deliberation layer from a dry sequential report into a real, engaging multi-turn conversation between the named agents (The Scout, The Advocate, The Editor), faithful to the run's actual findings/scores/decision, rendered chat-style inline on the issue page. Three coupled pieces: (1) a "Chronicler" pass in the pipeline — ONE LLM call that dramatizes the real Scout findings, Advocate scores/arguments, and Editor decision into a Jesse-voice dialogue (chosen over a live multi-turn debate to contain per-run cost and protect the weekly Thu→Thu cadence), whose output becomes the canonical transcript instead of the deterministic template `editor.py` currently overwrites (`_format_deliberation_transcript`); (2) structured dialogue-turn events (ordered speaker + text) so the frontend can render a thread — any new eventType/payload shape must be checked against `docs/API_CONTRACTS.md` first (CLAUDE.md hard rule); (3) a frontend chat-style render replacing the raw-Markdown `<pre>{transcript}</pre>` dump in `apps/web/components/issue/PodcastSlot.tsx` (which shows literal `#`/`##`/`**` and is buried under the podcast disclosure) with a formatted threaded conversation in the main issue flow. The advocate-score 0/10 prerequisite is already fixed (quick task 260523-eg3). Locked constraints: no schema field renames without `docs/API_CONTRACTS.md`; do not regress the `deliberationEvents`/`agentVotes` emission path; reuse `lib/voice.py` VOICE_CONSTRAINTS (Jesse voice non-negotiable); preserve `prefers-reduced-motion`, WCAG AA, single `<main>`, ≥44px touch targets, the 5 live Convex subscriptions, and DEL-04 (no model names); no new npm dependencies; no CDN scripts.
**Depends on**: Phase 12
**Requirements**: DEL-CONV-01, DEL-CONV-02, DEL-CONV-03, DEL-CONV-04, DEL-CONV-05, DEL-CONV-06
**Supersedes**: POD-02 (Phase 9 — "Issue page renders a collapsible transcript when podcast.deliberationTranscript is populated"). D-10 removes the reader-facing collapsible-transcript render from PodcastSlot.tsx; the `deliberationTranscript` data (Sanity field + GROQ projection) is retained solely for the V2-02 NotebookLM export (DEL-CONV-05). Readers now see the deliberation as the inline chat thread (DEL-CONV-04) instead of the buried `<pre>` blob.
**Success Criteria** (what must be TRUE):
  1. The published deliberation reads as a genuine multi-turn conversation between named agents (Scout / Advocate / Editor), faithful to the run's real findings, advocate scores, and editor decision — not a sectioned report
  2. The conversation renders as a formatted chat thread inline on the issue page: no literal Markdown characters, agent attribution per turn, not buried inside the podcast `<details>` disclosure
  3. The dialogue is emitted as structured, ordered turn data the frontend consumes (no client-side Markdown parsing of a `<pre>` blob); any schema/eventType/payload change is reconciled with `docs/API_CONTRACTS.md`
  4. A usable transcript form still exists for the V2-02 NotebookLM podcast export
  5. Pipeline cost/latency stays within the weekly cadence budget — exactly one added LLM call (the Chronicler), not a multi-call debate loop
  6. No new npm dependencies; Jesse VOICE_CONSTRAINTS reused; `prefers-reduced-motion` + WCAG AA + single `<main>` + ≥44px + 5 Convex subs + DEL-04 all preserved; `pnpm --filter web build` passes and pipeline tests stay green
**Plans**: 3 plans
- [x] 13-01-contract-and-test-scaffold-PLAN.md — Reconcile docs/API_CONTRACTS.md (§7/§1.2/§2.2) + additive Sanity conversation[] schema field + DispatchState field + 4 Wave 0 test files (DEL-CONV-02, DEL-CONV-03, DEL-CONV-06)
- [x] 13-02-chronicler-pipeline-PLAN.md — chronicler @agent_node (single LLM call, faithful turns, D-18 fallback, AGT-17) + llm_config + editor_gate_1->chronicler->researcher rewire + Sanity conversation[] write (DEL-CONV-01, DEL-CONV-02, DEL-CONV-05, DEL-CONV-06)
- [x] 13-03-chat-render-PLAN.md — types/GROQ/globals.css conversation thread + DeliberationSlot chat render + page.tsx prop + PodcastSlot <pre> removal (DEL-CONV-04, DEL-CONV-05, DEL-CONV-06)
**UI hint**: yes

### Phase 14: Light Theme Adoption
**Goal**: Client rejected the dark theme — retone the site from the fixed "Machine Editorial" DARK aesthetic to a fixed warm-paper LIGHT aesthetic, keeping the same single-fixed-palette architecture (DesignAgent stays suppressed via `DESIGNAGENT_SUPPRESSED`; web still ignores per-issue themes; `theme.ts` validation logic + FONT_WHITELIST unchanged). Retone the house palette in `apps/web/app/globals.css :root`: `--color-bg #FAFAF8` (warm paper), `--color-text #1A1A1A` (near-black ink), keeping brand accents gold `#CDA434` + rust `#C2502A` but darkened where used as text/links so they pass WCAG AA on the light base (gold-as-text fails contrast on white otherwise). This is a full re-tone, not a 4-variable swap: re-derive ALL `--color-*` tokens for a light base (surfaces `#14110D`→light cards, `--color-text-dim`/`-mute`, `--color-scout`/`-advocate` deliberation tones — all currently computed for contrast against the DARK bg and failing AA on white), flip white-ward derivations to black-ward (e.g. `--color-primary-bright` mixes toward white → toward black on light), retune the dark-tuned atmosphere radial-gradient glows / shadows / hairlines so they read on paper, and reconcile dark-built components (SectionNavigator vertical-timeline, DeliberationSlot carousel/flow/tape-reel + agent chips, IssueHero, PodcastSlot, the Phase 13 `.del-conversation*` chat-thread). Update the DesignAgent system prompt's "AESTHETIC ENVELOPE (Machine Editorial)" block (`agents/design`) from dark to light so a re-enabled DesignAgent produces on-brand light themes. Reverses Phase 12 MED-01 (dark palette lock).
**Depends on**: Phase 13
**Requirements**: LIGHT-01, LIGHT-02, LIGHT-03, LIGHT-04, LIGHT-05, LIGHT-06, LIGHT-07
**Success Criteria** (what must be TRUE):
  1. The live site renders on a warm-paper light base (`--color-bg #FAFAF8`, `--color-text #1A1A1A`) — no dark surfaces remain anywhere (issue page, archive, navigator, deliberation, footer, shop)
  2. Every text + accent token passes WCAG AA contrast on the NEW light base (gold/rust darkened for text/link use); `theme-aa-tones.test.ts` updated to assert light-base ratios
  3. Dark-tuned effects are reconciled for paper — atmosphere glows, shadows, hairlines, `--color-primary-bright`, deliberation chips/tape-reel and the `.del-conversation` thread all read correctly and on-brand on light
  4. The DesignAgent system-prompt aesthetic envelope describes the LIGHT aesthetic (so a re-enabled run is on-brand); suppression flag + per-issue-theme-off architecture unchanged
  5. Locked constraints preserved: `prefers-reduced-motion`, single `<main>`, ≥44px touch targets, 5 Convex subscriptions, DEL-04 (no model names), game-sandbox security, FONT_WHITELIST (Cormorant/Lora/Inter); no new npm deps; no CDN
  6. `pnpm --filter web build` passes and all prior tripwire tests stay green (re-tuned where they assert dark tones)
**Plans**: 4 plans
- [x] 14-01-test-gate-update-PLAN.md — Flip theme-aa-tones.test.ts to light-base AA assertions + add the two new -text tokens + 3 source-scan tripwires (Wave 0 gate)
- [x] 14-02-globals-retone-PLAN.md — Re-tone globals.css :root to the light palette + new AA-safe text tokens + black-ward/12% derived tokens + halved aurora + warm paper shadow + 6 small-text gold classes → --color-primary-text
- [x] 14-03-deliberation-component-reconcile-PLAN.md — DeliberationSlot editor chip + QA warning/error + editor flow-label → AA-safe -text variants (5 subs / DEL-04 / count-up preserved)
- [x] 14-04-designagent-envelope-PLAN.md — DesignAgent AESTHETIC ENVELOPE prose dark→light (prose-only; ThemeOutput/validation/whitelist unchanged)
**UI hint**: yes

### Phase 15: Shop Storefront — Rich Product Page
**Goal**: Convert the current minimal `/shop` (one sentence + BuyButton from Phase 8) into a real long-scroll product page for the Jesse A. Eisenbalm lip balm — modeled on the structure of `jesseaeisenbalm.com`: hero with the locked tagline "**Stop. Breathe. Balm. A human-only ritual for an AI-everywhere world.**" + product positioning paragraph (premium beeswax, petrolatum-free, professional-grade, TEWL prevention), 3-column features (beeswax formula / 100% to charity / hand-numbered Release 001), expanded ingredient story (no synthetics / parabens / petroleum), product image slot + `$8.99` + repeated BuyButton, charity callout populated from the current published issue (preserving the Phase 8 wiring), and an inline FAQ block (with `/shop/faq` promoted to its own route only if the content exceeds inline practicality — decision deferred to the UI-SPEC). Reuses every piece of the Phase 8 Stripe machinery byte-unchanged: the `<BuyButton>` client component (08-04), `POST /api/checkout/create-session` (08-04), `POST /api/stripe/webhook` (08-05), `/shop/thank-you` (08-07), `/legal/privacy` + `/legal/terms` (08-07). The page lives at `/shop` on the Dispatch site — the homepage stays the magazine destination per the brief ("a magazine that happens to sell one product"). Editorial light-theme aesthetic from Phase 14 + the typographic utilities established in Phase 10 (`.eyebrow`, `.drop-cap`, `.ornament-divider`, `.prose-measure`). Voice on `/shop` is the lip balm's own sub-brand voice ("Stop. Breathe. Balm." — meditative, deliberate, anti-AI ritual) — the deliberate counterpoint to the Dispatch's AI-editorial voice; the two co-exist as complementary sub-brands on the same site. Brand details from `jesseaeisenbalm.com` (tagline, $8.99, Release 001, charity model, beeswax/petrolatum-free positioning) used verbatim with `TODO(Andrew)` markers on items to finalize before launch: real product photography, final tagline confirmation, final price, real edition number. Product imagery: placeholder image slots (editorial SVG illustration or a type-only treatment for the hero) with explicit `TODO(Andrew)` markers — Andrew uploads real photos to replace.
**Depends on**: Phase 8 (commerce code surface), Phase 14 (light theme)
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, SHOP-06, SHOP-07, SHOP-08, SHOP-09, SHOP-10, SHOP-11
**Success Criteria** (what must be TRUE):
  1. `/shop` renders as a long-scroll product page — hero (tagline + product image slot + first CTA) → positioning paragraph → 3-column features → expanded ingredient story → charity callout (current published issue) → product image + price + repeated BuyButton → FAQ → footer — on the warm-paper light base, mobile-friendly, every CTA ≥44px touch target
  2. The Phase 8 `<BuyButton>` from 08-04 is reused byte-unchanged and renders in at least 2 positions on `/shop`; clicking it still POSTs to the existing `/api/checkout/create-session` route — no Stripe wiring change
  3. The charity callout query (latest published issue → charity name) is preserved from the Phase 8 `/shop` — server-rendered from Sanity, no client flicker — and the `ShopCallout` CMR-09 tripwire stays green (no urgency / scarcity / countdown — Release 001 is a brand fact, not an urgency tactic)
  4. Editorial typography is consistent with the rest of the magazine: uses `.eyebrow`, `.ornament-divider`, `.prose-measure` (and optionally `.drop-cap` on the hero or positioning paragraph) from Phase 10; Cormorant/Lora/Inter only (no new fonts; FONT_WHITELIST unchanged)
  5. Locked constraints preserved: WCAG AA on the warm-paper light base for every text/accent token used on `/shop`; single `<main>`; `prefers-reduced-motion` respected; only `--color-*` tokens for color (no hardcoded hex); no new npm dependencies; no CDN scripts; brief constraints honored (no Shopify, no Commerce.js, no cart, no urgency mechanics)
  6. `pnpm --filter web build` exits 0 and all prior tripwire tests stay green (Phase 7 game-sandbox, Phase 10 typography, Phase 12 navigator/deliberation, Phase 13 deliberation-conversation/no-model-names, Phase 14 theme-aa-tones, Phase 8 CMR-* including CMR-01 server-component + CMR-09 ShopCallout source-scan); `apps/web/__tests__/shop-page.test.ts` is adjusted to the new structure if needed (server component, BuyButton present in ≥2 positions, no client-flicker, no urgency vocabulary)
**Plans**: 1 plan
- [x] 15-01-shop-storefront-PLAN.md — Wave 1: extend shop-page.test.ts with 10 Phase 15 source-scan assertions (RED-first Wave 0 within plan) + rewrite shop/page.tsx as 8-section long-scroll storefront with BuyButton at 3 positions (SHOP-01..SHOP-11) (completed 2026-05-28)
**UI hint**: yes

### Phase 16: Choose Your Narrator
**Goal**: An issue whose `weeklyIssue.narrator` reference is set to a non-default `narratorProfile` document renders the four narrative sections (Origin Story, Problem Statement, Founder Bio, Case Study) AND the deliberation conversation in that narrator's voice — where "in voice" means (a) QA scores ≥80% on the per-narrator voice rubric, AND (b) Andrew confirms in human UAT the issue reads as that narrator (not Jesse-in-disguise). When `narrator` is unset, the pipeline produces Jesse voice byte-equivalent to Phase 15-era runs (zero-regression on existing tripwires + pytest). Three seeded narrator profiles minimum at landing: `jesse` (the explicit default), `maya-rudolph`, `werner-herzog`. Reader does NOT pick the narrator — editorial choice only (Andrew), governed in Studio. Narrator does NOT vary within an issue. Narrator does NOT change the visual theme (Phase 14 light palette remains fixed). Narrator is NOT a new model — same OpenRouter model, same agents, just narrator-aware system prompts. Game and Bonus sections are NOT narrator-aware in this phase (revisit if needed).
**Depends on**: Phase 1 (Sanity Foundation — schema pattern reused), Phase 5 (Agent Quality — VOICE_CONSTRAINTS centralization + Jesse-voice QA rubric), Phase 13 (Deliberation as Conversation — chronicler single-pass voice-shaping pattern extended), Phase 14 (Light Theme Adoption — visual baseline locked, narrator becomes the variation axis)
**Requirements**: NRR-01, NRR-02, NRR-03, NRR-04, NRR-05, NRR-06, NRR-07, NRR-08, NRR-09, NRR-10
**Success Criteria** (what must be TRUE):
  1. A `weeklyIssue` with `narrator` → seeded `werner-herzog` profile, run through the full pipeline, produces Origin Story / Problem / Founder Bio / Case Study sections that read as Herzog (QA score ≥80% on Herzog voice rubric, AND Andrew confirms in human UAT)
  2. A `weeklyIssue` with `narrator` unset (or set to default `jesse`) produces Jesse-voice content byte-equivalent in behavior to Phase 15-era runs: existing tripwires green (game-sandbox, no-model-names, typography, deliberation-conversation, podcast-slot, theme-aa-tones) AND existing 168-passing pipeline pytest suite remains green
  3. The deliberation conversation rendered on the issue page reflects the narrator voice when set, and falls back to Jesse voice when unset (Phase 13 DEL-CONV behavior preserved as the default branch — chronicler output for unset-narrator runs is byte-equivalent given the same inputs)
  4. Andrew can pick a narrator in Sanity Studio from a dropdown that previews `narratorProfile.exampleSamples`, and the choice flows into the next pipeline run without a code deploy
  5. The frontend issue page renders a narrator attribution chip on the masthead when narrator is set (e.g. "Narrated by Werner Herzog") and renders no chip when unset (default Jesse remains the implicit/invisible default)
  6. No new npm dependency, no CDN, no new font loaded; `theme.ts` validation + FONT_WHITELIST + game-sandbox security all untouched
  7. Cost per run: narrator-aware runs add ≤10% to LLM token spend vs. Jesse-default runs (voice constraint is a small system-prompt delta, not a new round-trip)
**Plans**: 11 plans (10 active + 1 tombstone)
- [x] 16-01-contract-and-schema-PLAN.md — Wave 0 gate: amend docs/API_CONTRACTS.md §7 + §1.2 + §2.2, create narratorProfile.ts schema, add weeklyIssue.narrator ref, register in index.ts, run TypeGen (autonomous: false)
- [x] 16-02-pipeline-test-scaffold-PLAN.md — Wave 0 RED tests: 6 new pytest files + extend test_chronicler.py (test_voice.py, test_narrator_seed_sentinel.py, test_narrator_cost_budget.py, test_calibrator_narrator.py, test_section_writer_voice_propagation.py, test_qa_judge_narrator.py)
- [x] 16-03-web-test-scaffold-PLAN.md — Wave 0 RED test: narrator-chip.test.ts with 5 sub-contracts (chip presence/absence/copy + DOM-order source-scan + GROQ no-leak Pitfall 8 guard)
- [x] 16-04-voice-py-refactor-PLAN.md — Wave 1: split lib/voice.py into UNIVERSAL_CORE + JESSE_PERSONA_BLOCK + assemble_voice() with import-time byte-equivalence assertion; preserve VOICE_CONSTRAINTS literal-concat for back-compat (Game agent stays Jesse via direct import)
- [x] 16-05-state-calibrator-writers-PLAN.md — Wave 2: DispatchState.narrator field + load_narrator_from_issue helper + Calibrator narrator-awareness + D-14 inactive-narrator warning + 4 narrative writers gain voice_constraints kwarg (Pitfall 2 mitigation)
- [ ] 16-06-chronicler-narrator-PLAN.md — Wave 2: chronicler.py _build_system_prompt accepts voice_constraints kwarg; reads style_brief['voice']; WINNER AUTHORITY stays in chronicler-specific rules (Research §G)
- [x] 16-07-qa-judge-narrator-PLAN.md — Wave 2: run_llm_judge accepts narrator kwarg; per-call rubric assembly appends voiceRubric + exampleSamples[:3] (Research §D Option 1)
- [~] 16-08-seed-and-frontend-PLAN.md — TOMBSTONE (superseded by 16-08a + 16-08b; checker iteration 1 split for scope per W7)
- [ ] 16-08a-seed-narrators-PLAN.md — Wave 2: seed 3 narrators (jesse + maya-rudolph + werner-herzog) with cross-language sentinel via apps/studio/seeds/narrators.json + idempotent seed-narrators.ts script + Andrew Studio checkpoint (autonomous: false — Andrew confirms exampleSamples preview in Studio)
- [ ] 16-08b-frontend-chip-PLAN.md — Wave 2: extend QUERY_ISSUE_BY_SLUG with narrator->{slug, displayName}; add IssueDoc.narrator type; render IssueHero narrator chip ABOVE publish-date (D-19); chip suppressed when narrator null or slug='jesse' (NRR-08)
- [ ] 16-09-verification-and-uat-PLAN.md — Wave 3: full test matrix verification; flip 16-VALIDATION.md to nyquist_compliant: true; author 16-HUMAN-UAT.md; Andrew runs Herzog UAT end-to-end (autonomous: false)
**UI hint**: yes

## Progress

**Execution Order:**
Phases 1 → 2 → 3 → 4 → 5 → 6 and 7 (post-Phase 5) and 8 (parallel to 5-7, post-Phase 2) → 9 → 10 (Phase 10 depends only on Phase 2, can run any time after 2 — slotted last so design polish lands after functional work)

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
| 5. Agent Quality | 15/15 | Complete | 2026-05-18 |
| 6. PDF + Webhook Chain | 6/8 | In Progress | - |
| 7. Game Rendering | 0/5 | Planned | - |
| 8. Stripe / Commerce | 6/8 | In Progress|  |
| 9. Issue Page Completion | 6/6 | Complete   | 2026-05-21 |
| 10. Editorial Design Pass | 4/4 | Complete   | 2026-05-19 |
| 11. Archive CardSwap + Motion Polish | 4/4 | Complete    | 2026-05-22 |
| 12. Machine Editorial Design Adoption | 5/5 | Complete    | 2026-05-22 |
| 13. Deliberation as Conversation | 3/3 | Complete    | 2026-05-24 |
| 14. Light Theme Adoption | 4/4 | Complete    | 2026-05-25 |
| 15. Shop Storefront | 1/1 | Complete    | 2026-05-28 |
| 16. Choose Your Narrator | 7/11 | In Progress|  |

## Backlog

### Phase 999.1: UI/UX audit follow-ups (BACKLOG)

**Goal:** [Captured for future planning] Deferred polish items surfaced by the UI/UX audit of the live site (eisenbalm-web.vercel.app, 2026-05-20). These are intentionally NOT hotfixes. The P0 accessibility cluster already shipped as quick task 260520-0kt; charity data hygiene (test record + duplicate-slug charity) was resolved manually in Sanity.
**Requirements:** TBD
**Plans:** 7/11 plans executed

Plans:
- [ ] **next/image conversion** — `apps/web/components/issue/BonusSection.tsx` storyboards use raw `<img>`; convert to `next/image` with explicit dimensions (via Sanity `urlFor`). Removes CLS risk, enables optimization. (Code already flags this as a Phase 5 deferral.)
- [ ] **Archive pagination** — `apps/web/app/archive` + `components/archive/ArchiveList.tsx` render all issues with no pagination; add pagination/load-more before the weekly archive grows large.
- [ ] **loading.tsx skeletons** — issue page, archive, charities; prevent content-jumping on slow Sanity reads (Performance pillar).
- [ ] **/about page copy** — `apps/web/app/about/page.tsx` is a "This page is being written" placeholder; needs Jesse-voice copy. (Cross-ref: already a STATE.md blocker — Andrew must provide /about copy before Phase 2 closes.)
- [ ] **(minor) _debug/convex duplicate `<main>`** — `apps/web/app/_debug/convex/page.tsx` nests a `<main>` inside the root layout's `<main id="main">`; internal debug route, low priority.
- [ ] TBD (promote with /gsd:review-backlog when ready)
