'use client'

/**
 * DeliberationSlot — Phase 19 dark-band centerpiece rewrite.
 * UI-SPEC §10 Deliberation Centerpiece (dark band, scoreboard + chat + confidence).
 *
 * Renders entirely from Sanity-sourced props (conversation + candidates,
 * threaded through IssueLayout.tsx from the issue's selectionDeliberation
 * field). Phase 29 (D-8) removed the 5 dead per-run Convex subscription
 * reads (pipelineRuns / pitchLog / deliberationEvents / agentVotes /
 * qaCorrections, each keyed by run ID) that were wired here — they opened
 * 5 subscriptions per visitor on the highest-traffic page and every result
 * was discarded (`void run; void pitchLog; ...`). The rendered deliberation
 * has always come from Sanity via IssueLayout.tsx, never from these subs.
 *
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
