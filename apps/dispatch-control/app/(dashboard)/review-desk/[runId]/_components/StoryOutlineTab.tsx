'use client'
/**
 * Quick 260724-i5n (LD-3) — the story focus view's Outline tab (mockup
 * `03-story-outline-tab.html`): a DERIVED read of the draft's own structure
 * (`deriveStoryOutline` — lede + h2 beats) plus a side rail summarizing the
 * Brief, claim counts, and open findings for this one section.
 *
 * Presentational — `StoryFocusView`/`ReviewDeskRunView` compute and pass
 * down everything this component needs (including the already-resolved
 * `resolved`/`unresolved` finding lists, the SAME span resolution the
 * single-section galley itself uses); this component owns no data fetching.
 */
import { deriveStoryOutline, type OutlineUnresolvedFinding } from './storyOutline'
import type { ContentBlock } from '@/lib/contentPatchClient'
import type { ResolvedAnnotation } from '@/lib/galley/spanResolver'

export interface OutlineBriefFields {
  centralClaim?: string
  readerEffect?: string
  knownRisks?: string
}

export interface OutlineOpenFinding {
  id: string
  severity: 'info' | 'warning' | 'error'
  reason: string
}

interface StoryOutlineTabProps {
  sectionId: string
  blocks: ContentBlock[]
  resolved: ResolvedAnnotation[]
  unresolved: ReadonlyArray<OutlineUnresolvedFinding>
  brief: OutlineBriefFields | null | undefined
  sourcedCount: number
  unsourcedCount: number
  openFindings: OutlineOpenFinding[]
  onJumpToFinding: () => void
}

const DOT_CLASS: Record<'err' | 'warn' | 'info', string> = {
  err: 'bg-[color:var(--color-vermilion)]',
  warn: 'bg-[color:var(--color-marigold)]',
  info: 'bg-[color:var(--color-cobalt)]',
}

const SEVERITY_DOT_CLASS: Record<'error' | 'warning' | 'info', string> = {
  error: 'bg-[color:var(--color-vermilion)]',
  warning: 'bg-[color:var(--color-marigold)]',
  info: 'bg-[color:var(--color-cobalt)]',
}

function BriefField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mt-3">
      <p className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.08em] text-[color:var(--color-cobalt)]">
        {label}
      </p>
      <p className="mt-[3px] font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-ink)]">
        {value && value.trim() !== '' ? value : '—'}
      </p>
    </div>
  )
}

function SideRail({
  brief,
  sourcedCount,
  unsourcedCount,
  openFindings,
  onJumpToFinding,
}: Pick<
  StoryOutlineTabProps,
  'brief' | 'sourcedCount' | 'unsourcedCount' | 'openFindings' | 'onJumpToFinding'
>) {
  return (
    <aside className="flex flex-col gap-3.5">
      <div className="border border-[color:var(--color-faint)] border-l-[3px] border-l-[color:var(--color-cobalt)] bg-[color:var(--color-card-alt)] p-4">
        <p className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.12em] text-[color:var(--color-faint)]">
          From the brief
        </p>
        {brief ? (
          <>
            <BriefField label="Central claim" value={brief.centralClaim} />
            <BriefField label="Reader effect" value={brief.readerEffect} />
            <BriefField label="Known risks" value={brief.knownRisks} />
          </>
        ) : (
          <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
            No brief yet.
          </p>
        )}
      </div>

      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-4">
        <p className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.12em] text-[color:var(--color-faint)]">
          Claims in this story
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-[24px] font-semibold text-[color:var(--color-marigold-text)]">
            {sourcedCount}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.06em] text-[color:var(--color-faint)]">
            sourced
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-[24px] font-semibold text-[color:var(--color-vermilion)]">
            {unsourcedCount}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.06em] text-[color:var(--color-faint)]">
            unsourced
          </span>
        </div>
      </div>

      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card-alt)] p-4">
        <p className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.12em] text-[color:var(--color-faint)]">
          Open findings &middot; {openFindings.length}
        </p>
        {openFindings.length === 0 ? (
          <p className="mt-2.5 font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
            No open findings for this story.
          </p>
        ) : (
          <div className="mt-2.5">
            {openFindings.map((finding, i) => (
              <div
                key={finding.id}
                className={`flex gap-[9px] py-[9px] text-[12px] leading-[1.45] text-[color:var(--color-ink)] ${
                  i === 0 ? '' : 'border-t border-[color:var(--color-faint)]'
                }`}
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT_CLASS[finding.severity]}`}
                />
                <span>
                  {finding.reason}{' '}
                  <button
                    type="button"
                    onClick={onJumpToFinding}
                    className="font-semibold text-[color:var(--color-cobalt)] hover:underline"
                  >
                    Jump to line
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

export default function StoryOutlineTab({
  blocks,
  resolved,
  unresolved,
  brief,
  sourcedCount,
  unsourcedCount,
  openFindings,
  onJumpToFinding,
}: StoryOutlineTabProps) {
  if (blocks.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-9 lg:grid-cols-[minmax(0,1fr)_300px]">
        <p className="font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
          This section has no prose outline — see the Draft tab.
        </p>
        <SideRail
          brief={brief}
          sourcedCount={sourcedCount}
          unsourcedCount={unsourcedCount}
          openFindings={openFindings}
          onJumpToFinding={onJumpToFinding}
        />
      </div>
    )
  }

  const { lede, beats } = deriveStoryOutline(blocks, resolved, unresolved)
  const rows = lede ? [lede, ...beats] : beats

  return (
    <div className="grid grid-cols-1 gap-9 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <p className="mb-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.12em] text-[color:var(--color-faint)]">
          The shape of the piece
        </p>
        {rows.map((beat, i) => (
          <div
            key={`${beat.kind}-${beat.blockStart}`}
            className={`flex gap-[18px] border-b border-[color:var(--color-faint)]/30 py-[15px] ${
              i === 0 ? 'pt-0' : ''
            } ${i === rows.length - 1 ? 'border-none' : ''}`}
          >
            <span className="w-[26px] shrink-0 pt-1 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-faint)]">
              {beat.kind === 'lede' ? '—' : String(i).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-[family-name:var(--font-display)] text-[19px] font-semibold leading-[1.15] text-[color:var(--color-ink)]">
                {beat.label || (beat.kind === 'lede' ? 'Opening' : 'Untitled beat')}
                {beat.kind === 'lede' && (
                  <span className="ml-2 align-[2px] font-[family-name:var(--font-mono)] text-[9px] font-normal uppercase tracking-[.1em] text-[color:var(--color-faint)]">
                    Lede
                  </span>
                )}
              </h3>
              {beat.lead && (
                <p className="mt-[5px] font-[family-name:var(--font-body)] text-[13.5px] italic leading-[1.5] text-[color:var(--color-ink-soft)]">
                  {beat.lead}
                </p>
              )}
            </div>
            <div className="shrink-0 pt-1 text-right">
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                {beat.wordCount}w
              </span>
              {beat.dots.length > 0 && (
                <div className="mt-[7px] flex justify-end gap-1">
                  {beat.dots.map((dot, di) => (
                    <span key={di} className={`h-2 w-2 rounded-full ${DOT_CLASS[dot]}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <p className="mt-[18px] font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-faint)]">
          The outline is read from the draft&rsquo;s structure — edit in the Draft tab.
        </p>
      </div>

      <SideRail
        brief={brief}
        sourcedCount={sourcedCount}
        unsourcedCount={unsourcedCount}
        openFindings={openFindings}
        onJumpToFinding={onJumpToFinding}
      />
    </div>
  )
}
