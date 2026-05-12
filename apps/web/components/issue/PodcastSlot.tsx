/**
 * Podcast slot. UI-SPEC §Podcast.
 * Container: editorial (680px). Anchor ID: #podcast.
 *
 * Phase 2:
 *   - If audioUrl present: <audio controls> + podcastDescription below
 *   - If no audioUrl: "Audio coming soon." empty state
 *   - If deliberationTranscript present: collapsible "Read the deliberation transcript"
 *
 * Phase 9/10 wires the full player and transcript.
 *
 * Voice: "Audio coming soon." (period, not exclamation)
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
      className="mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8 print:hidden"
    >
      {/* Top divider */}
      <div
        className="mb-8 h-px bg-[color:var(--color-text)]"
        style={{ opacity: 0.12 }}
        aria-hidden="true"
      />

      {/* Label row */}
      <div className="mb-4 flex items-center gap-2">
        <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-60">
          THE PODCAST
        </span>
        <AnchorCopyButton sectionId="podcast" />
      </div>

      {/* Audio player or empty state */}
      {audioUrl ? (
        <div className="mb-6">
          <audio
            controls
            src={audioUrl}
            className="w-full"
            aria-label="Episode audio"
          >
            Your browser does not support the audio element.
          </audio>
          {description && (
            <p className="mt-4 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
              {description}
            </p>
          )}
        </div>
      ) : (
        <p className="mb-6 font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
          Audio coming soon.
        </p>
      )}

      {/* Collapsible transcript — Phase 9/10 wires this with the full NotebookLM output */}
      {transcript && (
        <details className="group">
          <summary className="cursor-pointer list-none select-none">
            <span className="font-ui text-[14px] leading-[1.5] text-[color:var(--color-primary)] underline underline-offset-2 transition-opacity hover:opacity-75">
              Read the deliberation transcript
            </span>
          </summary>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
              {transcript}
            </pre>
          </div>
        </details>
      )}

      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
