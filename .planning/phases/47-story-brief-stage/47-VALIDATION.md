---
phase: 47
slug: story-brief-stage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 47-RESEARCH.md §Validation Architecture (maps BRF-01..BRF-06 to testable assertions).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/dispatch-control) + pytest (packages/pipeline, for the Brief threading) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` · `packages/pipeline/pyproject.toml` |
| **Quick run command** | `pnpm --filter dispatch-control test:unit -- <file>` · `cd packages/pipeline && uv run pytest <file> -x -q` |
| **Full suite command** | `pnpm --filter dispatch-control test:unit` · `cd packages/pipeline && uv run pytest tests/ -q` |
| **Strict build gate** | `pnpm --filter dispatch-control build` (strict `next build` — vitest does NOT type-check; MANDATORY before done) |
| **Estimated runtime** | vitest ~30–60s · pytest ~60–120s · build ~60–120s |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the touched component/module
- **After every plan wave:** Run the relevant full suite (vitest for frontend waves, pytest for pipeline waves)
- **Before `/gsd:verify-work`:** Full vitest + full pytest green AND strict `next build` exit 0 AND Convex parity green (new `briefs` table live on `dev:modest-magpie-797`)
- **Max feedback latency:** ~120 seconds per suite

---

## Per-Requirement Verification Map

*The gsd-planner fills exact Task IDs. This maps each requirement to its test type + automated command so no requirement lands without a sampling point.*

| Requirement | What must be TRUE | Test Type | Automated Command | Status |
|-------------|-------------------|-----------|-------------------|--------|
| BRF-01 | LeadCard renders EVERY field (premise, dated peg + source, reader energy, angle, category, confidence, brand-risk warning) IN FULL — never truncated, never tooltip-hidden | vitest (component + never-truncated tripwire) | `pnpm --filter dispatch-control test:unit -- LeadCard` | ⬜ pending |
| BRF-02 | Require a lead works; Remove requires a non-empty reason (disabled without) and writes an audit_log + Decision-log entry via the FastAPI action boundary | vitest (UI reason-gate) + pytest/route (audit-before-write) | `pnpm --filter dispatch-control test:unit -- LeadActions` | ⬜ pending |
| BRF-03 | Org options grouped under the chosen lead show mechanism, verification record WITH DATES, agent case, confidence, prior-coverage warning, and main concern ALWAYS visible (never truncated) | vitest (never-truncated concern tripwire, mirror Phase-37 CandidateSlate) | `pnpm --filter dispatch-control test:unit -- OrgOptions` | ⬜ pending |
| BRF-04 | "Needs your decision" renders two options side by side; label is "Needs your decision" NOT requiresHumanInput; choice requires a rationale and calls adjudicateGate1(runId, {selection:{charityName}, reason}) → existing resume | vitest (rationale mandatory + adjudicateGate1 called with charityName+reason + label assertion) | `pnpm --filter dispatch-control test:unit -- NeedsYourDecision` | ⬜ pending |
| BRF-05 | A six-field Brief (premise, current peg, central claim, reader effect, known risks, voice intention) is generated after selection, stored in Convex (editable, audited), threaded into DispatchState, and the 7 section writers draft FROM it (5th param to build_section_writer_prompt) | pytest (Brief generated in editor_gate_1 + build_section_writer_prompt 5-param + writers reference it) + vitest (editable field table, audited edits) | `cd packages/pipeline && uv run pytest tests/agents/test_editor.py tests/lib/test_voice.py -q` + `pnpm --filter dispatch-control test:unit -- BriefPanel` | ⬜ pending |
| BRF-06 | "Ask an agent to strengthen" a single Brief field: preview (read-only, no mutation) + apply (writes the field + audit_log + Decision-log) via the generalized revision engine, field-scoped | pytest (field-scoped revision preview/apply) + vitest (BRF-06 UI) | `cd packages/pipeline && uv run pytest tests/api/test_revision.py -q` + `pnpm --filter dispatch-control test:unit -- BriefFieldStrengthen` | ⬜ pending |
| Cross-cutting | Provisional `StoryPanelContent.tsx` replaced (deleted); strict `next build` green; new `briefs` Convex table live on dev:modest-magpie-797 | strict build + Convex parity | `pnpm --filter dispatch-control build` + `pnpm check:convex-parity` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/dispatch-control/__tests__/LeadCard.test.tsx` — new (BRF-01): every-field-rendered + never-truncated tripwire (mirror the Phase-37 never-truncated-concern test).
- [ ] `apps/dispatch-control/__tests__/LeadActions.test.tsx` — new (BRF-02): Require works; Remove disabled without reason; audit path asserted.
- [ ] `apps/dispatch-control/__tests__/OrgOptions.test.tsx` — new (BRF-03): grouped-under-lead + main-concern-always-visible tripwire (extend the CandidateSlate pattern).
- [ ] `apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx` — new (BRF-04): two-option render + mandatory rationale + adjudicateGate1 call + "Needs your decision" label (not requiresHumanInput).
- [ ] `apps/dispatch-control/__tests__/BriefPanel.test.tsx` — new (BRF-05): editable six-field table + audited edits.
- [ ] `apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx` — new (BRF-06): preview/apply field UI.
- [ ] `packages/pipeline/tests/agents/test_editor.py` — UPDATE (BRF-05): assert the Brief is generated at editor_gate_1 resolution + persisted.
- [ ] `packages/pipeline/tests/lib/test_voice.py` — UPDATE (BRF-05): assert `build_section_writer_prompt` accepts + threads the Brief (5th param) and the 7 writer call sites pass it.
- [ ] `packages/pipeline/tests/api/test_revision.py` — UPDATE/new (BRF-06): field-scoped preview/apply.
- [ ] Convex: new `briefs` table + functions must be synced (`pnpm --filter @eisenbalm/convex dev:once`) and parity-checked.

*Existing vitest + pytest infrastructure covers the frameworks; only the above files are new/updated.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live "Needs your decision" → resume round-trip | BRF-04 | The full pause→adjudicate→resume loop needs a live paused run (Clerk auth + reachable pipeline/Postgres) | On a paused run, choose a story with a rationale; confirm the run resumes and the decision + rationale appear in the Decision log. |
| Brief quality after generation | BRF-05 | Whether the deterministically-generated Brief reads well / is useful is not unit-assertable | After a real selection, read the six generated Brief fields; confirm they're coherent and the writers' drafts reflect them. |
| Stage-1 visual fidelity to Annotations §Stage 1 | BRF-01..06 | Layout/typography fidelity to the design doc is a visual judgment | Compare the built Stage 1 against `docs/design/dispatch-control-v3/` Annotations §Stage 1 (leads, org options, paused card, Brief table, empty/loading/error). |

---

## Validation Sign-Off

- [ ] All requirements have automated verify or Wave 0 test-file dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all new frontend test files + the pipeline Brief-threading test updates
- [ ] Strict `next build` gate included as a phase-gate check
- [ ] Convex `briefs` live-sync + parity included
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter (after planner maps Task IDs)

**Approval:** pending
