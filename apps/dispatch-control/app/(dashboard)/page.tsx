/**
 * Dashboard index — redirects to the Desk (quick 260730-i4j; supersedes
 * Phase 40 ISS-02 D-06/D-09's Issues-home-as-front-door decision, which
 * itself superseded Phase 30 D-04/Phase 21 D-09). The Desk is a work-first
 * landing: one run band plus every open task, grouped by severity, each row
 * deep-linking to the exact stage. `/issues` survives unchanged as the full
 * archive — still reachable from the nav, one slot down.
 */
import { redirect } from 'next/navigation'

export default function DashboardIndexPage() {
  redirect('/desk')
}
