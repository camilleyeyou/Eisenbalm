'use client'
/**
 * Phase 52 (HOME-01, HOME-05, HOME-07..09) — front-door data wrapper.
 *
 * The current issue comes ONLY from `useCurrentRun()` (runs.latest ->
 * pipelineRuns.byRunId -> issueNumber); never a max over issue numbers. Every
 * gate input is the hook's or a deduped subscription. The only pipeline fetch
 * is `getDraft`; publishing goes only through `publishChain`.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { useRole } from '@/lib/role'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import { deriveHomeSections, deriveHomeFooter } from '@/lib/homeSections'
import { publishChain, derivePublishGate, PUBLISH_SLOW_MS, PUBLISH_SLOW_NOTICE } from '@/lib/publishChain'
import { issueRunHref, issueFactCheckHref, issueApprovalHref, issueStoryHref } from '@/lib/issueRouteResolver'
import { IssueHomeView, type IssueHomeLinks } from './IssueHomeView'

type DraftState = { runId: string; draft: DraftResponse } | { runId: string; error: string } | undefined

export default function IssueHome() {
  const { getToken } = useAuth()
  const cr = useCurrentRun()
  const role = useRole()
  const selectedPitch = useQuery(api.pitchLog.selectedByRunId, cr.runId ? { runId: cr.runId } : 'skip')
  const issueRow = useQuery(
    api.issues.byIssueNumber,
    cr.issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: cr.issueNumber } : 'skip',
  )
  const [draftState, setDraftState] = useState<DraftState>(undefined)
  const [publishOk, setPublishOk] = useState(false)
  const [slow, setSlow] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'publishing'>('idle')
  const [publishError, setPublishError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const runStatus = cr.derivationInputs.runStatus

  // Draft load, re-fetched when a running run finishes. getToken is excluded
  // from deps (same as the section page) to avoid a refetch loop.
  useEffect(() => {
    const forRun = cr.runId
    if (!forRun) return
    let cancelled = false
    void (async () => {
      try {
        const result = await getDraft(forRun, await getToken())
        if (!cancelled) setDraftState({ runId: forRun, draft: result })
      } catch (e) {
        if (!cancelled) {
          setDraftState({
            runId: forRun,
            error: e instanceof ContentPatchError || e instanceof Error ? e.message : 'Failed to load draft.',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr.runId, runStatus])

  useEffect(() => {
    const runId = cr.runId
    const n = cr.issueNumber
    if (!runId || n == null) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/review-desk/${encodeURIComponent(runId)}/preview-url?slug=issue-${n}`)
        const json = (await res.json()) as { previewUrl?: string | null }
        if (!cancelled) setPreviewUrl(json.previewUrl ?? null)
      } catch {
        if (!cancelled) setPreviewUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cr.runId, cr.issueNumber])

  // A draft or error recorded for another run is never shown.
  const current = draftState && draftState.runId === cr.runId ? draftState : undefined
  const draft = current && 'draft' in current ? current.draft : undefined
  const draftError = current && 'error' in current ? current.error : null

  // A failed fetch while running means "being written"; otherwise never clean.
  const draftForSelector = draftError ? (runStatus === 'running' ? null : undefined) : draft

  const sections = deriveHomeSections({
    draft: draftForSelector,
    qaFindings: cr.qaFindings,
    claimRows: cr.claimRows,
    runStatus,
  })

  // The issues row is not flipped by the pipeline; the run's completedAt is
  // the real publish date in practice.
  const publishedAt = issueRow?.publishedAt ?? cr.runRow?.completedAt ?? cr.derivationInputs.runCompletedAt ?? null

  const footerRaw = deriveHomeFooter({
    stateKind: cr.state.kind,
    sections,
    claimSummaryBlocking: cr.claimSummary?.blocking,
    signOffsLoaded: cr.signOffs !== undefined,
    issue: cr.derivationInputs.issue,
    publishedAt,
    runStatus,
    runCompletedAt: cr.derivationInputs.runCompletedAt,
  })
  // Terminal kinds never wait on content or title.
  const footer =
    (footerRaw.kind === 'fix' || footerRaw.kind === 'ready') && cr.title === undefined
      ? ({ kind: 'loading' } as const)
      : footerRaw

  // HOME-09: no row may read clean until every gate input has arrived.
  const rowsReady =
    cr.claimSummary !== undefined &&
    cr.signOffs !== undefined &&
    cr.derivationInputs.issue !== undefined &&
    cr.title !== undefined

  const held = cr.derivationInputs.issue === undefined ? undefined : (cr.derivationInputs.issue?.held ?? false)
  const gate = derivePublishGate({ footer, role, held, busy: phase === 'publishing' })

  // Release the publishing hold once the run reads published.
  useEffect(() => {
    if (footer.kind === 'published' && phase === 'publishing') {
      setPhase('idle')
      setPublishOk(false)
      setSlow(false)
    }
  }, [footer.kind, phase])

  useEffect(() => {
    if (phase === 'publishing' && publishOk) {
      const t = setTimeout(() => setSlow(true), PUBLISH_SLOW_MS)
      return () => clearTimeout(t)
    }
  }, [phase, publishOk])

  const publishNotice = slow ? PUBLISH_SLOW_NOTICE : null

  const onConfirmPublish = async () => {
    if (!gate.enabled || !cr.runId) return
    setPhase('publishing')
    const r = await publishChain({
      getToken: () => getToken(),
      runId: cr.runId,
      activeSignOffs: cr.signOffs ?? {},
    })
    if (!r.ok) {
      setPublishError(r.message)
      setPhase('idle')
    } else {
      // Stay 'publishing' until the footer reads published; never auto-retry.
      setPublishOk(true)
    }
  }

  const n = cr.issueNumber
  const base = process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE
  const links: IssueHomeLinks = {
    admin: '/run',
    pastIssues: '/issues',
    runDetails: n != null && cr.runId ? issueRunHref(n, cr.runId) : null,
    factCheck: n != null ? issueFactCheckHref(n) : null,
    approval: n != null ? issueApprovalHref(n) : null,
    storyChoice: n != null ? issueStoryHref(n) : null,
    liveIssue: base && n != null ? `${base.replace(/\/$/, '')}/issue/issue-${n}` : null,
    preview: previewUrl,
  }

  return (
    <IssueHomeView
      issueNumber={cr.issueNumber}
      title={cr.title}
      subject={selectedPitch === undefined ? undefined : (selectedPitch?.scoutSummary ?? null)}
      sections={rowsReady ? sections : undefined}
      footer={footer}
      gate={gate}
      draftError={
        footer.kind === 'fix' || footer.kind === 'ready' || footer.kind === 'loading' ? draftError : null
      }
      publishing={phase === 'publishing'}
      publishError={publishError}
      publishNotice={publishNotice}
      confirming={phase === 'confirming'}
      onRequestPublish={() => {
        setPublishError(null)
        setPhase('confirming')
      }}
      onConfirmPublish={() => void onConfirmPublish()}
      onCancelPublish={() => setPhase('idle')}
      links={links}
    />
  )
}
