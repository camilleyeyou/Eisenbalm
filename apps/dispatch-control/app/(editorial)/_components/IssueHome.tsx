'use client'
/**
 * Phase 56 — front-door data wrapper (Main / Home-Writing / Home-Published).
 *
 * The current issue comes ONLY from `useCurrentRun()` (runs.latest -> run);
 * `/?run=<id>` pins a past issue. Publishing goes only through `publishChain`.
 * Start, Stop, Hold and Release are folded into the slab and footer.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { useCurrentRun } from '@/lib/useCurrentRun'
import { useRole } from '@/lib/role'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { getDraft, ContentPatchError, type DraftResponse } from '@/lib/contentPatchClient'
import { deriveHomeSections, deriveHomeFooter, type HomeSectionRow } from '@/lib/homeSections'
import {
  publishChain,
  derivePublishGate,
  NETWORK_FAILURE_MESSAGE,
  PUBLISH_SLOW_MS,
  PUBLISH_SLOW_NOTICE,
} from '@/lib/publishChain'
import { adminRunHref, sectionEditHref } from '@/lib/issueRouteResolver'
import { triggerRun, cancelRun, discardRun } from '@/lib/pipelineControlClient'
import { deriveEditorHome, homeSlabCopy, COPY } from '@/lib/editorState'
import { formatIssueLine } from '@/lib/issueTitle'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { IssueHomeView, type IssueHomeLinks } from './IssueHomeView'
import HoldStopFooter from './HoldStopFooter'
import DiscardIssueControl from './DiscardIssueControl'

type DraftState = { runId: string; draft: DraftResponse } | { runId: string; error: string } | undefined

const TRY_AGAIN = "That didn't go through. Press the button again."

export default function IssueHome({ runId = null }: { runId?: string | null }) {
  const { getToken } = useAuth()
  const router = useRouter()
  const confirm = useConfirm()
  const cr = useCurrentRun({ runId })
  const role = useRole()
  const latest = useQuery(api.runs.latest, runId ? { workspace_id: DEFAULT_WORKSPACE_ID } : 'skip')
  const selectedPitch = useQuery(api.pitchLog.selectedByRunId, cr.runId ? { runId: cr.runId } : 'skip')
  const issueRow = useQuery(
    api.issues.byIssueNumber,
    cr.issueNumber != null ? { workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: cr.issueNumber } : 'skip',
  )
  const holdMutation = useMutation(api.issues.hold)
  const reopenMutation = useMutation(api.issues.reopen)

  const [draftState, setDraftState] = useState<DraftState>(undefined)
  const [reloadTick, setReloadTick] = useState(0)
  const [publishOk, setPublishOk] = useState(false)
  const [slow, setSlow] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'publishing'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [footerError, setFooterError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [discardBusy, setDiscardBusy] = useState(false)
  const [discardPending, setDiscardPending] = useState(false)
  const [discardError, setDiscardError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [live, setLive] = useState<string | null>(null)
  const latch = useRef(false)
  const lastWritten = useRef(0)

  const runStatus = cr.derivationInputs.runStatus

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Draft load, re-fetched when a running run finishes. getToken is excluded
  // from deps to avoid a refetch loop.
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
  }, [cr.runId, runStatus, reloadTick])

  useEffect(() => {
    const rid = cr.runId
    const n = cr.issueNumber
    if (!rid || n == null) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/review-desk/${encodeURIComponent(rid)}/preview-url?slug=issue-${n}`)
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

  const current = draftState && draftState.runId === cr.runId ? draftState : undefined
  const draft = current && 'draft' in current ? current.draft : undefined
  const draftError = current && 'error' in current ? current.error : null
  const draftForSelector = draftError ? (runStatus === 'running' ? null : undefined) : draft

  const sections = deriveHomeSections({
    draft: draftForSelector,
    qaFindings: cr.qaFindings,
    claimRows: cr.claimRows,
    runStatus,
  })

  const publishedAt = issueRow?.publishedAt ?? cr.runRow?.completedAt ?? cr.derivationInputs.runCompletedAt ?? null

  const footerRaw = deriveHomeFooter({
    stateKind: cr.state.kind,
    sections,
    issue: cr.derivationInputs.issue,
    publishedAt,
    runStatus,
    runCompletedAt: cr.derivationInputs.runCompletedAt,
  })
  const footer =
    footerRaw.kind === 'ready' && cr.title === undefined ? ({ kind: 'loading' } as const) : footerRaw

  // No row may read written until every input has arrived.
  const rowsReady = cr.derivationInputs.issue !== undefined && cr.title !== undefined
  const rows: HomeSectionRow[] | undefined = rowsReady ? sections?.rows : undefined

  const held = cr.derivationInputs.issue === undefined ? undefined : (cr.derivationInputs.issue?.held ?? false)
  const gate = derivePublishGate({ footer, role, held, busy: phase === 'publishing' })

  const pinnedOlder = runId != null && latest !== undefined && latest?.runId !== runId
  const vm = deriveEditorHome({ footer, held, role, rows, pinnedOlder })
  const n = cr.issueNumber
  const slab = homeSlabCopy(vm, {
    issueNumber: n,
    startedAt: cr.runRow?.startedAt,
    publishedAt: issueRow?.publishedAt ?? null,
    now,
    pinned: runId != null,
  })

  // A past Problem / Stopped issue lives on its Behind-the-scenes page.
  useEffect(() => {
    if (runId && (footer.kind === 'failed' || footer.kind === 'stopped')) {
      router.replace(adminRunHref(runId))
    }
  }, [runId, footer.kind, router])

  // Release the publishing latch once the run reads published.
  useEffect(() => {
    if (footer.kind === 'published' && phase === 'publishing') {
      setPhase('idle')
      setPublishOk(false)
      setSlow(false)
      latch.current = false
    }
  }, [footer.kind, phase])

  useEffect(() => {
    if (phase === 'publishing' && publishOk) {
      const t = setTimeout(() => setSlow(true), PUBLISH_SLOW_MS)
      return () => clearTimeout(t)
    }
  }, [phase, publishOk])

  // Announce newly written parts while the writers work.
  useEffect(() => {
    if (vm.state === 'writing' && vm.writtenCount > lastWritten.current) {
      setLive(`Part ${vm.writtenCount} is written`)
    }
    lastWritten.current = vm.writtenCount
  }, [vm.state, vm.writtenCount])

  const issueLabel = n != null ? `Issue ${n}` : 'this issue'

  const stopRun = useCallback(async () => {
    if (!cr.runId) return
    setFooterError(null)
    try {
      await cancelRun(cr.runId, await getToken())
    } catch {
      setFooterError(TRY_AGAIN)
    }
  }, [cr.runId, getToken])

  const discardIssue = useCallback(async () => {
    if (!cr.runId) return
    setDiscardError(null)
    setDiscardBusy(true)
    try {
      const r = await discardRun(cr.runId, await getToken())
      if (r.discardRequested) setDiscardPending(true)
      if (held === true && n != null) {
        try {
          await reopenMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n })
        } catch {
          // best effort: a reused number re-shows Release on Home
        }
      }
    } catch (e) {
      setDiscardError(e instanceof Error && e.message.includes('(409)') ? COPY.discardIssuePublished : COPY.discardIssueFailed)
    } finally {
      setDiscardBusy(false)
    }
  }, [cr.runId, getToken, held, n, reopenMutation])

  useEffect(() => {
    if (vm.state === 'stopped') setDiscardPending(false)
  }, [vm.state])

  const onPrimary = async () => {
    if (latch.current) return
    setActionError(null)
    switch (slab.action) {
      case 'publish': {
        if (!gate.enabled || !cr.runId) return
        latch.current = true
        setPhase('publishing')
        const r = await publishChain({ getToken: () => getToken(), runId: cr.runId })
        if (!r.ok) {
          setActionError(n != null ? COPY.publishFailed.replace('{N}', String(n)) : NETWORK_FAILURE_MESSAGE)
          setPhase('idle')
          latch.current = false
        } else {
          setPublishOk(true)
        }
        return
      }
      case 'start-next':
      case 'start-new':
      case 'start-first': {
        latch.current = true
        setBusy(true)
        try {
          await triggerRun({}, await getToken())
        } catch {
          setActionError(COPY.startFailed)
        } finally {
          setBusy(false)
          latch.current = false
        }
        return
      }
      case 'release': {
        if (n == null) return
        latch.current = true
        setBusy(true)
        try {
          await reopenMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n })
        } catch {
          setActionError(TRY_AGAIN)
        } finally {
          setBusy(false)
          latch.current = false
        }
        return
      }
      case 'stop-stuck': {
        const ok = await confirm({
          title: COPY.stopConfirmTitle,
          body: COPY.stopConfirmBody.replace('{issue}', issueLabel),
          confirmLabel: COPY.stopConfirm,
          cancelLabel: COPY.stopCancel,
          tone: 'default',
        })
        if (!ok || !cr.runId) return
        latch.current = true
        setBusy(true)
        try {
          await cancelRun(cr.runId, await getToken())
        } catch {
          setActionError(TRY_AGAIN)
        } finally {
          setBusy(false)
          latch.current = false
        }
        return
      }
      default:
        return
    }
  }

  const base = process.env.NEXT_PUBLIC_WEB_PREVIEW_BASE
  const links: IssueHomeLinks = {
    preview: previewUrl,
    website: base && n != null ? `${base.replace(/\/$/, '')}/issue/issue-${n}` : null,
    whatHappened: cr.runId ? adminRunHref(cr.runId) : null,
  }

  const onHold = async () => {
    if (n == null) return
    setFooterError(null)
    try {
      await holdMutation({ workspace_id: DEFAULT_WORKSPACE_ID, issueNumber: n, reason: COPY.holdReason })
    } catch {
      setFooterError(TRY_AGAIN)
    }
  }

  let footerEl: React.ReactNode = null
  if (vm.state === 'writing' || vm.state === 'checking') {
    footerEl = (
      <HoldStopFooter mode="stop" onStop={() => void stopRun()} busy={false} issueLabel={issueLabel} error={footerError} />
    )
  } else if (vm.state === 'ready' || vm.state === 'ready-collab') {
    footerEl = (
      <HoldStopFooter mode="hold" onHold={() => void onHold()} busy={false} issueLabel={issueLabel} error={footerError} />
    )
  }

  const showDiscard =
    ['writing', 'checking', 'stuck', 'ready', 'ready-collab', 'held'].includes(vm.state) && runId == null
  if (showDiscard) {
    footerEl = (
      <>
        {footerEl}
        <DiscardIssueControl
          onDiscard={() => void discardIssue()}
          issueLabel={issueLabel}
          busy={discardBusy}
          pending={discardPending}
          error={discardError}
        />
      </>
    )
  }

  const showPublishSlow = slow && phase === 'publishing'

  return (
    <>
      <IssueHomeView
        vm={vm}
        slab={slab}
        issueLine={formatIssueLine({
          issueNumber: n,
          publishedAt: issueRow?.publishedAt,
          scheduledFor: issueRow?.scheduledFor,
          runStartedAt: cr.runRow?.startedAt,
          published: vm.state === 'published',
        })}
        charityName={cr.title}
        blurb={selectedPitch === undefined ? undefined : (selectedPitch?.scoutSummary ?? null)}
        rows={rows}
        hrefFor={(row) => sectionEditHref(row.id, cr.runId ?? '', latest?.runId ?? cr.runId)}
        onPrimary={() => void onPrimary()}
        primaryBusy={busy || phase === 'publishing'}
        actionError={actionError}
        links={links}
        footer={footerEl}
        draftError={footer.kind === 'ready' || footer.kind === 'loading' ? draftError : null}
        onReload={() => {
          setDraftState(undefined)
          setReloadTick((t) => t + 1)
        }}
        live={live}
      />
      {showPublishSlow ? (
        <p role="status" className="mt-6 font-[family-name:var(--font-body)] text-[17px] text-[color:var(--color-ink-soft)]">
          {PUBLISH_SLOW_NOTICE}
        </p>
      ) : null}
    </>
  )
}
