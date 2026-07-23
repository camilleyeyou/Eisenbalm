/**
 * Shared 1c-styled placeholder for not-yet-built Dispatch Control screens
 * (Phase 30 D-02: "honest placeholder" pattern — same approach Phase 21 used
 * for the original 7 route stubs, restyled to the 1c token system).
 *
 * Server Component — no client interactivity needed for a static notice.
 * Uses ONLY 1c CSS-variable tokens (bg-[color:var(--color-*)]) — never
 * literal Tailwind gray-scale or white classes.
 *
 * quick 260722-tv1: `min-h-[60vh]` -> `min-h-[320px]` — this screen can
 * render inside a workspace ContextPanel's sticky overflow-y-auto rail,
 * where a viewport-sized min-height forced pointless rail scroll.
 */
interface PlaceholderScreenProps {
  title: string
  phase: string
  blurb: string
}

export default function PlaceholderScreen({ title, phase, blurb }: PlaceholderScreenProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-start justify-center gap-4 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-10">
      <span
        className="inline-block rounded-[2px] bg-[color:var(--color-marigold)] px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-ink)]"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        coming in {phase}
      </span>
      <h1
        className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--color-ink)]"
      >
        {title}
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
        {blurb}
      </p>
    </div>
  )
}
