---
phase: 29-deployment-hardening-code-fixes
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/%5Fdebug/convex/page.tsx
  - apps/web/__tests__/debug-route.test.ts
  - apps/web/public/robots.txt
  - apps/web/README.md
  - apps/web/components/issue/DeliberationSlot.tsx
  - apps/web/__tests__/deliberation-subscriptions.test.ts
  - apps/web/__tests__/machine-editorial-components.test.ts
  - apps/web/__tests__/motion-polish.test.ts
  - apps/web/components/marketing/BuyButton.tsx
autonomous: true
requirements: [D-7, D-8, D-9]
must_haves:
  truths:
    - "The public /_debug/convex route no longer exists and its tripwire test asserts absence"
    - "DeliberationSlot.tsx opens zero Convex subscriptions; the deliberation still renders from Sanity props"
    - "A failed checkout shows a dry inline message and re-enables the button"
  artifacts:
    - path: "apps/web/components/marketing/BuyButton.tsx"
      provides: "inline checkout-failure message + static ShopQty import"
      contains: "useState"
  key_links:
    - from: "apps/web/components/issue/DeliberationSlot.tsx"
      to: "Sanity-sourced props"
      via: "render path (no useQuery(api.*.byRunId))"
      pattern: "conversation"
---

<objective>
Three independent web hygiene fixes: (D-7) remove the publicly-routable `/_debug/convex` page and its stale references; (D-8) delete the 5 dead `useQuery(api.*.byRunId)` subscriptions in `DeliberationSlot.tsx` (they open 5 subscriptions per visitor on the highest-traffic page and discard every result — the rendered deliberation comes from Sanity via IssueLayout.tsx) and update the THREE tripwire tests that assert those subs exist; (D-9) give the checkout button a visible, on-voice failure message.

Purpose: shrink the public attack/perf surface and fix a silent checkout dead-end.
Output: route deleted, dead subs removed, tripwires re-pointed, checkout UX fixed.

Follow 29-RESEARCH.md § "Tripwire Tests That Will Break By Design" — the D-7 test read via readFileSync will THROW (ENOENT) unless updated in the same commit, and D-8's five sub-strings are asserted across THREE files, not one.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/29-deployment-hardening-code-fixes/29-RESEARCH.md

<interfaces>
D-7 removal checklist (from the page header + apps/web/README.md lines 24, 182-192):
1. delete apps/web/app/%5Fdebug/convex/page.tsx (and the %5Fdebug/ dir if empty)
2. remove `Disallow: /_debug/` from apps/web/public/robots.txt (line 5)
3. correct apps/web/README.md (its claim that the route was "removed in Phase 9" is factually false in the current tree)
4. debug-route.test.ts currently asserts the file EXISTS + contains 'Convex smoke test' + lacks `<main` — flip to assert ABSENCE (or delete the two it() blocks)

D-8: DeliberationSlot.tsx lines ~45-56 have 5 `useQuery(api.X.byRunId, ...)` calls immediately followed by `void run; void pitchLog; void events; void votes; void corrections` plus a stale MOCK_ISSUE comment. The real render comes from Sanity props (`conversation`, `candidates`). The 5 api.*.byRunId strings are asserted in:
- apps/web/__tests__/deliberation-subscriptions.test.ts (dedicated)
- apps/web/__tests__/machine-editorial-components.test.ts (~lines 66-70)
- apps/web/__tests__/motion-polish.test.ts (~lines 140-144)

D-9: BuyButton.tsx (line 28-29) uses `require('@/components/marketing/ShopQtyProvider')` behind an eslint-disable; error path (line 78) only console.errors. Voice: dry, precise, no exclamation, no toast/modal/banner.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove the /_debug/convex route (D-7)</name>
  <files>apps/web/app/%5Fdebug/convex/page.tsx, apps/web/__tests__/debug-route.test.ts, apps/web/public/robots.txt, apps/web/README.md</files>
  <read_first>
    - apps/web/app/%5Fdebug/convex/page.tsx (header removal checklist)
    - apps/web/__tests__/debug-route.test.ts
    - apps/web/public/robots.txt
    - apps/web/README.md (lines 24, 182-192)
  </read_first>
  <action>
    Delete `apps/web/app/%5Fdebug/convex/page.tsx` and remove the now-empty `apps/web/app/%5Fdebug/` directory. Remove the `Disallow: /_debug/` line from `apps/web/public/robots.txt`. Rewrite `apps/web/__tests__/debug-route.test.ts` so it asserts the route file does NOT exist (`existsSync(...) === false`) — do not leave a `readFileSync` that will throw ENOENT. Correct `apps/web/README.md` to state the route was removed in Phase 29 (delete the stale "Phase 3 evidence / removed in Phase 9" wording).
  </action>
  <verify>
    <automated>pnpm --filter web test -- debug-route</automated>
  </verify>
  <acceptance_criteria>
    - `test ! -e apps/web/app/%5Fdebug/convex/page.tsx` (route file gone)
    - `grep -c "_debug" apps/web/public/robots.txt` == 0
    - `apps/web/__tests__/debug-route.test.ts` asserts absence (`grep -q "existsSync\|not.*exist\|toBe(false)" apps/web/__tests__/debug-route.test.ts`) and does NOT `readFileSync` the deleted page
    - `pnpm --filter web test -- debug-route` exits 0
  </acceptance_criteria>
  <done>The debug route, its robots entry, and stale README text are gone; the tripwire asserts absence and passes.</done>
</task>

<task type="auto">
  <name>Task 2: Remove dead Convex subscriptions in DeliberationSlot + update 3 tripwires (D-8)</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx, apps/web/__tests__/deliberation-subscriptions.test.ts, apps/web/__tests__/machine-editorial-components.test.ts, apps/web/__tests__/motion-polish.test.ts</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (lines ~40-60 — the 5 useQuery + void statements + MOCK_ISSUE comment)
    - apps/web/components/issue/IssueLayout.tsx (confirms deliberation renders from Sanity props)
    - apps/web/__tests__/deliberation-subscriptions.test.ts
    - apps/web/__tests__/machine-editorial-components.test.ts
    - apps/web/__tests__/motion-polish.test.ts
  </read_first>
  <action>
    In `DeliberationSlot.tsx` remove the 5 `useQuery(api.pipelineRuns.byRunId ...)` / `api.pitchLog.byRunId` / `api.deliberationEvents.byRunId` / `api.agentVotes.byRunId` / `api.qaCorrections.byRunId` calls, the corresponding `void run; void pitchLog; ...` suppressions, the now-unused `useQuery`/`api` imports (if nothing else uses them), and the stale `MOCK_ISSUE` comment. Confirm the component still renders deliberation from its Sanity props (`conversation`, `candidates`). Update the three tripwire tests so they no longer assert the 5 subscriptions exist — re-point each to the new contract (deliberation renders from Sanity props / no `api.*.byRunId` in DeliberationSlot). In `deliberation-subscriptions.test.ts`, keep any DEL-05 empty-state-copy assertions that still hold; remove/replace the "5 useQuery" and "'skip' sentinel" assertions.
  </action>
  <verify>
    <automated>pnpm --filter web test -- deliberation-subscriptions machine-editorial-components motion-polish</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "byRunId" apps/web/components/issue/DeliberationSlot.tsx` == 0
    - `grep -c "useQuery" apps/web/components/issue/DeliberationSlot.tsx` == 0
    - `grep -c "MOCK_ISSUE" apps/web/components/issue/DeliberationSlot.tsx` == 0
    - The three tripwire tests no longer assert the 5 `api.*.byRunId` subscriptions exist and pass: `pnpm --filter web test -- deliberation-subscriptions machine-editorial-components motion-polish` exits 0
    - `pnpm --filter web build` exits 0 (deliberation still renders from Sanity)
  </acceptance_criteria>
  <done>DeliberationSlot opens zero subscriptions; the three tripwires reflect the new contract and pass; the page still builds and renders deliberation from Sanity.</done>
</task>

<task type="auto">
  <name>Task 3: Visible checkout-failure message + static import (D-9)</name>
  <files>apps/web/components/marketing/BuyButton.tsx</files>
  <read_first>
    - apps/web/components/marketing/BuyButton.tsx (require() at line 28-29; error path at line 78)
    - .planning/phases/29-deployment-hardening-code-fixes/29-CONTEXT.md (voice: dry, no winking, no toast)
  </read_first>
  <action>
    In `BuyButton.tsx`: add a `useState` error string; on checkout API failure set a dry, on-voice inline message rendered near the button (no toast/modal/banner) and re-enable the button (existing behavior). Voice: precise and flat, e.g. "Checkout is unavailable right now. Try again in a moment." (no exclamation, no winking). Replace the runtime `require('@/components/marketing/ShopQtyProvider')` (fragile under Turbopack) with a static top-level import and remove the `eslint-disable-next-line @typescript-eslint/no-require-imports` comment.
  </action>
  <verify>
    <automated>pnpm --filter web test -- BuyButton buy-button 2>/dev/null || pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "useState" apps/web/components/marketing/BuyButton.tsx` and an inline error message string renders on failure
    - `grep -c "require(" apps/web/components/marketing/BuyButton.tsx` == 0 and `grep -c "no-require-imports" apps/web/components/marketing/BuyButton.tsx` == 0 (static import used)
    - Message contains no `!` and no toast/modal/banner API call (`grep -c "toast\|alert(" apps/web/components/marketing/BuyButton.tsx` == 0)
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>Checkout failures surface a dry inline message; the fragile runtime require is a static import; web build is green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` green (debug-route asserts absence; the 3 deliberation tripwires reflect the new no-subs contract)
- `pnpm --filter web build` exits 0
- grep: no `/_debug` in robots.txt, no `byRunId`/`useQuery` in DeliberationSlot.tsx, no `require(` in BuyButton.tsx
</verification>

<success_criteria>
The public debug route is gone, the highest-traffic page opens zero wasted subscriptions while still rendering deliberation from Sanity, and a failed checkout is no longer a silent dead-end — all with the vitest suite and strict `pnpm --filter web build` green.
</success_criteria>

<output>
After completion, create `.planning/phases/29-deployment-hardening-code-fixes/29-03-SUMMARY.md`
</output>
