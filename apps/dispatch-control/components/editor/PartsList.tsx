import Link from 'next/link'
import type { HomeSectionRow } from '@/lib/homeSections'
import { PART_LABELS, partRowStatus } from '@/lib/editorState'
import StatusWord from './StatusWord'

export default function PartsList({
  rows,
  published,
  hint,
  hrefFor,
}: {
  rows: HomeSectionRow[]
  published: boolean
  hint: string
  hrefFor?: (row: HomeSectionRow) => string
}) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-3">
        <h2 className="font-[family-name:var(--font-display)] text-[26px] font-semibold">The nine parts</h2>
        {hint ? <p className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)] sm:text-right">{hint}</p> : null}
      </div>
      <ol className="bg-[color:var(--color-card)] border border-[color:var(--color-line-strong)]">
        {rows.map((row, i) => {
          const st = partRowStatus(row, { published })
          const label = PART_LABELS[row.id] ?? row.label
          const title = row.headline || PART_LABELS[row.id] || row.label
          const cls = 'block min-h-[64px] px-4 py-4 sm:px-6 sm:flex sm:items-baseline sm:gap-6'
          const inner = (
            <>
              <span className="flex justify-between gap-3 sm:contents">
                <span className="font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)] sm:contents">
                  <span className="sm:w-6">{i + 1}</span>
                  <span className="sm:hidden"> · </span>
                  <span className="sm:w-[116px]">{label}</span>
                </span>
                <span className="sm:order-last sm:ml-auto">
                  <StatusWord word={st.word} text={st.text} />
                </span>
              </span>
              <span className="mt-1 block sm:mt-0 sm:flex-1 font-[family-name:var(--font-display)] text-[23px] font-medium leading-[1.25]">
                {title}
              </span>
            </>
          )
          return (
            <li key={row.id} className={i > 0 ? 'border-t border-[color:var(--color-line)]' : ''}>
              {st.linked ? (
                <Link href={hrefFor?.(row) ?? row.href} className={`${cls} hover:bg-[color:var(--color-wash)] editor-focus`}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
