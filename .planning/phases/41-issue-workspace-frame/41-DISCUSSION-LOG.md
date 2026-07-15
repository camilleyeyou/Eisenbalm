# Phase 41: Issue Workspace Frame — Draft, Voice Pass & Approval - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 41-issue-workspace-frame
**Mode:** discuss `--auto` (all gray areas auto-selected; recommended default chosen for each)
**Areas discussed:** Frame architecture & routing · Stage segments & Phase-40 reconciliation · Recomposition strategy · Stage 1 provisional Signal Desk · Stage 3 Fact Check interim · Stage 5 Approval & publish confirmation · Persistent outline · Context panel · Galley claim rendering · "Not generated" state · Nav & status marks · "editor" nomenclature

**Init note:** `gsd-tools init phase-op 41` reported `phase_found: false`. This is the known multi-milestone ROADMAP.md CLI quirk (v4.0 phases 40–50 misreport). Verified Phase 41 exists directly at `.planning/ROADMAP.md:886`; proceeded. Phase dir + slug derived manually: `41-issue-workspace-frame`.

---

## A. Workspace frame architecture & routing

| Option | Description | Selected |
|--------|-------------|----------|
| Shared `layout.tsx` + nested stage child routes | Frame persists across tab switches; every stage deep-linkable (Phase 40 D-06). Precedent: `run-monitor/layout.tsx`. | ✓ |
| Single page with client tab state | Simpler, but breaks per-stage deep links and re-mounts the frame. | |

**Auto-selected:** shared layout + nested routes (D-01/D-02). Bare `/issues/[n]` redirects to last-visited stage (D-03/D-04). **Rationale:** Phase 40 explicitly built for path-segment stages and a `lastVisitedStage` field; the derived-state selector + StageStrip were built to be consumed here.

## B. Stage segments & Phase-40 reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| `story/draft/fact-check/voice/approval`, rename `/review`→`/draft` | Matches `derivedState.ts` labels + Phase 40 D-06's anticipated names. | ✓ |
| Keep Phase 40's `/review` + `/voice` verbatim | Avoids a rename, but diverges from D-06 and the stage labels. | |

**Auto-selected:** the five design-aligned segments with a `/review`→`/draft` redirect (D-05/D-06).

## C. Recomposition strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Mount inner content, strip standalone chrome, internals untouched | Honors "DO NOT REBUILD" + Phase 40 D-07. | ✓ |
| Rewrite screens into the frame | Violates milestone reconciliation facts; high risk. | |

**Auto-selected:** reuse, don't rewrite (D-07/D-08). Decision rail splits out of the galley into Stage 5 (D-13).

## D. Stage 1 — provisional Signal Desk

| Option | Description | Selected |
|--------|-------------|----------|
| Add net-new issue-keyed wrapper, mount `SignalDeskScreen` as-is | Signal Desk lacks a `/issues/[n]` wrapper + nav entry (unlike Review/Voice). Full redesign is Phase 47. | ✓ |
| Wait for Phase 47 to build Stage 1 | Would leave a blank Stage 1 and lose SC-7 (interrupt-at-charity resolvable). | |

**Auto-selected:** provisional issue-keyed mount with uniform frame treatment (D-09/D-10).

## E. Stage 3 — Fact Check interim

| Option | Description | Selected |
|--------|-------------|----------|
| First-class placeholder composing read-only `claim_checks` coverage | WSP-07 discipline; no standalone screen exists yet (data lives in DecisionRail's SourceIndex). | ✓ |
| Blank/hidden Stage 3 tab until Phase 42 | Violates WSP-07 ("Not generated" is first-class, never blank). | |

**Auto-selected:** first-class placeholder; publish gate's "Fact Check complete" maps to `facts-cleared` sign-off for now (D-11/D-12).

## F. Stage 5 — Approval & publish confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Recompose DecisionRail into blockers-first Stage 5; remove typed confirmation, add exact preview + one click | Milestone locked decision (README #2); reuse the Phase 34 two-sign-off gate unchanged. | ✓ |
| Keep Phase 34 typed confirmation | Contradicts the locked milestone decision. | |

**Auto-selected:** recompose + drop typed confirmation, gate unchanged (D-13/D-14/D-15). "Agent editor's recommendation" label shipped here per SC-4 (D-16). Sign-off revocation unchanged (D-17).

## G. Persistent outline (WSP-02)

**Auto-selected:** section-level, persistent across stages, derived from the Phase 40 stage/section selector; vocabulary clean/review/must fix/changed since review/not generated (label+icon); reuse `sectionIdMap.ts` + `EDITABLE_SECTIONS` (D-18).

## H. Context panel (WSP-03)

**Auto-selected:** one shared collapsible shell, content injected per stage; reuse existing finding/provenance surfaces; hidden-state persistence at Claude's discretion (D-19).

## I. Galley claim rendering (WSP-04)

**Auto-selected:** reuse the Phase 35 provenance marks (`ClaimMark`/`AnnotationMark`/`spanResolver`); add keyboard-focus parity for the source popover; wire unchecked-claim click → Stage 3 tab (D-20).

## J. "Not generated" state (WSP-07)

**Auto-selected:** dedicated Editor's-note canvas block + "— not generated" outline marker, driven by section-artifact absence (D-21).

## K. Nav & status marks (WSP-01)

**Auto-selected:** add one "Issue Workspace" item to the Editorial nav group (the three desks already left in Phase 40); tabs carry live marks from `derivedState.ts` (D-22).

## L. "editor" nomenclature (WSP-05)

**Auto-selected:** apply "Agent editor's recommendation" in Stage 5 (in scope per SC-4); defer the console-wide nomenclature ripple to Phase 50 (D-16).

## Claude's Discretion

- Inner-component extraction boundary (D-08); context-panel persistence mechanism (D-19); Stage-3 placeholder richness (D-11); `/review`→`/draft` redirect mechanism (D-06); exact copy for placeholder/preview/Editor's-note; whether the Draft passage toolbar stubs or omits Inspect/Revise (Phases 44/45).

## Deferred Ideas

- Fact Check real stage (42) · My Tasks screen (43) · Inspector + Ask-agent-to-revise/for-evidence (44/45) · full Story & Brief (47) · role gating (49) · nomenclature ripple (50).

## External Research

None performed — the binding design spec + Phase 40 context + codebase scan fully determined the decisions.
