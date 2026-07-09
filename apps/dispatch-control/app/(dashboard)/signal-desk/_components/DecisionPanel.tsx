'use client'
/**
 * Phase 37 (SIG-02, Plan 37-05 Task 2) — DecisionPanel: the Gate 1 winner +
 * confidence meter + editor reasoning, sourced from the `editor-decision`
 * `deliberationEvents` row payload (API_CONTRACTS §37.2 — `editor_gate_1` now
 * persists `confidence` + `runnerUpNotes` alongside `winner`/`rationale`,
 * threaded via 37-01).
 *
 * `rationale` renders IN FULL — no clamping/ellipsis utility class anywhere
 * in this file (the same anti-truncation rule as CandidateSlate's
 * primaryConcern). `confidence` may be `null`/absent on runs recorded before
 * 37-01 landed — the meter hides in that case, but winner + rationale still
 * render. When no `editor-decision` row exists yet (run hasn't reached Gate
 * 1's decision, or is still mid-deliberation), a graceful empty state is
 * shown instead of a crash.
 */
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

export interface EditorDecisionRow {
  payload: string
}

interface EditorDecisionPayload {
  winner?: string
  rationale?: string
  confidence?: number | null
  runnerUpNotes?: string | null
}

function parseDecisionPayload(raw: string): EditorDecisionPayload {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as EditorDecisionPayload) : {}
  } catch {
    return {}
  }
}

export interface DecisionPanelProps {
  runId: string
}

export function DecisionPanel({ runId }: DecisionPanelProps) {
  const rows = useQuery(api.deliberationEvents.byRunIdAndType, {
    runId,
    eventType: 'editor-decision',
  }) as EditorDecisionRow[] | undefined

  return (
    <section
      aria-label="Gate 1 decision"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]">
        Gate 1 Decision
      </h2>

      {rows === undefined ? (
        <p className="mt-2 text-[13px] text-[color:var(--color-ink-soft)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[13px] italic text-[color:var(--color-ink-soft)]">
          No decision yet — Gate 1 hasn&rsquo;t resolved.
        </p>
      ) : (
        (() => {
          // Take the latest row if several exist (mirrors DecisionRail's
          // editor-final handling).
          const latest = rows[rows.length - 1]
          const payload = parseDecisionPayload(latest.payload)
          const confidencePct =
            payload.confidence != null ? Math.round(payload.confidence * 100) : null

          return (
            <div className="mt-2">
              <p
                data-testid="decision-winner"
                className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[color:var(--color-ink)]"
              >
                {payload.winner ?? 'Winner not recorded'}
              </p>

              {confidencePct != null && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[11px] text-[color:var(--color-ink-soft)]">
                    <span>Confidence</span>
                    <span data-testid="decision-confidence-label">{confidencePct}%</span>
                  </div>
                  <div
                    className="mt-1 h-2 w-full bg-[color:var(--color-nav)]"
                    role="progressbar"
                    aria-valuenow={confidencePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Gate 1 decision confidence"
                  >
                    <div
                      data-testid="decision-confidence-meter"
                      className="h-full bg-[color:var(--color-cobalt)]"
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 border-t border-[color:var(--color-faint)] pt-2">
                <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                  Editor reasoning
                </span>
                {/* rationale — rendered IN FULL, never clipped. */}
                <p
                  data-testid="decision-rationale"
                  className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                >
                  {payload.rationale ?? '—'}
                </p>
              </div>

              {payload.runnerUpNotes && (
                <div className="mt-3 border-t border-[color:var(--color-faint)] pt-2">
                  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                    Runner-up notes
                  </span>
                  <p
                    data-testid="decision-runner-up-notes"
                    className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-ink)]"
                  >
                    {payload.runnerUpNotes}
                  </p>
                </div>
              )}
            </div>
          )
        })()
      )}
    </section>
  )
}
