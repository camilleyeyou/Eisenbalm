# Phase 48: Brief Entry Point - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 48-brief-entry-point
**Mode:** Smart discuss (`--auto`) — all gray areas auto-selected; recommended default locked per area
**Areas discussed:** Graph branching, Winner/Brief seeding, Entry form + Brief mapping, Source material, verify_candidates posture, Deliberation in brief mode, Create-panel flow, Brief-entry API

---

## Graph entry & branching mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| `START` conditional edge on `entry_mode` | One graph; brief runs route `calibrator → verify_candidates → researcher`; discovery chain unchanged; downstream reused verbatim | ✓ |
| Preseed state + per-node short-circuit | Keep linear graph; signal_editor/scout/advocate/gate_1 each no-op when `entry_mode=='brief'` | |
| Second compiled graph | A separate StateGraph for brief runs | |

**Auto-selected:** `START` conditional edge (recommended) — LangGraph-idiomatic, one graph/one checkpointer, cleanly expresses "skip discovery, enter at Researcher." → **D-01, D-02, D-03**
**Notes:** Calibrator still runs (sets `style_brief`/narrator the writers need). Only Signal Editor, Scout, Advocate, Gate 1 are skipped (ENT-02's literal list). `verify_candidates` moves onto the brief branch (ENT-04).

---

## Winner/candidate/Brief seeding (Gate 1 skipped)

| Option | Description | Selected |
|--------|-------------|----------|
| Seed `initial_state` + persist `briefs` row at intake | Human brief seeds `entry_mode`/`winning_charity`/`candidates`/`brief`; `briefs:insert` at intake, no LLM | ✓ |
| A tiny deterministic `brief_intake` seed node | A bare node at the head of the brief branch assembles + writes the seed | |
| Reuse `editor_gate_1` with a brief branch inside it | Fork gate_1 to handle brief mode | |

**Auto-selected:** Seed `initial_state` + persist at intake (recommended) — the human authored the input, so seed it directly; downstream reads `winning_charity`/`brief` unchanged. → **D-04, D-05, D-06**
**Notes:** Exact write locus (console pre-trigger vs. endpoint vs. a bare pre-graph seed) left to RESEARCH; the constraint is a `briefs` row exists before the writers draft.

---

## Entry form fields + Brief mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal ENT-02 set → map to Brief | Collect premise/peg/organization/optional source; other 4 Brief fields blank + BRF-06 strengthen later | ✓ |
| Full 6-field Brief form up front | Operator authors all six Brief fields + org | |
| Minimal + one LLM pass to expand | Minimal input, LLM fills the remaining fields at intake | |

**Auto-selected:** Minimal ENT-02 set (recommended) — matches ENT-02 verbatim, minimal burden, reuses Phase 47's editable Brief + shipped BRF-06 strengthen. → **D-07, D-08, D-09**
**Notes:** `premise→premise`, `peg→currentPeg`, `org→winning_charity+candidate`; centralClaim/readerEffect/knownRisks/voiceIntention start blank. Org capture should include a website URL so `verify_candidates` checks are meaningful.

---

## "Optional source material" handling

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text/URL field → Researcher seed context | Single optional text field threaded to the Researcher as seed sources | ✓ |
| File/asset upload | Upload PDFs/images/documents as source material | |

**Auto-selected:** Free-text seed field (recommended) — simple, "optional" is literal (run works empty), reuses the Researcher's existing web-search. No file upload this phase. → **D-10**

---

## verify_candidates posture on a human org

| Option | Description | Selected |
|--------|-------------|----------|
| Advisory-only — record produced, never halts | Run checks, persist record (ENT-04), surface concerns in Stage 1; a fail does not remove/pause | ✓ |
| Run + pause/hold on a definitive kill | A definitive-fail org routes to a "Needs your decision"/Hold | |

**Auto-selected:** Advisory-only (recommended) — the human deliberately chose the org and there's no slate to fall back to; matches `verify_candidates`' conservative "never kill on ambiguous" posture. Record still exists (ENT-04). → **D-11**
**Notes:** Operator can still use the existing Hold control if the record looks disqualifying.

---

## Deliberation / chronicler in a brief run

| Option | Description | Selected |
|--------|-------------|----------|
| Skip chronicler; deliberation legitimately absent | Brief branch doesn't route through chronicler; reader deliberation section renders its absent state | ✓ |
| Chronicler variant dramatizing the editor's decision | Synthesize a deliberation from the brief decision-to-run | |

**Auto-selected:** Skip chronicler (recommended) — no scout/advocate/gate-1 debate exists to chronicle; fabricating one undercuts the milestone's verification/trust story. Outside ENT-03's enumerated artifacts + Stages 2–5 scope. → **D-12**
**Notes:** Flagged as the one honest divergence for Andrew; the dramatize-decision alternative captured in `<deferred>` (not built).

---

## Create-panel UI + intake flow

| Option | Description | Selected |
|--------|-------------|----------|
| Second card in the reserved CreatePanel cell → form → trigger → Stage 1 | Fill Phase 40 D-28's reserved cell; form inline/modal; submit creates issue + brief run + routes to Stage 1 | ✓ |
| A separate dedicated route/page for the brief form | Full-page brief intake outside CreatePanel | |

**Auto-selected:** Second card in the reserved cell (recommended) — D-28 (Phase 40) left the cell absent specifically for this; reuses the CreatePanel grid + `ensureByNumber` + `issueHref`; both paths land at Stage 1 (ENT-01). → **D-13, D-14**
**Notes:** Inline-expand vs. modal for the form is Claude's discretion. New `triggerBriefRun` client sibling of `triggerRun`.

---

## Brief-entry API endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated Clerk-guarded endpoint reusing `_start_run` | `POST /pipeline/run/brief` (or `/issues/brief`); seeds entry_mode + brief; reduced agent_runs queue | ✓ |
| Extend `RunWeeklyBody` / `/pipeline/run` with optional brief fields | Overload the existing trigger with `entry_mode` + brief payload | |

**Auto-selected:** New dedicated endpoint (recommended) — keeps the weekly/cron path untouched, reuses `_start_run`'s shared discipline (one-at-a-time gate, budget gate, config snapshot, agent_runs queue). Contract-first §48. → **D-15, D-16**
**Notes:** Brief-run `agentRuns:queueForRun` uses the SHORTER node set (no signal_editor/scout/advocate/editor_gate_1/chronicler) so the live rail reflects the real path. Endpoint name (`/pipeline/run/brief` vs `/issues/brief`) is Claude's discretion.

---

## Claude's Discretion

- Inline-expand vs. modal for the brief-intake form; exact field layout within the 1c token system.
- Where `briefs:insert` fires for a brief run (console pre-trigger / trigger endpoint / bare pre-graph seed).
- `route_by_entry_mode` router signature + edge placement.
- Source-material threading into the Researcher (new `DispatchState` field vs. existing research-seed slot).
- `voiceIntention` default (`style_brief.visualDirection`) vs. blank.
- Endpoint name (`/pipeline/run/brief` vs `/issues/brief`).

## Deferred Ideas

- A deliberation-equivalent for brief runs (dramatize the editor's decision) — not built.
- File/asset upload for source material — free-text only this phase.
- Roles/permissions gating of who may start a brief run → Phase 49.
- Nomenclature / Workbench rename (naming brief-run steps in Run Details) → Phase 50.
- LLM expansion of the minimal brief into a full 6-field Brief at intake — not chosen.
