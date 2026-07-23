# Dispatch Control — Whole-App Layout & Rendering Audit

**Audited:** 2026-07-22 (same day as the Issue Workspace stage-page redesign, quick 260722-n5r)
**Method:** 4 parallel code auditors, one per app slice (home/tasks/issues · workspace-adjacent stages + overlays · run-monitor · ops/tools + shared chrome), each checking all routes against 12 defect classes derived from the workspace incident: (1) min-h-screen/vh inside the `<main>` scrollport, (2) double padding / inconsistent max-w, (3) fixed-width column starvation, (4) missing min-w-0 on long text, (5) viewport-scaled type in narrow containers, (6) unbounded flat lists, (7) pre/table overflow, (8) sticky/fixed/z-index collisions, (9) popovers inside overflow ancestors, (10) mobile fixed widths, (11) dead/duplicate navigation, (12) anchor jumps without scroll-margin. Every reported finding was confirmed at file:line; top findings independently re-verified by the orchestrator before fixing.

**Shell ground truth:** `(dashboard)/layout.tsx` = 52px Masthead + `flex flex-1 overflow-hidden` row holding the 210px AppSidebar and `<main class="flex-1 overflow-y-auto p-6">` — `<main>` is the app's only scrollport (100vh − 52px), and every page already receives a 24px gutter from it.

---

## Fixed (quick 260722-tv1, commits 8dd442d · d913ff8 · c81c400)

### Shell & page roots
- **AppSidebar `h-screen` → `h-full`** — the aside was 52px taller than its `overflow-hidden` parent row, permanently clipping the bottom pinned block ("How to use" + "Signed in as …") at every viewport height. The single worst pre-existing rendering bug found.
- **Issues home** — `min-h-screen px-6 py-8` root (≈100px guaranteed overscroll + 48px double gutters on the app's front door) → `min-h-full py-2`, matching the workspace frame.
- **InspectorPanel** — `fixed top-0 h-full z-40` painted over the Masthead's My-Tasks/UserButton region → `top-[52px] h-[calc(100%-52px)]`.
- **HelpTip popover z-20 → z-40** — was occluded by the workspace's sticky stage nav (z-30) for the tip mounted directly above it.
- **AwaitingYouInbox dropdown** — fixed 360px → clamped to viewport.
- **_PlaceholderScreen `min-h-[60vh]` → `min-h-[320px]`** — vh-sizing inside the scrollport (it renders inside the workspace's sticky rails, forcing pointless rail scroll).
- **HeldIssueRow** — `min-w-0` + `break-words` on the free-text hold reason; held list capped at 8 with a "+N more" note (published was already capped at 5, held was not).

### Issue Workspace stages
- **Voice stage starvation (the Draft twin's leftover)** — `VoicePassRunView` kept a fixed 336px rail beside the galley keyed to the *viewport* `lg:` breakpoint; inside the workspace canvas (~582px at a 1440px viewport) the galley collapsed to ~230px. Now a **container query** (`.voice-canvas` / `.voice-stage-row` in globals.css, breakpoint 56rem of the canvas itself): the rail sits beside the galley only when the canvas is genuinely wide enough, else stacks full-width below. One layout serves both the workspace mount and standalone `/voice-pass/[runId]`.
- **Dead jump-nav** — `WorkspaceOutline` rows (all 5 stages), `DecisionRail`'s Transcript/must-fix jumps and `SourceIndex`'s "Jump to section" (Approval stage) all targeted `galley-*` anchors that only exist on Draft/Voice → silent no-ops on 3 of 5 stages. All now fall back to routing to the Draft stage with the anchor hash; `ReviewDeskRunView` gained a one-shot hash-scroll effect after draft load (sticky-offset handled by the existing `scroll-margin-top: 88px`).
- **Stage padding consistency** — `StoryBriefScreen` dropped its outer `p-6` (content edge no longer jumps when switching stage tabs); `SignalDeskScreen` dropped its own `p-6` (was doubling `<main>`'s at `/signal-desk`).
- **Galley annotation popover** — `.galley-popover` had no edge logic; right-edge findings overflowed/clipped. `AnnotationMark` now measures on open and shifts the popover left of the viewport edge (mirrors HelpTip's self-clamp).
- **PassageToolbar** — fixed-position floor raised above the Masthead (top ≥ 60) and right-edge clamped.
- **DecisionLog** — `min-w-0 break-words` on the 1fr value cells (long runIds/JSON snapshots could overflow the narrow canvas).
- **`min-h-[70vh]` dropped** from ReviewDeskRunView + VoicePassRunView roots (viewport-sizing inside the scrollport).

### Run Monitor & ops hardening
- **Runs/Graph tab bar now sticky** (`top-0 z-20` with rail background) — previously scrolled away on long tables.
- **Graph page `-m-6` → `-mx-6`** — the negative top/bottom margins pulled the header under the tab bar and added ~24px overscroll.
- **`max-w-[1600px]` wrappers** on the runs list and run-detail pages (were edge-to-edge on wide monitors; now match the workspace).
- **Client-side list caps with "Show all/older" toggles:** RunsTable → latest 50; DriftScoreboard series → latest 20 (+ each table now wrapped in `overflow-x-auto` — it had `min-w-[420px]` with no wrapper); VersionHistoryPanel → latest 20; IssueComments → latest 20 with "Show earlier". DiffViewer got `max-h-[480px]` so its `overflow-auto` actually engages.

**Gates after all fixes:** `pnpm --filter dispatch-control build` clean; full suite 1085/1085 (136 files). The only test edits were adding `useRouter` to nine pre-existing `next/navigation` mocks (new import in jump-nav files); no assertions changed.

---

## Flagged, NOT fixed (needs a decision or its own task)

1. **AppSidebar has no mobile collapse** — hard 210px with no breakpoint; below tablet width the app is effectively unusable (~117px content at 375px). Needs a design call: icon rail vs off-canvas drawer. (The in-page grids all collapse fine; the sidebar is the sole mobile blocker.)
2. **My Tasks renders tasks as one flat list** — 30–50+ rows on a heavy issue, no severity/stage grouping. Cheap to group since `TaskSeverity` is already on each row.
3. **`convex/runs.listForWorkspace` still `.collect()`s every run** — four components subscribe to the full list per page. The UI now caps at 50 client-side, but a server-side `.order('desc').take(N)` needs a Convex change + live deploy sync (deliberately excluded from this pass per the convex-functions-need-live-sync memory).
4. **Graph page vs AutoPublishBanner** — when the red auto-publish banner is active, the `h-full` tab shell + banner exceeds the scrollport and the React Flow bottom controls can clip. Exceptional mode; fix by making the banner participate in the height chain.
5. **RegistryTable and IssueRevenueTable remain unpaginated** — fine at current data volume; copy `AuditLogViewer`'s `limit: 50` + "showing latest" pattern when they grow.
6. **DecisionLog mounts ~11 times on the Story stage** (once per lead via LeadActions + once per brief field via BriefFieldStrengthen) — repeated identical logs down the page; consolidate to one per stage.
7. **HelpTip is absolute-positioned, not portaled** — safe in every current mount, but fragile inside overflow containers (e.g. the RunsTable `<th>`); portal it if tips are added to scrollable tables.
8. **`ClaimsChecklist.tsx` is dead code** (no importers since the review route became redirect-only) — delete when convenient.
9. **Run Monitor visual-token debt** — still on raw `neutral-*`/`text-sm` instead of the 1c `var(--color-*)`/bracket-pixel system (known from the 2026-07-18 review; style-only, no rendering defect).
10. **Tooling bug:** `gsd-tools state record-session --cwd` overwrote STATE.md frontmatter with stale milestone values (v2.0/50-phases instead of v4.0/11); the executor reverted and hand-edited. Avoid that command in this repo until fixed.

## Verified clean (no action needed)

Config, Finance (structure), Settings (AuditLogViewer is the in-repo exemplar: capped + wrapped), Registry chrome, Prompt Lab editor grid (no starvation at any common viewport), Eval Center apart from DriftScoreboard, Masthead/AwaitingYou z-order, all dialogs (z-50, centered, unclipped), onboarding tour overlay, RunDetail/AgentIOPanel overflow handling (exemplary: `break-all` runIds, wrapped `<pre>`, `max-h` + internal scroll), ReviewQueue truncation, How-to-use page, IssueCard/StageStrip/CreatePanel responsiveness, and the rebuilt Issue Workspace frame itself.
