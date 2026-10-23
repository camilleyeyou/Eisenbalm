/**
 * Navigation single source of truth.
 *
 * Phase 56: the editor sees a three-link nav (This week's issue, Past issues,
 * Behind the scenes) on every page. The seven dials behind "Behind the
 * scenes" carry plain-word labels; route paths are unchanged. Money and
 * Charities are checked weekly, so they come first (client decision D-7).
 */

export interface EditorNavItem {
  label: string
  href: string
  match: (pathname: string) => boolean
}

export const EDITOR_NAV: ReadonlyArray<EditorNavItem> = [
  { label: "This week's issue", href: '/', match: p => p === '/' || p.startsWith('/s/') },
  { label: 'Past issues', href: '/archive', match: p => p.startsWith('/archive') },
  { label: 'Behind the scenes', href: '/admin', match: p => p.startsWith('/admin') },
]

export interface AdminItem {
  label: string
  href: string
  description: string
  /** Checked every week: listed first and tagged in the hub. */
  weekly?: boolean
}

export const ADMIN_ITEMS: ReadonlyArray<AdminItem> = [
  {
    label: 'Money',
    href: '/admin/finance',
    description: 'Sales, money sent to charities, and what the writing costs',
    weekly: true,
  },
  {
    label: 'Charities',
    href: '/admin/charities',
    description: 'Every charity we know about, and the ones never to use',
    weekly: true,
  },
  {
    label: 'Past issues, step by step',
    href: '/admin/runs',
    description: "How each issue was made, and what stopped the ones that didn't finish",
  },
  {
    label: 'What the writers are told',
    href: '/admin/agents',
    description: 'The instructions each writer follows, with earlier versions',
  },
  {
    label: 'Quality tests',
    href: '/admin/tests',
    description: 'Check the writing still sounds right after a change',
  },
  {
    label: 'Schedule and limits',
    href: '/admin/automation',
    description: 'When a new issue starts and how much it may cost',
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    description: 'Emails and the record of who changed what',
  },
]
