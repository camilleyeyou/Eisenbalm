'use client'
/**
 * Phase 56 -- the Section page: one part of the issue, read and edited in
 * place, paragraph by paragraph. `/s/[section]` is the current issue;
 * `/s/[section]?run=<id>` pins an earlier one.
 *
 * Current-run resolution stays on `useCurrentRun()` (never a derived highest
 * issue number). `params.section` must be one of the nine part ids, else 404.
 * Text parts use SectionArticle; Game, Podcast, Look, Deliberation and
 * non-text bonuses keep their Galley body inside the same frame, read-only.
 */
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { notFound } from 'next/navigation'
import { useCurrentRun } from '@/lib/useCurrentRun'
import {
  getDraft,
  ContentPatchError,
  type ContentBlock,
  type DraftResponse,
} from '@/lib/contentPatchClient'
import { PART_ORDER, PART_LABELS, COPY } from '@/lib/editorState'
import { deriveHomeSections, deriveHomeFooter } from '@/lib/homeSections'
import { sectionEditHref } from '@/lib/issueRouteResolver'
import { NO_CHARITY_YET } from '@/lib/issueTitle'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import Galley from '@/components/galley/Galley'
import NextStepSlab from '@/components/editor/NextStepSlab'
import { SkeletonLine } from '@/components/ui/Skeleton'
import SectionHeader from './_components/SectionHeader'
import SectionEndNav, { type NavTarget } from './_components/SectionEndNav'
import ExemptSectionNote, { type ExemptSectionKind } from './_components/ExemptSectionNote'
import AgentChangesNote from './_components/AgentChangesNote'
import SectionArticle from './_components/SectionArticle'
import RewriteThisPart from './_components/RewriteThisPart'

interface SectionParams {
  section: string
}
interface SectionSearchParams {
  run?: string | string[]
}
interface SectionReaderPageProps {
  params: SectionParams | Promise<SectionParams>
  searchParams?: SectionSearchParams | Promise<SectionSearchParams>
}

function isThenable<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

const TEXT_PARTS: ReadonlySet<string> = new Set(['originStory', 'problemStatement', 'founderBio', 'caseStudy'])

function exemptKindFor(sectionId: string, bonusType: DraftResponse['bonusType']): ExemptSectionKind | null {
  if (sectionId === 'game') return 'game'
  if (sectionId === 'podcast') return 'podcast'
  if (sectionId === 'theme') return 'theme'
  if (sectionId === 'deliberation-conversation') return 'deliberation'
  if (sectionId === 'bonus' && bonusType !== 'specAd') return 'bonus-media'
  return null
}

function ThemeSwatches({ theme }: { theme: DraftResponse['theme'] }) {
  const chips: Array<{ label: string; value?: string }> = [
    { label: 'Main colour', value: theme?.primaryColor },
    { label: 'Accent', value: theme?.accentColor },
    { label: 'Background', value: theme?.backgroundColor },
    { label: 'Text', value: theme?.textColor },
  ]
  return (
    <section className="mt-6 flex flex-col gap-4 text-[17px]">
      <div className="flex flex-wrap gap-6">
        {chips.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className="block h-12 w-12 border border-[color:var(--color-line-strong)]"
              style={{ background: value ?? 'transparent' }}
            />
            <span className="text-[15px]">{label}</span>
          </div>
        ))}
      </div>
      <p>Headline font: {theme?.fontDisplay ?? 'Not set'}</p>
      <p>Body font: {theme?.fontBody ?? 'Not set'}</p>
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading this part" className="flex flex-col gap-3 px-4 py-8">
      <SkeletonLine className="h-8 w-2/3" />
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-5/6" />
    </div>
  )
}

function partTitle(id: string, draft: DraftResponse): string {
  const headline =
    id === 'bonus'
      ? draft.bonus?.headline
      : id === 'game'
        ? draft.game?.headline
        : TEXT_PARTS.has(id)
          ? draft.sections[id]?.headline
          : undefined
  return typeof headline === 'string' && headline.trim() !== '' ? headline : (PART_LABELS[id] ?? id)
}

export default function SectionReaderPage({ params, searchParams }: SectionReaderPageProps) {
  const resolvedParams = isThenable<SectionParams>(params) ? use(params) : params
  const sectionId = resolvedParams.section
  const resolvedSearch: SectionSearchParams = isThenable<SectionSearchParams>(searchParams)
    ? use(searchParams)
    : (searchParams ?? {})
  const pinnedRunId =
    typeof resolvedSearch.run === 'string' && resolvedSearch.run !== '' ? resolvedSearch.run : null

  const { getToken } = useAuth()
  const cr = useCurrentRun({ runId: pinnedRunId })
  const { state, runId, issueNumber, title, derivationInputs } = cr

  const [draft, setDraft] = useState<DraftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const draftRef = useRef<DraftResponse | null>(null)

  const reloadDraft = useCallback(async () => {
    if (!runId) return
    setError(null)
    try {
      const result = await getDraft(runId, await getToken())
      draftRef.current = result
      setDraft(result)
    } catch (e) {
      setError(e instanceof ContentPatchError || e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
    // getToken excluded to avoid a refetch loop when its reference churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  useEffect(() => {
    if (!runId) return
    void reloadDraft()
  }, [runId, reloadDraft])

  if (!(PART_ORDER as readonly string[]).includes(sectionId)) {
    notFound()
    return null
  }

  const issueHref = pinnedRunId ? `/?run=${encodeURIComponent(pinnedRunId)}` : '/'

  if (state.kind === 'none') {
    return (
      <p className="px-4 py-8 text-[17px] text-[color:var(--color-ink-soft)]">
        {pinnedRunId ? 'That issue could not be found.' : 'There is no current issue yet.'}
      </p>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4 px-4 py-8 text-[17px]">
        <p>{COPY.loadFailed}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            void reloadDraft()
          }}
          className="min-h-[48px] px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] font-semibold editor-focus"
        >
          {COPY.reloadButton}
        </button>
      </div>
    )
  }

  if (
    state.kind === 'loading' ||
    loading ||
    title === undefined ||
    derivationInputs.qaFindings === undefined ||
    derivationInputs.claimRows === undefined ||
    !runId ||
    !draft
  ) {
    return <LoadingSkeleton />
  }

  const sections = deriveHomeSections({
    draft,
    qaFindings: derivationInputs.qaFindings,
    claimRows: derivationInputs.claimRows,
    runStatus: derivationInputs.runStatus,
  })
  const footer = deriveHomeFooter({
    stateKind: state.kind,
    sections,
    issue: derivationInputs.issue,
    publishedAt: null,
    runStatus: derivationInputs.runStatus,
    runCompletedAt: derivationInputs.runCompletedAt,
  })
  const published = footer.kind === 'published'
  const row = sections?.rows.find((r) => r.id === sectionId)

  const changeItems = ((derivationInputs.qaFindings ?? []) as unknown as Array<{
    resolution?: string
    sectionName: string
    quotedSpan?: string
    suggestedFix?: string
  }>)
    .filter((f) => f.resolution === 'agent-applied' && qaSectionToGalleyId(f.sectionName) === sectionId)
    .map((f) =>
      f.quotedSpan && f.suggestedFix
        ? `“${f.quotedSpan}” became “${f.suggestedFix}”.`
        : 'A sentence was reworded to match the sources.',
    )
  const changeCount = row?.agentChanges ?? 0
  while (changeItems.length < changeCount) changeItems.push('A sentence was reworded to match the sources.')

  const idx = (PART_ORDER as readonly string[]).indexOf(sectionId)
  const currentForLinks = pinnedRunId ? null : runId
  const target = (i: number): NavTarget | null => {
    const id = PART_ORDER[i]
    if (!id) return null
    return { href: sectionEditHref(id, runId, currentForLinks), index: i + 1, label: PART_LABELS[id] ?? id }
  }

  const exemptKind = exemptKindFor(sectionId, draft.bonusType)
  const isTextBody = TEXT_PARTS.has(sectionId) || (sectionId === 'bonus' && draft.bonusType === 'specAd')
  const blocks: ContentBlock[] =
    sectionId === 'bonus'
      ? Array.isArray(draft.bonus?.body)
        ? (draft.bonus.body as ContentBlock[])
        : []
      : (draft.sections[sectionId]?.blocks ?? [])
  const getRevisionId = () => (draftRef.current ?? draft).revisionId
  const issueLabel = `${issueNumber != null ? `Issue ${issueNumber}` : 'This issue'} · ${title ?? NO_CHARITY_YET}`

  let helper: React.ReactNode
  if (exemptKind) helper = <ExemptSectionNote kind={exemptKind} />
  else if (published) helper = <p className="text-[15px]">{COPY.sectionPublishedHelper}</p>
  else helper = <p className="text-[15px]">{COPY.sectionToolbarHelper}</p>

  return (
    <>
      <NextStepSlab sentence={COPY.sectionSlab} ghost={{ label: COPY.backToIssue, href: issueHref }} />
      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-card)] px-4 pt-8 pb-12 sm:px-[clamp(24px,7vw,96px)] sm:pt-12 sm:pb-16">
        <SectionHeader
          issueLabel={issueLabel}
          issueHref={issueHref}
          partIndex={idx + 1}
          partLabel={PART_LABELS[sectionId] ?? sectionId}
          title={partTitle(sectionId, draft)}
        />

        <div className="mt-6 mb-8 flex max-w-[720px] flex-col gap-4 border-y border-[color:var(--color-line)] py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-[family-name:var(--font-body)] text-[color:var(--color-ink-soft)]">{helper}</div>
          <RewriteThisPart
            runId={runId}
            sectionId={sectionId}
            bonusType={draft.bonusType}
            published={published}
            runStatus={derivationInputs.runStatus}
            currentBlocks={blocks}
            getRevisionId={getRevisionId}
            onRewritten={reloadDraft}
          />
        </div>

        {isTextBody ? (
          blocks.length === 0 ? (
            <p className="text-[17px] text-[color:var(--color-ink-soft)]">This part isn&apos;t written yet.</p>
          ) : (
            <SectionArticle
              runId={runId}
              sectionId={sectionId}
              blocks={blocks}
              getRevisionId={getRevisionId}
              readOnly={published}
              onSaved={reloadDraft}
            />
          )
        ) : sectionId === 'theme' ? (
          <ThemeSwatches theme={draft.theme} />
        ) : (
          <Galley
            runId={runId}
            draft={draft}
            revisionId={draft.revisionId}
            reloadDraft={reloadDraft}
            sections={[sectionId]}
            hideFindings
            markSourcedClaims={false}
            onEditSection={() => {}}
          />
        )}

        <AgentChangesNote count={changeCount} items={changeItems} />
        <SectionEndNav prev={target(idx - 1)} next={target(idx + 1)} allHref={issueHref} />
      </div>
    </>
  )
}
