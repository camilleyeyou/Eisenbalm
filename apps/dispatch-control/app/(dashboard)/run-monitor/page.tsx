/**
 * Run Monitor — tab shell (Phase 30 D-05).
 *
 * Hosts the existing Runs list and Graph visualizer as two tabs under one
 * nav slot. Bare `/run-monitor` redirects to `/run-monitor/runs` (the
 * default view). Phase 37 replaces the interior with the forensic spine.
 */
import { redirect } from 'next/navigation'

export default function RunMonitorPage() {
  redirect('/run-monitor/runs')
}
