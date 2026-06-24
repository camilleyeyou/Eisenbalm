"use node"
/**
 * Phase 27 — NTF-01/02: operational notification dispatch action.
 *
 * MUST run in the Node.js runtime ("use node") — only internalAction can make
 * external HTTP calls (Resend, Slack incoming webhook). Actions CANNOT use
 * ctx.db; all DB access goes via ctx.runQuery / ctx.runMutation.
 *
 * Dispatched non-blocking (scheduler.runAfter(0, …)) from two seams (§27.5):
 *   - pipelineRuns:updateStatus → eventType 'complete' | 'failed' | 'awaiting-review'
 *   - deliberationEvents:insert (cost-warning) → eventType 'budget'
 *
 * Flow per event:
 *   1. Read pipeline_config (getAll) → build configMap (JSON.parse each value).
 *   2. Per-event flag gate (notify_on_<eventType>); flag-off → return, no send.
 *   3. For each configured channel (email if notify_email, slack if
 *      notify_slack_webhook_url): insertScheduled (atomic gate) → if the row was
 *      already 'sent', skip → else send via selectProvider / selectSlackProvider
 *      → markSent / markFailed.
 *
 * Never throws out of the action — a transport failure marks the ledger 'failed'
 * and is swallowed (D-05) so the triggering mutation never wedges.
 */
import { internalAction } from './_generated/server'
import { internal, api } from './_generated/api'
import { v } from 'convex/values'
import { selectProvider, selectSlackProvider } from '@eisenbalm/emails'

// Single-workspace project; the only allowed control-plane occurrence.
const DEFAULT_WORKSPACE_ID = 'eisenbalm'

/** pipeline_config per-event enable flag key for a dispatch eventType. */
function flagKey(eventType: string): string {
  // 'awaiting-review' → notify_on_awaiting_review (dash → underscore).
  return `notify_on_${eventType.replace(/-/g, '_')}`
}

/** Build a plain config map from pipeline_config rows (JSON.parse each value). */
function buildConfigMap(
  rows: Array<{ key: string; value: string }>,
): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      map[row.key] = JSON.parse(row.value)
    } catch {
      map[row.key] = row.value
    }
  }
  return map
}

export const sendNotification = internalAction({
  args: {
    runId: v.string(),
    // 'complete' | 'failed' | 'awaiting-review' | 'budget'
    eventType: v.string(),
  },
  handler: async (ctx, { runId, eventType }) => {
    const workspace_id = DEFAULT_WORKSPACE_ID

    // 1. Read config and build the config map.
    const rows = await ctx.runQuery(api.pipelineConfig.getAll, { workspace_id })
    const config = buildConfigMap(
      rows.map(r => ({ key: r.key, value: r.value })),
    )

    // 2. Per-event flag gate (D-06). Flag-off / absent → no send.
    if (config[flagKey(eventType)] !== true) return

    // Which channels are configured (D-03).
    const channels: Array<'email' | 'slack'> = []
    if (typeof config.notify_email === 'string' && config.notify_email) {
      channels.push('email')
    }
    if (
      typeof config.notify_slack_webhook_url === 'string' &&
      config.notify_slack_webhook_url
    ) {
      channels.push('slack')
    }

    const subject = `Eisenbalm run ${runId}: ${eventType}`
    const html = `<p>Pipeline run <strong>${runId}</strong> reached <strong>${eventType}</strong>.</p>`

    for (const channel of channels) {
      // 3a. Atomic idempotency gate — insert 'queued' only if absent.
      await ctx.runMutation(internal.notifications.insertScheduled, {
        workspace_id,
        runId,
        eventType,
        channel,
      })
      const row = await ctx.runQuery(internal.notifications.getByKey, {
        runId,
        eventType,
        channel,
      })
      // Already delivered for this key — skip (D-07).
      if (row?.status === 'sent') continue

      // 3b. Build provider + recipient per channel.
      try {
        let providerId: string
        if (channel === 'email') {
          const provider = selectProvider(process.env)
          const from = process.env.NOTIFY_FROM ?? 'alerts@dispatch.eisenbalm.com'
          const res = await provider.send({
            from,
            to: config.notify_email as string,
            subject,
            html,
          })
          providerId = res.id
        } else {
          const provider = selectSlackProvider(
            config.notify_slack_webhook_url as string,
          )
          const res = await provider.send({
            from: 'eisenbalm',
            to: 'slack',
            subject,
            html,
          })
          providerId = res.id
        }
        await ctx.runMutation(internal.notifications.markSent, {
          runId,
          eventType,
          channel,
          providerId,
        })
      } catch (err) {
        // Never throw out of the action (D-05) — record + continue.
        await ctx.runMutation(internal.notifications.markFailed, {
          runId,
          eventType,
          channel,
          errorMessage: String(err),
        })
      }
    }
  },
})
