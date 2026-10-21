/**
 * Quick 261021-j83 (D-7) — the Admin hub: one flat list of plain-language
 * items. Items checked every week (Finance, Charities) come first.
 */
import Link from 'next/link'
import { ADMIN_ITEMS } from '@/lib/nav'

export default function AdminHubPage() {
  const ordered = [...ADMIN_ITEMS.filter(i => i.weekly), ...ADMIN_ITEMS.filter(i => !i.weekly)]
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <h1 className="font-[family-name:var(--font-display)] text-[34px] leading-[1.05] text-[color:var(--color-ink)]">
        Admin
      </h1>
      <p className="mt-2 font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink-soft)]">
        Tools for checking and tuning the machine. The weekly issue lives on the front page.
      </p>
      <ul aria-label="Admin pages" className="mt-6 border border-[color:var(--color-faint)] bg-white">
        {ordered.map((item, i) => (
          <li key={item.href} className={i > 0 ? 'border-t border-[color:var(--color-nav)]' : ''}>
            <Link
              href={item.href}
              className="flex min-h-[64px] flex-col justify-center gap-0.5 px-5 py-3 hover:bg-[color:var(--color-card-alt)]"
            >
              <span className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-display)] text-[20px] text-[color:var(--color-ink)]">
                  {item.label}
                </span>
                {item.weekly ? (
                  <span className="border border-[color:var(--color-cobalt)] px-[6px] py-[1px] font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[.09em] text-[color:var(--color-cobalt)]">
                    Checked weekly
                  </span>
                ) : null}
              </span>
              <span className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
                {item.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
