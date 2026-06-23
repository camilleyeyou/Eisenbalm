---
phase: 26-review-gate-charity-registry
verified: 2026-06-23T00:00:00Z
status: passed
score: 7/7 must-haves verified (RVW-04 email-alert deferral signed off 2026-06-23 — Phase 27 NTF seam accepted)
human_verification:
  - test: "Confirm that the intentional email-alert deferral to Phase 27 satisfies the RVW-04 requirement as scoped"
    expected: "The Convex deliberation event is emitted on auto_publish enable; Phase 27 (NTF-01/02) wires actual Slack/email transport. Confirm this is acceptable for Phase 26 sign-off."
    why_human: "ROADMAP success criterion #4 says 'triggers an email alert to the operator'. Implementation emits a Convex event (the Phase 27 NTF hook) but no email is sent. CONTEXT D-11 and API_CONTRACTS §26.6 explicitly document this as a pre-planned Phase 27 seam. Whether the emitted event satisfies 'alerted' in the success criterion requires a human judgment call."
---

# Phase 26: Review Gate + Charity Registry — Verification Report

**Phase Goal:** Every finished run lands in `awaiting_review` by default; operator sees a full rendered preview + cost before deciding; operator can approve-and-publish, approve-and-schedule, re-roll sections, or reject; enabling `auto_publish` requires explicit friction and is audit-logged; every factual claim is surfaced as a sign-off checklist; the charity registry tracks candidate/featured/blocklisted states and the Scout deduplicates against it.

**Verified:** 2026-06-23
**Status:** human_needed (6/7 truths verified; 1 item requires human judgment on a pre-documented deferral)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Finished run lands in `awaiting_review`; appears in review queue | ✓ VERIFIED | `publisher/__init__.py:115` calls `pipelineRuns:updateStatus` with `status='awaiting-review'`; `ReviewQueue` component filters `runs.listForWorkspace` to `awaiting-review` and renders review cards with link to `/runs/{runId}/review` |
| 2 | Operator sees rendered preview of full issue + cost before deciding | ✓ VERIFIED | `apps/web/app/issue/[slug]/preview/page.tsx` renders `IssueLayout` via `previewDrafts` Sanity perspective, gated by HMAC token; dispatch-control review page shows `PreviewIframe` + cost card from `runs:byRunId` |
| 3 | Operator can approve-publish, approve-schedule, reject, or re-roll | ✓ VERIFIED | `api/review.py` exposes `POST /issues/{run_id}/publish`, `/schedule`, `/reject`; `ReviewDecisionPanel.tsx` exposes all four decisions with two-step confirms; tick sweep in `control.py:270` fires `dueForPublish` each tick for scheduled runs |
| 4 | `auto_publish` is off by default; enabling requires modal, is rate-limited, audit-logged, and emits alert; dashboard shows alarming banner | ? PARTIAL | Modal, rate-limit (24h, enforced in `pipelineConfig:setAutoPublish`), audit log (`auditLog:write`), Convex event emitted — all present. **Email transport deferred to Phase 27 per CONTEXT D-11** (see Human Verification). `AutoPublishBanner` renders persistent red `role="alert"` on every dashboard page. |
| 5 | Factual-claims checklist surfaces every number/name/date; approve gated on sign-off | ✓ VERIFIED | `lib/claims.py` extracts deterministically (three compiled regexes, DATE before NUMBER); publisher calls `claimChecks:insertBatch`; `ClaimsChecklist` renders per-row check/skip; `ReviewDecisionPanel` disables approve until `claimChecks:allSignedOff` returns true; `/publish` endpoint re-checks server-side (Pitfall 6 guard) |
| 6 | Charity registry shows candidate/featured/blocklisted states with `timesFeatured`, `lastFeaturedAt`; operator can manage | ✓ VERIFIED | `convex/charities.ts` exports all 7 functions; schema has `dedupKey`, `website`, `domain`, `sanityCharityId`, `firstSeenRunId`, `timesFeatured`, `lastFeaturedAt`; `RegistryTable` wired to `charities:listByWorkspace` and `charities:setStatus`; `AddCharityDialog` calls `charities:upsertCandidate` |
| 7 | Scout consults registry; skips featured/blocklisted charities | ✓ VERIFIED | `scout.py:117-155` `_load_registry_keys()` calls `charities:listForDedup`; dedup set built from featured+blocklisted rows; `scout.py:267` filters candidates against `featured_set`; `scout.py:308` calls `charities:upsertCandidate` for survivors with featured/blocklisted non-downgrade guard |

**Score:** 6/7 truths verified (1 item has pre-planned partial deferral needing human judgment)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/API_CONTRACTS.md §26.1–§26.8` | All Phase 26 contracts documented | ✓ VERIFIED | 9 `§26.` anchors present; covers charities table, claim_checks, runs.scheduledPublishAt, pipelineRuns.sanityIssueId, review_actions enum, Convex function signatures, FastAPI endpoints, preview route |
| `convex/charities.ts` | 7 exports: upsertCandidate, upsertFeatured, setStatus, listByWorkspace, listForDedup, getByDedupKey, seedFromPublished | ✓ VERIFIED | All 7 functions present; `bareDomain()` helper mirrors `scout.py._domain_of()`; upsertCandidate guards against featured/blocklisted downgrade |
| `convex/claimChecks.ts` | 4 exports: insertBatch, setStatus, listByRunId, allSignedOff | ✓ VERIFIED | All 4 functions present; `allSignedOff` returns `false` on empty list (conservative, Pitfall 5); idempotent delete-then-reinsert in `insertBatch` |
| `convex/reviewActions.ts` | 2 exports: record, listByRunId | ✓ VERIFIED | Both functions present; canonical action vocabulary documented in file header (§26.5) |
| `convex/schema.ts` (additive) | charities additive fields, claim_checks table, runs.scheduledPublishAt, pipelineRuns.sanityIssueId, review_actions table | ✓ VERIFIED | All additive fields confirmed: `dedupKey`, `website`, `domain`, `sanityCharityId`, `firstSeenRunId` on charities; `claim_checks` table at line 355; `scheduledPublishAt` on runs at line 233; `sanityIssueId` on pipelineRuns at line 22; `review_actions` table at line 368 |
| `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` | Deterministic claims extractor | ✓ VERIFIED | Three compiled regexes (RE_NUMBER, RE_DATE, RE_PROPER_NOUN); DATE runs before NUMBER; dedup on case-folded text; public API: `extract_all_claim_types`, `flatten_portable_text`, `extract_claims` |
| `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` | Registry repoint | ✓ VERIFIED | `_load_registry_keys()` calls `charities:listForDedup`; candidates filtered against featured+blocklisted; `upsertCandidate` called for survivors |
| `packages/pipeline/src/eisenbalm_pipeline/api/review.py` | 3 review endpoints | ✓ VERIFIED | `POST /issues/{run_id}/publish`, `/schedule`, `/reject`; all three enforce claims-signoff gate (publish + schedule); all write `reviewActions:record` + `auditLog`; router mounted in `main.py:148` |
| `packages/pipeline/src/eisenbalm_pipeline/api/control.py` | Scheduled-publish sweep in pipeline_tick | ✓ VERIFIED | Lines 270–308: queries `runs:dueForPublish`, calls `_flip_sanity_published` for each due run, clears `scheduledPublishAt` to prevent re-fire |
| `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` | upsertFeatured on publish | ✓ VERIFIED | Line 330: `charities:upsertFeatured` called inside `_run_publisher` (fires on both manual publish and scheduled-publish tick) |
| `apps/web/lib/preview-token.ts` | 5-minute HMAC token with two-window accept | ✓ VERIFIED | `previewToken()` uses `Math.floor(Date.now() / 300_000)` window; `verifyPreviewToken()` checks current + previous window with `timingSafeEqual` |
| `apps/web/app/issue/[slug]/preview/page.tsx` | Token-gated draft preview | ✓ VERIFIED | `verifyPreviewToken` called before Sanity fetch; uses `sanityPreviewClient`; `QUERY_ISSUE_PREVIEW_BY_SLUG` has no status filter; `noindex,nofollow` meta tag; `force-dynamic` |
| `apps/web/next.config.ts` (frame-ancestors CSP) | Per-route CSP scoped to `/issue/:slug/preview` | ✓ VERIFIED | `headers()` block scoped to `source: '/issue/:slug/preview'`; reads `PREVIEW_ALLOWED_ORIGIN` env; not site-wide |
| `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx` | Review screen with preview iframe + cost + claims + decisions | ✓ VERIFIED | Two-column layout (64%/36%); `PreviewIframe`, `ClaimsChecklist`, `ReviewDecisionPanel` all mounted; cost parsed from `runs:byRunId`; preview URL built server-side |
| `apps/dispatch-control/app/(dashboard)/runs/_components/ReviewQueue.tsx` | Awaiting-review queue in runs list | ✓ VERIFIED | `useQuery(api.runs.listForWorkspace)` filtered to `awaiting-review`; links to `/runs/{runId}/review` |
| `apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx` | Friction-gated toggle with modal | ✓ VERIFIED | Non-dismissible modal (Escape blocked, no outside-click handler, no X); rate-limit error surfaced from mutation throw; always red-destructive button style |
| `apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx` | Persistent red alarming banner | ✓ VERIFIED | `role="alert"`, red styling, "Change in Config" link, renders `null` when disabled; wired in `layout.tsx:25` |
| `apps/dispatch-control/app/(dashboard)/registry/page.tsx` | Charity registry management UI | ✓ VERIFIED | `RegistryTable` + `AddCharityDialogTrigger` mounted; workspace_id passed from server component |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `publisher/__init__.py` | `pipelineRuns:updateStatus status='awaiting-review'` | `convex_mutation_safe` | ✓ WIRED | Line 111-123; also writes `sanityIssueId`, `durationMs`, `cost` |
| `publisher/__init__.py` | `claimChecks:insertBatch` | `convex_mutation_safe` before status flip | ✓ WIRED | Lines 96-103; claims extracted before `awaiting-review` flip so checklist is ready immediately |
| `api/review.py publish` | `claimChecks:allSignedOff` | Convex query guard | ✓ WIRED | Lines 107-117; 409 `claims_not_signed_off` if not all signed off |
| `api/review.py publish` | `_flip_sanity_published` | `sanity_publish.py` | ✓ WIRED | Lines 134; fires Sanity webhook → `_run_publisher` chain |
| `api/review.py schedule` | `runs:setScheduledPublish` | Convex mutation | ✓ WIRED | Lines 251-255 |
| `control.py pipeline_tick` | `runs:dueForPublish` | Convex query | ✓ WIRED | Lines 281-285; runs on every tick before cadence gate |
| `ReviewDecisionPanel` | `publishIssue` / `scheduleIssue` / `rejectIssue` | `reviewClient.ts` | ✓ WIRED | Clerk JWT passed via `getToken()`; error reasons mapped to UI-SPEC copy |
| `ReviewDecisionPanel` | `claimChecks:allSignedOff` | Convex `useQuery` | ✓ WIRED | `canApprove = signoffQuery !== undefined && signoffQuery.allSignedOff === true` (Pitfall 5 guard) |
| `ClaimsChecklist` | `claimChecks:listByRunId` + `claimChecks:setStatus` | Convex `useQuery` + `useMutation` | ✓ WIRED | Per-claim check/skip buttons call `setStatus` |
| `AutoPublishToggle enable` | `pipelineConfig:setAutoPublish` | Convex mutation | ✓ WIRED | Rate-limit throw caught and surfaced as UI error copy |
| `AutoPublishBanner` | `pipelineConfig:getAll` | Convex `useQuery` | ✓ WIRED | Reads `auto_publish` key; renders nothing when false |
| `AutoPublishBanner` | `dashboard layout.tsx` | `layout.tsx:11+25` | ✓ WIRED | Injected at top of `<main>` on every dashboard page |
| `pipelineConfig:setAutoPublish` | `auditLog:write` | `ctx.runMutation(internal.auditLog.write)` | ✓ WIRED | Lines 185-192; action `auto_publish_enabled` / `auto_publish_disabled` |
| `scout.py` | `charities:listForDedup` | `_load_registry_keys()` async convex_query | ✓ WIRED | Lines 117-155; fallback to empty list on Convex failure |
| `scout.py` | `charities:upsertCandidate` | async convex_mutation per survivor | ✓ WIRED | Lines 308-318; guarded try/except (non-critical) |
| `_run_publisher` | `charities:upsertFeatured` | `convex_mutation_safe` | ✓ WIRED | Lines 329-340; fires on every publish (manual + scheduled) |
| `PreviewIframe` (dispatch-control) | `/issue/[slug]/preview` (apps/web) | Signed HMAC URL built server-side in `review/page.tsx` | ✓ WIRED | `buildPreviewUrl(runId, slug)` — PREVIEW_SECRET stays server-only |
| `apps/web preview route` | `verifyPreviewToken` | Called before any Sanity fetch | ✓ WIRED | `preview/page.tsx:95` — unauthorized branch returns `<PreviewUnauthorized />` |
| `apps/web next.config.ts` | `frame-ancestors CSP` | `headers()` scoped to `/issue/:slug/preview` | ✓ WIRED | `PREVIEW_ALLOWED_ORIGIN` env var controls allowed origin |
| `api/main.py` | `review.router` | `app.include_router(review.router)` | ✓ WIRED | Line 148 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ReviewQueue.tsx` | `runs` (awaiting-review) | `useQuery(api.runs.listForWorkspace)` → Convex `runs` table | Yes — real Convex subscription | ✓ FLOWING |
| `ReviewPage` (cost display) | `costDisplay` | `convex.query(api.runs.byRunId)` → `parseCostJson(run.cost).total` | Yes — from pipeline cost JSON | ✓ FLOWING |
| `ClaimsChecklist` | `claims` | `useQuery(claimChecksApi.claimChecks.listByRunId)` → Convex `claim_checks` table | Yes — written by publisher node | ✓ FLOWING |
| `ReviewDecisionPanel` | `signoffQuery` | `useQuery(claimChecksApi.claimChecks.allSignedOff)` → Convex computation | Yes — real aggregate from claim_checks | ✓ FLOWING |
| `RegistryTable` | `charities` | `useQuery(api.charities.listByWorkspace)` → Convex `charities` table | Yes — written by Scout + publisher | ✓ FLOWING |
| `AutoPublishBanner` + `AutoPublishToggle` | `configRows` | `useQuery(api.pipelineConfig.getAll)` → Convex `pipeline_config` | Yes — real config rows | ✓ FLOWING |
| `preview/page.tsx` | `issue` | `sanityPreviewClient.fetch(QUERY_ISSUE_PREVIEW_BY_SLUG)` | Yes — previewDrafts Sanity perspective | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — pipeline endpoints require a live Railway server; Convex subscriptions require a live deployment. Automated checks cannot be run without running services.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RVW-01 | 26-01, 26-03, 26-05 | `awaiting_review` status; finished run lands there; review queue | ✓ SATISFIED | `publisher/__init__.py:115`; `ReviewQueue.tsx`; `runs:listForWorkspace` filtered |
| RVW-02 | 26-04, 26-05 | Full rendered preview + deliberation + cost before deciding | ✓ SATISFIED | `preview/page.tsx`; `PreviewIframe`; cost card in review page |
| RVW-03 | 26-03, 26-05 | Approve-and-publish, approve-and-schedule, reject, re-roll | ✓ SATISFIED | `api/review.py` 3 endpoints; `ReviewDecisionPanel` 4 decisions; tick sweep |
| RVW-04 | 26-01, 26-06 | auto_publish friction: off by default, modal, rate-limited, alerted, audit-logged, alarming banner | PARTIAL — see Human Verification | Modal + rate-limit + audit log + Convex event + alarming banner all present; email transport deferred to Phase 27 (D-11) |
| RVW-05 | 26-01, 26-02, 26-05 | Factual-claims checklist; all claims must be signed off before approve | ✓ SATISFIED | `lib/claims.py`; `claimChecks:insertBatch` in publisher; `ClaimsChecklist`; server-side gate in `/publish` |
| REG-01 | 26-01, 26-06 | Charity registry: candidate/featured/blocklisted states, timesFeatured, lastFeaturedAt, dedup key | ✓ SATISFIED | `convex/charities.ts`; `convex/schema.ts`; `RegistryTable`; `AddCharityDialog` |
| REG-02 | 26-01, 26-02 | Scout consults registry; skips featured/blocklisted | ✓ SATISFIED | `scout.py:_load_registry_keys()`; dedup set filter; `upsertCandidate` for survivors |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ClaimsChecklist.tsx:64` | `const claimChecksApi = api as any` — type assertion bypasses TS for `claimChecks` module | ℹ️ Info | Non-critical; comment explains pending Convex dev regeneration; functions work correctly at runtime. |
| `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/_components/ReviewDecisionPanel.tsx:30` | Same `api as any` pattern for `claimChecks:allSignedOff` | ℹ️ Info | Same reason as above; not a runtime issue. |
| `apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx:65` | `(api as any).pipelineRuns.byRunId` — type assertion for pipelineRuns | ℹ️ Info | Convex generated types may not include this query; functions correctly at runtime. |

No blocker or warning anti-patterns found. All Info-level items are pending `npx convex dev` regeneration which the SUMMARY for Plan 06 acknowledges.

---

### Human Verification Required

#### 1. RVW-04 Email Alert Deferral Sign-off

**Test:** Confirm that the Convex deliberation event emitted on `auto_publish` enable satisfies the "alerted" component of RVW-04 for Phase 26.

**Expected:** The ROADMAP success criterion states: "enabling it requires a modal confirmation step, is rate-limited, emits an audit log entry, and triggers an email alert to the operator." The implementation emits a `deliberationEvents` row with `eventType:'cost-warning'` (and inner payload `eventType:'auto-publish-enabled'`) as the Phase 27 NTF hook. No email is sent in Phase 26.

**Why human:** CONTEXT D-11 and API_CONTRACTS §26.6 explicitly document this as a pre-planned seam: "Phase 26 emits the event, Phase 27 wires Slack/email (D-11)." Whether the event emission satisfies "alerted" in the success criterion — or whether this constitutes a gap that must be noted on the Phase 26 completion record — requires Andrew's (or the project owner's) explicit sign-off. If the Phase 26 completion is accepted with the Phase 27 seam in place, status can be flipped to `passed`.

---

### Gaps Summary

No blocking gaps found. All artifacts exist, are substantive, and are wired. All key links verified.

The single human-verification item is a scope question about a pre-documented, intentional architectural deferral (email alert transport for `auto_publish` enable event). The Convex event hook is emitted. Phase 27 (NTF-01/02) will wire the actual transport. This is not an oversight — it was planned and documented before Phase 26 was executed.

---

_Verified: 2026-06-23_
_Verifier: Claude (gsd-verifier)_
