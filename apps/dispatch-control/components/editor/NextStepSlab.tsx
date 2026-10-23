'use client'

import { useId } from 'react'
import Link from 'next/link'

export interface NextStepSlabProps {
  sentence: string
  explanation?: string
  primary?: { label: string; onClick?: () => void; href?: string; busy?: boolean }
  working?: boolean
  ghost?: { label: string; href: string }
  link?: { label: string; href: string; external?: boolean }
  error?: string | null
  /** Polite announcement text (aria-live, visually hidden). */
  live?: string
}

const PRIMARY_CLS =
  'min-h-[56px] w-full sm:w-auto px-8 inline-flex items-center justify-center bg-[color:var(--color-cobalt)] text-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[18px] font-semibold hover:brightness-[.92] editor-focus'

export default function NextStepSlab({ sentence, explanation, primary, working, ghost, link, error, live }: NextStepSlabProps) {
  const id = useId()
  let action: React.ReactNode = null
  if (primary) {
    if (primary.href) {
      action = (
        <Link href={primary.href} data-primary="" className={PRIMARY_CLS}>
          {primary.label}
        </Link>
      )
    } else {
      action = (
        <button
          type="button"
          data-primary=""
          aria-busy={primary.busy ? 'true' : undefined}
          onClick={() => {
            if (primary.busy) return
            primary.onClick?.()
          }}
          className={PRIMARY_CLS}
        >
          {primary.label}
        </button>
      )
    }
  } else if (working) {
    action = (
      <div className="min-h-[56px] flex items-center gap-3 font-[family-name:var(--font-ui)] text-[17px] font-semibold text-[color:var(--color-amber-text)]">
        <span aria-hidden="true" className="editor-pulse inline-block h-3 w-3 rounded-full bg-[color:var(--color-amber-text)]" />
        Working
      </div>
    )
  } else if (ghost) {
    action = (
      <Link
        href={ghost.href}
        className="min-h-[48px] px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[17px] font-semibold inline-flex items-center justify-center editor-focus"
      >
        {ghost.label}
      </Link>
    )
  }

  return (
    <section
      aria-labelledby={id}
      className="bg-[color:var(--color-card)] border-2 border-[color:var(--color-ink)] p-4 sm:p-8 flex flex-col sm:flex-row sm:flex-wrap gap-x-8 gap-y-6"
    >
      <div className="sm:flex-[1_1_440px]">
        <p id={id} className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-ink-soft)]">
          Your next step
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-[1.2] sm:text-[32px] sm:leading-[1.15] font-medium">
          {sentence}
        </p>
        {explanation ? (
          <p className="mt-3 max-w-[620px] font-[family-name:var(--font-body)] text-[17px] leading-[1.55] text-[color:var(--color-ink-soft)]">
            {explanation}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-stretch sm:items-end justify-center gap-2">
        {action}
        {link ? (
          <a
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="min-h-[48px] inline-flex items-center justify-center font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-cobalt)] underline editor-focus"
          >
            {link.label}
          </a>
        ) : null}
        {error ? (
          <p role="alert" className="font-[family-name:var(--font-ui)] text-[15px] font-semibold text-[color:var(--color-problem)]">
            {error}
          </p>
        ) : null}
      </div>
      {live ? (
        <p aria-live="polite" className="sr-only">
          {live}
        </p>
      ) : null}
    </section>
  )
}
