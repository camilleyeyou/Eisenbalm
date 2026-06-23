# Phase 26: Review Gate + Charity Registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 26-review-gate-charity-registry
**Areas discussed:** Publish/schedule mechanism, Charity registry source-of-truth, Factual-claims extraction, Review preview rendering

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Publish/schedule mechanism | How approve→publish/schedule fires | ✓ |
| Charity registry source-of-truth | Convex registry vs Sanity dual-store; Scout dedup | ✓ |
| Factual-claims extraction | Deterministic vs LLM; where it runs; web-search | ✓ |
| Review preview rendering | Iframe real page vs dashboard-native render | ✓ |

**User's choice:** All four.

---

## Publish / Schedule mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Flip Sanity status → reuse webhook | Publish endpoint sets weeklyIssue.status='published' → existing webhook → _run_publisher (PDF+Vercel) | ✓ |
| Direct publisher endpoint | Run _run_publisher directly, bypass webhook | |
| Phase 25 tick sweeps due publishes | Hourly /pipeline/tick also fires due scheduled publishes | ✓ |
| Convex scheduled function | Dedicated Convex scheduler.runAfter/cron for publishing | |

**User's choice:** Flip Sanity status → reuse webhook (D-01); Phase 25 tick sweeps due publishes (D-02).
**Notes:** Single proven publish codepath; reuses the hourly kill-switch-gated tick — no new scheduler.

---

## Charity registry source-of-truth

| Option | Description | Selected |
|--------|-------------|----------|
| Convex registry authoritative | Featured upserted on publish; Scout queries registry; one-time backfill; Sanity stays canonical content | ✓ |
| Sanity featured + Convex overlay | GROQ dedup for featured + Convex only for blocklist/candidate | |
| Full migration to registry | Convex fully replaces GROQ; remove archive query | |
| Normalized name + domain | Match on case-folded name OR bare domain (reuse scout.py:96) | ✓ |
| Website domain only | Match purely on bare domain | |
| Normalized name only | Match on case-folded name | |
| Scout logs candidates (yes) | Scout upserts pitched charities as status='candidate' | ✓ |
| Featured/blocklist only (no) | Registry tracks featured + operator blocklist only | |

**User's choice:** Convex registry authoritative (D-03); dedup key = normalized name + domain (D-04); Scout logs candidates (D-05).
**Notes:** Directly satisfies REG-02 "Scout consults the registry." Implies additive `charities` fields (website/domain + dedup key + optional Sanity slug) + one-time backfill.

---

## Factual-claims extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic extraction | Regex/NLP surfaces every number/date/proper-noun — full recall, zero token cost | ✓ |
| LLM claims pass | One LLM call extracts clean labeled claims; recall not guaranteed; costs $ | |
| Hybrid | Deterministic recall + LLM labeling | |
| Pipeline run-end, stored on run | Extract at run finish, persist to Convex, instant review screen | ✓ |
| Dashboard on-demand | Extract in TS on review-screen open; persist only check-off state | |
| No web-search (checklist only) | Human sign-off check/skip gate only | ✓ |
| Optional web-search verification | Per-claim web lookup surfacing support/contradiction | |

**User's choice:** Deterministic extraction (D-06); pipeline run-end stored on run (D-07); no web-search (D-08).
**Notes:** "Every number/name/date" is the literal acceptance bar — deterministic guarantees full recall. Check-off state persists in Convex.

---

## Review preview rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Iframe real page (draft route) | Token-guarded apps/web draft-preview route (previewDrafts) iframed in dashboard — true WYSIWYG | ✓ |
| Dashboard-native render | dispatch-control re-renders draft content itself | |
| Dashboard chrome around preview | Issue is centerpiece; cost/claims/decisions in side panel/header | ✓ |
| Separate tabs/sections | Preview, claims, cost as separate tabs | |

**User's choice:** Iframe real page via draft route (D-09); dashboard chrome around preview (D-10).
**Notes:** Review gate's whole point is fidelity. Requires guarded preview route + Sanity draft perspective + frame-ancestors CSP for the dashboard origin.

---

## Wrap-up

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Lock decisions; auto_publish friction + registry UI as Claude's discretion | ✓ |
| Discuss auto_publish friction | RVW-04 rate-limit/alarm/email-alert-boundary | |
| Discuss registry UI scope | REG-01 CRUD vs toggles, manual-add, location | |

**User's choice:** Ready for context.

## Claude's Discretion

- RVW-04 `auto_publish` friction (modal + rate-limit + audit-log + alarming enabled state; email alert event now, transport Phase 27) — captured as D-11.
- REG-01 registry management UI scope (a `/charities` route in dispatch-control; CRUD vs toggles-first) — Claude's call per brief.
- Endpoint shapes/names, scheduled-publish + claims storage shape, which actions emit audit/review rows, rate-limit window, registry backfill mechanics.

## Deferred Ideas

- Notification transport (Slack/email) — Phase 27.
- Web-search-backed claim verification — later.
- Stripe reconciliation + model_pricing staleness — Phase 27.
- Full issue-lifecycle kanban board — later polish.
- Wider re-roll (upstream nodes / auto QA re-run) — out.
