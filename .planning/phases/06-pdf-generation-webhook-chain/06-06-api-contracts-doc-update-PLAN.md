---
phase: 06-pdf-generation-webhook-chain
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
autonomous: true
requirements_addressed:
  - WHK-02

must_haves:
  truths:
    - "docs/API_CONTRACTS.md §5.3 reflects the verified Sanity webhook signature algorithm: t={ms},v1={base64url} over f'{ts}.{body}' — NOT the historical sha256=hex shape"
    - "docs/API_CONTRACTS.md §5.3 cross-references packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py (Plan 06-04) as the canonical implementation"
    - "Sections 5.1, 5.2, 5.4 remain unchanged (only §5.3 needs the correction)"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "Corrected §5.3 FastAPI handler skeleton with the right signature algorithm + cross-link to lib/sanity_webhook.py"
  key_links:
    - from: "docs/API_CONTRACTS.md §5.3"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py"
      via: "cross-reference comment"
      pattern: "lib/sanity_webhook"
---

<objective>
Amend `docs/API_CONTRACTS.md §5.3` to replace the wrong `sha256=hex` HMAC algorithm with the verified Sanity webhook signature algorithm from `@sanity/webhook` v5+ source: `t={ms},v1={base64url}` over the payload `f"{ts_ms}.{body}"`. Add a cross-reference to `lib/sanity_webhook.py` (Plan 06-04 lands the canonical implementation) so future maintainers don't re-introduce the old algorithm from the doc.

Purpose: per CLAUDE.md / API contract precedence, "Brief and API contracts are source of truth" — but this specific section is provably wrong against upstream. The planner directive (from planning_context) explicitly calls out: "API_CONTRACTS.md §5.3 has wrong signature algorithm per research; plan must include doc-update task amending it." Without this fix, any executor reading §5.3 verbatim would write an implementation that rejects every legitimate Sanity webhook.

Output: one doc-only edit, no code change. Parallel to Plan 06-04 (libs) and Plan 06-05 (renderer) because it's documentation, not implementation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
Current docs/API_CONTRACTS.md §5.3 (lines 1044-1079, WRONG signature algorithm):
```python
@router.post('/webhook/sanity-publish')
async def sanity_publish(request: Request, background_tasks: BackgroundTasks):
    # 1. Verify HMAC signature
    body = await request.body()
    signature = request.headers.get('sanity-webhook-signature', '')
    secret = os.environ['SANITY_WEBHOOK_SECRET'].encode()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(f'sha256={expected}', signature):
        raise HTTPException(status_code=401, detail='Invalid signature')

    # 2. Parse payload
    payload = await request.json()

    # 3. Guard: only trigger on published status
    if payload.get('status') != 'published':
        return {'ok': True, 'skipped': True}

    # 4. Trigger Publisher async — return 200 immediately
    background_tasks.add_task(...)
    return {'ok': True}
```

Verified algorithm (from 06-RESEARCH.md Pattern 1, sourced verbatim from
github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts):
```
header   = f"t={timestamp_ms},v1={signature}"
payload  = f"{timestamp_ms}.".encode("utf-8") + raw_body_bytes
signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload))
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace docs/API_CONTRACTS.md §5.3 signature algorithm with verified upstream algorithm</name>
  <read_first>
    - docs/API_CONTRACTS.md (lines 1020-1090 — full §5 Sanity Webhook section)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 1 — verbatim algorithm port + Pitfalls 1 + 4)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py (after Plan 06-04 lands — the canonical implementation)
  </read_first>
  <files>
    - docs/API_CONTRACTS.md
  </files>
  <action>
Edit `docs/API_CONTRACTS.md` §5.3. Locate the section header `### 5.3 — FastAPI handler` (around line 1044) and the code block that follows.

Replace lines 1044-1079 (the section header through the closing ``` of the code block) with the corrected version below. Preserve the surrounding sections (5.1, 5.2, 5.4) unchanged.

**New §5.3 content** (paste this in place of the existing §5.3 lines 1044-1079):

```markdown
### 5.3 — FastAPI handler

> **Algorithm correction (Phase 6 / 2026-05-18):** the Sanity webhook
> signature is NOT `sha256=<hex>` — that was a guess pinned in this doc
> before the upstream algorithm was verified. The canonical algorithm
> (from `@sanity/webhook` v5+ source) is:
>
>     header   = f"t={timestamp_ms},v1={signature}"
>     payload  = f"{timestamp_ms}.".encode("utf-8") + raw_body_bytes
>     signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload))
>
> The canonical Python implementation lives in
> `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py`
> (Phase 6 / Plan 06-04). Sources:
> https://github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts
> · `.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md`
> Pattern 1.

```python
# packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
# CANONICAL implementation: see lib/sanity_webhook.py for the verifier.

from fastapi import APIRouter, Request, HTTPException
from eisenbalm_pipeline.lib.sanity_webhook import (
    SIGNATURE_HEADER_NAME,
    SignatureError,
    SignatureExpiredError,
    verify_sanity_signature,
)

router = APIRouter()

@router.post('/webhook/sanity-publish')
async def sanity_publish(request: Request):
    # 1. Verify HMAC signature (raw body — DO NOT call request.json() first)
    raw = await request.body()
    sig_header = request.headers.get(SIGNATURE_HEADER_NAME)
    secret = os.environ['SANITY_WEBHOOK_SECRET']
    try:
        ts_ms = verify_sanity_signature(raw, sig_header, secret)
    except SignatureExpiredError:
        # WHK-03 — older than 5 minutes (or future-skewed beyond 5 min)
        raise HTTPException(status_code=410, detail='Signature too old')
    except SignatureError as e:
        # WHK-02 — bad format or HMAC mismatch
        raise HTTPException(status_code=401, detail=str(e))

    # 2. Parse payload
    payload = json.loads(raw)

    # 3. Guard: only trigger on published status
    if payload.get('status') != 'published':
        return {'ok': True, 'skipped': 'not-published'}

    # 4. WHK-04 — idempotency-key dedup (Plan 06-04 lib/idempotency.py)
    idem = request.headers.get('idempotency-key')
    if idem and request.app.state.pool is not None:
        first = await claim_idempotency_key(
            request.app.state.pool,
            source='sanity-publish',
            idempotency_key=idem,
            run_id=payload.get('runId'),
        )
        if not first:
            return {'ok': True, 'duplicate': True}

    # 5. Trigger Publisher async — return 200 immediately
    #    (asyncio.create_task pattern from Phase 4 Research Pitfall 4;
    #     BackgroundTasks is cancelled on client disconnect.)
    task = asyncio.create_task(_run_publisher(
        request.app,
        issue_id=payload['_id'],
        issue_number=payload['issueNumber'],
        run_id=payload.get('runId'),
    ))
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {'ok': True, 'scheduled': True}
```

**Signature header parsing notes:**

- The regex `^t=(\d+)[, ]+v1=([^, ]+)$` is permissive on whitespace between
  the two components — Sanity uses `, ` (comma + space) historically but
  `,` alone is accepted.
- The `t=` timestamp is the canonical age signal. The separate
  `sanity-transaction-time` header (ISO 8601) is a monitoring convenience;
  the 5-minute age check uses `t=` from the signature.
- Symmetric tolerance: reject `now - ts > MAX_AGE_MS` AND `ts - now >
  MAX_AGE_MS`. Either direction's skew beyond 5 min is rejected.
- The signature value uses **base64url WITHOUT padding** (`urlsafe_b64encode`
  + `.rstrip(b'=')`). Validators that accept padded base64 will fail.
```

After making the edit, verify it took:
```bash
grep -n "t={timestamp_ms},v1=" docs/API_CONTRACTS.md | head -3
# Expected: at least one hit in §5.3
grep -n "sha256=<hex>" docs/API_CONTRACTS.md
# Expected: no hits (or only inside the strikethrough/note block — verify by hand)
grep -n "verify_sanity_signature" docs/API_CONTRACTS.md | head -3
# Expected: at least one hit (cross-reference to lib module)
```
  </action>
  <verify>
    <automated>grep -c "t={timestamp_ms},v1=" docs/API_CONTRACTS.md && grep -c "verify_sanity_signature" docs/API_CONTRACTS.md && grep -c "lib/sanity_webhook" docs/API_CONTRACTS.md && ! grep -E "compare_digest\(f'sha256=" docs/API_CONTRACTS.md && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "t={timestamp_ms},v1=" docs/API_CONTRACTS.md` returns at least `1`
    - `grep -c "verify_sanity_signature" docs/API_CONTRACTS.md` returns at least `1`
    - `grep -c "base64url_no_pad" docs/API_CONTRACTS.md` returns at least `1`
    - `grep -c "Algorithm correction" docs/API_CONTRACTS.md` returns `1`
    - `grep -c "lib/sanity_webhook" docs/API_CONTRACTS.md` returns at least `1`
    - The OLD wrong line is absent: `grep -c "compare_digest(f'sha256=" docs/API_CONTRACTS.md` returns `0`
    - The OLD wrong shape is not present uncorrected: `grep -E "f'sha256=\{expected\}'" docs/API_CONTRACTS.md` produces no output
    - Section 5.1, 5.2, and 5.4 are unchanged: `grep -c "### 5.1" docs/API_CONTRACTS.md` returns `1`, `grep -c "### 5.2" docs/API_CONTRACTS.md` returns `1`, `grep -c "### 5.4" docs/API_CONTRACTS.md` returns `1`
  </acceptance_criteria>
  <done>
    docs/API_CONTRACTS.md §5.3 reflects the verified algorithm; future planners can quote it without introducing the bug; the file diff shows ONLY §5.3 changed.
  </done>
</task>

</tasks>

<verification>
- `git diff --stat docs/API_CONTRACTS.md` shows the file changed by < 100 lines (a focused edit, not a rewrite)
- `grep -A 2 "Algorithm correction" docs/API_CONTRACTS.md | head -5` shows the corrected algorithm block prominently at the top of §5.3
</verification>

<success_criteria>
1. API_CONTRACTS.md §5.3 shows the corrected `t={ms},v1={base64url}` algorithm
2. The wrong `sha256=hex` algorithm is removed (or strictly inside a strikethrough/correction note)
3. The new §5.3 cross-references lib/sanity_webhook.py as the canonical implementation
4. Sections 5.1, 5.2, 5.4 unchanged (no collateral damage)
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-06-SUMMARY.md` documenting:
  - The line-range that was replaced (e.g., "lines 1044-1079 → 1044-1115")
  - Whether the strikethrough was rendered (e.g., did you use markdown strikethrough syntax or a blockquote note)
  - Any other API_CONTRACTS sections that referenced the old algorithm and were touched as collateral
</output>
