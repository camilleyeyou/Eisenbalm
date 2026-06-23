# Phase 26: Review Gate + Charity Registry — Research

**Researched:** 2026-06-23
**Domain:** Operator review gate, draft-preview iframe, factual-claims extraction, Convex charity registry, Scout dedup re-point
**Confidence:** HIGH — every finding is grounded in actual file paths and line numbers from the repo

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Approve-and-publish flips Sanity `weeklyIssue.status='published'` → reuses webhook → `_run_publisher`.
- **D-02** Approve-and-schedule fires via the Phase 25 `/pipeline/tick` sweep; scheduled time stored as an additive field (exact shape is planning detail).
- **D-03** Convex `charities` is the authoritative dedup/state layer; on publish, upsert `status='featured'`, increment `timesFeatured`, set `lastFeaturedAt`. Scout queries the registry, skips featured + blocklisted.
- **D-04** Dedup key = normalized name + bare domain. Reuse `scout.py:96` `_domain_of()`.
- **D-05** Scout logs considered candidates as `status='candidate'` via an upsert to `charities`.
- **D-06** Deterministic regex/NLP extraction of every number, date pattern, and proper-noun sequence. No LLM extraction.
- **D-07** Extraction runs at pipeline run-end, stored in Convex. Per-claim check/skip state persists. Exact shape is a planning detail.
- **D-08** Sign-off checklist only — no web-search verification this phase.
- **D-09** Iframe the real `apps/web` issue page via a token-guarded draft-preview route (Sanity `previewDrafts` perspective). `dispatch-control` iframes it. Requires `frame-ancestors` CSP on `apps/web`.
- **D-10** Preview-centric layout — controls in dashboard chrome around the iframe.
- **D-11** `auto_publish` friction: modal confirmation + rate-limit + `audit_log` row + Convex alert event (no transport this phase). `auto_publish=false` default.
- **D-12** Re-roll from review screen reuses Phase 25 `/runs/{id}/agents/{key}/rerun`.

### Claude's Discretion

- Registry management UI scope: `/charities` route in dispatch-control, list + toggles (candidate/featured/blocklist) + manual add.
- Exact endpoint names: `POST /issues/{id}/publish`, `/schedule`, review-decision routes, registry queries.
- Storage shape for scheduled-publish time (additive `runs` field vs dedicated record).
- Storage shape for claim list + sign-off state (dedicated table vs claims-JSON-on-run + checkoff record).
- Which review actions write `audit_log` / `review_actions` rows.
- Rate-limit window + exact "visually alarming" treatment for `auto_publish` toggle.
- Backfill mechanics for seeding registry from existing published charities.

### Deferred Ideas (OUT OF SCOPE)

- Slack/email notification transport (Phase 27 NTF-01/02).
- Web-search-backed claim verification.
- Stripe donation reconciliation (Phase 27).
- Full issue-lifecycle kanban board.
- Re-rolling upstream nodes or auto re-running QA/editor_final after section re-roll.
- Per-issue OG image, charity-page issue history (V2-07/V2-09).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RVW-01 | `require_review` default-on; finished run lands in `awaiting_review` | Already true in pipeline (`publisher/__init__.py:76`); review queue reads existing `status` field |
| RVW-02 | Operator sees rendered preview + deliberation + cost before deciding | D-09 iframe draft-preview route; cost reads existing single-cost-writer path; deliberation already in Convex |
| RVW-03 | Approve-and-publish, approve-and-schedule, re-roll, reject | D-01 publish chain confirmed; D-02 tick sweep confirmed; D-12 reroll endpoint confirmed |
| RVW-04 | `auto_publish` friction — modal, rate-limit, audit-log, alert, alarming UI | Config read path confirmed; `auditLog:record` public mutation confirmed; alert-event pattern from Phase 25 confirmed |
| RVW-05 | Factual claims checklist before approve enabled | D-06 deterministic extraction; D-07 Convex storage; claim sign-off shape decided |
| REG-01 | Operator manages charity registry (candidate/featured/blocklisted + dedup key) | `charities` stub table at `schema.ts:320` confirmed; additive fields needed documented |
| REG-02 | Scout consults registry so featured/blocklisted not re-selected | Scout re-point from `_load_featured_keys()` GROQ at `scout.py:113-175` to Convex query confirmed |

</phase_requirements>

---

## Summary

Phase 26 is a build-on-top phase: every major mechanism either already exists or is confirmed reusable. The work is wiring, gating, and surface-adding, not greenfield design. Three areas demand careful research: (1) the draft-preview iframe requires a new token-guarded route on `apps/web` and per-route CSP headers that `next.config.ts` does not currently emit; (2) the claims-extraction shape needs a concrete Convex storage decision so API_CONTRACTS.md can be amended before the first line of code; (3) the charity registry needs four additive fields on the `charities` stub table, and the Scout re-point needs to add a Convex query alongside removing the GROQ call.

The most significant risk is the draft-preview route: Sanity's `previewDrafts` perspective requires the pipeline API token (not the public CDN token), and `frame-ancestors` CSP must be set at the route level rather than globally to avoid weakening security on the published site. A cross-origin iframe from `dispatch-control` to `apps/web` needs either a signed short-lived token or Clerk-session forwarding; the research recommends a signed HMAC token because `dispatch-control` already has the `PIPELINE_TRIGGER_SECRET` pattern and it avoids a full OAuth dance for a same-operator preview.

**Primary recommendation:** Amend `docs/API_CONTRACTS.md` first (CLAUDE.md hard rule), implementing decisions in this order: (1) `charities` additive fields + `review_actions` action enum expansion + claims tables, (2) FastAPI publish/schedule/review routes in `control.py`, (3) draft-preview route on `apps/web`, (4) Scout re-point, (5) claims extraction step, (6) dashboard screens.

---

## Standard Stack

### Core (existing — reuse only)

| Component | Location | Purpose | Phase 26 Use |
|-----------|----------|---------|--------------|
| `convex/schema.ts:320` | `charities` stub | Dedup registry | Add 4 fields; flesh out mutations |
| `convex/schema.ts:341` | `review_actions` stub | Review audit trail | Expand `action` enum |
| `convex/auditLog.ts:61` | `auditLog:record` public mutation | Operator action trail | Write on every review decision + auto_publish toggle |
| `convex/pipelineConfig.ts` | `pipelineConfig:upsert` + `getAll` | Config read/write | Read `auto_publish`; write `auto_publish_enabled_at` rate-limit key |
| `api/control.py` | Phase 25 run-control router | FastAPI control endpoints | Add publish/schedule/review routes here or a sibling `review.py` |
| `agents/publisher/__init__.py:145` | `_run_publisher` coroutine | The actual publish chain | Dashboard publish endpoint calls `_run_publisher` directly OR flips Sanity status |
| `api/webhooks.py:37` | Sanity webhook handler | Status=published → `_run_publisher` | Unchanged; dashboard approve path flips Sanity, webhook fires |
| `agents/scout.py:95–175` | `_domain_of()` + `_load_featured_keys()` | Domain normalization + dedup | Port dedup logic to registry; re-point `_load_featured_keys` to Convex query |
| `apps/dispatch-control/lib/pipelineControlClient.ts` | Clerk-authed fetch wrapper | Dashboard → pipeline calls | Extend with publish/schedule/review/registry methods |
| `apps/web/app/issue/[slug]/page.tsx` | Phase 19 issue page | Magazine layout | Draft-preview route renders the same components |

### New libraries needed

None. The regex/NLP claims extraction uses Python stdlib `re` (already in the pipeline venv). No new npm packages required for the dashboard iframe approach.

---

## Architecture Patterns

### Pattern 1: Draft-Preview Route (D-09)

**What:** A new Next.js route at `apps/web/app/issue/[slug]/preview/page.tsx` (or `apps/web/app/preview/issue/[slug]/page.tsx`) that:
1. Reads a short-lived HMAC token from a query param (`?token=<hmac>`).
2. Verifies the token server-side using `PREVIEW_SECRET` env var (same pattern as `SANITY_WEBHOOK_SECRET`).
3. On valid token, fetches the issue using the Sanity client with `perspective: 'previewDrafts'` (requires `SANITY_API_TOKEN` with read access — already set on Railway; must also be set in `apps/web` Vercel environment).
4. Renders the exact same component tree as the published page (`IssueMasthead`, `EditorialSection`, `DeliberationSlot`, etc.).
5. Emits a `Content-Security-Policy: frame-ancestors 'self' https://<dispatch-control-vercel-domain>` header for this route only.

**Token generation (dashboard side):** `dispatch-control` generates the token server-side (Next.js Server Action or API route) using `crypto.createHmac('sha256', PREVIEW_SECRET).update(runId + ':' + slug + ':' + Math.floor(Date.now()/300000)).digest('hex')` — a 5-minute TOTP-style sliding window. The preview iframe URL: `https://eisenbalm-web.vercel.app/issue/<slug>/preview?token=<hmac>&runId=<runId>`.

**Sanity draft perspective:** The existing `sanityClient` in `apps/web/lib/sanity/client.ts` uses `useCDN: true`. The preview route needs a server-only client instance: `createClient({ ...config, useCdn: false, token: process.env.SANITY_API_TOKEN, perspective: 'previewDrafts' })`. This client MUST NOT be exported to client components (it carries the API token).

**CSP header setup:** Next.js per-route headers via `next.config.ts` `headers()` function:

```typescript
// next.config.ts — add to the existing config
async headers() {
  return [
    {
      source: '/issue/:slug/preview',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'self' https://dispatch-control.vercel.app",
        },
        {
          key: 'X-Frame-Options',
          // omit or set ALLOW-FROM — but ALLOW-FROM is deprecated; CSP wins
          value: 'ALLOWALL',
        },
      ],
    },
  ]
},
```

The existing `apps/web` pages have no `X-Frame-Options` header today (not visible in `next.config.ts`), so adding per-route CSP for the preview route is additive-only and does not affect the public site.

**Draft vs published perspective hazard (from PITFALLS.md §5.3):** The preview route must use `perspective: 'previewDrafts'` — NOT `status == "published"` filter. The existing `QUERY_ISSUE_BY_SLUG` filters on `status == "published"`, which would return null for a draft. The preview route needs a separate GROQ query: `*[_type == "weeklyIssue" && slug.current == $slug][0]{ ... }` (no status filter) with the same field projections.

**Deliberation in preview:** The `DeliberationSlot` reads from Convex via `useQuery` hooks keyed on `runId`. Since `runId` is embedded in `pipelineMetadata.runId` on the draft Sanity doc, the preview correctly shows live deliberation data. No changes needed.

**Cost display:** Cost lives on `pipelineRuns.costUsd` (from the single-cost-writer path, Phase 23). The dashboard chrome reads `api.pipelineRuns.byRunId` — not the preview iframe. Cost is dashboard-side only, not inside the iframe.

### Pattern 2: Publish Chain (D-01)

The approved path:

```
Dashboard approve button
  → POST /issues/{id}/publish  (new FastAPI route in control.py)
  → sets weeklyIssue.status = 'published' via Sanity Python client patch
  → Sanity fires webhook to /webhook/sanity-publish  (existing, unchanged)
  → api/webhooks.py:37 verifies HMAC + dedup → asyncio.create_task(_run_publisher)
  → _run_publisher: PDF render + Sanity upload + 30s sleep + Vercel deploy + Convex status='complete'
```

The dashboard endpoint does NOT call `_run_publisher` directly — it only flips Sanity status. The webhook fires `_run_publisher`. This is the single proven codepath (WHK-01 through WHK-08) and requires zero new publish logic.

**Idempotency:** The existing webhook dedup (`claim_idempotency_key` at `webhooks.py:86`) already handles double-fire. The dashboard endpoint must also guard: check `pipelineRuns.status` — if already `complete`, return 200 with `{"alreadyPublished": true}`.

**Claims gate enforcement:** The publish endpoint MUST check that all claims for the run are signed off (checked or skipped) before flipping Sanity status. If any claim is unchecked, return `409 {"reason": "claims_not_signed_off"}`.

### Pattern 3: Scheduled Publish (D-02)

**Storage shape recommendation:** Add an additive field `scheduledPublishAt: v.optional(v.number())` to the `runs` table (Unix ms). The Phase 25 `/pipeline/tick` already reads the `runs` table on each tick. Add one check to `pipeline_tick()` in `control.py` after the cadence gate:

```python
# After step 2 (cadence gate), before step 3 (one-at-a-time):
due_runs = await convex_query(http, "runs:dueForPublish", {
    "workspace_id": WORKSPACE_ID,
    "nowMs": now_ms,
})
for r in due_runs:
    # publish each due scheduled run via the same Sanity-flip path
    await _flip_sanity_published(r["runId"], sanity_http)
```

New Convex query `runs:dueForPublish` returns runs where `status == "awaiting-review"` and `scheduledPublishAt <= nowMs`.

**API_CONTRACTS.md amendment needed:** Add `scheduledPublishAt: v.optional(v.number())` to the `runs` table schema description in §4A. Add `runs:dueForPublish` query spec. Add `POST /issues/{id}/schedule` endpoint spec.

### Pattern 4: Charity Registry (REG-01 / D-03/D-04/D-05)

**Additive fields needed on `charities` stub table** (`schema.ts:320`):

```typescript
// Current stub (schema.ts:320-328):
charities: defineTable({
  workspace_id: v.string(),
  name: v.string(),
  status: v.string(),          // "candidate" | "featured" | "blocklisted"
  timesFeatured: v.optional(v.number()),
  lastFeaturedAt: v.optional(v.number()),
})
  .index('by_workspace', ['workspace_id'])

// Phase 26 additions (all additive — no field renames):
charities: defineTable({
  workspace_id: v.string(),
  name: v.string(),
  status: v.string(),          // "candidate" | "featured" | "blocklisted"
  timesFeatured: v.optional(v.number()),
  lastFeaturedAt: v.optional(v.number()),
  // NEW (D-04): dedup key = case-folded name + bare domain concatenated
  dedupKey: v.optional(v.string()),   // e.g. "puppies behind bars|puppiesbehindbarsinc.org"
  website: v.optional(v.string()),    // raw website URL (for UI display + domain extraction)
  domain: v.optional(v.string()),     // bare domain (pre-computed, case-folded)
  // NEW (D-03 optional link): Sanity charity _id or slug for cross-reference
  sanityCharityId: v.optional(v.string()),
  // runId that first logged this as a candidate (traceability)
  firstSeenRunId: v.optional(v.string()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_dedupKey', ['workspace_id', 'dedupKey'])  // for dedup query
  .index('by_workspace_status', ['workspace_id', 'status'])       // for Scout filter
```

**Mutations needed in new `convex/charities.ts`:**

- `upsertCandidate(workspace_id, name, website, runId)` — Scout calls this for each pitched charity. If `dedupKey` matches an existing row, patch `status` only if it was `candidate` (never downgrade `featured` → `candidate`). Inserts new rows with `status='candidate'`.
- `upsertFeatured(workspace_id, name, website, sanityCharityId)` — called on publish (D-01 path). Sets `status='featured'`, increments `timesFeatured`, sets `lastFeaturedAt`. Uses `dedupKey` index to find existing row.
- `setStatus(workspace_id, charityId, status)` — operator manually sets `candidate`/`featured`/`blocklisted` from the registry UI.
- `listByWorkspace(workspace_id, status?)` — registry list query with optional status filter.
- `getByDedupKey(workspace_id, dedupKey)` — Scout dedup query.

**Dedup key construction:** `dedupKey = f"{name.strip().lower()}|{domain}"` where `domain = _domain_of(website)`. This matches the existing `_candidate_keys()` logic at `scout.py:104-110`. The `|` separator makes the two components clearly distinct.

### Pattern 5: Scout Re-Point (REG-02 / D-03)

**Current path** (`scout.py:113-175`): `_load_featured_keys()` runs a GROQ query joining `weeklyIssue.charity → charity` for published issues. Returns a flat list of lowercase name + slug + domain strings.

**New path:** Replace `_load_featured_keys()` with `_load_registry_keys()`:

```python
async def _load_registry_keys(http) -> list[str]:
    """Query Convex charities registry for featured + blocklisted dedupKeys."""
    try:
        rows = await convex_query(
            http,
            "charities:listForDedup",
            {"workspace_id": WORKSPACE_ID},
        )
        # rows: list of {dedupKey, name, domain, status}
        keys: set[str] = set()
        for r in rows:
            if r.get("dedupKey"):
                # dedupKey already contains name + domain separated by |
                for part in r["dedupKey"].split("|"):
                    if part:
                        keys.add(part)
        return sorted(keys)
    except Exception as exc:
        log.warning("Scout registry dedup: Convex failed (%r) — empty fallback", exc)
        return []
```

New Convex query `charities:listForDedup` returns only `{dedupKey, name, domain, status}` for rows where `status IN ["featured", "blocklisted"]`. This replaces the GROQ call entirely — the Scout no longer reads from Sanity for dedup.

**The existing `_candidate_keys()` and `_domain_of()` functions at `scout.py:95-110` remain unchanged** — they are used to match candidates against the registry keys.

**Candidate logging (D-05):** After the LLM parse and Python-side dedup at `scout.py:267-276`, for each surviving (and non-surviving) candidate, call `charities:upsertCandidate`. Non-surviving candidates (already featured/blocklisted) should still be logged as candidates with a note — but the simplest approach is to log only the surviving candidates (those that pass the Python dedup). The blocked ones are already in the registry; logging them again as `candidate` would silently downgrade them, so the `upsertCandidate` mutation must guard: only set `status='candidate'` if the row does not already have `featured` or `blocklisted` status.

### Pattern 6: Claims Extraction (D-06/D-07)

**Source text:** The section text to extract from is the assembled Sanity draft sections. At pipeline run-end, `write_issue_draft()` (`lib/sanity_client.py`) has already written all sections to Sanity. The extraction step can run:
- Option A: at the end of the `publisher` agent node (before `convex_mutation_safe("pipelineRuns:updateStatus", ...)` sets `awaiting-review`), reading from `DispatchState` fields (`origin_story`, `problem_statement`, etc.).
- Option B: as a separate "claims_extractor" step after the publisher node, reading the Sanity draft back.

**Recommended: Option A** — read from `DispatchState` at pipeline run-end. The state fields are already serialized strings (body content, headlines). This avoids a Sanity round-trip. The Portable Text body is a list of block dicts; the extractor flattens children to text.

**Regex patterns (Python `re` stdlib):**

```python
import re

# Numbers: integers, decimals, percentages, dollar amounts, ordinals
RE_NUMBER = re.compile(
    r'\b(?:\$[\d,]+(?:\.\d+)?[BMK]?|\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th)?)\b'
)

# Dates: years, month+year, full dates, relative references
RE_DATE = re.compile(
    r'\b(?:19|20)\d{2}\b'           # year
    r'|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?'
    r'|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    r'\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b',
    re.IGNORECASE
)

# Proper nouns: title-cased sequences (2+ consecutive capitalized words)
RE_PROPER_NOUN = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b')
```

The extraction produces a flat list of `{"text": str, "type": "number"|"date"|"proper_noun", "context": str}` where `context` is the surrounding 60-character window.

**Deduplication:** normalize each extracted string to lowercase + strip punctuation before dedup. Proper nouns match on exact case-folded string.

**Convex storage shape (D-07 — recommended):**

Two options considered:

- **Option A (dedicated table `claim_checks`):** `{workspace_id, runId, claimIndex, text, type, context, status: "pending"|"checked"|"skipped"}`. Clean, queryable per-claim, supports per-claim updates.
- **Option B (JSON blob on `runs`):** Add `claimsJson: v.optional(v.string())` to the `runs` table; store entire list as JSON; update the whole blob on each sign-off.

**Recommendation: Option A (dedicated `claim_checks` table).** Individual claim sign-off from the dashboard sends a mutation per claim (`claimChecks:setStatus(runId, claimIndex, status)`), which is clean and efficient. The approve gate checks `claimChecks:allSignedOff(runId)` → true when all claims are `checked` or `skipped` (none remain `pending`). Option B requires deserializing + re-serializing the whole JSON blob on every click.

**`claim_checks` table definition:**

```typescript
claim_checks: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  claimIndex: v.number(),       // stable ordinal position from extraction
  text: v.string(),             // extracted claim text
  claimType: v.string(),        // "number" | "date" | "proper_noun"
  context: v.string(),          // 60-char surrounding window
  status: v.string(),           // "pending" | "checked" | "skipped"
})
  .index('by_runId', ['runId'])
  .index('by_workspace', ['workspace_id'])
```

**API_CONTRACTS.md amendments needed:** Add `claim_checks` table to §4A. Add `claimChecks:insertBatch`, `claimChecks:setStatus`, `claimChecks:listByRunId`, `claimChecks:allSignedOff` mutation/query specs.

### Pattern 7: `review_actions` Table Expansion

The stub at `schema.ts:341` has `action: v.string()` with a comment mentioning only three values. Phase 26 must expand this to cover the full decision vocabulary:

```
"approved_and_published"
"approved_and_scheduled"
"rejected"
"section_rerolled"      // re-roll from review screen
"auto_publish_enabled"  // operator enabled auto_publish
"auto_publish_disabled"
"charity_blocklisted"
"charity_status_changed"
```

The `review_actions` table is the visible per-run decision trail (what did the operator decide on this run?). The `audit_log` table is the workspace-level action trail (everything ever done). Both should be written for approve/reject/schedule decisions; `audit_log` alone is sufficient for registry mutations.

### Pattern 8: `auto_publish` Friction (D-11)

**Read path:** `load_run_config()` at `config_loader.py:395` already reads `auto_publish` from `pipelineConfig:getAll`. The `publisher` agent node at `publisher/__init__.py:55-83` does NOT currently check `auto_publish` — it always sets `awaiting-review`. This is correct today. When `auto_publish=true`, the `publisher` node should check the config snapshot and call `_flip_sanity_published()` directly instead of stopping at `awaiting-review`. But PITFALLS.md §5.1 warns this is the catastrophic failure mode.

**Implementation of the friction:**

The Convex `pipelineConfig:upsert` mutation writes the `auto_publish` key. The dashboard mutation (Convex function, NOT FastAPI) that sets `auto_publish=true` must:
1. Check `auto_publish_last_enabled_at` — if set and within the last 24 hours, reject with `"rate_limited"` (prevents repeated toggling).
2. Write `auto_publish = true`.
3. Write `auto_publish_enabled_at = Date.now()`.
4. Call `ctx.runMutation(internal.auditLog.write, { action: "config.auto_publish_enabled", ... })`.
5. Insert a Convex `deliberationEvent` with `eventType: "auto-publish-enabled"` (the Phase 27 NTF hook will pick this up). This mirrors the Phase 25 D-09 alert-event pattern.

**Visually alarming treatment:** The dashboard `dispatch-control` renders `auto_publish=true` as a persistent red warning banner on the config page AND on every run card in the review queue. The toggle is a red destructive button, not a standard boolean switch. The confirmation modal text must be non-dismissible (no "don't show again").

**Rate-limit window:** 24-hour cooldown after enable; operator can re-disable immediately but re-enable requires 24 hours.

### Pattern 9: Publish/Schedule Endpoint Shapes (for API_CONTRACTS.md)

```
POST /issues/{sanity_issue_id}/publish
  Auth: Depends(require_clerk_jwt)
  Guards: run.status == "awaiting-review"; all claims signed off
  Action: patch Sanity weeklyIssue.status = "published"; write review_actions row; write audit_log row
  Response: {"issueId": str, "published": true}

POST /issues/{sanity_issue_id}/schedule
  Auth: Depends(require_clerk_jwt)
  Body: {"scheduledAt": int}  # Unix ms
  Guards: run.status == "awaiting-review"; all claims signed off; scheduledAt > now
  Action: write runs.scheduledPublishAt; write review_actions row; write audit_log row
  Response: {"issueId": str, "scheduledAt": int}

POST /issues/{sanity_issue_id}/reject
  Auth: Depends(require_clerk_jwt)
  Body: {"note": Optional[str]}
  Action: write review_actions row (action="rejected"); write audit_log row; runs.status unchanged
  Response: {"issueId": str, "rejected": true}
```

These three endpoints live in a new `api/review.py` router (or extend `api/control.py`). The `sanity_issue_id` is the Sanity `_id` of the `weeklyIssue` document (present on `pipelineRuns.sanityIssueId` — the Convex `runs` table would need an additive `sanityIssueId` field OR the endpoint resolves it via `pipelineRuns:byRunId`).

### Pattern 10: Backfill (D-03)

One-time script to seed the `charities` registry from existing published Sanity issues. The same GROQ query used by `_load_featured_keys()` at `scout.py:135-138` returns `{name, slug, website}` for all published charities. The backfill script:
1. Runs that GROQ query.
2. For each result, calls `charities:upsertFeatured(workspace_id, name, website, sanityCharityId=charity_slug)`.

The backfill is idempotent (upsert pattern). It can be a Railway one-shot command or a dashboard "Seed registry from published issues" button (operator-triggered). The script lives at `packages/pipeline/scripts/backfill_charity_registry.py` (uv-runnable, uses existing `lib/convex_client.py`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Publish chain | New PDF/deploy logic | `_run_publisher` already exists; flip Sanity status and let webhook fire |
| Re-roll from review screen | New re-run logic | Phase 25 `/runs/{id}/agents/{key}/rerun` already exists |
| Scheduled publish trigger | New scheduler | Phase 25 `/pipeline/tick` hourly sweep; add `runs:dueForPublish` check |
| Audit trail | New logging system | `auditLog:record` public mutation (`auditLog.ts:61`) — already deployed |
| Operator auth guard | New JWT verification | `_require_clerk_jwt_control` at `control.py:78` — already wired |
| Config read | New pipeline config query | `pipelineConfig:getAll` + `load_run_config()` — already deployed |
| Draft perspective Sanity client | New client | `createClient({ ..., perspective: 'previewDrafts', token: SANITY_API_TOKEN })` — Sanity SDK supports this |

---

## Common Pitfalls

### Pitfall 1: Draft-Preview Route Uses Published Perspective (Returns null)

**What goes wrong:** The existing `QUERY_ISSUE_BY_SLUG` at `queries.ts` filters `status == "published"`. A draft issue returns null, `notFound()` fires, the preview iframe shows 404.

**Why it happens:** Copy-pasting the existing page query without removing the status filter.

**How to avoid:** The preview route needs a separate GROQ query with no status filter. Keep the published query unchanged. The preview query must also be protected by token verification before executing — do not expose a no-filter query publicly.

**Warning signs:** Preview iframe shows "Issue not found" for a run in `awaiting-review`.

### Pitfall 2: `frame-ancestors` CSP Not Set Per-Route — Blocks Embedding or Weakens Public Pages

**What goes wrong:** Setting a global `frame-ancestors` CSP in `next.config.ts` either (a) blocks the preview entirely if too restrictive, or (b) allows the public site to be iframed by anyone if too permissive.

**How to avoid:** Use per-route headers in `next.config.ts` `headers()` targeting only `/issue/:slug/preview`. The public issue pages at `/issue/:slug` get no `frame-ancestors` override — they remain unembeddable (default).

### Pitfall 3: Scout Candidate Logging Downgrades `featured` → `candidate`

**What goes wrong:** `charities:upsertCandidate` sets `status='candidate'` unconditionally. If a previously-featured charity somehow passes the dedup filter (e.g., the registry is missing a `dedupKey`), the upsert overwrites `featured` with `candidate`, breaking the state machine.

**How to avoid:** `upsertCandidate` mutation must guard: `if (existing.status === 'featured' || existing.status === 'blocklisted') { skip status update }`. Only patch `status` if the existing row has `status === 'candidate'` or is a new insert.

### Pitfall 4: Claims Extraction Runs on Portable Text Block Dicts (Not Flat Strings)

**What goes wrong:** `DispatchState` section fields (e.g., `origin_story.body`) are lists of Portable Text block dicts, not flat strings. Running regex directly on the dict produces `[object Object]` matches or crashes.

**How to avoid:** Write a `_flatten_portable_text(blocks: list) -> str` helper that extracts `child["text"]` from each `block["children"]` list. Apply this before passing to the regex extractors. The helper also covers the headline strings (plain strings, not Portable Text).

### Pitfall 5: Approve Button Enabled Before Claims Loaded (RVW-05 Race)

**What goes wrong:** The dashboard loads the review screen, the claims list takes 200ms to load from Convex, and during that window the approve button is briefly enabled (no claims = all signed off).

**How to avoid:** The approve gate logic must distinguish "claims not loaded yet" from "all claims signed off." Initialize approve-disabled; only enable when `claimsQuery.status === 'success'` AND `allSignedOff === true`.

### Pitfall 6: Sanity Status Flip Without Claims Check

**What goes wrong:** The FastAPI `/issues/{id}/publish` endpoint flips Sanity status without verifying the Convex claims sign-off state. An operator calls the endpoint directly (bypassing the dashboard UI) with all claims unsigned.

**How to avoid:** The FastAPI endpoint MUST query `claimChecks:allSignedOff(runId)` before patching Sanity status. Return `409 {"reason": "claims_not_signed_off"}` if any claims are pending. This is a server-side guard, not just a client-side button disable.

### Pitfall 7: `review_actions` `action` Field Uses Non-Canonical Values

**What goes wrong:** Different callers write different strings for the same action (e.g., `"approved"` vs `"approved_and_published"` vs `"publish"`). The audit viewer cannot aggregate correctly.

**How to avoid:** Define a canonical enum in `API_CONTRACTS.md` before writing any mutation. The `review_actions` `action` field must use exactly those strings. Python callers use a constants file; TypeScript callers use a `const` enum.

### Pitfall 8: `auto_publish` Toggle Calls Convex Mutation Client-Side

**What goes wrong:** The dashboard calls `convex.mutation(api.pipelineConfig.upsert, ...)` directly from a client component to flip `auto_publish`. This bypasses any server-side rate-limit check because the rate-limit logic would need to be in the Convex mutation itself (which is fine, but then the rate-limit check runs on the Convex server, not the FastAPI server).

**How to avoid:** The rate-limit check in the Convex mutation handler is actually the right place — it runs transactionally with the write. Add the rate-limit guard directly to the `pipelineConfig:upsert` or a new `pipelineConfig:setAutoPublish` mutation. Keep the FastAPI side stateless on this toggle.

---

## State of the Art

| Old Approach | Current Approach | Phase 26 Change |
|--------------|------------------|-----------------|
| Scout dedup via GROQ (`scout.py:135`) | GROQ query on published Sanity issues | Re-point to Convex `charities` registry |
| No review queue UI | Runs land in `awaiting-review` visible only in Sanity Studio | Dedicated review screen in `dispatch-control` |
| No factual-claims surface | QA agent annotations only | Deterministic regex extraction + per-claim sign-off checklist |
| No charity state management | Charities exist only as Sanity content docs | Convex registry with candidate/featured/blocklisted lifecycle |

---

## Open Questions

1. **Sanity API token available in `apps/web` Vercel environment?**
   - What we know: `SANITY_API_TOKEN` is set on Railway (pipeline). `apps/web` uses the public Sanity CDN client without a token.
   - What's unclear: Whether Vercel already has the read-only Sanity token, or if it needs to be added.
   - Recommendation: Add `SANITY_API_TOKEN` (read-only Sanity token) to the `apps/web` Vercel project env vars. The preview route is server-only; the token never reaches the browser. Use a minimal-permission read-only token (not the pipeline write token).

2. **`dispatch-control` origin for `frame-ancestors` CSP — hardcoded or env var?**
   - What we know: The `apps/web` preview route must name the exact `dispatch-control` domain in its CSP.
   - What's unclear: Whether the dispatch-control Vercel domain is stable or changes with preview deployments.
   - Recommendation: Use an env var `PREVIEW_ALLOWED_ORIGIN` on `apps/web`. The value is the production dispatch-control domain. For local dev, add `http://localhost:3001` (dispatch-control dev port) as a comma-separated second value.

3. **Sanity issue ID lookup for the `/issues/{id}/publish` endpoint**
   - What we know: `pipelineRuns` has a `sanityIssueId` field written by `publisher/__init__.py:81`. The `runs` table does not have a `sanityIssueId` field.
   - What's unclear: Whether the publish endpoint should accept `sanityIssueId` directly or `runId` and look up the Sanity ID from `pipelineRuns`.
   - Recommendation: Accept `runId` (not sanityIssueId) in the publish endpoint — `runId` is the join key everywhere. The endpoint looks up `pipelineRuns.sanityIssueId` via `pipelineRuns:byRunId` (already a query in `convex/pipelineRuns.ts`). This avoids another join and keeps the dashboard URL clean (`/runs/{runId}/review`).

4. **One-time backfill: run as a script or as an operator-triggered dashboard action?**
   - Recommendation: Provide both. A CLI script (`backfill_charity_registry.py`) for the immediate backfill during Phase 26 deployment, and a "Seed registry" button in the registry UI for recovery if the registry gets corrupted. The button is a Convex action (not a FastAPI endpoint) that runs the same GROQ + upsert logic.

---

## Environment Availability

| Dependency | Required By | Available | Version | Notes |
|------------|-------------|-----------|---------|-------|
| `SANITY_API_TOKEN` in `apps/web` Vercel env | Draft-preview route (D-09) | Likely not set | — | Must be added; use read-only token |
| `PREVIEW_SECRET` in `apps/web` + `apps/dispatch-control` | Token-guarded preview | Not set yet | — | New env var; set on both apps |
| Python `re` module | Claims extraction | Always available | stdlib | No new pip install |
| Convex functions for `charities` + `claim_checks` | Registry + claims | Not deployed (stubs only) | — | New `.ts` files needed |

---

## Validation Architecture

**Nyquist validation is enabled** (`config.json` `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework (pipeline) | pytest + uv (`cd packages/pipeline && uv run pytest -x -q`) |
| Framework (web) | vitest via `pnpm --filter web test:unit` |
| Framework (dispatch-control) | vitest via `pnpm --filter dispatch-control test:unit` (if present) |
| Config file | `packages/pipeline/pyproject.toml`, `apps/web/vitest.config.ts` |
| Quick run command (pipeline) | `uv run pytest -x -q -k "<test_name>"` |
| Full suite command | `uv run pytest -x -q` (pipeline) + `pnpm --filter web test:unit` (web) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RVW-01 | Run landing in `awaiting-review` | unit | `pytest tests/test_publisher_node.py::test_status_is_awaiting_review` | Likely exists — verify |
| RVW-01 | `require_review=true` default in fallback config | unit | `pytest tests/test_config_loader.py::test_fallback_require_review_default` | Likely exists |
| RVW-02 | Draft-preview route returns 200 for valid token | unit | `pnpm --filter web test:unit -- -t "preview route"` | ❌ Wave 0 |
| RVW-02 | Draft-preview route returns 401 for missing/invalid token | unit | `pnpm --filter web test:unit -- -t "preview auth"` | ❌ Wave 0 |
| RVW-02 | `frame-ancestors` CSP present on preview route, absent on public route | unit (next.config headers) | `pnpm --filter web test:unit -- -t "preview CSP"` | ❌ Wave 0 |
| RVW-03 | Publish endpoint rejects if claims not all signed off | unit | `pytest tests/test_review_endpoints.py::test_publish_requires_claims_signoff` | ❌ Wave 0 |
| RVW-03 | Publish endpoint flips Sanity status and returns 200 | integration (mock Sanity) | `pytest tests/test_review_endpoints.py::test_publish_success` | ❌ Wave 0 |
| RVW-03 | Schedule endpoint writes `scheduledPublishAt` to runs | unit | `pytest tests/test_review_endpoints.py::test_schedule_writes_scheduled_at` | ❌ Wave 0 |
| RVW-03 | Tick processes due scheduled runs | unit | `pytest tests/test_scheduler.py::test_tick_fires_due_scheduled_runs` | ❌ Wave 0 |
| RVW-04 | `auto_publish` Convex mutation rejects within 24h rate-limit window | unit (Convex function test) | manual-only — Convex mutation tests not in current suite | manual |
| RVW-04 | `auto_publish` Convex mutation writes `audit_log` row | unit | manual-only for Convex mutations | manual |
| RVW-05 | Claims extraction finds numbers, dates, proper nouns in section text | unit | `pytest tests/test_claims_extractor.py::test_extract_all_claim_types` | ❌ Wave 0 |
| RVW-05 | Claims extraction handles Portable Text block format | unit | `pytest tests/test_claims_extractor.py::test_flatten_portable_text` | ❌ Wave 0 |
| RVW-05 | `claimChecks:allSignedOff` returns false when any claim is pending | unit (Convex) | manual-only | manual |
| REG-01 | `charities:upsertCandidate` does not downgrade `featured` status | unit (Convex) | manual-only | manual |
| REG-01 | `charities:upsertFeatured` increments `timesFeatured` | unit (Convex) | manual-only | manual |
| REG-02 | Scout skips charities with `featured` or `blocklisted` status | unit | `pytest tests/test_scout.py::test_registry_dedup_skips_featured` | ❌ Wave 0 |
| REG-02 | `_load_registry_keys()` returns empty list on Convex failure | unit | `pytest tests/test_scout.py::test_registry_load_empty_fallback` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Quick targeted test for the modified file, e.g. `uv run pytest tests/test_claims_extractor.py -x -q`
- **Per wave merge:** `uv run pytest -x -q` (pipeline full suite, ~200+ tests) + `pnpm --filter web test:unit`
- **Phase gate:** Both full suites green + manual smoke of the preview iframe in a browser before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/pipeline/tests/test_claims_extractor.py` — covers RVW-05 claim extraction
- [ ] `packages/pipeline/tests/test_review_endpoints.py` — covers RVW-03 publish/schedule/reject endpoint guards
- [ ] `packages/pipeline/tests/test_scout.py` registry dedup tests (extend existing file) — covers REG-02
- [ ] `apps/web/__tests__/preview-route.test.ts` — covers RVW-02 token guard + CSP headers
- [ ] `packages/pipeline/scripts/backfill_charity_registry.py` — covers D-03 one-time backfill (script, not a test, but must exist before deploy)

---

## Project Constraints (from CLAUDE.md)

- **Amend `docs/API_CONTRACTS.md` BEFORE any endpoint/schema change** — hard rule. Every new endpoint, every new Convex table/field, every new mutation must be documented in API_CONTRACTS first.
- **Do not modify frozen field names** without checking API_CONTRACTS.md first. `pipelineRuns` and `deliberationEvents` shapes are frozen.
- **GSD workflow enforcement** — all changes go through the GSD command pipeline; no direct repo edits outside a GSD workflow.
- **Tech stack is locked** — Next.js 14+ App Router, Sanity v3, FastAPI, LangGraph, Convex, Stripe, Supabase. No substitutions.
- **`workspace_id: "eisenbalm"`** threaded through all new Convex rows.
- **Read `convex/_generated/ai/guidelines.md` before writing any Convex code** — the CLAUDE.md inside `convex/` mandates this.
- **Single-cost-writer rule** (Phase 23) — cost shown in review preview reads `pipelineRuns.costUsd` from the recorded actual cost; never recomputes from `model_pricing`.
- **Block-with-explanation over queues** (Phase 24/25 pattern) — the publish endpoint blocks with a descriptive error when guards fail; it does not queue.

---

## Sources

### Primary (HIGH confidence — direct file reads)

- `convex/schema.ts:320-352` — `charities` + `review_actions` stub tables (confirmed shape)
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:95-175` — `_domain_of()`, `_candidate_keys()`, `_load_featured_keys()`, GROQ dedup path (confirmed code)
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py:145-268` — `_run_publisher` coroutine + Phase 6 publish chain (confirmed code)
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py:37-143` — Sanity webhook handler (confirmed code)
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py:1-503` — Phase 25 control router including `_emit_audit` helper and `_require_clerk_jwt_control` (confirmed code)
- `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py:60-140,270-400` — `RunConfig`, `require_review`, `auto_publish` read path (confirmed code)
- `convex/auditLog.ts:61` — `auditLog:record` public mutation (confirmed)
- `convex/pipelineConfig.ts:17-60` — `pipelineConfig:upsert` + `getAll` (confirmed)
- `convex/runs.ts:1-60` — `runs:create` + `setConfigSnapshot` (confirmed; `scheduledPublishAt` field absent → additive needed)
- `apps/web/app/issue/[slug]/page.tsx:1-160` — Phase 19 issue page component tree (confirmed)
- `apps/web/next.config.ts` — No `headers()` function, no `frame-ancestors` CSP (confirmed absent)
- `apps/dispatch-control/lib/pipelineControlClient.ts` — Clerk-authed fetch wrapper pattern (confirmed)
- `.planning/research/PITFALLS.md:370-436` — Pitfall 5.1/5.2/5.3 on auto_publish risk, claims false confidence, preview fidelity (confirmed)
- `docs/API_CONTRACTS.md:830-1022` — §3B run-control contracts (confirmed existing endpoint shapes)

### Secondary (MEDIUM confidence — architectural inference from confirmed code)

- Claims extraction regex patterns — derived from the D-06 decision and Python stdlib `re` capabilities; specific patterns need validation against real section text in a test run.
- `frame-ancestors` CSP via Next.js `headers()` per-route — standard Next.js 14 App Router capability; not yet present in this project but well-documented.
- Sanity `perspective: 'previewDrafts'` — standard Sanity v3 SDK capability; the project already uses `@sanity/client` so this is a config change, not a new library.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all reuse paths confirmed by file reads
- Publish chain (D-01): HIGH — `_run_publisher` + `webhooks.py` + `API_CONTRACTS.md §5` all read and confirmed
- Schedule sweep (D-02): HIGH — `pipeline_tick` code read; `runs` table confirmed; `scheduledPublishAt` field needs adding
- Registry (D-03/D-04/D-05): HIGH — `charities` stub confirmed; `_domain_of()` confirmed; additive field shapes recommended
- Claims extraction (D-06/D-07): MEDIUM HIGH — D-06 regex approach is deterministic; the exact Portable Text structure is confirmed from component imports; specific regex patterns are untested against real output
- Draft-preview CSP (D-09): MEDIUM HIGH — Next.js `headers()` per-route is standard capability; exact `SANITY_API_TOKEN` availability on `apps/web` is unconfirmed (open question 1)
- `auto_publish` friction (D-11): HIGH — `pipelineConfig:upsert` and `auditLog:record` confirmed; rate-limit shape in Convex mutation is standard
- Scout re-point (REG-02): HIGH — `_load_featured_keys()` GROQ code confirmed; Convex query replacement pattern is straightforward

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable stack — 30 days)
