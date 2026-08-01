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
- [x] **Phase 6: PDF + Webhook Chain** - WeasyPrint PDF from real ProblemWriter output; Sanity-to-Railway webhook with HMAC, age check, idempotency, 30s delay, and Vercel deploy hook (completed 2026-06-01)
- [ ] **Phase 7: Game Rendering** - iframe sandbox with automated HTML/JS validator, CSP meta injection, mobile sizing, and render fallback wired to Andrew notification
- [ ] **Phase 8: Stripe / Commerce** - `/shop` product page, Stripe Checkout, `/shop/thank-you`, raw-body webhook with idempotency, legal pages, and persistent shop callout
- [x] **Phase 9: Issue Page Completion** - Live Convex deliberation UI (subscriptions, agent identity cards, collapsed accordion) and podcast audio player + transcript, completing the full reading experience (completed 2026-05-21)

**v1.0 complete. v2.0: Mission Control Dashboard (Phases 21–27)**

- [x] **Phase 21: Auth + App Shell + Convex Schema** - Clerk auth on `dispatch-control`, `workspace_id` on all new tables, basic app shell with navigation (completed 2026-06-21)
- [x] **Phase 22: Config Externalization** - `load_run_config()` reads from Convex at run start; `snapshot_config()` before graph; 12-prompt migration with byte-verification; agent call-site swap (completed 2026-06-22)
- [x] **Phase 23: Node Wrappers + Read-Only Dashboard** - `wrap_agent_node()` emits live progress to `agent_runs`; operator views graph, run history, live run, cost roll-ups, per-agent I/O (completed 2026-06-22)
- [x] **Phase 24: Prompt Editor + Versioning** - CodeMirror editor with `{variable}` highlighting, save-as-version, diff, activate/rollback with in-progress lock, `VOICE_CONSTRAINTS` as versioned asset, single-agent test-run (10 plans) (completed 2026-06-22)
- [x] **Phase 25: Run Control** - On-demand trigger, kill switch, Railway cron tick, cooperative cancel, single-agent re-roll via LangGraph checkpoint, budget caps + alerts (completed 2026-06-23)
- [x] **Phase 26: Review Gate + Charity Registry** - `awaiting_review` queue, rendered preview, approve/schedule/reject/re-roll, friction-gated `auto_publish`, factual-claims checklist, charity registry with Scout dedup (completed 2026-06-23)
- [x] **Phase 27: Money + Notifications** - Stripe reconciliation (actual recorded cost, not estimates), payout tracking, Slack + email notifications, `model_pricing` staleness indicator (completed 2026-06-24)

**v2.0 complete. v3.0: Dispatch Control v2 — Editorial Operator Console (Phases 30–39)**

- ✅ **v3.0 Dispatch Control v2 — Editorial Operator Console** — Phases 30-39 (shipped 2026-07-10) — 62 plans; archived to [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) (tag `v3.0`)

- [x] **Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox** - 1c tokens/fonts on every screen, persistent masthead (issue/state/spend/lock chips), workflow-ordered nav + How-to-use screen, cross-screen Awaiting-you inbox, `NEXT_PUBLIC_PIPELINE_URL` production fix (completed 2026-07-07)
- [x] **Phase 31: Content-Patch Endpoints + Full Editing** - Scoped Sanity-patch endpoint family; per-section prose editing, structured-field editing, asset uploads — all dashboard → pipeline API → Sanity, no direct Sanity write path (completed 2026-07-07)
- [x] **Phase 32: Native Galley (read-only) + Span-Resolver** - `@portabletext/react` galley rendering the Sanity draft with existing QA annotations overlaid via a text-anchored resolver, running in parallel with the existing preview iframe (completed 2026-07-07)
- [x] **Phase 33: Accept-Fix Wiring + Decision Rail** - Annotation popover (accept/edit/dismiss) wired to Phase 31's content-patch, post-edit annotation re-resolution, blockers-first decision rail (completed 2026-07-08)
- [x] **Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement** - Server-enforced "Facts cleared" + "Sounds human" sign-offs, webhook-level re-validation closing the Studio status-flip bypass, Studio retired to read-only fallback (completed 2026-07-08)
- [x] **Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering** - Per-claim `{claim, sourceUrl, retrievedAt}` bindings from Researcher carried through the 7 writers into prose; galley renders sourced/unsourced spans; source-bound claims checklist (completed 2026-07-08)
- [x] **Phase 36: Voice Pass De-Slop Screen** - Dedicated machine-tell screen reusing the existing QA two-layer detector (rules + Opus judge), as-written vs. house-voice rewrite popovers, its own "Sounds human" sign-off (completed 2026-07-09)
- [x] **Phase 37: Run Monitor v2 + Signal Desk** - Forensic run spine (agents as dots, code gates as diamonds), handoff inspector, 7-writer per-section strength scores, run-vs-last-8 drift strip, Gate 1 candidate slate + interrupt/adjudication mode (completed 2026-07-09)
- [x] **Phase 38: Prompt Lab Evals + Eval Center** - Golden scenarios, eval drawer scoreboard with deltas, commit gate with override-with-reason, append-only Eval Center scoreboard, shadow run (completed 2026-07-09)
- [x] **Phase 39: Registry Coverage-Memory Strip** - Last-8-issues cause/geo/signal coverage strip, append-only charity corrections log re-read by the Researcher (completed 2026-07-10)

**v3.0 complete (shipped 2026-07-10). v4.0: Dispatch Control v3 — The Editorial Workspace (Phases 40–50)**

- ✅ **v4.0 Dispatch Control v3 — The Editorial Workspace** — Phases 40-50 (shipped 2026-07-17) — 92 plans; archived to [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)

- [x] **Phase 40: Issue Entity & Issues Home** - Console routing inverts to issue-keyed; an Issues home shows the in-progress issue's 5-stage strip, scheduled slot, held issues, and four separated header state systems (completed 2026-07-15)
- [x] **Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval** - One Issue Workspace with stage tabs 1-5, persistent outline, and collapsible context panel; recomposes the existing galley/voice-pass/decision-rail endpoints into Stages 2, 4, 5 (all 12 plans executed 2026-07-15, including the WSP-03 gap closure: the context panel now feeds real, stage-specific content on all 5 stages) (completed 2026-07-15)
- [x] **Phase 42: Fact Check Stage** - Stage 3 goes live — Researcher-emitted claim importance, an affirmative coverage summary, a filterable claim table, and the reused provenance card (completed 2026-07-15)
- [x] **Phase 43: My Tasks & Decision Log** - My Tasks becomes a derived projection over open claims/findings/sign-offs; one Decision log records every reasoned action console-wide (completed 2026-07-15)
- [x] **Phase 44: Inspect How This Was Made** - Universal 7-tab inspector reachable from six surfaces, with the missing-expected-input diff as the headline diagnostic (completed 2026-07-15)
- [x] **Phase 45: Agent Revision** - "Ask agent to revise" becomes a passage-level editing verb with direction chips, a claim-delta comparison card, and a per-issue cost guard (completed 2026-07-16)
- [x] **Phase 46: Signal Editor & Candidate Verification** - Pipeline grows 18 → 20 nodes: a Signal Editor agent emits dated story leads and a `verify_candidates` deterministic check gates organization selection (completed 2026-07-16)
- [x] **Phase 47: Story & Brief Stage** - Stage 1 goes live on real leads and verification records — organization options, "Needs your decision" adjudication, and an editable Brief (completed 2026-07-16)
- [x] **Phase 48: Brief Entry Point** - "Start from my brief" becomes a real second pipeline entry point that skips discovery and enters at the Researcher (completed 2026-07-16)
- [x] **Phase 49: Roles & Permissions** - Editor-in-chief vs Collaborator, six server-enforced gated actions, locked controls that explain themselves (completed 2026-07-16)
- [x] **Phase 50: Workbench & Nomenclature** - Run Monitor → Run Details, Prompt Lab → Agent Instructions, Eval Center → Quality Tests, Registry → Editorial Memory; nomenclature pass + failed-run recovery rail (completed 2026-07-17)

**v4.0 complete (shipped 2026-07-17). Binding spec: `docs/design/dispatch-control-v3/`.**

**v4.0 complete (shipped 2026-07-17). v5.0: The Editorial App (Phases 51–54)**

- [ ] **Phase 51: Section — Read and Fix in Place** - `/s/[section]` full-width prose with fact/voice/unsourced-claim problems marked in the sentence and fixed inline, reusing the galley/annotations/finding-resolution system wholesale
- [ ] **Phase 52: Issue — The Front Door** - `/` shows the current issue's real title/subject, nine sections as a derived table of contents, and the three publish gates as the page footer
- [ ] **Phase 53: Admin — The Door** - `/admin/*` gathers every operational surface behind one entrance with capability unchanged, never in the editor's path
- [ ] **Phase 54: Archive — Past Issues** - `/archive` lists past issues by title, searchable by subject, published/held/scheduled distinguishable at a glance

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
- [x] 06-01-test-infrastructure-PLAN.md — Wave 0 test surface (skeletons + fixtures + tiny.ttf + conftest helpers)
- [x] 06-02-schema-and-writethrough-PLAN.md — Sanity schema adds problemStatement.pdfContent + write_issue_draft passthrough (autonomous: false — Andrew runs typegen)
- [x] 06-03-fonts-deps-and-idempotency-cli-PLAN.md — weasyprint+jinja2 deps; vendor 4 TTFs; setup-webhook-idempotency CLI; railway preDeployCommand chain
- [x] 06-04-webhook-and-idempotency-libs-PLAN.md — lib/sanity_webhook (corrected HMAC), lib/idempotency, lib/vercel_client; unskip Plan 06-01 lib tests
- [x] 06-05-publisher-package-and-pdf-renderer-PLAN.md — promote agents/publisher.py to package; add pdf.py + fonts.py + Jinja2 template; unskip pdf/fonts tests
- [x] 06-06-api-contracts-doc-update-PLAN.md — amend docs/API_CONTRACTS §5.3 with corrected signature algorithm + cross-link to lib/sanity_webhook
- [x] 06-07-webhook-and-publisher-wiring-PLAN.md — _run_publisher coroutine + real webhook handler + manual fallback wiring; unskip publisher+webhook+manual tests
- [x] 06-08-readme-and-smoke-test-PLAN.md — README Phase 6 section + opt-in real-mode test + Andrew's 6-step smoke (autonomous: false)
**Research flag**: Phase 6 — WeasyPrint base64 font bundling approach (documented failures #2031, #2126) and Supabase webhook idempotency-key deduplication table pattern

### Phase 7: Game Rendering
**Goal**: GameWriter output renders inside a correctly-sandboxed iframe with no `allow-same-origin`; an automated validator rejects any unsafe HTML/JS patterns before the output reaches a reader; a CSP meta tag is injected into the srcdoc; the game is mobile-responsive; a fallback "Game unavailable" placeholder appears when validation fails and Andrew is notified via Convex
**Depends on**: Phase 5
**Requirements**: GAM-01, GAM-02, GAM-03, GAM-04, GAM-05, GAM-06
**Success Criteria** (what must be TRUE):
  1. An iframe rendering GameWriter output on any issue page uses exactly `sandbox="allow-scripts"` (never `allow-same-origin`); a codebase-level ESLint rule or test fails if `allow-same-origin` appears anywhere in the game rendering component
  2. The automated validator rejects embedCode containing any of: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>`, external `<link href=...>`; a CSP `<meta>` tag restricting external resources is injected into every srcdoc
  3. A game produced by GameWriter renders correctly at 360px viewport width without horizontal scroll or broken layout; when the validator rejects a game, the issue page shows "Game unavailable" and a `qaCorrections` entry is written to Convex with the rejection reason
**Plans**: 6 plans (5 + 1 gap closure)
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
**Plans**: 6 plans (5 + 1 gap closure)
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
- [x] 16-06-chronicler-narrator-PLAN.md — Wave 2: chronicler.py _build_system_prompt accepts voice_constraints kwarg; reads style_brief['voice']; WINNER AUTHORITY stays in chronicler-specific rules (Research §G)
- [x] 16-07-qa-judge-narrator-PLAN.md — Wave 2: run_llm_judge accepts narrator kwarg; per-call rubric assembly appends voiceRubric + exampleSamples[:3] (Research §D Option 1)
- [~] 16-08-seed-and-frontend-PLAN.md — TOMBSTONE (superseded by 16-08a + 16-08b; checker iteration 1 split for scope per W7)
- [x] 16-08a-seed-narrators-PLAN.md — Wave 2: seed 3 narrators (jesse + maya-rudolph + werner-herzog) with cross-language sentinel via apps/studio/seeds/narrators.json + idempotent seed-narrators.ts script + Andrew Studio checkpoint (autonomous: false — Andrew confirms exampleSamples preview in Studio)
- [x] 16-08b-frontend-chip-PLAN.md — Wave 2: extend QUERY_ISSUE_BY_SLUG with narrator->{slug, displayName}; add IssueDoc.narrator type; render IssueHero narrator chip ABOVE publish-date (D-19); chip suppressed when narrator null or slug='jesse' (NRR-08)
- [x] 16-09-verification-and-uat-PLAN.md — Wave 3: full test matrix verification; flip 16-VALIDATION.md to nyquist_compliant: true; author 16-HUMAN-UAT.md; Andrew runs Herzog UAT end-to-end (autonomous: false)
**UI hint**: yes

### Phase 17: UI/UX Audit Follow-ups
**Goal**: Land the deferred polish items surfaced by the 2026-05-20 UI/UX audit of the live site (`eisenbalm-web.vercel.app`). These are intentionally NOT hotfixes — the P0 accessibility cluster already shipped as quick task 260520-0kt and charity data hygiene was resolved manually in Sanity. Scope is the deferred medium-priority polish: image optimization (CLS), archive pagination, loading skeletons, /about copy, and one minor DOM-correctness fix on an internal debug route.
**Depends on**: Phase 2 (Web Shell — /about page surface), Phase 5 (Agent Quality — BonusSection storyboards), Phase 9 (Issue Page Completion — issue/archive loading surfaces)
**Requirements**: P17-01, P17-02, P17-03, P17-04, P17-05, P17-06, P17-07 (derived from the 6 audit success criteria — see 17-RESEARCH.md)
**Success Criteria** (what must be TRUE):
  1. `BonusSection.tsx` storyboards render via `next/image` with explicit dimensions sourced from Sanity `urlFor`; raw `<img>` source-scan tripwire green; CLS measurable improvement on `/issue/[slug]` Lighthouse run
  2. `/archive` paginates or load-mores once `issueCount > N` (N TBD during planning); full-archive render no longer ships every issue in one HTML payload
  3. `loading.tsx` skeletons present on `/issue/[slug]`, `/archive`, and `/charities` (and `/charities/[slug]`) — prevents content jump on slow Sanity reads
  4. `/about/page.tsx` no longer displays the "This page is being written" placeholder; Jesse-voice copy in place (Andrew action — gated on Andrew providing text)
  5. `apps/web/app/_debug/convex/page.tsx` no longer nests `<main>` inside the layout's `<main id="main">` (low priority — internal route only)
  6. No new npm dependency, no CDN; existing Phase 14 light-theme + Phase 12 typography lock + Phase 8 commerce surface all untouched; web vitest baseline 234/234 preserved
**Plans**: 6 plans (5 + 1 gap closure)
- [x] 17-01-wave0-test-stubs-PLAN.md — Wave 1: author the 5 source-scan test files (bonus-section-image, archive-pagination, loading-skeletons, about-page, debug-route) encoding P17-01/03/04/05/06 + dep-count guard (RED until Wave 2)
- [x] 17-02-bonus-section-next-image-PLAN.md — Wave 2: convert BonusSection storyboard grid to next/image fill in the aspect-video container; remove raw <img> + eslint-disable (P17-01, P17-02)
- [x] 17-03-archive-pagination-PLAN.md — Wave 2: client-side load-more in ArchiveList (PAGE_SIZE=10, visibleCount, useEffect reset, hasMore ≥44px button); GROQ + CardSwap unchanged (P17-03)
- [x] 17-04-loading-skeletons-and-debug-main-PLAN.md — Wave 2: 4 loading.tsx skeletons (animate-pulse + --color-line, no <main>) + fix duplicate <main> in /_debug/convex (P17-04, P17-06)
- [x] 17-05-about-copy-PLAN.md — Wave 2: replace /about placeholder with Jesse-voice interim copy + TODO(Andrew) marker; autonomous: false (Andrew voice gate) (P17-05)
**UI hint**: yes (polish-only — visible surface area: BonusSection, archive, loading states, /about)

### Phase 18: Magazine Editorial Layout — Writer Structure
**Goal**: Eliminate the "wall of 19px prose" reading experience on `/issue/[slug]` by teaching the four narrative writer agents (Origin Story, Problem Statement, Founder Bio, Case Study) and the Bonus agent to emit varied Portable Text structure — minimum 2× `h2` sub-headers + 1× `blockquote` (pull-quote candidate) per long-read — while preserving Jesse voice byte-equivalently for every Phase 5 tripwire (no register drift, no exclamation marks, no forbidden adjectives). The frontend `PortableTextRenderer` already supports h2/h3/blockquote/figure roles (Phase 10 + Phase 13 built them); they are currently dead-coded at the live URL because every writer emits only `block.style === "normal"`. This phase activates the existing renderer primitives by upgrading the writer prompts + QA contract — zero new components, zero schema changes. Audit baseline: `.planning/phases/10-editorial-design-pass/10-UI-REVIEW.md` (score 14/24, root cause cited as "writer agents emit only flat paragraphs"; fixes #1 + #3).
**Depends on**: Phase 5 (Agent Quality — writer agents are the modification surface), Phase 10 (Editorial Design Pass — the renderer primitives being activated), Phase 13 (Deliberation as Conversation — Portable Text emission patterns established for the chronicler)
**Requirements**: MEL-01 through MEL-08 (derive during `/gsd:plan-phase 18`)
**Success Criteria** (what must be TRUE):
  1. Every Origin Story, Problem Statement, Founder Bio, Case Study, and Bonus section on a freshly-generated issue contains AT LEAST 2 `block.style: "h2"` (or `h3`) sub-header blocks emitted by the writer, breaking the body into ≥3 logical sub-sections; verified by GROQ post-condition `count(originStory.body[style in ["h2","h3"]]) >= 2` (and equivalents for the other 4 sections)
  2. Every one of those 5 sections contains AT LEAST 1 `block.style: "blockquote"` block, lifting one quotable line from the body into the editorial pull-quote treatment (PortableTextRenderer.blockquote — display font, italic, `--color-accent` left border); verified by `count(*.body[style=="blockquote"]) >= 1` per section
  3. Voice byte-equivalence preserved on the body prose itself: existing `test_voice_byte_equivalence` and Phase 5 voice-isolation tripwires (`no-exclamation`, `no-forbidden-adjectives`, `no-passive-hedging`, `no-AI-reference`) still pass on the full assembled body for every section
  4. QA judge rejects any draft where a long-read section has 0 sub-headers OR 0 blockquotes — gates the structural contract at the QA layer, not just at write time
  5. Zero-regression matrix: `pnpm --filter pipeline test` ≥ 190 passing (Phase 16 baseline), `pnpm --filter web test:unit` ≥ 234 passing (Phase 16 baseline); the Portable Text renderer tests still pass without modification
  6. The live frontend at `https://eisenbalm-web.vercel.app/issue/[next-issue-slug]` no longer renders any section as 7-10 consecutive `<p>` blocks; verified by HTML scan asserting `count(<h2>) within each section >= 2 AND count(<blockquote>) >= 1`
  7. Cost per writer call rises by no more than 15% — the structural contract is small additional system-prompt instruction, not a multi-pass rewrite
**Plans**: 6 plans
- [x] 18-01-contract-reconciliation-PLAN.md — Wave 0 gate: amend docs/API_CONTRACTS.md §7 + §2.2 + §2.4 (body shape change + compose_section_body + 4 block helpers); add MEL-01..MEL-08 to REQUIREMENTS.md
- [x] 18-02-red-test-scaffold-PLAN.md — Wave 0 RED tests: 4 new pytest files (test_writer_structural_floor parametrized over 5 writers, test_qa_structural_axis, test_bonus_specad_only, test_portable_text_blocks)
- [x] 18-03-portable-text-helpers-and-state-PLAN.md — Wave 1: lib/portable_text.py block_paragraph/h2/h3/blockquote + compose_section_body serializer; graph/blocks.py BodyBlock discriminated union; graph/state.py body fields re-typed str → list[dict]
- [x] 18-04-writer-pydantic-and-prompts-PLAN.md — Wave 2: 5 writer Pydantic models (origin_story, problem, founder_bio, case_study, bonus[specAd only]) gain body: list[BodyBlock] + _enforce_structural_floor validator + STRUCTURE_CONTRACT in SECTION_GUIDANCE; sanity_client.py 5 call sites rewired to compose_section_body
- [x] 18-05-qa-judge-axis-and-orchestrator-PLAN.md — Wave 3: JudgeFinding.axis Literal += 'structural-variety' (D-05); rubric.md axis #6 with severity='warning'; agents/qa/__init__.py _section_body_text helper bridges str / list[dict] body shapes
- [x] 18-06-fixtures-verification-and-uat-PLAN.md — Wave 4: 5 stub fixtures emit list[dict] bodies (bigBudget bonus body preserved per D-04); 18-VERIFICATION.md per-MEL matrix; Andrew UAT live HTML scan + qualitative reading-experience sign-off (autonomous: false)
**UI hint**: yes (the whole point of this phase is the user-perceived editorial reading experience on `/issue/[slug]`)

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
| 6. PDF + Webhook Chain | 8/8 | Complete   | 2026-06-01 |
| 7. Game Rendering | 0/5 | Planned | - |
| 8. Stripe / Commerce | 6/8 | In Progress|  |
| 9. Issue Page Completion | 6/6 | Complete   | 2026-05-21 |
| 10. Editorial Design Pass | 4/4 | Complete   | 2026-05-19 |
| 11. Archive CardSwap + Motion Polish | 4/4 | Complete    | 2026-05-22 |
| 12. Machine Editorial Design Adoption | 5/5 | Complete    | 2026-05-22 |
| 13. Deliberation as Conversation | 3/3 | Complete    | 2026-05-24 |
| 14. Light Theme Adoption | 4/4 | Complete    | 2026-05-25 |
| 15. Shop Storefront | 1/1 | Complete    | 2026-05-28 |
| 16. Choose Your Narrator | 11/11 | Complete    | 2026-05-30 |
| 17. UI/UX Audit Follow-ups | 5/5 | Complete    | 2026-06-02 |
| 18. Magazine Editorial Layout — Writer Structure | 6/6 | Complete    | 2026-05-30 |
| 19. Issue Page Redesign — Dispatch Magazine Layout | 5/5 | Complete    | 2026-06-03 |
| 20. Post-Purchase Email Lifecycle | 3/5 | In Progress | - |
| 21. Auth + App Shell + Convex Schema | 5/5 | Complete    | 2026-06-22 |
| 22. Config Externalization | 5/5 | Complete    | 2026-06-22 |
| 23. Node Wrappers + Read-Only Dashboard | 4/4 | Complete    | 2026-06-22 |
| 24. Prompt Editor + Versioning | 10/10 | Complete    | 2026-06-22 |
| 25. Run Control | 5/5 | Complete    | 2026-06-23 |
| 26. Review Gate + Charity Registry | 6/6 | Complete    | 2026-06-23 |
| 27. Money + Notifications | 6/6 | Complete    | 2026-06-24 |
| 30. Foundation — Design System, Chrome & Inbox | 8/8 | Complete    | 2026-07-07 |
| 31. Content-Patch Endpoints + Full Editing | 6/6 | Complete    | 2026-07-07 |
| 32. Native Galley (read-only) + Span-Resolver | 7/7 | Complete    | 2026-07-07 |
| 33. Accept-Fix Wiring + Decision Rail | 5/5 | Complete    | 2026-07-08 |
| 34. Two-Sign-Off Publish Gate + Studio Bypass Retirement | 7/7 | Complete    | 2026-07-08 |
| 35. Provenance Pipeline + Sourced/Unsourced Galley | 6/6 | Complete    | 2026-07-08 |
| 36. Voice Pass De-Slop Screen | 7/7 | Complete    | 2026-07-09 |
| 37. Run Monitor v2 + Signal Desk | 5/5 | Complete    | 2026-07-09 |
| 38. Prompt Lab Evals + Eval Center | 6/6 | Complete   | 2026-07-09 |
| 39. Registry Coverage-Memory Strip | 5/5 | Complete    | 2026-07-10 |
| 40. Issue Entity & Issues Home | 9/9 | Complete    | 2026-07-15 |
| 41. Issue Workspace Frame — Draft, Voice Pass & Approval | 12/12 | Complete    | 2026-07-15 |
| 42. Fact Check Stage | 8/8 | Complete    | 2026-07-15 |
| 43. My Tasks & Decision Log | 9/9 | Complete    | 2026-07-15 |
| 44. Inspect How This Was Made | 9/9 | Complete    | 2026-07-15 |
| 45. Agent Revision | 7/7 | Complete    | 2026-07-16 |
| 46. Signal Editor & Candidate Verification | 7/7 | Complete    | 2026-07-16 |
| 47. Story & Brief Stage | 8/8 | Complete    | 2026-07-16 |
| 48. Brief Entry Point | 7/7 | Complete    | 2026-07-16 |
| 49. Roles & Permissions | 9/9 | Complete    | 2026-07-16 |
| 50. Workbench & Nomenclature | 7/7 | Complete    | 2026-07-17 |
| 51. Section — Read and Fix in Place | 7/8 | In Progress|  |
| 52. Issue — The Front Door | TBD | Not started | - |
| 53. Admin — The Door | TBD | Not started | - |
| 54. Archive — Past Issues | TBD | Not started | - |

## Backlog

_(empty — see Phase 17 in active milestone for UI/UX audit follow-ups, promoted from 999.1 on 2026-05-30 via `/gsd:review-backlog`)_

### Phase 19: Issue Page Redesign — Dispatch Magazine Layout
**Goal**: Rebuild `/issue/[slug]` to match the new "Dispatch" oxblood/cream magazine prototype precisely, REPLACING the old design in place (retire the Atmosphere aurora layer + the vertical-timeline SectionNavigator). Locked section order: (1) compact masthead, (2) three-column briefing — "why this charity" / "at a glance" animated count-up stats / "what's inside" TOC, (3) dark mission band, (4) sticky left section rail with scroll-spy active-tick tracking, (5) article sections with drop caps + pull-quotes (origin / problem / founder / case-study), (6) full-width game slot, (7) spec-ad bonus treatment (2-column justified body, "ADVERTISEMENT — SPEC" tab), (8) deliberation centerpiece — dark band with animated candidate scoreboard + chat-style transcript reveal + confidence bar, (9) podcast player, (10) shop band. Stack: `next/font` for Fraunces + Newsreader + IBM Plex Mono (sitewide swap in `app/layout.tsx`; add all three to `FONT_WHITELIST`), Tailwind v4 for layout, **framer-motion (NEW dependency)** for scroll reveals + stat count-ups + the deliberation message sequence, with `prefers-reduced-motion` honored everywhere (motion off, content fully visible). THEME CONTRACT: oxblood `#9A3324` / cream `#FBFAF6` becomes the new `BRAND_DEFAULTS` (`lib/theme.ts` + `globals.css :root`); per-issue Sanity theme overrides of accent + type tokens are RE-ENABLED — reversing Phase 14's suppression and realigning with the original brief (CLAUDE_CODE_BRIEF.md §239-255). Structure + motion stay CONSTANT across issues; only color + type tokens change. All `lib/theme.ts` security invariants stay intact (hex regex, FONT_WHITELIST membership, WCAG AA contrast gate, `setProperty`-only injection). Scope is sitewide (home/archive/charities adopt the new palette + fonts), superseding Phase 14. Delivery is two-staged: (A) static shell with MOCK data for visual approval, then (B) wire live Sanity GROQ + Convex deliberation subscriptions per API_CONTRACTS.md.
**Depends on**: Phase 2 (Web Shell + Theme Engine — `lib/theme.ts` + `globals.css` are the modification surface), Phase 9 (Issue Page Completion — Convex deliberation UI + podcast player being restyled), Phase 13 (Deliberation as Conversation — chronicler conversation data shape feeding the transcript), Phase 16 (Choose Your Narrator — narrator field on hero), Phase 18 (Magazine Editorial Layout — the h2/blockquote Portable Text the renderer consumes)
**Requirements**: P19-01, P19-02, P19-03, P19-04, P19-05, P19-06, P19-07 (also preserves WEB-02/06/07/08/09/14/15/16, DES-01/02/03/05/06, GAM-01/04/05, DEL-01..05, POD-01/03, CMR-09, AGT-14)
**Success Criteria** (what must be TRUE):
  1. `/issue/[slug]` renders all 10 sections in the locked order above, visually matching the prototype (compact masthead, 3-col briefing, dark mission band, sticky rail, drop-capped article sections with pull-quotes, full-width game, spec-ad, deliberation centerpiece, podcast, shop band); the old Atmosphere aurora + vertical-timeline navigator no longer appear
  2. Fraunces / Newsreader / IBM Plex Mono load via `next/font` (no runtime HTTP font fetch) and are wired as `--font-display` / `--font-body` / `--font-ui`; all three are members of `FONT_WHITELIST`
  3. oxblood/cream is the resolved palette when an issue supplies no theme (new `BRAND_DEFAULTS`); a valid Sanity `theme` overrides accent + type tokens per issue while structure/motion are byte-identical across issues; `lib/theme.ts` security tests still pass unmodified (hex validation, font whitelist, WCAG AA fallback, setProperty-only)
  4. framer-motion drives scroll reveals, stat count-ups, and the deliberation message reveal; under `prefers-reduced-motion: reduce` all motion is disabled and 100% of content is immediately visible (no hidden/empty states)
  5. Stage A (static shell with mock data) is reviewable and user-approved BEFORE any live data wiring begins; Stage B wires Sanity GROQ + Convex subscriptions per API_CONTRACTS.md without changing the approved structure/motion
  6. Zero-regression matrix: `pnpm --filter web test:unit` ≥ prior baseline passing; `pnpm --filter web typecheck` + `build` clean; theme/security tests unmodified and green
  7. Accessibility preserved: single landmark structure, skip-link intact, scroll-spy rail keyboard-navigable, sticky rail hidden on mobile per prototype, focus-visible ring honored
**Plans**: 6 plans (5 + 1 gap closure)
**UI hint**: yes (entire phase is the user-perceived issue-page reading experience)

Plans:
- [x] 19-01-foundation-fonts-theme-tokens-PLAN.md — Wave 1: install framer-motion; swap fonts (Fraunces/Newsreader/IBM Plex Mono) in layout.tsx; oxblood/cream BRAND_DEFAULTS + 9-entry FONT_WHITELIST + serializeThemeCss/applyTheme emit bg/text; globals.css :root re-token; update theme-aa-tones.test.ts + author issue-page-dispatch.test.ts (Wave 0)
- [x] 19-02-stage-a-shell-and-sections-PLAN.md — Wave 2 (Stage A): framer-motion primitives (ScrollReveal/ScrollProgressBar/StatCountUp/SectionRail); new Masthead/Briefing/MissionBand/ShopBand; restyle EditorialSection/CaseStudySection/GameSlot/BonusSection/PodcastSlot; rewrite page.tsx 10-section order from MOCK_ISSUE; retire Atmosphere + SectionNavigator
- [x] 19-03-stage-a-deliberation-centerpiece-PLAN.md — Wave 2 (Stage A): rewrite DeliberationSlot to dark-band centerpiece (DelibScoreboard + DelibChat stagger + ConfidenceBar); preserve 5 Convex subs + DEL-04; wire MOCK into page.tsx
- [x] 19-04-stage-a-visual-approval-checkpoint-PLAN.md — Wave 3 (GATE): Stage A automated gates green + human visual approval vs 19-PROTOTYPE.html before Stage B (autonomous: false)
- [x] 19-05-stage-b-live-wiring-and-verification-PLAN.md — Wave 4 (Stage B): re-enable per-issue theming in issue/[slug]/layout.tsx; swap MOCK_ISSUE → live QUERY_ISSUE_BY_SLUG; thread runId (Convex subs + GAM-05) + problemPdfUrl; full-suite verify + nyquist sign-off + live UAT (autonomous: false)

### Phase 20: Post-Purchase Email Lifecycle (8-email flow)

**Goal:** Build an in-house, fully-testable 8-email post-purchase lifecycle for the single-SKU Stripe store — triggered off each completed `stripeOrders` order, scheduled by Convex (`scheduler.runAfter` + hourly cron sweep), rendered as Jesse-voice React Email DRAFTS, sent via a Resend provider abstraction that is OFF by default, and personalized off the per-order `charitySlug`. Emails 1-3 are transactional (always send), 4-8 marketing (one-click `List-Unsubscribe` headers + CAN-SPAM postal footer; unsubscribe cancels pending marketing steps via `ctx.scheduler.cancel` but never transactional). Idempotent `emailSends` ledger guarantees each step sends at most once; `emailSubscribers` holds consent + unsubscribe token. Live sending + Resend key + DNS subdomains + postal address + Andrew voice sign-off are LAUNCH PREREQUISITES — the whole flow is testable with NO live sends.
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06, EMAIL-07, EMAIL-08, EMAIL-09, EMAIL-10
**Depends on:** Phase 8 (Stripe commerce — the `stripeOrders` table + the webhook that records orders is the lifecycle trigger)
**Plans:** 5/5 plans complete

Plans:
- [x] 20-01-emails-package-and-pure-helpers-PLAN.md — Wave 1: scaffold `@eisenbalm/emails` workspace package; pure helpers (8 offsets, suppression, idempotency, token, subjects) + SendEmailProvider abstraction (Resend + Fake, live OFF by default) + Wave 0 vitest (EMAIL-01/02/03/07)
- [x] 20-02-convex-data-model-PLAN.md — Wave 1: add `emailSubscribers` + idempotent `emailSends` (with `scheduledFnId`) tables + internal claim/markSent/markSkipped/upsert/getByToken functions + env docs; deploy to dev (EMAIL-02/03/09)
- [x] 20-03-convex-flow-engine-PLAN.md — Wave 2: `enqueueEmailFlow` + `sendEmailStep`/`sweepStaleSends` actions + `crons.ts` hourly sweep + charity GROQ builders; wire enqueue into `stripeOrders.insert` (fire-and-forget) (EMAIL-01/02/03/09)
- [ ] 20-04-react-email-templates-PLAN.md — Wave 3: 8 Jesse-voice React Email DRAFT templates + transactional/marketing layouts + CAN-SPAM footer + real `renderEmailStep` + Next `serverExternalPackages` (EMAIL-04/05/06/08)
- [ ] 20-05-unsubscribe-route-and-cancellation-PLAN.md — Wave 3: `GET/POST /api/email/unsubscribe` one-click route + `unsubscribeByToken` cancellation mutation (cancels pending marketing steps only) (EMAIL-03/10)

### Phase 28: Prompt Console — Editorial Authoring

**Goal:** Make dispatch-control `/prompts` a best-in-class editorial authoring console for Jesse's voice — Andrew can understand, safely edit, and validate any agent prompt before it ships. Four capability areas: (1) editorial context + safety (agent role/description on cards + detail, "edited since seed" drift badge, unsaved-changes guard, search/filter); (2) variable tooling (click-to-insert variable chips with descriptions, an assembled-with-sample-values preview, unused-variable hints); (3) the authoring loop (draft-vs-active side-by-side test-run with real cost + token count + a voice-rubric score on the output); (4) prompt source-of-truth sync (surface DB-vs-`.md` divergence and reconcile the dashboard / `.md` files / Google-Docs round-trip per a locked canonical-source decision). Voice-drift guardrails are the throughline.
**Requirements**: PRC-01..10 (derived 2026-06-24 in /gsd:plan-phase; see REQUIREMENTS.md → Prompt Console)
**Depends on:** Phase 24 (prompt editor + versioning), Phase 27 (dashboard money/notifications surfaces), and the seeded `prompt_versions` table (30 active v1 rows)
**Plans:** 4/4 plans complete

**Decisions:** Locked in 28-CONTEXT.md (D-01..D-15). Both open decisions resolved — (1) standalone single-output scorer loading the live active rubric (D-04); (2) DB authoritative, `.md` becomes seed-only + runtime fallback, Google-Docs round-trip retired for prompts, drift surfaced as badge + copyable `.md`-marker export (D-01/02/03).

Plans:
- [x] 28-01-editorial-context-drift-export-PLAN.md — Wave 1: editorial descriptions map (PRC-01) + drift query/badge (PRC-02) + list search/group/drift filter (PRC-04) + copyable `.md`-marker export (PRC-10)
- [x] 28-02-variable-tooling-unsaved-guard-PLAN.md — Wave 2 (after 01): variable description+sample maps + click-to-insert chips (PRC-05) + assembled-with-samples preview (PRC-06) + unused-var hint (PRC-07) + in-app unsaved-changes guard (PRC-03)
- [x] 28-03-scoring-endpoint-contract-first-PLAN.md — Wave 1: API_CONTRACTS §3A.2 (contract-first) + standalone `score_output` scorer (active rubric, disk fallback) + `POST /agents/{key}/score` + pytest (PRC-09 backend)
- [x] 28-04-side-by-side-compare-score-ui-PLAN.md — Wave 2 (after 03): scoreClient + active-version run helper + TestRunPanel draft-vs-active side-by-side compare + voice-score display + delta (PRC-08, PRC-09 UI)

### Phase 29: Deployment hardening code fixes

> **Mechanism note (corrected by 29-RESEARCH.md — authoritative):** the `internalMutation` / `RAILWAY_ENVIRONMENT` wording in the goal below is the pre-research draft. Convex `internalMutation`s are NOT reachable via the HTTP `/api/mutation` API, so pipeline/webhook-facing functions stay **public `mutation`s guarded by a shared-secret argument + constant-time compare** (repo precedent: `convex/auditLog.ts`); dashboard-facing ones get the `getUserIdentity()` guard. D-2 uses `RAILWAY_ENVIRONMENT_NAME`. The 5 PLAN.md files follow the corrected mechanism.

**Goal:** Close the code-track blockers found in the 2026-07-03 pre-production audit so the stack is safe to deploy. Security-critical (priority): (1) **Convex auth lockdown** — split the ~20 currently-public `mutation` functions into auth-guarded dashboard mutations (derive actor from `ctx.auth.getUserIdentity()` Clerk JWT, never from a spoofable arg) vs `internalMutation` for pipeline/webhook writes (`pipelineRuns`, `runs`, `deliberationEvents`, `agentVotes`, `pitchLog`, `qaCorrections`, charities candidate writes); give the Stripe webhook's `ConvexHttpClient` admin auth and make `stripeEvents.claim` + `stripeOrders.insert` internal. (2) **Pipeline auth fail-closed** — refuse to boot / hard-401 when `PIPELINE_TRIGGER_SECRET` or `CLERK_JWT_ISSUER_DOMAIN` is unset in a deployed env (`RAILWAY_ENVIRONMENT` present); switch the `runs.py` trigger-secret compare to `hmac.compare_digest`. (3) **Pipeline restart reconciliation** — startup lifespan sweep that marks Convex runs stuck in `'running'` with no live task as failed/cancelled so a mid-run restart can't deadlock the one-at-a-time gate forever.

**Mechanical cleanups (same phase):** add `PyJWT` + `requests` to pipeline `pyproject.toml`; fix stale `SUPABASE_POSTGRES_URL` guidance in `packages/pipeline/.env.example` + `checkpointer.py`/`cli.py` error strings (now Railway Postgres); remove the public `/_debug/convex` route (+ its test, `robots.txt` entry, README note); remove the 5 dead Convex `useQuery` subscriptions in `DeliberationSlot.tsx`; add a visible checkout-failure message in `BuyButton.tsx`; add an ESLint config to `apps/web` so the lint gate works; fix the ~17 TS errors in `apps/web/__tests__`; add a favicon; document missing env vars (`PREVIEW_SECRET` + `NEXT_PUBLIC_WEB_PREVIEW_BASE` in dispatch-control `.env.example` + `DEPLOY.md`; `DESIGNAGENT_SUPPRESSED` + `LOG_LEVEL` in pipeline `.env.example`).

**Out of scope (external actions the user owns):** Stripe live-mode cutover, Clerk production instance, Resend DNS/email env, regenerating the Convex deploy key, deleting demo Sanity docs, writing legal/shop copy, setting env vars on Vercel/Railway/Convex, creating the Railway cron service.

**Requirements**: derived from pre-production audit (see memory: pre-deploy-audit-260703)
**Depends on:** Phase 28
**Plans:** 5/5 plans complete

Plans:
- [x] 29-01-convex-auth-lockdown-PLAN.md — Convex mutation authorization: shared guard helper, identity/secret/dual-lane guards, pipeline + Stripe caller updates, convex-test suite (D-1)
- [x] 29-02-pipeline-auth-and-reconciliation-PLAN.md — Pipeline fail-closed auth, constant-time trigger-secret compare, restart reconciliation sweep, declared deps (D-2, D-3, D-4, D-5)
- [x] 29-03-web-route-subs-checkout-PLAN.md — Remove /_debug/convex route, delete 5 dead DeliberationSlot subs + 3 tripwires, visible checkout-failure message (D-7, D-8, D-9)
- [x] 29-04-eslint-typecheck-favicon-PLAN.md — apps/web ESLint config, fix 17 test TS errors, add favicon (D-10, D-11, D-12)
- [x] 29-05-env-var-docs-PLAN.md — Railway Postgres env guidance + document missing dispatch-control/pipeline env vars (D-6, D-13)

---

## v2.0 Phase Details — Mission Control Dashboard

### Phase 21: Auth + App Shell + Convex Schema
**Goal**: Operator can sign in to `dispatch-control` and see a navigable app shell; every dashboard route is protected by Clerk while `apps/web` stays unauthenticated; all new Convex tables carry `workspace_id` and the "eisenbalm" workspace is seeded
**Depends on**: Phase 3 (Convex Deployment — existing tables and deploy pipeline)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, CFG-05
**Success Criteria** (what must be TRUE):
  1. Operator navigates to `dispatch-control` and is redirected to Clerk sign-in when unauthenticated; after signing in, the app shell renders with top-level navigation (Graph, Runs, Config, Prompts, Registry, Finance, Settings)
  2. Every dashboard route and API endpoint returns a redirect-to-sign-in or 401 when called without a valid Clerk session; `apps/web` public pages load without any Clerk dependency
  3. FastAPI dashboard-control endpoints reject requests without a valid Clerk JWT; the Railway cron path retains its existing `X-Pipeline-Trigger-Secret` and is unaffected
  4. The audit log and run records attribute the signed-in operator's identity to every triggered action from day one
  5. Every new Convex table (`workspaces`, `users`, `agents`, `prompt_versions`, `pipeline_config`, `runs`, `agent_runs`, `charities`, `model_pricing`, `review_actions`, `audit_log`) carries a `workspace_id` field; querying by `workspace_id = "eisenbalm"` returns the seeded workspace record
**Plans**: 6 plans (5 + 1 gap closure)
Plans:
- [x] 21-01-PLAN.md — Scaffold dispatch-control app + Phase 21 test harness (Wave 0)
- [x] 21-02-PLAN.md — 11 Convex tables (workspace_id) + auth.config + seed + JIT user upsert
- [x] 21-03-PLAN.md — Clerk auth wiring (middleware, providers, sign-in); apps/web no-leak
- [x] 21-04-PLAN.md — FastAPI require_clerk_jwt guard; cron secret untouched
- [x] 21-05-PLAN.md — App shell: sidebar + 7 nav routes + Clerk user button
**UI hint**: yes

### Phase 22: Config Externalization
**Goal**: The pipeline reads all agent config (prompts, model, temperature, tokens, enabled flag) from Convex once at run start; a full config snapshot is written to the `runs` record BEFORE the LangGraph graph is invoked; the 12 existing prompt `.md` files are migrated into Convex as version-1 active rows with byte-verification; agents read from `state["config"]` not from disk mid-run; disk files are retained as fallback
**Depends on**: Phase 21
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04
**Success Criteria** (what must be TRUE):
  1. A pipeline run triggered after Phase 22 shows a `config_snapshot` JSON field on the `runs` record that contains the exact prompt text and model settings used — verifiable by comparing the snapshot to the active prompt versions in Convex
  2. The config snapshot is written to Convex and confirmed before `graph.ainvoke()` is called; editing a prompt mid-run does not change the in-flight run's behavior (the config was captured at start)
  3. All 12 agent prompt `.md` files appear in Convex `prompt_versions` as version-1 active rows; running the byte-comparison verification script shows zero diff between the seeded rows and the original files
  4. If Convex is unreachable at run start, the pipeline falls back to the on-disk `.md` files and logs a warning — it does not crash or silently ignore the degradation
**Plans**: 6 plans (5 + 1 gap closure)
- [x] 22-01-PLAN.md — Wave 0: API_CONTRACTS §7 amendment (DispatchState.config) + failing test scaffolds (config_loader, byte-parity, snapshot-ordering) + wheel-safe prompt-data test
- [x] 22-02-PLAN.md — Convex schema flesh-out (agents top_p/max_tokens/description) + agents/promptVersions/pipelineConfig/runs functions (idempotent upserts + read queries + setConfigSnapshot)
- [x] 22-03-PLAN.md — lib/config_loader.py (RunConfig + AGENT_KEY_TO_PROMPT_FILE + load_run_config two-tier fallback + snapshot_config) + DispatchState.config field
- [x] 22-04-PLAN.md — Idempotent seed_phase22.py + standalone verify_prompt_seed.py + green mocked byte-parity pytest (CFG-02)
- [x] 22-05-PLAN.md — runs.py snapshot-before-invoke wiring + 11 prompt call-site swap + snapshot-ordering/resume-no-resnap tests

### Phase 23: Node Wrappers + Read-Only Dashboard
**Goal**: Every LangGraph agent node is wrapped by `wrap_agent_node()`; the wrapper emits `agent_runs:started`/`completed`/`failed` to Convex (reading already-accumulated cost from `cost.py` — no second recorder); the operator dashboard shows the pipeline graph, full run history, a live run view with per-agent status and cost, and per-agent input/output inspection; audit infrastructure is in place
**Depends on**: Phase 22
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, AUD-01
**Success Criteria** (what must be TRUE):
  1. Triggering a pipeline run causes each of the 14 agent nodes to emit `started` and `completed` (or `failed`) events to `agent_runs` in Convex with timestamps and cost-so-far; the dashboard live-run view shows each agent transitioning queued → running → done/failed in real time without page refresh
  2. The cost roll-up on the dashboard matches the already-captured per-call cost from `acomplete`/`cost.py` — no second cost-recording call is present (verified by integration test checking `agent_runs` cost values match `pipelineRuns.cost`)
  3. Operator can open any past run and inspect per-agent input/output payload and any error or retry message
  4. The pipeline graph view shows each agent as a node with its current config (model, enabled flag, description) sourced from Convex
  5. Every config/prompt change, review decision, and kill-switch flip emits a row to the `audit_log` table with actor, timestamp, and before/after values
**Plans**: 4 plans
Plans:
- [x] 23-01-PLAN.md — Convex schema extension (agent_runs + agent_run_payloads) + agentRuns.ts/auditLog.ts mutations+queries + cost-rollup util + convex-test/pytest harness (Wave 0)
- [x] 23-02-PLAN.md — wrap_agent_node() instrumentation across all agent nodes + queueForRun at run start (Wave 1)
- [x] 23-03-PLAN.md — Graph view: React Flow DAG with config-at-rest, live status, node-click I/O panel (Wave 1)
- [x] 23-04-PLAN.md — Runs history + run detail + cost roll-up + read-only audit-log viewer (Wave 1)
**UI hint**: yes

### Phase 24: Prompt Editor + Versioning
**Goal**: Operator can edit any agent's system prompt and user-prompt template in a CodeMirror editor with `{variable}` highlighting; saving creates an immutable new version; operator can diff any two versions, activate a version, or rollback — with activation blocked while a run is in progress; `VOICE_CONSTRAINTS` is a versioned first-class config entry; operator can test-run a single agent against sample input
**Depends on**: Phase 23
**Requirements**: PRM-01, PRM-02, PRM-03, PRM-04, PRM-05, PRM-06
**Success Criteria** (what must be TRUE):
  1. Operator opens a prompt editor, makes a change, and saves — the dashboard shows a new version row with author, timestamp, and optional note; the prior version is still accessible and its text is unchanged
  2. The editor highlights `{variable_name}` tokens specific to that agent in a distinct color; typing an unknown variable name or mangling an existing one shows a warning before the operator can save
  3. Activating a prompt version while a run is in progress is blocked or safely queued with a visible explanation; activating when no run is in progress takes effect immediately for the next run
  4. Operator can select any two versions in a diff view and see a side-by-side diff of the prompt text
  5. Operator can trigger a test-run for a single agent, supply sample or prior-real input, and see the agent's output and cost without running the full pipeline
  6. `VOICE_CONSTRAINTS` appears in the editor as a named config entry alongside agent prompts; editing and versioning it follows the same save-as-version flow
**Plans**: 10 plans
Plans:
- [x] 24-01-contracts-and-test-scaffold-PLAN.md — API_CONTRACTS amendment (mutations + test-run endpoint + RunConfig.voice_constraints) + 8 RED test files (Wave 1)
- [x] 24-02-convex-versioning-data-layer-PLAN.md — saveVersion/activate/listForAgent/getByVersion + by_workspace_agentKey_version index + in-progress guard + audit (Wave 2, PRM-03/04)
- [x] 24-03-pipeline-asset-loading-infra-PLAN.md — RunConfig asset fields + agentKey registries + config_loader hydration with disk fallback (Wave 2, PRM-01/06)
- [x] 24-04a-user-template-md-and-byte-test-PLAN.md — 11 *_user.md templates captured + byte-equivalence test green (Wave 3, PRM-01)
- [x] 24-04b-user-template-callsites-and-seed-PLAN.md — 8 agent call-site swaps + byte-verified user-template seed (Wave 4, PRM-01)
- [x] 24-05a-guidance-rubric-md-and-byte-test-PLAN.md — SECTION_GUIDANCE + GUIDANCE_VERIFIED/ANONYMOUS + qa/rubric.md captured + byte test green (Wave 4, PRM-01)
- [x] 24-05b-guidance-rubric-callsites-and-seed-PLAN.md — 5 section-writer/QA call-site swaps + seed extension (Wave 5, PRM-01)
- [x] 24-06-voice-versioning-and-test-run-backend-PLAN.md — VOICE_CONSTRAINTS versioned via db_voice_override + POST /agents/{key}/test-run (Wave 6, PRM-05/06)
- [x] 24-07-editor-ui-variable-awareness-PLAN.md — CodeMirror editor + variable registry/highlight + save-as-version + version history + render checkpoint (Wave 3, PRM-01/02/03/06)
- [x] 24-08-diff-rollback-testrun-ui-PLAN.md — side-by-side diff + activate/rollback (in-progress block) + four-mode test-run UI (Wave 7, PRM-04/05)
**UI hint**: yes

### Phase 25: Run Control
**Goal**: Operator can trigger a run on demand; a `schedule_enabled` kill switch gates all automated runs; a Railway cron calls the tick endpoint on the configured cadence; operator can cancel an in-flight run cooperatively; operator can re-roll a single agent/section via LangGraph checkpoint; per-run and monthly budget caps with alert thresholds are enforced
**Depends on**: Phase 23
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06
**Success Criteria** (what must be TRUE):
  1. Operator clicks "Trigger Run" on the dashboard and a new pipeline run starts; the run appears in the run history with `trigger_source = "manual"` and `triggered_by` = the operator's identity
  2. Setting `schedule_enabled = false` in the dashboard causes the Railway cron tick to no-op immediately — no run starts; the dashboard shows the kill switch state and the next scheduled time with the operator's local timezone shown explicitly
  3. Operator clicks "Cancel" on a live run; the run ends in `cancelled` status within the span of one agent node completing; every subsequent agent node that checks the cancel flag before starting no-ops cleanly
  4. Operator uses the re-roll UI to regenerate a single agent/section within an existing run; the LangGraph checkpoint is read, the target node is re-executed, and the issue draft is updated in Sanity — the other sections are unchanged
  5. When a run's projected cost would exceed the configured monthly cap, the system refuses to start the run and shows a warning; when accumulated cost crosses the alert threshold, the operator receives a notification (Slack and/or email)
**Plans**: 6 plans (5 + 1 gap closure)
- [x] 25-01-PLAN.md — Wave 1 foundation: amend docs/API_CONTRACTS.md (contract-first) for /pipeline/run·/pipeline/tick·/runs/{id}/cancel·re-roll + cancel-flag + new pipeline_config keys; additive runs.cancelRequested schema field; RunCancelled exception; idempotent config seed; 5 RED Wave 0 pytest scaffolds + conftest Convex stub fixture
- [x] 25-02-PLAN.md — Wave 2 trigger + scheduler (RUN-01/02/03): refactor run_weekly into _start_run; api/control.py /pipeline/run (operator-attributed) + /pipeline/tick (kill-switch-first, due-gated, cursor-advancing); lib/scheduler.py cadence engine; auditLog public record mutation; repoint cli trigger_weekly -> /pipeline/tick
- [x] 25-03-PLAN.md — Wave 3 cancel + re-roll (RUN-04/05): cooperative cancel-flag poll in wrap_agent_node + RunCancelled landing in _execute_run; convex runs requestCancel/isCancelRequested/updateStatus; /runs/{id}/cancel + /runs/{id}/agents/{key}/rerun (section-only, D-04-guarded, isolated checkpoint fork)
- [x] 25-04-PLAN.md — Wave 4 budget caps (RUN-06): DB-sourced per-run cap snapshotted at run start; monthly cost-warning alert (scope=monthly, no cancel); lib/budget.py trailing-average start-gate + convex runs:monthToDateCost; wire both control seams
- [x] 25-05-PLAN.md — Wave 5 dashboard UI (RUN-01..06): pipelineControlClient + Runs control bar (Trigger Run two-step) + budget alert banner + cancelled badge; Run-detail Cancel Run + per-section Re-roll; Config page Automation (kill-switch focal point + schedule editor) + Budget Caps + Danger Zone + next-run local/UTC display
**UI hint**: yes

### Phase 26: Review Gate + Charity Registry
**Goal**: Every finished run lands in `awaiting_review` by default; operator sees a full rendered preview + cost before deciding; operator can approve-and-publish, approve-and-schedule, re-roll sections, or reject; enabling `auto_publish` requires explicit friction and is audit-logged; every factual claim is surfaced as a sign-off checklist; the charity registry tracks candidate/featured/blocklisted states and the Scout deduplicates against it
**Depends on**: Phase 25, Phase 23
**Requirements**: RVW-01, RVW-02, RVW-03, RVW-04, RVW-05, REG-01, REG-02
**Success Criteria** (what must be TRUE):
  1. A completed pipeline run lands in `awaiting_review` status and appears in the review queue; the operator sees a rendered preview of the full issue (including deliberation and cost) before making any decision
  2. Operator can approve-and-publish (triggers Vercel deploy), approve-and-schedule (sets a future publish time), reject (returns run to rejected state), or initiate a section re-roll from the review screen
  3. The factual-claims checklist surfaces every number, proper name, and date from the issue text; the operator must check off each claim (or explicitly skip) before the approve action is enabled
  4. `auto_publish` is `false` by default; enabling it requires a modal confirmation step, is rate-limited, emits an audit log entry, and triggers an email alert to the operator — the dashboard makes the enabled state visually alarming
  5. The charity registry shows each charity's current state (candidate/featured/blocklisted), `times_featured`, and `last_featured_at`; the Scout queries the registry at run start and skips any already-featured or blocklisted charity
**Plans**: 6 plans
- [x] 26-01-contracts-convex-foundation-PLAN.md — API_CONTRACTS amendments + additive Convex schema (charities/claim_checks/runs/pipelineRuns) + registry/claims/review/config functions + Wave 0 test scaffolds
- [x] 26-02-pipeline-claims-scout-PLAN.md — Deterministic claims extractor (RVW-05) + Scout registry re-point & candidate logging (REG-02) + idempotent registry backfill script
- [x] 26-03-pipeline-review-endpoints-PLAN.md — FastAPI publish/schedule/reject endpoints (claims-signoff gate) + shared Sanity-flip helper + tick scheduled-publish sweep (RVW-01/03)
- [x] 26-04-web-draft-preview-route-PLAN.md — Token-guarded apps/web draft-preview route (previewDrafts perspective) + per-route frame-ancestors CSP (RVW-02)
- [x] 26-05-dashboard-review-screen-PLAN.md — Review queue + preview-centric review screen (iframe + cost + claims checklist + approve/schedule/reject/re-roll) (RVW-01/02/03/05)
- [x] 26-06-dashboard-registry-autopublish-PLAN.md — Charity registry UI (REG-01) + friction-gated auto_publish toggle with alarming layout banner (RVW-04)
**UI hint**: yes

### Phase 27: Money + Notifications
**Goal**: Operator can view, per issue, gross sales / Stripe fees / net-to-charity from actual Stripe API data + recorded order data; payout status per issue is tracked; `model_pricing` table is labeled as projection-only with a staleness indicator; operator receives Slack and/or email notifications on run complete, run failed, run awaiting review, and budget threshold hit
**Depends on**: Phase 26
**Requirements**: RCN-01, RCN-02, NTF-01, NTF-02
**Success Criteria** (what must be TRUE):
  1. The finance view shows, for each published issue: gross sales (from actual Stripe payment_intent records), Stripe fees, and net-to-charity — computed from the actual recorded `stripeOrders` rows and Stripe API, never from `model_pricing` estimates
  2. Operator can mark a payout as sent (with date and reference) per issue; the dashboard shows payout status across all issues so the "100% of proceeds" promise is auditable at a glance
  3. The `model_pricing` table view is labeled "Projection pricing (not actual cost)" and shows a staleness indicator when any row's pricing data is more than 30 days old
  4. Operator receives a Slack notification and/or email within 5 minutes of: a run completing successfully, a run failing, a run entering `awaiting_review`, or a budget threshold being crossed
**Plans**: 6 plans
- [x] 27-00-contract-env-test-scaffold-PLAN.md — API_CONTRACTS §27 (contract-first), STRIPE_SECRET_KEY in Convex env, 3 Vitest RED scaffolds
- [x] 27-01-additive-schema-PLAN.md — Additive Convex schema: notificationsLedger + payouts tables, stripeOrders.stripeFee
- [x] 27-02-finance-backend-PLAN.md — Reconciliation/staleness helpers + convex finance (fee fetch) + payouts mutations (RCN-01/02)
- [x] 27-03-notifications-backend-PLAN.md — Slack provider + dispatch helper + notificationsLedger + sendNotification + trigger seams (NTF-01/02)
- [x] 27-04-finance-ui-PLAN.md — /finance view: summary card + issue revenue table + inline payout mark-sent + projection pricing
- [x] 27-05-notification-settings-ui-PLAN.md — Settings Notifications subsection + setNotificationConfig mutation


---

## v3.0 Phase Details — Dispatch Control v2 (Editorial Operator Console)

Derived 2026-07-06 from `.planning/research/SUMMARY.md`'s dependency-driven build order and PROJECT.md's Current Milestone locked decisions + reconciliation facts. 43 v3.0 requirements mapped across 10 phases (30-39); Phases 37-38 are parallel tracks with no schema/endpoint dependency on the Review Desk track (30-36).

### Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox
**Goal**: Every console screen presents the 1c design system, the operator always sees pipeline/spend/lock status from the masthead, navigation is workflow-ordered, and a single inbox aggregates everything blocked on a human — with the deployed dashboard actually reaching the pipeline API.
**Depends on**: Phase 21 (existing `dispatch-control` app shell being extended)
**Requirements**: CHR-01, CHR-02, CHR-03, CHR-04, CHR-05
**Success Criteria** (what must be TRUE):
  1. Every screen in dispatch-control renders using the 1c token set (ink `#17140e`, cobalt `#253ad4`, vermilion `#e8471d`, marigold `#f2b01e`, green `#148a52`) and the four fonts (Newsreader/Lora/Space Grotesk/IBM Plex Mono) loaded via `next/font` — no leftover default styling remains.
  2. The masthead, present on every route, shows current issue number, pipeline state chip, month-to-date spend vs. cap, and the auto-publish lock chip, all reading live data.
  3. Left nav lists Review Desk, Signal Desk, Run Monitor, Voice Pass/Prompt Lab, Eval Center, Registry in that order, plus a "How to use" screen documenting the weekly loop, color legend, and house rules.
  4. The Awaiting-you inbox in the masthead lists every awaiting-review run, Gate 1 interrupt, unresolved blocker, and failed run; clicking any item routes to its owning screen.
  5. The deployed dashboard's test-run panel successfully calls the pipeline API in production (`NEXT_PUBLIC_PIPELINE_URL` configured and verified live, not just in local dev).
**Plans**: 8 plans (4 waves)
- [x] 30-01-design-bundle-tokens-fonts-PLAN.md — Commit design handoff bundle (D-12) + 1c @theme tokens + 4 next/font loaders (CHR-01)
- [x] 30-02-route-skeleton-redirects-PLAN.md — Final route set: placeholders + run-monitor tabs + prompt-lab rename + redirects + home→/review-desk (D-02/03/04/05)
- [x] 30-03-screen-token-swap-PLAN.md — Literal neutral-*→1c token swap across Config/Finance/Settings (CHR-01, Pitfall 1)
- [x] 30-04-masthead-PLAN.md — Persistent 52px ink masthead: issue#/state/spend-vs-cap/lock chips from live Convex (CHR-02)
- [x] 30-05-grouped-nav-sidebar-PLAN.md — 3-group workflow-ordered nav + pinned How-to-use, 1c sidebar, nav.test rewrite (CHR-03)
- [x] 30-06-awaiting-you-inbox-PLAN.md — Pure-derivation Awaiting-you dropdown, blockers-first, routes to working screens (CHR-04)
- [x] 30-07-how-to-use-screen-PLAN.md — How-to-use content: weekly loop + color legend + house rules (CHR-03, D-13)
- [x] 30-08-pipeline-url-prod-fix-PLAN.md — CHR-05 human checkpoint: Vercel NEXT_PUBLIC_PIPELINE_URL + Railway CORS verified live
**UI hint**: yes

### Phase 31: Content-Patch Endpoints + Full Editing
**Goal**: Every content mutation from the console flows through a scoped pipeline-API patch to Sanity — never a direct Sanity write — so per-section editing, structured-field editing, and asset uploads all work without disturbing other sections' block identities.
**Depends on**: Phase 30 (console shell to host the editing UI); backend endpoint work has no schema dependency on Phase 30 and may start in parallel
**Requirements**: EDT-01, EDT-02, EDT-03, EDT-05
**Success Criteria** (what must be TRUE):
  1. Operator can edit any section's prose as a structured block list in the console and save; the change lands in the Sanity draft via a scoped `patch` endpoint, and every other section's content/block identities are untouched.
  2. Operator can edit structured fields (section headlines, PDF key data points, game embed code, theme values) from the console and see them reflected in the Sanity draft.
  3. Operator can upload a podcast audio file, Suno audio, or storyboard image through the console and see it attached to the draft as a Sanity asset.
  4. A source scan of `apps/dispatch-control` finds zero direct Sanity client writes — every content mutation path calls the pipeline API, never Sanity directly.
**Plans**: 6 plans (5 + 1 gap closure)
- [x] 31-01-contracts-and-shared-foundation-PLAN.md — API_CONTRACTS §31 endpoint family (contract-first) + pt_to_blocks reverse mapper + operator theme validator (9-font canonical) + warn-only structural-floor helper + _emit_audit before/after + Wave-0 pytest scaffold
- [x] 31-02-sanity-client-patch-helpers-PLAN.md — patch_issue_field (scoped dotted-path + ifRevisionID→409) + get_issue_draft (PT→rows + lossy) + upload_asset (files/images) with httpx.MockTransport tests
- [x] 31-03-content-patch-endpoint-router-PLAN.md — api/content.py Clerk-guarded PATCH/POST/GET family (EDT-01/02/03), D-08 validation split, before/after audit, raw-binary upload, main.py mount
- [x] 31-04-frontend-foundation-client-and-route-shell-PLAN.md — contentPatchClient + EDT-05 no-direct-Sanity-write source-scan + Review Desk route shell (auto-focus run + chip list + reused preview iframe)
- [x] 31-05-editor-components-and-wiring-PLAN.md — BlockEditor/TurnListEditor/StructuredFieldEditor/AssetUploadSlot + SectionEditorPanel save/dirty/unsaved-nav/409 harness + inbox re-point + strict build gate
- [x] 31-06-draft-read-completeness-and-dirty-gated-saves-PLAN.md — GAP CLOSURE: get_issue_draft returns pdfContent + decomposed bonus.body/bodyLossy; dirty-gated pdf/bonus-body save steps; omit-able patch_bonus fields; bonus payload variant/blocks contract fix
**UI hint**: yes

### Phase 32: Native Galley (read-only) + Span-Resolver
**Goal**: Operator can read the issue as the reader will see it, natively rendered with existing QA findings highlighted inline, without losing the working preview iframe as a fallback during the transition.
**Depends on**: Phase 30 (console shell)
**Requirements**: GLY-01, GLY-02, GLY-05
**Success Criteria** (what must be TRUE):
  1. The Review Desk renders the Sanity draft (all sections, including the sandboxed game) as a native `@portabletext/react` tree, not an iframe.
  2. Existing QA findings render as inline severity-colored span annotations, resolved via `quotedSpan` text-match plus a `blockIndexHint` against live content; findings that fail to resolve are visibly marked "unresolved" — never silently dropped or mis-rendered.
  3. Section-status chips show per-section finding counts and jump to that section on click.
  4. The prior preview-iframe route still renders and is reachable, so Andrew has a working fallback for at least one full weekly cycle.
**Plans**: 7 plans
- [x] 32-01-test-scaffold-and-dep-PLAN.md — Wave 0: install @portabletext/react + author 8 RED test files (resolver, sectionIdMap, syntheticPortableText, googleFontLoader, galleyGameValidator, UnresolvedFindingCard, Galley, SectionChipList)
- [x] 32-02-blockindexhint-and-asset-urls-PLAN.md — Wave 1: contract-first §31.7 + _DRAFT_GROQ asset-URL dereference (podcast audio + storyboards) + Convex qaCorrections.blockIndexHint + QA agent ordinal emission (GLY-01, GLY-02)
- [x] 32-03-span-resolver-core-PLAN.md — Wave 1: pure sectionIdMap.ts + spanResolver.ts (per-block quotedSpan match, hint disambiguation, narrow normalization, ambiguous→unresolved) (GLY-02)
- [x] 32-04-render-helpers-PLAN.md — Wave 1: syntheticPortableText.ts (markDef injection) + googleFontLoader.ts (whitelist-validated) + galleyGameValidator.ts (parity duplicate) (GLY-01)
- [x] 32-05-annotation-primitives-PLAN.md — Wave 2: AnnotationMark.tsx (severity underline + read-only popover) + UnresolvedFindingCard.tsx + galley CSS (GLY-02)
- [x] 32-06-galley-assembly-PLAN.md — Wave 3: GalleryGameSlot + GallerySection + Galley (all 8 sections, live findings, resolver, theme fonts) (GLY-01)
- [x] 32-07-chip-counts-and-page-wiring-PLAN.md — Wave 4: SectionChipList count badges + jump-nav + page.tsx galley-default view + edit affordance + iframe fallback (GLY-05, GLY-01)
**UI hint**: yes

### Phase 33: Accept-Fix Wiring + Decision Rail
**Goal**: Operator can act on any QA finding directly from the galley — accept the fix, edit inline, or dismiss with a reason — with every action mutating the real draft and logged, and the decision rail makes unresolved blockers impossible to miss.
**Depends on**: Phase 31 (content-patch endpoints), Phase 32 (galley + span-resolver)
**Requirements**: GLY-03, GLY-04, EDT-04, EDT-06
**Success Criteria** (what must be TRUE):
  1. Clicking an annotation opens a popover showing axis, severity, reason, and suggested fix, with Accept fix / Edit inline / Dismiss actions.
  2. Accepting a fix applies the suggested text to the draft via the Phase 31 content-patch endpoint and logs the action to the audit log; dismissing requires a one-line reason, also logged — nothing is silent.
  3. After any content patch, annotation anchors are re-resolved against the updated content; annotations invalidated by the edit are surfaced as orphaned for operator review, not dropped.
  4. The decision rail shows unresolved error-severity findings first and blocks Publish until they're resolved; it also shows the editor memo, hook card, and a verification summary with an affirmative timestamp state ("checked Nm ago" — never blank).
**Plans**: 5 plans
- [x] 33-01-contract-amendment-PLAN.md — Amend docs/API_CONTRACTS.md §33 (findings endpoints, resolution fields, publish gate, checkedAt) BEFORE any code
- [x] 33-02-convex-resolution-state-PLAN.md — Additive qaCorrections resolution fields + secret-guarded setResolution + byId + pitchLog:selectedByRunId + claim_checks.checkedAt + codegen + convex-test
- [x] 33-03-pipeline-findings-endpoints-PLAN.md — Python span-resolver port + api/findings.py accept/dismiss/reopen + open-error-findings 409 on publish_issue & schedule_issue
- [x] 33-04-popover-actions-reresolution-PLAN.md — findingsClient + shared isOpenFinding + popover Accept/Edit/Dismiss + unresolved-card actions + reloadDraft/edit-inline plumbing
- [x] 33-05-decision-rail-PLAN.md — Blockers-first DecisionRail (memo/hook/verification/actions) mounted as the 336px right column
**UI hint**: yes

### Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement
**Goal**: An issue cannot be published without two independent, server-enforced sign-offs, and the Sanity Studio status-flip can no longer bypass that gate.
**Depends on**: Phase 26 (existing publish/claims-signoff gate being extended); schema-independent of Phases 31-33 but sequenced alongside the galley's gated Publish UI so it isn't built twice
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. The publish endpoint returns 409 unless both "Facts cleared" and "Sounds human" sign-offs are recorded for that run.
  2. The Sanity publish webhook handler itself re-checks sign-off state before running the publisher — flipping status directly in Studio no longer triggers a publish.
  3. Sanity Studio's publish action for `weeklyIssue` is disabled/removed after a soak period of real weekly cycles on the console, with Studio documented as a read-only fallback.
  4. Every sign-off, publish attempt, and any override is recorded in the audit log with actor and timestamp.
**Plans**: 7 plans (1 gap closure)
- [x] 34-01-contract-amendment-PLAN.md — §34 API_CONTRACTS: sign_offs table, sign-off endpoint, gate restructure, webhook revert, Studio action (contract-first)
- [x] 34-02-convex-sign-offs-table-PLAN.md — Convex sign_offs table + signOffs.ts (record/revokeAll/activeByRunId/listByRunId)
- [x] 34-03-signoff-endpoints-publish-gate-PLAN.md — api/signoffs.py sign-off endpoint (relocated facts prereqs) + publish/schedule missing_signoffs gate + guarded paths
- [x] 34-04-webhook-revalidation-revert-PLAN.md — webhook D-07 re-check + _revert_sanity_status + bypass audit/alert (PUB-02)
- [x] 34-05-auto-revoke-on-mutation-PLAN.md — D-08 auto-revoke both sign-offs across 9 content patches + 3 findings routes + rerun_agent
- [x] 34-06-rail-signoffs-studio-retirement-PLAN.md — DecisionRail sign-off controls + signOffClient + flag-gated Studio publish-action removal + read-only-fallback docs
- [x] 34-07-decisionrail-signoff-test-coverage-PLAN.md — gap closure: repair DecisionRail.test.tsx signOffs mock (restores 16 tests) + add sign-off UI coverage (VERIFICATION.md)
**UI hint**: yes

### Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering
**Goal**: Every claim the Researcher extracts carries a source and survives into the final prose the writers produce, and the galley shows Andrew at a glance which claims are sourced and which aren't.
**Depends on**: Phase 32 (galley + span-resolver — the frontend target for this pipeline work)
**Requirements**: PRV-01, PRV-02, PRV-03, PRV-04
**Success Criteria** (what must be TRUE):
  1. The Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` bindings, generalizing the existing founder/subject paired-field source-URL pattern to all claim types.
  2. Each of the 7 section writers references claim IDs in its structured output (established at generation time, not free prose), so bindings survive rewriting rather than being reconstructed by post-hoc fuzzy matching.
  3. The galley renders sourced claims with a marigold highlight (hover reveals source URL + retrieval date) and unsourced claims with a rust tint, as first-class visual states.
  4. The decision rail's source index groups unsourced claims on top with jump links and lists sourced claims with their sources; the claims sign-off checklist is upgraded to source-bound claims instead of free-text.
**Plans**: 6 plans
- [x] 35-01-contract-and-convex-schema-foundation-PLAN.md — Wave 1: amend docs/API_CONTRACTS.md §35/§26.2 (claims model, writer claimSpans, one-row-per-occurrence, ResearchOutput drift note) + claim_checks additive optional fields (claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint) + insertBatch args + convex codegen
- [x] 35-02-researcher-index-bound-claims-PLAN.md — Wave 2: ResearchOutputModel.claims (index-bound, D-01) + S1..Sn result numbering + code-side index→URL + retrievedAt stamping + keyStatistics removal + ResearchOutput TypedDict (PRV-01)
- [x] 35-03-writer-claimspans-PLAN.md — Wave 2: ClaimSpanRef flat model + build_section_writer_prompt claims-whitelist injection (user-prompt only) + 5 prose writers emit claimSpans with lenient unknown-claimId drop (PRV-02)
- [x] 35-04-publisher-provenance-seeding-PLAN.md — Wave 3: per-section/per-block extractor + corrected flat-shape blockIndexHint (Pitfall 1 fix) + publisher seeds sourced+unsourced claim_checks rows one-per-occurrence (PRV-02/PRV-04 data)
- [x] 35-05-galley-provenance-wash-PLAN.md — Wave 2: claimSpan mark stacking + ClaimMark wash component (marigold sourced / rust unsourced, background-only D-09) + hover tooltip + check/skip popover + default-on toolbar toggle (PRV-03)
- [x] 35-06-decision-rail-source-index-PLAN.md — Wave 2: SourceIndex (unsourced-on-top + sourced-by-section, check/skip + jump links) mounted in the rail Verification section; facts-cleared gate untouched (PRV-04)
**UI hint**: yes

### Phase 36: Voice Pass De-Slop Screen
**Goal**: Operator has a dedicated screen for catching machine-tell prose and can rewrite it to house voice before it counts as "sounds human."
**Depends on**: Phase 33 (accept-fix pattern — Voice Pass is mechanically the same span-match → popover → content-patch shape), Phase 34 (feeds the publish gate)
**Requirements**: VOX-01, VOX-02, VOX-03, VOX-04
**Success Criteria** (what must be TRUE):
  1. The Voice Pass screen lights machine-tells and voice violations inline over otherwise clean prose, with a per-screen tell count.
  2. Clicking a tell opens an as-written vs. suggested-house-voice comparison with Accept rewrite / Write my own / Keep (not a tell) actions; accepting mutates the draft via content-patch.
  3. Voice Pass carries its own "Sounds human" sign-off, distinct from factual clearance, and that sign-off feeds the Phase 34 publish gate.
  4. Detection is two-layer — deterministic rules render instantly, the Opus judge runs on demand — reusing the existing `agents/qa/rules.py` + judge rather than a new detector.
**Plans**: TBD
**UI hint**: yes

### Phase 37: Run Monitor v2 + Signal Desk
**Goal**: Operator can see exactly what happened in a run as a forensic timeline and can adjudicate charity selection at Gate 1 without leaving the dashboard.
**Depends on**: Phase 30 (console shell); no schema/endpoint dependency on Phases 31-36 — parallel track, over existing `agent_runs`/`agent_run_payloads`/`pitchLog`/`editor_gate_1` interrupt-resume
**Requirements**: MON-01, MON-02, MON-03, MON-04, SIG-01, SIG-02, SIG-03
**Success Criteria** (what must be TRUE):
  1. A run renders as a vertical forensic spine — LLM agents as dots, code gates (`verify_research`, `validate_sections`) as marigold diamonds — each showing per-node cost, latency, model chip, and retry count.
  2. Clicking a node shows the upstream→node→downstream handoff in human-readable form first, with raw JSON behind a toggle.
  3. The 7-writers node expands into per-section rows with a QA-derived strength score (0-100 colored bar) and flag counts, each section individually re-runnable.
  4. A drift strip compares the current run's cost and duration against the trailing 8 runs.
  5. Operator sees the Gate 1 candidate slate (pitchLog scout summaries, Advocate scores with expandable arguments, `primaryConcern` always visible, never truncated) and the winner/confidence/reasoning panel in full.
  6. When the pipeline interrupts at Gate 1, the screen enters side-by-side adjudication; the operator's pick plus a logged reason resumes the run via the existing `POST /run/{run_id}/resume` endpoint.
**Plans**: TBD
**UI hint**: yes

### Phase 38: Prompt Lab Evals + Eval Center
**Goal**: Operator can validate a prompt edit against real scenarios before committing it, and can watch editorial quality over time instead of trusting a single green number.
**Depends on**: Phase 30 (console shell); no schema/endpoint dependency on Phases 31-37 — parallel track, over the existing `api/agents.py` test-run/score isolation pattern and `api/control.py` checkpoint-fork pattern
**Requirements**: EVL-01, EVL-02, EVL-03, EVL-04, EVL-05
**Success Criteria** (what must be TRUE):
  1. Golden scenario fixtures run against a single agent through the existing test-run/score endpoints.
  2. Editing a prompt in the Prompt Lab eval drawer auto-selects the scenarios it affects, runs them, and shows a scoreboard of deltas vs. the active version.
  3. Committing a prompt is gated on target-metric-up-with-no-regressions, with a logged override-with-reason escape hatch so the gate cannot deadlock.
  4. The Eval Center shows scenario cards (description, what-it-catches, last result) plus an append-only scoreboard time-series in new Convex tables — the editorial drift detector.
  5. Operator can run a shadow run — the discovery scenario against current real news — and see what a paid run would produce, without publishing or affecting run state.
**Plans**: 6 plans
- [x] 38-01-contract-eval-scores-foundation-PLAN.md — Contract §38 (whole-phase boundary) + append-only eval_scores Convex table + evalScores.record/list queries (EVL-04)
- [x] 38-02-golden-scenarios-endpoint-PLAN.md — 8 golden scenario fixtures (replicable agentKeys only) + Pydantic loader + GET /eval/scenarios + TS client (EVL-01)
- [x] 38-04-commit-gate-override-PLAN.md — promptVersions.activate eval-gate (target-up/no-regression, freshness-guarded) + logged override-with-reason + VersionHistoryPanel UI (EVL-03)
- [x] 38-03-shadow-run-discover-candidates-PLAN.md — pure discover_candidates() extraction from scout.py + read-only POST /eval/shadow-run + D-12 isolation proof (EVL-05)
- [x] 38-05-prompt-lab-eval-drawer-PLAN.md — EvalDrawer auto-select + N-scenario draft-vs-active scoreboard + eval_scores persistence (EVL-02)
- [x] 38-06-eval-center-drift-shadow-PLAN.md — Eval Center scenario cards + append-only drift time-series + ShadowRunPanel trigger (EVL-04, EVL-05)
**UI hint**: yes

### Phase 39: Registry Coverage-Memory Strip
**Goal**: Operator can see thematic repetition across recent issues at a glance and keep a durable record of corrections to a charity that the Researcher actually reuses.
**Depends on**: Phase 30 (console shell); read-side aggregation over the existing charity registry — can land any time
**Requirements**: MEM-01, MEM-02, MEM-03
**Success Criteria** (what must be TRUE):
  1. A coverage-memory strip visualizes the last 8 issues' cause/geo/signal chips so thematic repetition is visible at a glance.
  2. Operator can append a correction to a charity's record, stored as an append-only corrections log surfaced in the Registry.
  3. The Researcher re-reads a charity's corrections log on any future mention of that charity, verifiable in pipeline output/logs for a repeat-charity run.
**Plans**: TBD
**UI hint**: yes

## v4.0 Phase Details — Dispatch Control v3 (The Editorial Workspace)

Derived 2026-07-14 from `docs/design/dispatch-control-v3/` (Annotations, DERIVED-STATE-CONTRACT, README) and PROJECT.md's Current Milestone locked decisions + reconciliation facts. 62 v4.0 requirements map one-to-one — one requirement block per phase — across 11 phases (40-50), continuing numbering from v3.0 (which ended at Phase 39). Sequencing is foundation-first: Phase 40 inverts routing to be issue-keyed (everything else sits on this); Phase 41 recomposes three existing shipped screens (galley, voice pass, decision rail/publish gate) into the new Workspace frame and is the first demoable milestone; Phase 42 is the only genuinely new stage; Phases 43-45 build the cross-cutting workspace mechanics (tasks, inspector, revision) that depend on Fact Check's claims existing; Phase 46 is a self-contained backend pipeline change (18→20 nodes) with no console dependency, sequenced before Phase 47 because Stage 1 cannot render without it; Phase 48 depends on the Brief artifact Phase 47 produces; Phase 49 gates the six actions built across Phases 41/42/45/47; Phase 50 is the wide-but-shallow nomenclature and Workbench-rename pass that ripples across everything before it, so it closes the milestone.

**Reuse discipline (do not rebuild):** the 1c design system (Phase 30), the two-sign-off publish gate (Phase 34 `sign_offs`), the eval commit gate (Phase 38), and the provenance substrate (Phase 35 `claim_checks`) are v4.0's foundation, not v4.0's work. Every phase below builds strictly additively on them.

### Phase 40: Issue Entity & Issues Home
**Goal**: The console stops being run-keyed and becomes issue-keyed — a run is reachable only as a historical record under an issue — and an Issues home answers "what's the state of the operation, and does it need me?" at a glance.
**Depends on**: Phase 39 (v3.0 substrate — existing `runs`/`pipelineRuns`/masthead/nav this phase inverts routing around); nothing new within v4.0 (first phase)
**Requirements**: ISS-01, ISS-02, ISS-03, ISS-04, ISS-05, ISS-06
**Success Criteria** (what must be TRUE):
  1. Operator opens Issues home and sees the in-progress issue as a card with its 5-stage strip, status, open-task count, claim coverage, voice state, estimated work remaining, and run cost.
  2. Every console URL for the active issue is issue-keyed; the underlying pipeline run is reachable only as a historical record inside that issue, never as a top-level nav destination.
  3. Operator sees the next scheduled issue slot with the Calibrator's repetition note (e.g. "avoid US-SE · avoid weather") and can start it early.
  4. Operator can hold an issue with a required reason; the held issue appears on the home with reason, who, and when, and can be reopened.
  5. The global header shows issue status, system activity, My Tasks count, and cost vs budget as four separate, never-blended readouts, each carrying label + icon (never color alone).
  6. When issue status fails to load, the card reads "State unknown — refresh" rather than showing a silently stale "ready" state.
**Plans**: 9 plans (5 waves)
- [x] 40-01-contract-test-scaffolding-PLAN.md — §40 API contract + all Wave-0 test scaffolds + vitest env
- [x] 40-02-issues-table-convex-PLAN.md — issues Convex table + functions + pipelineRuns issue-keyed queries
- [x] 40-03-repetition-note-backfill-pipeline-PLAN.md — repetition-note endpoint + ensureByNumber at run start + backfill
- [x] 40-04-derived-state-resolver-libs-PLAN.md — pure derivedState selector + route resolver + repetition-note client
- [x] 40-05-issues-home-screen-PLAN.md — Issues home: in-progress card, stage strip, scheduled slot, held/published rows, Create
- [x] 40-06-routing-inversion-PLAN.md — issue-keyed route wrappers + legacy redirects + dashboard index
- [x] 40-07-issue-overview-hold-PLAN.md — /issues/[n] overview + HoldDialog + hold/reopen wiring (ISS-04)
- [x] 40-08-masthead-nav-chrome-PLAN.md — four-readout header (ISS-05) + nav restructure (ISS-02/D-31)
- [x] 40-09-integration-gate-PLAN.md — Convex deploy + full suite + strict build + backfill + human verify
**UI hint**: yes

### Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval
**Goal**: The Review Desk, Signal Desk, and Voice Pass nav items collapse into one Issue Workspace with stage tabs 1-5 — with no loss of capability. Stages 2 (Draft), 4 (Voice Pass), and 5 (Approval) are recompositions of the galley, voice-pass, and decision-rail work already shipped in v3.0 — not new backend. Stage 1 is not empty in the interim: it provisionally mounts the existing Phase 37 Signal Desk (candidate slate + Gate 1 adjudication) as-is, carried over until Phase 47 replaces it with the full Story & Brief design.
**Depends on**: Phase 40 (issue-keyed routing the Workspace is mounted under); Phase 32/33 (galley + decision rail being recomposed), Phase 34 (publish gate being recomposed), Phase 36 (Voice Pass being recomposed), Phase 37 (Signal Desk candidate slate + Gate 1 adjudication provisionally mounted as Stage 1 — carried over as-is, not rebuilt)
**Requirements**: WSP-01, WSP-02, WSP-03, WSP-04, WSP-05, WSP-06, WSP-07
**Success Criteria** (what must be TRUE):
  1. Operator navigates stage tabs 1-5 inside one Issue Workspace — the separate Review Desk / Signal Desk / Voice Pass nav items are gone — and each tab carries a live status mark.
  2. The persistent issue outline lists every section with its state (clean / review / must fix / changed since review / not generated) and jumps to it on click.
  3. Stage 2's galley renders in publication typography with checked claims marigold-underlined (source on hover and keyboard focus) and unchecked claims rust-tinted and clickable through to Fact Check.
  4. Stage 5 leads with blockers (Must fix / Review recommended / estimated review time with jump links), then the readiness board, then the agent editor's recommendation labeled explicitly as agent judgment — "editor" unqualified stays reserved for the human.
  5. Publish is disabled until Must fix = 0 AND Fact Check complete AND Voice approved current, with the unlock condition written next to the control; publishing shows an exact preview (destination, title, time, consequences) and completes on one confirmation click — no typed confirmation.
  6. "Not generated" renders as a visible first-class state in the canvas and outline (e.g. the Editor's note), never a blank.
  7. Stage 1 renders the existing candidate slate and Gate 1 adjudication, so a run that interrupts at charity selection can still be resolved from the Workspace — no capability is lost in the collapse.
**Plans**: 12 plans (5 base waves + 2 gap-closure waves for WSP-03)
- [x] 41-01-selectors-route-helpers-PLAN.md — deriveSectionStates selector + stage href builders (Wave 1)
- [x] 41-02-last-visited-stage-mutation-PLAN.md — issues.setLastVisitedStage Convex mutation + live sync (Wave 1)
- [x] 41-03-galley-claim-focus-clickthrough-PLAN.md — claim focus-parity + unchecked click-through prop chain (Wave 1)
- [x] 41-04-signal-desk-issue-keying-PLAN.md — SignalDeskScreen additive runId? prop (Wave 1)
- [x] 41-05-workspace-state-outline-panel-PLAN.md — WorkspaceStateProvider + section outline + context panel (Wave 2)
- [x] 41-06-workspace-frame-layout-nav-PLAN.md — frame layout, stage tabs, persistent controls, redirect, nav (Wave 3)
- [x] 41-07-stage1-story-stage3-factcheck-PLAN.md — Stage 1 Signal Desk mount + Stage 3 Fact Check placeholder (Wave 4)
- [x] 41-08-stage2-draft-recomposition-PLAN.md — Stage 2 Draft galley: rail removed, click-through, not-generated (Wave 4)
- [x] 41-09-stage5-approval-publish-preview-PLAN.md — Stage 5 Approval readiness board + exact publish preview (Wave 4)
- [x] 41-10-integration-gate-PLAN.md — full suite + strict build + Convex live + demo-path UAT (Wave 5)
- [x] 41-11-context-panel-slot-mechanism-PLAN.md — WSP-03 gap: ContextPanel per-stage content slot (setPanelContent) + expose provider data (Gap Wave 1)
- [x] 41-12-per-stage-context-panel-content-PLAN.md — WSP-03 gap: 5 stage panel publishers (lead/QA/claims/voice/readiness) + regression tests (Gap Wave 2)
**UI hint**: yes

### Phase 42: Fact Check Stage
**Goal**: Stage 3 goes live — the only genuinely new stage in this milestone — built on the provenance substrate Phase 35 already shipped, plus one new Researcher-emitted field.
**Depends on**: Phase 41 (Workspace frame + stage tabs Fact Check mounts into); Phase 35 (provenance substrate — `claim_checks` with claimId/sourceUrl/retrievedAt/sectionName)
**Requirements**: FCT-01, FCT-02, FCT-03, FCT-04, FCT-05, FCT-06, FCT-07
**Contract note**: FCT-06 ("Ask agent for better evidence") ESTABLISHES the shared span-scoped agent-revision endpoint contract — claim-scoped first. Phase 45 GENERALIZES this same endpoint to arbitrary passage revision; it does not build a second one. Both sit behind the EDT-05 write boundary (dashboard → pipeline API → Sanity, logged to `audit_log`) — the source-scan test forbidding direct Sanity writes from the console applies to this endpoint too.
**Success Criteria** (what must be TRUE):
  1. The Researcher emits an `importance` tier (Load-bearing / Supporting / Incidental) on every claim it produces.
  2. Stage 3 shows an affirmative summary — claims checked X of Y, must fix, conflicting sources, checks not run, changed since check, last verified — where blank never stands in for a verified state.
  3. Operator can filter the claim table by must fix, unchecked, changed, numbers & dates, people & titles, organization claims, and weak source.
  4. Selecting a claim opens a provenance card (exact claim, importance, status, source + publisher, supporting passage, URL, retrieval date, agent, confidence) — the same component reused in Draft, Approval, and the inspector — and operator can Confirm, Edit claim, Replace source, Remove claim, or Keep as written with a required reason.
  5. "Ask agent for better evidence" returns a replacement source and a rewritten claim together; confirming applies both as a content patch + claim update and records a decision-log entry.
  6. A revision touching a claim's block returns that claim to unchecked and increments the "changed since check" counter, even when the replacement text is itself already sourced.
**Plans**: 8 plans (6 waves)
- [x] 42-01-contract-schema-convex-PLAN.md — §42 contract + claim_checks importance/changedSinceCheck/conflict + pipeline-lane claimChecks functions (Wave 1)
- [x] 42-02-researcher-publisher-importance-PLAN.md — Researcher emits importance; publisher merges onto sourced+unsourced rows (Wave 2, FCT-01)
- [x] 42-03-reset-touched-claims-PLAN.md — content.py _reset_touched_claims returns touched claims to unchecked + changed marker (Wave 2, FCT-07)
- [x] 42-04-factcheck-endpoints-PLAN.md — api/factcheck.py six actions + two-step evidence preview/apply (Wave 3, FCT-05/06)
- [x] 42-05-derived-selectors-workspace-provider-PLAN.md — deriveFactCheckSummary + isMustFix + provider claimRows extension (Wave 2, FCT-02)
- [x] 42-06-provenance-card-stage3-screen-PLAN.md — shared ClaimProvenanceCard + Stage 3 screen: summary/filters/table/actions (Wave 4, FCT-02/03/04/05/06)
- [x] 42-07-draft-approval-card-reuse-PLAN.md — Draft ClaimMark + Approval SourceIndex consume the shared card (Wave 5, FCT-04)
- [x] 42-08-integration-gate-PLAN.md — full suites + strict build + Convex dev sync + demo-leg UAT (Wave 6)
**UI hint**: yes

### Phase 43: My Tasks & Decision Log
**Goal**: My Tasks becomes a derived projection over open claims, open findings, and missing sign-offs — no new task store — and every reason-requiring action console-wide writes to one shared Decision log.
**Depends on**: Phase 42 (Fact Check's claims are the primary source My Tasks projects over); Phase 34/36 (existing sign-offs My Tasks also projects over)
**Requirements**: TSK-01, TSK-02, TSK-03, TSK-04, TSK-05, TSK-06
**Success Criteria** (what must be TRUE):
  1. My Tasks lists every open claim, open finding, and missing sign-off as a derived task, computed as a selector over existing data — not a new tasks table.
  2. Each task shows a plain-language title, the issue/area affected, why human judgment is required, severity (Must fix / Review recommended / Information), stage, age, and the agent's recommendation when one exists.
  3. Clicking a task's primary action deep-links to the exact claim, passage, or decision; "Inspect context" opens the inspector on that artifact.
  4. When nothing needs the operator, My Tasks says so explicitly and points to Approval — silence is a designed state, not an empty list.
  5. A task whose underlying step was restarted shows as superseded with a link to the new step, rather than disappearing silently.
  6. Every reason-requiring action across the console (remove lead, override a recommendation, keep as written, hold, activate with regression, Do not use) writes to one Decision log component recording actor, action, time, reason, before/after, instruction version, issue, and run.
**Plans**: 9 plans (6 waves)
- [x] 43-01-contract-audit-decision-shape-PLAN.md — §43 contract: audit_log decision fields + shared decision-write helper + projection query + derivedState corrections (Wave 1)
- [x] 43-02-audit-decision-substrate-convex-PLAN.md — audit_log additive fields + writeDecision + listDecisions + users read query + Convex sync (Wave 2)
- [x] 43-03-derivetasks-age-deeplink-fix-PLAN.md — deriveTasks openedAt/age + claim→/fact-check & facts-signoff→/approval href fix (Wave 2)
- [x] 43-04-superseded-resolved-session-logic-PLAN.md — taskSupersession module: run.section_rerolled cross-ref + resolved session memory (Wave 3)
- [x] 43-05-my-tasks-screen-nav-handoff-PLAN.md — /my-tasks screen + empty/superseded states + Editorial nav item + inbox See-all (Wave 4)
- [x] 43-06-decision-log-component-mounts-PLAN.md — shared DecisionLog component + Approval-panel & Workspace-frame mounts (Wave 3)
- [x] 43-07-retrofit-reason-actions-shared-helper-PLAN.md — route hold/reopen/activate-override/keep-as-written through the shared helper (Wave 4)
- [x] 43-08-do-not-use-reason-capture-PLAN.md — net-new Do-not-use reason enforcement + audit emission + registry reason UI (Wave 5)
- [x] 43-09-integration-gate-PLAN.md — full suite + strict build + Convex deploy + pipeline pytest + live-session UAT (Wave 6)
**UI hint**: yes

### Phase 44: Inspect How This Was Made
**Goal**: One universal 7-tab inspector panel is reachable from six places in the product, surfacing the missing-expected-input diff as the single highest-leverage diagnostic in the design.
**Depends on**: Phase 43 (My Tasks' "Inspect context" is one of the six entry points); existing `agent_runs`/`prompt_versions`/`VariableRegistry` substrate (Phases 23-24, 28)
**Requirements**: INS-01, INS-02, INS-03, INS-04, INS-05, INS-06
**Success Criteria** (what must be TRUE):
  1. Operator opens the same inspector panel from the brief organization card, the draft passage toolbar, the fact-check claim detail, a voice finding, the approval recommendation, and My Tasks.
  2. The panel shows seven tabs (Summary, Inputs, Instructions, Output, Sources, Diagnostics, Technical) with human-readable content first — raw JSON is never the default view on any tab.
  3. The Inputs tab explicitly calls out missing expected inputs, computed as declared template variables minus the keys actually supplied in the run's input payload.
  4. The Instructions tab shows the exact active instruction version and the shared rules referenced, and links through to Agent Instructions via "Improve this agent."
  5. The Output tab shows the full human-readable output and notes when the issue text has since diverged from it.
  6. The panel footer offers Ask agent to revise, Restart from this step, Improve this agent, Compare instruction versions, Related quality tests, and Prior & downstream steps on every artifact type.
**Plans**: 9 plans (6 waves)
- [x] 44-01-contract-and-wave0-test-stubs-PLAN.md — API_CONTRACTS §44 (InspectorArtifact, resolver, redefined missing-inputs diff, inputKeys field, openInspector) + 5 Wave-0 test stubs (Wave 1)
- [x] 44-02-inputkeys-schema-pipeline-substrate-PLAN.md — additive agent_run_payloads.inputKeys + savePayload + pipeline untruncated emit + pytest (Wave 2)
- [x] 44-03-pure-artifact-step-resolver-PLAN.md — lib/inspectorArtifact.ts: 6 artifact types → agentKey/promptKey, editor_gate_1/editor_gate1 alias, bonus variant, artifact-key encoding (Wave 2)
- [x] 44-04-missing-inputs-diff-and-divergence-PLAN.md — declaredStateInputs + truncation-honest missing diff (RESEARCH Pitfall 1 redefinition) + output-divergence predicate (Wave 2)
- [x] 44-05-seven-tab-inspector-panel-PLAN.md — shared summarize helpers + presentational 7-tab InspectorPanel + footer (live vs reserved) (Wave 3)
- [x] 44-06-inspector-provider-container-mount-PLAN.md — InspectorProvider (one instance) + data-fetching container + mount at (dashboard) root (Wave 4)
- [x] 44-07-entry-points-draft-voice-factcheck-PLAN.md — draft passage + voice finding (shared galley onInspect) + fact-check claim (ClaimProvenanceCard callback) (Wave 5)
- [x] 44-08-entry-points-approval-mytasks-org-PLAN.md — approval recommendation + My Tasks (enable + deriveTasks.insp) + brief org card (Wave 5)
- [x] 44-09-integration-gate-PLAN.md — full suite + strict build + Convex sync + pipeline pytest + cross-surface live UAT (Wave 6)
**UI hint**: yes

### Phase 45: Agent Revision
**Goal**: "Ask agent to revise" becomes an editing verb available everywhere a passage is selected, with direction chips and an explicit claim-delta comparison before anything applies, bounded by a per-issue cost guard.
**Depends on**: Phase 44 (the inspector footer's "Ask agent to revise" action this phase implements); Phase 42 (generalizes the span-scoped revision endpoint FCT-06 establishes — do not build a second one; also the source of claim-delta computation via `claim_checks`)
**Requirements**: REV-01, REV-02, REV-03, REV-04, REV-05
**Success Criteria** (what must be TRUE):
  1. Selecting a passage in Draft offers Edit text, Ask agent to revise, Compare with previous, Restore previous, Related facts & sources, and Inspect how this was made.
  2. "Ask agent to revise" presents direction chips (Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom) — never a bare "Regenerate."
  3. A revision request returns a comparison card showing original, proposed, what changed, and the explicit claim delta (added / removed / altered) before anything is applied.
  4. Operator can Apply, Edit before applying, Try another approach, or Discard; Apply mutates the draft through the existing content-patch write boundary and logs to `audit_log`.
  5. Revision calls are bounded by a per-issue cost guard, visible against the header's cost-vs-budget readout.
**Plans**: 7 plans (4 waves)
- [x] 45-01-contract-and-wave0-test-stubs-PLAN.md — API_CONTRACTS §45 (passage-revision preview/apply shapes, 7 chip ids, claim-delta, cost-guard 409) + blockIndexFromKey helper + 6 Wave-0 test stubs (Wave 1)
- [x] 45-02-pipeline-shared-prose-patch-core-and-cost-primitives-PLAN.md — extract content.py::_patch_prose_span (one shared apply path, D-01) + budget.py::would_exceed_run_cap + 'revision' llm_config (Wave 2)
- [x] 45-03-pipeline-revision-endpoint-PLAN.md — api/revision.py revise/preview+apply (direction-chip prompt, claim delta, distinct-agentKey cost recording, cost-guard 409, sign-off revoke, one audit row) (Wave 3)
- [x] 45-04-frontend-revision-flow-kit-PLAN.md — revisionClient + DirectionChips + RevisionComparisonCard + RevisionFlow (chips→preview→card→apply, try-another/edit-before-applying) (Wave 2)
- [x] 45-05-frontend-passage-toolbar-and-surface-wiring-PLAN.md — data-block-index stamping + PassageToolbar (6 actions, Compare/Restore reserved) + Draft/Voice wiring + InspectorFooter flipped live (Wave 3)
- [x] 45-06-frontend-cost-vs-budget-readout-PLAN.md — deriveRunCostUsd/deriveRunCapUsd + WorkspaceStateProvider agentRuns subscription + never-blank FrameChrome header readout (Wave 2)
- [x] 45-07-integration-gate-PLAN.md — full suite + strict build + Convex-sync confirm + Annotations demo-leg UAT (Wave 4)
**UI hint**: yes

### Phase 46: Signal Editor & Candidate Verification
**Goal**: The v3.0 deferral comes due — a Signal Editor agent and a deterministic `verify_candidates` check are added to the pipeline graph, growing it from 18 to 20 nodes, so Stage 1 has real leads and verification records to render.
**Depends on**: Phase 39 (existing 18-node pipeline graph, Postgres checkpointer, Editorial Memory this phase extends); independent of Phases 40-45 — a self-contained backend track with no console dependency
**Requirements**: SGE-01, SGE-02, SGE-03, SGE-04, SGE-05
**Success Criteria** (what must be TRUE):
  1. A pipeline run's new Signal Editor node emits 3-5 dated story leads, each with premise, dated peg + source link, reader energy, charitable angle, category, confidence, and a brand-risk flag where applicable.
  2. The Signal Editor never self-selects a brand-risk-flagged lead — that decision always routes to the human.
  3. A `verify_candidates` deterministic check runs after Scout and produces a verification record per organization (domain live, registration ID, obscurity/press scan), killing candidates that fail.
  4. The pipeline graph runs 20 nodes end-to-end — `signal_editor` before `scout`, `verify_candidates` between `scout` and `advocate` — and the Postgres checkpointer resumes correctly across a pause/resume cycle that spans the new nodes.
  5. The Signal Editor reads Editorial Memory (recent coverage, avoid-list) and surfaces a repetition warning alongside a lead rather than silently suppressing it.
**Plans**: 8 plans (6 waves)
- [x] 46-01-contract-convex-store-and-wave0-tests-PLAN.md — API_CONTRACTS §46 (StoryLead + VerificationRecord + 2 DispatchState fields) + story_leads/verification_records Convex tables & functions + secret-guard + 3 Wave-0 test scaffolds (Wave 1)
- [x] 46-02-dispatchstate-contract-and-repetition-helper-PLAN.md — state.py StoryLead/VerificationRecord TypedDicts + JSON-safe fields + lib/registry_repetition.compute_repetition_note extraction (Wave 2)
- [x] 46-03-signal-editor-prompt-and-model-registration-PLAN.md — llm_config/config_loader signal_editor (Sonnet) registration + signal_editor.md/signal_editor_user.md prompts + seed script (Wave 1)
- [x] 46-04-signal-editor-agent-PLAN.md — agents/signal_editor.py (@agent_node: 3-5 leads, brand-risk recommended=false Python gate, Editorial Memory repetition warning) + unit tests (Wave 3)
- [x] 46-05-verify-candidates-and-editor-recovery-PLAN.md — agents/verify_candidates.py deterministic check + editor_gate_1 all-killed recovery (D-14) + unit tests (Wave 3)
- [x] 46-06-graph-wiring-and-consumer-sync-PLAN.md — builder.py 20-node rewire + api/runs.py agent_keys + agent_wrapper _INPUT_KEYS + test_builder_wiring/test_pipeline_real_mode updates (Wave 4)
- [x] 46-07-checkpoint-resume-and-integration-gate-PLAN.md — test_checkpoint_resume_phase46 (SGE-04) + full suite + Convex parity/live-sync gate (Wave 5)

### Phase 47: Story & Brief Stage
**Goal**: Stage 1 is REPLACED, not built from nothing: the provisional Signal Desk that Phase 41 mounted as Stage 1 is swapped out for the full v3 design, built on the leads and verification records Phase 46 now produces — organization options, "Needs your decision" adjudication when agents can't confidently choose, and an editable Brief the writers draft from.
**Depends on**: Phase 46 (Signal Editor leads + `verify_candidates` records this stage renders); Phase 41 (Workspace frame + stage tabs Story & Brief mounts into, REPLACING the provisional Signal Desk Phase 41 carried over as Stage 1)
**Requirements**: BRF-01, BRF-02, BRF-03, BRF-04, BRF-05, BRF-06
**Success Criteria** (what must be TRUE):
  1. Stage 1 shows story leads as cards with peg + source, reader energy, angle, category, confidence, and any brand-risk warning shown in full — never truncated or tooltip-hidden.
  2. Operator can Require a lead, or Remove it with a mandatory logged reason.
  3. Organization options are grouped under the chosen lead, each showing mechanism, verification record with dates, agent case, confidence, prior-coverage warning, and its main concern always visible.
  4. When agents cannot confidently choose, the stage enters a "Needs your decision" state with the top two options side by side (what each makes possible, evidence quality, risk, burden); the operator's choice requires a rationale and resumes the run via the existing interrupt/resume endpoint.
  5. An editable Brief (premise, current peg, central claim, reader effect, known risks, voice intention) is generated after selection, and the section writers draft from it.
  6. Operator can ask an agent to strengthen any single field of the Brief.
**Plans**: 8 plans (4 waves)
- [x] 47-01-contracts-convex-store-wave0-tests-PLAN.md — API_CONTRACTS §7 Brief + new §47 (briefs table, story_leads.status, leads + brief endpoints) + `briefs` Convex table/functions + `storyLeads.setStatus` + guarded-path registration + live-sync/parity + 6 Wave-0 test scaffolds (Wave 1)
- [x] 47-02-dispatchstate-brief-and-editor-gate1-generation-PLAN.md — state.py Brief TypedDict + deterministic Brief assembly in `editor_gate_1` (no new node/LLM) + `briefs:insert` (Wave 2)
- [x] 47-03-writer-brief-threading-PLAN.md — `build_section_writer_prompt` 5th `brief` param + thread `state.get("brief")` into all 7 section writers (Wave 3)
- [x] 47-04-leads-and-brief-fastapi-endpoints-PLAN.md — `api/leads.py` Require/Remove (reason-gated) + `api/brief.py` PATCH + field-strengthen preview/apply + wire `_fetch_brief_context` to `briefs:byRunId` (Wave 2)
- [x] 47-05-workspace-subscriptions-lead-card-actions-PLAN.md — WorkspaceStateProvider storyLeads/verificationRecords/briefs subs + `requireLead`/`removeLead` clients + LeadCard (BRF-01, never-truncated) + LeadActions (BRF-02) (Wave 2)
- [x] 47-06-org-options-and-needs-your-decision-PLAN.md — OrgOptionSlate (BRF-03, joinCandidates + verification dates + never-truncated concern) + NeedsYourDecisionCard (BRF-04, two-option + adjudicateGate1 resume) (Wave 3)
- [x] 47-07-brief-field-table-and-strengthen-PLAN.md — briefClient + BriefFieldTable (BRF-05 editable) + BriefFieldStrengthen (BRF-06, field-scoped RevisionFlow) (Wave 3)
- [x] 47-08-story-brief-screen-mount-and-phase-gate-PLAN.md — StoryBriefScreen composition + empty/loading/error + deriveStoryStage tighten + mount replaces SignalDeskScreen + DELETE StoryPanelContent.tsx + strict build/full suites/Convex parity gate (Wave 4)
**UI hint**: yes

### Phase 48: Brief Entry Point
**Goal**: "Start from my brief" becomes a real second pipeline entry point — not a stub — letting a human-supplied premise skip discovery entirely and enter the run at the Researcher.
**Depends on**: Phase 47 (the editable Brief artifact this entry point's human-authored input must match the shape of)
**Requirements**: ENT-01, ENT-02, ENT-03, ENT-04
**Success Criteria** (what must be TRUE):
  1. Create issue offers two equal paths — "Find a story with agents" and "Start from my brief" — both landing in the Issue Workspace at Story & Brief.
  2. Operator can submit a human-supplied premise, peg, organization, and optional source material, starting a run that skips Signal Editor, Scout, Advocate, and Gate 1, and enters directly at the Researcher.
  3. A brief-started run produces the same downstream artifacts (research, sections, QA, claims, sign-offs) as an agent-discovered run and is indistinguishable from one at Stages 2-5.
  4. An organization supplied in a human brief is still put through `verify_candidates`, so its verification record is never absent.
**Plans**: 7 plans (4 waves)
- [x] 48-01-contracts-convex-schema-dispatchstate-PLAN.md — API_CONTRACTS §7 (entry_mode + source_material) + new §48 + DispatchState fields + convex/schema.ts runs.entryMode + runs.ts create arg + Convex live-sync (Wave 1)
- [x] 48-02-wave0-test-scaffolds-PLAN.md — failing/skip-guarded test scaffolds: builder-fork source-scan, _start_run seed, brief-run endpoint, verify_candidates advisory (green), e2e brief-mode, CreatePanel + StoryBriefScreen (Wave 1)
- [x] 48-03-pipeline-entry-seam-PLAN.md — builder.py two conditional edges + route_by_entry_mode + _start_run entry_mode/seed/reduced-queue/briefs:insert + Researcher source_material threading (Wave 2)
- [x] 48-04-brief-trigger-endpoint-PLAN.md — api/control.py shared _enforce_start_gates helper + POST /pipeline/run/brief (BriefRunBody, 422/409 gates, reduced queue, entry_mode='brief', audit) (Wave 3)
- [x] 48-05-create-panel-brief-path-PLAN.md — triggerBriefRun client + CreatePanel second peer card + inline brief-intake form (ensureByNumber -> triggerBriefRun -> issueHref) (Wave 2)
- [x] 48-06-stage1-brief-mode-render-PLAN.md — WorkspaceStateProvider entryMode + new BriefOrgCard (single verified human org, concern never truncated) + StoryBriefScreen brief-mode branch (Wave 2)
- [x] 48-07-integration-gate-PLAN.md — activate brief-mode e2e (same artifacts minus deliberation) + full suites + strict next build + Convex live-sync gate (Wave 4)
**UI hint**: yes

### Phase 49: Roles & Permissions
**Goal**: Every action gated to Editor-in-chief across the workspace is enforced server-side, not just hidden in the UI, and a Collaborator sees exactly what they can't do and why.
**Depends on**: Phase 41 (publish, Voice Pass approval), Phase 42 (evidence-replacement confirmation), Phase 45 (apply revision), Phase 47 (Do-not-use lives in Editorial Memory, gated the same way) — the surfaces whose six actions this phase gates
**Requirements**: ROL-01, ROL-02, ROL-03, ROL-04
**Success Criteria** (what must be TRUE):
  1. A signed-in user carries a role of Editor-in-chief or Collaborator, and role checks are enforced server-side — a Collaborator's direct API call to a gated action is rejected, not merely hidden client-side.
  2. Exactly six actions are gated to Editor-in-chief: apply revision, confirm evidence replacement, approve the Voice Pass, publish, make an instruction active, mark an organization Do not use.
  3. A Collaborator sees every gated control rendered and locked with an explanation of why, never hidden from view.
  4. A Collaborator can read every screen and leave comments.
**Plans**: 9 plans
Plans:
- [x] 49-01-contract-first-role-comments-PLAN.md — API_CONTRACTS §49 (role vocab + comments table) + schema shapes
- [x] 49-02-clerk-claim-empirical-gate-PLAN.md — Clerk role claim on both token surfaces + empirical propagation gate (checkpoint)
- [x] 49-03-fastapi-editor-gate-PLAN.md — _require_editor + gate the 4 FastAPI actions + test_role_gate.py
- [x] 49-04-convex-editor-gate-PLAN.md — requireEditor + gate activate/setStatus + update convex-test identities
- [x] 49-05-comments-backend-PLAN.md — convex/comments.ts add/listByIssueNumber (both roles) + tests
- [x] 49-06-role-hook-lockedcontrol-PLAN.md — useRole() hook + reusable LockedControl wrapper
- [x] 49-07-wire-locked-controls-PLAN.md — wrap the six controls with verbatim §6 locked labels
- [x] 49-08-comments-affordance-mount-PLAN.md — IssueComments mounted in FrameChrome + My Tasks
- [x] 49-09-integration-gate-PLAN.md — exactly-six source-scan + full suites + strict build + Convex sync (checkpoint)
**UI hint**: yes

### Phase 50: Workbench & Nomenclature
**Goal**: The System Workbench gets its final rename and shape — Run Monitor → Run Details, Prompt Lab → Agent Instructions, Eval Center → Quality Tests, Registry → Editorial Memory — and the nomenclature table from the binding spec is applied consistently everywhere in the console.
**Depends on**: All prior v4.0 phases (nomenclature and the Editorial/Workbench nav split ripple across every screen built in Phases 40-49); Phases 37, 38, 39 (the v3.0 screens being renamed and extended with the recovery rail + "why this draft exists" bridge)
**Requirements**: WBN-01, WBN-02, WBN-03, WBN-04, WBN-05, WBN-06
**Success Criteria** (what must be TRUE):
  1. Nav shows two visibly distinct groups — Editorial (Issues, My Tasks, Issue Workspace) and System Workbench (Run Details, Agent Instructions, Quality Tests, Editorial Memory) — with the signed-in role shown.
  2. Run Details names steps by action ("Find story leads", "Verify research", "Draft sections") with the agent as secondary metadata, renders deterministic checks as diamond markers, and states plainly whether it's showing a historical record or a live run.
  3. A failed run shows a plain-language recovery rail (what happened / what completed successfully / what did not happen / recommended recovery) with Restart from this step (reusing completed steps, not re-paying for them) and Improve this agent; downstream steps dim as Skipped.
  4. Agent Instructions shows why a draft instruction exists, linking back to the specific issue output that motivated it.
  5. Typed confirmation appears only for Mark Do-not-use (organization name + required reason); the automation toggle no longer lives on the operator surface, moved to Administration.
  6. Every renamed term from the nomenclature table (deterministic check, step / Restart from this step, Make active / Restore version, Quality test / Standard test case, Preview next run, Do not use, Must fix, Human approval required) appears consistently across the console — no legacy term ("gate", "node", "eval", "golden scenario", "shadow run", "blocklisted") remains in operator-facing copy.
**Plans**: 7 plans (4 waves)
Plans:
- [x] 50-00-topology-nomenclature-module-tripwire-scaffolds-PLAN.md — Wave 0 prereq: fix pipelineTopology.ts to 20 nodes + reconcile GATE_KEYS diamond set + signal_editor reachability; shared lib/nomenclature.ts (RUN_STEP_MAP + renamed terms); nomenclature banned-term tripwire (skip-guarded) + route/enum preservation tripwire (Wave 0)
- [x] 50-01-nav-rename-role-indicator-PLAN.md — WBN-01: rename the 4 Workbench nav labels + screen headings over unchanged hrefs; net-new signed-in role indicator bottom-left (Wave 1)
- [x] 50-02-run-details-action-steps-diamonds-framing-PLAN.md — WBN-02: §7 action-named steps (agent secondary) via RUN_STEP_MAP, reconciled diamonds, 7-writers collapse, historical-vs-live framing (Wave 1)
- [x] 50-03-automation-reframe-typed-confirm-donotuse-PLAN.md — WBN-06/WBN-05: remove automation switch-framing (Masthead/banner to Administration), typed org-name confirm on Mark Do-not-use, verify no typed-confirm on publish, "Do not use" label over unchanged 'blocklisted' (Wave 1)
- [x] 50-04-why-this-draft-exists-origin-ref-PLAN.md — WBN-04: contract-first prompt_versions.originRef additive field + Convex sync; "Improve this agent" carries origin; editor renders "why this draft exists" (Wave 1)
- [x] 50-05-failed-run-recovery-rail-honest-restart-PLAN.md — WBN-03: 4-part recovery rail + Skipped dimming; honest 3-of-11 Restart matrix (writers/Gate-1/Publisher-Clerk-bridge live, 8 reserved); Improve-this-agent (Wave 2)
- [x] 50-06-nomenclature-sweep-tripwire-green-PLAN.md — WBN-05: sweep how-to-use glossary + Prompt Lab/Eval Center + 260710-k8y conflict terms (Rehearsal/Make live/Draft vs. live); un-skip the nomenclature tripwire green; phase gate (Wave 3)
**UI hint**: yes
## v5.0 Phase Details — The Editorial App

Derived 2026-07-31 from PROJECT.md's Current Milestone (goal, locked decisions, reconciliation facts), the Claude Design architecture/Section/Issue mockups (project `38e48d39-1983-4178-a622-b21299a6ca0c`, previews 20/21/22), and 24 v5.0 requirements (READ/HOME/DOOR/PAST). One requirement block maps to exactly one phase, across 4 phases numbered 51–54, continuing from v4.0 (which ended at Phase 50). The phase sequence is client-agreed, not purely dependency-derived: **Phase 51** (Section) ships first — deliberately — because it is where 90% of editor time goes, it is the surface that must feel right after three rejected UI passes, it re-tests the riskiest assumption (fact/voice/sourcing problems marked in the sentence, fixed without leaving the paragraph) at the lowest possible risk since it reuses the existing galley/annotation/finding-resolution system wholesale, and it must produce something the client can react to before the milestone ends, not at its end. **Phase 52** (Issue front door) follows because its table of contents composes Phase 51's per-section derived state and links directly into it, and because publish moves to the page footer — the same gate, role check, and server enforcement Phase 34/41 already built, not a fourth page. **Phase 53** (Admin door) follows because operational tooling can only be fully removed from the editor's path once the two editorial surfaces it is being removed from (51, 52) are real. **Phase 54** (Archive) is last, matching its own least-used-of-four billing in the design contract.

**Reuse discipline (do not rebuild):** the galley + inline span annotations + finding resolution (Phase 32/33), the claim ledger + provenance card (Phase 35/42), the two-sign-off publish gate + role-gated actions (Phase 34/41/49), the issue-keyed routing + derived-state selectors (Phase 40/41), and the `runs.latest → pipelineRuns.byRunId → issueNumber` current-run resolution (quick 260730-ldn) are v5.0's foundation, not v5.0's work — no phase below forks or re-implements them. The backend (pipeline, the 9 agents / 20 nodes, Convex, Sanity, the content-patch API) is untouched by every phase in this milestone; zero schema changes are anticipated. The v4.0 console (today's `/run`, `/issues/[n]/*`, `/review-desk/*`, `/voice-pass/*`, and its System Workbench nav items under their current names) keeps running at its current URLs throughout — this milestone is additive; retiring those old routes is explicitly out of scope for all four phases below and belongs to a later milestone. There is no bookkeeping anywhere in this milestone: the `useReviewedSections` localStorage layer is deleted, and every section/issue state below is derived from open findings, never a manual mark.

### Phase 51: Section — Read and Fix in Place
**Goal**: An editor can read any section of the current issue as full-width prose and fix a factual, voice, or unsourced-claim problem without leaving the paragraph — the riskiest assumption in the redesign, tested first, reusing the galley/annotation/finding-resolution system wholesale.
**Depends on**: Phase 50 (v4.0 substrate this composes into a new reading surface: the native galley + span-resolver [Phase 32], accept-fix wiring [Phase 33], claim/finding data [Phase 35/42], role-gated apply [Phase 49] — nothing new within v5.0; first phase of the milestone)
**Requirements**: READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, READ-08
**Success Criteria** (what must be TRUE):
  1. Editor opens `/s/[section]` and reads the section as full-width prose (~760px reading measure, Lora body type, no side rails, no form fields) — a page to read, not a workspace to navigate.
  2. Editor sees every fact, voice, and unsourced-claim problem marked directly inside the sentence it affects, each distinguishable by a text label as well as by colour (never colour alone).
  3. Editor can open a marked problem in place and read the agent's reasoning and its evidence without leaving the paragraph.
  4. Editor can accept a suggested correction in one action — including every place the same correction recurs in the section — edit the passage themselves instead, or dismiss a finding that isn't a problem with the reason the existing annotation system already requires.
  5. Editor can move to the previous or next section without returning to the issue, and sees how many sections still need them, computed from open findings and never from a manual mark.
**Plans**: 7 plans (5 waves)
Plans:
- [x] 51-00-wave0-test-scaffolds-PLAN.md — Wave 0: new __tests__/SectionReaderPage.test.tsx (skip-guarded) + Pitfall-1/Pitfall-2/READ-02 cases in AnnotationMark/ClaimMark/ClaimProvenanceCard tests (Wave 1)
- [x] 51-01-shared-primitives-editable-sections-phrasing-safe-generate-fix-PLAN.md — D-17 EDITABLE_SECTIONS promotion + re-export; ClaimProvenanceCard phrasingSafe mode; label-independent generateFixOnAccept + Fact/Voice/Source showAxisTag + D-09 markSourcedClaims opt-out, threaded Galley -> GallerySection -> mark (Wave 2)
- [x] 51-02-editorial-route-group-shell-scoped-typography-PLAN.md — app/(editorial)/layout.tsx with its own Confirm/CommandPalette/Inspector stack (Pitfall 3) + .section-reader 760px/17.5px/16px scoped CSS (Wave 2)
- [x] 51-03-delete-reviewed-bookkeeping-derive-story-desk-PLAN.md — D-25: delete useReviewedSections + drive StoryDeskGrid/StoryFocusView/ReviewDeskRunView from open-finding counts (Wave 2)
- [x] 51-04-section-reader-page-honest-states-nav-count-PLAN.md — /s/[section]: current-run + draft + single-section Galley (all axes, neutral labels), three honest states, exempt-section notes, end-of-prose prev/next + derived count (Wave 3)
- [x] 51-05-in-place-editor-group-accept-PLAN.md — in-place textarea block editor (patchSection/patchBonus branch, 409 copy) + pure findingGroups selector + group-aware sequential Accept with honest partial failure (Wave 4)
- [x] 51-07-evidence-in-the-finding-popover-PLAN.md — READ-03/D-20: pure findingClaimLink intersection selector + ClaimProvenanceCard mounted phrasingSafe inside AnnotationMark's popover (client-derived link, zero schema change) (Wave 5)
- [ ] 51-06-integration-gate-strict-build-PLAN.md — full Vitest suite + mandatory pnpm --filter dispatch-control build + invariant source-scan + human read-through checkpoint (Wave 6)
**UI hint**: yes

### Phase 52: Issue — The Front Door
**Goal**: An editor lands on the current issue's real title and subject, sees the nine sections as a table of contents with derived state, and can publish from the page footer through the unchanged gate.
**Depends on**: Phase 51 (the Section surface the table of contents links into and whose per-section derived state it reads); the existing `runs.latest → pipelineRuns.byRunId → issueNumber` resolution and the two-sign-off publish gate (Phase 34/41) this phase composes at `/`, never re-implements
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-07, HOME-08, HOME-09
**Success Criteria** (what must be TRUE):
  1. Editor lands on `/` and sees the current issue's real title and subject — never an invented, empty, or reserved-slot issue — resolved the locked way (`runs.latest → pipelineRuns.byRunId → issueNumber`, never `max(issueNumber)`).
  2. Editor sees all nine sections as a table of contents, each showing its actual produced headline and a state derived from its open findings — nothing to tick, nothing to maintain.
  3. Editor sees one plain-language sentence describing what needs doing and can go straight from it into the first thing that needs them.
  4. Editor sees the three publish gates as the page footer, each naming what's blocking it and linking to the work that unblocks it, and can publish once both sign-offs are recorded and no must-fix findings remain — through the existing gate, role check, and server enforcement, never a parallel path.
  5. Editor sees an honest state when nothing is running, when a run is running, and when a run failed (a failed run offers no sign-off action it can't honour), and is never shown "clean" or "nothing needs you" while findings, claims, or sign-offs are still loading.
**Plans**: TBD
**UI hint**: yes

### Phase 53: Admin — The Door
**Goal**: Every operational surface is reachable from one admin entrance with its capability unchanged, and never appears in the editor's reading-and-fixing path — while the v4.0 console remains reachable as the publish fallback.
**Depends on**: Phase 52 (the front-door corner link this door is reached from); the existing Run Details [Phase 50], Agent Instructions [Phase 24/28/50], Quality Tests [Phase 38/50], Editorial Memory [Phase 39/50], Signal Desk [Phase 37], Finance [Phase 27], Config [Phase 22], and Settings screens this phase relocates behind one entrance without modifying them
**Requirements**: DOOR-01, DOOR-02, DOOR-03, DOOR-04
**Success Criteria** (what must be TRUE):
  1. Operator reaches every operational surface (Run Details, Agent Instructions, Quality Tests, Editorial Memory, Signal Desk, Finance, Config, Settings) from one `/admin` entrance.
  2. Every relocated operational page performs exactly as it did before the move — no capability lost, dropped, or degraded by the relocation.
  3. Editor reading or fixing an issue at `/` or `/s/[section]` never encounters operational nav or tooling.
  4. Operator can still reach and publish through the existing v4.0 console at its current URL — there is no week this milestone leaves without a way to publish.
**Plans**: TBD
**UI hint**: yes

### Phase 54: Archive — Past Issues
**Goal**: An editor recognizes and finds a past issue by its title and subject rather than its number, and can tell published, held, and scheduled issues apart at a glance — the least-used of the four surfaces, built last.
**Depends on**: Phase 52 (the issue-title/derived-state resolution this reuses for archive rows); Phase 53 (completes the four-surface set before the milestone closes)
**Requirements**: PAST-01, PAST-02, PAST-03
**Success Criteria** (what must be TRUE):
  1. Editor sees past issues listed by their real title, not by issue number.
  2. Editor can search past issues by subject and find the one they mean without knowing its number or date.
  3. Editor can tell published, held, and scheduled issues apart at a glance, each carrying a distinct label (never colour alone).
**Plans**: TBD
**UI hint**: yes
