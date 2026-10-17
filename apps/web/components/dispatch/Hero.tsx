import './top.css'
import Image from 'next/image'
import type { FactChip } from '@/lib/dispatch/derive'
import type { IssueNarrator } from '@/lib/sanity/types'
import { FUND_CTA, HERO_EYEBROW, READ_STORY_CTA, STICKER_LINES } from '@/lib/dispatch/copy'

export function Hero({
  issueNumber,
  charityName,
  headline,
  dek,
  chips,
  readTime,
  heroImage,
  narrator,
}: {
  issueNumber: number
  charityName: string
  headline: string
  dek: string | null
  chips: FactChip[]
  readTime: string
  heroImage: { url: string; alt: string | null; width: number | null; height: number | null } | null
  narrator?: IssueNarrator | null
}) {
  return (
    <section id="story" aria-labelledby="story-title" className="d-hero">
      <div className="d-container d-hero-grid">
        <div className="d-hero-copy">
          <div className="d-hero-eyebrow">
            <span className="d-pill d-pill--ink d-pill--compact">{HERO_EYEBROW}</span>
            <span className="d-label">{`Issue ${issueNumber} · ${readTime}`}</span>
            {narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm' && (
              <span className="d-label" data-testid="narrator-chip">
                Narrated by {narrator.name}
              </span>
            )}
          </div>
          <p className="d-body d-hero-charity">{charityName}</p>
          <h1 id="story-title" className="d-display">
            {headline}
          </h1>
          {dek && <p className="d-body d-hero-dek">{dek}</p>}
          {chips.length > 0 && (
            <dl className="d-chips">
              {chips.map((c) => (
                <div key={c.label} className="d-chip">
                  <dt className="d-label">{c.label}</dt>
                  <dd>{c.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="d-hero-ctas">
            <a href="#origin" className="d-pill d-pill--ink">
              {READ_STORY_CTA}
            </a>
            <a href="#buy" className="d-pill d-pill--paper">
              {FUND_CTA}
            </a>
          </div>
        </div>
        <div className="d-hero-art-wrap">
          {heroImage ? (
            <div className="d-hero-art">
              <Image
                src={heroImage.url}
                alt={heroImage.alt ?? charityName}
                fill
                sizes="(max-width: 640px) 100vw, 380px"
                className="d-hero-photo"
              />
            </div>
          ) : (
            <div className="d-hero-art d-hero-art--shapes" aria-hidden="true">
              <span className="d-hero-circle" />
              <span className="d-hero-shape d-hero-shape--a" />
              <span className="d-hero-shape d-hero-shape--b" />
            </div>
          )}
          <p className="d-sticker" aria-hidden="true">
            <span>{STICKER_LINES[0]}</span>
            <span>{STICKER_LINES[1]}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
