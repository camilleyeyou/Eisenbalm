---
phase: 39
slug: registry-coverage-memory-strip
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control, incl. convex-test) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `cd apps/dispatch-control && npx vitest run` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — vitest does not type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package.
- **After every plan wave:** Run BOTH full suites — this phase touches pipeline (coverage endpoint, researcher corrections read) and frontend/Convex (strip, corrections UI, charity_corrections table).
- **Before `/gsd:verify-work`:** Both full suites green + `pnpm --filter dispatch-control build` exits 0 + the manual/live checks below.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner — foundations first: contract §39/§26 extension; charity_corrections table + append mutation; GET /registry/coverage-strip endpoint; researcher corrections read via existing make_dedup_key) | | | MEM-01..03 | | | | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 / Wave 1 Requirements

Foundations the research resolved (must land before consumers), RED-first:
- [ ] Contract-first: `docs/API_CONTRACTS.md` (extend §26) for the charity_corrections table + append mutation + GET /registry/coverage-strip BEFORE code.
- [ ] `charity_corrections` append-only Convex table + `append`/`listByCharityKey` mutation/query (requireOperator on append, audit-logged following saveVersion's pattern — NOT setStatus's audit-gap pattern).
- [ ] `GET /registry/coverage-strip` FastAPI endpoint (server-side Convex charities + Sanity focusArea/location/scoutNotes join — dispatch-control has ZERO Sanity access, tripwire-enforced; must be a server endpoint).
- [ ] Researcher corrections read: reuse the EXISTING `charity_registry.make_dedup_key()` (do NOT reimplement — a 4th impl risks silent key drift), call `charityCorrections:listByCharityKey`, inject into prompt, log for MEM-03 verifiability.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage strip shows last-8 cause/geo/signal chips | MEM-01 | Visual + real issue data | Open the Registry; confirm the strip visualizes the last 8 featured charities' cause/geo/signal chips so thematic repetition is scannable |
| Corrections append + surface | MEM-02 | Visual/live | Add a correction to a charity in the Registry; confirm it appends (append-only), surfaces in the charity's list, and writes an audit row |
| Researcher re-reads corrections on a repeat charity | MEM-03 | Live pipeline | Run a repeat-charity pipeline run with a correction on file; confirm the pipeline log/output shows the Researcher read + injected the corrections |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0/1 covers the corrections table+mutation, coverage-strip endpoint, and the researcher read (via existing make_dedup_key)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
