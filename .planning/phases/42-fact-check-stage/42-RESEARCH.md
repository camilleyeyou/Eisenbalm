# Phase 42: Fact Check Stage - Research

**Researched:** 2026-07-15
**Domain:** Internal reuse/extension of an existing Convex + FastAPI + Next.js editorial console (no new external services/libraries)
**Confidence:** HIGH (every claim below is verified against the actual current source tree, not training-data assumptions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. `importance` field — the one pipeline change (FCT-01)**
- **D-01:** `importance` is a NEW optional field on the `claim_checks` Convex table (`importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental')))`), additive exactly like the Phase 35 provenance fields (legacy rows omit it). Extend `convex/claimChecks.ts::insertBatch` args and `convex/schema.ts`. Contract-first: amend `docs/API_CONTRACTS.md` (new §42) before code, per the Ph35/38/39 pattern.
- **D-02:** The Researcher emits `importance` per claim; it flows to `claim_checks` at publish-time claim merge. The Researcher tags each fact with an importance tier; the publisher binds that tier onto the writer-bound (sourced) `claim_checks` rows via the existing `claimId` linkage (§35.5 merge). Exact prompt/schema plumbing and the claimId→importance join is phase-researcher (this document's) territory — locked: importance is Researcher-emitted and lands on `claim_checks`, not how the LLM call is shaped.
- **D-03:** Deterministic-only (unsourced) claims and legacy rows get a defined `importance` fallback so summary math is total. Fallback = `Supporting` (never silently `Load-bearing`) unless a cheap heuristic promotes clearly load-bearing unsourced statistics. Legacy rows with no `importance` render as `Supporting` and are excluded from must-fix — but never render blank (D-08).

**B. Summary counters & severity — derived, not stored (FCT-02, FCT-05)**
- **D-04:** The affirmative summary is a PURE DERIVED SELECTOR over `claim_checks` rows, mirroring `lib/derivedState.ts`. Add `deriveFactCheckSummary(claimRows)` returning `{ factCoverage: "X of Y", mustFixCount, changedCount, uncheckedCount, conflictsCount, checksNotRunCount, lastVerifiedAt }`. No stored counters — counters/My Tasks/Approval/header all read derived selectors, so no explicit fan-out wiring is needed.
- **D-05:** Severity is derived per claim, not stored. `Must fix = importance === 'Load-bearing' && !sourceUrl`. Everything else = Review recommended / Information.
- **D-06:** `changedCount` is a block-level touched-counter, not re-verification. Counts `claim_checks` rows whose block was touched by an applied revision since their last check, via the D-14/D-20 "changed since check" marker. Increments even when the replacement text is itself sourced.
- **D-07:** `conflictsCount` and `checksNotRunCount` get pragmatic, honest derivations — never blank-as-verified. Recommended default: `checksNotRunCount` = rows that are `pending` AND have no `sourceUrl` AND were never through a check attempt; `conflictsCount` = rows carrying an explicit conflict marker (new optional `claim_checks.conflict` boolean set only by Replace-source / Ask-agent flows that detect a source disagreement) — `0` until such a flow sets it, surfaced as explicit "0 conflicting sources", never omitted. Exact predicates are Claude/phase-researcher discretion, bounded by: every claim renders one explicit state and blank never means verified.
- **D-08:** "Blank never means verified" is a hard rule. Every claim renders an explicit state chip (`✓ Checked` / `✕ Must fix` / `Unchecked` / `Review recommended` / `Changed`). The summary renders every counter even at zero.

**C. The reused provenance card component (FCT-04)**
- **D-09:** Build ONE shared provenance card component (e.g. `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx`) rendering `{ text, importance, status, sourceUrl, sourcePublisher, supportingPassage, retrievedAt, agent, confidence }`. Consumed by Stage 3 Fact Check, Stage 2 Draft (replacing/feeding `ClaimMark`/`AnnotationMark`), Stage 5 Approval (replacing/feeding `SourceIndex.tsx`), and the Phase 44 inspector. Do NOT fork three copies.
- **D-10:** Field sourcing — only `importance` is genuinely new; the rest derive. `text`/`status`/`sourceUrl`/`retrievedAt`/`sectionName` come straight from `claim_checks`; `sourcePublisher` = derived from `sourceUrl` host; `supportingPassage` = `context` (± `blockIndexHint` window); `agent` = derived from `sectionName → writer` map; `confidence` = sourced-claim metadata if recorded, else "—" (never blank-as-verified). Any field needing a new stored value beyond `importance` must be justified against the "only importance is new" contract stance during planning.
- **D-11:** The six actions live on the card, structured for Phase 49 role-gating. Render all action controls now for the editor; structure them so Phase 49 can wrap with locked-render. Do NOT hide controls.

**D. Claim table filters (FCT-03)**
- **D-12:** Filters are pure client-side derived predicates over the loaded claim list — no new Convex queries. Multi-select chips: `must fix` (D-05), `unchecked` (`status === 'pending'`), `changed` (D-14 marker), `numbers & dates` (`claimType ∈ {number, date}`), `people & titles` + `organization claims` (both `claimType === 'proper_noun'` today), `weak source`.
- **D-13:** `people & titles` vs `organization claims`, and `weak source`, use documented heuristics — refinement deferred to research. Today `claimType` is only `number|date|proper_noun`. Recommended default: split proper_noun via org-suffix detection (Trust/Foundation/Society/Inc/LLC/Institute → org; else person/title); `weak source` = unsourced OR a sourced claim whose source fails a quality heuristic (no resolvable publisher / low-authority TLD). Exact heuristics are phase-researcher discretion. Do not expand `claimType`'s stored vocabulary in this phase without a contract amendment.

**E. The six claim actions & their write boundaries (FCT-05)**
- **D-14:** Status-only actions are dashboard Convex mutations; content-touching actions go through the pipeline write boundary.
  - **Confirm** → `convex/claimChecks.ts::setStatus('checked')` (exists, operator-guarded). No content mutation.
  - **Keep as written (+required reason)** → a `checked`-equivalent terminal status + a decision-log entry. Reason is mandatory (empty reason rejected).
  - **Edit claim · Replace source · Remove claim** mutate the claim record and/or issue content, so they go dashboard → pipeline API → Convex/Sanity, logged to `audit_log` (EDT-05 write boundary). New endpoints (recommended home: a new `api/factcheck.py` router, or extend `api/content.py`), each guarded by `_require_clerk_jwt_control` and emitting a truncated before/after audit row via `_emit_audit`.
- **D-15:** "Edit claim" edits the claim record via the pipeline boundary, and if the edit changes the underlying prose it also content-patches Sanity. Replace source updates `sourceUrl` (+ code-stamped `retrievedAt`); Remove claim removes/tombstones the `claim_checks` row. Exact split is planning-time discretion, bounded by the write-boundary rule and contract-first amendment.
- **D-16:** No explicit cross-surface update wiring. Counters (D-04), My Tasks, Approval readiness, header status are all derived selectors over the same Convex data — a single mutation propagates to all four via Convex reactivity.

**F. "Ask agent for better evidence" — the shared revision endpoint (FCT-06)**
- **D-17:** Two-step endpoint — preview then apply — that ESTABLISHES the span-scoped agent-revision contract (claim-scoped first; Phase 45 generalizes the SAME endpoint). Step 1: request endpoint asks the evidence agent for a replacement source + rewritten claim, returns BOTH for a comparison card — no mutation. Step 2: confirm endpoint applies both atomically — content patch (rewrites the claim's prose in Sanity through the existing `content.py` machinery) + `claim_checks` update (new `sourceUrl`/`retrievedAt`/`text`, status) — and records a decision-log entry. Design the shape to generalize to arbitrary passage revision. Contract-first in §42. Sits behind EDT-05; logged to `audit_log`; no direct console→Sanity write.
- **D-18:** "Decision-log entry" = write to the existing `audit_log` trail for now; the formal Decision Log component is Phase 43. Every reason-requiring action here (Keep as written, Ask-agent confirm) writes an `audit_log` row.

**G. Revision → unchecked + "changed since check" (FCT-07)**
- **D-19:** Extend the existing `content.py` patch endpoints to reset touched claims, reusing the sign-off-revocation hook point. Add a parallel `_reset_touched_claims(run_id, sectionName, blockIndexHint)` that, for any `claim_checks` row anchored to a touched block (`sectionName` + `blockIndexHint`), sets `status = 'pending'` and sets the "changed since check" marker — even when the replacement text is itself sourced.
- **D-20:** The "changed since check" marker is a new optional `claim_checks` field (e.g. `changedSinceCheck: v.optional(v.boolean())` or a `changedAt` timestamp), set by a new operator/pipeline Convex mutation the content endpoints call; `changedCount` (D-06) counts set rows. Cleared when the claim is next checked. Additive/optional like all Phase 35 fields.

**H. Cross-cutting discipline**
- **D-21:** Contract-first. Amend `docs/API_CONTRACTS.md` with a new §42 (claim shape + `importance` field + the six action endpoints + the FCT-06 request/apply contract + the `changedSinceCheck`/`conflict` fields) BEFORE writing code.
- **D-22:** Reuse, do not rebuild. Consume `lib/derivedState.ts`, the Phase 35 claim rendering (`ClaimMark`/`AnnotationMark`/`spanResolver`), the `content.py` write-boundary + audit pattern, and `convex/claimChecks.ts`. New net-new: the `importance`/`changedSinceCheck`/`conflict` fields, the fact-check summary selector, the shared provenance card, the six-action endpoints, and the FCT-06 revision endpoint. Everything else is additive on shipped substrate.
- **D-23:** Every state renders label + icon, never color alone.

### Claude's Discretion
- Exact Researcher prompt/schema for emitting `importance`, and the publisher claimId→importance join mechanics (D-02).
- Whether unsourced deterministic claims get a flat `Supporting` fallback or a light load-bearing heuristic (D-03).
- Concrete predicates for `conflictsCount` / `checksNotRunCount` and whether `conflict` needs a stored field (D-07).
- Heuristics for `people & titles` vs `organization claims` and `weak source` (D-13).
- Endpoint home for the six actions (`api/factcheck.py` new router vs extending `api/content.py`) and the FCT-06 request/apply split (D-14, D-17).
- What "Edit claim" splits between `claim_checks` and Sanity content (D-15).
- Provenance card file location and the exact refactor path for Draft/Approval to consume it without regressing shipped surfaces (D-09).
- Precise copy for the summary line, filter chips, empty/zero states, and the comparison card.

### Deferred Ideas (OUT OF SCOPE)
- Generalizing the FCT-06 revision endpoint to arbitrary passage revision — Phase 45 (extends the SAME endpoint; Phase 42 builds it claim-scoped).
- The 7-tab "Inspect how this was made" panel — Phase 44 (Phase 42 builds the reusable provenance card + an Inspect entry point only).
- My Tasks screen + the formal shared Decision Log component — Phase 43 (Phase 42 writes to the derived task projection + `audit_log`, doesn't build the screen/component).
- Role/permission gating (locked-control rendering) of the six actions — Phase 49.
- Console-wide nomenclature ripple — Phase 50.
- Expanding `claimType`'s stored vocabulary (person vs org) — deferred; Phase 42 uses derived heuristics for the people/org filters (D-13), no stored subtype without a contract amendment.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FCT-01 | Researcher emits `importance` tier on every claim | See "FCT-01" below: exact `ClaimOutput`/`ResearchOutputModel` fields to extend in `researcher.py`, and the exact publisher merge site in `agents/publisher/__init__.py` that must read it via the `claimId`-keyed `research_claims` map |
| FCT-02 | Affirmative summary, blank never means verified | See "FCT-02": `deriveFactCheckSummary` sketch, exact counter predicates, reconciliation with `claimChecks:allSignedOff`'s existing gate semantics |
| FCT-03 | Filter claim table by 7 predicates | See "FCT-03": client-side predicate sketch, `claimType` heuristic split, integration with existing `claimType` regex vocabulary in `lib/claims.py` |
| FCT-04 | Shared provenance card (Draft/Approval/FactCheck/inspector) | See "FCT-04": exact field-sourcing table, refactor path for `ClaimMark.tsx`/`SourceIndex.tsx`, existing `sectionIdMap.ts` reuse for `agent` derivation |
| FCT-05 | Six claim actions wired to counters/tasks/readiness/header | See "FCT-05": exact write-boundary classification per action (operator-Convex vs pipeline-API), new Convex mutations needed, precedent from `qaCorrections.ts::setResolution` |
| FCT-06 | Ask-agent-for-better-evidence two-step content-patch+claim-update+decision-log | See "FCT-06": exact preview/apply endpoint sketch mirroring `voice_pass.py`'s rewrite + `findings.py`'s accept, reuse of `web_search`/`acomplete`/`resolve_span`/`patch_issue_field` |
| FCT-07 | Revision touching a claim's block resets it to unchecked + increments changed-count | See "FCT-07": `_reset_touched_claims` algorithm, the block-index-drift pitfall and recommended conservative fallback, exact hook points in `content.py` |

</phase_requirements>

## Summary

Phase 42 is a pure extension phase: it adds exactly one new stored field (`importance`, plus two small optional siblings `changedSinceCheck` and `conflict`) to an existing, well-understood Convex table (`claim_checks`), and otherwise composes existing, already-shipped machinery — the Phase 31 content-patch write boundary (`_resolve_sanity_id` / `patch_issue_field` / `_emit_audit` / `_revoke_active_signoffs`), the Phase 33 accept/dismiss action-endpoint template (`api/findings.py`), the Phase 36 preview-then-apply rewrite template (`api/voice_pass.py`), the Phase 32 span resolver (`lib/span_resolver.py`), and the Phase 40 derived-selector pattern (`lib/derivedState.ts`). No new npm/pip package is required anywhere in this phase.

The single highest-leverage finding is that `api/voice_pass.py::voice_rewrite` (generate-only, no mutation) plus `api/findings.py::accept_finding` (server-side span re-resolution + scoped patch + Convex flip + audit) is *literally* the FCT-06 "Ask agent for better evidence" two-step contract already built for a different domain (voice tells instead of claims). The new evidence-preview/apply endpoints should be near-verbatim copies of that pair, keyed off `claim_checks.text`/`sectionName`/`blockIndexHint` instead of `qaCorrections.quotedSpan`/`sectionName`/`blockIndexHint`.

The second highest-leverage finding is a **required correction to already-shipped code**: `apps/dispatch-control/lib/derivedState.ts::deriveTasks` currently computes claim severity as `row.sourceUrl ? 'review-recommended' : 'must-fix'` — i.e., it does not know about `importance` at all (it didn't exist yet). Per locked decision D-05, this must become `isMustFix(row)` (`importance === 'Load-bearing' && !sourceUrl`). This requires `WorkspaceStateProvider.tsx`'s `claimRows` mapping (currently 5 fields: `_id, status, sourceUrl, sectionName, claimText`) to be additively extended with `claimIndex`, `claimId`, `importance`, and `changedSinceCheck` — otherwise My Tasks / stage-tab badges will silently disagree with the new Stage 3 screen's own richer subscription.

The third finding worth flagging early: `claimChecks:allSignedOff` (the `facts-cleared` sign-off's server-side prerequisite, in `api/signoffs.py`) already requires "every row status !== 'pending'" with **no allowlist on the status string** — this means any new terminal status value this phase introduces (e.g. `'kept'` for Keep-as-written, or a soft-delete flag for Remove) is automatically compatible with the existing gate with **zero code change to `signoffs.py`**, *provided* Remove-claim rows are excluded from the `claim_checks:listByRunId`/`allSignedOff` "live" row set (or also flipped off `'pending'`). This must be handled explicitly or the Approval gate will silently misbehave.

**Primary recommendation:** Build one new pipeline router `api/factcheck.py` (mirroring `findings.py`'s structure) that owns Edit-claim / Replace-source / Remove-claim / Keep-as-written / the two-step Ask-agent-for-better-evidence pair, and one new Convex module extension (`convex/claimChecks.ts` gains `byRunIdAndIndex`, `updateClaim`, `markChanged`, `remove`, all `requirePipelineSecret`-guarded, mirroring `qaCorrections.ts::setResolution`'s guard lane). Extend `content.py`'s `patch_section`/`patch_bonus` (specAd only) with a `_reset_touched_claims` call placed immediately alongside the existing `_revoke_active_signoffs` call. Build one new derived-selector module addition `deriveFactCheckSummary` in `lib/derivedState.ts`, fix `deriveTasks`'s claim-severity heuristic, and extend `WorkspaceStateProvider`'s `claimRows` mapping. Build one new shared component `ClaimProvenanceCard.tsx` and refactor `ClaimMark.tsx`/`SourceIndex.tsx` to consume it incrementally (do not do a big-bang rewrite of Draft/Approval in the same phase as the new Stage 3 screen — sequence it as its own wave).

## Standard Stack

### Core

No new libraries. This phase is 100% additive on the existing stack:

| Component | Version (verified in repo) | Role in this phase |
|---|---|---|
| FastAPI | `0.136.1` (`packages/pipeline/pyproject.toml`) | New `api/factcheck.py` router, mounted in `api/main.py` |
| Pydantic | `2.13.4` | New request/response models for the six-action + evidence endpoints |
| Convex (schema/functions) | in-repo, no version pin needed | `claim_checks` table extension, new `claimChecks.ts` mutations |
| httpx (`AsyncClient`) | `0.28.1` | Sanity GROQ read for charity name (evidence-search query context) |
| `langchain-tavily` / `tavily-python` | `0.2.18` / `0.7.24` | Reused by the evidence-preview endpoint via `lib/search_client.py::web_search` — already configured (`TAVILY_API_KEY`), used today by Scout + Researcher |
| `langchain-openai` (OpenRouter client) | `1.2.1` | Reused via `lib/openrouter_client.py::acomplete` for the evidence-preview LLM call — already configured (`OPENROUTER_API_KEY`), used today by every agent including `voice_pass.py::voice_rewrite` |
| Next.js / React / Convex client | in-repo (`apps/dispatch-control/package.json`) | New Stage 3 screen, new `ClaimProvenanceCard.tsx`, new client module `factCheckClient.ts` mirroring `voicePassClient.ts`/`findingsClient.ts` |
| vitest | in-repo | Existing test harness for the new components/selectors |
| pytest / pytest-asyncio | `>=8.3,<9` / `>=0.24,<1` | Existing test harness for the new endpoints |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `api/content.py` with the six new claim endpoints | New standalone `api/factcheck.py` router | `content.py` is already 811 lines covering 9 distinct endpoint families; a 10th (claim-specific) family with its own request models is cleaner as its own router file — matches the existing precedent of `findings.py` and `voice_pass.py` being split out from `content.py` rather than appended to it |
| A new `importance` judge/LLM call at review time | Researcher-emitted `importance` at generation time (locked, D-02) | Locked decision — not open for research to re-litigate. Generation-time emission is cheaper (one extra structured-output field, no new agent call) and matches the existing `claims: list[ClaimOutput]` pattern exactly |
| Hard-delete on "Remove claim" | Soft-delete (`removed: v.optional(v.boolean())`) | Hard-delete is simpler but destroys audit trail and risks claimIndex reuse confusion if a future re-run's `insertBatch` (which does delete-all-then-reinsert per run) is ever changed to append-only. Soft-delete preserves history and is a 1-line filter everywhere `claim_checks` rows are consumed |

**Installation:** None — no new packages.

## Architecture Patterns

### Recommended Project Structure (new/changed files)

```
convex/
├── schema.ts                          # claim_checks: +importance, +changedSinceCheck, +conflict
├── claimChecks.ts                     # +byRunIdAndIndex, +updateClaim, +updateSource, +markChanged, +remove, +keepAsWritten
packages/pipeline/src/eisenbalm_pipeline/
├── agents/researcher.py               # ClaimOutput +importance; mapped_claims +importance
├── agents/publisher/__init__.py       # sourced_rows +importance (via research_claims lookup); unsourced rows +importance fallback
├── lib/claims.py                      # extract_claims_by_block rows get a default importance (fallback logic, or leave to publisher)
├── api/factcheck.py                   # NEW router — keep/edit/replace-source/remove + evidence preview+apply
├── api/content.py                     # patch_section + patch_bonus (specAd) gain _reset_touched_claims call
├── api/main.py                        # +app.include_router(factcheck.router)
apps/dispatch-control/
├── lib/derivedState.ts                # +deriveFactCheckSummary, +isMustFix; fix deriveTasks claim severity
├── lib/factCheckClient.ts             # NEW — mirrors voicePassClient.ts + findingsClient.ts
├── components/provenance/ClaimProvenanceCard.tsx   # NEW shared card
├── components/galley/ClaimMark.tsx    # refactor to source popover content from the shared card (careful, incremental)
├── app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx  # refactor to reuse the shared card's row rendering
├── app/(dashboard)/issues/[issueNumber]/fact-check/
│   ├── page.tsx                       # replace placeholder wiring
│   ├── FactCheckScreen.tsx            # NEW — real stage (own useQuery(claimChecks.listByRunId), summary, filters, table)
│   ├── FactCheckPlaceholder.tsx       # DELETE (Phase 41 interim surface)
│   └── FactCheckPanelContent.tsx      # extend buildFactCheckPanelContent or keep as-is (context-panel summary only)
├── app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx    # claimRows mapping +claimIndex, +claimId, +importance, +changedSinceCheck
docs/
└── API_CONTRACTS.md                   # +§42 (written BEFORE code, per D-21)
```

### Pattern 1: Preview-then-apply agent revision (FCT-06's exact template already exists)

**What:** A read-only "generate a suggestion" endpoint, followed by a separate "apply" endpoint that re-resolves the span server-side and atomically patches Sanity + flips Convex state + audits.
**When to use:** Any "ask agent to change something" flow that must show the operator a comparison before committing.
**Example (existing code, Phase 36 — this is what FCT-06 clones):**
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py:150-205 (preview/generate step)
@router.post("/issues/{run_id}/voice-rewrite")
async def voice_rewrite(request, run_id, body: _RewriteBody, claims=Depends(_require_clerk_jwt_control)) -> dict:
    """ONLY generates text — never mutates the draft, never calls setResolution,
    never patches Sanity. Client passes the result into accept as suggestedFixOverride."""
    ...
    rewrite, _usage = await acomplete(agent_id="qa", run_id=f"voice-rewrite-{run_id}", messages=messages, response_format=_Rewrite)
    return {"findingId": body.findingId, "suggestedFix": suggested_fix}
```
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/findings.py:112-247 (apply step)
@router.post("/issues/{run_id}/findings/{finding_id}/accept")
async def accept_finding(request, run_id, finding_id, body: _AcceptBody, claims=Depends(_require_clerk_jwt_control)) -> dict:
    # load -> 409 checks -> get_issue_draft -> resolve_span (None -> 409 span_not_resolved)
    # -> patch_issue_field (stale rev -> 409 revision_mismatch) -> Convex flip -> audit
    ...
```
FCT-06's evidence preview/apply pair should follow this shape exactly, substituting a Tavily `web_search` call ahead of the `acomplete` call in the preview step (see Pattern 2), and substituting `claim_checks` row lookup/patch for `qaCorrections` lookup/patch in the apply step.

### Pattern 2: Fresh web search + structured-output claim mapping (Researcher's own pattern, reusable for evidence search)

**What:** Run N Tavily queries, numbering results as `[S0]..[Sn]`, then have the LLM select an index (never emit a raw URL) so a hallucinated source URL is structurally impossible.
**Example:**
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py:151-244
class ClaimOutput(BaseModel):
    text: str = ""
    sourceIndex: int | None = None   # 0-based index into the numbered Tavily results

batch = await web_search(q, max_results=4)
...
if isinstance(source_index, int) and 0 <= source_index < len(tavily_results):
    source_url = tavily_results[source_index].url
```
The evidence-preview endpoint should reuse `web_search` (`lib/search_client.py::web_search(query, *, max_results=5)`) directly — form the query from the claim's `text` (+ charity name, fetched via a small GROQ projection — see FCT-06 below) — then use the same index-selection discipline in a small single-claim response model.

### Pattern 3: Pipeline-lane-only Convex mutations for content-adjacent state (write-boundary discipline)

**What:** Some Convex mutations are directly callable from the dashboard (`requireOperator`); others may ONLY be called from the FastAPI pipeline layer (`requirePipelineSecret`) so that every write gets an accompanying `_emit_audit` row.
**Confirmed precedent:**
```typescript
// Source: convex/qaCorrections.ts:90-105 — setResolution is requirePipelineSecret-guarded,
// called ONLY from api/findings.py / api/voice_pass.py, never directly from the dashboard.
export const setResolution = mutation({
  args: { id: v.id('qaCorrections'), resolution: v.optional(...), pipelineSecret: v.optional(v.string()) },
  handler: async (ctx, { pipelineSecret, ... }) => { requirePipelineSecret(pipelineSecret); ... }
})
```
**Application:** `claimChecks.ts`'s existing `setStatus` stays `requireOperator`-guarded (Confirm keeps calling it directly, as `ClaimMark.tsx`/`SourceIndex.tsx` already do). All NEW claim mutations this phase adds (`updateClaim`, `updateSource`, `markChanged`, `remove`, and whatever "Keep as written" uses) should be `requirePipelineSecret`-guarded and reachable ONLY through `api/factcheck.py`, so every one of them gets a real `_emit_audit` row — this is what makes "Keep as written" (which needs a mandatory reason + audit trail) different from a bare `setStatus('checked')` call.

### Pattern 4: Derived-selector module extension (no new subscriptions)

**What:** `lib/derivedState.ts` is the ONE place editorial policy (severity, stage rules) lives; it is pure functions over already-fetched Convex query results.
**Example (current claim severity — MUST be corrected this phase):**
```typescript
// Source: apps/dispatch-control/lib/derivedState.ts:314-327 (deriveTasks, current)
for (const row of i.claimRows ?? []) {
  if (row.status !== 'pending') continue
  const sev: TaskSeverity = row.sourceUrl ? 'review-recommended' : 'must-fix'  // <- importance-blind, must change (D-05)
  ...
}
```
**Recommended replacement (illustrative, not locked):**
```typescript
export function isMustFix(row: { importance?: string; sourceUrl?: string }): boolean {
  return (row.importance ?? 'Supporting') === 'Load-bearing' && !row.sourceUrl
}
// in deriveTasks:
const sev: TaskSeverity = isMustFix(row) ? 'must-fix' : 'review-recommended'
```
This requires `DerivationInputs.claimRows` (and the `WorkspaceStateProvider.tsx` mapping that builds it) to carry `importance` — currently it does not (see Common Pitfalls).

### Pattern 5: `sectionName → agent` derivation (reuse existing bidirectional map, do not build a new one from scratch)

**What:** D-10 needs an `agent` label per claim, derived from `sectionName`. The galley `sectionName` vocabulary (`originStory`, `problemStatement`, `founderBio`, `caseStudy`, `bonus`) already has a reverse mapper back to the internal snake_case agent/module key.
```typescript
// Source: apps/dispatch-control/lib/galley/sectionIdMap.ts:29-40
export function galleyIdToQaSection(galleyId: string): string | null { ... }
// 'problemStatement' -> 'problem', 'originStory' -> 'origin_story', etc.
```
Combine with a tiny presentation formatter (title-case + " Writer" suffix, or a 5-entry literal label map) rather than inventing a new galleyId→agent map. `sectionName` absent (legacy/global rows) → agent = "—" (never a guess), consistent with D-10's "never blank-as-verified" framing extended to "never fabricate an agent attribution."

### Anti-Patterns to Avoid
- **Don't fork the provenance card into three near-identical components** (Draft popover / Approval list row / Fact Check card) — D-09 explicitly forbids this; even if the visual chrome differs (inline popover vs context-panel card vs list row), the *data-to-fields* mapping function should be one shared function/component consumed by all three render contexts.
- **Don't add a new judge/LLM call to compute `importance` post-hoc** — locked as Researcher-emitted at generation time (D-02); a post-hoc classifier would violate the "one net-new backend concept" framing of this phase and reintroduce the citation-hallucination risk class Phase 35 was built to avoid.
- **Don't expand `claimType`'s stored vocabulary** (e.g., adding `"person"`/`"organization"` as new literal values) to implement the people/org filters — D-13 explicitly reserves this; use a derived client-side heuristic instead.
- **Don't let `deriveFactCheckStage`/`deriveTasks` (already shipped, Phase 40/41) silently diverge from the new `deriveFactCheckSummary`** — both read `claim_checks` rows; if the Stage 3 screen computes `mustFixCount` one way and the stage-tab badge/My Tasks computes severity another way, the header/tab/task list will visibly disagree (violates D-16's implicit assumption that all four surfaces agree because they share the same selector logic).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locating a claim's exact phrase inside current Sanity block content to patch it | A new fuzzy-text-search / diff algorithm | `lib/span_resolver.py::resolve_span(blocks, quoted_span, block_index_hint)` — already handles exact/quote-normalized/whitespace-tolerant matching + disambiguation, used today by `findings.py::accept_finding` | It already solves exactly this problem for QA findings; `claim_checks.text` (the sourced row's verbatim `asWritten` string) is a `quotedSpan`-shaped input it already accepts |
| Generating a replacement source + rewritten claim text from an operator click | A bespoke prompt/response pipeline from scratch | Reuse `lib/search_client.py::web_search` (Tavily) + `lib/openrouter_client.py::acomplete` (OpenRouter/Anthropic), following the exact index-selection discipline `researcher.py` already uses | Both clients are already configured, tested, and cost-tracked (`acomplete` records cost per agent call automatically) |
| Reset-claims-on-edit bookkeeping | A new "dirty tracking" subsystem | The existing `sectionName`/`blockIndexHint` anchor pair already stored on every `claim_checks` row (Phase 35) | These anchors already exist for exactly this purpose (jump-links); reuse them as the match key for reset, don't invent a second anchor scheme |
| Per-action audit logging | A new audit table / logging convention | `_emit_audit` (already threads through every content-patch + findings + voice-pass + signoffs endpoint) | One audit_log table, one helper, already wired to Convex; the "decision log" is explicitly specified (D-18) to be a projection over this SAME trail, not a new store |
| Sign-off gate re-checking must-fix count | New logic in `api/signoffs.py` | Nothing — `claimChecks:allSignedOff`'s existing `status !== 'pending'` check already transitively enforces "no pending must-fix claims block facts-cleared", since a must-fix claim is by definition still `pending` until acted on | Verified: `allSignedOff`'s predicate has no status allowlist, so any new terminal status this phase introduces (e.g. `'kept'`) is automatically compatible — **but only if Remove-claim excludes/flips removed rows so they don't stay `'pending'` forever** (see Common Pitfalls) |

**Key insight:** Every "new" mechanism FCT-04/05/06/07 ask for has a structurally identical shipped precedent from Phase 31/32/33/34/35/36 — this phase's actual net-new surface area is small (one field, a handful of new Convex mutations, one new router file, one new selector, one shared component).

## Runtime State Inventory

Not applicable — this is a greenfield-additive phase (new fields/endpoints/screens), not a rename/refactor/migration phase. Skipped per the trigger condition.

## Common Pitfalls

### Pitfall 1: `WorkspaceStateProvider`'s `claimRows` mapping is too narrow for the new selector and for `deriveTasks`'s corrected severity logic
**What goes wrong:** The provider currently maps raw `claim_checks` rows down to `{_id, status, sourceUrl, sectionName, claimText}` (see `WorkspaceStateProvider.tsx:133-139`). `importance`, `claimIndex`, `claimId`, `changedSinceCheck` are all dropped. If `deriveFactCheckSummary`/corrected `deriveTasks` are wired against this same mapped array without extending it, `mustFixCount` and task severity will always be wrong (importance undefined everywhere).
**Why it happens:** The mapping was written in Phase 40/41 before `importance` existed; it's easy to miss because the code still "works" (just silently wrong) — TypeScript won't catch a missing optional field silently defaulting.
**How to avoid:** Extend the mapping additively (`claimIndex: row.claimIndex, claimId: row.claimId, importance: row.importance, changedSinceCheck: row.changedSinceCheck`) as part of this phase's plan, and update `DerivationInputs['claimRows']`'s type in `derivedState.ts` to match. Add a unit test asserting `deriveTasks` produces `'must-fix'` only for `importance === 'Load-bearing' && !sourceUrl` rows, not merely `!sourceUrl` rows.
**Warning signs:** A claim with `importance: 'Incidental'` and no `sourceUrl` still shows as "must fix" in My Tasks/stage badge even though the Fact Check screen itself (reading full rows) correctly shows it as "Review recommended".

### Pitfall 2: Block-index drift makes naive position-based "touched block" diffing unreliable
**What goes wrong:** `patch_section`/`patch_bonus` replace the WHOLE section body array in one PATCH; there is no per-block diff today. If `_reset_touched_claims` is implemented as "compare `before[i].text` to `after[i].text`" and an operator inserts a new paragraph above block 2, every subsequent block's *content* is unchanged but its *index* shifts — a naive positional diff would either falsely mark all downstream blocks as "changed" (if only comparing values fails due to shift) or, worse, silently miss the truly-inserted block's claims if lengths differ and the loop stops early.
**Why it happens:** `blockIndexHint` was documented from the start as "a hint only, never authoritative" (§32.1) — the whole system already assumes index drift is possible and normal; a new `_reset_touched_claims` implementation must inherit that same humility.
**How to avoid:** When `len(before_blocks) == len(after_blocks)`, do a positional text diff to find touched indices precisely. When lengths differ (insert/delete happened), do NOT attempt positional diffing — conservatively treat the **entire section** as touched (reset every `claim_checks` row for that `sectionName`, regardless of `blockIndexHint`). Over-resetting is safe (worst case: an operator re-confirms a claim that didn't actually need it); under-resetting silently leaves a stale "checked" state next to changed prose, which is the actual failure mode FCT-07 exists to prevent.
**Warning signs:** A claim shows "✓ Checked" immediately after an edit that visibly changed the surrounding paragraph, because index-based matching missed it.

### Pitfall 3: Self-reset ordering — an action that edits a claim's own block must not leave that same claim un-resolved
**What goes wrong:** If "Edit claim" (or the evidence-apply step) patches prose in a block, and `_reset_touched_claims` fires generically for that block, the SAME claim being explicitly edited/confirmed would get reset back to `'pending'` by its own side effect, undoing the explicit terminal-status write the endpoint is also trying to make.
**Why it happens:** Both effects touch the same row; ordering determines which one "wins" if they're not coordinated.
**How to avoid:** In any endpoint that both (a) content-patches a block AND (b) sets a terminal status on the specific claim being acted on, call `_reset_touched_claims` FIRST, then explicitly set the acted-upon claim's terminal status (and clear its `changedSinceCheck` flag) LAST, so the explicit action always wins over the generic reset. Any *other* claim sharing that block legitimately stays reset-to-pending.
**Warning signs:** Confirming/editing a claim immediately shows it as "Changed" or "Unchecked" instead of the just-applied terminal state.

### Pitfall 4: `allSignedOff`'s total/signedOff counts must stay honest once Remove-claim exists
**What goes wrong:** `claimChecks:allSignedOff` (`total > 0 && every row status !== 'pending'`) is the server-side prerequisite gate for the `facts-cleared` sign-off (`api/signoffs.py:92-107`). If "Remove claim" is implemented as a soft-delete flag without also updating `allSignedOff`/`listByRunId` to exclude removed rows, one of two bad things happens: either the removed row still counts toward `total` and blocks sign-off forever (if it stays `'pending'`), or the sign-off gate silently ignores its own removal bookkeeping inconsistently across the app (Fact Check screen filters it out, but the gate still sees it).
**Why it happens:** `allSignedOff` and `listByRunId` are two independent Convex functions; a new `removed` flag added to the schema does nothing to either unless both are explicitly updated.
**How to avoid:** Decide definitively (a) whether Remove sets `status` to a new terminal value (e.g. `'removed'`, which trivially satisfies `!== 'pending'` with zero code change) — the simplest, lowest-risk option — or (b) filters removed rows out of `allSignedOff`/`listByRunId`'s counted set explicitly. Pick (a) unless there's a strong reason to keep removed claims fully invisible; either way, write an explicit test.
**Warning signs:** Facts-cleared sign-off 409s with `claims_not_signed_off` even though the Fact Check screen shows "0 unchecked."

### Pitfall 5: `research.claims` and `claimSpans` are ephemeral (never reach Sanity) — "Edit claim"/"Ask agent apply" must resolve prose via `claim_checks`, not via claimSpans
**What goes wrong:** A naive implementation might assume the writer's `claimSpans` sidecar (`{claimId, asWritten}`) is still available at review time to locate where a claim's phrase lives in the draft. It is not — §35.3 explicitly states `claimSpans` is NEVER forwarded to Sanity and only exists transiently inside the writer's in-memory output dict during the original pipeline run.
**Why it happens:** The naming similarity between `claimSpans` (writer-time) and `claim_checks` (persisted) invites confusion.
**How to avoid:** At review time, the ONLY persisted anchor for a sourced claim's phrase is the `claim_checks` row itself: `text` (== the original `asWritten` value, verbatim — see `publisher/__init__.py:135-138`, `"text": as_written`), `sectionName`, and `blockIndexHint`. Content-patching endpoints (Edit claim, Ask-agent-apply) must resolve against **current** Sanity block content using `resolve_span(current_blocks, claim_row.text, claim_row.blockIndexHint)` exactly like `findings.py::accept_finding` does — never assume `claimSpans` is queryable post-publish.
**Warning signs:** An implementation tries to read `state['research']['claims']` or `section['claimSpans']` from a completed run and finds nothing (the LangGraph checkpoint may not even be loadable post-completion in the same way `rerun_agent` reloads it).

### Pitfall 6: Evidence-preview needs charity context that isn't on `pipelineRuns` or in `get_issue_draft`'s current projection
**What goes wrong:** Forming a good Tavily search query for "better evidence" needs the charity's name (and ideally domain) for context, similar to how `researcher.py::_build_queries` uses `charity.get("name")`/`charity.get("website")`. Neither `pipelineRuns` (Convex) nor `get_issue_draft`'s current GROQ projection (`_DRAFT_GROQ`, `sanity_client.py:576-582`) includes charity name.
**Why it happens:** Charity name/website live on the Sanity `charity` document, referenced from `weeklyIssue`, and no existing draft-read endpoint dereferences it (it's not needed for editing).
**How to avoid:** Add a small scoped GROQ projection (mirroring `content.py::_fetch_before`'s pattern) — e.g. `*[_id == $id][0]{"charityName": charity->name, "charityWebsite": charity->website}` — called once inside the evidence-preview endpoint, not a wholesale expansion of `get_issue_draft`'s shape.
**Warning signs:** Evidence search queries are generic/low-quality because they only have the bare claim text with no charity context.

### Pitfall 7: Design-doc "Verification" state vocabulary vs CONTEXT's locked per-claim chip vocabulary
**What goes wrong:** `Dispatch Control v3 - Annotations.md`'s "State model" section lists `Checked · Partly checked · Check not run · Failed check · Changed since checking` for "Verification: fact summary + per claim" — five labels. CONTEXT.md's locked D-08 vocabulary for the per-claim chip is `✓ Checked / ✕ Must fix / Unchecked / Review recommended / Changed` — a different five labels, oriented around severity rather than a check-attempt lifecycle. Implementing both verbatim would produce visibly inconsistent copy.
**Why it happens:** The Annotations doc's "State model" section appears to be a cross-domain summary table (covering Issue status / System activity / Verification / Attention as four parallel taxonomies) rather than a literal per-claim chip spec; CONTEXT.md's D-08 is the phase-specific locked decision that supersedes it for THIS phase's actual UI.
**How to avoid:** Treat D-08's vocabulary as authoritative for the per-claim chip and the summary line (it is a locked CONTEXT.md decision, which per this project's hierarchy outranks an exploratory reading of the design annotations). Flag this reconciliation explicitly in the plan so the discrepancy is a documented, deliberate choice rather than an oversight.
**Warning signs:** None functionally — this is a copy/consistency risk, not a data risk. Worth one line in the plan's rationale so a future reader doesn't "fix" it back to the Annotations wording.

## Code Examples

### `deriveFactCheckSummary` — illustrative sketch (D-04/D-05/D-06/D-07/D-08; NOT a locked spec, exact predicates are discretion)

```typescript
// Source pattern: apps/dispatch-control/lib/derivedState.ts (new addition, mirrors deriveStageStates style)
export interface FactCheckClaimRow {
  claimIndex: number
  claimId?: string
  text: string
  claimType: string
  status: string // 'pending' | 'checked' | 'skipped' | 'kept' | 'removed' | ...
  importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
  sourceUrl?: string
  retrievedAt?: number
  sectionName?: string
  blockIndexHint?: number
  changedSinceCheck?: boolean
  conflict?: boolean
  checkedAt?: number
}

export function isMustFix(row: Pick<FactCheckClaimRow, 'importance' | 'sourceUrl' | 'status'>): boolean {
  return row.status === 'pending' && (row.importance ?? 'Supporting') === 'Load-bearing' && !row.sourceUrl
}

export interface FactCheckSummary {
  factCoverage: string
  total: number
  checked: number
  mustFixCount: number
  changedCount: number
  uncheckedCount: number
  conflictsCount: number
  checksNotRunCount: number
  lastVerifiedAt: number | null
}

export function deriveFactCheckSummary(rows: FactCheckClaimRow[]): FactCheckSummary {
  const total = rows.length
  const checked = rows.filter(r => r.status !== 'pending').length
  const mustFixCount = rows.filter(isMustFix).length
  const changedCount = rows.filter(r => r.changedSinceCheck).length
  const uncheckedCount = rows.filter(r => r.status === 'pending').length
  const conflictsCount = rows.filter(r => r.conflict).length
  const checksNotRunCount = rows.filter(
    r => r.status === 'pending' && !r.sourceUrl && !r.changedSinceCheck,
  ).length
  const checkedAts = rows.map(r => r.checkedAt ?? 0).filter(t => t > 0)
  const lastVerifiedAt = checkedAts.length > 0 ? Math.max(...checkedAts) : null
  return {
    factCoverage: `${checked} of ${total}`,
    total, checked, mustFixCount, changedCount, uncheckedCount, conflictsCount, checksNotRunCount, lastVerifiedAt,
  }
}
```

### `_reset_touched_claims` — illustrative sketch (D-19/D-20; conservative on index drift per Pitfall 2)

```python
# Source pattern: packages/pipeline/src/eisenbalm_pipeline/api/content.py (new helper, called
# alongside _revoke_active_signoffs in patch_section and patch_bonus's specAd branch)
async def _touched_block_indices(before_blocks: list[dict], after_blocks: list[dict]) -> set[int] | None:
    """None return = 'whole section touched' (length changed — index-position
    diffing is unreliable under insert/delete, Pitfall 2)."""
    if len(before_blocks) != len(after_blocks):
        return None
    return {
        i for i, (b, a) in enumerate(zip(before_blocks, after_blocks))
        if (b or {}).get("text") != (a or {}).get("text")
    }

async def _reset_touched_claims(
    convex_http: Any, *, run_id: str, section_name: str, touched: set[int] | None,
) -> None:
    rows = await _cc.convex_query(convex_http, "claimChecks:listByRunId", {"runId": run_id}) or []
    for row in rows:
        if row.get("sectionName") != section_name:
            continue
        bih = row.get("blockIndexHint")
        # touched is None -> whole section; bih is None -> unresolved anchor, reset
        # conservatively rather than silently skip.
        if touched is None or bih is None or bih in touched:
            await _cc.convex_mutation_safe(
                "claimChecks:markChanged", {"runId": run_id, "claimIndex": row["claimIndex"]},
            )
```

Called from `patch_section` as (illustrative placement, immediately after the existing `_revoke_active_signoffs` call):
```python
await _revoke_active_signoffs(convex_http, run_id=run_id, reason="section edited")
touched = await _touched_block_indices(before.get("body", []), blocks)
await _reset_touched_claims(convex_http, run_id=run_id, section_name=section_name, touched=touched)
```

## §42 Contract Skeleton (write this into `docs/API_CONTRACTS.md` BEFORE code, per D-21)

```markdown
## §42 — Fact Check Stage (Phase 42)

### §42.1 — `claim_checks` additive fields (amends §26.2/§35.4 in place)

claim_checks gains three additive optional fields:
  importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental')))
  changedSinceCheck: v.optional(v.boolean())
  conflict: v.optional(v.boolean())

Invariant: importance absent => treated as 'Supporting' for mustFix purposes (D-03), never blank in the UI.

### §42.2 — Researcher `ClaimOutput` gains `importance` (D-01/D-02)

class ClaimOutput(BaseModel):
    text: str = ""
    sourceIndex: int | None = None
    importance: Literal['Load-bearing', 'Supporting', 'Incidental'] = 'Supporting'  # NEW

Mapped claim (state["research"]["claims"][i]) gains `importance` alongside claimId/sourceUrl/retrievedAt.
Publisher's sourced_rows lookup (research_claims[claimId]) carries `importance` through exactly like
sourceUrl/retrievedAt today. Unsourced (regex catch-all) rows default importance='Supporting' (D-03).

### §42.3 — `claimChecks.ts` new/changed functions

insertBatch: claims[] objects gain `importance: v.optional(...)` (pass-through, mirrors §35.5)
byRunIdAndIndex({runId, claimIndex}): Promise<Doc<'claim_checks'> | null>          [NEW, public read]
updateClaim({runId, claimIndex, text?, sourceUrl?, retrievedAt?, pipelineSecret}): Promise<void>  [NEW, requirePipelineSecret]
markChanged({runId, claimIndex, pipelineSecret}): Promise<void>
  // sets status:'pending', changedSinceCheck:true                                 [NEW, requirePipelineSecret]
keepAsWritten({runId, claimIndex, status:'checked'|other, pipelineSecret}): Promise<void>
  // terminal status, mirrors setStatus but pipeline-lane so the caller can audit  [NEW, requirePipelineSecret]
remove({runId, claimIndex, pipelineSecret}): Promise<void>
  // sets status:'removed' (or a removed flag — see 42-RESEARCH Pitfall 4)         [NEW, requirePipelineSecret]
setStatus: UNCHANGED (Confirm keeps calling this directly, requireOperator)

### §42.4 — New pipeline endpoints (api/factcheck.py, mounted in api/main.py)

POST   /issues/{run_id}/claims/{claim_index}/keep          body {reason: string}
PATCH  /issues/{run_id}/claims/{claim_index}                body {ifRevisionID?, text?, sourceUrl?, retrievedAt?}
POST   /issues/{run_id}/claims/{claim_index}/replace-source body {sourceUrl: string, retrievedAt?: number}
DELETE /issues/{run_id}/claims/{claim_index}                body {reason?: string}
POST   /issues/{run_id}/claims/{claim_index}/evidence/preview  body {} -> {sourceUrl, sourcePublisher, retrievedAt, rewrittenClaim}
POST   /issues/{run_id}/claims/{claim_index}/evidence/apply    body {ifRevisionID, sourceUrl, retrievedAt, rewrittenClaim}

All Clerk-JWT-guarded (_require_clerk_jwt_control). Content-touching routes (PATCH claim when text
changes, evidence/apply) additionally call _reset_touched_claims + _revoke_active_signoffs + _emit_audit,
mirroring api/content.py's patch_section shape exactly. evidence/preview is read-only (mirrors
voice_pass.py::voice_rewrite) — no audit row, no mutation.

### §42.5 — `_reset_touched_claims` hook (amends §31 patch_section/patch_bonus in place)

patch_section (all 4 long-reads) and patch_bonus (specAd branch's `blocks` payload only — bigBudget/
jingle bonus.body is a plain string, exempt per §35.3 D-06) each gain a call to
_reset_touched_claims(convex_http, run_id=, section_name=, touched=) immediately alongside the existing
_revoke_active_signoffs call. See 42-RESEARCH.md Pitfall 2 for the index-drift-conservative algorithm.

### §42.6 — Provenance card shape (D-09/D-10)

{ text, importance, status, sourceUrl, sourcePublisher, supportingPassage, retrievedAt, agent, confidence }
sourcePublisher = derived from sourceUrl host (new); supportingPassage = context field (existing);
agent = derived from sectionName via galleyIdToQaSection + a 5-entry label map (new, tiny); confidence
= "—" always (no stored source for this yet — never invent a value).
```

## Data Model Deltas (concrete)

| File | Change | Type |
|---|---|---|
| `convex/schema.ts` (`claim_checks`, ~L431-452) | `+importance`, `+changedSinceCheck`, `+conflict` (all `v.optional`) | Additive |
| `convex/claimChecks.ts` (`insertBatch` args) | `+importance: v.optional(...)` in the `claims` array object validator | Additive |
| `convex/claimChecks.ts` | `+byRunIdAndIndex`, `+updateClaim`, `+markChanged`, `+remove`, `+keepAsWritten` | New functions |
| `packages/pipeline/.../agents/researcher.py` (`ClaimOutput`) | `+importance: Literal[...] = 'Supporting'` | Additive field |
| `packages/pipeline/.../agents/researcher.py` (`mapped_claims` construction, ~L238-243) | `+"importance": claim_dict.get("importance", "Supporting")` | Code change |
| `packages/pipeline/.../agents/publisher/__init__.py` (`sourced_rows` construction, ~L135-154) | `+row["importance"] = rc.get("importance", "Supporting") if rc else "Supporting"` | Code change |
| `packages/pipeline/.../agents/publisher/__init__.py` (`unsourced_rows`, ~L161-166) | Each unsourced row gets `row["importance"] = "Supporting"` before appending (D-03 fallback) | Code change |
| `packages/pipeline/.../api/content.py` (`patch_section`, `patch_bonus`) | `+_reset_touched_claims(...)` call | Code change |
| `packages/pipeline/.../api/factcheck.py` | New file | New |
| `packages/pipeline/.../api/main.py` | `+app.include_router(factcheck.router)` | Code change |
| `apps/dispatch-control/lib/derivedState.ts` | `+isMustFix`, `+deriveFactCheckSummary`, fix `deriveTasks` claim severity, extend `DerivationInputs['claimRows']` type | Code change + additive |
| `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` (`claimRows` mapping, ~L133-139) | `+claimIndex, +claimId, +importance, +changedSinceCheck` | Code change |
| `apps/dispatch-control/lib/factCheckClient.ts` | New file (mirrors `findingsClient.ts`/`voicePassClient.ts`) | New |
| `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` | New file | New |
| `docs/API_CONTRACTS.md` | `+§42` | New section, written first |

## Endpoint List (methods/paths/bodies/guards) — recap

| Method | Path | Body | Guard | Content-touching? |
|---|---|---|---|---|
| (existing, unchanged) `useMutation(api.claimChecks.setStatus)` | Confirm — direct Convex call | `{runId, claimIndex, status:'checked'}` | `requireOperator` | No |
| POST | `/issues/{run_id}/claims/{claim_index}/keep` | `{reason: string}` (reject empty, mirrors `dismiss_finding`) | Clerk | No (claim record only) |
| PATCH | `/issues/{run_id}/claims/{claim_index}` | `{ifRevisionID?, text?, sourceUrl?, retrievedAt?}` | Clerk | Yes, if `text` present (Sanity prose patch via `resolve_span`+`patch_issue_field`) |
| POST | `/issues/{run_id}/claims/{claim_index}/replace-source` | `{sourceUrl, retrievedAt?}` | Clerk | No (metadata only) |
| DELETE | `/issues/{run_id}/claims/{claim_index}` | `{reason?}` | Clerk | No |
| POST | `/issues/{run_id}/claims/{claim_index}/evidence/preview` | `{}` | Clerk | No (read-only, mirrors `voice_rewrite`) |
| POST | `/issues/{run_id}/claims/{claim_index}/evidence/apply` | `{ifRevisionID, sourceUrl, retrievedAt, rewrittenClaim}` | Clerk | Yes (Sanity patch + claim update, atomic) |

Exact path/verb naming is Claude's discretion (D-14); this table is a concrete, internally-consistent recommendation, not a mandate.

## Proposed Wave/Plan Decomposition

1. **Wave A — Contract + data model (blocking everything else).** Amend `docs/API_CONTRACTS.md` §42 (D-21). Add `importance`/`changedSinceCheck`/`conflict` to `convex/schema.ts` + `claimChecks.ts::insertBatch`. Add the new Convex functions (`byRunIdAndIndex`, `updateClaim`, `markChanged`, `remove`, `keepAsWritten`). Deploy to the dev Convex deployment (per project memory: committing `convex/*.ts` ≠ deployed — run `pnpm --filter @eisenbalm/convex dev:once`).
2. **Wave B — Researcher/publisher `importance` plumbing (FCT-01).** Extend `ClaimOutput`, the researcher's mapped-claims construction, and the publisher's sourced/unsourced row construction. Unit tests on `researcher.py` and `publisher/__init__.py` (extend existing test files, e.g. mirroring `test_claims_extractor.py`/publisher test fixtures).
3. **Wave C — `_reset_touched_claims` (FCT-07).** Extend `content.py::patch_section`/`patch_bonus`. Unit tests extending `test_content_patch_endpoints.py` (verify a same-length edit resets only the touched block's claims; a length-changed edit resets the whole section; ordering test per Pitfall 3).
4. **Wave D — Six-action endpoints + evidence preview/apply (FCT-05/FCT-06).** New `api/factcheck.py`, mounted in `main.py`. Pytest coverage per endpoint (mirrors `test_content_patch_endpoints.py`/an equivalent `test_findings_endpoints.py` if one exists — verify naming).
5. **Wave E — Derived selectors + `WorkspaceStateProvider` extension (FCT-02).** `deriveFactCheckSummary`, `isMustFix`, `deriveTasks` fix, `claimRows` mapping extension. Vitest unit tests on `derivedState.ts` (extend existing suite).
6. **Wave F — Shared provenance card + Stage 3 screen (FCT-03/FCT-04).** `ClaimProvenanceCard.tsx`, `factCheckClient.ts`, the real Stage 3 screen (summary + filters + table + card), delete `FactCheckPlaceholder.tsx`, wire `page.tsx`. Component tests mirroring `FactCheckPlaceholder.test.tsx`'s "never blank" discipline.
7. **Wave G (optional, can be its own follow-on plan) — Refactor Draft (`ClaimMark.tsx`) and Approval (`SourceIndex.tsx`) to consume the shared card.** Explicitly called out as higher-risk (regressing shipped Phase 35 rendering) — recommend sequencing this LAST and validating with the existing galley/claim rendering tests before/after.

This ordering respects dependencies: A blocks everything (schema must exist before any code reads/writes the new fields); B/C/D can run in parallel once A lands (they touch disjoint pipeline files); E depends on B (needs `importance` to exist in Convex) but not on C/D; F depends on E (screen needs the selector) and can start once B lands (needs `importance` present in real data, at least in dev/test fixtures); G is explicitly last and lower-priority/higher-risk.

## State of the Art

| Old Approach (Phase 41 interim) | Current Approach (Phase 42) | When Changed | Impact |
|---|---|---|---|
| `FactCheckPlaceholder.tsx` — read-only coverage ladder, no filters, no actions, no `importance` | Real Stage 3 screen — affirmative summary, 7 filters, provenance card, 6 actions | This phase | Placeholder is deleted; its "never blank" discipline and status-label vocabulary carry forward verbatim into the real screen (explicitly called out in CONTEXT code_context) |
| `deriveTasks` claim severity = `sourceUrl` presence only | `isMustFix` = `importance === 'Load-bearing' && !sourceUrl` | This phase | A previously-"must-fix" unsourced Incidental claim (e.g., an atmospheric date) becomes "review-recommended" — task list volume/composition shifts, should be called out to the user/Andrew as an intentional editorial refinement |
| Three separate claim-rendering surfaces (`ClaimMark` popover, `SourceIndex` list row, none for Fact Check) | One shared `ClaimProvenanceCard` (Fact Check first; Draft/Approval refactored in Wave G) | This phase (Fact Check) / later wave (Draft/Approval) | Consolidates future UI changes to one place; deferred refactor risk is explicitly scoped out of the earliest waves |

**Deprecated/outdated:** `FactCheckPlaceholder.tsx`/`FactCheckPanelContent.tsx`'s "arrives next — Phase 42" banner and interim read-only listing — both retired this phase (the panel-content publisher pattern itself, i.e. `buildFactCheckPanelContent` feeding `WorkspaceStateProvider`'s `panelContent` slot, is NOT deprecated — it should be extended/kept, only its "coming soon" copy and the placeholder component go away).

## Open Questions

1. **Is "Keep as written" a distinct stored `status` value, or `'checked'` + an audit-only distinction?**
   - What we know: `claim_checks.status` is a loose `v.string()` (not a literal union), so adding `'kept'` is schema-free and automatically compatible with `allSignedOff`'s `!== 'pending'` gate.
   - What's unclear: whether the UI needs to visually distinguish "Confirmed" from "Kept as written" claims (e.g., a different chip), which would require the new status value; or whether the mandatory-reason + audit-log entry alone is sufficient distinction (chip stays "✓ Checked" either way, per D-08's 5-value vocabulary which has no separate "Kept" state).
   - Recommendation: default to reusing `status: 'checked'` for Keep-as-written (satisfies D-08's locked chip vocabulary exactly, no schema/UI branching needed) and let the mandatory-reason + `audit_log` row be the entire distinguishing record. Only introduce a new status literal if the plan review surfaces a concrete UI need for a 6th chip state.

2. **Should "Remove claim" hard-delete or soft-delete the row, and how does that interact with a future re-run's `insertBatch`?**
   - What we know: `insertBatch` already does delete-all-then-reinsert per `runId` (fully idempotent re-extraction) — so a hard-deleted claim would simply reappear if the publisher/claims-extraction ever re-ran for the same `runId` (it currently only runs once, at publish time, per `agents/publisher/__init__.py`).
   - What's unclear: whether a future phase might re-run claims extraction on an existing run (e.g., after a large content re-roll) in a way that would resurrect a manually-removed claim, and whether that's desired or a bug.
   - Recommendation: soft-delete (`status: 'removed'` or a `removed: v.optional(v.boolean())` flag) is the safer default — it preserves the audit trail and sidesteps this ambiguity entirely; the `total`/`allSignedOff` semantics should explicitly exclude `removed` rows from the "must not be pending" gate the same way they'd need to for `'checked'`.

3. **Does the `facts-cleared` sign-off gate (`api/signoffs.py`) need an EXPLICIT `mustFixCount === 0` re-check, or is it fully subsumed by the existing `allSignedOff` check?**
   - What we know: A must-fix claim (`importance === 'Load-bearing' && !sourceUrl`) is by definition `status === 'pending'` until acted on (Confirm/Edit/Replace-source/Remove/Keep-as-written all move it off `'pending'`). `allSignedOff` already requires zero `'pending'` rows. So `mustFixCount` mathematically reaches 0 whenever `allSignedOff` is true, given the current (D-05) definition of must-fix as a property of pending rows only.
   - What's unclear: whether a future edge case (e.g., a claim's `changedSinceCheck` marker resets it to `'pending'` AFTER a prior `allSignedOff` check but BEFORE the sign-off endpoint's own re-check runs) creates a race. This is already handled today by `_revoke_active_signoffs` firing on the SAME content-patch call that would trigger `_reset_touched_claims` — so the sign-off itself gets revoked at the same instant the claim reset happens, closing the race.
   - Recommendation: no code change needed to `signoffs.py`; add a regression test asserting `allSignedOff === true` implies `deriveFactCheckSummary(rows).mustFixCount === 0` for the same row set, to catch any future definitional drift between the two.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `TAVILY_API_KEY` | Evidence-preview endpoint's `web_search` call | ✓ (already used by Scout + Researcher in production) | n/a (env var) | — |
| `OPENROUTER_API_KEY` | Evidence-preview endpoint's `acomplete` call | ✓ (already used by every agent, including `voice_pass.py::voice_rewrite`) | n/a (env var) | — |
| `CLERK_JWT_ISSUER_DOMAIN` | All new endpoints' `_require_clerk_jwt_control` guard | ✓ (already required in every deployed environment; dev-mode degrades to a sentinel identity per `control.py:83-105`) | n/a (env var) | Local dev: sentinel `local-dev-operator` identity |
| Convex dev deployment sync | Any new `convex/*.ts` function to be callable | Must be MANUALLY synced after this phase's schema/function changes | n/a | Per project memory: `pnpm --filter @eisenbalm/convex dev:once` — committing the `.ts` file alone does NOT deploy it |

**Missing dependencies with no fallback:** None — all required external services are already configured and in active use elsewhere in the pipeline.

**Missing dependencies with fallback:** None applicable.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework (pipeline) | pytest 8.3.x + pytest-asyncio 0.24.x (`asyncio_mode = "auto"`), `testpaths = ["tests"]` |
| Framework (console) | vitest (config: `apps/dispatch-control/vitest.config.ts`) + `@testing-library/react` for `.test.tsx` (jsdom via `environmentMatchGlobs`), convex-test for Convex-function tests tagged `edge-runtime` |
| Config file (pipeline) | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Config file (console) | `apps/dispatch-control/vitest.config.ts` |
| Quick run command (pipeline) | `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -x -q` (or the new `test_factcheck_endpoints.py`) |
| Quick run command (console) | `pnpm --filter dispatch-control test:unit -- __tests__/<new-file>.test.ts` |
| Full suite command (pipeline) | `cd packages/pipeline && uv run pytest -x -q` (baseline: 90 test files as of this research) |
| Full suite command (console) | `pnpm --filter dispatch-control test:unit` (baseline: 84 test files as of this research) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| FCT-01 | Researcher `ClaimOutput` carries `importance`; publisher merges it onto sourced+unsourced rows | unit (pytest) | `uv run pytest tests/agents/test_researcher.py -x -q` (or wherever existing researcher tests live) + a new publisher-merge test | ❌ Wave 0 — new assertions needed in existing/new test files |
| FCT-02 | `deriveFactCheckSummary` counters, `isMustFix`, corrected `deriveTasks` severity | unit (vitest) | `pnpm --filter dispatch-control test:unit -- __tests__/derivedState.test.ts` | ⚠️ existing `derivedState.test.ts`-style file likely exists (extend it) — verify exact filename during planning |
| FCT-03 | Filter predicates (must fix / unchecked / changed / numbers&dates / people&titles / org / weak source) | unit (vitest) | New `__tests__/factCheckFilters.test.ts` | ❌ Wave 0 |
| FCT-04 | `ClaimProvenanceCard` renders all 9 fields honestly (never blank-as-verified); field-sourcing correctness | component (vitest + testing-library, jsdom) | New `__tests__/ClaimProvenanceCard.test.tsx` | ❌ Wave 0 |
| FCT-05 | Six actions each produce the correct write (Convex-only vs pipeline-boundary), correct audit rows | integration (pytest, mirrors `test_content_patch_endpoints.py`'s monkeypatch style) | New `packages/pipeline/tests/test_factcheck_endpoints.py` | ❌ Wave 0 |
| FCT-06 | Evidence preview returns without mutating; apply is atomic (content patch + claim update + audit) | integration (pytest) | Same new `test_factcheck_endpoints.py` | ❌ Wave 0 |
| FCT-07 | `_reset_touched_claims`: same-length edit resets only touched-block claims; length-changed edit resets whole section; self-reset ordering (Pitfall 3) | unit + integration (pytest, extends `test_content_patch_endpoints.py`) | `uv run pytest tests/test_content_patch_endpoints.py -k reset_touched -x -q` | ❌ Wave 0 (new test cases in an existing file) |

### Sampling Rate
- **Per task commit:** the quick-run command scoped to the file(s) just touched.
- **Per wave merge:** the relevant full suite (pipeline `pytest -x -q` for Waves A-D; console `test:unit` for Waves E-G) plus `pnpm --filter dispatch-control build` (strict build — per project memory, vitest does not type-check; a frontend wave is not "done" until `build` exits 0) and, for any wave touching `convex/*.ts`, a sync to the dev deployment (`pnpm --filter @eisenbalm/convex dev:once`) before considering the wave verified.
- **Phase gate:** both full suites green (pytest + vitest), `pnpm --filter dispatch-control build` clean, `dispatch-control-no-sanity-write.test.ts` still green (no new direct-Sanity-write path introduced by `factCheckClient.ts` or `ClaimProvenanceCard.tsx`), before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/pipeline/tests/test_factcheck_endpoints.py` — covers FCT-05/FCT-06 (new endpoint file has no existing test coverage)
- [ ] New pytest cases in `packages/pipeline/tests/test_content_patch_endpoints.py` (or a sibling file) — covers FCT-07's `_reset_touched_claims`
- [ ] New/extended researcher + publisher pytest cases — covers FCT-01's `importance` plumbing (confirm exact existing test file names for `researcher.py`/`publisher/__init__.py` during planning — this research did not exhaustively enumerate every existing pipeline test file)
- [ ] `apps/dispatch-control/__tests__/derivedState.test.ts` (or equivalent) — extend for `deriveFactCheckSummary`/`isMustFix`/corrected `deriveTasks` (FCT-02)
- [ ] `apps/dispatch-control/__tests__/ClaimProvenanceCard.test.tsx` — new, covers FCT-04
- [ ] `apps/dispatch-control/__tests__/factCheckFilters.test.ts` (or inline in the screen's test file) — covers FCT-03
- [ ] Framework install: none — both pytest and vitest are already fully configured; no new install step

## Sources

### Primary (HIGH confidence — read directly from the current repo tree)
- `.planning/phases/42-fact-check-stage/42-CONTEXT.md` — locked decisions D-01..D-23
- `.planning/REQUIREMENTS.md` (lines 362-368, 813-819) — FCT-01..FCT-07 verbatim + traceability
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §1, §4, §5, §6, §8, §9
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` (Stage 2/3/5, Inspector, State model, Decision & audit sections)
- `docs/design/dispatch-control-v3/README.md` (color semantics, milestone-kickoff decisions)
- `docs/API_CONTRACTS.md` §26.2, §26.6, §31.1-§31.9, §32.1, §35.1-§35.6
- `convex/schema.ts` (`claim_checks` table, ~L431-452), `convex/claimChecks.ts`, `convex/signOffs.ts`, `convex/qaCorrections.ts`, `convex/lib/auth.ts`
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`, `agents/publisher/__init__.py`, `lib/claims.py`, `graph/blocks.py` (`ClaimSpanRef`), `lib/voice.py` (`build_claims_block`)
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py`, `api/control.py`, `api/findings.py`, `api/voice_pass.py`, `api/signoffs.py`, `lib/sanity_client.py`, `lib/span_resolver.py`, `lib/search_client.py`
- `apps/dispatch-control/lib/derivedState.ts`, `lib/findingsClient.ts`, `lib/voicePassClient.ts`, `lib/galley/sectionIdMap.ts`
- `apps/dispatch-control/components/galley/ClaimMark.tsx`, `components/galley/AnnotationMark.tsx`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SourceIndex.tsx`
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/{FactCheckPlaceholder.tsx,FactCheckPanelContent.tsx,page.tsx}`
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx`
- `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts`, `__tests__/FactCheckPlaceholder.test.tsx`
- `packages/pipeline/pyproject.toml`, `apps/dispatch-control/package.json`, `apps/dispatch-control/vitest.config.ts`
- `.planning/STATE.md` (lines 308, 666-747 — Phase 35/41 decision log entries)

### Secondary (MEDIUM confidence)
- None — every claim in this document was verified directly against the repository's current source, not inferred from training data or web search. No Context7/WebSearch/WebFetch calls were needed; this is a 100% in-repo internal-reuse phase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every version cited is read directly from `pyproject.toml`/`package.json`
- Architecture: HIGH — every pattern cited is an existing, shipped, working code path in this exact repo (not a general best-practice inference)
- Pitfalls: HIGH — each pitfall is derived from a specific, cited code interaction already present in the tree (e.g., `allSignedOff`'s literal predicate, `claimSpans`'s documented non-persistence, `blockIndexHint`'s documented non-authoritativeness)

**Research date:** 2026-07-15
**Valid until:** Until the next phase touching `claim_checks`, `content.py`, or `derivedState.ts` lands (this is an internal-reuse phase with no external-API currency concerns; the 30-day default does not really apply — re-verify only if Phase 43/44/45/49 change any of the shared surfaces this phase builds on)

## RESEARCH COMPLETE

**Phase:** 42 - Fact Check Stage
**Confidence:** HIGH

### Key Findings
- FCT-06's "Ask agent for better evidence" two-step contract is architecturally identical to the already-shipped `api/voice_pass.py::voice_rewrite` (generate-only preview) + `api/findings.py::accept_finding` (span-resolve + patch + Convex flip + audit) pair — build the new evidence endpoints as near-verbatim copies of these two files, not from scratch.
- A required correction to already-shipped code was found: `lib/derivedState.ts::deriveTasks` computes claim severity from `sourceUrl` presence alone (no `importance` concept existed when it was written) — this must change to `isMustFix` per locked decision D-05, and `WorkspaceStateProvider.tsx`'s `claimRows` mapping must be extended to carry `importance`/`claimIndex`/`claimId`/`changedSinceCheck`, or My Tasks/stage badges will silently disagree with the new Stage 3 screen.
- `claimSpans` (the writer-time claim-to-phrase binding) is confirmed NEVER persisted to Sanity (§35.3) — all content-patching claim actions (Edit claim, Ask-agent-apply) must resolve the claim's phrase against CURRENT Sanity content via `claim_checks.text` + `lib/span_resolver.py::resolve_span`, exactly like `findings.py` already does for QA findings.
- `claimChecks:allSignedOff`'s gate predicate (`status !== 'pending'`, no allowlist) already transitively enforces "zero must-fix claims block facts-cleared" with zero changes needed to `api/signoffs.py` — but this is contingent on "Remove claim" correctly moving removed rows off `'pending'` (or filtering them out everywhere), which must be handled explicitly.
- Block-index-based "what changed" diffing for FCT-07's `_reset_touched_claims` is unreliable across insert/delete (position drift) — the conservative, honest algorithm is: same-length body → positional text diff finds exact touched blocks; length changed → treat the whole section as touched. Ordering matters: reset-touched-claims must run BEFORE the acting endpoint sets its own claim's terminal status, or the action would immediately undo itself.

### File Created
`/Users/user/Desktop/Eisenbalm/.planning/phases/42-fact-check-stage/42-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Zero new dependencies; all versions read directly from `pyproject.toml`/`package.json` |
| Architecture | HIGH | Every recommended pattern is copied from an existing, working, tested code path in this exact repository |
| Pitfalls | HIGH | Each pitfall traces to a specific, cited existing code behavior (not speculative) |

### Open Questions
1. Whether "Keep as written" needs a distinct stored status value or can reuse `'checked'` + audit-only distinction (recommendation given: reuse `'checked'`).
2. Hard-delete vs soft-delete for "Remove claim", and its interaction with `allSignedOff`/`listByRunId` (recommendation given: soft-delete via a new terminal status or `removed` flag, explicitly excluded from/compatible with the sign-off gate).
3. Whether `api/signoffs.py` needs an explicit `mustFixCount === 0` re-check or is fully subsumed by the existing `allSignedOff` gate (recommendation given: no code change needed, but add a regression test asserting the equivalence).
4. Exact existing pytest file names covering `researcher.py`/`publisher/__init__.py` were not exhaustively enumerated — confirm during planning which existing test files to extend for FCT-01.

### Ready for Planning
Research complete. Planner can now create PLAN.md files. Recommended plan/wave order is provided above (Contract+schema → pipeline importance plumbing → reset-touched-claims → six-action+evidence endpoints → derived selectors → shared card+Stage 3 screen → optional Draft/Approval refactor).
