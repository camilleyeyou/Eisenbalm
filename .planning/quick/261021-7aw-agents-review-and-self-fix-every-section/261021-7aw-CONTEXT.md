# Quick Task 261021-7aw: Agents review and self-fix every section; remove all content gates from publishing - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning

<domain>
## Task Boundary

The editor (Andrew) wants the agents to own review completely. Agents review every
section and fix problems themselves. Nothing content-related stops the editor
from publishing. If the editor dislikes something in the draft, they edit it by
hand. No "must fix", no "remix"/rewrite prompts in the editor's path.

Follow-up (separate task, NOT this one): simplify the dashboard so anyone can use it.
</domain>

<decisions>
## Implementation Decisions (locked by user)

### Agents fix problems themselves
- The pipeline auto-applies fixes BEFORE the draft reaches the editor:
  - QA (agents/qa) findings that carry a `suggestedFix` + resolvable `quotedSpan`
    are applied to the section text in state before the Sanity draft is written.
  - Voice-axis findings without a suggestedFix: agent generates the house-voice
    rewrite (reuse the existing voice-rewrite logic behind POST /issues/{runId}/voice-rewrite)
    and applies it.
  - Agent-contradicted claims (claim checks / verify.py): correct or remove the
    contradicted sentence before the draft is written.
  - Every auto-applied fix is recorded with a resolution (e.g. `resolution: "agent-applied"`)
    so the row is closed and serves as a read-only log of what the agents changed.
  - A fix that cannot be applied (span not found, ambiguous) must NOT block anything —
    mark it resolved as e.g. `agent-skipped`/logged, never leave an open blocker.
  - Failure of the self-fix step must never fail the run (degrade: log + continue).

### Review covers all 9 sections
- Currently QA covers 6 (origin_story, problem, founder_bio, case_study, game, bonus).
  Extend agent review to deliberation-conversation, podcast (transcript/show notes text),
  and theme (validate colors/fonts per the brief — hex + font-name validation; auto-correct
  invalid values to safe defaults).

### Nothing blocks Publish except role + hold
- KEEP: Editor-in-chief role gate, the hold switch, run must exist / have a Sanity issue
  (there must be content to publish), awaiting-review status sanity.
- REMOVE server gates: open error-finding gates (facts + voice) in api/signoffs.py,
  claims_not_signed_off gate, missing_signoffs gate in api/review.py publish_issue +
  schedule_issue, the sign-off re-validation in api/webhooks.py (~line 185).
  Sign-offs become non-required (keep the endpoint/table for compatibility; do not
  require them anywhere).
- REMOVE client gates: 'fix' footer state in apps/dispatch-control/lib/homeSections.ts,
  'not-ready' due to findings in derivePublishGate (lib/publishChain.ts); publishChain
  should no longer need to record sign-offs first (or record them best-effort without
  failing the publish). Same for DecisionRail / approval surfaces in the old console.

### No must-fix / remix UX in the editor path
- No "things to fix" row states/counts, no "N things to fix" sentences, no required
  Accept rewrite / Write my own / Keep prompts in the editor path (`(editorial)` routes
  `/` and `/s/[section]`). At most a quiet, read-only "what the agents changed" note.
- Keep backend tables (qaCorrections, claimChecks, signOffs) — do not delete schema.

### Claude's Discretion
- Exact resolution literal names (check Convex schema validators first; add literal if needed
  and remember Convex functions must be synced: `pnpm --filter @eisenbalm/convex dev:once`).
- Where in the graph the self-fix node sits (after QA, before Sanity draft write is the natural spot).
</decisions>

<specifics>
## Notes / Pitfalls
- Memory: vitest doesn't type-check — run `pnpm --filter dispatch-control build` (strict build) before done.
- Memory: Phase 34 retirement was half-done once — when removing gates, remove BOTH client and server
  sides and all callers (publish, schedule, publish-manual, webhook) so they don't drift.
- Update existing tests that assert the old gates (they will now be wrong) — change them to assert
  the new behavior, don't just delete coverage.
- Update docs/API_CONTRACTS.md sections that describe the removed gates.
</specifics>

<canonical_refs>
## Canonical References
- docs/API_CONTRACTS.md (§34.x sign-offs, §36.x voice, §51.1.8 claim gate)
- packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py, api/review.py, api/webhooks.py
- packages/pipeline/src/eisenbalm_pipeline/agents/qa/, agents/verify.py, graph/
- apps/dispatch-control/lib/homeSections.ts, lib/publishChain.ts, app/(editorial)/
</canonical_refs>
