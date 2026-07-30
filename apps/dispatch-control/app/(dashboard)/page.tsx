/**
 * Dashboard index — redirects to The Run (quick 260730-ldn; supersedes the
 * quick 260730-i4j `/desk` redirect). The Run resolves the current issue
 * ONLY through `useCurrentRun()` (`lib/currentRun.ts`'s `resolveCurrentRun`)
 * and lands the operator on the nine sections the agents actually produced —
 * real headlines they can click straight into editing — never an invented
 * issue. `/issues` survives as the title-led Archive — still reachable from
 * the nav, one slot down.
 */
import { redirect } from 'next/navigation'

export default function DashboardIndexPage() {
  redirect('/run')
}
