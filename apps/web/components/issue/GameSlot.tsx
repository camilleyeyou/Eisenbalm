/**
 * Game slot. UI-SPEC §4.
 * Container: editorial wide (860px). Anchor ID: #game.
 *
 * Phase 2: renders the placeholder slot for all states.
 * Phase 7 will wire the real iframe with the full sandbox validator.
 *
 * The iframe is included here WITH the correct security attribute
 * (sandbox="allow-scripts" — never allow-same-origin) so the security
 * contract is correct from Phase 2, before Phase 7 hardens the validator.
 *
 * Fixed height: 360px desktop, 280px mobile.
 * Slot message: "Interactive version of this section is loading."
 */
import type { IssueGame } from '@/lib/sanity/types'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface GameSlotProps {
  game: IssueGame
}

export function GameSlot({ game }: GameSlotProps) {
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
       * Phase 2: always shows placeholder with the slot message.
       * Phase 7: swaps to a real iframe after sandbox validator is in place.
       *
       * When embedCode is present but Phase 7 hasn't landed, we show the
       * placeholder rather than unsanitized embed code. The iframe element
       * below uses sandbox="allow-scripts" (never allow-same-origin) per
       * critical rule #8. Phase 7 hardens this with the full validator.
       */}
      <div className="relative h-[280px] w-full overflow-hidden rounded border border-[color:var(--color-border,#e5e7eb)] bg-[color:var(--color-surface,var(--color-bg))] sm:h-[360px]">
        {/* Phase 2 placeholder — always shown; Phase 7 replaces with iframe */}
        <div className="flex h-full items-center justify-center px-8">
          <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
            Interactive version of this section is loading.
          </p>
        </div>
        {/*
         * Hidden iframe stub — correct sandbox in place for Phase 7.
         * Kept hidden in Phase 2 since embedCode has not been validated
         * by the Phase 7 validator yet. DO NOT remove sandbox="allow-scripts".
         */}
        {game?.embedCode && (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // The iframe is intentionally hidden (display:none) in Phase 2.
          // Phase 7 will surface it after the sandbox validator is wired.
          <iframe
            style={{ display: 'none' }}
            // SECURITY: allow-scripts only — never allow-same-origin
            sandbox="allow-scripts"
            srcDoc={game.embedCode}
            title={game.headline ?? 'Game'}
            className="absolute inset-0 h-full w-full border-none"
          />
        )}
      </div>

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
