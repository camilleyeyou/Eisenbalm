'use client'

/**
 * SiteHeader — fixed nav (transparent at top → cream glass on scroll) with real mobile disclosure.
 * UI-SPEC §Navigation + §Accessibility Contract + §Motion Contract.
 *
 * Desktop (≥960px): wordmark left, inline link row + "Buy Lip Balm" CTA right.
 * Mobile (<960px): wordmark left, hamburger button right → disclosure panel.
 *
 * Mobile disclosure contract (LOCKED — mobile nav must NOT disappear):
 *   - <button aria-expanded={open} aria-controls="site-mobile-menu"
 *             aria-label={open ? 'Close menu' : 'Open menu'}>
 *   - Panel id="site-mobile-menu" contains 4 nav links + "Buy Lip Balm" CTA.
 *   - Escape key closes the menu and returns focus to the button.
 *   - Clicking any nav link closes the menu.
 *   - Closed by default.
 *   - ≥44px touch targets (min-h-11 + py-2 on all links; min-h-11 min-w-11 on button).
 *   - No JS-driven slide/transform animation — relies on globals.css
 *     reduced-motion guard neutralising any CSS transition.
 *
 * Scroll state: the header adds .scrolled via a scroll listener to apply
 *   blur/border. The transition is CSS only (neutralised under reduced-motion).
 *
 * Attributes:
 *   data-site-header — consumed by print stylesheet hide-list.
 *   class="site-nav" — consumed by Plan 09-01 print hide-list + scroll-state.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const NAV = [
  { href: '/archive', label: 'Archive' },
  { href: '/charities', label: 'Charities' },
  { href: '/about', label: 'About' },
  { href: '/shop', label: 'Shop' },
] as const

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Scroll-state for blur/border treatment
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close on Escape; return focus to button
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const closeMenu = useCallback(() => setOpen(false), [])
  const toggleMenu = useCallback(() => setOpen((v) => !v), [])

  return (
    <header
      data-site-header
      className={[
        'site-nav',
        'fixed top-0 left-0 right-0 z-[150]',
        'flex items-center justify-between',
        'px-5 md:px-10 py-5',
        'font-ui',
        'border-b transition-[padding,background,backdrop-filter,border-color]',
        scrolled
          ? 'py-3 bg-[color-mix(in_srgb,var(--color-bg)_90%,transparent)] backdrop-blur-[10px] border-[color:var(--color-line)]'
          : 'border-transparent',
      ]
        .join(' ')}
      aria-label="Site navigation"
    >
      {/* Wordmark */}
      <Link
        href="/"
        className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text)] whitespace-nowrap z-10"
      >
        The Eisenbalm Dispatch
      </Link>

      {/* Desktop nav — visible ≥960px */}
      <nav
        aria-label="Primary"
        className="hidden min-[960px]:flex items-center gap-8"
      >
        <ul className="flex items-center gap-6 list-none">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex items-center min-h-11 py-2 text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] transition-colors"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* "Buy Lip Balm" CTA — UI-SPEC Copywriting Contract */}
        <Link
          href="/shop"
          className="inline-flex items-center min-h-11 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-bg)] bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-bright)] transition-colors"
        >
          Buy Lip Balm
        </Link>
      </nav>

      {/* Hamburger — visible <960px */}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="site-mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={toggleMenu}
        className="min-[960px]:hidden inline-flex items-center justify-center min-h-11 min-w-11 text-[color:var(--color-text)] z-10"
      >
        {open ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <Menu size={20} aria-hidden="true" />
        )}
      </button>

      {/* Mobile menu panel — disclosure */}
      {open && (
        <nav
          id="site-mobile-menu"
          aria-label="Mobile"
          className="min-[960px]:hidden absolute top-full left-0 right-0 bg-[color:var(--color-surface)] border-b border-[color:var(--color-line)] px-5 py-4"
        >
          <ul className="flex flex-col list-none">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  className="flex items-center min-h-11 py-2 text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] transition-colors border-b border-[color:var(--color-line)] last:border-0"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/shop"
                onClick={closeMenu}
                className="inline-flex items-center min-h-11 mt-3 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-bg)] bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-bright)] transition-colors"
              >
                Buy Lip Balm
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
