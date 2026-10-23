/**
 * Phase 56-08 — "Behind the scenes" (pure view). Slab, this week's issue step
 * by step, and the seven dials. Data lives in BehindHub.tsx.
 */
import Link from 'next/link'
import NextStepSlab from '@/components/editor/NextStepSlab'
import StepList from '@/components/editor/StepList'
import { SkeletonLine } from '@/components/ui/Skeleton'
import { COPY, type StepVM } from '@/lib/editorState'
import type { AdminItem } from '@/lib/nav'

export interface BehindHubViewProps {
  slabSentence: string
  issueLine: string | null
  steps: StepVM[] | undefined
  costLine: string | null
  items: ReadonlyArray<AdminItem>
}

export default function BehindHubView({ slabSentence, issueLine, steps, costLine, items }: BehindHubViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-10">
      <NextStepSlab sentence={slabSentence} ghost={{ label: COPY.backToIssue, href: '/' }} />
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-[32px] sm:text-[42px] font-semibold leading-[1.1]">
          Behind the scenes
        </h1>
        <p className="mt-3 max-w-[620px] font-[family-name:var(--font-body)] text-[17px] leading-[1.55] text-[color:var(--color-ink-soft)]">
          How the machine made this week&rsquo;s issue, and the dials that control it. Nothing on this page is needed to publish.
        </p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12">
        <div>
          {issueLine ? (
            <p className="mb-2 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">{issueLine}</p>
          ) : null}
          {steps === undefined ? (
            <div className="space-y-3">
              <SkeletonLine />
              <SkeletonLine />
              <SkeletonLine />
            </div>
          ) : (
            <StepList label="This week's issue, step by step" steps={steps} footer={costLine} />
          )}
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[26px] font-semibold">The dials</h2>
          <ul className="mt-4 bg-white border border-[color:var(--color-line-strong)]">
            {items.map((item, i) => (
              <li key={item.href} className={i > 0 ? 'border-t border-[color:var(--color-line-strong)]' : ''}>
                <Link
                  href={item.href}
                  className="flex min-h-[64px] flex-col justify-center gap-0.5 px-6 py-4 hover:bg-[color:var(--color-wash)] editor-focus"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-[family-name:var(--font-ui)] text-[17px] font-semibold">{item.label}</span>
                    {item.weekly ? (
                      <span className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">Check weekly</span>
                    ) : null}
                  </span>
                  <span className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]">{item.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
