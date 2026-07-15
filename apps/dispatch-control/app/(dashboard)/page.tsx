/**
 * Dashboard index — redirects to Issues home (Phase 40 ISS-02, D-06, D-09;
 * supersedes Phase 30 D-04/Phase 21 D-09). The console is issue-keyed now:
 * Issues home is the new front door, replacing the Review Desk auto-focus
 * shell.
 */
import { redirect } from 'next/navigation'

export default function DashboardIndexPage() {
  redirect('/issues')
}
