/**
 * Phase 56-09 — Behind-Run (pure view). Plain-words account of what happened
 * to one issue. Data lives in BehindRun.tsx.
 */
import Link from 'next/link'
import NextStepSlab from '@/components/editor/NextStepSlab'
import StepList from '@/components/editor/StepList'
import { SkeletonLine } from '@/components/ui/Skeleton'
import { COPY, type StepVM } from '@/lib/editorState'
import { GENERIC_EXPLANATION, STEP_EXPLANATIONS } from '@/lib/behindExplanations'

export type BehindRunMode = 'problem' | 'paused' | 'stuck' | 'stopped' | 'working' | 'ready' | 'published'

export interface BehindRunViewProps {
  mode: BehindRunMode
  issueNumber: number | null
  issueLine: string
  issueHref: string
  steps: StepVM[] | undefined
  costLine: string | null
  problemKey: string | null
  rawError: string | null
  /** Weekday the issue went out, for the published sentence. */
  publishedDay?: string
  onPrimary: () => void
  primaryBusy: boolean
  actionError: string | null
}

const PAUSED_EXPLANATION = {
  what: "This older issue stopped to wait for a choice that is now made automatically. It can't continue.",
  next: 'Stop it, then start a new issue.',
}

function slabFor(p: BehindRunViewProps): React.ComponentProps<typeof NextStepSlab> {
  const n = p.issueNumber != null ? `Issue ${p.issueNumber}` : 'This issue'
  const primary = (label: string) => ({ label, onClick: p.onPrimary, busy: p.primaryBusy })
  switch (p.mode) {
    case 'problem':
      return {
        sentence: 'This issue hit a problem and stopped. Nothing reached readers.',
        explanation:
          'There is nothing to fix here by hand. Start a new issue and the writers will try again from the beginning, usually without trouble.',
        primary: primary('Start a new issue'),
        error: p.actionError,
      }
    case 'stopped':
      return {
        sentence: 'This issue was stopped. Nothing reached readers.',
        explanation: "Start a new issue when you're ready. The writers will begin again from the start.",
        primary: primary('Start a new issue'),
        error: p.actionError,
      }
    case 'stuck':
    case 'paused':
      return {
        sentence: "This older issue can't continue.",
        explanation: "It paused on an older version of the system and can't finish. Stop it, then start a new issue.",
        primary: primary('Stop this issue'),
        error: p.actionError,
      }
    case 'working':
      return { sentence: 'Nothing for you to do yet. The writers are on it.', working: true }
    case 'ready':
      return {
        sentence: `${n} is waiting for you on the front page.`,
        ghost: { label: COPY.backToIssue, href: p.issueHref },
      }
    case 'published':
      return {
        sentence: `${n} went out on ${p.publishedDay ?? 'Thursday'}.`,
        ghost: { label: COPY.backToIssue, href: p.issueHref },
      }
  }
}

export default function BehindRunView(props: BehindRunViewProps) {
  const { mode, issueNumber, issueLine, steps, costLine, problemKey, rawError } = props
  const explanation =
    mode === 'paused' || mode === 'stuck'
      ? PAUSED_EXPLANATION
      : problemKey
        ? (STEP_EXPLANATIONS[problemKey] ?? GENERIC_EXPLANATION)
        : mode === 'problem'
          ? GENERIC_EXPLANATION
          : null
  const showRight = explanation != null || rawError != null

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-10">
      <NextStepSlab {...slabFor(props)} />
      <header>
        <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">
          <Link href="/admin" className="underline editor-focus">
            Behind the scenes
          </Link>
          {` · ${issueLine}`}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[32px] sm:text-[42px] font-semibold leading-[1.1]">
          {issueNumber != null ? `What happened to Issue ${issueNumber}` : 'What happened to this issue'}
        </h1>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12">
        <div>
          {steps === undefined ? (
            <div className="space-y-3">
              <SkeletonLine />
              <SkeletonLine />
              <SkeletonLine />
            </div>
          ) : (
            <StepList label="Step by step" steps={steps} footer={costLine} />
          )}
        </div>
        {showRight ? (
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-[26px] font-semibold">In plain words</h2>
            <div className="mt-4 space-y-4 bg-white border border-[color:var(--color-line-strong)] p-6">
              {explanation ? (
                <>
                  <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.6]">{explanation.what}</p>
                  <p className="font-[family-name:var(--font-body)] text-[17px] leading-[1.6]">{explanation.next}</p>
                </>
              ) : null}
              {rawError ? (
                <details className="border-t border-[color:var(--color-line-strong)] pt-3">
                  <summary className="min-h-[48px] flex items-center cursor-pointer font-[family-name:var(--font-ui)] text-[17px] font-semibold editor-focus">
                    Technical details
                  </summary>
                  <pre className="overflow-x-auto bg-[rgba(23,20,14,0.04)] p-4 text-[14px] font-[monospace] whitespace-pre">
                    {rawError}
                  </pre>
                </details>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
