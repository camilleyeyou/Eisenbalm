# Phase 36: Voice Pass De-Slop Screen - Research

**Researched:** 2026-07-08
**Domain:** Internal reuse — QA detection pipeline (Python/LangGraph), Convex data model, FastAPI review endpoints, Next.js galley renderer
**Confidence:** HIGH (all reuse seams verified against actual code, line-by-line; the two structural gaps below are confirmed by direct grep/read, not inference)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Screen surface & scope**
- D-01: Dedicated `/voice-pass/[runId]` route (the `/voice-pass` stub route already exists), reusing the Phase 32 galley renderer components (GallerySection / synthetic PortableText). Distinct from the factual Review Desk galley — Voice Pass is the voice-axis surface, Review Desk stays the factual surface.
- D-02: Same draft prose, rendered galley-style, lit with voice-tell annotations instead of factual QA annotations — VOX-01's "machine-tells lit inline over otherwise clean prose." Reuses the draft-read + span-resolver + annotation-mark stack from Phases 32-35.
- D-03: Prose sections only (same reader-content coverage as the galley); game and podcast are exempt from tell-lighting (no in-iframe span annotation), consistent with Phase 35 D-06.
- D-03b: Entry from the awaiting-you inbox + a Review Desk link. Voice Pass is a peer destination to the Review Desk; the two sign-offs (Facts cleared / Sounds human) are earned on their respective surfaces.

**Detection — two-layer (VOX-04)**
- D-04: Rules layer reads existing findings from `qaCorrections` instantly, axis-filtered to voice axes (sentiment / gravity / irony-signaling / and the new machine-tell axis). These are already computed at pipeline QA time (`agents/qa/rules.py` predicates → `qaCorrections:insert`), so the screen lights them with no round-trip — VOX-04's "deterministic rules render instantly."
- D-05: Extend `agents/qa/rules.py` with a new `axis="machine-tell"` predicate carrying an AI-slop lexicon (e.g. "delve", "tapestry", "testament to", "in the realm of", "it's important to note", "navigate the landscape", tricolon / "not only… but also" / em-dash overuse patterns) — the machine-tell half of VOX-01 that the current Jesse-voice forbidden sets don't cover. Keep the lockstep-sync note (rules.py ↔ lib/voice.py ↔ rubric.md) in mind; the machine-tell lexicon is a Voice-Pass-specific addition, not necessarily mirrored into prompt-assembly forbidden sets (Claude's discretion on whether writers should also avoid them at generation time).
- D-06: Judge layer runs on demand — a "Run deep check" control calls a new endpoint that re-runs the existing `agents/qa/judge.py` against the current (post-edit) draft, writing voice-axis findings. Instant rules first, judge on click — VOX-04 literal.
- D-07: Reuse `qaCorrections` as the single finding store, axis-filtered per screen: Voice Pass shows the voice axes, the Review Desk galley keeps showing the factual axes. No new table. (Confirm the axis taxonomy cleanly partitions voice vs factual; if an axis is ambiguous, planning decides its home — the machine-tell axis is unambiguously Voice Pass.)

**Tell interaction & rewrite (VOX-02)**
- D-08: Suggested rewrite = the judge's `suggestedFix` when present; for rule-only tells with no fix, an on-click LLM rewrite call generates the house-voice suggestion on demand.
- D-09: Reuse the Phase 33 `api/findings.py` accept/dismiss endpoints — Accept rewrite = accept (server-resolved span-replace via Phase 31 content-patch, `ifRevisionID` guard), Write my own = Edit inline (open the section editor), Keep (not a tell) = dismiss with reason "not a tell". Mechanically identical to Phase 33's Accept/Edit/Dismiss; no new voice-specific mutation path.
- D-10: Reuse the AnnotationMark popover for the as-written vs suggested-house-voice comparison (the Phase 32/33 component gains a voice-tell presentation variant), not a separate diff panel.
- D-11: Accepting a rewrite auto-revokes the "Sounds human" sign-off — it's a content mutation, and Phase 34 D-08 already revokes active sign-offs on every content-patch. Andrew re-signs after reviewing. Consistent with the factual side; no special-casing.

**"Sounds human" sign-off (VOX-03)**
- D-12: Prerequisite-gated sign-off (upgrades Phase 34 D-05's interim ungated attestation now that voice IS machine-checkable): "Sounds human" is enabled only when zero open error-severity voice/machine-tell findings remain (resolved or dismissed). Judge warnings (subjective style notes) do NOT block — mirrors Phase 33's error-blocks / warnings-don't pattern. This is the "before it counts as sounds human" in the phase goal.
- D-13: Signed on the Voice Pass screen, writing the same `sign_offs` row `kind='sounds-human'` that DecisionRail reads (Phase 34 D-05 anticipated Voice Pass "becomes where the sign-off is earned"). DecisionRail reflects the same green/red live via Convex; the Phase 34 publish gate contract is unchanged (it already requires both sign-offs).
- D-14: Server-enforced prerequisite — the sign-off endpoint enforces "no open error-severity voice findings for the run" server-side (mirrors facts-cleared's Phase 34 D-01 server check), not merely a disabled button. UI-only gating would be cosmetic.

### Claude's Discretion
- Exact machine-tell lexicon contents + regex shapes; whether writers also avoid them at generation time (lib/voice.py) or only Voice Pass flags them.
- The on-demand judge re-check endpoint shape + the on-click rewrite endpoint shape (contract-first: amend `docs/API_CONTRACTS.md` before code — CLAUDE.md hard rule).
- The exact voice-axis set that routes to Voice Pass vs Review Desk (the axis partition); per-screen tell-count computation.
- AnnotationMark voice-variant layout; Voice Pass route chrome; whether the "Run deep check" and rewrite calls stream or block.
- How the sign-off endpoint names its 409 detail for the "open voice findings" prerequisite.

### Deferred Ideas (OUT OF SCOPE)
- Run Monitor v2 / Signal Desk — Phase 37.
- Writers avoiding machine-tells at generation time (lib/voice.py forbidden-set mirror) — Claude's discretion within this phase or a follow-up; the detection surface is the phase's core.
- A dedicated `voice_findings` table — considered, not chosen (D-07 reuses qaCorrections axis-filtered); revisit only if the axis partition proves leaky.
- Streaming judge/rewrite responses — Claude's discretion; not a phase requirement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOX-01 | Dedicated Voice Pass screen — machine-tells and voice violations lit inline over clean prose, with a per-screen tell count | §Architecture Pattern 1 (axis-filtered Galley reuse) + §Architecture Pattern 4 (route scaffold, mirrors review-desk's `page.tsx` auto-redirect + `[runId]/page.tsx`) + §Pitfall 1 (axis partition is the load-bearing mechanism) |
| VOX-02 | Click a tell → as-written vs suggested-house-voice comparison, Accept rewrite / Write my own / Keep (not a tell), accept mutates via content-patch | §Architecture Pattern 2 (AnnotationMark voice variant) + §Code Example 2 (extend `_AcceptBody` with an optional `suggestedFix` override) + §Don't Hand-Roll (reuse `findings.py` accept/dismiss verbatim) |
| VOX-03 | Voice Pass carries its own "Sounds human" sign-off, distinct from factual clearance (feeds PUB-01) | §Architecture Pattern 3 (clone `signoffs.py`'s facts-cleared prerequisite, axis-scoped) + §Pitfall 2 (double-gating risk with facts-cleared unless narrowed) |
| VOX-04 | Two-layer detection — deterministic rules render instantly, LLM judge runs on demand — reusing existing QA rules + Opus judge, no new detector | §Code Example 1 (on-demand judge/rules re-check endpoint, built from `get_issue_draft` + `run_all_predicates`/`run_llm_judge`) + §Pitfall 3 (axis-collapse bug in the orchestrator that would silently defeat D-05) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Contract-first (HARD rule):** `docs/API_CONTRACTS.md` MUST be amended *before* writing code for: the on-demand judge/rules re-check endpoint, the on-click rewrite endpoint, the new `qaCorrections.axis` literal (`"machine-tell"`), and the sign-off endpoint's new "open voice findings" prerequisite for `kind="sounds-human"`. Model the new section on the existing `§34.3`/`§34.4` style (exact guard order, exact 409 body shapes) — see §Code Example 3.
- **Schema field names are locked without a contract check first** — `schemas/*.ts` and `convex/schema.ts` field names must not change without checking `API_CONTRACTS.md`. This phase only *adds* a new `axis` literal (additive), it does not rename anything.
- **GSD workflow enforcement** — file-changing work happens through `/gsd:execute-phase`, not direct edits.
- **Voice is non-negotiable / Jesse was born AI, brand does not pivot** — directly relevant: the machine-tell lexicon and rubric axis exist to protect this; do not let the on-click rewrite path invent AI self-reference or hedging language when generating "house voice" suggestions.
- **Andrew is single-threaded, no backup reviewer** — the sign-off UX must never silently block with no explanation; every 409 needs a human-readable `message` (matches the existing `signoffs.py`/`findings.py` convention).

## Summary

Phase 36 is close to pure plumbing: every piece VOX-01..04 needs already exists in the codebase from Phases 5, 18, 32-35 — a two-layer QA detector (`agents/qa/rules.py` + `agents/qa/judge.py`), a shared finding store (`qaCorrections`, already carrying `axis`, `resolution`, `blockIndexHint`), a native galley renderer with a span resolver and an `AnnotationMark` popover with Accept/Edit/Dismiss wired to Phase 33's `api/findings.py`, and a two-sign-off table (`sign_offs`) with a `POST /issues/{run_id}/sign-off` endpoint that already branches on `kind` and already renders both "Sign: Facts cleared" / "Sign: Sounds human" buttons in `DecisionRail.tsx` today (the "Sounds human" button is currently UNGATED per Phase 34 D-06, waiting for this phase).

The work is concentrated in three seams, and two of them contain confirmed structural gaps that will silently defeat the phase's own literal requirements if not addressed:

1. **The Convex `axis` field is a CLOSED union** (`gravity | sentiment | irony-signaling | precision | cross-section-consistency | hard-rule`) in both `convex/schema.ts` and `convex/qaCorrections.ts`'s `insert` mutation. `"machine-tell"` is not there. Because pipeline writes go through `convex_mutation_safe`, which **swallows any exception and only logs a warning**, a missing literal does not crash the pipeline — it silently drops the finding. (This exact failure mode already exists today for Phase 18's `"structural-variety"` judge axis, which is a valid Python `Literal` but absent from the Convex union — confirmed nowhere-written, never caught by any test.) D-05's new predicate is dead on arrival unless `"machine-tell"` is added to both Convex validators in the same change.

2. **The orchestrator (`agents/qa/__init__.py::qa()`) collapses every Layer-1 (rules.py) finding's axis to `"hard-rule"` before writing to Convex**, discarding whatever axis the predicate itself set (`gravity`, `sentiment`, `irony-signaling`, `precision`). This directly conflicts with D-04/D-07, which describe Voice Pass filtering on `sentiment`/`gravity`/`irony-signaling`/`machine-tell` as if those axes survive to Convex — today, for the four *existing* Layer-1 predicates, they do not (only Layer-2 judge findings carry the fine-grained axis). The new machine-tell predicate must be exempted from this collapse (or the collapse should be removed entirely, now that Sanity Studio — the stated reason for the collapse — is being retired per PUB-03).

3. **`api/signoffs.py`'s existing `facts-cleared` prerequisite is NOT axis-scoped** — it blocks on *any* open `severity="error"` finding in `qaCorrections`, regardless of axis. Once D-14 adds an analogous voice-axis-scoped check for `sounds-human`, a single open `sentiment`/`gravity`/`machine-tell` error will block **both** sign-offs unless `facts-cleared`'s check is narrowed to exclude voice axes. VOX-03 says the two sign-offs are "distinct" — recommend narrowing `facts-cleared`'s check now (see Pitfall 2) so the two gates partition cleanly rather than double-blocking.

**Primary recommendation:** Add `"machine-tell"` to the Convex `axis` union; stop (or selectively stop, for the new predicate) collapsing Layer-1 axes to `"hard-rule"` in the orchestrator; add a `axisFilter` prop to `Galley`/`Galley`'s finding-grouping step so Review Desk and Voice Pass both narrow to their own axis set from the *same* component; clone `signoffs.py`'s facts-cleared prerequisite pattern for `sounds-human` scoped to voice axes, and narrow facts-cleared's own check to exclude those same axes; build the on-demand judge/rules re-check endpoint from `get_issue_draft` (already used by `findings.py`/`content.py`) rather than anything pipeline-state-shaped; and thread an optional `suggestedFix` override through the *existing* `accept_finding` endpoint (extending `_AcceptBody`) so the on-click rewrite path needs no new mutation, only a new value to pass into the endpoint Phase 33 already built.

## Standard Stack

No new external libraries. This phase is 100% internal reuse — FastAPI, Convex, Next.js/React, `@portabletext/react`, and the OpenRouter client (`acomplete`) are already installed and already used by the exact modules this phase extends.

### Core (existing modules this phase extends)
| Module | Role | Why reuse (not new) |
|--------|------|----------------------|
| `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` | Layer-1 deterministic predicates | D-05 adds one predicate here; `run_all_predicates` already fans out per-section |
| `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` | Layer-2 LLM-as-judge (`run_llm_judge`) | D-06 re-invokes this verbatim against a re-read draft |
| `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` | Orchestrator, `_finding_to_qa_correction`, axis-collapse | Needs a small, targeted edit (Pitfall 3) — not a rewrite |
| `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` | Accept/dismiss/reopen endpoints | D-09 reuses verbatim; VOX-02's Accept rewrite needs one field added to the request body (Code Example 2) |
| `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` | `POST /issues/{run_id}/sign-off`, kind-branching | D-14 adds an `elif kind == "sounds-human"` branch mirroring the existing `facts-cleared` branch |
| `packages/pipeline/src/eisenbalm_pipeline/api/content.py::_resolve_sanity_id`, `lib/sanity_client.py::get_issue_draft` | Draft-read used by every content endpoint | D-06's re-check endpoint reads the draft through this, exactly like `findings.py` does |
| `convex/qaCorrections.ts`, `convex/schema.ts` | `qaCorrections` table + `insert`/`setResolution` mutations | D-07's single-store reuse; needs the `"machine-tell"` literal added |
| `convex/signOffs.ts` | `sign_offs` table + `record`/`activeByRunId` | D-13 — already generic across `kind`, no change needed here |
| `apps/dispatch-control/.../Galley.tsx`, `GallerySection.tsx`, `AnnotationMark.tsx` | Native galley render + popover | D-02/D-10 — needs an axis-filter prop (Galley) and a presentation variant (AnnotationMark) |
| `apps/dispatch-control/lib/galley/spanResolver.ts`, `sectionIdMap.ts`, `findingState.ts` | Span resolution, id-vocabulary bridge, open-finding predicate | Used unmodified — these are pure, section-id-agnostic |
| `apps/dispatch-control/.../DecisionRail.tsx`, `lib/signOffClient.ts` | Sign-off buttons + client | `"Sign: Sounds human"` button already exists and is wired; D-14 will make its server call start 409ing until findings are clear, which the client already surfaces via `actionMessage` |
| `eisenbalm_pipeline.lib.openrouter_client.acomplete` | LLM call wrapper with cost recording | D-06/D-08 both go through this — never a raw OpenRouter/Anthropic client call |

### Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Span anchoring (finding → exact char offsets in a block) | A new regex/fuzzy matcher for Voice Pass | `apps/dispatch-control/lib/galley/spanResolver.ts::resolveSectionFindings` (already 3-stage: exact → quote-normalized → whitespace-tolerant, `blockIndexHint` disambiguation, never guesses) | Purpose-built, tested (Plan 32-03/32-05), and any Voice Pass-specific matcher would duplicate exactly this logic with a new bug surface |
| Accept/Dismiss/Reopen mutation logic | A `voicePassFindings.py` sibling of `findings.py` | `api/findings.py`'s existing three endpoints, unmodified except one optional field | D-09 is explicit: "no new voice-specific mutation path" — the span-replace, revision-guard, and audit-row logic is identical regardless of which axis the finding carries |
| Voice/QA detection | A new "machine-tell scanner" service or separate LLM call pipeline | `agents/qa/rules.py` (extend) + `agents/qa/judge.py` (re-invoke) | VOX-04 is explicit and binding — "reusing the existing QA rules + Opus judge rather than a new detector" |
| Sign-off storage/state machine | A new `voiceSignOffs` table | `sign_offs` table, already `kind`-parameterized (`'facts-cleared' \| 'sounds-human'`), already has `record`/`revokeAll`/`activeByRunId` | The table, the auto-revoke-on-mutation wiring (D-08 in Phase 34), and the DecisionRail display are ALL already generic across kind |
| Draft text extraction for re-check | A new Sanity → plain-text reader | `get_issue_draft` (`lib/sanity_client.py`) + a small helper mirroring `agents/qa/__init__.py::_body_to_text` to flatten `blocks[i].text` per section | `get_issue_draft` already returns `{headline, blocks, lossy}` per long-read section plus raw `game`/`bonus` — this is precisely the shape the QA extractor needs, already used by `findings.py`/`content.py` |

## Architecture Patterns

### Pattern 1: Axis-filtered Galley reuse (the core VOX-01/D-02/D-07 mechanism)

**What:** `Galley.tsx` currently has **no axis filtering at all** — it groups every *open* `qaCorrections` finding (any axis) by galley section id and renders it. For Review Desk and Voice Pass to coexist as two *distinct* surfaces (not two views of the same undifferentiated pile), `Galley` needs an axis whitelist applied before grouping.

**When to use:** Both `review-desk/[runId]/page.tsx` (narrow to factual axes) and the new `voice-pass/[runId]/page.tsx` (narrow to voice axes) mounting the same `Galley` component.

**Example (the one change needed in `Galley.tsx`, minimal and localized):**
```tsx
// Galley.tsx — add a prop, filter before grouping (rest of the file unchanged)
interface GalleyProps {
  runId: string
  draft: DraftResponse
  revisionId: string
  reloadDraft: () => Promise<void> | void
  onEditSection: (sectionId: string, findingId?: string) => void
  showProvenance?: boolean
  /** NEW (Phase 36): only findings whose axis is in this set are lit.
   *  Review Desk passes FACTUAL_AXES; Voice Pass passes VOICE_AXES. */
  includeAxes?: ReadonlySet<string>
}

// inside the component, right after `const openFindings = rawFindings.filter(isOpenFinding)`:
const scopedFindings = includeAxes
  ? openFindings.filter(row => row.axis !== undefined && includeAxes.has(row.axis))
  : openFindings // undefined = no filter (back-compat default; existing Review Desk call site keeps working until updated)
```
Everything downstream (`findingsByGalleyId`, `resolveFor`, `GallerySection`) is untouched — the filter is a single line inserted before the existing grouping loop. `GallerySection`/`AnnotationMark`/`spanResolver.ts` never need to know about axis partitioning at all.

**Per-screen tell count (VOX-01's "per-screen tell count"):** `scopedFindings.length` (or grouped by section) — computed the same way `DecisionRail.tsx` already computes `blockers`/`warnings`/`infos` counts from `openFindings`, just axis-scoped first.

### Pattern 2: AnnotationMark voice-variant labels (D-10)

**What:** `AnnotationMark.tsx` is already fully generic (`findingId`, `severity`, `axis?`, `reason`, `suggestedFix?`, `quotedSpan?`) with an Accept/Edit/Dismiss action row wired to `findingsClient.ts`. D-10 needs different **labels**, not different **mechanics**: "Accept rewrite" (not "Accept fix"), "Write my own" (not "Edit inline"), "Keep (not a tell)" (not "Dismiss").

**When to use:** Voice Pass's `GallerySection`/`AnnotationMark` instances only.

**Example:**
```tsx
// AnnotationMark.tsx — thread an optional label-set prop, default to today's labels
interface AnnotationMarkProps {
  // ...existing props...
  labels?: {
    accept?: string      // default 'Accept fix'
    editInline?: string  // default 'Edit inline'
    dismiss?: string     // default 'Dismiss'
    dismissReasonDefault?: string // e.g. prefill 'Not a tell' for Voice Pass
  }
}
```
The popover's "as-written vs suggested-house-voice comparison" (D-10's comparison framing) is already 90% there: the popover shows `quotedSpan` context (via the underlined span itself, in-place) and `suggestedFix` (labelled "Suggested: …" today) — for Voice Pass, relabel that line "Suggested house voice: …" so the comparison reads as as-written (underlined text) vs suggested (popover line), without building a separate two-column diff UI (D-10 explicitly rejects a separate diff panel).

### Pattern 3: Cloning the facts-cleared prerequisite for sounds-human (D-12/D-14)

**What:** `api/signoffs.py::record_sign_off` already branches on `body.kind`. The `facts-cleared` branch's second guard is the exact template to clone:
```python
# EXISTING (api/signoffs.py, facts-cleared branch) — verified at packages/pipeline/.../api/signoffs.py:98-120
findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
open_errors = [
    f for f in findings
    if f.get("severity") == "error" and not f.get("resolution")
]
if open_errors:
    raise HTTPException(status_code=409, detail={
        "reason": "open_error_findings",
        "message": f"{len(open_errors)} error finding(s) must be accepted or dismissed before clearing facts.",
        "count": len(open_errors),
    })
```
**D-14's clone**, scoped to voice axes (new `elif body.kind == "sounds-human":` branch):
```python
VOICE_AXES = {"gravity", "sentiment", "irony-signaling", "machine-tell"}  # confirm final set at plan time — see Pitfall 1

elif body.kind == "sounds-human":
    findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
    open_voice_errors = [
        f for f in findings
        if f.get("severity") == "error"
        and not f.get("resolution")
        and f.get("axis") in VOICE_AXES
    ]
    if open_voice_errors:
        raise HTTPException(status_code=409, detail={
            "reason": "open_voice_findings",
            "message": f"{len(open_voice_errors)} voice finding(s) must be accepted or dismissed before signing sounds-human.",
            "count": len(open_voice_errors),
        })
```
This is "anchor-blind" exactly like facts-cleared's D-11b comment — an orphaned (unresolvable-span) error finding still has no `resolution` and still blocks; losing the anchor must never silently un-block the gate.

**Also required (Pitfall 2):** narrow the *existing* `facts-cleared` `open_errors` filter to exclude `VOICE_AXES`, so a single open `sentiment` error does not block both sign-offs simultaneously. This is a one-line change to already-shipped Phase 34 code, not merely additive — call this out explicitly in the plan (it touches an existing, tested endpoint).

### Pattern 4: Route scaffold — mirror `review-desk`'s auto-focus pattern (D-01)

**What:** `apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx` today is a flat `PlaceholderScreen` (no `[runId]` segment exists yet). `review-desk/page.tsx` already implements exactly the pattern Voice Pass needs: query `api.runs.listForWorkspace`, filter to `awaiting-review`, auto-`router.replace` into `/review-desk/${runId}` when there's exactly one, render a switcher when there are several, render an empty state otherwise.

**Recommendation:** Replace `voice-pass/page.tsx`'s placeholder body with the identical pattern (redirecting to `/voice-pass/${runId}`), and create `voice-pass/[runId]/page.tsx` + a `_components/` folder mirroring `review-desk/[runId]/_components/` (it can likely import `Galley`, `GallerySection`, `AnnotationMark`, `DecisionRail` directly rather than duplicating them — these live under `review-desk/[runId]/_components/`, a Next.js route-local folder; the plan should decide whether to import cross-route (works fine in Next.js — nothing route-specific about the component internals) or promote the shared components to a route-agnostic `components/galley/` directory. Promoting avoids a `review-desk/[runId]/_components/...` import path reaching into a sibling route's private folder, which is a code-smell even though it works.

## Common Pitfalls

### Pitfall 1: The Convex `axis` union is closed — a missing literal is a SILENT no-op, not a crash
**What goes wrong:** `convex/schema.ts` (line ~85-92) and `convex/qaCorrections.ts`'s `insert` mutation args (line ~31-38) both declare `axis` as `v.optional(v.union(v.literal('gravity'), v.literal('sentiment'), v.literal('irony-signaling'), v.literal('precision'), v.literal('cross-section-consistency'), v.literal('hard-rule')))`. There is no `"machine-tell"` literal today.
**Why it happens:** Pipeline writes go through `convex_mutation_safe` (`lib/convex_client.py:150`), which wraps the call in `try/except Exception` and only `log.warning(...)`s on failure — it never raises. A Convex arg-validation rejection (unknown literal) is caught here and the finding silently vanishes.
**Proof this already happened once:** `judge.py`'s `JudgeFinding.axis` `Literal` includes `"structural-variety"` (added Phase 18 MEL-04), but neither `convex/schema.ts` nor `convex/qaCorrections.ts` includes it. The only test covering this (`packages/pipeline/tests/agents/test_qa_structural_axis.py`) checks the Python `Literal` and `rubric.md` text — it never asserts the Convex schema includes it. This is a live, confirmed, pre-existing gap (out of this phase's scope to fix, but instructive: it is *exactly* the mistake D-05 must not repeat).
**How to avoid:** Add `v.literal('machine-tell')` to BOTH `convex/schema.ts`'s `qaCorrections` table definition AND `convex/qaCorrections.ts`'s `insert` mutation's `axis` union, in the same commit that adds the Python-side predicate. Add a test that writes a `machine-tell`-axis finding through the real `qaCorrections:insert` path (not just a Python unit test on the predicate) so this class of gap cannot regress silently again.
**Warning signs:** A "Run deep check" or pipeline run that logs `qa-correction` events with the expected count but the Voice Pass screen shows zero machine-tell annotations — check pipeline logs for `convex_mutation_safe failed: qaCorrections:insert ... ArgumentValidationError` first, before assuming a rendering bug.

### Pitfall 2: Two sign-off prerequisites will double-block unless axis-scoped on both sides
**What goes wrong:** `api/signoffs.py`'s existing `facts-cleared` open-error check (`packages/pipeline/.../api/signoffs.py:98-120`) scans `qaCorrections:byRunId` for `severity == "error" and not resolution` with **no axis filter at all**. If D-14 adds a new voice-axis-scoped check for `sounds-human` but leaves `facts-cleared`'s check as-is, a single open `sentiment` or `machine-tell` error will block BOTH sign-offs — contradicting VOX-03's "distinct from factual clearance."
**Why it happens:** The check predates the axis partition (Phase 34 shipped before Voice Pass existed) and was written when "any open error" was a reasonable global gate.
**How to avoid:** Narrow `facts-cleared`'s existing filter to exclude the voice-axis set (`VOICE_AXES`) at the same time D-14's `sounds-human` branch is added, so the two checks partition the same `qaCorrections` table into disjoint (or at least non-conflicting) halves. Flag this in the plan explicitly as a modification to already-shipped, tested Phase 34 code — not a pure addition — so the plan's verification step re-runs `test_signoffs_endpoints.py` and checks for a regression in the facts-cleared path.
**Warning signs:** A run where Andrew resolves every factual/precision finding but "Sign: Facts cleared" still 409s — check whether the open finding blocking it is actually a voice-axis one that belongs to Voice Pass.

### Pitfall 3: The QA orchestrator collapses ALL Layer-1 axes to `"hard-rule"` — D-05's new axis will vanish into the same bucket unless exempted
**What goes wrong:** `agents/qa/__init__.py::qa()` (lines ~184-198) takes the raw Layer-1 `QAFinding`s from `run_all_predicates` (which correctly set `axis="gravity"`, `"sentiment"`, `"irony-signaling"`, `"precision"` per-predicate) and **overwrites every one of them to `axis="hard-rule"`** before writing to Convex, with the comment "so Andrew can tell which layer produced each finding when reading qaCorrections in Studio." If the new machine-tell predicate is added to `rules.py` without touching this collapse, its findings will ALSO become `axis="hard-rule"` on write — never `"machine-tell"` — silently defeating D-04/D-07/D-14's axis-based filtering for exactly the new predicate this phase adds.
**Why it happens:** The collapse was a deliberate Phase 5 design choice for Sanity-Studio observability. Studio is being retired as an editing/publish surface per PUB-03 (soak period), which weakens (but doesn't eliminate — Studio may still exist read-only) the original rationale.
**How to avoid — two options, pick one at plan time:**
  1. **Minimal:** in the list comprehension that builds `layer1` in `qa()`, special-case: keep `axis="hard-rule"` for the four existing predicates, but pass through `f.axis` unchanged when it is `"machine-tell"`. Smallest possible diff; existing Layer-1 findings keep their current (collapsed) behavior.
  2. **Cleaner:** stop collapsing entirely — write each Layer-1 finding with its own true axis (`gravity`/`sentiment`/`irony-signaling`/`precision`/`machine-tell`). This makes the axis partition (Pitfall 2, D-07) fully clean, since the one factual leak in the `hard-rule` bucket today (`check_unverified_name`, which sets `axis="precision"` at the predicate level) would then correctly land in the Review Desk / factual axis set instead of being indistinguishable from voice hits inside `"hard-rule"`. Requires updating any test/expectation asserting `axis == "hard-rule"` for Layer-1 rows (searched: no test currently asserts this at the orchestrator/integration level — `test_rules.py` tests the raw predicates before the collapse, so it is unaffected either way).
  Recommend option 2 given the ambiguity D-07 explicitly calls out, but flag as a planning decision since it changes existing shipped behavior.
**Warning signs:** New machine-tell findings appear in `qaCorrections` (ruling out Pitfall 1) but Voice Pass's axis filter shows zero of them — check the row's actual `axis` value in Convex; if it reads `"hard-rule"` instead of `"machine-tell"`, this is the bug.

### Pitfall 4: Duplicate findings on repeated "Run deep check" clicks
**What goes wrong:** `qaCorrections:insert` always creates a NEW row — there is no upsert/dedup key. If the on-demand judge re-check (D-06) is invoked twice against an unchanged draft, it will write the same findings twice, doubling the tell count and confusing "zero open error findings" (D-12) math with stale duplicates.
**Why it happens:** This mutation was designed for a single pipeline-run write pattern (Phase 5), not repeated manual re-invocation.
**How to avoid:** Before inserting new Layer-2 findings from an on-demand re-check, auto-resolve (via the existing `qaCorrections:setResolution` mutation, `resolution: "dismissed"`, `resolutionReason: "superseded by re-check"`) any currently-OPEN voice-axis findings whose `agentId`/origin marks them as judge-authored from a PRIOR re-check (not rule-layer findings, which are stable/idempotent by nature — same predicate, same text, same result every time, so no need to touch them). This needs a way to distinguish "judge output from re-check N" — e.g. tag these rows with a distinguishable `agentId` value (`"qa-recheck"` vs the pipeline's `"qa"`) at insert time so a "supersede prior recheck findings" query can target them precisely.
**Warning signs:** Tell count increases every time "Run deep check" is clicked even though the operator made no edits between clicks.

### Pitfall 5: `check_unverified_name`'s factual finding hides inside whatever axis bucket Voice Pass reads
**What goes wrong:** `rules.py::check_unverified_name` is a **factual** verification backstop (unverified founder/subject name usage) that happens to be a Layer-1 predicate, and today gets collapsed to `axis="hard-rule"` alongside the four genuinely voice-violating predicates. If Voice Pass's axis filter includes `"hard-rule"` wholesale (rather than resolving Pitfall 3 first), an occasional factual precision finding will show up on the Voice Pass screen, not Review Desk.
**Why it happens:** `"hard-rule"` is a layer label, not a semantic axis — it was never designed to be axis-partitioned.
**How to avoid:** Resolve Pitfall 3 (stop the collapse, or at minimum route `check_unverified_name`'s `precision`-axis output to Review Desk specifically) before finalizing the axis-partition table (D-07).
**Warning signs:** A "voice" finding whose `reason` text mentions `founderNameVerified` or `subjectNameVerified` — this is scope leakage from the factual axis, not a real voice tell.

### Pitfall 6: Narrator context is unavailable to an on-demand re-check
**What goes wrong:** `run_llm_judge` accepts an optional `narrator: Narrator | None` to evaluate against a non-Jesse narrator's voice rubric (Phase 16). The `Narrator` TypedDict is resolved from Sanity by the Calibrator agent DURING a live pipeline run and lives only in `DispatchState` — it is not persisted anywhere queryable by `run_id` after the run completes (no `narratorId` field found on `pipelineRuns` or the `weeklyIssue` Sanity schema). An on-demand re-check endpoint built outside the graph therefore cannot resolve the narrator and should call `run_llm_judge(..., narrator=None, ...)`.
**Why it happens:** Narrator resolution was designed as a run-start, in-memory concern (Phase 16 NRR-09/10), not a persisted, independently-queryable record.
**How to avoid:** Accept `narrator=None` for the on-demand path (this is the documented byte-compatible legacy default — NRR-10 — so it is a safe, well-tested fallback, not a hack). Flag as an Open Question if narrator-aware Voice Pass matters for issues with a non-Jesse narrator; low urgency since Jesse is the default narrator for most issues.
**Warning signs:** None functionally (falls back safely) — this is a known limitation to document, not a bug to chase.

### Pitfall 7: Parallel-worktree strand risk (repeated project lesson, Phase 35)
**What goes wrong:** A wave run in isolated worktrees can strand code on per-agent branches, requiring galley/rail reassembly after the fact (this happened in Phase 35).
**How to avoid:** Verify all Voice Pass code (pipeline `axis` literal changes, `signoffs.py` changes, `Galley.tsx` prop changes, new route files) lands on `master` before the next wave — reconcile explicitly, do not assume worktree merges are automatic.

## Code Examples

### Code Example 1: On-demand judge/rules re-check endpoint shape (D-06)

Verified feasible by tracing the exact call chain `findings.py`/`content.py` already use:

```python
# NEW: api/voice_pass.py (or similar — name TBD at plan time; contract-first)
from eisenbalm_pipeline.api.content import _resolve_sanity_id
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft
from eisenbalm_pipeline.agents.qa.rules import run_all_predicates
from eisenbalm_pipeline.agents.qa.judge import run_llm_judge

# Draft -> QA section-shape mirror of agents/qa/__init__.py::_extract_sections,
# but reading get_issue_draft's {headline, blocks, lossy} shape instead of
# DispatchState's Portable-Text-block-list shape (same flattening idea,
# different input container).
def _draft_to_qa_sections(draft: dict) -> dict[str, str]:
    def _rows_to_text(rows: list[dict]) -> str:
        return " ".join(r.get("text", "") for r in rows)
    sections = draft["sections"]
    out = {
        "origin_story": _rows_to_text(sections.get("originStory", {}).get("blocks", [])),
        "problem":      _rows_to_text(sections.get("problemStatement", {}).get("blocks", [])),
        "founder_bio":  _rows_to_text(sections.get("founderBio", {}).get("blocks", [])),
        "case_study":   _rows_to_text(sections.get("caseStudy", {}).get("blocks", [])),
        "game":         (draft.get("game") or {}).get("description", "") or "",
        "bonus": (
            _rows_to_text(draft["bonus"].get("body", []))
            if draft.get("bonusType") == "specAd" else ""
        ),
    }
    return out

@router.post("/issues/{run_id}/voice-recheck")
async def voice_recheck(request: Request, run_id: str, claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(request, run_id, claims)
    draft = await get_issue_draft(sanity_http, sanity_id)
    sections = _draft_to_qa_sections(draft)

    # Layer 1 is already instant/free client-side (D-04 reads existing rows) —
    # this endpoint's job is specifically the Layer-2 on-demand judge call (D-06).
    findings, resolved_model = await run_llm_judge(sections, run_id=run_id, narrator=None, rubric=None)

    for f in findings:
        await _cc.convex_mutation_safe("qaCorrections:insert", {  # or convex_mutation (non-safe) if the endpoint should surface failures as 5xx
            "runId": run_id, "agentId": "qa-recheck", "sectionName": f.section,
            "severity": f.severity, "axis": f.axis, "quotedSpan": f.quotedSpan,
            "reason": f.reason, "suggestedFix": f.suggestedFix, "accepted": False,
        })
    return {"runId": run_id, "findingCount": len(findings)}
```
Note: uses `convex_mutation` (raising) rather than `convex_mutation_safe` (swallowing) is worth considering here specifically — since this is a live, synchronous, operator-triggered call (unlike the fire-and-forget pipeline write), a silent failure here is worse (the operator thinks they got a fresh check when they got nothing, per Pitfall 1's exact failure mode).

### Code Example 2: Threading a rewrite override through the existing accept endpoint (D-08/D-09)

`findings.py::_AcceptBody` currently only carries `ifRevisionID`. Extending it lets VOX-02's "Accept rewrite" reuse `accept_finding` completely unmodified in its core logic:

```python
class _AcceptBody(BaseModel):
    ifRevisionID: str
    suggestedFixOverride: Optional[str] = None  # NEW: on-click rewrite result, when the finding had none

# inside accept_finding, replace:
#   suggested_fix = finding.get("suggestedFix")
# with:
    suggested_fix = body.suggestedFixOverride or finding.get("suggestedFix")
```
This means the on-click rewrite endpoint (also new, contract-first) only needs to *return* rewrite text to the client — the client passes it straight into the existing `POST .../accept` call as `suggestedFixOverride`. No new Convex mutation, no patch-in-two-steps race condition.

### Code Example 3: Contract section shape to add to `docs/API_CONTRACTS.md` (model on §34.3/§34.4)

Follow the exact section-numbering and prose style already established (see `docs/API_CONTRACTS.md:2970-3021` for the §34.3/§34.4 precedent) — guard order, exact 409 `detail` shapes, and "ADD/REMOVE" instructions relative to the current file, so the plan's diff is unambiguous to implement.

## Runtime State Inventory

Not applicable — this is a greenfield-within-existing-system feature phase (new screen + new axis + new endpoints), not a rename/refactor/migration. No stored-data renames, no OS-registered state, no secret renames.

## Open Questions

1. **Should `facts-cleared`'s existing open-error check be narrowed to exclude voice axes (Pitfall 2), or should double-gating be accepted as intentional belt-and-suspenders?**
   - What we know: today it is NOT axis-scoped; VOX-03 says the two sign-offs are "distinct."
   - What's unclear: whether "distinct" was meant as UI/workflow distinction only (each earned on its own screen) or as a semantic guarantee (an open voice error never blocks facts-cleared).
   - Recommendation: narrow it — matches the phase's stated intent most literally, and is a small, explicit, testable change.

2. **Should the axis-collapse-to-`"hard-rule"` behavior be removed entirely (Pitfall 3, option 2), or should only the new machine-tell predicate be exempted (option 1)?**
   - What we know: Studio (the stated reason for the collapse) is being retired as an editing surface (PUB-03); no test currently locks in the collapse behavior at the orchestrator/integration level.
   - What's unclear: whether any other in-flight or planned surface still reads `qaCorrections.axis == "hard-rule"` as a meaningful signal.
   - Recommendation: grep for `'hard-rule'`/`"hard-rule"` reads across `apps/dispatch-control` before deciding (a build-time source-scan is cheap and would settle this without guessing); the search performed during this research found NO frontend reads of `"hard-rule"` as a literal filter value.

3. **Does Voice Pass need narrator-aware judge re-checks (Pitfall 6)?**
   - What we know: `run_llm_judge(narrator=None, ...)` is the safe, tested default.
   - What's unclear: whether any currently-featured issue uses a non-Jesse narrator, making this a live gap rather than a theoretical one.
   - Recommendation: ship with `narrator=None`; revisit only if Andrew reports narrator-specific voice checks misfiring.

4. **Where should `Galley`/`GallerySection`/`AnnotationMark` physically live — stay under `review-desk/[runId]/_components/` (imported cross-route by Voice Pass) or move to a route-agnostic shared location?**
   - What we know: Next.js has no technical objection to importing from a sibling route's `_components/` folder (it's just a TS module path).
   - What's unclear: whether the project's conventions prefer promoting genuinely shared UI out of a single route's private folder.
   - Recommendation: promote to something like `apps/dispatch-control/components/galley/` in this phase, since Voice Pass is the SECOND consumer — a good, low-cost time to fix the "private folder imported by two routes" smell before a third consumer makes it worse.

## Environment Availability

Not applicable — no new external dependencies. FastAPI, Convex, Next.js/Clerk, and the OpenRouter client are all already deployed and exercised by the exact code paths this phase extends.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Pipeline framework | pytest (asyncio_mode="auto"), config at `packages/pipeline/pyproject.toml` |
| Pipeline quick run | `cd packages/pipeline && uv run pytest -x -q` |
| Pipeline full suite | `cd packages/pipeline && uv run pytest -q` (504 tests collected as of this research date — confirmed by direct run) |
| Frontend framework | vitest, config via `apps/dispatch-control/package.json` (`"test": "vitest run"`) |
| Frontend quick run | `cd apps/dispatch-control && npx vitest run <file>` |
| Frontend full suite | `cd apps/dispatch-control && npx vitest run` (391 passed, 2 todo, 46 files as of this research date — confirmed by direct run) |
| Frontend strict build (CLAUDE.md project memory rule) | `pnpm --filter dispatch-control build` — MUST be run before declaring frontend work done; vitest does not type-check |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOX-01 | Voice Pass screen lights voice-axis findings only, with a per-screen tell count | unit (component) | `npx vitest run VoicePassGalley.test.tsx` (or wherever the axis-filter logic lands — mirror `Galley.test.tsx`'s existing patterns) | ❌ Wave 0 |
| VOX-01 | Axis-filter prop on `Galley` correctly narrows findings before grouping | unit | extend `apps/dispatch-control/__tests__/Galley.test.tsx` with an `includeAxes` case | ✅ file exists, extend it |
| VOX-02 | Accept rewrite applies `suggestedFixOverride` when present, falls back to `finding.suggestedFix` otherwise | unit (pipeline) | `cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -k accept -x -q` (confirm exact filename at plan time — findings.py's existing test coverage should have a home file) | Confirm at plan time |
| VOX-02 | Keep (not a tell) / Write my own reuse dismiss/edit-inline unmodified | unit | existing `findingsClient.test.ts`, `ResolvedFindingsList.test.tsx`, `UnresolvedFindingCard.test.tsx` should stay green with no changes needed | ✅ (regression only) |
| VOX-03 | `sounds-human` sign-off 409s with `open_voice_findings` when an open voice error exists; succeeds when none do | unit (pipeline) | `cd packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py -x -q` (extend existing file) | ✅ file exists, extend it |
| VOX-03 | `facts-cleared`'s prerequisite excludes voice axes (Pitfall 2 regression guard) | unit (pipeline) | extend `test_signoffs_endpoints.py` with a case: open voice-axis error present, facts-cleared succeeds anyway | ✅ file exists, extend it |
| VOX-04 | New `machine-tell` predicate fires on lexicon hits, does not false-positive on clean prose | unit (pipeline) | extend `packages/pipeline/tests/agents/qa/test_rules.py` | ✅ file exists, extend it |
| VOX-04 | `machine-tell` axis literal round-trips through the REAL `qaCorrections:insert` mutation (Pitfall 1 regression guard) | integration | a Convex-schema-level test asserting the mutation accepts `axis: "machine-tell"` — NOT a Python-only unit test (per Pitfall 1's exact failure precedent with `structural-variety`) | ❌ Wave 0 — this exact gap already exists for `structural-variety` and has no test today |
| VOX-04 | On-demand judge re-check endpoint reads the current (post-edit) draft and writes voice-axis findings | integration | new pipeline test hitting the new endpoint against a fake Sanity draft (mirror `test_findings_endpoints.py`'s fixture style) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted file run (`pytest <file> -x -q` / `vitest run <file>`)
- **Per wave merge:** full suite both sides (`uv run pytest -q` AND `npx vitest run`), plus `pnpm --filter dispatch-control build`
- **Phase gate:** Full suite green (both languages) + strict build clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] A Convex-mutation-level test asserting `qaCorrections:insert` accepts `axis: "machine-tell"` (and, opportunistically, `"structural-variety"` — closing the pre-existing gap this research surfaced, though that is not itself a phase requirement)
- [ ] `apps/dispatch-control/__tests__/VoicePass*.test.tsx` (or wherever the new route/component tests land) — no existing test file covers the `/voice-pass/[runId]` route since it does not exist yet
- [ ] A pipeline integration test for the new on-demand judge/rules re-check endpoint (fixture-driven fake Sanity draft, mirroring `test_findings_endpoints.py`'s style)

## Sources

### Primary (HIGH confidence — direct code read, this repository)
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` — predicates, `QAFinding`, `run_all_predicates`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` — `run_llm_judge`, `JudgeFinding`, `score_output`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` — orchestrator, axis-collapse (Pitfall 3)
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` — judge rubric, evaluation axes
- `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` — accept/dismiss/reopen
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` — sign-off record endpoint, facts-cleared prerequisite
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — publish/schedule/reject, two-sign-off gate
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py::_resolve_sanity_id` — draft-resolution helper
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py::get_issue_draft` — draft read shape
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py::convex_mutation_safe` — silent-failure behavior (Pitfall 1)
- `packages/pipeline/tests/agents/qa/test_rules.py`, `packages/pipeline/tests/agents/test_qa_structural_axis.py` — confirms the structural-variety gap and test coverage boundaries
- `convex/schema.ts`, `convex/qaCorrections.ts`, `convex/signOffs.ts` — table/mutation definitions, closed axis union (Pitfall 1)
- `apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx` — current stub state
- `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx` — auto-focus redirect pattern to mirror
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` — data wiring, `useQuery` composition
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/{Galley,GallerySection,AnnotationMark,DecisionRail}.tsx`
- `apps/dispatch-control/lib/galley/{spanResolver,sectionIdMap,findingState}.ts`
- `docs/API_CONTRACTS.md` §33, §34 — contract style/precedent for the new §36 section
- `.planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — VOX-01..04
- Direct test runs performed during this research: `cd packages/pipeline && uv run pytest --collect-only -q` (504 tests), `cd apps/dispatch-control && npx vitest run` (391 passed, 2 todo, 46 files)

### Secondary (MEDIUM confidence — WebSearch, cross-referenced across multiple independent sources)
- Machine-tell lexicon candidates for D-05, cross-verified across 9 independent sources (blogs, a cited Max Planck Institute study reference, and a community gist): "delve", "tapestry", "testament (to)", "leverage", "underscore", "realm", "robust", "pivotal", "seamless", "moreover"/"furthermore" as transition overuse, and "It's not X — it's Y" em-dash constructions as the single most commonly identified structural tell. See Sources list below.

## Metadata

**Confidence breakdown:**
- Standard stack / reuse seams: HIGH — every file, function signature, and line number cited was read directly, not inferred from documentation or memory.
- Architecture patterns: HIGH — all four patterns are minimal, localized diffs to real files whose current content was verified.
- Pitfalls: HIGH for #1-5 (confirmed via direct grep/read of the exact code paths, including running the actual test suites to confirm gaps aren't already covered); MEDIUM for #6 (narrator persistence — confirmed absent via targeted grep, but exhaustive search of every possible persistence path was not performed); LOW-risk-but-flagged for #7 (process precedent, not code-verified for this phase specifically).
- Machine-tell lexicon: MEDIUM — WebSearch-sourced, cross-referenced across multiple independent articles agreeing on the same core word list; not verified against a single authoritative academic source directly (the Max Planck Institute study was referenced by secondary sources, not read directly).

**Research date:** 2026-07-08
**Valid until:** Stable for the lifetime of this phase's implementation (internal reuse of code that isn't expected to change out from under this research); the machine-tell lexicon itself may drift as "AI slop" vocabulary evolves — treat the initial list as a v1 baseline Andrew should be able to extend, not a closed set.
