import type { StepVM } from '@/lib/editorState'
import { STATUS_WORDS } from '@/lib/nomenclature'
import StatusWord, { StatusMarker } from './StatusWord'

export default function StepList({ steps, footer, label }: { steps: StepVM[]; footer?: string | null; label: string }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-[26px] font-semibold">{label}</h2>
      <ol className="relative mt-4">
        <span aria-hidden="true" className="absolute left-[10px] top-4 bottom-4 w-[2px] bg-[color:var(--color-line-strong)]" />
        {steps.map((s) => {
          const def = STATUS_WORDS[s.word]
          return (
            <li key={s.key} className="relative flex gap-4 py-2">
              <StatusMarker marker={def.marker} size={22} fill="status" colorVar={def.colorVar} />
              <div>
                <p className="font-[family-name:var(--font-ui)] text-[17px] font-semibold">{s.name}</p>
                <StatusWord word={s.word} text={s.line} hideMarker />
              </div>
            </li>
          )
        })}
      </ol>
      {footer ? (
        <p className="mt-4 font-[family-name:var(--font-body)] text-[17px] text-[color:var(--color-ink-soft)]">{footer}</p>
      ) : null}
    </div>
  )
}
