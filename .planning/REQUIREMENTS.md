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

- [x] **CMR-01**: Reader can view the lip balm product at `/shop` with current charity callout (server-rendered, no client flicker)
- [x] **CMR-02**: Reader can complete a checkout via Stripe Checkout (custom integration via `checkout.sessions.create()`)
- [x] **CMR-03**: Reader lands on `/shop/thank-you` after successful checkout (static, no DB query)
- [x] **CMR-04**: Stripe webhook handler verifies signature using raw body (`request.text()`) and the Stripe webhook secret
- [x] **CMR-05**: Stripe webhook signature verification has NO development-mode bypass; signature is always required
- [x] **CMR-06**: Stripe webhook handler is idempotent on `event.id` (deduplicates retries)
- [x] **CMR-07**: A privacy policy page exists at `/legal/privacy` (Stripe TOS + GDPR/CCPA compliance)
- [x] **CMR-08**: A terms-of-service page exists at `/legal/terms`
- [x] **CMR-09**: A persistent shop callout appears at the bottom of every issue page (one sentence + button — NO banner, NO modal, NO popup, NO countdown)
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
- [x] **LIGHT-01**: All `--color-*` tokens in `apps/web/app/globals.css :root` emit the locked warm-paper LIGHT palette per 14-UI-SPEC.md (`--color-bg #FAFAF8`, `--color-text #1A1A1A`, surfaces/text-dim/text-mute/scout/advocate re-toned), plus the two NEW AA-safe text tokens `--color-primary-text #7A5C0E` and `--color-accent-text #9B3015`. No dark base/ink literals remain. Reverses Phase 12 MED-01 dark lock; single-fixed-palette architecture unchanged (DesignAgent suppressed, per-issue theming off, theme.ts logic + FONT_WHITELIST untouched).
- [x] **LIGHT-02**: `color-mix()` derived tokens are re-expressed for the light base — `--color-primary-bright` mixes toward black (not white), `--color-primary-glow` reduced to 12%, atmosphere `.aurora` radial glows halved to 5/3/2% — so hairlines, glows, and shadows read correctly on paper. (Manual visual verification per 14-VALIDATION.md.)
- [x] **LIGHT-03**: `apps/web/__tests__/theme-aa-tones.test.ts` asserts light-base WCAG AA ratios (`DARK_BG`→`LIGHT_BG #FAFAF8`): every text/UI token passes AA on the light base; raw gold `#CDA434` is asserted BELOW AA (decorative-only); the two new -text tokens pass AA; the old dark mute `#938A77` is documented as failing on light.
- [x] **LIGHT-04**: Accent-as-text AA-safe variants are used where raw gold/rust render as small text: `DeliberationSlot.tsx` editor agent chip + speaker label + editor flow-label use `--color-primary-text`; QA Warning pill uses `--color-primary-text`; QA Error pill uses `--color-accent-text`. Scout/Advocate chips, 5 Convex subscriptions, DEL-04, and the count-up are preserved.
- [x] **LIGHT-05**: `globals.css` small-text gold classes (`.snw-section-num`, `.snw-module-label`, `.snw-read-value`, `.snw-title-accent`, `.sc-num`, `.sc-arrow`) reference `--color-primary-text`; the `.section-card:hover` shadow uses the warm paper shadow `rgba(90,75,50,0.18)` — no `rgba(0,0,0,…)` remains in `.section-card`. (Source-scan tripwires in theme-aa-tones.test.ts.)
- [x] **LIGHT-06**: The DesignAgent `agents/design/__init__.py` AESTHETIC ENVELOPE system-prompt block describes the warm-paper LIGHT aesthetic (canvas #FAFAF8, near-black ink #1A1A1A) so a re-enabled DesignAgent produces on-brand light themes. Prose-only — ThemeOutput shape, validation, FONT_WHITELIST, regenerate-once, and SAFE_THEME fallback unchanged. (Manual verification per 14-VALIDATION.md.)
- [x] **LIGHT-07**: Regression — all prior tripwire tests stay green (re-tuned where they asserted dark tones: theme-aa-tones, deliberation-no-model-names, deliberation-subscriptions, deliberation-conversation, game-sandbox, podcast-slot) and `pnpm --filter web build` exits 0. Locked constraints preserved: WCAG AA on the new base, prefers-reduced-motion, single `<main>`, ≥44px, 5 Convex subscriptions, DEL-04, game-sandbox security; no new npm deps; no CDN.

### Shop Storefront — Rich Product Page (Phase 15)

- [x] **SHOP-01**: `/shop` renders 8 long-scroll sections in order: `#shop-hero` → `#shop-positioning` → `#shop-features` → `#shop-ingredient-story` → `#shop-charity` → `#shop-buy` → `#shop-faq` → `#shop-footer-cta`, all within a single `<main>` (root-layout-owned), warm-paper light theme, mobile responsive
- [x] **SHOP-02**: Hero tagline `Stop. Breathe. Balm.` appears verbatim as the `<h1>` followed by `A human-only ritual for an AI-everywhere world.` as the italic sub-tagline — both rendered in Tier 4 display typography (`font-display clamp(28px,4vw,72px)`)
- [x] **SHOP-03**: Phase 8 `<BuyButton>` is reused byte-unchanged at ≥2 positions (UI-SPEC ships 3: `#shop-hero`, `#shop-buy`, `#shop-footer-cta`); spacing is via wrapper `<div className="mt-N"><BuyButton /></div>` only — NEVER props on `<BuyButton />`
- [x] **SHOP-04**: Charity callout is server-rendered from Sanity — `QUERY_LATEST_CHARITY_NAME` inline GROQ + `sanityClient.fetch` + try/catch preserved byte-unchanged from Phase 8; `charityName` interpolated into `#shop-charity`; locked fallback string `Proceeds go to our featured charity each week.` on Sanity outage; `export const revalidate = 60` ISR preserved
- [x] **SHOP-05**: 4-tier typography contract — exactly T1 (12px Inter, `.eyebrow`), T2 (16px Lora), T3 (18px Lora prose), T4 (`clamp(28px,4vw,72px)` Cormorant Garamond display) — no other sizes; `.drop-cap` on `#shop-positioning` only; `.prose-measure` on prose blocks; `.ornament-divider` between 5 section pairs; `.eyebrow` on every section label
- [x] **SHOP-06**: Copy on `/shop` is in the lip-balm sub-brand voice (`Stop. Breathe. Balm.` register — meditative, declarative) — NOT the Dispatch editorial voice; no exclamation marks, no superlatives, no AI mentions in body copy, no urgency vocabulary; "Release 001" is a brand fact (edition designation), NOT a scarcity claim; all draft copy from UI-SPEC §Copywriting Contract used verbatim
- [x] **SHOP-07**: Phase 8 Stripe machinery is byte-unchanged: `apps/web/components/marketing/BuyButton.tsx`, `apps/web/app/api/checkout/create-session/route.ts`, `apps/web/app/api/stripe/webhook/route.ts`, `apps/web/app/shop/thank-you/page.tsx`, `apps/web/app/legal/privacy/page.tsx`, `apps/web/app/legal/terms/page.tsx`, `apps/web/components/issue/ShopCallout.tsx`, `apps/web/lib/theme.ts` (FONT_WHITELIST), `apps/web/app/globals.css`, and the Convex schema all unchanged; the page remains a Server Component (no `'use client'`)
- [x] **SHOP-08**: No urgency vocabulary anywhere in the rebuilt page source (CMR-09 contract extension to `/shop`) — source-scan asserts no `limited`, no `only N left`, no `countdown`, no `hurry`, no `act now`
- [x] **SHOP-09**: No hardcoded hex values in `apps/web/app/shop/page.tsx` — all color references use the `--color-*` token system via the Tailwind arbitrary-value pattern `bg-[color:var(--color-*)]` / `text-[color:var(--color-*)]` / `border-[color:var(--color-*)]`; gold-as-text uses `--color-primary-text` (AA-safe) NEVER raw `--color-primary`
- [x] **SHOP-10**: `TODO(Andrew)` JSX-comment markers are present (greppable) on every item Andrew must finalize before launch: hero product photography, product still photography, final price, edition number / hand-numbering description, ingredient list verification, shipping rates/carrier/delivery window, contact email, footer-outro voice check
- [x] **SHOP-11**: Regression — `pnpm --filter web build` exits 0 and all prior tripwire tests stay green (Phase 7 game-sandbox, Phase 10 typography, Phase 12 navigator/deliberation, Phase 13 deliberation-conversation/no-model-names, Phase 14 theme-aa-tones LIGHT-03/05, Phase 11 archive/motion, Phase 8 CMR-* including CMR-01 and CMR-09); `apps/web/__tests__/shop-page.test.ts` runs the 6 preserved CMR-01 assertions + 10 new Phase 15 source-scan assertions all green

### Magazine Editorial Layout — Writer Structure (Phase 18)

- [x] **MEL-01**: Each of the 5 long-read sections (`originStory`, `problemStatement`, `founderBio`, `caseStudy`, `bonus` when `bonusType == "specAd"`) emits at minimum 2 Portable Text blocks with `style: "h2"` or `style: "h3"` in its Sanity body array; verified by GROQ post-condition `count(<section>.body[style in ["h2","h3"]]) >= 2` per section
- [x] **MEL-02**: Each of those 5 sections emits at minimum 1 Portable Text block with `style: "blockquote"`; verified by `count(<section>.body[style=="blockquote"]) >= 1` per section
- [x] **MEL-03**: Body prose voice is byte-equivalent: existing Phase 5 voice-isolation tripwires (no exclamation marks, no forbidden adjectives, no passive hedging, no AI self-reference) still pass on the assembled body text for every section; `packages/pipeline/tests/test_section_writer_voice_propagation.py` stays green; `packages/pipeline/tests/test_voice.py` stays green (Phase 16 NRR-10 byte-equivalence)
- [x] **MEL-04**: QA judge rubric (`packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`) gains a `structural-variety` axis; `JudgeFinding.axis` `Literal` in `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` includes `"structural-variety"`; findings from a flat-paragraph-wall section produce at least one `structural-variety` entry in `qaCorrections` with `severity: "warning"` (not `error` — per CONTEXT D-05; Phase 5 D-02 keeps QA annotation-only)
- [x] **MEL-05**: Zero-regression matrix: `cd packages/pipeline && uv run pytest -x -q` reports >= 200 passing (>= 190 Phase 16 baseline + 4 new Phase 18 test files); `pnpm --filter web test:unit` reports >= 234 passing (Phase 16 baseline preserved); all listed Phase 18 tripwire tests (see 18-CONTEXT.md canonical_refs > Tripwires) stay green
- [x] **MEL-06**: Live frontend at `https://eisenbalm-web.vercel.app/issue/<next-issue-slug>` for a freshly-generated issue contains at least 2 `<h2>` elements AND at least 1 `<blockquote>` element within each of the 5 long-read section containers; verified by HTML scan documented in `18-VERIFICATION.md` (no 7-10 consecutive `<p>` blocks per section)
- [x] **MEL-07**: Cost per writer call rises at most 15% vs. Phase 16 baseline; the STRUCTURE_CONTRACT (CONTEXT D-01) is a <=120-word system-prompt addition; the structural-validator retry (CONTEXT D-02) adds at most one extra `acomplete` call per writer per run; verified by controlled real-mode run documented in `18-VERIFICATION.md`
- [x] **MEL-08**: `BigBudgetBonus.body` and `JingleBonus.body` Pydantic fields remain typed `str` (no structural floor — per CONTEXT D-04); only `SpecAdBonus.body` is typed `list[BodyBlock]`; a negative pytest case asserts `BigBudgetBonus` and `JingleBonus` Pydantic models do NOT carry the `_enforce_structural_floor` validator


### Issue Page Redesign — Dispatch Magazine Layout (Phase 19)

- [x] **P19-01**: `/issue/[slug]` renders all 10 sections in the locked order — compact masthead → 3-col briefing (why / animated count-up stats / what's-inside TOC) → dark mission band → sticky left scroll-spy rail → drop-capped article sections with pull-quotes (origin/problem/founder/case) → full-width game → spec-ad bonus → deliberation dark-band centerpiece (scoreboard + chat + confidence) → podcast player → shop band — visually matching `19-PROTOTYPE.html`; the Atmosphere aurora + vertical-timeline `SectionNavigator` no longer appear (deleted).
- [x] **P19-02**: Fraunces / Newsreader / IBM Plex Mono load via `next/font/google` (no runtime HTTP font fetch) wired as `--font-display` / `--font-body` / `--font-ui`; all three are appended to `FONT_WHITELIST` (now 9 entries) and `BRAND_DEFAULTS` fonts reference them.
- [x] **P19-03**: oxblood `#9A3324` / cream `#FBFAF6` is the resolved palette when an issue supplies no theme (new `BRAND_DEFAULTS` + `globals.css :root`); per-issue Sanity `theme` overrides accent + type tokens (theming RE-ENABLED, reversing Phase 14 / Phase 12 MED-01) while structure/motion stay constant; `serializeThemeCss` + `applyTheme` emit `--color-bg` + `--color-text`; `lib/theme.ts` security invariants (hex regex, FONT_WHITELIST membership, WCAG AA gate, setProperty-only) unchanged and green.
- [x] **P19-04**: `framer-motion` (new dependency) drives scroll reveals, stat count-ups, scroll-progress bar, scroll-spy rail, and the deliberation message stagger; under `prefers-reduced-motion: reduce` ALL motion is disabled and 100% of content is immediately visible (no opacity-0 / hidden / empty states).
- [x] **P19-05**: Delivery is two-staged — Stage A (static shell with MOCK data) is reviewable and USER-APPROVED before any live data wiring; Stage B wires live Sanity GROQ + Convex deliberation subscriptions per `docs/API_CONTRACTS.md` WITHOUT changing the approved structure/motion.
- [x] **P19-06**: Zero-regression — `pnpm --filter web test:unit` >= prior baseline passing; `pnpm --filter web typecheck` + `build` clean; `theme-aa-tones.test.ts` UPDATED to the new palette; theme/security tests otherwise unmodified and green.
- [x] **P19-07**: Accessibility preserved — single `<main>` landmark, skip-link intact, scroll-spy rail keyboard-navigable (`role="navigation"` + `aria-label="Article sections"`, hidden < 980px), focus-visible ring honored, game play button + podcast play/pause have aria-labels, deliberation chat has `role="log"` + `aria-live="polite"`, game `sandbox="allow-scripts"` + DEL-04 no-model-names preserved.

## Milestone v2.0 Requirements — Mission Control Dashboard

**Scope:** Phases 21–27 (productization-prep deferred). A single-tenant, review-gated no-code control plane for the agent pipeline, built with multi-tenant bones. Grounded in `docs/MISSION_CONTROL_BRIEF.md`, `docs/CURRENT_STATE.md`, and `.planning/research/SUMMARY.md`. Locked decisions: separate `dispatch-control` app · single-tenant + `workspace_id` threaded · `require_review` default-on · Railway-cron scheduler.

### Auth & App Shell (AUTH)
- [x] **AUTH-01**: Operator can sign in to the `dispatch-control` app via Clerk; every dashboard route is protected while the public `apps/web` site stays unauthenticated.
- [x] **AUTH-02**: Any unauthenticated request to a dashboard route or dashboard API is rejected (redirect to sign-in / 401).
- [x] **AUTH-03**: FastAPI dashboard-control endpoints verify a Clerk-issued token before mutating pipeline state; the Railway cron path keeps its existing `X-Pipeline-Trigger-Secret`.
- [x] **AUTH-04**: Actions are attributed to the signed-in operator (consumed by the audit log and run-trigger attribution).

### Config Externalization & Reproducibility (CFG) — the §2 keystone
- [x] **CFG-01**: Active agent config (system prompt, user template, model, temperature, max tokens, enabled flag) lives in Convex and is the source the pipeline reads at run start.
- [x] **CFG-02**: The 12 existing prompt `.md` files are migrated into the config store as version-1 active rows, byte-verified against the files.
- [x] **CFG-03**: The pipeline loads the full run config once at run start; if the config store is unavailable it falls back to the on-disk `.md` files rather than crashing or silently ignoring edits.
- [x] **CFG-04**: Every run records an immutable snapshot of the exact config it used, written BEFORE the graph is invoked, so a mid-run edit cannot alter an in-flight run.
- [x] **CFG-05**: Every new dashboard/config table carries a `workspace_id` (seeded to one "eisenbalm" workspace); no charity- or Eisenbalm-specific logic is hardcoded in the control plane.

### Dashboard & Live Observability (OBS)
- [x] **OBS-01**: Operator can view the pipeline as the real agent graph — each agent a node showing its current config (model, enabled, description).
- [x] **OBS-02**: Operator can view full run history (status, trigger source, who triggered, duration, cost) and open any run.
- [x] **OBS-03**: Operator can watch a run live — each agent transitions queued→running→done/failed with live token/cost accrual + latency — via Convex subscriptions.
- [x] **OBS-04**: Operator can see cost rolled up per agent → per run → per issue → per week/month, reading the already-captured per-call cost (no second cost recorder is added).
- [x] **OBS-05**: Operator can inspect per-agent input/output and any error/retry for a run.

### Prompt Editing & Versioning (PRM)
- [x] **PRM-01**: Operator can edit an agent's system prompt and user-prompt template in a UI editor.
- [x] **PRM-02**: The editor highlights the template variables available to that agent and warns on unknown/mangled variables before save.
- [x] **PRM-03**: Saving a prompt creates a new version (author + timestamp + optional note) and never overwrites a prior version.
- [x] **PRM-04**: Operator can diff any two versions and activate/rollback to a chosen version in one click; activation is blocked or safely queued while a run is in progress.
- [x] **PRM-05**: Operator can test-run a single agent against sample or prior-real input and see its output + cost, without running the whole pipeline.
- [x] **PRM-06**: The voice/persona text (`VOICE_CONSTRAINTS`) is editable and versioned as a first-class config entry alongside agent prompts.

### Run Control (RUN)
- [x] **RUN-01**: Operator can trigger a new issue run on demand from the dashboard.
- [x] **RUN-02**: A master `schedule_enabled` kill switch exists; the scheduler tick checks it FIRST and no-ops when off (automation controlled by data, not by enabling/disabling the cron).
- [x] **RUN-03**: A Railway cron calls the tick endpoint on the configured cadence; operator can edit cadence / pause / resume and see the next scheduled run with timezone shown explicitly.
- [x] **RUN-04**: Operator can cancel an in-flight run; the pipeline stops cooperatively and the run ends in a consistent `cancelled` state.
- [x] **RUN-05**: Operator can re-roll a single agent/section within an existing issue without rerunning the whole pipeline. *(absorbs former V2-05)*
- [x] **RUN-06**: Operator can set per-run and monthly budget caps with alert thresholds; the system warns at threshold and can refuse to start a run that would exceed the cap.

### Review & Publish Gate (RVW)
- [x] **RVW-01**: `require_review` is on by default; a finished run lands in `awaiting_review` rather than auto-publishing.
- [x] **RVW-02**: Operator sees a full rendered preview of the issue + deliberation + cost before deciding.
- [x] **RVW-03**: Operator can approve-and-publish, approve-and-schedule, re-roll sections, or reject a run from the review screen.
- [x] **RVW-04**: Enabling `auto_publish` requires explicit friction — it is off by default, takes a confirmation step, and is alerted + audit-logged.
- [x] **RVW-05**: Every factual claim (number / name / date) in a finished issue is surfaced as a checklist for human sign-off before publish.

### Charity Registry (REG)
- [x] **REG-01**: Operator can manage a charity registry with states candidate/featured/blocklisted, plus `times_featured`, `last_featured_at`, and a dedup key.
- [x] **REG-02**: The Scout consults the registry so an already-featured or blocklisted charity is not selected again.

### Donation Reconciliation (RCN)
- [x] **RCN-01**: Operator can see, per issue, gross sales / Stripe fees / net-to-charity for that issue's sales window (from the Stripe API + existing order records).
- [x] **RCN-02**: Operator can track payout status per issue so the "100% of proceeds" promise is auditable.

### Notifications (NTF)
- [x] **NTF-01**: Operator receives a notification (Slack and/or email) on run complete, run failed, and run awaiting review.
- [x] **NTF-02**: Operator receives a notification when a budget threshold is hit.

### Audit Log (AUD)
- [x] **AUD-01**: Every config/prompt change, review decision, and kill-switch flip is recorded in an audit log with actor, timestamp, and before/after values.

## Milestone v3.0 Requirements — Dispatch Control v2 (Editorial Operator Console)

**Scope:** Rebuild dispatch-control into the complete editorial surface per the committed 1c design (`Dispatch Control.dc.html`); Sanity bypassed (all editing/publishing via the console through the pipeline API), removal deferred to a follow-up milestone. Grounded in the design bundle (design brief v2, audit R1–R6, DECISIONS.md) and `.planning/research/SUMMARY.md`. Locked decisions: native galley (no iframe) · per-section editing (no WYSIWYG) · dashboard → pipeline API → Sanity for every write · Signal Desk on existing backend only · two-sign-off publish with webhook-level bypass closure.

### Design System & Chrome (CHR)
- [x] **CHR-01**: Operator sees the 1c design system on every console screen — tokens (ink `#17140e`, cobalt `#253ad4`, vermilion `#e8471d`, marigold `#f2b01e`, green `#148a52`), Newsreader/Lora/Space Grotesk/IBM Plex Mono via next/font, hard-edged anti-SaaS surfaces.
- [x] **CHR-02**: Persistent masthead on every screen shows current issue number, pipeline state chip, month-to-date spend vs cap, and the auto-publish lock chip.
- [x] **CHR-03**: Left nav is workflow-ordered (Review Desk · Signal Desk · Run Monitor · Voice Pass / Prompt Lab · Eval Center · Registry) with a "How to use" screen (weekly loop, color legend, house rules).
- [x] **CHR-04**: Operator sees an Awaiting-you inbox in the masthead aggregating everything blocked on a human (awaiting-review runs, Gate 1 interrupts, unresolved blockers, failed runs); each item routes to the owning screen.
- [x] **CHR-05**: The deployed dashboard reaches the pipeline API (`NEXT_PUBLIC_PIPELINE_URL` configured; existing test-run panel functional in production).

### Galley & Review Desk (GLY)
- [x] **GLY-01**: Operator reads the issue as the reader will see it — a native render of the Sanity draft (all sections including the sandboxed game) inside the Review Desk, replacing the preview iframe.
- [x] **GLY-02**: QA findings render as inline severity-colored span annotations, resolved by quotedSpan text-match with a block-index hint; anchors that no longer resolve are surfaced as orphaned, never silently dropped.
- [x] **GLY-03**: Clicking an annotation opens a popover showing axis, severity, reason, and suggested fix, with Accept fix / Edit inline / Dismiss actions.
- [x] **GLY-04**: The decision rail is blockers-first: unresolved error-severity findings gate Publish; rail shows the editor memo, hook card, and a verification summary with affirmative states ("checked Nm ago" — never blank).
- [x] **GLY-05**: Section-status chips show per-section finding counts and act as jump navigation.

### Editing & Write Boundary (EDT)
- [x] **EDT-01**: Operator can edit any section's prose per-section from the console (structured block-list editing, not inline WYSIWYG); saves write to the Sanity draft via a pipeline content-patch endpoint using scoped patches.
- [x] **EDT-02**: Operator can edit structured fields from the console: section headlines, PDF key data points, game embed code, theme values.
- [x] **EDT-03**: Operator can upload assets (podcast audio, Suno audio, storyboard images) through the console → pipeline → Sanity assets.
- [x] **EDT-04**: Accept-fix applies the suggested text to the draft via content-patch and logs it; Dismiss requires a one-line reason; every content mutation lands in the audit log ("nothing silent").
- [x] **EDT-05**: All content writes flow dashboard → pipeline API → Sanity; the dashboard has no direct Sanity write path (source-scan enforceable).
- [x] **EDT-06**: After any content patch, annotation anchors are re-resolved; annotations invalidated by the edit surface as orphaned for operator review.

### Two-Sign-off Publish Gate (PUB)
- [x] **PUB-01**: Publishing requires two independent server-enforced sign-offs — "Facts cleared" and "Sounds human" — the publish endpoint refuses (409) unless both are recorded.
- [x] **PUB-02**: The Sanity publish webhook handler verifies sign-off state before running the publisher — a direct Studio status-flip can no longer bypass the gate.
- [x] **PUB-03**: Sanity Studio is retired as the editing/publish surface (publish path locked down, documented as read-only fallback) after a soak period of real weekly cycles on the console.
- [x] **PUB-04**: Every sign-off, publish, and override is audit-logged with actor and timestamp.

### Voice Pass (VOX)
- [x] **VOX-01**: Operator has a dedicated Voice Pass screen — machine-tells and voice violations lit inline over clean prose, with a per-screen tell count.
- [x] **VOX-02**: Clicking a tell opens an as-written vs suggested-house-voice comparison with Accept rewrite / Write my own / Keep (not a tell) actions; accept mutates via content-patch.
- [x] **VOX-03**: Voice Pass carries its own "Sounds human" sign-off, distinct from factual clearance (feeds PUB-01).
- [x] **VOX-04**: Detection is two-layer — deterministic rules render instantly, the LLM judge runs on demand — reusing the existing QA rules + Opus judge.

### Provenance (PRV)
- [x] **PRV-01**: The Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` bindings (generalizing the existing founder/subject paired-field pattern).
- [x] **PRV-02**: Section writers carry claim references forward via their structured output schemas so bindings survive into final prose (established at generation time, never post-hoc matched).
- [x] **PRV-03**: The galley renders sourced claims (marigold highlight, hover → source URL + retrieval date) and unsourced claims (rust tint) as first-class visual states.
- [x] **PRV-04**: The decision rail shows a source index — unsourced claims grouped on top with jump links, sourced claims listed with their sources; the claims checklist upgrades to source-bound claims.

### Run Monitor v2 (MON)
- [x] **MON-01**: Runs render as a vertical forensic spine — LLM agents as dots, code gates (verify_research, validate_sections) as marigold diamonds — with per-node cost, latency, model chip, and retry count.
- [x] **MON-02**: Clicking a node shows the handoff (upstream → node → downstream) and human-readable output, with raw JSON behind a toggle.
- [x] **MON-03**: The 7-writers node expands to per-section rows with a QA-derived strength score (0–100 colored bar) and flag counts; each section individually re-runnable.
- [x] **MON-04**: A drift strip compares this run's cost and duration against the trailing 8 runs.

### Signal Desk (SIG)
- [x] **SIG-01**: Operator sees the candidate slate from existing data (pitchLog scout summaries, Advocate scores with expandable arguments, primaryConcern always visible, never truncated).
- [x] **SIG-02**: The Gate 1 decision panel shows the winner, confidence meter, and editor reasoning in full.
- [x] **SIG-03**: When the pipeline interrupts at Gate 1, the screen enters side-by-side adjudication; the operator's pick plus a logged reason resumes the run via the existing resume endpoint.

### Prompt Lab Evals & Eval Center (EVL)
- [x] **EVL-01**: Golden scenarios exist as fixtures runnable against single agents through the existing test-run/score endpoints.
- [x] **EVL-02**: The Prompt Lab eval drawer auto-selects scenarios affected by the edited asset, runs them, and shows a scoreboard with deltas vs the active version.
- [x] **EVL-03**: Prompt commit is gated on target-metric-up with no regressions, with an override-with-reason escape hatch (logged) so the gate cannot deadlock.
- [x] **EVL-04**: The Eval Center shows scenario cards (description, what-it-catches, last result) and an append-only scoreboard time-series in new Convex tables — the editorial drift detector.
- [x] **EVL-05**: Operator can run a shadow run — the discovery scenario against current real news, previewing what a paid run would produce, without publishing or affecting run state.

### Registry Memory (MEM)
- [x] **MEM-01**: A coverage-memory strip visualizes the last 8 issues' cause/geo/signal chips so thematic repetition is visible at a glance.
- [x] **MEM-02**: Operator can append corrections to a charity's record (append-only corrections log) surfaced in the Registry.
- [x] **MEM-03**: The Researcher re-reads a charity's corrections log on any future mention of that charity.

## Milestone v4.0 Requirements — Dispatch Control v3 (The Editorial Workspace)

**Binding spec:** `docs/design/dispatch-control-v3/` — Annotations (semantics), DERIVED-STATE-CONTRACT (state machine, inspector shape, role gating), README (decisions, color semantics).

**Thesis:** the console stops mirroring the pipeline and becomes an editorial product with an *issue* at its center. The machine retreats behind a System Workbench. The editor never "triggers a pipeline."

### Issue Entity & Issues Home (ISS)
- [x] **ISS-01**: Operator sees an Issues home listing the in-progress issue as a card with its 5-stage strip, status, open-task count, claim coverage, voice state, estimated work remaining, and run cost.
- [x] **ISS-02**: Console routes are issue-keyed; a run is reachable only as a historical record *under* an issue, never as the primary navigation object.
- [x] **ISS-03**: Operator sees the next scheduled issue slot with the Calibrator's repetition note (e.g. "avoid US-SE · avoid weather") and can start it early.
- [x] **ISS-04**: Operator can hold an issue with a required reason; held issues appear on the home with reason + who + when, and can be reopened.
- [x] **ISS-05**: The global header separates four state systems that are never blended — issue status, system activity, My Tasks count, cost vs budget — each carrying label + icon, never color alone.
- [x] **ISS-06**: When issue status cannot load, the card reads "State unknown — refresh" rather than a silently stale "ready".

### Issue Workspace Frame (WSP)
- [x] **WSP-01**: One Issue Workspace replaces the Review Desk, Signal Desk, and Voice Pass nav items, with stage tabs 1–5 carrying live status marks.
- [x] **WSP-02**: A persistent issue outline lists every section with its state (clean / review / must fix / changed since review / not generated) and jumps to it.
- [ ] **WSP-03**: A collapsible context panel renders stage-appropriate context (open items, claim detail, findings, decision log) and can be hidden.
- [ ] **WSP-04**: Stage 2 (Draft) renders the galley in publication typography — checked claims marigold-underlined with source on hover *and* keyboard focus; unchecked claims rust-tinted and clickable through to Fact Check.
- [ ] **WSP-05**: Stage 5 (Approval) leads with blockers (Must fix / Review recommended / estimated review time, with jump links), then the readiness board, then the agent editor's recommendation labeled as agent judgment — "editor" unqualified is reserved for the human.
- [ ] **WSP-06**: Publish is disabled until Must fix = 0 ∧ Fact Check complete ∧ Voice approved current, with the unlock condition written next to the control; publishing shows an exact preview (destination, title, time, consequences) and one confirmation click — no typed confirmation.
- [x] **WSP-07**: "Not generated" is a visible first-class state in canvas and outline (e.g. the Editor's note), never a blank.

### Fact Check Stage (FCT)
- [ ] **FCT-01**: The Researcher emits an `importance` tier (Load-bearing / Supporting / Incidental) on every claim.
- [ ] **FCT-02**: Stage 3 shows an affirmative summary — claims checked X of Y, must fix, conflicting sources, checks not run, changed since check, last verified — so that blank never means verified.
- [ ] **FCT-03**: Operator can filter claims by must fix, unchecked, changed, numbers & dates, people & titles, organization claims, and weak source.
- [ ] **FCT-04**: Selecting a claim opens a provenance card (exact claim, importance, status, source + publisher, supporting passage, URL, retrieval date, agent, confidence) — the same component reused in Draft, Approval, and the inspector.
- [ ] **FCT-05**: Operator can Confirm, Edit claim, Replace source, Remove claim, or Keep as written with a required reason; each action updates the counters, My Tasks, Approval readiness, and header status.
- [ ] **FCT-06**: "Ask agent for better evidence" returns a replacement source **and** a rewritten claim; confirming applies both as a content patch + claim update and records a decision-log entry.
- [ ] **FCT-07**: A revision touching a claim's block returns that claim to unchecked and increments the "changed since check" counter.

### My Tasks & Decision Log (TSK)
- [ ] **TSK-01**: My Tasks lists everything awaiting human judgment as a *derived projection* over open claims, open findings, and missing sign-offs — no separate task store.
- [ ] **TSK-02**: Every task shows a plain-language title, the issue/area affected, why human judgment is required, severity (Must fix / Review recommended / Information), stage, age, and the agent's recommendation when one exists.
- [ ] **TSK-03**: Each task's primary action deep-links to the exact claim, passage, or decision; "Inspect context" opens the inspector on that artifact.
- [ ] **TSK-04**: When nothing needs the operator, My Tasks says so explicitly and points to Approval — silence is a designed state, not an empty list.
- [ ] **TSK-05**: A task whose underlying step was restarted shows as superseded with a link to the new step, never disappearing silently.
- [ ] **TSK-06**: Every reason-requiring action (remove lead, override a recommendation, keep as written, hold, activate with regression, Do not use) writes to one Decision log component recording actor, action, time, reason, before/after, instruction version, issue and run.

### Inspect How This Was Made (INS)
- [ ] **INS-01**: One "Inspect how this was made" panel is reachable from the brief organization card, the draft passage toolbar, the fact-check claim detail, a voice finding, the approval recommendation, and My Tasks.
- [ ] **INS-02**: The panel has seven tabs (Summary, Inputs, Instructions, Output, Sources, Diagnostics, Technical), human-readable content first; raw JSON is never the default anywhere.
- [ ] **INS-03**: The Inputs tab lists the values actually supplied and explicitly calls out **missing expected inputs** — computed as declared template variables minus keys present in the run's input payload.
- [ ] **INS-04**: The Instructions tab shows the exact active instruction version, the shared rules referenced, and links through to Agent Instructions ("Improve this agent →").
- [ ] **INS-05**: The Output tab shows the full human-readable output and notes when the issue text has since diverged from it.
- [ ] **INS-06**: The panel footer offers Ask agent to revise, Restart from this step, Improve this agent, Compare instruction versions, Related quality tests, and Prior & downstream steps.

### Agent Revision (REV)
- [ ] **REV-01**: Selecting a passage offers Edit text, Ask agent to revise, Compare with previous, Restore previous, Related facts & sources, and Inspect how this was made.
- [ ] **REV-02**: "Ask agent to revise" offers direction chips (Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom) — never a bare "Regenerate".
- [ ] **REV-03**: A revision returns a comparison card showing original, proposed, what changed, and the explicit claim delta (added / removed / altered) *before* anything is applied.
- [ ] **REV-04**: Operator can Apply, Edit before applying, Try another approach, or Discard; applying mutates the draft through the existing content-patch write boundary and logs to `audit_log`.
- [ ] **REV-05**: Agent revision calls are bounded by a per-issue cost guard, surfaced against the header's cost-vs-budget.

### Signal Editor & Candidate Verification (SGE)
- [ ] **SGE-01**: A Signal Editor agent emits 3–5 dated story leads per run, each with premise, dated peg + source link, reader energy, charitable angle, category, confidence, and a brand-risk flag where applicable.
- [ ] **SGE-02**: The Signal Editor never self-selects a brand-risk-flagged lead — it routes the decision to the human.
- [ ] **SGE-03**: A `verify_candidates` deterministic check runs after Scout and produces a verification record per organization (domain live, registration ID, obscurity/press scan), killing candidates that fail.
- [ ] **SGE-04**: The pipeline graph runs 20 nodes with `signal_editor` before `scout` and `verify_candidates` between `scout` and `advocate`, and the Postgres checkpointer resumes correctly across the new nodes.
- [ ] **SGE-05**: The Signal Editor reads Editorial Memory (recent coverage, avoid-list) and *surfaces* a repetition warning alongside the lead rather than silently suppressing it.

### Story & Brief Stage (BRF)
- [ ] **BRF-01**: Stage 1 shows story leads as cards with peg + source, reader energy, angle, category, confidence, and any brand-risk warning shown in full — never truncated or tooltip-hidden.
- [ ] **BRF-02**: Operator can Require a lead, or Remove it with a mandatory logged reason.
- [ ] **BRF-03**: Organization options are grouped under the chosen lead, each showing mechanism, verification record with dates, agent case, confidence, prior-coverage warning, and its **main concern always visible**.
- [ ] **BRF-04**: When agents cannot confidently choose, the stage enters a "Needs your decision" state with the top two options side by side (what each makes possible, evidence quality, risk, burden); the operator's choice requires a rationale and resumes the run via the existing interrupt/resume endpoint.
- [ ] **BRF-05**: An editable Brief (premise, current peg, central claim, reader effect, known risks, voice intention) is generated after selection, and the section writers draft *from* it.
- [ ] **BRF-06**: Operator can ask an agent to strengthen any single field of the brief.

### Brief Entry Point (ENT)
- [ ] **ENT-01**: Create issue offers two equal paths — "Find a story with agents" and "Start from my brief" — both landing in the Issue Workspace at Story & Brief.
- [ ] **ENT-02**: "Start from my brief" accepts a human-supplied premise, peg, organization, and optional source material, and starts a run that skips Signal Editor, Scout, Advocate, and Gate 1, entering at the Researcher.
- [ ] **ENT-03**: A brief-started run produces the same downstream artifacts (research, sections, QA, claims, sign-offs) as an agent-discovered run and is indistinguishable at Stages 2–5.
- [ ] **ENT-04**: An organization supplied in a human brief is still put through `verify_candidates`, so the verification record is never absent.

### Roles & Permissions (ROL)
- [ ] **ROL-01**: A user carries a role of Editor-in-chief or Collaborator, enforced server-side — not only in the UI.
- [ ] **ROL-02**: Exactly six actions are gated to Editor-in-chief: apply revision, confirm evidence replacement, approve the Voice Pass, publish, make an instruction active, mark an organization Do not use.
- [ ] **ROL-03**: A Collaborator sees every gated control rendered and locked *with an explanation of why*, never hidden.
- [ ] **ROL-04**: A Collaborator can read everything and comment.

### Workbench & Nomenclature (WBN)
- [ ] **WBN-01**: Nav splits into two visibly distinct groups — Editorial (Issues, My Tasks, Issue Workspace) and System Workbench (Run Details, Agent Instructions, Quality Tests, Editorial Memory) — with the signed-in role shown.
- [ ] **WBN-02**: Run Details names steps by action ("Find story leads", "Verify research", "Draft sections") with the agent as secondary metadata, renders deterministic checks as diamond markers, and states plainly whether it is showing a historical record or a live run.
- [ ] **WBN-03**: A failed run shows a plain-language recovery rail — what happened / what completed successfully / what did not happen / recommended recovery — with Restart from this step (reusing completed steps, not re-paying) and Improve this agent; downstream steps dim as Skipped.
- [ ] **WBN-04**: Agent Instructions shows *why a draft instruction exists*, linking back to the specific issue output that motivated it.
- [ ] **WBN-05**: Product vocabulary follows the nomenclature table throughout — deterministic check (not gate), step / Restart from this step (not node / re-run from node), Make active / Restore version (not commit / rollback), Quality test / Standard test case (not eval / golden scenario), Preview next run (not shadow run), Do not use (not blocklisted), Must fix (not blocking), Human approval required (not Auto-publish OFF).
- [ ] **WBN-06**: Typed confirmation is reserved for Mark Do-not-use (organization name + required reason); the automation toggle leaves the operator surface for Administration.

## Future Requirements (deferred beyond v2.0)

Tracked but not in the current roadmap.

### Deferred from v3.0 (Dispatch Control v2)

- **V3-DEF-01**: Sanity removal — content store → Convex, assets → blob storage, `apps/web` data-layer swap, Studio deletion. Own follow-up milestone after real weekly cycles prove the console; the EDT-05 write boundary makes this a contained adapter swap.
- ~~**V3-DEF-02**: Signal Editor agent + candidate gates, hookClaim, EIN/verification records~~ → **promoted into v4.0** as SGE-01..05. Stage 1 of the v3 design is built on story leads and a verification record, so the deferral came due.
- **V3-DEF-03**: Inline WYSIWYG galley editing — upgrade from per-section editing only if Andrew's weekly friction demands it.
- ~~**V3-DEF-04**: Assignable Editor-in-Chief seat + read/comment collaborator roles~~ → **promoted into v4.0** as ROL-01..04.
- **V3-DEF-05**: Suno + NotebookLM API automation (manual upload flows ship in v3.0 EDT-03).

### Productization (deferred from v2.0 — the §6 SaaS-extraction groundwork)
- **V2-PROD-01**: Workspace-scoping audit + multi-workspace switching (activate Clerk Organizations)
- **V2-PROD-02**: Per-workspace encrypted secrets store (BYO API keys; AES-256-GCM in Convex)
- **V2-PROD-03**: De-Eisenbalm-ify the control plane (a "rename the brand" grep test passes)
- **V2-PROD-04**: Agent graph topology stored as data/config (no graph-editor UI yet)

### Automation

### Automation

- **V2-01**: Suno API integration (auto-generate jingle audio from `sunoPrompt` instead of Andrew pasting `sunoAudioUrl`)
- **V2-02**: NotebookLM API integration (auto-generate podcast audio from `deliberationTranscript`)
- **V2-03**: Automatic weekly cron trigger for `/run/weekly` (v1 is manually triggered) — *CLI shipped in quick-260620-far; the kill-switch-gated tick + Railway-cron provisioning is now v2.0 RUN-02/RUN-03*

### Editorial Tooling

- **V2-04**: A backup human reviewer flow when Andrew is unavailable (Andrew is the single gate in v1)
- **V2-05**: A "regenerate single section" button in Sanity Studio that re-invokes one agent without rerunning the whole pipeline — *absorbed into v2.0 RUN-05 (re-roll a single agent from the dashboard)*
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
| Real-time collaborative editing (multi-cursor, presence) — v3.0 | Exactly one operator. CRDT/multiplayer machinery is accidental complexity that increases lost-edit risk while the write boundary is being tightened. |
| Configurable multi-role approval chains — v3.0 | One-person newsroom; the two-sign-off gate models the only two concerns that exist (facts, voice). Role machinery has no current user. |
| AI chat / copilot sidebar in the console — v3.0 | Andrew's job is judging machine output, not chatting with more of it; QA's reason/quotedSpan/suggestedFix fields already explain findings. |
| Bulk accept-all for QA findings — v3.0 | "Voice drift = brand failure" — bulk-accepting substantive findings defeats the human gate. (Bulk-dismiss of info-severity noise is allowed.) |
| Inline WYSIWYG rich-text editor — v3.0 | Locked: per-section structured editing. WYSIWYG fights the BodyBlock model and re-opens the wall-of-prose problem Phase 18's structural floor prevents. |
| Per-word track-changes / redline UI — v3.0 | Span-level accept/edit/dismiss is the right grain; content is regenerated in blocks, not micro-copyedited. |
| Run-replay video/timeline scrubber — v3.0 | Handoff inspector + drift strip deliver the forensic value; a cinematic replay is high effort, low marginal value for one operator. |

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
| CMR-01 | Phase 8: Stripe / Commerce | Complete |
| CMR-02 | Phase 8: Stripe / Commerce | Complete |
| CMR-03 | Phase 8: Stripe / Commerce | Complete |
| CMR-04 | Phase 8: Stripe / Commerce | Complete |
| CMR-05 | Phase 8: Stripe / Commerce | Complete |
| CMR-06 | Phase 8: Stripe / Commerce | Complete |
| CMR-07 | Phase 8: Stripe / Commerce | Complete |
| CMR-08 | Phase 8: Stripe / Commerce | Complete |
| CMR-09 | Phase 8: Stripe / Commerce | Complete |
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
| SHOP-01 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-02 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-03 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-04 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-05 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-06 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-07 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-08 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-09 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-10 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| SHOP-11 | Phase 15: Shop Storefront — Rich Product Page | Not started |
| MEL-01 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-02 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-03 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-04 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-05 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-06 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-07 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| MEL-08 | Phase 18: Magazine Editorial Layout — Writer Structure | Not started |
| P19-01 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |
| P19-02 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |
| P19-03 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |
| P19-04 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |
| P19-05 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |
| P19-06 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |
| P19-07 | Phase 19: Issue Page Redesign — Dispatch Magazine Layout | Not started |

**Coverage (v1.0):**
- v1 requirements: 110 total (95 prior + 8 MEL-* Phase 18 + 7 P19-* Phase 19)
- Mapped to phases: 110
- Unmapped: 0 ✓

## v2.0 Traceability

Added 2026-06-21 during v2.0 roadmap creation. All 38 v2.0 requirements mapped to Phases 21–27.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| AUTH-02 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| AUTH-03 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| AUTH-04 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| CFG-05 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| CFG-01 | Phase 22: Config Externalization | Complete |
| CFG-02 | Phase 22: Config Externalization | Complete |
| CFG-03 | Phase 22: Config Externalization | Complete |
| CFG-04 | Phase 22: Config Externalization | Complete |
| OBS-01 | Phase 23: Node Wrappers + Read-Only Dashboard | Complete |
| OBS-02 | Phase 23: Node Wrappers + Read-Only Dashboard | Complete |
| OBS-03 | Phase 23: Node Wrappers + Read-Only Dashboard | Complete |
| OBS-04 | Phase 23: Node Wrappers + Read-Only Dashboard | Complete |
| OBS-05 | Phase 23: Node Wrappers + Read-Only Dashboard | Complete |
| AUD-01 | Phase 23: Node Wrappers + Read-Only Dashboard | Complete |
| PRM-01 | Phase 24: Prompt Editor + Versioning | Complete |
| PRM-02 | Phase 24: Prompt Editor + Versioning | Complete |
| PRM-03 | Phase 24: Prompt Editor + Versioning | Complete |
| PRM-04 | Phase 24: Prompt Editor + Versioning | Complete |
| PRM-05 | Phase 24: Prompt Editor + Versioning | Complete |
| PRM-06 | Phase 24: Prompt Editor + Versioning | Complete |
| RUN-01 | Phase 25: Run Control | Complete |
| RUN-02 | Phase 25: Run Control | Complete |
| RUN-03 | Phase 25: Run Control | Complete |
| RUN-04 | Phase 25: Run Control | Complete |
| RUN-05 | Phase 25: Run Control | Complete |
| RUN-06 | Phase 25: Run Control | Complete |
| RVW-01 | Phase 26: Review Gate + Charity Registry | Complete |
| RVW-02 | Phase 26: Review Gate + Charity Registry | Complete |
| RVW-03 | Phase 26: Review Gate + Charity Registry | Complete |
| RVW-04 | Phase 26: Review Gate + Charity Registry | Complete |
| RVW-05 | Phase 26: Review Gate + Charity Registry | Complete |
| REG-01 | Phase 26: Review Gate + Charity Registry | Complete |
| REG-02 | Phase 26: Review Gate + Charity Registry | Complete |
| RCN-01 | Phase 27: Money + Notifications | Complete |
| RCN-02 | Phase 27: Money + Notifications | Complete |
| NTF-01 | Phase 27: Money + Notifications | Complete |
| NTF-02 | Phase 27: Money + Notifications | Complete |

**Coverage (v2.0):**
- v2.0 requirements: 38 total (AUTH:4, CFG:5, OBS:5, PRM:6, RUN:6, RVW:5, REG:2, RCN:2, NTF:2, AUD:1)
- Mapped to phases: 38
- Unmapped: 0 ✓
- V2-PROD-01..04 deferred to future milestone (not in Phases 21-27) ✓

## Prompt Console (Phase 28)

Derived 2026-06-24 in `/gsd:plan-phase 28` from the four capability areas and locked decisions D-01–D-15 (see `.planning/phases/28-prompt-console/28-CONTEXT.md`). Extends the Phase 24 PRM-* prompt editor.

### Editorial context + safety

- [x] **PRC-01**: Every editable prompt card and detail pane displays the agent's editorial role/description, sourced from a single brand-agnostic console-side descriptions map keyed by `agentKey` covering all editable keys (system prompts, `*_user` templates, six section-guidance keys, `rubric`/`voice_constraints`) (D-09)
- [x] **PRC-02**: A "drift" badge marks prompts whose active version content differs from the seeded v1, surfaced on list cards and the detail pane (D-10, D-03)
- [x] **PRC-03**: An in-app unsaved-changes guard (confirm dialog + visible "unsaved changes" indicator) fires on navigate-away, `agentKey` switch, or view-toggle while the draft is dirty; no native `beforeunload` (D-11)
- [x] **PRC-04**: The prompt list is filterable by name text, by group (`system`/`user-template`/`section-guidance`/`asset` via `groupForAgentKey`), and by drift (D-12)

### Variable tooling

- [x] **PRC-05**: Click-to-insert variable chips with tooltips, sourced from a global `{variable}→description` map keyed by variable name, pairing with `VARIABLE_REGISTRY` without changing its shape (D-13)
- [x] **PRC-06**: An "assembled with sample values" preview substitutes a client-side `{variable}→sampleValue` map into the draft instantly with no server call (D-14)
- [x] **PRC-07**: A passive "unused variable" advisory hint flags registry-allowed variables absent from the draft, without gating save (the Phase 24 unknown-var gate stays the only gate) (D-15)

### The authoring loop

- [x] **PRC-08**: A draft-vs-active side-by-side test-run compare runs the active version on demand and shows both outputs with real cost + token counts; the unsaved draft runs by default at 1× cost (D-07)
- [x] **PRC-09**: A voice-rubric score on test-run output — per-axis breakdown + overall headline number + 1–2 line rationale, advisory only (never gates save/activate) — loading the live active `rubric` (disk fallback); scores the draft always and the active side when compared, showing the delta (D-04, D-05, D-06, D-08)

### Prompt source-of-truth sync

- [x] **PRC-10**: DB (`prompt_versions`) is authoritative; a copyable export renders the active version's exact `.md`-marker byte form (`<!-- PROMPT START/END -->`) for copy→commit, with no direct repo write; the client `.docx`/Google-Docs round-trip is retired for prompts (D-01, D-02, D-03)

## Phase 28 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRC-01 | Phase 28: Prompt Console | Planned |
| PRC-02 | Phase 28: Prompt Console | Planned |
| PRC-03 | Phase 28: Prompt Console | Planned |
| PRC-04 | Phase 28: Prompt Console | Planned |
| PRC-05 | Phase 28: Prompt Console | Planned |
| PRC-06 | Phase 28: Prompt Console | Planned |
| PRC-07 | Phase 28: Prompt Console | Planned |
| PRC-08 | Phase 28: Prompt Console | Planned |
| PRC-09 | Phase 28: Prompt Console | Planned |
| PRC-10 | Phase 28: Prompt Console | Planned |

**Coverage (Phase 28):**
- Phase 28 requirements: 10 total (PRC:10)
- Mapped to phase: 10
- Unmapped: 0 ✓

## v3.0 Traceability

Added 2026-07-06 during v3.0 roadmap creation. All 43 v3.0 requirements mapped to Phases 30-39 (continuing numbering from Phase 29). Phases 37-38 are parallel tracks with no schema/endpoint dependency on the Review Desk track (30-36).

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHR-01 | Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox | Planned |
| CHR-02 | Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox | Planned |
| CHR-03 | Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox | Planned |
| CHR-04 | Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox | Planned |
| CHR-05 | Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox | Planned |
| EDT-01 | Phase 31: Content-Patch Endpoints + Full Editing | Complete |
| EDT-02 | Phase 31: Content-Patch Endpoints + Full Editing | Complete |
| EDT-03 | Phase 31: Content-Patch Endpoints + Full Editing | Complete |
| EDT-05 | Phase 31: Content-Patch Endpoints + Full Editing | Complete |
| GLY-01 | Phase 32: Native Galley (read-only) + Span-Resolver | Planned |
| GLY-02 | Phase 32: Native Galley (read-only) + Span-Resolver | Planned |
| GLY-05 | Phase 32: Native Galley (read-only) + Span-Resolver | Planned |
| GLY-03 | Phase 33: Accept-Fix Wiring + Decision Rail | Planned |
| GLY-04 | Phase 33: Accept-Fix Wiring + Decision Rail | Planned |
| EDT-04 | Phase 33: Accept-Fix Wiring + Decision Rail | Planned |
| EDT-06 | Phase 33: Accept-Fix Wiring + Decision Rail | Planned |
| PUB-01 | Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement | Planned |
| PUB-02 | Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement | Planned |
| PUB-03 | Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement | Planned |
| PUB-04 | Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement | Planned |
| PRV-01 | Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering | Planned |
| PRV-02 | Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering | Planned |
| PRV-03 | Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering | Planned |
| PRV-04 | Phase 35: Provenance Pipeline + Sourced/Unsourced Galley Rendering | Planned |
| VOX-01 | Phase 36: Voice Pass De-Slop Screen | Planned |
| VOX-02 | Phase 36: Voice Pass De-Slop Screen | Planned |
| VOX-03 | Phase 36: Voice Pass De-Slop Screen | Planned |
| VOX-04 | Phase 36: Voice Pass De-Slop Screen | Planned |
| MON-01 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| MON-02 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| MON-03 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| MON-04 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| SIG-01 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| SIG-02 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| SIG-03 | Phase 37: Run Monitor v2 + Signal Desk | Planned |
| EVL-01 | Phase 38: Prompt Lab Evals + Eval Center | Planned |
| EVL-02 | Phase 38: Prompt Lab Evals + Eval Center | Planned |
| EVL-03 | Phase 38: Prompt Lab Evals + Eval Center | Planned |
| EVL-04 | Phase 38: Prompt Lab Evals + Eval Center | Planned |
| EVL-05 | Phase 38: Prompt Lab Evals + Eval Center | Planned |
| MEM-01 | Phase 39: Registry Coverage-Memory Strip | Planned |
| MEM-02 | Phase 39: Registry Coverage-Memory Strip | Planned |
| MEM-03 | Phase 39: Registry Coverage-Memory Strip | Planned |

**Coverage (v3.0):**
- v3.0 requirements: 43 total (CHR:5, GLY:5, EDT:6, PUB:4, VOX:4, PRV:4, MON:4, SIG:3, EVL:5, MEM:3)
- Mapped to phases: 43
- Unmapped: 0 ✓
- V3-DEF-01..05 deferred to a follow-up milestone (not in Phases 30-39) ✓

## v4.0 Traceability

Added 2026-07-14 during v4.0 roadmap creation. All 62 v4.0 requirements mapped to Phases 40-50 (continuing numbering from v3.0, which ended at Phase 39). One requirement block maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ISS-01 | Phase 40: Issue Entity & Issues Home | Complete |
| ISS-02 | Phase 40: Issue Entity & Issues Home | Complete |
| ISS-03 | Phase 40: Issue Entity & Issues Home | Complete |
| ISS-04 | Phase 40: Issue Entity & Issues Home | Complete |
| ISS-05 | Phase 40: Issue Entity & Issues Home | Complete |
| ISS-06 | Phase 40: Issue Entity & Issues Home | Complete |
| WSP-01 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| WSP-02 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| WSP-03 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| WSP-04 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| WSP-05 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| WSP-06 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| WSP-07 | Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval | Planned |
| FCT-01 | Phase 42: Fact Check Stage | Planned |
| FCT-02 | Phase 42: Fact Check Stage | Planned |
| FCT-03 | Phase 42: Fact Check Stage | Planned |
| FCT-04 | Phase 42: Fact Check Stage | Planned |
| FCT-05 | Phase 42: Fact Check Stage | Planned |
| FCT-06 | Phase 42: Fact Check Stage | Planned |
| FCT-07 | Phase 42: Fact Check Stage | Planned |
| TSK-01 | Phase 43: My Tasks & Decision Log | Planned |
| TSK-02 | Phase 43: My Tasks & Decision Log | Planned |
| TSK-03 | Phase 43: My Tasks & Decision Log | Planned |
| TSK-04 | Phase 43: My Tasks & Decision Log | Planned |
| TSK-05 | Phase 43: My Tasks & Decision Log | Planned |
| TSK-06 | Phase 43: My Tasks & Decision Log | Planned |
| INS-01 | Phase 44: Inspect How This Was Made | Planned |
| INS-02 | Phase 44: Inspect How This Was Made | Planned |
| INS-03 | Phase 44: Inspect How This Was Made | Planned |
| INS-04 | Phase 44: Inspect How This Was Made | Planned |
| INS-05 | Phase 44: Inspect How This Was Made | Planned |
| INS-06 | Phase 44: Inspect How This Was Made | Planned |
| REV-01 | Phase 45: Agent Revision | Planned |
| REV-02 | Phase 45: Agent Revision | Planned |
| REV-03 | Phase 45: Agent Revision | Planned |
| REV-04 | Phase 45: Agent Revision | Planned |
| REV-05 | Phase 45: Agent Revision | Planned |
| SGE-01 | Phase 46: Signal Editor & Candidate Verification | Planned |
| SGE-02 | Phase 46: Signal Editor & Candidate Verification | Planned |
| SGE-03 | Phase 46: Signal Editor & Candidate Verification | Planned |
| SGE-04 | Phase 46: Signal Editor & Candidate Verification | Planned |
| SGE-05 | Phase 46: Signal Editor & Candidate Verification | Planned |
| BRF-01 | Phase 47: Story & Brief Stage | Planned |
| BRF-02 | Phase 47: Story & Brief Stage | Planned |
| BRF-03 | Phase 47: Story & Brief Stage | Planned |
| BRF-04 | Phase 47: Story & Brief Stage | Planned |
| BRF-05 | Phase 47: Story & Brief Stage | Planned |
| BRF-06 | Phase 47: Story & Brief Stage | Planned |
| ENT-01 | Phase 48: Brief Entry Point | Planned |
| ENT-02 | Phase 48: Brief Entry Point | Planned |
| ENT-03 | Phase 48: Brief Entry Point | Planned |
| ENT-04 | Phase 48: Brief Entry Point | Planned |
| ROL-01 | Phase 49: Roles & Permissions | Planned |
| ROL-02 | Phase 49: Roles & Permissions | Planned |
| ROL-03 | Phase 49: Roles & Permissions | Planned |
| ROL-04 | Phase 49: Roles & Permissions | Planned |
| WBN-01 | Phase 50: Workbench & Nomenclature | Planned |
| WBN-02 | Phase 50: Workbench & Nomenclature | Planned |
| WBN-03 | Phase 50: Workbench & Nomenclature | Planned |
| WBN-04 | Phase 50: Workbench & Nomenclature | Planned |
| WBN-05 | Phase 50: Workbench & Nomenclature | Planned |
| WBN-06 | Phase 50: Workbench & Nomenclature | Planned |

**Coverage (v4.0):**
- v4.0 requirements: 62 total (ISS:6, WSP:7, FCT:7, TSK:6, INS:6, REV:5, SGE:5, BRF:6, ENT:4, ROL:4, WBN:6)
- Mapped to phases: 62
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-07-14 — added v4.0 Traceability (ISS/WSP/FCT/TSK/INS/REV/SGE/BRF/ENT/ROL/WBN → Phases 40-50)*
