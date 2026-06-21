/**
 * Single source of truth for the 7 nav items in the Dispatch Control shell.
 * Order is locked (D-07): Graph → Runs → Config → Prompts → Registry → Finance → Settings
 * Graph is the default home view (dashboard index redirects to /graph).
 */
import {
  Workflow,
  Activity,
  SlidersHorizontal,
  FileText,
  BookMarked,
  DollarSign,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Graph',    href: '/graph',    icon: Workflow },
  { label: 'Runs',     href: '/runs',     icon: Activity },
  { label: 'Config',   href: '/config',   icon: SlidersHorizontal },
  { label: 'Prompts',  href: '/prompts',  icon: FileText },
  { label: 'Registry', href: '/registry', icon: BookMarked },
  { label: 'Finance',  href: '/finance',  icon: DollarSign },
  { label: 'Settings', href: '/settings', icon: Settings },
]
