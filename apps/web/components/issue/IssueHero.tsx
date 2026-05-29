/**
 * Issue hero — charity header at the top of every issue page.
 * UI-SPEC §IssueHero.
 *
 * Phase 9 restyle: dark editorial treatment with ghost numeral, enlarged
 * charity h1, italic mission with --color-accent left border, and a
 * formatted meta row. DES-01.
 *
 * Renders:
 *   - Ghost numeral: issueNumber, aria-hidden, display font,
 *     clamp(280px,40vw,560px), opacity .025, positioned behind content.
 *   - Issue eyebrow: "Issue N — Month D, YYYY" (.eyebrow class, --color-primary).
 *   - Charity name: <h1> display font clamp(56px,10.5vw,148px), weight 400,
 *     --color-primary with text-shadow glow (--color-primary-glow).
 *   - "by Jesse A. Eisenbalm" italic byline.
 *   - Hero mission: display font italic lede, clamp(22px,2.6vw,32px),
 *     --color-text-dim, with --color-accent left border (2px).
 *   - Meta row: .eyebrow spans for location, "Est. {year}", "{N} min read".
 *   - PDF download link — only when problemPdfUrl is non-null.
 *
 * Voice rules: no exclamation marks. "Est. {year}" never "Est. null".
 * Touch target: PDF link keeps min-h-11 (≥44px). Ghost numeral is aria-hidden
 * and pointer-events:none (decorative only). No <main>.
 */
import type { IssueCharity, IssueNarrator } from '@/lib/sanity/types'

function formatPublishDate(dateStr: string): string {
  // dateStr is ISO-8601 (e.g., "2025-06-05"). Parse in UTC to avoid
  // timezone drift that would shift the day.
  const parts = dateStr.split('-').map(Number)
  const year = parts[0] ?? 2000
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

interface IssueHeroProps {
  charity: IssueCharity
  issueNumber: number
  publishDate: string
  readingTimeMinutes: number
  problemPdfUrl: string | null
  /**
   * Phase 16 (NRR-08): per-issue narrator. Undefined / null / inactive / Jesse
   * all suppress the chip — Jesse is the implicit default. Only an explicit,
   * active, non-Jesse narrator surfaces a chip.
   */
  narrator?: IssueNarrator | null
}

export function IssueHero({
  charity,
  issueNumber,
  publishDate,
  readingTimeMinutes,
  problemPdfUrl,
  narrator,
}: IssueHeroProps) {
  const formattedDate = formatPublishDate(publishDate)
  const issueLabel = `Issue ${issueNumber}`

  return (
    <header className="relative mx-auto w-full max-w-[1340px] overflow-hidden px-4 pt-28 pb-16 sm:px-10 sm:pt-36 sm:pb-20">
      {/*
       * Ghost numeral — decorative issue number behind hero content.
       * aria-hidden: purely decorative, no semantic value.
       * pointer-events:none + user-select:none so it never intercepts
       * interactions. Opacity is static (no animation — no motion guard needed).
       */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-[2%] -translate-y-1/2 select-none font-display font-light italic leading-[0.8] text-[color:var(--color-text)]"
        style={{
          fontSize: 'clamp(280px,40vw,560px)',
          opacity: 0.025,
          zIndex: 0,
        }}
      >
        {issueNumber}
      </span>

      {/* Hero inner content — sits above ghost numeral */}
      <div className="relative" style={{ zIndex: 1 }}>
        {/*
         * Phase 16 (NRR-08) — Narrator chip.
         * Position: above the publish-date line (the eyebrow below carries the
         * semantic publish-date timestamp), per CONTEXT D-19 ("above the
         * publish-date line"). Render only when narrator is set, active, AND
         * not Jesse Eisenbalm — Jesse is the implicit default; an absent /
         * inactive / Jesse narrator renders no chip (NRR-08(b)). The two-
         * condition guard (narrator && narrator.name !== 'Jesse Eisenbalm')
         * is the source-scan contract enforced by
         * apps/web/__tests__/narrator-chip.test.ts. Styling reuses the Phase
         * 12 MED-04 machine-readout convention (font-ui / 11px / uppercase /
         * 0.18em tracking / --color-text-mute) already used in
         * BonusSection.tsx — no new design surface.
         */}
        {narrator && narrator.active && narrator.name !== 'Jesse Eisenbalm' && (
          <p
            data-testid="narrator-chip"
            className="mb-6 font-ui text-[11px] uppercase leading-[1.5] tracking-[0.18em] text-[color:var(--color-text-mute)]"
          >
            Narrated by {narrator.name}
          </p>
        )}

        {/* Issue label — .eyebrow class with --color-primary accent line prefix.
            The publish-date is rendered as a semantic <time> element so screen
            readers + crawlers can parse it; this is also the "publish-date line"
            referenced by CONTEXT D-19 / NRR-08. */}
        <p className="eyebrow mb-9 flex items-center gap-[14px] text-[color:var(--color-primary)]">
          <span className="inline-block h-px w-9 bg-[color:var(--color-primary)]" aria-hidden="true" />
          {issueLabel} —{' '}
          <time dateTime={publishDate}>{formattedDate}</time>
        </p>
        {/* Note: the chip JSX above MUST stay before the <time> element here.
            apps/web/__tests__/narrator-chip.test.ts (NRR-08(e)) source-scans
            for chipPos < timePos as a proxy for rendered DOM-order. */}

        {/* Charity name — primary visual anchor (h1), masthead-scale display.
            Text-shadow glow uses --color-primary-glow for the ambient halo.
            MOT-01: each word reveals via clip-path + translateY + opacity @keyframes
            (CSS-only, Server Component safe — no 'use client', no hooks). The
            animation is component-scoped via a <style> tag (React 19 / Next 15
            hoist to <head> and deduplicate). opacity:0 and clip-path appear ONLY
            inside @keyframes from{} — never as base inline styles — so that the
            globals.css prefers-reduced-motion guard (duration→0.01ms) collapses
            the animation to instant without leaving words permanently hidden. */}
        <h1
          className="mb-10 max-w-[14ch] font-display font-normal leading-[0.92] tracking-[-0.02em] text-[color:var(--color-primary)]"
          style={{
            fontSize: 'clamp(56px,10.5vw,148px)',
            textShadow: '0 0 80px var(--color-primary-glow, rgba(205,164,52,.12))',
          }}
        >
          <style>{`
            @keyframes heroWordReveal {
              from { clip-path: inset(0 0 100% 0); transform: translateY(12px); opacity: 0; }
              to   { clip-path: inset(0 0 0% 0);   transform: translateY(0);    opacity: 1; }
            }
            .hero-word-span {
              display: inline-block;
              animation: heroWordReveal 600ms cubic-bezier(0.4, 0, 0.2, 1) both;
            }
          `}</style>
          {charity.name.split(' ').map((word, i, arr) => (
            <span
              key={i}
              className="hero-word-span"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {word}{i < arr.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>

        {/* Masthead byline */}
        <p className="mb-10 font-body text-[16px] italic leading-[1.55] text-[color:var(--color-text-dim)]">
          by Jesse A. Eisenbalm
        </p>

        {/* Hero mission — display font italic lede with --color-accent left border (2px).
            clamp(22px,2.6vw,32px) per UI-SPEC mission/lede scale. */}
        {charity.missionStatement && (
          <p
            className="mb-10 max-w-[720px] border-l-2 border-[color:var(--color-accent)] pl-6 font-display font-light italic leading-[1.45] text-[color:var(--color-text-dim)]"
            style={{ fontSize: 'clamp(22px,2.6vw,32px)' }}
            aria-label={`Mission: ${charity.missionStatement}`}
          >
            {charity.missionStatement}
          </p>
        )}

        {/* Meta row — .eyebrow spans separated by hairline borders top+bottom.
            At least two .eyebrow usages required (DES-04 tripwire). */}
        <div className="mb-10 flex flex-wrap items-stretch border-t border-b border-[color:var(--color-line)]">
          {charity.focusArea && (
            <span className="eyebrow border-r border-[color:var(--color-line)] px-6 py-[18px]">
              {charity.focusArea}
            </span>
          )}
          <span className="eyebrow border-r border-[color:var(--color-line)] px-6 py-[18px]">
            {charity.location}
          </span>
          {charity.foundingYear != null && (
            <span className="eyebrow border-r border-[color:var(--color-line)] px-6 py-[18px]">
              Est. {charity.foundingYear}
            </span>
          )}
          {readingTimeMinutes > 0 && (
            <span className="eyebrow px-6 py-[18px]">
              {readingTimeMinutes} min read
            </span>
          )}
        </div>

        {/* PDF download — Phase 6 populates this; omit if null.
            min-h-11 preserves ≥44px touch target. */}
        {problemPdfUrl && (
          <a
            href={problemPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-3 border border-[color:var(--color-line-strong)] px-6 py-[14px] font-ui text-[11px] font-medium uppercase leading-[1.5] tracking-[0.08em] text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)]"
            download
          >
            Download the Problem Statement Deck (PDF)
          </a>
        )}
      </div>
    </header>
  )
}
