/**
 * Phase 27 — NTF-01/02: pure notification-dispatch decision helper.
 *
 * This is the import path the Wave 0 RED scaffold asserts against
 * (apps/web/__tests__/notifications-ledger.test.ts). It is intentionally pure
 * (no Convex, no I/O): given the event, the resolved pipeline_config map, and
 * the current notificationsLedger rows for this key, it decides — per channel —
 * whether to `send` or `skip`. The `sendNotification` internalAction consumes
 * this decision; the unit test pins its behavior.
 *
 * Rules (API_CONTRACTS §27.4–§27.5):
 *   - flag-off (D-06): notify_on_<eventType> false/absent → every channel skips.
 *   - per-channel (D-03): email enabled when `notify_email` set; slack enabled
 *     when `notify_slack_webhook_url` set. One decision per enabled channel.
 *   - idempotency (D-07): a ledger row already 'sent' or 'queued' for
 *     (runId, eventType, channel) → that channel skips (no-op).
 *   - budget (D-04): a `cost-warning` source event maps to eventType 'budget'.
 */

export type NotificationChannel = 'email' | 'slack'
export type DispatchAction = 'send' | 'skip'

export interface NotificationConfig {
  notify_email?: string
  notify_slack_webhook_url?: string
  notify_on_complete?: boolean
  notify_on_failed?: boolean
  notify_on_awaiting_review?: boolean
  notify_on_budget?: boolean
  [key: string]: unknown
}

export interface LedgerRow {
  runId: string
  eventType: string
  channel: string
  status: string
}

export interface DecideDispatchInput {
  runId: string
  /** Dispatch eventType: 'complete' | 'failed' | 'awaiting-review' | 'budget'. */
  eventType: string
  /** Source deliberationEvents eventType, e.g. 'cost-warning' (maps → 'budget'). */
  sourceEventType?: string
  config: NotificationConfig
  ledger: LedgerRow[]
}

export interface DispatchDecision {
  channel: NotificationChannel
  action: DispatchAction
  eventType: string
}

/** Map a source deliberationEvents eventType onto a dispatch eventType. */
function mapSourceEventType(eventType: string, sourceEventType?: string): string {
  if (sourceEventType === 'cost-warning') return 'budget'
  return eventType
}

/** pipeline_config per-event enable flag key for a dispatch eventType. */
function flagKey(eventType: string): string {
  // 'awaiting-review' → notify_on_awaiting_review (dash → underscore).
  return `notify_on_${eventType.replace(/-/g, '_')}`
}

const HANDLED_STATUSES = new Set(['sent', 'queued'])

export function decideDispatch(input: DecideDispatchInput): DispatchDecision[] {
  const { runId, config, ledger, sourceEventType } = input
  const eventType = mapSourceEventType(input.eventType, sourceEventType)

  // ── flag-off (D-06): emit per-channel skip decisions, no sends ────────────
  const enableFlag = config[flagKey(eventType)]
  const flagEnabled = enableFlag === true

  // Which channels are configured (D-03).
  const channels: NotificationChannel[] = []
  if (config.notify_email) channels.push('email')
  if (config.notify_slack_webhook_url) channels.push('slack')

  return channels.map((channel): DispatchDecision => {
    if (!flagEnabled) {
      return { channel, action: 'skip', eventType }
    }
    // ── idempotency (D-07): already sent/queued for this key → skip ─────────
    const already = ledger.some(
      row =>
        row.runId === runId &&
        row.eventType === eventType &&
        row.channel === channel &&
        HANDLED_STATUSES.has(row.status),
    )
    return { channel, action: already ? 'skip' : 'send', eventType }
  })
}
