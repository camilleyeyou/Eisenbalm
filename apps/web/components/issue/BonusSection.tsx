/**
 * BonusSection — restyled for Phase 19 Dispatch magazine layout.
 * UI-SPEC §Section 9 Spec-Ad Bonus.
 *
 * LOCKED constraints:
 *   - <section id="bonus"> — canonical anchor
 *   - bonusType branching preserved (bigBudget / jingle / specAd)
 *   - bigBudget/jingle branches: existing markup preserved (untouched)
 *   - specAd branch: Phase 19 ADVERTISEMENT — SPEC treatment
 *
 * Phase 19 changes (specAd only):
 *   - ad box max-width 760px, border var(--color-text), bg #FFFDF8
 *   - "ADVERTISEMENT — SPEC" tab via ::before pseudo (globals.css handles .ad::before)
 *   - 2-col justified body (column-count:2; collapse below 980px)
 *   - ScrollReveal wrapper
 *   - id="bonus" (unchanged)
 *
 * Phase 19 note: .ad styles handled via globals.css .ad-wrap / inline styles here.
 * Storyboards render via next/image fill in aspect-video container (P17-01; CLS-safe).
 */
import Image from 'next/image'
import type { IssueBonus, BonusType } from '@/lib/sanity/types'
import { PortableTextRenderer } from './PortableTextRenderer'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'
import { ScrollReveal } from './ScrollReveal'

function subLabel(bonusType: BonusType): string {
  switch (bonusType) {
    case 'bigBudget': return 'BIG BUDGET TREATMENT'
    case 'jingle':    return 'THE JINGLE'
    case 'specAd':    return 'THE SPEC AD'
  }
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
  return (
    <div className="ad-wrap">
      {/*
       * Ad box — max-width 760px, ADVERTISEMENT — SPEC tab via ::before,
       * 2-col justified body, accent hr
       */}
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          border: '1px solid var(--color-text)',
          padding: '48px 56px',
          background: '#FFFDF8',
          position: 'relative',
        }}
      >
        {/* ADVERTISEMENT — SPEC tab — pseudo content injected via ::before in globals.css */}
        {/* We use a positioned span since CSS ::before doesn't work on divs in all contexts */}
        <span
          style={{
            position: 'absolute',
            top: '-1px',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#FFFDF8',
            padding: '0 14px',
            fontFamily: 'var(--font-ui)',
            fontSize: '9px',
            letterSpacing: '0.16em',
            color: 'var(--color-text-mute)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
          aria-hidden="true"
        >
          ADVERTISEMENT — SPEC
        </span>

        {/* Section label — centered, accent */}
        <div
          className="sec-label"
          style={{ justifyContent: 'center', color: 'var(--color-accent)' }}
        >
          {subLabel('specAd')}
        </div>

        {/* h2 — Fraunces clamp(28px,3.5vw,40px) weight 400 centered */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,3.5vw,40px)',
            fontWeight: 400,
            textAlign: 'center',
            lineHeight: 1.1,
            marginBottom: '8px',
          }}
        >
          {bonus.headline}
        </h2>

        {/* Ad sub: Fraunces 20px italic centered accent */}
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontStyle: 'italic',
            textAlign: 'center',
            color: 'var(--color-accent)',
            marginBottom: '28px',
          }}
        >
          {/* Sub defaults to headline if no separate subtitle in Sanity */}
          A premium product, donated fully.
        </p>

        {/* Accent rule */}
        <div
          style={{
            height: '2px',
            background: 'var(--color-accent)',
            width: '60px',
            margin: '0 auto 28px',
          }}
          aria-hidden="true"
        />

        {/* Body — 2-col justified, Newsreader 17px weight 300 */}
        <div
          className="body"
          style={{
            fontSize: '17px',
            columnCount: 2,
            columnGap: '32px',
            textAlign: 'justify',
          }}
        >
          <PortableTextRenderer value={bonus.body} />
        </div>
      </div>
    </div>
  )
}

interface BonusSectionProps {
  bonus: IssueBonus
  bonusType: BonusType
}

export function BonusSection({ bonus, bonusType }: BonusSectionProps) {
  if (!bonus) return null

  // specAd gets Phase 19 full treatment
  if (bonusType === 'specAd') {
    return (
      <section id="bonus">
        <ScrollReveal>
          <SpecAdBonus bonus={bonus} />
        </ScrollReveal>
      </section>
    )
  }

  // bigBudget/jingle: existing markup preserved untouched
  const maxW = bonusType === 'bigBudget' ? 'max-w-[860px]' : 'max-w-[680px]'
  return (
    <section id="bonus" className={`mx-auto w-full ${maxW} px-4 sm:px-6 lg:px-8`}>
      <div className="mb-10 h-px bg-[color:var(--color-line)]" aria-hidden="true" />

      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center gap-[0.5em]">
          <span className="font-ui text-[14px] leading-[1] text-[color:var(--color-accent)]" aria-hidden="true">
            §
          </span>
          <span className="eyebrow">THE BONUS</span>
        </div>
        <AnchorCopyButton sectionId="bonus" />
      </div>

      <div className="mb-6">
        <span className="font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] text-[color:var(--color-text-mute)]">
          {subLabel(bonusType)}
        </span>
      </div>

      <h2 className="mb-8 font-display text-[clamp(38px,5vw,64px)] font-normal leading-[1.05] tracking-[-0.015em] text-[color:var(--color-primary)]">
        {bonus.headline}
      </h2>

      {bonusType === 'bigBudget' && <BigBudgetBonus bonus={bonus} />}
      {bonusType === 'jingle'    && <JingleBonus    bonus={bonus} />}

      <div className="mt-10" aria-hidden="true" />
    </section>
  )
}
