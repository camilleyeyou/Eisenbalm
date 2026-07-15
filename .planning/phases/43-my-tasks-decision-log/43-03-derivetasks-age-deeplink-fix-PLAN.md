---
phase: 43-my-tasks-decision-log
plan: 03
type: execute
wave: 2
depends_on: ["43-01"]
files_modified:
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/__tests__/derivedState.test.ts
autonomous: true
requirements: [TSK-01, TSK-02, TSK-03]

must_haves:
  truths:
    - "deriveTasks still projects EXACTLY open findings + pending claims + missing sign-offs — no new source added (TSK-01 regression held)"
    - "each DerivedTask carries an additive openedAt?: number derived from its underlying artifact timestamp (QA finding timestamp, claim _creationTime, missing sign-off run startedAt), and formatTaskAge(openedAt, now) renders a non-blank relative age string (TSK-02)"
    - "a claim task's primary.href resolves to /issues/{n}/fact-check (not /draft); the signoff-facts task's href resolves to /issues/{n}/approval (not /draft) (TSK-03, Pitfall 1)"
    - "openedAt + href changes are additive: the Masthead count-only caller still compiles and still returns the same task count"
  artifacts:
    - path: "apps/dispatch-control/lib/derivedState.ts"
      provides: "DerivedTask.openedAt, formatTaskAge, corrected claim/signoff hrefs, widened DerivationInputs timestamp passthroughs"
      exports: ["deriveTasks", "formatTaskAge"]
    - path: "apps/dispatch-control/__tests__/derivedState.test.ts"
      provides: "regression + age + href assertions in the deriveTasks describe block"
  key_links:
    - from: "deriveTasks claim loop"
      to: "issueRouteResolver.issueFactCheckHref"
      via: "primary.href for stage-3 claim tasks"
      pattern: "issueFactCheckHref"
---

<objective>
Extend the ALREADY-BUILT deriveTasks selector additively (D-01/D-02) for the two things the screen needs that the count-only Masthead caller didn't: task age (TSK-02) and correct deep links (TSK-03), while proving the projection still reads exactly the three locked sources (TSK-01). This includes the RESEARCH-confirmed href bug fix (Pitfall 1): claim + facts-signoff tasks currently point at /draft instead of the working /fact-check and /approval screens.

Purpose: My Tasks renders this selector as-is (no fork); the ONLY selector deltas this phase allows are additive openedAt + the href corrections. Severity/ordering/grouping stay verbatim (shared isMustFix/findingSeverityToTaskSeverity — the anti-drift rule).
Output: DerivedTask.openedAt + formatTaskAge + corrected hrefs + widened DerivationInputs timestamp passthroughs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@apps/dispatch-control/lib/derivedState.ts
@apps/dispatch-control/lib/issueRouteResolver.ts

<interfaces>
<!-- Verified from the current repo tree. -->
lib/derivedState.ts (verified):
  import line 18: `import { issueDraftHref, issueVoiceHref } from './issueRouteResolver'` — ADD issueFactCheckHref, issueApprovalHref.
  DerivedTask (33-44): { id, sev, title, where, why, rec?, primary{label,href}, insp?, stage } — ADD openedAt?: number.
  DerivationInputs.qaFindings row type (82-93) — ADD timestamp?: number (qaCorrections rows carry timestamp; schema.ts:103).
  DerivationInputs.claimRows row type (63-81) — ADD createdAt?: number (map from claim_checks _creationTime); ADD runStartedAt?: number to DerivationInputs top-level for sign-off age.
  deriveTasks (366-441):
    - qaFinding loop (374-389): set openedAt: row.timestamp.
    - claim loop (391-404): href currently = issueDraftHref(n) -> issueFactCheckHref(n); set openedAt: row.createdAt.
    - signoff-facts (409-419): href currently = issueDraftHref(n) -> issueApprovalHref(n); openedAt: i.runStartedAt.
    - signoff-voice (420-431): href currently = issueVoiceHref(n). VERIFY where the 'sounds-human' sign-off control lives (read ApprovalStage.tsx + DecisionRail). If the voice sign-off button lives on Approval, retarget to issueApprovalHref(n); else leave issueVoiceHref(n). openedAt: i.runStartedAt.
  fallbackHref path (n === null) is unchanged — keep it.
issueRouteResolver.ts: issueFactCheckHref (line 52) = `/issues/{n}/fact-check`; issueApprovalHref (line 56) = `/issues/{n}/approval` — both exist.
__tests__/derivedState.test.ts: baseInputs() helper (lines 26-38); deriveTasks describe block (line 384). Extend in place.
Masthead.tsx claimRows mapper (212-218) is count-only and does NOT pass createdAt/timestamp — that is fine; openedAt is additive-optional and My Tasks (43-05) passes them.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — TSK-01 regression + openedAt + href corrections</name>
  <files>apps/dispatch-control/__tests__/derivedState.test.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/derivedState.test.ts (baseInputs 26-38; the deriveTasks describe 384-472 — match its it() structure)
    - apps/dispatch-control/lib/derivedState.ts (deriveTasks 366-441; the loops being changed)
    - docs/API_CONTRACTS.md §43.5 (the openedAt + href correction contract)
  </read_first>
  <behavior>
    - TSK-01 regression: deriveTasks over {qaFindings:[open], claimRows:[pending], signOffs:{}} on a non-running run still returns exactly (open findings) + (pending claims) + (missing sign-offs) tasks — no extra source, no dropped source.
    - TSK-03 href: a pending-claim task has primary.href === '/issues/7/fact-check'; the signoff-facts task (id 'signoff-facts') has primary.href === '/issues/7/approval'.
    - TSK-02 age: a QA-finding task built from a row with timestamp T has openedAt === T; a claim task from a row with createdAt C has openedAt === C; the signoff-facts task has openedAt === the provided runStartedAt.
    - formatTaskAge(now - 2h, now) returns a non-blank relative string containing 'h' (or the agreed unit); formatTaskAge(undefined, now) returns an explicit non-blank fallback (e.g. 'unknown') — never ''.
  </behavior>
  <action>
Extend __tests__/derivedState.test.ts: add cases inside (or a new describe adjacent to) the existing `deriveTasks` block asserting each <behavior> bullet. Feed timestamp/createdAt/runStartedAt via baseInputs overrides (extend the fixtures with the new optional fields). Add a small `formatTaskAge` describe block. These are RED until Task 2 (openedAt/hrefs/formatTaskAge do not exist yet).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts || true</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "/issues/7/fact-check\|/issues/7/approval" apps/dispatch-control/__tests__/derivedState.test.ts` matches
    - `grep -n "openedAt" apps/dispatch-control/__tests__/derivedState.test.ts` matches
    - `grep -n "formatTaskAge" apps/dispatch-control/__tests__/derivedState.test.ts` matches
    - the command exits non-zero (RED) before Task 2
  </acceptance_criteria>
  <done>Age, deep-link corrections, and the TSK-01 no-new-source invariant are pinned RED.</done>
</task>

<task type="auto">
  <name>Task 2: Add openedAt + formatTaskAge + correct hrefs + widen DerivationInputs</name>
  <files>apps/dispatch-control/lib/derivedState.ts</files>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts (import line 18; DerivedTask 33-44; DerivationInputs 58-96; deriveTasks 366-441)
    - apps/dispatch-control/lib/issueRouteResolver.ts (issueFactCheckHref line 52, issueApprovalHref line 56)
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx + review-desk/[runId]/_components/DecisionRail.tsx (to VERIFY whether the sounds-human sign-off control lives on Approval before retargeting signoff-voice)
  </read_first>
  <action>
In lib/derivedState.ts:
1. Line 18: add `issueFactCheckHref, issueApprovalHref` to the issueRouteResolver import.
2. DerivedTask: add `openedAt?: number` (raw ms).
3. DerivationInputs: add `timestamp?: number` to the qaFindings row element type; add `createdAt?: number` to the claimRows row element type; add top-level `runStartedAt?: number`.
4. deriveTasks: set `openedAt: row.timestamp` on QA-finding tasks; change the claim task `href` from `issueDraftHref(n as number)` to `issueFactCheckHref(n as number)` and set `openedAt: row.createdAt`; change the `signoff-facts` `href` from `issueDraftHref(n as number)` to `issueApprovalHref(n as number)` and set `openedAt: i.runStartedAt`; set `openedAt: i.runStartedAt` on signoff-voice. For signoff-voice's href: if the DecisionRail read confirms the sounds-human sign-off control lives on Approval, retarget it to `issueApprovalHref(n as number)`; otherwise keep `issueVoiceHref`. Keep the `fallbackHref` (n===null) branch behavior unchanged.
5. Add `export function formatTaskAge(openedAt: number | undefined, now: number = Date.now()): string` — a pure relative-age formatter (mirror RegistryTable.formatRelativeTime granularity: just now / Nm ago / Nh ago / Nd ago); return an explicit 'unknown' (never '') when openedAt is undefined. Keep deriveTasks itself time-independent (do NOT call Date.now() inside it).
Do NOT change severity math, ordering, the source set, or add any new query.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts && pnpm --filter dispatch-control typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "issueFactCheckHref\|issueApprovalHref" apps/dispatch-control/lib/derivedState.ts` matches in both the import and deriveTasks
    - `grep -n "openedAt" apps/dispatch-control/lib/derivedState.ts` shows it on DerivedTask and set in each task branch
    - `grep -n "export function formatTaskAge" apps/dispatch-control/lib/derivedState.ts` matches
    - `grep -n "issueDraftHref(n as number)" apps/dispatch-control/lib/derivedState.ts` no longer appears in the claim loop or the signoff-facts branch
    - `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` exits 0 (RED→GREEN)
    - `pnpm --filter dispatch-control typecheck` exits 0 (Masthead count-only caller still compiles)
  </acceptance_criteria>
  <done>Tasks carry openedAt, claim/facts-signoff deep links point at the working stages, formatTaskAge renders a non-blank age, and the change is additive (Masthead still compiles/counts).</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` green.
- `pnpm --filter dispatch-control typecheck` green.
- `git diff apps/dispatch-control/lib/derivedState.ts` shows additive-only changes to types + the two href corrections; no source removed from the projection.
</verification>

<success_criteria>
deriveTasks projects exactly the three locked sources, every task carries a non-blank age via openedAt+formatTaskAge, and claim/facts-signoff tasks deep-link to /fact-check and /approval — the selector the My Tasks screen renders is complete and additive.
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-03-SUMMARY.md`.
</output>
