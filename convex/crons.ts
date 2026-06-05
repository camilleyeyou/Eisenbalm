/**
 * Phase 20 — Convex cron jobs.
 *
 * email-retry-sweep: runs hourly at :30 to recover stale 'scheduled' emailSends rows.
 * Convex scheduled actions are at-most-once; this sweep is the safety net for
 * steps that were scheduled but did not fire (e.g., runtime error, cold start).
 * sweepStaleSends only re-enqueues rows that are >1h past their expected fire time
 * so E1 (offset=0) is not noisily re-fired every hour.
 */
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.hourly(
  'email-retry-sweep',
  { minuteUTC: 30 },
  internal.emailActions.sweepStaleSends,
  {},
)

export default crons
