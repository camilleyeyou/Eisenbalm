---
phase: 9
slug: issue-page-completion
status: planned
nyquist_compliant: true
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

Task IDs are assigned by the planner. Each requirement below maps to a Wave 1 (test scaffold) test file the executor must keep green. The planner MUST attach the matching `<automated>` command to the task that delivers each requirement.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status | Delivered by |
|-------------|----------|-----------|-------------------|-------------|--------|--------------|
| DEL-01 | All 5 Convex subscriptions wired, runId-null-safe (`"skip"` sentinel) | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-02 |
| DEL-02 | Advocate score bars from `deliberationEvents` payload (NOT `agentVotes`); null-score fallback copy | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-02 |
| DEL-02 | QA severity → color token map (info/warning/error); label always rendered (no color-only signal) | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-qa-severity.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-02 |
| DEL-04 | No model names rendered — `modelVersions` / `cost` JSON never reaches render path | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-02 |
| DEL-05 | Graceful empty state when runId null or no Convex data | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-02 |
| DEL-06 (chip) | Agent identity chip in DeliberationSlot builds `/agents/[agentId]` href; displayName/role; no model string | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/deliberation-agent-cards.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-02 (chip href) |
| DEL-06 (route) | `/agents/[agentId]` route file uses agent-profile query, calls `notFound(`, exposes NO model name, never reads `.cost` | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/agents-route.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-03 (route) |
| LOCKED mobile-nav | SiteHeader disclosure: `aria-expanded`/`aria-controls`, Escape handler, `Open menu`/`Close menu` aria-labels (mobile nav must NOT disappear) | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/site-header-nav.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-04 |
| POD-01/02/03 | Audio player / collapsible transcript / "Audio coming soon" empty state | unit | `cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-03 |
| AA tones | House secondary tones pass AA against `#0C0B0A` | unit | `cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts` | ✅ (Plan 09-00) | ⬜ pending | Plan 09-01 |
| GAM-01/03 | Game sandbox security — must remain green after any restyle | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` | ✅ EXISTS | ⬜ pending | preserved by Plans 09-02/09-04/09-05 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 1 (test scaffold) Requirements (all authored in Plan 09-00)

> Note: Plan 09-00 frontmatter is `wave: 1`. The GSD executor coerces `wave: 0` to `1`
> (`parseInt('0') || 1`), so this scaffold runs in Wave 1 alongside Plan 09-01. "Wave 0"
> as a label here means the test-scaffold wave; on disk it is Wave 1.

- [ ] `apps/web/__tests__/deliberation-subscriptions.test.ts` — DEL-01, DEL-05 (useQuery `"skip"` sentinel; null-runId returns empty state, not error)
- [ ] `apps/web/__tests__/deliberation-advocate-scores.test.ts` — DEL-02 (score extracted from `deliberationEvents` payload for `advocate-argument`; null-score renders "Scores did not complete this cycle." not 0)
- [ ] `apps/web/__tests__/deliberation-qa-severity.test.ts` — DEL-02 (severity → color token mapping; text label always present)
- [ ] `apps/web/__tests__/deliberation-no-model-names.test.ts` — DEL-04 (source-scan: assert `modelVersions` / `cost` never read in `DeliberationSlot` render path)
- [ ] `apps/web/__tests__/deliberation-agent-cards.test.ts` — DEL-06 CHIP side (agentId → `/agents/[agentId]` href construction in DeliberationSlot; displayName/role rendered, no model string)
- [ ] `apps/web/__tests__/agents-route.test.ts` — DEL-06 ROUTE side (source-scan `app/agents/[agentId]/page.tsx`: uses `QUERY_AGENT_PROFILE_BY_ID`/`QUERY_AGENT_PROFILES`, calls `notFound(`, no model-name literal, never reads `.cost`). `describe.skip` until Plan 09-03 creates the route; readFileSync inside the skip callback (route file does not exist at scaffold time)
- [ ] `apps/web/__tests__/site-header-nav.test.ts` — LOCKED mobile-nav disclosure (source-scan `components/SiteHeader.tsx`: `aria-expanded`, `aria-controls`, an Escape handler `'Escape'`, both `Open menu`/`Close menu` aria-labels). `describe.skip` until Plan 09-04 adds the disclosure
- [ ] `apps/web/__tests__/podcast-slot.test.ts` — POD-01, POD-02, POD-03 (audio element present when audioFile set; transcript disclosure; empty state when audioFile empty)
- [ ] `apps/web/__tests__/theme-aa-tones.test.ts` — WCAG AA constraint (import `contrastRatio` from `lib/theme.ts`; assert each house tone ≥ 4.5:1 on `#0C0B0A`; ember 3.0–4.5 large-only; #615B4D < 4.5 regression guard)

*Game sandbox infrastructure (`game-sandbox.test.ts`) already exists and covers GAM-01/03 — keep green, do not duplicate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deliberation events update in real time while pipeline runs (no refresh) | DEL-03 | Requires a live Convex deployment + a running pipeline emitting events; unit tests mock `useQuery` and cannot observe true subscription latency | With a `runId` that has live Convex data (or a manually-inserted `deliberationEvents` row), open the issue page, expand the accordion, and insert/update a Convex row via dashboard — confirm the UI updates within subscription latency without a page reload |
| Agent identity card navigates to the correct profile page | DEL-06 | Unit test verifies href construction; actual navigation + rendered profile is a visual/route check | Click an agent identity card; confirm it lands on `/agents/[agentId]` for that agent and renders the correct displayName/role |
| Accordion collapsed-by-default + score bars / severity colors render per UI-SPEC | DEL-01, DEL-02 | Visual conformance to the approved mockup is not unit-checkable | Load an issue with Convex data; confirm accordion is collapsed on load, expands to show score bars and severity-colored corrections matching `09-UI-SPEC.md` |
| Mobile nav disclosure operable; reduced-motion honored; AA tones in situ | LOCKED constraints | Visual/interaction conformance | At ≤960px confirm hamburger opens/closes the menu (keyboard + Escape); with reduced-motion enabled confirm no aurora/grain/count-up animation and no content trapped invisible |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 1 (test scaffold) dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 1 (test scaffold) covers all MISSING references (9 new test files authored in Plan 09-00 — incl. agents-route.test.ts for the DEL-06 route deliverable and site-header-nav.test.ts for the LOCKED mobile-nav disclosure)
- [x] No watch-mode flags (use `vitest run`, never `vitest` watch)
- [x] Feedback latency < ~10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-confirmed 2026-05-21 (revised 2026-05-21: added agents-route + site-header-nav guards; reconciled Wave-0→Wave-1 label)
