# Phase 45: Agent Revision - Research

**Researched:** 2026-07-15
**Domain:** FastAPI content-revision endpoint generalization (Python) + React/Next.js selection-toolbar UI (dispatch-control) + Convex cost accounting
**Confidence:** HIGH (all findings grounded in direct source inspection of the exact files this phase extends — no unverified training-data claims)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Endpoint — generalize FCT-06, do not fork**
- **D-01:** Extend the **existing** `factcheck.py` preview/apply pair (`/issues/{run_id}/claims/{claim_index}/evidence/preview` + `/evidence/apply`) into a passage-scoped revision endpoint pair. Phase 42 explicitly designed the request/response shape (`ifRevisionID` / source / rewritten text) to be claim-agnostic so Phase 45 extends it. **Do not build a second revision endpoint** (REV-04; §42.4a). Exact home (new passage route in `factcheck.py` vs a sibling `api/revision.py` that shares `_patch_claim_prose`/`_resolve_sanity_id`/`_emit_audit`) is planning-time discretion, bounded by "one shared apply path, not two."
- **D-02:** **Preview = read-only, no mutation, no audit row** (mirrors `voice_pass.py::voice_rewrite` and `evidence/preview` exactly). **Apply = atomic**: re-resolve the passage span against **current** Sanity content via `lib/span_resolver.py::resolve_span` (never `claimSpans`, §35.3), content-patch the prose, run `_reset_touched_claims` FIRST, revoke active sign-offs, then `_emit_audit`. This is the established `content.py` / `_patch_claim_prose` order (42-RESEARCH Pitfall 3).
- **D-03:** `ifRevisionID` mismatch returns **409** exactly like the `content.py` revision guard (§31.4). The apply path stays behind `_require_clerk_jwt_control` and the EDT-05 write boundary — **no direct console→Sanity write** (the `dispatch-control-no-sanity-write.test.ts` tripwire applies to the new route).

**B. Direction chips — parametrized single prompt**
- **D-04:** The seven chips (Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom) are **one parametrized house-voice prompt** with a per-chip directive clause — **not** seven agent definitions and **never a bare "Regenerate"** (REV-02). Mirror `voice_pass.py::voice_rewrite`'s structure: `VOICE_CONSTRAINTS` + a directive, `acomplete` with a structured `response_format`.
- **D-05:** **"Try another approach"** re-runs the same preview endpoint passing the **prior proposal(s) as avoid-context** (a `priorProposals` / `avoid` field on the request) so the agent diverges rather than repeats.
- **D-06:** **"Custom direction…"** passes the operator's free text verbatim as the directive clause.
- **D-07:** **"Match the brief"** uses the **best available brief context today** (Calibrator `style_brief` / issue premise) and is forward-compatible with the Phase 47 Brief entity — it must **degrade gracefully**, never hard-depend on a Brief that does not exist yet. Note the Phase 47 dependency in RESEARCH.
- **D-08:** Agent identity/voice: reuse the house-voice constraints path (like `voice_rewrite`). Whether to tag `agent_id` per the section's originating writer or use a single generic `revision` agent id is planning-time discretion — **default to a single revision agent id with `VOICE_CONSTRAINTS`** for simplicity.

**C. Claim delta — advisory narrative, deterministic enforcement**
- **D-09:** The comparison card's **claim delta (added / removed / altered)** is produced by the revision agent as **structured output** relative to the original passage, rendered as the "What changed" line (DERIVED-STATE-CONTRACT §9's example is the target register: "Claims: 1 altered … No claims added or removed"). This delta is **advisory/explanatory only**.
- **D-10:** The **enforced** state change — claims returning to unchecked + the "changed since check" counter — remains the **deterministic block-level `_reset_touched_claims` hook** (§42.5, D-19/D-20) that already fires on every content patch. Increments **even when the replacement text is itself sourced**. The displayed delta never drives the actual claim reset; the touched-block diff does.
- **D-11:** "Edit before applying" sends the operator-edited text through the **same** apply endpoint. The card's delta is **not** re-computed on manual edit — the deterministic reset at apply is always correct regardless, so a stale advisory delta is acceptable (never silently wrong state).

**D. Per-issue cost guard (REV-05)**
- **D-12:** **Reuse the existing per-run cost cap** (`cost.py::set_run_cap` / `per_run_cap_usd`, config `cost_cap_usd`) as the budget denominator — **do not invent a second budget system**. The header "cost-vs-budget" readout shows the issue's spend against that cap.
- **D-13:** **Revision LLM calls must record cost attributable to the issue's real run** so the guard can read it. **Do not** repeat `evidence/preview`'s throwaway `run_id=f"evidence-preview-{run_id}"` pattern for cost attribution — a prefixed pseudo-run-id means the cost is invisible to a per-issue guard. Record revision-call cost under (or queryable against) the issue's run.
- **D-14:** **Enforcement = hard-block with explanation.** When the projected next revision call would exceed the per-issue allowance, the **preview endpoint returns 409** (mirror `budget.py::would_exceed_monthly_cap`'s predicate shape) and the chip UI renders **disabled-with-explanation** — never a silent failure. Consistent with the milestone's §6 locked-render philosophy.
- **D-15:** The header readout is **net-new** in the workspace `FrameChrome` (`layout.tsx`, next to the existing `{tasks.length} open · ~{workMinutes} min` line); the value is exposed via `WorkspaceStateProvider` from data it already (or newly) subscribes to. Follow the never-blank honesty rule (unknown → refresh affordance, never a stale number).

**E. Toolbar completeness (REV-01)**
- **D-16:** The Draft selection toolbar **offers all six** actions (SC1 "offers"). Wire the four with shipped backing + the new revision verb:
  - **Edit text** → existing `BlockEditor` flow.
  - **Related facts & sources** → shared `ClaimProvenanceCard`.
  - **Inspect how this was made** → Phase 44 `onInspect` (galley already threads the prop).
  - **Ask agent to revise** → this phase's new flow.
- **D-17:** **Compare with previous** and **Restore previous** render as **visible-but-reserved controls with an explanatory `title`** — there is **no shipped content-version endpoint** and building passage version history is out of this phase's scope (Deferred). This follows the exact D-08 precedent the shipped `InspectorFooter` set (reserved actions with titles) and the milestone rule "Locked controls render with an explanation, never hidden." **Fallback if verification demands functional behavior:** back Compare/Restore with the pre-revision passage text captured by THIS phase's apply endpoint (revision lineage only, not general versioning) — planner should escalate rather than silently expand scope.

**F. Entry-point surfaces**
- **D-18:** Wire the revision flow as **one shared, surface-agnostic action** into the **shared galley selection toolbar** (covers Draft/Stage 2 — SC1 — and Voice/Stage 4, since the Annotations demo selects "the founder phrase" in "Draft/Voice") **plus** the **Phase 44 inspector footer** (flip its reserved "Ask agent to revise" button live). The revision flow is **one component + one endpoint** regardless of which surface invokes it.

**G. Contract-first + reuse discipline**
- **D-19:** **Amend `docs/API_CONTRACTS.md` with a new §45 BEFORE writing code** — the passage-scoped request/response shape (span target, direction chip, avoid-context, claim-delta output, cost-guard 409), extending §42.4a. This is the established Ph35/38/39/42 pattern.
- **D-20:** **Reuse, do not rebuild:** `factcheck.py` preview/apply + `_patch_claim_prose`; `content.py` write-boundary helpers (`_resolve_sanity_id`, `_emit_audit`, `_revoke_active_signoffs`, `_reset_touched_claims`, `resolve_span`); `voice_pass.py::voice_rewrite` prompt pattern; `acomplete` + `web_search`; the shared galley, `ClaimProvenanceCard`, `BlockEditor`, `onInspect`; `WorkspaceStateProvider` + `FrameChrome`; `cost.py` + `budget.py`. **Sign-off revocation stays as Phase 34 built it** — voice approval IS revoked on applied revision (our wiring is correct; the prototype's "voiceDone survives" is a known bug — port the sentence, not the wiring).

### Claude's Discretion
- Exact endpoint home (`factcheck.py` passage route vs sibling `api/revision.py` sharing the apply path).
- `agent_id` tagging strategy for revision calls (single revision id vs per-section writer) — default single.
- Precise per-issue revision-cost storage/query mechanism (extend an existing table/query vs a small tally) — bounded by D-13.
- Whether the comparison-card diff view is word-level or block-level highlighting.

### Deferred Ideas (OUT OF SCOPE)
- **General passage/content version history** — a real store of prior passage versions backing fully-functional "Compare with previous" / "Restore previous." This phase renders those two as reserved-with-explanation (D-17). If a future phase wants them live, either build passage versioning or back them with the revision lineage this phase's apply endpoint captures.
- **Phase 47 Brief entity** — full-fidelity "Match the brief" against the editable Brief (premise/peg/central claim/reader effect/known risks/voice intention). This phase degrades "Match the brief" to available brief-like context (D-07).
- **Phase 49 role-gating** — wrapping Apply revision / Confirm evidence replacement with the `🔒 editor only` locked-render. This phase structures the Apply control so Phase 49 can gate it; it does not implement RBAC.
- **General "Restart from this step"** — the inspector footer's other reserved action; needs a generic resume mechanism that does not exist (only Gate-1 resume). Not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REV-01 | Selecting a passage offers Edit text, Ask agent to revise, Compare with previous, Restore previous, Related facts & sources, and Inspect how this was made | §"Requirement-by-requirement" REV-01 below: block-index DOM stamping in `GallerySection.tsx`, new `PassageToolbar` component, reuse of `BlockEditor`/`ClaimProvenanceCard`/`onInspect`, reserved-with-title pattern for Compare/Restore |
| REV-02 | "Ask agent to revise" offers direction chips (never bare "Regenerate") | §REV-02 below: `_DIRECTION_CLAUSES` parametrized prompt map, `voice_rewrite`-style single `acomplete` call, "Match the brief"/"Try another approach" degradation rules |
| REV-03 | A revision returns a comparison card (original / proposed / what changed / claim delta) before anything applies | §REV-03 below: structured-output Pydantic model mirroring `_EvidencePick`, `EvidenceComparisonCard` precedent to clone in `apps/dispatch-control` |
| REV-04 | Apply / Edit before applying / Try another approach / Discard; apply mutates through the existing content-patch write boundary + `audit_log` | §REV-04 below: extracted `_patch_prose_span` helper (generalized from `_patch_claim_prose`), `_emit_audit`/`_revoke_active_signoffs`/`_reset_touched_claims` reuse, `ifRevisionID` 409 |
| REV-05 | Per-issue cost guard, visible against the header's cost-vs-budget | §REV-05 below: the D-13 pseudo-run-id trap and its fix, durable `agent_runs` cost summation (zero new Convex code required), a new `would_exceed_run_cap` predicate in `budget.py`, `FrameChrome` header wiring |
</phase_requirements>

## Summary

Phase 45 is 90% wiring of already-shipped machinery and 10% genuinely new surface. The pipeline side is the most mechanical: `factcheck.py`'s `evidence/preview` + `evidence/apply` pair was **built by Phase 42 specifically to generalize** (§42.4a says so explicitly), and every write-boundary helper it needs (`resolve_span`, `_touched_block_indices`, `_reset_touched_claims`, `_resolve_sanity_id`, `_revoke_active_signoffs`, `_emit_audit`) already lives in `content.py`/`control.py` and is already imported by `factcheck.py`. The one real gap: `_patch_claim_prose` is written against a `claim: dict` (claim_checks row shape) — passage revision has no such row, so the correct move is to **extract a claim-agnostic core** (`_patch_prose_span(section_name, quoted_text, block_index_hint, new_text, ...)`) that both the existing claim path and the new passage path call. This is the literal reading of D-01's "one shared apply path, not two."

The frontend has a real gap that the CONTEXT document undersells: **there is no passage-selection toolbar today.** `Galley.tsx`/`GallerySection.tsx` render annotation marks (QA findings) and claim marks (provenance wash) with popovers, and a per-section "Inspect how this was made" button, but nothing listens for an arbitrary text selection inside a block. Building this is small but real: each rendered block already carries a parseable `_key` (`row-{sectionId}-{blockIndex}`, from `syntheticPortableText.ts`) that the `PortableText` block-type renderers receive as `value._key` — stamping that onto the DOM (`data-block-index`) and adding a `selectionchange`/`mouseup` listener that reads `window.getSelection()` is the concrete, minimal path to a real six-action toolbar. Because `Galley`/`GallerySection` are the SAME component instance used by both `ReviewDeskRunView` (Draft) and `VoicePassRunView` (Voice), wiring the toolbar there gives both surfaces D-18's "one component, one endpoint" for free.

The cost guard (REV-05) is where the CONTEXT document's stated trap is real and worse than it first appears: `lib/cost.py`'s in-memory `_store[run_id]` is **cleared by `end_run()` inside the Publisher node** — i.e., by the time an operator reaches Draft/Fact-Check/Voice review (which happens strictly after the Publisher writes the draft), the original pipeline's cost bookkeeping has ALREADY been evicted from memory. Relying on `_store`/`_run_caps` for a "per-issue" guard is fragile across both the pipeline-completion boundary and any process restart. The durable, already-existing source of truth is the Convex `agent_runs` table (`agentRuns:byRunId`, summed by `costUsd`) — every original pipeline agent already has a row there, and revision calls should get their OWN distinct `agentKey` per call (never reuse an existing pipeline agentKey — that would silently overwrite/corrupt the original agent's historical cost row via the existing upsert-by-`(runId, agentKey)` mutation). Summing `agentRuns:byRunId` rows requires **zero new Convex schema or function** — it is directly queryable today from both the FastAPI backend (`_cc.convex_query`) and the frontend (`useQuery`).

**Primary recommendation:** Extract `_patch_prose_span` from `factcheck.py::_patch_claim_prose` into `content.py` (claim-agnostic core), add ONE new router (`api/revision.py`, mounted like `factcheck.py`/`voice_pass.py`) exposing `POST /issues/{run_id}/revise/preview` + `POST /issues/{run_id}/revise/apply` with `sectionName`/`quotedText`/`blockIndexHint` in the body (passages have no stable ID the way claims/sections do), record every revision LLM call's cost under a freshly-generated distinct `agentKey` (e.g. `revision-{uuid4().hex[:12]}`) via the existing internal `agentRuns:completed` mutation, and gate the preview call with a new `would_exceed_run_cap` predicate in `budget.py` that sums `agentRuns:byRunId` and compares against `load_run_config(http).per_run_cap_usd` (fetched fresh from Convex, not the fragile in-memory `_run_caps`).

## Standard Stack

No new third-party dependency, no new npm package, no new pip package. This phase composes 100% existing, already-installed libraries:

### Core (reused, not new)
| Library | Version | Purpose | Why Standard (here) |
|---------|---------|---------|--------------|
| `langchain-openai` (via `openrouter_client.py::acomplete`) | already pinned | House-voice revision LLM call | Every agent in the pipeline routes through this one call site (D-14/AGT-17) |
| `httpx` (via `convex_client.py`) | already pinned | Convex HTTP API calls (`Authorization: Convex {DEPLOY_KEY}`) | Same client every endpoint in `api/*.py` uses |
| `@portabletext/react` | already pinned | Block rendering in `GallerySection.tsx` | The passage-selection toolbar hooks into this existing render, does not replace it |
| `convex/react` (`useQuery`) | already pinned | Live cost-vs-budget subscription | Same pattern every `WorkspaceStateProvider` subscription uses |
| `pydantic` | already pinned | Structured revision output (delta + proposed text) | Same `response_format` pattern as `_EvidencePick` (factcheck.py) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `agent_runs` cost summation (zero new Convex code) | A dedicated new Convex query/table for "revision spend ledger" | A new table is more explicit but violates D-12's "do not invent a second budget system" in spirit and adds schema surface for no real gain — `agent_runs` already has `by_runId` + `costUsd` |
| A single `revision` OpenRouter `agent_id` (needs one new `MODEL_BY_AGENT` entry) | Reuse `agent_id="qa"` (already in `MODEL_BY_AGENT`, already used by `voice_rewrite`) | Reusing `"qa"` needs zero `llm_config.py` change but mixes "revision" cost bookkeeping under the QA model's sampling params; a new `"revision"` key is one line and keeps intent clear — **recommend the new key**, bounded by D-08's discretion |

**Installation:** none — no `npm install` / `pip install` needed.

**Version verification:** N/A — no version changed by this phase.

## Architecture Patterns

### Recommended file changes (reuse-first)
```
packages/pipeline/src/eisenbalm_pipeline/
├── api/
│   ├── content.py         # EXTEND: extract _patch_prose_span(...) generalized
│   │                       #   core out of factcheck.py's _patch_claim_prose;
│   │                       #   also relocate _claim_section_blocks -> _section_blocks
│   │                       #   (already section-name-generic internally) so both
│   │                       #   factcheck.py and revision.py import ONE implementation
│   ├── factcheck.py       # EDIT: _patch_claim_prose becomes a thin wrapper that
│   │                       #   unpacks the claim dict and calls _patch_prose_span
│   ├── revision.py         # NEW: POST /issues/{run_id}/revise/preview + /apply
│   │                       #   mirrors factcheck.py's evidence/preview+apply pair
│   ├── main.py             # EDIT: mount the new router (one line, like the other 5)
│   └── control.py          # UNCHANGED — _emit_audit/_revoke_active_signoffs/
│                            #   _require_clerk_jwt_control imported as-is
├── lib/
│   ├── budget.py           # EXTEND: would_exceed_run_cap(...) — new function,
│   │                       #   reuses existing trailing_average()
│   ├── cost.py             # NO CHANGE required (record_cost/get_cost_payload
│   │                       #   already sufficient) — see REV-05 pitfalls below
│   │                       #   for why NOT to lean on _store/_run_caps here
│   └── llm_config.py       # OPTIONAL 2-line add: "revision" -> MODEL_BY_AGENT +
│                            #   SAMPLING_BY_AGENT (bounded discretion, D-08)
docs/
└── API_CONTRACTS.md        # EDIT: new §45 (contract-first, D-19) BEFORE code

apps/dispatch-control/
├── lib/
│   ├── revisionClient.ts   # NEW: mirrors factCheckClient.ts's fetch wrapper
│   │                       #   (pipelineBaseUrl, RevisionError, preview/apply fns)
│   └── derivedState.ts     # EXTEND: deriveRunCostUsd(agentRunRows) -> number|undefined
├── components/
│   ├── galley/
│   │   ├── GallerySection.tsx   # EDIT: stamp data-block-index on each rendered
│   │   │                         #   block (value._key already encodes it)
│   │   ├── Galley.tsx            # EDIT: thread a new onRevise?/passage-toolbar
│   │   │                         #   plumbing prop, same optional-prop pattern
│   │   │                         #   as onInspect (Phase 44)
│   │   └── PassageToolbar.tsx    # NEW: the 6-action floating toolbar on selection
│   ├── revision/
│   │   ├── DirectionChips.tsx    # NEW: 7 fixed-copy chips (never "Regenerate")
│   │   └── RevisionComparisonCard.tsx  # NEW: clones FactCheckScreen's
│   │                                    #   EvidenceComparisonCard pattern
│   └── inspector/
│       └── InspectorFooter.tsx   # EDIT: flip "Ask agent to revise" from
│                                   #   RESERVED to LIVE (D-18)
├── app/(dashboard)/issues/[issueNumber]/
│   ├── layout.tsx                 # EDIT: add cost-vs-budget span next to
│   │                               #   "{tasks.length} open · ~{workMinutes} min"
│   └── _components/
│       └── WorkspaceStateProvider.tsx  # EDIT: one new useQuery(agentRuns.byRunId)
│                                         #   (skip-guarded like the existing 8),
│                                         #   feed through deriveRunCostUsd
convex/
└── (no schema or function change required — see REV-05)
```

### Pattern 1: Claim-agnostic prose-patch core (D-01/D-20)
**What:** Extract the span-resolve → patch → reset-touched-claims sequence out of `_patch_claim_prose` into a function that takes `(section_name, quoted_text, block_index_hint, new_text)` instead of a `claim: dict`.
**When to use:** Any endpoint that needs to mutate a passage inside a section's block body — today: claim edit (`PATCH /claims/{i}`), evidence apply, and (this phase) passage revision apply.
**Example:**
```python
# packages/pipeline/src/eisenbalm_pipeline/api/content.py — NEW, extracted
async def _patch_prose_span(
    convex_http: Any,
    sanity_http: Any,
    *,
    sanity_id: str,
    run_id: str,
    section_name: str,
    quoted_text: str,
    block_index_hint: Optional[int],
    new_text: str,
    if_revision_id: str,
) -> str:
    """Shared apply path (§42.4a / §45): span-resolve -> patch -> reset-touched
    FIRST -> caller sets its own terminal state LAST (Pitfall 3 ordering)."""
    draft = await get_issue_draft(sanity_http, sanity_id)
    blocks, field_path = _section_blocks(draft, section_name)  # relocated, was _claim_section_blocks

    match = resolve_span(blocks, quoted_text, block_index_hint)
    if match is None:
        raise HTTPException(409, detail={"reason": "span_not_resolved", "message": "..."})

    before_blocks = [dict(b) for b in blocks]
    text = blocks[match.block_index]["text"]
    blocks[match.block_index] = {
        **blocks[match.block_index],
        "text": text[: match.start] + new_text + text[match.end :],
    }
    new_rev = await patch_issue_field(
        sanity_http, issue_id=sanity_id, field_path=field_path,
        value=compose_section_body(blocks), if_revision_id=if_revision_id,
    )
    touched = _touched_block_indices(before_blocks, blocks)
    await _reset_touched_claims(convex_http, run_id=run_id, section_name=section_name, touched=touched)
    return new_rev

# factcheck.py's _patch_claim_prose becomes a 6-line wrapper:
async def _patch_claim_prose(convex_http, sanity_http, *, sanity_id, run_id, claim, new_text, if_revision_id):
    return await _patch_prose_span(
        convex_http, sanity_http, sanity_id=sanity_id, run_id=run_id,
        section_name=claim.get("sectionName") or "",
        quoted_text=claim.get("text", ""), block_index_hint=claim.get("blockIndexHint"),
        new_text=new_text, if_revision_id=if_revision_id,
    )
```
Source: `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:181-236` (existing `_patch_claim_prose`), `content.py:160-227` (existing `_touched_block_indices`/`_reset_touched_claims`).

### Pattern 2: Two-step preview→apply with a comparison card (D-02, established FCT-06)
**What:** `POST .../revise/preview` (read-only, no mutation, no audit) returns a proposal; the client renders a comparison card; `POST .../revise/apply` (atomic, audited) commits the SAME text the client displayed.
**When to use:** Any agent-assisted content change that a human must review before it lands (voice-rewrite, evidence-replace, and now revision).
**Example (client precedent to clone verbatim in spirit):**
```typescript
// apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx:263-294
function handleAskAgent() { /* calls evidencePreview(runId, claimIndex, token) */ }
function handleConfirmEvidence() { /* obtains FRESH ifRevisionID, calls evidenceApply(...) */ }
```
Source: `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx:114-163,222-294` (`EvidenceComparisonCard` + handlers) — clone this shape into `RevisionComparisonCard.tsx`, not a new pattern.

### Pattern 3: Block-index capture via existing synthetic `_key` (net-new UI mechanism)
**What:** Each rendered block already carries `_key = "row-{sectionId}-{blockIndex}"` (see `syntheticPortableText.ts:143`). `@portabletext/react`'s block-type components receive `value` (the block object, including `_key`) as a prop — stamping `data-block-index` onto the rendered DOM node from that value is all that's needed for a selection handler to recover which block a `window.getSelection()` range falls inside.
**When to use:** The new `PassageToolbar`'s selection-capture logic.
**Example:**
```tsx
// GallerySection.tsx components.block.normal (and h2/h3/blockquote) — add value:
normal: ({ value, children }) => (
  <p className="galley-body" data-block-index={parseBlockIndex(value._key)}>{children}</p>
),
// parseBlockIndex('row-founderBio-2') -> 2  (simple split-on-'-', take last segment, Number())
```
Source: `apps/dispatch-control/lib/galley/syntheticPortableText.ts:141-144,218` (block `_key` construction), `apps/dispatch-control/components/galley/GallerySection.tsx:120-129` (current block renderers, no `value` param used today).

### Anti-Patterns to Avoid
- **Reusing an existing pipeline `agentKey` (e.g. `"qa"`, `"origin_story"`) for the Convex `agentRuns:completed` write on a revision call:** `agentRuns:completed` is an **upsert by `(runId, agentKey)`** (`convex/agentRuns.ts:107-114` patches the existing row) — writing a revision call's cost under an EXISTING pipeline agentKey silently **overwrites that agent's real historical cost/timing/token row**. Every revision call MUST get its own freshly-generated `agentKey` (e.g. `f"revision-{uuid4().hex[:12]}"`).
- **Relying on `lib/cost.py`'s in-memory `_store`/`_run_caps` as the per-issue guard's source of truth:** `_store[run_id]` is popped by `end_run()` inside the Publisher node (`agents/publisher/__init__.py:69`) — BEFORE any human review stage (Draft/Fact-Check/Voice) even begins. By revision time, `_store[run_id]` either doesn't exist or (worse) was silently recreated empty by a stray `record_cost` call, undercounting the true per-issue total. Read the durable Convex `agent_runs` rows instead.
- **A second budget/cap system:** D-12 is explicit — the per-issue guard's denominator is the SAME `per_run_cap_usd` (`pipeline_config`, read via `load_run_config`). Do not add a new `revision_cost_cap_usd` config key.
- **Forking a second revision endpoint pair** instead of extracting the shared core — this is the literal thing D-01 forbids.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding where in a section's text an arbitrary phrase currently sits | A new fuzzy-matcher / regex span search | `lib/span_resolver.py::resolve_span` (3-stage exact → quote-normalized → whitespace-tolerant, already used by claims/findings) | Client and server MUST agree on resolution (the file's own docstring: "a finding the galley renders as anchored must not 409 on accept") — a second matcher would drift from this one over time |
| Detecting which claims a content edit touched | A new claim-diffing heuristic | `content.py::_touched_block_indices` + `_reset_touched_claims` | Already handles the None-on-length-change / over-reset-never-under-reset invariant (§42.5); this is exactly the mechanism REV-04's "logs to audit_log" + REV-03's claim-delta enforcement needs |
| House-voice rewriting with structured output | A new prompt-engineering framework or LangChain chain | `lib/openrouter_client.py::acomplete(response_format=SomePydanticModel)` | Single call site for every agent in the pipeline (D-14/AGT-17); already handles retry-on-schema-miss, cost recording, model-version capture |
| Per-issue spend total | A new ledger table | Sum `costUsd` across `agentRuns:byRunId({runId})` rows (already public, already subscribed in `WorkspaceStateProvider`) | Every pipeline agent already writes a row there; summing needs zero schema change |
| Comparison-card diff UI (strikethrough original / proposed) | A new diff library (e.g. `diff-match-patch`) | Plain strikethrough CSS on the original + plain text on the proposed (exactly what `EvidenceComparisonCard` already does) | The DERIVED-STATE-CONTRACT §9 example is a narrative "what changed" sentence, not a token-level diff — word-level highlighting is explicitly Claude's discretion, not a requirement |

**Key insight:** Every hard part of this phase (span resolution, write-boundary audit, cost recording) was solved by Phases 31-42. The only genuinely new code is: (1) the selection-toolbar UI, (2) the direction-chip prompt parametrization, (3) the cost-guard predicate. Everything else is composition.

## Common Pitfalls

### Pitfall 1: The D-13 pseudo-run-id trap is deeper than it looks
**What goes wrong:** Recording revision cost under the real `run_id` in `lib/cost.py`'s in-memory store looks like it "just works" (same key `acomplete()` already uses) — but `_store[run_id]` was already cleared by `end_run()` in the Publisher node by the time any revision happens.
**Why it happens:** `end_run()` (`lib/cost.py:214`) is called exactly once, from `agents/publisher/__init__.py:69`, at the END of the LangGraph run — i.e., BEFORE Draft/Fact-Check/Voice review stages exist for the operator to act in. `record_cost()`'s `_store.setdefault(run_id, {})` silently recreates an empty dict rather than erroring, so nothing crashes — it just quietly produces a total that only reflects revision spend, never the original pipeline spend.
**How to avoid:** Treat `agentRuns:byRunId({runId})` (Convex, durable) as the ONLY source of truth for "how much has this issue cost so far." Never gate on `get_cost_payload(run_id)["total"]` for the per-issue guard.
**Warning signs:** A revision guard that allows spending up to a FULL fresh `per_run_cap_usd` after the original run already consumed most of it.

### Pitfall 2: `agentRuns:completed` is an upsert, not an append
**What goes wrong:** Calling `agentRuns:completed` with a reused `agentKey` (e.g. `"revision"` for every call, or worse, `"qa"`/`"researcher"`) overwrites the existing row for that `(runId, agentKey)` pair.
**Why it happens:** `convex/agentRuns.ts:107-140` looks up by `(runId, agentKey)` and PATCHES if found — designed for the once-per-run-per-node pipeline shape, not a repeatable action.
**How to avoid:** Generate a distinct `agentKey` per revision call (e.g. `f"revision-{uuid4().hex[:12]}"`). Summing `agentRuns:byRunId` then correctly includes every call, and the original 18 pipeline-agent rows stay untouched.
**Warning signs:** A run's `agent_runs` row for `researcher`/`qa`/etc. shows implausible cost/timing after an operator does several revisions.

### Pitfall 3: Passage revision has no server-side "original text" to source from
**What goes wrong:** The claim-scoped pattern (`evidence/apply`) never sends the original claim text in the request — the server already has it from the loaded `claim_checks` row. A passage has no equivalent stored row.
**Why it happens:** Claims are a first-class Convex entity; arbitrary selected passages are not.
**How to avoid:** The client MUST send `quotedText` (the exact browser-selected text) in BOTH the preview and apply request bodies — this is the one genuine shape divergence from the claim pattern that the planner should NOT "fix" to match evidence/apply's leaner body.
**Warning signs:** An apply endpoint that 404s or 409s because it has nothing to resolve against.

### Pitfall 4: `_reset_touched_claims` reset-first-terminal-status-last ordering (inherited from 42-RESEARCH Pitfall 3)
**What goes wrong:** If a revision touches a block that also contains the OWN claim being discussed (e.g. revising a passage that happens to also be a tracked claim), calling `_reset_touched_claims` AFTER any claim-specific terminal-status write would silently flip that claim back to "pending" even though the endpoint just explicitly resolved it.
**Why it happens:** `_reset_touched_claims` is a blanket block-level reset; it does not know about an endpoint's own more-specific intent.
**How to avoid:** Passage revision has no claim-specific terminal status of its own (unlike claim-edit/evidence-apply), so this ordering concern does not directly apply to `revision.py` — but if the planner later adds any claim-side-effect to passage revision, the reset-first/terminal-last order must be preserved.
**Warning signs:** A claim that was just fixed by a revision immediately shows as unchecked again.

### Pitfall 5: "Match the brief" has nothing but `style_brief.voice`/`visualDirection` to point at today
**What goes wrong:** Assuming `style_brief` carries premise/peg/central-claim/reader-effect fields the way the Phase 47 Brief entity will.
**Why it happens:** `StyleBriefOutput` (`agents/calibrator.py:38-52`) only has `voice: str`, `bonusType`, `visualDirection: str` — no premise/peg/central-claim/reader-effect/known-risks fields exist anywhere in `DispatchState` today.
**How to avoid:** "Match the brief" today should reference `style_brief.get("voice")` / `style_brief.get("visualDirection")` PLUS (best-effort) the winning charity's `missionStatement`/`whyOverlooked`/`focusArea` fields (the closest existing proxy for "premise/peg") as the directive clause's context, explicitly documented as a degraded substitute for Phase 47's real Brief.
**Warning signs:** A chip that silently no-ops or crashes on issues run before Phase 47 ships (i.e., every issue for the foreseeable future).

### Pitfall 6: `_build_chat_model` raises `KeyError` for an unregistered `agent_id`
**What goes wrong:** Calling `acomplete(agent_id="revision", ...)` without first adding `"revision"` to `MODEL_BY_AGENT`/`SAMPLING_BY_AGENT` in `lib/llm_config.py` raises `KeyError` at the first real (non-stub) revision request.
**Why it happens:** `openrouter_client.py::_build_chat_model` (line 77-79) explicitly validates membership.
**How to avoid:** Either (a) add a 2-line `"revision"` entry to `MODEL_BY_AGENT`/`SAMPLING_BY_AGENT` (recommended — keeps intent legible), or (b) reuse `agent_id="qa"` exactly as `voice_rewrite` does (zero `llm_config.py` change, D-08's stated default). Pick one and be consistent — do not mix.
**Warning signs:** 500s in production the first time an operator clicks "Ask agent to revise" against a live (non-stub) deployment.

### Pitfall 7: EDT-05 no-Sanity-write tripwire scope
**What goes wrong:** Assuming the tripwire test needs updating for this phase.
**Why it happens:** `dispatch-control-no-sanity-write.test.ts` recursively scans `apps/dispatch-control/{app,components,lib}` for `@sanity/client`/`createClient(`/etc.
**How to avoid:** No action needed as long as the new `revisionClient.ts` only ever calls the pipeline's `NEXT_PUBLIC_PIPELINE_URL` (exactly like `factCheckClient.ts`) — the test will pass automatically, by construction, with zero edits.
**Warning signs:** None expected; flagging only so the planner doesn't spend a task "updating" a test that needs no change.

## Code Examples

### Direction-chip parametrized prompt (D-04/D-06/D-07)
```python
# packages/pipeline/src/eisenbalm_pipeline/api/revision.py — NEW
from typing import Literal, Optional
from pydantic import BaseModel

DirectionChip = Literal[
    "make_clearer", "make_more_specific", "tighten",
    "match_brief", "reduce_repetition", "try_another_approach", "custom",
]

_DIRECTION_CLAUSES: dict[str, str] = {
    "make_clearer": "Make this clearer — simplify sentence structure without losing precision.",
    "make_more_specific": "Make this more specific — add concrete, honestly-available detail.",
    "tighten": "Tighten this — cut words without losing meaning.",
    "reduce_repetition": "Reduce repetition — vary sentence rhythm and word choice from the surrounding prose.",
    # "match_brief" and "custom" are built dynamically (below) — not static clauses.
}

def _build_directive(direction: DirectionChip, *, custom_direction: Optional[str], brief_context: str) -> str:
    if direction == "custom":
        return (custom_direction or "").strip() or "Revise this passage."
    if direction == "match_brief":
        return f"Align this passage more closely with the story's voice and premise: {brief_context}"
    return _DIRECTION_CLAUSES[direction]

class _RevisionClaimDelta(BaseModel):
    added: list[str] = []
    removed: list[str] = []
    altered: list[str] = []

class _RevisionPick(BaseModel):
    proposedText: str
    whatChanged: str
    claimDelta: _RevisionClaimDelta
```
Source pattern: `packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py:173-197` (`voice_rewrite`'s `VOICE_CONSTRAINTS` + directive + `acomplete` structure); `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:106-113` (`_EvidencePick` structured-output precedent).

### "Try another approach" avoid-context (D-05)
```python
class _RevisePreviewBody(BaseModel):
    sectionName: str
    quotedText: str
    blockIndexHint: Optional[int] = None
    direction: DirectionChip
    customDirection: Optional[str] = None
    priorProposals: list[str] = []   # populated by the client only for try_another_approach

# in the handler, appended to the user message when priorProposals is non-empty:
avoid_block = (
    "\n\nPrevious attempt(s) to avoid repeating:\n" +
    "\n".join(f"- {p}" for p in body.priorProposals)
    if body.priorProposals else ""
)
```

### Per-issue cost guard predicate (D-12/D-13/D-14) — new function in `budget.py`
```python
# packages/pipeline/src/eisenbalm_pipeline/lib/budget.py — EXTEND
_DEFAULT_REVISION_COST_ESTIMATE_USD = 0.05  # conservative flat estimate when no
                                              # prior revision call exists for this run yet

async def would_exceed_run_cap(
    http: Any, *, run_id: str, per_run_cap_usd: float, prior_revision_costs: list[float],
) -> tuple[bool, dict]:
    """Pre-call guard for REV-05 (§45). Mirrors would_exceed_monthly_cap's shape
    exactly, but sums the DURABLE agent_runs rows for this run_id — never the
    in-memory lib.cost._store, which is cleared before revisions can happen
    (Pitfall 1)."""
    if per_run_cap_usd <= 0:
        return False, {"reason": "cap_disabled", "spentUsd": 0.0}
    rows = await _cc.convex_query(http, "agentRuns:byRunId", {"runId": run_id}) or []
    spent_usd = sum(float(r.get("costUsd") or 0.0) for r in rows)
    projected = trailing_average(prior_revision_costs) or _DEFAULT_REVISION_COST_ESTIMATE_USD
    over = (spent_usd + projected) > per_run_cap_usd
    return over, {"spentUsd": spent_usd, "projectedUsd": projected, "capUsd": per_run_cap_usd}
```
Source: `packages/pipeline/src/eisenbalm_pipeline/lib/budget.py:51-98` (`would_exceed_monthly_cap`, `trailing_average` — reused verbatim), `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py:289` (`load_run_config` — the durable cap source; call this fresh in the endpoint rather than reading `_run_caps`).

### Recording a revision call's durable, distinct-agentKey cost (D-13 fix)
```python
import uuid
from eisenbalm_pipeline.lib.openrouter_client import acomplete

pick, usage = await acomplete(
    agent_id="revision",     # or "qa" if not adding a new llm_config.py key (Pitfall 6)
    run_id=run_id,           # the REAL run_id — never a prefixed pseudo-id (D-13)
    messages=messages,
    response_format=_RevisionPick,
)
await _cc.convex_mutation(
    convex_http, "agentRuns:completed",
    {
        "workspace_id": "eisenbalm",
        "runId": run_id,
        "agentKey": f"revision-{uuid.uuid4().hex[:12]}",  # NEVER reuse an existing pipeline agentKey (Pitfall 2)
        "completedAt": int(time.time() * 1000),
        "costUsd": usage["usd"],
        "durationMs": 0,
        "tokensIn": usage["tokens_in"],
        "tokensOut": usage["tokens_out"],
    },
)
```

### Frontend: summing per-issue cost with zero new Convex code (D-15)
```typescript
// apps/dispatch-control/lib/derivedState.ts — EXTEND (new pure function)
export function deriveRunCostUsd(
  agentRunRows: Array<{ costUsd?: number }> | undefined,
): number | undefined {
  if (agentRunRows === undefined) return undefined  // never-blank: loading, not zero
  return agentRunRows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
}

// WorkspaceStateProvider.tsx — ADD one skip-guarded subscription, mirrors the existing 8
const agentRunRows = useQuery(api.agentRuns.byRunId, runId ? { runId } : 'skip')
const runCostUsd = deriveRunCostUsd(agentRunRows)

// layout.tsx FrameChrome — ADD next to "{tasks.length} open · ~{workMinutes} min":
{runCostUsd === undefined ? (
  <span className="font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink-soft)]">
    cost unknown — refresh
  </span>
) : (
  <span className="font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-ink)]">
    ${runCostUsd.toFixed(2)} / ${capUsd.toFixed(2)}
  </span>
)}
```
`capUsd` should come from `pipelineConfig:getAll` (already a public query, `convex/pipelineConfig.ts:61`) parsed for `per_run_cap_usd`, mirroring exactly how `api/control.py:242-251` parses it server-side.

## State of the Art

| Old Approach (Phase 42, claim-scoped) | New Approach (Phase 45, passage-scoped) | When Changed | Impact |
|--------------------------------------|------------------------------------------|---------------|--------|
| `evidence/preview`/`evidence/apply` keyed by `claim_index` in the URL, original text sourced server-side from `claim_checks` | `revise/preview`/`revise/apply` keyed by `sectionName` in the body, original text (`quotedText`) sourced from the client's live browser selection | This phase | The apply body must now carry the original text explicitly — a genuine, deliberate shape divergence, not an oversight |
| Cost of `evidence/preview`'s LLM call recorded under a throwaway `run_id=f"evidence-preview-{run_id}"` (invisible to any per-run/per-issue guard) | Cost recorded under the REAL `run_id` with a distinct per-call `agentKey`, durable in `agent_runs` | This phase (D-13 fix) | The pre-existing `evidence/preview`'s cost-attribution gap is a known, documented, NOT-fixed-by-this-phase issue (out of scope — flagged as an Open Question below, not silently carried forward into the new endpoint) |
| No per-call cost guard on `evidence/preview` (any operator can call it unlimited times) | Passage revision requires a pre-call 409 guard | This phase | New behavior — REV-05 requirement |

**Deprecated/outdated:** None — this phase is purely additive; nothing existing is removed or renamed (mirrors every prior contract-first phase's closing invariant, §42/§44).

## Open Questions

1. **Should `evidence/preview`'s existing cost-attribution gap (D-13's namesake trap) be retroactively fixed as part of this phase?**
   - What we know: `evidence/preview` still uses `run_id=f"evidence-preview-{run_id}"` today (factcheck.py:571) — its cost is genuinely invisible to any per-issue guard, including the one this phase builds.
   - What's unclear: CONTEXT.md frames D-13 as "don't repeat this pattern" for the NEW endpoint, not "go fix the old one."
   - Recommendation: Leave `evidence/preview` unchanged (out of scope per D-01's "generalizes the SAME endpoint" framing being about REQUEST SHAPE, not about retrofitting Phase 42's cost bug) but flag it explicitly in the phase's PR/commit notes so a future phase (or this one, at planner's discretion) can close it in one line by the same distinct-agentKey pattern.

2. **Exact copy for the seven direction-chip labels' internal identifiers.**
   - What we know: the DISPLAYED copy is locked verbatim (REV-02): "Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom".
   - What's unclear: the internal `DirectionChip` literal-string identifiers (`make_clearer` etc.) are not specified anywhere — this RESEARCH document proposes one naming scheme.
   - Recommendation: Lock the identifiers in the §45 API_CONTRACTS.md amendment (D-19) before writing code, exactly as proposed above, so client and server never drift.

3. **Whether "bonus" (specAd only) is in scope for passage revision alongside the 4 long-read sections.**
   - What we know: `_claim_section_blocks` (soon `_section_blocks`) already treats `"bonus"` as a valid `section_name` when `bonusType === "specAd"`, 409ing otherwise — the SAME machinery costlessly covers bonus.
   - What's unclear: the roadmap's Success Criteria only mention "Draft" generically; the Annotations demo path only exercises the founder-bio passage.
   - Recommendation: Include `"bonus"` (specAd variant) in scope since it is a zero-marginal-cost inclusion via the shared `_section_blocks` helper — excluding it would require ADDING a special case, not removing one.

## Environment Availability

No new external dependency is introduced by this phase — every service it touches (OpenRouter, Convex, Sanity, Clerk) is already required and already configured by Phases 5/21/31/36/42.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| OpenRouter API (`OPENROUTER_API_KEY`) | Revision LLM call | ✓ (already required by every agent) | n/a | Stub mode (`EISENBALM_STUB_MODE=true`) already exists for tests |
| Convex deployment + `CONVEX_DEPLOY_KEY` | `agentRuns:byRunId`/`agentRuns:completed`, cost readout | ✓ (already required by every endpoint in `api/*.py`) | n/a | none needed |
| Sanity API + `SANITY_API_TOKEN` | Passage content-patch | ✓ (already required by `content.py`/`factcheck.py`) | n/a | none needed |
| Clerk (`CLERK_JWT_ISSUER_DOMAIN`) | `_require_clerk_jwt_control` | ✓ (already required; dev-mode degrades to a sentinel actor when unset) | n/a | dev-mode sentinel already implemented |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all already-shipped.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Pipeline framework | pytest (asyncio_mode="auto"), `packages/pipeline/pyproject.toml` |
| Pipeline quick run | `cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py -x` |
| Pipeline full suite | `cd packages/pipeline && python -m pytest` |
| Console framework | Vitest, `apps/dispatch-control/package.json` (`"test": "vitest run"`) |
| Console quick run | `cd apps/dispatch-control && npx vitest run __tests__/RevisionComparisonCard.test.tsx` |
| Console full suite | `cd apps/dispatch-control && npm run test` (aliases `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | Passage selection surfaces all 6 actions; Compare/Restore reserved-with-title | component | `npx vitest run __tests__/PassageToolbar.test.tsx` | ❌ Wave 0 |
| REV-01 | `data-block-index` correctly stamped per block, selection resolves to the right block | unit (pure fn) | `npx vitest run __tests__/blockIndexFromKey.test.ts` | ❌ Wave 0 |
| REV-02 | Direction chips render fixed copy, never "Regenerate"; disabled-with-title when cost-capped | component | `npx vitest run __tests__/DirectionChips.test.tsx` | ❌ Wave 0 |
| REV-02 | `_build_directive` produces the correct clause per chip incl. custom/match_brief degradation | unit (pytest) | `python -m pytest tests/test_revision_endpoints.py -k directive -x` | ❌ Wave 0 |
| REV-03 | `revise/preview` returns proposedText/whatChanged/claimDelta, NO mutation, NO audit row | integration (pytest, monkeypatched Convex/Sanity like `test_factcheck_endpoints.py`) | `python -m pytest tests/test_revision_endpoints.py -k preview -x` | ❌ Wave 0 |
| REV-04 | `revise/apply` patches Sanity, resets touched claims FIRST, revokes sign-offs, emits exactly one audit row, 409s on stale `ifRevisionID` and on unresolved span | integration (pytest) | `python -m pytest tests/test_revision_endpoints.py -k apply -x` | ❌ Wave 0 |
| REV-04 | EDT-05 boundary: zero direct Sanity-client imports/patterns in `apps/dispatch-control` | source-scan tripwire | `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` | ✅ (existing, passes with zero edits) |
| REV-05 | `would_exceed_run_cap` sums durable `agent_runs` rows (not in-memory `_store`) and 409s correctly at/over cap | unit (pytest) | `python -m pytest tests/test_budget.py -k run_cap -x` | ❌ Wave 0 (extend existing `test_budget.py` if present, else create) |
| REV-05 | Revision cost recorded under the REAL run_id with a distinct `agentKey` (never overwrites an existing pipeline agent's row) | integration (pytest) | `python -m pytest tests/test_revision_endpoints.py -k cost_attribution -x` | ❌ Wave 0 |
| REV-05 | Header cost-vs-budget readout: never-blank (loading -> refresh affordance, not stale/zero) | component | `npx vitest run __tests__/FrameChromeCostReadout.test.tsx` | ❌ Wave 0 |
| — (demo leg) | Full Annotations header path: select founder phrase -> Ask agent to revise -> apply -> Voice Pass returns to "Review needed" | manual-only (documented in phase VERIFICATION.md as the load-bearing human check) | n/a — browser walkthrough | manual |

### Sampling Rate
- **Per task commit:** the relevant single test file (`pytest tests/test_revision_endpoints.py -x` or the matching `vitest run __tests__/<Component>.test.tsx`).
- **Per wave merge:** full pipeline pytest (`python -m pytest`, mirrors the ~230-test baseline every prior phase reports) + full console vitest (`npm run test`, mirrors the existing per-phase count reported in `PROJECT.md`).
- **Phase gate:** Full suite green before `/gsd:verify-work`; the EDT-05 tripwire and every prior phase's tripwires (theme-aa-tones, game-sandbox, no-model-names, apps-web-no-clerk, etc.) must remain green with zero regressions — this is the established pattern every phase in `PROJECT.md`'s Validated log reports.

### Wave 0 Gaps
- [ ] `tests/test_revision_endpoints.py` — new pytest file, mirrors `tests/test_factcheck_endpoints.py`'s structure (monkeypatched `_cc.convex_query`/`convex_mutation`, `_sc._groq`, `patch_issue_field`) — covers REV-03/REV-04/REV-05's cost-attribution behavior.
- [ ] `tests/test_budget.py` — extend if it exists (verify presence before Wave 0; `would_exceed_monthly_cap` likely already has a test file to extend, given Phase 25 RUN-06 shipped it) — covers REV-05's guard predicate.
- [ ] `apps/dispatch-control/__tests__/PassageToolbar.test.tsx`, `DirectionChips.test.tsx`, `RevisionComparisonCard.test.tsx`, `FrameChromeCostReadout.test.tsx` — new Vitest files, mirror `FactCheckScreen.test.tsx`'s render/interaction-testing conventions — cover REV-01/REV-02/REV-03/REV-05.
- [ ] `apps/dispatch-control/lib/blockIndexFromKey.ts` (+ its test) — new pure helper + test, extracted so it's independently testable outside the DOM-selection integration.
- Framework install: none — pytest and vitest are already configured; no new install step.

## Project Constraints (from CLAUDE.md)

- **Stack is locked** — Next.js 14+/Vercel, Sanity v3, FastAPI/Railway, LangGraph, OpenRouter, Supabase, Convex, Stripe, WeasyPrint/Playwright — "do not substitute." This phase introduces no new stack element, consistent with the lock.
- **Monorepo boundaries** — `apps/dispatch-control`, `packages/pipeline` — this phase's files all land inside the existing structure; no new workspace package needed.
- **Security: game agent HTML/JS sandbox + theme CSS-variable validation** — not touched by this phase (no game/theme code paths involved).
- **GSD Workflow Enforcement** — "Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it." The planner must route all Phase 45 implementation through `/gsd:execute-phase`, not ad-hoc edits.
- **Write boundary (from PROJECT.md, elevated to project-level fact)** — "every console content mutation goes dashboard → pipeline API → Sanity, logged to `audit_log`. The new revision endpoints must respect it (an EDT-05 source-scan test proves zero direct Sanity writes)." Directly binding on this phase's `revision.py` + `revisionClient.ts`.
- **DO NOT REBUILD the design system, the publish gate, or the eval commit gate** — none of these are touched by Phase 45; noted only for completeness since PROJECT.md's reconciliation facts apply milestone-wide.

## Sources

### Primary (HIGH confidence — direct source inspection)
- `docs/API_CONTRACTS.md` §31 (content-patch write boundary), §35 (provenance/claimSpans), §42.1-§42.7 (Fact Check + the FCT-06 contract this phase generalizes), §44 (Inspect how this was made, footer reserved actions) — read in full.
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` (all 10 sections) and `Dispatch Control v3 - Annotations.md` (all sections) and `README.md` — read in full.
- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` (full file, 691 lines) — the endpoint this phase generalizes.
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` (full file, 889 lines) — the write-boundary helpers.
- `packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`, `api/control.py` (relevant sections) — `voice_rewrite` pattern, `_emit_audit`/`_revoke_active_signoffs`/`_require_clerk_jwt_control`.
- `packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py`, `cost.py`, `budget.py`, `openrouter_client.py` (full files) — span resolution, cost/budget mechanics, LLM call site.
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py:69`, `agents/calibrator.py`, `lib/llm_config.py`, `lib/agent_wrapper.py` — `end_run()` call site, `StyleBrief` fields, `MODEL_BY_AGENT` registry.
- `convex/agentRuns.ts`, `convex/runs.ts`, `convex/schema.ts` (grepped) — `agent_runs` upsert semantics, `runs.cost` field, `pipeline_config`.
- `apps/dispatch-control/components/galley/{Galley,GallerySection}.tsx`, `components/provenance/ClaimProvenanceCard.tsx`, `components/inspector/InspectorFooter.tsx`, `app/(dashboard)/issues/[issueNumber]/layout.tsx`, `app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx`, `app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx`, `lib/factCheckClient.ts`, `lib/galley/syntheticPortableText.ts` — all read in full or in relevant part.
- `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` — the EDT-05 tripwire, read in full.
- `.planning/phases/45-agent-revision/45-CONTEXT.md`, `.planning/REQUIREMENTS.md` (REV-01..05), `.planning/PROJECT.md` (v4.0 locked decisions + reconciliation facts), `.planning/config.json` (nyquist_validation confirmed true).

### Secondary (MEDIUM confidence)
- None used — every load-bearing claim above traces to a directly-read file in this repository (no WebSearch/Context7 was needed; this is a codebase-internal generalization phase, not a third-party library integration).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every reused call site was read directly.
- Architecture: HIGH — the extraction/generalization design is derived from reading the exact function it generalizes, not inferred.
- Cost guard (REV-05): HIGH on the diagnosis (the `end_run()`/`_store` clearing sequence is directly confirmed in code), MEDIUM-HIGH on the specific recommended fix (durable `agent_runs` summation) since this is a novel-to-this-phase design choice, not a copy of an existing pattern — flagged as Claude's discretion in CONTEXT.md, and the RESEARCH recommendation is the most conservative, lowest-new-surface option found.
- Pitfalls: HIGH — every pitfall traces to a specific line/file read during this research pass.

**Research date:** 2026-07-15
**Valid until:** 30 days (stable internal codebase; re-verify if Phase 46/47/49 land first and change `style_brief`, `agent_runs` schema, or the galley component tree before Phase 45 executes)

## RESEARCH COMPLETE
