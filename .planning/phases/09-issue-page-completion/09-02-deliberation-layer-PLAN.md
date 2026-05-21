---
phase: 09-issue-page-completion
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/web/components/issue/DeliberationSlot.tsx
autonomous: true
requirements: [DEL-01, DEL-02, DEL-03, DEL-04, DEL-05]
must_haves:
  truths:
    - "DeliberationSlot subscribes via useQuery to all 5 Convex tables keyed on runId, using the \"skip\" sentinel when runId is null"
    - "Collapsed by default; expands to a two-column pitch-log + timeline layout"
    - "Advocate scores come from deliberationEvents advocate-argument payloads; null scores render the fallback copy, never 0"
    - "QA corrections render with severity color AND a text label (no color-only signal)"
    - "Editor confidence renders gracefully whether or not a structured confidence number is available"
    - "No model name or modelVersions/cost ever reaches the render path"
    - "Empty state renders when runId is null or all queries are empty; never an error or broken UI"
  artifacts:
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "Live Convex deliberation layer, collapsed-by-default, no model names"
      contains: "'use client'"
      min_lines: 150
  key_links:
    - from: "apps/web/components/issue/DeliberationSlot.tsx"
      to: "convex deliberation queries"
      via: "useQuery with skip sentinel"
      pattern: "runId \\? \\{ runId \\} : ['\"]skip['\"]"
    - from: "apps/web/components/issue/DeliberationSlot.tsx"
      to: "deliberationEvents advocate-argument payload"
      via: "JSON.parse of payload, score extraction"
      pattern: "advocate-argument"
---

<objective>
Rewrite DeliberationSlot.tsx from a propless stub into the live Convex deliberation layer (DEL-01..05). It subscribes to all five Convex tables keyed on `issue.runId`, renders the collapsed-by-default two-column layout (pitch log + timeline), advocate score bars, QA severity color-coding, the editor confidence treatment, agent identity chips, and all loading/empty/error states — with NO model names anywhere.

This is the functional heart of Phase 9. It is its own plan because the Convex subscription + payload-parsing + no-model-names security surface consumes meaningful context and must not be diluted.

Purpose: Readers see exactly how each issue was made — pitch log, advocate scoring, QA findings, editor confidence — bound to live data, gracefully empty for pre-Convex issues.
Output: A fully wired `DeliberationSlot.tsx` (Client Component, `<details>`-collapsed) and the four deliberation-* test files turned green (unskipped).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/09-issue-page-completion/09-UI-SPEC.md
@.planning/phases/09-issue-page-completion/09-RESEARCH.md
@.planning/phases/09-issue-page-completion/09-VALIDATION.md
@.claude/skills/convex-performance-audit

<interfaces>
<!-- SOURCE OF TRUTH for the five Convex query shapes: convex/schema.ts.
     All five byRunId queries take { runId: string } (v.string, NOT optional)
     and are deployed. Passing undefined/null throws → use the "skip" sentinel. -->

Convex query hooks (from '@convex/_generated/api', via useQuery from 'convex/react'):
  api.pitchLog.byRunId         → returns rows: { _id, runId, charityId?, charityName, charityLocation, charityWebsite?, assetRange?, focusArea?, scoutSummary, selected: boolean, timestamp }[] | undefined
  api.deliberationEvents.byRunId → rows: { _id, runId, agentId, eventType, payload: string, charityId?, sectionName?, timestamp }[] | undefined  (ordered asc)
  api.agentVotes.byRunId       → rows: { _id, runId, agentId, charityId, charityName, vote: 'for'|'against'|'abstain', reasoning, timestamp }[] | undefined   (NO score field)
  api.qaCorrections.byRunId    → rows: { _id, runId, agentId?, sectionName, reason, severity: 'info'|'warning'|'error', accepted, axis?, quotedSpan?, suggestedFix?, ... }[] | undefined
  api.pipelineRuns.byRunId     → single row | null | undefined: { _id, runId, issueNumber, status: 'running'|'awaiting-review'|'complete'|'failed', startedAt, completedAt?, errorMessage?, durationMs?, cost?, awaitingHumanAt? }
    ⚠️ pipelineRuns.cost is a JSON string containing modelVersions — NEVER read it.

Null-runId guard (CANONICAL — research §Architecture Patterns; convex-performance-audit skill subscription-cost.md):
  const pitchLog = useQuery(api.pitchLog.byRunId, runId ? { runId } : 'skip')
  ...one per table. When runId is null, ALL skip → no subscription, returns undefined.

Advocate score extraction (research §Pitfall 2; API_CONTRACTS §3 advocate-argument payload):
  Scores are NOT on agentVotes. Parse deliberationEvents where eventType === 'advocate-argument':
    payload JSON = { charityName: string, argument: string, score: number | null }
  score may be null (real Issue 999) → render "Scores did not complete this cycle." NOT 0.

Editor confidence — IMPORTANT CODEBASE FINDING (overrides orchestrator decision #3's assumption):
  The Phase 5 editor agent emits the 'editor-decision' deliberationEvents payload as
  { winner: string, rationale: string } — see packages/pipeline/.../agents/editor.py
  _editor_decision_payload(). It does NOT persist a structured `editor_confidence`
  number to Convex. Confidence (0.0-1.0) lives only inside the markdown
  `deliberationTranscript` ("**Confidence:** {pct}"), not as a queryable field.
  THEREFORE: attempt to read `editor_confidence` OR `confidence` from the parsed
  editor-decision payload defensively (in case a later pipeline revision adds it),
  and ONLY render the confidence meter + below-threshold note when a finite number
  0..1 is found. When absent, render the editor decision (winner + rationale) WITHOUT
  a fabricated confidence bar. Never invent a number.

QA severity → color (research §Code Examples; convex/schema.ts truth — NOT API_CONTRACTS §3.6):
  const QA_SEVERITY = {
    info:    { color: 'var(--color-text-dim)', label: 'Info' },
    warning: { color: 'var(--color-primary)',  label: 'Warning' },
    error:   { color: 'var(--color-accent)',   label: 'Error' },
  }
  ALWAYS render the label too (WCAG 1.4.1 — color is never the only signal).

Agent identity colors (UI-SPEC §Agent identity colors — house, not themed):
  scout → var(--color-scout); advocate → var(--color-advocate); editor → var(--color-primary).
  Any other agentId → neutral chip: var(--color-text-dim) text on color-mix(var(--color-text) 8%, transparent) bg.
  Cards/chips show agentProfile.displayName + role and LINK to /agents/{agentId} (DEL-06; Plan 09-03 builds that route).
  agentProfile data comes from QUERY_AGENT_PROFILES — fetch it where? DeliberationSlot is a Client Component, so
  it cannot await a server GROQ fetch. Pass agentProfiles as a prop from page.tsx? page.tsx is owned by Plan 09-04
  this wave. To avoid a page.tsx file conflict, this plan's DeliberationSlot fetches profiles client-side via the
  sanity client OR derives the display label from a hardcoded house map keyed by agentId. USE the hardcoded house
  AGENT_LABELS map (calibrator/scout/advocate/editor/researcher/origin-story/problem-statement/founder-bio/case-study/
  game/bonus/design/qa/publisher → displayName + role) so DeliberationSlot needs ZERO new props and ZERO server fetch.
  The link href is always /agents/{agentId} (the agentId from the Convex row). This keeps the no-model-names rule
  trivially satisfied (the map contains only personas) and avoids the page.tsx ownership conflict with Plan 09-04.

Collapse shell (DEL-03 — keep the existing <details>/<summary> pattern):
  <section id="deliberation" className="...site-nav-excluded... print:hidden">
    <details className="deliberation-slot group">
      <summary> "How this issue was made" + AnchorCopyButton + chevron </summary>
      {/* two-column body */}
    </details>
  </section>
  (AnchorCopyButton import: '@/components/AnchorCopyButton', prop is sectionId="deliberation".)

Reduced-motion for the confidence count-up (UI-SPEC §Motion Contract; research §Confidence meter):
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  If reduced: set the final fill width immediately, no count-up. Else: count-up is OPTIONAL — a CSS width
  transition on the bar is sufficient and is already neutralized by the globals.css reduced-motion guard.
  Do NOT trap any element at opacity:0 with no fallback.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite DeliberationSlot as a Client Component with all 5 Convex subscriptions, payload parsing, and the no-model-names guarantee</name>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (the stub being replaced)
    - apps/web/components/issue/GameSlot.tsx (CANONICAL 'use client' + Convex hook + runId-null guard pattern — mirror its structure and security comments)
    - convex/schema.ts (the 5 table shapes — TRUTH for field names; agentVotes has NO score; QA severity is info|warning|error)
    - convex/deliberationEvents.ts, convex/pitchLog.ts, convex/agentVotes.ts, convex/qaCorrections.ts, convex/pipelineRuns.ts (byRunId return shapes)
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py lines 227-242 (_editor_decision_payload → confirms editor-decision payload is { winner, rationale }, NO confidence field)
    - docs/API_CONTRACTS.md §3 (advocate-argument payload = { charityName, argument, score })
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Deliberation Contract; §Color QA severity; §Agent identity colors; §Copywriting Contract for exact strings)
    - apps/web/__tests__/deliberation-no-model-names.test.ts (the DEL-04 tripwire this code must satisfy)
  </read_first>
  <files>apps/web/components/issue/DeliberationSlot.tsx</files>
  <action>
Replace the entire file. Start with `'use client'` on line 1. Imports: `useQuery` from `'convex/react'`, `api` from `'@convex/_generated/api'`, `AnchorCopyButton` from `'@/components/AnchorCopyButton'`, React hooks as needed.

Props: `type Props = { runId: string | null }`. Export `function DeliberationSlot({ runId }: Props)`.

Subscriptions (DEL-01) — all five, each with the `"skip"` sentinel:
```tsx
const run         = useQuery(api.pipelineRuns.byRunId,       runId ? { runId } : 'skip')
const pitchLog    = useQuery(api.pitchLog.byRunId,          runId ? { runId } : 'skip')
const events      = useQuery(api.deliberationEvents.byRunId, runId ? { runId } : 'skip')
const votes       = useQuery(api.agentVotes.byRunId,        runId ? { runId } : 'skip')
const corrections = useQuery(api.qaCorrections.byRunId,     runId ? { runId } : 'skip')
```

State derivation:
- `isLoading` = `runId != null && [run, pitchLog, events, votes, corrections].some(q => q === undefined)`
- `isEmpty` = `!runId || (pitchLog?.length === 0 && events?.length === 0 && votes?.length === 0 && corrections?.length === 0 && !run)`

Advocate scores (DEL-02) — extract from events, NEVER from votes:
```tsx
const advocateScores = new Map<string, number | null>()
events?.filter(e => e.eventType === 'advocate-argument').forEach(e => {
  try {
    const p = JSON.parse(e.payload) as { charityName?: string; score?: number | null }
    if (p.charityName) advocateScores.set(p.charityName, typeof p.score === 'number' ? p.score : null)
  } catch { /* malformed payload — skip */ }
})
```
Render one 0–10 horizontal bar per pitch-log candidate. Look up the score by `card.charityName`. If the score is `null` OR not present, render the copy literal `Scores did not complete this cycle.` in `--color-text-dim` and NO bar (never width 0 as if zero). The bar fill uses `--color-primary` (gradient ember→primary acceptable); width = `(score/10)*100%`.

Editor decision + confidence (DEL — graceful):
```tsx
const editorEvent = events?.find(e => e.eventType === 'editor-decision')
let winner: string | null = null, rationale: string | null = null, confidence: number | null = null
if (editorEvent) {
  try {
    const p = JSON.parse(editorEvent.payload) as Record<string, unknown>
    winner = typeof p.winner === 'string' ? p.winner : null
    rationale = typeof p.rationale === 'string' ? p.rationale : null
    const c = (p.editor_confidence ?? p.confidence)
    confidence = typeof c === 'number' && c >= 0 && c <= 1 ? c : null
  } catch { /* skip */ }
}
```
Render the winner + rationale. Render the confidence meter ONLY when `confidence !== null`: a labeled bar with fill width `${confidence*100}%`, value text `${Math.round(confidence*100)}%`. If `confidence < 0.70`, render the below-threshold note. The note TEXT must be `Below 0.70 threshold — human review flagged.` styled with `--color-text-dim` at body size (NOT ember body text — ember is AA-large-only), with an ember (`--color-accent`) left border or icon only. (Pitfall 5.)

Pitch log cards (DEL-02, left column) — one card per `pitchLog` row: charityName (display), charityLocation + scoutSummary (`--color-text-dim`). When `card.selected === true`, add a `--color-primary` left border + glow class and a text badge `★ Selected this week`; otherwise a `Runner-up` text badge. The selected/runner-up state MUST carry a text label, not color alone.

Timeline (DEL-02, right column) — map `events` (already asc) into a vertical timeline. For each event, render an agent identity chip + a short line of copy parsed from `payload` per `eventType`:
- scout-finding → "{charityName} — surfaced"
- advocate-argument → "{charityName}: scored" (+ the bar handled above, or inline)
- editor-decision → "Selected {winner}"
- section-draft → "{sectionName} drafted"
- qa-correction / editor-final / publisher-deploy → a neutral one-liner
Wrap every `JSON.parse` in try/catch; on parse failure render a neutral "Event recorded" line — never crash.

QA corrections (DEL-02) — map `corrections` rows. Define the QA_SEVERITY map exactly as in <interfaces>. Each row shows: sectionName, reason, and a severity pill that renders BOTH the color (`style={{ color: QA_SEVERITY[sev].color }}`) AND the text label `{QA_SEVERITY[sev].label}`. Do NOT use `minor`/`moderate`/`major` anywhere.

Agent identity chips (DEL-02 partial; DEL-06 link target built in 09-03) — define a module-level `AGENT_LABELS: Record<string, { displayName: string; role: string }>` covering the 14 agentIds (calibrator, scout, advocate, editor, researcher, origin-story, problem-statement, founder-bio, case-study, game, bonus, design, qa, publisher) plus the `game-validator` synthetic id used by GameSlot. Use Jesse-voice persona names (e.g. scout → "The Scout"). For an unknown agentId, fall back to a Title-Cased version of the id. The chip is wrapped in an anchor: `<a href={`/agents/${agentId}`} ...>` showing `displayName` (and `role` as secondary). Color the chip per the agent-identity-color rule (scout/advocate/editor → their tokens; else neutral). NEVER render any model string. (DEL-04.)

NO-MODEL-NAMES (DEL-04 — SECURITY): Do NOT read `run.cost`. Do NOT parse `modelVersions`. Do NOT reference `run` for anything except `run.status` (for the live dot) and existence. Add an explicit comment: `// DEL-04: pipelineRuns.cost is a JSON string containing modelVersions — never read.` The source-scan test deliberation-no-model-names.test.ts strips comments before scanning, so even the comment's "modelVersions" mention is fine — but write the comment to mention it as cost, e.g. `// SECURITY: never read run.cost (it contains the model-version map).` Keep it OUT of the code path.

Collapse + states (DEL-03, DEL-05):
- Outer `<section id="deliberation" className="... print:hidden">` (keep print:hidden + a `deliberation-slot` class for the print hide-list; the section also adds the `section-navigator`-unrelated dark styling via Tailwind/`--color-*` tokens).
- `<details className="deliberation-slot group">` collapsed by default; `<summary>` = `How this issue was made` + `<AnchorCopyButton sectionId="deliberation" />` + a chevron that rotates on `group-open` (transition neutralized by the reduced-motion guard).
- Inside the expanded body: render in priority order — `isLoading` → `<p>Loading the deliberation.</p>`; else `isEmpty` → `<p>This issue predates the open deliberation record.</p>`; else the two-column grid (left: deliberation intro + pitch log cards with score bars; right: timeline + editor confidence + QA corrections). If `run?.status === 'running'`, show a small text "live" indicator on the column label (text, not color-only).
- Two-column grid: Tailwind `grid` with `lg:grid-cols-[...]`, single column < 960px (use `lg:` breakpoint). Use `--color-surface`/`--color-card` for the band/cards, `--color-line` for borders.

Touch targets: the agent-profile anchors and the summary must be ≥44px hit area (min-h-11 / py-2 padding).

Use the EXACT copy strings from the UI-SPEC Copywriting Contract: "How this issue was made", "Loading the deliberation.", "This issue predates the open deliberation record.", "Scores did not complete this cycle.", "Below 0.70 threshold — human review flagged.", "★ Selected this week", "Runner-up". No exclamation marks anywhere else.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `head -1 apps/web/components/issue/DeliberationSlot.tsx` is exactly `'use client'`
    - `grep -c "useQuery" apps/web/components/issue/DeliberationSlot.tsx` >= 5
    - `grep -E "runId \? \{ runId \} : ['\"]skip['\"]" apps/web/components/issue/DeliberationSlot.tsx` matches at least once (skip sentinel)
    - source references all five: `api.pitchLog.byRunId`, `api.deliberationEvents.byRunId`, `api.agentVotes.byRunId`, `api.qaCorrections.byRunId`, `api.pipelineRuns.byRunId`
    - `grep -c "advocate-argument" apps/web/components/issue/DeliberationSlot.tsx` >= 1 and `grep -c "JSON.parse" apps/web/components/issue/DeliberationSlot.tsx` >= 1
    - contains the literals `Scores did not complete this cycle.`, `This issue predates the open deliberation record.`, `Below 0.70 threshold — human review flagged.`, `★ Selected this week`, `Runner-up`
    - contains `var(--color-text-dim)`, `var(--color-primary)`, `var(--color-accent)` for the QA severity map and the labels `Info`, `Warning`, `Error`
    - `grep -i "modelversions\|claude\|sonnet\|haiku\| gpt\|openrouter" apps/web/components/issue/DeliberationSlot.tsx` returns NOTHING in the code path (the DEL-04 test, which strips comments, must pass)
    - `cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts` exits 0
    - `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` exits 0
  </acceptance_criteria>
  <done>DeliberationSlot is a Client Component with all 5 subscriptions, payload-parsed scores/confidence, severity-with-label QA rows, persona-only agent chips, full state machine, and zero model references; DEL-04 tripwire green.</done>
</task>

<task type="auto">
  <name>Task 2: Unskip and finalize the deliberation Wave-0 tests</name>
  <read_first>
    - apps/web/__tests__/deliberation-subscriptions.test.ts (created skipped in Plan 09-00)
    - apps/web/__tests__/deliberation-advocate-scores.test.ts
    - apps/web/__tests__/deliberation-qa-severity.test.ts
    - apps/web/__tests__/deliberation-agent-cards.test.ts
    - apps/web/components/issue/DeliberationSlot.tsx (the just-written implementation — confirm the asserted literals match)
  </read_first>
  <files>apps/web/__tests__/deliberation-subscriptions.test.ts, apps/web/__tests__/deliberation-advocate-scores.test.ts, apps/web/__tests__/deliberation-qa-severity.test.ts, apps/web/__tests__/deliberation-agent-cards.test.ts</files>
  <action>
Change `describe.skip(...)` to `describe(...)` in each of the four files (deliberation-subscriptions, deliberation-advocate-scores, deliberation-qa-severity, deliberation-agent-cards) so the DEL-01/02/05/06 source-scan assertions run against the new DeliberationSlot.tsx. Remove the `// UNSKIP in Plan 09-02` markers.

If any assertion fails because a string in DeliberationSlot.tsx differs slightly from the test's expected literal, FIX the DeliberationSlot.tsx source to match the UI-SPEC copy/token contract (the spec literals are canonical) — do NOT weaken the test. The four files assert: skip sentinel + 5 query refs + empty copy (subscriptions); advocate-argument + JSON.parse + null-score copy + no votes.score (advocate-scores); the 3 severity tokens + 3 labels + no legacy severities (qa-severity); /agents/ href + displayName/role + no model strings (agent-cards). All four must go green.

Do NOT modify deliberation-no-model-names.test.ts (it was never skipped) or theme-aa-tones.test.ts or podcast-slot.test.ts (other plans' concern).
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-qa-severity.test.ts __tests__/deliberation-agent-cards.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "describe.skip" apps/web/__tests__/deliberation-subscriptions.test.ts` == 0
    - `grep -c "describe.skip" apps/web/__tests__/deliberation-advocate-scores.test.ts` == 0
    - `grep -c "describe.skip" apps/web/__tests__/deliberation-qa-severity.test.ts` == 0
    - `grep -c "describe.skip" apps/web/__tests__/deliberation-agent-cards.test.ts` == 0
    - `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-qa-severity.test.ts __tests__/deliberation-agent-cards.test.ts` exits 0
    - `cd apps/web && npm run test:unit` exits 0 (full suite green)
  </acceptance_criteria>
  <done>All four deliberation test files are unskipped and green against the new DeliberationSlot; full unit suite green.</done>
</task>

</tasks>

<verification>
- DeliberationSlot.tsx is a Client Component subscribing to all 5 tables with the skip sentinel; renders pitch log, advocate bars (null-safe), QA severity (label+color), editor decision + optional confidence, persona agent chips linking /agents/{agentId}; loading/empty/running states.
- No model name / cost / modelVersions in the code path.
- All four deliberation-* tests unskipped and green; deliberation-no-model-names and game-sandbox green; full suite green.
</verification>

<success_criteria>
- DEL-01 (5 subscriptions, skip-safe), DEL-02 (score bars + QA severity colors + agent chips), DEL-03 (collapsed-by-default details), DEL-04 (no model names), DEL-05 (graceful empty state) all satisfied and test-verified.
</success_criteria>

<output>
After completion, create `.planning/phases/09-issue-page-completion/09-02-SUMMARY.md`. Note in the SUMMARY that editor confidence is rendered only when a structured number is present in the editor-decision payload, because Phase 5's pipeline currently emits { winner, rationale } without a confidence field — flag this for a possible pipeline-payload follow-up.
</output>
