---
phase: 50
slug: workbench-nomenclature
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `50-RESEARCH.md` §Validation Architecture. This is a display-copy / rename
> phase — the dominant validation is **source-scan tripwires** (grep operator-facing copy for
> banned legacy terms, and prove route paths / stored enum values / node ids are preserved),
> plus the strict build/type gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`apps/dispatch-control`) + pytest (`packages/pipeline`, only if the D-11/D-12 Publisher-restart bridge or D-13 capture touches the API) |
| **Config file** | `apps/dispatch-control/vitest.config.ts`; existing tripwire precedents: `__tests__/nav.test.ts`, and the source-scan pattern used by no-model-names / no-sanity-write / FORBIDDEN_BYPASS tests |
| **Quick run command** | `pnpm --filter dispatch-control test -- --run` |
| **Full suite command** | `pnpm --filter dispatch-control test -- --run && pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~60–120 seconds (vitest ~30s + Next build ~60–90s) |

**Type/build gate (MANDATORY before any frontend plan is "done"):** `pnpm --filter dispatch-control build` — vitest does NOT type-check (project rule [[run-strict-build-before-frontend-phase-done]]). If any Convex function/schema is touched (D-13 additive field), also `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797` ([[convex-functions-need-live-sync]]).

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dispatch-control test -- --run` (fast; the nomenclature tripwire fails immediately if a banned term reappears).
- **After every plan wave:** Run the full suite command (test + build).
- **Before `/gsd:verify-work`:** Full suite green AND `pnpm --filter dispatch-control build` exits 0.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

*Planner fills task IDs; each WBN requirement maps to at least one automated verification below. Anchor guidance:*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 50-0-01 | 00 | 0 | WBN-02 (prereq) | unit | `pnpm --filter dispatch-control test -- --run pipelineTopology` (asserts 20 nodes incl. signal_editor + verify_candidates) | ❌ W0 | ⬜ pending |
| 50-01-01 | 01 | 1 | WBN-05 | source-scan tripwire | `pnpm --filter dispatch-control test -- --run nomenclature` (greps operator-facing copy for banned terms; allowlists route paths / node ids / stored enums) | ❌ W0 | ⬜ pending |
| 50-01-02 | 01 | 1 | WBN-05 | source-scan tripwire | route-preservation + enum-preservation assertion (`/run-monitor` `/prompt-lab` `/eval-center` `/registry` still resolve; `charities.status` literal `'blocklisted'` unchanged) | ❌ W0 | ⬜ pending |
| 50-0x-01 | 0x | — | WBN-01 | unit | `nav.test.ts` — two groups + renamed labels + role indicator present | ✅ (extend) | ⬜ pending |
| 50-0x-02 | 0x | — | WBN-02 | unit | action-name map returns §7 labels per node key; diamond set = {verify_candidates, verify_research, …} | ❌ W0 | ⬜ pending |
| 50-0x-03 | 0x | — | WBN-03 | unit | recovery rail renders 4-part sections + downstream Skipped dimming; per-step Restart honesty (only backed steps offer reuse copy) | ❌ W0 | ⬜ pending |
| 50-0x-04 | 0x | — | WBN-04 | unit | draft instruction renders origin ref → deep-links the motivating issue output | ❌ W0 | ⬜ pending |
| 50-0x-05 | 0x | — | WBN-06 | unit + tripwire | typed-confirm exists ONLY on Mark Do-not-use (org name + reason); publish path has none; Masthead/banner reworded | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/dispatch-control/__tests__/nomenclature.test.ts` — the WBN-05 banned-term source-scan tripwire (banned set MUST include the spec's "old" column **and** the already-live conflicting terms found in research: "Rehearsal", "Make live", "LIVE badge", "Draft vs. live"). Allowlist: route path strings, node ids (`editor_gate_1`, `verify_research`…), stored enum literals (`'blocklisted'`), and code identifiers.
- [ ] `apps/dispatch-control/__tests__/rename-preservation.test.ts` (or fold into above) — asserts route folders + `charities.status='blocklisted'` + `charity.blocklisted` audit action are NOT renamed (guards D-02/D-03).
- [ ] Fix + re-pin `run-monitor/graph/_components/pipelineTopology.ts` to the real 20 nodes and update its stale 18-node test (Wave-0 prerequisite for WBN-02/D-08 per research finding #1).
- [ ] Extend `apps/dispatch-control/__tests__/nav.test.ts` for the renamed labels + role indicator (WBN-01).

*If none: "Existing infrastructure covers all phase requirements." — NOT the case here; the nomenclature tripwire + topology fix are net-new Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual read of the two nav groups + role indicator placement (bottom-left) | WBN-01 | Layout/visual distinctness isn't grep-checkable | Load the console; confirm Editorial vs System Workbench read as distinct groups and the signed-in role shows bottom-left |
| Failed-run recovery rail reads as plain language + downstream steps visibly dim | WBN-03 | Prose quality + dim styling are visual | Toggle a failed run; read the 4-part rail; confirm downstream steps show "Skipped" and dim |
| "Restart from this step" actually reuses completed steps where claimed | WBN-03 | Requires a live pipeline run to prove checkpoint reuse | For a step with a backing primitive, restart and confirm completed steps are not re-paid (per research: only 3 of 11 steps have real backing — verify copy stays honest for the other 8) |

*If none: "All phase behaviors have automated verification." — not fully; the visual/behavioral items above are manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (nomenclature tripwire, topology fix)
- [ ] No watch-mode flags (use `--run`)
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
