---
phase: 36-voice-pass-de-slop-screen
verified: 2026-07-09T00:00:00Z
status: gaps_found
score: 3.5/4 must-haves verified (VOX-01, VOX-03, VOX-04 fully verified; VOX-02 partially verified)
gaps:
  - truth: "Clicking a voice tell opens an as-written vs suggested-house-voice comparison with Accept rewrite / Write my own / Keep (not a tell) actions, all three functional"
    status: partial
    reason: >
      Two of the three named VOX-02 actions are fully wired end-to-end:
      "Accept rewrite" (generates a house-voice suggestion on demand via
      POST /voice-rewrite when no suggestedFix is stored, then applies it
      through accept_finding's suggestedFixOverride) and "Keep (not a tell)"
      (dismiss with a prefilled reason) both work. The third, "Write my own",
      renders with the correct label and is clickable, but its onClick
      handler (`handleEditSection` in voice-pass/[runId]/page.tsx) is an
      intentional no-op — clicking it produces no observable effect. Voice
      Pass has no section-editor surface to navigate to (Review Desk's
      SectionEditorPanel/viewMode switcher was never built out for this
      screen). This is a real gap against 36-CONTEXT.md's own binding
      decision D-09 ("Write my own = Edit inline (open the section editor)")
      and against the literal VOX-02 requirement text, which names all three
      actions. It does NOT block the phase's core goal ("can rewrite it to
      house voice") since Accept rewrite already delivers that outcome, and
      it was transparently self-reported by the 36-06 executor as a "Known
      Stub" rather than silently claimed complete.
    artifacts:
      - path: "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx"
        issue: "handleEditSection() (lines ~160-162) is an intentionally inert no-op passed as Galley's onEditSection; the 'Write my own' button calls it and nothing happens."
    missing:
      - "A real destination for 'Write my own' on Voice Pass — either a lightweight inline text-edit affordance scoped to the finding's section, or a deep-link to Review Desk's SectionEditorPanel with the section+finding pre-selected."
---

# Phase 36: Voice Pass De-Slop Screen Verification Report

**Phase Goal:** Operator has a dedicated screen for catching machine-tell prose and can rewrite it to house voice before it counts as "sounds human."
**Verified:** 2026-07-09
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (VOX-01) | Operator has a dedicated Voice Pass screen with machine-tells/voice violations lit inline and a per-screen tell count | ✓ VERIFIED | `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` mounts the promoted `<Galley includeAxes={VOICE_AXES} labels={VOICE_LABELS} .../>`; `tellCount` computed via `isOpenFinding` + `VOICE_AXES` and rendered in the header ("N tells"); `check_machine_tell`/`MACHINE_TELL_LEXICON` in `rules.py`, registered in `run_all_predicates`; `machine-tell` present in both `convex/schema.ts` and `convex/qaCorrections.ts` axis unions; `agents/qa/__init__.py` no longer collapses Layer-1 axes (`grep -c "hard-rule"` = 0; `layer1: list[QAFinding] = layer1_raw`) |
| 2 (VOX-02) | Clicking a tell shows as-written vs suggested-house-voice with Accept rewrite / Write my own / Keep (not a tell), all functional; accept mutates via content-patch | ⚠ PARTIAL | `AnnotationMark.tsx`'s voice variant (`labels.accept === 'Accept rewrite'`) relabels the "Suggested:" line, calls `voicePassClient.rewrite()` on demand for rule-only tells then `acceptFinding(..., { suggestedFixOverride })` — fully wired and tested (5 new tests in `AnnotationMark.test.tsx`). "Keep (not a tell)" dismisses with a prefilled reason — fully wired. "Write my own" (`onEditSection`) is bound to `handleEditSection()`, an intentional no-op in `voice-pass/[runId]/page.tsx` — the button renders and is clickable but has zero observable effect (no edit surface exists on this screen). Self-reported by 36-06's own SUMMARY as a "Known Stub." |
| 3 (VOX-03) | Voice Pass carries its own server-gated "Sounds human" sign-off, distinct from factual clearance | ✓ VERIFIED | `VoicePassRail.tsx` subscribes `qaCorrections:byRunId`, scopes to `VOICE_AXES`, disables "Sign: Sounds human" while `voiceBlockers.length > 0`, calls `recordSignOff(token, runId, 'sounds-human')`; server `api/signoffs.py` has `VOICE_AXES` constant, narrows `facts-cleared`'s open-error scan to exclude voice axes, and a `sounds-human` branch 409ing `open_voice_findings`; `DecisionRail.tsx`/`ResolvedFindingsList.tsx` scoped to `FACTUAL_AXES` so the two rails/sign-offs are genuinely disjoint; both rails read the same `api.signOffs.activeByRunId` row |
| 4 (VOX-04) | Detection is two-layer: deterministic rules render instantly, LLM judge runs on demand, reusing existing QA rules + Opus judge | ✓ VERIFIED | `check_machine_tell` (Layer-1, rules.py, no new detector) + `POST /issues/{run_id}/voice-recheck` in `api/voice_pass.py` re-invokes the EXISTING `run_llm_judge(sections, run_id=run_id, narrator=None, rubric=None)`, superseding prior open `agentId="qa-recheck"` findings first (dedup, no double-counting on repeat clicks) |

**Score:** 3.5/4 truths verified (VOX-02 partial — 2 of its 3 named actions fully functional, the third is a self-reported inert stub)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | `machine-tell` axis literal | ✓ VERIFIED | Line 92, plus `structural-variety` gap-close |
| `convex/qaCorrections.ts` | `machine-tell` axis literal in insert mutation | ✓ VERIFIED | Line 38, identical to schema |
| `packages/pipeline/.../agents/qa/rules.py` | `check_machine_tell` + `MACHINE_TELL_LEXICON`, registered | ✓ VERIFIED | 12-pattern lexicon; registered in `run_all_predicates` |
| `packages/pipeline/.../agents/qa/__init__.py` | Layer-1 axis passthrough (no hard-rule collapse) | ✓ VERIFIED | `grep -c "hard-rule"` = 0 |
| `packages/pipeline/.../api/signoffs.py` | `VOICE_AXES` partition + `open_voice_findings` 409 | ✓ VERIFIED | Narrowed facts-cleared + new sounds-human branch |
| `packages/pipeline/.../api/voice_pass.py` | `voice-recheck` + `voice-rewrite` endpoints | ✓ VERIFIED | Both routes present, registered in `main.py` |
| `packages/pipeline/.../api/findings.py` | `suggestedFixOverride` on accept | ✓ VERIFIED | `_AcceptBody.suggestedFixOverride`; `accept_finding` resolution line |
| `apps/dispatch-control/components/galley/*` (6 files) | Promoted, route-agnostic galley stack | ✓ VERIFIED | Old `_components/Galley.tsx` path confirmed gone; new path imported by Review Desk |
| `apps/dispatch-control/lib/galley/axisPartition.ts` | `VOICE_AXES`/`FACTUAL_AXES` | ✓ VERIFIED | Both sets exported, used by Galley/DecisionRail/ResolvedFindingsList/VoicePassRail |
| `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` | Voice Pass screen | ✓ VERIFIED | Mounts Galley w/ `includeAxes={VOICE_AXES}`, `labels={VOICE_LABELS}`, tell count, "Run deep check" |
| `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx` | Machine-tells list + voice-law ref + sounds-human sign-off | ✓ VERIFIED | All three sections present and wired |
| `apps/dispatch-control/components/galley/AnnotationMark.tsx` | Voice-tell `labels` variant | ⚠ PARTIAL (see gap) | Accept rewrite + Keep-not-a-tell functional; `onEditSection`/"Write my own" destination not built |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `convex/qaCorrections.ts insert.axis` | `convex/schema.ts qaCorrections.axis` | identical literal set | ✓ WIRED | Both contain `machine-tell` + `structural-variety` |
| `voice-pass/[runId]/page.tsx` | `components/galley/Galley` | `includeAxes={VOICE_AXES}` | ✓ WIRED | Confirmed in source |
| `Galley.tsx` | `openFindings` filter | `includeAxes` whitelist | ✓ WIRED | `scopedFindings = includeAxes ? openFindings.filter(...) : openFindings` |
| `AnnotationMark Accept rewrite` | `voice-rewrite` → `accept + suggestedFixOverride` | `handleAccept()` | ✓ WIRED | Confirmed: rewrite() called when `!value.suggestedFix`, result passed as override |
| `VoicePassRail Sign: Sounds human` | `POST /issues/{runId}/sign-off {kind:'sounds-human'}` | `recordSignOff` | ✓ WIRED | Server 409s `open_voice_findings`; client disables button on the same predicate |
| `DecisionRail` / `ResolvedFindingsList` | `FACTUAL_AXES` | `factualOpen` filter | ✓ WIRED | Mirrors server-side facts-cleared narrowing |
| `AnnotationMark "Write my own"` | section-editor surface | `onEditSection` callback | ✗ NOT WIRED | Callback fires but destination handler is an intentional no-op; no editor surface exists on Voice Pass |
| `voice-recheck` | `run_llm_judge` | `narrator=None`, dedup-supersede | ✓ WIRED | Confirmed in `api/voice_pass.py` |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| VOX-01 | 36-01, 36-04, 36-05 | Dedicated Voice Pass screen, machine-tells lit inline, per-screen tell count | ✓ SATISFIED | Screen, axis union, predicate, passthrough all verified |
| VOX-02 | 36-03, 36-06 | As-written vs suggested comparison; Accept rewrite / Write my own / Keep-not-a-tell; accept via content-patch | ⚠ PARTIAL | Accept rewrite + Keep-not-a-tell fully functional; Write my own is an inert stub |
| VOX-03 | 36-02, 36-06 | Independent "Sounds human" sign-off, server-gated, distinct from facts-cleared | ✓ SATISFIED | Server partition + client rail + shared DecisionRail reflection all verified |
| VOX-04 | 36-01, 36-02, 36-03, 36-04, 36-05 | Two-layer detection: instant rules + on-demand judge, reusing existing modules | ✓ SATISFIED | `check_machine_tell` (rules-only) + `voice-recheck` re-invoking `run_llm_judge` with dedup |

No orphaned requirements — all four VOX-01..04 IDs are declared in at least one plan's `requirements` frontmatter and covered above. (Note: `.planning/REQUIREMENTS.md`'s bottom traceability table still shows VOX-01..04 as "Planned" — this is a stale-table doc artifact also present for the already-shipped Phase 34/35 rows; the requirements checklist section above it correctly shows all four as `[x]`. Not a code gap, but worth a doc pass in a future phase.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` | ~160-162 | `function handleEditSection() { /* Intentionally inert. */ }` — empty handler passed to a live, labeled, clickable button | ⚠ Warning | "Write my own" is a dead click; matches the classic `onClick={() => {}}` stub pattern. Transparently documented by the executor as a "Known Stub," not silently hidden. |

No other anti-patterns (TODO/FIXME/placeholder text, empty returns, hardcoded-empty data flowing to render) found in the files this phase touched.

### Test Suite Results (re-run, not trusted from SUMMARY claims)

- `cd packages/pipeline && uv run pytest -q` → **493 passed, 36 skipped** (matches SUMMARY claim)
- `cd apps/dispatch-control && npx vitest run` → **48 files passed | 1 skipped, 421 passed | 2 todo** (matches SUMMARY claim)
- `pnpm --filter dispatch-control build` → exit 0, `/voice-pass` and `/voice-pass/[runId]` routes present in the build manifest

Targeted re-runs also confirmed: `tests/agents/qa/test_rules.py`, `tests/agents/qa/test_qa_axis_passthrough.py`, `tests/test_signoffs_endpoints.py`, `tests/test_voice_pass_endpoints.py`, `tests/test_findings_endpoints.py` → 66 passed.

### Human Verification Required

None required to resolve the classification of the one identified gap — it was verified deterministically via code inspection (the handler body is empty). The following is worth a human glance if/when "Write my own" is built out, but is not blocking this verification:

#### 1. Voice Pass "Write my own" UX decision

**Test:** N/A (design decision, not a bug to reproduce)
**Expected:** N/A
**Why human:** Whether "Write my own" should open a lightweight inline editor on Voice Pass itself, or deep-link to Review Desk's `SectionEditorPanel`, is a product/UX call outside what code inspection can resolve — flagged for planning, not verification.

### Gaps Summary

Five of six plans (36-01 through 36-05, plus most of 36-06) landed exactly as specified, with strong RED-first test coverage and no regressions (pipeline suite 493/0 failed, frontend suite 421/0 failed, strict build green). VOX-01, VOX-03, and VOX-04 are fully achieved and wired end-to-end, including the parts of the system most prone to silent failure (the Convex closed-union axis literal, the Layer-1 axis passthrough, and the server-side sign-off partition — all specifically called out in the phase's own research as historical footguns, and all correctly closed here).

The one gap is narrow and self-reported: on the Voice Pass screen, the "Write my own" action (one of VOX-02's three named actions, and 36-CONTEXT.md's own binding decision D-09) is wired to an intentionally empty handler. The button renders correctly, with the correct label, but produces no effect when clicked — Voice Pass has no section-editor surface to send the operator to. This does not prevent the phase's core value proposition ("can rewrite it to house voice before it counts as sounds human") from working, since "Accept rewrite" already delivers a fully-functional generate-then-apply path, and "Keep (not a tell)" fully closes out false positives. But it is a genuine, unresolved gap against the literal requirement text and the phase's own binding decision — not an acceptable silent deferral, which is why status is `gaps_found` rather than `passed`. A follow-up plan should give Voice Pass a real "Write my own" destination (either its own lightweight inline editor or a deep-link into Review Desk's existing `SectionEditorPanel`).

---

*Verified: 2026-07-09*
*Verifier: Claude (gsd-verifier)*
