'use client'

/**
 * GameSlot — restyled for Phase 19 Dispatch magazine layout.
 * UI-SPEC §Section 8 Full-Width Game.
 *
 * SECURITY CONTRACT (LOCKED — GAM-01, GAM-03):
 *   sandbox="allow-scripts"  ALWAYS — exactly this one token.
 *   Never include the same-origin escape token (defeats the sandbox).
 *   __tests__/game-sandbox.test.ts is the source-scan tripwire.
 *
 * ACCESSIBILITY (GAM-A11Y):
 *   Play button: aria-label="Play {game.headline}" (icon-only button)
 *
 * Phase 19 changes:
 *   - Full-width game layout, bg var(--color-surface)
 *   - Head grid 1.3fr 1fr — left: sec-label + h2, right: description
 *   - 76px accent circle play button with ripple ::before (disabled under reduced-motion)
 *   - id="game" (unchanged)
 *   - runId prop preserved for Stage B GAM-05
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

interface GameSlotProps {
  game: IssueGame
  runId: string | null
}

export function GameSlot({ game, runId }: GameSlotProps) {
  const insertQaCorrection = useMutation(api.qaCorrections.insert)
  const reportedRef = useRef(false)
  const [started, setStarted] = useState(false)

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
    <div id="game" className="fw">
      <div className="game">
        <div className="game-in" style={{ maxWidth: '1180px', margin: '0 auto' }}>
          {/* Head grid: 1.3fr 1fr — left: label + h2, right: description */}
          <div
            className="game-head"
          >
            <div>
              <div className="sec-label" style={{ marginBottom: '14px' }}>
                THE GAME
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(30px,4vw,46px)',
                  fontWeight: 400,
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                }}
              >
                {game?.headline ? (
                  <>
                    <em style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
                      {game.headline}
                    </em>
                  </>
                ) : (
                  'The Game'
                )}
              </h2>
            </div>
            <div
              className="game-desc"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontStyle: 'italic',
                color: 'var(--color-text-dim)',
                lineHeight: 1.6,
              }}
            >
              {game?.description ?? ''}
            </div>
          </div>

          {/* Game frame */}
          <div
            className="game-frame"
            style={{
              background: '#fff',
              border: '1px solid var(--color-line-strong)',
              minHeight: '420px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {srcdoc ? (
              started ? (
                // SECURITY (GAM-01, GAM-03): allow-scripts ONLY.
                // game-sandbox.test.ts is the source-scan tripwire.
                // Do NOT add any other sandbox tokens here.
                <iframe
                  sandbox="allow-scripts"
                  srcDoc={srcdoc}
                  title={game?.headline ?? 'Game'}
                  style={{ width: '100%', minHeight: '420px', border: 'none' }}
                />
              ) : (
                // Play placeholder — 76px accent circle play button with ripple
                <div
                  className="game-ph"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '18px',
                    textAlign: 'center',
                    padding: '50px',
                  }}
                >
                  {/* Play button — 76px circle, accent bg, ripple ::before */}
                  <button
                    type="button"
                    aria-label={`Play ${game?.headline ?? 'the game'}`}
                    onClick={() => setStarted(true)}
                    className="play"
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: 'none',
                      position: 'relative',
                      transition: 'transform 0.25s, box-shadow 0.25s',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.transform = 'scale(1.07)'
                      el.style.boxShadow = '0 12px 40px -10px var(--color-accent)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.transform = ''
                      el.style.boxShadow = ''
                    }}
                  >
                    {/* Ripple ring — .play::before is the CSS animation (globals.css) */}
                    {/* Play triangle SVG */}
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 30 30"
                      fill="#fff"
                      aria-hidden="true"
                      style={{ marginLeft: '4px' }}
                    >
                      <polygon points="6,4 26,15 6,26" />
                    </svg>
                  </button>

                  {game?.headline && (
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '26px',
                        color: 'var(--color-text)',
                        lineHeight: 1.1,
                      }}
                    >
                      {game.headline}
                    </p>
                  )}
                  {game?.description && (
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: 'var(--color-text-mute)',
                        maxWidth: '300px',
                        lineHeight: 1.5,
                      }}
                    >
                      {game.description}
                    </p>
                  )}
                </div>
              )
            ) : game?.embedCode ? (
              // Validator rejected embedCode — show fallback
              <GameFallback />
            ) : (
              // No game — empty state
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '420px' }}>
                <p
                  style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '14px',
                    color: 'var(--color-text-mute)',
                  }}
                >
                  Game coming soon.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
