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

**Archive CardSwap + Issue-Page Motion Polish (Phase 11 — 2026-05-22)**
- ✓ ARC-01: `/archive` shows a CSS-only 3D `CardSwap` cycling real past issues from Sanity (`ArchiveIssue[]`, no GSAP/CDN/new deps), 6s auto-advance, pause-on-hover, click-to-open; `prefers-reduced-motion` skips the timer and the preserved `<ArchiveList>` is the static keyboard-accessible fallback
- ✓ MOT-01: issue hero charity name reveals word-by-word via component-scoped `@keyframes` clip-path (opacity/clip-path only in `from{}`); `IssueHero.tsx` stays a Server Component; instant under reduced-motion
- ✓ MOT-02: `.section-card:hover` gains `translateY(-4px)` lift in `globals.css`; `SectionNavigator.tsx` magnetic-glow `prefersReducedMotion` early-return preserved (no new cursor JS)
- ✓ MOT-03: `DeliberationSlot.tsx` confidence meter counts up 0→value via `IntersectionObserver`+rAF (final value instant under reduced-motion); pitch cards use `.pitch-card-list` scroll-snap; 5 Convex subscriptions byte-unchanged, DEL-04 clean
- ✓ Constraints held: no new npm dep, FONT_WHITELIST 6 entries unchanged, `theme.ts`/`GameSlot.tsx` untouched, single `<main>`; 91/91 Phase 11 + tripwire tests green, build passes (5 visual checks noted in `11-VERIFICATION.md` for a browser pass)

**Machine Editorial Design Adoption + DesignAgent Suppression (Phase 12 — 2026-05-22)**
- ✓ MED-01: live site locked to the fixed Machine Editorial dark palette — `issue/[slug]/layout.tsx` emits `''` (not `serializeThemeCss(null)`) when suppressed, so the `globals.css :root` house palette (`#0C0B0A`/`#F0EAD9`/`#CDA434`/`#C2502A`) wins on every issue; `theme.ts` validation logic byte-unchanged
- ✓ MED-02: reversible env-var flag `DESIGNAGENT_SUPPRESSED` (no `NEXT_PUBLIC_`, request-time server read) — pipeline `graph/builder.py` drops the `design` node from `SECTION_WRITERS` and `agents/validate.py` drops `"theme"` from `REQUIRED_FIELDS` in atomic lockstep; web `layout.tsx` + `ThemeApplier.tsx` ignore per-issue theme; flipping the var OFF restores prior theming + re-adds the node with no code change
- ✓ MED-03: DesignAgent `_build_messages` system prompt gains the "AESTHETIC ENVELOPE (Machine Editorial)" block (envelope + per-issue accent variation); `ThemeOutput`/`_validate_full`/regenerate-once/`SAFE_THEME`/`FALLBACK_FONT_*` byte-unchanged
- ✓ MED-04: `SectionNavigator.tsx` rebuilt to the board's Vertical Timeline variant (spine, node dots, `§ NN`, tag pills, Cormorant title + italic word, READ STATUS readout, scroll-driven progress); 8 canonical anchor ids + `--mx`/`--my` glow + `prefers-reduced-motion` early-return preserved; machine-readout labels = Inter uppercase 0.18em (no IBM Plex Mono)
- ✓ MED-05: `DeliberationSlot.tsx` rebuilt to the board's Carousel & Flow variant (scroll-snap pitch carousel + winner glow, Scout→Advocate→Editor flow line, tape-reel confidence meter); 5 Convex subscriptions + AGENT_LABELS + count-up `useEffect` + DEL-04 (no model names) preserved byte-compatible
- ✓ Constraints held: no new npm dep, FONT_WHITELIST unchanged, `theme.ts` + game-sandbox security untouched, single `<main>`, ≥44px, WCAG AA; Phase 12 + all prior tripwires green, `pnpm --filter web build` passes, pipeline pytest 160 passed / 0 failed. Pre-existing Phase 8 (Stripe) baseline unchanged: 29 CMR sentinel tests red (08-04..08-07 unbuilt). Visual-fidelity browser pass noted in `12-VERIFICATION.md`.

**Deliberation as Conversation (Phase 13 — 2026-05-24)**
- ✓ DEL-CONV-01/05: new `chronicler` `@agent_node` (`agents/chronicler.py`) — a SINGLE `acomplete` call (cost/cadence-safe, no debate loop) that dramatizes the run's real Scout findings + Advocate scores + Editor decision into a faithful Jesse-voice `{speaker, text}` dialogue using `VOICE_CONSTRAINTS` verbatim; D-18 deterministic fallback preserves the editor-set transcript on failure; `model_versions["chronicler"]` recorded (AGT-17). Transcript form retained for the V2-02 NotebookLM export (D-17)
- ✓ DEL-CONV-02/03: structured turns are **Sanity content, not a Convex event** — additive `selectionDeliberation.conversation[]` (`{speaker, text}`) in `weeklyIssue.ts`, `DispatchState.deliberation_conversation`, and `docs/API_CONTRACTS.md` reconciled at §7/§1.2/§2.2 BEFORE any producer/consumer code (contract-first gate); Convex `deliberationEvents.eventType` union untouched (D-06/D-08); Sanity write uses `_key=turn-{i:03d}`
- ✓ DEL-CONV-04: `DeliberationSlot.tsx` renders the dialogue as a chat thread ABOVE the machine `<details>` view — `{turn.text}` as plain string (no `dangerouslySetInnerHTML`, no client Markdown parse), per-turn agent chips reuse `agentChipStyle` + `getAgentLabel`, `role="log"`; the raw `<pre>{transcript}</pre>` dump removed from `PodcastSlot.tsx` (D-10 supersedes POD-02's reader-facing render; transcript data retained)
- ✓ Constraints held: no new npm dep, `VOICE_CONSTRAINTS` reused, single `<main>`, ≥44px, WCAG AA, 5 Convex subscriptions, DEL-04 (no model names) all preserved; `pnpm --filter web build` passes; deliberation-conversation (6/6) + podcast-slot (9/9) + DEL-04 tripwire (3/3) + game-sandbox + typography tripwires green; pipeline pytest 168 passed / 31 skipped. Pre-existing Phase 8 (Stripe) baseline unchanged: 29 CMR sentinel tests red. 4 human checks pending in `13-HUMAN-UAT.md` (live-run faithfulness, visual read, reduced-motion, AA contrast)

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

**PDF generation** (validated in Phase 6 — pending Andrew live-infra smoke)
- ✓ Publisher renders the Problem Statement to PDF via WeasyPrint using `problemStatement.pdfContent`, themed to the issue's colors/fonts (base64-inlined Playfair Display + Source Serif Pro, no Google Fonts HTTP) — `agents/publisher/pdf.py`
- ✓ PDF uploads back to Sanity as `weeklyIssue.problemPdf` via `upload_pdf_to_issue`; `/issue/[slug]` renders "Download the problem framework" link when `problemPdfUrl` is non-null — verified by unit tests + sample 18.6 KB PDF render
- ✓ Sanity webhook on publish triggers Publisher with corrected `t={ms},v1={base64url}` HMAC verification, 5-minute symmetric age check, Supabase idempotency-key dedup, 30s sleep before Vercel deploy hook, Convex `pipelineRuns.status='complete'` write — 12 requirements (PDF-01..04, WHK-01..08) marked Complete in REQUIREMENTS.md
- ⚠ End-to-end Andrew publish on live Railway + Sanity + Vercel + Supabase — 4 items persisted to `06-HUMAN-UAT.md`; smoke script documented in `packages/pipeline/README.md` § Phase 6

**Game rendering** (validated in Phase 7 — pending Andrew live-infra smoke)
- ✓ `apps/web/lib/game-validator.ts` exports `validateEmbedCode` (deny-list mirrors `FORBIDDEN_CONSTRUCTS` in `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` — 13 banned patterns: `window.parent`, `top.`, `parent.`, `fetch(`, `XMLHttpRequest`, `document.cookie`, `document.domain`, external `<script src=...>`, external `<link href=...>`, etc.) and `injectGameHead` (prepends 9-directive CSP meta + viewport + mobile CSS reset)
- ✓ `apps/web/components/issue/GameSlot.tsx` is a Client Component that calls `validateEmbedCode` on `game.embedCode`, renders `<iframe sandbox="allow-scripts" srcdoc={injectGameHead(embedCode)}>` on pass, renders `<GameFallback>` ("Game unavailable.") on fail, fires one-shot `qaCorrections.insert` Convex mutation on fail (useRef-guarded + runId-null skip)
- ✓ GAM-03 codebase-level tripwire: `apps/web/__tests__/game-sandbox.test.ts` reads `GameSlot.tsx` from disk and asserts `allow-same-origin` is absent + `sandbox="allow-scripts"` is present (3 tests passing)
- ✓ `pnpm --filter web test:unit` Vitest suite: 27/27 passing (24 validator + 3 sandbox source-scan)
- ⚠ Andrew live-infra smoke for GAM-05 (validator-fail → Convex row at qaCorrections table) + GAM-06 (360px mobile rendering against published issue) — 2 items persisted to `07-HUMAN-UAT.md`; runbooks documented in `apps/web/README.md` § "Andrew's manual smoke test"

**Stripe / commerce**
- [ ] Reader can view the lip balm product at `/shop`
- [ ] Reader can complete a checkout via Stripe (custom integration, no Shopify)
- [ ] Reader lands on `/shop/thank-you` after successful checkout
- [ ] Stripe webhook updates order state on payment confirmation (signature-verified, idempotent)
- [ ] A small persistent shop callout appears at the bottom of every issue page (one sentence + button — no banner, no modal)

**Deliberation layer + Podcast + Visual redesign** (validated in Phase 9 — pending Andrew live-infra smoke)
- ✓ `apps/web/components/issue/DeliberationSlot.tsx` rewritten from propless stub into a live Convex layer: 5 `useQuery` subscriptions (`pipelineRuns`/`pitchLog`/`deliberationEvents`/`agentVotes`/`qaCorrections`) keyed on `issue.runId` with the `"skip"` sentinel when null; collapsed-by-default `<details>` two-column layout; advocate score bars parsed from `deliberationEvents` `advocate-argument` payloads (null → "Scores did not complete this cycle.", never a 0 bar); QA severity color + text label (WCAG 1.4.1); editor-confidence meter rendered only on a finite 0–1 payload value (DEL-01/02/03/05)
- ✓ DEL-04 security: `run.cost`/`modelVersions` never reach the render path (the only `run.cost` string is a `// SECURITY` comment); agent identity chips use a hardcoded persona `AGENT_LABELS` map and link to `/agents/[agentId]` — no model names anywhere. Tripwire `apps/web/__tests__/deliberation-no-model-names.test.ts` (never skipped) enforces this
- ✓ DEL-06: minimal `apps/web/app/agents/[agentId]/page.tsx` route (RSC, `QUERY_AGENT_PROFILE_BY_ID`, `notFound()` on miss, renders displayName/role/personality/avatar only)
- ✓ POD-01/02/03: `apps/web/components/issue/PodcastSlot.tsx` native `<audio controls>` when `podcast.audioFile` set, collapsible transcript, "Audio coming soon." empty state with no broken player
- ✓ Visual redesign: dark HYBRID house palette in `globals.css` (`:root` now dark, per-issue `--color-*` still themes accents), `Atmosphere.tsx` (reduced-motion-safe aurora/grid/grain/scroll-progress), 8-card `SectionNavigator.tsx`, `SiteHeader.tsx` mobile disclosure (aria-expanded/controls + Escape), 8 article components restyled, pull-quotes extracted from the first body blockquote (zero schema change), game sandbox tripwire preserved
- ✓ Nyquist substrate: 10 Phase 9 Vitest files green (62 tests) incl. WCAG-AA tone guard (`theme-aa-tones.test.ts`) + mobile-nav guard (`site-header-nav.test.ts`); zero regressions (the 29 failing CMR tests are the pre-existing unbuilt-Phase-8 baseline)
- ⚠ Real-time deliberation propagation while a pipeline runs (DEL-03 success criterion 4) — correct-by-code via Convex reactive `useQuery`, but live confirmation needs a running Convex deployment; persisted to `09-HUMAN-UAT.md`

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
*Last updated: 2026-05-24 after Phase 13 (Deliberation as Conversation) completion — the issue deliberation now reads as a real multi-turn agent conversation. A new single-call `chronicler` LangGraph node (`editor_gate_1 → chronicler → researcher`) dramatizes the run's real Scout findings + Advocate scores + Editor decision into a faithful Jesse-voice `{speaker, text}` dialogue (VOICE_CONSTRAINTS reused; D-18 deterministic fallback preserves the transcript for the NotebookLM export). Turns are Sanity content (additive `selectionDeliberation.conversation[]` + `DispatchState.deliberation_conversation`, `API_CONTRACTS.md` reconciled §7/§1.2/§2.2 contract-first; Convex `eventType` union untouched). `DeliberationSlot.tsx` renders the thread inline above the machine `<details>` view (plain-string turns, reused agent chips, `role="log"`); the raw `<pre>{transcript}</pre>` dump removed from `PodcastSlot.tsx` (D-10 supersedes POD-02's reader-facing render, transcript data retained). No new npm deps, 5 Convex subs + DEL-04 + single `<main>` + ≥44px + WCAG AA preserved; build passes, pipeline pytest 168 passed / 31 skipped, all tripwires green. 4 human-verification items pending in `13-HUMAN-UAT.md`. Pre-existing Phase 8 (Stripe) baseline remains: 29 CMR tests red (08-04..08-07 unbuilt).*

*Earlier: 2026-05-22 after Phase 12 (Machine Editorial Design Adoption + DesignAgent Suppression) completion — live site locked to the fixed Machine Editorial dark palette via the reversible `DESIGNAGENT_SUPPRESSED` env flag (web emits `''` so `globals.css :root` wins; pipeline drops the `design` node + `validate.py` drops `"theme"` from REQUIRED_FIELDS in atomic lockstep; DesignAgent prompt gains the Machine Editorial envelope for re-enabled runs). `SectionNavigator.tsx` rebuilt to the board's Vertical Timeline variant and `DeliberationSlot.tsx` to the Carousel & Flow variant — canonical anchors, `--mx`/`--my` glow, reduced-motion early-returns, 5 Convex subscriptions, AGENT_LABELS, and DEL-04 all preserved; machine-readout labels approximated with Inter uppercase 0.18em (no IBM Plex Mono / Spectral; FONT_WHITELIST unchanged). No new npm deps, `theme.ts` + game-sandbox security untouched, single `<main>`. Phase 12 + prior tripwires green, `pnpm --filter web build` passes, pipeline pytest 160 passed / 0 failed. MED-01..MED-05 validated. Pre-existing Phase 8 (Stripe) baseline remains: 29 CMR tests red (08-04..08-07 unbuilt).*
*Earlier: 2026-05-22 after Phase 11 (Archive CardSwap + Issue-Page Motion Polish) completion — new `apps/web/components/archive/CardSwap.tsx` (`'use client'`, CSS-3D card stack bound to real `ArchiveIssue[]` from `QUERY_ARCHIVE`, 6s auto-advance, pause-on-hover, click-to-open front `<a>`, accessible prev/next chevrons + indicator dots all `min-h-11`, `prefers-reduced-motion` skips the timer, `data-print-hide`, `<section>` not `<main>`) mounted above the preserved `<ArchiveList>` in `app/archive/page.tsx` (ARC-01). Motion polish MOT-01/02/03: `IssueHero.tsx` charity name splits into `.hero-word-span`s with component-scoped `@keyframes heroWordReveal` (clip-path/translateY/opacity ONLY in `from{}`, per-span `animationDelay`) — stays a Server Component; `globals.css` `.section-card:hover` gains `translateY(-4px)` + new `.pitch-card-list` scroll-snap carousel; `DeliberationSlot.tsx` confidence meter counts up 0→value via `IntersectionObserver`+rAF (reduced-motion shows final value instantly), pitch cards wired to `.pitch-card-list` (`role=list`/`listitem`, `tabIndex`, `aria-live`) — 5 Convex subscriptions byte-unchanged, DEL-04 clean. Locked constraints held: no new npm dep, FONT_WHITELIST 6 entries unchanged, `theme.ts`/`GameSlot.tsx` untouched, single `<main>`. 91/91 Phase 11 + tripwire tests green (3 new source-scan files + 5 tripwires), `pnpm --filter web build` passes, zero regressions. 5 visual checks (3D motion, hero reveal timing, magnetic glow, count-up trigger, AA contrast on new surfaces) noted in `11-VERIFICATION.md` for a browser pass. Pre-existing Phase 8 (Stripe/Commerce) baseline remains: 29 CMR tests red (08-04..08-07 unbuilt).*

*Earlier: 2026-05-21 after Phase 9 (Issue Page Completion + Visual Redesign) completion — `DeliberationSlot.tsx` rewritten as a live Convex layer (5 `useQuery` subscriptions, `"skip"` sentinel, collapsed-by-default accordion, advocate score bars from `deliberationEvents` payloads, QA severity color+label, agent persona chips → `/agents/[agentId]`, NO model names — `deliberation-no-model-names.test.ts` tripwire). `PodcastSlot.tsx` audio player / collapsible transcript / "Audio coming soon." (POD-01/02/03). Minimal `app/agents/[agentId]/page.tsx` route (DEL-06). Dark HYBRID house palette in `globals.css`, `Atmosphere.tsx` + `SectionNavigator.tsx` + `SiteHeader.tsx` mobile disclosure, 8 article components restyled, pull-quotes from first body blockquote (zero schema change), game sandbox preserved. All 9 DEL-/POD- requirements Complete; 10 Phase 9 Vitest files green (62 tests), zero regressions. Real-time propagation (DEL-03 SC#4) persisted to `09-HUMAN-UAT.md` for Andrew's live-Convex smoke. Pre-existing Phase 8 (Stripe/Commerce) baseline remains: 08-04..08-07 unbuilt (29 CMR tests red).*

*Earlier: 2026-05-19 after Phase 7 (Game Rendering) completion — `apps/web/lib/game-validator.ts` ships `validateEmbedCode` (13-entry deny-list mirroring `FORBIDDEN_CONSTRUCTS` in `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`) and `injectGameHead` (9-directive CSP meta + viewport + mobile CSS reset). `GameSlot.tsx` rewritten as Client Component: validator passes → `<iframe sandbox="allow-scripts" srcdoc={injectGameHead(embedCode)}>`; validator fails → `<GameFallback>` ("Game unavailable.") + one-shot `qaCorrections.insert` Convex mutation (useRef-guarded). `issue.runId` threaded through `app/issue/[slug]/page.tsx`. GAM-03 codebase tripwire `__tests__/game-sandbox.test.ts` asserts `allow-same-origin` absent + `sandbox="allow-scripts"` present in `GameSlot.tsx` source. Vitest infrastructure stood up in `apps/web` (`pnpm --filter web test:unit`, 27/27 passing). 4/6 GAM-* requirements (GAM-01/02/03/04) marked Complete via automation; GAM-05 (validator-fail → Convex row) + GAM-06 (360px mobile rendering) persisted to `07-HUMAN-UAT.md` for Andrew's live-infra smoke, with runbooks documented in `apps/web/README.md` § Phase 7. Phase 6 carryover (live Andrew publish + tampered HMAC + 30s CDN gap + Supabase dedup) remains deferred.*
