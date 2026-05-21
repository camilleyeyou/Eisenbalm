/**
 * Podcast slot. UI-SPEC §Podcast Contract (POD-01/02/03).
 * Container: 740px reading measure. Anchor ID: #podcast.
 *
 * Phase 9 dark editorial restyle.
 *
 * POD-01: If audioUrl present → native <audio controls> (accessible source of
 *         truth). Dark audio-player figure wrapper added for print-hide-list.
 * POD-02: If deliberationTranscript present → collapsible disclosure.
 *         Label: "Read full deliberation transcript" / "Hide transcript".
 *         ≥44px touch target on summary. whitespace-pre-wrap transcript body.
 * POD-03: If audioUrl is null → "Audio coming soon." (period, no exclamation).
 *         NO <audio> element rendered. Description + transcript may still show.
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
  const transcript = podcast?.deliberationTranscript ?? null

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

      {/* Collapsible transcript (POD-02) */}
      {transcript && (
        <details className="group">
          <summary
            className="flex cursor-pointer list-none select-none items-center gap-2"
            style={{ minHeight: '44px' }}
          >
            {/* "Read full deliberation transcript" shown when closed; "Hide transcript" shown when open */}
            <span
              className="font-ui text-[12px] font-[500] uppercase leading-[1.5] tracking-[0.08em] underline underline-offset-2 transition-opacity hover:opacity-75 group-open:hidden"
              style={{ color: 'var(--color-primary)' }}
            >
              Read full deliberation transcript
            </span>
            <span
              className="hidden font-ui text-[12px] font-[500] uppercase leading-[1.5] tracking-[0.08em] underline underline-offset-2 transition-opacity hover:opacity-75 group-open:inline"
              style={{ color: 'var(--color-primary)' }}
            >
              Hide transcript
            </span>
          </summary>

          <div
            className="mt-6 rounded-sm p-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
          >
            <pre
              className="whitespace-pre-wrap font-body text-[16px] leading-[1.8]"
              style={{ color: 'var(--color-text-dim)' }}
            >
              {transcript}
            </pre>
          </div>
        </details>
      )}

      <div className="mt-12" aria-hidden="true" />
    </section>
  )
}
