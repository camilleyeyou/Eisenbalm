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
 * Design note (Dismiss): the mockup shows a `Dismiss` action on each finding
 * card; this rail deliberately does NOT implement one. Accept/Edit/Dismiss
 * already live in `AnnotationMark`'s popover (the galley's inline
 * annotation), and building a second dismiss-with-reason flow here would
 * fork the annotation system — an explicit constraint. `Jump to it` scrolls
 * to the mark AND opens that popover (see `onJump` wiring in
 * `StoryFocusView`), so Dismiss is one interaction away through the
 * existing, tested path.
 */
import { VOICE_AXES } from '@/lib/galley/axisPartition'
import type { ResolvedAnnotation } from '@/lib/galley/spanResolver'

export interface StoryFindingsRailUnresolvedFinding {
  findingId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  quotedSpan?: string
}

interface StoryFindingsRailProps {
  resolved: ResolvedAnnotation[]
  unresolved: ReadonlyArray<StoryFindingsRailUnresolvedFinding>
  onJump: (findingId: string) => void
  onFixInEditor: (findingId: string) => void
  onNextStoryWithFindings?: () => void
}

interface RailRow {
  findingId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  quotedSpan?: string
}

/** error -> "Must fix" (solid vermilion); voice-axis -> "Voice" (tinted
 * marigold); everything else -> "Review" (tinted cobalt). Label + color
 * together — never color alone. */
function severityChip(row: RailRow): { label: string; className: string } {
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
}: StoryFindingsRailProps) {
  const rows: RailRow[] = [
    ...resolved.map(r => ({
      findingId: r.findingId,
      severity: r.severity,
      axis: r.axis,
      reason: r.reason,
      quotedSpan: r.quotedSpan,
    })),
    ...unresolved,
  ]

  // The whole point of the variant: a clean story gets NO rail — not a
  // collapsed/empty one.
  if (rows.length === 0) return null

  return (
    <aside className="sticky top-[72px] flex w-full flex-col border border-l-0 border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] lg:w-[292px]">
      <div className="flex items-center gap-2 border-b border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-3">
        <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.12em] text-[color:var(--color-ink)]">
          Open on this story
        </span>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[9.5px] text-[color:var(--color-vermilion)]">
          {rows.length}
        </span>
      </div>
      {rows.map(row => {
        const chip = severityChip(row)
        return (
          <div key={row.findingId} className="border-b border-[color:var(--color-faint)] p-3 last:border-b-0">
            <span
              className={`inline-block border px-[6px] py-[2px] font-[family-name:var(--font-mono)] text-[8.5px] font-semibold uppercase tracking-[.1em] ${chip.className}`}
            >
              {chip.label}
            </span>
            {row.quotedSpan && (
              <p className="mt-2 border-l-2 border-[color:var(--color-faint)] pl-2 font-[family-name:var(--font-body)] text-[12px] italic leading-snug text-[color:var(--color-ink)]">
                &ldquo;{row.quotedSpan}&rdquo;
              </p>
            )}
            <p className="mt-2 font-[family-name:var(--font-body)] text-[11.5px] leading-snug text-[color:var(--color-ink-soft)]">
              {row.reason}
            </p>
            <div className="mt-2 flex gap-3">
              {row.quotedSpan ? (
                <button
                  type="button"
                  onClick={() => onJump(row.findingId)}
                  className="min-h-[44px] font-[family-name:var(--font-ui)] text-[11px] font-semibold text-[color:var(--color-cobalt)]"
                >
                  Jump to it →
                </button>
              ) : (
                // No quotedSpan to scroll to (unresolved — anchor failure) —
                // never a blank row, always a live action.
                <button
                  type="button"
                  onClick={() => onFixInEditor(row.findingId)}
                  className="min-h-[44px] font-[family-name:var(--font-ui)] text-[11px] font-semibold text-[color:var(--color-cobalt)]"
                >
                  Fix in editor →
                </button>
              )}
            </div>
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
