# Codebase Concerns

**Analysis Date:** 2026-05-09

## Overview

The Eisenbalm Dispatch is in early scaffolding stage with design and schema artifacts in place, but no implementation code. The concerns documented here are forward-looking risks identified from the build brief (`docs/CLAUDE_CODE_BRIEF.md`), API contracts (`docs/API_CONTRACTS.md`), and schema definitions (`convex/schema.ts`, `schemas/`). Each concern describes what could fail during build or operation, with references to specific contract boundaries and design decisions.

---

## Pipeline Reliability

**Severity: HIGH**

**What could go wrong:**
The nine-agent LangGraph pipeline (`docs/CLAUDE_CODE_BRIEF.md`, lines 78–188) is sequential-then-parallel with multiple external dependencies:
- **9 Claude API calls** via OpenRouter (lines 87–171)
- **Web search calls** in Scout (line 96) and Researcher (line 125) agents
- **Human gate at Editor gate 1** (line 109–117) — pipeline pauses if no winner selected
- **Sanity writes** after selection and after QA (lines 188–195)
- **Convex mutations** for event streaming (per `docs/API_CONTRACTS.md` section 3)
- **PDF generation** by Publisher agent (lines 203–210)

**Failure modes:**
1. **OpenRouter rate limiting or API errors** → phase 1 stalls, no charity selected
2. **Scout web search timeout** → Scout cannot find candidates, Editor has no options
3. **Partial phase 2 failure** (e.g., GameWriter fails, OriginStoryWriter succeeds) → inconsistent issue draft
4. **Sanity write fails** → issue never appears in Studio for Andrew to review
5. **Convex mutation failures** → deliberation layer is blank even though pipeline succeeded
6. **No retry or fallback strategy specified** → single failure = manual intervention required

**Contract references:**
- `docs/API_CONTRACTS.md` §2 (Pipeline → Sanity writes) — specifies `try/except` wrapping but no retry strategy
- `docs/API_CONTRACTS.md` §3 (Pipeline → Convex mutations) — lists mutations as "non-blocking," meaning failures are ignored, but no alerts
- `docs/API_CONTRACTS.md` §7 (Error handling rules, lines 1295–1307)
- `convex/schema.ts` lines 6–20 (`pipelineRuns` table) — tracks status but no `retryCount` or `lastError` field

**When to address:**
- **Phase 4** (Pipeline skeleton, `docs/CLAUDE_CODE_BRIEF.md` line 349) — implement retry logic with exponential backoff for OpenRouter and Sanity calls
- **Phase 5** (Agent quality) — add circuit breaker for web search; fallback to previous candidates if Scout times out
- Add structured error handling with alerts to Convex `pipelineRuns.status='failed'` with detailed `errorMessage` (already in schema, line 17)

**Watch for:**
- OpenRouter API rate limits (check monthly quota early)
- Tavily/Brave search rate limits (recommend Tavily due to lower cost per query)
- Sanity write latency (batch operations to reduce round trips)
- Silent Convex mutation failures (log every mutation result, alert if `status !== 200`)

---

## Voice Consistency / QA Agent Bottleneck

**Severity: HIGH**

**What could go wrong:**
Jesse's voice is "dry, precise, absurdly serious — no winking" (`docs/CLAUDE_CODE_BRIEF.md`, line 361). This voice is **fragile in LLM output** — slight variations in temperature, model choice, or prompt can cause:
- Tone drift (sarcasm, irony, cuteness instead of flatness)
- Inconsistent formality (too casual or overly formal)
- Brand pivot if voice drifts significantly

The **only automated guard** is the QA agent (lines 176–181), which is invoked AFTER all nine content agents have run. QA makes corrections (`docs/API_CONTRACTS.md` §3.6, `convex/schema.ts` lines 61–79), but:
1. QA corrections are a record of failures, not prevention
2. If QA misses a voice violation, the content goes live with Andrew's approval
3. No automated "voice freshness" metric — QA relies on Claude's judgment

**Contract references:**
- `docs/API_CONTRACTS.md` §7, `QACorrection` TypedDict (line 1245–1252) — `severity` field has levels, but no escalation rule for "major" voice violations
- `convex/schema.ts` lines 61–79 (`qaCorrections` table) — stores corrections but no blocking logic
- `docs/CLAUDE_CODE_BRIEF.md` lines 176–181 (QA agent) — no description of what "voice alignment" means quantitatively

**When to address:**
- **Phase 5** (Agent quality) — define a "voice rubric" with 3–5 concrete examples of Jesse voice vs. non-Jesse voice. Test against these examples in unit tests for each writer.
- **Phase 9** (Deliberation layer) — surface QA corrections prominently in the deliberation UI so Andrew sees every voice-related flag
- Add a `voiceViolationDetected` boolean to `qaCorrections` table; escalate to Andrew if true

**Watch for:**
- High QA correction rate (>30% of sections flagged) — sign that writer prompts are drifting
- Andrew frequently overriding QA corrections — sign that QA's definition of "voice" doesn't match the magazine's actual voice
- Voice feedback from readers — collect early and adjust rubric

---

## Game Iframe Sandbox Escape Risk

**Severity: MEDIUM (HIGH if GameWriter is not careful)**

**What could go wrong:**
The GameWriter agent (`docs/CLAUDE_CODE_BRIEF.md` lines 150–157) generates `embedCode` (HTML/JS) that is rendered as:

```typescript
<iframe srcdoc={embedCode} sandbox="allow-scripts"></iframe>
```

This is specified in the brief (line 233 of brief) and schema (`schemas/weeklyIssue.ts`, line 188–194).

**The risk:** GameWriter output is **untrusted LLM output** rendered directly in the user's browser. An XSS vulnerability in the iframe sandbox could allow:
1. **DOM access escape**: `sandbox="allow-scripts"` allows script execution. If the script references the parent document, it could access other tabs or user data
2. **CSS injection**: Malicious CSS in the game could overlay a phishing form
3. **Event listener injection**: The game could listen for keystrokes if not properly sandboxed
4. **No CSP in iframe source**: The `srcdoc` attribute bypasses CSP on the parent page

**Contract references:**
- `schemas/weeklyIssue.ts` lines 188–194 (`game.embedCode` field) — no validation that `embedCode` is valid HTML or free of script tags with unsafe event handlers
- `docs/CLAUDE_CODE_BRIEF.md` line 156 — "The game must work inside a sandboxed `<iframe srcdoc="...">`. No external dependencies. No CDN links."
  - This constraint is correct but enforced only by prompt, not schema validation
  - No test in pipeline to verify GameWriter output is self-contained

**When to address:**
- **Phase 7** (Game rendering) — implement a static HTML validator that:
  1. Parses embedCode as HTML
  2. Rejects any `<script>` tags with `src=` (external scripts)
  3. Rejects any event handler attributes (`on*`) that reference parent/window
  4. Rejects any `<form>` with `action=` (form submission to attacker domain)
  5. Whitelists only: `<div>`, `<canvas>`, `<svg>`, `<style>`, `<script>` (inline only, no `src`)

- Add `gameHtmlValidation` to the Convex `deliberationEvents` table (new eventType) to log validation results per issue
- Render the iframe with `sandbox="allow-scripts"` AND add `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'">`  inside the iframe body

**Watch for:**
- GameWriter outputting external CDN links (violates brief constraint)
- Inline scripts with global variable pollution (e.g., `window.alert()` calls)
- Forms or inputs in the game (unnecessary for gamification, high risk)

---

## Charity Factual Accuracy / Hallucination Risk

**Severity: HIGH**

**What could go wrong:**
Two agents pull live data about charities:

1. **Scout agent** (lines 92–100): searches Charity Navigator, GuideStar, and web
   - Output: candidate array with `foundingYear`, `assetRange`, `missionStatement`, `focusArea` (line 99)
   - These are written to Sanity `charity` document (docs/API_CONTRACTS.md §2.1, lines 272–292)

2. **Researcher agent** (lines 124–129): "Deep dives the winning charity: founding story details, founder background, real outcomes and case study subjects"
   - Output: `ResearchOutput` with `founderName`, `founderBackground`, `caseStudySubject`, `caseStudyOutcome` (docs/API_CONTRACTS.md §7, lines 1207–1214)

**Hallucination vectors:**
1. **Founder name or background fabricated** → defamation risk if a real person exists with that name in the same geographic area
2. **Asset range wildly inaccurate** → published as fact on `/charities/[slug]` page (docs/CLAUDE_CODE_BRIEF.md line 219), visible to readers
3. **Case study subject invented** → "proof of existence" is false; Researcher claim is "one real person, one real outcome" (line 149)
4. **Founding year off by decades** — appears on public charity page

**Contract references:**
- `schemas/charity.ts` lines 44–60 (numeric/string fields with no citation or source URL)
- `docs/API_CONTRACTS.md` §2.1 (write_charity function, lines 272–292) — no `sourceUrl` or `verifiedBy` field to track where data came from
- `docs/API_CONTRACTS.md` §7, `ResearchOutput` (lines 1207–1214) — includes `verifiedFacts: list[str]` and `sources: list[str]`, but pipeline write function does not preserve these
- `docs/CLAUDE_CODE_BRIEF.md` line 149 — "One real person, one real outcome. Proof of existence." — but no validation that the person actually exists

**When to address:**
- **Phase 5** (Agent quality) — implement a fact-checking step before QA:
  1. Scout: for each candidate, return `{ factsClaimed: list[str], sourceUrls: list[str] }`
  2. Researcher: return `verifiedFacts` with URLs; validate each fact is from the official charity website or Charity Navigator
  3. Add a `factCheckResult` table to Convex to log validation passes/failures
  
- **Phase 2** (Sanity schema + Studio) — add optional `charityNavigatorUrl` and `guidestarUrl` fields to `charity` (already in schema, lines 34–41 of charity.ts) — use these as the canonical data source, not hallucinated values

**Watch for:**
- Scout returning asset ranges that don't match Charity Navigator (compare in QA)
- Researcher inventing case study subjects (require Researcher to cite the charity's annual report or news article)
- Founder names that exist but are attributed wrong (cross-check with LinkedIn or charity board listings)

---

## Stripe Webhook Reliability & Fulfillment Workflow

**Severity: MEDIUM**

**What could go wrong:**
The Stripe integration is custom (no Shopify):
- Product page at `/shop` (line 222)
- Checkout via `stripe.redirectToCheckout()` or payment intent (docs/API_CONTRACTS.md §6.1, lines 1099–1117)
- Webhook handler for `checkout.session.completed` and `payment_intent.payment_failed` (§6.2, lines 1136–1170)

**Issues:**
1. **Webhook signature verification is correct** (line 1144–1148) but webhook handler only logs orders; **no fulfillment workflow specified**
   - No integration with shipping/inventory system
   - No order confirmation email
   - No tracking for whether customer received the lip balm
   - No way to handle refunds or cancellations

2. **Idempotency not enforced** — if the webhook is delivered twice, the order is logged twice
   - Stripe retries webhooks; handler should deduplicate by `session.id`

3. **Metadata field is too minimal** (line 1113) — only `source: 'eisenbalm-dispatch'`
   - Missing: `issue_number`, `charity_id` (to track which week's purchase supports which charity)
   - Missing: `customer_email` (would enable sending confirmation)

4. **Error handling is correct** (returns 200 even on internal error, per docs/API_CONTRACTS.md line 1305) but no alert mechanism
   - If fulfillment system integration breaks, no one is notified

**Contract references:**
- `docs/API_CONTRACTS.md` §6.2 (lines 1153–1170) — handler only logs; TODO: "Future: send confirmation email"
- `docs/CLAUDE_CODE_BRIEF.md` lines 284–291 (ecommerce section) — brief says "One product: Jesse A. Eisenbalm lip balm" but no details on how physical fulfillment works
- Schema: no `order` document type in Sanity or Convex to track orders, so they're only logged to console

**When to address:**
- **Phase 8** (Stripe integration) — before shipping product:
  1. Add `idempotencyKey` to webhook handler to deduplicate retries (use Stripe session ID)
  2. Create an `order` collection in Convex or Sanity with fields: `stripeSessionId`, `charityId`, `issueNumber`, `customerEmail`, `quantity`, `fulfillmentStatus` (pending/shipped/delivered)
  3. Add `issue_number` and `charity_id` to Stripe metadata (line 1113) so orders can be matched to issues
  4. Implement fulfillment webhook to a third-party service (ShipStation, Printful, etc.) or manual fulfillment queue
  5. Add webhook error alerting (send Slack/email if webhook processing fails)

**Watch for:**
- Stripe webhook delivery timeouts (current handler returns 200 immediately, good, but background task may fail)
- Duplicate orders from webhook retries
- Customer confusion about fulfillment timeline (no confirmation email)
- Charities receiving wrong donation amounts (if refunds aren't deducted)

---

## PDF Generation Performance & Reliability

**Severity: MEDIUM**

**What could go wrong:**
Publisher agent generates the Problem Statement PDF:
- Input: `pdfContent` from ProblemWriter (docs/CLAUDE_CODE_BRIEF.md line 142)
- Tool: WeasyPrint or Playwright (line 295)
- Output: PDF uploaded to Sanity (docs/API_CONTRACTS.md §2.3, lines 412–427)

**Issues:**
1. **WeasyPrint is slow** — rendering HTML to PDF can take 30–120 seconds for a complex template
   - Publisher agent is triggered by webhook (line 201), which has a timeout
   - If PDF generation exceeds timeout, webhook returns 200 but Publisher task fails silently
   - Issue never gets the `problemPdf` field populated

2. **Font availability** — Design agent specifies Google Fonts (schema weeklyIssue.ts line 89)
   - WeasyPrint must have access to Google Fonts API or cached fonts
   - If font fails to load, PDF renders with fallback font, breaking theme consistency
   - No validation that font name is valid Google Fonts name

3. **Theme injection from `issue.theme` object** — colors and fonts are CSS variables
   - Template must inject these as inline styles or `<style>` block
   - No validation that hex colors are valid (Design agent should validate, but no test)
   - CSS variable typos could render PDF with wrong colors

4. **PDF file size** — no limit specified
   - If template is complex or image-heavy, PDF could be >50MB
   - Sanity has soft limits on asset uploads (check current limits)

**Contract references:**
- `docs/API_CONTRACTS.md` §2.3 (upload_pdf_to_issue, lines 412–427) — no timeout or retry logic
- `docs/CLAUDE_CODE_BRIEF.md` lines 295–302 (PDF generation) — mentions WeasyPrint but no template path specified
- `schemas/weeklyIssue.ts` lines 85–90 (theme fields) — no validation that `fontDisplay` and `fontBody` are valid Google Fonts names
- `convex/schema.ts` — no `pdfGenerationStatus` field to track if PDF was successfully uploaded

**When to address:**
- **Phase 6** (PDF generation) — before pushing to production:
  1. Set Publisher task timeout to 5 minutes (Google Cloud Tasks default is 10 min, but start conservative)
  2. If PDF generation exceeds 3 minutes, log warning and fallback to rendering a simple PDF (text-only, no styling)
  3. Validate `theme.fontDisplay` and `theme.fontBody` against list of valid Google Fonts
  4. Add `pdfGenerationStatus` field to Convex `deliberationEvents` (new eventType: `publisher-pdf-generated` with pass/fail)
  5. Test PDF generation with locally cached fonts (WeasyPrint can use system fonts)

**Watch for:**
- Slow PDF generation on initial runs (may need to warm up)
- Font loading failures (add fallback serif/sans-serif to CSS)
- PDF file size creep (monitor with `problemPdf.asset.size` in Sanity)
- Color mismatches in PDF (test theme injection with edge cases: very light colors, very dark colors)

---

## Theme Injection Security / CSS Injection

**Severity: MEDIUM**

**What could go wrong:**
Each issue page injects the `theme` object as CSS variables:

```typescript
// docs/CLAUDE_CODE_BRIEF.md lines 245–252
const style = `
  --color-primary: ${issue.theme.primaryColor};
  --color-accent: ${issue.theme.accentColor};
  --color-bg: ${issue.theme.backgroundColor};
  --color-text: ${issue.theme.textColor};
  --font-display: '${issue.theme.fontDisplay}', serif;
  --font-body: '${issue.theme.fontBody}', sans-serif;
`
```

**Vulnerability:**
- `primaryColor` etc. are hex strings generated by Design agent — no validation schema
- If Design agent outputs `}; color: blue; .evil {` instead of a hex color, CSS injection occurs
- Injected CSS could hide page content, overlay a phishing form, or change link colors to attack-site colors
- Font names are not quoted in the CSS variable assignment — if `fontDisplay` contains a backtick or quote, CSS parsing breaks

**Contract references:**
- `schemas/weeklyIssue.ts` lines 85–88 (theme.primaryColor etc.) — type is `string`, no format validation
  - No regex, no whitelist of valid hex formats
- `docs/CLAUDE_CODE_BRIEF.md` lines 245–252 — naive template literal injection without escaping
- `docs/API_CONTRACTS.md` §2.2 (write_issue_draft, line 324) — theme object written directly from agent output without validation

**When to address:**
- **Phase 2** (Next.js shell) — implement theme validation:
  1. Validate all `theme.primaryColor`, `accentColor`, `backgroundColor`, `textColor` as valid hex colors: `^#[0-9A-F]{6}$` (case-insensitive)
  2. Validate `theme.fontDisplay` and `fontBody` against whitelist of safe Google Fonts names (no special characters)
  3. Use CSS-safe escaping when injecting into `<style>` tag: escape `}`, `;`, `'`, `"` as Unicode escapes
  4. Example safe injection:
  ```typescript
  const sanitizedColor = /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : '#000000'
  const style = `--color-primary: ${sanitizedColor};`
  ```

- Add validation to Design agent prompt: "Always output hex colors in format #RRGGBB"

**Watch for:**
- Design agent trying to output RGB colors (e.g., `rgb(255, 0, 0)`) instead of hex
- Unusual font names (e.g., font names with numbers or special characters that aren't on Google Fonts)
- CSS syntax errors in browser console (sign of injection attempts)

---

## Andrew Bottleneck / Single Point of Failure

**Severity: MEDIUM**

**What could go wrong:**
Andrew is the **sole human editor and approval gate**:
- Reviews issue draft in Sanity Studio (line 197)
- Can edit any field (line 198)
- Changes `status` from `draft` to `published` to trigger deploy (line 199)
- Manually populates `sunoAudioUrl` for jingle bonus type (line 375)

**Failure modes:**
1. **Andrew unavailable** (vacation, sick, emergency) — no issue ships that week
2. **No backup reviewer specified** — no escalation path if Andrew can't decide
3. **Manual Suno step is a friction point** — if Andrew forgets to generate audio or populate the URL, issue deploys with blank jingle audio

**Contract references:**
- `docs/CLAUDE_CODE_BRIEF.md` lines 197–199 (Andrew gate)
- `docs/CLAUDE_CODE_BRIEF.md` lines 374–375 (Suno manual step) — `sunoAudioUrl` left empty, Andrew must paste result manually
- `schemas/weeklyIssue.ts` line 235 (sunoAudioUrl field) — required for jingle bonus type but no validation to ensure populated before publish
- No `approverOverride` or backup workflow specified

**When to address:**
- **Phase 1 (Sanity schema)** — add optional `backupEditor` reference field to agentProfile or workflowSettings
- **Phase 5 (Agent quality)** — consider auto-generating jingle audio via Suno API (if API available) instead of manual step
- **Phase 9 (Deliberation layer)** — add pre-publish checklist in Sanity that validates:
  1. If `bonusType === 'jingle'`, require `sunoAudioUrl` to be non-empty
  2. All required fields populated (no markdown-style `[TODO]` placeholders)
  3. Voice freshness score >0.8 (if QA has scored articles)
- Document fallback: if Andrew unavailable, escalate to defined backup editor with write access to Sanity

**Watch for:**
- Issues stuck in `draft` status for >2 weeks (sign of bottleneck)
- Suno audio URLs left blank or broken links
- Pattern of Andrew rejecting QA corrections (sign of tone misalignment)

---

## Real-Time Subscription Scaling

**Severity: MEDIUM**

**What could go wrong:**
The deliberation layer is powered by Convex real-time subscriptions:

```typescript
// docs/API_CONTRACTS.md §4.6, lines 1001–1010
const pitches = useQuery(api.pitchLog.byRunId, { runId })
const votes = useQuery(api.agentVotes.byRunId, { runId })
const corrections = useQuery(api.qaCorrections.byRunId, { runId })
const events = useQuery(api.deliberationEvents.byRunId, { runId })
```

Each query is a live subscription. During a pipeline run:
- Scout writes 3–5 candidates to `pitchLog`
- Advocate writes arguments for each candidate
- Researcher, 7 content writers, QA write events to `deliberationEvents`
- QA writes corrections to `qaCorrections` for each section

**Volume:** per run, expect 50–200 events in `deliberationEvents` alone.

**Cost issue:**
- Convex charges per function call (mutation) and per subscriber
- If 100+ readers watch the deliberation layer during a run, each subscribing to 4 queries, that's 400+ live subscriptions
- Convex pricing: check current rate, but could escalate quickly with high reader interest

**Performance issue:**
- `deliberationEvents.byRunId` query collects ALL events and orders by timestamp (schema line 856)
- If 200 events exist, every new event triggers a refetch for all subscribers
- Could cause UI jank if rendering 200+ event items

**Contract references:**
- `convex/schema.ts` lines 22–42 (deliberationEvents table) — no pagination, no limit on event count
- `docs/API_CONTRACTS.md` §4.3 (deliberationEvents queries, lines 845–902) — no `limit` or `offset` parameters
- `docs/CLAUDE_CODE_BRIEF.md` line 235 (deliberation layer on issue page) — component subscribes to all queries without lazy loading

**When to address:**
- **Phase 3** (Convex setup) — optimize queries before going public:
  1. Add `limit` and `offset` to `deliberationEvents.byRunId` (paginate, show latest 50 events)
  2. Add `order('desc')` to show newest events first (more interesting to watch)
  3. For pitch log and votes, these are smaller; keep as-is but monitor query latency
  4. Test subscriptions with 50+ concurrent readers using Convex load testing
  
- **Phase 9** (Deliberation layer) — implement infinite scroll or pagination in the UI
- Consider moving non-critical queries (QA corrections, pitch log) to a separate accordion tab so they don't load by default

**Watch for:**
- Convex bill spikes on publish day (100+ readers × 4 subscriptions = high costs)
- UI slowdown when >50 readers are watching
- Events not appearing real-time (sign of subscription bottleneck)

---

## Suno Audio Generation Friction

**Severity: LOW–MEDIUM**

**What could go wrong:**
For jingle bonus type, the BonusWriter agent outputs `sunoPrompt` (line 159–161), but:
- **No automatic audio generation** — Andrew must manually visit Suno.ai, paste the prompt, generate audio, and copy the URL back to Sanity
- **Manual step is a friction point** — can block weekly cadence if Andrew is busy or forgets
- **No retry mechanism** — if Suno audio generation fails, there's no fallback

**Contract references:**
- `docs/CLAUDE_CODE_BRIEF.md` lines 374–375 — `sunoAudioUrl` field is "left empty for Andrew to populate manually"
- `schemas/weeklyIssue.ts` lines 226–238 (sunoPrompt and sunoAudioUrl fields) — no validation that audio URL is populated before publish
- No Suno API integration mentioned in stack (line 11–23)

**When to address:**
- **Phase 8 or later** — if Suno API becomes available:
  1. Add Suno API key to environment variables
  2. Create a Publisher sub-task to call Suno API with the `sunoPrompt`
  3. Poll Suno API until generation completes, then populate `sunoAudioUrl`
  4. If generation fails, fallback: either auto-generate via another service or alert Andrew to do it manually

- In the meantime, **Phase 5** — add Sanity hook or script that reminds Andrew to populate Suno URL before publish
  - Pre-publish validation (mentioned in Andrew Bottleneck section above)

**Watch for:**
- Issues missing jingle audio because Andrew forgot
- Delays in publish if Suno API is down

---

## Webhook → Publisher Trigger Reliability

**Severity: MEDIUM**

**What could go wrong:**
The only trigger for the Publisher agent is the Sanity webhook:

```
URL:    https://<railway-domain>/webhook/sanity-publish
Filter: _type == "weeklyIssue" && status == "published"
```
(docs/API_CONTRACTS.md §5.1, lines 1024–1029)

**Failure modes:**
1. **Webhook delivery failure** — Sanity retries for ~24 hours, but if Railway is down, webhook may never be received
2. **Webhook signature verification fails** — handler returns 401 (correct), but no alert to Andrew
3. **Background task fails silently** — handler returns 200 immediately (correct per spec, line 1078), but if `run_publisher()` fails, issue never deploys
4. **No fallback trigger** — only way to re-trigger Publisher is to unpublish and re-publish the issue, which is hacky

**Contract references:**
- `docs/API_CONTRACTS.md` §5.3 (FastAPI handler, lines 1053–1078) — returns 200 immediately, background task is fire-and-forget
  - No way to check if Publisher task succeeded without logs
- `docs/API_CONTRACTS.md` §5.4 (trigger Vercel deploy, lines 1083–1087) — no error handling if Vercel deploy fails
- `docs/CLAUDE_CODE_BRIEF.md` line 201 (webhook triggers Publisher) — no fallback mechanism

**When to address:**
- **Phase 5 or 6** (early) — add reliability:
  1. Add `deploymentStatus` field to Convex `pipelineRuns` table (values: `pending-deploy`, `deployed`, `deploy-failed`)
  2. In Publisher task, after Vercel deploy succeeds, update Convex `pipelineRuns.deploymentStatus = 'deployed'`
  3. Add a cron job (Railway built-in or external scheduler) that checks for runs in `status='awaiting-review'` for >24 hours — alert Andrew
  4. If Vercel deploy fails, update `deploymentStatus = 'deploy-failed'` and write alert event to Convex

- **Phase 10** (monitoring) — add dashboard that surfaces:
  - Last successful deploy (issue number, date)
  - Any runs stuck in `awaiting-review` or `deploy-failed`
  - Webhook delivery errors from Sanity

**Watch for:**
- Railway downtime (monitor Railway status page)
- Vercel deploy hook timeouts (current timeout is 30s, may be tight)
- Issues published but not appearing on homepage (sign of deploy failure)

---

## No Automated Test Coverage

**Severity: HIGH**

**What could go wrong:**
The contracts in `docs/API_CONTRACTS.md` specify exact field names, types, and query shapes, but:
- No tests validate that agents output the correct fields
- No tests validate that pipeline writes match the contract (e.g., `text_to_portable_text()` produces valid Portable Text)
- No tests validate that Convex queries match the schema
- No tests validate that Sanity GROQ queries return the expected shape
- No tests validate theme color/font validation (mentioned in theme injection section)

**Result:** Implementation can silently diverge from contracts. A simple typo (e.g., `scoutSummary` vs `scout_summary`) breaks the entire pipeline at runtime.

**Contract references:**
- `docs/API_CONTRACTS.md` — entire document is a specification waiting for tests
- `docs/API_CONTRACTS.md` §2.4 (text_to_portable_text helper, lines 438–470) — no test that output is valid Portable Text JSON
- `docs/API_CONTRACTS.md` §7 (LangGraph state contract, lines 1254–1291) — no test that agents populate all required fields

**When to address:**
- **Phase 1 (Sanity schema)** — write integration tests in Jest:
  1. Test GROQ queries return correct shape
  2. Test Sanity document validation (required fields, field types)

- **Phase 4 (Pipeline skeleton)** — write Python tests:
  1. Unit test `text_to_portable_text()` with various inputs (single paragraph, multiple paragraphs, empty string)
  2. Unit test each agent's output matches the `DispatchState` contract (check field names, types)
  3. Integration test: pipeline run start-to-finish with mock LLM responses
  4. Test Convex mutation payloads are valid JSON

- **Phase 5 (Agent quality)** — add snapshot tests:
  1. Capture a full pipeline run's state
  2. Snapshot the Convex mutations that would be sent
  3. Snapshot the Sanity documents that would be written
  4. If any field changes, snapshot diff alerts developers

**Watch for:**
- Silent contract violations (field names don't match, breaking frontend queries)
- Portable Text rendering errors in Sanity Studio
- Convex queries returning `null` when data exists (schema mismatch)

---

## Stack Drift Risk / Data Store Confusion

**Severity: MEDIUM**

**What could go wrong:**
The stack is locked (`docs/CLAUDE_CODE_BRIEF.md` line 12–24) and uses 3 datastores:

1. **Sanity** — CMS for published content, agent profiles, schemas
2. **Convex** — real-time event stream, deliberation data
3. **Supabase** — Python SDK used by pipeline (line 20)

**Confusion vectors:**
- Which datastore owns "charity data"?
  - Charity is a Sanity document (`schemas/charity.ts`)
  - But Scout finds candidates and writes to Convex `pitchLog`
  - Which is the source of truth?
  
- Which datastore owns "issue metadata"?
  - Issue is a Sanity document (`schemas/weeklyIssue.ts`)
  - But pipeline status is tracked in Convex `pipelineRuns`
  - Which tables are synced?

- **Supabase is mentioned but underspecified:**
  - Brief says "Pipeline database" (line 20) but no schema or use case documented
  - Not mentioned in API contracts at all
  - No `supabase/` schema files in the repo
  - Is it for pipeline state, or for something else?

**Contract references:**
- `docs/CLAUDE_CODE_BRIEF.md` line 20 — "Supabase (Python SDK)" — no other mention
- `docs/API_CONTRACTS.md` — no Supabase contracts
- `convex/schema.ts` — is the source of truth, not Supabase
- `schemas/` — Sanity is the CMS, not Supabase

**When to address:**
- **Phase 1 or Phase 2** — clarify data ownership:
  1. Write a "Data Architecture" doc mapping each entity to its source datastore:
     - `charity` → Sanity (source of truth), Convex `pitchLog` (transient)
     - `weeklyIssue` → Sanity (source of truth), Convex `pipelineRuns` (transient)
     - `agentProfile` → Sanity (source of truth)
     - `deliberationEvents`, `agentVotes`, `qaCorrections` → Convex (transient, not synced to Sanity)
     - Supabase → clarify or remove from stack
  
  2. Add comments to schema files:
     - Sanity: "This is the CMS source of truth. Convex mirrors transient runtime data."
     - Convex: "Runtime event streams. Not synced back to Sanity. Cleared after issue publishes."

- **Phase 3 (Convex setup)** — if Supabase is needed, document its schema and API contracts

**Watch for:**
- Data inconsistencies (charity changed in Sanity, not reflected in Convex)
- Unused Supabase tables (sign of feature creep or abandoned design)
- Confusion in implementation about which datastore to read/write

---

## Missing Critical Details in Contracts

**Severity: LOW–MEDIUM**

**What could go wrong:**
Several contract boundaries have TODOs or missing details:

1. **Stripe fulfillment** — "Future: send confirmation email" (docs/API_CONTRACTS.md line 1157)
2. **Game HTML validation** — not specified
3. **Suno API integration** — manual step, not automated
4. **Webhook error alerting** — no alert mechanism
5. **Pre-publish validation** — no schema for checklist

**When to address:**
- During each phase, clarify the contract before implementation
- Treat TODOs as blockers: don't move to next phase until TODO is resolved

---

## Theme Font Validation Gap

**Severity: MEDIUM**

**What could go wrong:**
Design agent specifies Google Fonts by name (`fontDisplay`, `fontBody`), but:
- No validation that names are valid Google Fonts
- If Design agent outputs "Comic Sans" or a typo like "Robto" (instead of "Roboto"), frontend fails to load the font
- Fallback to serif/sans-serif, but theme looks broken

**Contract references:**
- `schemas/weeklyIssue.ts` lines 89–90 (fontDisplay, fontBody) — type is `string`, no regex validation
- `docs/CLAUDE_CODE_BRIEF.md` line 169 — "Font values must be valid Google Fonts names"
- No test that Design agent output matches valid Google Fonts

**When to address:**
- **Phase 2 (Next.js shell)** — add font validation:
  1. Fetch list of valid Google Fonts from Google Fonts API once at app startup
  2. Validate `theme.fontDisplay` and `theme.fontBody` against this list
  3. Fallback to `serif` / `sans-serif` if invalid
  4. Log warning to console if invalid font detected

- **Phase 5 (Agent quality)** — Design agent prompt should include:
  - "Output font names exactly as they appear on fonts.google.com"
  - Example: "Roboto", "Playfair Display", "JetBrains Mono" (with proper capitalization)
  - Never make up font names

**Watch for:**
- "Failed to load font" errors in browser console
- Inconsistent typography across issues (sign of fallback being used)

---

## Summary: Risk Prioritization

### Address in next phase (critical before Phase 2):
1. **Data Architecture doc** — clarify Sanity vs. Convex vs. Supabase ownership
2. **Theme color validation** — implement hex format validation in Next.js
3. **Suno auto-generation decision** — clarify if API will be available

### Address by Phase 5 (Agent quality):
1. **Pipeline retry logic** — exponential backoff for OpenRouter and Sanity
2. **Voice consistency rubric** — define what Jesse voice is quantitatively
3. **QA escalation** — "major" voice violations block publish
4. **Agent output testing** — snapshot tests for each agent's output shape
5. **Design agent validation** — enforce hex colors and valid Google Fonts

### Address by Phase 6–8 (implementation):
1. **PDF generation timeout and fallback** — WeasyPrint performance
2. **Stripe fulfillment and deduplication** — order tracking and shipping
3. **Webhook reliability** — deployment status tracking and alerting
4. **Game HTML validation** — sandbox escape prevention

### Address by Phase 9 (deployment readiness):
1. **Deliberation layer pagination** — subscription cost management
2. **Pre-publish checklist** — Andrew gate automation
3. **Charity hallucination prevention** — fact-checking integration
4. **Backup editor workflow** — Andrew bottleneck mitigation

---

*Concerns audit: 2026-05-09*
