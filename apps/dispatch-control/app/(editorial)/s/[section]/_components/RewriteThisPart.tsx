'use client'
/**
 * Phase 56 -- "Rewrite this part" with a client-side Keep / Go back. The reroll
 * endpoint overwrites the draft, so the old blocks are snapshotted first and
 * re-applied through the content-patch API on Go back.
 */
import { useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { rerollAgent } from '@/lib/pipelineControlClient'
import {
  patchSection,
  patchBonus,
  type ContentBlock,
  type BonusPatchPayload,
} from '@/lib/contentPatchClient'
import { AGENT_FOR_SECTION, COPY, canRewrite } from '@/lib/editorState'

const REWRITE_FAILED =
  "We couldn't rewrite this part just now. Wait a minute and press Rewrite this part again."

interface RewriteThisPartProps {
  runId: string
  sectionId: string
  bonusType?: string
  published: boolean
  runStatus?: string
  currentBlocks: ContentBlock[]
  getRevisionId: () => string
  onRewritten: () => Promise<void> | void
  bonusBody?: (blocks: ContentBlock[]) => BonusPatchPayload
}

type Phase = 'idle' | 'rewriting' | 'choosing' | 'reverting' | 'error'

const ghost =
  'min-h-[48px] w-full sm:w-auto px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] text-[17px] font-semibold editor-focus'

export default function RewriteThisPart(props: RewriteThisPartProps) {
  const { runId, sectionId, bonusType, published, runStatus, currentBlocks, getRevisionId, onRewritten, bonusBody } = props
  const { getToken } = useAuth()
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const snapshot = useRef<ContentBlock[] | null>(null)

  if (!canRewrite({ sectionId, bonusType, published, runStatus })) return null

  async function rewrite() {
    snapshot.current = currentBlocks.map((b) => ({ ...b }))
    setMessage(null)
    setPhase('rewriting')
    try {
      await rerollAgent(runId, AGENT_FOR_SECTION[sectionId] ?? sectionId, await getToken())
    } catch {
      setMessage(REWRITE_FAILED)
      setPhase('error')
      return
    }
    try {
      await onRewritten()
    } catch {
      /* the new text is saved; a failed reload must not hide the choice */
    }
    setPhase('choosing')
  }

  async function goBack() {
    const blocks = snapshot.current
    if (!blocks) return
    setPhase('reverting')
    try {
      const token = await getToken()
      if (sectionId === 'bonus') {
        await patchBonus(
          runId,
          bonusBody ? bonusBody(blocks) : { ifRevisionID: getRevisionId(), body: blocks },
          token,
        )
      } else {
        await patchSection(runId, sectionId, { ifRevisionID: getRevisionId(), blocks }, token)
      }
      await onRewritten()
      setPhase('idle')
    } catch {
      setMessage(COPY.saveFailed)
      setPhase('choosing')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {(phase === 'idle' || phase === 'error') && (
        <button type="button" className={ghost} onClick={() => void rewrite()}>
          {COPY.rewriteButton}
        </button>
      )}
      {(phase === 'rewriting' || phase === 'reverting') && (
        <p
          aria-live="polite"
          className="text-[17px] text-[color:var(--color-amber-text)]"
          style={{ fontFamily: 'var(--font-lora)', margin: 0 }}
        >
          {COPY.rewriteInProgress}
        </p>
      )}
      {phase === 'choosing' && (
        <>
          <p className="text-[17px]" style={{ fontFamily: 'var(--font-lora)', margin: 0 }}>
            {COPY.rewriteResult}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className={ghost}
              onClick={() => {
                setMessage(null)
                setPhase('idle')
              }}
            >
              {COPY.keepVersion}
            </button>
            <button type="button" className={ghost} onClick={() => void goBack()}>
              {COPY.goBack}
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="alert" className="text-[15px] font-semibold text-[color:var(--color-problem)]" style={{ margin: 0 }}>
          {message}
        </p>
      )}
    </div>
  )
}
