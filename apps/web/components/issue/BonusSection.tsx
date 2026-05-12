/**
 * Bonus section. UI-SPEC §5.
 * Anchor ID: #bonus.
 *
 * Branches on bonusType:
 *   - bigBudget: editorial wide (860px), headline + body + storyboard image grid
 *   - jingle:    editorial (680px), headline + body + lyrics + optional <audio>
 *   - specAd:    editorial (680px), headline + body only
 *
 * Sub-labels (exact copy from UI-SPEC copywriting contract):
 *   bigBudget → "BIG BUDGET TREATMENT"
 *   jingle    → "THE JINGLE"
 *   specAd    → "THE SPEC AD"
 *
 * Voice rules: "The audio for this jingle is being produced. Lyrics below."
 * (no exclamation marks, no winking)
 */
import type { IssueBonus, BonusType } from '@/lib/sanity/types'
import { PortableTextRenderer } from './PortableTextRenderer'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

function subLabel(bonusType: BonusType): string {
  switch (bonusType) {
    case 'bigBudget': return 'BIG BUDGET TREATMENT'
    case 'jingle':    return 'THE JINGLE'
    case 'specAd':    return 'THE SPEC AD'
  }
}

function containerClass(bonusType: BonusType): string {
  // bigBudget gets editorial-wide container (860px); others use editorial (680px)
  const maxW = bonusType === 'bigBudget' ? 'max-w-[860px]' : 'max-w-[680px]'
  return `mx-auto w-full ${maxW} px-4 sm:px-6 lg:px-8`
}

interface BigBudgetBonusProps {
  bonus: NonNullable<IssueBonus>
}
function BigBudgetBonus({ bonus }: BigBudgetBonusProps) {
  const storyboards = bonus.storyboards ?? []
  return (
    <>
      <PortableTextRenderer value={bonus.body} className="mb-8" />
      {storyboards.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {storyboards.map((sb, i) => {
            const url = sb.asset?.url
            if (!url) return null
            return (
              <div key={i} className="aspect-video overflow-hidden rounded bg-[color:var(--color-surface,var(--color-bg))]">
                {/* next/image would be ideal but requires explicit dimensions;
                    using <img> with object-fit for the Phase 2 scaffold.
                    Phase 5 can convert to next/image with urlFor dimensions. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Storyboard ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

interface JingleBonusProps {
  bonus: NonNullable<IssueBonus>
}
function JingleBonus({ bonus }: JingleBonusProps) {
  return (
    <>
      <PortableTextRenderer value={bonus.body} className="mb-6" />
      {bonus.sunoAudioUrl ? (
        <div className="mb-6">
          {/* HTML5 audio player — Phase 9 upgrades to full player */}
          <audio
            controls
            src={bonus.sunoAudioUrl}
            className="w-full"
            aria-label={`Audio: ${bonus.headline}`}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : (
        <p className="mb-6 font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
          The audio for this jingle is being produced. Lyrics below.
        </p>
      )}
      {bonus.lyrics && (
        <div className="rounded border border-[color:var(--color-border,#e5e7eb)] bg-[color:var(--color-surface,var(--color-bg))] px-6 py-4">
          <pre className="whitespace-pre-wrap font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
            {bonus.lyrics}
          </pre>
        </div>
      )}
    </>
  )
}

interface SpecAdBonusProps {
  bonus: NonNullable<IssueBonus>
}
function SpecAdBonus({ bonus }: SpecAdBonusProps) {
  return <PortableTextRenderer value={bonus.body} />
}

interface BonusSectionProps {
  bonus: IssueBonus
  bonusType: BonusType
}

export function BonusSection({ bonus, bonusType }: BonusSectionProps) {
  if (!bonus) return null

  return (
    <section id="bonus" className={containerClass(bonusType)}>
      {/* Top divider */}
      <div
        className="mb-8 h-px bg-[color:var(--color-text)]"
        style={{ opacity: 0.12 }}
        aria-hidden="true"
      />

      {/* Label row: "THE BONUS" parent label + sub-label + anchor button */}
      <div className="mb-2 flex items-center gap-2">
        <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-60">
          THE BONUS
        </span>
        <AnchorCopyButton sectionId="bonus" />
      </div>
      <div className="mb-4">
        <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-40">
          {subLabel(bonusType)}
        </span>
      </div>

      {/* Headline */}
      <h2 className="mb-6 font-display text-[28px] font-semibold leading-[1.15] text-[color:var(--color-primary)] sm:text-[36px]">
        {bonus.headline}
      </h2>

      {/* Branch on bonusType */}
      {bonusType === 'bigBudget' && <BigBudgetBonus bonus={bonus} />}
      {bonusType === 'jingle'    && <JingleBonus    bonus={bonus} />}
      {bonusType === 'specAd'    && <SpecAdBonus    bonus={bonus} />}

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
