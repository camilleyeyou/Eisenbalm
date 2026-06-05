'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ArchiveIssue } from '@/lib/sanity/types'
import { formatMonthYear } from '@/lib/format'

type Props = { issues: ArchiveIssue[] }

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
      className="relative mb-10 mt-6"
    >
      {/* Badge — issue count */}
      <div className="mb-4 flex justify-end">
        <span
          className="rounded-sm px-2 py-1 font-ui text-[9px] font-medium uppercase tracking-[0.1em]"
          style={{
            color: 'var(--color-primary)',
            background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
            border: '1px solid var(--color-line-strong)',
          }}
        >
          {issues.length} ISSUES
        </span>
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
          const cardStyle: React.CSSProperties = {
            position: 'absolute',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            borderRadius: '2px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--color-card)',
            border: `1px solid ${isFront ? 'var(--color-primary)' : 'var(--color-line)'}`,
            ...getCardStyle(relativeIndex, !reducedMotion),
          }

          const cardInner = (
            <>
              {/* Eyebrow */}
              <span
                className="font-ui text-[11px] uppercase tracking-[0.1em]"
                style={{ color: 'var(--color-text-mute)' }}
              >
                ISSUE {issue.issueNumber} &middot;{' '}
                {formatMonthYear(issue.publishDate).toUpperCase()}
              </span>

              {/* Charity name */}
              <span
                className="font-display text-[22px] font-normal leading-[1.2]"
                style={{ color: 'var(--color-text)' }}
              >
                {issue.charity.name}
              </span>

              {/* Meta lines — only when non-null */}
              <div
                className="mt-auto flex flex-col gap-1 font-ui text-[11px]"
                style={{ color: 'var(--color-text-mute)' }}
              >
                {issue.charity.focusArea ? (
                  <span>{issue.charity.focusArea}</span>
                ) : null}
                {issue.charity.assetRange ? (
                  <span>{issue.charity.assetRange}</span>
                ) : null}
              </div>
            </>
          )

          // Front card is an interactive link; back cards are non-interactive
          if (isFront) {
            return (
              <a
                key={issue.slug}
                href={`/issue/${issue.slug}`}
                aria-label={`Issue ${issue.issueNumber}: ${issue.charity.name}`}
                className="cardswap-card block"
                style={{
                  ...cardStyle,
                  textDecoration: 'none',
                }}
              >
                {cardInner}
              </a>
            )
          }
          return (
            <div
              key={issue.slug}
              aria-hidden="true"
              className="cardswap-card"
              style={{ ...cardStyle, pointerEvents: 'none' }}
            >
              {cardInner}
            </div>
          )
        })}
      </div>

      {/* Prev / Next chevron controls — siblings of scene */}
      <div className="mt-4 flex justify-between">
        <button
          type="button"
          aria-label="Previous issue"
          onClick={() =>
            setActiveIndex((i) => (i - 1 + issues.length) % issues.length)
          }
          className="flex min-h-11 min-w-11 items-center justify-center rounded"
          style={{ color: 'var(--color-text-mute)' }}
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <button
          type="button"
          aria-label="Next issue"
          onClick={() => setActiveIndex((i) => (i + 1) % issues.length)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded"
          style={{ color: 'var(--color-text-mute)' }}
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>

      {/* Indicator dots */}
      <div
        className="mt-2 flex items-center justify-center gap-1"
        role="tablist"
      >
        {issues.map((issue, i) => (
          <button
            key={issue.slug}
            type="button"
            aria-label={`Issue ${issue.issueNumber}`}
            aria-current={i === activeIndex ? 'true' : undefined}
            onClick={() => setActiveIndex(i)}
            className="flex min-h-11 min-w-11 items-center justify-center"
          >
            <span
              style={{
                display: 'block',
                width: i === activeIndex ? 8 : 3,
                height: i === activeIndex ? 8 : 3,
                borderRadius: '9999px',
                backgroundColor:
                  i === activeIndex
                    ? 'var(--color-primary)'
                    : 'var(--color-text-mute)',
                opacity: i === activeIndex ? 1 : 0.5,
                transition: reducedMotion ? 'none' : 'width 200ms ease, height 200ms ease',
              }}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
