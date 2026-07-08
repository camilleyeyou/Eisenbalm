---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 07
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/__tests__/DecisionRail.test.tsx
autonomous: true
gap_closure: true
requirements: [PUB-01]

must_haves:
  truths:
    - "The 16 pre-existing DecisionRail tests (D-12..D-17) pass again after the sign-off UI was added in 34-06"
    - "The new Sign-offs section has test coverage: both controls render, click records a sign-off, the affirmative 'signed Nm ago' state renders, and Publish is gated until both greens"
    - "The Facts-cleared control is client-side disabled while an open error-severity blocker exists (D-01)"
    - "`pnpm --filter dispatch-control test` exits 0 (no failing files) and `pnpm --filter dispatch-control build` type-checks clean"
  artifacts:
    - path: "apps/dispatch-control/__tests__/DecisionRail.test.tsx"
      provides: "signOffs api mock entry + signOffClient mock + new Sign-offs describe block"
      contains: "signOffs:activeByRunId"
  key_links:
    - from: "apps/dispatch-control/__tests__/DecisionRail.test.tsx"
      to: "DecisionRail.tsx useQuery(api.signOffs.activeByRunId)"
      via: "vi.mock('@convex/_generated/api') signOffs entry + mockQueries case"
      pattern: "signOffs:\\s*\\{\\s*activeByRunId"
    - from: "apps/dispatch-control/__tests__/DecisionRail.test.tsx"
      to: "DecisionRail.tsx handleSignOff -> recordSignOff"
      via: "vi.mock('@/lib/signOffClient') recordSignOff spy"
      pattern: "recordSignOff\\).toHaveBeenCalledWith"
---

<objective>
Close the client-side test-suite regression that Phase 34 introduced (VERIFICATION.md
gap). Plan 34-06 added a new `useQuery(api.signOffs.activeByRunId, { runId })`
subscription to `DecisionRail.tsx`, but did not extend the hand-written Convex API
mock in `apps/dispatch-control/__tests__/DecisionRail.test.tsx`. As a result all 16
pre-existing tests in that file crash at render with
`TypeError: Cannot read properties of undefined (reading 'activeByRunId')`, and the
new Sign-offs UI has zero coverage.

This is a TEST-SIDE fix only. Do NOT modify `DecisionRail.tsx`, `signOffClient.ts`,
or any shipped production code unless a test surfaces a genuine defect — the phase's
server-enforcement goal is already verified (4/4 truths).

Purpose: restore a green `pnpm --filter dispatch-control test` and add regression
coverage for the two-sign-off publish gate operator surface (PUB-01).
Output: an updated `DecisionRail.test.tsx` (mock repaired + new describe block).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-VERIFICATION.md

<interfaces>
<!-- Extracted from the codebase so the executor needs no exploration. -->

The convex query `api.signOffs.activeByRunId` (convex/signOffs.ts L115-131) returns:
```ts
// keyed by kind, ACTIVE (unrevoked) rows only; absent key = not signed/revoked
Record<'facts-cleared' | 'sounds-human', { actorId: string; signedAt: number }>
// e.g. { 'facts-cleared': { actorId: 'andrew', signedAt: 1720000000000 } }
```

How DecisionRail.tsx consumes it (DecisionRail.tsx L152-157, L361-388, L397-408):
```ts
const active = useQuery(api.signOffs.activeByRunId, { runId }) as
  | Record<SignOffKind, { actorId: string; signedAt: number }> | undefined
const factsActive = !!active?.['facts-cleared']   // false when key absent
const humanActive = !!active?.['sounds-human']
// Facts control disabled while blockers open:  disabled={blockers.length > 0 || signOffBusy !== null}
// Human control ungated:                       disabled={signOffBusy !== null}
// Publish disabled unless both greens:  disabled={blockers.length > 0 || !factsActive || !humanActive || busy}
// Active copy: "Facts cleared — signed {formatAgo(signedAt)}" / "Sounds human — signed {formatAgo(signedAt)}"
// Not-active button labels: "Sign: Facts cleared" / "Sign: Sounds human"
// Gate hint when zero blockers but a sign-off missing: "Both sign-offs required to publish."
```

The sign-off client the component calls (signOffClient.ts):
```ts
export type SignOffKind = 'facts-cleared' | 'sounds-human'
export class SignOffApiError extends Error {
  constructor(public readonly status: number, public readonly reason: string, message: string)
}
export async function recordSignOff(
  token: string | null, runId: string, kind: SignOffKind,
): Promise<{ runId: string; kind: SignOffKind; signedAt: number }>
// DecisionRail calls: recordSignOff(token, runId, kind) where token comes from getToken()
// (the existing @clerk/nextjs mock makes getToken() resolve to 'tok-clerk')
```

Established api-mock pattern already in this test file (DecisionRail.test.tsx L27-34):
```ts
vi.mock('@convex/_generated/api', () => ({
  api: {
    qaCorrections: { byRunId: 'qaCorrections:byRunId' },
    deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
    pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' },
    claimChecks: { listByRunId: 'claimChecks:listByRunId' },
  },
}))
```
The `mockQueries()` helper (L112-127) switches on those string sentinels to feed
`useQuery`. The `@/lib/reviewClient` mock (L36-52) is the model for the new
`@/lib/signOffClient` mock (typed error class + a `vi.fn()` async default).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Repair the Convex API + signOffClient mocks so the 16 existing tests render again</name>
  <files>apps/dispatch-control/__tests__/DecisionRail.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (the file being edited — study L27-34 api mock, L105-127 QueryState + mockQueries, L36-52 reviewClient mock pattern)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (L152-157 the useQuery(api.signOffs.activeByRunId) call and factsActive/humanActive derivation; L397 the Publish disabled condition)
    - apps/dispatch-control/lib/signOffClient.ts (recordSignOff signature + SignOffApiError shape to mirror in the mock)
    - convex/signOffs.ts (L115-131 activeByRunId return shape)
    - apps/dispatch-control/__tests__/Masthead.test.tsx (a second existing test using the same vi.mock('@convex/_generated/api') pattern, for reference)
  </read_first>
  <action>
    Make three additive edits to DecisionRail.test.tsx. Change NO production code.

    1. Extend the api mock block (currently L27-34) to add a `signOffs` entry mirroring
       the sibling entries:
       ```ts
       vi.mock('@convex/_generated/api', () => ({
         api: {
           qaCorrections: { byRunId: 'qaCorrections:byRunId' },
           deliberationEvents: { byRunIdAndType: 'deliberationEvents:byRunIdAndType' },
           pitchLog: { selectedByRunId: 'pitchLog:selectedByRunId' },
           claimChecks: { listByRunId: 'claimChecks:listByRunId' },
           signOffs: { activeByRunId: 'signOffs:activeByRunId' },
         },
       }))
       ```

    2. Add a `@/lib/signOffClient` mock next to the existing `@/lib/reviewClient` mock,
       exporting a typed error class and a `vi.fn()` default (mirror the reviewClient
       shape at L36-52):
       ```ts
       vi.mock('@/lib/signOffClient', () => {
         class SignOffApiError extends Error {
           constructor(
             public readonly status: number,
             public readonly reason: string,
             message: string,
           ) {
             super(message)
             this.name = 'SignOffApiError'
           }
         }
         return {
           SignOffApiError,
           recordSignOff: vi.fn(async () => ({
             runId: 'run-1',
             kind: 'facts-cleared',
             signedAt: Date.now(),
           })),
         }
       })
       ```
       Add a matching top-of-file import alongside the existing client imports:
       `import { recordSignOff } from '@/lib/signOffClient'`.

    3. Teach `mockQueries` about the new query. Add `signoffs?: unknown` to the
       `QueryState` interface (L105-110), and add a case to the switch (L113-126).
       CRITICAL: the DEFAULT (when a test does not pass `state.signoffs`) MUST return
       BOTH sign-offs active, because the pre-existing blocker-free tests
       ("only counts OPEN findings", "enables Publish when zero blockers…",
       "surfaces the server 409…") assert `publish.disabled === false` / click Publish,
       and the 34-06 Publish button is now gated on `factsActive && humanActive`.
       Returning undefined/empty here would leave those tests red.
       ```ts
       case 'signOffs:activeByRunId':
         return state.signoffs !== undefined
           ? state.signoffs
           : {
               'facts-cleared': { actorId: 'andrew', signedAt: Date.now() },
               'sounds-human': { actorId: 'andrew', signedAt: Date.now() },
             }
       ```

    Do not delete or rename any existing test. Do not touch the `Loading…` test's
    inline `useQuery` override (L232-241) — its `default` branch already returns `[]`,
    which is a harmless empty `active` for that assertion.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "signOffs: { activeByRunId: 'signOffs:activeByRunId' }" apps/dispatch-control/__tests__/DecisionRail.test.tsx && grep -q "vi.mock('@/lib/signOffClient'" apps/dispatch-control/__tests__/DecisionRail.test.tsx && grep -q "case 'signOffs:activeByRunId':" apps/dispatch-control/__tests__/DecisionRail.test.tsx && pnpm --filter dispatch-control test -- --run __tests__/DecisionRail.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "signOffs: { activeByRunId: 'signOffs:activeByRunId' }" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `grep -q "vi.mock('@/lib/signOffClient'" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `grep -q "case 'signOffs:activeByRunId':" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `grep -q "import { recordSignOff } from '@/lib/signOffClient'" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `git -C /Users/user/Desktop/Eisenbalm diff --name-only` lists ONLY `apps/dispatch-control/__tests__/DecisionRail.test.tsx` (no production files changed)
    - `pnpm --filter dispatch-control test -- --run __tests__/DecisionRail.test.tsx` exits 0
  </acceptance_criteria>
  <done>The DecisionRail.test.tsx file's Convex API mock includes signOffs, a signOffClient mock exists, mockQueries defaults to both-active, and the file's existing 16 tests pass (`--run __tests__/DecisionRail.test.tsx` exits 0). No production source file modified.</done>
</task>

<task type="auto">
  <name>Task 2: Add a Sign-offs describe block covering render, record, affirmative state, and the both-greens Publish gate</name>
  <files>apps/dispatch-control/__tests__/DecisionRail.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx (post-Task-1 state — reuse `mockQueries`, the `errorFinding`/`warningFinding` fixtures L80-94, and the `render`/`screen`/`fireEvent`/`waitFor` imports)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (L356-409 the Sign-offs section markup + Publish gate: button labels "Sign: Facts cleared"/"Sign: Sounds human", active copy "Facts cleared — signed …"/"Sounds human — signed …", gate hint "Both sign-offs required to publish.", and the Facts button `disabled={blockers.length > 0 || …}`)
    - apps/dispatch-control/lib/signOffClient.ts (recordSignOff(token, runId, kind) call signature for the toHaveBeenCalledWith assertion)
  </read_first>
  <action>
    Append ONE new `describe('DecisionRail sign-offs (Phase 34, D-01/D-05/D-06)', …)`
    block at the end of the file. Import `recordSignOff` is already added in Task 1;
    reference it directly (it is the vi.fn mock). Add these five `it` cases:

    1. `it('renders both sign-off controls when neither is active', …)`
       - `mockQueries({ signoffs: {} })`
       - render `<DecisionRail runId="run-1" />`
       - assert `screen.getByRole('button', { name: /sign: facts cleared/i })` is defined
       - assert `screen.getByRole('button', { name: /sign: sounds human/i })` is defined

    2. `it('records a facts-cleared sign-off via recordSignOff(token, runId, kind) on click', async () => …)`
       - `mockQueries({ signoffs: {}, findings: [] })` (no blockers so Facts is enabled)
       - render, `fireEvent.click(screen.getByRole('button', { name: /sign: facts cleared/i }))`
       - `await waitFor(() => expect(recordSignOff).toHaveBeenCalledWith('tok-clerk', 'run-1', 'facts-cleared'))`

    3. `it('shows the affirmative "signed Nm ago" state for an active sign-off — never blank', () => …)`
       - `mockQueries({ signoffs: { 'facts-cleared': { actorId: 'andrew', signedAt: Date.now() - 2 * 60_000 } } })`
       - render
       - assert `screen.getByText(/facts cleared — signed \d+m ago/i)` is defined
       - assert the still-unsigned control renders: `screen.getByRole('button', { name: /sign: sounds human/i })` is defined

    4. `it('gates Publish until BOTH sign-offs are green even with zero blockers', () => …)`
       - `mockQueries({ findings: [], signoffs: { 'facts-cleared': { actorId: 'andrew', signedAt: Date.now() } } })`
         (facts green, human missing, no blockers)
       - render
       - `const publish = screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement`
       - assert `publish.disabled === true`
       - assert `screen.getByText(/both sign-offs required to publish/i)` is defined

    5. `it('disables the Facts-cleared control while an open error blocker exists (D-01)', () => …)`
       - `mockQueries({ findings: [errorFinding], signoffs: {} })`
       - render
       - `const facts = screen.getByRole('button', { name: /sign: facts cleared/i }) as HTMLButtonElement`
       - assert `facts.disabled === true`
       - assert the ungated human control is NOT disabled:
         `expect((screen.getByRole('button', { name: /sign: sounds human/i }) as HTMLButtonElement).disabled).toBe(false)`

    Use the existing `errorFinding` fixture (already defined L80-86). Do not add new
    top-level mocks — everything needed exists after Task 1.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "DecisionRail sign-offs (Phase 34" apps/dispatch-control/__tests__/DecisionRail.test.tsx && grep -q "recordSignOff).toHaveBeenCalledWith('tok-clerk', 'run-1', 'facts-cleared')" apps/dispatch-control/__tests__/DecisionRail.test.tsx && grep -q "both sign-offs required to publish" apps/dispatch-control/__tests__/DecisionRail.test.tsx && pnpm --filter dispatch-control test -- --run __tests__/DecisionRail.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "DecisionRail sign-offs (Phase 34" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `grep -c "  it(" apps/dispatch-control/__tests__/DecisionRail.test.tsx` returns a value ≥ 21 (16 pre-existing + 5 new)
    - `grep -q "recordSignOff).toHaveBeenCalledWith('tok-clerk', 'run-1', 'facts-cleared')" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `grep -qi "signed \\\\d+m ago" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `grep -qi "both sign-offs required to publish" apps/dispatch-control/__tests__/DecisionRail.test.tsx` exits 0
    - `pnpm --filter dispatch-control test -- --run __tests__/DecisionRail.test.tsx` exits 0
  </acceptance_criteria>
  <done>DecisionRail.test.tsx contains a new "DecisionRail sign-offs" describe block with 5 passing tests covering control render, recordSignOff invocation, affirmative signed-ago state, both-greens Publish gating, and blocker-disabled Facts control; the file exits 0.</done>
</task>

</tasks>

<verification>
Whole-plan gate (both must pass — the Nyquist automated checks):

1. `pnpm --filter dispatch-control test` exits 0 — the FULL dispatch-control vitest
   suite is green (previously 1 file failed / 16 tests failed). This is the check the
   phase originally skipped (it relied on `build`, which does not run tests).
2. `pnpm --filter dispatch-control build` exits 0 — strict type-check clean (per the
   MEMORY "run strict build before frontend phase done" lesson; vitest does not
   type-check).
3. `git -C /Users/user/Desktop/Eisenbalm diff --name-only` shows only
   `apps/dispatch-control/__tests__/DecisionRail.test.tsx` — confirming no production
   code was touched (the gap is test-side per VERIFICATION.md).
</verification>

<success_criteria>
- The 16 pre-existing DecisionRail tests pass again (signOffs mock repaired).
- ≥5 new tests cover the sign-off UI: both controls render, click → recordSignOff,
  affirmative "signed Nm ago" state, Publish gated until both greens, Facts control
  blocker-disabled.
- `pnpm --filter dispatch-control test` exits 0 and `pnpm --filter dispatch-control build` exits 0.
- Zero production source files modified.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-07-SUMMARY.md`
</output>
