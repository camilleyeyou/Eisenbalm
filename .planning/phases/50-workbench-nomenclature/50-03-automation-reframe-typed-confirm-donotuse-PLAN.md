---
phase: 50-workbench-nomenclature
plan: 03
type: execute
wave: 1
depends_on: ["50-00"]
files_modified:
  - apps/dispatch-control/components/Masthead.tsx
  - apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx
  - apps/dispatch-control/__tests__/registryDoNotUse.test.ts
  - apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx
autonomous: true
requirements: [WBN-06, WBN-05]

must_haves:
  truths:
    - "The Masthead no longer frames automation as an ON/OFF switch; the normal case reads 'Human approval required'"
    - "The AutoPublishBanner points to Administration (Config) and drops switch-framing"
    - "Mark Do-not-use requires typed organization-name confirmation + required reason, Editor-in-chief only"
    - "No typed-confirmation UI exists on either publish surface"
    - "The rendered charity status label reads 'Do not use' while the stored enum value stays 'blocklisted'"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx"
      provides: "typed org-name confirm step on Mark Do-not-use + 'Do not use' labels over unchanged 'blocklisted' value"
      contains: "Do not use"
    - path: "apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts"
      provides: "source-scan proving neither publish surface has a typed-confirm input"
      contains: "typed"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx"
      to: "convex charities.setStatus"
      via: "status: 'blocklisted' unchanged (label swap only)"
      pattern: "status: 'blocklisted'"
    - from: "apps/dispatch-control/components/Masthead.tsx"
      to: "Administration (Config)"
      via: "automation setting relocated off the operator surface"
      pattern: "Human approval required|Administration|/config"
---

<objective>
WBN-06 (+ the WBN-05 Do-not-use label swap). Remove the automation switch-framing from the operator surface, confirm typed confirmation is reserved for Mark Do-not-use only (never on publish), add the typed organization-name confirmation step to Mark Do-not-use, and swap the rendered "Blocklisted" label to "Do not use" over the unchanged stored enum.

Purpose: The Masthead "Auto-publish ON" chip + AutoPublishBanner still read as a switch on the editorial surface (D-16); the automation setting belongs in Administration (Config). Typed confirmation is a high-friction gate reserved for destructive/administrative actions — D-15 reserves it for Mark Do-not-use (org name + reason, Editor-in-chief) and forbids it on the routine publish path (Phase 34 reversal). The `blocklisted → "Do not use"` change is a display-label swap over an unchanged, load-bearing enum (D-03).
Output: Reframed automation copy, a typed-name Do-not-use confirm, a "Do not use" label, and tests proving publish carries no typed confirm.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@.planning/phases/50-workbench-nomenclature/50-RESEARCH.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@apps/dispatch-control/components/Masthead.tsx
@apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx
@apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
@apps/dispatch-control/components/LockedControl.tsx
@apps/dispatch-control/lib/nomenclature.ts

<interfaces>
<!-- Masthead.tsx ~:286 current: {autoPublish ? 'Auto-publish ON' : 'Human approval required'} -->
<!-- AutoPublishBanner.tsx ~:52 current text: "Auto-publish is enabled. Runs will publish automatically without review." link → /config "Change in Config" -->
<!-- RegistryTable.tsx (Phase 43): reason-only confirm today —
     confirmingBlocklistId / blocklistReason state; handleBlocklist() calls
     setStatus({ workspace_id, charityId, status: 'blocklisted', reason }).
     Editor gating already server-enforced (Phase 49 requireEditor) + client LockedControl. -->
<!-- DERIVED-STATE §6 locked labels: Mark Do not use → '🔒 editor only' ; Publish → 'Collaborators can review and comment, not publish.' -->
<!-- Annotations §Approval: "Routine weekly approval is deliberately not scary; typed confirmation is reserved for Do-not-use marking, enabling automation, destructive deletion." -->
<!-- Annotations §Editorial Memory: "Mark Do not use = typed confirmation (org name) + required reason, Editor-in-chief only" ; status labels: In progress / Published / Considered / Do not use (never "blocklisted"). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reframe the Masthead automation chip + AutoPublishBanner (remove switch-framing)</name>
  <files>apps/dispatch-control/components/Masthead.tsx, apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx</files>
  <read_first>
    - apps/dispatch-control/components/Masthead.tsx (~:280-290 the autoPublish chip)
    - apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx (~:40-60 banner text + /config link)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Global header ("'Human approval required' replaces 'Auto-publish OFF' — a reassurance, not a switch. The automation setting itself lives in Administration…")
    - .planning/phases/50-CONTEXT.md D-16 (finish the ON chip + banner; Config = the Administration home; do NOT build a new Administration screen)
  </read_first>
  <action>
    Masthead.tsx: the chip currently renders `autoPublish ? 'Auto-publish ON' : 'Human approval required'`. The OFF case ('Human approval required') is correct — keep it. Reword the ON case so it is NOT switch-framed: replace `'Auto-publish ON'` with an honest, non-switch alert that points to Administration, e.g. `'Publishing automatically — managed in Administration'` (keep the vermilion styling for the ON/alert state). The chip must never read as a toggle the operator flips here. (Exact wording is D-16 discretion within the "reassurance/alert, not a switch" register — do not reintroduce "Auto-publish ON/OFF" switch phrasing.)
    AutoPublishBanner.tsx: reword the enabled-state text away from switch language and point at Administration. Replace "Auto-publish is enabled. Runs will publish automatically without review." with copy in the same register, e.g. "Publishing is automatic. This setting is managed in Administration, not here." Keep the `/config` link but relabel it "Open Administration" (or keep "Change in Config" — the "Administration" label for Config is D-16 discretion). Do NOT move or rebuild the actual `AutoPublishToggle` (it stays in `/config` — the Administration home); do NOT build a new Administration screen.
  </action>
  <acceptance_criteria>
    - `grep -rn "Auto-publish ON\|Auto-publish OFF" apps/dispatch-control/components/Masthead.tsx apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx` returns NOTHING.
    - `grep -n "Human approval required" apps/dispatch-control/components/Masthead.tsx` still hits (the OFF/normal case preserved).
    - The banner references Administration/Config and no longer says "Runs will publish automatically without review" as switch-framing (grep confirms the old sentence is gone).
    - `AutoPublishToggle` still lives under `/config` (unchanged): `grep -rl "AutoPublishToggle" apps/dispatch-control/app/(dashboard)/config` hits.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control build</automated></verify>
  <done>The Masthead chip + banner no longer frame automation as an operator-surface switch; the setting stays in Config/Administration; the normal case reads "Human approval required".</done>
</task>

<task type="auto">
  <name>Task 2: Add typed org-name confirmation to Mark Do-not-use + swap the "Do not use" label</name>
  <files>apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx, apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx, apps/dispatch-control/__tests__/registryDoNotUse.test.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx (confirmingBlocklistId / blocklistReason / handleBlocklist / setStatus call + filter options)
    - apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx (status → label mapping)
    - apps/dispatch-control/components/LockedControl.tsx (Editor-in-chief lock pattern already applied here)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Editorial Memory (typed org-name + reason, Editor-in-chief) + status labels
    - .planning/phases/50-CONTEXT.md D-03 (label swap over unchanged 'blocklisted' value) + D-15 (typed confirm reserved for Do-not-use)
  </read_first>
  <action>
    RegistryTable.tsx — extend the existing reason-only confirm popover into a typed-name + reason confirm for Mark Do-not-use:
      1. Add a controlled text input for the operator to TYPE the organization's exact name; the "Mark Do not use" confirm button stays disabled until (a) the typed name matches the charity's `name` (exact, trimmed) AND (b) the required reason is non-empty. Keep the existing `blocklistReason` requirement; add `typedName` state.
      2. Keep the Editor-in-chief gating exactly as-is (LockedControl / requireEditor already enforce it) — do not weaken it.
      3. Leave the mutation byte-unchanged: `handleBlocklist` still calls `setStatus({ workspace_id, charityId, status: 'blocklisted', reason })`. The STORED value stays `'blocklisted'` (D-03) — only the UI adds the typed-name step and renames labels.
      4. Rename operator-facing labels: filter option `{ value: 'blocklisted', label: 'Blocklisted' }` → keep value `'blocklisted'`, change `label` to `'Do not use'`; the action button text "Blocklist"/"Unblocklist" → "Mark Do not use"/"Restore to consideration" (value/handlers unchanged). Fix the stale "(Phase 47)" comment (RESEARCH Pitfall 9) → "(Phase 50)".
    CharityStatusBadge.tsx — map the `'blocklisted'` status to the rendered label `'Do not use'` (badge text only; the switch/compare on `status === 'blocklisted'` stays).
    Create `apps/dispatch-control/__tests__/registryDoNotUse.test.ts`:
      - Assert the confirm button is disabled until the typed name matches the charity name AND reason is non-empty (mock a charity, drive the inputs).
      - Assert the mutation is called with `status: 'blocklisted'` (unchanged value) when confirmed.
      - Assert CharityStatusBadge renders "Do not use" (not "Blocklisted") for a `'blocklisted'` charity.
      - Assert no operator-facing "Blocklist"/"Blocklisted" label survives in the rendered output (the value literal in code is fine).
  </action>
  <acceptance_criteria>
    - `grep -n "status: 'blocklisted'" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` still hits (stored value unchanged).
    - `grep -n "Do not use" apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx` hits.
    - `pnpm --filter dispatch-control test -- --run registryDoNotUse` passes (typed-name gating, unchanged mutation value, "Do not use" label, no "Blocklisted" copy).
    - rename-preservation tripwire (50-00) stays green (the 'blocklisted' literal + audit action preserved).
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run registryDoNotUse && pnpm --filter dispatch-control build</automated></verify>
  <done>Mark Do-not-use requires typed org name + reason (Editor-in-chief); labels read "Do not use"; the stored 'blocklisted' value + audit action are untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Verify + guard that neither publish surface carries a typed confirmation</name>
  <files>apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx (primary publish surface)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/PublishPreviewDialog.tsx (publish confirm dialog)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx (legacy sibling publish surface)
    - .planning/phases/50-CONTEXT.md D-15 + .planning/phases/50-RESEARCH.md §"Pitfall 8" (two publish surfaces; verify, don't assume)
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §1 (ready = factDone && voiceDone — the only publish gate)
  </read_first>
  <action>
    Read both publish surfaces (`DecisionRail.tsx`, `ReviewDecisionPanel.tsx`) and the publish confirm dialog (`PublishPreviewDialog.tsx`). Confirm the publish unlock is `ready = factDone && voiceDone` (∧ Editor ∧ !published) with only a concise preview→confirm — NO typed-text-match input (no "type the issue title to confirm" pattern mirroring the Do-not-use org-name input). If any leftover typed-confirmation UI exists on a publish path, REMOVE it (Phase 34 reversal — D-15). If none exists (expected), leave the surfaces byte-unchanged.
    Create `apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts` — a source-scan tripwire over `review-desk/[runId]/_components/` and `run-monitor/runs/[runId]/review/_components/`:
      - Assert NO typed-name/typed-title confirmation input pattern appears on the publish path (e.g. no controlled input whose value must equal the issue title/number to enable Publish). Model the scan on `roleGateInventory.test.ts`; encode the forbidden pattern narrowly (an input gating Publish on a typed match) so it does not false-positive on the Do-not-use surface (which legitimately HAS one, in the registry directory — out of this scan's scope).
      - Assert the publish button's enable condition references the sign-off gate (factDone/voiceDone or the existing `ready`/`canPublish` derivation), not a typed confirmation.
  </action>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test -- --run publishNoTypedConfirm` passes.
    - Manual grep documented in the SUMMARY: neither `DecisionRail.tsx` nor `ReviewDecisionPanel.tsx` contains a typed-title/typed-name confirm input on the publish path.
    - The registry Do-not-use typed confirm (Task 2) remains the ONLY typed-confirmation in operator copy.
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run publishNoTypedConfirm && pnpm --filter dispatch-control build</automated></verify>
  <done>Publish carries only the sign-off gate + a concise confirm (no typed confirmation), proven by a source-scan tripwire; typed confirmation exists only on Mark Do-not-use.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run registryDoNotUse publishNoTypedConfirm rename-preservation` green.
- `pnpm --filter dispatch-control build` exits 0.
- No "Auto-publish ON/OFF" switch copy on the operator surface; the 'blocklisted' stored value + `charity.blocklisted` audit action unchanged.
</verification>

<success_criteria>
- Automation reads "Human approval required" (normal) with the setting relocated to Config/Administration — no switch on the operator surface.
- Mark Do-not-use = typed org name + required reason, Editor-in-chief only.
- Publish has no typed confirmation.
- Charity status renders "Do not use" over the unchanged 'blocklisted' enum.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-03-SUMMARY.md`.
</output>
