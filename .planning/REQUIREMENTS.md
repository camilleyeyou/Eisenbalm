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
- [ ] **AUTH-03**: FastAPI dashboard-control endpoints verify a Clerk-issued token before mutating pipeline state; the Railway cron path keeps its existing `X-Pipeline-Trigger-Secret`.
- [x] **AUTH-04**: Actions are attributed to the signed-in operator (consumed by the audit log and run-trigger attribution).

### Config Externalization & Reproducibility (CFG) — the §2 keystone
- [ ] **CFG-01**: Active agent config (system prompt, user template, model, temperature, max tokens, enabled flag) lives in Convex and is the source the pipeline reads at run start.
- [ ] **CFG-02**: The 12 existing prompt `.md` files are migrated into the config store as version-1 active rows, byte-verified against the files.
- [ ] **CFG-03**: The pipeline loads the full run config once at run start; if the config store is unavailable it falls back to the on-disk `.md` files rather than crashing or silently ignoring edits.
- [ ] **CFG-04**: Every run records an immutable snapshot of the exact config it used, written BEFORE the graph is invoked, so a mid-run edit cannot alter an in-flight run.
- [x] **CFG-05**: Every new dashboard/config table carries a `workspace_id` (seeded to one "eisenbalm" workspace); no charity- or Eisenbalm-specific logic is hardcoded in the control plane.

### Dashboard & Live Observability (OBS)
- [ ] **OBS-01**: Operator can view the pipeline as the real agent graph — each agent a node showing its current config (model, enabled, description).
- [ ] **OBS-02**: Operator can view full run history (status, trigger source, who triggered, duration, cost) and open any run.
- [ ] **OBS-03**: Operator can watch a run live — each agent transitions queued→running→done/failed with live token/cost accrual + latency — via Convex subscriptions.
- [ ] **OBS-04**: Operator can see cost rolled up per agent → per run → per issue → per week/month, reading the already-captured per-call cost (no second cost recorder is added).
- [ ] **OBS-05**: Operator can inspect per-agent input/output and any error/retry for a run.

### Prompt Editing & Versioning (PRM)
- [ ] **PRM-01**: Operator can edit an agent's system prompt and user-prompt template in a UI editor.
- [ ] **PRM-02**: The editor highlights the template variables available to that agent and warns on unknown/mangled variables before save.
- [ ] **PRM-03**: Saving a prompt creates a new version (author + timestamp + optional note) and never overwrites a prior version.
- [ ] **PRM-04**: Operator can diff any two versions and activate/rollback to a chosen version in one click; activation is blocked or safely queued while a run is in progress.
- [ ] **PRM-05**: Operator can test-run a single agent against sample or prior-real input and see its output + cost, without running the whole pipeline.
- [ ] **PRM-06**: The voice/persona text (`VOICE_CONSTRAINTS`) is editable and versioned as a first-class config entry alongside agent prompts.

### Run Control (RUN)
- [ ] **RUN-01**: Operator can trigger a new issue run on demand from the dashboard.
- [ ] **RUN-02**: A master `schedule_enabled` kill switch exists; the scheduler tick checks it FIRST and no-ops when off (automation controlled by data, not by enabling/disabling the cron).
- [ ] **RUN-03**: A Railway cron calls the tick endpoint on the configured cadence; operator can edit cadence / pause / resume and see the next scheduled run with timezone shown explicitly.
- [ ] **RUN-04**: Operator can cancel an in-flight run; the pipeline stops cooperatively and the run ends in a consistent `cancelled` state.
- [ ] **RUN-05**: Operator can re-roll a single agent/section within an existing issue without rerunning the whole pipeline. *(absorbs former V2-05)*
- [ ] **RUN-06**: Operator can set per-run and monthly budget caps with alert thresholds; the system warns at threshold and can refuse to start a run that would exceed the cap.

### Review & Publish Gate (RVW)
- [ ] **RVW-01**: `require_review` is on by default; a finished run lands in `awaiting_review` rather than auto-publishing.
- [ ] **RVW-02**: Operator sees a full rendered preview of the issue + deliberation + cost before deciding.
- [ ] **RVW-03**: Operator can approve-and-publish, approve-and-schedule, re-roll sections, or reject a run from the review screen.
- [ ] **RVW-04**: Enabling `auto_publish` requires explicit friction — it is off by default, takes a confirmation step, and is alerted + audit-logged.
- [ ] **RVW-05**: Every factual claim (number / name / date) in a finished issue is surfaced as a checklist for human sign-off before publish.

### Charity Registry (REG)
- [ ] **REG-01**: Operator can manage a charity registry with states candidate/featured/blocklisted, plus `times_featured`, `last_featured_at`, and a dedup key.
- [ ] **REG-02**: The Scout consults the registry so an already-featured or blocklisted charity is not selected again.

### Donation Reconciliation (RCN)
- [ ] **RCN-01**: Operator can see, per issue, gross sales / Stripe fees / net-to-charity for that issue's sales window (from the Stripe API + existing order records).
- [ ] **RCN-02**: Operator can track payout status per issue so the "100% of proceeds" promise is auditable.

### Notifications (NTF)
- [ ] **NTF-01**: Operator receives a notification (Slack and/or email) on run complete, run failed, and run awaiting review.
- [ ] **NTF-02**: Operator receives a notification when a budget threshold is hit.

### Audit Log (AUD)
- [ ] **AUD-01**: Every config/prompt change, review decision, and kill-switch flip is recorded in an audit log with actor, timestamp, and before/after values.

## Future Requirements (deferred beyond v2.0)

Tracked but not in the v2.0 roadmap.

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
| AUTH-03 | Phase 21: Auth + App Shell + Convex Schema | Pending |
| AUTH-04 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| CFG-05 | Phase 21: Auth + App Shell + Convex Schema | Complete |
| CFG-01 | Phase 22: Config Externalization | Pending |
| CFG-02 | Phase 22: Config Externalization | Pending |
| CFG-03 | Phase 22: Config Externalization | Pending |
| CFG-04 | Phase 22: Config Externalization | Pending |
| OBS-01 | Phase 23: Node Wrappers + Read-Only Dashboard | Pending |
| OBS-02 | Phase 23: Node Wrappers + Read-Only Dashboard | Pending |
| OBS-03 | Phase 23: Node Wrappers + Read-Only Dashboard | Pending |
| OBS-04 | Phase 23: Node Wrappers + Read-Only Dashboard | Pending |
| OBS-05 | Phase 23: Node Wrappers + Read-Only Dashboard | Pending |
| AUD-01 | Phase 23: Node Wrappers + Read-Only Dashboard | Pending |
| PRM-01 | Phase 24: Prompt Editor + Versioning | Pending |
| PRM-02 | Phase 24: Prompt Editor + Versioning | Pending |
| PRM-03 | Phase 24: Prompt Editor + Versioning | Pending |
| PRM-04 | Phase 24: Prompt Editor + Versioning | Pending |
| PRM-05 | Phase 24: Prompt Editor + Versioning | Pending |
| PRM-06 | Phase 24: Prompt Editor + Versioning | Pending |
| RUN-01 | Phase 25: Run Control | Pending |
| RUN-02 | Phase 25: Run Control | Pending |
| RUN-03 | Phase 25: Run Control | Pending |
| RUN-04 | Phase 25: Run Control | Pending |
| RUN-05 | Phase 25: Run Control | Pending |
| RUN-06 | Phase 25: Run Control | Pending |
| RVW-01 | Phase 26: Review Gate + Charity Registry | Pending |
| RVW-02 | Phase 26: Review Gate + Charity Registry | Pending |
| RVW-03 | Phase 26: Review Gate + Charity Registry | Pending |
| RVW-04 | Phase 26: Review Gate + Charity Registry | Pending |
| RVW-05 | Phase 26: Review Gate + Charity Registry | Pending |
| REG-01 | Phase 26: Review Gate + Charity Registry | Pending |
| REG-02 | Phase 26: Review Gate + Charity Registry | Pending |
| RCN-01 | Phase 27: Money + Notifications | Pending |
| RCN-02 | Phase 27: Money + Notifications | Pending |
| NTF-01 | Phase 27: Money + Notifications | Pending |
| NTF-02 | Phase 27: Money + Notifications | Pending |

**Coverage (v2.0):**
- v2.0 requirements: 38 total (AUTH:4, CFG:5, OBS:5, PRM:6, RUN:6, RVW:5, REG:2, RCN:2, NTF:2, AUD:1)
- Mapped to phases: 38
- Unmapped: 0 ✓
- V2-PROD-01..04 deferred to future milestone (not in Phases 21-27) ✓

---
*Requirements defined: 2026-05-09*
*Last updated: 2026-06-21 — added v2.0 traceability (AUTH/CFG/OBS/PRM/RUN/RVW/REG/RCN/NTF/AUD → Phases 21-27)*
