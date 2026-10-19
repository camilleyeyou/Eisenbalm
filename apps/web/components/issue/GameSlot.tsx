'use client'

/**
 * GameSlot — Phase 55 Dispatch band (section 05, black field).
 *
 * SECURITY CONTRACT (LOCKED — GAM-01, GAM-03):
 *   The iframe sandbox attribute is ALWAYS exactly the single allow-scripts token.
 *   Never include the same-origin escape token (defeats the sandbox).
 *   __tests__/game-sandbox.test.ts is the source-scan tripwire.
 *
 * ACCESSIBILITY (GAM-A11Y):
 *   Play button: aria-label="Play {game.headline}" (icon-only button)
 *
 * The iframe is mounted on load as a live preview. Play restarts it (remount
 * via key) and focuses it.
 *
 * runId prop preserved for Stage B GAM-05.
 *
 * Phase 9 security path preserved:
 *   - validateEmbedCode + injectGameHead — UNCHANGED
 *   - Convex qaCorrections.insert on validation failure — UNCHANGED
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'
import type { IssueGame } from '@/lib/sanity/types'
import { GameFallback } from '@/components/issue/GameFallback'
import { injectGameHead, validateEmbedCode } from '@/lib/game-validator'
import { NumberedSection } from '@/components/dispatch/NumberedSection'
import { sectionMeta } from '@/lib/dispatch/copy'
import '@/components/dispatch/bands.css'

interface GameSlotProps {
  game: IssueGame
  runId: string | null
}

export function GameSlot({ game, runId }: GameSlotProps) {
  const insertQaCorrection = useMutation(api.qaCorrections.insert)
  const reportedRef = useRef(false)
  const [runKey, setRunKey] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)

  // After a restart, move focus into the game.
  useEffect(() => {
    if (runKey > 0) frameRef.current?.focus()
  }, [runKey])

  // Run the validator once per render. Pure function — no I/O.
  const validation = game?.embedCode
    ? validateEmbedCode(game.embedCode)
    : null

  // Build the srcdoc only when the validator passed.
  const srcdoc = game?.embedCode && validation?.valid
    ? injectGameHead(game.embedCode)
    : null

  // Fire-and-forget Convex write on validation failure.
  useEffect(() => {
    if (!validation || validation.valid) return
    if (reportedRef.current) return
    if (!runId) return
    reportedRef.current = true
    insertQaCorrection({
      runId,
      sectionName: 'game',
      reason: `Game validator rejected embedCode: ${validation.reason}`,
      severity: 'error',
      accepted: false,
      agentId: 'game-validator',
      axis: 'hard-rule',
    }).catch((err) => {
      console.error('[GameSlot] qaCorrections.insert failed', err)
    })
  }, [validation, runId, insertQaCorrection])

  return (
    <NumberedSection
      id="game"
      number={sectionMeta('game').number}
      label={sectionMeta('game').label}
      title={game?.headline ?? null}
    >
      <div className="d-game-grid">
        <div className="d-game-copy">
          {game?.description && <p className="d-body d-game-desc">{game.description}</p>}
          {srcdoc && (
            <button
              type="button"
              className="d-pill d-game-play"
              aria-label={`Play ${game?.headline ?? 'the game'}`}
              onClick={() => setRunKey((k) => k + 1)}
            >
              ▶ Play {game?.headline}
            </button>
          )}
        </div>
        <div className="d-game-frame">
          {srcdoc ? (
            // SECURITY (GAM-01, GAM-03): allow-scripts ONLY.
            // game-sandbox.test.ts is the source-scan tripwire.
            // Do NOT add any other sandbox tokens here.
            <iframe
              key={runKey}
              ref={frameRef}
              sandbox="allow-scripts"
              srcDoc={srcdoc}
              title={game?.headline ?? 'Game'}
              loading="lazy"
            />
          ) : game?.embedCode ? (
            // Validator rejected embedCode: show fallback
            <GameFallback />
          ) : (
            <p className="d-body d-game-desc">Game coming soon.</p>
          )}
        </div>
      </div>
    </NumberedSection>
  )
}
