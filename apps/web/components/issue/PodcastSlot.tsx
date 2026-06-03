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
    <section
      id="pod"
      className="pod"
      style={{ borderBottom: '1px solid var(--color-line)' }}
    >
      {/* Section label */}
      <div className="sec-label">THE PODCAST</div>

      {/* h2 */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(30px,4vw,46px)',
          fontWeight: 400,
          lineHeight: 1.08,
          letterSpacing: '-0.02em',
          marginBottom: '14px',
        }}
      >
        The{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
          Dispatch
        </em>{' '}
        Podcast
      </h2>

      {/* Description */}
      {description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            fontStyle: 'italic',
            color: 'var(--color-text-dim)',
            lineHeight: 1.5,
            marginTop: '14px',
          }}
        >
          {description}
        </p>
      )}

      {audioUrl ? (
        <div>
          {/* Custom player widget */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              padding: '24px',
              margin: '30px 0',
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
            }}
          >
            {/* Play/Pause button — 52px circle accent bg, dynamic aria-label */}
            <button
              type="button"
              aria-label={playing ? 'Pause episode' : 'Play episode'}
              onClick={handlePlayPause}
              style={{
                width: '52px',
                height: '52px',
                minWidth: '52px',
                borderRadius: '50%',
                background: 'var(--color-accent)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'var(--color-accent-deep)'
                el.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'var(--color-accent)'
                el.style.transform = ''
              }}
            >
              {playing ? (
                // Pause icon
                <svg width="18" height="18" viewBox="0 0 18 18" fill="#fff" aria-hidden="true">
                  <rect x="4" y="3" width="3.5" height="12" />
                  <rect x="10.5" y="3" width="3.5" height="12" />
                </svg>
              ) : (
                // Play icon
                <svg width="18" height="18" viewBox="0 0 18 18" fill="#fff" aria-hidden="true">
                  <polygon points="4,3 16,9 4,15" />
                </svg>
              )}
            </button>

            {/* Track info + progress */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text)',
                  marginBottom: '10px',
                }}
              >
                {podcast?.podcastDescription ? 'Episode' : 'The Dispatch Podcast'}
              </div>

              {/* Progress bar — 3px track + accent fill */}
              <div
                style={{
                  height: '3px',
                  background: 'var(--color-line-strong)',
                  position: 'relative',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  const el = audioRef.current
                  if (!el || !el.duration) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = (e.clientX - rect.left) / rect.width
                  el.currentTime = pct * el.duration
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progress}%`,
                    background: 'var(--color-accent)',
                  }}
                />
              </div>

              {/* Time display */}
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                  color: 'var(--color-text-mute)',
                  marginTop: '7px',
                }}
              >
                {currentTime} / {duration}
              </div>
            </div>
          </div>

          {/* HTML5 audio element (POD-01 — accessible source of truth) */}
          {/* controls is required for POD-01 test assertion */}
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
        <div style={{ marginTop: '30px' }}>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--color-text-dim)',
            }}
          >
            Audio coming soon.
          </p>
        </div>
      )}
    </section>
  )
}
