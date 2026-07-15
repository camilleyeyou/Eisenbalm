/**
 * Phase 40 (ISS-02, D-07, D-31, Plan 40-06 Task 3) — `/voice-pass` leaves
 * the nav and folds into the issue-keyed console (D-09), mirroring
 * review-desk/page.tsx exactly: redirects to `/issues`, which links into
 * `/issues/[n]/voice` for the in-progress issue.
 */
import { redirect } from 'next/navigation'

export default function VoicePassShellRedirect() {
  redirect('/issues')
}
