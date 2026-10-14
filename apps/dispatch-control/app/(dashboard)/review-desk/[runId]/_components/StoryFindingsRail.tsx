'use client'
/**
 * quick 260730-i4j (Task 3d) — the story-scoped open-findings rail.
 *
 * Draft Focus (mockup `12-draft-one-rail.html`): the Draft stage drops the
 * frame's left 232px outline rail AND right 320px ContextPanel entirely
 * (see `issues/[issueNumber]/layout.tsx`'s `draftFocus` branch). Findings
 * for the currently-open story instead live in ONE ~292px rail rendered
 * INSIDE the story canvas (`StoryFocusView`) — and only when that story
 * actually has open findings. A clean story runs the full canvas width;
 * this component returns `null` (not a collapsed/empty shell) in that case
 * — that is the entire point of the variant.
 *
 * Pure — no Convex, no fetch. `resolved`/`unresolved` are the SAME
 * `resolveSectionFindings(...)` output `ReviewDeskRunView` already computes
 * for the currently-open story (`selectedResolution`) and already threads
 * into `StoryFocusView` as props — no new plumbing.
 *
 * quick 261014-lbr: cards are grouped by normalized quote per section (two
 * findings on the same passage = one card). Apply fix / Dismiss reuse
 * `acceptFinding` / `dismissFinding` (the AnnotationMark helpers) via
 * `storyFindingActions` — no new endpoint. The rail itself stays pure
 * (callbacks only, no Convex/fetch/Clerk).
 */
import { VOICE_AXES } from '@/lib/galley/axisPartition'
import type { ResolvedAnnotation } from '@/lib/galley/spanResolver'
import { useState } from 'react'
import { groupFindingRows, type FindingGroup } from './storyFindingActions'

export interface StoryFindingsRailUnresolvedFinding {
  findingId: string
  sectionId?: string
  suggestedFix?: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  quotedSpan?: string
}

interface ActionResult {
  note: string | null
}

interface StoryFindingsRailProps {
  resolved: ResolvedAnnotation[]
  unresolved: ReadonlyArray<StoryFindingsRailUnresolvedFinding>
  onJump: (findingId: string) => void
  onFixInEditor: (findingId: string) => void
  onNextStoryWithFindings?: () => void
  /** false for sections whose text is not marked up in the galley (game, theme, non-specAd bonus). */
  canAnnotate?: boolean
  onApplyFix?: (members: FindingGroup['members']) => Promise<ActionResult | void>
  onDismiss?: (findingIds: string[], reason: string) => Promise<ActionResult | void>
}

interface CardState {
  busy?: boolean
  note?: string | null
  dismissing?: boolean
  reason?: string
}

/** error -> "Must fix" (solid vermilion); voice-axis -> "Voice" (tinted
 * marigold); everything else -> "Review" (tinted cobalt). Label + color
 * together — never color alone. */
function severityChip(row: { severity: 'info' | 'warning' | 'error'; axis?: string }): { label: string; className: string } {
  if (row.severity === 'error') {
    return {
      label: 'Must fix',
      className:
        'border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)] text-white',
    }
  }
  if (VOICE_AXES.has(row.axis ?? '')) {
    return {
      label: 'Voice',
      className:
        'border-[color:var(--color-marigold)] bg-[color:var(--color-marigold)]/[.14] text-[color:var(--color-marigold-text)]',
    }
  }
  return {
    label: 'Review',
    className: 'border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)]/[.08] text-[color:var(--color-cobalt)]',
  }
}

export default function StoryFindingsRail({
  resolved,
  unresolved,
  onJump,
  onFixInEditor,
  onNextStoryWithFindings,
  canAnnotate = true,
  onApplyFix,
  onDismiss,
}: StoryFindingsRailProps) {
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const patch = (key: string, p: CardState) =>
    setCards(prev => ({ ...prev, [key]: { ...prev[key], ...p } }))

  const groups = groupFindingRows(resolved, unresolved)
  const totalFindings = resolved.length + unresolved.length

  // The whole point of the variant: a clean story gets NO rail — not a
  // collapsed/empty one.
  if (groups.length === 0) return null

  async function run(key: string, fn: () => Promise<ActionResult | void>, closeDismiss = false) {
    patch(key, { busy: true })
    try {
      const r = await fn()
      patch(key, { busy: false, note: r && r.note ? r.note : null, ...(closeDismiss ? { dismissing: false } : {}) })
    } catch (e) {
      patch(key, { busy: false, note: e instanceof Error ? e.message : 'That did not work — try again.' })
    }
  }

  const linkCls =
    'min-h-[44px] font-[family-name:var(--font-ui)] text-[11px] font-semibold text-[color:var(--color-cobalt)]'

  return (
    <aside className="sticky top-[72px] flex w-full flex-col border border-l-0 border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] lg:w-[292px]">
      <div className="flex items-center gap-2 border-b border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-3">
        <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.12em] text-[color:var(--color-ink)]">
          Open on this story
        </span>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[9.5px] text-[color:var(--color-vermilion)]">
          {groups.length}
          {groups.length !== totalFindings && (
            <span className="ml-1 text-[color:var(--color-faint)]">&middot; from {totalFindings} findings</span>
          )}
        </span>
      </div>
      {groups.map(group => {
        const chip = severityChip(group)
        const st = cards[group.key] ?? {}
        const showApply = canAnnotate && Boolean(group.suggestedFix) && Boolean(onApplyFix)
        const reasonText = 'font-[family-name:var(--font-body)] text-[11.5px] leading-snug text-[color:var(--color-ink-soft)]'
        return (
          <div key={group.key} className="border-b border-[color:var(--color-faint)] p-3 last:border-b-0">
            <span
              className={`inline-block border px-[6px] py-[2px] font-[family-name:var(--font-mono)] text-[8.5px] font-semibold uppercase tracking-[.1em] ${chip.className}`}
            >
              {chip.label}
            </span>
            {group.quotedSpan && (
              <p className="mt-2 border-l-2 border-[color:var(--color-faint)] pl-2 font-[family-name:var(--font-body)] text-[12px] italic leading-snug text-[color:var(--color-ink)]">
                &ldquo;{group.quotedSpan}&rdquo;
              </p>
            )}
            {group.reasons.length === 1 ? (
              <p className={`mt-2 ${reasonText}`}>{group.reasons[0]}</p>
            ) : (
              <ul className={`mt-2 list-disc pl-4 ${reasonText}`}>
                {group.reasons.map(r => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {group.suggestedFix && (
              <p className="mt-2 font-[family-name:var(--font-body)] text-[11px] leading-snug text-[color:var(--color-ink-soft)]">
                Suggested change: &ldquo;{group.suggestedFix}&rdquo;
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {showApply && (
                <button
                  type="button"
                  disabled={st.busy}
                  onClick={() => run(group.key, () => onApplyFix!(group.members))}
                  className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 font-[family-name:var(--font-ui)] text-[11px] font-semibold text-white disabled:opacity-60"
                >
                  {st.busy && !st.dismissing ? 'Applying…' : 'Apply fix'}
                </button>
              )}
              {canAnnotate && group.anchoredFindingId ? (
                <button type="button" onClick={() => onJump(group.anchoredFindingId!)} className={linkCls}>
                  Jump to it →
                </button>
              ) : (
                // Not marked up in the galley (game/theme/anchor failure) —
                // never a blank row, always a live action.
                <button type="button" onClick={() => onFixInEditor(group.findingIds[0]!)} className={linkCls}>
                  Fix it in the editor →
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={() => patch(group.key, { dismissing: !st.dismissing })}
                  className={linkCls}
                >
                  Dismiss
                </button>
              )}
            </div>
            {onDismiss && st.dismissing && (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Why? (one line)"
                  value={st.reason ?? ''}
                  onChange={e => patch(group.key, { reason: e.target.value })}
                  className="border border-[color:var(--color-faint)] bg-white px-2 py-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-ink)]"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={st.busy || !(st.reason ?? '').trim()}
                    onClick={() => run(group.key, () => onDismiss(group.findingIds, (st.reason ?? '').trim()), true)}
                    className={`${linkCls} disabled:opacity-50`}
                  >
                    Confirm dismiss
                  </button>
                  <button type="button" onClick={() => patch(group.key, { dismissing: false })} className={linkCls}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {st.note && (
              <p role="status" className="mt-2 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-vermilion)]">
                {st.note}
              </p>
            )}
          </div>
        )
      })}
      {onNextStoryWithFindings && (
        <div className="border-t border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-3">
          <button
            type="button"
            onClick={onNextStoryWithFindings}
            className="min-h-[44px] font-[family-name:var(--font-ui)] text-[11.5px] font-semibold text-[color:var(--color-cobalt)]"
          >
            Next story with findings →
          </button>
        </div>
      )}
    </aside>
  )
}
