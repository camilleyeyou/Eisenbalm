/**
 * Bonus section. UI-SPEC §BonusSection.
 * Anchor ID: #bonus.
 *
 * Phase 9 restyle: dark editorial treatment matching GameSlot / EditorialSection.
 * § label prefix + .eyebrow class; headline --color-primary display font;
 * surfaces use --color-card / --color-line tokens.
 *
 * LOCKED constraints:
 *   - <section id="bonus"> NEVER <main> (single-main rule).
 *   - bonusType branching preserved (bigBudget / jingle / specAd).
 *   - Sub-labels exact copy: "BIG BUDGET TREATMENT" / "THE JINGLE" / "THE SPEC AD".
 *   - Jingle audio element retained.
 *   - Storyboards render via next/image fill in the aspect-video container (P17-01; CLS-safe).
 *
 * Branches on bonusType:
 *   - bigBudget: editorial wide (860px), headline + body + storyboard image grid
 *   - jingle:    editorial (680px), headline + body + lyrics + optional <audio>
 *   - specAd:    editorial (680px), headline + body only
 */
import Image from 'next/image'
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
              <div
                key={i}
                className="relative aspect-video overflow-hidden rounded border border-[color:var(--color-line)] bg-[color:var(--color-card)]"
              >
                <Image
                  src={url}
                  alt={`Storyboard ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 430px"
                  className="object-cover"
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
          {/* HTML5 audio player — native controls; Phase 9 PodcastSlot owns the custom player */}
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
        <p className="mb-6 font-ui text-[14px] leading-[1.5] text-[color:var(--color-text-mute)]">
          The audio for this jingle is being produced. Lyrics below.
        </p>
      )}
      {bonus.lyrics && (
        <div className="rounded border border-[color:var(--color-line-strong)] bg-[color:var(--color-card)] px-6 py-5">
          <pre className="whitespace-pre-wrap font-body text-[18px] leading-[1.65] text-[color:var(--color-text-dim)]">
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
        className="mb-10 h-px bg-[color:var(--color-line)]"
        aria-hidden="true"
      />

      {/* Label row: § + "THE BONUS" parent label + anchor button */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center gap-[0.5em]">
          <span
            className="font-ui text-[14px] leading-[1] text-[color:var(--color-accent)]"
            aria-hidden="true"
          >
            §
          </span>
          <span className="eyebrow">THE BONUS</span>
        </div>
        <AnchorCopyButton sectionId="bonus" />
      </div>

      {/* Sub-label: exact copy (BIG BUDGET TREATMENT / THE JINGLE / THE SPEC AD) */}
      <div className="mb-6">
        <span className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] text-[color:var(--color-text-mute)]">
          {subLabel(bonusType)}
        </span>
      </div>

      {/* Headline — display font, --color-primary */}
      <h2 className="mb-8 font-display text-[clamp(38px,5vw,64px)] font-normal leading-[1.05] tracking-[-0.015em] text-[color:var(--color-primary)]">
        {bonus.headline}
      </h2>

      {/* Branch on bonusType */}
      {bonusType === 'bigBudget' && <BigBudgetBonus bonus={bonus} />}
      {bonusType === 'jingle'    && <JingleBonus    bonus={bonus} />}
      {bonusType === 'specAd'    && <SpecAdBonus    bonus={bonus} />}

      <div className="mt-10" aria-hidden="true" />
    </section>
  )
}
