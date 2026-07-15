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
 * Review Desk, Signal Desk, and Voice Pass LEFT the nav — they are now issue
 * sub-routes reachable from `/issues/[issueNumber]` (D-07/D-09): thin
 * issue→run param translations around the already-shipped screens, at
 * `/issues/[n]/review` and `/issues/[n]/voice`. Their labels are unchanged;
 * the nomenclature pass (Run Monitor → Run Details, Registry → Editorial
 * Memory) is Phase 50, not this plan.
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
      { label: 'Issues', href: '/issues' },
    ],
  },
  {
    label: 'System Workbench',
    items: [
      { label: 'Run Monitor', href: '/run-monitor' },
      { label: 'Prompt Lab', href: '/prompt-lab' },
      { label: 'Eval Center', href: '/eval-center' },
      { label: 'Registry', href: '/registry' },
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
