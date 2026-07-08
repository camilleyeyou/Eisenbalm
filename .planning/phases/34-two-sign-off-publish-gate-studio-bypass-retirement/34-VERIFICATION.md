---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
verified: 2026-07-08T15:56:00Z
status: human_needed
score: 4/4 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/4 truths verified (server-side); 1 client test-suite regression
  gaps_closed:
    - "DecisionRail.tsx and its Phase 33 test suite remain internally consistent after the sign-off UI is added — plan 34-07 (commits 6498876, cb9b14c, f26ccf8) repaired the @convex/_generated/api mock (adds signOffs.activeByRunId), added a @/lib/signOffClient mock, taught mockQueries to default both sign-offs active, and added a 5-test 'DecisionRail sign-offs (Phase 34, D-01/D-05/D-06)' describe block. Re-run confirmed: pnpm --filter dispatch-control test → 44 files passed / 1 skipped, 376 tests passed / 2 todo. Only the test file (+ planning docs) was touched — production code unchanged."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Set SANITY_STUDIO_DISABLE_PUBLISH=true in the Studio env, rebuild/restart Studio, open a weeklyIssue document and confirm the Publish action is absent (and still present for every other document type); unset the flag and confirm it returns"
    expected: "weeklyIssue publish button disappears only when the flag is 'true'; no effect on other schema types; reversible"
    why_human: "Requires a running Sanity Studio instance with real env var injection — the document.actions resolver logic was verified by code reading, but the runtime behavior cannot be confirmed statically"
  - test: "With a run that has zero or one active sign-off, flip a weeklyIssue's status to 'published' directly in Sanity Studio, then confirm (a) status reverts to 'in-review', (b) no Vercel deploy / PDF generation fires, (c) an audit row (run.publish_bypass_blocked) and a deliberation alert appear"
    expected: "The D-07 webhook guard blocks + reverts + audits + alerts; the publisher never runs"
    why_human: "Needs live Sanity + Convex + a running FastAPI instance with a real webhook delivery; the local pytest webhook suite is env-skipped and the pre-existing lifespan-fixture gap (deferred-items.md) prevents exercising this path in-harness"
---

# Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement Verification Report

**Phase Goal:** An issue cannot be published without two independent, server-enforced sign-offs, and the Sanity Studio status-flip can no longer bypass that gate.
**Verified:** 2026-07-08T15:56:00Z (re-verification after gap-closure plan 34-07)
**Status:** human_needed (all automated checks pass; two runtime-UAT items remain)
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Publish endpoint returns 409 unless both "Facts cleared" and "Sounds human" sign-offs are recorded for the run | ✓ VERIFIED | `review.py::publish_issue`/`schedule_issue` query `signOffs:activeByRunId` and 409 `missing_signoffs` listing exactly which kind(s) are absent (review.py L77-123, L191-243). No override path exists (grep confirms only doc-comment references to D-03, no code path). `test_review_endpoints.py` covers both-active-passes / one-missing-409 / none-active-409. Regression-checked after 34-07: pattern still present, production code untouched by the gap-closure commits. |
| 2 | The Sanity publish webhook handler re-checks sign-off state before running the publisher — a Studio status-flip no longer triggers a publish | ✓ VERIFIED | `webhooks.py::sanity_publish` (L124-172) re-queries `signOffs:activeByRunId` after the existing HMAC/age/status/idempotency guards and before `asyncio.create_task(_run_publisher(...))`. Missing sign-off(s) OR `run_id is None` → `_revert_sanity_status(..., status="in-review")` + audit row (`run.publish_bypass_blocked`) + `deliberationEvents:insert` alert, and the publisher is never launched. A legit dashboard publish passes through unchanged. Covered by 3 new + 3 updated cases in `test_webhook_sanity.py` (env-skipped locally, pre-existing pattern). |
| 3 | Sanity Studio's publish action for `weeklyIssue` is disabled/removed after a soak period, with Studio documented as read-only fallback | ✓ VERIFIED (code+docs; flag-flip is intentionally manual/future per D-10/D-11) | `apps/studio/sanity.config.ts` `document.actions` resolver filters out `'publish'` for `weeklyIssue` only, gated on `SANITY_STUDIO_DISABLE_PUBLISH === 'true'` (default OFF, untouched for every other schema type). `apps/studio/README.md` §"Publishing & the console (Phase 34)" and `EDITOR_GUIDE.md` §"Soak & retiring Studio publish (Phase 34)" document the console as system-of-record, Studio as read-only fallback, and the manual soak-end criterion. The webhook guard (truth #2) protects the gate regardless of flag state. Runtime flag-flip confirmation is human UAT item #1. |
| 4 | Every sign-off, publish attempt, and any override is recorded in the audit log with actor and timestamp | ✓ VERIFIED | `api/signoffs.py::record_sign_off` emits `auditLog:record` action=`signoff.recorded` (actor+resource_id=`{run_id}:{kind}`) on every successful sign-off. The webhook bypass-block path emits `auditLog:record` action=`run.publish_bypass_blocked` plus a `deliberationEvents:insert` alert. Content-mutation-triggered revocations are recorded via `signOffs:revokeAll`'s `revokedAt`/`revokedReason` fields on the `sign_offs` row (D-02's "recorded, not field-flips that lose history" design, frozen verbatim in API_CONTRACTS §34.6) paired with the underlying content mutation's own `_emit_audit` call. No override path exists (D-03), so "override" audit coverage is vacuously satisfied by the existing `auto_publish` toggle precedent per CONTEXT.md. |

**Score:** 4/4 success-criteria truths verified. The previously flagged client test-suite regression is closed (see Re-verification below).

### Re-verification: Gap Closure (Plan 34-07)

The initial verification (2026-07-08T15:30:46Z) found one gap: Plan 34-06's new `useQuery(api.signOffs.activeByRunId, ...)` call broke all 16 pre-existing tests in `apps/dispatch-control/__tests__/DecisionRail.test.tsx` (unmocked `signOffs` key), and no new sign-off UI coverage was added.

**Closure verified (full 3-level check on the failed item):**

| Check | Result |
|-------|--------|
| Commits exist | ✓ `6498876`, `cb9b14c`, `f26ccf8` all valid per `gsd-tools verify commits` |
| Files touched | ✓ Only `apps/dispatch-control/__tests__/DecisionRail.test.tsx` + planning docs — production code untouched |
| Mock repaired (exists) | ✓ `signOffs: { activeByRunId: 'signOffs:activeByRunId' }` at L33 of the api mock; `vi.mock('@/lib/signOffClient', ...)` at L37 with a `recordSignOff` spy |
| Substantive | ✓ `mockQueries` handles `signOffs:activeByRunId` (L147) defaulting both sign-offs active, preserving the 3 pre-existing zero-blocker Publish assertions under the new both-greens gate |
| New coverage (wired) | ✓ New `describe('DecisionRail sign-offs (Phase 34, D-01/D-05/D-06)')` block at L329 with 5 tests: control render, `recordSignOff('tok-clerk', 'run-1', 'facts-cleared')` invocation, affirmative "signed Nm ago" state, both-greens Publish gating, blocker-disabled Facts control |
| Suite passes (behavioral) | ✓ `pnpm --filter dispatch-control test -- --run` → **44 files passed / 1 skipped, 376 tests passed / 2 todo** — matches the reported gap-closure state exactly |

**Regression check on previously passed items:** existence + key-pattern spot-checks re-run on all 9 Phase-34 source artifacts (review.py `missing_signoffs` gate, webhooks.py `publish_bypass_blocked` guard, `_revert_sanity_status`, `_revoke_active_signoffs`, `sign_offs` schema, `signOffs.ts` queries, Studio flag, `signOffClient.ts`, DecisionRail subscription) — all pass. Since the 34-07 commits touched no production code, no deeper regression re-verification was warranted.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/API_CONTRACTS.md` §34 | Frozen contract for sign_offs table, endpoints, gates, webhook, Studio action | ✓ VERIFIED | `## Phase 34 —...` at L2913, §34.1–§34.9 all present |
| `convex/schema.ts` | `sign_offs` table, 3 indexes | ✓ VERIFIED | L426-442, matches §34.1 verbatim |
| `convex/signOffs.ts` | record/revokeAll/activeByRunId/listByRunId | ✓ VERIFIED | All 4 exported, upsert-by-index pattern, secret-guarded mutations / public queries |
| `convex/_generated/api.d.ts` | Regenerated, exposes `signOffs` | ✓ VERIFIED | L37, L76 |
| `packages/pipeline/.../api/signoffs.py` | `POST /issues/{run_id}/sign-off`, relocated facts prerequisites | ✓ VERIFIED | Full match to §34.3 |
| `packages/pipeline/tests/test_signoffs_endpoints.py` | Sign-off endpoint matrix | ✓ VERIFIED | 6/6 tests pass locally |
| `review.py` publish/schedule gate restructure | `missing_signoffs` 409, claims/error checks removed | ✓ VERIFIED | Both endpoints; old direct checks fully relocated |
| `lib/sanity_publish.py::_revert_sanity_status` | Inverse of `_flip_sanity_published` | ✓ VERIFIED | L77-91, defaults `status="in-review"` |
| `api/webhooks.py` D-07 guard | Re-check + revert + block + alert | ✓ VERIFIED | L124-172, matches §34.5/§34.6b incl. `run_id is None` |
| `api/control.py::_revoke_active_signoffs` | Fail-open shared helper | ✓ VERIFIED | L177-186 |
| Call-site wiring (content.py ×9, findings.py ×3, control.py rerun_agent ×1) | All 13 content-mutation endpoints revoke on save | ✓ VERIFIED | All 13 call sites confirmed with endpoint-specific reason strings |
| `apps/dispatch-control/lib/signOffClient.ts` | `recordSignOff` client | ✓ VERIFIED | Mirrors reviewClient.ts shape |
| `DecisionRail.tsx` Sign-offs section | Two live controls, both-greens Publish gate | ✓ VERIFIED | Component correct; test suite repaired + extended by 34-07 |
| `apps/dispatch-control/__tests__/DecisionRail.test.tsx` | Consistent mock + sign-off coverage | ✓ VERIFIED (was ✗) | 21 tests (16 repaired + 5 new), all passing |
| `apps/studio/sanity.config.ts` | Flag-gated `document.actions` override | ✓ VERIFIED | L29-41, scoped to `weeklyIssue` only |
| `apps/studio/README.md` + `EDITOR_GUIDE.md` | Read-only-fallback + soak criterion docs | ✓ VERIFIED | Both sections present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `convex/signOffs.ts::record`/`revokeAll` | `requirePipelineSecret` | secret guard | ✓ WIRED | First line of both handlers |
| `api/signoffs.py` | `signOffs:record` | `_cc.convex_mutation` | ✓ WIRED | Confirmed |
| `review.py::publish_issue`/`schedule_issue` | `signOffs:activeByRunId` | `missing_signoffs` gate | ✓ WIRED | Both call sites |
| `api/webhooks.py` | `signOffs:activeByRunId` | webhook re-check | ✓ WIRED | L134 |
| `api/webhooks.py` | `_revert_sanity_status` | bypass revert | ✓ WIRED | L141, imported L28 |
| `content.py` (×9) / `findings.py` (×3) / `control.py::rerun_agent` | `signOffs:revokeAll` | `_revoke_active_signoffs` | ✓ WIRED | 13/13 |
| `DecisionRail.tsx` | `api.signOffs.activeByRunId` | `useQuery` live subscription | ✓ WIRED | Runtime + test mock both consistent now (was ✗ in test mock) |
| `lib/signOffClient.ts` | `/issues/{runId}/sign-off` | POST fetch | ✓ WIRED | Confirmed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PUB-01 | 34-01, 02, 03, 05, 06 (+07 tests) | Publish requires two independent server-enforced sign-offs, 409 unless both recorded | ✓ SATISFIED | Truth #1 |
| PUB-02 | 34-01, 04 | Webhook re-checks sign-off state before publishing; Studio flip can't bypass | ✓ SATISFIED | Truth #2 |
| PUB-03 | 34-01, 06 | Studio publish path locked down behind flag, documented as read-only fallback after soak | ✓ SATISFIED (code/docs; soak-end flip is intentionally manual/future) | Truth #3 |
| PUB-04 | 34-01, 02, 03, 04, 05, 06 | Every sign-off, publish, override audit-logged with actor+timestamp | ✓ SATISFIED | Truth #4 |

No orphaned requirements — REQUIREMENTS.md's Phase 34 mapping (PUB-01..04) matches what the plans declared.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None remaining | — | The 34-06 test-suite regression flagged in the initial verification is closed by 34-07. No TODO/FIXME/PLACEHOLDER/stub patterns in any Phase-34 source file. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pipeline test suite (full) | `uv run pytest -q` (packages/pipeline) | `441 passed, 36 skipped` | ✓ PASS |
| Sign-off endpoint matrix | `uv run pytest tests/test_signoffs_endpoints.py -q` | `6 passed` | ✓ PASS |
| Webhook D-07 guard tests | `uv run pytest tests/api/test_webhook_sanity.py -q` | `8 skipped` (env-conditional, pre-existing pattern) | ? SKIP — source inspection confirms the 3 D-07 cases exist and assert block/revert/audit |
| `apps/web` vitest suite | `pnpm --filter web test -- --run` | `443 passed, 13 todo` | ✓ PASS |
| `pnpm --filter dispatch-control build` | build | exit 0, all routes generated | ✓ PASS |
| `apps/dispatch-control` vitest suite | `pnpm --filter dispatch-control test -- --run` | `44 files passed / 1 skipped; 376 passed / 2 todo` | ✓ PASS (was ✗ FAIL: 16 failed pre-34-07) |

### Human Verification Required

### 1. SANITY_STUDIO_DISABLE_PUBLISH flag-flip UAT

**Test:** Set `SANITY_STUDIO_DISABLE_PUBLISH=true` in `apps/studio/.env.local` (or the Studio deployment env), rebuild/restart Studio, open a `weeklyIssue` document, confirm the "Publish" action is absent from the document actions menu while every other document type's publish action is untouched. Unset the flag and confirm it returns.
**Expected:** `weeklyIssue` publish button disappears only when the flag is `'true'`; no effect on other schema types; reversible.
**Why human:** Requires a running Sanity Studio instance with real env var injection — cannot be verified via static code/test analysis alone. (The `document.actions` resolver logic itself was verified by direct code reading.)

### 2. End-to-end Studio-bypass-block against live Sanity + Convex

**Test:** With a real run that has zero or one active sign-off, manually flip a `weeklyIssue` document's `status` to `published` directly in Sanity Studio (bypassing the dashboard). Confirm: (a) the document's status reverts to `in-review` shortly after, (b) no Vercel deploy / PDF generation fires, (c) an audit row (`run.publish_bypass_blocked`) and a deliberation alert appear.
**Expected:** Matches the D-07 guard's designed behavior (confirmed via code reading + the 34-04 SUMMARY's documented manual `starlette.testclient.TestClient` smoke test).
**Why human:** Needs live Sanity + Convex + a running FastAPI instance with a real webhook delivery; the local pytest webhook suite is env-skipped and the pre-existing lifespan-fixture gap (`deferred-items.md`) prevents exercising this path in-harness.

### Gaps Summary

No gaps remain. The initial verification's single gap — the DecisionRail test-suite regression introduced by 34-06 — was closed by gap-closure plan 34-07 (commits `6498876`, `cb9b14c`, `f26ccf8`): the Convex API mock now includes `signOffs.activeByRunId`, a `@/lib/signOffClient` mock was added, `mockQueries` defaults both sign-offs active (preserving the pre-existing zero-blocker Publish assertions under the new both-greens gate), and a 5-test sign-off describe block covers the new UI. Independently re-run: the full dispatch-control vitest suite passes (376 passed / 2 todo), and since 34-07 touched only the test file plus planning docs, no production behavior changed and no regression re-check beyond spot-checks was needed.

The phase's server-side goal is fully achieved: the publish/schedule endpoints, the webhook's independent re-validation, the Studio publish-action flag, and the audit trail all match the frozen `docs/API_CONTRACTS.md` §34 contract exactly. A Studio status-flip cannot publish an issue — the server, not the client, is the enforcement boundary. Two runtime-UAT items (live flag flip; live bypass-block) remain for human confirmation; both verify runtime behavior of logic already confirmed correct in code.

---

_Verified: 2026-07-08T15:56:00Z_
_Verifier: Claude (gsd-verifier)_
