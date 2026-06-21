/**
 * Dashboard index — redirects to Graph (D-09).
 * Graph is the default home view per the pipeline-graph framing.
 */
import { redirect } from 'next/navigation'

export default function DashboardIndexPage() {
  redirect('/graph')
}
