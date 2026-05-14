# Requirements: The Eisenbalm Dispatch

**Defined:** 2026-05-09
**Core Value:** Every Thursday, ship a complete, on-voice issue: one obscure charity, eight original sections (origin story, problem, founder bio, case study, game, bonus, deliberation, podcast), and a working shop callout — published only after Andrew's manual review.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases (see Traceability).

### Foundation (Sanity)

- [x] **FND-01**: Sanity Studio renders all schema types (`charity`, `weeklyIssue`, `agentProfile`) with every field editable
- [x] **FND-02**: Sanity v5 TypeGen generates TypeScript types from schemas + GROQ queries on every build
- [x] **FND-03**: One `agentProfile` document is seeded for each of the 14 named agents (calibrator, scout, advocate, editor, researcher, origin-story, problem-statement, founder-bio, case-study, game, bonus, design, qa, publisher)
- [x] **FND-04**: Andrew can log into Sanity Studio, edit any field of a `weeklyIssue` draft, and save changes

### Web Shell (reads from Sanity, themed per issue)

- [x] **WEB-01**: Reader landing on `/` is routed to the latest published issue
- [x] **WEB-02**: Reader can view a full issue at `/issue/[slug]` with sections in correct order: charity header → origin story → problem → founder bio → case study → game → bonus → deliberation → podcast → shop callout
- [x] **WEB-03**: Reader can browse the archive at `/archive`, sortable by issue number and searchable by charity name / focus area
- [x] **WEB-04**: Reader can browse the charity database at `/charities` and view individual charities at `/charities/[slug]`
- [x] **WEB-05**: Reader can view a static `/about` page with Jesse's about copy
- [x] **WEB-06**: Each issue page injects `theme.{primary,accent,background,text}Color` and `theme.{fontDisplay,fontBody}` as CSS variables so typography and color change per issue while grid stays constant
- [x] **WEB-07**: Theme color values are validated as 6-digit hex strings before injection (CSS injection prevention)
- [x] **WEB-08**: Theme injection uses `element.style.setProperty(...)` (not template-literal CSS strings)
- [x] **WEB-09**: Theme color combinations are checked for WCAG AA contrast at render time; degraded fallback applied if contrast fails
- [x] **WEB-10**: Each issue page emits `schema.org/Article` JSON-LD with charity name, founder, publish date, author=Jesse
- [x] **WEB-11**: Each issue page emits Open Graph + Twitter card meta tags
- [x] **WEB-12**: An XML sitemap at `/sitemap.xml` lists all published issues and charity pages
- [x] **WEB-13**: An RSS feed at `/feed.xml` lists all published issues
- [x] **WEB-14**: Each issue page has a print stylesheet that renders cleanly without theme color background
- [x] **WEB-15**: Each issue page shows estimated reading time computed from total section word count
- [x] **WEB-16**: Each issue section has an anchor copy-link button

### Convex (deployed schema + functions)

- [x] **CVX-01**: Convex deploys with the existing `convex/schema.ts` (tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`)
- [x] **CVX-02**: Convex query functions exist for `pipelineRuns.byRunId`, `pitchLog.byRunId`, `agentVotes.byRunId`, `qaCorrections.byRunId`, `deliberationEvents.byRunId`
- [x] **CVX-03**: Convex mutation functions exist for inserting a `pipelineRun`, appending `pitchLog` entries, appending `agentVotes`, appending `qaCorrections`, appending `deliberationEvents`
- [x] **CVX-04**: `CONVEX_DEPLOY_KEY` is provisioned and stored in Vercel + Railway environment configurations
- [x] **CVX-05**: Web app `useQuery` subscriptions to all five Convex queries return empty arrays without errors when no data exists

### Pipeline Skeleton (LangGraph + 14 stub agents)

- [x] **PIP-01**: FastAPI app builds and deploys to Railway via custom Dockerfile (with WeasyPrint system deps pre-installed)
- [ ] **PIP-02**: FastAPI exposes `POST /run/weekly` that triggers a new pipeline run and returns `{runId}`
- [ ] **PIP-03**: LangGraph graph wires all agents in the brief's exact sequence: Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → fan-out{OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design} → QA → Editor[final] → Publisher
- [ ] **PIP-04**: Each agent's stub returns a structurally valid LangGraph state matching the contract in `docs/API_CONTRACTS.md §7`
- [x] **PIP-05**: `runId` is generated exactly once at pipeline start and threaded into every Convex write and the `weeklyIssue.pipelineMetadata.runId` field on Sanity
- [ ] **PIP-06**: An integration test asserts that after a stub run, `weeklyIssue.pipelineMetadata.runId` on Sanity equals the `runId` on every Convex row for that run
- [x] **PIP-07**: Pipeline writes a complete `weeklyIssue` draft to Sanity at end of run (status=`draft`), creating or upserting referenced `charity` documents idempotently via deterministic `_id`
- [ ] **PIP-08**: Pipeline writes `pipelineRuns` (run start), `deliberationEvents` (per agent event), `agentVotes` (Advocate scores), `qaCorrections` (QA findings), and `pitchLog` (Scout candidates) to Convex during the run
- [ ] **PIP-09**: LangGraph state is checkpointed to Supabase Postgres via `AsyncPostgresSaver`; `checkpointer.setup()` runs once at deploy time, not on every startup
- [ ] **PIP-10**: Editor gate 1 calls `interrupt()` when no winner can be selected; LangGraph pauses, surfaces a pause state to Convex (`pipelineRuns.status = "awaiting-review"`), and resumes via a `POST /run/{runId}/resume` endpoint that re-injects the checkpoint
- [x] **PIP-11**: Per-run cost is logged (token count + USD per agent + total) to Convex `pipelineRuns.cost`
- [x] **PIP-12**: Pipeline duration (start to draft-written) is tracked on `pipelineRuns.durationMs`

### Agent Quality (voice-critical + factual safety)

- [ ] **AGT-01**: Calibrator returns a `styleBrief` with `voice` constants imported from a hardcoded module (NOT regenerated per call); selects `bonusType` (bigBudget | jingle | specAd) that does NOT match the previous issue's `bonusType`
- [ ] **AGT-02**: Calibrator output is stored on `weeklyIssue.calibratorBrief` for Andrew's review
- [ ] **AGT-03**: Scout uses Tavily web search and returns 3-5 candidates (`{name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked}`); writes each to Convex `pitchLog` as it finds them; respects an iteration limit (max N tool calls) to contain cost
- [ ] **AGT-04**: Scout candidates exclude charities already featured (cross-checked against Sanity `charity` documents)
- [ ] **AGT-05**: Advocate produces an argument and 1-10 score for every Scout candidate; writes each to Convex `deliberationEvents` as `advocate-argument`
- [ ] **AGT-06**: Editor (gate 1) selects exactly one winner with `editorDecision`, `runnerUpNotes`, and a structured `deliberationTranscript`; writes `editor-decision` event to Convex
- [ ] **AGT-07**: Researcher returns a structured research object including `founderName` AND a `founderNameSourceUrl` field that points to the charity's own website confirming the name; if no source URL is found, `founderNameVerified=false` and downstream FounderBioWriter falls back to anonymous framing
- [ ] **AGT-08**: A post-Researcher verification step fetches the charity's website (`httpx`) and string-searches for `founderName`; if not found, sets `founderNameVerified=false`
- [ ] **AGT-09**: CaseStudyWriter requires `subjectNameVerified=true` (same source-confirmation pattern); falls back to anonymous framing if not verified
- [ ] **AGT-10**: OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter each receive a structurally isolated `voiceConstraints` block (not concatenated with prior agent state); output passes a Jesse-voice rubric in QA
- [ ] **AGT-11**: BonusWriter branches on `bonusType` and emits the corresponding shape: bigBudget→`{headline, body, storyboards[]}`, jingle→`{headline, body, lyrics, sunoPrompt}` (sunoAudioUrl empty), specAd→`{headline, body}`
- [ ] **AGT-12**: GameWriter emits `{headline, description, embedCode}` where `embedCode` is self-contained HTML/JS with no external CDN URLs and no `<script src=...>` references
- [ ] **AGT-13**: DesignAgent emits `{primaryColor, accentColor, backgroundColor, textColor}` as 6-digit hex strings; values are validated before being written to Sanity
- [ ] **AGT-14**: DesignAgent emits `{fontDisplay, fontBody}` from a curated whitelist of approved Google Fonts (web + WeasyPrint compatible); whitelist is enforced at write time
- [ ] **AGT-15**: QA agent reviews all section content against a Jesse-voice rubric and factual accuracy; writes corrections to Convex `qaCorrections` with severity (info | warning | error) and acceptance status
- [ ] **AGT-16**: Editor Final reviews QA output, makes final sequencing decisions, writes any connective copy needed, and emits `editor-final` event to Convex
- [ ] **AGT-17**: Voice-critical agents (Calibrator, Editor, Editor Final, QA) use pinned OpenRouter model versions (model+revision string)
- [ ] **AGT-18**: An iteration limit is enforced on every agent that uses tool-calling (Scout, Researcher); exceeding it raises a controlled error written to `deliberationEvents` rather than silent loop

### PDF Generation + Publisher

- [ ] **PDF-01**: Publisher renders Problem Statement to PDF via WeasyPrint using `weeklyIssue.problemStatement.pdfContent` and the issue's theme colors/fonts
- [ ] **PDF-02**: PDF templates use base64-inlined `@font-face` declarations (NOT HTTP-loaded Google Fonts); fonts come from the Phase 5 whitelist
- [ ] **PDF-03**: Generated PDF uploads to Sanity as an asset and is set on `weeklyIssue.problemPdf`
- [ ] **PDF-04**: PDF download button on `/issue/[slug]` links to `weeklyIssue.problemPdf.asset->url`

### Webhook Chain (Sanity → Publisher → Vercel)

- [ ] **WHK-01**: Sanity webhook fires on `_type == "weeklyIssue" && status == "published"` to a Publisher endpoint on Railway
- [ ] **WHK-02**: Publisher endpoint verifies the webhook HMAC signature against `SANITY_WEBHOOK_SECRET` using the raw request body (`request.body()`)
- [ ] **WHK-03**: Publisher rejects webhooks where `sanity-transaction-time` is older than 5 minutes
- [ ] **WHK-04**: Publisher deduplicates webhooks via the `idempotency-key` header and a Supabase `webhook_idempotency` table with a unique constraint
- [ ] **WHK-05**: Publisher waits 30 seconds before triggering the Vercel deploy hook (Sanity CDN propagation)
- [ ] **WHK-06**: Publisher uses `useCdn: false` on the Sanity client when fetching content for PDF generation (build-time correctness)
- [ ] **WHK-07**: Publisher updates `pipelineRuns.status` to `complete` and writes a `publisher-deploy` event to Convex
- [ ] **WHK-08**: A manual `POST /run/{runId}/publish` endpoint exists as a fallback re-trigger when the Sanity webhook fails to deliver

### Game Rendering (sandbox-safe iframe)

- [ ] **GAM-01**: Issue page renders the game inside `<iframe srcdoc={embedCode} sandbox="allow-scripts">` (NEVER with `allow-same-origin`)
- [ ] **GAM-02**: An automated validator runs on every GameWriter `embedCode` output and rejects any of: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>` tags, external `<link href=...>` tags
- [ ] **GAM-03**: An ESLint or codebase-level rule prevents the iframe `sandbox` attribute from including `allow-same-origin`
- [ ] **GAM-04**: A CSP `<meta>` tag is injected into the srcdoc HTML restricting external resources
- [ ] **GAM-05**: If validation fails, the issue page renders a fallback "Game unavailable" placeholder; Andrew is notified via Convex `qaCorrections`
- [ ] **GAM-06**: Game iframe is responsive and renders correctly on mobile (≥360px wide)

### Stripe / Commerce

- [ ] **CMR-01**: Reader can view the lip balm product at `/shop` with current charity callout (server-rendered, no client flicker)
- [ ] **CMR-02**: Reader can complete a checkout via Stripe Checkout (custom integration via `checkout.sessions.create()`)
- [ ] **CMR-03**: Reader lands on `/shop/thank-you` after successful checkout (static, no DB query)
- [ ] **CMR-04**: Stripe webhook handler verifies signature using raw body (`request.text()`) and the Stripe webhook secret
- [ ] **CMR-05**: Stripe webhook signature verification has NO development-mode bypass; signature is always required
- [ ] **CMR-06**: Stripe webhook handler is idempotent on `event.id` (deduplicates retries)
- [ ] **CMR-07**: A privacy policy page exists at `/legal/privacy` (Stripe TOS + GDPR/CCPA compliance)
- [ ] **CMR-08**: A terms-of-service page exists at `/legal/terms`
- [ ] **CMR-09**: A persistent shop callout appears at the bottom of every issue page (one sentence + button — NO banner, NO modal, NO popup, NO countdown)
- [ ] **CMR-10**: Stripe shipping rates are configured in the Stripe dashboard and applied at checkout

### Deliberation Layer (live Convex UI)

- [ ] **DEL-01**: Issue page subscribes via `useQuery` to all five Convex tables filtered by the issue's `runId`
- [ ] **DEL-02**: Deliberation UI renders advocate score bars, QA severity colors, agent identity cards (using `agentProfile` from Sanity), and a pitch log timeline
- [ ] **DEL-03**: Deliberation UI is collapsed by default; reader can expand to see the deliberation
- [ ] **DEL-04**: Deliberation UI does NOT expose underlying model names (no "written by Claude" or similar)
- [ ] **DEL-05**: Deliberation UI shows graceful empty states for issues that predate Convex writes
- [ ] **DEL-06**: Each agent event in the deliberation links back to the agent's `agentProfile` page

### Podcast Section

- [ ] **POD-01**: Issue page renders an HTML5 `<audio>` player when `podcast.audioFile` is populated
- [ ] **POD-02**: Issue page renders a collapsible transcript when `podcast.deliberationTranscript` is populated
- [ ] **POD-03**: Issue page shows an "Audio coming soon" empty state when `podcast.audioFile` is empty (typical between draft and Andrew uploading the NotebookLM output)

### Operations / Observability

- [ ] **OPS-01**: Pipeline failures (any agent raises) write a `pipelineRuns.status = "failed"` row with the failed agent ID and error message; Andrew can view in Convex
- [ ] **OPS-02**: A `/run/{runId}/status` endpoint returns the current pipeline state for monitoring
- [x] **OPS-03**: Per-run cost summary is visible in Sanity Studio on the `weeklyIssue` draft (read-only field rendered from Convex `pipelineRuns.cost`)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **V2-01**: Suno API integration (auto-generate jingle audio from `sunoPrompt` instead of Andrew pasting `sunoAudioUrl`)
- **V2-02**: NotebookLM API integration (auto-generate podcast audio from `deliberationTranscript`)
- **V2-03**: Automatic weekly cron trigger for `/run/weekly` (v1 is manually triggered)

### Editorial Tooling

- **V2-04**: A backup human reviewer flow when Andrew is unavailable (Andrew is the single gate in v1)
- **V2-05**: A "regenerate single section" button in Sanity Studio that re-invokes one agent without rerunning the whole pipeline
- **V2-06**: Voice-drift dashboard for Andrew (track Jesse-voice rubric scores across issues over time)

### Reader Engagement

- **V2-07**: Per-issue OG image rendered from theme + charity name (v1 may use a static template)
- **V2-08**: Source citations from Scout's research surfaced in deliberation events (links readers can follow)
- **V2-09**: Charity-page issue history (which issues featured this charity)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-product catalog or Shopify integration | Brief locks: one product (lip balm), custom Stripe only. Adding catalog dilutes "magazine that happens to sell one product." |
| User accounts / login on the marketing site | Readers don't need accounts to read or buy. Adds auth attack surface for no value. |
| Newsletter / email subscriptions | Brief: "the site is a destination, not a newsletter." Email is anti-thesis of brand. |
| AI-positioned marketing or "powered by AI" badges | Brief: "the brand does not pivot to AI — Jesse was born AI." |
| Automatic publishing without Andrew | Brief: only Andrew can flip status to published. The human gate is intentional. |
| Suno API integration in v1 | API integration not decided; manual paste workflow is sufficient for v1. |
| NotebookLM podcast generation in v1 | Same as Suno — keeps weekly cadence achievable without external API risk. |
| Popups, urgency mechanics, countdown timers, modal upsells on /shop | Brief explicitly forbids these. The shop is one page, one button. |
| Stack substitutions (Astro, Strapi, Inngest, Vercel AI SDK, Shopify) | Brief: "do not substitute." |
| User comments on issues | Adds moderation surface area + spam risk. Brand voice depends on editorial control. |
| Real-time chat / community features | Out of brand. The site is a magazine, not a community. |
| Mobile native app | Web-first; mobile-responsive is sufficient. |

## Traceability

Finalized during roadmap creation (2026-05-09). Research's 10-phase suggestion merged to 9 phases: Deliberation Layer (DEL) and Podcast Section (POD) combined into Phase 9 — both are issue-page UI completion with no ordering dependency between them.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1: Sanity Foundation | Complete |
| FND-02 | Phase 1: Sanity Foundation | Complete |
| FND-03 | Phase 1: Sanity Foundation | Complete |
| FND-04 | Phase 1: Sanity Foundation | Complete |
| WEB-01 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-02 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-03 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-04 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-05 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-06 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-07 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-08 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-09 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-10 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-11 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-12 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-13 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-14 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-15 | Phase 2: Web Shell + Theme Engine | Complete |
| WEB-16 | Phase 2: Web Shell + Theme Engine | Complete |
| CVX-01 | Phase 3: Convex Deployment | Complete |
| CVX-02 | Phase 3: Convex Deployment | Complete |
| CVX-03 | Phase 3: Convex Deployment | Complete |
| CVX-04 | Phase 3: Convex Deployment | Complete |
| CVX-05 | Phase 3: Convex Deployment | Complete |
| PIP-01 | Phase 4: Pipeline Skeleton | Complete |
| PIP-02 | Phase 4: Pipeline Skeleton | Pending |
| PIP-03 | Phase 4: Pipeline Skeleton | Pending |
| PIP-04 | Phase 4: Pipeline Skeleton | Pending |
| PIP-05 | Phase 4: Pipeline Skeleton | Complete |
| PIP-06 | Phase 4: Pipeline Skeleton | Pending |
| PIP-07 | Phase 4: Pipeline Skeleton | Complete |
| PIP-08 | Phase 4: Pipeline Skeleton | Pending |
| PIP-09 | Phase 4: Pipeline Skeleton | Pending |
| PIP-10 | Phase 4: Pipeline Skeleton | Pending |
| PIP-11 | Phase 4: Pipeline Skeleton | Complete |
| PIP-12 | Phase 4: Pipeline Skeleton | Complete |
| OPS-01 | Phase 4: Pipeline Skeleton | Pending |
| OPS-02 | Phase 4: Pipeline Skeleton | Pending |
| OPS-03 | Phase 4: Pipeline Skeleton | Complete |
| AGT-01 | Phase 5: Agent Quality | Pending |
| AGT-02 | Phase 5: Agent Quality | Pending |
| AGT-03 | Phase 5: Agent Quality | Pending |
| AGT-04 | Phase 5: Agent Quality | Pending |
| AGT-05 | Phase 5: Agent Quality | Pending |
| AGT-06 | Phase 5: Agent Quality | Pending |
| AGT-07 | Phase 5: Agent Quality | Pending |
| AGT-08 | Phase 5: Agent Quality | Pending |
| AGT-09 | Phase 5: Agent Quality | Pending |
| AGT-10 | Phase 5: Agent Quality | Pending |
| AGT-11 | Phase 5: Agent Quality | Pending |
| AGT-12 | Phase 5: Agent Quality | Pending |
| AGT-13 | Phase 5: Agent Quality | Pending |
| AGT-14 | Phase 5: Agent Quality | Pending |
| AGT-15 | Phase 5: Agent Quality | Pending |
| AGT-16 | Phase 5: Agent Quality | Pending |
| AGT-17 | Phase 5: Agent Quality | Pending |
| AGT-18 | Phase 5: Agent Quality | Pending |
| PDF-01 | Phase 6: PDF + Webhook Chain | Pending |
| PDF-02 | Phase 6: PDF + Webhook Chain | Pending |
| PDF-03 | Phase 6: PDF + Webhook Chain | Pending |
| PDF-04 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-01 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-02 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-03 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-04 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-05 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-06 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-07 | Phase 6: PDF + Webhook Chain | Pending |
| WHK-08 | Phase 6: PDF + Webhook Chain | Pending |
| GAM-01 | Phase 7: Game Rendering | Pending |
| GAM-02 | Phase 7: Game Rendering | Pending |
| GAM-03 | Phase 7: Game Rendering | Pending |
| GAM-04 | Phase 7: Game Rendering | Pending |
| GAM-05 | Phase 7: Game Rendering | Pending |
| GAM-06 | Phase 7: Game Rendering | Pending |
| CMR-01 | Phase 8: Stripe / Commerce | Pending |
| CMR-02 | Phase 8: Stripe / Commerce | Pending |
| CMR-03 | Phase 8: Stripe / Commerce | Pending |
| CMR-04 | Phase 8: Stripe / Commerce | Pending |
| CMR-05 | Phase 8: Stripe / Commerce | Pending |
| CMR-06 | Phase 8: Stripe / Commerce | Pending |
| CMR-07 | Phase 8: Stripe / Commerce | Pending |
| CMR-08 | Phase 8: Stripe / Commerce | Pending |
| CMR-09 | Phase 8: Stripe / Commerce | Pending |
| CMR-10 | Phase 8: Stripe / Commerce | Pending |
| DEL-01 | Phase 9: Issue Page Completion | Pending |
| DEL-02 | Phase 9: Issue Page Completion | Pending |
| DEL-03 | Phase 9: Issue Page Completion | Pending |
| DEL-04 | Phase 9: Issue Page Completion | Pending |
| DEL-05 | Phase 9: Issue Page Completion | Pending |
| DEL-06 | Phase 9: Issue Page Completion | Pending |
| POD-01 | Phase 9: Issue Page Completion | Pending |
| POD-02 | Phase 9: Issue Page Completion | Pending |
| POD-03 | Phase 9: Issue Page Completion | Pending |

**Coverage:**
- v1 requirements: 80 total
- Mapped to phases: 80
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 — traceability finalized after roadmap creation (9-phase structure)*
