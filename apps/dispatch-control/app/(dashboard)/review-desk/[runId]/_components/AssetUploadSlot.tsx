'use client'
/**
 * Inline asset upload slot (Phase 31 EDT-03, D-11/D-12/D-13, Plan 31-05 Task 2).
 *
 * Lives inline inside the owning section's editor (podcast audio in the
 * podcast editor, Suno audio in the jingle bonus editor, storyboard images
 * in the bigBudget bonus editor — D-11, no separate assets screen).
 *
 * Flow:
 *   1. File input (accept scoped to `kind`).
 *   2. If a `currentAssetUrl` already exists, selecting a new file shows an
 *      inline overwrite-confirm panel BEFORE uploading (D-12) — the old
 *      asset stays in Sanity, only the slot's reference is swapped.
 *   3. Calls `uploadAsset(runId, slot, file, {...}, token)` immediately —
 *      asset uploads save on their own, independent of the section's
 *      explicit-save harness (D-11).
 *   4. On success, renders an inline preview from the returned CDN
 *      `assetUrl` — native `<audio>` for audio, `<img>` thumbnail for images
 *      (D-13) — and calls `onUploaded(result)` so the parent panel can
 *      refresh `currentRevisionId`.
 */
import { useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { uploadAsset, ContentPatchError, type UploadAssetResult } from '@/lib/contentPatchClient'

interface AssetUploadSlotProps {
  runId: string
  slot: string
  kind: 'audio' | 'image'
  currentAssetUrl?: string
  ifRevisionID: string
  onUploaded: (result: UploadAssetResult) => void
}

export default function AssetUploadSlot({
  runId,
  slot,
  kind,
  currentAssetUrl,
  ifRevisionID,
  onUploaded,
}: AssetUploadSlotProps) {
  const { getToken } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentAssetUrl)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (previewUrl) {
      // D-12: existing asset — require confirmation before overwriting.
      setPendingFile(file)
    } else {
      void doUpload(file)
    }
  }

  async function doUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const token = await getToken()
      const result = await uploadAsset(
        runId,
        slot,
        file,
        { filename: file.name, contentType: file.type || 'application/octet-stream', ifRevisionID },
        token,
      )
      setPreviewUrl(result.assetUrl)
      setPendingFile(null)
      onUploaded(result)
    } catch (e) {
      setError(
        e instanceof ContentPatchError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Upload failed.',
      )
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function confirmOverwrite() {
    if (pendingFile) void doUpload(pendingFile)
  }

  function cancelOverwrite() {
    setPendingFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-white p-3">
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'audio' ? 'audio/*' : 'image/*'}
        aria-label={`Upload ${slot}`}
        onChange={handleFileSelect}
        disabled={uploading}
        className="text-sm text-[color:var(--color-ink)]"
      />

      {uploading && (
        <p className="text-xs text-[color:var(--color-ink-soft)]">Uploading…</p>
      )}

      {pendingFile && !uploading && (
        <div className="flex flex-col gap-2 border border-[color:var(--color-marigold)] bg-[color:var(--color-card-alt)] p-2">
          <p className="text-xs text-[color:var(--color-marigold-text)]">
            Replace the existing asset? The current file stays in Sanity, but
            this slot will point to the new one.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmOverwrite}
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[.04em] text-white"
            >
              Confirm replace
            </button>
            <button
              type="button"
              onClick={cancelOverwrite}
              className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {previewUrl && !pendingFile && (
        <div className="pt-1">
          {kind === 'audio' ? (
            <audio controls src={previewUrl} className="w-full" />
          ) : (
            <img src={previewUrl} alt={`${slot} preview`} className="max-h-40 w-auto" />
          )}
        </div>
      )}
    </div>
  )
}
