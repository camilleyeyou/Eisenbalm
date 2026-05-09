# Feature Research

**Domain:** Weekly AI-generated editorial magazine + AI pipeline observability + one-product cause ecommerce
**Researched:** 2026-05-09
**Confidence:** HIGH (editorial/ecommerce), MEDIUM (AI observability — novel surface)

---

## Surface 1: Editorial Magazine

The reading experience. Eight sections per issue, per-issue theming, archive, charity database.

### Table Stakes (Surface 1)

Features readers assume exist. Missing these = product feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mobile-first responsive layout | 60%+ of reading is on mobile in 2026; non-responsive = immediate bounce | LOW | Grid stays constant per brief; CSS variables handle theming |
| Sub-3-second page load | Conversion/engagement drops sharply above 3s; ISR on Vercel handles this | LOW | Next.js ISR post-publish, Sanity CDN reads |
| Per-page `<title>`, `<meta description>`, Open Graph tags | Every share to social/messaging produces a blank card without og:title, og:description, og:image | LOW | Per-issue: charity name, section summary, a theme-matched image |
| `schema.org/Article` JSON-LD on issue pages | Google AI Mode (Gemini-powered) uses schema to verify claims and cite sources; omitting it removes eligibility for structured discovery | MEDIUM | `@type: Article`, `author` (Jesse), `datePublished`, `about` (charity entity) |
| `schema.org/NGO` or `schema.org/Organization` JSON-LD on charity pages | Charity pages should be discoverable as entities; omitting hurts organic discovery of the charity database | LOW | `@type: NGO`, `name`, `url`, `foundingDate`, `description` |
| XML sitemap at `/sitemap.xml` | Search crawlers require it; without it, archive pages may not be indexed | LOW | Next.js App Router has built-in sitemap generation via `sitemap.ts` |
| `robots.txt` | Without it, crawlers make assumptions; some may over-crawl or under-crawl | LOW | Allow all issue and charity pages; disallow `/api/`, Convex endpoints |
| Canonical URLs | Duplicate content penalty risk if `/` and `/issue/latest` both render the same issue | LOW | Canonical on `/` points to `/issue/[slug]` |
| Accessible markup: ARIA landmarks, alt text, heading hierarchy | Screen readers require it; legal exposure in some jurisdictions; WCAG 2.2 AA is now expected baseline | MEDIUM | Headings must follow per-section hierarchy, not be decorative |
| Keyboard navigation | Tab-accessible nav, game iframe focus management, audio player keyboard controls | MEDIUM | The sandboxed game iframe is the hard case |
| Per-issue section anchor links | Readers sharing a specific section (e.g., "The Problem") expect a shareable URL | LOW | `#origin-story`, `#problem`, `#founder`, etc. |
| Working audio player | Podcast section with play/pause, scrubber, volume — standard HTML5 `<audio>` expectations | LOW | `<audio>` element with controls; collapsible transcript below |
| PDF download button | Brief specifies downloadable Problem Statement PDF | LOW | Already in brief; link to Sanity `problemPdf` asset URL |
| Readable typography at all sizes | Long-form text requires comfortable line-height, measure, and contrast; the per-issue font switching makes this a real risk | MEDIUM | CSS variables inject fonts; must validate contrast ratio for each theme |

### Differentiators (Surface 1)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-issue color + typography theming | Each issue feels like its own publication; reinforces that every charity got a bespoke editorial treatment — not a template run | MEDIUM | Already specced: CSS variables on `<html>`. Risk: DesignAgent picks illegible combos. Needs hex-contrast validation in Publisher. |
| Sandboxed interactive game per issue | No other charity editorial product has a playable game that gamifies the specific charity's mission | HIGH | Already specced: `<iframe srcdoc sandbox="allow-scripts">`. Self-contained constraint is the key discipline. |
| Rotating bonus section (ad treatment / jingle / spec campaign) | Adds editorial surprise; "what is the bonus this week" becomes a reader hook | MEDIUM | Calibrator prevents two-week repeats. Brief covers all three formats. |
| Deliberation layer embedded in the reading experience | Readers see the AI editorial board argue about which charity deserved the cover — inside the magazine, not on a separate "how it works" page | HIGH | Core differentiator; own surface (see Surface 2). |
| Charity database as a long-term product | Over 52+ issues, the `/charities` database becomes a curated index of overlooked nonprofits — a distinct value artifact | LOW | GROQ query already written; needs good search/filter at scale |
| Per-issue estimated reading time | Readers with 20 minutes before a meeting decide whether to start; showing "~18 min read" respects their time | LOW | Brief under-specifies this. Calculate from section word counts at render time. |
| Print stylesheet | Some readers print long-form essays; a print-clean layout of the Problem Statement in particular would mirror the PDF's intent | LOW | Brief does not mention this. `@media print` hides game iframe, deliberation layer, shop callout, nav. |

### Anti-Features (Surface 1)

| Anti-Feature | Why Requested | Why NOT For This Brand | Alternative |
|--------------|---------------|------------------------|-------------|
| Newsletter / email subscribe CTA | "Every content site has one" | Brief explicitly: the site is a destination, not a newsletter. A subscribe form reframes Eisenbalm as a distribution channel rather than a magazine readers choose to visit. It also adds auth surface area for no value. | If distribution matters later, an RSS feed serves readers who want pull-based updates without the email relationship |
| Related articles / "You might also like" widget | Standard editorial UX | Creates a generic "content site" feel that undercuts the one-issue-at-a-time magazine brand. Each issue is complete. There is no algorithmically similar charity. | The archive at `/archive` is the discovery mechanism — readers can browse, not be fed. |
| Social share count displays | "Show virality to build credibility" | This brand is not competing on virality. Display counts on obscure charities can read as damning (low numbers). | Static share-to-X / share-to-Threads / copy-link buttons are sufficient without counts |
| Comments or reader discussion | "Community builds engagement" | Brand voice requires no backtalk. Jesse doesn't entertain debate. A comment section would invite irony-signaling that collapses the dry-serious tone. | The deliberation layer is the "conversation" — between named agents, not anonymous readers |
| User accounts / reading history personalization | Increases "stickiness" | Personalization requires auth, which adds surface area and implies a relationship (subscription) the brief rules out. One magazine per week — there is no personalization needed. | Bookmarking via native browser bookmark is sufficient |
| AI-generated content labels / "Powered by AI" badges | Transparency best practice for general AI content | The brand premise is that Jesse was born AI. Labeling it "AI content" would be like labeling a Pixar film "computer-generated." The deliberation layer IS the transparency. | The Deliberation Layer shows the full pipeline. That is the transparency mechanism. |
| Infinite scroll on archive | "Modern pagination" | Obscures navigation and makes it impossible to share a specific page position. Archive has a finite number of issues. | Simple paginated list or full list (52 issues/year is manageable) with search/filter |
| Dark mode toggle | "Universal expectation" | Per-issue theming already defines the background color. Dark mode toggle conflicts with the DesignAgent's intentional palette and would require overriding every issue's aesthetic. | Honor `prefers-color-scheme` at the system level only for non-issue pages (archive, charities, about) |

---

## Surface 2: AI Observability Layer (Deliberation Layer)

The pipeline transparency surface. Lives inside the issue page. Shows pitch log, agent votes, QA corrections, event timeline — live via Convex subscriptions.

### Table Stakes (Surface 2)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Attribution to named agents (not "the AI") | "AI" is a black box; "Scout found three candidates; Advocate scored them 7, 4, 9; Editor chose #3 because…" is a story | MEDIUM | `agentProfile` documents in Sanity power the identity cards. Each event carries `agentId` — resolve to `displayName`, `role`, `personality`. |
| Chronological event timeline | Readers need to understand cause-and-effect: Scout finds → Advocate argues → Editor decides | LOW | Convex events are ordered by `timestamp`. Render as a vertical timeline. |
| Charity pitch cards with outcome markers | Show all 3-5 candidates, which ones were rejected and why, which one won | MEDIUM | `pitchLog.byRunId` + `selected` field. Rejected candidates shown with Advocate score and runner-up notes. |
| QA correction diff view | Show what the QA agent changed and why, per section | MEDIUM | `qaCorrections` has `original`, `corrected`, `reason`, `severity`. A simple two-column diff or "before/after" toggle is readable. |
| Empty/loading states that don't break the page | If Convex data hasn't loaded or `runId` is undefined, the section must degrade gracefully — not crash | LOW | Convex `useQuery` returns `undefined` while loading. Skeleton loaders for each card. |
| Pipeline status indicator | Show whether the run is `running`, `awaiting-review`, or `complete` | LOW | `pipelineRuns.byRunId` query. Status badge at top of deliberation section. |

### Differentiators (Surface 2)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Agent personality cards | Each agent has a `personality` field in `agentProfile`. Showing "Scout: relentlessly skeptical. Advocate: constitutionally optimistic." before showing their outputs makes the deliberation legible as a story, not a log dump | LOW | Already in schema. Display above the timeline. Cache after first GROQ fetch. |
| Advocate score visualization | The 1-10 score per candidate is numerical data — render as a simple bar or rating, not just a number. Makes the comparative case at a glance. | LOW | Brief specifies `advocateScore (1–10)`. Simple CSS bar chart or star-equiv is enough. |
| QA severity color coding | `minor` (yellow) / `moderate` (orange) / `major` (red) corrections communicate quality signal at a glance without requiring readers to read every correction | LOW | Already in schema. CSS utility classes. |
| Deliberation section collapses by default | The deliberation layer is optional depth — readers who don't care about it should not be required to scroll through it | LOW | Collapsed accordion with "See how this issue was made" label. Expands on click. |
| "Why this charity and not the others" summary block | A plain-language summary of the editor's decision — one paragraph, pinned above the full timeline — gives readers the TL;DR before diving into the log | LOW | Derived from `editorDecision` field in `selectionDeliberation`. Not a new Convex query — already in the Sanity issue fetch. |
| Real-time event arrival animation | For readers who arrive while the pipeline is still running (unlikely but possible for future live-run transparency), new events animate in smoothly | MEDIUM | Convex subscriptions auto-update. CSS `@keyframes fade-in` on newly mounted cards. Low complexity for implemented subscription. |

### Anti-Features (Surface 2)

| Anti-Feature | Why Requested | Why NOT For This Brand | Alternative |
|--------------|---------------|------------------------|-------------|
| "Powered by [Model Name]" attribution | Transparency best practice in AI products | The brand is Jesse, not OpenRouter or Claude. Model names are infrastructure, not identity. Showing "written by Claude Sonnet 3.7" undermines the agent-as-character conceit and invites comparison to other AI products. | Agents have names and personalities in `agentProfile`. That IS the attribution. |
| Accuracy score / hallucination meter | "Users want to know if AI content is reliable" | False precision. A "reliability: 84%" badge would be unverifiable and misleading for the kind of human-story editorial content this site publishes. | QA correction log shows what was caught and corrected. That is the honest version. |
| Live pipeline progress bar during runs | "Transparency during generation" | Pipeline runs Thursday-to-Thursday, not while readers watch. This is a post-hoc observability layer, not a live generation viewer. A fake progress bar would be dishonest. | Pipeline status badge (`running` / `complete`) is sufficient. |
| Editable agent outputs via reader UI | "Readers could help correct errors" | Violates the editorial chain of custody. Andrew is the only correction authority. Reader edits would destroy the journalistic posture. | A contact/corrections link in the footer pointing to Andrew is sufficient. |
| Voting on which charity should have won | "Reader engagement, community feel" | Undermines the entire premise that the editorial board's deliberation is authoritative. Retroactive reader voting turns the deliberation into a poll. | Sharing the issue is the reader's vote. |

---

## Surface 3: One-Product Ecommerce

Lip balm. Custom Stripe. One page. One button. 100% of proceeds go to the featured charity.

### Table Stakes (Surface 3)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clear product description and price | Buyers need to know what they're purchasing and what it costs before clicking — hiding the price until checkout is a dark pattern | LOW | One SKU, one price. Display upfront on `/shop`. |
| Single-click checkout path | 70% of carts are abandoned due to excessive steps. Stripe Checkout handles payment collection, so the flow is: product page → Stripe-hosted checkout → thank-you page. Minimal friction. | LOW | `POST /api/checkout` → redirect to `session.url`. Already in API contracts. |
| Secure payment indicators | SSL lock, Stripe badge (Stripe Checkout includes these by default), accepted card logos | LOW | Stripe Checkout UI provides these natively. No manual implementation. |
| Order confirmation page at `/shop/thank-you` | Buyers need acknowledgment that their order completed — without it, they re-submit or contact support | LOW | Already specced. Pull `session_id` from URL param to show order summary. |
| Charity callout on product page | The purchase reason — "100% of proceeds go to [current featured charity]" — must be prominent, not buried in fine print | LOW | Dynamic: show current issue's charity name and link. Critical trust signal for this brand. |
| Quantity selector | Even for a single SKU, buyers may want to purchase multiple lip balms (gifts, bulk). Removing quantity forces a separate transaction. | LOW | Brief includes `quantity` param in checkout session creation. |
| Mobile-optimized checkout path | 60%+ of commerce is on mobile. Stripe Checkout is mobile-optimized by default. | LOW | Stripe handles this. Main risk is the product page layout itself. |
| Privacy policy / terms | Required for payment processing compliance (Stripe TOS, GDPR/CCPA basics) | LOW | Brief does not mention this. Minimal static page required. `/legal/privacy` |

### Differentiators (Surface 3)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Which charity receives this purchase — live, per featured issue | The buyer sees exactly which charity benefits from their order right now, with a link to the issue. This is the entire purchase motivation. | LOW | Query latest published issue slug + charity name from Sanity. Display on `/shop` with link to `/issue/[slug]`. |
| "Your purchase goes to [charity]" on the thank-you page | Reinforces the reason for purchase; makes the confirmation page feel meaningful rather than transactional | LOW | Brief under-specifies the thank-you page content. Include charity name and a one-sentence impact statement. |
| Persistent shop callout on every issue page | Readers encounter the purchase CTA in editorial context, where they're already engaged with the charity. Not a banner — one sentence, one button. | LOW | Already in brief. Append as fixed or sticky element at bottom of issue page. The callout updates dynamically with the current featured charity. |
| No account required | Friction-free. Buyers who've never been to the site can purchase in under 2 minutes. | LOW | Stripe Guest Checkout is default. Brief prohibits user accounts on the marketing site. |
| Total donated counter (optional, post-v1) | A running "$X,XXX donated to date across Y charities" figure on `/shop` builds long-term trust and demonstrates that the model works | MEDIUM | Requires order tracking in Supabase or Stripe metadata. Post-v1. |

### Anti-Features (Surface 3)

| Anti-Feature | Why Requested | Why NOT For This Brand | Alternative |
|--------------|---------------|------------------------|-------------|
| Urgency/scarcity mechanics ("Only 3 left!", countdown timers) | "Proven conversion tactics" | Brief explicitly forbids these. They are also dishonest for a non-inventory-scarce product and conflict with Jesse's no-manipulation brand posture. Dark patterns are increasingly illegal under FTC 2026 rules. | The charity mission is the urgency. "This week's proceeds go to [charity]. Next week they go somewhere else." — that is honest urgency. |
| Popups and modal upsells | "Capture abandoning visitors" | Brief explicitly forbids. Popups destroy the magazine reading experience and signal the opposite of Jesse's dry, unbothered brand. | The persistent (non-modal) shop callout on issue pages is the non-annoying version. |
| Subscription / recurring orders | "Increase LTV" | Brief locks one-time payment only. A subscription model implies a different relationship (membership) the brand hasn't established and doesn't want. Adding subscriptions dilutes the per-issue charity connection. | Each issue cycle is implicitly a fresh purchase decision. |
| Product reviews / star ratings | "Social proof is conversion-critical" | Lip balm reviews introduce a consumer-product review dynamic that clashes with the editorial/cause-marketing brand. The editorial content is the social proof. | Issue readership and charity-link transparency serve as credibility signals instead. |
| Multi-product catalog | "Expand revenue" | Brief explicitly out of scope. Multiple products introduce SKU management, inventory, shipping complexity, and distract from "magazine that happens to sell one product." | If product line grows, that is a v2 architectural decision that needs brand and scope rethinking. |
| Abandoned cart emails | "Recover lost revenue" | Requires email collection and sending infrastructure. Brief prohibits newsletter/email. Any email capture re-opens the "is this a store?" question the brand deliberately avoids. | Stripe Guest Checkout reduces abandonment by minimizing friction, not by following up. |
| Apple Pay / Google Pay as separate feature | "One-tap mobile payments reduce friction" | Stripe Checkout natively includes Apple Pay and Google Pay where supported. This is not a separate feature to build — it is included free by using Stripe Checkout. | Non-issue. Stripe handles it. |

---

## Feature Dependencies (Cross-Surface)

```
Deliberation Layer (Surface 2)
    └──requires──> Convex subscriptions (runId from Sanity)
                       └──requires──> Pipeline writes deliberation events to Convex
                                          └──requires──> Pipeline runs successfully

Per-issue theming (Surface 1)
    └──requires──> DesignAgent output (valid hex + Google Font names)
                       └──requires──> Publisher validates theme before writing to Sanity

Shop callout charity name (Surface 3)
    └──requires──> Latest published issue query (Surface 1 infrastructure)

Charity database page (Surface 1)
    └──requires──> Scout writes charity documents to Sanity during pipeline run

PDF download (Surface 1)
    └──requires──> Publisher agent generates PDF and uploads to Sanity (post-publish webhook)

Audio player (Surface 1)
    └──requires──> Andrew manually runs NotebookLM and pastes audio URL (manual gate, v1)
```

### Dependency Notes

- **Deliberation layer requires pipeline + Convex**: The observability surface has no content until the pipeline runs. Issue pages for early issues show an empty deliberation section until the first run completes. Plan an empty state.
- **Theme validation is a hard dependency**: If DesignAgent emits an invalid hex color or a Google Font name that fails to load, the entire issue's typography breaks. Publisher should validate before writing.
- **Shop charity callout requires a published issue**: `/shop` shows "proceeds go to [charity]" based on the latest published issue. Before the first issue ships, this section shows a placeholder.

---

## Under-Specified Areas (Brief Gaps)

These features are implied by the brief but not explicitly specified. They need decisions before or during build.

### Surface 1 — Editorial

| Gap | Question | Recommended Default |
|-----|----------|---------------------|
| Estimated reading time | Should issue pages show a reading time estimate? | YES. Calculate from section word counts server-side. Display in charity header area. |
| Share buttons | Should sections have share-to-X / share-to-Threads / copy-link buttons? | YES, per-section anchor link copy-to-clipboard is sufficient. No share count display. |
| RSS feed | Should the site publish an RSS feed at `/feed.xml`? | YES. Low complexity. Serves readers who want pull-based updates without email. Feed includes issue title, charity name, publish date, and link. No full content. |
| Print stylesheet | Should issue pages have a print-clean layout? | YES. `@media print` hides nav, game iframe, deliberation layer, shop callout. Leaves editorial text + charity header readable. |
| Accessibility: game iframe focus | How does keyboard focus enter/exit the sandboxed game iframe? | The iframe needs `tabindex="0"` and a visible focus ring. Add a "Skip game" link above it for keyboard users. |
| Archive search implementation | How does `/archive` search work? Is it client-side filtering or a GROQ full-text query? | Client-side filtering of the full archive list (small dataset, fetched once). Filter by charity name, focus area, bonus type. |
| `og:image` per issue | What is the Open Graph image for each issue? | DesignAgent should emit a "card image" suggestion, or a static template renders the charity name + issue number + accent color as an OG image. Simplest: static fallback image per issue. |
| Podcast section: empty state | What shows when Andrew hasn't uploaded the audio yet (`audioFile` is null)? | Show the collapsible `deliberationTranscript` text only, with a note "Audio coming soon." |
| `/about` page content | The brief mentions `/about` exists but says nothing about its content. | Static page: who Jesse is, what the format is, where 100% of proceeds go. Not a CMS-managed page. |

### Surface 2 — Deliberation Layer

| Gap | Question | Recommended Default |
|-----|----------|---------------------|
| Collapsed by default | Should the deliberation layer be collapsed or expanded on page load? | COLLAPSED by default with a clear "See how this issue was made" expansion trigger. Keeps the reading experience primary. |
| Agent avatar images | `agentProfile` has an `avatar` field. Are avatars illustrated or abstract? | Not specified in brief. Placeholder: use a consistent geometric avatar system (initials + theme color) until illustrated avatars are created. |
| Historical issues: Convex data retention | Convex data is described as "ephemeral pipeline observability." Does it persist indefinitely or expire? | The brief does not specify a retention policy. Convex data should persist indefinitely (it is queryable by readers on all past issues). Clarify with Andrew. |
| Mobile layout of deliberation layer | How does the horizontal pitch card layout translate to mobile? | Vertical stack on mobile. Single-column pitch cards. Timeline collapses to simplified event list. |

### Surface 3 — Ecommerce

| Gap | Question | Recommended Default |
|-----|----------|---------------------|
| Product description on `/shop` | What copy describes the lip balm itself (ingredients, size, shipping)? | Static copy. Brief says "Jesse A. Eisenbalm lip balm" — product details (weight, ingredients, shipping cost/time) are not specified. Andrew must provide. |
| Shipping | Does the checkout include shipping calculation or is shipping flat-rate / free? | Stripe Checkout supports shipping rate collection. Decision needed before Stripe product setup. Brief is silent. |
| Privacy policy / terms of service | Are these required? Where do they live? | YES. Stripe requires them. Minimal static page at `/legal/privacy`. |
| Order confirmation email | Does Stripe send an automatic receipt, or does the site send a custom one? | Stripe Checkout sends automatic email receipts by default. No custom email needed in v1. |
| Thank-you page content | What exactly appears on `/shop/thank-you`? | Charity name, "Your purchase benefits [charity]", order total, Stripe session ID for reference. Brief says "reader lands on /shop/thank-you" but no content spec. |

---

## MVP Definition

### Launch With (v1)

All three surfaces must function at launch. The site is not a product without all three.

**Surface 1 — Editorial**
- [ ] Issue page with all 8-10 sections rendered in order
- [ ] Per-issue theme (CSS variables, working Google Fonts load)
- [ ] Charity header with all metadata
- [ ] PDF download for Problem Statement
- [ ] Audio player (even if audio URL is null — graceful empty state)
- [ ] Archive at `/archive` with client-side search/filter
- [ ] Charity database at `/charities` and individual charity pages
- [ ] Open Graph tags and schema.org JSON-LD on issue and charity pages
- [ ] XML sitemap

**Surface 2 — Deliberation Layer**
- [ ] Pitch log with candidate cards (winner marked)
- [ ] Agent event timeline (chronological)
- [ ] QA corrections list with severity coloring
- [ ] Agent identity cards (name, role, personality)
- [ ] Collapsed by default with expand trigger
- [ ] Graceful empty/loading states

**Surface 3 — Ecommerce**
- [ ] Product page at `/shop` with price, description, charity callout
- [ ] Stripe Checkout redirect
- [ ] Thank-you page at `/shop/thank-you`
- [ ] Stripe webhook handler (signature-verified, idempotent)
- [ ] Persistent shop callout on issue pages

### Add After Validation (v1.x)

- [ ] RSS feed at `/feed.xml` — add when reader retention becomes a priority
- [ ] Print stylesheet — add when long-form readership is confirmed
- [ ] Estimated reading time — add when section word count tracking is available
- [ ] Per-section share/copy-link buttons — add when social sharing is measurable
- [ ] `og:image` dynamic generation per issue — add when social card quality matters (start with static fallback)

### Future Consideration (v2+)

- [ ] Total donated counter on `/shop` — requires order aggregation across Stripe history
- [ ] Charity search/filter on `/archive` with full-text GROQ — only needed when archive exceeds 50 issues
- [ ] Email list (if brand pivots to distribution) — requires complete rethinking of the destination-not-newsletter positioning

---

## Feature Prioritization Matrix

| Feature | Surface | User Value | Build Cost | Priority |
|---------|---------|------------|------------|----------|
| Issue page with all sections | 1 | HIGH | HIGH | P1 |
| Per-issue theming | 1 | HIGH | MEDIUM | P1 |
| Deliberation layer (collapsed) | 2 | HIGH | MEDIUM | P1 |
| Stripe checkout | 3 | HIGH | MEDIUM | P1 |
| Open Graph + schema.org markup | 1 | HIGH | LOW | P1 |
| Archive + charity database | 1 | MEDIUM | LOW | P1 |
| Agent identity cards | 2 | MEDIUM | LOW | P1 |
| QA corrections display | 2 | MEDIUM | LOW | P1 |
| Shop callout on issue pages | 3 | HIGH | LOW | P1 |
| Charity callout on /shop | 3 | HIGH | LOW | P1 |
| Thank-you page content | 3 | MEDIUM | LOW | P1 |
| XML sitemap | 1 | MEDIUM | LOW | P1 |
| RSS feed | 1 | LOW | LOW | P2 |
| Print stylesheet | 1 | LOW | LOW | P2 |
| Estimated reading time | 1 | MEDIUM | LOW | P2 |
| Per-section anchor + copy-link | 1 | MEDIUM | LOW | P2 |
| og:image dynamic generation | 1 | MEDIUM | MEDIUM | P2 |
| Total donated counter | 3 | MEDIUM | MEDIUM | P3 |

---

## Sources

- [What Readers Expect From Digital Magazines in 2026](https://www.3dissue.com/what-readers-expect-from-digital-magazines-in-2026-based-on-the-ux-patterns-winning-right-now/)
- [Digital Publishing Trends for 2026](https://www.yudu.com/blog/digital-publishing-trends-2026)
- [Show Your Work: AI Transparency That Earns Trust in Journalism](https://completeaitraining.com/news/show-your-work-ai-transparency-that-earns-trust-in/)
- [Designing for AI Trust: 2026 Transparency Best Practices](https://www.parallelhq.com/blog/designing-ai-transparency-trust)
- [Full Disclosure, Less Trust? arXiv study on AI disclosure in news writing](https://arxiv.org/html/2601.09620v1)
- [Frontiers: Provenance and Disclosure Cues in AI Journalism (2026)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1815243/full)
- [AI Observability: The Missing Layer in Human-Agent Systems](https://www.designative.info/2026/04/20/ai-observability-is-the-missing-layer-in-human-agent-systems)
- [Agentic AI Observability: A 2026 Playbook](https://www.arthur.ai/column/agentic-ai-observability-playbook-2026)
- [Ecommerce Conversion Rate Benchmarks 2026 — Shopify](https://www.shopify.com/blog/ecommerce-conversion-rate)
- [Dark Patterns in eCommerce — NAMAAIT](https://www.namaait.com/en/articles/104/dark-patterns-ecommerce)
- [Dark Patterns 2026: FTC Click-to-Cancel Rule](https://cookie-script.com/privacy-laws/dark-patterns-2026-the-ftc-new-click-to-cancel-rule)
- [Schema Markup After March 2026: Structured Data Update](https://www.digitalapplied.com/blog/schema-markup-after-march-2026-structured-data-strategies)
- [Next.js SEO: Complete Implementation Guide for 2026](https://adeelhere.com/blog/2025-12-09-complete-nextjs-seo-guide-from-zero-to-hero)
- [Open Graph Tags: Complete Guide 2026](https://share-preview.com/blog/og-tags-complete-guide.html)
- [Social Proof Statistics 2026](https://wisernotify.com/blog/social-proof-statistics/)

---
*Feature research for: The Eisenbalm Dispatch — editorial magazine, AI observability, one-product ecommerce*
*Researched: 2026-05-09*
