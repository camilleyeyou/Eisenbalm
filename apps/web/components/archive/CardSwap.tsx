'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { formatMonthYear } from '@/lib/format'
import '@/components/dispatch/pages.css'

type Props = { issues: ArchiveIssue[] }

const TONES = ['green', 'blue', 'red', 'yellow'] as const

type CSSProperties = React.CSSProperties & {
  position?: string
  width?: string
  height?: string
  transformStyle?: string
  [key: string]: string | number | undefined
}

function getCardStyle(
  relativeIndex: number,
  isTransitioning: boolean,
): CSSProperties {
  const transition = isTransitioning
    ? 'transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 500ms ease'
    : 'none'

  if (relativeIndex === 0) {
    return {
      transform: 'translateZ(0) rotateX(0deg)',
      opacity: 1,
      zIndex: 3,
      transition,
    }
  }
  if (relativeIndex === 1) {
    return {
      transform: 'translateZ(-50px) translateY(18px) rotateX(2deg)',
      opacity: 0.55,
      zIndex: 2,
      transition,
    }
  }
  if (relativeIndex === 2) {
    return {
      transform: 'translateZ(-100px) translateY(36px) rotateX(4deg)',
      opacity: 0.35,
      zIndex: 1,
      transition,
    }
  }
  return {
    opacity: 0,
    pointerEvents: 'none',
    zIndex: 0,
    transition,
  }
}

export function CardSwap({ issues }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reduced-motion gate — read at mount (client-only)
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Auto-advance timer
  useEffect(() => {
    if (reducedMotion || issues.length <= 1) return
    intervalRef.current = setInterval(
      () => setActiveIndex((i) => (i + 1) % issues.length),
      6000,
    )
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [reducedMotion, issues.length])

  if (issues.length === 0) return null

  function pause() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function resume() {
    if (reducedMotion || issues.length <= 1 || intervalRef.current) return
    intervalRef.current = setInterval(
      () => setActiveIndex((i) => (i + 1) % issues.length),
      6000,
    )
  }

  return (
    <section
      aria-label="Archive preview"
      data-print-hide="true"
      className="d-swap"
    >
      {/* Badge — issue count */}
      <div className="d-swap-badge">
        <span className="d-eyebrow d-muted">{issues.length} ISSUES</span>
      </div>

      {/* 3D Scene */}
      <div
        className="cardswap-scene relative mx-auto max-w-full"
        style={{ perspective: '1200px', width: 'min(500px, 100%)', height: '400px' }}
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        {issues.map((issue, i) => {
          const relativeIndex = (i - activeIndex + issues.length) % issues.length
          const isFront = relativeIndex === 0
          const tone = TONES[i % TONES.length]
          const cardStyle: React.CSSProperties = {
            position: 'absolute',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            ...getCardStyle(relativeIndex, !reducedMotion),
          }

          const cardInner = (
            <>
              {/* Eyebrow */}
              <span className={`d-swap-strip d-eyebrow d-tone-${tone}`}>
                ISSUE {issue.issueNumber} &middot;{' '}
                {formatMonthYear(issue.publishDate).toUpperCase()}
              </span>
              <span className="d-swap-body">
                {/* Charity name */}
                <span className="d-swap-name">{issue.charity.name}</span>

                {/* Meta lines — only when non-null */}
                <span className="d-swap-meta">
                  {issue.charity.focusArea ? (
                    <span>{issue.charity.focusArea}</span>
                  ) : null}
                  {issue.charity.assetRange ? (
                    <span>{issue.charity.assetRange}</span>
                  ) : null}
                </span>
              </span>
            </>
          )

          // Front card is an interactive link; back cards are non-interactive
          if (isFront) {
            return (
              <a
                key={issue.slug}
                href={`/issue/${issue.slug}`}
                aria-label={`Issue ${issue.issueNumber}: ${issue.charity.name}`}
                className="cardswap-card d-swap-card"
                style={cardStyle}
              >
                {cardInner}
              </a>
            )
          }
          return (
            <div
              key={issue.slug}
              aria-hidden="true"
              className="cardswap-card d-swap-card"
              style={{ ...cardStyle, pointerEvents: 'none' }}
            >
              {cardInner}
            </div>
          )
        })}
      </div>

      {/* Prev / Next chevron controls — siblings of scene */}
      <div className="d-swap-controls">
        <button
          type="button"
          aria-label="Previous issue"
          onClick={() =>
            setActiveIndex((i) => (i - 1 + issues.length) % issues.length)
          }
          className="d-swap-ctl"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <button
          type="button"
          aria-label="Next issue"
          onClick={() => setActiveIndex((i) => (i + 1) % issues.length)}
          className="d-swap-ctl"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>

      {/* Indicator dots */}
      <div className="d-swap-dots" role="tablist">
        {issues.map((issue, i) => (
          <button
            key={issue.slug}
            type="button"
            aria-label={`Issue ${issue.issueNumber}`}
            aria-current={i === activeIndex ? 'true' : undefined}
            onClick={() => setActiveIndex(i)}
            className="d-swap-dot"
          >
            <span />
          </button>
        ))}
      </div>
    </section>
  )
}
