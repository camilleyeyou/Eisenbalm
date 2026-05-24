/**
 * Podcast slot. UI-SPEC §Podcast Contract (POD-01/03).
 * Container: 740px reading measure. Anchor ID: #podcast.
 *
 * Phase 9 dark editorial restyle.
 * Phase 13 D-10: Collapsible transcript render removed (POD-02 superseded).
 *   The transcript data field + GROQ projection are retained for the
 *   V2-02 NotebookLM export (D-17 / DEL-CONV-05). Only the reader-facing
 *   collapsible-disclosure render is removed. Readers now see the deliberation
 *   as the inline chat thread in DeliberationSlot (DEL-CONV-04).
 *
 * POD-01: If audioUrl present → native <audio controls> (accessible source of
 *         truth). Dark audio-player figure wrapper added for print-hide-list.
 * POD-03: If audioUrl is null → "Audio coming soon." (period, no exclamation).
 *         NO <audio> element rendered. Description may still show.
 *
 * Voice: "Audio coming soon." (period, not exclamation — UI-SPEC Copywriting).
 * All CSS transitions already neutralized by the globals.css reduced-motion guard.
 * No JS animation added here.
 */
import type { IssuePodcast } from '@/lib/sanity/types'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface PodcastSlotProps {
  podcast: IssuePodcast
}

export function PodcastSlot({ podcast }: PodcastSlotProps) {
  const audioUrl = podcast?.audioUrl ?? null
  const description = podcast?.podcastDescription ?? null

  return (
    <section
      id="podcast"
      className="mx-auto w-full max-w-[740px] px-4 sm:px-6 lg:px-8 print:hidden"
    >
      {/* Top divider */}
      <div
        className="mb-8 h-px"
        style={{ background: 'var(--color-line)' }}
        aria-hidden="true"
      />

      {/* Label row */}
      <div className="mb-6 flex items-center gap-2">
        <span
          className="font-ui text-[11px] font-[500] uppercase leading-[1.5] tracking-[0.12em]"
          style={{ color: 'var(--color-text-dim)' }}
        >
          THE PODCAST
        </span>
        <AnchorCopyButton sectionId="podcast" />
      </div>

      {/* Audio player or empty state */}
      {audioUrl ? (
        <figure
          className="audio-player mb-6 rounded-sm p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
        >
          <audio
            controls
            src={audioUrl}
            className="w-full"
            aria-label={`${description ?? 'Episode'} — podcast audio`}
          >
            Your browser does not support the audio element.
          </audio>
          {description && (
            <figcaption
              className="mt-4 font-body text-[17px] leading-[1.7]"
              style={{ color: 'var(--color-text-dim)' }}
            >
              {description}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="mb-6">
          <p
            className="font-ui text-[13px] leading-[1.5] tracking-[0.04em]"
            style={{ color: 'var(--color-text-dim)' }}
          >
            Audio coming soon.
          </p>
          {description && (
            <p
              className="mt-4 font-body text-[17px] leading-[1.7]"
              style={{ color: 'var(--color-text-dim)' }}
            >
              {description}
            </p>
          )}
        </div>
      )}

      <div className="mt-12" aria-hidden="true" />
    </section>
  )
}
