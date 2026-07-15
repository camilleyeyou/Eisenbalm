'use client'
/**
 * Phase 40 Plan 40-05 (§40-UI-SPEC "State & Icon Contract" #5, ISS-01) —
 * the 5-segment stage strip. Shared visual contract Phase 41's stage tabs
 * will reuse — build it once, here.
 *
 * Renders exactly 5 `data-testid="stage-segment"` nodes (one per
 * `stages` entry), each carrying: the stage name, the state ICON (per the
 * State & Icon Contract), and the state LABEL text. The spin-animation
 * icon reserved for System Activity "Running" is NEVER used here — "In
 * progress" is a STATIC `CircleDot`, so this strip can never be mistaken
 * for a live system-activity readout.
 *
 * Geometry (5 segments, `min-h-[44px]` each) is preserved regardless of
 * state so IssueCard's loading skeleton can reuse this exact component.
 */
import { AlertTriangle, Circle, CircleDot, CheckCircle2 } from 'lucide-react'
import type { StageState, StageStateResult } from '@/lib/derivedState'

const STAGE_LABELS = ['Story', 'Draft', 'Fact Check', 'Voice', 'Approval'] as const

export const STAGE_STATE_LABELS: Record<StageState, string> = {
  'not-generated': 'Not generated',
  'in-progress': 'In progress',
  'needs-you': 'Needs you',
  clean: 'Clean',
}

function StageIcon({ state }: { state: StageState }) {
  switch (state) {
    case 'not-generated':
      return (
        <Circle
          size={14}
          className="shrink-0 text-[color:var(--color-faint)]"
          aria-hidden="true"
        />
      )
    case 'in-progress':
      // STATIC — never a spin animation. The spinner icon is reserved
      // exclusively for System Activity "Running" (UI-SPEC rule).
      return (
        <CircleDot
          size={14}
          className="shrink-0 text-[color:var(--color-marigold)]"
          aria-hidden="true"
        />
      )
    case 'needs-you':
      return (
        <AlertTriangle
          size={14}
          className="shrink-0 text-[color:var(--color-vermilion)]"
          aria-hidden="true"
        />
      )
    case 'clean':
      return (
        <CheckCircle2
          size={14}
          className="shrink-0 text-[color:var(--color-green)]"
          aria-hidden="true"
        />
      )
  }
}

interface StageStripProps {
  stages: StageStateResult[]
}

export default function StageStrip({ stages }: StageStripProps) {
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Stage progress">
      {stages.map((stage, i) => {
        const label = STAGE_STATE_LABELS[stage.state]
        const suffix = stage.state === 'needs-you' && stage.openCount > 0 ? ` · ${stage.openCount}` : ''
        return (
          <div
            key={STAGE_LABELS[i] ?? i}
            data-testid="stage-segment"
            role="listitem"
            className="flex min-h-[44px] min-w-[112px] items-center gap-[6px] rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card-alt)] px-[9px] py-[3px]"
          >
            <StageIcon state={stage.state} />
            <span className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
                {STAGE_LABELS[i] ?? `Stage ${i + 1}`}
              </span>
              <span className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
                {label}
                {suffix}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
