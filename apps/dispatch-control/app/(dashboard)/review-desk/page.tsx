/**
 * Phase 40 (ISS-02, D-07, D-31, Plan 40-06 Task 3) — `/review-desk` leaves
 * the nav and folds into the issue-keyed console (D-09): the Issues home
 * (`/issues`) now resolves the current in-progress issue and links straight
 * into `/issues/[n]/review`. This shell no longer needs its own
 * awaiting-review lookup — it just redirects to `/issues`.
 */
import { redirect } from 'next/navigation'

export default function ReviewDeskShellRedirect() {
  redirect('/issues')
}
