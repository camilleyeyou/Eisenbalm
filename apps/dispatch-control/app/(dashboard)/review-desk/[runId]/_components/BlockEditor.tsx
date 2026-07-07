'use client'
/**
 * Long-read block-row editor (Phase 31 D-06, Plan 31-05 Task 1).
 *
 * Renders each `ContentBlock` (`{type, text}`) as an editable row with full
 * block ops: edit text, change type (paragraph/h2/h3/blockquote), add a
 * paragraph row below, delete, and reorder via up/down buttons (D-06 —
 * NO drag-and-drop library, locked no-drag decision).
 *
 * Presentational only: state is lifted to the parent (SectionEditorPanel,
 * Plan 05 Task 3), which owns dirty-state tracking. This component just
 * calls `onChange(nextBlocks)` with a new array on every edit.
 *
 * When `lossy` is true (a stored Portable Text block had markDefs or more
 * than one child span — see `pt_to_blocks` in API_CONTRACTS §31.7), a
 * visible banner warns the operator that saving here will flatten the
 * original rich formatting (inline links/marks) — not a silent data loss.
 */
import type { ContentBlock } from '@/lib/contentPatchClient'

export type Block = ContentBlock

const BLOCK_TYPES: Block['type'][] = ['paragraph', 'h2', 'h3', 'blockquote']

const BLOCK_TYPE_LABELS: Record<Block['type'], string> = {
  paragraph: 'Paragraph',
  h2: 'Heading (H2)',
  h3: 'Sub-heading (H3)',
  blockquote: 'Pull-quote',
}

interface BlockEditorProps {
  blocks: Block[]
  lossy?: boolean
  onChange: (blocks: Block[]) => void
}

const rowButtonClass =
  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

export default function BlockEditor({ blocks, lossy = false, onChange }: BlockEditorProps) {
  function updateBlock(index: number, patch: Partial<Block>) {
    const next = blocks.map((b, i) => (i === index ? { ...b, ...patch } : b))
    onChange(next)
  }

  function addBlockAfter(index: number) {
    const next = [...blocks]
    next.splice(index + 1, 0, { type: 'paragraph', text: '' })
    onChange(next)
  }

  function deleteBlock(index: number) {
    const next = blocks.filter((_, i) => i !== index)
    onChange(next)
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {lossy && (
        <p
          role="status"
          className="rounded-[2px] border border-[color:var(--color-marigold)] bg-[color:var(--color-card-alt)] px-3 py-2 text-xs text-[color:var(--color-marigold-text)]"
        >
          This section had rich formatting that the block editor can&apos;t fully
          represent — saving will flatten it.
        </p>
      )}

      {blocks.length === 0 && (
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          No content yet.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {blocks.map((block, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-white p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--color-ink-soft)]">
                Type
                <select
                  aria-label={`Block ${index + 1} type`}
                  value={block.type}
                  onChange={e =>
                    updateBlock(index, { type: e.target.value as Block['type'] })
                  }
                  className="min-h-[36px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-2 text-sm text-[color:var(--color-ink)]"
                >
                  {BLOCK_TYPES.map(t => (
                    <option key={t} value={t}>
                      {BLOCK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move block ${index + 1} up`}
                  title="Move up"
                  className={rowButtonClass}
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move block ${index + 1} down`}
                  title="Move down"
                  className={rowButtonClass}
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Add block after ${index + 1}`}
                  title="Add block below"
                  className={rowButtonClass}
                  onClick={() => addBlockAfter(index)}
                >
                  + Add
                </button>
                <button
                  type="button"
                  aria-label={`Delete block ${index + 1}`}
                  title="Delete"
                  className={rowButtonClass}
                  onClick={() => deleteBlock(index)}
                >
                  Delete
                </button>
              </div>
            </div>

            <textarea
              aria-label={`Block ${index + 1} text`}
              value={block.text}
              rows={block.type === 'paragraph' ? 4 : 2}
              onChange={e => updateBlock(index, { text: e.target.value })}
              className="min-h-[44px] w-full resize-y rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-2 text-sm text-[color:var(--color-ink)]"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addBlockAfter(blocks.length - 1)}
        className="min-h-[44px] self-start rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-2 font-[family-name:var(--font-ui)] text-[12px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
      >
        + Add block
      </button>
    </div>
  )
}
