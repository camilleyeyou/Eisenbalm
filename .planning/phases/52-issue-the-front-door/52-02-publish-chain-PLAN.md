---
phase: 52-issue-the-front-door
plan: 02
type: tdd
wave: 2
depends_on: ["52-01"]
files_modified:
  - apps/dispatch-control/lib/publishChain.ts
  - apps/dispatch-control/__tests__/publishChain.test.ts
  - apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx
autonomous: true
requirements: [HOME-07]

must_haves:
  truths:
    - "One call records facts-cleared, then sounds-human, then publishes — through recordSignOff and publishIssue only"
    - "Sign-offs already active in the live map are skipped, never re-sent"
    - "The chain stops at the first failure and returns the server's own message"
    - "Publish is enabled only when the footer is 'ready', the user is known Editor-in-chief, the issue is not held, and no chain is in flight"
  artifacts:
    - path: "apps/dispatch-control/lib/publishChain.ts"
      provides: "publishChain, derivePublishGate, copy constants"
      exports: ["publishChain", "derivePublishGate", "NETWORK_FAILURE_MESSAGE", "COLLABORATOR_LOCK_LABEL", "HELD_REASON", "PUBLISH_SLOW_MS", "PUBLISH_SLOW_NOTICE"]
    - path: "apps/dispatch-control/__tests__/publishChain.test.ts"
      provides: "Chain order / skip / stop-on-failure / 409-reason table / gate parity tests"
  key_links:
    - from: "apps/dispatch-control/lib/publishChain.ts"
      to: "lib/signOffClient.ts recordSignOff, lib/reviewClient.ts publishIssue"
      via: "direct import; no new fetch"
      pattern: "recordSignOff\\(|publishIssue\\("
---

<objective>
The one-click Publish as a small, tested function plus the client enablement predicate.

Purpose: HOME-07 — one click = facts-cleared sign-off -> voice sign-off -> publish through the EXISTING endpoints, server enforcement and role check; never a parallel path (52-CONTEXT "Publishing", 52-RESEARCH Q5). The enablement predicate must be a subset of what the server allows (Phase 34 client-vs-server drift lesson).
Output: `lib/publishChain.ts` + `__tests__/publishChain.test.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-issue-the-front-door/52-CONTEXT.md
@.planning/phases/52-issue-the-front-door/52-RESEARCH.md
@.planning/phases/52-issue-the-front-door/52-01-SUMMARY.md

<interfaces>
From apps/dispatch-control/lib/signOffClient.ts:
```ts
export type SignOffKind = 'facts-cleared' | 'sounds-human'
export class SignOffApiError extends Error { constructor(public readonly status: number, public readonly reason: string, message: string) }
export async function recordSignOff(token: string | null, runId: string, kind: SignOffKind): Promise<{ runId: string; kind: SignOffKind; signedAt: number }>
```
From apps/dispatch-control/lib/reviewClient.ts:
```ts
export class ReviewApiError extends Error { constructor(public readonly status: number, public readonly reason: string, message: string) }
export async function publishIssue(token: string | null, runId: string): Promise<{ issueId: string; published: true }>
```
From apps/dispatch-control/lib/role.ts: `export type Role = 'Editor-in-chief' | 'Collaborator'` (useRole returns `Role | undefined`; undefined = Clerk loading, NOT Collaborator)
From apps/dispatch-control/lib/homeSections.ts (Plan 52-01): `export type HomeFooter = { kind: 'loading' | 'none' | 'failed' | 'gate1' | 'running' | 'ready' } | { kind: 'published'; ... } | { kind: 'fix'; ... }`
Server 409 reasons (api/signoffs.py, api/review.py): claims_not_signed_off, open_error_findings, open_voice_findings, run_not_reviewable, forbidden_role (403), missing_signoffs, wrong_status, no_sanity_issue.
Verbatim existing copy (DecisionRail.tsx lines ~567, ~589): "Collaborators can review and comment, not publish." and "This issue is held — release the hold to publish."
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — publishChain.test.ts</name>
  <files>apps/dispatch-control/__tests__/publishChain.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/signOffClient.ts
    - apps/dispatch-control/lib/reviewClient.ts
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (how recordSignOff/publishIssue are mocked)
    - apps/dispatch-control/lib/homeSections.ts (HomeFooter)
  </read_first>
  <behavior>
    - chain: with activeSignOffs {} -> calls recordSignOff(tok,'run_1','facts-cleared'), then recordSignOff(tok,'run_1','sounds-human'), then publishIssue(tok,'run_1') in that exact order (assert via a shared call-log array); returns {ok:true}.
    - getToken is awaited once per request (3 calls when nothing is signed).
    - skip: activeSignOffs {'facts-cleared': {...}} -> recordSignOff called once with 'sounds-human'; both active -> recordSignOff never called, publishIssue called once.
    - stop: facts step rejects with new SignOffApiError(409,'claims_not_signed_off','1 claim(s) contradicted by sources must be fixed or dismissed before clearing facts.') -> returns {ok:false, step:'facts-cleared', message: that exact string}; sounds-human and publishIssue NOT called.
    - table-driven over the eight reasons: claims_not_signed_off & open_error_findings (facts step, SignOffApiError), open_voice_findings & run_not_reviewable & forbidden_role (voice step, SignOffApiError; forbidden_role status 403), missing_signoffs & wrong_status & no_sanity_issue (publish step, ReviewApiError) -> each returns ok:false with the matching step and the error's message verbatim.
    - network: a plain TypeError('Failed to fetch') at any step -> message === NETWORK_FAILURE_MESSAGE.
    - gate: derivePublishGate({footer:{kind:'ready'}, role:'Editor-in-chief', held:false, busy:false}) -> {enabled:true}; role undefined -> {enabled:false, reason:'role-unknown'}; role 'Collaborator' -> reason 'collaborator'; held true -> reason 'held'; held undefined -> reason 'loading'; busy -> reason 'busy'; every footer kind other than 'ready' (loading, none, failed, gate1, running, published, fix) -> enabled false with reason 'not-ready'.
    - slow: PUBLISH_SLOW_MS === 75_000 and PUBLISH_SLOW_NOTICE === 'Publishing is taking longer than usual — check Admin → Run Details.'
    - copy: COLLABORATOR_LOCK_LABEL === 'Collaborators can review and comment, not publish.'; HELD_REASON === 'This issue is held — release the hold to publish.'
  </behavior>
  <action>
    Create `apps/dispatch-control/__tests__/publishChain.test.ts` (node env). Mock `@/lib/signOffClient` and `@/lib/reviewClient` with `vi.mock(..., async () => ({ ...(await vi.importActual(...)), recordSignOff: hoisted.recordSignOff }))` / `publishIssue: hoisted.publishIssue` using `vi.hoisted` (precedent: `__tests__/SectionReaderPage.test.tsx` lines 52-75) so the real `SignOffApiError`/`ReviewApiError` classes stay importable. Import `{ publishChain, derivePublishGate, NETWORK_FAILURE_MESSAGE, COLLABORATOR_LOCK_LABEL, HELD_REASON, PUBLISH_SLOW_MS, PUBLISH_SLOW_NOTICE }` from `@/lib/publishChain`. Implement every spec in <behavior>; name the describe blocks 'chain', 'skip', 'stop', 'reasons', 'gate', 'slow'. Confirm RED, commit `test(52-02): add failing publish-chain tests`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/publishChain.test.ts 2>&1 | grep -E "FAIL|failed|Cannot find"</automated>
  </verify>
  <acceptance_criteria>
    - Test file exists and contains all eight reason strings: `claims_not_signed_off`, `open_error_findings`, `open_voice_findings`, `run_not_reviewable`, `forbidden_role`, `missing_signoffs`, `wrong_status`, `no_sanity_issue`
    - Contains `Collaborators can review and comment, not publish.` and `This issue is held — release the hold to publish.`
    - Run fails before Task 2
  </acceptance_criteria>
  <done>Failing chain/gate tests committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — implement lib/publishChain.ts</name>
  <files>apps/dispatch-control/lib/publishChain.ts, apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/publishChain.test.ts
    - apps/dispatch-control/lib/signOffClient.ts, apps/dispatch-control/lib/reviewClient.ts
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx lines 250-300 (existing handlers — mirror their error->message mapping)
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/publishChain.ts` (no 'use client', no React). Docstring: Phase 52 HOME-07 — second caller of recordSignOff/publishIssue after DecisionRail; composes the existing endpoints; the server (signoffs.py / review.py `_require_editor`) is the authoritative gate; NEVER call publish-manual (pipelineControlClient) — that is the restart path; publish is non-idempotent so callers must disable on first click; schedule-publish stays only on /issues/[n]/approval (DecisionRail) by design.

    Code:
    ```ts
    import { recordSignOff, SignOffApiError, type SignOffKind } from '@/lib/signOffClient'
    import { publishIssue, ReviewApiError } from '@/lib/reviewClient'
    import type { Role } from '@/lib/role'
    import type { HomeFooter } from '@/lib/homeSections'

    export const NETWORK_FAILURE_MESSAGE = 'Couldn’t reach the server. Nothing was published — try again.'
    export const COLLABORATOR_LOCK_LABEL = 'Collaborators can review and comment, not publish.'
    export const HELD_REASON = 'This issue is held — release the hold to publish.'
    export const PUBLISH_SLOW_MS = 75_000
    export const PUBLISH_SLOW_NOTICE = 'Publishing is taking longer than usual — check Admin → Run Details.'
    const SIGN_OFF_ORDER: readonly SignOffKind[] = ['facts-cleared', 'sounds-human']
    export type PublishChainStep = SignOffKind | 'publish'
    export type PublishChainResult = { ok: true } | { ok: false; step: PublishChainStep; message: string }
    export async function publishChain(opts: { getToken: () => Promise<string | null>; runId: string; activeSignOffs: Record<string, unknown> }): Promise<PublishChainResult>
    export type PublishGate = { enabled: true } | { enabled: false; reason: 'not-ready' | 'loading' | 'role-unknown' | 'collaborator' | 'held' | 'busy' }
    export function derivePublishGate(args: { footer: HomeFooter; role: Role | undefined; held: boolean | undefined; busy: boolean }): PublishGate
    ```
    publishChain: for each kind in SIGN_OFF_ORDER, skip when `opts.activeSignOffs[kind] !== undefined`, else `await recordSignOff(await opts.getToken(), opts.runId, kind)`; catch -> return `{ok:false, step: kind, message: plain(e)}`. Then `await publishIssue(await opts.getToken(), opts.runId)`; catch -> `{ok:false, step:'publish', message: plain(e)}`. No retries. `plain(e)` = `e instanceof SignOffApiError || e instanceof ReviewApiError ? e.message : NETWORK_FAILURE_MESSAGE`.
    derivePublishGate order: footer.kind !== 'ready' -> not-ready; busy -> busy; held === undefined -> loading; held -> held; role === undefined -> role-unknown; role !== 'Editor-in-chief' -> collaborator; else enabled. (Collaborator never starts the chain — facts-cleared is not role-gated server-side, so a Collaborator click would leave a half-recorded sign-off; Pitfall 11.)

    Also update the stale "exclusively in DecisionRail" claim in `apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx` docstring (lines ~20-24): replace the sentence "`recordSignOff`/`publishIssue` stay exclusively in `DecisionRail.tsx` (mounted by `/issues/[n]/approval`), ..." with "`recordSignOff`/`publishIssue` are called only from `DecisionRail.tsx` (`/issues/[n]/approval`) and `lib/publishChain.ts` (the Phase 52 front door at `/`), both behind the unchanged server gate." Comment-only edit; do not change code in RunScreen.

    Tests green -> commit `feat(52-02): publish chain + client gate for the front door`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/publishChain.test.ts __tests__/errorEnvelope.test.ts __tests__/publishNoTypedConfirm.test.ts __tests__/roleGateInventory.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - All four test files pass
    - `grep -n "publishManual\|publish-manual\|fetch(" apps/dispatch-control/lib/publishChain.ts` matches only inside the docstring warning (no `fetch(` call, no import from pipelineControlClient)
    - `grep -c "recordSignOff(\|publishIssue(" apps/dispatch-control/lib/publishChain.ts` >= 2
    - `grep -n "lib/publishChain.ts" "apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx"` matches
    - `git diff --stat` for RunScreen.tsx shows comment-only changes (no line outside the docstring block changed)
  </acceptance_criteria>
  <done>Chain + gate implemented and green; RunScreen docstring no longer claims DecisionRail is the only caller.</done>
</task>

</tasks>

<verification>
`cd apps/dispatch-control && pnpm exec vitest run __tests__/publishChain.test.ts __tests__/homeSections.test.ts` green.
</verification>

<success_criteria>
One-click publish exists as a tested sequence over the existing clients, with an enablement predicate that can only be stricter than the server.
</success_criteria>

<output>
After completion, create `.planning/phases/52-issue-the-front-door/52-02-SUMMARY.md`
</output>
