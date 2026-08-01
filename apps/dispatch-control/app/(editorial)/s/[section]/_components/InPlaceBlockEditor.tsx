'use client'
/**
 * Phase 51 (READ-05, D-18/D-19) -- the section-reader's in-place block
 * editor. A controlled `<textarea>`, not `contenteditable` (UI-SPEC locks
 * this, matching the review-desk long-read block editor's existing
 * precedent) -- avoids cross-browser selection/paste inconsistency and
 * keeps the Save-edit/Cancel-edit dirty-state model trivial to implement
 * correctly.
 *
 * Text only (D-18): no block-type selector, no add/delete/reorder control
 * exists anywhere in this component -- the block's existing `type` is
 * preserved verbatim on save. This is deliberately NOT the review-desk's
 * full block-ops editor; it is the one flagged block's text, nothing more.
 *
 * Pitfall 5: `bonus` is NOT in `patchSection`'s four-value allow-list
 * (docs/API_CONTRACTS.md:2619) -- saving the bonus section MUST branch to
 * `patchBonus`, never `patchSection`.
 *
 * The 409 copy below is locked by 51-UI-SPEC.md's Copywriting Contract --
 * reproduced byte-for-byte, em dash included.
 */
import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  patchSection,
  patchBonus,
  ContentPatchError,
  type ContentBlock,
} from '@/lib/contentPatchClient'

const actionButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: '4px 10px',
  marginRight: 6,
  border: '1px solid var(--color-faint)',
  borderRadius: 2,
  background: 'white',
  color: 'var(--color-ink)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  cursor: 'pointer',
}

interface InPlaceBlockEditorProps {
  runId: string
  sectionId: string
  /** The current section's full block array -- copied and only the one
   * `blockIndex` entry's `text` is replaced on save; every other block
   * (and every block's `type`) travels through unchanged. */
  blocks: ContentBlock[]
  blockIndex: number
  /** Read fresh at Save-time from the caller's live `draft.revisionId` --
   * never captured once, so a retry after a 409 automatically uses the
   * freshly-reloaded revision. */
  revisionId: string
  reloadDraft: () => Promise<void> | void
  onClose: () => void
  /** True when `blockIndex` is a fallback default (no findingId reached
   * this editor, or the finding's span never resolved) rather than a
   * resolved target -- say so plainly rather than guessing silently. */
  isFallbackBlock?: boolean
}

export default function InPlaceBlockEditor({
  runId,
  sectionId,
  blocks,
  blockIndex,
  revisionId,
  reloadDraft,
  onClose,
  isFallbackBlock,
}: InPlaceBlockEditorProps) {
  const { getToken } = useAuth()
  const original = blocks[blockIndex]?.text ?? ''
  const [value, setValue] = useState(original)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const dirty = value !== original

  function handleCancel() {
    setNote(null)
    onClose()
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setNote(null)
    const nextBlocks = blocks.map((b, i) => (i === blockIndex ? { ...b, text: value } : b))
    try {
      if (sectionId === 'bonus') {
        // Pitfall 5: `bonus` is NOT in patchSection's four-value allow-list.
        await patchBonus(runId, { ifRevisionID: revisionId, body: nextBlocks }, await getToken())
      } else {
        await patchSection(
          runId,
          sectionId,
          { ifRevisionID: revisionId, blocks: nextBlocks },
          await getToken(),
        )
      }
      await reloadDraft()
      onClose()
    } catch (e) {
      if (e instanceof ContentPatchError && e.reason === 'revision_mismatch') {
        await reloadDraft()
        setNote('This passage changed since you started editing — reload and try again.')
      } else {
        setNote(e instanceof Error ? e.message : 'Save failed.')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
  }

  return (
    <div className="section-reader-inline-editor" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {isFallbackBlock && (
        <p
          className="galley-body"
          style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-ink-soft)', margin: 0 }}
        >
          Opened the first paragraph of this section — use "Edit myself" on a specific finding for a
          precise target.
        </p>
      )}
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {dirty && (
          <span
            aria-label="Unsaved changes"
            title="Unsaved changes"
            style={{
              height: 8,
              width: 8,
              marginTop: 18,
              borderRadius: '50%',
              background: 'var(--color-vermilion)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
        )}
        <textarea
          aria-label={`Edit ${sectionId} passage`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            minHeight: 44,
            width: '100%',
            resize: 'vertical',
            border: '1px solid var(--color-faint)',
            borderRadius: 2,
            background: 'var(--color-card)',
            padding: '8px 10px',
            fontFamily: 'var(--font-lora)',
            fontSize: 16.5,
            lineHeight: 1.7,
            color: 'var(--color-ink)',
          }}
        />
      </span>
      <span style={{ display: 'block' }}>
        <button type="button" style={actionButtonStyle} disabled={saving} onClick={() => void handleSave()}>
          Save edit
        </button>
        <button type="button" style={actionButtonStyle} disabled={saving} onClick={handleCancel}>
          Cancel edit
        </button>
      </span>
      {note && (
        <span role="status" style={{ display: 'block', fontSize: 11 }}>
          {note}
        </span>
      )}
    </div>
  )
}
