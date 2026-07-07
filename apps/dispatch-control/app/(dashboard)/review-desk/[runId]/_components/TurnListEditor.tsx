'use client'
/**
 * Deliberation conversation turn-list editor (Phase 31 D-04, Plan 31-05 Task 1).
 *
 * Edits `selectionDeliberation.conversation[]` — an ordered list of
 * `{speaker, text}` turns produced by the Chronicler (Phase 13). Each row is
 * a speaker input + text textarea with Add/Delete/Move up/down controls,
 * mirroring BlockEditor's op set (no drag-and-drop library).
 *
 * Presentational only: calls `onChange(nextTurns)` on every edit; the parent
 * (SectionEditorPanel) owns dirty state and the save call.
 */
import type { DeliberationTurn } from '@/lib/contentPatchClient'

interface TurnListEditorProps {
  turns: DeliberationTurn[]
  onChange: (turns: DeliberationTurn[]) => void
}

const rowButtonClass =
  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

export default function TurnListEditor({ turns, onChange }: TurnListEditorProps) {
  function updateTurn(index: number, patch: Partial<DeliberationTurn>) {
    onChange(turns.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  function addTurnAfter(index: number) {
    const next = [...turns]
    next.splice(index + 1, 0, { speaker: '', text: '' })
    onChange(next)
  }

  function deleteTurn(index: number) {
    onChange(turns.filter((_, i) => i !== index))
  }

  function moveTurn(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= turns.length) return
    const next = [...turns]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {turns.length === 0 && (
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          No conversation turns yet.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {turns.map((turn, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-white p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <label className="flex flex-1 items-center gap-2 text-xs font-medium text-[color:var(--color-ink-soft)]">
                Speaker
                <input
                  type="text"
                  aria-label={`Turn ${index + 1} speaker`}
                  value={turn.speaker}
                  onChange={e => updateTurn(index, { speaker: e.target.value })}
                  className="min-h-[36px] flex-1 rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2 text-sm text-[color:var(--color-ink)]"
                />
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move turn ${index + 1} up`}
                  title="Move up"
                  className={rowButtonClass}
                  disabled={index === 0}
                  onClick={() => moveTurn(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move turn ${index + 1} down`}
                  title="Move down"
                  className={rowButtonClass}
                  disabled={index === turns.length - 1}
                  onClick={() => moveTurn(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Add turn after ${index + 1}`}
                  title="Add turn below"
                  className={rowButtonClass}
                  onClick={() => addTurnAfter(index)}
                >
                  + Add
                </button>
                <button
                  type="button"
                  aria-label={`Delete turn ${index + 1}`}
                  title="Delete"
                  className={rowButtonClass}
                  onClick={() => deleteTurn(index)}
                >
                  Delete
                </button>
              </div>
            </div>

            <textarea
              aria-label={`Turn ${index + 1} text`}
              value={turn.text}
              rows={3}
              onChange={e => updateTurn(index, { text: e.target.value })}
              className="min-h-[44px] w-full resize-y rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-2 text-sm text-[color:var(--color-ink)]"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addTurnAfter(turns.length - 1)}
        className="min-h-[44px] self-start rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
      >
        + Add turn
      </button>
    </div>
  )
}
