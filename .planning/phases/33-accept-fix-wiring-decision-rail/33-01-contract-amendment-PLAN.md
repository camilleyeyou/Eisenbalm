---
phase: 33-accept-fix-wiring-decision-rail
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
autonomous: true
requirements: [GLY-03, GLY-04, EDT-04, EDT-06]

must_haves:
  truths:
    - "docs/API_CONTRACTS.md contains a Phase 33 section documenting the findings accept/dismiss/reopen endpoints before any code exists"
    - "The publish/schedule open-error-findings 409 condition is documented"
    - "The qaCorrections resolution fields and claim_checks.checkedAt are documented as additive"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§33 contract for findings endpoints, resolution fields, publish gate, checkedAt"
      contains: "## Phase 33"
  key_links: []
---

<objective>
Amend `docs/API_CONTRACTS.md` with a new Phase 33 section (§33) that defines every interface boundary this phase introduces, BEFORE any endpoint or schema code is written. This is a CLAUDE.md HARD RULE: the contract amendment is the first task of the phase.

Purpose: Establish the frozen contract that the Convex, pipeline, and dashboard plans (33-02..33-05) implement verbatim. No field names, endpoint paths, or 409 reason strings may be invented later — they are all fixed here.
Output: `docs/API_CONTRACTS.md` gains a `## Phase 33 — Accept-Fix Wiring + Decision Rail` section inserted directly after the existing `## Phase 32 — Native Galley Read-Only Span Resolver` block (§32.1) and BEFORE the global `## Error handling rules` appendix.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write §33 contract into docs/API_CONTRACTS.md</name>
  <read_first>
    - docs/API_CONTRACTS.md (lines ~2707-2743: read the existing §32.1 block and the trailing "## Error handling rules" appendix — §33 inserts between them, matching the §31/§32 heading + prose style exactly)
    - .planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md (D-01..D-17 — the locked decisions §33 must encode)
    - .planning/phases/33-accept-fix-wiring-decision-rail/33-RESEARCH.md (§Architecture Patterns 1-5 — the verified endpoint shapes, payload keys, and 409 reasons)
    - convex/qaCorrections.ts (current insert mutation — §33 documents the NEW setResolution mutation alongside it)
    - convex/claimChecks.ts (current setStatus — §33 documents the checkedAt stamp)
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (publish_issue/schedule_issue guard chains — §33 documents the new 409 guard slotted into both)
  </read_first>
  <action>
Insert a new `## Phase 33 — Accept-Fix Wiring + Decision Rail` section into docs/API_CONTRACTS.md immediately after the §32.1 block (which ends with the italic "*All Phase 31 changes are additive...*" note near line 2727) and BEFORE the `## Error handling rules` heading (~line 2731). Document ALL of the following verbatim so downstream plans have zero discretion on shapes:

**§33.1 — `qaCorrections` resolution fields (D-01, additive optional).** New optional fields on the `qaCorrections` table + a NEW `setResolution` mutation (the existing `insert` public GAM-05 exception is UNCHANGED):
- `resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed')))` — absent = open.
- `resolutionReason: v.optional(v.string())` — required-for-dismiss enforced at the ENDPOINT, not the schema.
- `resolvedBy: v.optional(v.string())`, `resolvedAt: v.optional(v.number())`.
- Legacy `accepted: boolean` STAYS and is kept in sync (accept → `accepted: true`; dismiss → `accepted: false` (no-op in practice); reopen → `accepted: false`) for Phase 26 back-compat.
- `setResolution` mutation signature (pipeline lane — MUST call `requirePipelineSecret`, MUST be added to `_PIPELINE_SECRET_GUARDED_PATHS`): args `{ id: v.id('qaCorrections'), resolution: v.optional(union('accepted','dismissed')) /* absent = reopen */, resolutionReason: v.optional(v.string()), resolvedBy: v.optional(v.string()), resolvedAt: v.optional(v.number()), pipelineSecret: v.optional(v.string()) }`. Handler patches the row and sets `accepted = (resolution === 'accepted')`. Passing `resolution: undefined` clears the fields (reopen).
- A tiny public `qaCorrections:byId` query (`args: { id: v.id('qaCorrections') }`) is added so the pipeline can load one finding; reads are public per existing convention.

**§33.2 — `claim_checks.checkedAt` (D-13, additive optional).** New optional field `checkedAt: v.optional(v.number())` on `claim_checks`. Stamped inside `claimChecks:setStatus` with `Date.now()` when status flips to `checked` or `skipped` (NOT when set back to `pending`). Legacy rows without `checkedAt` degrade to an honest "not yet checked" state — never blank. The Phase 26 `ClaimsChecklist.tsx` needs ZERO changes.

**§33.3 — Findings endpoints (D-02, EDT-04).** Three new Clerk-JWT-guarded (`_require_clerk_jwt_control`) POST routes in a NEW `api/findings.py` router:
- `POST /issues/{run_id}/findings/{finding_id}/accept` — body `{ ifRevisionID: string }`. Flow: load finding (404 if missing/wrong run; 409 `{reason:"already_resolved"}` if `resolution` already set) → 409 `{reason:"accept_unavailable"}` if `suggestedFix` or `quotedSpan` absent (D-07) → map QA sectionName→draft key → `get_issue_draft` → server-side span resolution (§33.5) → 409 `{reason:"span_not_resolved", message:"Couldn't locate this text in the current draft. Use Edit inline instead."}` on no-match/ambiguous (D-05) → `patch_issue_field(field_path=f"{section}.body", value=compose_section_body(blocks), if_revision_id=body.ifRevisionID)` which raises 409 `{reason:"revision_mismatch"}` on stale rev (D-06) → `qaCorrections:setResolution` (resolution='accepted', resolvedBy, resolvedAt) → `_emit_audit(action="finding.accepted", before=quotedSpan, after=suggestedFix)`. Returns `{ revisionId: string, findingId: string, resolution: "accepted" }`.
- `POST /issues/{run_id}/findings/{finding_id}/dismiss` — body `{ reason: string }`. Empty/whitespace reason → 422. Flow: load finding (404/409 already_resolved) → `qaCorrections:setResolution` (resolution='dismissed', resolutionReason=reason, resolvedBy, resolvedAt) → `_emit_audit(action="finding.dismissed", after=reason)`. Returns `{ findingId: string, resolution: "dismissed" }`. NO Sanity write.
- `POST /issues/{run_id}/findings/{finding_id}/reopen` — no body. Flow: load finding (404; 409 `{reason:"not_resolved"}` if `resolution` absent) → `qaCorrections:setResolution` (resolution=undefined → clears fields, accepted=false) → `_emit_audit(action="finding.reopened")`. Returns `{ findingId: string, resolution: null }`.

**§33.4 — Publish/schedule open-error-findings gate (D-14, D-11b, GLY-04 server).** `review.py::publish_issue` AND `review.py::schedule_issue` gain a new guard slotted in AFTER the existing claims-signoff gate: read `qaCorrections:byRunId`, compute `open_errors = [f for f in findings if f.severity == "error" and not f.resolution]`, and if non-empty raise 409 `{reason:"open_error_findings", message:"{n} error finding(s) must be accepted or dismissed before publishing.", count:n}`. This is anchor-state-blind (an orphaned error finding still blocks — D-11b). Note explicitly that `schedule_issue` gets the SAME gate (Pitfall 8 — scheduled runs must not bypass via the tick sweep).

**§33.5 — Server-side span resolution (D-05).** A NEW `lib/span_resolver.py` is a 1:1 Python port of `apps/dispatch-control/lib/galley/spanResolver.ts`: three block-by-block stages (exact `str.find`; curly-quote-normalized `‘’→'` `“”→"` length-preserving; whitespace-tolerant `re.escape` with `\s+` collapse over quote-normalized text). Disambiguation: 0 matches → next stage; 1 → winner; 2+ → `blockIndexHint` wins ONLY if it names an actual candidate block, else ambiguous = unresolved. Replacement is `text[:start] + suggestedFix + text[end:]` on the ORIGINAL block text (offsets index original text because normalization is length-preserving). Never guess.

**§33.6 — Editor memo payload key (D-16 correction).** The rail's editor memo reads the `editor-final` `deliberationEvents` row; the payload JSON key is **`notes`** (`{"approved": bool, "notes": str}` per `agents/editor.py`), NOT `editor_final_notes`. Consumers `JSON.parse(payload).notes` with a try/catch and an honest empty state.

**§33.7 — Hook card + verification data sources (D-12, D-13).** Hook card renders the selected pitch: `pitchLog` filtered `selected === true` (a new `pitchLog:selectedByRunId` query on the existing `by_runId_and_selected` index) → `charityName` + `scoutSummary`. Verification summary reads `claimChecks:listByRunId`: "X/Y claims checked" (X = `status !== 'pending'`), "checked Nm ago" from `max(checkedAt)`, never blank.

Close the section with an italic note (mirroring §31/§32 style): "*All Phase 33 changes are additive: `qaCorrections`/`claim_checks` gain only optional fields; the `insert` public exception and all Phase 26/31/32 shapes are unchanged.*"

Do NOT reference PUB-* two-sign-off items — those are Phase 34 (only D-14's error-findings check belongs here).
  </action>
  <verify>
    <automated>grep -q "## Phase 33 — Accept-Fix Wiring + Decision Rail" docs/API_CONTRACTS.md && grep -q "findings/{finding_id}/accept" docs/API_CONTRACTS.md && grep -q "open_error_findings" docs/API_CONTRACTS.md && grep -q "setResolution" docs/API_CONTRACTS.md && grep -q "checkedAt" docs/API_CONTRACTS.md && grep -q "span_not_resolved" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "findings/{finding_id}/\(accept\|dismiss\|reopen\)" docs/API_CONTRACTS.md` returns ≥ 3 (all three endpoints documented)
    - `grep -q "resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed')))" docs/API_CONTRACTS.md` succeeds (exact resolution field shape)
    - `grep -q "requirePipelineSecret" docs/API_CONTRACTS.md` AND `grep -q "_PIPELINE_SECRET_GUARDED_PATHS" docs/API_CONTRACTS.md` succeed (setResolution guard documented)
    - `grep -q "schedule_issue" docs/API_CONTRACTS.md` succeeds within the §33 block (Pitfall 8 gate parity documented)
    - `grep -q "notes" docs/API_CONTRACTS.md` in a context stating the editor-final key is `notes` not `editor_final_notes` (verified by reading the §33.6 line)
    - `grep -q "selectedByRunId" docs/API_CONTRACTS.md` succeeds (hook card query documented)
    - The §33 heading appears AFTER the `## Phase 32` heading and BEFORE `## Error handling rules`: `awk '/## Phase 32/{p32=NR} /## Phase 33/{p33=NR} /## Error handling rules/{eh=NR} END{exit !(p32<p33 && p33<eh)}' docs/API_CONTRACTS.md` exits 0
    - No PUB- two-sign-off endpoint is introduced: `grep -c "Facts cleared\|Sounds human\|signoff pair\|two-sign-off endpoint" docs/API_CONTRACTS.md` unchanged from the pre-edit count (Phase 34 scope, not here)
  </acceptance_criteria>
  <done>docs/API_CONTRACTS.md has a complete §33 section covering findings endpoints, resolution fields, publish/schedule gate, span resolution, editor-memo key, and rail data sources — positioned between §32 and the error-handling appendix, additive-only, no Phase 34 scope.</done>
</task>

</tasks>

<verification>
- `grep "## Phase 33" docs/API_CONTRACTS.md` returns the new heading.
- All endpoint paths, field names, and 409 reason strings referenced by plans 33-02..33-05 exist verbatim in §33.
</verification>

<success_criteria>
- The frozen §33 contract exists and downstream plans can be implemented from it without inventing any shapes.
</success_criteria>

<output>
After completion, create `.planning/phases/33-accept-fix-wiring-decision-rail/33-01-SUMMARY.md`
</output>
