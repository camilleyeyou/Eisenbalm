---
phase: 28-prompt-console
plan: 04
subsystem: dispatch-control (prompt authoring console)
tags: [frontend, authoring-loop, voice-score, test-run, compare]
requires:
  - "Plan 03: POST /agents/{key}/score endpoint + API_CONTRACTS §3A.2"
  - "Phase 24: TestRunPanel + testRunClient + /agents/{key}/test-run"
  - "convex/promptVersions.getActive (active-row read)"
provides:
  - "scoreClient.scoreOutput — typed client for POST /agents/{key}/score (§3A.2)"
  - "testRunClient.runActiveVersionTest — on-demand active-version run helper"
  - "testRunClient.pipelineBaseUrl — exported shared base URL"
  - "TestRunPanel: draft voice-score + compare-against-active side-by-side + score delta"
affects:
  - "apps/dispatch-control /prompts/[agentKey] authoring loop"
tech-stack:
  added: []
  patterns:
    - "Mirror testRunClient fetch+bearer+error shape for sibling pipeline clients"
    - "Advisory-only scoring: score errors non-fatal; no disabled state references a score"
    - "On-demand compare preserves the 1x default (D-07): only handleCompare runs active"
key-files:
  created:
    - apps/dispatch-control/lib/scoreClient.ts
    - apps/dispatch-control/__tests__/scoreClient.test.ts
  modified:
    - apps/dispatch-control/lib/testRunClient.ts
    - apps/dispatch-control/app/(dashboard)/prompts/_components/TestRunPanel.tsx
decisions:
  - "Shared pipelineBaseUrl exported from testRunClient (DRY) rather than duplicated"
  - "ResultColumn extracted so Draft/Active sides reuse identical output/cost/score markup"
  - "Default Run clears any stale compare side → layout returns to single-column"
metrics:
  duration_min: 4
  tasks: 2
  files: 4
  completed: 2026-06-24
---

# Phase 28 Plan 04: Side-by-Side Compare + Score UI Summary

Completed the prompt-console authoring loop (PRC-08, PRC-09): every draft
test-run is now scored against the live voice rubric (per-axis breakdown +
overall headline + 1–2 line rationale), and a new "Compare against active"
action runs the active version's prompt on demand and renders both outputs +
real cost/token counts side-by-side with a signed voice-score delta. The score
is strictly advisory — it never gates any action.

## What shipped

**Task 1 — `scoreClient.ts` + active-version run helper** (`a140166`)
- `scoreClient.scoreOutput(agentKey, output, token)` POSTs to
  `/agents/{key}/score` with body `{ workspace_id: 'eisenbalm', agent_key, output }`,
  parsing the §3A.2 `ScoreResult` (`overall`, `axes[]`, `rationale`,
  `rubric_source`, cost fields). Mirrors `runAgentTest`'s bearer + non-ok error shape.
- `pipelineBaseUrl()` is now exported from `testRunClient.ts` and shared by
  `scoreClient` (single env-resolution path).
- `runActiveVersionTest(agentKey, activeContent, body, token)` added additively —
  a thin wrapper that runs the active version's content as `draft_prompt`.
  `runAgentTest`'s signature is unchanged.
- Fetch-mocked unit test (3 cases): URL/method/body assertion, bearer-omission
  when token null, and status+detail error propagation. Green.

**Task 2 — `TestRunPanel` extension** (`f502eb9`)
- Subscribes to `api.promptVersions.getActive({ workspace_id, agentKey })` for the
  compare side.
- Default **Run** scores the draft output (PRC-09) and renders a score block:
  overall headline, per-axis list (axis · score · pass/flag dot · note),
  rationale, and a `rubric: {source} · advisory — does not gate` caption. Score
  failures are non-fatal ("scoring unavailable — output still shown").
- **Compare against active** (PRC-08, D-07) runs the active version via
  `runActiveVersionTest`, scores it, and switches to a 2-column `Draft` / `Active`
  layout reusing the shared `ResultColumn` (output + cost `<dl>` + score).
- Score **delta** headline (`draft.overall − active.overall`, signed, "vs active")
  shows when both sides scored (D-08).
- The default Run stays 1× — `runActiveVersionTest` is invoked ONLY by
  `handleCompare`. No `disabled` expression references a score (advisory-only).
- New buttons have `min-h-[44px]` + focus-visible rings.

## Deviations from Plan

None — plan executed as written.

Minor implementation choices within plan discretion: exported `pipelineBaseUrl`
(the plan's "keep DRY if easy" option) and extracted a `ResultColumn` helper so
both sides share identical markup. The default Run also clears any stale compare
state so the layout collapses back to single-column on a fresh run.

## Verification

- `pnpm --filter dispatch-control test -- scoreClient` → 3 passed.
- `pnpm --filter dispatch-control build` (strict, next build) → passed; `/prompts/[agentKey]` route compiles.
- All Task 1 + Task 2 acceptance greps pass; `runActiveVersionTest` call site is
  uniquely inside `handleCompare`.

Manual sanity (visual draft-score + side-by-side compare + delta) requires the
Plan-03 endpoint reachable via `NEXT_PUBLIC_PIPELINE_URL` at runtime — deferred
to Andrew's environment per the existing pipeline-URL caveat (MEMORY:
dispatch-control Phase 24 runtime).

## Known Stubs

None.

## Self-Check: PASSED

All created files exist on disk; both per-task commits (a140166, f502eb9) are in git history.
