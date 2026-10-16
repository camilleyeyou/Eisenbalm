# Phase 55: Public Site Redesign — The Dispatch Front Page - Research

**Researched:** 2026-10-16
**Domain:** Next.js 15 App Router front-end rebuild (apps/web) to a fixed-brand mockup; additive Sanity/Convex data; Stripe/Convex commerce wiring
**Confidence:** HIGH on codebase findings (read directly), HIGH on font/contrast math (computed), MEDIUM on content-sourcing recommendations (design judgement, needs Andrew sign-off)

<user_constraints>
## User Constraints (from ROADMAP.md Phase 55 — no CONTEXT.md exists; locked 2026-10-16)

### Locked Decisions
1. **Fixed Dispatch brand** — Manrope; palette `#00FF79` / `#005CFF` / `#FF002B` / `#EEFE34` + `#0A0A0A` / `#FFFFFF`. Per-issue DesignAgent colour/font theming is dropped on the public site; only the weekly accent rotates among the four. `lib/theme.ts` security invariants stay intact.
2. **Jesse's dry voice** — the mockup's copy is layout reference only. Real copy stays "dry, precise, absurdly serious"; agent prompts are not retuned toward the mockup's plain tone. Cadence is Thursday (the mockup's "Monday" is wrong).
3. **"Full $8.99 / 100% to them" wording is approved.** (Do not re-flag.)
4. **Deliberation = summary cards** (picked / runner-up / also considered + editor confidence bar), replacing the DelibChat transcript.

### Claude's Discretion
- How each Scope-B content item is sourced (derive vs new field vs Andrew-authored), weekly-accent selection rule, chrome strategy, plan/wave decomposition, candidate requirement IDs.

### Deferred Ideas (OUT OF SCOPE)
- None recorded. (Implicitly out of scope: retuning agent prompts toward the mockup tone; rebranding /shop, /archive, /charities, /about, /legal — see Open Questions.)
</user_constraints>

<phase_requirements>
## Phase Requirements (candidate IDs — ROADMAP says "TBD"; proposed for the planner)

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | Fixed Dispatch brand tokens (Manrope, 4-colour palette, ink/white) scoped to home + issue pages; `lib/theme.ts` untouched | Standard Stack, Pattern 1 |
| PUB-02 | Weekly accent = deterministic function of issueNumber; ink colour chosen by `contrastRatio` ≥ 4.5 | Pattern 2, Pitfall 3 |
| PUB-03 | Home (`/`) renders the latest issue front page inline (no redirect) + back-issues grid + footer | Architecture, Pitfall 1 |
| PUB-04 | Masthead, ticker, accent hero, "How the Dispatch works" strip, sticky in-issue nav match mockup | Mockup analysis |
| PUB-05 | Eight numbered colour-block sections reuse existing section ids (`origin problem founder case game bonus delib pod`) and existing data | Architecture |
| PUB-06 | Deliberation summary cards (picked / runner-up / also considered) + **real** editor confidence; DelibChat/DelibScoreboard removed from public page | Deliberation data |
| PUB-07 | Game still in `sandbox="allow-scripts"` iframe; `game-validator`/`GameSlot` security contract unchanged | Game contract |
| PUB-08 | Every "Fund them" CTA reaches Stripe Checkout (`/api/checkout/create-session`) | Commerce |
| PUB-09 | Live "balms sold" count from Convex `stripeOrders`, scoped to the issue's charity | Commerce |
| PUB-10 | Working newsletter signup writing `emailSubscribers` (source `newsletter-optin`) | Email |
| PUB-11 | Scope-B content (ticker, dek, chips, read time, pull quotes, timeline, ad summary, hero photo) sourced per classification table; all degrade gracefully when absent | Scope-B table |
| PUB-12 | Back-issues grid + client-side search (name, cause, issue no.) | Archive |
| PUB-13 | 375px: no horizontal scroll; desktop parity | Responsive risks |
| PUB-14 | WCAG AA, `prefers-reduced-motion`, single `<main>`, ≥44px targets, strict build green | A11y |
| PUB-15 | Phase 19 oxblood/cream + transcript artifacts retired **with their tests** (retirement is a deliverable) | Retirement inventory |
| PUB-16 | Jesse-voice guard: no mockup placeholder strings ship; cadence copy says Thursday | Validation |
</phase_requirements>

## Summary

The site today is a Phase 19 "oxblood/cream magazine": root `app/layout.tsx` loads Fraunces/Newsreader/IBM Plex Mono and injects `serializeThemeCss(null)`; `/` **redirects** to the latest issue (`app/page.tsx`); `/issue/[slug]/layout.tsx` re-injects the per-issue Sanity theme (`serializeThemeCss(theme)` + `<ThemeApplier>`); and `components/issue/IssueLayout.tsx` (shared by the published page and the draft-preview route) composes ScrollProgressBar → SectionRail → IssueMasthead → IssueBriefing → MissionBand → 4 prose sections → GameSlot → BonusSection → DeliberationSlot (dark band, DelibChat + DelibScoreboard + ConfidenceBar) → PodcastSlot → ShopBand. Almost everything the mockup needs for Scope A already exists as data; the rebuild is mostly presentation. The data is already in the right shapes: section ids match the mockup nav, `selectionDeliberation.candidates[]` has scores, and Stripe/Convex already record per-charity orders.

Four findings change the plan. (1) The mockup is a **single page** (hero + all 8 sections + shop + back issues + footer), so `/` must stop redirecting and render the front page itself (canonical → `/issue/<slug>`). (2) The current deliberation confidence bar is **fake**: `DeliberationSlot` defaults `confidence ?? 80` and `IssueLayout` never passes one. The real value (`editor_confidence`, 0–1) exists in pipeline state and the Convex `editor-decision` event payload but is **never written to Sanity**; it needs one additive pipeline+schema field, and old issues must hide the bar rather than show 80%. (3) There is **no quantity on `stripeOrders`** and no public per-charity count query (the only aggregate, `charityLedger.charityTotals`, is an unscoped public query over all orders); the balms count must be derived (`donationAmount / 899`) behind a new narrowly-scoped public Convex query, and Convex functions only exist once synced to the deployment. (4) Several "new content" items (pull quotes, timeline, ad summary, hero photo) cannot come from the pipeline without prompt/Pydantic changes the locked decisions discourage; they should be Andrew-authored in one **top-level `frontPage` object** the pipeline never writes — but note `write_issue_draft` uses `createOrReplace`, so a pipeline re-run on the same issue wipes it (mitigation in Pitfalls).

Dropping per-issue theming is cheap and safe: leave `lib/theme.ts` exports exactly as they are (they are pinned by tests and used for `contrastRatio`), stop calling `serializeThemeCss(theme)`/`ThemeApplier` from the issue layout, and add a tiny new `lib/brand.ts` whose CSS is built only from a frozen constant palette. No new npm dependencies are required (Manrope is available in `next/font/google` as a variable font, weights 200–800, verified in the installed Next 15.5.18 font-data).

**Primary recommendation:** Build the new front page as a self-contained `components/dispatch/*` tree styled by one scoped `app/dispatch.css` (precedent: `app/shop/shop-brand.css`), compose it inside the existing `IssueLayout` (so the preview route keeps fidelity), render it from both `/` and `/issue/[slug]`, hide the old site chrome on those two routes, and retire Phase 19 components together with their source-scan tests in a final dedicated wave.

## Project Constraints (from CLAUDE.md)

- Read `docs/CLAUDE_CODE_BRIEF.md` and `docs/API_CONTRACTS.md` first; **do not modify field names** in `schemas/` / `convex/schema.ts` without checking API_CONTRACTS.md. Additive optional fields are fine but **API_CONTRACTS §1.2 (GROQ) / §2.2 (draft shape) must be updated in the same plan**.
- Tech stack locked: Next 14+ App Router/Vercel, Sanity v3 (repo has v5 Studio), Convex, Stripe custom, no Shopify/urgency mechanics. (The "no urgency mechanics" rule matters: a live balms counter + "progress toward next cart" must be informational, no countdowns/scarcity copy.)
- Jesse's voice is non-negotiable: dry, precise, absurdly serious, no winking, no exclamation marks. Voice rules apply to all new constants (strip copy, empty states, error text).
- Security: game iframe `sandbox="allow-scripts"` only; theme injection validates hex/fonts. Stripe webhook idempotency + signature verification untouched.
- GSD enforcement: all file edits happen through a GSD workflow. Project memory: run strict `pnpm --filter web build`/typecheck before declaring a frontend phase done (vitest does not type-check); Convex functions need `pnpm --filter @eisenbalm/convex dev:once` to reach the deployment; treat "retirement" halves as first-class deliverables.
- No `.claude/skills/` or `.agents/skills/` directory in the project (checked). User-global HF skills are irrelevant to this phase.

## Standard Stack

### Core (all already installed — no new deps)
| Library | Version (verified) | Purpose | Why |
|---------|---------|---------|-----|
| next | 15.5.18 installed (`^15.3.9`) | App Router, `next/font/google`, `next/image` | Existing; do NOT upgrade to 16 in this phase |
| react / react-dom | ^19.2.6 | UI | Existing |
| tailwindcss + @tailwindcss/postcss | ^4.3.0 | Utility classes | Existing; mockup values go in scoped CSS, not new config |
| next/font/google `Manrope` | font-data: weights 200–800 + `variable`, latin subsets | Brand font | Verified in `next/dist/compiled/@next/font/dist/google/font-data.json`; use variable (no `weight` array) |
| convex | ^1.38.0 | `useQuery` live count; `ConvexHttpClient` in routes | Existing `ConvexClientProvider` already mounted in root layout |
| @sanity/client, next-sanity, @sanity/image-url (installed ^2.1.1) | existing | GROQ reads; hero image URLs via `lib/sanity/image.ts` | `cdn.sanity.io/images/**` already in `next.config.ts` remotePatterns |
| @portabletext/react ^6.2 | existing | `PortableTextRenderer` reuse for section bodies | Reuse, restyle via CSS |
| vitest ^3.2 + jsdom + @testing-library/react | existing | Tests | Baseline: **47 files / 443 passed / 13 todo, ~6 s** (run 2026-10-16) |

### Supporting
| Library | Purpose | When |
|---------|---------|------|
| framer-motion ^12 | `useReducedMotion` in remaining motion bits | Only if something still animates; the mockup's only motion is the CSS ticker, so new components can be motion-library-free. Keep the dependency (tests pin it: `P19-04`) |
| @eisenbalm/emails `generateUnsubscribeToken` | token for newsletter subscriber row | Newsletter route only (node runtime) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scoped `dispatch.css` (+ CSS vars) | Tailwind arbitrary values inline | Mockup carries ~hundreds of precise values; a scoped stylesheet keeps JSX readable and follows the `shop-brand.css` precedent (hex only in the CSS file). Tailwind utilities remain fine for layout glue |
| Pathname-switched chrome | Move existing pages into `(site)` route group / multiple root layouts | Route-group move changes file paths pinned by ~10 source-scan tests (`app/shop/page.tsx`, `app/issue/[slug]/page.tsx`, …) — high churn for no user value |
| Derived/Andrew-authored content | New LLM "front-page copy" agent | New agent = prompt registry (Phase 24), cost, voice QA; conflicts with decision 2's "don't retune agent prompts". Defer |

**Installation:** none. **Version check:** `npm view next version` reports 16.4.2 upstream; the repo is intentionally on 15.5.18 — do not bump.

## Architecture Patterns

### Current → target component map (cite: `apps/web/…`)

| Today (Phase 19) | Disposition |
|---|---|
| `app/page.tsx` — redirects to latest issue; empty state | **Rewrite**: fetch latest issue via `QUERY_ISSUE_BY_SLUG` (slug from `QUERY_LATEST_ISSUE_SLUG`), render the same `IssueLayout`; `alternates.canonical = /issue/<slug>`; keep empty state (Jesse voice, "Check back Thursday."). WEB-01 ("routed to latest issue") is superseded — update its REQUIREMENTS note |
| `app/layout.tsx` — Fraunces/Newsreader/Plex fonts, `serializeThemeCss(null)`, `SiteHeader`, `<main id="main">`, `SiteFooter`, `viewport.themeColor '#FBFAF6'` | **Extend, don't replace**: add `Manrope` variable (`--font-dispatch`), keep other fonts/theme CSS for the not-yet-rebranded routes; swap header/footer through a pathname switch (below). `themeColor` can stay (tests `issue-page-dispatch` pin cream) until a sitewide rebrand |
| `app/issue/[slug]/layout.tsx` — per-issue theme fetch + `serializeThemeCss(theme)` + `<ThemeApplier>` | **Rewrite**: no theme query; emit `serializeAccentCss(accentForIssue(n))` (needs `issueNumber` → a minimal query `{issueNumber}`), wrapper `className="dispatch"`. Tests pinning the old behaviour (`issue-page-dispatch` "Plan 05") are rewritten |
| `components/issue/IssueLayout.tsx` | **Keep file & export** (shared with `app/issue/[slug]/preview/page.tsx`, D-09 fidelity); replace internals with `components/dispatch/*` composition. Keep JSON-LD, reading time, briefing-stat derivation logic (move to derive lib) |
| IssueMasthead, IssueBriefing, MissionBand, SectionRail, ScrollProgressBar, StatCountUp, ThemeApplier, ShopBand/ShopCallout(unused?), DelibChat, DelibScoreboard, ConfidenceBar, DeliberationSlot | **Retire** (final wave, with tests) — see Retirement Inventory |
| EditorialSection, CaseStudySection, BonusSection, PodcastSlot, GameSlot, GameFallback, PortableTextRenderer, AnchorCopyButton, JsonLd | **Reuse logic, restyle**. GameSlot keeps validator + iframe + qaCorrections write verbatim; only the surrounding frame/headings change |
| `SiteHeader` (fixed, cream glass), `SiteFooter` | Keep for `/shop /archive /charities /about /legal`; hidden on `/` and `/issue/*` |

### Recommended structure
```
apps/web/
├── app/
│   ├── dispatch.css                 # .dispatch token layer + all mockup values (hex only here)
│   ├── api/email/subscribe/route.ts # NEW newsletter signup (node runtime)
│   └── (page.tsx, issue/[slug]/{layout,page}.tsx rewritten)
├── components/dispatch/             # NEW
│   ├── DispatchMasthead.tsx  Ticker.tsx  Hero.tsx  HowStrip.tsx  IssueNav.tsx (client, sticky + scroll-spy)
│   ├── NumberedSection.tsx          # colour-block wrapper: number disc, label, h2
│   ├── sections/{Origin,Problem,Founder,Case,Game,Bonus,Delib,Pod}.tsx  (or reuse existing w/ props)
│   ├── DelibCards.tsx  ShopBand.tsx  BalmCounter.tsx (client, useQuery)  FundButton.tsx (client)
│   ├── BackIssues.tsx (client search)  NewsletterForm.tsx (client)  DispatchFooter.tsx  ChromeSwitch.tsx
└── lib/
    ├── brand.ts                     # PALETTE, accentForIssue, inkFor, serializeAccentCss
    ├── dispatch/derive.ts           # pure: ticker lines, fact chips, key-figure parse, delib cards, balm math
    └── checkout-client.ts           # startCheckout(quantity) shared by BuyButton/FundButton
```

### Pattern 1: Fixed brand without touching `lib/theme.ts`
**What:** New `lib/brand.ts` holds `PALETTE = Object.freeze({ green:'#00FF79', blue:'#005CFF', red:'#FF002B', yellow:'#EEFE34' })`, `INK='#0A0A0A'`, `PAPER='#FFFFFF'`. CSS is emitted only from this frozen constant (no Sanity input reaches it), and a module-scope/unit-test assertion runs every value through `validateHex` from `lib/theme.ts`. `lib/theme.ts` (HEX_REGEX, FONT_WHITELIST 9 entries, BRAND_DEFAULTS oxblood, serializeThemeCss, applyTheme) is **not edited** — `issue-page-dispatch`, `archive-cardswap` ("FONT_WHITELIST unchanged"), `theme.test.ts` pin it, and the pipeline DesignAgent/WeasyPrint still use the same whitelist. After this phase `serializeThemeCss(theme)`/`applyTheme` have no public-page caller except the root default `serializeThemeCss(null)` (still used by non-rebranded routes) — acceptable dead-ish surface; do not delete.
**Weekly accent:** `ACCENT_ORDER = [green, blue, red, yellow]`; `accentForIssue(n) = ACCENT_ORDER[((n - 1) % 4 + 4) % 4]` (deterministic, adjacent issues never repeat, back-issue cards can recompute their own accent with no stored data). Issue 2 (the mockup) would be blue; if Andrew wants the mockup's green for the current issue use `(n + 3) % 4`-style offset — a one-line constant, flag to Andrew. Do **not** read `theme.accentColor` (DesignAgent output) — decision 1.
**Ink:** mockup's `ink()` uses a luminance threshold (<0.2 → white); use the repo's own `contrastRatio` and pick the higher-contrast of `#0A0A0A`/`#FFFFFF`. Computed (this session): green 14.69 vs black; blue 5.28 vs white (3.75 vs black); red 4.98 vs black (3.97 vs white — **white on red fails AA**); yellow 17.78 vs black. A unit test must assert `contrastRatio(inkFor(a), a) ≥ 4.5` for all four.
**Section colours are fixed, not accent-driven** in the mockup (01 white, 02 blue, 03 yellow, 04 white+red, 05 black, 06 red, 07 white, 08 green); only hero background, sticky CTA, buy CTA and sticker shapes use the accent. Encode the section palette as a constant map.

### Pattern 2: Chrome switch (single `<main>`, correct landmarks)
Root layout today renders `SiteHeader` + one `<main id="main">` + `SiteFooter`. Add a tiny client `ChromeSwitch` (uses `usePathname`; passes server-rendered `SiteHeader`/`SiteFooter` nodes as props/children) that renders nothing for `pathname === '/' || pathname.startsWith('/issue/')` and `<DispatchFooter/>` instead of `SiteFooter` there (footer must sit **outside** `<main>` to be a `contentinfo` landmark). The mockup's top bar + masthead + ticker are rendered inside the page (they carry per-issue dateline data), as a `<header>` within `<main>` — acceptable; axe-clean. Keep the skip link and `id="main"`. `/issue/[slug]/preview` is covered by the `/issue/` prefix.
Pre-existing nit to fix opportunistically: `preview/page.tsx` unauthorized/unavailable branches render their own `<main>` inside the root `<main>` (nested mains).

### Pattern 3: Pure derivation lib (testable, no React)
All Scope-B "derive" logic lives in `lib/dispatch/derive.ts`: `tickerLines(issue)`, `factChips(charity)`, `keyFigure(stat: string) → {figure, caption}` (regex split of the free-text `stat`, fall back to full sentence), `deliberationCards(issue)`, `balmsFromCents(cents, unit=899)`, `readTimeLabel(minutes)`, `backIssueCard(archiveIssue)`. Each returns `null`/`[]` when data absent so components omit blocks rather than show placeholders.

### Pattern 4: Reuse GameSlot logic verbatim
Keep `validateEmbedCode`, `injectGameHead`, `useMutation(api.qaCorrections.insert)` fire-and-forget, `sandbox="allow-scripts"`, and the `started` click-to-load gate. The mockup's game panel (fake Frame/Wheels buttons) is **illustrative only** — the real game is agent-generated HTML. Restyle: black band, 05 disc, `game.headline` h2, `game.description`, green "▶ Play" button (≥44px, `aria-label="Play {headline}"` retained — test `Plan 02`), iframe inside a `2px solid #00FF79` rounded frame. `__tests__/game-sandbox.test.ts` source-scans `components/issue/GameSlot.tsx`: keep that **path** (or update `GAME_SLOT_PATH` in the same commit) and never add `allow-same-origin`.

### Anti-Patterns to Avoid
- **Scroll-reveal gating of content** (`ScrollReveal` caused a recent opacity:0-forever bug on tall sections, fast 260723). The new design needs no reveal animation; do not reintroduce it.
- **Putting Andrew-authored fields inside pipeline-owned section objects** (`originStory`, `caseStudy`, …) — pipeline writes whole objects.
- **Using the global `:focus-visible { outline: var(--color-accent) }`** inside `.dispatch` — accent green/yellow on white is 1.35 / 1.11:1. Override with `#0A0A0A` outline (white on black bands).
- **Hard-coding `$8.99` strings in many places** — currently in `shop/page.tsx`, `ShopStickyBar.tsx`, `ShopQtyProvider.tsx` (`unitPriceCents = 899`, "TODO(Andrew) confirm price"). Introduce one `BALM_PRICE_CENTS = 899` in `lib/site.ts` and consume it in the new code + the count math.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG contrast / hex validation | New color math | `contrastRatio`, `validateHex` from `lib/theme.ts` | Already tested; invariant says no third-party lib |
| Portable Text rendering | Custom block renderer | `PortableTextRenderer` (restyle with CSS columns `column-width:340px`) | Handles h2/h3/blockquote/links safely |
| Stripe redirect flow | New checkout API | existing `POST /api/checkout/create-session` (validates qty 1–20, locks `charitySlug` in metadata at click) | Idempotent, tested (`checkout-create-session.test.ts`) |
| Failure UX for checkout | New error copy | `CHECKOUT_FAILURE_MESSAGE` exported by `BuyButton.tsx` | Voice-approved, tested |
| Reading time | New counter | `lib/reading-time.ts` `readingTime(...)` (already used by IssueLayout) | Existing |
| Live data subscription | Polling / SWR | `useQuery(api.…)` via mounted `ConvexClientProvider`; initial value via `ConvexHttpClient` in the server component to avoid a blank flash | Real-time, already wired |
| Search over back issues | GROQ `match` endpoint | client-side `Array.filter` over `QUERY_ARCHIVE` result | ≤ ~52 issues/yr; no server round-trip, trivially testable |
| Unsubscribe token | Own crypto | `generateUnsubscribeToken()` from `@eisenbalm/emails` (Node runtime) | Matches existing 64-hex contract |

**Key insight:** this phase is presentation over data that mostly exists; the genuinely new backend surface is four small additive items (editor confidence, `frontPage` object, public balms query, newsletter mutation). Resist adding agents or tables.

## Scope-B Content Classification

Legend: **(a)** derive from existing data · **(b)** new schema/pipeline field · **(c)** Andrew-authored in Studio. Proposed grouping: all (c)/(b-authored) items live in ONE new optional top-level `weeklyIssue.frontPage` object (additive; no renames).

| Item | Class | Source / rule | Fallback when absent |
|------|-------|---------------|----------------------|
| Ticker lines | **a** (+optional c override) | `This week: {charity.name}` · `charity.focusArea` · `charity.location` · `Founded {foundingYear}` · up to 3 `problemStatement.keyDataPoints[].stat` · constant `Every balm sold this week goes to them`-style Jesse-voice line. Optional `frontPage.tickerLines[]` replaces the derived data lines | Derived lines only; omit nulls. Ticker is `aria-hidden` decoration → the same facts must also appear in fact chips/body |
| Hero dek | **a** (+c override) | `charity.missionStatement` first ≤2 sentences (already used as tagline). `frontPage.dek` overrides | missionStatement → generic Jesse line |
| Fact chips (3) | **a** | "What they do"=`focusArea`, "Size"=`assetRange`, "Based in"/"Founded"=`location`/`foundingYear` (same fields IssueLayout already turns into `briefingStats`) | Omit chips whose field is null |
| Read time | **a** | existing `readingTime(...)` → "{n}-minute read" | — |
| Pull quotes (origin, case) | **c** (`frontPage.pullQuotes.origin/case`) | Andrew picks a line from the generated text. A heuristic extractor from Portable Text is possible but risks a banal/voice-wrong pull quote shipped unreviewed — not recommended | Omit the quote block |
| Problem stat tiles | **a** | `problemStatement.pdfContent.keyDataPoints[]` (exactly 3 `{stat, source}`; pipeline writes them — `agents/problem.py`). **GROQ projection must be added** (`"keyDataPoints": pdfContent.keyDataPoints[]{stat, source}`). Parse leading figure by regex; free-text stats that don't parse render as a sentence at body size (no 96px overflow) | Omit grid |
| Case-study timeline (4 steps) | **c** (`frontPage.caseTimeline[]{label,value}`, max 4) | Andrew-authored; pipeline CaseStudyWriter extension deferred | Omit strip |
| Ad "performance summary" | **c** (`frontPage.adSummary{title, rows[{label,value}]}`), only meaningful for `bonusType==='specAd'` | Andrew-authored | specAd: render existing ad body only; jingle/bigBudget: existing audio/storyboard markup in the red band |
| Live balms-sold count | **a** (new Convex query) | see Commerce | "—" hidden; never a placeholder like the mockup's `[LIVE COUNT]` |
| "≈ N–M balms covers one {unit}" + progress bar | **c** (`frontPage.impactUnit{label, costMinUsd, costMaxUsd}`) | `ceil(costMin/8.99)`–`ceil(costMax/8.99)`; progress = `balms / ceil(costMin/8.99)` capped 100% | Hide the sentence and bar; show count only |
| Hero photo | **c** (`frontPage.heroImage` + required `alt` when set) | `@sanity/image-url` + `next/image`, `sizes` set, explicit aspect box (CLS) | Geometric accent-shape composition (circle + sticker) — **not** the mockup's dog illustration, which is charity-specific placeholder art |
| Sticker "Your $8.99 → wheels" | **a** | Generic: "Your $8.99" / "100% to them" (the noun "wheels" is charity-specific) | — |
| Editor confidence | **b** (pipeline-written) | see Deliberation | Hide bar |
| Archive search | **a** | client filter | — |
| Email signup | **b** (backend) | see Email | — |
| "How the Dispatch works" strip, footer blurb, sticky/CTA labels | **Andrew/Jesse-authored constants** in `lib/dispatch/copy.ts` | Dry-voice rewrite; step 1 says **Thursday** | — |

Schema/contract implications: add `frontPage` to `apps/studio/schemas/weeklyIssue.ts`; run `pnpm --filter studio typegen` (regenerates `sanity.types.ts`/`schema.json`); extend `lib/sanity/types.ts`, **both** `QUERY_ISSUE_BY_SLUG` and `QUERY_ISSUE_PREVIEW_BY_SLUG` (they are intentionally identical — a test should assert parity); update `docs/API_CONTRACTS.md` §1.2 and §2.2. `narrator-chip.test.ts` (NRR-08d) pins that the narrator projection stays `name, slug, active` only — keep it.

## Deliberation data (picked / runner-up / also considered / confidence)

- **Sanity (canonical, already on the public page):** `selectionDeliberation.candidates[]{charity->{name,slug,location}, scoutSummary, advocateArgument, advocateScore}`, `editorDecision` (Editor reasoning, 200–400 words, Jesse voice), `runnerUpNotes` (50–150 words), `conversation[]` (to be dropped from the public projection and component props; keep the schema field). `IssueLayout` already sorts winner first then by `advocateScore` and flags `runnerUp = index 1`. Cards: **Picked** = featured charity (blurb = first sentence of `editorDecision`); **Runner-up** = candidate #2 (blurb = first sentence(s) of `runnerUpNotes`); **Also considered** = remaining candidates (blurb = first sentence of `scoutSummary`). Sentence-trim helper must be unit tested (abbreviations, no terminal period).
- **Editor confidence does not exist in Sanity.** It exists as `editor_confidence: Optional[float]` in `graph/state.py` (0.0–1.0; `None` on the human-override path; `0.9` hard-coded on the deterministic fallback path in `agents/editor.py` ~L503) and as `confidence` in the Convex `editor-decision` `deliberationEvents` payload (`_editor_decision_payload`). `convex/schema.ts` `confidence: v.string()` at L567 is an unrelated table. The current UI's 80% is a hard-coded default (`DeliberationSlot` `confidence ?? 80`).
  **Recommendation (b):** add `selectionDeliberation.editorConfidence` (number 0–1, optional) to the Sanity schema and write `state.get("editor_confidence")` in `sanity_client.write_issue_draft` (one line + Python test). Existing published issues have no value → **omit the bar** (never default). Optional backfill: one-off script reading the `editor-decision` event payload by `runId` — treat as optional, Andrew can type it in Studio. Do not subscribe to Convex from the public deliberation section (Phase 29 D-8 removed 5 subs deliberately; `motion-polish`/`machine-editorial` tests pin "zero subscriptions" — carry that contract to the new cards). SC-3 says "live Convex/Sanity data": Sanity-sourced cards satisfy it; the Convex-live piece is the balms count.
- Keep DEL-04: no model/provider names in the render path (`deliberation-no-model-names.test.ts`) — re-point the test at the new `DelibCards`. Persona labels stay "The Scout/Advocate/Editor". The mockup's explainer "panel of AIs — a scout, an advocate and an editor" must be re-voiced.
- Edge cases: 1–2 candidates only (no "also considered" card), missing scores, missing `runnerUpNotes`, `candidates[].charity` null (reference unresolved) — cards must tolerate each.

## Commerce: checkout CTAs and balms-sold count

- **Checkout:** `POST /api/checkout/create-session` creates the Stripe session, `quantity` 1–20, locks `charitySlug` of the *latest published issue* into metadata. `BuyButton` posts then `window.location.href = url`; it calls `useShopQty()` which **throws outside `<ShopQtyProvider>`** (only the /shop page provides it). For the front page: extract the fetch+redirect into `lib/checkout-client.ts` (`startCheckout(quantity=1)`), have `BuyButton` and a new dispatch-styled `FundButton` both use it (keeps `buy-button.test.tsx` green), render the failure message inline (no modal). Header/hero/sticky "Fund them" links are anchors to `#buy`; the `#buy` shop band holds the real `FundButton`. Add a small "more than one?" link to `/shop` (existing qty stepper). Success criterion 5 is then testable: every CTA is either the `FundButton` or an in-page anchor to it.
- **Price discrepancy to resolve (Open Question 1):** memory `commerce-email-live-state` records the Stripe test price as `$21` (`price_1TZDwNIA…`) while all UI copy and `unitPriceCents` say $8.99 (locked, approved wording). Confirm `STRIPE_PRICE_ID.unit_amount === 899` in the mode that ships, otherwise "Full $8.99" is false at checkout and the balms math is wrong.
- **Count source:** `stripeOrders` (Convex) has `charitySlug`, `createdAt`, `donationAmount` (== product subtotal, cents), `amountSubtotal`, `amountTotal`, indexes `by_charitySlug_createdAt`, `by_createdAt`; **no quantity**. `charityLedger.charityTotals` is an unauthenticated query returning every slug's totals (also flagged in the pre-deploy audit) — do not call it from the public site. Add a new public query, e.g. `stripeOrders.balmsForCharity({ charitySlug, sinceMs? }) → { orders, balms, donationCents }` using the `by_charitySlug_createdAt` index; `balms = Σ round((donationAmount ?? amountSubtotal ?? amountTotal) / 899)` (same fallback chain as `charityTotals`). Returns aggregates only — no emails/addresses. "This week" for the current issue = `createdAt ≥ publishDate`; for back issues show the lifetime total for that charity labelled "Balms sold". Optional hardening: persist `quantity` on new orders (webhook currently doesn't expand line items).
- **Must-know:** committing `convex/*.ts` is not deployment — run `pnpm --filter @eisenbalm/convex dev:once` (target `dev:modest-magpie-797`) and regenerate `_generated` (tracked in git; `@convex/_generated/api` import fails typecheck until updated). Test-mode rows (`smoke-*`, `live-test-*`, `email-test-*` slugs) are excluded by the slug filter, but any real-slug test orders in the shared deployment would inflate the live count (Open Question 2).
- Loading/empty: server component fetches the initial value (`ConvexHttpClient`, short revalidate) and passes it to `BalmCounter` which upgrades via `useQuery`; `0` renders "0", `undefined` (Convex URL unset) hides the tile.

## Email signup

- **Exists:** Resend wiring + `emailSubscribers` table (`email`, `consentState`, `source` — comments list `'post-purchase-flow' | 'newsletter-optin'`, `unsubscribeToken`), `upsertSubscriber` (**internal** mutation, idempotent, preserves a prior unsubscribe), one-click unsubscribe route (`/api/email/unsubscribe`), `generateUnsubscribeToken()`. All lifecycle sends are keyed on `orderId` (post-purchase steps 1–8).
- **Missing:** any public subscribe surface, any weekly broadcast sender, and a verified sending domain (memory: only the Resend account owner receives; from-address is `onboarding@resend.dev`; `EMAIL_POSTAL_ADDRESS` placeholder).
- **Recommendation:** (1) new public Convex mutation `emailSubscribers.subscribeNewsletter({ email, unsubscribeToken, webhookSecret })` guarded by `requireWebhookSecret` (the Stripe-webhook lane; same `STRIPE_TO_CONVEX_SECRET`) that calls `internal.emailSubscribers.upsertSubscriber` with `source:'newsletter-optin'`; (2) `app/api/email/subscribe/route.ts` (node runtime) validates email (length + simple regex), honeypot field, generic success response regardless of prior state (no enumeration), generates the token, calls Convex; (3) `NewsletterForm` client component (real `<form>`, `<label>`, inline dry status text, `aria-live="polite"`). No confirmation email and no broadcast in this phase: "working" = consent recorded, honestly worded ("Thursdays. No other mail." only if/when sending exists — until then do not promise). Flag to Andrew: delivery needs domain verification + a broadcast job (separate phase). Consider a double-opt-in note for EU subscribers (shipping list includes EU) — decision for Andrew.

## Archive / back issues
`QUERY_ARCHIVE` already returns `issueNumber, publishDate, slug, bonusType, charity{name,slug,location,focusArea,assetRange}`. Card subtitle (mockup: one-line cause) = `focusArea`; if the charity `missionStatement` one-liner is wanted, add it to the projection (additive). Card colour = `accentForIssue(issueNumber)` + `inkFor`. Home grid shows the latest N (e.g. 8) excluding the current issue; "See them all →" links `/archive` (which keeps `CardSwap`/`ArchiveList`, unchanged in this phase — their tests pin them). Search = controlled input + `useMemo` filter over name, focusArea, location, `No. {issueNumber}`; case-insensitive, trims; empty-result message in voice; the input needs a visible `<label>` (mockup has one) and `type="search"`; results announced via `aria-live`. A pure `filterIssues(issues, query)` in `derive.ts` makes this fully unit-testable.

## Responsive & a11y risks (375px — 311px content width after 32px padding)

| Risk | Where (mockup) | Mitigation |
|------|-----------------|-----------|
| Fixed 380×380 hero art block, 360px circle, 150px sticker | Hero right column | Replace with `width:min(100%,380px); aspect-ratio:1`; scale children in `%`/`cqw`; sticker `width:clamp(110px,38%,150px)` |
| Giant `clamp(40–92px)` headlines with long unbroken words (real charity names/headlines are AI-generated, e.g. "Mobilization") | hero h2, section h2s, buy h2 | Lower the clamp minimum (~30–34px), add `overflow-wrap:anywhere; hyphens:auto`, test with a 30-char word fixture |
| `clamp(56px…)` stat figures with long strings ("$1.2 billion") | 02 problem tiles | `keyFigure()` caps figure length (~8 chars) else render as sentence |
| Sticky nav: charity label (`flex:0 0 auto`) + scroller + CTA (`flex:0 0 auto`) leaves ~0px for links | In-issue nav | Hide the charity label < 640px; keep the horizontal scroller `overflow-x:auto` (it is a *contained* scroll, not page overflow) and make CTA compact; verify `scrollWidth <= innerWidth` on `document.documentElement` |
| Touch targets < 44px: top-bar links `padding:12px 0` @14px ≈ 41px; "Fund them" pill in sticky nav `9px 18px` ≈ 35px; footer Privacy/Terms 13px unpadded; search "See them all" 15px | multiple | Set `min-height:44px` (+ inline-flex centering) on every link/button class in `dispatch.css`; test via source-scan for the shared `.d-tap` class or computed CSS in jsdom is unreliable — use a manual checklist + class-presence test |
| Header padding 32px at 375 | all `max-width:1280; padding:…32px` | `padding-inline: clamp(16px,5vw,32px)` |
| 3-up flex rows (`flex:1 1 260px/300px/220px/320px`) | how-strip, delib cards, case timeline, shop | Fine (wrap) but verify no `min-width` > 311; inputs `width:240px` → `width:100%; max-width:240px` |
| Multi-column prose `column-width:340px; column-rule` | sections 01,02,04 | At 311px resolves to 1 column; ensure `column-rule` doesn't render in single-column case (it doesn't) |
| Ticker | `aria-hidden`, 45s CSS loop; reduced-motion sets `animation:none` which **clips** the rest of the text (overflow hidden) | Under reduced motion switch to a wrapped/static first set (`white-space:normal; height:auto; flex-wrap:wrap`), or `overflow-x:auto`. Duplicate set must be `aria-hidden` and only the first set read — currently the whole ticker is `aria-hidden`, so ensure facts exist elsewhere |
| Contrast: grey `#4A4A4A` secondary text is 8.86:1 on white but **2.23:1 on red `#FF002B`**; blue `#005CFF` as text on black is 3.75:1; green on blue 3.92:1 (large-only); white on red 3.97:1 | cards, sections, bands | Rules for `dispatch.css`: secondary-grey only on white/yellow(7.96); on coloured fields use full ink; coloured big numerals ≥ 24px bold only (green-on-blue acceptable as large text); never white-on-red body text |
| Focus visibility | global accent ring | `.dispatch :focus-visible { outline:3px solid #0A0A0A; outline-offset:2px }`, white ring inside black/blue bands |
| Colour-only meaning | sticky nav dots, delib cards | Dots are decorative `aria-hidden` next to text labels (ok); "Picked/Runner-up/Also considered" are text labels (ok) |
| Landmarks/headings | one `<h1>` (masthead "The Eisenbalm Dispatch" in mockup) but the hero charity `h2` is the real page subject | Make the masthead wordmark a `<p>`/`div` role-less and the **hero charity headline the `<h1>`** on issue pages (SEO + SR); sections `h2`; cards `h3` |
| `reduced-motion` | sticker rotation is static; smooth-scroll on anchors | Wrap `scroll-behavior:smooth` in `@media (prefers-reduced-motion:no-preference)`; scroll-spy must not animate |
| Anchor targets under sticky nav | `#origin` etc. | `scroll-margin-top: 64px` on sections |

## Retirement inventory (Phase 19 artifacts — treat as a deliverable)

Components to delete after the new tree is live (grep-verify zero importers first): `IssueMasthead`, `IssueBriefing`, `MissionBand`, `SectionRail`, `ScrollProgressBar`, `StatCountUp`, `ThemeApplier`, `DelibChat`, `DelibScoreboard`, `ConfidenceBar`, `DeliberationSlot`, `ShopBand`/`ShopCallout` (components/issue copies; `components/marketing/ShopCallout` is a separate file — check `shop-callout` tests), `IssueHero` (already unused except `loading.tsx` skeleton import; **its narrator chip is not rendered anywhere today** — `narrator-chip.test.ts` scans IssueHero source; decide whether the chip is re-homed into the hero eyebrow (recommended, keep NRR-08 rules) or the requirement is retired). `globals.css` (1478 lines) retains Phase 19 classes used by other routes — do not bulk-delete; remove only classes whose sole consumers are retired components, guarded by tests.

Source-scan tests pinned to retired artifacts (all pass today; each must be rewritten or deleted *in the same plan that removes its target*): `issue-page-typography.test.ts` (fonts, drop cap on `IssueLayout`, `.ornament-divider`, `.metadata-block`, IssueHero `.eyebrow`, ShopCallout lock, issue page `data-shop-callout`; it has an uncommitted working-tree edit already), `issue-page-dispatch.test.ts` (Fraunces/Newsreader/Plex imports, cream themeColor, BRAND_DEFAULTS oxblood, Plan 05 "layout calls serializeThemeCss(theme)", DelibChat role=log, SectionRail), `theme-aa-tones.test.ts` (cream/oxblood/dark-band AA + globals.css tripwires), `motion-polish.test.ts` & `machine-editorial-components.test.ts` (ConfidenceBar/DelibChat/SectionNavigator), `deliberation-conversation|agent-cards|advocate-scores|qa-severity|no-model-names|subscriptions.test.ts`, `issue-hero-motion.test.ts`, `narrator-chip.test.ts` (IssueHero), `issue-page-shop-callout.test.ts`, `loading-skeletons.test.ts` (issue loading.tsx), `podcast-slot.test.ts`, `bonus-section-image.test.ts`. **Keep untouched:** `game-sandbox`, `game-validator`, `theme.test.ts` (lib), `archive-*` (archive page unchanged), `site-header-nav` (SiteHeader stays), all `stripe-*`/`email-*`/`checkout-*`/`buy-button`, `legal-pages`, `shop-page`, `about-page`.

Runtime state / data inventory (retirement side): Stored data — existing Sanity issues keep `theme{}` and `selectionDeliberation.conversation[]` (unused by the public site, harmless; do not migrate/delete); no Sanity data renames. Live service config — Sanity Studio must be redeployed to show the new `frontPage`/`editorConfidence` fields; Convex dev deployment must receive the new functions. OS-registered/secrets — none new (`STRIPE_TO_CONVEX_SECRET` already exists in Vercel and Convex env). Build artifacts — regenerate Studio typegen output and Convex `_generated`.

## Common Pitfalls

### Pitfall 1: Homepage redirect left in place
**What goes wrong:** `/` keeps `redirect()`ing; "home matches the mockup" is never true; back-issues grid/footer sign-up are unreachable from home.
**How to avoid:** Home renders the shared layout; add `alternates.canonical` to `/issue/<slug>`; keep `export const revalidate = 60`; add a source-scan test that `app/page.tsx` no longer imports `redirect`. Update sitemap/RSS expectations only if they referenced `/` redirect (they don't).

### Pitfall 2: Fake confidence survives the rebuild
**What goes wrong:** The cards reuse `confidence ?? 80`; the page shows an invented 80% bar. **Avoid:** bar renders only when `editorConfidence` is a finite 0–1 number; test asserts no literal `80` default.

### Pitfall 3: Accent/ink contrast regressions on rotation
**What goes wrong:** Mockup's luminance-threshold `ink()` is correct for these 4 colours today but is not the repo's AA gate; adding or reordering palette colours silently breaks AA. **Avoid:** `inkFor` via `contrastRatio` + a unit test over the palette.

### Pitfall 4: Pipeline re-run wipes Andrew's `frontPage`
`write_issue_draft` posts `createOrReplace` for `issue-{n}`; any pipeline re-run for that issue number replaces the doc, dropping Andrew's `frontPage` edits (and any Studio edits generally — pre-existing behaviour). **Avoid/mitigate:** keep authored data in the top-level `frontPage` object; optionally make `write_issue_draft` fetch-and-carry `frontPage` (small Python change + test) — flag to the planner as a decision; at minimum document it in `apps/studio/EDITOR_GUIDE.md`.

### Pitfall 5: Convex function not deployed → prod 500 / empty count
Phase 39 shipped exactly this. **Avoid:** wave includes `dev:once` sync + `_generated` commit as an explicit task and a verification step (`npx convex run stripeOrders:balmsForCharity '{"charitySlug":"…"}'`).

### Pitfall 6: Tests that pass while build fails
vitest does not type-check. `pnpm --filter web typecheck` (tsc, ~6 s, green today) is the fast gate; `pnpm --filter web build` also runs `generateStaticParams` against live Sanity — in this session it **failed at static generation with `UND_ERR_SOCKET` (network) after "Compiled successfully" and type-check passed**, i.e. a flaky/sandboxed-network failure, not a code failure. Run the strict build on a networked machine / CI; do not let the flake mask real errors (check that failure occurs *after* "Checking validity of types").

### Pitfall 7: Preview route drift
`/issue/[slug]/preview` (dispatch-control iframe) reuses `IssueLayout` and has its own `frame-ancestors` CSP; it needs the same accent wrapper. Since the accent comes from `issue.issueNumber`, compute it inside `IssueLayout` (wrapper div carrying inline CSS vars from `serializeAccentCss`) rather than only in `app/issue/[slug]/layout.tsx`, so preview and published cannot diverge. Home also needs it, and `/` has no issue layout.

### Pitfall 8: Voice leakage via the mockup
Mockup strings ("Monday", "panel of AIs", "Cats. Also on wheels.", "[LIVE COUNT]", "Release 001 · hand-numbered", "Illustration · a real photo … goes here", "Audio coming soon" is OK-ish but check POD-03 copy "Audio coming soon.") must not ship. Add a denylist test over `components/dispatch/**` and `lib/dispatch/copy.ts`.

### Pitfall 9: Urgency mechanics
CLAUDE.md forbids urgency. A "progress toward the next cart" bar and live count are informational; no countdowns, "only N left", or pulsing counters.

## Code Examples

### Brand module (security-preserving)
```typescript
// lib/brand.ts — values come ONLY from this frozen constant; nothing from Sanity.
import { contrastRatio, validateHex, WCAG_AA_THRESHOLD } from '@/lib/theme'

export const PALETTE = Object.freeze({
  green: '#00FF79', blue: '#005CFF', red: '#FF002B', yellow: '#EEFE34',
} as const)
export const INK = '#0A0A0A'
export const PAPER = '#FFFFFF'
export const ACCENT_ORDER = [PALETTE.green, PALETTE.blue, PALETTE.red, PALETTE.yellow] as const

export function accentForIssue(issueNumber: number): string {
  const n = Number.isFinite(issueNumber) ? Math.trunc(issueNumber) : 1
  return ACCENT_ORDER[(((n - 1) % 4) + 4) % 4]
}
export function inkFor(bg: string): string {
  return contrastRatio(INK, bg) >= contrastRatio(PAPER, bg) ? INK : PAPER
}
export function serializeAccentCss(accent: string): string {
  const a = validateHex(accent) ?? PALETTE.green
  const second = ACCENT_ORDER[(ACCENT_ORDER.indexOf(a as never) + 1) % 4]
  return `.dispatch{--d-accent:${a};--d-accent-ink:${inkFor(a)};--d-second:${second};}`
}
// unit test: every PALETTE value passes validateHex; contrastRatio(inkFor(c), c) >= WCAG_AA_THRESHOLD.
```

### Manrope (Source: installed `next/font/google` font-data; Next 15 App Router)
```typescript
import { Manrope } from 'next/font/google'
const fontDispatch = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-dispatch' })
// <html className={`${fontDisplay.variable} … ${fontDispatch.variable}`}>
// .dispatch { font-family: var(--font-dispatch), system-ui, sans-serif; }
```
Existing tests forbid a Google Fonts `<link>` (`issue-page-typography`) — the mockup's `<link href=fonts.googleapis…>` must NOT be copied.

### Shared checkout client
```typescript
// lib/checkout-client.ts
export async function startCheckout(quantity = 1): Promise<{ ok: true } | { ok: false }> {
  try {
    const res = await fetch('/api/checkout/create-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    })
    const body = (await res.json()) as { url?: string }
    if (body.url) { window.location.href = body.url; return { ok: true } }
  } catch { /* fall through */ }
  return { ok: false }
}
```

### Convex public aggregate (pattern from `charityLedger.ts`)
```typescript
// convex/stripeOrders.ts (add; keep existing `insert` untouched)
export const balmsForCharity = query({
  args: { charitySlug: v.string(), sinceMs: v.optional(v.number()) },
  handler: async (ctx, { charitySlug, sinceMs }) => {
    const rows = await ctx.db.query('stripeOrders')
      .withIndex('by_charitySlug_createdAt', q => sinceMs === undefined
        ? q.eq('charitySlug', charitySlug)
        : q.eq('charitySlug', charitySlug).gte('createdAt', sinceMs)).collect()
    let balms = 0, cents = 0
    for (const r of rows) { const c = r.donationAmount ?? r.amountSubtotal ?? r.amountTotal ?? 0; cents += c; balms += Math.round(c / 899) }
    return { orders: rows.length, balms, donationCents: cents }
  },
})
```

## State of the Art

| Old (Phase 19) | Current (Phase 55) | Impact |
|---|---|---|
| Per-issue Sanity theme → CSS vars (WEB-06..09) | Fixed palette + deterministic weekly accent | WEB-06 behaviour superseded; WEB-07/08/09 invariants remain in `lib/theme.ts` (still tested) |
| `/` redirects to latest issue (WEB-01) | `/` renders the front page | Update requirement text/traceability |
| DelibChat transcript + fake 80% | Summary cards + real confidence | New pipeline→Sanity field |
| Fraunces/Newsreader/Plex | Manrope (public pages only) | Other routes keep old fonts until a sitewide rebrand |

**Deprecated/outdated:** `ThemeApplier`, drop-cap/ornament typography utilities (for public issue page), SectionRail scroll-spy (replaced by sticky nav).

## Open Questions

1. **Stripe price vs $8.99** — memory says the test price object is $21. What we know: UI and `unitPriceCents` are 899; wording approved. Unclear: actual `unit_amount` of `STRIPE_PRICE_ID` in the shipping mode. Recommendation: Wave 0 task to read the price via Stripe API/dashboard and add a startup/CI assertion; blocks SC-5 honesty.
2. **Test orders in the live count** — one Convex deployment (`dev:modest-magpie-797`) serves dev and the Vercel site. Real-slug test orders would inflate the count. Recommendation: purge per the productionization checklist, or add `livemode` to `stripeOrders` (schema addition) and filter.
3. **Chrome for non-rebranded routes** — `/shop`, `/archive`, `/charities`, `/about`, `/legal` stay oxblood/cream; the "Fund them" journey ends on Stripe (hosted) so /shop is not in the main path, but header "Past nonprofits" → `/archive` lands on the old brand. Recommendation: accept for this phase and queue a follow-up "sitewide rebrand"; Andrew should confirm.
4. **Weekly accent offset** — `(n-1)%4` makes issue 2 blue; the mockup shows green for issue 2. Andrew to confirm order/offset (one constant).
5. **Pipeline carry-forward of `frontPage`** (Pitfall 4) — include the small Python change or document the limitation?
6. **Newsletter promise & delivery** — wording on cadence (Thursday) and double opt-in for EU; broadcast sender + verified Resend domain are out of this phase.
7. **Narrator chip (NRR-08)** — currently not rendered by `IssueLayout`; re-home in the hero eyebrow or retire the requirement.
8. **Who authors `frontPage` for the live issue** — SC-2 ("All copy on a live issue reads in Jesse's voice") needs Andrew to fill pull quotes/timeline/ad summary/photo/impact unit for the issue used in the read-through, or the verifier must accept graceful omission.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | 24.13.0 | — |
| pnpm | workspace | ✓ | 9.15.4 | — |
| vitest suite (web) | validation | ✓ | 47 files/443 pass, ~6 s | — |
| `tsc --noEmit` (web) | type gate | ✓ | clean, ~6 s | — |
| `next build` (strict) | SC-6 | ⚠ partial | Compiles + type-checks; **fails in `generateStaticParams`/prerender with `UND_ERR_SOCKET` to Sanity from this environment** | Run on networked machine/CI; typecheck as local gate |
| Sanity project access (read) | build prerender, dev | ⚠ flaky from sandbox | — | — |
| Convex dev deployment sync | new query/mutation | not exercised | — | `pnpm --filter @eisenbalm/convex dev:once` needs Convex auth; human step if absent |
| Sanity Studio deploy / `typegen` | new schema fields | not exercised | — | `pnpm --filter studio typegen`; Studio deploy is a human step |
| Playwright / axe / Lighthouse | 375px & a11y automation | ✗ not installed in repo | — | Manual checkpoint (Chrome DevTools 375px + axe extension); optionally `pnpm dlx playwright` ad hoc, not a project dependency |
| `convex-test` | testing Convex fns | ✗ in `apps/web`/`convex` (only `apps/dispatch-control`) | ^0.0.53 elsewhere | Keep Convex query logic thin; unit-test the pure `balmsFromCents` and verify live via `convex run` |

**Missing with no fallback:** none blocking research; Stripe price verification and Sanity/Convex human deploy steps are checkpoints.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.2 (node env; `*.test.tsx` → jsdom via `environmentMatchGlobs`), @testing-library/react |
| Config file | `apps/web/vitest.config.ts` (`include: __tests__/**/*.test.ts(x)`) |
| Quick run command | `pnpm --filter web test -- <file>` (≈1–6 s) |
| Full suite command | `pnpm --filter web test` (baseline 443 pass / 13 todo) |
| Type gate | `pnpm --filter web typecheck` (≈6 s) |
| Phase gate | `pnpm --filter web build` on a networked machine (strict) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | Manrope loaded via next/font (no `<link>`); `dispatch.css` holds palette; `lib/theme.ts` exports unchanged (FONT_WHITELIST 9, HEX_REGEX) | source-scan | `pnpm --filter web test -- brand-tokens` | ❌ Wave 0 (`__tests__/brand-tokens.test.ts`); keep `issue-page-dispatch` theme assertions or move them |
| PUB-02 | `accentForIssue` cycles, never repeats adjacent; `inkFor` ≥ 4.5:1 for all 4; palette passes `validateHex` | unit | `… -- brand-accent` | ❌ Wave 0 |
| PUB-03 | `/` page has no `redirect`, renders layout, canonical → issue | source-scan | `… -- home-page` | ❌ |
| PUB-04/05 | Section ids `origin problem founder case game bonus delib pod` present exactly once, in order; single `<main>` in root only; nav anchors resolve | source-scan + jsdom render of `IssueLayout` with fixture | `… -- issue-front-page` | ❌ |
| PUB-06 | `deliberationCards()` picks winner/runner-up/rest, tolerant of 1–2 candidates; confidence bar absent when undefined; no model names; no `conversation`/DelibChat on public page; zero Convex subs | unit + source-scan | `… -- delib-cards` | ❌ (replaces 6 deliberation tests) |
| PUB-07 | GameSlot keeps `sandbox="allow-scripts"` only, validator import, aria-label Play | source-scan | `… -- game-sandbox` | ✅ existing (must stay green) |
| PUB-08 | `FundButton` posts quantity 1, redirects on `{url}`, shows `CHECKOUT_FAILURE_MESSAGE` on failure; all `Fund them` links target `#buy` or are FundButton | jsdom component + source-scan | `… -- fund-button` | ❌ (model on `buy-button.test.tsx` ✅) |
| PUB-09 | `balmsFromCents` rounding/legacy fallback; BalmCounter hides on undefined, shows 0; GROQ/Convex arg shape | unit + jsdom | `… -- balm-count` | ❌; live check via `npx convex run stripeOrders:balmsForCharity` (manual) |
| PUB-10 | Subscribe route: bad email 400, honeypot ignored, success generic, Convex called with secret + source `newsletter-optin`; form a11y (label, status live region) | route unit (mock ConvexHttpClient, like `email-unsubscribe-route.test.ts` ✅) + jsdom | `… -- newsletter` | ❌ |
| PUB-11 | `derive.ts`: tickerLines, factChips, keyFigure (parse + fallback), readTime, absent-data → omitted; GROQ projections (published & preview) contain new fields and stay identical | unit + source-scan | `… -- dispatch-derive` / `… -- groq-parity` | ❌ |
| PUB-12 | `filterIssues` by name/cause/number, case/whitespace; empty state | unit + jsdom | `… -- back-issues-search` | ❌ |
| PUB-13 | No fixed-px widths ≥ 312 in `dispatch.css` outside `min()/clamp()/max-width` (regex tripwire); overflow-wrap rules present; padding clamp present | source-scan | `… -- dispatch-css-responsive` | ❌; **plus manual 375px + desktop read-through (human checkpoint)** |
| PUB-14 | `.d-tap` min-height 44px rule exists and is applied to links/buttons; reduced-motion block neutralises ticker + smooth scroll; focus-visible override; ink/colour pairs AA via `contrastRatio` over a declared pairs table | source-scan + unit | `… -- dispatch-a11y`; **plus manual axe + keyboard pass** | ❌ |
| PUB-15 | Retired files absent; no importers; rewritten tests reference new tree | source-scan | `… -- phase19-retired` | ❌ (+ `grep -rn` orphan check in verification) |
| PUB-16 | Denylist (`Monday`, `[LIVE COUNT]`, `Release 001`, `a real photo`, `Cats. Also`) absent from dispatch sources; exclamation-mark ban in copy constants; "Thursday" present | source-scan | `… -- dispatch-voice` | ❌ |
| (contract) Pipeline writes `editorConfidence` | `write_issue_draft` includes it; None → omitted | pytest | `pnpm --filter pipeline …` / `cd packages/pipeline && pytest tests -k sanity_client` (confirm exact invocation) | ❌ |

### Sampling Rate
- **Per task commit:** targeted `pnpm --filter web test -- <new-file>` + `pnpm --filter web typecheck`
- **Per wave merge:** `pnpm --filter web test` (full) + typecheck
- **Phase gate:** full suite green, strict `pnpm --filter web build` on a networked machine, manual 375px/desktop read-through of one live issue (human), Convex + Studio deployed and verified, then `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/brand-accent.test.ts`, `brand-tokens.test.ts` — PUB-01/02
- [ ] `__tests__/dispatch-derive.test.ts` + fixtures (`__tests__/fixtures/issue.ts`: full issue, sparse issue, long-word issue, 1-candidate issue) — PUB-06/11/12
- [ ] `__tests__/groq-parity.test.ts` — published vs preview projections
- [ ] `__tests__/fund-button.test.tsx`, `newsletter-form.test.tsx`, `newsletter-route.test.ts`
- [ ] Decide handling of the ~15 Phase 19 source-scan tests (rewrite vs delete) — scheduled in final wave, listed above
- [ ] Framework install: none needed

## Suggested plan / wave decomposition

| Wave | Plan | Scope | Notes |
|------|------|-------|-------|
| 0 | **55-01 Foundation** | `lib/brand.ts`, Manrope in root layout, `app/dispatch.css` tokens/utilities (`.d-tap`, focus, reduced-motion, section palette), `ChromeSwitch` + `DispatchFooter`, derive-lib skeleton + test fixtures, Stripe price check task | Sequential; everything depends on it |
| 1 (parallel, disjoint files) | **55-02 Data contract** | Studio `frontPage` + `editorConfidence`, GROQ (published+preview) + types, API_CONTRACTS §1.2/§2.2, pipeline `write_issue_draft` + test, typegen, Studio EDITOR_GUIDE note | Human: deploy Studio schema |
| 1 | **55-03 Commerce** | Convex `balmsForCharity`, `dev:once` sync, `checkout-client`, `FundButton`, `BalmCounter`, `BALM_PRICE_CENTS` | Human: Convex sync / `convex run` check |
| 1 | **55-04 Newsletter** | Convex mutation (secret lane), `/api/email/subscribe`, `NewsletterForm` | Human: env check of `STRIPE_TO_CONVEX_SECRET` |
| 2 (parallel) | **55-05 Shell** | Masthead, Ticker, Hero (photo/fallback, sticker), HowStrip, IssueNav (sticky, scroll-spy, mobile), ShopBand, BackIssues + search, copy constants | Presentational; uses fixtures until data lands |
| 2 | **55-06 Sections** | NumberedSection + 8 sections (restyled Editorial/Case/Game/Bonus/Pod), DelibCards, problem stat tiles, pull quotes, timeline, ad summary | GameSlot security tests stay green |
| 3 | **55-07 Integration + retirement** | Compose in `IssueLayout`; rewrite `app/page.tsx`, `issue/[slug]/layout.tsx`, preview route accent; JSON-LD/metadata; loading skeleton; delete Phase 19 components + rewrite/delete pinned tests; orphan grep | Single owner of `IssueLayout.tsx` to avoid wave-2 conflicts |
| 4 | **55-08 Verification** | Full suite + typecheck + strict build; 375px & desktop read-through (human); axe/keyboard; live-issue content authoring checkpoint with Andrew; verify balms count against a test purchase | `autonomous: false` checkpoint plan |

## Sources

### Primary (HIGH confidence — direct repo reads, this session)
- `.planning/phases/55-public-site-redesign/MOCKUP-Main.dc.html`, `MOCKUP-README.md`; memory `front-page-redesign-andrew-mockup.md`, `commerce-email-live-state.md`
- `apps/web`: `app/layout.tsx`, `app/page.tsx`, `app/issue/[slug]/{layout,page}.tsx`, `preview/page.tsx`, `components/issue/*` (IssueLayout, DeliberationSlot, GameSlot, BonusSection, ShopBand, SectionRail, ScrollReveal, ConfidenceBar…), `components/marketing/{BuyButton,ShopQtyProvider}.tsx`, `lib/theme.ts`, `lib/game-validator.ts`, `lib/sanity/{queries,types}.ts`, `lib/stripe/*`, `app/api/checkout/create-session/route.ts`, `app/api/email/unsubscribe/route.ts`, `next.config.ts`, `vitest.config.ts`, `app/globals.css`, `__tests__/*`
- `convex/{schema,stripeOrders,charityLedger,emailSubscribers,pitchLog,…}.ts`, `convex/lib/auth.ts`
- `apps/studio/schemas/weeklyIssue.ts`; `packages/pipeline/.../agents/editor.py`, `graph/state.py`, `lib/sanity_client.py`
- Installed `next/dist/compiled/@next/font/dist/google/font-data.json` (Manrope axes/weights) ; `npm view` for versions
- Executed: `pnpm --filter web test` (443 pass), `typecheck` (clean), `build` (compiles/type-checks; network failure at prerender); node WCAG contrast computation for palette pairs

### Secondary / Tertiary
- None used. No external web sources were needed; no LOW-confidence claims rely on training data alone except the general HTML landmark rule (`footer` is `contentinfo` only outside `main/article/section`) — MEDIUM, standard HTML-AAM behaviour.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and checked; Manrope verified in installed Next.
- Architecture: HIGH for current-state findings and retirement list; MEDIUM for chrome-switch and `frontPage` design (judgement calls).
- Pitfalls: HIGH (most reproduced or read from code: fake 80%, `useShopQty` throw, `createOrReplace`, price mismatch, build flake).
- Content sourcing classification: MEDIUM — needs Andrew's confirmation (Open Questions 4, 5, 8).

**Research date:** 2026-10-16
**Valid until:** ~2026-11-15 (repo-internal; invalidated sooner by changes to `IssueLayout`, `convex/stripeOrders.ts`, or Phase 53/54 work touching apps/web)
