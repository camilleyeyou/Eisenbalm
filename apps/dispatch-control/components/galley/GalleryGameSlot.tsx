'use client'
/**
 * Phase 32 (GLY-01, D-05) — galley game render.
 *
 * Renders the game in a sandboxed iframe (`sandbox="allow-scripts"` +
 * `srcDoc`) using the Plan 32-04 galley game validator, matching the reader
 * site's `GameSlot.tsx` sandbox contract byte-for-byte on the `sandbox`
 * attribute. The galley is read-only — unlike the reader site, a validation
 * failure here does NOT write a `qaCorrections` row (that already happens on
 * the live reader render); it only renders a fallback box.
 *
 * SECURITY (LOCKED): `sandbox` is EXACTLY `"allow-scripts"` — never add the
 * same-origin escape token, or any other token.
 */
import { injectGameHead, validateEmbedCode } from '@/lib/galley/galleyGameValidator'

export interface GalleryGame {
  headline?: string
  description?: string
  embedCode?: string
}

interface GalleryGameSlotProps {
  game: GalleryGame
}

export default function GalleryGameSlot({ game }: GalleryGameSlotProps) {
  const validation = game?.embedCode ? validateEmbedCode(game.embedCode) : null
  const srcDoc = game?.embedCode && validation?.valid ? injectGameHead(game.embedCode) : null

  return (
    <section id="galley-game" className="galley-game-slot">
      <h2 className="galley-h2">{game?.headline ?? 'The Game'}</h2>
      {game?.description && <p className="galley-deck">{game.description}</p>}

      {srcDoc ? (
        // SECURITY: allow-scripts ONLY — never add the same-origin escape token.
        <iframe
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          title={game?.headline ?? 'Game'}
          className="galley-game-frame"
          style={{ width: '100%', minHeight: '360px', border: '1px solid var(--color-ink)' }}
        />
      ) : game?.embedCode ? (
        <div className="galley-game-fallback">Game unavailable</div>
      ) : (
        <div className="galley-game-fallback">Game coming soon.</div>
      )}
    </section>
  )
}
