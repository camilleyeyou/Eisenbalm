/**
 * Phase 27 — NTF-01 (D-02): Slack incoming-webhook provider.
 *
 * Implements the Phase 20 `SendEmailProvider` seam so Slack reuses the same
 * single send path as Resend — no second send abstraction is forked. Uses the
 * native global `fetch` (no new npm package).
 *
 * The provider maps a `SendEmailParams` onto a Slack message by collapsing
 * subject + plaintext-stripped html into a single `text` field — Slack's
 * incoming-webhook payload only needs `{ text }`.
 *
 * Selection happens via `selectSlackProvider(webhookUrl)`, called by the
 * `sendNotification` internalAction once it has resolved the webhook URL from
 * pipeline_config. See API_CONTRACTS §27.6.
 */
import type { SendEmailParams, SendEmailProvider } from './provider'

/** Strip HTML tags to plaintext for the Slack message body. No new dep. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class SlackWebhookProvider implements SendEmailProvider {
  constructor(private webhookUrl: string) {}

  async send(params: SendEmailParams): Promise<{ id: string }> {
    const text = params.subject + '\n' + stripHtml(params.html)
    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error(`slack webhook failed: ${res.status}`)
    return { id: `slack-${Date.now()}` }
  }
}

/** Return a Slack provider bound to the given incoming-webhook URL. */
export function selectSlackProvider(webhookUrl: string): SendEmailProvider {
  return new SlackWebhookProvider(webhookUrl)
}
