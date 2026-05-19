'use client'

/**
 * Game slot. UI-SPEC §4.
 * Container: editorial wide (860px). Anchor ID: #game.
 *
 * Phase 7: real iframe with sandbox validator + CSP injection.
 *
 * Security contract (LOCKED — GAM-01, GAM-03):
 *   sandbox="allow-scripts"  ALWAYS
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
 *   3. game.embedCode valid        → <iframe srcDoc={injectGameHead(embedCode)} ...>
 *
 * The Convex write happens in a useEffect guarded by a useRef so it fires
 * at most once per component mount even under React Strict Mode double-
 * invocation in dev. If runId is null (e.g. an issue authored manually
 * in Sanity Studio without a pipeline run), the write is skipped —
 * runId is v.string() in the schema; passing undefined throws.
 */

import { useEffect, useRef } from 'react'
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
      className="mx-auto w-full max-w-[860px] px-4 sm:px-6 lg:px-8 print:hidden"
    >
      {/* Top divider */}
      <div
        className="mb-8 h-px bg-[color:var(--color-text)]"
        style={{ opacity: 0.12 }}
        aria-hidden="true"
      />

      {/* Label row */}
      <div className="mb-4 flex items-center gap-2">
        <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-60">
          THE GAME
        </span>
        <AnchorCopyButton sectionId="game" />
      </div>

      {/* Optional headline from Sanity */}
      {game?.headline && (
        <h2 className="mb-4 font-display text-[28px] font-semibold leading-[1.15] text-[color:var(--color-primary)] sm:text-[36px]">
          {game.headline}
        </h2>
      )}

      {/* Optional description */}
      {game?.description && (
        <p className="mb-4 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
          {game.description}
        </p>
      )}

      {/*
       * Game frame area.
       * Container styles MUST NOT change — Phase 2 sized this to
       * 280px mobile / 360px desktop with overflow-hidden to clip
       * any internal game content that exceeds the box. GAM-06 mobile
       * substrate is provided by injectGameHead's CSS reset.
       */}
      <div className="relative h-[280px] w-full overflow-hidden rounded border border-[color:var(--color-border,#e5e7eb)] bg-[color:var(--color-surface,var(--color-bg))] sm:h-[360px]">
        {srcdoc ? (
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
        ) : game?.embedCode ? (
          // Validator rejected embedCode — show fallback. The Convex
          // write is fired by the useEffect above (one shot per mount).
          <GameFallback />
        ) : (
          // No game on this issue — empty-state placeholder.
          <div className="flex h-full items-center justify-center px-8">
            <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
              Game coming soon.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
