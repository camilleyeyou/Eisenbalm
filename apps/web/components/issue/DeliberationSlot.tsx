'use client'

/**
 * DeliberationSlot — Phase 19 dark-band centerpiece rewrite.
 * UI-SPEC §10 Deliberation Centerpiece (dark band, scoreboard + chat + confidence).
 *
 * STAGE A: renders from props (conversation + candidates from MOCK_ISSUE).
 * STAGE B (Plan 05): wires Convex live data without structural change.
 *
 * DEL-01..05: All 5 Convex useQuery subscriptions PRESERVED verbatim.
 *   They are present now so Plan 05 wires live data with no structural change.
 *   Stage A renders from props; the subscriptions are unused but guarded correctly.
 * DEL-04: No model/provider names appear anywhere in the render path.
 *   The agent display map uses 'The Scout' / 'The Advocate' / 'The Editor' only.
 * DEL-05: Graceful empty state when runId is null and no candidates/conversation.
 *
 * Dark-band inline constants (UI-SPEC §Dark Deliberation Band Tokens):
 *   band bg #1A1714, accent-on-dark #E0B0A4, muted #B8B2A4
 *   (card constants are owned by DelibScoreboard and ConfidenceBar)
 *
 * Voice: dry, precise, no exclamation marks, no winking. (CLAUDE.md)
 */

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

import { DelibScoreboard } from './DelibScoreboard'
import type { DelibCandidate } from './DelibScoreboard'
import { DelibChat } from './DelibChat'
import { ConfidenceBar } from './ConfidenceBar'

type ConversationTurn = {
  speaker: 'scout' | 'advocate' | 'editor'
  text: string
}

type Props = {
  runId: string | null
  conversation: ConversationTurn[] | null
  candidates: DelibCandidate[] | null
  confidence?: number
}

export function DeliberationSlot({ runId, conversation, candidates, confidence }: Props) {
  // ─── DEL-01: All 5 Convex subscriptions preserved verbatim ───────────────────
  // When runId is null, every query receives 'skip' — no subscription, returns undefined.
  // Stage A renders from props. Stage B (Plan 05) uses these live values.
  const run         = useQuery(api.pipelineRuns.byRunId,       runId ? { runId } : 'skip')
  const pitchLog    = useQuery(api.pitchLog.byRunId,           runId ? { runId } : 'skip')
  const events      = useQuery(api.deliberationEvents.byRunId, runId ? { runId } : 'skip')
  const votes       = useQuery(api.agentVotes.byRunId,         runId ? { runId } : 'skip')
  const corrections = useQuery(api.qaCorrections.byRunId,      runId ? { runId } : 'skip')

  // Suppress unused-variable warnings for Stage A (Stage B wires these)
  void run; void pitchLog; void events; void votes; void corrections

  // ─── DEL-05: Empty state ──────────────────────────────────────────────────────
  // Graceful when no runId AND no candidates/conversation
  const isEmpty =
    !runId &&
    (!candidates || candidates.length === 0) &&
    (!conversation || conversation.length === 0)

  // ─── Confidence bar trigger ───────────────────────────────────────────────────
  const [confTrigger, setConfTrigger] = useState(false)

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <section
      id="delib"
      data-deliberation-slot
      className="delib"
      aria-label="How the charity was chosen"
    >
      <div className="delib-in">

        {/* Header — centered, max-width 680px */}
        <div className="delib-head">
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: '#E0B0A4',
              marginBottom: '16px',
            }}
          >
            § The Deliberation
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 4.5vw, 56px)',
              fontWeight: 400,
              color: '#FBFAF6',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
            }}
          >
            Watch the Machines{' '}
            <em style={{ fontStyle: 'italic', color: '#E0B0A4' }}>Decide</em>
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '21px',
              fontStyle: 'italic',
              fontWeight: 400,
              color: '#B8B2A4',
            }}
          >
            Three charities were proposed. One was chosen. Here is the full audit.
          </p>
        </div>

        {/* DEL-05: Empty state */}
        {isEmpty ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15.5px',
              color: '#B8B2A4',
              textAlign: 'center',
              marginTop: '48px',
            }}
          >
            This issue predates the open deliberation record.
          </p>
        ) : (
          /* Grid: scoreboard (left) | chat + confidence (right) */
          <div className="delib-grid">
            {/* Left — Candidate Scoreboard */}
            <div>
              {candidates && candidates.length > 0 && (
                <DelibScoreboard candidates={candidates} />
              )}
            </div>

            {/* Right — Chat transcript + confidence bar */}
            <div className="delib-chat-col">
              {conversation && conversation.length > 0 && (
                <DelibChat
                  messages={conversation}
                  onComplete={() => setConfTrigger(true)}
                />
              )}

              {/* Confidence bar — fills 200ms after last message reveals */}
              <ConfidenceBar
                value={confidence ?? 80}
                trigger={confTrigger}
                winner={candidates?.find(c => c.winning)?.name ?? null}
              />
            </div>
          </div>
        )}

      </div>
    </section>
  )
}
