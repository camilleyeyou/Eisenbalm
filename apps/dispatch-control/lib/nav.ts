/**
 * Single source of truth for the grouped left nav in the Dispatch Control shell.
 * Order is workflow-ordered (CHR-03, dc.html D-01/D-06):
 *   Workflow      → Review Desk (home, D-04) · Signal Desk · Run Monitor · Voice Pass
 *   Craft & memory→ Prompt Lab · Eval Center · Registry
 *   Operations    → Config · Finance · Settings
 * "How to use" is pinned at the bottom, outside the three groups.
 * The dc.html spec uses no icons — plain text nav items only.
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
    label: 'Workflow',
    items: [
      { label: 'Review Desk', href: '/review-desk' },
      { label: 'Signal Desk', href: '/signal-desk' },
      { label: 'Run Monitor', href: '/run-monitor' },
      { label: 'Voice Pass', href: '/voice-pass' },
    ],
  },
  {
    label: 'Craft & memory',
    items: [
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
