'use client'
/**
 * Quick 260724-i5n (LD-1) — the CARDS-variant Story Desk (mockup
 * `02-story-desk-cards.html`): the Draft stage's default landing, a 3-up
 * grid of the 9 editable sections plus a "N of 9 reviewed" progress header.
 *
 * Presentational only — the parent (`ReviewDeskRunView`) owns `story`/`tab`
 * URL state, the localStorage-backed reviewed set, and passes both plus the
 * SAME FACTUAL_AXES-scoped chip counts the single-section galley resolves
 * against, so a card's status/dots always agree with what opening it will
 * show (never a second, drifting resolution).
 */
import { EDITABLE_SECTIONS, type SectionChipCounts } from './SectionChipList'
import { sectionExcerpt, sectionWordCount } from './storyOutline'
import type { DraftResponse, ContentBlock } from '@/lib/contentPatchClient'

interface StoryDeskGridProps {
  draft: DraftResponse
  chipCounts: Record<string, SectionChipCounts>
  reviewedIds: ReadonlySet<string>
  onOpen: (sectionId: string) => void
  /** Quick 260724-x4b (LD-3) — the per-card secondary Edit shortcut. */
  onOpenEdit: (sectionId: string) => void
  issueNumber?: number
}

type CardStatus = 'done' | 'mustfix' | 'review' | 'clean'
type ChipTone = 'clean' | 'review' | 'mustfix'

const TOP_RULE: Record<CardStatus, string> = {
  done: 'border-t-[3px] border-t-[color:var(--color-green)]',
  mustfix: 'border-t-[3px] border-t-[color:var(--color-vermilion)]',
  review: 'border-t-[3px] border-t-[color:var(--color-marigold)]',
  clean:
    'border-t-[3px] border-t-[color:var(--color-nav)] hover:border-t-[color:var(--color-cobalt)]',
}

const CHIP_CLASS: Record<ChipTone, string> = {
  clean: 'text-[color:var(--color-green)] border-[color:var(--color-green)] bg-[rgba(20,138,82,0.07)]',
  review:
    'text-[color:var(--color-marigold-text)] border-[color:var(--color-marigold)] bg-[rgba(242,176,30,0.1)]',
  mustfix: 'text-white border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)]',
}

const CHIP_LABEL: Record<ChipTone, string> = {
  clean: 'Clean',
  review: 'Review',
  mustfix: 'Must fix',
}

/**
 * LD-7's structured-sections carve-out is `game`/`theme`/`podcast` — the
 * approved cards mockup (02) counts words for the Deliberation card ("890
 * words"), not a "Structured" label, since a conversation turn list is
 * genuinely proseable text unlike a game embed or theme's color/font fields.
 */
const STRUCTURED_LABEL: Partial<Record<string, string>> = {
  game: 'Structured',
  theme: 'Structured',
  podcast: 'Transcript',
}

function headlineFor(draft: DraftResponse, sectionId: string, fallback: string): string {
  if (sectionId === 'game') return draft.game?.headline || fallback
  if (sectionId === 'bonus') return draft.bonus?.headline || fallback
  if (sectionId === 'podcast') return 'Podcast'
  if (sectionId === 'deliberation-conversation') return 'Deliberation'
  if (sectionId === 'theme') return 'Theme'
  return draft.sections[sectionId]?.headline || fallback
}

function excerptFor(draft: DraftResponse, sectionId: string): string {
  if (sectionId === 'bonus') {
    if (draft.bonusType === 'specAd' && Array.isArray(draft.bonus?.body)) {
      return sectionExcerpt(draft.bonus.body as ContentBlock[])
    }
    if (draft.bonusType === 'jingle') return 'Original lyrics for this week’s issue.'
    return 'A storyboard concept for this week’s issue.'
  }
  if (sectionId === 'game') return draft.game?.description || 'An interactive section.'
  if (sectionId === 'theme') return draft.theme?.visualDirection || 'The issue’s visual theme.'
  if (sectionId === 'podcast') return 'Audio companion to this issue.'
  if (sectionId === 'deliberation-conversation') {
    const first = (draft.conversation ?? [])[0]
    return first ? `${first.speaker}: ${first.text}` : 'How the agents chose this week’s charity.'
  }
  return sectionExcerpt(draft.sections[sectionId]?.blocks ?? [])
}

function wordCountLabelFor(draft: DraftResponse, sectionId: string): string {
  const structured = STRUCTURED_LABEL[sectionId]
  if (structured) return structured
  if (sectionId === 'bonus') {
    if (draft.bonusType === 'specAd' && Array.isArray(draft.bonus?.body)) {
      return `${sectionWordCount(draft.bonus.body as ContentBlock[])} words`
    }
    return 'Structured'
  }
  if (sectionId === 'deliberation-conversation') {
    const words = (draft.conversation ?? []).reduce((total, turn) => total + sectionWordCount([
      { type: 'paragraph', text: turn.text },
    ]), 0)
    return `${words} words`
  }
  return `${sectionWordCount(draft.sections[sectionId]?.blocks ?? [])} words`
}

function statusFor(counts: SectionChipCounts | undefined, reviewed: boolean): CardStatus {
  if (reviewed) return 'done'
  if ((counts?.error ?? 0) > 0) return 'mustfix'
  if ((counts?.warning ?? 0) > 0) return 'review'
  return 'clean'
}

function chipToneFor(status: CardStatus): ChipTone {
  if (status === 'mustfix') return 'mustfix'
  if (status === 'review') return 'review'
  return 'clean'
}

export default function StoryDeskGrid({
  draft,
  chipCounts,
  reviewedIds,
  onOpen,
  onOpenEdit,
}: StoryDeskGridProps) {
  const total = EDITABLE_SECTIONS.length
  const reviewedCount = EDITABLE_SECTIONS.filter(s => reviewedIds.has(s.id)).length

  let mustFixCount = 0
  let reviewCount = 0
  for (const section of EDITABLE_SECTIONS) {
    if (reviewedIds.has(section.id)) continue
    const counts = chipCounts[section.id]
    if ((counts?.error ?? 0) > 0) mustFixCount += 1
    else if ((counts?.warning ?? 0) > 0) reviewCount += 1
  }

  const progressPercent = total > 0 ? Math.round((reviewedCount / total) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-semibold leading-none text-[color:var(--color-ink)] sm:text-[34px]">
            The Draft Desk
          </h1>
          <p className="mt-2 font-[family-name:var(--font-body)] text-[13.5px] italic text-[color:var(--color-ink-soft)]">
            Nine stories this week. Read them one at a time.
          </p>
        </div>
        <div className="w-full sm:w-auto sm:text-right">
          <p className="font-[family-name:var(--font-mono)] text-[11.5px] text-[color:var(--color-ink-soft)]">
            <b className="font-semibold text-[color:var(--color-ink)]">
              {reviewedCount} of {total}
            </b>{' '}
            reviewed &middot; {mustFixCount} must fix &middot; {reviewCount} in review
          </p>
          <div className="relative mt-2 h-[5px] w-full bg-[color:var(--color-nav)] sm:ml-auto sm:w-[220px]">
            <i
              className="absolute inset-y-0 left-0 block bg-[color:var(--color-green)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.06em] text-[color:var(--color-faint)]">
            Review progress
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {EDITABLE_SECTIONS.map((section, index) => {
          const reviewed = reviewedIds.has(section.id)
          const counts = chipCounts[section.id]
          const status = statusFor(counts, reviewed)
          const chipTone = chipToneFor(status)
          const errorDots = counts?.error ?? 0
          const warningDots = counts?.warning ?? 0

          const headline = headlineFor(draft, section.id, section.label)

          return (
            <div
              key={section.id}
              className={`relative flex min-h-[190px] flex-col rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-[18px] pb-3.5 text-left hover:bg-[color:var(--color-card-alt)] ${TOP_RULE[status]}`}
            >
              {/* Quick 260724-x4b (LD-3): the stretched primary button —
                  a normal click anywhere on the card still opens the
                  section read-only on its Draft tab. Two REAL sibling
                  buttons (never a button nested inside a button). */}
              <button
                type="button"
                data-testid={`story-card-${section.id}`}
                onClick={() => onOpen(section.id)}
                aria-label={`Open ${headline}`}
                className="absolute inset-0 z-0 rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
              />
              <div className="pointer-events-none relative z-[1] flex flex-1 flex-col">
                {reviewed && (
                  <span className="absolute right-3.5 top-3 font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--color-green)]">
                    &#10003; Reviewed
                  </span>
                )}
                <span className="flex items-baseline justify-between">
                  <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.12em] text-[color:var(--color-cobalt)]">
                    {section.label}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </span>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-[21px] font-semibold leading-[1.12] text-[color:var(--color-ink)]">
                  {headline}
                </h2>
                <p className="mt-2 line-clamp-2 font-[family-name:var(--font-body)] text-[13px] italic leading-[1.5] text-[color:var(--color-ink-soft)]">
                  {excerptFor(draft, section.id)}
                </p>
                <span className="mt-auto flex items-center gap-2.5 pt-3.5">
                  <span
                    className={`rounded-[2px] border px-[7px] py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[.09em] ${CHIP_CLASS[chipTone]}`}
                  >
                    {CHIP_LABEL[chipTone]}
                  </span>
                  {(errorDots > 0 || warningDots > 0) && (
                    <span className="flex gap-1">
                      {Array.from({ length: errorDots }).map((_, i) => (
                        <span
                          key={`e${i}`}
                          className="h-[7px] w-[7px] rounded-full bg-[color:var(--color-vermilion)]"
                        />
                      ))}
                      {Array.from({ length: warningDots }).map((_, i) => (
                        <span
                          key={`w${i}`}
                          className="h-[7px] w-[7px] rounded-full bg-[color:var(--color-marigold)]"
                        />
                      ))}
                    </span>
                  )}
                  <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-faint)]">
                    {wordCountLabelFor(draft, section.id)}
                  </span>
                </span>
                <div className="mt-2.5 flex justify-end pointer-events-none">
                  <button
                    type="button"
                    data-testid={`story-card-edit-${section.id}`}
                    onClick={e => {
                      e.stopPropagation()
                      onOpenEdit(section.id)
                    }}
                    aria-label={`Edit ${headline}`}
                    className="pointer-events-auto relative z-[2] min-h-[36px] inline-flex items-center font-[family-name:var(--font-ui)] text-[12px] font-semibold text-[color:var(--color-cobalt)] hover:text-[color:var(--color-cobalt-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
                  >
                    Edit &rarr;
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center font-[family-name:var(--font-body)] text-[13px] italic text-[color:var(--color-faint)]">
        Open a story to review it in focus —{' '}
        <b className="font-[family-name:var(--font-ui)] font-semibold not-italic text-[color:var(--color-ink-soft)]">
          Outline
        </b>{' '}
        and{' '}
        <b className="font-[family-name:var(--font-ui)] font-semibold not-italic text-[color:var(--color-ink-soft)]">
          Draft
        </b>{' '}
        tabs inside. Publishing still happens in the Approval stage.
      </p>
    </div>
  )
}
