/**
 * Deliberation slot. UI-SPEC §Deliberation.
 * Container: editorial wide (860px). Anchor ID: #deliberation.
 *
 * Phase 2: collapsed accordion with "How this issue was made" trigger.
 * Shows the empty state message — Phase 9 wires Convex subscriptions.
 *
 * Implemented as a <details>/<summary> for zero-JS collapsible
 * (progressive enhancement — JS-free, WCAG-friendly).
 *
 * Voice: "Deliberation data will appear here when the pipeline is connected."
 * (no exclamation marks, no winking)
 */
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

export function DeliberationSlot() {
  return (
    <section
      id="deliberation"
      className="mx-auto w-full max-w-[860px] px-4 sm:px-6 lg:px-8 print:hidden"
    >
      {/* Top divider */}
      <div
        className="mb-8 h-px bg-[color:var(--color-text)]"
        style={{ opacity: 0.12 }}
        aria-hidden="true"
      />

      {/* Collapsed accordion */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
          {/* Accordion trigger — exact copy from UI-SPEC */}
          <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-60 group-open:opacity-100">
            How this issue was made
          </span>
          <AnchorCopyButton sectionId="deliberation" />
          {/* Chevron indicator */}
          <span
            className="ml-auto font-ui text-[14px] text-[color:var(--color-text)] opacity-60 transition-transform group-open:rotate-180"
            aria-hidden="true"
          >
            ▾
          </span>
        </summary>

        {/* Empty state body — Phase 9 wires Convex subscriptions here */}
        <div className="mt-6 pb-2">
          <p className="font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
            Deliberation data will appear here when the pipeline is connected.
          </p>
        </div>
      </details>

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
