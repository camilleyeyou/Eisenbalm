'use client'
/**
 * Phase 56 -- the Section page's paragraph list. One paragraph is open at a
 * time. Save goes through patchSection (patchBonus for the bonus part) with the
 * revision id read fresh at call time.
 */
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  patchSection,
  patchBonus,
  ContentPatchError,
  type ContentBlock,
  type BonusPatchPayload,
} from '@/lib/contentPatchClient'
import { COPY } from '@/lib/editorState'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import ParagraphRow from './ParagraphRow'

interface SectionArticleProps {
  runId: string
  sectionId: string
  blocks: ContentBlock[]
  getRevisionId: () => string
  readOnly: boolean
  onSaved: () => Promise<void> | void
  bonusBody?: (blocks: ContentBlock[]) => BonusPatchPayload
}

export default function SectionArticle({
  runId,
  sectionId,
  blocks,
  getRevisionId,
  readOnly,
  onSaved,
  bonusBody,
}: SectionArticleProps) {
  const { getToken } = useAuth()
  const confirm = useConfirm()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIndex, setSavedIndex] = useState<number | null>(null)
  const rows = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function focusRow(i: number) {
    setTimeout(() => rows.current.get(i)?.focus(), 0)
  }

  async function open(i: number) {
    if (readOnly || i === openIndex) return
    if (openIndex !== null && dirty) {
      const ok = await confirm({
        title: COPY.discardTitle,
        body: COPY.discardBody,
        confirmLabel: COPY.discardConfirm,
        cancelLabel: COPY.discardCancel,
      })
      if (!ok) return
    }
    setError(null)
    setDirty(false)
    setOpenIndex(i)
  }

  function cancel() {
    const i = openIndex
    setOpenIndex(null)
    setError(null)
    setDirty(false)
    if (i !== null) focusRow(i)
  }

  async function save(text: string) {
    if (openIndex === null || saving) return
    const i = openIndex
    setSaving(true)
    setError(null)
    const next = blocks.map((b, idx) => (idx === i ? { ...b, text } : b))
    try {
      const token = await getToken()
      if (sectionId === 'bonus') {
        await patchBonus(
          runId,
          bonusBody ? bonusBody(next) : { ifRevisionID: getRevisionId(), body: next },
          token,
        )
      } else {
        await patchSection(runId, sectionId, { ifRevisionID: getRevisionId(), blocks: next }, token)
      }
      await onSaved()
      setOpenIndex(null)
      setDirty(false)
      setSavedIndex(i)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setSavedIndex(null), 3000)
      focusRow(i)
    } catch (e) {
      setError(COPY.saveFailed)
      if (e instanceof ContentPatchError && e.reason === 'revision_mismatch') {
        try {
          await onSaved()
        } catch {
          /* keep the words in the box regardless */
        }
      }
    } finally {
      setSaving(false)
    }
  }

  let n = 0
  return (
    <article className="flex flex-col gap-2">
      {blocks.map((b, i) => {
        if (b.type === 'h2' || b.type === 'h3') {
          const H = b.type
          return (
            <H key={i} className="max-w-[720px] text-[23px] font-semibold" style={{ fontFamily: 'var(--font-lora)' }}>
              {b.text}
            </H>
          )
        }
        n += 1
        return (
          <ParagraphRow
            key={i}
            number={n}
            text={b.text}
            editing={openIndex === i}
            readOnly={readOnly}
            saving={saving}
            error={openIndex === i ? error : null}
            justSaved={savedIndex === i}
            rowRef={(el) => {
              rows.current.set(i, el)
            }}
            onOpen={() => void open(i)}
            onCancel={cancel}
            onSave={(t) => void save(t)}
            onDirtyChange={setDirty}
          />
        )
      })}
    </article>
  )
}
