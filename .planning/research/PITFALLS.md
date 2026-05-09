# Pitfalls Research

**Domain:** Multi-agent LLM editorial pipeline with iframe sandbox, real-people factual writing, webhook-driven deploy chain, and custom Stripe commerce
**Researched:** 2026-05-09
**Confidence:** HIGH (critical pitfalls verified against official docs + community post-mortems; operational patterns verified against CONCERNS.md build-time analysis)

> **Note on scope:** CONCERNS.md already documents build-time risks (retry logic, test coverage, contract drift). This document focuses on operational failure modes — what breaks *during weekly runs* and *during production operation* — with additional depth on the nine domain-specific categories asked for. Pitfalls already thoroughly documented in CONCERNS.md are noted with a cross-reference rather than duplicated.

---

## Category 1: LLM Pipeline — Voice Drift, Prompt Contamination, Cost, Partial Failures

### Pitfall 1.1: Calibrator Style Brief Mutated Downstream (Prompt Contamination)

**Severity: HIGH**

**What goes wrong:**
The Calibrator style brief is injected into every subsequent agent's system prompt. If an upstream agent (Scout, Advocate) produces output that contradicts or overwrites the brief in the shared LangGraph state — for instance, the Scout summarizes a charity's mission in language that sounds enthusiastic and sentimental — that output becomes part of the context the OriginStoryWriter and FounderBioWriter receive. The writer agents then model their output on the *tone they see in context*, not on the style brief they were given in their system prompt. This is not adversarial injection; research published in April 2026 (arxiv 2604.01350) found that in shared-state multi-agent systems, benign cross-user contamination rates of 57–71% occur from scope-bound artifacts being misapplied downstream. The equivalent here is "scope-bound tone artifacts" from Scout propagating into writer voice.

**Why it happens:**
LangGraph state accumulates outputs from every agent. Writer agents receive both their system prompt (Jesse's voice) and the full accumulated state (which now includes Scout's enthusiastic summaries). The state has higher semantic weight than the system prompt because it contains concrete examples of "what this pipeline says."

**How to avoid:**
1. Pass the Calibrator style brief to each writer agent as a **separate, isolated message** that is explicitly labeled "VOICE AUTHORITY — supersedes all other context."
2. Scout and Advocate output must be stored in typed state fields (`pitchCandidates`, `advocateArguments`) that are structurally distinct from the style brief field. Never concatenate Scout output into the same block as the style brief when building writer prompts.
3. Add a prompt construction function in the pipeline that assembles each agent's context deterministically: `[system_prompt] + [voice_brief] + [research_data]` — never freeform string concatenation.
4. In QA agent, add an explicit check: "Does the tone of this section match the Calibrator's visual direction and voice constraints?" — flag if the section's vocabulary includes sentiment words that appear nowhere in the style brief.

**Warning signs:**
- QA corrections spiking above 30% of sections per run
- Andrew frequently rewriting the same types of phrases (e.g., consistently removing "heart-warming" or "incredible")
- OriginStory and FounderBio sections sounding warmer than Problem Statement (Problem goes through the same pipeline — if they diverge, Scout contamination is the likely cause)

**Phase to address:** Phase 5 (Agent quality) — build prompt construction functions with explicit structure; Phase 4 skeleton must not use freeform string concat

**Type:** Operational (occurs every pipeline run)

---

### Pitfall 1.2: Voice Drift Accumulates Issue-to-Issue via Calibrator

**Severity: HIGH**

**What goes wrong:**
The Calibrator receives "previous issue numbers, previous bonus types" as input. If the Calibrator's style brief is stored and re-fed as historical context, a model temperature variance or subtle model update through OpenRouter can cause the style brief itself to drift slightly each week — slightly warmer language in week 3, slightly more ironic in week 7 — until the brand collapses 2–3 months later. The drift is invisible week-to-week but cumulative over the issue archive.

**Why it happens:**
The Calibrator is the only agent whose output shapes every other agent's voice. Any drift in Calibrator output is amplified by the 6–7 downstream writers. Because the brief says "no irony signaling," a Calibrator brief that says "use deadpan irony" vs "use flatness" is a small text difference that produces large output differences.

**How to avoid:**
1. Lock the Calibrator's core voice rules as a **hardcoded system prompt string** that does not change with each run. What changes is only `bonusType` and `visualDirection`. The voice constraints (`dry, precise, absurdly serious, no winking`) are immutable strings injected verbatim, never re-generated.
2. Store the full Calibrator output in Sanity on every run as `pipelineMetadata.calibratorBrief`. Andrew can review it as part of the issue draft.
3. Every 4 issues, Andrew should do a voice audit: read all 4 FounderBio sections back-to-back and rate them 1–10 for consistency. If variance > 2 points, investigate Calibrator drift.

**Warning signs:**
- Calibrator output for voice constraints differs meaningfully from a fixed reference brief (run a diff)
- Readers commenting that the "feel" of the site has changed
- Andrew's Sanity edits shifting from small tweaks to paragraph-level rewrites

**Phase to address:** Phase 5 (Calibrator is voice-critical per brief) — this is the highest-priority agent quality issue

**Type:** Operational (drift accumulates; mostly invisible during single run)

---

### Pitfall 1.3: Parallel Phase 2 Partial Failure Produces Structurally Invalid Draft

**Severity: HIGH**

**What goes wrong:**
The seven Phase 2 agents (OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design) run in parallel. If GameWriter fails after a 90-second timeout while the other six succeed, the pipeline writes a `weeklyIssue` draft to Sanity with `game.embedCode = null`. Andrew sees the draft, doesn't notice the game section is empty (it's one of ten sections), approves it, publishes — and readers see a broken iframe.

**Why it happens:**
LangGraph parallel node failures do not abort the graph by default; the graph continues with whatever succeeded. The failure is recorded in the node's output but does not surface prominently in the Sanity draft or the Convex run state unless explicitly coded.

**How to avoid:**
1. After parallel phase completes, add a validation node that checks every required field against the LangGraph state contract (`DispatchState` from API_CONTRACTS.md §7). Any null required field sets `pipelineRuns.status = 'partial-failure'` in Convex with a list of failed sections.
2. In Sanity Studio, use a custom input component or validation rule on `weeklyIssue` that surfaces a warning banner: "The following sections failed: [list]" — visible to Andrew before he can flip `status` to `published`.
3. Design individual section retry logic: if GameWriter fails, retry exactly once with a simplified prompt (fewer constraints). If it fails again, write a placeholder and flag it.

**Warning signs:**
- Pipeline run duration much shorter than expected (parallel phase completing fast = some agents never started)
- Convex `pipelineRuns.status` shows `completed` but `deliberationEvents` count is lower than expected (≤50 events when typical run produces 80–120)
- Game section renders an empty iframe box in the issue preview

**Phase to address:** Phase 4 (Pipeline skeleton must include the validation node) and Phase 7 (Game rendering, add retry logic for GameWriter specifically)

**Type:** Operational (risk on every run)

---

### Pitfall 1.4: OpenRouter Model Version Silently Changes Mid-Run

**Severity: MEDIUM**

**What goes wrong:**
OpenRouter routes to model versions using aliases like `anthropic/claude-3-5-sonnet`. When Anthropic releases a new model version, OpenRouter silently updates the alias routing. The Calibrator that ran at 9 AM is routed to `claude-3-5-sonnet-20241022`; the QA agent that runs 40 minutes later is routed to `claude-3-5-sonnet-20250101`. The voice rubric in the QA agent's prompts was calibrated against the older model's output style. QA passes content that the old model would have flagged.

**Why it happens:**
OpenRouter alias resolution is not pinned per-session; it resolves at request time.

**How to avoid:**
1. Pin all critical voice agents (Calibrator, Editor, QA, Editor Final) to explicit model version strings (e.g., `anthropic/claude-3-5-sonnet-20241022`) rather than floating aliases.
2. Keep a `modelVersions` field in Convex `pipelineRuns` that records the exact model string used for each agent on that run. When voice issues appear, this field makes it trivial to identify if a model change correlated.
3. Subscribe to OpenRouter model update notifications or check the OpenRouter changelog before each Thursday run.

**Warning signs:**
- QA correction rate suddenly drops to near-zero (model changed, QA is now permissive)
- Andrew starts catching more voice issues during his review than usual
- Section output style shifts without any prompt changes

**Phase to address:** Phase 5 (agent quality) — pin model versions before relying on QA for voice accuracy

**Type:** Operational + Build

---

### Pitfall 1.5: Per-Run Cost Runaway Without Hard Cap

**Severity: MEDIUM**

**What goes wrong:**
9 agents × multiple calls + web search + retries = unbounded per-run cost. If Scout enters a web search loop (tool_use → result → tool_use → result, 20 iterations), one run can cost $30–$80 instead of $3–$8. At weekly cadence this is a $1,500/year cost overrun. OpenRouter does not enforce per-call token caps unless explicitly set; LangGraph does not add cost limits by default.

**Why it happens:**
Web-search agents with broad mandates (Scout: "find 3–5 candidates") can invoke search tools repeatedly when results are unsatisfactory. Without a step counter or token budget, there is no circuit breaker.

**How to avoid:**
1. Set explicit `max_iterations` per agent: Scout ≤ 8 tool calls, Researcher ≤ 12. LangGraph supports this via `recursion_limit` on individual nodes.
2. Set a hard per-run token budget at the OpenRouter API key level (OpenRouter supports per-key credit caps in account settings).
3. Log `usage.total_tokens` from every OpenRouter response into Convex `deliberationEvents` with event type `cost-checkpoint`. Alert if cumulative tokens exceed threshold (e.g., 200K tokens per phase).
4. Add a run-start cost estimate to the `pipelineRuns` row; compare against actual at run-end and alert if actual > 2× estimate.

**Warning signs:**
- Single agent in `deliberationEvents` shows 15+ tool_call events (Scout normally does 4–8)
- Convex `pipelineRuns` shows a run duration > 90 minutes (normal is 25–45 minutes)
- OpenRouter dashboard shows a single day with 5× normal spend

**Phase to address:** Phase 4 (Pipeline skeleton — add iteration limits and cost logging before any real agent calls) and Phase 5 (tune budgets with real model usage data)

**Type:** Operational (risk on every run)

---

## Category 2: Factual Accuracy — Real People, Real Charities

### Pitfall 2.1: Hallucinated Founder Name Published About a Real Person

**Severity: HIGH**

**What goes wrong:**
Researcher agent deep-dives the winning charity and returns `founderName`, `founderBackground`. LLMs routinely hallucinate founder names that are plausible for the charity's geography and domain. If the hallucinated name happens to match a real person in that city (e.g., "Sarah Chen, nutritionist in Oakland"), the site publishes a false biographical narrative about that real person. This is a defamation risk confirmed by legal analysis: hallucinated false statements of fact about identifiable real people satisfy the basic elements of defamation claims (see sources).

**Why it happens:**
The Researcher has a mandate to find founder details. If the charity's website doesn't have a clear "About Our Founder" page, the model fills in plausible details rather than returning empty fields. The brief says "proof of existence" but no verification mechanism enforces this.

**How to avoid:**
1. Researcher must return a `sourceUrl` for every `founderName` and `caseStudySubject` claim. If no URL exists, the field must be `null` — not a hallucinated value.
2. Add a post-Researcher validation step (lightweight Python) that visits the charity's official website, Charity Navigator page, and GuideStar entry and checks if the `founderName` string appears in the page text. If not found, flag as `unverified` and do not write to Sanity.
3. In Sanity Studio, the `founderName` field should show a visual warning if `founderNameVerified: false`. Andrew must explicitly acknowledge this warning to proceed.
4. In the FounderBioWriter prompt: "If founder name or background cannot be verified from the charity's own website, write the section in third-person general without naming the founder. Do not invent biographical details."

**Warning signs:**
- Researcher output includes a `founderName` with no accompanying `founderSourceUrl`
- `founderBackground` contains details like alma mater or specific dates that are not present in the charity's public materials
- Google search for `[founderName] [charityName]` returns zero results

**Phase to address:** Phase 5 (Agent quality — factual verification is a safety requirement, not a nice-to-have) and Phase 2 (Sanity schema — add `founderNameVerified` boolean field)

**Type:** Operational + Legal risk

---

### Pitfall 2.2: Charity Data Published from Stale or Wrong IRS Records

**Severity: MEDIUM**

**What goes wrong:**
Scout uses web search to find asset ranges, mission statements, and founding years. IRS Form 990 data (the primary source on Charity Navigator and GuideStar) is typically 12–18 months behind the current year. A charity with $800K in assets in the most recent 990 may now have $2.1M after a major grant. Publishing `assetRange: "$100K–$1M"` when the charity is now at $2.1M is inaccurate and could affect donor perception or the charity's reputation.

**Why it happens:**
Scout agents search for charity data and return what search results say. Search results often surface Charity Navigator pages with year-old IRS data. The agent has no way to know this is stale without explicitly checking dates.

**How to avoid:**
1. Scout must record the data year for every financial figure: `assetRangeYear: 2023` alongside `assetRange`. Display this year on the `/charities/[slug]` page.
2. Add to Scout's prompt: "Always note the year of the most recent Form 990 data. If the most recent available data is older than 18 months from today, flag the asset range as 'estimated from [year] data'."
3. On the public charity page, display financial figures with a footnote: "Financial data from [year] IRS Form 990."

**Warning signs:**
- Scout returns financial data without a year qualifier
- Asset range on the charity page contradicts the charity's own current website ("Our 2024 impact report...")
- Charity reaches out to correct published information

**Phase to address:** Phase 5 (Scout prompt engineering) and Phase 2 (Sanity `charity` schema — add `assetRangeYear` field)

**Type:** Operational

---

### Pitfall 2.3: Case Study Subject is a Composite or Invented Person

**Severity: HIGH**

**What goes wrong:**
CaseStudyWriter produces "one person, one outcome" (brief, line 149). Researcher is supposed to supply a real case study subject. But if the charity's public materials only have testimonials labeled "Anonymous" or "A mother in Ohio," Researcher has no real person to cite. Rather than returning null, the model invents a name and story that "sounds like" real testimony from that charity's domain. This is published as fact on the issue page.

**Why it happens:**
The CaseStudyWriter's mandate ("one real person, one real outcome") creates pressure on the Researcher to always provide a name. LLMs fill gaps with plausible fiction rather than acknowledging they can't find the information.

**How to avoid:**
1. Researcher's output schema must include `caseStudySubjectVerified: bool` and `caseStudySourceUrl: str | null`. If no named subject with a verifiable source exists, both fields return `false` / `null`.
2. If `caseStudySubjectVerified = false`, CaseStudyWriter's prompt switches to a composite/anonymized framing: "Write the case study about an unnamed beneficiary, not a named individual. Do not invent a name."
3. In Sanity Studio, the case study section shows a banner when `caseStudySubjectVerified = false` to give Andrew explicit awareness.

**Warning signs:**
- Case study subject's name returns no results when Googled alongside the charity name
- Story details are extremely specific (named street, precise dates) but no source URL was provided
- Charity's own website uses "Anonymous" for all beneficiary stories

**Phase to address:** Phase 5 (Researcher agent, factual verification chain)

**Type:** Operational + Legal risk

---

## Category 3: iframe Sandbox — Escape, postMessage, Fingerprinting

### Pitfall 3.1: srcdoc Document is Same-Origin with Parent Page

**Severity: HIGH**

**What goes wrong:**
The brief specifies `<iframe srcdoc={embedCode} sandbox="allow-scripts">`. MDN and security research confirm: unless the frame also has `allow-same-origin` in its sandbox, a `srcdoc` document is treated as a unique opaque origin, separate from the parent. This is the **correct** and **safe** configuration. However: if a developer adds `allow-same-origin` to the sandbox (perhaps debugging layout issues), the iframe immediately gains same-origin access to the parent DOM, defeating the entire sandbox. Conversely, even without `allow-same-origin`, `srcdoc` content with `allow-scripts` can use `window.parent.postMessage()` to communicate with the parent page, and the parent page must validate message origins.

**Why it happens:**
Developers often add `allow-same-origin` to sandboxed iframes to fix styling or localStorage issues, not realizing this defeats the sandbox for scripting. This is explicitly documented by MDN as negating sandbox protection.

**How to avoid:**
1. The sandbox attribute must be exactly `sandbox="allow-scripts"` — never add `allow-same-origin`. Add a lint rule or code comment that prevents this: `// DO NOT add allow-same-origin here — defeats sandbox`.
2. The parent page's `postMessage` listener (if any is added for game score reporting) must validate `event.origin` and `event.source` strictly. Since srcdoc with no `allow-same-origin` has opaque origin, valid messages from the game will have `event.origin === 'null'`. The listener must only accept messages of specific shapes: `{ type: 'game-complete', score: number }` — reject all other shapes.
3. The GameWriter prompt must explicitly state: "Do not emit any `window.parent.postMessage()` calls in your game code." If score/state reporting is needed, it must be self-contained within the iframe.
4. Write an automated test that parses GameWriter's `embedCode` output and asserts: no `window.parent`, no `window.top`, no `document.cookie`, no `localStorage`, no `sessionStorage`, no `fetch()`, no XMLHttpRequest.

**Warning signs:**
- `allow-same-origin` appears in the sandbox attribute in any PR
- Game code contains `window.parent` or `window.top` references
- Browser console shows cross-origin postMessage errors during game interaction

**Phase to address:** Phase 7 (Game rendering) — the sandbox config must be specified and locked before GameWriter is given free rein

**Type:** Build + Operational (LLM output changes weekly)

---

### Pitfall 3.2: LLM-Emitted Game HTML Contains Relative URLs Resolved Against Parent Origin

**Severity: MEDIUM**

**What goes wrong:**
Even without `allow-same-origin`, relative URLs inside a `srcdoc` iframe resolve against the *embedding page's URL*, not the iframe's origin. A GameWriter that outputs `<img src="/assets/icon.png">` or `<script src="/lib.js">` causes the browser to fetch those resources from the Next.js app's own origin. This is not a sandbox escape, but it is: (a) a CSP violation if CSP is configured, (b) a way to trigger unauthorized GET requests to the Next.js server from the iframe, and (c) a way for maliciously crafted game code to probe internal API endpoints.

**Why it happens:**
The GameWriter brief says "no external CDN" — the LLM interprets this as "use relative paths" rather than "self-contained inline only."

**How to avoid:**
1. Add to GameWriter prompt: "All resources must be defined inline in the HTML. No `<script src>`, no `<link href>`, no `<img src>` with a relative or absolute URL. All CSS must be inline `<style>` blocks. All JavaScript must be inline `<script>` blocks. All images must be base64 data URIs."
2. The GameWriter output validator (Phase 7) must parse the HTML and reject any external-pointing URLs in `src`, `href`, or `action` attributes.
3. In the Next.js page that renders the iframe, set a Content-Security-Policy header for the frame: `<meta>` inside the srcdoc is the only CSP available for opaque-origin frames; embed it: `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src data: blob:;">`.

**Warning signs:**
- Browser dev tools show 404 requests to `/assets/` or similar paths from the iframe
- Network tab shows the game fetching resources from the app domain
- CSP violation reports in browser console

**Phase to address:** Phase 7 (GameWriter prompt + validator)

**Type:** Operational (LLM output changes weekly)

---

### Pitfall 3.3: Game Renders Broken on Mobile Due to Viewport/Scroll Constraints

**Severity: LOW**

**What goes wrong:**
Sandboxed iframes with fixed dimensions in the game HTML (`width: 800px`, `height: 600px`) overflow their container on mobile viewports. The game becomes partially unplayable. The GameWriter generates desktop-oriented games because its training data skews to desktop canvas/SVG games.

**Why it happens:**
GameWriter is instructed to "gamify the charity's mission" but not explicitly instructed about mobile-safe dimensions or responsive layout. Self-contained HTML games that use `<canvas>` with hardcoded dimensions are a common LLM output pattern.

**How to avoid:**
1. Add to GameWriter prompt: "The game must be playable on a 375px wide screen without horizontal scroll. Use `width: 100%` and `height: auto` on the game container. If using `<canvas>`, set canvas width dynamically using `canvas.width = Math.min(window.innerWidth - 32, 600)`."
2. Set the `<iframe>` in the Next.js component to `width="100%" style={{ minHeight: '400px', border: 'none' }}` and use a `ResizeObserver` to adjust height based on the iframe's content.

**Warning signs:**
- GameWriter emits HTML with hardcoded pixel dimensions > 375px
- Game is horizontally scrollable on mobile
- GameWriter uses `position: fixed` or `overflow: hidden` on the game body

**Phase to address:** Phase 7 (GameWriter prompt and iframe container component)

**Type:** Operational

---

## Category 4: Per-Issue Theme Injection

### Pitfall 4.1: CSS Custom Property Injection via Unvalidated LLM Color Values

**Severity: MEDIUM**

**What goes wrong:**
The brief injects theme values into CSS custom properties via template literal: `--color-primary: ${issue.theme.primaryColor};`. If the DesignAgent outputs a value like `red; } body { display: none; } .evil {` instead of a hex color, this breaks out of the CSS variable context and injects arbitrary CSS into the page's `<style>` block. A real confirmed CVE (GHSA-97v6-998m-fp4g from ApostropheCMS) demonstrates exactly this attack vector on CSS custom property fields.

**Why it happens:**
The Sanity `weeklyIssue` schema defines color fields as `string` with no format validation. The pipeline writes DesignAgent output directly to Sanity without validation (per API_CONTRACTS.md §2.2). The Next.js page injects the value without escaping.

**How to avoid:**
1. In the Next.js theme injection code, validate every color value against `/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/` before injection. If invalid, substitute the brand default (`#000000` for dark, `#FFFFFF` for light). Log the violation.
2. In the pipeline, before writing to Sanity, run `theme.primaryColor` etc. through the same regex. If invalid, retry DesignAgent with instruction "Output only valid 6-digit hex colors like #A3C4F2."
3. In the `<style>` tag construction, never use template literals. Use the CSS `setProperty` DOM API instead: `document.documentElement.style.setProperty('--color-primary', validatedColor)`. CSS `setProperty` treats the value as a CSS value, not as raw text that can break out of the property context.

**Warning signs:**
- DesignAgent output for a color field contains semicolons, brackets, or the word "rgb"
- Browser CSS inspector shows malformed `--color-primary` entries
- Page layout visually breaks after an issue deploys (sections hidden, colors wrong)

**Phase to address:** Phase 2 (Next.js shell — theme injection component must be secure from day one); Phase 5 (DesignAgent prompt + pipeline validation)

**Type:** Build (security must be in place before any real DesignAgent output reaches the site)

---

### Pitfall 4.2: Google Font Name Injection Causes FOUT or Font Loading Failure

**Severity: LOW**

**What goes wrong:**
Font values are injected as: `--font-display: '${issue.theme.fontDisplay}', serif;`. If `fontDisplay` contains a single quote (`O'Connor Serif`), it terminates the CSS string value early and the rest becomes a syntax error. More commonly: DesignAgent outputs a font name that doesn't exist on Google Fonts (`"Clarendon"` is on Linotype, not Google; `"Gotham"` is not on Google Fonts at all), and the font silently falls back to serif/sans-serif, breaking the per-issue visual identity.

**Why it happens:**
DesignAgent is instructed to output "valid Google Fonts names" but LLMs frequently confuse fonts from different foundries/services. The validation gap is that no check confirms the name exists on fonts.google.com before the run completes.

**How to avoid:**
1. Validate font names at pipeline write time using the Google Fonts API: `GET https://www.googleapis.com/webfonts/v1/webfonts?key={API_KEY}&family={fontName}`. If the family isn't found, retry DesignAgent with a fallback instruction, or substitute `Inter` and `Merriweather` (always available, safe defaults).
2. In the Next.js theme injection, use `next/font/google` dynamic loading with a curated safe list of fonts. If the font name from Sanity isn't in the safe list, fall back to the defaults without breaking the layout.
3. In the CSS injection, single-quote the font name and escape any existing single quotes: `fontDisplaySafe = issue.theme.fontDisplay.replace(/'/g, "\\'")`.

**Warning signs:**
- Font in browser dev tools shows "network" source as Google Fonts API but renders as "Times New Roman" or system serif (fallback was triggered)
- DesignAgent output contains font names with apostrophes, numbers, or special characters
- Console shows `Failed to load resource: the server responded with a status of 400` from fonts.googleapis.com

**Phase to address:** Phase 2 (CSS injection safety) and Phase 5 (DesignAgent validation and retry logic)

**Type:** Build + Operational

---

### Pitfall 4.3: Low-Contrast Theme Fails WCAG, Hurts Mobile Readability

**Severity: LOW**

**What goes wrong:**
DesignAgent selects colors for aesthetic coherence (matching a charity's brand palette) but doesn't evaluate contrast ratios. A pale yellow `backgroundColor` with white `textColor` produces WCAG contrast ratio < 1.5:1 — text is nearly invisible. This is especially bad on OLED mobile screens in low-light environments.

**Why it happens:**
DesignAgent prompt specifies visual direction but not accessibility constraints. LLMs optimizing for "aesthetic coherence" often produce monochromatic schemes that look beautiful in isolation but fail readability.

**How to avoid:**
1. Add to DesignAgent prompt: "Ensure text/background contrast ratio meets WCAG AA (4.5:1 for body text, 3:1 for large text). Use online contrast checker logic: luminance formula L = 0.2126R + 0.7152G + 0.0722B."
2. In the pipeline, after DesignAgent output, run a contrast check in Python using the WCAG formula. If contrast < 4.5:1, retry DesignAgent with: "Your previous color combination fails accessibility contrast requirements. Try again with higher contrast."
3. QA agent prompt should include: "Check if the theme colors would produce readable body text."

**Warning signs:**
- DesignAgent background color and text color are in the same color family (both warm, both cool, both saturated)
- Andrew opens the issue draft and the text is hard to read
- Contrast check tool returns ratio < 3:1

**Phase to address:** Phase 5 (DesignAgent + QA) and Phase 2 (contrast validation utility)

**Type:** Operational

---

## Category 5: Stripe Integration

### Pitfall 5.1: Fulfillment Race Condition — Thank-You Page Shows Before Webhook Fires

**Severity: MEDIUM**

**What goes wrong:**
The customer completes Stripe checkout and is redirected to `/shop/thank-you`. At this point, Stripe Checkout has succeeded and the customer has paid. But the webhook (`checkout.session.completed`) may not have fired yet — Stripe webhook delivery can lag 1–30 seconds after redirect. If the thank-you page queries the order status from Convex/Supabase to display "Your order is confirmed," the record doesn't exist yet and the page shows an error or empty state. Conversely, if the webhook fires twice (Stripe retries on any non-200 response), the order is logged twice.

**Why it happens:**
The standard Stripe pattern is: payment succeeds → redirect to success URL → webhook fires asynchronously. The success redirect and webhook are separate, unordered events. Most implementations try to query order state immediately on the success page, not realizing the webhook hasn't completed yet.

**How to avoid:**
1. The `/shop/thank-you` page must NOT try to query order status from the database. It should display a static confirmation using the `session_id` parameter Stripe appends to the success URL: extract customer email and amount from the session client-side via `stripe.retrievePaymentIntent()` or display static copy ("Your order is confirmed and your payment was received").
2. The webhook handler must be idempotent: before processing any event, check if `stripeSessionId` already exists in the orders store. If yes, return 200 without processing. Use Stripe's `event.id` as the idempotency key.
3. Return 200 from the webhook handler within 5 seconds regardless of downstream processing time. Move all fulfillment logic (email, Convex write, charity tracking) to a background task.
4. Store the `stripeSessionId` and `paymentIntentId` both. Refund webhook events (`charge.refunded`) arrive with `paymentIntentId`, not `sessionId` — you need both to correlate refunds with orders.

**Warning signs:**
- Thank-you page sometimes shows an error or "Order not found" for ~5 seconds then refreshes to show the order (race condition visible in production)
- Duplicate rows in the orders table with the same `stripeSessionId`
- Webhook handler returns 500 and gets retried by Stripe (Stripe retries with exponential backoff for up to 72 hours)

**Phase to address:** Phase 8 (Stripe integration — idempotency and race condition handling must be designed before the first real transaction)

**Type:** Build (must be correct before going live)

---

### Pitfall 5.2: Webhook Signature Verification Bypassed in Testing, Never Re-Enabled

**Severity: HIGH**

**What goes wrong:**
During development, signature verification is disabled to test webhook handling with curl or Stripe CLI without generating valid signatures. The check is commented out or wrapped in `if (process.env.NODE_ENV !== 'development')`. The production deploy inherits this conditional. Without signature verification, any HTTP client can POST to the webhook endpoint and trigger order fulfillment (or worse, trigger order-complete logic without a real payment).

**Why it happens:**
This is one of the most common Stripe integration mistakes. Developers disable verification during development and forget to restore it. The `if NODE_ENV` guard looks reasonable but is exactly wrong.

**How to avoid:**
1. Never disable signature verification for any environment, including development. Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (Stripe CLI) during development — it generates valid signatures automatically.
2. The verification code must be unconditional: always verify, always return 400 on failure. No environment gates.
3. In CI, add a test that POSTs a webhook event without a valid signature and asserts the handler returns 400.

**Warning signs:**
- The webhook handler code has any `if (isDev)` or `if (!STRIPE_WEBHOOK_SECRET)` guards around the `stripe.webhooks.constructEvent()` call
- `STRIPE_WEBHOOK_SECRET` is not set in the production environment variables
- The endpoint returns 200 for POST requests that lack a `Stripe-Signature` header

**Phase to address:** Phase 8 (Stripe integration — a code review gate: signature verification must be reviewed by a second person before go-live)

**Type:** Build (security: never acceptable to skip)

---

## Category 6: Sanity → Vercel Webhook Deploy Chain

### Pitfall 6.1: Deploy Hook Fires Before Sanity CDN Propagates New Content

**Severity: MEDIUM**

**What goes wrong:**
Andrew publishes the issue in Sanity Studio. Sanity fires the webhook to Railway (triggering Publisher) almost immediately — often within 1–2 seconds. After PDF generation, Publisher fires the Vercel deploy hook. Vercel starts a new build. But Vercel's build fetches content from Sanity's CDN (`useCdn: true`), which may not yet reflect the published issue (CDN propagation lag can be 5–60 seconds). The Vercel build completes and caches the *old* version of the issue content (still in draft state or old issue data). The published site shows the wrong or missing issue.

This is a documented and widely reported Sanity + Vercel pattern. It's been in the Sanity community for years (see sources).

**Why it happens:**
Webhooks and CDN caches are asynchronous and not coordinated. The deploy hook fires too quickly relative to CDN propagation.

**How to avoid:**
1. In the FastAPI Publisher handler, add a 30-second delay between PDF upload and Vercel deploy hook trigger: `await asyncio.sleep(30)`. This gives the Sanity CDN time to propagate.
2. In the Next.js Sanity client used for the build-time fetch, set `useCdn: false`. For a weekly publication schedule, build performance impact is negligible. This is the recommended fix.
3. Alternatively, use Sanity's on-demand ISR (Next.js `revalidatePath`) instead of a full Vercel rebuild. Only revalidate the specific issue slug route. This is faster and bypasses the CDN propagation issue.

**Warning signs:**
- Issue is "published" in Sanity but the live site still shows the previous issue (or no issue) after deploy
- Vercel build logs show Sanity queries but the fetched data timestamps predate the publish action
- Manually triggering another Vercel deploy 5 minutes later shows the correct content

**Phase to address:** Phase 6 (Publisher agent — the 30-second delay or CDN bypass must be in the first Publisher implementation)

**Type:** Build (the default Sanity + Vercel pattern has this race; must be explicitly prevented)

---

### Pitfall 6.2: Rapid Re-Publish Triggers Multiple Deploys (Deploy Storm)

**Severity: LOW**

**What goes wrong:**
Andrew publishes the issue, notices a typo in Sanity Studio, unpublishes and re-publishes to fix it. Each publish event fires the Sanity webhook, which triggers Publisher, which fires a Vercel deploy. Two builds are now running simultaneously on Vercel's free/hobby tier. Vercel cancels the earlier build and runs only the latest — which is usually fine. But if Andrew edits 5 fields and saves each one (Sanity's autosave behavior), 5 webhooks fire. Only status-change webhooks should trigger Publisher.

**Why it happens:**
Sanity webhooks can be configured with GROQ filters, but if the filter is too broad (e.g., any change to `weeklyIssue`) rather than specific (`status == "published"`), every field edit triggers a deploy.

**How to avoid:**
1. The Sanity webhook filter must be exactly `_type == "weeklyIssue" && status == "published"` per API_CONTRACTS.md §5.1. Verify this is the deployed filter, not just a design intent.
2. In the FastAPI webhook handler, add debounce logic: track `lastDeployAt` in Convex `pipelineRuns`. If a new webhook fires for the same `issueId` within 120 seconds of the previous deploy, ignore it.
3. The Vercel deploy hook URL should be stored in an environment variable, not hardcoded. This makes it easy to disable if needed.

**Warning signs:**
- Vercel build history shows multiple canceled builds for the same issue deploy
- Railway logs show multiple `/webhook/sanity-publish` hits within seconds for the same issue
- PDF is generated multiple times for the same issue (Publisher logs show duplicate PDF uploads)

**Phase to address:** Phase 6 (Publisher agent implementation)

**Type:** Build + Operational

---

### Pitfall 6.3: PDF Generation Timeout Blocks Issue Publish

**Severity: HIGH**

**What goes wrong:**
WeasyPrint is triggered inside the Publisher agent's background task. WeasyPrint is known to have significant performance issues: 15–40 seconds for moderate-complexity HTML, and Google Fonts loading via HTTP can add 10–30 seconds if fonts are not cached (documented in WeasyPrint GitHub issues #2031, #2126, #1581). The Sanity webhook to Railway has a default timeout; if the Railway endpoint takes too long to respond, Sanity retries. But the bigger risk is the Publisher *background task* timing out: if Railway's process manager kills the task after 30–60 seconds, the PDF is never generated and `problemPdf` is never written to Sanity. The issue publishes without the PDF download button working.

**Why it happens:**
Webhook-triggered tasks have tight timeout budgets. WeasyPrint's remote font loading creates unpredictable latency. The brief notes this risk but no specific solution is locked.

**How to avoid:**
1. Bundle the issue's fonts into the WeasyPrint HTML template as base64-encoded inline font-face declarations. Never load Google Fonts remotely during PDF generation. Pre-download the fonts when the issue draft is created (Phase 6 task: font pre-fetcher).
2. Set WeasyPrint's URL fetcher to block all external HTTP requests: use `presentational_hints=True` and a custom `url_fetcher` that only allows `data:` URIs and local file paths.
3. Run PDF generation asynchronously and poll for completion: Publisher fires off the PDF task, immediately updates Convex `pipelineRuns.pdfStatus = 'generating'`, returns 200 to Sanity. A separate polling loop checks every 10 seconds and updates `pdfStatus = 'complete'` when done.
4. Sanity webhook must return 200 within 10 seconds (Sanity's timeout). All actual work must happen in background tasks.

**Warning signs:**
- `/problem-statement-pdf` download button on the issue page returns 404 (field is null)
- WeasyPrint process shows > 30 seconds in Railway logs
- Railway logs show "Process killed" or memory OOM during PDF generation

**Phase to address:** Phase 6 (PDF generation) — font bundling strategy must be decided before the first WeasyPrint template is written

**Type:** Operational (risk on every publish)

---

## Category 7: Human Bottleneck

### Pitfall 7.1: Andrew Offline, No Issue Ships, No Communication to Readers

**Severity: HIGH**

**What goes wrong:**
Andrew is the sole publish gate. If he is offline (vacation, sick, emergency) for one or two Thursdays, no issues ship. The cadence breaks. There is no backup reviewer, no communication to readers that this week's issue is delayed, and no automation that can even draft a "we'll be back" notice. The weekly cadence is the brand promise — "every Thursday" is how readers know to return. A missed week without communication erodes trust.

**Why it happens:**
The brief intentionally makes Andrew the single gate ("only Andrew can flip status to published"). The intent is brand integrity, but the consequence is cadence fragility. No fallback workflow is specified.

**How to avoid:**
1. Create a lightweight "delay notice" Sanity document type or a static page that Andrew can publish in under 2 minutes from his phone: a single-field document that, when published, shows a banner on the site saying "This week's issue is coming [date]." This does not require another person.
2. Define a "vacation buffer": if Andrew knows he'll be offline, he can run the pipeline a week early, do his review, and schedule the issue publish for next Thursday (Sanity supports scheduled publishing in Sanity v3).
3. Document (not necessarily build) what a "backup editor" workflow would look like if ever needed: what Sanity permissions they'd need, what the review checklist is.

**Warning signs:**
- `pipelineRuns` in Convex showing `awaiting-review` status for > 5 days (Thursday → Tuesday)
- Andrew's last Sanity Studio activity was > 3 days ago on a week when the pipeline has completed
- No alert mechanism for "pipeline complete but not yet reviewed"

**Phase to address:** Phase 4 (Pipeline skeleton — add Convex-based notification when pipeline reaches `awaiting-review`); Sanity scheduled publishing should be verified in Phase 1/2

**Type:** Operational

---

### Pitfall 7.2: Andrew Misses a Broken Field in the 10-Section Draft

**Severity: MEDIUM**

**What goes wrong:**
Andrew reviews a 10-section issue draft in Sanity Studio. The pipeline completed with a partial failure — GameWriter returned a minimal stub, or FounderBio returned a voice-correct but factually wrong section. Andrew doesn't notice because he's reading for voice/tone, not doing a forensic audit of every sentence's sourcing. The issue publishes with the broken section.

**Why it happens:**
Human reviewers under time pressure scan, not audit. The Studio presents all sections as equally complete fields. Nothing visually distinguishes a section that passed QA from a section that failed QA or had a factual flag.

**How to avoid:**
1. In Sanity Studio, render QA corrections inline in the relevant section fields. If `qaCorrections` for the FounderBio section has any items with `severity: 'major'`, the FounderBio field shows a red warning banner in Studio.
2. Add a pre-publish validation rule to the `weeklyIssue` document: cannot flip `status` to `published` if any field has an outstanding `severity: 'major'` QA flag (unless Andrew explicitly acknowledges and overrides).
3. Surface a "Pipeline summary" tab in the Studio issue view: a single-screen dashboard showing: sections complete / failed, QA flags per section, factual verification status for founder/case study, game validation result.

**Warning signs:**
- Andrew's average review time drops below 10 minutes (insufficient for 10 sections)
- Issues with QA-flagged content go live without any Andrew edits in the flagged sections
- Andrew's Sanity edits show diffs only in the first 2–3 sections (scanning, not reviewing all)

**Phase to address:** Phase 9 (Deliberation layer — Andrew's review interface improvements are in this phase per the build sequence)

**Type:** Operational

---

## Category 8: Three-Datastore Drift (Sanity / Convex / Supabase)

### Pitfall 8.1: `runId` Mismatch Between Sanity and Convex Breaks Deliberation Layer

**Severity: HIGH**

**What goes wrong:**
The deliberation layer on the issue page works by: (1) fetching the issue from Sanity, which includes `pipelineMetadata.runId`, then (2) using that `runId` to query Convex for deliberation events. If the `runId` in Sanity doesn't match the `runId` used to write events to Convex — perhaps because the pipeline writes to Sanity last and generates a new `runId` during the Sanity write step — the deliberation layer returns zero events for every issue.

**Why it happens:**
The `runId` must be generated at the start of the pipeline run and passed consistently through all writes (to both Convex and Sanity). If `runId` is generated multiple times (e.g., once for Convex mutations at the start, then a different UUID is generated for the Sanity write at the end), the two stores are out of sync.

**How to avoid:**
1. Generate `runId` exactly once: at pipeline start, as the first action in the LangGraph graph. It must be the first field set in `DispatchState`.
2. Every Convex mutation and every Sanity document write must use the same `runId` from state. Prohibit any code that calls `uuid()` or `str(uuid4())` after the initial generation.
3. Add an integration test: run the pipeline stub, assert that the `runId` in the Sanity draft equals the `runId` in all Convex mutation payloads for that run.

**Warning signs:**
- Deliberation layer renders empty on the published issue page
- Convex `deliberationEvents` table has events but Sanity `pipelineMetadata.runId` doesn't match any `runId` in Convex
- Two different UUIDs appear in the same pipeline run's logs

**Phase to address:** Phase 4 (Pipeline skeleton — `runId` generation is a foundational contract)

**Type:** Build (must be correct from the first pipeline skeleton implementation)

---

### Pitfall 8.2: Charity Created in Sanity During Pipeline Run, Duplicate on Re-Run

**Severity: MEDIUM**

**What goes wrong:**
At the end of the pipeline, all Scout candidates are written to Sanity as `charity` documents. If the pipeline fails after creating Sanity charities but before completing the `weeklyIssue` write (e.g., QA agent times out), and the pipeline is re-run, it creates duplicate `charity` documents for the same charities. Sanity has no unique constraint enforcement by default — two documents with the same `charity.name` can coexist.

**Why it happens:**
Sanity document creation is not idempotent by default. The pipeline uses `createIfNotExists` or `createOrReplace` in some contexts (API_CONTRACTS.md §2.1) but if this is not consistently applied, re-runs create duplicates.

**How to avoid:**
1. Use `client.createIfNotExists()` for all charity writes, with the charity's `_id` deterministically derived from the charity name + EIN: `charity_${slugify(charityName)}_${ein}`. This ensures the same charity always maps to the same Sanity document ID.
2. Use `client.patch(id).setIfMissing({...}).commit()` to update existing charity documents, never `client.create()` which always creates a new document.
3. Before any charity write, query Sanity for existing charities with the same name: `*[_type == "charity" && name == $name][0]`. If found, update instead of create.

**Warning signs:**
- Sanity `charity` document count grows by more than 5 per week (Scout finds 3–5 candidates, only one should be "new")
- `/charities` page shows duplicate charity entries
- Archive shows same charity featured in two different weeks

**Phase to address:** Phase 4 (Pipeline skeleton — Sanity write functions must be idempotent from day one)

**Type:** Build + Operational

---

### Pitfall 8.3: Supabase Role Undefined, Tables Never Created, Pipeline Fails Silently

**Severity: MEDIUM**

**What goes wrong:**
The brief lists Supabase as "Pipeline database" but no schema, tables, or API contract specifies what it stores. If developers build the pipeline assuming Supabase handles something specific (session state, pipeline checkpoints, agent memory) but no Supabase tables exist, the pipeline either fails at first run or silently skips persistence without error. The CONCERNS.md notes this gap explicitly (Stack Drift Risk section).

**Why it happens:**
Supabase is listed in the stack but its role is undefined in all contracts. This creates ambiguity: some developers assume it's the primary pipeline state store; others assume Convex handles it all and Supabase is unused.

**How to avoid:**
1. Before Phase 4, make a binding decision: what does Supabase store? Given Convex handles all real-time pipeline observability, a natural role for Supabase is **durable pipeline checkpoints** (what LangGraph state has been persisted, enabling resume-after-failure). If Supabase is not needed for v1, remove it from the stack to avoid confusion.
2. If Supabase is used, create a `supabase/migrations/` directory in Phase 4 alongside the LangGraph code, and write the migration before any pipeline code uses it.
3. Add to the pre-run checklist: verify Supabase connection and table existence before pipeline starts.

**Warning signs:**
- Pipeline code imports `supabase` Python SDK but no tests cover Supabase reads/writes
- Environment has `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set but no schema file exists
- Pipeline fails with `relation "pipeline_checkpoints" does not exist` at runtime

**Phase to address:** Phase 4 (Pipeline skeleton — must clarify Supabase role on day one of pipeline implementation)

**Type:** Build

---

## Category 9: Weekly Cadence Break Risks

### Pitfall 9.1: Thursday Publish Window Missed Due to Pipeline Duration Creep

**Severity: HIGH**

**What goes wrong:**
The brief describes a Thu→Thu window for pipeline + Andrew review + publish. The pipeline currently has an estimated run time of 25–45 minutes based on 9 agents + 2 web search passes. But as prompts grow more complex, context windows fill up, and retry logic adds iterations, run times can creep to 90+ minutes. Combined with Andrew's review (assume 30–60 minutes) and PDF generation + deploy, the total window can exceed 3 hours. If Andrew starts the pipeline at 7 PM Thursday and it takes 3 hours, publish happens at 10 PM — technically "Thursday" but not the "first thing Thursday morning" cadence readers expect.

**Why it happens:**
Each phase of optimization adds to prompt size. The Calibrator style brief grows. The Researcher returns more verifiable facts. Each addition is justified individually but adds up.

**How to avoid:**
1. Set a hard SLA: pipeline must complete within 45 minutes from trigger to `awaiting-review`. Track actual duration in Convex `pipelineRuns` and alert if it exceeds 60 minutes.
2. Add a `--fast` mode to the pipeline: reduced web search iterations, shorter output limits per section. Used if the Thursday deadline is tight.
3. Run the pipeline on Wednesday night, not Thursday morning. Andrew reviews Thursday morning, publishes Thursday afternoon. This gives a 12-hour buffer.

**Warning signs:**
- Average pipeline duration increasing week-over-week (track in Convex)
- Andrew pinging the status of the pipeline > 45 minutes after trigger
- Pipeline runs that complete close to midnight Thursday

**Phase to address:** Phase 5 (Agent quality — prompt size optimization) and Phase 4 (skeleton — duration tracking from day one)

**Type:** Operational

---

### Pitfall 9.2: Bonus Type Rotation Breaks Without Prior-Run Context

**Severity: LOW**

**What goes wrong:**
The Calibrator must never repeat a bonus type two weeks in a row. It receives "previous bonus types" as input. If the Convex `pipelineRuns` table is queried for this and the query fails (service disruption, wrong runId, Convex outage), the Calibrator receives an empty previous-history array. It may then select `jingle` two weeks in a row. Andrew might not notice (he's not tracking which week had which bonus type from memory). Readers notice.

**Why it happens:**
The rotation constraint depends on external state lookup. Any failure in that lookup silently removes the constraint.

**How to avoid:**
1. Store the last `bonusType` in Sanity on the `weeklyIssue` document that was most recently published — not just in Convex (which is transient). Read from Sanity (durable) not Convex (ephemeral) for this historical lookup.
2. Calibrator prompt should include explicit last-3-issues bonus types injected from Sanity at pipeline start. If Sanity lookup fails, halt the pipeline rather than proceeding with potentially invalid rotation.
3. Add a Sanity validation rule: when a `weeklyIssue` is published, check if the previous published issue had the same `bonusType`. If so, surface a warning in Studio before publish.

**Warning signs:**
- Two consecutive published issues have the same `bonusType`
- Calibrator output log shows `previousBonusTypes: []` (empty — lookup failed)

**Phase to address:** Phase 5 (Calibrator agent — historical lookup from Sanity, not Convex)

**Type:** Operational

---

### Pitfall 9.3: Scout Finds No Eligible Charities, Pipeline Stalls Without Alert

**Severity: MEDIUM**

**What goes wrong:**
Scout must find 3–5 candidate charities that meet all criteria: registered nonprofit, $100K–$1M assets, interesting/odd mission, low visibility, not already featured. As the issue archive grows (50+ issues), the pool of "not already featured" charities narrows. Web search also varies in quality — some weeks Tavily/Brave returns only well-known charities. If Scout returns only 1 candidate (or 0), the Editor cannot hold a meaningful deliberation. The pipeline either stalls at Editor gate 1 or proceeds with a weak selection.

**Why it happens:**
Scout's search quality depends on current web search engine results, which are non-deterministic. As the featured-charity exclusion list grows, valid search terms shrink.

**How to avoid:**
1. Scout should write candidates to Convex `pitchLog` *incrementally* as it finds them, not only at the end. This lets Andrew see partial results in real-time.
2. If Scout finds fewer than 3 candidates after its allotted search budget, it should automatically retry with broadened criteria (relaxed asset range: $50K–$2M; relaxed geography; no "obscure" constraint) and flag this in `pipelineRuns`.
3. Maintain a curated "charity seed list" in Sanity: Andrew can add promising charities he's encountered that Scout should try first before doing open web search. This creates a warm-start option that improves over time.

**Warning signs:**
- Scout `pitchLog` entries for a run total < 3
- Editor gate 1 fires "no winner" pause more than once per month
- Scout tool_use logs show repeated searches returning the same previously-featured charities

**Phase to address:** Phase 5 (Scout agent — fallback search logic and seed list concept)

**Type:** Operational (risk increases as archive grows)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode voice rubric in QA prompt (not in config) | Faster Phase 5 | Requires code deploy to adjust voice after launch | Acceptable for v1; add Sanity-configurable rubric in v2 |
| Skip font pre-fetching; load fonts in WeasyPrint via HTTP | Simpler Phase 6 implementation | Flaky PDF generation; 15–30s added latency per run | Never acceptable — font HTTP loading is a known WeasyPrint failure mode |
| Use floating OpenRouter model aliases (not pinned versions) | Always gets "latest" model | Voice changes without warning when model updates | Never acceptable for Calibrator, Editor, QA; acceptable for non-voice agents |
| Write charity data once and never update it in Sanity | No update logic to build | Stale financial data in charity archive over time | Acceptable for v1; add annual refresh job in v2 |
| No Convex subscription throttling on deliberation layer | Simpler implementation | Cost spike if many readers watch live pipeline run | Acceptable for v1 at low traffic; address before any press/virality event |
| Disable Stripe signature verification in dev environment | Faster webhook testing | Accidentally ships to production with verification disabled | Never acceptable — use Stripe CLI for local testing instead |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Sanity webhook → Railway | Not setting SANITY_WEBHOOK_SECRET; verifying signature manually | Use Sanity's official `@sanity/webhook` package which handles HMAC-SHA256 verification |
| OpenRouter | Using `model: "claude-3-5-sonnet"` (alias) | Pin to exact version string; store resolved version in `pipelineRuns` |
| Stripe + Next.js App Router | Handling webhook in a `route.ts` that uses `bodyParser` | Webhook handler must receive raw body, not parsed JSON; use `request.arrayBuffer()` and `Buffer.from()` |
| WeasyPrint | Loading Google Fonts via `@import url('https://fonts.googleapis.com/...')` in the HTML template | Embed fonts as base64 `@font-face` declarations; no remote HTTP in WeasyPrint templates |
| Convex from FastAPI | Using Convex HTTP API from Python without official SDK | Use Convex's HTTP action client or the `convex-py` SDK; do not hand-roll HTTP requests |
| Vercel deploy hook | Firing it immediately after Sanity publish | Add 30-second delay, or switch to `revalidatePath`-based ISR to avoid CDN propagation race |
| iframe srcdoc | Testing sandbox in Chrome, assuming it's consistent | Test in Firefox and Safari; sandbox behavior for srcdoc can differ in edge cases |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Convex `deliberationEvents.byRunId` returns all events without pagination | UI renders 200+ list items on issue page; jank on scroll | Add `limit: 50` and pagination to the Convex query in Phase 3 | With any run that generates > 30 events (every run) |
| WeasyPrint process not isolated from Railway web process | PDF generation monopolizes Railway instance; webhook responses time out | Run WeasyPrint in a dedicated background worker or Railway private service | From the first PDF generation under load |
| Sanity GROQ queries fetching entire issue document for every `/archive` page row | Slow archive page load; high Sanity CDN bandwidth | Add projection to GROQ: `{ _id, slug, issueNumber, charityName, publishedAt, theme.primaryColor }` | After ~20 issues in the archive |
| OpenRouter retries on non-deterministic errors (rate limit) causing duplicate LLM calls | Agent output written twice to Convex; contradictory deliberation entries | Implement idempotent agent invocation: check if output for this `runId + agentId` already exists before calling | On any run where OpenRouter rate-limits mid-pipeline |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `sandbox="allow-scripts allow-same-origin"` on game iframe | Complete sandbox defeat; game has parent DOM access | Exact attribute must be `sandbox="allow-scripts"` only; lint rule to prevent `allow-same-origin` |
| CSS custom property values injected without hex validation | CSS injection: layout spoofing, phishing overlay | Validate all color values: `/^#[0-9A-Fa-f]{6}$/`; use DOM `setProperty` instead of template literal in `<style>` |
| Stripe webhook handler without `stripe.webhooks.constructEvent()` | Any client can fake a payment completion | Unconditional signature verification; no environment gates |
| Sanity write API token committed to repo | Full CMS write access exposed | Use Vercel/Railway secret management; rotate token if ever found in git history |
| DesignAgent font name passed to Google Fonts API without validation | SSRF vector if the font field is used to construct a URL | Validate font name against `/^[A-Za-z0-9 ]+$/` before any URL construction |
| LLM-generated relative URLs inside srcdoc iframe | Unauthorized GET requests to Next.js app from iframe context | GameWriter validator must reject any `src=` or `href=` attributes that are not `data:` URIs |

---

## "Looks Done But Isn't" Checklist

- [ ] **Stripe integration:** Webhook handler returns 200 immediately but fulfillment is async — verify background task actually completes, not just that the endpoint returns 200
- [ ] **Game iframe:** GameWriter outputs "valid HTML" — verify it passes the sandbox validator (no external URLs, no window.parent, no form elements)
- [ ] **Theme injection:** DesignAgent outputs "valid hex colors" — verify the injected CSS renders correctly in all four color fields simultaneously, not just the primary color
- [ ] **PDF generation:** Publisher "uploads PDF to Sanity" — verify the `problemPdf` field on the published `weeklyIssue` is non-null and the download URL resolves to an actual PDF, not a 404
- [ ] **Deliberation layer:** Convex subscriptions "connect to the issue" — verify the `runId` in Sanity matches the `runId` in Convex for a specific issue (not just that the component renders)
- [ ] **Factual verification:** Researcher "provides verifiable facts" — verify that `founderName` was confirmed against the charity's official website, not just that the field is non-empty
- [ ] **Bonus type rotation:** Calibrator "never repeats two weeks in a row" — verify the logic by testing with a mock `previousBonusTypes: ['jingle', 'jingle']` (two jingles in history) and confirming Calibrator selects a different type
- [ ] **Sanity webhook signature:** Publisher "verifies Sanity webhook" — verify by sending an unsigned POST and confirming the handler returns 400, not 200

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hallucinated founder published, real person complains | HIGH | Immediately unpublish issue; manually research correct founder; re-publish corrected version; add charity to "manually verified" list |
| Game iframe exploited (CSS injection or parent DOM access) | HIGH | Immediately replace `embedCode` with a static placeholder in Sanity; audit all previous game embeds; patch validator before next run |
| Stripe webhook delivering duplicates, orders doubled | MEDIUM | Query Stripe dashboard for actual confirmed payments; reconcile against order table; refund any double-charged customers |
| PDF generation broken, deploy went live without PDF | LOW | Re-trigger Publisher by unpublishing and re-publishing in Sanity (with debounce bypass); or manually run Publisher script against the issue slug |
| Voice drift discovered after 4 issues | HIGH | Audit all 4 issues with voice rubric; identify which issue introduced drift; roll back Calibrator prompt to pre-drift version; re-edit affected issues in Sanity |
| Deploy CDN race: site shows wrong issue content | LOW | Manually trigger new Vercel deploy from Vercel dashboard; verify `useCdn: false` is set in the build-time Sanity client |
| Convex subscription showing no deliberation data | MEDIUM | Query Convex directly by `runId` from Convex dashboard; compare `runId` with Sanity's `pipelineMetadata.runId`; if mismatch, update Sanity field manually |

---

## Pitfall-to-Phase Mapping

| Pitfall | Severity | Prevention Phase | Verification |
|---------|----------|------------------|--------------|
| 1.1 Calibrator brief contamination downstream | HIGH | Phase 4 (prompt construction functions) | Run a test pipeline with emotionally-charged Scout output; confirm OriginStory does not reflect Scout's tone |
| 1.2 Voice drift issue-to-issue | HIGH | Phase 5 (Calibrator voice constraints hardcoded) | Compare Calibrator brief text week 1 vs week 4; diff should show only bonusType/visualDirection changes |
| 1.3 Parallel phase partial failure | HIGH | Phase 4 (validation node) + Phase 7 (GameWriter retry) | Kill GameWriter mid-run in a test; confirm Studio shows warning and status is `partial-failure` |
| 1.4 OpenRouter model version silently changes | MEDIUM | Phase 5 (pin model versions) | Confirm `pipelineRuns.modelVersions` field shows exact version strings, not aliases |
| 1.5 Per-run cost runaway | MEDIUM | Phase 4 (iteration limits) + Phase 5 (budget logging) | Run Scout with a mock that always returns unsatisfactory results; verify it stops after 8 tool calls |
| 2.1 Hallucinated founder | HIGH | Phase 5 (post-Researcher verification step) | Provide Researcher with a charity that has no public founder info; verify it returns `founderName: null` not an invented name |
| 2.2 Stale charity financial data | MEDIUM | Phase 5 (Scout date-stamping) + Phase 2 (schema) | Confirm `assetRangeYear` field exists and is populated on all charity documents |
| 2.3 Invented case study subject | HIGH | Phase 5 (Researcher verification) | Provide Researcher with a charity that uses only anonymous testimonials; verify `caseStudySubjectVerified: false` |
| 3.1 srcdoc same-origin with parent | HIGH | Phase 7 (sandbox config locked) | Check final iframe HTML in browser: `allow-same-origin` must not appear; `window.parent` in console must fail |
| 3.2 Relative URLs in game HTML | MEDIUM | Phase 7 (GameWriter validator) | Pass game HTML with a `<img src="/test.png">` to validator; verify it is rejected |
| 3.3 Game not mobile-responsive | LOW | Phase 7 (GameWriter prompt + iframe container) | Test on 375px viewport; game must not require horizontal scroll |
| 4.1 CSS custom property injection | MEDIUM | Phase 2 (theme validation) | Inject `primaryColor: "red; } body { display: none; }"` via Sanity; verify page renders normally with fallback color |
| 4.2 Invalid Google Font name | LOW | Phase 5 (DesignAgent validation) + Phase 2 (safe list) | Set `fontDisplay: "Gotham"` in Sanity; verify site renders with fallback font, not broken layout |
| 4.3 Low-contrast theme | LOW | Phase 5 (DesignAgent contrast check) | Input very pale yellow + white; verify contrast checker fails and DesignAgent is forced to retry |
| 5.1 Fulfillment race condition | MEDIUM | Phase 8 (static thank-you page) | Complete test checkout; immediately check `/shop/thank-you` before webhook fires; verify no order-not-found error |
| 5.2 Stripe webhook signature bypassed | HIGH | Phase 8 (unconditional verification) | POST to webhook endpoint without Stripe-Signature header; verify 400 response |
| 6.1 CDN propagation race | MEDIUM | Phase 6 (30s delay or useCdn:false) | Publish test issue; trigger deploy immediately; verify deployed site shows new issue content |
| 6.2 Deploy storm from rapid re-publish | LOW | Phase 6 (debounce logic in Publisher) | Publish, edit, re-publish within 60 seconds; verify only one Vercel build runs |
| 6.3 PDF generation timeout | HIGH | Phase 6 (font bundling, async generation) | Run PDF generation against a template with a Google Font; verify it completes in < 30 seconds with bundled fonts |
| 7.1 Andrew offline, no issue ships | HIGH | Phase 4 (awaiting-review alert) + Phase 2 (scheduled publish) | Verify Sanity supports scheduled publishing for weeklyIssue documents |
| 7.2 Andrew misses broken field in review | MEDIUM | Phase 9 (Pipeline summary tab in Studio) | Introduce a QA major violation in a test run; verify Studio shows the warning before Andrew can publish |
| 8.1 runId mismatch Sanity/Convex | HIGH | Phase 4 (single runId generation) | Run a test pipeline; compare `weeklyIssue.pipelineMetadata.runId` in Sanity against all Convex event runIds |
| 8.2 Duplicate charity documents | MEDIUM | Phase 4 (idempotent Sanity writes) | Trigger pipeline twice for the same charity; verify Sanity has only one charity document |
| 8.3 Supabase role undefined | MEDIUM | Phase 4 (decision: define or remove Supabase) | Before Phase 4 code starts: confirm what tables Supabase stores, or remove from stack |
| 9.1 Pipeline duration creep | HIGH | Phase 5 (duration SLA tracking) | Track `pipelineRuns.duration` week-over-week; alert at 60-minute threshold |
| 9.2 Bonus type rotation breaks | LOW | Phase 5 (Calibrator reads from Sanity history) | Simulate Convex outage; verify Calibrator still has correct previous bonus types from Sanity |
| 9.3 Scout finds no eligible charities | MEDIUM | Phase 5 (broadened fallback criteria + seed list) | Run Scout with exclusion list of 100 charities; verify fallback criteria activates |

---

## Sources

- [arxiv 2604.01350 — Unintentional Cross-User Contamination in Shared-State LLM Agents (April 2026)](https://arxiv.org/abs/2604.01350)
- [arxiv 2410.07283 — Prompt Infection: LLM-to-LLM Prompt Injection in Multi-Agent Systems](https://arxiv.org/html/2410.07283v1)
- [MDN — HTMLIFrameElement: srcdoc property and sandbox attributes](https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc)
- [MDN — iframe sandbox: allow-scripts without allow-same-origin](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)
- [GHSA-97v6-998m-fp4g — CSS Custom Property Injection via apostrophecms/color-field](https://github.com/apostrophecms/apostrophe/security/advisories/GHSA-97v6-998m-fp4g)
- [OWASP — Testing for CSS Injection](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/11-Client_Side_Testing/05-Testing_for_CSS_Injection)
- [HackTricks — Iframes in XSS, CSP and SOP](https://book.hacktricks.xyz/pentesting-web/xss-cross-site-scripting/iframes-in-xss-and-csp)
- [Stripe API Reference — Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [WeasyPrint GitHub Issue #2031 — Timeout on PDF generation via remote URL fetching](https://github.com/Kozea/WeasyPrint/issues/2031)
- [WeasyPrint GitHub Issue #2126 — Google Fonts loading failures in production](https://github.com/Kozea/WeasyPrint/issues/2126)
- [Sanity Community — CDN propagation race with Vercel deploy hooks](https://www.sanity.io/answers/sanity-webhook-to-a-vercel-deploy-url-trigger-not-working)
- [Sanity + Vercel on-demand ISR via GROQ-powered webhooks](https://dev.to/valse/nextjs-on-demand-isr-by-sanity-groq-powered-webhooks-221n)
- [Nolo — AI Defamation: Hallucinated False Statements About Real People](https://www.nolo.com/legal-encyclopedia/artificial-intelligence-defamation-and-libel-is-anyone-liable.html)
- [Journal of Free Speech Law — Defamation by Hallucination in AI Reasoning Models](https://www.journaloffreespeechlaw.org/lidskydaves.pdf)
- [OpenRouter — State of AI 2025, token usage patterns in agentic inference](https://openrouter.ai/state-of-ai)
- [MindStudio — AI Agent Token Budget Management to prevent cost runaway](https://www.mindstudio.ai/blog/ai-agent-token-budget-management-claude-code)
- [Stripe Webhooks: Complete Guide — race conditions, idempotency, retry behavior](https://www.magicbell.com/blog/stripe-webhooks-guide)
- [Next.js — Font Optimization and Google Fonts CSS variables](https://nextjs.org/docs/app/getting-started/fonts)
- [Project CONCERNS.md — build-time risk analysis (Eisenbalm codebase, 2026-05-09)](/.planning/codebase/CONCERNS.md)

---

*Pitfalls research for: multi-agent LLM editorial pipeline (The Eisenbalm Dispatch)*
*Researched: 2026-05-09*
