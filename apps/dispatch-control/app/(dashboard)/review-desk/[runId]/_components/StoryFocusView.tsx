'use client'
/**
 * Quick 260724-i5n (LD-2) — the per-story focus view (mockups
 * `03-story-outline-tab.html` / `04-story-draft-tab.html`): crumbs
 * (back-to-desk, "Story X of 9", prev/next steppers), a story header (kicker,
 * headline, meta line, Mark reviewed + Edit story actions), folder
 * Outline/Draft tabs, and a footer prev/next-unreviewed nav.
 *
 * Presentational — `ReviewDeskRunView` owns all URL/dirty/editing state and
 * passes callbacks down; this component only ever calls them. The Draft
 * tab's non-editing body reuses the SAME `<Galley>` every other surface
 * uses, scoped to this one section via its `sections` prop (LD-4) — never a
 * forked annotation renderer.
 *
 * quick 260730-i4j (Task 3a/3e) — Draft Focus. The frame's `layout.tsx` now
 * drops BOTH its rails on the Draft stage (`draftFocus` branch), so the two
 * capabilities `WorkspaceOutline` used to provide — jump to any of the 9
 * `EDITABLE_SECTIONS`, and a per-section state mark — move INTO this crumb
 * row as a `Stories` disclosure (Task 3a), at zero extra clicks. The
 * story-scoped `StoryFindingsRail` (Task 3d) renders inside the Draft tab's
 * panel, in its own 292px column, ONLY when the open story has open findings
 * AND is not mid-edit (the editor already takes the full width).
 */
import { EDITABLE_SECTIONS, type SectionChipCounts } from './SectionChipList'
import StoryOutlineTab, { type OutlineBriefFields, type OutlineOpenFinding } from './StoryOutlineTab'
import SectionEditorPanel from './SectionEditorPanel'
import StoryFindingsRail from './StoryFindingsRail'
import Galley from '@/components/galley/Galley'
import { sectionWordCount } from './storyOutline'
import type { ContentBlock, DraftResponse } from '@/lib/contentPatchClient'
import type { ResolvedAnnotation } from '@/lib/galley/spanResolver'
import type { OutlineUnresolvedFinding } from './storyOutline'
import type { PassageSelection, RevisionPassageFromSelection } from '@/components/galley/PassageToolbar'

interface StoryFocusViewProps {
  runId: string
  draft: DraftResponse
  sectionId: string
  activeTab: 'outline' | 'draft'
  onTab: (tab: 'outline' | 'draft') => void
  onBack: () => void
  onNav: (sectionId: string) => void
  reviewed: boolean
  onToggleReviewed: () => void
  chipCounts: Record<string, SectionChipCounts>
  resolved: ResolvedAnnotation[]
  unresolved: ReadonlyArray<OutlineUnresolvedFinding>
  openFindings: OutlineOpenFinding[]
  sourcedCount: number
  unsourcedCount: number
  brief: OutlineBriefFields | null | undefined
  editing: boolean
  onEdit: () => void
  onExitEdit: () => void
  onDirtyChange: (dirty: Record<string, boolean>) => void
  focusFindingId?: string
  findingReason?: string
  revisionId: string
  reloadDraft: () => Promise<void> | void
  onEditSection: (sectionId: string, findingId?: string) => void
  onInspect?: (sectionId: string) => void
  onRevise?: (passage: RevisionPassageFromSelection) => void
  onRelatedFacts?: (sel: PassageSelection) => void
  showProvenance: boolean
  onToggleProvenance?: () => void
  onUnsourcedClaimClick?: (claimIndex: number) => void
  nextUnreviewed: { id: string; label: string } | null
}

function wordCountLabelFor(draft: DraftResponse, sectionId: string): string {
  if (sectionId === 'game' || sectionId === 'theme') return 'Structured'
  if (sectionId === 'podcast') return 'Transcript'
  if (sectionId === 'bonus') {
    if (draft.bonusType === 'specAd' && Array.isArray(draft.bonus?.body)) {
      return `${sectionWordCount(draft.bonus.body as ContentBlock[])} words`
    }
    return 'Structured'
  }
  if (sectionId === 'deliberation-conversation') {
    const words = (draft.conversation ?? []).reduce(
      (total, turn) => total + sectionWordCount([{ type: 'paragraph', text: turn.text }]),
      0,
    )
    return `${words} words`
  }
  return `${sectionWordCount(draft.sections[sectionId]?.blocks ?? [])} words`
}

function sectionBlocksFor(draft: DraftResponse, sectionId: string): ContentBlock[] {
  if (sectionId === 'bonus') {
    return draft.bonusType === 'specAd' && Array.isArray(draft.bonus?.body)
      ? (draft.bonus.body as ContentBlock[])
      : []
  }
  return draft.sections[sectionId]?.blocks ?? []
}

function headlineFor(draft: DraftResponse, sectionId: string, fallback: string): string {
  if (sectionId === 'game') return draft.game?.headline || fallback
  if (sectionId === 'bonus') return draft.bonus?.headline || fallback
  if (sectionId === 'podcast') return 'Podcast'
  if (sectionId === 'deliberation-conversation') return 'Deliberation'
  if (sectionId === 'theme') return 'Theme'
  return draft.sections[sectionId]?.headline || fallback
}

const CRUMB_BTN =
  'font-[family-name:var(--font-mono)] text-[11px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]'

// quick 260730-i4j (Task 3a) — the outline's per-section state mark, ported
// into the Stories picker. Label + color together — never color alone.
function StoriesPickerMark({ counts }: { counts: SectionChipCounts | undefined }) {
  const errorCount = counts?.error ?? 0
  const openCount = counts?.open ?? 0
  if (errorCount > 0) {
    return (
      <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-vermilion)]">
        {errorCount} must fix
      </span>
    )
  }
  if (openCount > 0) {
    return (
      <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-marigold-text)]">
        {openCount} open
      </span>
    )
  }
  return (
    <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-green)]">
      Clean
    </span>
  )
}

export default function StoryFocusView({
  runId: _runId,
  draft,
  sectionId,
  activeTab,
  onTab,
  onBack,
  onNav,
  reviewed,
  onToggleReviewed,
  chipCounts,
  resolved,
  unresolved,
  openFindings,
  sourcedCount,
  unsourcedCount,
  brief,
  editing,
  onEdit,
  onExitEdit,
  onDirtyChange,
  focusFindingId,
  findingReason,
  revisionId,
  reloadDraft,
  onEditSection,
  onInspect,
  onRevise,
  onRelatedFacts,
  showProvenance,
  onToggleProvenance,
  onUnsourcedClaimClick,
  nextUnreviewed,
}: StoryFocusViewProps) {
  const index = EDITABLE_SECTIONS.findIndex(s => s.id === sectionId)
  const meta = EDITABLE_SECTIONS[index]
  const label = meta?.label ?? sectionId
  const prev = index > 0 ? EDITABLE_SECTIONS[index - 1] : undefined
  const next = index >= 0 && index < EDITABLE_SECTIONS.length - 1 ? EDITABLE_SECTIONS[index + 1] : undefined

  const counts = chipCounts[sectionId]
  const errorCount = counts?.error ?? 0
  const warningCount = counts?.warning ?? 0
  const openCount = counts?.open ?? 0

  const blocks = sectionBlocksFor(draft, sectionId)
  const canShowGalley = sectionId !== 'theme'

  // quick 260730-i4j (Task 3e) — the story-scoped findings rail, only inside
  // the (non-editing) Draft tab panel, and only when this story has open
  // findings. The Outline tab keeps its own open-findings list; the editor
  // takes the full width regardless.
  const hasFindings = resolved.length + unresolved.length > 0
  const showRail = activeTab === 'draft' && !editing && hasFindings

  function handleJump(findingId: string) {
    const el = document.getElementById(`finding-${findingId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // The mark IS the popover trigger (AnnotationMark) — clicking it opens
      // Accept/Edit/Dismiss at the same anchor, never a forked jump target.
      el.click()
    }
  }

  function handleFixInEditor(findingId: string) {
    onEditSection(sectionId, findingId)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Crumbs */}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={onBack} className={CRUMB_BTN}>
          &larr; Draft desk
        </button>
        <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[.08em] text-[color:var(--color-faint)]">
          {index >= 0 ? `Story ${index + 1} of ${EDITABLE_SECTIONS.length}` : label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {prev && (
            <button type="button" onClick={() => onNav(prev.id)} className={CRUMB_BTN}>
              &larr; {prev.label}
            </button>
          )}
          {next && (
            <button type="button" onClick={() => onNav(next.id)} className={CRUMB_BTN}>
              {next.label} &rarr;
            </button>
          )}
          {/* quick 260730-i4j (Task 3a) — the outline's jump + state-mark
              capability, restored here now the left rail is gone on Draft. */}
          <details className="relative">
            <summary
              className={`${CRUMB_BTN} inline-flex cursor-pointer list-none select-none items-center [&::-webkit-details-marker]:hidden`}
            >
              Stories
            </summary>
            <div className="absolute right-0 z-20 mt-1.5 w-72 border border-[color:var(--color-ink)]/[.15] bg-[color:var(--color-card)] shadow-[4px_4px_0_var(--color-ink)]">
              {EDITABLE_SECTIONS.map(section => (
                <button
                  key={section.id}
                  type="button"
                  aria-current={section.id === sectionId ? 'true' : undefined}
                  onClick={() => onNav(section.id)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[12.5px] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                >
                  <span>{section.label}</span>
                  <StoriesPickerMark counts={chipCounts[section.id]} />
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* Story head */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[.12em] text-[color:var(--color-cobalt)]">
            {label}
          </span>
          <h1 className="mt-1.5 font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.05] text-[color:var(--color-ink)] sm:text-[33px]">
            {headlineFor(draft, sectionId, label)}
          </h1>
          <p className="mt-2.5 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-faint)]">
            {wordCountLabelFor(draft, sectionId)}
            {errorCount > 0 && (
              <>
                {' '}
                &middot; <b className="font-semibold text-[color:var(--color-vermilion)]">{errorCount} must fix</b>
              </>
            )}
            {warningCount > 0 && <> &middot; {warningCount} warning{warningCount === 1 ? '' : 's'}</>}
            {' '}
            &middot; {reviewed ? 'reviewed' : 'unreviewed'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onToggleReviewed}
            className="min-h-[44px] border border-[color:var(--color-ink)] bg-white px-4 py-2.5 font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
          >
            {reviewed ? 'Reviewed' : '✓ Mark reviewed'}
          </button>
          <button
            type="button"
            onClick={editing ? onExitEdit : onEdit}
            className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 py-2.5 font-[family-name:var(--font-ui)] text-[12.5px] font-semibold text-white hover:bg-black"
          >
            {editing ? 'Done editing' : 'Edit story'}
          </button>
        </div>
      </div>

      {/* Folder tabs */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onTab('outline')}
          className={
            activeTab === 'outline'
              ? 'border border-b-0 border-[color:var(--color-faint)] border-t-[3px] border-t-[color:var(--color-cobalt)] bg-[color:var(--color-card)] px-[22px] pb-[11px] pt-[10px] font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[.1em] text-[color:var(--color-ink)]'
              : 'border border-b-0 border-[color:var(--color-faint)] bg-[color:var(--color-rail)] px-[22px] pb-[11px] pt-[12px] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[.1em] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)]'
          }
        >
          Outline
        </button>
        <button
          type="button"
          onClick={() => onTab('draft')}
          className={
            activeTab === 'draft'
              ? 'border border-b-0 border-[color:var(--color-faint)] border-t-[3px] border-t-[color:var(--color-cobalt)] bg-[color:var(--color-card)] px-[22px] pb-[11px] pt-[10px] font-[family-name:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[.1em] text-[color:var(--color-ink)]'
              : 'border border-b-0 border-[color:var(--color-faint)] bg-[color:var(--color-rail)] px-[22px] pb-[11px] pt-[12px] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[.1em] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-card-alt)]'
          }
        >
          Draft
          {openCount > 0 && (
            <span className="ml-2 inline-flex min-w-[16px] justify-center rounded-full bg-[color:var(--color-vermilion)] px-[5px] py-[2px] text-[9.5px] leading-none text-white">
              {openCount}
            </span>
          )}
        </button>
      </div>

      {/* quick 260730-i4j (Task 3e) — the story-scoped findings rail lives in
          its own grid column beside the tab panel, ONLY when the Draft tab
          is showing a clean (non-editing) story with open findings. Every
          other combination (Outline tab, editing, or a clean story) keeps
          the panel's previous full-width markup, unchanged. */}
      <div className={showRail ? 'grid grid-cols-1 items-start lg:grid-cols-[minmax(0,1fr)_292px]' : ''}>
      <div className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-6 sm:p-8">
        {activeTab === 'outline' ? (
          <StoryOutlineTab
            sectionId={sectionId}
            blocks={blocks}
            resolved={resolved}
            unresolved={unresolved}
            brief={brief}
            sourcedCount={sourcedCount}
            unsourcedCount={unsourcedCount}
            openFindings={openFindings}
            onJumpToFinding={() => onTab('draft')}
          />
        ) : editing ? (
          <>
            {findingReason && (
              <div
                data-finding-id={focusFindingId}
                className="mb-4 flex flex-col gap-1 border-l-2 border-[color:var(--color-marigold)] bg-[color:var(--color-card-alt)] p-3"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-marigold-text,var(--color-ink-soft))]">
                  QA finding
                </span>
                <p className="text-xs text-[color:var(--color-ink)]">{findingReason}</p>
              </div>
            )}
            <SectionEditorPanel
              runId={_runId}
              selectedSection={sectionId}
              draft={draft}
              onDirtyChange={onDirtyChange}
              focusFindingId={focusFindingId}
              findingReason={findingReason}
            />
          </>
        ) : (
          <>
            {onToggleProvenance && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={onToggleProvenance}
                  aria-pressed={showProvenance}
                  className="min-h-[36px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-medium uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
                >
                  {showProvenance ? 'Provenance on' : 'Provenance off'}
                </button>
              </div>
            )}
            {canShowGalley ? (
              <Galley
                runId={_runId}
                draft={draft}
                revisionId={revisionId}
                reloadDraft={reloadDraft}
                onEditSection={onEditSection}
                onInspect={onInspect}
                onRevise={onRevise}
                onRelatedFacts={onRelatedFacts}
                showProvenance={showProvenance}
                onUnsourcedClaimClick={onUnsourcedClaimClick}
                sections={[sectionId]}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
                  Theme is applied globally (CSS variables), not rendered as its own passage.
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] text-[color:var(--color-ink)] sm:grid-cols-3">
                  <dt className="text-[color:var(--color-ink-soft)]">Primary</dt>
                  <dd>{draft.theme?.primaryColor || '—'}</dd>
                  <dt className="text-[color:var(--color-ink-soft)]">Accent</dt>
                  <dd>{draft.theme?.accentColor || '—'}</dd>
                  <dt className="text-[color:var(--color-ink-soft)]">Background</dt>
                  <dd>{draft.theme?.backgroundColor || '—'}</dd>
                  <dt className="text-[color:var(--color-ink-soft)]">Text</dt>
                  <dd>{draft.theme?.textColor || '—'}</dd>
                  <dt className="text-[color:var(--color-ink-soft)]">Display font</dt>
                  <dd>{draft.theme?.fontDisplay || '—'}</dd>
                  <dt className="text-[color:var(--color-ink-soft)]">Body font</dt>
                  <dd>{draft.theme?.fontBody || '—'}</dd>
                </dl>
                <p className="font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-ink-soft)]">
                  Edit story to change the theme.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      {showRail && (
        <StoryFindingsRail
          resolved={resolved}
          unresolved={unresolved}
          onJump={handleJump}
          onFixInEditor={handleFixInEditor}
        />
      )}
      </div>

      <div className="flex justify-between">
        {prev ? (
          <button type="button" onClick={() => onNav(prev.id)} className={CRUMB_BTN}>
            &larr; {String(index).padStart(2, '0')} &middot; {prev.label}
          </button>
        ) : (
          <span />
        )}
        {nextUnreviewed ? (
          <button type="button" onClick={() => onNav(nextUnreviewed.id)} className={CRUMB_BTN}>
            Next unreviewed: <b className="font-semibold text-[color:var(--color-ink)]">{nextUnreviewed.label}</b> &rarr;
          </button>
        ) : (
          <button type="button" onClick={onBack} className={CRUMB_BTN}>
            All caught up — back to desk
          </button>
        )}
      </div>
    </div>
  )
}
