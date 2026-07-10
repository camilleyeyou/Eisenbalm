# Phase 39: Registry Coverage-Memory Strip - Research

**Researched:** 2026-07-09
**Domain:** Convex schema/mutations + FastAPI read endpoint + Sanity GROQ join + dispatch-control (Next.js/React) UI + pipeline agent (Researcher) context injection
**Confidence:** HIGH (all seams verified against actual code; the one open question — D-03 signal source — is resolved with a concrete, code-grounded recommendation, not a guess)

## Summary

Phase 39 is small in surface area but spans three systems: Convex (new `charity_corrections` table + queries/mutations, plus a new `listRecentFeatured` query), the FastAPI pipeline (a new read endpoint joining Convex→Sanity for the coverage strip, plus a corrections-read-and-inject step in `researcher.py`), and dispatch-control (a new strip component on the Registry page + a per-charity corrections UI extending `RegistryTable`). Every mutation/read pattern needed already has a direct precedent in the codebase (Phase 26 registry, Phase 28 prompt versions, Phase 31/33 content-patch/findings). Nothing here requires inventing a new architecture — it requires correctly locating and reusing four existing patterns.

The one genuine research question — D-03's "signal" source — resolves cleanly: the Sanity `charity.scoutNotes` field (populated from the Scout's `scoutSummary` at candidate-write time, `packages/pipeline/.../lib/sanity_client.py:62`) is real, already-persisted, stable once a charity is featured (Scout's dedup registry prevents re-pitching, so `write_charity`'s `createOrReplace` never overwrites it post-feature), and requires zero new writes or cross-run joins. It is the cheapest honest signal source available. Cause (`focusArea`) and geo (`location`) already live on the same Sanity document, so the entire coverage-strip payload for one charity is a single Sanity doc read — no deliberationEvents/agentVotes/pitchLog cross-run reconstruction needed.

**Primary recommendation:** Ship all three coverage-strip chips (cause=`focusArea`, geo=`location`, signal=truncated `scoutNotes`) sourced from one Sanity charity-doc read per featured charity, joined server-side in a new FastAPI GET endpoint (dispatch-control has zero Sanity SDK access — enforced by an existing source-scan tripwire test, so this join CANNOT happen client-side). Build `charity_corrections` as a new append-only Convex table with a `requireOperator`-guarded `append` mutation (matching the Phase 26 `charities.setStatus` / Phase 28 `promptVersions.saveVersion` dashboard-mutation convention, NOT a pipeline endpoint) and an unguarded `listByCharityKey` query (matching `charities.listForDedup`'s "queries are unguarded" convention). The Researcher reads corrections by computing the dedupKey via the ALREADY-EXISTING `eisenbalm_pipeline.lib.charity_registry.make_dedup_key()` helper (do not reimplement) and injects them into its prompt before the `acomplete` call, logging a line the MEM-03 test asserts on.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: A strip on the Registry page (top of `registry/page.tsx`), visualizing the last 8 featured issues' cause/geo/signal chips. Distinct from the Run Monitor drift strip.
- **D-02**: Last-8 source = the 8 most recently featured charities (`charities` table, `status === 'featured'`, ordered by `lastFeaturedAt` desc), joined to their Sanity charity's `focusArea` (→ cause) and `location` (→ geo). One column per issue, chips stacked.
- **D-03**: The "signal" chip source is a research question — resolved below (see Summary + §"D-03 Signal Source" under Architecture Patterns).
- **D-04**: Repetition is visible, not computed-into-a-score. No algorithmic diversity score this phase.
- **D-05**: New append-only Convex table `charity_corrections` — `{workspace_id, charityKey (registry dedupKey; also store sanityCharityId when known), text, author, createdAt}`. Append-only: never updated or deleted. Contract-first: amend `docs/API_CONTRACTS.md` + add the table before code.
- **D-06**: Write path = a guarded, audit-logged append. A `requireOperator`-guarded mutation (or a pipeline endpoint if that matches the existing registry mutation pattern — **research confirms: Convex `requireOperator` mutation is the correct match**), writing an audit row.
- **D-07**: Surfaced per-charity in the Registry. Each charity row gains an "Add correction" affordance + a chronological list of its corrections (row expansion or detail panel — Claude's discretion). Reuses `RegistryTable.tsx`, not a new page.
- **D-08**: The Researcher agent reads corrections for the winning charity (Phase 2, per-charity), NOT the Scout. Queries `charity_corrections` by the winning charity's `dedupKey` (fallback `sanityCharityId`/name) and injects the corrections text into its prompt context.
- **D-09**: Match by dedupKey — the registry's canonical case-folded key (`{name.trim().toLowerCase()}|{domain}`, Phase 26 §26.1), falling back to `sanityCharityId` then name.
- **D-10**: Verifiable in pipeline output/logs. The Researcher logs that it read the corrections (count + injected) so a repeat-charity run demonstrably shows the re-read in pipeline logs/output. A test asserts corrections reach the Researcher's context on a charity that has them.

### Claude's Discretion
- Exact coverage-strip visual (chip layout, color coding within the 1c system); whether the last-8 join happens client-side or via a read endpoint — **research resolves this: MUST be a read endpoint, see Pitfalls**.
- The `signal` source decision (D-03) — **resolved below**; the exact `charity_corrections` field set + indexes — **proposed below**; whether the write is a Convex mutation or pipeline endpoint — **resolved below: Convex mutation**.
- The Registry correction UI (row expansion vs panel); the Researcher's corrections-injection prompt wording + where in the research flow it reads them — **located below: top of `researcher()`, before `_build_messages`**.
- Whether corrections are also surfaced anywhere the winning charity appears beyond the Registry (not required).

### Deferred Ideas (OUT OF SCOPE)
- Signal chip if no clean source exists (D-03 option c) — not needed; option (a)/(b) hybrid resolves cleanly (see below).
- Algorithmic coverage/diversity score (D-04 keeps it visual).
- Auto-acting on corrections (Researcher reads + incorporates normally; does not rewrite based on them beyond that).
- Corrections surfaced beyond the Registry (e.g. issue page) — not required this phase.
- REG-01/REG-02 (charity registry + Scout dedup) — already shipped Phase 26; do not touch. No new agent. Explicitly out of scope.

## Project Constraints (from CLAUDE.md)

- **Contract-first HARD rule**: `docs/API_CONTRACTS.md` must be amended BEFORE code for the `charity_corrections` table, its mutation/query signatures, the new `charities:listRecentFeatured` query, and the new coverage-strip read endpoint. This is a project-wide (not just GSD-workflow) rule — do not skip it even for a "small" additive table.
- **Schema field names**: do not rename any existing field in `convex/schema.ts` or `schemas/*.ts` without checking `API_CONTRACTS.md` first. This phase is purely additive (new table, new optional Convex query) — no existing field renames anywhere in scope.
- **GSD workflow enforcement**: file-changing work must go through a GSD command (`/gsd:execute-phase` etc.) — not directly relevant to research, but flagged for the eventual planner/executor.
- **Convex-specific**: `convex/CLAUDE.md` instructs reading `convex/_generated/ai/guidelines.md` before writing Convex code — the planner/executor should do this before implementing the new table/mutations.

## Standard Stack

No new libraries. This phase is 100% additive on the existing stack:

| Layer | Existing tool | Role in this phase |
|-------|---------------|---------------------|
| Convex | `convex/server`, `convex/values` | New `charity_corrections` table, `append`/`listByCharityKey` in a new `convex/charityCorrections.ts`; new `listRecentFeatured` query added to existing `convex/charities.ts` |
| Convex auth | `convex/lib/auth.ts` (`requireOperator`) | Guards the corrections `append` mutation (dashboard-only) |
| Convex audit | `convex/auditLog.ts` (`internal.auditLog.write`) | "Nothing silent" row on every correction append |
| Pipeline HTTP | `httpx.AsyncClient` via `lib/convex_client.py` (`convex_query_safe`) | Researcher's fail-open corrections read |
| Pipeline HTTP | `lib/sanity_client.py` (`groq_query`) | New coverage-strip endpoint's Sanity join |
| Pipeline dedup | `lib/charity_registry.py` (`make_dedup_key`) | Reused verbatim by the Researcher — do not reimplement |
| Dashboard | `convex/react` (`useQuery`/`useMutation`), Next.js App Router | Corrections UI on `RegistryTable`; strip data comes from a plain `fetch` to the new pipeline endpoint (not `useQuery` — see Pitfalls) |
| Dashboard auth | Clerk (existing `_require_clerk_jwt_control`-equivalent guard pattern already used by every other dashboard-facing FastAPI endpoint) | Guards the new coverage-strip read endpoint |

No `npm install` / `uv add` needed.

## Architecture Patterns

### D-03 Signal Source — resolved

**Investigated candidates:**

1. **Store a signal at feature time** (option a) — Publisher's `_run_publisher` (`packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py:430-443`) calls `charities:upsertFeatured` using data from the fetched Sanity `issue` dict, NOT from `state["winning_charity"]` directly at that call site. `state["winning_charity"]` (a `CharityCandidate` TypedDict, `graph/state.py:57-70`) DOES carry `focusArea`, `scoutSummary`, `whyOverlooked`, `advocateArgument`, `advocateScore` all the way through the graph — but by publish time, the Publisher is working from the Sanity draft, not raw state, so wiring a NEW signal field through this specific call site would require either (a) also passing `state` into the Publisher's Convex-write step, or (b) a new Sanity field carrying `whyOverlooked` (currently NOT persisted — `write_charity` only maps `scoutSummary` → `scoutNotes`, not `whyOverlooked`).
2. **Derive from pitchLog / agentVotes primaryConcern for that charity's run** (option b) — investigated and REJECTED as impractical: `pitchLog` and `agentVotes` are indexed only `by_runId` / `by_runId_and_charity` (`convex/schema.ts:52-66,110-123`); the `charities` table does NOT store the runId in which a charity was FEATURED (only `firstSeenRunId`, the run it was first CANDIDATE in — Phase 26 §26.1). Reconstructing "the run this charity won" would require a Sanity `weeklyIssue` lookup by charity reference to get `pipelineMetadata.runId`, THEN a global (unindexed) scan of `agentVotes`/`pitchLog` filtered by `charityId` across all runs. This is a fragile multi-hop join with no supporting index — exactly the kind of "invented complexity" D-03 warns against.
3. **Sanity `charity.scoutNotes`** (a variant of option b, but ALREADY PERSISTED, no cross-run join) — `write_charity` (`lib/sanity_client.py:41-73`) maps `charity["scoutSummary"]` (the `CharityCandidate.scoutSummary` field, "why Scout surfaced this one") into the Sanity `charity.scoutNotes` field (`apps/studio/schemas/charity.ts:68-74`, described as "Scout agent's assessment of why this charity is overlooked and worth featuring"). This write happens exactly ONCE per charity name+slug (`write_charity` uses `createOrReplace` with deterministic `_id = charity-{slugify(name)}`, called only from `scout.py:357`, never again once the charity is featured — because Scout's registry dedup, `_load_registry_keys`/`charities:listForDedup`, prevents a featured charity from ever being re-pitched as a candidate again). This field is REAL data (not fabricated), already sitting on the same Sanity document as `focusArea` and `location`, requires ZERO new writes, and ZERO new indexes/queries.

**Recommendation: use Sanity `charity.scoutNotes` as the signal chip**, truncated for chip display (it's a free-text sentence/short-paragraph field, not a pre-sized tag — truncate client-/server-side the same way `RegistryTable.tsx`'s existing `truncateUrl()` helper truncates URLs, with the full text as a hover title). This means the ENTIRE coverage-strip payload for one charity — cause, geo, AND signal — comes from ONE Sanity charity document, joined once by `sanityCharityId`. No pitchLog/agentVotes/deliberationEvents read is needed at all.

Note for the planner: the original design brief's "signal" concept (`docs/design/dispatch-control-v2/README.md` §Signal Desk: "signal, dated peg + source link, angle, category chip") was tied to the deferred **Signal Editor agent** (V3-DEF-02, explicitly out of scope for v3.0). `scoutNotes` is the closest real analog ("why this charity, why now") that exists today — it is honest but imperfect (a full sentence, not a punchy tag). If Andrew finds truncated `scoutNotes` chips unsatisfying after a few weeks, a natural v3.1 follow-up is threading `state["winning_charity"]["whyOverlooked"]` through the Publisher's Convex/Sanity write as a dedicated short field — but that is a NEW write path this phase should not build (D-03 explicitly says prefer an existing source).

### charity_corrections — proposed schema (contract-first, amend `convex/schema.ts` + `docs/API_CONTRACTS.md` §39 before code)

```typescript
// convex/schema.ts — new table, mirrors claim_checks (§26.2) style
charity_corrections: defineTable({
  workspace_id: v.string(),
  charityKey: v.string(),                  // registry dedupKey (§26.1 format) — PRIMARY match key
  sanityCharityId: v.optional(v.string()),  // denormalized display/fallback convenience
  text: v.string(),                         // the correction itself
  author: v.string(),                       // Clerk actorId from requireOperator(ctx) — NEVER a client-supplied field
  createdAt: v.number(),
})
  .index('by_workspace_charityKey', ['workspace_id', 'charityKey'])  // Registry UI + Researcher read
  .index('by_workspace', ['workspace_id'])                            // general listing if ever needed
```

`charityKey` = the SAME dedupKey format as `charities.dedupKey` (`{name.trim().toLowerCase()}|{domain}`, Phase 26 §26.1) — not a new key scheme. Because `RegistryTable.tsx` already loads full `charities` docs via `charities:listByWorkspace` (which includes `dedupKey` and `sanityCharityId` per §26.1), the correction-append UI can pass `charity.dedupKey` directly — no client-side dedupKey computation needed in the dashboard.

### charity_corrections — proposed Convex functions (new file `convex/charityCorrections.ts`)

```typescript
// Mutation — dashboard-only (matches Phase 26 charities.setStatus / Phase 28
// promptVersions.saveVersion convention — requireOperator, NOT a pipeline endpoint):
append({ workspace_id, charityKey, sanityCharityId?, text }): Promise<Id<'charity_corrections'>>
  // const actor = await requireOperator(ctx)
  // const id = await ctx.db.insert('charity_corrections', {workspace_id, charityKey, sanityCharityId, text, author: actor, createdAt: Date.now()})
  // await ctx.runMutation(internal.auditLog.write, {
  //   workspace_id, actorId: actor, action: 'charity_correction.added',
  //   resourceType: 'charity_correction', resourceId: charityKey,
  //   after: JSON.stringify({ text }),
  // })
  // return id

// Query — unguarded (matches charities.listForDedup: "queries are unguarded — read-only" per convex_client.py):
listByCharityKey({ workspace_id, charityKey }): Promise<Doc<'charity_corrections'>[]>
  // by_workspace_charityKey index, sorted createdAt ASC (chronological append-only log — oldest correction first)
```

Follow `promptVersions.saveVersion` (`convex/promptVersions.ts:194-239`) EXACTLY for the audit-log call shape — it is the live precedent for "requireOperator + insert + `ctx.runMutation(internal.auditLog.write, ...)`" on a brand-new append-only record type. Do NOT follow `charities.setStatus`'s precedent for the audit call: `setStatus` (`convex/charities.ts:167-189`) currently does NOT call `auditLog.write` at all, despite `reviewActions.ts`'s comment documenting `"charity_status_changed"`/`"charity_blocklisted"` as canonical audit actions — this looks like an existing Phase 26 gap (confirmed via grep: those two action strings are documented but never emitted anywhere in the codebase). This is out of scope to fix, but the planner should NOT copy `setStatus`'s missing-audit pattern for the NEW corrections mutation — D-06 explicitly requires the audit row.

### Last-8 coverage strip — data flow (new Convex query + new FastAPI read endpoint)

**New Convex query** (add to existing `convex/charities.ts`, uses the ALREADY-EXISTING `by_workspace_status` index):

```typescript
listRecentFeatured({ workspace_id, limit? }): Promise<Doc<'charities'>[]>
  // Uses by_workspace_status index (status: 'featured'); sort by lastFeaturedAt desc; take(limit ?? 8)
```

**New FastAPI GET endpoint** — location: extend `packages/pipeline/src/eisenbalm_pipeline/api/content.py` (already has the `GET /issues/{run_id}/draft` read-only precedent at line 799 AND already imports both `groq_query`/Sanity helpers and `_require_clerk_jwt_control`) OR a new `registry.py` router registered in `main.py` alongside the other 10 routers — planner's discretion, but MUST be a server-side join, not client-side (see Pitfalls). Shape:

```
GET /registry/coverage-strip
Auth: Depends(_require_clerk_jwt_control)   # same guard as get_content_draft
Action:
  1. rows = await convex_query(http, "charities:listRecentFeatured", {"workspace_id": WORKSPACE_ID, "limit": 8})
  2. ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]
  3. sanity_rows = await groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}', params={"ids": ids})
  4. zip sanity_rows back onto `rows` by _id == sanityCharityId, preserving lastFeaturedAt-desc order;
     rows missing sanityCharityId (legacy/backfilled charities without one) render with empty chips, never crash
Response: [{name, sanityCharityId, lastFeaturedAt, cause: focusArea, geo: location, signal: scoutNotes}, ...]  (8 or fewer)
```

The dashboard's `CoverageStrip` component calls this endpoint with a plain authenticated `fetch` (mirroring `contentPatchClient.ts`/`findingsClient.ts`'s `pipelineBaseUrl()` + Bearer-token pattern), NOT `useQuery` — this data changes at most once a week (on publish), so Convex's live-reactivity is not needed here, and routing it through a query would still require a second hop to Sanity that `useQuery` cannot do anyway.

### Researcher corrections read + injection (D-08/D-09/D-10)

Exact location: `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`, inside `researcher()`, immediately after line 129-134 (`charity = state.get("winning_charity") or {}` / the missing-charity guard) and BEFORE `_build_queries(charity)` / `_build_messages(...)`:

```python
from eisenbalm_pipeline.lib.charity_registry import make_dedup_key  # REUSE — do not reimplement _domain_of locally
from eisenbalm_pipeline.lib.convex_client import convex_query_safe

# ...inside researcher(), after the winning_charity guard:
dedup_key = make_dedup_key(charity.get("name", ""), charity.get("website"))
corrections = await convex_query_safe(
    "charityCorrections:listByCharityKey",
    {"workspace_id": "eisenbalm", "charityKey": dedup_key},
) or []
log.info(
    "Researcher: read %d correction(s) for charity=%r (dedupKey=%r) — %s",
    len(corrections), charity.get("name"), dedup_key,
    "injected into research context" if corrections else "none found",
)
```

Then pass `corrections` into `_build_messages(...)` (extend its signature) so the text is interpolated into the system or user prompt — mirroring how `_build_messages` already interpolates `{VOICE_CONSTRAINTS}`/`{charity}`/`{results_block}` via `.replace(...)` on the loaded template (researcher.py:90-124). A new `{corrections}` placeholder in `researcher_user.md` (or the system prompt, planner's call) is the simplest wiring, consistent with the existing template-variable convention (Phase 24 PRM-02 "variable pills" validate against exactly what's injected — a new placeholder must be added to whichever prompt file consumes it so Prompt Lab's variable validator doesn't flag it as unknown).

**Why `make_dedup_key` and not a fresh reimplementation:** `eisenbalm_pipeline/lib/charity_registry.py:33-49` already provides `make_dedup_key(name, website) -> str`, producing the EXACT `"{name.strip().lower()}|{domain}"` format that `convex/charities.ts`'s `bareDomain`+dedupKey construction and `scout.py`'s own inline `_candidate_keys()` both independently compute. Reusing this shared helper (rather than re-deriving domain-stripping logic a third time in `researcher.py`) is the only way to GUARANTEE the Researcher's computed key matches the registry's stored `dedupKey` byte-for-byte — any independent reimplementation risks silent drift (e.g. different `www.` stripping, different case-folding order) that would make corrections invisibly fail to match (a correction is written, but the Researcher's key never finds it — MEM-03 would silently fail).

**Fallback chain (D-09):** if `dedup_key` (name+website derived) finds nothing, the winning charity's `state["winning_charity_sanity_id"]` (set earlier in Phase 1 selection, `graph/state.py:173`) is available as a second lookup — but since `charity_corrections.charityKey` is always a dedupKey (not a sanityCharityId), a sanityCharityId-based fallback requires either (a) also indexing/looking up by `sanityCharityId` on `charity_corrections`, or (b) resolving sanityCharityId → dedupKey via `charities:getByDedupKey`'s sibling lookup. Given the Registry UI writes `charityKey` directly from an already-loaded `charities` doc's `dedupKey` (which is ALWAYS present — Phase 26 sets it on every insert), the fallback path is a defensive/legacy-only concern, not a common case. Simplest correct approach: `charity_corrections` rows are always keyed by dedupKey; if a future correction needs to be entered for a charity whose registry row somehow lacks a `dedupKey` (should not happen post-Phase-26), that is an existing-registry-data-quality issue outside this phase's scope.

**MEM-03 verification test:** a pipeline unit test (mirroring `test_researcher.py`'s existing `AsyncMock`-patching style) that: (1) monkeypatches `convex_query_safe` to return 2 correction rows for a given dedupKey, (2) sets `state["winning_charity"]` to a charity whose computed dedupKey matches, (3) asserts the corrections text appears in the `messages` list passed to the mocked `acomplete` call, and (4) asserts (via `caplog`) that the `log.info(...)` line fires with the correct count. This is the "verifiable in pipeline output/logs for a repeat-charity run" acceptance criterion made concrete — it does not require an actual second real pipeline run, just a state/mock construction that represents "this charity has been corrected before."

### Recommended dispatch-control component structure

```
apps/dispatch-control/app/(dashboard)/registry/
├── page.tsx                          # mount <CoverageStrip /> above <RegistryTable />
└── _components/
    ├── CoverageStrip.tsx              # NEW — fetches GET /registry/coverage-strip, renders 8 columns of stacked chips
    ├── RegistryTable.tsx              # extended — per-row "Add correction" + corrections list (row expansion, matching the existing inline-confirm-popover pattern already used for Blocklist)
    ├── CorrectionsList.tsx            # NEW — chronological list for one charity, read via useQuery(api.charityCorrections.listByCharityKey, {workspace_id, charityKey: charity.dedupKey})
    ├── AddCorrectionDialog.tsx        # NEW — mirrors AddCharityDialog.tsx's dialog+form structure; calls useMutation(api.charityCorrections.append)
    ├── AddCharityDialog.tsx           # existing, unchanged
    └── CharityStatusBadge.tsx         # existing, unchanged
```

`CorrectionsList`/`AddCorrectionDialog` CAN use `useQuery`/`useMutation` directly (Convex, not Sanity — no EDT-05 conflict), unlike `CoverageStrip` which must go through the pipeline endpoint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dedup key computation in the Researcher | A new `_domain_of`/case-fold implementation in `researcher.py` | `eisenbalm_pipeline.lib.charity_registry.make_dedup_key()` | Already exists, already the canonical shared implementation; a second implementation risks silent key-format drift that would break MEM-03 invisibly |
| Cause/geo/signal join for the coverage strip | A client-side dispatch-control Sanity fetch (raw GROQ HTTP or SDK) | A new FastAPI GET endpoint (`groq_query` + `convex_query`) | `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` source-scans for `@sanity/client`, `from 'sanity'`, `createClient(`, and `.api.sanity.io` across `app/`, `components/`, `lib/` — any direct Sanity touch (even read-only) in dispatch-control will either fail this tripwire (if it matches the regex) or violate the established "dashboard has zero Sanity path" architecture the whole v3.0 milestone is built on (EDT-05) |
| Audit logging for the new mutation | A bespoke audit insert | `ctx.runMutation(internal.auditLog.write, {...})` exactly as `promptVersions.saveVersion` does | Existing, tested pattern; do not follow `charities.setStatus`'s (apparently gapped) no-audit precedent |
| "Signal" taxonomy | A brand-new category/tag system for "why this charity" | Sanity `charity.scoutNotes` (already populated from `scoutSummary`) | Real, already-written, zero new writes — inventing a taxonomy here is exactly what D-03 forbids |

**Key insight:** every piece of this phase is a *join* or a *guarded append*, not new business logic — the risk is entirely in getting the EXISTING keys/patterns right (dedupKey format, requireOperator vs pipeline-secret, unguarded queries, the Sanity write boundary), not in designing anything novel.

## Common Pitfalls

### Pitfall 1: Building the coverage strip client-side and hitting the Sanity write-boundary wall
**What goes wrong:** A planner sees `charities.listByWorkspace` already returns `focusArea`... except it doesn't — that field lives only on the SANITY charity doc, never copied onto the Convex `charities` row. A naive plan might try to add a client-side Sanity fetch to dispatch-control "just for reads."
**Why it happens:** `DriftStrip.tsx` (Run Monitor's MON-04) is a fully client-side `useQuery`-only aggregation, and it's the freshest precedent in the same app — easy to assume the coverage strip can follow the same shape.
**How to avoid:** Route `focusArea`/`location`/`scoutNotes` through a new FastAPI GET endpoint. Confirmed via `dispatch-control-no-sanity-write.test.ts` (zero `@sanity/*` deps in `package.json`, zero forbidden import patterns in `app/`, `components/`, `lib/`) and the broader EDT-05 "dashboard → pipeline API → Sanity for every write" architecture (this extends to reads too, by construction — there is no Sanity client available in that app at all).
**Warning signs:** any `import ... from '@sanity/client'` or raw `fetch('https://*.api.sanity.io/...')` inside `apps/dispatch-control/{app,components,lib}` will fail the existing tripwire test immediately in CI/local test run.

### Pitfall 2: dedupKey drift between the Researcher and the registry
**What goes wrong:** Re-deriving the dedupKey format independently in `researcher.py` (e.g. forgetting to strip `www.`, or folding case in a different order) produces a key that never matches `charities.dedupKey` or `charity_corrections.charityKey` — corrections silently never reach the Researcher, and MEM-03 "verifiably" fails (nothing crashes, nothing errors, it just quietly returns zero corrections every time).
**Why it happens:** Three independent implementations of the same dedup-key logic already exist in the codebase (`scout.py:_domain_of`/`_candidate_keys`, `convex/charities.ts:bareDomain`, `lib/charity_registry.py:make_dedup_key`) — it would be easy to write a FOURTH instead of reusing the third.
**How to avoid:** Import and call `eisenbalm_pipeline.lib.charity_registry.make_dedup_key(name, website)` directly in `researcher.py`. Add a unit test asserting `make_dedup_key(charity["name"], charity["website"]) == <the same charity's charities.dedupKey row>` for at least one fixture.
**Warning signs:** a correction written via the Registry UI for a charity that visibly appears in a later run's Researcher log as "0 corrections found."

### Pitfall 3: Treating `charity_corrections` as editable
**What goes wrong:** Adding an "edit" or "delete" action to the corrections UI because it's convenient for fixing typos.
**Why it happens:** Every other Registry/dashboard list in this codebase (charities, prompt versions, findings) has SOME mutability (status flips, version activation, accept/dismiss). Append-only is the exception, not the pattern default.
**How to avoid:** D-05 is explicit — "never updated or deleted (the log IS the durable record)." Only expose `append` in `convex/charityCorrections.ts`; do not add `update`/`remove`. If a correction is wrong, the fix is a NEW correction that supersedes it in the chronological log (the Researcher/human both read the full history, including superseded entries — that's the audit value).
**Warning signs:** a `patch`/`delete` mutation appearing in `convex/charityCorrections.ts` or a trash-can icon in `CorrectionsList.tsx`.

### Pitfall 4: `charities.setStatus`'s missing audit-log call as a false precedent
**What goes wrong:** Copying `setStatus`'s handler shape (no `auditLog.write` call) for the new `append` mutation, reading `reviewActions.ts`'s comment ("`audit_log` alone is sufficient for registry mutations (setStatus)") as evidence that registry mutations don't need explicit audit calls.
**Why it happens:** `setStatus` is the most recent, most-similar (`requireOperator`-guarded, registry-adjacent) mutation in the codebase — but it's ALSO an apparent existing gap (`"charity_status_changed"`/`"charity_blocklisted"` are documented canonical audit actions in `API_CONTRACTS.md` §26.5 but are never actually emitted anywhere in the current code).
**How to avoid:** Follow `promptVersions.saveVersion` instead — it DOES call `ctx.runMutation(internal.auditLog.write, {...})` after insert, and D-06 explicitly requires "writing an audit row ('nothing silent')" for the corrections append. Do not fix `setStatus`'s gap (out of scope — REG-01/REG-02 are explicitly off-limits this phase), but do not replicate it either.
**Warning signs:** a correction appended via the dashboard produces no new `audit_log` row.

### Pitfall 5: Forgetting `charityKey` must be pre-computed by the caller, not derived server-side from a name string alone
**What goes wrong:** The `append` mutation accepting a raw `charityName` and computing `charityKey` itself (duplicating `bareDomain`+dedupKey logic a FOURTH time, in yet another file), instead of accepting the already-known `charityKey` from the loaded `charities` doc.
**Why it happens:** `charities.upsertCandidate`/`upsertFeatured` DO compute the dedupKey server-side from `name`+`website` args — a plausible-looking precedent.
**How to avoid:** Because `RegistryTable.tsx` already has the FULL `charities` doc (including `dedupKey`) loaded via `listByWorkspace`, the correction dialog has zero reason to re-derive anything — pass `charity.dedupKey` straight through as `charityKey`. This also sidesteps a THIRD reimplementation of the bareDomain logic in Convex.
**Warning signs:** `bareDomain`/domain-stripping logic appearing a fourth time inside `convex/charityCorrections.ts`.

### Pitfall 6: Missing `sanityCharityId` for legacy/backfilled charities breaking the coverage strip
**What goes wrong:** Some featured charities (especially ones from `charities:seedFromPublished`'s one-time backfill, or any inserted before `sanityCharityId` was consistently set) may have `sanityCharityId` undefined. A join that assumes every featured row has one will throw or silently drop a column of the strip.
**Why it happens:** `sanityCharityId` is `v.optional(v.string())` on the `charities` table (§26.1) — it is NOT guaranteed present on every row, only on rows created/patched via `upsertFeatured` with that arg supplied.
**How to avoid:** The coverage-strip endpoint must skip Sanity lookup gracefully for rows lacking `sanityCharityId` and render an empty/dash chip set for that column rather than erroring the whole request.
**Warning signs:** the coverage strip 500s or silently renders fewer than 8 columns with no explanation when one of the last 8 featured charities is a legacy row.

### Pitfall 7: Parallel-worktree execution
**What goes wrong:** Running this phase's plans in a separate git worktree (as some earlier phases in this milestone did before the practice was reversed).
**Why it happens:** Historical habit from before Phase 36-38's "no worktrees" correction (documented in CONTEXT.md `code_context` → "Sequential-in-main-checkout execution (Phases 36-38) — no worktrees; avoids the Phase 35 strand problem").
**How to avoid:** Execute Phase 39's plans sequentially in the main checkout, matching Phases 36-38's established practice. `.planning/config.json`'s `git.branching_strategy: "none"` confirms no phase-branch scaffolding is expected either.

## Runtime State Inventory

Not applicable — this phase is purely additive (new table, new query, new mutation, new endpoint, new UI, one new read-and-inject step in an existing agent). No rename, refactor, or migration of existing stored data, live service config, OS-registered state, secrets, or build artifacts is involved.

## Code Examples

### Existing `requireOperator` + audit precedent to copy exactly (`convex/promptVersions.ts:194-239`)
```typescript
export const saveVersion = mutation({
  args: { workspace_id: v.string(), agentKey: v.string(), content: v.string(), createdBy: v.optional(v.string()), note: v.optional(v.string()) },
  handler: async (ctx, { workspace_id, agentKey, content, createdBy, note }) => {
    const actor = await requireOperator(ctx)
    // ...insert...
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id, actorId: actor, action: 'prompt_version.saved',
      resourceType: 'prompt_version', resourceId: `${agentKey}:${nextVersion}`,
      after: JSON.stringify({ agentKey, version: nextVersion }),
    })
    return id
  },
})
```

### Existing fail-open Convex read precedent to mirror for the Researcher (`packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:110-150`)
```python
async def _load_registry_keys(http) -> list[str]:
    try:
        rows = await convex_query(http, "charities:listForDedup", {"workspace_id": WORKSPACE_ID})
        # ...
        return sorted(keys)
    except Exception as exc:
        log.warning("Scout registry dedup: Convex failed (%r) — empty fallback", exc)
        return []
```
For the Researcher, use the already-centralized `convex_query_safe(path, args)` (`lib/convex_client.py:208-232`) instead of hand-rolling a try/except — it already returns `None`/logs a warning on any failure.

### Existing read-only dashboard GET endpoint precedent (`packages/pipeline/src/eisenbalm_pipeline/api/content.py:799-810`)
```python
@router.get("/issues/{run_id}/draft")
async def get_content_draft(request: Request, run_id: str, claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
    """Read-only — no audit row."""
    _convex_http, sanity_http, sanity_id, _actor = await _resolve_sanity_id(request, run_id, claims)
    return await get_issue_draft(sanity_http, sanity_id)
```
The new `GET /registry/coverage-strip` endpoint should follow this exact shape (Clerk-guarded, read-only, no audit row — reads are not audited anywhere else in the codebase either).

### `make_dedup_key` — reuse verbatim (`packages/pipeline/src/eisenbalm_pipeline/lib/charity_registry.py:33-49`)
```python
def make_dedup_key(name: str, website: str | None) -> str:
    name_part = name.strip().lower()
    domain_part = _domain_of(website)
    return f"{name_part}|{domain_part}"
```

## State of the Art

Not applicable in the "library version drift" sense — this phase touches no external library, no framework upgrade, no API version change. The only "state of the art" consideration is internal-architecture currency: the write-boundary rule (dashboard → pipeline API → Sanity, EDT-05) was established in Phase 31 and reinforced through Phase 34; this phase is the first to need a Sanity-sourced READ from the Registry screen specifically, so it is the first place this research had to explicitly confirm the boundary applies to reads too (it does, by construction — there is no Sanity client in the app at all).

## Open Questions

None remaining — all six research questions posed in the phase brief are resolved above with code-grounded answers:
1. D-03 signal source → Sanity `charity.scoutNotes`.
2. Last-8 join authority → `charities` table (`status='featured'`, `lastFeaturedAt` desc) joined server-side via a new pipeline endpoint (not client-side, not Sanity `weeklyIssue`).
3. Registry mutation pattern → Convex `requireOperator` mutation (matches `charities.setStatus`), not a pipeline endpoint.
4. Researcher corrections read location → top of `researcher()`, using `make_dedup_key` + `convex_query_safe`, with a `log.info(...)` line for MEM-03 verifiability.
5. `charity_corrections` shape/indexes → proposed above (`by_workspace_charityKey` primary).
6. Pitfalls → catalogued above (7 total).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (pipeline) | pytest + pytest-asyncio (`asyncio_mode = "auto"`), config at `packages/pipeline/pyproject.toml` |
| Framework (dashboard) | Vitest, `apps/dispatch-control/package.json` → `"test": "vitest run"` |
| Config file | `packages/pipeline/pyproject.toml` (pytest) / dashboard's existing `vitest.config.*` |
| Quick run command (pipeline) | `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -x -q` |
| Quick run command (dashboard) | `pnpm --filter dispatch-control test -- CoverageStrip` (or the new test file name) |
| Full suite command (pipeline) | `cd packages/pipeline && uv run pytest -x -q` |
| Full suite command (dashboard) | `pnpm --filter dispatch-control test` then `pnpm --filter dispatch-control build` (strict — per memory note, `build` catches type errors `test` alone misses) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEM-01 | Coverage strip renders last-8 cause/geo/signal chips from the new endpoint | unit (component, mocked fetch) | `pnpm --filter dispatch-control test -- CoverageStrip` | ❌ Wave 0 (`__tests__/CoverageStrip.test.tsx`) |
| MEM-01 | New `charities:listRecentFeatured` returns ≤8 featured rows sorted by `lastFeaturedAt` desc | unit/integration (pipeline test mocking `convex_query`) | `cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -x -q` | ❌ Wave 0 |
| MEM-01 | Endpoint gracefully skips charities with no `sanityCharityId` (Pitfall 6) | unit (pipeline) | `cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -k missing_sanity_id -x -q` | ❌ Wave 0 |
| MEM-02 | `charity_corrections.append` requires operator identity, writes row + audit_log row | manual/integration (no direct Convex unit-test harness in this repo — verify via dashboard test mocking `useMutation` + a pipeline-side or manual Convex dashboard check) | `pnpm --filter dispatch-control test -- AddCorrectionDialog` | ❌ Wave 0 |
| MEM-02 | Corrections render chronologically per-charity in `RegistryTable` | unit (component) | `pnpm --filter dispatch-control test -- CorrectionsList` | ❌ Wave 0 |
| MEM-02 | No edit/delete path exists on `charity_corrections` (append-only enforcement, Pitfall 3) | negative source-scan test (mirrors `dispatch-control-no-sanity-write.test.ts` pattern) | `pnpm --filter dispatch-control test -- charity-corrections-append-only` | ❌ Wave 0 |
| MEM-03 | Researcher computes dedupKey via `make_dedup_key` and reads `charityCorrections:listByCharityKey` | unit (pipeline, `AsyncMock`-patched `convex_query_safe`) | `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -k corrections -x -q` | ❌ Wave 0 (extend existing `test_researcher.py`) |
| MEM-03 | Corrections text appears in the messages passed to `acomplete` | unit (pipeline) | same file as above | ❌ Wave 0 |
| MEM-03 | A log line records count + injection, verifiable via `caplog` | unit (pipeline, `caplog` fixture) | same file as above | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new/changed test file's quick command (pipeline or dashboard, whichever the task touched).
- **Per wave merge:** both full suites — `cd packages/pipeline && uv run pytest -x -q` AND `pnpm --filter dispatch-control test` + `pnpm --filter dispatch-control build`.
- **Phase gate:** full suite green (both languages) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/pipeline/tests/test_registry_coverage.py` — covers `charities:listRecentFeatured` shape + missing-`sanityCharityId` fallback + the new endpoint's Convex→Sanity zip logic (MEM-01)
- [ ] Extend `packages/pipeline/tests/agents/test_researcher.py` — covers the dedupKey computation, `convex_query_safe` call, prompt injection, and `caplog` log-line assertion (MEM-03)
- [ ] `apps/dispatch-control/__tests__/CoverageStrip.test.tsx` — covers 8-chip rendering + graceful fewer-than-8 + missing-chip fallback (MEM-01)
- [ ] `apps/dispatch-control/__tests__/AddCorrectionDialog.test.tsx` / `CorrectionsList.test.tsx` — covers the append form + chronological list rendering (MEM-02)
- [ ] A negative test asserting no `update`/`remove` export exists on `convex/charityCorrections.ts` (append-only enforcement, Pitfall 3) — new small test file, e.g. `apps/dispatch-control/__tests__/charity-corrections-append-only.test.ts`, or a Python/Node source-scan of `convex/charityCorrections.ts`'s exported function names
- [ ] No pytest framework install needed — `pytest`/`pytest-asyncio` already configured; no Vitest install needed either.

## Sources

### Primary (HIGH confidence — direct code reads)
- `convex/schema.ts` (lines 1-150, 340-439) — `charities`, `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`, `claim_checks` table shapes and indexes
- `convex/charities.ts` (full file, 330 lines) — `upsertCandidate`, `upsertFeatured`, `setStatus`, `listByWorkspace`, `listForDedup`, `getByDedupKey`, `seedFromPublished`
- `convex/lib/auth.ts` — `requireOperator`, `requirePipelineSecret`, `requireOperatorOrPipeline` guard implementations
- `convex/auditLog.ts` — `write`/`record`/`listForWorkspace`
- `convex/promptVersions.ts` (lines 190-239) — `saveVersion`'s requireOperator+audit pattern
- `convex/reviewActions.ts` (lines 1-60) — canonical audit action enum + the "audit_log alone sufficient for registry mutations" comment (and the fact those actions are never actually emitted, confirmed via repo-wide grep)
- `apps/studio/schemas/charity.ts` — Sanity charity fields: `focusArea`, `location`, `scoutNotes` (exact field names + descriptions)
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` (full file) — `_domain_of`, `_candidate_keys`, `_load_registry_keys`, `write_charity` call site, `charities:upsertCandidate` call site
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` (full file) — exact `winning_charity` access point, `_build_messages` structure, `acomplete` call site
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` (lines 390-454) — `charities:upsertFeatured` call site (confirms it fires from Sanity `issue` dict, not raw state)
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` (full DispatchState + CharityCandidate/ResearchOutput TypedDicts) — confirms `winning_charity` field carries `focusArea`/`scoutSummary`/`whyOverlooked`; confirms `winning_charity_sanity_id` is a separate top-level field
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` (lines 41-73, plus function index) — `write_charity`'s exact field mapping (`scoutSummary` → `scoutNotes`), `groq_query` helper existence
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` (full file) — `convex_query`, `convex_query_safe`, `convex_mutation`, `_PIPELINE_SECRET_GUARDED_PATHS` (confirms queries are unguarded)
- `packages/pipeline/src/eisenbalm_pipeline/lib/charity_registry.py` (full file) — `make_dedup_key`, `_domain_of`, `load_dedup_keys`
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` (relevant excerpts) — `GET /issues/{run_id}/draft` read-only endpoint precedent, `_require_clerk_jwt_control` import
- `apps/dispatch-control/app/(dashboard)/registry/page.tsx` and `_components/RegistryTable.tsx` (full files) — current mount point, current query/mutation usage, absence of any row-expansion pattern
- `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` (full file) — the EDT-05 tripwire proving dispatch-control has zero Sanity access
- `apps/dispatch-control/lib/findingsClient.ts` (excerpt) — the "this app NEVER imports the Sanity client SDK" doc comment + `pipelineBaseUrl()` fetch-client pattern
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx` (full file) — the OTHER strip (MON-04), confirming why D-01 needs to be visually/architecturally distinct, and why its fully-client-side pattern does NOT transfer to MEM-01 (no Sanity join needed there)
- `docs/API_CONTRACTS.md` (lines 1980-2260, plus §35-38 headers) — Phase 26 registry contract shape, the `## §NN — Title (Phase NN)` heading convention for the new §39 section
- `docs/design/dispatch-control-v2/README.md` (§Registry, §Signal Desk) — confirms "signal" was originally tied to the deferred Signal Editor agent (V3-DEF-02)
- `.planning/config.json` — `nyquist_validation: true`, `git.branching_strategy: "none"`

### Secondary (MEDIUM confidence)
- None needed — every claim above was verified directly against the file, not inferred from a description.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, every pattern reused has a direct, current, working precedent in this exact codebase.
- Architecture: HIGH — D-03's resolution is derived from tracing the actual data flow (Scout write → Sanity field → Publisher call site → state shape), not assumed; the Sanity write-boundary conclusion is proven by an existing passing test, not inferred from a policy doc alone.
- Pitfalls: HIGH — all 7 pitfalls are grounded in specific file:line evidence (an existing gap in `setStatus`'s audit call, the exact tripwire test, the exact TypedDict fields), not generic advice.

**Research date:** 2026-07-09
**Valid until:** 30 days (stable internal architecture; no external dependency risk) — but re-verify `charities.setStatus`'s audit-gap status if Phase 26 receives any patch in the interim, since that assumption is time-sensitive to independent changes in an out-of-scope file.
