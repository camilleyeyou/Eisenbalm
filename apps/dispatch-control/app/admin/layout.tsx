/**
 * Quick 261021-j83 — the /admin shell: a slim top bar (wordmark, back to the
 * issue, Admin hub, user menu) above the page. No sidebar, masthead inbox,
 * tour or stage tabs.
 *
 * Provider order is load-bearing (fast 260723): ConfirmProvider and
 * CommandPaletteProvider must sit OUTSIDE InspectorProvider — the inspector
 * panel's footer calls useConfirm(); the inside-ordering crashed opening the
 * inspector. This layout stays a Server Component rendering client providers.
 */
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { InspectorProvider } from '@/components/inspector/InspectorProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { CommandPaletteProvider } from '@/components/CommandPalette'

const BAR_LINK =
  'inline-flex min-h-[44px] items-center px-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] underline-offset-4 hover:underline'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <CommandPaletteProvider>
        <InspectorProvider>
          <div className="flex h-screen flex-col overflow-hidden bg-[color:var(--color-rail)]">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-faint)] bg-[color:var(--color-paper)] px-4 md:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  className="font-[family-name:var(--font-display)] text-[20px] text-[color:var(--color-ink)]"
                >
                  The Eisenbalm Dispatch
                </Link>
                <Link href="/" className={BAR_LINK}>
                  ← Back to the issue
                </Link>
                <Link href="/admin" className={BAR_LINK}>
                  Admin
                </Link>
              </div>
              <UserButton />
            </header>
            <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">{children}</main>
          </div>
        </InspectorProvider>
      </CommandPaletteProvider>
    </ConfirmProvider>
  )
}
