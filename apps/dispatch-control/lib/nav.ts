/**
 * Single source of truth for the grouped left nav in the Dispatch Control shell.
 *
 * quick 260730-ldn — Editorial collapses to exactly TWO items: **The Run**
 * (`/run`) and **Archive** (`/issues`). This retires the Phase 40/41/quick
 * 260730-i4j history below it: four Editorial entries used to point at
 * three surfaces, two of them at the very same `/issues` URL (`Issues` and
 * `Issue Workspace`). My Tasks' signal — "what needs me right now" — is now
 * carried by The Run's per-section finding chips and its three gates
 * (facts / voice / publish), so the nav entry is redundant; `/my-tasks`
 * itself is UNCHANGED and still reachable from `AwaitingYouInbox`'s
 * "See all" link. The Issue Workspace's five stage tabs are similarly
 * absorbed: reading a section IS the Draft stage, and Fact Check / Voice /
 * Approval become the three gates at the bottom of The Run.
 *
 *   Editorial        → The Run (/run) · Archive (/issues)
 *   System Workbench → Run Monitor · Prompt Lab · Eval Center · Registry —
 *                       the machine, visited when something broke or an
 *                       agent needs improving.
 *   Operations       → Config · Finance · Settings — unchanged.
 *
 * Review Desk, Signal Desk, and Voice Pass LEFT the nav — they are issue
 * sub-routes reachable from `/issues/[issueNumber]` (D-07/D-09): thin
 * issue→run param translations around the already-shipped screens, at
 * `/issues/[n]/review` and `/issues/[n]/voice`. Their labels are unchanged.
 *
 * Phase 50 (WBN-01, D-04/D-06) — the four System Workbench labels below are
 * sourced from `lib/nomenclature.ts`'s `WORKBENCH_NAV_LABELS` (Run Monitor →
 * Run Details, Prompt Lab → Agent Instructions, Eval Center → Quality Tests,
 * Registry → Editorial Memory) so the display copy has one source of truth.
 * Only the LABELS changed — every href below is unchanged (D-02: routes are
 * not renamed).
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
      // quick 260730-ldn — the front door. Resolves the current issue ONLY
      // through useCurrentRun() (lib/currentRun.ts), never max(issueNumber).
      { label: 'The Run', href: '/run' },
      // The full archive — every issue this workspace has produced, by title.
      { label: 'Archive', href: '/issues' },
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
