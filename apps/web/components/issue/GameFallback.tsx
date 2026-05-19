/**
 * Phase 7 fallback for when the game validator rejects embedCode.
 *
 * Copy is locked to "Game unavailable." (period, no exclamation, no
 * apology). Jesse's voice: dry, precise. See CLAUDE.md voice section.
 *
 * Pure display component — no logic, no state, no Convex calls. The
 * Convex `qaCorrections.insert` write lives in GameSlot.tsx where the
 * mutation hook can be bound to the runId prop.
 *
 * Typography mirrors the Phase 2 "Interactive version of this section
 * is loading." placeholder so the visual rhythm is unchanged.
 */
export function GameFallback() {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
        Game unavailable.
      </p>
    </div>
  )
}
