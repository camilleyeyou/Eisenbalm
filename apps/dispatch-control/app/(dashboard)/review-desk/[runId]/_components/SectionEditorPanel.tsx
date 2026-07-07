'use client'
/**
 * Section editor dispatch + save/dirty/unsaved-nav/409 harness (Phase 31
 * D-07/D-10, Plan 31-05 Task 3).
 *
 * Given the loaded draft, dispatches the right editor for `selectedSection`
 * (BlockEditor for the 4 long-reads + specAd bonus, StructuredFieldEditor's
 * sub-editors for theme/game/pdf/bonus, TurnListEditor for the deliberation
 * conversation, a plain textarea for the podcast transcript, AssetUploadSlot
 * for asset fields) and owns the explicit-save harness:
 *
 *   - A local working copy of every editable field, diffed against the last
 *     loaded/saved snapshot to compute a per-section `dirty` map (D-07).
 *   - An explicit Save button per section, disabled when that section isn't
 *     dirty; on click, calls the matching contentPatchClient fn(s) with the
 *     current `ifRevisionID`, chaining the returned `revisionId` across
 *     multiple patch calls within one Save (a long-read section patches both
 *     its headline and body; problemStatement additionally patches its PDF
 *     data points).
 *   - On `ContentPatchError('revision_mismatch')` (D-10): shows a
 *     reload-and-reapply prompt — reloading replaces any unsaved edits with
 *     the latest saved draft.
 *   - On `ContentPatchError('validation_failed')`: surfaces `fields[]`
 *     inline (theme hex/font, game embed size).
 *   - A `beforeunload` handler warns before closing/navigating away with any
 *     section dirty; `onDirtyChange` bubbles the dirty map up to the parent
 *     page so it can guard the section-chip nav and paint the unsaved dot.
 */
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  getDraft,
  patchHeadline,
  patchSection,
  patchPdfDataPoints,
  patchBonus,
  patchGame,
  patchDeliberationConversation,
  patchPodcastTranscript,
  patchTheme,
  ContentPatchError,
  type ContentBlock,
  type DeliberationTurn,
  type DraftResponse,
  type KeyDataPoint,
  type BonusPatchPayload,
  type UploadAssetResult,
} from '@/lib/contentPatchClient'
import BlockEditor from './BlockEditor'
import TurnListEditor from './TurnListEditor'
import AssetUploadSlot from './AssetUploadSlot'
import {
  HeadlineEditor,
  ThemeEditor,
  GameEditor,
  PdfDataPointsEditor,
  BonusEditor,
  type ThemeFields,
  type GameFields,
  type PdfFields,
  type BonusFields,
} from './StructuredFieldEditor'

const LONG_READ_SECTIONS = ['originStory', 'problemStatement', 'founderBio', 'caseStudy']

interface LongReadWorking {
  headline: string
  blocks: ContentBlock[]
  lossy: boolean
}

interface WorkingState {
  longReads: Record<string, LongReadWorking>
  pdf: PdfFields
  bonus: BonusFields
  bonusType: 'specAd' | 'bigBudget' | 'jingle'
  game: GameFields
  theme: ThemeFields
  conversation: DeliberationTurn[]
  podcastTranscript: string
  podcastAudioUrl?: string
}

/** Best-effort coercion — see 31-05-SUMMARY.md "Known follow-ups" for the
 * upstream `get_issue_draft()` gaps this defends against (bonus.body isn't
 * run through pt_to_blocks server-side yet). */
function coerceBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is ContentBlock =>
      v && typeof v === 'object' && typeof v.type === 'string' && typeof v.text === 'string',
  )
}

function blankKeyDataPoints(): KeyDataPoint[] {
  return [
    { stat: '', source: '' },
    { stat: '', source: '' },
    { stat: '', source: '' },
  ]
}

function buildWorkingState(draft: DraftResponse): WorkingState {
  const longReads: Record<string, LongReadWorking> = {}
  for (const name of LONG_READ_SECTIONS) {
    const sec = draft.sections?.[name]
    longReads[name] = {
      headline: sec?.headline ?? '',
      blocks: sec?.blocks ?? [],
      lossy: Boolean(sec?.lossy),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTheme = (draft.theme ?? {}) as Record<string, any>
  const theme: ThemeFields = {
    primaryColor: rawTheme.primaryColor ?? '',
    accentColor: rawTheme.accentColor ?? '',
    backgroundColor: rawTheme.backgroundColor ?? '',
    textColor: rawTheme.textColor ?? '',
    fontDisplay: rawTheme.fontDisplay ?? 'Newsreader',
    fontBody: rawTheme.fontBody ?? 'Newsreader',
    visualDirection: rawTheme.visualDirection ?? '',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawGame = (draft.game ?? {}) as Record<string, any>
  const game: GameFields = {
    headline: rawGame.headline ?? '',
    description: rawGame.description ?? '',
    embedCode: rawGame.embedCode ?? '',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBonus = (draft.bonus ?? {}) as Record<string, any>
  const bonus: BonusFields = {
    headline: rawBonus.headline ?? '',
    body: coerceBlocks(rawBonus.body),
    lossy: Boolean(rawBonus.bodyLossy),
    lyrics: rawBonus.lyrics ?? '',
    sunoPrompt: rawBonus.sunoPrompt ?? '',
    sunoAudioUrl: rawBonus.sunoAudioUrl,
    storyboards: Array.isArray(rawBonus.storyboards)
      ? rawBonus.storyboards.map((s: unknown) => {
          const entry = s as { url?: string; asset?: { url?: string } } | undefined
          return { url: entry?.url ?? entry?.asset?.url }
        })
      : [],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPodcast = (draft.podcast ?? {}) as Record<string, any>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPdf = ((draft.sections?.problemStatement as any)?.pdfContent ?? {}) as Record<string, any>
  const pdf: PdfFields = {
    problemStatement: rawPdf.problemStatement ?? '',
    keyDataPoints:
      Array.isArray(rawPdf.keyDataPoints) && rawPdf.keyDataPoints.length === 3
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rawPdf.keyDataPoints.map((r: any) => ({ stat: r?.stat ?? '', source: r?.source ?? '' }))
        : blankKeyDataPoints(),
    interventionMechanism: rawPdf.interventionMechanism ?? '',
  }

  return {
    longReads,
    pdf,
    bonus,
    bonusType: draft.bonusType,
    game,
    theme,
    conversation: draft.conversation ?? [],
    podcastTranscript: rawPodcast.deliberationTranscript ?? '',
    podcastAudioUrl: rawPodcast.audioFile?.asset?.url ?? rawPodcast.audioFile?.url,
  }
}

/** Section slice used for dirty diffing — JSON-stable subset of WorkingState. */
function sectionSlice(section: string, state: WorkingState): unknown {
  if (LONG_READ_SECTIONS.includes(section)) {
    return section === 'problemStatement'
      ? { longRead: state.longReads[section]!, pdf: state.pdf }
      : { longRead: state.longReads[section]! }
  }
  switch (section) {
    case 'bonus':
      return { headline: state.bonus.headline, body: state.bonus.body, lyrics: state.bonus.lyrics, sunoPrompt: state.bonus.sunoPrompt }
    case 'game':
      return state.game
    case 'deliberation-conversation':
      return state.conversation
    case 'podcast':
      return state.podcastTranscript
    case 'theme':
      return state.theme
    default:
      return null
  }
}

function isDirty(section: string, working: WorkingState, loaded: WorkingState): boolean {
  return JSON.stringify(sectionSlice(section, working)) !== JSON.stringify(sectionSlice(section, loaded))
}

interface SectionEditorPanelProps {
  runId: string
  selectedSection: string
  draft: DraftResponse
  onDirtyChange?: (dirty: Record<string, boolean>) => void
}

export default function SectionEditorPanel({
  runId,
  selectedSection,
  draft,
  onDirtyChange,
}: SectionEditorPanelProps) {
  const { getToken } = useAuth()

  const [working, setWorking] = useState<WorkingState>(() => buildWorkingState(draft))
  const [loaded, setLoaded] = useState<WorkingState>(() => buildWorkingState(draft))
  const [revisionId, setRevisionId] = useState(draft.revisionId)

  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saveError, setSaveError] = useState<Record<string, string | null>>({})
  const [warnings, setWarnings] = useState<Record<string, string[]>>({})
  const [fieldErrors, setFieldErrors] = useState<string[] | undefined>(undefined)
  const [mismatchSection, setMismatchSection] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)

  const dirtyMap = useMemo(() => {
    const ids = [...LONG_READ_SECTIONS, 'bonus', 'game', 'deliberation-conversation', 'podcast', 'theme']
    const out: Record<string, boolean> = {}
    for (const id of ids) out[id] = isDirty(id, working, loaded)
    return out
  }, [working, loaded])

  const anyDirty = Object.values(dirtyMap).some(Boolean)

  useEffect(() => {
    onDirtyChange?.(dirtyMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyMap])

  // D-07 unsaved-changes warning on browser close/refresh/navigation away.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!anyDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [anyDirty])

  async function reloadDraft() {
    setReloading(true)
    try {
      const token = await getToken()
      const fresh = await getDraft(runId, token)
      const state = buildWorkingState(fresh)
      setWorking(state)
      setLoaded(state)
      setRevisionId(fresh.revisionId)
      setMismatchSection(null)
      setSaveError({})
    } catch (e) {
      setSaveError(prev => ({
        ...prev,
        [mismatchSection ?? selectedSection]: e instanceof Error ? e.message : 'Reload failed.',
      }))
    } finally {
      setReloading(false)
    }
  }

  async function saveSection(section: string) {
    setSaving(prev => ({ ...prev, [section]: true }))
    setSaveError(prev => ({ ...prev, [section]: null }))
    setFieldErrors(undefined)

    let revId = revisionId
    const collectedWarnings: string[] = []

    async function step<T extends { revisionId: string; warnings?: string[] }>(fn: (rev: string) => Promise<T>) {
      const result = await fn(revId)
      revId = result.revisionId
      if (result.warnings?.length) collectedWarnings.push(...result.warnings)
    }

    try {
      const token = await getToken()

      if (LONG_READ_SECTIONS.includes(section)) {
        const lr = working.longReads[section]!
        await step(rev => patchHeadline(runId, section, { ifRevisionID: rev, headline: lr.headline }, token))
        await step(rev => patchSection(runId, section, { ifRevisionID: rev, blocks: lr.blocks }, token))
        if (section === 'problemStatement') {
          const pdfDirty = JSON.stringify(working.pdf) !== JSON.stringify(loaded.pdf)
          if (pdfDirty) {
            await step(rev =>
              patchPdfDataPoints(
                runId,
                {
                  ifRevisionID: rev,
                  problemStatement: working.pdf.problemStatement,
                  keyDataPoints: working.pdf.keyDataPoints,
                  interventionMechanism: working.pdf.interventionMechanism,
                },
                token,
              ),
            )
          }
        }
      } else if (section === 'bonus') {
        const bonusBodyDirty = JSON.stringify(working.bonus.body) !== JSON.stringify(loaded.bonus.body)
        const payload: BonusPatchPayload = {
          ifRevisionID: revId,
          variant: working.bonusType,
          headline: working.bonus.headline,
        }
        if (working.bonusType === 'specAd' && bonusBodyDirty) payload.blocks = working.bonus.body
        if (working.bonusType === 'jingle') {
          payload.lyrics = working.bonus.lyrics
          payload.sunoPrompt = working.bonus.sunoPrompt
        }
        await step(rev => patchBonus(runId, { ...payload, ifRevisionID: rev }, token))
      } else if (section === 'game') {
        await step(rev =>
          patchGame(
            runId,
            { ifRevisionID: rev, headline: working.game.headline, description: working.game.description, embedCode: working.game.embedCode },
            token,
          ),
        )
      } else if (section === 'deliberation-conversation') {
        await step(rev => patchDeliberationConversation(runId, { ifRevisionID: rev, turns: working.conversation }, token))
      } else if (section === 'podcast') {
        await step(rev => patchPodcastTranscript(runId, { ifRevisionID: rev, transcript: working.podcastTranscript }, token))
      } else if (section === 'theme') {
        await step(rev => patchTheme(runId, { ifRevisionID: rev, ...working.theme }, token))
      }

      setRevisionId(revId)
      setLoaded(prev => ({ ...prev, ...structuredCloneSection(section, working) }))
      setWarnings(prev => {
        const next = { ...prev }
        if (collectedWarnings.length) next[section] = collectedWarnings
        else delete next[section]
        return next
      })
    } catch (e) {
      if (e instanceof ContentPatchError && e.reason === 'revision_mismatch') {
        // D-10: reload-and-reapply — the operator's unsaved edits in every
        // section are preserved until they explicitly choose to reload.
        setMismatchSection(section)
      } else if (e instanceof ContentPatchError && e.reason === 'validation_failed') {
        setFieldErrors(e.fields)
        setSaveError(prev => ({ ...prev, [section]: e.message }))
      } else {
        setSaveError(prev => ({
          ...prev,
          [section]: e instanceof Error ? e.message : 'Save failed.',
        }))
      }
    } finally {
      setSaving(prev => ({ ...prev, [section]: false }))
    }
  }

  function structuredCloneSection(section: string, source: WorkingState): Partial<WorkingState> {
    if (LONG_READ_SECTIONS.includes(section)) {
      const patch: Partial<WorkingState> = {
        longReads: { ...loaded.longReads, [section]: source.longReads[section]! },
      }
      if (section === 'problemStatement') patch.pdf = source.pdf
      return patch
    }
    switch (section) {
      case 'bonus':
        return { bonus: source.bonus }
      case 'game':
        return { game: source.game }
      case 'deliberation-conversation':
        return { conversation: source.conversation }
      case 'podcast':
        return { podcastTranscript: source.podcastTranscript }
      case 'theme':
        return { theme: source.theme }
      default:
        return {}
    }
  }

  function onAssetUploaded(section: string, result: UploadAssetResult) {
    setRevisionId(result.revisionId)
    if (section === 'podcast') {
      setWorking(prev => ({ ...prev, podcastAudioUrl: result.assetUrl }))
      setLoaded(prev => ({ ...prev, podcastAudioUrl: result.assetUrl }))
    }
  }

  const dirty = dirtyMap[selectedSection] ?? false
  const isSaving = Boolean(saving[selectedSection])
  const error = saveError[selectedSection]
  const sectionWarnings = warnings[selectedSection]

  function SaveBar() {
    return (
      <div className="flex flex-col gap-2 border-t border-[color:var(--color-faint)] pt-3">
        {mismatchSection === selectedSection && (
          <div className="flex flex-col gap-2 border border-[color:var(--color-vermilion)] bg-[color:var(--color-card-alt)] p-3">
            <p className="text-xs text-[color:var(--color-vermilion)]">
              This section changed since you loaded it. Reload and reapply your
              edit — reloading will replace your unsaved edits with the latest
              saved version.
            </p>
            <button
              type="button"
              onClick={() => void reloadDraft()}
              disabled={reloading}
              className="min-h-[44px] self-start rounded-[2px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[.04em] text-white disabled:opacity-50"
            >
              {reloading ? 'Reloading…' : 'Reload and reapply'}
            </button>
          </div>
        )}

        {sectionWarnings && sectionWarnings.length > 0 && (
          <ul className="flex flex-col gap-1 border border-[color:var(--color-marigold)] bg-[color:var(--color-card-alt)] p-2 text-xs text-[color:var(--color-marigold-text)]">
            {sectionWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-xs text-[color:var(--color-vermilion)]">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void saveSection(selectedSection)}
            disabled={!dirty || isSaving}
            className="min-h-[44px] rounded-[2px] border border-[color:var(--color-cobalt)] bg-[color:var(--color-cobalt)] px-4 py-2 font-[family-name:var(--font-ui)] text-[12px] font-semibold uppercase tracking-[.04em] text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {dirty && !isSaving && (
            <span className="text-xs text-[color:var(--color-ink-soft)]">Unsaved changes</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {LONG_READ_SECTIONS.includes(selectedSection) && working.longReads[selectedSection] && (
        <div className="flex flex-col gap-4">
          <HeadlineEditor
            headline={working.longReads[selectedSection]!.headline}
            onChange={headline =>
              setWorking(prev => ({
                ...prev,
                longReads: {
                  ...prev.longReads,
                  [selectedSection]: { ...prev.longReads[selectedSection]!, headline },
                },
              }))
            }
          />
          <BlockEditor
            blocks={working.longReads[selectedSection]!.blocks}
            lossy={working.longReads[selectedSection]!.lossy}
            onChange={blocks =>
              setWorking(prev => ({
                ...prev,
                longReads: {
                  ...prev.longReads,
                  [selectedSection]: { ...prev.longReads[selectedSection]!, blocks },
                },
              }))
            }
          />
          {selectedSection === 'problemStatement' && (
            <PdfDataPointsEditor
              pdf={working.pdf}
              onChange={pdf => setWorking(prev => ({ ...prev, pdf }))}
            />
          )}
        </div>
      )}

      {selectedSection === 'bonus' && (
        <BonusEditor
          runId={runId}
          ifRevisionID={revisionId}
          bonusType={working.bonusType}
          bonus={working.bonus}
          onChange={bonus => setWorking(prev => ({ ...prev, bonus }))}
          onAssetUploaded={result => onAssetUploaded('bonus', result)}
        />
      )}

      {selectedSection === 'game' && (
        <GameEditor game={working.game} onChange={game => setWorking(prev => ({ ...prev, game }))} />
      )}

      {selectedSection === 'deliberation-conversation' && (
        <TurnListEditor
          turns={working.conversation}
          onChange={conversation => setWorking(prev => ({ ...prev, conversation }))}
        />
      )}

      {selectedSection === 'podcast' && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-[color:var(--color-ink-soft)]">
            Deliberation transcript
            <textarea
              value={working.podcastTranscript}
              rows={10}
              onChange={e =>
                setWorking(prev => ({ ...prev, podcastTranscript: e.target.value }))
              }
              className="min-h-[44px] w-full resize-y rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-2 text-sm text-[color:var(--color-ink)]"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[color:var(--color-ink-soft)]">
              Podcast audio
            </span>
            <AssetUploadSlot
              runId={runId}
              slot="podcast-audio"
              kind="audio"
              currentAssetUrl={working.podcastAudioUrl}
              ifRevisionID={revisionId}
              onUploaded={result => onAssetUploaded('podcast', result)}
            />
          </div>
        </div>
      )}

      {selectedSection === 'theme' && (
        <ThemeEditor
          theme={working.theme}
          fieldErrors={fieldErrors}
          onChange={theme => setWorking(prev => ({ ...prev, theme }))}
        />
      )}

      <SaveBar />
    </div>
  )
}
