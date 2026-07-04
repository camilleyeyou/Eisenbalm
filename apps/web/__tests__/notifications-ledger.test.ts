/**
 * Phase 27 — Money + Notifications: Wave 0 RED scaffold (NTF-01/02).
 *
 * Covers the notification-dispatch decision helper specified in
 * docs/API_CONTRACTS.md §27.4–§27.5:
 *   - idempotency: a second dispatch decision for an existing 'sent' ledger
 *     row (same runId|eventKey + eventType + channel) is a no-op (skip) (D-07).
 *   - config-flag-off: when the per-event enable flag is false, the decision
 *     is skip (D-06).
 *   - per-channel dispatch: with both email + slack configured and enabled,
 *     one decision is yielded per channel (D-03).
 *   - budget trigger: a `cost-warning` deliberationEvent maps to eventType
 *     'budget' for dispatch (D-04 — reuse the frozen cost-warning literal).
 *
 * RED-by-design: `decideDispatch` does NOT exist yet. This import path IS the
 * contract the Wave 2 notifications plan implements
 * (`apps/web/lib/notifications/dispatch.ts`). Until then this file is RED —
 * correct Wave 0 behavior. If it fails, implement the helper; do NOT weaken it.
 *
 * Requirements covered: NTF-01, NTF-02.
 */
import { describe, it, expect } from 'vitest'

import { decideDispatch } from '@/lib/notifications/dispatch'

// Baseline config: both channels configured + all events enabled.
const CONFIG_BOTH_ENABLED = {
  notify_email: 'ops@example.com',
  notify_slack_webhook_url: 'https://hooks.slack.com/services/T/B/X',
  notify_on_complete: true,
  notify_on_failed: true,
  notify_on_awaiting_review: true,
  notify_on_budget: true,
}

// ─── NTF-01: idempotency (ledger-aware no-op) ───────────────────────────────

describe('NTF-01: dispatch idempotency', () => {
  it('a second dispatch for an already-sent (runId, eventType, channel) is a skip', () => {
    const ledger = [
      { runId: 'run_1', eventType: 'complete', channel: 'email', status: 'sent' },
    ]
    const decisions = decideDispatch({
      runId: 'run_1',
      eventType: 'complete',
      config: CONFIG_BOTH_ENABLED,
      ledger,
    })
    const email = decisions.find((d: { channel: string }) => d.channel === 'email')
    expect(email?.action).toBe('skip')
  })

  it('a fresh (runId, eventType, channel) with no ledger row dispatches (send)', () => {
    const decisions = decideDispatch({
      runId: 'run_1',
      eventType: 'complete',
      config: CONFIG_BOTH_ENABLED,
      ledger: [],
    })
    const email = decisions.find((d: { channel: string }) => d.channel === 'email')
    expect(email?.action).toBe('send')
  })
})

// ─── NTF-01: config-flag-off skip ───────────────────────────────────────────

describe('NTF-01: config-flag-off skip', () => {
  it('skips a complete event when notify_on_complete is false', () => {
    const config = { ...CONFIG_BOTH_ENABLED, notify_on_complete: false }
    const decisions = decideDispatch({
      runId: 'run_2',
      eventType: 'complete',
      config,
      ledger: [],
    })
    expect(decisions.every((d: { action: string }) => d.action === 'skip')).toBe(true)
  })
})

// ─── NTF-01: per-channel dispatch selection ─────────────────────────────────

describe('NTF-01: per-channel dispatch', () => {
  it('yields one decision per configured + enabled channel (email + slack)', () => {
    const decisions = decideDispatch({
      runId: 'run_3',
      eventType: 'failed',
      config: CONFIG_BOTH_ENABLED,
      ledger: [],
    })
    const channels = decisions
      .filter((d: { action: string }) => d.action === 'send')
      .map((d: { channel: string }) => d.channel)
      .sort()
    expect(channels).toEqual(['email', 'slack'])
  })

  it('yields only the email channel when slack webhook is unset', () => {
    const config = { ...CONFIG_BOTH_ENABLED, notify_slack_webhook_url: '' }
    const decisions = decideDispatch({
      runId: 'run_4',
      eventType: 'failed',
      config,
      ledger: [],
    })
    const sendChannels = decisions
      .filter((d: { action: string }) => d.action === 'send')
      .map((d: { channel: string }) => d.channel)
    expect(sendChannels).toEqual(['email'])
  })
})

// ─── NTF-02: budget trigger maps cost-warning → 'budget' ────────────────────

describe('NTF-02: budget trigger from cost-warning', () => {
  it("a cost-warning deliberationEvent maps to eventType 'budget' for dispatch", () => {
    const decisions = decideDispatch({
      runId: 'run_5',
      eventType: 'budget', // produced by mapping deliberationEvents 'cost-warning' → 'budget'
      sourceEventType: 'cost-warning',
      config: CONFIG_BOTH_ENABLED,
      ledger: [],
    })
    const sent = decisions.filter((d: { action: string }) => d.action === 'send')
    expect(sent.length).toBeGreaterThanOrEqual(1)
    expect(sent.every((d: { eventType: string }) => d.eventType === 'budget')).toBe(true)
  })

  it('skips budget dispatch when notify_on_budget is false', () => {
    const config = { ...CONFIG_BOTH_ENABLED, notify_on_budget: false }
    const decisions = decideDispatch({
      runId: 'run_6',
      eventType: 'budget',
      sourceEventType: 'cost-warning',
      config,
      ledger: [],
    })
    expect(decisions.every((d: { action: string }) => d.action === 'skip')).toBe(true)
  })
})
