/**
 * Single source of truth for the grouped left nav in the Dispatch Control shell.
 *
 * Phase 40 (ISS-02 / D-31, §40.9) restructure — the console became
 * issue-keyed (Plans 40-02..40-07): a run stopped being the editorial nav
 * object, so the groups are now:
 *   Editorial        → Issues (/issues) — the editorial home. My Tasks joins
 *                       this group in Phase 43; the Issue Workspace lands in
 *                       Phase 41 (both replace/extend this same URL tree).
 *   System Workbench → Run Monitor · Prompt Lab · Eval Center · Registry —
 *                       the machine, visited when something broke or an
 *                       agent needs improving. Run Monitor SURVIVES as a nav
 *                       item here (D-08) — ISS-02's "never a top-level nav
 *                       destination" means a run stops being the *editorial*
 *                       object, not that it becomes unreachable.
 *   Operations       → Config · Finance · Settings — unchanged.
 *
 * quick 260730-i4j — the Desk (`/desk`) is now the FRONT DOOR: it supersedes
 * the Issues-home-as-front-door decision above (root redirect now points at
 * `/desk`, not `/issues`). Desk is the FIRST Editorial item — a work-first
 * landing that states the run and lists every open task in one place.
 * `/issues` survives unchanged, one slot down, as the full archive (every
 * issue, held/published lists, the create panel) — reachable, not forced.
 *
 * Review Desk, Signal Desk, and Voice Pass LEFT the nav — they are now issue
 * sub-routes reachable from `/issues/[issueNumber]` (D-07/D-09): thin
 * issue→run param translations around the already-shipped screens, at
 * `/issues/[n]/review` and `/issues/[n]/voice`. Their labels are unchanged;
 *
 * Phase 50 (WBN-01, D-04/D-06) — the nomenclature pass has now landed: the
 * four System Workbench labels below are sourced from
 * `lib/nomenclature.ts`'s `WORKBENCH_NAV_LABELS` (Run Monitor → Run Details,
 * Prompt Lab → Agent Instructions, Eval Center → Quality Tests, Registry →
 * Editorial Memory) so the display copy has one source of truth. Only the
 * LABELS changed — every href below is unchanged (D-02: routes are not
 * renamed).
 *
 * "How to use" is pinned at the bottom, outside the three groups.
 * The dc.html spec uses no icons — plain text nav items only.
 *
 * NAMING TRAP (§40 preamble): this console route tree at `/issues/[n]` is
 * keyed by **issueNumber**. It is UNRELATED to the pipeline's 18 endpoints
 * shaped `/issues/{run_id}/...` (content.py, review.py, findings.py,
 * signoffs.py, voice_pass.py, control.py), where `{run_id}` is a **runId**.
 * Different hosts, different frameworks, opposite path-param meanings — they
 * collide in string only.
 */

import { WORKBENCH_NAV_LABELS } from './nomenclature'

export interface NavItem {
  label: string
  href: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Editorial',
    items: [
      // quick 260730-i4j — the front door. Ahead of Issues: a work-first
      // landing (run band + every open task) rather than the archive.
      { label: 'Desk', href: '/desk' },
      { label: 'Issues', href: '/issues' },
      // Phase 41 (WSP-01, D-22) — the single "Issue Workspace" entry that
      // completes WSP-01's "replace the three desks" (Review/Signal/Voice
      // already left the nav in Phase 40 D-31). Links to /issues; the bare
      // /issues/[n] route redirects onward to the last-visited stage (D-03).
      // "Issues" is the home/list; "Issue Workspace" is the current-issue entry.
      { label: 'Issue Workspace', href: '/issues' },
      // Phase 43 Plan 43-05 (TSK-01) — the reserved slot this comment
      // predicted: the nav-level, cross-stage task list the Masthead's
      // count-only "My Tasks · N" readout (Phase 40 Plan 40-08) and the
      // AwaitingYouInbox "See all" link both point at.
      { label: 'My Tasks', href: '/my-tasks' },
    ],
  },
  {
    label: 'System Workbench',
    items: [
      { label: WORKBENCH_NAV_LABELS.run_monitor, href: '/run-monitor' },
      { label: WORKBENCH_NAV_LABELS.prompt_lab, href: '/prompt-lab' },
      { label: WORKBENCH_NAV_LABELS.eval_center, href: '/eval-center' },
      { label: WORKBENCH_NAV_LABELS.registry, href: '/registry' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Config', href: '/config' },
      { label: 'Finance', href: '/finance' },
      { label: 'Settings', href: '/settings' },
    ],
  },
]

export const NAV_PINNED: NavItem = { label: 'How to use', href: '/how-to-use' }
