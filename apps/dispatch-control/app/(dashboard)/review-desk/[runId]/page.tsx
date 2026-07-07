'use client'
/**
 * Review Desk editor shell (Phase 31 D-02, Plan 31-04 Task 2).
 *
 * Two-pane layout: LEFT = SectionChipList (jump-nav over the editable
 * surfaces), RIGHT = the selected section's editor slot (Plan 05 fills in
 * the real editors — this plan renders a "Select a section" placeholder) plus
 * a toggleable reused PreviewIframe (D-02) for reader-fidelity checks.
 *
 * Data: fetches the draft via getDraft(runId, token) from contentPatchClient
 * (token from useAuth().getToken()). The signed preview URL is resolved via a
 * tiny server Route Handler (app/api/review-desk/[runId]/preview-url) since
 * lib/previewToken.ts is server-only (PREVIEW_SECRET + node:crypto) and this
 * page is a Client Component (it owns selectedSection state).
 *
 * §31.9 rerun-clobber ordering rule: a static advisory note is shown near the
 * header — re-rolling a section after an operator edit overwrites the console
 * change (rerun rebuilds from the LangGraph checkpoint and calls the full
 * write_issue_draft). v1 position: documented ordering rule, not a code guard.
 */
import { use, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import SectionChipList, { EDITABLE_SECTIONS } from './_components/SectionChipList'
import SectionEditorPanel from './_components/SectionEditorPanel'
import PreviewIframe from '../../run-monitor/runs/[runId]/review/_components/PreviewIframe'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'

interface ReviewDeskRunPageProps {
  params: Promise<{ runId: string }>
}

export default function ReviewDeskRunPage({ params }: ReviewDeskRunPageProps) {
  const { runId: rawRunId } = use(params)
  const runId = decodeURIComponent(rawRunId)

  const { getToken } = useAuth()

  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedSection, setSelectedSection] = useState<string>(
    EDITABLE_SECTIONS[0]?.id ?? 'originStory',
  )

  // D-07 dirty-state map, bubbled up from SectionEditorPanel so the
  // section-chip list can paint the unsaved dot and in-app nav can guard
  // against silently discarding unsaved edits when switching sections.
  const [dirty, setDirty] = useState<Record<string, boolean>>({})

  function handleSelectSection(id: string) {
    if (
      dirty[selectedSection] &&
      !window.confirm(
        'You have unsaved changes in this section. Switch sections anyway? Unsaved edits will be lost.',
      )
    ) {
      return
    }
    setSelectedSection(id)
  }

  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = await getToken()
        const result = await getDraft(runId, token)
        if (!cancelled) setDraft(result)
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof ContentPatchError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Failed to load draft.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [runId, getToken])

  useEffect(() => {
    if (!showPreview || previewUrl) return
    let cancelled = false
    async function loadPreview() {
      try {
        const res = await fetch(`/api/review-desk/${encodeURIComponent(runId)}/preview-url`)
        const body = await res.json()
        if (!cancelled) setPreviewUrl(body.previewUrl ?? null)
      } catch {
        if (!cancelled) setPreviewUrl(null)
      }
    }
    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [showPreview, previewUrl, runId])

  const selectedLabel =
    EDITABLE_SECTIONS.find(s => s.id === selectedSection)?.label ?? selectedSection

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      {/* Header + rerun-clobber advisory (§31.9) */}
      <div className="flex flex-col gap-1 border-b border-[color:var(--color-faint)] pb-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
          Review Desk — Run {runId}
        </h1>
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          Re-roll a section before editing — re-rolling after an edit
          overwrites console changes here.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-[color:var(--color-ink-soft)]">Loading draft…</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          {/* LEFT — section-chip jump-nav */}
          <div className="w-full shrink-0 lg:w-64">
            <SectionChipList
              sections={EDITABLE_SECTIONS}
              selected={selectedSection}
              onSelect={handleSelectSection}
              dirty={dirty}
            />
          </div>

          {/* RIGHT — editor slot + toggleable preview */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]">
                {selectedLabel}
              </h2>
              <button
                type="button"
                onClick={() => setShowPreview(v => !v)}
                className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
              >
                {showPreview ? 'Hide preview' : 'Show preview'}
              </button>
            </div>

            {!showPreview ? (
              draft ? (
                <SectionEditorPanel
                  runId={runId}
                  selectedSection={selectedSection}
                  draft={draft}
                  onDirtyChange={setDirty}
                />
              ) : (
                <div className="flex min-h-[300px] flex-1 items-center justify-center border border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8">
                  <p className="text-sm text-[color:var(--color-ink-soft)]">
                    Loading draft…
                  </p>
                </div>
              )
            ) : previewUrl ? (
              <div className="min-h-[500px] flex-1">
                <PreviewIframe previewUrl={previewUrl} />
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-1 items-center justify-center border border-dashed border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-8">
                <p className="text-sm text-[color:var(--color-ink-soft)]">
                  Preview unavailable.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
