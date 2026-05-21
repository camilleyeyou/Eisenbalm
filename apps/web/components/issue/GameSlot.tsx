'use client'

/**
 * Game slot. UI-SPEC §Game Contract.
 * Container: editorial wide (860px). Anchor ID: #game.
 *
 * Phase 9 restyle: dark click-to-load placeholder UX. SECURITY PATH UNCHANGED.
 *
 * Security contract (LOCKED — GAM-01, GAM-03):
 *   sandbox="allow-scripts"  ALWAYS — exactly this one token.
 *   sandbox MUST NEVER include the same-origin escape token (it would
 *   defeat the sandbox; the embedded page could rewrite its own
 *   sandbox attribute).
 *   __tests__/game-sandbox.test.ts is the source-scan tripwire (Plan 07-04)
 *   that fails the build if the forbidden token literal appears in
 *   this file.
 *
 * Rendering decision tree:
 *   1. game === null               → "Game coming soon." placeholder (no iframe)
 *   2. game.embedCode invalid      → <GameFallback /> ("Game unavailable.")
 *                                    + one-shot Convex qaCorrections.insert write
 *   3. game.embedCode valid        → click-to-load placeholder → on activation,
 *                                    swap to <iframe sandbox="allow-scripts"
 *                                    srcDoc={injectGameHead(embedCode)} ...>
 *
 * The click-to-load pattern (Phase 9):
 *   - Renders a dark placeholder with a ripple play button while started===false.
 *   - On button click, sets started=true which swaps in the validated iframe.
 *   - The iframe STILL uses injectGameHead(embedCode) — the security path is
 *     NOT bypassed. Only the visual timing changes (load-on-demand vs eager).
 *   - The validate-and-report useEffect fires on mount regardless of started state.
 *
 * The Convex write happens in a useEffect guarded by a useRef so it fires
 * at most once per component mount even under React Strict Mode double-
 * invocation in dev. If runId is null (e.g. an issue authored manually
 * in Sanity Studio without a pipeline run), the write is skipped —
 * runId is v.string() in the schema; passing undefined throws.
 */

import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'
import type { IssueGame } from '@/lib/sanity/types'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'
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

  // Fire-and-forget Convex write on validation failure. Guarded by:
  //   - reportedRef (one shot per component mount; survives re-renders)
  //   - !runId (Issues authored manually in Sanity have no runId — skip)
  //   - validation.valid (only fire on FAILURE)
  // Andrew sees the row in the Phase 9 deliberation layer where
  // agentId='game-validator' will be color-coded by severity='error'.
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
      // Convex write failures must not break the page render. Log to
      // browser console so Andrew can investigate; the fallback UI is
      // already on-screen regardless.
      console.error('[GameSlot] qaCorrections.insert failed', err)
    })
  }, [validation, runId, insertQaCorrection])

  return (
    <section
      id="game"
      className="mx-auto w-full max-w-[860px] border-t border-[color:var(--color-line)] px-4 py-16 sm:px-6 lg:px-8 print:hidden"
    >
      {/* Label row: § glyph + "THE GAME" label in --color-text-mute */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex items-center gap-[0.5em]">
          <span
            className="font-ui text-[14px] leading-[1] text-[color:var(--color-accent)]"
            aria-hidden="true"
          >
            §
          </span>
          <span className="eyebrow">THE GAME</span>
        </div>
        <AnchorCopyButton sectionId="game" />
      </div>

      {/* Optional headline from Sanity */}
      {game?.headline && (
        <h2 className="mb-4 font-display text-[clamp(38px,5vw,64px)] font-normal leading-[1.05] tracking-[-0.015em] text-[color:var(--color-primary)]">
          {game.headline}
        </h2>
      )}

      {/* Optional description */}
      {game?.description && (
        <p className="mb-6 font-body text-[19px] font-light leading-[1.7] text-[color:var(--color-text-dim)]">
          {game.description}
        </p>
      )}

      {/*
       * Game frame area.
       * Dark --color-surface background with --color-line-strong border.
       * Height: 280px mobile / 480px desktop (mockup's min-height 480px for desktop).
       * overflow-hidden clips any internal game content that exceeds the box.
       */}
      <div className="relative h-[280px] w-full overflow-hidden border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] sm:h-[480px]">
        {srcdoc ? (
          started ? (
            // SECURITY (GAM-01, GAM-03): allow-scripts ONLY.
            // The sandbox attribute below uses exactly one token. The
            // Vitest source-scan test in __tests__/game-sandbox.test.ts
            // fails the build if any forbidden escape token appears in
            // this file.
            <iframe
              sandbox="allow-scripts"
              srcDoc={srcdoc}
              title={game?.headline ?? 'Game'}
              className="absolute inset-0 h-full w-full border-none"
            />
          ) : (
            // Dark click-to-load placeholder — ripple play button.
            // On click, sets started=true which swaps in the EXISTING validated iframe.
            // The security path (validateEmbedCode + injectGameHead) is NOT bypassed.
            <div className="relative flex h-full flex-col items-center justify-center gap-5 px-16 text-center">
              {/* Radial glow behind button */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(138,155,122,.08), transparent 70%)',
                }}
                aria-hidden="true"
              />
              {/* Ripple play button — CSS animation; reduced-motion guard in globals.css neutralizes it */}
              <button
                type="button"
                aria-label="Play the game"
                onClick={() => setStarted(true)}
                className="relative flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--color-scout)] bg-[rgba(138,155,122,0.08)] transition-[background,box-shadow,transform] hover:scale-105 hover:bg-[rgba(138,155,122,0.18)] hover:shadow-[0_0_50px_-10px_var(--color-scout)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-scout)]"
                style={{ minWidth: '88px', minHeight: '88px' }}
              >
                {/* Ripple ring — animate-ping is the Tailwind built-in ripple;
                    prefers-reduced-motion guard in globals.css neutralizes animation-duration */}
                <span
                  className="pointer-events-none absolute h-[88px] w-[88px] animate-ping rounded-full border border-[color:var(--color-scout)] opacity-60"
                  aria-hidden="true"
                />
                {/* Play triangle SVG */}
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="var(--color-text)"
                  aria-hidden="true"
                  style={{ marginLeft: '5px' }}
                >
                  <polygon points="6,4 26,15 6,26" />
                </svg>
              </button>
              {game?.headline && (
                <p className="relative font-display text-[34px] font-normal leading-[1.1] text-[color:var(--color-text)]">
                  {game.headline}
                </p>
              )}
              {game?.description && (
                <p className="relative max-w-[300px] font-body text-[14px] italic leading-[1.6] text-[color:var(--color-text-mute)]">
                  {game.description}
                </p>
              )}
            </div>
          )
        ) : game?.embedCode ? (
          // Validator rejected embedCode — show fallback. The Convex
          // write is fired by the useEffect above (one shot per mount).
          <GameFallback />
        ) : (
          // No game on this issue — empty-state placeholder.
          <div className="flex h-full items-center justify-center px-8">
            <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text-mute)]">
              Game coming soon.
            </p>
          </div>
        )}
      </div>

      <div className="mt-10" aria-hidden="true" />
    </section>
  )
}
