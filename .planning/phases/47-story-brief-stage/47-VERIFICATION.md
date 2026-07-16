---
phase: 47-story-brief-stage
verified: 2026-07-16T13:10:55Z
status: passed
score: 6/6 must-haves verified
---

# Phase 47: Story & Brief Stage Verification Report

**Phase Goal:** Stage 1 is REPLACED, not built from nothing: the provisional Signal Desk that Phase 41 mounted as Stage 1 is swapped out for the full v3 design, built on the leads and verification records Phase 46 now produces — organization options, "Needs your decision" adjudication when agents can't confidently choose, and an editable Brief the writers draft from.

**Verified:** 2026-07-16T13:10:55Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria 1–6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stage 1 shows story leads as cards with peg + source, reader energy, angle, category, confidence, and brand-risk warning shown IN FULL — never truncated or tooltip-hidden | VERIFIED | `LeadCard.tsx` renders `premise`, `datedPeg` + a real `<a href={pegSourceUrl}>` source link, `readerEnergy`, `charitableAngle`, `category`, `confidence`, and (when `brandRiskFlag`) `brandRiskReason` in full. No `line-clamp`/`truncate` class or `title=` attribute anywhere in the file. `LeadCard.test.tsx` asserts the never-truncated tripwire (`textContent === longWarning`, `className` not matching `/line-clamp\|truncate/`) and passes. |
| 2 | Operator can Require a lead, or Remove it with a mandatory logged reason | VERIFIED | `LeadActions.tsx` — "Require this lead" calls `requireLead(runId, leadId, token)`; Remove's submit button is disabled while `reason.trim().length === 0`; submitting calls `removeLead(runId, leadId, reason, token)`. Backend `api/leads.py::remove_lead` returns 422 when `reason` is empty and calls `_emit_audit(reason=, run_id=)` (Decision-log-visible) when present; `require_lead` stays out of the Decision log by design (no `reason=` kwarg). Both endpoints call the guarded `storyLeads:setStatus` Convex mutation, never a bare dashboard mutation. |
| 3 | Organization options are grouped under the chosen lead, each showing mechanism, verification record with dates, agent case, confidence, prior-coverage warning, and its main concern always visible | VERIFIED | `OrgOptionSlate.tsx` groups all surviving org options under `selectActiveLead()` (required > recommended > first — the documented one-active-lead-per-run simplification). Each option renders `scoutSummary` (mechanism), a `formatCheckedAt`-dated verification block, `advocateArgument` (agent case), `advocateScore` (confidence), a prior-coverage warning branch, and a never-truncated `primaryConcern` ("Main concern") block reusing the exact `CandidateSlate.tsx` discipline. `OrgOptions.test.tsx` asserts the tripwire and verification-with-dates rendering; passes. |
| 4 | "Needs your decision" state with top two options side by side; choice requires a rationale and resumes via the existing interrupt/resume endpoint | VERIFIED | `NeedsYourDecisionCard.tsx` renders only while `isPausedAtGate1` (mirrored in `StoryBriefScreen.tsx` and `deriveStoryStage`); shows the top two candidates (by `advocateScore`) side by side with four comparison rows (what each makes possible / evidence quality / risk / burden); the visible heading is literally "Needs your decision" (grep confirms `requiresHumanInput` never appears in rendered text); "Choose this story" is disabled until a rationale is entered and calls the UNCHANGED `adjudicateGate1(runId, { selection: { charityName }, reason }, token)`. No second resume/interrupt path introduced. |
| 5 | An editable Brief (premise, current peg, central claim, reader effect, known risks, voice intention) is generated after selection, and the section writers draft from it | VERIFIED (documented reading) | `editor.py::_assemble_brief` deterministically builds the six-field `Brief` immediately after `winning_charity` resolves, on the unified auto-select/human-resume return path (`agents/editor.py:620-636`) AND the D-14 degraded all-candidates-killed recovery path (`:453-473`) — zero new graph node, zero new LLM call (`interrupt(` count unchanged at 10; no `acomplete` inside `_assemble_brief`). Persisted via `briefs:insert` (upsert-safe) and returned as `state['brief']`. `voice.py::build_section_writer_prompt` gained a 5th `brief` param rendering all six fields into the USER message only; all 7 section writers (`origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus`, `design`) reference `state.get("brief")` (grep count = 7). `BriefFieldTable.tsx` renders the Brief as an editable six-field table, saving via the guarded `PATCH /issues/{runId}/brief` boundary. **Honest nuance (assessed per instructions):** the graph has zero pause points between `editor_gate_1` and the 7 writers (`chronicler→researcher→verify_research→writers` in one `ainvoke()`), so operator edits to the Brief inform later revision passes/Phase 48, not the FIRST draft. This is the explicitly documented, accepted design (D-11 "prefer minimal machinery"; stated plainly in `API_CONTRACTS.md` §47.3 and in REQUIREMENTS.md's own phrasing "generated after selection, and the section writers draft from it" — which the auto-generated Brief satisfies literally). Under this documented reading, BRF-05 is satisfied. |
| 6 | Operator can ask an agent to strengthen any single field of the Brief | VERIFIED | `BriefFieldStrengthen.tsx` — "Ask an agent to strengthen" → `strengthenBriefFieldPreview` (read-only, no mutation, no audit) → `RevisionComparisonCard` (Apply/Edit/Try another/Discard) → `strengthenBriefFieldApply` (writes via `briefs:patch` + `_emit_audit(reason=, run_id=)`, Decision-log-visible). Backend `api/brief.py` budget-guards the preview (409 on cap-exceeded) before the LLM call and validates `field` against the six-key enum (422 on unknown). Component mirrors `RevisionFlow`'s state-machine shape and reuses `RevisionComparisonCard` directly rather than importing `RevisionFlow` itself (documented, justified deviation — `RevisionFlow` is hardcoded to the Sanity passage-revision client and would call the wrong endpoints). |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/.../story-brief/_components/StoryBriefScreen.tsx` | Stage-1 composition shell | VERIFIED | 277 lines; composes Leads→OrgOptionSlate→NeedsYourDecisionCard (conditional)→BriefFieldTable+BriefFieldStrengthen in the design order; Empty/Loading/Error states present. |
| `.../LeadCard.tsx` | BRF-01 never-truncated card | VERIFIED | 132 lines; all fields rendered in full, no clamp/truncate/title. |
| `.../LeadActions.tsx` | BRF-02 Require/Remove | VERIFIED | 118 lines; reason-gated Remove, guarded clients. |
| `.../OrgOptionSlate.tsx` | BRF-03 grouped org options | VERIFIED | 250 lines; verification dates, never-truncated main concern. |
| `.../NeedsYourDecisionCard.tsx` | BRF-04 two-option adjudication | VERIFIED | 246 lines; "Needs your decision" label, adjudicateGate1 resume. |
| `.../BriefFieldTable.tsx` | BRF-05 editable six-field table | VERIFIED | 154 lines; six fields, patchBrief on save, honest loading/not-yet-generated states. |
| `.../BriefFieldStrengthen.tsx` | BRF-06 field-scoped strengthen | VERIFIED | 166 lines; preview/apply via briefClient.ts, RevisionComparisonCard reuse. |
| `.../issues/[issueNumber]/story/page.tsx` | Mounts StoryBriefScreen | VERIFIED | 38 lines; renders `<StoryBriefScreen issueNumber runId />`, no SignalDeskScreen reference. |
| `.../issues/[issueNumber]/story/StoryPanelContent.tsx` | DELETED | VERIFIED | `test ! -f` confirms absence; no remaining reference to `StoryPanelContent`/`buildStoryPanelContent`/`StoryPanelPublisher` anywhere in `apps/dispatch-control`. |
| `packages/pipeline/.../agents/editor.py` | `_assemble_brief` + `briefs:insert`, no new node/LLM | VERIFIED | Helper at line 249; called + persisted at both winner-resolution paths (lines 457/620) plus the D-14 recovery path; `interrupt(` count = 10 (Gate-1 pause only); no `acomplete` in helper. |
| `packages/pipeline/.../lib/voice.py` | 5th `brief` param, all 7 writers threaded | VERIFIED | `build_brief_block()` + 5th param on `build_section_writer_prompt`; grep confirms `state.get("brief")` present in all 7 writer modules. |
| `packages/pipeline/.../api/leads.py` | Require/Remove endpoints | VERIFIED | 170 lines; 422 on empty reason, guarded Clerk boundary, audit trail. |
| `packages/pipeline/.../api/brief.py` | PATCH + strengthen preview/apply | VERIFIED | 287 lines; field validation, budget guard, audit-free preview, audited apply. |
| `packages/pipeline/.../api/revision.py::_fetch_brief_context` | Reads `briefs:byRunId`, legacy fallback | VERIFIED | Lines 149-207; prefers live Brief, degrades to Sanity proxy, never crashes. |
| `docs/API_CONTRACTS.md` §7 + §47 | Brief TypedDict + full stage contract | VERIFIED | `class Brief(TypedDict)` at line 1792 with all six fields; `## §47 — Story & Brief Stage` at line 5552 documents table, endpoints, guarded paths. |
| `convex/schema.ts` | `briefs` table + `story_leads.status` | VERIFIED | `briefs` table at line 571 (`by_runId` index); additive `status` union field on `story_leads` at line 541. |
| `convex/briefs.ts` / `convex/storyLeads.ts` | insert/patch/byRunId, setStatus | VERIFIED | Upsert-safe `insert`, single-field `patch`, `byRunId` query; `setStatus` mutation with the three-literal union, additive only. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `LeadActions.tsx` | `require_lead`/`remove_lead` (FastAPI) | `requireLead`/`removeLead` clients | WIRED | Clerk token → POST endpoints → `storyLeads:setStatus` + audit. |
| `NeedsYourDecisionCard.tsx` | `adjudicateGate1` | UNCHANGED Phase-37 resume bridge | WIRED | Grep confirms only `adjudicateGate1` used for resume in this component. |
| `BriefFieldTable.tsx` | `patch_brief` (FastAPI) | `patchBrief` client | WIRED | PATCH `/issues/{runId}/brief` → `briefs:patch` + audit (no reason). |
| `BriefFieldStrengthen.tsx` | `strengthen/preview`+`/apply` (FastAPI) | `briefClient.ts` | WIRED | Preview issues no write/audit; apply writes + reasoned audit → Decision log. |
| `editor.py` | `briefs:insert` (Convex) | `convex_mutation_safe` | WIRED | Called on all three winner-resolution paths (auto-select/resume unified path + D-14 recovery). |
| `editor_gate_1` return | `DispatchState['brief']` | `return {**state, ..., "brief": brief}` | WIRED | Present on both return blocks. |
| 7 section writers | `build_section_writer_prompt`/bespoke prompts | `state.get("brief")` | WIRED | Grep count exactly 7/7. |
| `revision.py::_fetch_brief_context` | `briefs:byRunId` | Convex read | WIRED | Live-read preferred; legacy Sanity-proxy fallback retained; never crashes. |
| `story/page.tsx` | `StoryBriefScreen` | Mount | WIRED | `SignalDeskScreen` reference fully removed. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| BRF-01 | 47-01, 47-05, 47-08 | Never-truncated lead cards | SATISFIED | `LeadCard.tsx` + passing tripwire test |
| BRF-02 | 47-01, 47-04, 47-05, 47-08 | Require/Remove with mandatory reason | SATISFIED | `LeadActions.tsx` + `api/leads.py` |
| BRF-03 | 47-01, 47-06, 47-08 | Grouped org options, never-truncated concern | SATISFIED | `OrgOptionSlate.tsx` + passing tripwire test |
| BRF-04 | 47-01, 47-06, 47-08 | Needs-your-decision two-option adjudication | SATISFIED | `NeedsYourDecisionCard.tsx`, correct label + resume |
| BRF-05 | 47-01, 47-02, 47-03, 47-04, 47-07, 47-08 | Editable Brief generated after selection, writers draft from it | SATISFIED (documented reading — see Truth 5) | `editor.py`, `voice.py`, `BriefFieldTable.tsx`, `api/brief.py` |
| BRF-06 | 47-01, 47-04, 47-07, 47-08 | Strengthen any single Brief field | SATISFIED | `BriefFieldStrengthen.tsx` + `api/brief.py` strengthen endpoints |

No orphaned requirements — REQUIREMENTS.md's Phase 47 row set (BRF-01..06) exactly matches the six requirement IDs declared across the 8 plans' frontmatter. All six are checked `[x]` in the requirements checklist (lines 401-406). Note: the traceability table (lines 842-847) still reads "Planned" rather than "Complete" — a pre-existing, documented cosmetic convention in this codebase (mixed-state precedent, e.g. SIG-01 per 47-08's SUMMARY), not a functional gap.

### Anti-Patterns Found

None blocking. Scanned all 9 new/modified Stage-1 component files and the 5 modified pipeline files for TODO/FIXME/placeholder comments, empty-return stubs, hardcoded-empty state, and console.log-only implementations — none found. The only stub-shaped code encountered (`brief === null` empty state in `BriefFieldTable.tsx`, `pitchRows.length === 0` empty state in `OrgOptionSlate.tsx`) is an intentional, honest "no data yet" UI state gated behind real Convex subscriptions, not a placeholder masking missing functionality.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `LeadCard.tsx` | `lead` prop | `ws.storyLeads` → `api.storyLeads.byRunId` (Convex) → written by Signal Editor (Phase 46) | Yes — live Convex query, real `story_leads` rows | FLOWING |
| `OrgOptionSlate.tsx` | `pitchRows`/`advocateRows`/`verificationRecords` | `ws.pitchRows`/`api.deliberationEvents.byRunIdAndType`/`ws.verificationRecords` | Yes — all live subscriptions, no static fallback | FLOWING |
| `BriefFieldTable.tsx` | `brief` prop | `ws.brief` → `api.briefs.byRunId` → written by `editor_gate_1::_assemble_brief` | Yes — deterministic assembly from real pipeline state, not a static stub | FLOWING |
| `NeedsYourDecisionCard.tsx` | `pitchRows`/`advocateRows` props | Passed down from `StoryBriefScreen`'s own live subscriptions | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full dispatch-control vitest suite | `pnpm --filter dispatch-control test:unit` | 932 passed / 2 todo / 0 failed (110 files) | PASS |
| Strict Next.js build (type-checks) | `pnpm --filter dispatch-control build` | Exit 0, zero type errors, `/issues/[issueNumber]/story` route present | PASS |
| Full pipeline pytest suite | `cd packages/pipeline && uv run pytest tests/ -q` | 661 passed, 37 skipped, 0 failed | PASS |
| Convex deploy parity | `pnpm check:convex-parity` | 61 called functions all present on dev:modest-magpie-797 (135 deployed) | PASS |
| Targeted BRF pytest files | `pytest tests/test_leads_endpoints.py tests/test_brief_endpoints.py tests/test_brief_convex_guard.py tests/agents/test_editor.py tests/lib/test_voice.py` | 47 passed, 2 skipped | PASS |
| No dangling references to deleted placeholder | `grep -rn "StoryPanelContent\|buildStoryPanelContent\|StoryPanelPublisher" apps/dispatch-control` | 0 matches | PASS |
| No new interrupt/LLM call added to `_assemble_brief` | `grep -c "interrupt(" editor.py` (=10, unchanged) + no `acomplete` in helper | Confirmed | PASS |
| All 7 writers thread `state.get("brief")` | `grep -rl 'state.get("brief")' ... | wc -l` | 7 | PASS |

All gates independently re-run and confirmed green — matching the SUMMARY.md claims exactly (932/932, 661/661 pytest, build exit 0, 61/61 Convex parity).

### Human Verification Required

None identified as blocking. The following are optional but worth a quick manual pass for UX polish (not gaps against the phase goal):

1. **Visual review of the Story & Brief screen composition**
   **Test:** Load `/issues/[n]/story` for a run with leads, org options, and (if paused) the Needs-your-decision card, in a browser.
   **Expected:** The vertical composition (Leads → Org options → Needs-your-decision → Brief table) reads cleanly at real viewport widths; the never-truncated blocks don't visually overflow oddly with very long agent-generated text.
   **Why human:** Visual layout/typography quality can't be verified by grep/unit tests; this is UX polish, not a functional gap — automated tests already confirm the text is never clipped programmatically.

2. **End-to-end "Ask an agent to strengthen" quality**
   **Test:** Trigger a real strengthen pass on a Brief field with a live OpenRouter call and review the proposed text.
   **Expected:** The proposed text is genuinely sharper, doesn't invent facts, and matches Jesse's voice.
   **Why human:** LLM output quality is not something a unit test with mocked `acomplete` can assess; the wiring (preview→apply, budget guard, audit) is already verified structurally.

### Gaps Summary

None. All six observable truths (BRF-01 through BRF-06) are verified against real, reachable, tested code — not placeholders. The provisional `StoryPanelContent.tsx`/`SignalDeskScreen` mount has been fully replaced (deleted, not merely superseded) by `StoryBriefScreen.tsx`, composing all six new Stage-1 components in the design-specified order. The pipeline-side Brief generation is deterministic, zero-new-machinery, and threaded into all 7 section writers. All four phase gates (full vitest, strict Next.js build, full pytest, Convex parity) were independently re-run during this verification and confirmed green, matching the SUMMARY's claims exactly. The one nuance worth flagging for future readers — BRF-05's Brief edits reach only later revision passes, not the pipeline's first draft, because the graph has no pause point between Gate 1 and the writers — is an explicitly documented, accepted design decision (D-11), not an implementation gap.

---
*Verified: 2026-07-16T13:10:55Z*
*Verifier: Claude (gsd-verifier)*
