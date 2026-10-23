'use client'

/**
 * Phase 56 — shared editor/admin shell: masthead + three-link nav + main.
 * No user menu, no command palette, no "Admin" link.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { EDITOR_NAV } from '@/lib/nav'

export default function EditorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  return (
    <div className="min-h-screen bg-[color:var(--color-rail)] text-[color:var(--color-ink)]">
      <header className="mx-auto flex max-w-[1040px] flex-wrap items-baseline justify-between gap-x-6 gap-y-3 px-4 pb-2 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="editor-focus basis-full font-[family-name:var(--font-display)] text-[23px] font-semibold sm:basis-auto"
        >
          The Eisenbalm Dispatch
        </Link>
        <nav aria-label="Pages">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {EDITOR_NAV.map(item => {
              const current = item.match(pathname)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={
                      'editor-focus inline-flex min-h-[48px] items-center font-[family-name:var(--font-ui)] text-[15px] ' +
                      (current
                        ? 'font-semibold text-[color:var(--color-ink)] underline decoration-2 underline-offset-[6px]'
                        : 'text-[color:var(--color-ink-soft)]')
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto flex max-w-[1040px] flex-col gap-8 px-4 pb-16 pt-4 sm:gap-12 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
