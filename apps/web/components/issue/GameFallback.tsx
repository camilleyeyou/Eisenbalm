/**
 * Phase 7 fallback for when the game validator rejects embedCode.
 *
 * Copy is locked to "Game unavailable." (period, no exclamation, no
 * apology). Jesse's voice: dry, precise. See CLAUDE.md voice section.
 *
 * Phase 9 restyle: dark --color-surface container with --color-text-mute
 * text. Pure display component — no logic, no state, no Convex calls.
 * The Convex `qaCorrections.insert` write lives in GameSlot.tsx where the
 * mutation hook can be bound to the runId prop.
 */
export function GameFallback() {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text-mute)]">
        Game unavailable.
      </p>
    </div>
  )
}
