---
quick_id: 260720-gic
subsystem: api
tags: [fastapi, webhooks, idempotency, postgres, sanity, publisher]

provides:
  - Issue-keyed (publisher-run, issue_id) atomic claim in the Sanity publish webhook, preventing the Publisher's own problemPdf patch from re-scheduling itself
  - Hermetic RED-gated regression test proving the self-echo loop and its fix
affects: [pipeline-webhooks, publisher-agent-rollout]

tech-stack:
  added: []
  patterns:
    - "Second, differently-scoped idempotency claim (distinct `source`) layered on the same claim_idempotency_key/webhook_idempotency primitive, rather than a status check, to defeat a step-N-before-step-M write-ordering race"

key-files:
  created:
    - packages/pipeline/tests/api/test_webhook_self_echo.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py

key-decisions:
  - "Claim keyed on issue_id (not run_id or header idempotency-key) so it survives across the Publisher's distinct-header echoes; placed AFTER the §34.5 sign-off re-check so a blocked/reverted publish never permanently consumes the claim"
  - "No TTL on the claim: operator re-publish of the same issue does not go through this webhook (publish_manual / manual_publish call _run_publisher directly), so blocking a second WEBHOOK-driven publish of the same issue forever is acceptable"

requirements-completed: [ECHO-01]

duration: ~15min
completed: 2026-07-20
---

# Quick 260720-gic: Stop Publisher Webhook Self-Trigger Loop Summary

**Issue-keyed atomic claim (`source="publisher-run"`, `idempotency_key=issue_id`) in the Sanity publish webhook, taken immediately before scheduling `_run_publisher` and after the sign-off re-check, stops the Publisher's own `problemPdf` patch from re-triggering itself.**

## Performance

- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Reproduced the CONFIRMED production incident (run `d9c09fa7` / `issue-999604`) as a hermetic, Postgres-free regression test that FAILS against the unfixed handler (RED: `pub_spy.await_count == 2`) and PASSES after the fix (GREEN: `== 1`)
- Added an atomic `(publisher-run, issue_id)` claim, reusing the existing race-safe `claim_idempotency_key` helper against a namespace-separate `source`, so it cannot collide with the pre-existing header-key (`source="sanity-publish"`) dedup rows
- Verified the happy path (single webhook delivery) is unaffected — still schedules the Publisher exactly once with `{"scheduled": true}`
- Full `packages/pipeline` test suite green: 710 passed, 38 skipped (env-gated), 0 failed

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — hermetic self-echo regression test** - `a7bd115` (test)
2. **Task 2: GREEN — issue-keyed publisher-run claim before scheduling _run_publisher** - `6611a2a` (fix)

## Files Created/Modified

- `packages/pipeline/tests/api/test_webhook_self_echo.py` - New hermetic test module (bare FastAPI app, webhook router only, no env dependency). `test_self_echo_schedules_publisher_once` is the mandatory RED gate; `test_single_delivery_still_schedules_once` guards the happy path.
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` - Added the self-echo guard block in `sanity_publish`, positioned after the §34.5 sign-off re-check and immediately before `asyncio.create_task(_run_publisher(...))`. No existing guards were removed or reordered.

## Decisions Made

- Followed the plan's diagnosis and interfaces exactly: reused `claim_idempotency_key` unmodified, keyed the new claim on `issue_id` under a distinct `source="publisher-run"`, and placed it after the sign-off gate (not before) so a bypass-blocked publish never burns the claim for a later legitimate publish.
- Did not add a TTL or expiry to the claim — the plan's "re-publish escape hatch" analysis (both `publish_manual` and `manual_publish` invoke `_run_publisher` directly, bypassing this webhook entirely) makes a permanent per-issue claim safe.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's exact code, comment text, and placement instructions verbatim.

## Issues Encountered

None. The RED gate behaved exactly as predicted (`await_count == 2` pre-fix, confirmed before any fix was applied) and flipped to GREEN (`== 1`) after the fix with no iteration needed.

## Rollout Notes (carried forward from plan `<rollout>` and `<output>` — READ BEFORE DEPLOYING)

**This fix has NOT been deployed or pushed.** The orchestrator handles rollout after independent verification. When it does, the ordering below is load-bearing — reversing it re-opens the incident window.

### 1. Deploy-before-recreate ordering (CRITICAL)

This code change deploys to Railway automatically on push/merge to the deployed branch:

1. Merge/push → Railway auto-deploys the code fix.
2. **VERIFY the deploy is live** (Railway logs and/or `/healthz`) **BEFORE** the operator recreates the Sanity webhook that was manually deleted to stop the production incident.
3. **Only then**: the operator recreates the deleted Sanity webhook (see safer config below).

If the webhook is recreated before the fix is confirmed live, the self-trigger loop returns immediately and will hammer Sanity's API / rate-limit Vercel's deploy hook again, exactly as it did in the original incident.

### 2. Safer Sanity webhook filter for recreation (defense-in-depth, human config — NOT code)

When the operator recreates the deleted Sanity webhook, use this GROQ filter instead of the original (assumed) unconditional `status == "published"` filter:

```
_type == "weeklyIssue" && status == "published" && delta::changedAny(status)
```

This fires the webhook **only when `status` actually transitions to `"published"`** — the Publisher's `problemPdf` PATCH leaves `status` unchanged (it's already `"published"` when that patch happens), so `delta::changedAny(status)` is `false` for that mutation and the webhook simply never fires for it.

This is **complementary to the code fix, not a substitute**: the `(publisher-run, issue_id)` claim in `webhooks.py` is the authoritative guard (it holds even if the webhook filter is ever misconfigured or reverted); the GROQ filter reduces webhook noise/cost by not sending the echo request at all.

### 3. Separate follow-up — do NOT fix in this task

A pre-existing, latent bug surfaced in the same production logs during this incident's investigation: the `deliberationEvents:insert` Convex mutation call in `webhooks.py`'s bypass-blocked path sends an extra `timestamp` field that is **not present in the Convex validator** for that table. This is unrelated to the self-echo loop (it fires on the missing-signoffs block path, not the scheduling path this fix touches) and is explicitly out of scope here. Track it as its own follow-up quick task/phase — do not fold it into this fix.

## User Setup Required

None for this code change itself. The operator-facing action (recreating the Sanity webhook with the safer filter, in the correct order relative to deploy) is documented above under Rollout Notes and is NOT something this executor can perform (no deploy, no Sanity dashboard access, per this task's constraints).

## Next Phase Readiness

- Fix is committed and test-verified locally; ready for the orchestrator's independent verification and subsequent rollout per the ordering above.
- No blockers. No changes needed to the Publisher agent, Convex schema/functions, or frontend — scope was strictly the webhook handler as planned.

---
*Quick task: 260720-gic*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: packages/pipeline/tests/api/test_webhook_self_echo.py
- FOUND: packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
- FOUND: .planning/quick/260720-gic-stop-publisher-webhook-self-trigger-loop/260720-gic-SUMMARY.md
- FOUND commit a7bd115 (test: RED)
- FOUND commit 6611a2a (fix: GREEN)
