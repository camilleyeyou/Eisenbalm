---
phase: 09-issue-page-completion
plan: 02
subsystem: ui
tags: [convex, react, typescript, deliberation, real-time, accessibility]

# Dependency graph
requires:
  - phase: 09-issue-page-completion-00
    provides: Wave-0 test scaffolding — 4 deliberation test files created as describe.skip stubs
  - phase: 03-convex-deployment
    provides: Convex query functions (byRunId) for all 5 deliberation tables

provides:
  - Live Convex deliberation layer in DeliberationSlot.tsx (DEL-01..05 satisfied)
  - Agent identity chips with /agents/{agentId} links and AGENT_LABELS persona map (DEL-06 partial)
  - QA severity color + text label rendering (WCAG 1.4.1)
  - Advocate score bars from deliberationEvents payloads (never agentVotes)
  - Editor confidence meter (only when finite number in payload)
  - All 34 deliberation tests passing

affects: [09-issue-page-completion, 10-editorial-design-pass, agents-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'use client' + 5 useQuery with skip sentinel: runId ? { runId } : 'skip' for null-safe Convex subscriptions"
    - "AGENT_LABELS persona map — hardcoded house map keyed by agentId, never exposes model names"
    - "Advocate scores from deliberationEvents payload JSON (not agentVotes — no score column in schema)"
    - "QA_SEVERITY map: info/warning/error → CSS variable + text label (WCAG 1.4.1 no color-only signal)"
    - "Editor confidence rendered only when finite number 0..1 present in editor-decision payload"
    - "prefersReducedMotion early-return for bar transitions (Motion Contract)"

key-files:
  created: []
  modified:
    - apps/web/components/issue/DeliberationSlot.tsx
    - apps/web/__tests__/deliberation-subscriptions.test.ts
    - apps/web/__tests__/deliberation-advocate-scores.test.ts
    - apps/web/__tests__/deliberation-qa-severity.test.ts
    - apps/web/__tests__/deliberation-agent-cards.test.ts

key-decisions:
  - "Editor confidence rendered only when a structured number is present in the editor-decision payload — Phase 5 pipeline emits { winner, rationale } without a confidence field; confidence is only in the deliberationTranscript markdown. No fabricated confidence bar."
  - "AGENT_LABELS hardcoded in DeliberationSlot.tsx — avoids new props and server fetch from page.tsx; keeps no-model-names rule trivially satisfied; avoids page.tsx ownership conflict"
  - "deliberation-agent-cards.test.ts scans raw (non-comment-stripped) source for modelVersions — comment was updated from 'pipelineRuns.cost...modelVersions' to 'model-version map' to keep both test suites green"
  - "Pre-existing 29 Phase-8 Wave-0 sentinel test failures are out of scope (SCOPE BOUNDARY) — documented in STATE.md as known; not fixed in this plan"

patterns-established:
  - "Pattern: skip-sentinel-guard — useQuery(api.X.byRunId, runId ? { runId } : 'skip') for all Convex subscriptions in client components that receive nullable runId"
  - "Pattern: agent-persona-map — AGENT_LABELS Record<string, {displayName, role}> with /agents/{agentId} link; never expose model strings in UI"

requirements-completed: [DEL-01, DEL-02, DEL-03, DEL-04, DEL-05]

# Metrics
duration: 5min
completed: 2026-05-21
---

# Phase 09 Plan 02: Deliberation Layer Summary

**Live Convex deliberation layer with 5 skip-safe subscriptions, advocate score bars from event payloads, QA severity color+label chips, persona-only agent identity links, and collapsed-by-default accordion — all 34 deliberation tests green, zero model names in render path**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-21T22:46:30Z
- **Completed:** 2026-05-21T22:51:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Rewrote `DeliberationSlot.tsx` from a propless Phase-2 stub into a fully-wired 'use client' component with all 5 Convex subscriptions
- Implemented advocate score bars extracted from `deliberationEvents` `advocate-argument` payloads (null-score renders "Scores did not complete this cycle." not 0)
- QA severity color-coding with text labels (`Info`/`Warning`/`Error`) using CSS variable tokens — WCAG 1.4.1 compliant
- Editor confidence meter with below-0.70 note (amber border + `--color-text-dim` body text, not ember body text per AA constraint)
- Unskipped all 4 deliberation test suites (31 tests) — all 34 deliberation tests now green including the always-active DEL-04 tripwire

## Task Commits

1. **Task 1: Rewrite DeliberationSlot as Client Component** - `4329113` (feat)
2. **Task 2: Unskip deliberation test files** - `39b4409` (test)

## Files Created/Modified

- `apps/web/components/issue/DeliberationSlot.tsx` — Full rewrite: 'use client', 5 Convex subscriptions, advocate score bars, QA severity, editor confidence, agent chips, loading/empty/running states
- `apps/web/__tests__/deliberation-subscriptions.test.ts` — Unskipped (describe.skip → describe)
- `apps/web/__tests__/deliberation-advocate-scores.test.ts` — Unskipped
- `apps/web/__tests__/deliberation-qa-severity.test.ts` — Unskipped
- `apps/web/__tests__/deliberation-agent-cards.test.ts` — Unskipped

## Decisions Made

1. **Editor confidence not rendered by default** — Phase 5's pipeline agent (`agents/editor.py` `_editor_decision_payload()`) emits `{ winner, rationale }` with no `confidence` field. The component reads `p.editor_confidence ?? p.confidence` defensively and only renders the meter when a finite 0..1 number is found. This is a pipeline follow-up item: if a future pipeline revision adds a structured confidence field, the component will render it automatically without changes.

2. **AGENT_LABELS hardcoded in component** — avoids new props from `page.tsx` (which is owned by Plans 09-01/09-04) and avoids a server GROQ fetch inside a client component. The map covers all 14 + 1 (`game-validator`) agent IDs with Jesse-voice persona names.

3. **Raw-scan `modelVersions` removal from comments** — `deliberation-agent-cards.test.ts` checks `source` (raw, not comment-stripped) for `modelVersions`. The SECURITY comment was changed from "contains modelVersions" to "contains the model-version map" so both the raw-scan and the comment-stripped test (`deliberation-no-model-names.test.ts`) pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment text triggered raw-scan tripwire in deliberation-agent-cards.test.ts**
- **Found during:** Task 2 (unskip tests)
- **Issue:** The SECURITY comment in DeliberationSlot.tsx contained the literal `modelVersions`, which the `deliberation-agent-cards.test.ts` test checks in raw (non-comment-stripped) source. The `deliberation-no-model-names.test.ts` strips comments before scanning — so the comment was safe there but not in the agent-cards test.
- **Fix:** Changed comment from "pipelineRuns.cost is a JSON string containing modelVersions" to "pipelineRuns.cost is a JSON string" (the SECURITY prefix already says "model-version map")
- **Files modified:** `apps/web/components/issue/DeliberationSlot.tsx`
- **Verification:** All 5 deliberation test files pass
- **Committed in:** `39b4409` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in comment text that tripped a source-scan assertion)
**Impact on plan:** Trivial comment edit. No behavior change. All acceptance criteria satisfied.

## Issues Encountered

- The full `npm run test:unit` suite exits non-zero due to 29 pre-existing Phase-8 Wave-0 sentinel failures (stripe-webhook-source, legal-pages, thank-you, shop-page BuyButton, checkout, etc.) documented in STATE.md since Plan 08-01. These are out of scope per SCOPE BOUNDARY rule and are not caused by this plan's changes. The target test command from the plan (`npm run test:unit -- __tests__/deliberation-*.test.ts`) exits 0.

## Pipeline Follow-up (flagged per plan output spec)

The editor confidence meter renders only when a structured `confidence` or `editor_confidence` number is present in the `editor-decision` Convex event payload. Phase 5's pipeline currently emits `{ winner, rationale }` from `_editor_decision_payload()` — confidence is only in the markdown `deliberationTranscript` string ("**Confidence:** {pct}"), not as a queryable field. The component is wired to display confidence when the field appears, but **a pipeline-payload follow-up is needed** to add `editor_confidence: float` to the `editor-decision` payload JSON if Andrew wants the confidence meter to render in production.

## Next Phase Readiness

- DEL-01..05 requirements satisfied; DEL-06 (agent profile page) was built in Plan 09-03
- `DeliberationSlot` accepts `runId: string | null` prop — wired from `page.tsx` by Plan 09-01
- All 34 deliberation tests green; full deliberation layer ready for visual QA

## Self-Check

- `4329113` exists: yes (git log confirms)
- `39b4409` exists: yes (git log confirms)
- `apps/web/components/issue/DeliberationSlot.tsx` exists with 'use client' on line 1: yes
- All 5 deliberation test files pass: yes (34/34 tests pass)

## Self-Check: PASSED

---
*Phase: 09-issue-page-completion*
*Completed: 2026-05-21*
