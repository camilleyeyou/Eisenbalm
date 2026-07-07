/**
 * Dashboard index — redirects to Review Desk (Phase 30 D-04, supersedes
 * Phase 21 D-09). Review Desk is home even while it's a placeholder —
 * masthead + the Awaiting-you inbox carry the real signal until Phase 32.
 */
import { redirect } from 'next/navigation'

export default function DashboardIndexPage() {
  redirect('/review-desk')
}
