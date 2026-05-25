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
- [x] **PIP-02**: FastAPI exposes `POST /run/weekly` that triggers a new pipeline run and returns `{runId}`
- [x] **PIP-03**: LangGraph graph wires all agents in the brief's exact sequence: Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → fan-out{OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design} → QA → Editor[final] → Publisher
- [x] **PIP-04**: Each agent's stub returns a structurally valid LangGraph state matching the contract in `docs/API_CONTRACTS.md §7`
- [x] **PIP-05**: `runId` is generated exactly once at pipeline start and threaded into every Convex write and the `weeklyIssue.pipelineMetadata.runId` field on Sanity
- [x] **PIP-06**: An integration test asserts that after a stub run, `weeklyIssue.pipelineMetadata.runId` on Sanity equals the `runId` on every Convex row for that run
- [x] **PIP-07**: Pipeline writes a complete `weeklyIssue` draft to Sanity at end of run (status=`draft`), creating or upserting referenced `charity` documents idempotently via deterministic `_id`
- [x] **PIP-08**: Pipeline writes `pipelineRuns` (run start), `deliberationEvents` (per agent event), `agentVotes` (Advocate scores), `qaCorrections` (QA findings), and `pitchLog` (Scout candidates) to Convex during the run
- [x] **PIP-09**: LangGraph state is checkpointed to Supabase Postgres via `AsyncPostgresSaver`; `checkpointer.setup()` runs once at deploy time, not on every startup
- [x] **PIP-10**: Editor gate 1 calls `interrupt()` when no winner can be selected; LangGraph pauses, surfaces a pause state to Convex (`pipelineRuns.status = "awaiting-review"`), and resumes via a `POST /run/{runId}/resume` endpoint that re-injects the checkpoint
- [x] **PIP-11**: Per-run cost is logged (token count + USD per agent + total) to Convex `pipelineRuns.cost`
- [x] **PIP-12**: Pipeline duration (start to draft-written) is tracked on `pipelineRuns.durationMs`

### Agent Quality (voice-critical + factual safety)

- [x] **AGT-01**: Calibrator returns a `styleBrief` with `voice` constants imported from a hardcoded module (NOT regenerated per call); selects `bonusType` (bigBudget | jingle | specAd) that does NOT match the previous issue's `bonusType`
- [x] **AGT-02**: Calibrator output is stored on `weeklyIssue.calibratorBrief` for Andrew's review
- [x] **AGT-03**: Scout uses Tavily web search and returns 3-5 candidates (`{name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked}`); writes each to Convex `pitchLog` as it finds them; respects an iteration limit (max N tool calls) to contain cost
- [x] **AGT-04**: Scout candidates exclude charities already featured (cross-checked against Sanity `charity` documents)
- [x] **AGT-05**: Advocate produces an argument and 1-10 score for every Scout candidate; writes each to Convex `deliberationEvents` as `advocate-argument`
- [x] **AGT-06**: Editor (gate 1) selects exactly one winner with `editorDecision`, `runnerUpNotes`, and a structured `deliberationTranscript`; writes `editor-decision` event to Convex
- [x] **AGT-07**: Researcher returns a structured research object including `founderName` AND a `founderNameSourceUrl` field that points to the charity's own website confirming the name; if no source URL is found, `founderNameVerified=false` and downstream FounderBioWriter falls back to anonymous framing
- [x] **AGT-08**: A post-Researcher verification step fetches the charity's website (`httpx`) and string-searches for `founderName`; if not found, sets `founderNameVerified=false`
- [x] **AGT-09**: CaseStudyWriter requires `subjectNameVerified=true` (same source-confirmation pattern); falls back to anonymous framing if not verified
- [x] **AGT-10**: OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter each receive a structurally isolated `voiceConstraints` block (not concatenated with prior agent state); output passes a Jesse-voice rubric in QA
- [x] **AGT-11**: BonusWriter branches on `bonusType` and emits the corresponding shape: bigBudget→`{headline, body, storyboards[]}`, jingle→`{headline, body, lyrics, sunoPrompt}` (sunoAudioUrl empty), specAd→`{headline, body}`
- [x] **AGT-12**: GameWriter emits `{headline, description, embedCode}` where `embedCode` is self-contained HTML/JS with no external CDN URLs and no `<script src=...>` references
- [x] **AGT-13**: DesignAgent emits `{primaryColor, accentColor, backgroundColor, textColor}` as 6-digit hex strings; values are validated before being written to Sanity
- [x] **AGT-14**: DesignAgent emits `{fontDisplay, fontBody}` from a curated whitelist of approved Google Fonts (web + WeasyPrint compatible); whitelist is enforced at write time
- [x] **AGT-15**: QA agent reviews all section content against a Jesse-voice rubric and factual accuracy; writes corrections to Convex `qaCorrections` with severity (info | warning | error) and acceptance status
- [x] **AGT-16**: Editor Final reviews QA output, makes final sequencing decisions, writes any connective copy needed, and emits `editor-final` event to Convex
- [x] **AGT-17**: Voice-critical agents (Calibrator, Editor, Editor Final, QA) use pinned OpenRouter model versions (model+revision string)
- [x] **AGT-18**: An iteration limit is enforced on every agent that uses tool-calling (Scout, Researcher); exceeding it raises a controlled error written to `deliberationEvents` rather than silent loop

### PDF Generation + Publisher

- [x] **PDF-01**: Publisher renders Problem Statement to PDF via WeasyPrint using `weeklyIssue.problemStatement.pdfContent` and the issue's theme colors/fonts
- [x] **PDF-02**: PDF templates use base64-inlined `@font-face` declarations (NOT HTTP-loaded Google Fonts); fonts come from the Phase 5 whitelist
- [x] **PDF-03**: Generated PDF uploads to Sanity as an asset and is set on `weeklyIssue.problemPdf`
- [x] **PDF-04**: PDF download button on `/issue/[slug]` links to `weeklyIssue.problemPdf.asset->url`

### Webhook Chain (Sanity → Publisher → Vercel)

- [x] **WHK-01**: Sanity webhook fires on `_type == "weeklyIssue" && status == "published"` to a Publisher endpoint on Railway
- [x] **WHK-02**: Publisher endpoint verifies the webhook HMAC signature against `SANITY_WEBHOOK_SECRET` using the raw request body (`request.body()`)
- [x] **WHK-03**: Publisher rejects webhooks where `sanity-transaction-time` is older than 5 minutes
- [x] **WHK-04**: Publisher deduplicates webhooks via the `idempotency-key` header and a Supabase `webhook_idempotency` table with a unique constraint
- [x] **WHK-05**: Publisher waits 30 seconds before triggering the Vercel deploy hook (Sanity CDN propagation)
- [x] **WHK-06**: Publisher uses `useCdn: false` on the Sanity client when fetching content for PDF generation (build-time correctness)
- [x] **WHK-07**: Publisher updates `pipelineRuns.status` to `complete` and writes a `publisher-deploy` event to Convex
- [x] **WHK-08**: A manual `POST /run/{runId}/publish` endpoint exists as a fallback re-trigger when the Sanity webhook fails to deliver

### Game Rendering (sandbox-safe iframe)

- [x] **GAM-01**: Issue page renders the game inside `<iframe srcdoc={embedCode} sandbox="allow-scripts">` (NEVER with `allow-same-origin`)
- [x] **GAM-02**: An automated validator runs on every GameWriter `embedCode` output and rejects any of: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>` tags, external `<link href=...>` tags
- [x] **GAM-03**: An ESLint or codebase-level rule prevents the iframe `sandbox` attribute from including `allow-same-origin`
- [x] **GAM-04**: A CSP `<meta>` tag is injected into the srcdoc HTML restricting external resources
- [x] **GAM-05**: If validation fails, the issue page renders a fallback "Game unavailable" placeholder; Andrew is notified via Convex `qaCorrections`
- [x] **GAM-06**: Game iframe is responsive and renders correctly on mobile (≥360px wide)

### Stripe / Commerce

- [ ] **CMR-01**: Reader can view the lip balm product at `/shop` with current charity callout (server-rendered, no client flicker)
- [x] **CMR-02**: Reader can complete a checkout via Stripe Checkout (custom integration via `checkout.sessions.create()`)
- [ ] **CMR-03**: Reader lands on `/shop/thank-you` after successful checkout (static, no DB query)
- [x] **CMR-04**: Stripe webhook handler verifies signature using raw body (`request.text()`) and the Stripe webhook secret
- [ ] **CMR-05**: Stripe webhook signature verification has NO development-mode bypass; signature is always required
- [x] **CMR-06**: Stripe webhook handler is idempotent on `event.id` (deduplicates retries)
- [ ] **CMR-07**: A privacy policy page exists at `/legal/privacy` (Stripe TOS + GDPR/CCPA compliance)
- [ ] **CMR-08**: A terms-of-service page exists at `/legal/terms`
- [ ] **CMR-09**: A persistent shop callout appears at the bottom of every issue page (one sentence + button — NO banner, NO modal, NO popup, NO countdown)
- [x] **CMR-10**: Stripe shipping rates are configured in the Stripe dashboard and applied at checkout

### Deliberation Layer (live Convex UI)

- [x] **DEL-01**: Issue page subscribes via `useQuery` to all five Convex tables filtered by the issue's `runId`
- [x] **DEL-02**: Deliberation UI renders advocate score bars, QA severity colors, agent identity cards (using `agentProfile` from Sanity), and a pitch log timeline
- [x] **DEL-03**: Deliberation UI is collapsed by default; reader can expand to see the deliberation
- [x] **DEL-04**: Deliberation UI does NOT expose underlying model names (no "written by Claude" or similar)
- [x] **DEL-05**: Deliberation UI shows graceful empty states for issues that predate Convex writes
- [x] **DEL-06**: Each agent event in the deliberation links back to the agent's `agentProfile` page

### Podcast Section

- [x] **POD-01**: Issue page renders an HTML5 `<audio>` player when `podcast.audioFile` is populated
- [x] **POD-02**: Issue page renders a collapsible transcript when `podcast.deliberationTranscript` is populated
- [x] **POD-03**: Issue page shows an "Audio coming soon" empty state when `podcast.audioFile` is empty (typical between draft and Andrew uploading the NotebookLM output)

### Operations / Observability

- [x] **OPS-01**: Pipeline failures (any agent raises) write a `pipelineRuns.status = "failed"` row with the failed agent ID and error message; Andrew can view in Convex
- [x] **OPS-02**: A `/run/{runId}/status` endpoint returns the current pipeline state for monitoring
- [x] **OPS-03**: Per-run cost summary is visible in Sanity Studio on the `weeklyIssue` draft (read-only field rendered from Convex `pipelineRuns.cost`)

### Editorial Design Pass (Issue Page)

- [x] **DES-01**: Issue page uses paired Google Fonts via Next.js `next/font/google` — a serif display face for the charity name + section headers (e.g. Playfair Display, Libre Caslon, Cormorant Garamond, or similar editorial serif) and a serif body face for paragraphs (e.g. Lora, Source Serif 4, EB Garamond, or similar). No client-side font flash (FOUT); fonts are subsetted and self-hosted via the framework.
- [x] **DES-02**: The lead paragraph of the first prose section of an issue (typically Origin Story) renders with a drop cap — initial letter scaled ~3x the body size, baseline-aligned with the second line, hanging into the left margin if achievable. Subsequent paragraphs do not get drop caps. Drop cap renders correctly on mobile (≥320px) without breaking layout.
- [x] **DES-03**: The body prose column is constrained to a comfortable reading measure (60–68ch) on screens ≥768px; on mobile it uses full width with proper horizontal padding (e.g. 20–24px). Line-height is ≥1.55 for body prose. Paragraph spacing is consistent (either indent or blank-line separation throughout).
- [x] **DES-04**: Section transitions use an ornament or rule divider (not the browser default `<hr>`) — e.g. a centered small motif, an asterism (* * *), a Unicode ornament (❦, ❧), or a precise rule with consistent vertical rhythm. Section headers use a consistent visual treatment (e.g. small-caps eyebrow label + serif title).
- [x] **DES-05**: The case study's structured metadata (founded/AUM/focus/etc.) renders in a footnote-style or sidebar treatment visually distinct from running prose (e.g. smaller type, monospace numerals, italics, or a delineated metadata block).
- [x] **DES-06**: Phase 2's per-issue theme injection still works after the redesign — the charity's `theme.primaryColor`, `theme.accentColor`, `theme.backgroundColor`, and `theme.textColor` from Sanity still drive page colors via CSS variables. Switching from one issue to another with different theme values visibly changes accent colors (links, dividers, section eyebrows) without breaking the typographic hierarchy or the layout.

### Archive CardSwap + Motion Polish (Phase 11)

- [x] **ARC-01**: The `/archive` page renders a CSS-3D "CardSwap" component that cycles through real past published issues fetched from Sanity (existing archive GROQ query) — stacked 3D cards auto-advancing on a timer (~6s), pause-on-hover, click-to-open the issue, optional indicator dots, and a "N issues" badge. Each card shows the real issue number, charity name (per-issue accent), one-line mission, date, and read time. No GSAP, no CDN `<script>`, no new npm dependency — CSS perspective/transforms + minimal JS only. Under `prefers-reduced-motion` the auto-cycle is disabled and cards render as a static, keyboard-accessible list.
- [x] **MOT-01**: The issue hero charity name reveals line-by-line via a clip-path animation on load; under `prefers-reduced-motion` it renders instantly with no animation.
- [x] **MOT-02**: Section-navigator cards show a gold magnetic cursor-follow glow + hover translate; under `prefers-reduced-motion` no JS cursor tracking runs and interactive targets remain ≥44px.
- [x] **MOT-03**: The deliberation confidence meter animates 0→its real value on scroll-into-view (final value shown instantly under `prefers-reduced-motion`), and pitch cards use a scroll-snap carousel — without exposing model names (DEL-04) or breaking the live Convex subscriptions.

### Machine Editorial Design Adoption (Phase 12)
- [x] **MED-01**: The live site renders in a single fixed "Machine Editorial" dark aesthetic — the web app no longer applies per-issue DesignAgent `theme` overrides (colors/fonts); the fixed house dark palette (`#0C0B0A` / `#F0EAD9` / `#CDA434` / `#C2502A`) wins on every issue. The `theme.ts` FONT_WHITELIST + hex/`setProperty`/WCAG security contracts are unchanged. (Intentionally supersedes the DES-06 per-issue color behavior while the DesignAgent is suppressed.)
- [x] **MED-02**: A reversible config flag suppresses the DesignAgent — it skips the `design` node in the LangGraph build (packages/pipeline) and makes apps/web ignore per-issue `theme`. Flipping the flag back restores prior per-issue theming with no code change.
- [x] **MED-03**: The DesignAgent system prompt encodes the Machine Editorial design language (palette intent + aesthetic constraints) so output stays within the aesthetic when re-enabled; the existing 6-field ThemeOutput, hex/font/WCAG validation, regenerate-once, and SAFE_THEME fallback are unchanged.
- [x] **MED-04**: `SectionNavigator` is rebuilt to the chosen superdesign board variant (timeline | masonry | isometric) at high fidelity, using only FONT_WHITELIST fonts (Cormorant Garamond / Lora / Inter; the board's IBM Plex Mono machine-readout labels approximated via Inter + wide uppercase letter-spacing); reduced-motion-safe, ≥44px targets, single `<main>`, WCAG AA.
- [x] **MED-05**: `DeliberationSlot` is rebuilt to the chosen board variant (carousel | orbital | brutalist) at high fidelity with the confidence meter + candidate pitch log; DEL-04 (no model names) and the 5 live Convex subscriptions remain intact; reduced-motion-safe.

### Light Theme Adoption (Phase 14)
- [ ] **LIGHT-01**: All `--color-*` tokens in `apps/web/app/globals.css :root` emit the locked warm-paper LIGHT palette per 14-UI-SPEC.md (`--color-bg #FAFAF8`, `--color-text #1A1A1A`, surfaces/text-dim/text-mute/scout/advocate re-toned), plus the two NEW AA-safe text tokens `--color-primary-text #7A5C0E` and `--color-accent-text #9B3015`. No dark base/ink literals remain. Reverses Phase 12 MED-01 dark lock; single-fixed-palette architecture unchanged (DesignAgent suppressed, per-issue theming off, theme.ts logic + FONT_WHITELIST untouched).
- [ ] **LIGHT-02**: `color-mix()` derived tokens are re-expressed for the light base — `--color-primary-bright` mixes toward black (not white), `--color-primary-glow` reduced to 12%, atmosphere `.aurora` radial glows halved to 5/3/2% — so hairlines, glows, and shadows read correctly on paper. (Manual visual verification per 14-VALIDATION.md.)
- [ ] **LIGHT-03**: `apps/web/__tests__/theme-aa-tones.test.ts` asserts light-base WCAG AA ratios (`DARK_BG`→`LIGHT_BG #FAFAF8`): every text/UI token passes AA on the light base; raw gold `#CDA434` is asserted BELOW AA (decorative-only); the two new -text tokens pass AA; the old dark mute `#938A77` is documented as failing on light.
- [ ] **LIGHT-04**: Accent-as-text AA-safe variants are used where raw gold/rust render as small text: `DeliberationSlot.tsx` editor agent chip + speaker label + editor flow-label use `--color-primary-text`; QA Warning pill uses `--color-primary-text`; QA Error pill uses `--color-accent-text`. Scout/Advocate chips, 5 Convex subscriptions, DEL-04, and the count-up are preserved.
- [ ] **LIGHT-05**: `globals.css` small-text gold classes (`.snw-section-num`, `.snw-module-label`, `.snw-read-value`, `.snw-title-accent`, `.sc-num`, `.sc-arrow`) reference `--color-primary-text`; the `.section-card:hover` shadow uses the warm paper shadow `rgba(90,75,50,0.18)` — no `rgba(0,0,0,…)` remains in `.section-card`. (Source-scan tripwires in theme-aa-tones.test.ts.)
- [ ] **LIGHT-06**: The DesignAgent `agents/design/__init__.py` AESTHETIC ENVELOPE system-prompt block describes the warm-paper LIGHT aesthetic (canvas #FAFAF8, near-black ink #1A1A1A) so a re-enabled DesignAgent produces on-brand light themes. Prose-only — ThemeOutput shape, validation, FONT_WHITELIST, regenerate-once, and SAFE_THEME fallback unchanged. (Manual verification per 14-VALIDATION.md.)
- [ ] **LIGHT-07**: Regression — all prior tripwire tests stay green (re-tuned where they asserted dark tones: theme-aa-tones, deliberation-no-model-names, deliberation-subscriptions, deliberation-conversation, game-sandbox, podcast-slot) and `pnpm --filter web build` exits 0. Locked constraints preserved: WCAG AA on the new base, prefers-reduced-motion, single `<main>`, ≥44px, 5 Convex subscriptions, DEL-04, game-sandbox security; no new npm deps; no CDN.

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
| PIP-02 | Phase 4: Pipeline Skeleton | Complete |
| PIP-03 | Phase 4: Pipeline Skeleton | Complete |
| PIP-04 | Phase 4: Pipeline Skeleton | Complete |
| PIP-05 | Phase 4: Pipeline Skeleton | Complete |
| PIP-06 | Phase 4: Pipeline Skeleton | Complete |
| PIP-07 | Phase 4: Pipeline Skeleton | Complete |
| PIP-08 | Phase 4: Pipeline Skeleton | Complete |
| PIP-09 | Phase 4: Pipeline Skeleton | Complete |
| PIP-10 | Phase 4: Pipeline Skeleton | Complete |
| PIP-11 | Phase 4: Pipeline Skeleton | Complete |
| PIP-12 | Phase 4: Pipeline Skeleton | Complete |
| OPS-01 | Phase 4: Pipeline Skeleton | Complete |
| OPS-02 | Phase 4: Pipeline Skeleton | Complete |
| OPS-03 | Phase 4: Pipeline Skeleton | Complete |
| AGT-01 | Phase 5: Agent Quality | Complete |
| AGT-02 | Phase 5: Agent Quality | Complete |
| AGT-03 | Phase 5: Agent Quality | Complete |
| AGT-04 | Phase 5: Agent Quality | Complete |
| AGT-05 | Phase 5: Agent Quality | Complete |
| AGT-06 | Phase 5: Agent Quality | Complete |
| AGT-07 | Phase 5: Agent Quality | Complete |
| AGT-08 | Phase 5: Agent Quality | Complete |
| AGT-09 | Phase 5: Agent Quality | Complete |
| AGT-10 | Phase 5: Agent Quality | Complete |
| AGT-11 | Phase 5: Agent Quality | Complete |
| AGT-12 | Phase 5: Agent Quality | Complete |
| AGT-13 | Phase 5: Agent Quality | Complete |
| AGT-14 | Phase 5: Agent Quality | Complete |
| AGT-15 | Phase 5: Agent Quality | Complete |
| AGT-16 | Phase 5: Agent Quality | Complete |
| AGT-17 | Phase 5: Agent Quality | Complete |
| AGT-18 | Phase 5: Agent Quality | Complete |
| PDF-01 | Phase 6: PDF + Webhook Chain | Complete |
| PDF-02 | Phase 6: PDF + Webhook Chain | Complete |
| PDF-03 | Phase 6: PDF + Webhook Chain | Complete |
| PDF-04 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-01 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-02 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-03 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-04 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-05 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-06 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-07 | Phase 6: PDF + Webhook Chain | Complete |
| WHK-08 | Phase 6: PDF + Webhook Chain | Complete |
| GAM-01 | Phase 7: Game Rendering | Complete |
| GAM-02 | Phase 7: Game Rendering | Complete |
| GAM-03 | Phase 7: Game Rendering | Complete |
| GAM-04 | Phase 7: Game Rendering | Complete |
| GAM-05 | Phase 7: Game Rendering | Complete |
| GAM-06 | Phase 7: Game Rendering | Complete |
| CMR-01 | Phase 8: Stripe / Commerce | Pending |
| CMR-02 | Phase 8: Stripe / Commerce | Complete |
| CMR-03 | Phase 8: Stripe / Commerce | Pending |
| CMR-04 | Phase 8: Stripe / Commerce | Complete |
| CMR-05 | Phase 8: Stripe / Commerce | Pending |
| CMR-06 | Phase 8: Stripe / Commerce | Complete |
| CMR-07 | Phase 8: Stripe / Commerce | Pending |
| CMR-08 | Phase 8: Stripe / Commerce | Pending |
| CMR-09 | Phase 8: Stripe / Commerce | Pending |
| CMR-10 | Phase 8: Stripe / Commerce | Complete |
| DEL-01 | Phase 9: Issue Page Completion | Complete |
| DEL-02 | Phase 9: Issue Page Completion | Complete |
| DEL-03 | Phase 9: Issue Page Completion | Complete |
| DEL-04 | Phase 9: Issue Page Completion | Complete |
| DEL-05 | Phase 9: Issue Page Completion | Complete |
| DEL-06 | Phase 9: Issue Page Completion | Complete |
| POD-01 | Phase 9: Issue Page Completion | Complete |
| POD-02 | Phase 9: Issue Page Completion | Complete |
| POD-03 | Phase 9: Issue Page Completion | Complete |
| ARC-01 | Phase 11: Archive CardSwap + Motion Polish | Complete |
| MOT-01 | Phase 11: Archive CardSwap + Motion Polish | Complete |
| MOT-02 | Phase 11: Archive CardSwap + Motion Polish | Complete |
| MOT-03 | Phase 11: Archive CardSwap + Motion Polish | Complete |
| MED-01 | Phase 12: Machine Editorial Design Adoption | Not started |
| MED-02 | Phase 12: Machine Editorial Design Adoption | Not started |
| MED-03 | Phase 12: Machine Editorial Design Adoption | Not started |
| MED-04 | Phase 12: Machine Editorial Design Adoption | Not started |
| MED-05 | Phase 12: Machine Editorial Design Adoption | Not started |
| LIGHT-01 | Phase 14: Light Theme Adoption | Not started |
| LIGHT-02 | Phase 14: Light Theme Adoption | Not started |
| LIGHT-03 | Phase 14: Light Theme Adoption | Not started |
| LIGHT-04 | Phase 14: Light Theme Adoption | Not started |
| LIGHT-05 | Phase 14: Light Theme Adoption | Not started |
| LIGHT-06 | Phase 14: Light Theme Adoption | Not started |
| LIGHT-07 | Phase 14: Light Theme Adoption | Not started |

**Coverage:**
- v1 requirements: 84 total
- Mapped to phases: 84
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-05-09 — traceability finalized after roadmap creation (9-phase structure)*
