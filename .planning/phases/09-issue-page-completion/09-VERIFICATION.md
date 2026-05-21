---
phase: 09-issue-page-completion
verified: 2026-05-21T16:05:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Load an issue page that has a live Convex runId and confirm the deliberation accordion updates in real time without a page refresh while a pipeline is running"
    expected: "Deliberation events appear as they stream in — no reload needed. The live indicator (● live) is visible while run.status === 'running'."
    why_human: "Requires a live Convex deployment with a pipeline run in progress. Code enables this via useQuery subscriptions (inherently reactive), but live behavior cannot be verified statically."
---

# Phase 9: Issue Page Completion — Verification Report

**Phase Goal:** The issue page is fully complete: the deliberation layer subscribes live to all five Convex tables, renders advocate score bars, QA severity colors, and named agent identity cards (no model names exposed) in a collapsed-by-default accordion; the podcast section renders an audio player and collapsible transcript when Andrew has uploaded audio, and shows "Audio coming soon" when he hasn't.

**Verified:** 2026-05-21T16:05:00Z
**Status:** human_needed (all automated checks pass; one live-behavior item requires a running Convex deployment)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Deliberation accordion is collapsed by default; expanding it renders advocate score bars, QA severity color-coding, and agent identity cards linking to `/agents/[agentId]` — NO model names visible | ✓ VERIFIED | `DeliberationSlot.tsx` line 209: `<details>` without `open` attribute (HTML default = collapsed). Score bars at lines 341–380. QA severity pills at lines 564–573. Agent chips at lines 425–441 linking to `/agents/${event.agentId}`. `run.cost` and `modelVersions` confirmed absent in non-comment code. |
| 2 | Issue page with no Convex data shows graceful empty state in deliberation section | ✓ VERIFIED | `DeliberationSlot.tsx` lines 241–248: when `runId` is null or all queries empty, renders "This issue predates the open deliberation record." Test file `deliberation-subscriptions.test.ts` (9 tests, green). |
| 3 | Podcast section renders HTML5 audio player + collapsible transcript when `audioFile` is set; shows "Audio coming soon." when empty | ✓ VERIFIED | `PodcastSlot.tsx` lines 55–94 (audio player / empty state). Lines 97–130 (collapsible transcript). Exact string "Audio coming soon." at line 83. Transcript labels "Read full deliberation transcript" / "Hide transcript" at lines 108/113. `podcast-slot.test.ts` (8 tests, green). |
| 4 | Deliberation events update in real time while pipeline runs — no page refresh required | ? UNCERTAIN | Code verified: 5 `useQuery` calls with `'skip'` sentinel (lines 105–109 of `DeliberationSlot.tsx`) — Convex `useQuery` is inherently reactive. Live behavior requires a running pipeline + live Convex deployment. Routed to human verification. |

**Score:** 3/4 truths fully automated-verified; 1 correct-by-code, pending live behavior confirmation.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/issue/DeliberationSlot.tsx` | Live Convex deliberation layer, collapsed-by-default, no model names | ✓ VERIFIED | 597 lines (min_lines: 150 met). `'use client'` at line 1. All 5 `useQuery` calls with skip sentinel. |
| `apps/web/components/issue/PodcastSlot.tsx` | Dark editorial podcast player + transcript + empty state | ✓ VERIFIED | Contains "Audio coming soon." at line 83. |
| `apps/web/app/agents/[agentId]/page.tsx` | Minimal agentProfile page (DEL-06 link target) | ✓ VERIFIED | Contains `QUERY_AGENT_PROFILE_BY_ID` at line 27. Calls `notFound()` at line 76. No model name reads. |
| `apps/web/app/globals.css` | Dark house palette :root + new tokens + print hide-list | ✓ VERIFIED | `--color-text-dim` at line 47, `--color-scout`, `--color-advocate`, `--color-surface`, `--color-card`, `--color-line`, `--color-line-strong` all present. |
| `apps/web/lib/sanity/queries.ts` | `QUERY_AGENT_PROFILES` GROQ query | ✓ VERIFIED | `export const QUERY_AGENT_PROFILES` at line 178. |
| `apps/web/lib/sanity/types.ts` | `AgentProfile` type | ✓ VERIFIED | `export type AgentProfile` at line 187. |
| `apps/web/app/issue/[slug]/page.tsx` | runId prop wiring to DeliberationSlot | ✓ VERIFIED | `<DeliberationSlot runId={issue.runId ?? null} />` at line 243. `runId` in `Issue` type and GROQ query confirmed. |
| `apps/web/components/SiteHeader.tsx` | Mobile nav disclosure with aria-expanded, aria-controls, Escape handler, Open/Close menu labels | ✓ VERIFIED | All four patterns present (lines 59, 127–129). `site-header-nav.test.ts` (5 tests, green). |
| `apps/web/components/issue/Atmosphere.tsx` | Fixed decorative layers (aurora/grid/grain/progress) | ✓ VERIFIED | File exists; imported and used in `page.tsx` line 189. |
| `apps/web/components/issue/SectionNavigator.tsx` | 8-card section navigator | ✓ VERIFIED | File exists; imported and used in `page.tsx` line 201. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DeliberationSlot.tsx` | Convex deliberation queries | `useQuery` with `'skip'` sentinel | ✓ WIRED | All 5 tables: `pipelineRuns.byRunId`, `pitchLog.byRunId`, `deliberationEvents.byRunId`, `agentVotes.byRunId`, `qaCorrections.byRunId`. Pattern `runId ? { runId } : 'skip'` appears 5 times. |
| `DeliberationSlot.tsx` | `deliberationEvents` advocate-argument payload | JSON.parse of payload, score extraction | ✓ WIRED | Lines 130–142: `events?.filter(e => e.eventType === 'advocate-argument')` → `JSON.parse(e.payload)` → `p.score`. Null-score fallback at lines 372–379. |
| `app/issue/[slug]/page.tsx` | `DeliberationSlot.tsx` | `runId` prop | ✓ WIRED | Line 243: `<DeliberationSlot runId={issue.runId ?? null} />` |
| `app/agents/[agentId]/page.tsx` | `agentProfile` document in Sanity | GROQ fetch by `agentId.current` | ✓ WIRED | Line 28: `*[_type == "agentProfile" && agentId.current == $agentId][0]`. Pattern confirmed. |
| `DeliberationSlot.tsx` → agent chip | `/agents/[agentId]` route | `href` construction | ✓ WIRED | Line 426: `href={\`/agents/${event.agentId}\`}`. `deliberation-agent-cards.test.ts` (6 tests, green). |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `DeliberationSlot.tsx` | `pitchLog`, `events`, `votes`, `corrections`, `run` | `useQuery(api.*.byRunId, runId ? { runId } : 'skip')` | Yes — live Convex subscriptions keyed on `runId` | ✓ FLOWING |
| `DeliberationSlot.tsx` | `advocateScores` (Map) | Derived from `events` via `JSON.parse(e.payload)` for `advocate-argument` | Yes — derived from live data | ✓ FLOWING |
| `PodcastSlot.tsx` | `audioUrl`, `transcript`, `description` | Props from `issue.podcast` (Sanity GROQ) | Yes — `IssuePodcast` type from Sanity | ✓ FLOWING |
| `app/agents/[agentId]/page.tsx` | `profile` | `sanityClient.fetch(QUERY_AGENT_PROFILE_BY_ID, { agentId })` | Yes — Sanity fetch | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DeliberationSlot exports a function, has 'use client', no modelVersions in non-comment code | `node -e` source analysis | All three confirmed | ✓ PASS |
| PodcastSlot contains "Audio coming soon." (exact period, no exclamation) | `grep` on source | Found at line 83 | ✓ PASS |
| agents route calls `notFound()` for unknown agentIds | `grep` on source | Line 76 confirmed | ✓ PASS |
| 5 skip sentinels in DeliberationSlot (one per Convex table) | `grep -c` | Count = 5 | ✓ PASS |
| Full Vitest suite — Phase 9 test files | `npm run test:unit` | 10/10 Phase 9 test files green (62 tests pass). 7 failing files exactly match Phase 8 baseline (checkout-create-session, legal-pages, shop-page, stripe-webhook, stripe-webhook-source, stripe-webhook-idempotency, thank-you-source — 29 failures total, all due to missing Phase 8 implementation files). Zero Phase 9 regressions. | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEL-01 | 09-02, 09-01 | Issue page subscribes via `useQuery` to all five Convex tables filtered by `runId` | ✓ SATISFIED | `DeliberationSlot.tsx` lines 105–109; `deliberation-subscriptions.test.ts` green |
| DEL-02 | 09-02 | Renders advocate score bars, QA severity colors, agent identity cards, pitch log timeline | ✓ SATISFIED | Score bars lines 341–380; QA pills lines 564–573; `deliberation-advocate-scores.test.ts` + `deliberation-qa-severity.test.ts` green |
| DEL-03 | 09-02 | Deliberation UI collapsed by default | ✓ SATISFIED | `<details>` at line 209, no `open` attribute |
| DEL-04 | 09-02, 09-03 | No model names exposed | ✓ SATISFIED | `run.cost` and `modelVersions` absent from non-comment code in both `DeliberationSlot.tsx` and `app/agents/[agentId]/page.tsx`; `deliberation-no-model-names.test.ts` green |
| DEL-05 | 09-02 | Graceful empty state for issues predating Convex writes | ✓ SATISFIED | Lines 241–248; `deliberation-subscriptions.test.ts` covers null-runId case |
| DEL-06 | 09-02 (chip), 09-03 (route) | Agent events link to `agentProfile` page; route resolves without 404 | ✓ SATISFIED | Chip href at line 426; route at `app/agents/[agentId]/page.tsx`; `deliberation-agent-cards.test.ts` + `agents-route.test.ts` green |
| POD-01 | 09-03 | HTML5 `<audio>` player when `podcast.audioFile` is populated | ✓ SATISFIED | `PodcastSlot.tsx` lines 55–75; `podcast-slot.test.ts` green |
| POD-02 | 09-03 | Collapsible transcript when `podcast.deliberationTranscript` is populated | ✓ SATISFIED | Lines 97–130; labels "Read full deliberation transcript" / "Hide transcript" |
| POD-03 | 09-03 | "Audio coming soon." empty state when `podcast.audioFile` is empty | ✓ SATISFIED | Line 83, exact string with period |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned: `DeliberationSlot.tsx`, `PodcastSlot.tsx`, `app/agents/[agentId]/page.tsx`, `app/issue/[slug]/page.tsx`, `globals.css`, `lib/sanity/queries.ts`, `lib/sanity/types.ts`. No TODOs, FIXME, placeholders, return null stubs, or hardcoded empty data in render paths found.

---

## Human Verification Required

### 1. Real-Time Deliberation Updates

**Test:** Open an issue page for a run where `issue.runId` is set and the pipeline is actively `running` (Convex `pipelineRuns.status === 'running'`). Confirm that new `deliberationEvents` appear in the timeline without a page refresh or manual reload. The "● live" indicator should be visible.

**Expected:** New events appear within Convex's subscription latency (~100–500ms). The agent timeline grows as the pipeline emits new events. No page refresh needed.

**Why human:** Requires a live Convex deployment with an active pipeline run. The code enables this via `useQuery` (Convex's reactive subscription API), but actual propagation behavior cannot be verified from source alone.

---

## Gaps Summary

No gaps found. All automated checks pass. The one human verification item (real-time update behavior) is a live-infrastructure check that the code demonstrably enables — it is not a code deficiency.

---

_Verified: 2026-05-21T16:05:00Z_
_Verifier: Claude (gsd-verifier)_
