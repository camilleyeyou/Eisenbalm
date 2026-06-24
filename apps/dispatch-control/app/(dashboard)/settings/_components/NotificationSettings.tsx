'use client'
/**
 * Phase 27 (NTF-01/02) — Notification channel config (Settings subsection).
 *
 * Operator-facing surface for the `notify_*` pipeline_config keys read by the
 * Plan 03 notifier at dispatch time. Two INDEPENDENT channel blocks (Slack /
 * Email) — either, both, or neither may be configured (D-03). Each block has:
 *   - a shadcn <Switch> with a visible <label> (the channel name)
 *   - a conditional config input revealed via CSS `hidden`/`block` (no height
 *     animation — avoids layout shift, per the UI-SPEC interaction contract)
 *   - four per-event checkboxes (Run complete / Run failed / Awaiting review /
 *     Budget threshold) mapping to notify_on_complete / notify_on_failed /
 *     notify_on_awaiting_review / notify_on_budget
 *   - a full-width save button that writes ONLY that channel's keys via
 *     api.pipelineConfig.setNotificationConfig (Slack save never clobbers email
 *     keys and vice versa)
 *
 * Current config is seeded from api.pipelineConfig.getAll (JSON.parse each row,
 * mirroring BudgetAlertBanner's configMap pattern). When neither channel has a
 * value, the unconfigured copy is shown.
 *
 * Follows the APPROVED 27-UI-SPEC: heading `Notifications`, fixed copy, type
 * scale (text-base font-semibold heading), and accessibility invariants
 * (min-h-[44px] + focus-visible ring on all interactive elements).
 */
import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { Switch } from '@/components/ui/switch'

interface NotificationSettingsProps {
  workspace_id: string
}

// Per-event flags shared by both channels.
interface EventFlags {
  notify_on_complete: boolean
  notify_on_failed: boolean
  notify_on_awaiting_review: boolean
  notify_on_budget: boolean
}

const EVENT_FIELDS: { key: keyof EventFlags; label: string }[] = [
  { key: 'notify_on_complete', label: 'Run complete' },
  { key: 'notify_on_failed', label: 'Run failed' },
  { key: 'notify_on_awaiting_review', label: 'Awaiting review' },
  { key: 'notify_on_budget', label: 'Budget threshold' },
]

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1'

const SAVE_BUTTON_CLASS =
  'w-full min-h-[44px] min-w-[44px] rounded-md bg-neutral-900 text-white text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 disabled:opacity-50'

const CHECKBOX_CLASS =
  'h-4 w-4 rounded border-neutral-300 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1'

export default function NotificationSettings({
  workspace_id,
}: NotificationSettingsProps) {
  const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })
  const setNotificationConfig = useMutation(
    api.pipelineConfig.setNotificationConfig,
  )

  // ── Slack channel state ────────────────────────────────────────────────
  const [slackEnabled, setSlackEnabled] = useState(false)
  const [slackWebhook, setSlackWebhook] = useState('')
  const [slackEvents, setSlackEvents] = useState<EventFlags>({
    notify_on_complete: false,
    notify_on_failed: false,
    notify_on_awaiting_review: false,
    notify_on_budget: false,
  })
  const [slackSaving, setSlackSaving] = useState(false)

  // ── Email channel state ────────────────────────────────────────────────
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [emailEvents, setEmailEvents] = useState<EventFlags>({
    notify_on_complete: false,
    notify_on_failed: false,
    notify_on_awaiting_review: false,
    notify_on_budget: false,
  })
  const [emailSaving, setEmailSaving] = useState(false)

  // ── Seed state from current config once it loads ───────────────────────
  useEffect(() => {
    if (configRows === undefined) return

    const configMap: Record<string, unknown> = {}
    for (const row of configRows) {
      try {
        configMap[row.key] = JSON.parse(row.value)
      } catch {
        configMap[row.key] = row.value
      }
    }

    const webhook = String(configMap['notify_slack_webhook_url'] ?? '')
    const email = String(configMap['notify_email'] ?? '')
    const events: EventFlags = {
      notify_on_complete: Boolean(configMap['notify_on_complete']),
      notify_on_failed: Boolean(configMap['notify_on_failed']),
      notify_on_awaiting_review: Boolean(configMap['notify_on_awaiting_review']),
      notify_on_budget: Boolean(configMap['notify_on_budget']),
    }

    setSlackWebhook(webhook)
    setSlackEnabled(webhook.length > 0)
    setSlackEvents(events)

    setEmailAddress(email)
    setEmailEnabled(email.length > 0)
    setEmailEvents(events)
  }, [configRows])

  if (configRows === undefined) {
    return (
      <div className="text-sm text-neutral-500 py-4">
        Loading notification settings…
      </div>
    )
  }

  // Derive "unconfigured" from the persisted config (not the local toggles).
  const configMap: Record<string, unknown> = {}
  for (const row of configRows) {
    try {
      configMap[row.key] = JSON.parse(row.value)
    } catch {
      configMap[row.key] = row.value
    }
  }
  const hasSlack = String(configMap['notify_slack_webhook_url'] ?? '').length > 0
  const hasEmail = String(configMap['notify_email'] ?? '').length > 0
  const unconfigured = !hasSlack && !hasEmail

  async function handleSaveSlack() {
    setSlackSaving(true)
    try {
      await setNotificationConfig({
        workspace_id,
        notify_slack_webhook_url: slackEnabled ? slackWebhook : '',
        ...slackEvents,
      })
    } finally {
      setSlackSaving(false)
    }
  }

  async function handleSaveEmail() {
    setEmailSaving(true)
    try {
      await setNotificationConfig({
        workspace_id,
        notify_email: emailEnabled ? emailAddress : '',
        ...emailEvents,
      })
    } finally {
      setEmailSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-neutral-900">Notifications</h2>

      {unconfigured && (
        <p className="text-sm text-neutral-500">
          No notification channels configured. Add a Slack webhook or email
          address to receive run alerts.
        </p>
      )}

      {/* ── Slack channel ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Switch
            id="notify-slack-toggle"
            checked={slackEnabled}
            onCheckedChange={setSlackEnabled}
            className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          />
          <label
            htmlFor="notify-slack-toggle"
            className="text-sm font-medium text-neutral-900 cursor-pointer"
          >
            Slack
          </label>
        </div>

        <div className={slackEnabled ? 'block space-y-3' : 'hidden'}>
          <div className="space-y-1">
            <label
              htmlFor="notify-slack-webhook"
              className="text-xs text-neutral-500"
            >
              Webhook URL
            </label>
            <input
              id="notify-slack-webhook"
              type="url"
              value={slackWebhook}
              onChange={e => setSlackWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/…"
              className={INPUT_CLASS}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs text-neutral-500">
              Notify on these events
            </legend>
            {EVENT_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={slackEvents[key]}
                  onChange={e =>
                    setSlackEvents(prev => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className={CHECKBOX_CLASS}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            onClick={handleSaveSlack}
            disabled={slackSaving}
            className={SAVE_BUTTON_CLASS}
          >
            {slackSaving ? 'Saving…' : 'Save Slack settings'}
          </button>
        </div>
      </div>

      {/* ── Email channel ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Switch
            id="notify-email-toggle"
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
            className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
          />
          <label
            htmlFor="notify-email-toggle"
            className="text-sm font-medium text-neutral-900 cursor-pointer"
          >
            Email
          </label>
        </div>

        <div className={emailEnabled ? 'block space-y-3' : 'hidden'}>
          <div className="space-y-1">
            <label
              htmlFor="notify-email-address"
              className="text-xs text-neutral-500"
            >
              Recipient email
            </label>
            <input
              id="notify-email-address"
              type="email"
              value={emailAddress}
              onChange={e => setEmailAddress(e.target.value)}
              placeholder="operator@example.com"
              className={INPUT_CLASS}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs text-neutral-500">
              Notify on these events
            </legend>
            {EVENT_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={emailEvents[key]}
                  onChange={e =>
                    setEmailEvents(prev => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className={CHECKBOX_CLASS}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            onClick={handleSaveEmail}
            disabled={emailSaving}
            className={SAVE_BUTTON_CLASS}
          >
            {emailSaving ? 'Saving…' : 'Save email settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
