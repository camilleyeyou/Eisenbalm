---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 03
type: execute
wave: 2
depends_on: ["30-01"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/config/page.tsx
  - apps/dispatch-control/app/(dashboard)/config/_components/NextRunDisplay.tsx
  - apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx
  - apps/dispatch-control/app/(dashboard)/config/_components/AutomationPanel.tsx
  - apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx
  - apps/dispatch-control/app/(dashboard)/finance/page.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/FinanceSummaryCard.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx
  - apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx
  - apps/dispatch-control/app/(dashboard)/settings/page.tsx
  - apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx
  - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx
  - apps/dispatch-control/__tests__/screen-token-swap.test.ts
autonomous: true
requirements: [CHR-01]
must_haves:
  truths:
    - "Config, Finance, and Settings screens render in the 1c skin — no leftover default gray shadcn/neutral styling remains"
  artifacts:
    - path: "apps/dispatch-control/__tests__/screen-token-swap.test.ts"
      provides: "Source-scan tripwire asserting no literal neutral-*/bg-white classes remain in the 13 files"
      contains: "neutral-"
  key_links:
    - from: "config/finance/settings component files"
      to: "1c tokens in globals.css"
      via: "bg-[color:var(--color-*)] arbitrary-value classes replacing literal neutral-*/white"
      pattern: "\\[color:var\\(--color-"
---

<objective>
Execute the token-swap-only pass (D-06/D-07) across the Config, Finance, and Settings screens. Per RESEARCH Pitfall 1, a `globals.css :root` variable remap does NOT restyle these screens — they use literal `neutral-*`/`white`/`text-neutral-*` Tailwind classes that compile to fixed hex and are unaffected by CSS-variable changes. This is a mechanical, source-scan-verified literal-class replacement pass, NOT a re-layout (do not restructure these screens — their owning rebuild is deferred; layout follow-ups are noted, not fixed here).

Purpose: ROADMAP Success Criterion 1 ("no leftover default styling remains") fails at UAT unless these 13 files are swapped to 1c tokens.
Output: 13 files with `neutral-*`/`white` classes replaced by 1c token arbitrary-value classes; a tripwire test locking the absence of the old classes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@apps/dispatch-control/app/globals.css
</context>

<interfaces>
<!-- 1c token → replacement class mapping (use these consistently):
  bg-white / bg-neutral-50        → bg-[color:var(--color-card)]        (surfaces) or bg-[color:var(--color-rail)] (page bg)
  bg-neutral-100 / bg-neutral-900 → bg-[color:var(--color-card-alt)] / bg-[color:var(--color-ink)]
  text-neutral-900 / text-black   → text-[color:var(--color-ink)]
  text-neutral-700/600/500        → text-[color:var(--color-ink-soft)]
  text-neutral-400                → text-[color:var(--color-faint)]
  border-neutral-200/300          → border-[color:var(--color-ink)]/15  (hard hairline)
  destructive/red accents         → text-[color:var(--color-vermilion)] / bg-[color:var(--color-vermilion)]
  positive/green accents          → text-[color:var(--color-green)]
  rounded-md/lg/xl                → rounded-none  (hard-edged anti-SaaS)
-->
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author the token-swap tripwire + swap Config screen (5 files)</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/config/page.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/AutomationPanel.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx
    - apps/dispatch-control/app/(dashboard)/config/_components/NextRunDisplay.tsx
  </read_first>
  <files>
    apps/dispatch-control/__tests__/screen-token-swap.test.ts,
    apps/dispatch-control/app/(dashboard)/config/page.tsx,
    apps/dispatch-control/app/(dashboard)/config/_components/NextRunDisplay.tsx,
    apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx,
    apps/dispatch-control/app/(dashboard)/config/_components/AutomationPanel.tsx,
    apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx
  </files>
  <behavior>
    - screen-token-swap.test.ts globs the 13 known files across config/finance/settings and asserts NONE contain a literal `neutral-` class token, `bg-white`, `text-white`, or `text-black` (source-scan via node:fs)
    - It asserts each file references at least one 1c token class `[color:var(--color-`
    - Config's 5 files pass after this task; the finance/settings files are still red until Task 2
  </behavior>
  <action>
    First author `__tests__/screen-token-swap.test.ts` per the behavior block, with the 13-file list hardcoded (the exact paths in this plan's files_modified). Then do the mechanical swap on the 5 Config files using the mapping in the interfaces block: replace every literal `neutral-*`, `bg-white`, `text-white`, `text-black`, and `rounded-md/lg` class with its 1c token equivalent. Preserve all logic, props, JSX structure, and the `monthly_cap_usd`/`auto_publish` config-key wiring in BudgetCapsPanel byte-unchanged — change ONLY color/radius utility classes. Do not re-lay-out.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run screen-token-swap</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rl "neutral-" apps/dispatch-control/app/(dashboard)/config` returns nothing
    - `grep -rq "\[color:var(--color-" apps/dispatch-control/app/(dashboard)/config/page.tsx` succeeds
    - BudgetCapsPanel still reads/writes config keys `monthly_cap_usd` and `auto_publish` (unchanged): `grep -q "monthly_cap_usd" apps/dispatch-control/app/(dashboard)/config/_components/BudgetCapsPanel.tsx`
    - screen-token-swap.test.ts's Config assertions pass
  </acceptance_criteria>
  <done>Config screen fully swapped to 1c tokens; tripwire authored and Config-green.</done>
</task>

<task type="auto">
  <name>Task 2: Swap Finance (5 files) + Settings (3 files) screens</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/finance/page.tsx + its 4 _components
    - apps/dispatch-control/app/(dashboard)/settings/page.tsx + its 2 _components
    - apps/dispatch-control/__tests__/screen-token-swap.test.ts (the tripwire authored in Task 1)
  </read_first>
  <files>
    apps/dispatch-control/app/(dashboard)/finance/page.tsx,
    apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx,
    apps/dispatch-control/app/(dashboard)/finance/_components/FinanceSummaryCard.tsx,
    apps/dispatch-control/app/(dashboard)/finance/_components/ModelPricingCard.tsx,
    apps/dispatch-control/app/(dashboard)/finance/_components/IssueRevenueTable.tsx,
    apps/dispatch-control/app/(dashboard)/settings/page.tsx,
    apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx,
    apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx
  </files>
  <action>
    Apply the identical mechanical swap (interfaces-block mapping) to the 5 Finance files and 3 Settings files. Preserve all logic, data wiring, and structure — change only color/radius utility classes. For status colors keep semantics: money-positive → `--color-green`, fees/negative or destructive → `--color-vermilion`, staleness warnings → `--color-marigold`/`--color-marigold-text`. Do not re-lay-out (D-07). If any layout reads poorly after the swap, add a `// TODO(Phase-owner): layout follow-up` comment and move on — do not fix here.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run screen-token-swap && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rl "neutral-" apps/dispatch-control/app/(dashboard)/finance apps/dispatch-control/app/(dashboard)/settings` returns nothing
    - `grep -rl "bg-white\|text-white\|text-black" apps/dispatch-control/app/(dashboard)/finance apps/dispatch-control/app/(dashboard)/settings` returns nothing
    - screen-token-swap.test.ts fully green (all 13 files)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Finance + Settings screens fully swapped to 1c tokens; full tripwire green; build clean.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run screen-token-swap` green
- `pnpm --filter dispatch-control build` exits 0
- No literal neutral-*/white/black classes remain in config/finance/settings
</verification>

<success_criteria>
CHR-01 (Pitfall 1): Config/Finance/Settings render in the 1c skin with no leftover default styling; tripwire locks it.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-03-SUMMARY.md`
</output>
