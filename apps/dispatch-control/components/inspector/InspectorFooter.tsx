'use client'
/**
 * Phase 44 Plan 44-05 (INS-06, §44.7) — the inspector's six footer actions.
 *
 * Live deep-links target ALREADY-SHIPPED surfaces; the rest render as
 * visible-but-reserved controls with an explanatory title (D-08, mirroring
 * how Phases 42/43 shipped Inspect entry points as stubs before this panel
 * existed). The inspector performs no mutations — every live action here
 * navigates or deep-links, never writes (D-09).
 *
 * | Action                        | State                                              |
 * |--------------------------------|-----------------------------------------------------|
 * | Improve this agent →           | LIVE when promptKey !== null; else RESERVED         |
 * | Compare instruction versions   | LIVE when promptKey !== null; else RESERVED         |
 * | Related quality tests          | LIVE when promptKey !== null; else RESERVED         |
 * | Prior & downstream steps       | Always LIVE                                         |
 * | Ask agent to revise            | LIVE when `onAskToRevise` is provided; else RESERVED |
 * | Restart from this step         | Always RESERVED, for ALL artifact types             |
 *
 * "Restart from this step" rationale (44-RESEARCH.md Pitfall 6): the only
 * existing resume endpoint (`POST /run/{run_id}/resume`) is hardcoded to the
 * Gate-1 `interrupt()` payload shape — there is no generic "resume from node
 * X" mechanism, so wiring this to it would either silently no-op or misfire
 * a Gate-1-shaped payload at a non-Gate-1 step. Reserved for every artifact
 * type, no exception (§44.7).
 *
 * Phase 45 (REV-01, D-18, Plan 45-05 Task 3): "Ask agent to revise" flips
 * from Always RESERVED to conditionally LIVE. The panel (`InspectorPanel.tsx`)
 * only passes `onAskToRevise` when it can derive a REAL, non-empty
 * `quotedText` (`lib/firstProseExcerpt.ts`) for the inspected artifact's
 * section — omitted (e.g. a non-drafted-section artifact: claim/rec/org/
 * signal/qa, or an empty section) leaves this action reserved, honestly,
 * rather than a false-live dead button. The old Phase-44 reserved-reason
 * constant for this action is gone: there is no longer a single static
 * reserved reason for every caller.
 */
import Link from 'next/link'
import {
  Wand2,
  GitCompare,
  FlaskConical,
  Waypoints,
  MessageSquarePlus,
  RotateCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface InspectorFooterProps {
  /** null => the agent is not externalized to prompt-lab (§44.9's 5-agent set). */
  promptKey: string | null
  agentKey: string
  runId: string
  /**
   * Phase 45 (REV-01, D-18) — opens the shared `RevisionFlow` scoped to a
   * REAL derived passage for this artifact's section. Omitted => "Ask agent
   * to revise" renders reserved (this artifact has no revisable passage, or
   * the mounting surface hasn't wired revision support) — never a
   * false-live button.
   */
  onAskToRevise?: () => void
}

const NOT_EXTERNALIZED_TITLE = "This agent's instructions are code-defined, not editable here."
const REVISE_NOT_AVAILABLE_TITLE =
  'No revisable passage available for this artifact — the galley toolbar covers drafted sections directly.'
const RESTART_TITLE =
  'Completed steps are reused, not re-paid — general step restart is not yet wired (Gate-1 resume only).'

const LIVE_CLASSES =
  'flex min-h-[36px] items-center gap-[6px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.03em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]'

const RESERVED_CLASSES =
  'flex min-h-[36px] items-center gap-[6px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[10.5px] font-semibold uppercase tracking-[.03em] text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40'

function FooterAction({
  icon: Icon,
  label,
  href,
  onClick,
  disabledTitle,
}: {
  icon: LucideIcon
  label: string
  /** Present => LIVE (rendered as a Link). */
  href?: string
  /** Present (and `href` absent) => LIVE (rendered as an enabled button). Phase 45 (D-18). */
  onClick?: () => void
  /** Used when neither `href` nor `onClick` is present => RESERVED (disabled button). */
  disabledTitle?: string
}) {
  // No custom aria-label here — the visible label text is already a clear
  // accessible name on its own, and a custom aria-label would silently
  // shadow it (e.g. an "…'s instructions" suffix would falsely collide with
  // the Instructions TAB button's accessible name in assistive-tech/testing
  // queries — 44-05 caught this during test-writing).
  if (href) {
    return (
      <Link href={href} className={LIVE_CLASSES}>
        <Icon size={13} aria-hidden="true" />
        {label}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={LIVE_CLASSES}>
        <Icon size={13} aria-hidden="true" />
        {label}
      </button>
    )
  }
  return (
    <button type="button" disabled title={disabledTitle} className={RESERVED_CLASSES}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </button>
  )
}

export function InspectorFooter({ promptKey, agentKey, runId, onAskToRevise }: InspectorFooterProps) {
  const promptHref = promptKey ? `/prompt-lab/${encodeURIComponent(promptKey)}` : undefined
  // eval-center does not yet read an `agent` query param (confirmed against
  // ScenarioCard.tsx / page.tsx as of 44-05) — the link below is still LIVE
  // (the page loads and is genuinely useful), and forward-compatible for
  // when server-side filtering ships; the query string is inert until then.
  const evalCenterHref = promptKey ? `/eval-center?agent=${encodeURIComponent(promptKey)}` : undefined

  return (
    <div
      className="sticky bottom-0 flex flex-wrap gap-2 border-t border-[color:var(--color-faint)] bg-[color:var(--color-paper)] p-3"
      aria-label={`Actions for ${agentKey} · run ${runId}`}
    >
      <FooterAction
        icon={Wand2}
        label="Improve this agent →"
        href={promptHref}
        disabledTitle={NOT_EXTERNALIZED_TITLE}
      />
      <FooterAction
        icon={GitCompare}
        label="Compare instruction versions"
        href={promptHref}
        disabledTitle={NOT_EXTERNALIZED_TITLE}
      />
      <FooterAction
        icon={FlaskConical}
        label="Related quality tests"
        href={evalCenterHref}
        disabledTitle={NOT_EXTERNALIZED_TITLE}
      />
      <FooterAction icon={Waypoints} label="Prior & downstream steps" href="/run-monitor/graph" />
      <FooterAction
        icon={MessageSquarePlus}
        label="Ask agent to revise"
        onClick={onAskToRevise}
        disabledTitle={REVISE_NOT_AVAILABLE_TITLE}
      />
      <FooterAction icon={RotateCcw} label="Restart from this step" disabledTitle={RESTART_TITLE} />
    </div>
  )
}
