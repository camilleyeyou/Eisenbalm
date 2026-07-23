'use client'
/**
 * Phase 24 (PRM-04) — side-by-side two-column DiffViewer.
 *
 * Computes a line-level diff with `diffLines` (diff v9) and renders two parallel
 * columns (24-RESEARCH Pattern 4):
 *   - removed lines → LEFT cell populated, RIGHT cell empty
 *   - added lines   → LEFT cell empty,     RIGHT cell populated
 *   - context lines → BOTH cells populated
 *
 * Each column carries a `data-side="left"|"right"` attribute (the DiffViewer
 * scaffold test asserts both sides exist and that removed/added text lands in
 * the correct column). Per-line type drives the background tint:
 *   removed = red, added = green, context = neutral.
 *
 * quick 260722-tv1: the split-diff root gains `max-h-[480px]` — it already
 * carried `overflow-auto` but no height cap, so a large diff ran unbounded
 * instead of engaging its own vertical scroll.
 */
import { diffLines, type Change } from 'diff'

interface DiffViewerProps {
  left: { label: string; content: string }
  right: { label: string; content: string }
}

type LeftLine = { text: string; type: 'removed' | 'context' | 'empty' }
type RightLine = { text: string; type: 'added' | 'context' | 'empty' }

/**
 * Split a Change.value into its constituent lines. `diffLines` chunks keep their
 * trailing newline, so a value like "a\nb\n" splits into ["a", "b", ""]; drop
 * the trailing empty element produced by that final newline.
 */
function toLines(value: string): string[] {
  const parts = value.split('\n')
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
  return parts
}

function DiffColumn({
  label,
  lines,
  side,
}: {
  label: string
  lines: Array<LeftLine | RightLine>
  side: 'left' | 'right'
}) {
  return (
    <div data-side={side} className="min-w-0">
      <div className="sticky top-0 border-b border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-600">
        {label}
      </div>
      <div>
        {lines.map((line, i) => {
          const bg =
            line.type === 'removed'
              ? 'bg-red-50 text-red-900'
              : line.type === 'added'
                ? 'bg-green-50 text-green-900'
                : line.type === 'empty'
                  ? 'bg-neutral-50'
                  : 'text-neutral-700'
          return (
            <div
              key={i}
              className={`whitespace-pre-wrap break-words px-2 py-0.5 ${bg}`}
            >
              {line.text === '' ? ' ' : line.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DiffViewer({ left, right }: DiffViewerProps) {
  const changes: Change[] = diffLines(left.content, right.content)

  const leftLines: LeftLine[] = []
  const rightLines: RightLine[] = []

  for (const change of changes) {
    const lines = toLines(change.value)
    if (change.removed) {
      for (const l of lines) {
        leftLines.push({ text: l, type: 'removed' })
        rightLines.push({ text: '', type: 'empty' })
      }
    } else if (change.added) {
      for (const l of lines) {
        leftLines.push({ text: '', type: 'empty' })
        rightLines.push({ text: l, type: 'added' })
      }
    } else {
      for (const l of lines) {
        leftLines.push({ text: l, type: 'context' })
        rightLines.push({ text: l, type: 'context' })
      }
    }
  }

  return (
    <div className="grid max-h-[480px] grid-cols-2 divide-x divide-neutral-200 overflow-auto rounded border border-neutral-200 font-mono text-xs">
      <DiffColumn label={left.label} lines={leftLines} side="left" />
      <DiffColumn label={right.label} lines={rightLines} side="right" />
    </div>
  )
}

export default DiffViewer
