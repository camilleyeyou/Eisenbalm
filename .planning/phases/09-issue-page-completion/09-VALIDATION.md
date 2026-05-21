---
phase: 9
slug: issue-page-completion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` |
| **Full suite command** | `cd apps/web && npm run test:unit` (runs `vitest run` over `__tests__/`) |
| **Estimated runtime** | ~10 seconds (unit, no browser) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` (game security tripwire — must stay green after any GameSlot/issue-page change)
- **After every plan wave:** Run `cd apps/web && npm run test:unit` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Each requirement below maps to a Wave 0 test file the executor must keep green. The planner MUST attach the matching `<automated>` command to the task that delivers each requirement.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DEL-01 | All 5 Convex subscriptions wired, runId-null-safe (`"skip"` sentinel) | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts` | ❌ W0 | ⬜ pending |
| DEL-02 | Advocate score bars from `deliberationEvents` payload (NOT `agentVotes`); null-score fallback copy | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts` | ❌ W0 | ⬜ pending |
| DEL-02 | QA severity → color token map (info/warning/error); label always rendered (no color-only signal) | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-qa-severity.test.ts` | ❌ W0 | ⬜ pending |
| DEL-04 | No model names rendered — `modelVersions` / `cost` JSON never reaches render path | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts` | ❌ W0 | ⬜ pending |
| DEL-05 | Graceful empty state when runId null or no Convex data | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts` | ❌ W0 | ⬜ pending |
| DEL-06 | Agent identity card links to `/agents/[agentId]` (route exists, no 404) | unit + manual | `cd apps/web && npm run test:unit -- __tests__/deliberation-agent-cards.test.ts` | ❌ W0 | ⬜ pending |
| POD-01/02/03 | Audio player / collapsible transcript / "Audio coming soon" empty state | unit | `cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts` | ❌ W0 | ⬜ pending |
| GAM-01/03 | Game sandbox security — must remain green after any restyle | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` | ✅ EXISTS | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/deliberation-subscriptions.test.ts` — DEL-01, DEL-05 (useQuery `"skip"` sentinel; null-runId returns empty state, not error)
- [ ] `apps/web/__tests__/deliberation-advocate-scores.test.ts` — DEL-02 (score extracted from `deliberationEvents` payload for `advocate-argument`; null-score renders "Scores did not complete this cycle." not 0)
- [ ] `apps/web/__tests__/deliberation-qa-severity.test.ts` — DEL-02 (severity → color token mapping; text label always present)
- [ ] `apps/web/__tests__/deliberation-no-model-names.test.ts` — DEL-04 (source-scan: assert `modelVersions` / `cost` never read in `DeliberationSlot` render path)
- [ ] `apps/web/__tests__/deliberation-agent-cards.test.ts` — DEL-06 (agentId → `/agents/[agentId]` href construction; displayName/role rendered, no model string)
- [ ] `apps/web/__tests__/podcast-slot.test.ts` — POD-01, POD-02, POD-03 (audio element present when audioFile set; transcript disclosure; empty state when audioFile empty)

*Game sandbox infrastructure (`game-sandbox.test.ts`) already exists and covers GAM-01/03 — keep green, do not duplicate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deliberation events update in real time while pipeline runs (no refresh) | DEL-03 | Requires a live Convex deployment + a running pipeline emitting events; unit tests mock `useQuery` and cannot observe true subscription latency | With a `runId` that has live Convex data (or a manually-inserted `deliberationEvents` row), open the issue page, expand the accordion, and insert/update a Convex row via dashboard — confirm the UI updates within subscription latency without a page reload |
| Agent identity card navigates to the correct profile page | DEL-06 | Unit test verifies href construction; actual navigation + rendered profile is a visual/route check | Click an agent identity card; confirm it lands on `/agents/[agentId]` for that agent and renders the correct displayName/role |
| Accordion collapsed-by-default + score bars / severity colors render per UI-SPEC | DEL-01, DEL-02 | Visual conformance to the approved mockup is not unit-checkable | Load an issue with Convex data; confirm accordion is collapsed on load, expands to show score bars and severity-colored corrections matching `09-UI-SPEC.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (6 new test files)
- [ ] No watch-mode flags (use `vitest run`, never `vitest` watch)
- [ ] Feedback latency < ~10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
