# Phase 49: Roles & Permissions - Research

**Researched:** 2026-07-16
**Domain:** Server-side RBAC over an existing Clerk-authenticated (no-role) console, split across FastAPI (4 routes) + Convex (2 mutations); a net-new flat comment capability
**Confidence:** HIGH for the FastAPI enforcement path and locked-control rendering; MEDIUM for the Clerk→Convex custom-claim path (one real, version-specific landmine found — see Pitfall 1); MEDIUM for the comment data model (net-new, no prior art in this repo)

## Summary

Phase 49 adds one authorization layer on top of an authentication layer that already works. Both server surfaces (`_require_clerk_jwt_control` in FastAPI, `requireOperator` in Convex) already verify a real Clerk identity — neither reads a role. Cataloguing role requires a Clerk-side decision (where does the role claim live and how does each backend see it) plus two small, additive server dependencies, one client-side presentation hook, and one net-new Convex table for comments.

The single highest-risk unknown is **not** the FastAPI side — it already fails safe because `test_control.py`/`test_clerk_auth.py`-style tests never set `CLERK_JWT_ISSUER_DOMAIN`, so they run through the local-dev sentinel path, and D-04 already specifies that sentinel resolves to Editor-in-chief (zero test breakage). The real risk is on the **Convex** side: `convex-test`'s existing `t.withIdentity({ subject: '...' })` calls (in `activate.test.ts`, `charitiesDoNotUse.test.ts`, `convexAuthLockdown.test.ts`) carry no role claim, and a fail-closed `requireEditor` will break them unless the plan explicitly updates each one to add `role: 'Editor-in-chief'`. This is a concrete, enumerable list (below) — not a vague warning.

The second real risk, found via current (2026) source research and not from training-data recall, is that **convex-js ≥1.34 changed how `ConvexProviderWithClerk` fetches its token**: when the default Clerk session token's `aud` claim equals `"convex"`, the provider now sends the RAW session token instead of fetching the named `"convex"` JWT template, silently dropping any custom claim that exists ONLY on the template. This repo pins `convex: "^1.38.0"` (past the change). The safe mitigation — add the role claim to **both** the default/customized session token AND the named `"convex"` JWT template — is documented below and should be spot-verified empirically in Wave 0 before the rest of the phase is built on it.

**Primary recommendation:** Store role as Clerk `publicMetadata.role` (`"Editor-in-chief" | "Collaborator"`); expose it as a same-named custom claim on BOTH the default session token (Clerk Dashboard → Sessions → Customize session token) and the `"convex"` JWT template (Clerk Dashboard → JWT Templates → convex → Claims) using `{{user.public_metadata.role}}`; add `_require_editor` (FastAPI, layered on `_require_clerk_jwt_control`) and `requireEditor(ctx)` (Convex, alongside `requireOperator`) as thin additive checks on `claims.get("role")` / `identity.role`; treat the FastAPI local-dev sentinel and an absent/undefined role on the Convex side according to the fail-safe rules in Pitfall 2 and Pitfall 3 respectively.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROL-01 | A user carries a role of Editor-in-chief or Collaborator, enforced server-side | Role-resolution section (Clerk publicMetadata → JWT claim on two surfaces) + `_require_editor` / `requireEditor` shapes |
| ROL-02 | Exactly six actions gated to Editor-in-chief | Confirmed handler inventory (below) — 4 FastAPI routes + 2 Convex mutations, exact `Depends()`/call-site swap points identified |
| ROL-03 | Collaborator sees every gated control locked with an explanation, never hidden | `<LockedControl>` pattern researched against existing button/disabled conventions in `RevisionFlow.tsx` / `VersionHistoryPanel.tsx`; verbatim locked labels sourced from DERIVED-STATE-CONTRACT §6 |
| ROL-04 | Collaborator can read everything and comment | Comment data-model research: `comments` Convex table shape, mount points (`layout.tsx` FrameChrome + `/my-tasks/page.tsx`), API_CONTRACTS §39-style new-table precedent |

</phase_requirements>

## Standard Stack

No new libraries. This phase is 100% additive logic on the existing stack: Clerk (already installed, `@clerk/nextjs` in dispatch-control), Convex (`convex` `^1.38.0`, `convex-test` `^0.0.53`), FastAPI + PyJWT (already the verifier in `api/auth.py`/`api/control.py`). CLAUDE.md forbids new npm dependencies — nothing here requires one.

### Core (already present, reused)
| Library | Version (verified in repo) | Purpose | Why reused not replaced |
|---------|---------|---------|--------------|
| `@clerk/nextjs` | (dispatch-control `package.json`) | Session/identity in the console | `useAuth().getToken()` / `useUser()` already the only identity surface |
| `convex` | `^1.38.0` | Convex client + backend runtime | `ctx.auth.getUserIdentity()` is the only path to a verified identity server-side |
| `convex-test` | `^0.0.53` | Convex mutation/query unit testing | `t.withIdentity({...})` already the established test-identity pattern |
| `PyJWT` (`jwt`) | pinned in `packages/pipeline/pyproject.toml` | RS256 verification against Clerk JWKS | `api/auth.py::_fetch_public_key` / `jwt.decode` already does this — role is just one more field on the same decoded dict |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Clerk `publicMetadata` + JWT claim | Mirror `users.role` in Convex and read it via a DB lookup inside `requireEditor` | Rejected by CONTEXT D-03: `upsertCurrentUser` is not called by live app code today (only tests — verified, see Code Context), so `users.role` is not a live source; adding a JIT-upsert-activation dependency is unnecessary extra surface when the JWT claim path works today without it |
| Per-request Convex DB role lookup | JWT custom claim (no DB round-trip) | JWT claim is faster (no query) and is what CONTEXT D-03 already recommends; rejected the DB-lookup path as the *primary* mechanism, though `users.role` remains a viable optional mirror later |
| `ConvexError` for FastAPI's 403 body | Existing bare `HTTPException(status_code=403, detail={...})` pattern | No change needed — FastAPI already returns dict-shaped `detail` on every other 40x in this codebase (`{"reason": "wrong_status", ...}` etc.); keep that convention for `_require_editor`, do not introduce a different error envelope for one dependency |

**Installation:** none.

**Version verification:**
```bash
grep '"convex"' apps/dispatch-control/package.json   # "^1.38.0" — confirmed 2026-07-16
```
`convex@^1.38.0` post-dates the `ConvexProviderWithClerk` JWT-template-vs-raw-session-token behavior change introduced in 1.34.0 (see Pitfall 1) — this is a **load-bearing version fact**, not a hypothetical, and drives the "add the claim to both surfaces" recommendation below.

## Architecture Patterns

### Recommended structure (no new files beyond what's listed)
```
packages/pipeline/src/eisenbalm_pipeline/api/
├── control.py          # existing _require_clerk_jwt_control lives here — ADD _require_editor here too
├── revision.py          # apply_passage_revision — swap claims: dict = Depends(_require_clerk_jwt_control)
│                        #   → Depends(_require_editor)  [1 line]
├── factcheck.py         # apply_claim_evidence — same 1-line swap
├── signoffs.py           # record_sign_off (kind="sounds-human" only — see Open Question 1) — same swap
└── review.py             # publish_issue — same swap

convex/
├── lib/auth.ts           # existing requireOperator lives here — ADD requireEditor here too
├── promptVersions.ts     # activate() — swap requireOperator(ctx) → requireEditor(ctx)  [1 line]
├── charities.ts          # setStatus() — same swap
└── comments.ts            # NEW — add/list, both-roles-callable

apps/dispatch-control/
├── lib/
│   └── role.ts            # NEW — useRole() hook wrapping useUser(), reads publicMetadata.role
├── components/
│   └── LockedControl.tsx  # NEW — the reusable wrapper (ROL-03)
└── app/(dashboard)/issues/[issueNumber]/
    ├── layout.tsx          # FrameChrome — ADD a persistent Comments affordance here (covers all 5 stages + overview)
    └── ../my-tasks/page.tsx # ADD the same affordance here (My Tasks is a sibling route, NOT under this layout)
```

### Pattern 1: Role claim on Clerk, read without a DB round-trip on both backends
**What:** Store role in Clerk `publicMetadata.role` (`"Editor-in-chief" | "Collaborator"`, assigned out-of-band per D-14 — no admin UI this phase). Expose it as a custom claim named `role` on:
1. The **default/customized session token** (Clerk Dashboard → Configure → Sessions → "Customize session token" → Claims editor → add `"role": "{{user.public_metadata.role}}"`). This is what every existing `useAuth().getToken()` call (no template argument) already sends to FastAPI — **zero changes needed in any of the ~15 `*Client.ts` files that call `getToken()`** — the claim just starts appearing in the same `claims` dict `_require_clerk_jwt_control` already returns.
2. The **named `"convex"` JWT template** (Clerk Dashboard → JWT Templates → the template literally named `convex`, per `convex/auth.config.ts`'s own setup comment → Claims editor → add the SAME `"role": "{{user.public_metadata.role}}"`). This is what `ConvexProviderWithClerk` fetches for every Convex call.

**Why both, not one:** Two separate systems (confirmed against current Clerk docs, not training-data assumption — see Sources). A named JWT template does **not** automatically inherit claims added to the default session token, and vice versa. Skipping either one leaves that backend blind to role.

**When to use:** Immediately — this is the only viable path today per CONTEXT D-03 (mirroring `users.role` into Convex is not viable because the JIT upsert isn't live-wired).

**Example (FastAPI side — no new dependency needed, only a new consumer):**
```python
# packages/pipeline/src/eisenbalm_pipeline/api/control.py
# claims already returned by _require_clerk_jwt_control includes "role" once the
# Clerk session-token claim above is configured — no change to that function.

async def _require_editor(
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Layered on top of _require_clerk_jwt_control — authorization, not
    authentication. Local-dev sentinel (sub == "local-dev-operator", set when
    CLERK_JWT_ISSUER_DOMAIN is unset) resolves to Editor-in-chief (D-04) so
    every existing header-free test for the 4 gated routes keeps passing
    unchanged. A real, deployed identity must carry role == "Editor-in-chief"."""
    if claims.get("sub") == "local-dev-operator":
        return claims
    if claims.get("role") != "Editor-in-chief":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"reason": "forbidden_role", "message": "Editor-in-chief only."},
        )
    return claims
```

**Example (Convex side):**
```typescript
// convex/lib/auth.ts — alongside requireOperator
export async function requireEditor(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'unauthorized', message: 'Not authenticated' })
  if (identity.role !== 'Editor-in-chief') {
    throw new ConvexError({ code: 'forbidden_role', message: 'Editor-in-chief only.' })
  }
  return identity.subject
}
```
Source pattern for `ConvexError` usage (import from `convex/values`, structured `.data` on the client): confirmed against current Convex docs (see Sources) — this repo has ZERO prior `ConvexError` usage (`requireOperator`/`requirePipelineSecret` all throw plain `Error`), so introducing it here is a deliberate new pattern per CONTEXT D-06, not an established one — flagged for planner awareness, not a blocker.

### Pattern 2: Client-side role hook — presentation only
**What:** A `useRole()` hook wrapping Clerk's `useUser()`, reading `user?.publicMetadata?.role as Role | undefined`. Returns `'Editor-in-chief' | 'Collaborator' | undefined` (undefined while Clerk is still loading — callers must treat undefined as "don't assume either way," not as Collaborator, to avoid a locked-flash-then-unlock flicker for editors).
**When to use:** Only inside `<LockedControl>` and any nav role indicator (nav indicator itself is Phase 50, per CONTEXT deferred list — this phase only needs the hook to exist and be consumed by `LockedControl`).
**Why client-only, never authoritative:** D-11 — the server dependency (`_require_editor`/`requireEditor`) is the only real gate; this hook exists purely so the UI can decide which of two render branches (active button vs. locked-with-explanation) to show.

### Pattern 3: `<LockedControl>` wrapper
**What:** A wrapper component that takes the role-gated action's normal enabled button as `children` (or a render-prop) plus a `lockedLabel` string (the verbatim DERIVED-STATE-CONTRACT §6 text) and renders EITHER the real control (if `useRole() === 'Editor-in-chief'`) OR a disabled-but-focusable control with the explanation rendered as visible adjacent text (not `title=` tooltip-only — CONTEXT D-10 requires this to be perceivable without hover/focus-reveal).
**Existing convention it must match (verified against `VersionHistoryPanel.tsx` line ~196-207, `RevisionFlow.tsx`):** raw `<button>` elements, Tailwind utility classes, `disabled:cursor-not-allowed disabled:opacity-40`, `min-h-[44px]` (WCAG AA touch-target), `focus-visible:ring-2` — no component library. `<LockedControl>` should preserve this exact class vocabulary so a locked button is visually indistinguishable in *chrome* from a normal disabled button, differing only in the explanation text rendered beside/below it.
```typescript
// apps/dispatch-control/components/LockedControl.tsx (shape, not final code)
interface LockedControlProps {
  isLocked: boolean
  lockedLabel: string          // verbatim from DERIVED-STATE-CONTRACT §6 — never paraphrased
  children: React.ReactNode    // the real, enabled control
}
export function LockedControl({ isLocked, lockedLabel, children }: LockedControlProps) {
  if (!isLocked) return <>{children}</>
  return (
    <div className="flex flex-col gap-1">
      {/* Preserve original control's sizing/shape but force-disable + strip handlers */}
      <div aria-disabled="true" className="pointer-events-none opacity-40">{children}</div>
      <span role="note" className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-ink-soft)]">
        {lockedLabel}
      </span>
    </div>
  )
}
```
Note: forcing `pointer-events-none` on a wrapped enabled-looking button risks it still being focusable-but-inert in a confusing way (tab lands on it, Enter does nothing, no announcement). CONTEXT D-10 requires "still focusable/announced" — the safer implementation clones the child with `disabled` + `aria-disabled="true"` forced onto the actual `<button>` (via `React.cloneElement` or by having each call site pass its own `disabled={!isEditor}` and only using `<LockedControl>` for the explanation text placement) rather than wrapping an enabled button in a non-interactive overlay. **Leave the exact mechanism (clone vs. prop-threading) to planning** — both satisfy D-10, but prop-threading is less fragile than `cloneElement` type-checking across 6 different existing button call sites with different prop shapes.

### Anti-Patterns to Avoid
- **Hiding instead of locking:** ROL-03 explicitly forbids `{isEditor && <Button/>}` — the six controls must always render, disabled+explained for a Collaborator. (The Issues Create/Reopen-hidden and My-Tasks-disabled UX notes in the Annotations doc are separate, pre-existing, non-server-gated presentation choices — CONTEXT D-07 explicitly says these are NOT among the six and are not this phase's contract.)
- **Trusting a client-supplied role/actorId:** Both `requireOperator` and `requireEditor` must derive the actor/role from the verified identity only — never from a mutation argument (this discipline already exists in `promptVersions.activate`'s `actorId: _actorId` — intentionally-ignored pattern; keep it).
- **Treating the FastAPI and Convex sentinel/test-identity concerns as symmetric:** they are not (see Pitfall 2 vs Pitfall 3) — do not assume "the sentinel handles it" covers the Convex side too.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured mutation errors | A custom error-code convention for Convex | `ConvexError({ code, message })` from `convex/values` | Already the documented, client-catchable (`error instanceof ConvexError`, `error.data`) mechanism in current Convex — no need to invent a string-parsing convention |
| Role storage | A second Convex table/field beyond `users.role` | Clerk `publicMetadata` (source of truth) + JWT claim (read path) | D-02 explicitly forbids a second role field; `users.role` already exists and is the intended future mirror, not a new column |
| Timing-safe secret comparisons | A new compare helper for the (unrelated) pipeline/webhook secrets touched by this phase not at all | N/A — Phase 49 does not touch `requirePipelineSecret`/`requireWebhookSecret` | Out of scope; listed only to confirm this phase does not need to touch `constantTimeEqual` |

**Key insight:** everything genuinely new in this phase (comments) is small and flat by design (D-13); everything else is a 1-line dependency swap on top of infrastructure that already exists and already works for authentication. The temptation to hand-roll would be building a role-management/admin UI (explicitly out of scope, D-14) or a second identity system — resist both.

## Common Pitfalls

### Pitfall 1: convex-js ≥1.34 may bypass the named JWT template's custom claims (version-specific, HIGH-confidence finding)
**What goes wrong:** `ConvexProviderWithClerk` (in `convex-js`) added a code path in v1.34.0: when the *raw default session token's* `aud` claim already equals `"convex"`, the provider skips fetching the named `"convex"` JWT template and forwards the raw session token instead — silently dropping any custom claim that exists ONLY on the named template.
**Why it happens:** An optimization to avoid a redundant `getToken({template})` round-trip when the session token is already usable as-is; documented in a live upstream GitHub issue (get-convex/convex-js#145, filed against v1.34.0, no resolution found beyond a pin-to-1.32.0 workaround as of research date).
**How to avoid:** This repo pins `convex: "^1.38.0"` — past the change. Mitigate by adding the SAME `role` claim to **both** the default/customized session token AND the named `"convex"` JWT template (Pattern 1 above), so the claim survives regardless of which code path fires.
**Warning signs:** In Wave 0, before building `requireEditor` against it, log `JSON.stringify(await ctx.auth.getUserIdentity())` from any existing authenticated mutation in a dev session and confirm `role` actually appears. Do not assume the JWT-template edit alone is sufficient — verify empirically once, then proceed.

### Pitfall 2: FastAPI local-dev sentinel and existing tests — LOW risk (already handled by D-04, confirmed safe)
**What goes wrong:** Naively requiring `claims.get("role") == "Editor-in-chief"` everywhere would break every existing test for the 4 gated FastAPI routes, because none of them set `CLERK_JWT_ISSUER_DOMAIN` (confirmed: `test_control.py`, `test_review_endpoints.py`, `test_signoffs_endpoints.py`, `test_revision_endpoints.py`, `test_factcheck_endpoints.py` all run through the sentinel path, which returns `{"sub": "local-dev-operator"}` with no `role` key).
**Why it happens:** The sentinel is a deliberate local-dev/test convenience (`_require_clerk_jwt_control`'s existing docstring) that predates role entirely.
**How to avoid:** `_require_editor` must special-case `claims.get("sub") == "local-dev-operator"` → treat as Editor-in-chief (exactly D-04's instruction) BEFORE checking the role claim. This keeps every one of the ~15+ existing pytest cases across those 5 files green with zero test edits.
**Warning signs:** none if implemented as above — this is the one part of the auth surface that requires no test changes at all.

### Pitfall 3: Convex-side existing tests WILL break unless explicitly updated (HIGH risk, concrete enumerable list)
**What goes wrong:** Unlike FastAPI, Convex has no "local-dev sentinel" concept — `convex-test`'s `t.withIdentity({ subject: 'user_operator' })` calls simulate a REAL authenticated identity for the test, with no role field. Swapping `requireOperator(ctx)` → `requireEditor(ctx)` inside `promptVersions.activate` and `charities.setStatus` will make `requireEditor` see `identity.role === undefined`, which must resolve to **rejected** (fail-closed — an absent/unmigrated role claim should never silently grant Editor-in-chief, unlike the FastAPI sentinel case which is a known, intentional dev-only string).
**Why it happens:** These are pre-existing, currently-passing tests written before role existed.
**How to avoid:** The plan must explicitly update every `withIdentity({ subject: ... })` call that exercises `promptVersions.activate` or `charities.setStatus` to `withIdentity({ subject: '...', role: 'Editor-in-chief' })`. Confirmed exact files touching these two mutations:
  - `apps/dispatch-control/__tests__/activate.test.ts` (2 `withIdentity` calls exercising `activate`)
  - `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` (Lane 1 — 1 call exercising `activate`; also documents the "rejects with no identity" case, which must continue to pass unchanged since it has no identity at all, not merely a wrong role)
  - `apps/dispatch-control/__tests__/charitiesDoNotUse.test.ts` (3 `withIdentity` calls exercising `setStatus`)
  - `apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts` — grep-confirmed to reference `promptVersions.activate`; verify at plan time whether it calls the mutation directly (needs the role claim) or only reads eval-gate state.
  Each of these files also needs a NEW negative case: `withIdentity({ subject: 'user_x', role: 'Collaborator' })` → expect a thrown `ConvexError`/rejection (this is the direct proof of ROL-01/SC-1 on the Convex side).
**Warning signs:** `pnpm --filter dispatch-control test` (or equivalent vitest invocation) regressing from its current green baseline the moment `requireEditor` is swapped in — this is the canary; do not proceed past that swap without updating the enumerated files in the same commit/plan-task.

### Pitfall 4: `role` as a reserved/collision claim name
**What goes wrong:** Convex's `UserIdentity` interface reserves certain claim names (`sub`, `iss`, `aud`, `iat`, `exp`, `nbf`, `jti` are rejected outright by Convex if returned as custom claims; the interface also has its own first-class OIDC fields like `name`, `email`, etc.).
**Why it happens:** n/a — `role` is not in either reserved list, confirmed against the current `UserIdentity` interface doc (see Sources) — this is a non-issue, listed only because it was explicitly checked, not assumed.
**How to avoid:** No action needed; `role` is safe to use as the claim/field name on both surfaces.
**Warning signs:** none expected.

### Pitfall 5: Confusing the two different "operator" name traps
**What goes wrong:** `agents.py::_require_operator` (FastAPI) and `convex/lib/auth.ts::requireOperator` are both **authentication only**, despite the "operator" name suggesting a role. CONTEXT.md already flags this explicitly (code_context "Not authorization" note) — restated here because it is exactly the kind of thing a planner skimming code might miss and wire `_require_editor` on top of the wrong base, or assume `requireOperator` already does part of the job.
**How to avoid:** `_require_editor` layers on `_require_clerk_jwt_control` (control.py), NOT on `agents.py::_require_operator` (a different dependency, used by the single-agent test-run/score endpoints, which are out of scope for this phase — they are not among the six). `requireEditor` is a sibling to `requireOperator` in `convex/lib/auth.ts`, not a wrapper around it (both independently call `ctx.auth.getUserIdentity()` — no need to compose them, since `requireEditor`'s role check already implies a valid identity exists, same as `requireOperator`'s check).

## Code Examples

### FastAPI: swapping the dependency on all four routes (mechanical, ~4 one-line edits)
```python
# packages/pipeline/src/eisenbalm_pipeline/api/revision.py:355 (apply_passage_revision)
# packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:546 (apply_claim_evidence)
# packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py:55 (record_sign_off, kind="sounds-human" only — see Open Question 1)
# packages/pipeline/src/eisenbalm_pipeline/api/review.py:67 (publish_issue)

# BEFORE:
claims: dict = Depends(_require_clerk_jwt_control),
# AFTER:
claims: dict = Depends(_require_editor),
```
`_require_editor` must be imported from `api.control` into each of these four modules (they already import `_require_clerk_jwt_control` and `_emit_audit` from there — same import line, one more name added).

### Convex: swapping the guard on both mutations (mechanical, 2 one-line edits + import)
```typescript
// convex/promptVersions.ts:280 (activate) and convex/charities.ts:185 (setStatus)
// BEFORE:
const actor = await requireOperator(ctx)
// AFTER:
const actor = await requireEditor(ctx)
```

### Testing the rejection (FastAPI) — reusing the existing `_make_jwt_mock` helper verbatim
```python
# Source pattern: packages/pipeline/tests/api/test_clerk_auth.py — _make_jwt_mock already
# exists and is exactly what a new test_control_role_gate.py (or similar) should reuse.

async def test_apply_revision_rejects_collaborator(auth_client, monkeypatch):
    monkeypatch.setenv("CLERK_JWT_ISSUER_DOMAIN", "https://example.clerk.accounts.dev")
    monkeypatch.setattr(
        "eisenbalm_pipeline.api.auth._fetch_public_key", lambda kid: "dummy-key"
    )
    import eisenbalm_pipeline.api.control as control_mod
    monkeypatch.setattr(control_mod, "jwt", _make_jwt_mock(
        unverified_header={"kid": "k1", "alg": "RS256"},
        decode_returns={"sub": "user_collab", "role": "Collaborator"},
    ))
    r = await auth_client.post("/issues/run-abc/revise/apply", json={...})
    assert r.status_code == 403
    assert r.json()["detail"]["reason"] == "forbidden_role"
```
Note: `_require_editor` in `control.py` calls `_fetch_public_key` from `api.auth` (per the existing `_require_clerk_jwt_control` implementation, which does a `from eisenbalm_pipeline.api.auth import _fetch_public_key` local import) — the monkeypatch target for `jwt` itself must match wherever `_require_editor`'s underlying claims resolution actually imports `jwt` from (currently `control.py` does its own local `import jwt`) — verify the exact patch target against the live implementation when the plan writes this test, don't copy this path blindly.

### Testing the rejection (Convex) — reusing the existing `convexTest`/`withIdentity` harness
```typescript
// apps/dispatch-control/__tests__/promptVersionsRoleGate.test.ts (new file, or added to activate.test.ts)
it('rejects a Collaborator-role identity', async () => {
  const t = convexTest({ schema, modules })
  await seedOneVersion(t)
  await expect(
    t.withIdentity({ subject: 'user_collab', role: 'Collaborator' }).mutation(
      api.promptVersions.activate,
      { workspace_id: WS, agentKey: 'scout', version: 1, actorId: 'user_collab' },
    ),
  ).rejects.toThrow(/forbidden_role|Editor-in-chief/)
})
```

## Comment Capability — the primary unknown (ROL-04)

### Recommended data model
Follow the `charity_corrections` (§39.1) precedent exactly — this repo already has a proven "small, append-only, workspace+key-scoped Convex table with a guarded mutation + unguarded read query" pattern; comments should be its sibling, not a new shape.

```typescript
// convex/schema.ts — NEW
comments: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),              // PRIMARY target key — matches the console's issue-keyed model (§40)
  stage: v.optional(v.string()),        // 'story' | 'draft' | 'fact-check' | 'voice' | 'approval' | undefined (issue-overview-level or My Tasks)
  anchorRef: v.optional(v.string()),    // free-form opaque string (e.g. a claim index, a section name) — screen-level granularity by default (D-13 leaves this open; start flat, do not build claim/passage-level anchoring this phase)
  text: v.string(),
  authorId: v.string(),                 // Clerk subject from ctx.auth.getUserIdentity() — NEVER client-supplied
  createdAt: v.number(),
})
  .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
  .index('by_workspace', ['workspace_id']),
```

```typescript
// convex/comments.ts — NEW
// Mutation — BOTH roles may call (this is the one write a Collaborator can make).
// Uses ctx.auth.getUserIdentity() directly (NOT requireOperator, NOT requireEditor —
// neither is right: this needs "any authenticated user," which is a THIRD, even
// simpler lane than the two in convex/lib/auth.ts today).
add({ workspace_id, issueNumber, stage?, anchorRef?, text }): Promise<Id<'comments'>>

// Query — UNGUARDED read (matches charity_corrections:listByCharityKey convention)
listByIssueNumber({ workspace_id, issueNumber, stage? }): Promise<Doc<'comments'>[]>
```

**A third auth lane is needed, not a reuse of `requireOperator`/`requireEditor`:** both existing helpers implicitly assume "the caller must be *an* authenticated dashboard user" — which is exactly right for `add`, but neither name fits ("operator" already means something specific in this codebase per Pitfall 5, and `requireEditor` is by definition Editor-in-chief-only, the opposite of what comments need). Recommend a plain `requireAnyIdentity(ctx)` (or inlining `ctx.auth.getUserIdentity()` directly in `comments.add`, mirroring `upsertCurrentUser`'s own inline check) rather than overloading either existing helper's name/semantics.

### Mount points (both are needed — confirmed by reading the actual layout code, not assumed)
- **The 5 stages + issue overview:** `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx`'s `FrameChrome` component is the single shared frame rendered for every one of `/issues/[issueNumber]`, `/story`, `/draft`, `/fact-check`, `/voice`, `/approval` — confirmed by reading the file: it renders `{children}` (the per-stage content) between a persistent `WorkspaceOutline` and a collapsible `ContextPanel`. **Do not** try to hang comments off `ContextPanel`'s `panelContent` prop — that slot is REPLACED per-stage via `WorkspaceStateProvider`'s `setPanelContent` (confirmed: each stage screen sets its own panel content, e.g. Stage 2 open QA items, Stage 4 voice findings), so anything mounted there would be clobbered on every stage switch. Instead, add a persistent, separate `<IssueComments issueNumber={n} stage={currentStageSegment} />` affordance directly inside `FrameChrome` (e.g., a second collapsible region beside `ContextPanel`, or a toggle in the header row) — a NEW mount point sibling to, not inside, `ContextPanel`.
- **My Tasks:** `apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx` is a SIBLING route, NOT nested under `/issues/[issueNumber]/layout.tsx` — it needs its own, separate placement of the same `<IssueComments>`/comment-affordance component (likely per-task-row, since My Tasks aggregates across issues — confirm exact placement against the My Tasks row shape at plan time, out of research scope to prescribe further).

### Scope discipline (D-13)
Stay flat: no threading, no @mentions, no notifications. `add`/`listByIssueNumber` is the entire mutation/query surface. Do not build anchor-resolution (span/claim-level anchoring) — `anchorRef` is an optional opaque string for future use, not a resolved/re-anchored reference like the galley's QA-finding spans (§32) — comments do not need to survive content edits by re-resolving position; a screen/stage-level granularity satisfies "read everywhere + leave comments."

## API_CONTRACTS.md registration (CLAUDE.md hard rule — checked, not skipped)

Two things in this phase require a **new `## §49` section** in `docs/API_CONTRACTS.md`, following the exact template every phase since §31 uses (contract-first, written before code, "Plan NN-0X implements these shapes verbatim"):

1. **The `users.role` vocabulary change** (D-02): the schema comment at `convex/schema.ts:240` currently reads `role: v.optional(v.string()), // "admin" | "operator" — RBAC deferred to Phase 28`. This is a **value-vocabulary change** (not a field rename — the field name `role` is untouched, only the semantic string values change to `"Editor-in-chief" | "Collaborator"`), which still falls under the CLAUDE.md "schema field renames" contract-check rule by its spirit (a `docs/API_CONTRACTS.md` consumer reading the old comment would be actively misled). Document the new vocabulary in §49 and update the schema.ts comment in the same plan/commit.
2. **The new `comments` table + `convex/comments.ts` functions** (D-12) — a wholly new table, same "contract-first" obligation §39/§40/§46/§47 all followed for their own new tables. Model §49's structure directly on §39's (`charity_corrections`) — table shape, mutation/query signatures, and an explicit append-only-or-not statement (comments are append-only for `add`; no edit/delete this phase — mirror §39's "no update/patch/remove/delete function is defined" invariant unless the plan decides otherwise).

Do **not** add a new `deliberationEvents.eventType` literal for role-gate denials or for comments — CONTEXT D-08 already rules out an audit row for denials, and comments are a `comments`-table concern, not a `deliberationEvents` concern (the existing note at API_CONTRACTS.md:525 — "Dedicated table, NOT a new deliberationEvents.eventType literal" — is precedent that a new concern gets a new table, not a new frozen-union literal).

## Project Constraints (from CLAUDE.md)

- No new npm dependencies — satisfied (this phase needs none).
- No CDN scripts — not implicated by this phase.
- WCAG AA / ≥44px touch targets / single `<main>` / prefers-reduced-motion — `<LockedControl>` must preserve the `min-h-[44px]` convention already used on every button in this codebase (verified in `VersionHistoryPanel.tsx`, `ContextPanel.tsx`, `layout.tsx`'s `StatusReadout`); the locked explanation text must be visible, not a `title=` tooltip (WCAG: tooltip-only content is not reliably perceivable) — satisfies both D-10 and the CLAUDE.md a11y rule simultaneously.
- Schema field renames / new eventTypes / new payload shapes checked against `docs/API_CONTRACTS.md` first — see the dedicated section above; both changes (role vocabulary, `comments` table) require a new/updated §49 section BEFORE implementation, per repo convention.
- Do not regress the `deliberationEvents`/`agentVotes` emission path — this phase does not touch either; confirmed no code path in the six gated actions or in `comments.ts` needs to write to `deliberationEvents`.
- GSD workflow enforcement (this repo's own CLAUDE.md) — plan execution must go through `/gsd:execute-phase`, not direct edits; not a research concern but restated for the planner's awareness.

## Testing Approach — proving SC-1 (server-side rejection, not UI-hiding)

### FastAPI (4 routes)
Reuse `packages/pipeline/tests/api/test_clerk_auth.py`'s `_make_jwt_mock` helper verbatim (it already mocks `get_unverified_header`/`decode`/exception classes without needing a real RSA keypair). For each of the 4 routes (`apply_passage_revision`, `apply_claim_evidence`, `record_sign_off` kind="sounds-human", `publish_issue`):
- **Positive:** `CLERK_JWT_ISSUER_DOMAIN` set, mocked `jwt.decode` returns `{"sub": "user_x", "role": "Editor-in-chief"}` → 200 (or whatever the route's normal success/409-for-other-reasons path is).
- **Negative (the SC-1 proof):** same setup, `role: "Collaborator"` → 403, `detail.reason == "forbidden_role"`.
- **Local-dev-sentinel regression guard:** `CLERK_JWT_ISSUER_DOMAIN` unset (existing test default) → unchanged behavior, proving D-04 held.

Recommend one new test file per route-family (or a single `test_role_gate.py` covering all 4, parametrized by path) rather than scattering role assertions into the 4 existing endpoint test files — keeps the "6 gated actions" contract auditable from one file.

### Convex (2 mutations)
Reuse the `convexTest`/`withIdentity` pattern from `activate.test.ts`/`convexAuthLockdown.test.ts` verbatim. For `promptVersions.activate` and `charities.setStatus`:
- **Positive:** `t.withIdentity({ subject: 'user_x', role: 'Editor-in-chief' })` → succeeds (update the 6 enumerated existing call sites from Pitfall 3 to add this field).
- **Negative (the SC-1 proof):** `t.withIdentity({ subject: 'user_x', role: 'Collaborator' })` → `rejects.toThrow(...)` (or catches a thrown `ConvexError` and asserts `.data.code === 'forbidden_role'`).
- **No-identity case (already covered, keep it):** `t.mutation(...)` with no `withIdentity` at all → still rejects (this proves authentication still gates even before role does).

### Comments (`add`/`listByIssueNumber`)
- Both an Editor-in-chief and a Collaborator identity can call `add` and it succeeds (positive proof of ROL-04's "the one write a Collaborator can make").
- No identity at all → `add` rejects (comments still require *some* authenticated user, just not a specific role).
- `listByIssueNumber` is unguarded (matches `charity_corrections:listByCharityKey`) — no identity needed to read.

### Frontend (`<LockedControl>`) — presentation-only, lower-stakes
A component-level test (vitest + Testing Library, if that's the existing frontend-component test pattern in this app — verify against how `VersionHistoryPanel`/similar components are tested today) asserting: given `isLocked=true`, the locked label text is present in the DOM (not just in a `title` attribute) and the wrapped control is `disabled`/`aria-disabled`. This is NOT a substitute for the server-side tests above — it only proves ROL-03's rendering contract, never ROL-01's enforcement.

## Open Questions

1. **Does "confirm evidence replacement" gate at `apply_claim_evidence` (§42.4a) only, or also at the metadata-only `replace_claim_source` (`factcheck.py:349`)?**
   - What we know: CONTEXT.md's code_context explicitly calls out `apply_claim_evidence` (`:546`) as the gated one, and explicitly says it is "NOT the metadata-only `replace_claim_source` at :349."
   - What's unclear: whether `replace_claim_source` should remain fully open to Collaborators (a metadata-only edit, arguably harmless) or was simply out of the six-action count by design.
   - Recommendation: Treat CONTEXT.md's explicit exclusion as authoritative (it was verified against the live code, not guessed) — do not gate `replace_claim_source`. If this proves wrong in practice, it is a 1-line addition later, not a rework.

2. **Does `record_sign_off` need role-gating on BOTH `kind` values, or only `"sounds-human"`?**
   - What we know: ROL-02's six-action list says "approve the Voice Pass" (singular) and CONTEXT's D-06 explicitly names only `kind="sounds-human"` as the gated one; `facts-cleared` is a separate concept (machine-checkable claims sign-off) not named among the six.
   - What's unclear: whether a Collaborator being able to record `facts-cleared` (the OTHER sign-off kind, on the SAME endpoint) is intended, or an oversight in the six-action framing.
   - Recommendation: Gate only when `body.kind == "sounds-human"` inside `record_sign_off` (an in-handler branch, not a route-level `Depends()` swap, since the route handles both kinds) — this is a different shape than the other 3 FastAPI routes (which gate the whole route) and the planner should design `record_sign_off`'s guard as a conditional check inside the handler, not a `Depends()` swap. Flag this explicitly in the plan so it isn't implemented identically to the other three by copy-paste.

3. **Exact mount mechanism for the persistent Comments affordance in `FrameChrome`** (collapsible panel vs. header toggle vs. bottom drawer).
   - What we know: `ContextPanel` is unsuitable (gets clobbered per-stage, confirmed by reading the code) — comments need their own, separate, persistent slot.
   - What's unclear: the exact visual placement/interaction (a second `<ContextPanel title="Comments">` instance stacked with the first? A slide-over triggered from the header row?).
   - Recommendation: Leave to planning/implementation discretion (D-14 already reserves "comment-affordance placement" for planning) — this research confirms WHERE it must NOT go (not inside the per-stage `panelContent` slot) and WHERE it must ALSO appear (My Tasks, a separate route) but does not prescribe the exact widget.

4. **`requireAnyIdentity` naming for `comments.add`'s auth lane.**
   - What we know: neither `requireOperator` nor `requireEditor` semantically fits "any authenticated user, no role check."
   - What's unclear: whether the planner wants a formally named third helper in `convex/lib/auth.ts`, or an inline `ctx.auth.getUserIdentity()` check inside `comments.add` (mirroring `users.ts::upsertCurrentUser`'s own inline pattern, which never called a shared helper).
   - Recommendation: Inline is lower-ceremony and matches the one existing precedent (`upsertCurrentUser`) for "just needs any identity." A named helper only pays for itself if a second mutation needs the same "any identity" lane later — not clearly true yet in this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Pipeline framework | pytest + pytest-asyncio (`asyncio_mode = "auto"`), `packages/pipeline/pyproject.toml` |
| Pipeline quick run | `cd packages/pipeline && uv run pytest tests/api/test_clerk_auth.py tests/test_control.py -x -q` |
| Pipeline full suite | `cd packages/pipeline && uv run pytest -x -q` (baseline per Phase 48 completion: 679 passing) |
| Dispatch-control framework | Vitest (`apps/dispatch-control/vitest.config.ts`), `convex-test` for Convex functions, edge-runtime environment |
| Dispatch-control quick run | `cd apps/dispatch-control && pnpm vitest run __tests__/activate.test.ts __tests__/charitiesDoNotUse.test.ts __tests__/convexAuthLockdown.test.ts` |
| Dispatch-control full suite | `cd apps/dispatch-control && pnpm test` (`vitest run`) (baseline per Phase 48 completion: 939 passing) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROL-01 | Collaborator's direct FastAPI call rejected (4 routes) | unit (pytest, mocked JWT) | `uv run pytest tests/api/test_role_gate.py -x` | ❌ Wave 0 (new file) |
| ROL-01 | Collaborator's direct Convex mutation call rejected (2 mutations) | unit (convex-test) | `pnpm vitest run __tests__/activate.test.ts __tests__/charitiesDoNotUse.test.ts` | ✅ existing files, ❌ new negative cases needed |
| ROL-02 | Exactly six actions gated, no more/fewer | unit (source-scan or explicit route/mutation inventory test) | manual grep-based check documented in VERIFICATION.md, OR a source-scan test asserting `_require_editor`/`requireEditor` appear exactly at the 6 known call sites | ❌ Wave 0 (optional — recommend a lightweight source-scan test mirroring `dispatch-control-no-sanity-write.test.ts`'s pattern) |
| ROL-03 | Locked control renders with visible explanation, not hidden | unit (component test, vitest + Testing Library if available) | `pnpm vitest run __tests__/LockedControl.test.tsx` | ❌ Wave 0 (new file) |
| ROL-04 | Collaborator can call `comments.add`, read via `listByIssueNumber` | unit (convex-test) | `pnpm vitest run __tests__/comments.test.ts` | ❌ Wave 0 (new file) |

### Sampling Rate
- **Per task commit:** the quick-run commands above (route-scoped / file-scoped subsets).
- **Per wave merge:** full suite on both sides (`uv run pytest -x -q` and `pnpm test`).
- **Phase gate:** both full suites green, plus the enumerated Pitfall 3 test-file updates confirmed present (not just "not failing" — confirm the NEW negative Collaborator-rejection assertions actually exist in each of the 4 enumerated Convex test files, since a regression-free suite alone would not prove SC-1 was tested, only that nothing broke).

### Wave 0 Gaps
- [ ] `packages/pipeline/tests/api/test_role_gate.py` (or equivalent) — covers ROL-01/ROL-02 on the FastAPI side, all 4 routes, positive+negative+sentinel-regression
- [ ] Update `apps/dispatch-control/__tests__/activate.test.ts`, `convexAuthLockdown.test.ts`, `charitiesDoNotUse.test.ts`, and (verify) `promptVersionsEvalGate.test.ts` — add `role: 'Editor-in-chief'` to existing `withIdentity` calls exercising the 2 gated mutations, plus new Collaborator-rejection cases
- [ ] `apps/dispatch-control/__tests__/comments.test.ts` (new) — covers ROL-04
- [ ] `apps/dispatch-control/__tests__/LockedControl.test.tsx` (new) — covers ROL-03
- [ ] Empirical Clerk/Convex claim-propagation spot-check (Pitfall 1) — not a permanent automated test, but a one-time manual verification step that should be documented as done in VERIFICATION.md before the rest of the phase relies on `identity.role` being present

## Environment Availability

No new external dependencies. Clerk and Convex are already-provisioned, already-configured services (Clerk Dashboard access and Convex deployment access are required to make the two manual configuration edits in Pattern 1 — these are **manual, non-automatable dashboard steps**, same category as the pre-existing `convex/auth.config.ts` setup comment already documents for the JWT-template creation itself). No fallback needed if Clerk Dashboard access is available (it must be, since the console is already Clerk-authenticated in production); if Clerk Dashboard access is NOT available to whoever executes this phase, the phase is blocked on that single manual step — flag this explicitly as a human-dependency checkpoint in the plan, not a code task.

## Sources

### Primary (HIGH confidence)
- Live repo source (read directly, this session): `packages/pipeline/src/eisenbalm_pipeline/api/{auth,control,revision,factcheck,signoffs,review}.py`, `convex/{lib/auth.ts,promptVersions.ts,charities.ts,schema.ts,users.ts,auth.config.ts}`, `apps/dispatch-control/{middleware.ts,app/layout.tsx,app/(dashboard)/issues/[issueNumber]/layout.tsx,__tests__/*}`, `docs/API_CONTRACTS.md` (§39, §40, §43.4), `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §6
- [Convex & Clerk | Convex Developer Hub](https://docs.convex.dev/auth/clerk) — current `auth.config.ts` setup steps, confirms `applicationID: "convex"` + named JWT template still the documented pattern
- [Interface: UserIdentity | Convex Developer Hub](https://docs.convex.dev/api/interfaces/server.UserIdentity) — reserved vs. custom claim fields
- [JWT templates - Session management | Clerk Docs](https://clerk.com/docs/guides/sessions/jwt-templates) — shortcode syntax (`{{user.public_metadata.role}}`), named-template vs. session-token distinction
- [Customize your session token - Session management | Clerk Docs](https://clerk.com/docs/guides/sessions/customize-session-tokens) — default session token claim customization, 1.2KB size caveat (add individual fields, not the whole `public_metadata` object)
- [get-convex/convex-js Issue #145](https://github.com/get-convex/convex-js/issues/145) — the v1.34.0 `ConvexProviderWithClerk` behavior change (raw session token vs. named template) — directly load-bearing given this repo's `convex@^1.38.0` pin
- Convex application-errors docs (`ConvexError` import/throw/catch shape) — fetched and quoted in Pattern 1

### Secondary (MEDIUM confidence)
- General Convex/Clerk custom-claims WebSearch summaries corroborating the above (multiple independent search result sets agreeing on the same claim-exposure mechanics)

### Tertiary (LOW confidence)
- None relied upon as authoritative — every claim above traces to either live repo source or an official docs/GitHub source.

## Metadata

**Confidence breakdown:**
- Standard stack / architecture (FastAPI + Convex dependency swaps): HIGH — verified against live source, existing test patterns, and current official docs.
- Clerk→JWT claim propagation to Convex: MEDIUM — the mechanism is HIGH confidence (official docs), but the version-specific convex-js 1.34+ behavior change (Pitfall 1) means the *actual* runtime behavior in this exact deployment should be spot-verified empirically once before the rest of the phase depends on it (flagged as a Wave 0 gap, not skipped).
- Comment data model: MEDIUM — no prior art in this repo (net-new), modeled directly on the closest analogous existing pattern (`charity_corrections`, §39) rather than invented from scratch; the exact UI mount widget is intentionally left open (Open Question 3).
- Pitfalls/testing approach: HIGH — every enumerated test file was grepped and read, not assumed; the Pitfall 3 file list is exhaustive as of this research date, not illustrative.

**Research date:** 2026-07-16
**Valid until:** 30 days for the internal architecture findings (stable, repo-controlled); re-verify the convex-js version-behavior finding (Pitfall 1) sooner if `apps/dispatch-control/package.json`'s `convex` pin changes before this phase is implemented.
