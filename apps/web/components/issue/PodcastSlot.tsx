'use client'

/**
 * PodcastSlot — restyled for Phase 19 Dispatch magazine layout.
 * UI-SPEC §Section 11 Podcast Player.
 *
 * POD-01: HTML5 <audio> element (controls) gated on audioUrl — PRESERVED.
 * POD-03: Empty state "Audio coming soon." (period, no exclamation) — PRESERVED.
 *
 * Phase 19 changes:
 *   - Custom play/pause button (52px circle, accent bg) with dynamic aria-label:
 *     "Play episode" when paused / "Pause episode" when playing (POD-01 a11y)
 *   - Progress bar 3px, var(--color-line-strong) track + accent fill
 *   - Player widget: var(--color-surface) bg, border, padding 24px
 *   - id="pod" (unchanged)
 *
 * Phase 13 D-10 preserved:
 *   - No collapsible transcript render (D-10 removed the details/summary block)
 *   - No transcript data reference in this component
 *
 * Note: <audio controls> is kept as the accessible source of truth per POD-01.
 * The custom player button is layered on top for visual treatment.
 * The audio element uses visually-hidden controls (opacity 0) while the
 * custom UI drives it via ref.
 */

import { useRef, useState } from 'react'
import type { IssuePodcast } from '@/lib/sanity/types'
import { NumberedSection } from '@/components/dispatch/NumberedSection'
import { sectionMeta } from '@/lib/dispatch/copy'
import '@/components/dispatch/bands.css'

interface PodcastSlotProps {
  podcast: IssuePodcast
}

export function PodcastSlot({ podcast }: PodcastSlotProps) {
  const audioUrl = podcast?.audioUrl ?? null
  const description = podcast?.podcastDescription ?? null
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handlePlayPause() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
    setPlaying(!playing)
  }

  function handleTimeUpdate() {
    const el = audioRef.current
    if (!el || !el.duration) return
    setProgress((el.currentTime / el.duration) * 100)
    setCurrentTime(formatTime(el.currentTime))
  }

  function handleLoadedMetadata() {
    const el = audioRef.current
    if (!el) return
    setDuration(formatTime(el.duration))
  }

  function handleEnded() {
    setPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
  }

  return (
    <NumberedSection
      id="pod"
      number="08"
      label={sectionMeta('pod').label}
      title="The Dispatch Podcast"
      compact
    >
      {description && <p className="d-body d-pod-desc">{description}</p>}
      <div className="d-wave" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="d-wave-bar" />
        ))}
      </div>

      {audioUrl ? (
        <div className="d-pod-player">
          <button
            type="button"
            className="d-pill d-pill--ink"
            aria-label={playing ? 'Pause episode' : 'Play episode'}
            onClick={handlePlayPause}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <div className="d-pod-track-wrap">
            <div
              className="d-pod-track"
              onClick={(e) => {
                const el = audioRef.current
                if (!el || !el.duration) return
                const rect = e.currentTarget.getBoundingClientRect()
                el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration
              }}
            >
              <span className="d-pod-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="d-label d-pod-time">
              {currentTime} / {duration}
            </p>
          </div>

          {/* HTML5 audio element (POD-01 — accessible source of truth) */}
          <audio
            ref={audioRef}
            controls
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            style={{ display: 'none' }}
            aria-label={`${description ?? 'Episode'} — podcast audio`}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : (
        // POD-03: empty state — "Audio coming soon." (period, not exclamation)
        <p className="d-body">Audio coming soon.</p>
      )}
    </NumberedSection>
  )
}
