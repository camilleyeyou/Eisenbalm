# Testing Patterns

**Analysis Date:** 2025-02-09

## Current Status

**NO testing infrastructure exists yet:**
- No test files, no test framework, no test config
- No CI/CD pipeline configured
- No mock/fixture strategy
- No type testing

**This is intentional — the project is in schema/planning stage.** Testing will be implemented as code is written.

---

## Testing Strategy (from Build Brief)

The brief states: **"Each build step should be independently testable before moving to the next."**

This implies:
1. **Unit boundaries are clear** — each pipeline agent is testable separately
2. **Integration boundaries are explicit** — each API contract (Sanity, Convex, Stripe, Webhooks) is testable separately
3. **Manual QA gate acts as acceptance test** — Andrew's review in Sanity Studio is the human acceptance test before publish

**QA Agent in the pipeline** acts as **automated voice/factual review:**
- Reviews all section content against Jesse's voice, factual accuracy, tonal consistency, values alignment
- Writes corrections to Convex `qaCorrections` table
- Output is queryable and displayable in the deliberation layer

---

## No Tests, But Test Boundaries Are Clear

Based on API_CONTRACTS.md, these boundaries will require tests when implementation begins:

### Boundary 1: Next.js → Sanity (GROQ Reads)

**Files:** `apps/web/lib/sanity/queries.ts` (when created)

**Test boundaries to cover:**
- `QUERY_LATEST_ISSUE_SLUG` returns latest published issue or null
- `QUERY_ISSUE_BY_SLUG` returns full issue data with all nested sections resolved
- `QUERY_ARCHIVE` returns all published issues, ordered desc by issueNumber
- `QUERY_ALL_CHARITIES` returns all charities, ordered by name
- `QUERY_CHARITY_BY_SLUG` returns single charity with featured-in reference resolved
- `QUERY_AGENT_PROFILES` returns all agent profiles (called once, cached)
- `QUERY_ISSUE_RUN_ID` extracts runId for Convex deliberation subscription
- All queries handle null gracefully (no published issues, no charity found, etc.)
- CDN vs. no-CDN behavior (reads use CDN, writes don't)

**Test approach:** Mock Sanity client responses, verify query shape and nullability handling.

---

### Boundary 2: Pipeline → Sanity (Python Writes)

**Files:** `packages/pipeline/lib/sanity_client.py`, `packages/pipeline/lib/portable_text.py` (when created)

**Test boundaries to cover:**

**Charity writes (`write_charity`):**
- Creates deterministic `_id: f'charity-{slug}'` (no duplicates)
- Slugifies name correctly (handles spaces, special chars, Unicode)
- All optional fields handle missing values gracefully
- `charityNavigatorUrl`, `guidestarUrl` are truly optional

**Issue draft write (`write_issue_draft`):**
- Creates `_id: f'issue-{issueNumber}'`
- `status` always starts at `'draft'`
- Slug generation matches pattern: `f'issue-{issueNumber}'`
- All section content is converted to Portable Text via helper
- Nested `selectionDeliberation.candidates` array has `_key` for each item
- `pipelineMetadata.modelVersions` is valid JSON string
- All references are correct format: `{ _type: 'reference', _ref: '...' }`

**PDF upload & patch (`upload_pdf_to_issue`):**
- Asset upload succeeds and returns `_id`
- Patch operation correctly sets `problemPdf` with asset reference
- Filename includes issue number: `'dispatch-issue-{number}-problem-statement.pdf'`

**Portable Text conversion (`text_to_portable_text`):**
- Splits plain text by double newlines (paragraph breaks)
- Each block has `_type: 'block'`, unique `_key`, `style: 'normal'`, empty `markDefs`
- Each block contains one or more span children
- Each span has `_type: 'span'`, unique `_key`, `text`, empty `marks`
- UUID generation for keys is unique (no collisions in single call)
- Empty paragraphs are filtered out
- Whitespace is trimmed per paragraph

**Charity `firstFeaturedIn` patch (`set_charity_first_featured`):**
- Only sets if field is not already populated
- Reference format is correct
- Does not error if charity already has `firstFeaturedIn`

**Test approach:** Mock Sanity client, verify document shapes match schema, check deterministic IDs and slug generation, test Portable Text block structure.

---

### Boundary 3: Pipeline → Convex (Python HTTP Mutations)

**Files:** `packages/pipeline/lib/convex_client.py` (when created)

**Test boundaries to cover:**

**Connection:**
- HTTP client uses correct base URL from `NEXT_PUBLIC_CONVEX_URL` env var
- Authorization header is `Convex {CONVEX_DEPLOY_KEY}`
- Timeout is reasonable (10 seconds observed in contract)
- Response parsing handles JSON errors gracefully

**pipelineRuns mutations:**
- `pipelineRuns:create` with `runId`, `issueNumber`, `startedAt` (Unix ms)
- `pipelineRuns:updateStatus` with `runId`, `status` enum, optional `completedAt`, optional `errorMessage`
- Status transitions are valid: `running` → `awaiting-review` or `complete` or `failed`
- Timestamps are Unix milliseconds, not seconds

**deliberationEvents mutations:**
- `deliberationEvents:insert` with all required fields
- `eventType` matches Convex union: `'scout-finding'`, `'advocate-argument'`, `'editor-decision'`, `'section-draft'`, `'qa-correction'`, `'editor-final'`, `'publisher-deploy'`
- `payload` is always valid JSON string (validated with `json.dumps()`)
- `timestamp` is set at insert time (Unix ms)
- `charityId` and `sectionName` are optional per eventType (not all events have them)

**pitchLog mutations:**
- `pitchLog:insert` with all fields including optional `charityId`, `website`, `assetRange`, `focusArea`
- `selected: False` initially, updated by `pitchLog:markSelected`
- `pitchLog:markSelected` matches correct charity by name and runId

**agentVotes mutations:**
- `agentVotes:insert` with `runId`, `agentId`, `charityId` (Sanity _id), `charityName`, `vote` enum, `reasoning`
- `vote` is one of `'for'`, `'against'`, `'abstain'`
- In v1, only Advocate votes, always `'for'`

**qaCorrections mutations:**
- `qaCorrections:insert` per correction (not batched)
- `severity` is one of `'minor'`, `'moderate'`, `'major'`
- `accepted` reflects whether Editor final kept the correction
- Section and field names match schema field names exactly

**Test approach:** Mock HTTP responses, verify mutation payloads are valid JSON, check timestamp generation, test error handling for network failures (non-blocking).

---

### Boundary 4: Next.js → Convex (TypeScript Query Hooks)

**Files:** `convex/pipelineRuns.ts`, `convex/pitchLog.ts`, `convex/deliberationEvents.ts`, `convex/agentVotes.ts`, `convex/qaCorrections.ts` (when created)

**Test boundaries to cover:**

**Query functions:**
- `pipelineRuns.byRunId({ runId })` returns single run or null
- `pitchLog.byRunId({ runId })` returns array of pitches for a run, ordered ascending by timestamp
- `deliberationEvents.byRunId({ runId })` returns array of all events for a run, ordered ascending
- `deliberationEvents.byRunIdAndType({ runId, eventType })` filters by type correctly
- `agentVotes.byRunId({ runId })` returns array of votes for a run
- `agentVotes.byRunIdAndCharity({ runId, charityId })` filters by both keys
- `qaCorrections.byRunId({ runId })` returns array of corrections for a run, ordered ascending

**Mutation functions:**
- `pipelineRuns.create` accepts required args, adds timestamp automatically
- `pipelineRuns.updateStatus` patches only provided fields, does not affect others
- `pitchLog.insert` adds timestamp automatically
- `pitchLog.markSelected` batches updates correctly (marks one as selected, others as not)
- `deliberationEvents.insert` adds timestamp automatically
- `agentVotes.insert` adds timestamp automatically
- `qaCorrections.insert` adds timestamp automatically

**Index usage:**
- Queries use appropriate indices (`.withIndex('by_runId', ...)`)
- Index queries use `.first()` for single results, `.collect()` for arrays
- Ordering is consistent with index order

**Error handling:**
- `pipelineRuns.updateStatus` throws if run not found (guard clause)
- All other mutations proceed without existence checks (trust data layer)

**Test approach:** Use Convex local dev environment or mock Convex context, verify query results match expected shapes, test index-driven filtering, verify timestamps are applied.

---

### Boundary 5: Sanity → Pipeline (Webhook)

**Files:** `packages/pipeline/api/webhooks.py` (when created)

**Test boundaries to cover:**

**Signature verification:**
- HMAC validation succeeds for valid signature
- HMAC validation fails for invalid signature (returns 401)
- Signature uses `SANITY_WEBHOOK_SECRET` env var
- Algorithm is SHA256
- Comparison is timing-safe (`hmac.compare_digest`)

**Webhook parsing:**
- Extracts `_id`, `_type`, `status`, `issueNumber`, `runId` from payload
- Only processes if `status == 'published'`
- Returns `{ ok: True, skipped: True }` for draft/in-review status (graceful skip)
- Returns `200` immediately (async task triggered, not waited for)

**Background task triggering:**
- FastAPI `background_tasks.add_task()` is used (non-blocking)
- Publisher agent is invoked with `issue_id`, `issue_number`, `run_id`
- No exceptions from background task block the webhook response

**Test approach:** Mock FastAPI request with signed payload, verify HMAC validation, check status code (200) is returned immediately, verify background task is registered (don't wait for execution).

---

### Boundary 6: Stripe Commerce

**Files:** `apps/web/app/api/checkout/route.ts`, `apps/web/app/api/webhooks/stripe/route.ts` (when created)

**Test boundaries to cover:**

**Checkout session creation:**
- POST to `/api/checkout` with `{ quantity: 1 }` (optional, defaults to 1)
- Creates session with `STRIPE_PRICE_ID` from env
- Session mode is `'payment'` (not subscription)
- Success URL includes `{CHECKOUT_SESSION_ID}` placeholder
- Cancel URL is shop page
- Metadata includes `source: 'eisenbalm-dispatch'`
- Returns `{ url: session.url }` (client redirects to this)

**Stripe webhook handler:**
- POST to `/api/webhooks/stripe`
- Validates signature using `STRIPE_WEBHOOK_SECRET`
- Returns `200` for valid/invalid signatures (doesn't leak timing info)
- Handles `checkout.session.completed` event
  - Logs order: `session.id`, `session.customer_email`
  - Future: sends confirmation email
  - Does not create fulfillment (digital + single physical SKU, no shipping)
- Handles `payment_intent.payment_failed` event
  - Logs only, no action required
- Ignores other event types gracefully

**Error handling:**
- Invalid signature returns `400` (not successful)
- Processing failures inside event handlers don't crash webhook response (catch & log)
- Always returns `200` for valid signed payloads (even if processing fails)

**Test approach:** Mock Stripe event payloads, verify signature validation, test session creation parameters, verify webhook handles event types correctly, check response codes.

---

### Boundary 7: LangGraph State Contract (inter-agent)

**Files:** `packages/pipeline/types.py` (when created, defines `DispatchState`)

**Test boundaries to cover:**

**Type validation:**
- All `Optional[T]` fields can be `None`
- All `Literal['...']` values are exactly those strings
- Nested TypedDicts (StyleBrief, CharityCandidate, etc.) validate structure
- List types validate element types
- Union types accept any member type

**State mutations:**
- Each agent reads from state, writes only its own fields
- No cross-agent field overwrites
- All agent outputs are compatible with downstream consumers
- UUID generation for `run_id` is unique

**Test approach:** Type-check the state module (mypy with strict mode), verify TypedDict structure matches all downstream usages in mutations/queries.

---

## Manual QA Gate (Andrew's Review)

**Location:** Sanity Studio, `weeklyIssue` document with `status: 'draft'`

**What Andrew checks (observed from brief):**
- All section content reads naturally in Jesse's voice
- No factual errors (verified against original charity research)
- Tonal consistency across sections
- Brand values alignment (no fundraising gimmicks, no urgency mechanics)
- Theme colors are valid hex values
- Game is self-contained (no external CDN links, works in sandboxed iframe)
- Bonus content matches the selected `bonusType` (jingle has lyrics, big budget has storyboards, etc.)
- Suno prompt is provided if bonusType is `'jingle'` (manual generation step until API is wired)

**Manual action:**
- Andrew can edit any field in the draft
- Andrew manually changes `status` from `'draft'` to `'published'`
- Publishing triggers Sanity webhook → Publisher agent

**Acceptance criteria:**
- Sanity Studio renders all fields without errors
- Andrew can edit and save changes
- Publishing does not error
- PDF generates without errors
- Vercel deploy completes successfully

---

## Recommended Test Framework & Structure (placeholder for future)

When implementation begins, consider:

**Unit tests:**
- **Language:** Python (pipeline) and TypeScript (Next.js, Convex)
- **Framework:** pytest (Python), vitest or Jest (TypeScript)
- **Coverage target:** API boundary functions (query construction, payload validation, error handling)
- **Scope:** Individual functions, not integration

**Integration tests:**
- **Scope:** Single API boundary with mocked dependencies
- **Example:** Sanity write with mocked Sanity client, Convex mutation response verification
- **Run:** After each boundary layer is complete

**End-to-end tests:**
- **Scope:** Full pipeline run from trigger to Vercel deploy
- **Trigger:** Manual (scheduled testing) or weekly (production runs)
- **Verification:** Content appears on published page, theme applies correctly, game runs in iframe
- **Manual step:** Andrew reviews and publishes draft (cannot be automated)

**Smoke tests:**
- **Scope:** Happy path for each build step (from brief)
- **Run:** Before moving to next step
- **Example:** "Schema wired in Studio" → "Studio renders all fields" → "Next.js fetches latest issue" → etc.

---

## Test Isolation & Fixtures

**Needed (future):**
- **Fixture datasets:** Sample charity data, issue data, agent profiles for all tests
- **Mock Sanity responses:** Cached GROQ response shapes from production-like queries
- **Mock Convex responses:** JSON shapes matching Convex mutation return values
- **Mock Stripe events:** Valid signed Stripe webhook payloads for signature testing
- **Test database:** Isolated Convex dev environment or in-memory store for testing
- **Seed data:** One complete pipeline run with all tables populated

**Not needed (Andrew is manual QA):**
- UI automation tests (Andrew reviews in Studio)
- E2E visual regression tests
- Load testing (weekly runs, low volume)

---

## CI/CD Placeholder

**Not yet configured.** When added:

- **On PR:** Run linter, type checker, unit tests for modified boundaries
- **On merge to main:** Run full test suite, deploy to staging
- **Weekly:** Run production pipeline (Monday UTC-7 assumed, adjust as needed)
- **On publish:** Verify Vercel deploy completes, update Convex `pipelineRuns` status

---

## File Paths Reference (for test discovery when written)

**Schema files to test:**
- `convex/schema.ts` — Validate table structure with Convex tooling
- `schemas/charity.ts` — Validate field definitions with Sanity SDK
- `schemas/weeklyIssue.ts` — Complex schema with many nested objects
- `schemas/agentProfile.ts` — Agent profiles schema

**API boundary files (test these heavily when created):**
- `apps/web/lib/sanity/queries.ts` — GROQ queries
- `packages/pipeline/lib/sanity_client.py` — Sanity write operations
- `packages/pipeline/lib/convex_client.py` — Convex HTTP mutations
- `packages/pipeline/lib/portable_text.py` — Portable Text conversion
- `packages/pipeline/api/webhooks.py` — Sanity webhook handler
- `apps/web/app/api/checkout/route.ts` — Stripe checkout
- `apps/web/app/api/webhooks/stripe/route.ts` — Stripe webhook handler

**Agent files (test pipeline state contracts):**
- `packages/pipeline/types.py` — LangGraph DispatchState TypedDict
- `packages/pipeline/agents/*.py` — Individual agent functions

---

## Summary

**Current state:** No tests, no framework. This is normal at this stage.

**Explicit test boundaries (from API_CONTRACTS.md):**
- 7 API contract boundaries need test coverage
- Each boundary is independently testable
- Test scope is clear: verify payload shapes, handle nulls, validate enums, test error paths

**QA strategy:**
- Andrew's manual review is the acceptance gate
- QA agent (automated) flags voice/factual issues for correction
- Deliberation layer (frontend) shows all QA corrections made during the run

**When to add tests:**
1. After **Sanity schema + Studio** step (verify fields render)
2. After **Next.js shell** step (verify GROQ queries return correct data)
3. After **Convex setup** step (verify mutations write correctly)
4. After **Pipeline skeleton** step (verify state transitions, error handling)
5. After each **Agent** step (verify output matches contract)

**Recommended approach:**
- Start with contract validation tests (payload shapes, enum values)
- Add boundary integration tests (mocked dependencies)
- Save E2E for weekly production runs (Andrew reviews as acceptance)
