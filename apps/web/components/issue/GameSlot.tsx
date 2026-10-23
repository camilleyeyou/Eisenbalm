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
 * via key), scrolls the stage into view and focuses it. An optional Full screen
 * toggle fullscreens the parent-page stage div only (the iframe is untouched).
 *
 * How to play: goal / howToPlay / controls are additive Sanity fields; legacy
 * issues without them render exactly as before.
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
  const stageRef = useRef<HTMLDivElement>(null)
  const [fullscreenOk, setFullscreenOk] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const goal = game?.goal?.trim() ?? ''
  const controls = game?.controls?.trim() ?? ''
  const steps = (game?.howToPlay ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 3)
  const hasInstructions = Boolean(goal) || steps.length > 0 || Boolean(controls)
  const splitTokens = controls
    .split(/\s*(?:·|\/|,|\bor\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
  const controlTokens = splitTokens.length > 0 ? splitTokens : controls ? [controls] : []

  function play() {
    setRunKey((k) => k + 1)
  }

  // After a restart, bring the stage into view and move focus into the game.
  useEffect(() => {
    if (runKey === 0) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    stageRef.current?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    frameRef.current?.focus({ preventScroll: true })
  }, [runKey])

  // Full screen is feature-detected (absent in jsdom and on iPhone Safari).
  useEffect(() => {
    setFullscreenOk(Boolean(document.fullscreenEnabled))
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.()?.catch?.(() => {})
    } else {
      stageRef.current?.requestFullscreen?.()?.catch?.(() => {})
    }
  }

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
        <aside className="d-game-copy">
          {game?.description && <p className="d-body d-game-desc">{game.description}</p>}
          {hasInstructions && (
            <div className="d-game-howto" role="group" aria-labelledby="game-howto-title">
              <p id="game-howto-title" className="d-eyebrow d-game-howto-title">How to play</p>
              {goal && <p className="d-game-goal">{goal}</p>}
              {steps.length > 0 && (
                <ol className="d-game-steps">
                  {steps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              )}
              {controls && (
                <p className="d-game-controls">
                  <span className="d-label">Controls</span>
                  {controlTokens.map((t) => <kbd key={t}>{t}</kbd>)}
                </p>
              )}
            </div>
          )}
          {srcdoc && (
            <div className="d-game-actions">
              <button
                type="button"
                className="d-pill d-game-play"
                aria-label={`Play ${game?.headline ?? 'the game'}`}
                onClick={play}
              >
                ▶ Play {game?.headline}
              </button>
              {fullscreenOk && (
                <button
                  type="button"
                  className="d-pill d-game-full"
                  onClick={toggleFullscreen}
                  aria-pressed={isFullscreen}
                >
                  {isFullscreen ? 'Exit full screen' : 'Full screen'}
                </button>
              )}
            </div>
          )}
        </aside>
        <div className="d-game-stage" ref={stageRef}>
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
      </div>
    </NumberedSection>
  )
}
