/**
 * Single source of truth for the /admin hub (quick 261021-j83).
 *
 * The editor area (`/`, `/s/[section]`, `/archive`) has no nav. Everything an
 * operator might need lives behind ONE `Admin` link, as a flat list of plain
 * language items. Finance and Charities are checked weekly, so they come
 * first (client decision D-7). Pages keep their existing internals; only
 * their URL moved under /admin/*.
 */

export interface AdminItem {
  label: string
  href: string
  description: string
  /** Checked every week: listed first and tagged in the hub. */
  weekly?: boolean
}

export const ADMIN_ITEMS: ReadonlyArray<AdminItem> = [
  {
    label: 'Finance',
    href: '/admin/finance',
    description: 'Revenue, payouts and model costs',
    weekly: true,
  },
  {
    label: 'Charities',
    href: '/admin/charities',
    description: 'The charity registry and the do-not-use list',
    weekly: true,
  },
  {
    label: 'Runs',
    href: '/admin/runs',
    description: 'Every run, why one failed, and restarting it',
  },
  {
    label: 'Agent instructions',
    href: '/admin/agents',
    description: 'What each agent is told to do, with version history',
  },
  {
    label: 'Quality tests',
    href: '/admin/tests',
    description: 'Check that the agents still sound right after a change',
  },
  {
    label: 'Automation',
    href: '/admin/automation',
    description: 'Schedule and budget caps',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    description: 'Notifications and audit log',
  },
]
