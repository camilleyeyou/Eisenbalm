/**
 * How to use — minimal stub (Phase 30 D-02). Only needs to exist so the nav
 * coverage gate (Plan 30-05's nav.test.ts) passes. Full content (weekly loop,
 * color legend, house rules) lands in Plan 30-07.
 */
export default function HowToUsePage() {
  return (
    <div className="max-w-xl space-y-2 p-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--color-ink)]">
        How to use
      </h1>
      <p className="text-sm text-[color:var(--color-ink-soft)]">
        Weekly loop, color legend, and house rules — content lands in Plan 30-07.
      </p>
    </div>
  )
}
