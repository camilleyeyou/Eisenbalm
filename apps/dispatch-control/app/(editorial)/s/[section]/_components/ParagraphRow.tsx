'use client'
/**
 * Phase 56 -- one paragraph of the Section page. Read mode: click, pencil or
 * Enter/Space opens it. Edit mode: a labelled textarea with Save and Cancel.
 */
import { useEffect, useState, type KeyboardEvent, type Ref } from 'react'
import { COPY } from '@/lib/editorState'

interface ParagraphRowProps {
  /** 1-based number shown in the label ("Editing paragraph 3"). */
  number: number
  text: string
  editing: boolean
  readOnly: boolean
  saving: boolean
  error: string | null
  justSaved: boolean
  rowRef?: Ref<HTMLDivElement>
  onOpen: () => void
  onCancel: () => void
  onSave: (text: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export default function ParagraphRow({
  number,
  text,
  editing,
  readOnly,
  saving,
  error,
  justSaved,
  rowRef,
  onOpen,
  onCancel,
  onSave,
  onDirtyChange,
}: ParagraphRowProps) {
  const [value, setValue] = useState(text)
  const id = `paragraph-edit-${number}`

  useEffect(() => {
    if (editing) setValue(text)
  }, [editing, text])

  useEffect(() => {
    if (!editing) onDirtyChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) {
    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
      if (readOnly || e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen()
      }
    }
    return (
      <div
        ref={rowRef}
        tabIndex={0}
        role="group"
        aria-label={`Paragraph ${number}`}
        onKeyDown={onKeyDown}
        className="group relative -mx-3 px-3 py-2 pr-16 sm:pr-3 flex gap-4 hover:bg-[color:var(--color-wash)] focus-within:bg-[color:var(--color-wash)] editor-focus"
      >
        <div className="max-w-[720px] flex-1">
          <p
            onClick={readOnly ? undefined : onOpen}
            className="text-[18px] leading-[1.7] sm:leading-[1.75] text-[color:var(--color-ink)]"
            style={{ fontFamily: 'var(--font-lora)', margin: 0, cursor: readOnly ? 'default' : 'text' }}
          >
            {text}
          </p>
          {justSaved && (
            <span role="status" className="text-[15px] text-[color:var(--color-done)]">
              {COPY.saved}
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            aria-label="Edit this paragraph"
            onClick={onOpen}
            className="absolute right-0 top-0 sm:static h-12 w-12 shrink-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 editor-focus"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSave(value)
    }
  }

  return (
    <div ref={rowRef} className="-mx-3 px-3 py-2 max-w-[720px] flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {`Editing paragraph ${number}`}
      </label>
      <textarea
        id={id}
        autoFocus
        rows={6}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          onDirtyChange(e.target.value !== text)
        }}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (typeof e.currentTarget.scrollIntoView === 'function') {
            e.currentTarget.scrollIntoView({ block: 'center' })
          }
        }}
        className="w-full resize-y px-6 py-4 border-2 border-[color:var(--color-cobalt)] bg-[color:var(--color-card)] text-[18px] leading-[1.75] text-[color:var(--color-ink)]"
        style={{ fontFamily: 'var(--font-lora)' }}
      />
      <p className="text-[15px] text-[color:var(--color-ink-soft)]" style={{ margin: 0 }}>
        {COPY.editReassurance}
      </p>
      {error && (
        <p role="alert" className="text-[15px] font-semibold text-[color:var(--color-problem)]" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(value)}
          className="min-h-[48px] px-6 bg-[color:var(--color-cobalt)] text-[color:var(--color-card)] text-[17px] font-semibold editor-focus"
        >
          Save
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="min-h-[48px] px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] text-[17px] font-semibold editor-focus"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
