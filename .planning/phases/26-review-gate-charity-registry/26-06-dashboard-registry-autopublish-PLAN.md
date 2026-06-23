---
phase: 26-review-gate-charity-registry
plan: 06
type: execute
wave: 3
depends_on: [26-01, 26-02]
files_modified:
  - apps/dispatch-control/app/(dashboard)/registry/page.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx
  - apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialog.tsx
  - apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx
  - apps/dispatch-control/app/(dashboard)/config/page.tsx
  - apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx
  - apps/dispatch-control/app/(dashboard)/layout.tsx
autonomous: true
requirements: [RVW-04, REG-01]
user_setup: []

must_haves:
  truths:
    - "The /registry page lists each charity with its state (candidate/featured/blocklisted), timesFeatured, and lastFeaturedAt"
    - "The operator can blocklist / unblocklist / change status and manually add a charity"
    - "auto_publish is off by default; enabling it requires a non-dismissible modal confirmation"
    - "Enabling auto_publish is rate-limited (24h), audit-logged, and emits a Convex alert event"
    - "When auto_publish is enabled the dashboard shows a persistent red alarming banner on every page"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/registry/page.tsx"
      provides: "Charity registry management UI (list + filters + state controls + add)"
    - path: "apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx"
      provides: "Friction-gated auto_publish toggle (modal + rate-limit error)"
    - path: "apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx"
      provides: "Persistent red layout-level enabled warning"
  key_links:
    - from: "AutoPublishToggle enable"
      to: "pipelineConfig:setAutoPublish"
      via: "Convex mutation enforcing 24h rate-limit + audit + alert event"
      pattern: "setAutoPublish"
    - from: "RegistryTable status controls"
      to: "charities:setStatus"
      via: "blocklist / status-change mutation"
      pattern: "charities:setStatus"
    - from: "AutoPublishBanner"
      to: "dashboard layout"
      via: "rendered on every page when auto_publish enabled"
      pattern: "AutoPublishBanner"
---

<objective>
Build the charity registry management UI (REG-01) and the friction-gated `auto_publish` toggle (RVW-04). The registry lists charities with state + featured stats and lets the operator blocklist / change status / add manually. The `auto_publish` toggle is deliberately high-friction: a non-dismissible modal, a 24h rate-limit (enforced in the Convex mutation), an audit log row, a Convex alert event, and a persistent alarming red banner when enabled.

Purpose: REG-01 makes the candidate/featured/blocklisted lifecycle operator-visible and editable (the Scout already consults it via Plan 02). RVW-04 makes bypassing the human gate loud and intentional — the human gate is the brand's design.
Output: /registry page + 3 components, auto_publish toggle + layout banner, config-page wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md
@.planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md
@CLAUDE.md

<interfaces>
<!-- Existing dispatch-control patterns. -->
apps/dispatch-control/app/(dashboard)/registry/page.tsx — current placeholder (replace).
apps/dispatch-control/app/(dashboard)/config/page.tsx — AutomationPanel + Danger Zone (border-red-200 bg-white). Add AutoPublishToggle below the schedule toggle in an "Advanced" subsection (border-t mt-4 pt-4).
apps/dispatch-control/app/(dashboard)/layout.tsx — dashboard shell (owns <main> + nav). Inject AutoPublishBanner at the top so it shows on every page.
apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx — amber role="alert" banner pattern (border-amber-200 bg-amber-50). Swap amber→red for AutoPublishBanner.
apps/dispatch-control/lib/workspace.ts — getCurrentWorkspace().
Convex (from Plan 26-01):
  charities:listByWorkspace({workspace_id, status?}) -> rows {_id, name, website, status, timesFeatured, lastFeaturedAt}
  charities:setStatus({workspace_id, charityId, status})
  charities:upsertCandidate / upsertFeatured (manual add path — use a setStatus-style add or a dedicated add; UI uses upsertCandidate for manual adds with status candidate)
  pipelineConfig:getAll({workspace_id}) -> rows {key, value}  (read auto_publish)
  pipelineConfig:setAutoPublish({workspace_id, enabled, actorId}) -> throws "rate_limited" within 24h
UI-SPEC copy: Charity Registry / Add Charity / state badges Candidate|Featured|Blocklisted / "Featured N time(s)" / Blocklist confirm copy / auto_publish modal copy / banner text / rate-limited error.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: CharityStatusBadge + AddCharityDialog + RegistryTable + /registry page</name>
  <read_first>
    - .planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md (Screen 3 Charity Registry: top bar, filter pills, table columns, status badge colors, Blocklist confirmation copy, "Featured N times" pluralization, empty state)
    - apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx (Convex useQuery + table + badge styling to reuse)
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx (placeholder being replaced)
    - convex/_generated/api.d.ts (charities query/mutation names)
  </read_first>
  <action>
1. `CharityStatusBadge.tsx` (`'use client'` or pure): props `{ status }`. Renders a text-label badge — Candidate (neutral), Featured (green-tinted: border-green-200 bg-green-50 text-green-700), Blocklisted (red-tinted: border-red-200 bg-red-50 text-red-700). Text label always present (not color alone — accessibility).

2. `AddCharityDialog.tsx` (`'use client'`): shadcn Dialog triggered by the "Add Charity" primary button. Fields: Name (required) + Website (optional). On submit, call `charities:upsertCandidate({workspace_id, name, website, runId: "manual"})` (manual adds enter as candidates). Close on success; show "Could not update the registry. Try again." on failure.

3. `RegistryTable.tsx` (`'use client'`):
   - Props `{ workspace_id }`. useQuery `charities:listByWorkspace({workspace_id})`. useMutation `charities:setStatus`.
   - Filter pills: All / Candidates / Featured / Blocklisted (active = filled neutral-900; inactive = outlined). Client-side filter on status.
   - Empty state: heading "No charities yet" + body "Charities appear here as the Scout pitches candidates. You can also add entries manually."
   - Columns: Name (text-sm), Website (text-sm muted, truncate 32 chars), Status (`<CharityStatusBadge />`), Times Featured (right-aligned numeric; label "Featured N time"/"Featured N times" pluralized), Last Featured (relative time, text-xs muted), Actions.
   - Actions column: a status toggle button. If blocklisted → "Remove from Blocklist" → setStatus to "candidate". Else → "Blocklist Charity" behind an inline confirmation popover: heading "Blocklist this charity?", body "The Scout will skip [name] in all future runs.", CTA "Blocklist Charity" → setStatus "blocklisted". All buttons ≥44px, focus-visible ring, `text-neutral-600 hover:text-neutral-900`.

4. Replace `registry/page.tsx` with a Server Component: `const workspace_id = await getCurrentWorkspace()`; `export const dynamic = 'force-dynamic'`. Top bar: "Charity Registry" h1 (text-xl font-semibold) + `<AddCharityDialog workspace_id={workspace_id} />` button (primary). Then `<RegistryTable workspace_id={workspace_id} />`. Single column `space-y-6`.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && grep -q "Charity Registry" "apps/dispatch-control/app/(dashboard)/registry/page.tsx" && grep -q "charities:listByWorkspace" "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx" && grep -q "charities:setStatus" "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx" && test -f "apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialog.tsx" && pnpm --filter dispatch-control typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - registry/page.tsx no longer contains "coming in Phase 26" (placeholder replaced)
    - `grep -q "charities:listByWorkspace" RegistryTable.tsx` AND `grep -q "charities:setStatus" RegistryTable.tsx` succeed
    - UI-SPEC copy present: `grep -q "No charities yet" RegistryTable.tsx` and `grep -q "The Scout will skip" RegistryTable.tsx`
    - CharityStatusBadge renders all three states with text labels (grep "Candidate" "Featured" "Blocklisted")
    - AddCharityDialog calls `charities:upsertCandidate`
    - `pnpm --filter dispatch-control typecheck` exits 0
  </acceptance_criteria>
  <done>The registry page lists charities with state + stats and supports blocklist/status-change/manual-add.</done>
</task>

<task type="auto">
  <name>Task 2: AutoPublishToggle (friction modal + rate-limit) + AutoPublishBanner + wiring</name>
  <read_first>
    - .planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md (auto_publish section: toggle copy, enable modal copy non-dismissible, banner text, rate-limited error, Screen 4 placement + enabled appearance)
    - apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx (role="alert" banner pattern — swap amber→red)
    - apps/dispatch-control/app/(dashboard)/config/page.tsx (where to mount AutoPublishToggle — Advanced subsection below schedule toggle)
    - apps/dispatch-control/app/(dashboard)/layout.tsx (where to inject AutoPublishBanner so it appears on every page)
    - convex/pipelineConfig.ts (setAutoPublish signature + getAll for reading current state — from Plan 26-01)
  </read_first>
  <action>
1. `AutoPublishToggle.tsx` (`'use client'`):
   - useQuery `pipelineConfig:getAll({workspace_id})`; derive current `auto_publish` boolean (JSON.parse the value row).
   - useMutation `pipelineConfig:setAutoPublish`; get actorId via `useAuth().userId`.
   - Toggle label "Auto-publish"; description "When enabled, finished runs publish automatically without review. Off by default."
   - The toggle renders as a RED destructive-styled button at all times (not a neutral switch) per UI-SPEC.
   - DISABLING is immediate: call `setAutoPublish({workspace_id, enabled:false, actorId})`.
   - ENABLING opens a non-dismissible shadcn Dialog (no X, no close-on-outside-click; page dimmed `bg-black/40`, not blurred): heading "Enable auto-publish?", body "Auto-publish bypasses the review gate. Runs will publish immediately when complete. This is audit-logged. You cannot re-enable within 24 hours of a disable.", CTA "Enable Auto-publish" (`--destructive`) → call `setAutoPublish({workspace_id, enabled:true, actorId})`.
   - On the mutation throwing `"rate_limited"`: show "Auto-publish was recently changed. Wait 24 hours before re-enabling."
   - Mount in config/page.tsx in an "Advanced" subsection: `<div className="border-t border-neutral-200 mt-4 pt-4">` containing `<AutoPublishToggle workspace_id={workspace_id} />`, placed below the existing schedule toggle (inside or just after AutomationPanel per UI-SPEC Screen 4).

2. `AutoPublishBanner.tsx` (`'use client'`):
   - useQuery `pipelineConfig:getAll`; if `auto_publish === true` render a persistent banner `border-red-200 bg-red-50 text-red-700`, `role="alert"`: text "Auto-publish is enabled. Runs will publish automatically without review." + a link "Change in Config" → `/config`. Render nothing when disabled.
   - Inject `<AutoPublishBanner workspace_id={workspace_id} />` at the TOP of the dashboard layout content in `layout.tsx` so it appears on every page (not per-page).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && grep -q "setAutoPublish" "apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx" && grep -q "Enable auto-publish?" "apps/dispatch-control/app/(dashboard)/config/_components/AutoPublishToggle.tsx" && grep -q "AutoPublishToggle" "apps/dispatch-control/app/(dashboard)/config/page.tsx" && grep -q "AutoPublishBanner" "apps/dispatch-control/app/(dashboard)/layout.tsx" && grep -q "border-red-200" "apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx" && pnpm --filter dispatch-control build 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "setAutoPublish" AutoPublishToggle.tsx` (mutation wired)
    - Non-dismissible modal: `grep -q "Enable auto-publish?" AutoPublishToggle.tsx` AND the dialog disables outside-close (grep for onInteractOutside/no-close or a comment documenting non-dismissible)
    - Rate-limit error copy present: `grep -q "Wait 24 hours before re-enabling" AutoPublishToggle.tsx`
    - AutoPublishToggle mounted in config/page.tsx (grep) and AutoPublishBanner mounted in layout.tsx (grep)
    - Banner uses `border-red-200` + `role="alert"` and renders only when enabled (verify by reading the conditional)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>auto_publish enablement is gated by a non-dismissible modal, rate-limited in Convex, audit-logged, alert-emitting, and visually alarming on every page.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control typecheck` + `build` exit 0.
- /registry lists charities with state + featured stats; blocklist/status/add work.
- auto_publish off by default; enabling needs the modal; rate-limit + audit + alert via the Convex mutation; red banner on every page when enabled.
</verification>

<success_criteria>
- The candidate/featured/blocklisted lifecycle is operator-visible and editable (REG-01).
- Bypassing the human gate is high-friction, audit-logged, rate-limited, and loud (RVW-04).
</success_criteria>

<output>
After completion, create `.planning/phases/26-review-gate-charity-registry/26-06-SUMMARY.md`.
</output>
