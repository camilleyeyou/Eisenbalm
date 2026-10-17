/**
 * BonusSection — Phase 55 Dispatch band (section 06, red field).
 * bonusType branching preserved (bigBudget / jingle / specAd).
 * Storyboards render via next/image fill in a relative aspect-video wrapper (CLS-safe).
 */
import Image from 'next/image'
import type { IssueBonus, BonusType } from '@/lib/sanity/types'
import { PortableTextRenderer } from './PortableTextRenderer'
import { NumberedSection } from '@/components/dispatch/NumberedSection'
import { AdSummary } from '@/components/dispatch/AdSummary'
import { bonusLabel } from '@/lib/dispatch/copy'
import type { FrontPageRow } from '@/lib/sanity/types'
import '@/components/dispatch/bands.css'

interface BigBudgetBonusProps {
  bonus: NonNullable<IssueBonus>
}
function BigBudgetBonus({ bonus }: BigBudgetBonusProps) {
  const storyboards = bonus.storyboards ?? []
  return (
    <>
      <div className="d-prose"><PortableTextRenderer value={bonus.body} /></div>
      {storyboards.length > 0 && (
        <div className="d-bonus-storyboards">
          {storyboards.map((sb, i) => {
            const url = sb.asset?.url
            if (!url) return null
            return (
              <div
                key={i}
                className="relative aspect-video overflow-hidden"
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
      <div className="d-prose"><PortableTextRenderer value={bonus.body} /></div>
      {bonus.sunoAudioUrl ? (
        <div className="d-bonus-audio">
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
        <p className="d-body">
          The audio for this jingle is being produced. Lyrics below.
        </p>
      )}
      {bonus.lyrics && (
        <pre className="d-bonus-lyrics">{bonus.lyrics}</pre>
      )}
    </>
  )
}

interface SpecAdBonusProps {
  bonus: NonNullable<IssueBonus>
  adSummary?: { title: string | null; rows: FrontPageRow[] } | null
}
function SpecAdBonus({ bonus, adSummary }: SpecAdBonusProps) {
  return (
    <div className="d-bonus-ad">
      <p className="d-label d-bonus-marker">Advertisement (spec)</p>
      <div className="d-prose">
        <PortableTextRenderer value={bonus.body} />
      </div>
      {adSummary && <AdSummary summary={adSummary} />}
    </div>
  )
}

interface BonusSectionProps {
  bonus: IssueBonus
  bonusType: BonusType
  adSummary?: { title: string | null; rows: FrontPageRow[] } | null
}

export function BonusSection({ bonus, bonusType, adSummary }: BonusSectionProps) {
  if (!bonus) return null
  return (
    <NumberedSection
      id="bonus"
      number="06"
      label={bonusLabel(bonusType)}
      title={bonus.headline ?? null}
    >
      {bonusType === 'bigBudget' && <BigBudgetBonus bonus={bonus} />}
      {bonusType === 'jingle' && <JingleBonus bonus={bonus} />}
      {bonusType === 'specAd' && <SpecAdBonus bonus={bonus} adSummary={adSummary} />}
    </NumberedSection>
  )
}
