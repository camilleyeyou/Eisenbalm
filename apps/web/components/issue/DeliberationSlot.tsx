'use client'

/**
 * Deliberation slot. UI-SPEC §Deliberation Contract.
 * Anchor ID: #deliberation.
 *
 * Phase 9: Live Convex deliberation layer.
 *   - 5 Convex subscriptions, all guarded with the "skip" sentinel when
 *     runId is null (DEL-01).
 *   - Collapsed by default via <details>/<summary> (DEL-03).
 *   - Advocate scores from deliberationEvents advocate-argument payloads,
 *     never from agentVotes (DEL-02).
 *   - QA severity colors + text labels (WCAG 1.4.1) (DEL-02).
 *   - Graceful empty state when no Convex data (DEL-05).
 *   - SECURITY: pipelineRuns.cost (model-version map) is never accessed
 *     in this component (DEL-04).
 *
 * Phase 12 (MED-05): Rebuilt to Carousel & Flow three-zone vertical stack.
 *   - Zone 1: Horizontal scroll-snap pitch-log carousel (restyled card interiors,
 *     winner luminous gold glow).
 *   - Zone 2: Scout→Advocate→Editor flow-line diagram + tape-reel confidence meter.
 *   - Zone 3: QA findings (logic unchanged).
 *   - All 5 Convex subscriptions, AGENT_LABELS, DEL-04, and confidence-meter
 *     IntersectionObserver + rAF count-up preserved byte-compatible.
 *
 * Voice: dry, precise, no exclamation marks, no winking. (CLAUDE.md)
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'
import type { IssueDeliberationTurn } from '@/lib/sanity/types'

// SECURITY: never read run.cost (it contains the model-version map).
// pipelineRuns.cost is a JSON string — never read.
// Only run.status is accessed below (for the live indicator).

// ─── Agent identity map (house persona names — DEL-04) ──────────────────────
// Maps agentId → { displayName, role }. Never exposes underlying model names.
// Used for chip labels and /agents/[agentId] links.
const AGENT_LABELS: Record<string, { displayName: string; role: string }> = {
  calibrator: { displayName: 'The Calibrator', role: 'Style Director' },
  scout: { displayName: 'The Scout', role: 'Charity Researcher' },
  advocate: { displayName: 'The Advocate', role: 'Charity Champion' },
  editor: { displayName: 'The Editor', role: 'Editorial Director' },
  researcher: { displayName: 'The Researcher', role: 'Deep Researcher' },
  'origin-story': { displayName: 'The Narrator', role: 'Origin Story Writer' },
  'problem-statement': { displayName: 'The Analyst', role: 'Problem Writer' },
  'founder-bio': { displayName: 'The Profiler', role: 'Founder Bio Writer' },
  'case-study': { displayName: 'The Documentarian', role: 'Case Study Writer' },
  game: { displayName: 'The Game Master', role: 'Game Designer' },
  bonus: { displayName: 'The Bonus Writer', role: 'Bonus Section Writer' },
  design: { displayName: 'The Designer', role: 'Visual Design Agent' },
  qa: { displayName: 'The Auditor', role: 'Quality Assurance' },
  publisher: { displayName: 'The Publisher', role: 'Publishing Agent' },
  'game-validator': { displayName: 'The Validator', role: 'Game Security Validator' },
}

function getAgentLabel(agentId: string): { displayName: string; role: string } {
  if (AGENT_LABELS[agentId]) return AGENT_LABELS[agentId]
  // Fallback: Title-case the agentId
  const displayName = agentId
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { displayName, role: 'Agent' }
}

// ─── QA severity → color + label (DEL-02 — WCAG 1.4.1: color + text) ────────
// Exactly three severities from convex/schema.ts qaCorrections.severity union.
const QA_SEVERITY: Record<'info' | 'warning' | 'error', { color: string; label: string }> = {
  info:    { color: 'var(--color-text-dim)', label: 'Info' },
  warning: { color: 'var(--color-primary)',  label: 'Warning' },
  error:   { color: 'var(--color-accent)',   label: 'Error' },
}

// ─── Agent identity chip color ─────────────────────────────────────────────
function agentChipStyle(agentId: string): { color: string; backgroundColor: string } {
  if (agentId === 'scout') {
    return {
      color: 'var(--color-scout)',
      backgroundColor: 'color-mix(in srgb, var(--color-scout) 14%, transparent)',
    }
  }
  if (agentId === 'advocate') {
    return {
      color: 'var(--color-advocate)',
      backgroundColor: 'color-mix(in srgb, var(--color-advocate) 14%, transparent)',
    }
  }
  if (agentId === 'editor') {
    return {
      color: 'var(--color-primary)',
      backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
    }
  }
  return {
    color: 'var(--color-text-dim)',
    backgroundColor: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
  }
}

// ─── Reduced motion check ────────────────────────────────────────────────────
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = { runId: string | null; conversation: IssueDeliberationTurn[] | null }

export function DeliberationSlot({ runId, conversation }: Props) {
  // DEL-01: All five Convex subscriptions with the "skip" sentinel.
  // When runId is null, every query gets 'skip' — no subscription, returns undefined.
  const run         = useQuery(api.pipelineRuns.byRunId,       runId ? { runId } : 'skip')
  const pitchLog    = useQuery(api.pitchLog.byRunId,           runId ? { runId } : 'skip')
  const events      = useQuery(api.deliberationEvents.byRunId, runId ? { runId } : 'skip')
  const votes       = useQuery(api.agentVotes.byRunId,         runId ? { runId } : 'skip')
  const corrections = useQuery(api.qaCorrections.byRunId,      runId ? { runId } : 'skip')

  // Loading: any query still in-flight (undefined = loading in Convex)
  const isLoading =
    runId != null &&
    [run, pitchLog, events, votes, corrections].some(q => q === undefined)

  // Empty: no runId OR all queries returned nothing
  const isEmpty =
    !runId ||
    (
      (pitchLog?.length ?? 0) === 0 &&
      (events?.length ?? 0) === 0 &&
      (votes?.length ?? 0) === 0 &&
      (corrections?.length ?? 0) === 0 &&
      !run
    )

  // DEL-02: Advocate scores from deliberationEvents advocate-argument payloads.
  // agentVotes has NO score field — scores live in the event payload JSON.
  const advocateScores = new Map<string, number | null>()
  events?.filter(e => e.eventType === 'advocate-argument').forEach(e => {
    try {
      const p = JSON.parse(e.payload) as { charityName?: string; score?: number | null }
      if (p.charityName != null) {
        advocateScores.set(
          p.charityName,
          typeof p.score === 'number' ? p.score : null,
        )
      }
    } catch {
      // Malformed payload — skip silently
    }
  })

  // DEL-02: Editor decision + confidence (graceful — field may not exist)
  const editorEvent = events?.find(e => e.eventType === 'editor-decision')
  let editorWinner: string | null = null
  let editorRationale: string | null = null
  let editorConfidence: number | null = null
  if (editorEvent) {
    try {
      const p = JSON.parse(editorEvent.payload) as Record<string, unknown>
      editorWinner = typeof p.winner === 'string' ? p.winner : null
      editorRationale = typeof p.rationale === 'string' ? p.rationale : null
      const c = (p.editor_confidence ?? p.confidence)
      editorConfidence =
        typeof c === 'number' && c >= 0 && c <= 1 ? c : null
    } catch {
      // Malformed payload — skip
    }
  }

  // Timeline event → one-liner copy
  function eventOneLiner(eventType: string, payload: string): string {
    try {
      const p = JSON.parse(payload) as Record<string, unknown>
      switch (eventType) {
        case 'scout-finding':
          return `${String(p.charityName ?? 'Candidate')} — surfaced`
        case 'advocate-argument':
          return `${String(p.charityName ?? 'Candidate')}: scored`
        case 'editor-decision':
          return `Selected ${String(p.winner ?? 'candidate')}`
        case 'section-draft':
          return `${String(p.sectionName ?? 'Section')} drafted`
        case 'qa-correction':
          return `QA note: ${String(p.reason ?? 'finding recorded')}`
        case 'editor-final':
          return 'Editor approved final content'
        case 'publisher-deploy':
          return 'Issue published'
        case 'cost-warning':
          return 'Pipeline cost threshold reached'
        case 'agent-tool-limit-exceeded':
          return `Agent tool limit exceeded`
        default:
          return 'Event recorded'
      }
    } catch {
      return 'Event recorded'
    }
  }

  // Live indicator
  const isLive = run?.status === 'running'

  // MOT-03: Confidence meter count-up via IntersectionObserver + rAF.
  // prefersReducedMotion is module-scope (non-reactive) — intentionally omitted from deps.
  const confidenceSectionRef = useRef<HTMLDivElement>(null)
  const [displayValue, setDisplayValue] = useState(0)
  const animatedRef = useRef(false)

  useEffect(() => {
    if (editorConfidence === null) return
    const target = Math.round(editorConfidence * 100)

    if (prefersReducedMotion) {
      setDisplayValue(target)   // Pitfall 4: final value instantly, never 0
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !animatedRef.current) {
          animatedRef.current = true
          observer.disconnect()   // Pitfall 3: disconnect after first fire
          const duration = 1200
          const start = performance.now()
          function tick(now: number) {
            const t = Math.min((now - start) / duration, 1)
            setDisplayValue(Math.round(t * target))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.4 },
    )
    const el = confidenceSectionRef.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [editorConfidence])
  // prefersReducedMotion is module-scope (non-reactive) — intentionally omitted from deps

  return (
    <section
      id="deliberation"
      className="deliberation-slot mx-auto w-full max-w-[1340px] px-4 sm:px-6 lg:px-8 print:hidden"
    >
      {/* Top divider */}
      <div
        className="mb-8 h-px"
        style={{ backgroundColor: 'var(--color-line-strong)' }}
        aria-hidden="true"
      />

      {/* ── Chat-thread conversation render (Phase 13 DEL-CONV-04) ─────────
          Visible by default. Only rendered when conversation data present.
          Placement: BEFORE the <details> machine view.
          turn.text is always rendered as a plain string — never via
          dangerouslySetInnerHTML or a Markdown parser (D-12).
          reuses getAgentLabel + agentChipStyle helpers already in scope.   */}
      {conversation && conversation.length > 0 && (
        <div className="del-conversation mb-8">
          <p
            className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] mb-6"
            style={{ color: 'var(--color-text-dim)' }}
          >
            The Deliberation
          </p>
          <div role="log" aria-label="Deliberation conversation">
            {conversation.map((turn, i) => {
              const label = getAgentLabel(turn.speaker)
              const chip = agentChipStyle(turn.speaker)
              return (
                <div className="del-conversation-turn" key={i}>
                  <a
                    href={`/agents/${turn.speaker}`}
                    className="del-conversation-chip"
                    style={{ color: chip.color, backgroundColor: chip.backgroundColor }}
                    aria-label={label.displayName}
                  >
                    {label.displayName.replace(/^The\s+/, '').charAt(0)}
                  </a>
                  <div className="del-conversation-body">
                    <p
                      className="font-ui text-[11px] font-semibold leading-[1.5] mb-1"
                      style={{ color: chip.color }}
                    >
                      {label.displayName} — {label.role}
                    </p>
                    <p
                      className="font-body text-[15px] leading-[1.65]"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      {turn.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapsed accordion — DEL-03 */}
      <details className="deliberation-slot group">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 select-none py-2 min-h-11"
          style={{ minHeight: '44px' }}
        >
          <span
            className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.1em]"
            style={{ color: 'var(--color-text)' }}
          >
            How this issue was made
          </span>
          <AnchorCopyButton sectionId="deliberation" />
          {/* Chevron rotates on open; transition neutralized by reduced-motion guard in globals.css */}
          <span
            className="ml-auto font-ui text-[11px] transition-transform group-open:rotate-180"
            style={{ color: 'var(--color-text-dim)' }}
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        {/* Expanded body */}
        <div className="mt-6 pb-8">
          {isLoading ? (
            // Loading state (DEL-05)
            <p
              className="font-body text-[15px] leading-[1.65]"
              style={{ color: 'var(--color-text-dim)' }}
            >
              Loading the deliberation.
            </p>
          ) : isEmpty ? (
            // Empty state (DEL-05) — predates Convex integration or no data
            <p
              className="font-body text-[15px] leading-[1.65]"
              style={{ color: 'var(--color-text-dim)' }}
            >
              This issue predates the open deliberation record.
            </p>
          ) : (
            <>
              {/* ── Three-zone vertical stack (MED-05 Carousel & Flow) ─────── */}

              {/* ─────────────────────────────────────────────────────────────
                  ZONE 1 — Horizontal Pitch Log Carousel
                  ───────────────────────────────────────────────────────────── */}
              <div className="mb-12">
                <h3
                  className="mb-4 font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em]"
                  style={{ color: 'var(--color-text-dim)' }}
                >
                  The Scout&apos;s Candidates — Pitch Log
                  {isLive && (
                    <span
                      className="ml-2 font-ui text-[11px]"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      ● live
                    </span>
                  )}
                </h3>

                {pitchLog && pitchLog.length > 0 ? (
                  <>
                    <div className="pitch-card-list" role="list">
                      {pitchLog.map(card => {
                        const score = advocateScores.get(card.charityName)
                        const hasScore = advocateScores.has(card.charityName)
                        const scoreValue = hasScore ? score : undefined
                        return (
                          <div
                            key={card._id}
                            role="listitem"
                            tabIndex={0}
                            style={{
                              borderRadius: '4px',
                              backgroundColor: 'var(--color-card)',
                              padding: '24px',
                              borderLeft: card.selected
                                ? '3px solid var(--color-primary)'
                                : '3px solid transparent',
                              boxShadow: card.selected
                                ? '0 0 32px color-mix(in srgb, var(--color-primary) 28%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent)'
                                : 'none',
                              minWidth: 0,
                            }}
                          >
                            {/* Charity name + badge row */}
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className="font-display text-[15px] font-semibold leading-[1.1]"
                                style={{ color: 'var(--color-text)' }}
                              >
                                {card.charityName}
                              </span>
                              {card.selected ? (
                                <span
                                  className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.08em] px-2 py-0.5 rounded-sm"
                                  style={{
                                    color: 'var(--color-primary)',
                                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                                  }}
                                >
                                  ★ Selected this week
                                </span>
                              ) : (
                                <span
                                  className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.08em] px-2 py-0.5 rounded-sm"
                                  style={{
                                    color: 'var(--color-text-dim)',
                                    backgroundColor: 'color-mix(in srgb, var(--color-text) 8%, transparent)',
                                  }}
                                >
                                  Runner-up
                                </span>
                              )}
                            </div>

                            {/* Location */}
                            <p
                              className="mb-1 font-ui text-[11px] leading-[1.5]"
                              style={{ color: 'var(--color-text-dim)' }}
                            >
                              {card.charityLocation}
                            </p>

                            {/* Scout summary */}
                            <p
                              className="mb-3 font-body text-[15px] italic leading-[1.55]"
                              style={{ color: 'var(--color-text-dim)' }}
                            >
                              {card.scoutSummary}
                            </p>

                            {/* DEL-02: Advocate score bar */}
                            {hasScore && typeof scoreValue === 'number' ? (
                              <div>
                                <div
                                  className="mb-1 flex items-center justify-between"
                                >
                                  <span
                                    className="font-ui text-[11px] leading-[1.5]"
                                    style={{ color: 'var(--color-text-dim)' }}
                                  >
                                    Advocate score
                                  </span>
                                  <span
                                    className="font-ui text-[11px] font-medium"
                                    style={{ color: 'var(--color-primary)' }}
                                  >
                                    {scoreValue}/10
                                  </span>
                                </div>
                                <div
                                  className="h-1.5 w-full overflow-hidden rounded-full"
                                  style={{ backgroundColor: 'var(--color-line-strong)' }}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${(scoreValue / 10) * 100}%`,
                                      backgroundColor: 'var(--color-primary)',
                                      transition: prefersReducedMotion ? 'none' : 'width 0.6s ease',
                                    }}
                                  />
                                </div>
                              </div>
                            ) : hasScore && scoreValue === null ? (
                              // Null score — the real Issue 999 case
                              <p
                                className="font-ui text-[11px] leading-[1.5]"
                                style={{ color: 'var(--color-text-dim)' }}
                              >
                                Scores did not complete this cycle.
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    <p className="sr-only">Scroll to see more candidates.</p>
                  </>
                ) : (
                  <p
                    className="font-body text-[15px] leading-[1.65]"
                    style={{ color: 'var(--color-text-dim)' }}
                  >
                    No pitch log entries for this run.
                  </p>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  ZONE 2 — Scout → Advocate → Editor Flow Line + Confidence Meter
                  Rendered only when pitchLog, editorWinner, or editorConfidence present.
                  ───────────────────────────────────────────────────────────── */}
              {(pitchLog?.length || editorWinner || editorConfidence !== null) && (
                <div className="mb-12">
                  {/* Flow line diagram — decorative, screen readers get timeline text */}
                  <div className="del-flow" aria-hidden="true">
                    {/* Scout node */}
                    <div className="del-flow-node">
                      <div
                        className="del-flow-circle"
                        style={{ backgroundColor: 'var(--color-scout)' }}
                      />
                      <div>
                        <span
                          className="del-flow-label"
                          style={{ color: 'var(--color-scout)' }}
                        >
                          THE SCOUT
                        </span>
                        <span
                          className="del-flow-action ml-2"
                        >
                          CANDIDATES FOUND
                        </span>
                      </div>
                    </div>
                    <div className="del-flow-connector" />

                    {/* Advocate node */}
                    <div className="del-flow-node">
                      <div
                        className="del-flow-circle"
                        style={{ backgroundColor: 'var(--color-advocate)' }}
                      />
                      <div>
                        <span
                          className="del-flow-label"
                          style={{ color: 'var(--color-advocate)' }}
                        >
                          THE ADVOCATE
                        </span>
                        <span
                          className="del-flow-action ml-2"
                        >
                          ARGUMENTS SCORED
                        </span>
                      </div>
                    </div>
                    <div className="del-flow-connector" />

                    {/* Editor node */}
                    <div className="del-flow-node">
                      <div
                        className="del-flow-circle"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      />
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span
                          className="del-flow-label"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          THE EDITOR
                        </span>
                        {editorWinner ? (
                          <>
                            <em
                              className="font-body text-[15px] not-italic leading-[1.55]"
                              style={{ color: 'var(--color-text)', fontStyle: 'italic' }}
                            >
                              {editorWinner}
                            </em>
                            <span className="del-flow-action">selected</span>
                          </>
                        ) : (
                          <span className="del-flow-action">candidate selected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Event timeline — screen-reader accessible equivalent of flow line */}
                  {events && events.length > 0 && (
                    <div className="sr-only">
                      <h4>Deliberation timeline</h4>
                      <ul>
                        {events.map(event => {
                          const { displayName } = getAgentLabel(event.agentId)
                          return (
                            <li key={event._id}>
                              {displayName}: {eventOneLiner(event.eventType, event.payload)}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Confidence meter — below flow line, only when finite 0..1 present */}
                  {editorConfidence !== null && (
                    <div
                      ref={confidenceSectionRef}
                      className="mx-auto mt-8"
                      style={{ maxWidth: '640px' }}
                    >
                      <p
                        className="mb-2 font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em]"
                        style={{ color: 'var(--color-text-mute)' }}
                      >
                        EDITOR CONFIDENCE
                      </p>
                      <p
                        className="mb-3 font-display font-semibold leading-[1.1]"
                        style={{
                          fontSize: 'clamp(32px, 3.5vw, 48px)',
                          color: 'var(--color-primary)',
                        }}
                        aria-live="polite"
                      >
                        {displayValue}%
                      </p>
                      <div className="del-confidence-bar-track">
                        <div
                          className="del-confidence-bar-fill"
                          style={{
                            width: `${displayValue}%`,
                            transition: prefersReducedMotion ? 'none' : undefined,
                          }}
                        />
                      </div>

                      {/* Below-threshold flag */}
                      {editorConfidence < 0.70 && (
                        <div
                          className="mt-4 flex items-start gap-2 rounded-r pl-3"
                          style={{ borderLeft: '3px solid var(--color-accent)' }}
                        >
                          <p
                            className="font-body text-[15px] leading-[1.65]"
                            style={{ color: 'var(--color-text-dim)' }}
                          >
                            Below 0.70 threshold — human review flagged.
                          </p>
                        </div>
                      )}

                      {/* Editor rationale — surfaced below confidence meter */}
                      {editorRationale && (
                        <p
                          className="mt-4 font-body text-[15px] leading-[1.65]"
                          style={{ color: 'var(--color-text-dim)' }}
                        >
                          {editorRationale}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Visible event timeline (non-sr) for agents not covered by flow line */}
                  {events && events.length > 0 && (
                    <div
                      className="mx-auto mt-8 flex flex-col gap-4"
                      style={{ maxWidth: '640px' }}
                    >
                      {events
                        .filter(e =>
                          e.eventType !== 'scout-finding' &&
                          e.eventType !== 'advocate-argument' &&
                          e.eventType !== 'editor-decision'
                        )
                        .map(event => {
                          const { displayName, role } = getAgentLabel(event.agentId)
                          const chipStyle = agentChipStyle(event.agentId)
                          const oneLiner = eventOneLiner(event.eventType, event.payload)
                          return (
                            <div key={event._id} className="flex items-start gap-3">
                              {/* Agent identity chip with /agents/ link */}
                              <a
                                href={`/agents/${event.agentId}`}
                                className="flex-shrink-0 rounded px-2 py-1 font-ui text-[11px] leading-[1.5] no-underline"
                                style={{
                                  color: chipStyle.color,
                                  backgroundColor: chipStyle.backgroundColor,
                                  minHeight: '44px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  alignItems: 'flex-start',
                                  minWidth: '80px',
                                }}
                              >
                                <span className="font-semibold">{displayName}</span>
                                <span style={{ opacity: 0.7 }}>{role}</span>
                              </a>

                              {/* Event one-liner */}
                              <p
                                className="flex-1 font-body text-[15px] leading-[1.65] pt-1"
                                style={{ color: 'var(--color-text-dim)' }}
                              >
                                {oneLiner}
                              </p>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  ZONE 3 — QA Findings
                  Logic unchanged from Phase 11.
                  ───────────────────────────────────────────────────────────── */}
              {corrections && corrections.length > 0 && (
                <div>
                  <h4
                    className="mb-3 font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em]"
                    style={{ color: 'var(--color-text-dim)' }}
                  >
                    QA Findings
                  </h4>
                  <div className="flex flex-col gap-3">
                    {corrections.map(correction => {
                      const sev = (correction.severity ?? 'info') as 'info' | 'warning' | 'error'
                      const severityInfo = QA_SEVERITY[sev] ?? QA_SEVERITY.info
                      return (
                        <div
                          key={correction._id}
                          className="rounded p-4"
                          style={{ backgroundColor: 'var(--color-card)' }}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span
                              className="font-ui text-[11px] leading-[1.5]"
                              style={{ color: 'var(--color-text-dim)' }}
                            >
                              {correction.sectionName}
                            </span>
                            {/* Severity pill — color + text label (WCAG 1.4.1) */}
                            <span
                              className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.06em] px-2 py-0.5 rounded-sm"
                              style={{
                                color: severityInfo.color,
                                border: `1px solid ${severityInfo.color}`,
                              }}
                            >
                              {severityInfo.label}
                            </span>
                          </div>
                          <p
                            className="font-body text-[15px] leading-[1.55]"
                            style={{ color: 'var(--color-text-dim)' }}
                          >
                            {correction.reason}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </details>

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
