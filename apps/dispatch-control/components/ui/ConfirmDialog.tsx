'use client'
/**
 * quick 260723-4a6 (Task 2) — the 1c-styled confirm dialog + promise-based
 * `useConfirm()` hook, replacing every `window.confirm(...)` call in the
 * console with a branded in-app modal.
 *
 * `ConfirmProvider` mirrors `components/onboarding/OnboardingProvider.tsx`'s
 * shape (createContext + a hook that throws if used outside the provider).
 * It holds AT MOST one pending confirm request in state and renders ONE
 * dialog for the whole app — mounted in `(dashboard)/layout.tsx`, wrapping
 * the shell `<div>` (a sibling of `CommandPaletteProvider`), so every route
 * child can call `useConfirm()`.
 *
 * z-order (see CommandPalette.tsx for the full ladder): this dialog is
 * `z-[70]` — above HelpTip (`z-[60]`) and the inspector panel (`z-40`), below
 * the command palette (`z-[75]`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

interface PendingRequest extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve })
    })
  }, [])

  function settle(value: boolean) {
    pending?.resolve(value)
    setPending(null)
  }

  useEffect(() => {
    if (!pending) return
    confirmButtonRef.current?.focus()
  }, [pending])

  useEffect(() => {
    if (!pending) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') settle(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <button
            type="button"
            aria-label="Dismiss dialog"
            className="fixed inset-0 z-[70] cursor-default bg-[color:var(--color-ink)]/40"
            onClick={() => settle(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative z-[70] w-[min(420px,calc(100vw-32px))] rounded-[2px] border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-5"
          >
            <h2
              id="confirm-dialog-title"
              className="font-[family-name:var(--font-ui)] text-[13px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)]"
            >
              {pending.title}
            </h2>
            {pending.body && (
              <p className="mt-2 font-[family-name:var(--font-ui)] text-[13px] leading-relaxed text-[color:var(--color-ink-soft)]">
                {pending.body}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => settle(true)}
                className={
                  pending.tone === 'danger'
                    ? 'min-h-[44px] rounded-[2px] border border-[color:var(--color-vermilion)] bg-[color:var(--color-vermilion)] px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-white hover:opacity-90'
                    : 'min-h-[44px] rounded-[2px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-masthead-text)] hover:opacity-90'
                }
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/** Throws if used outside a `<ConfirmProvider>` — no silent `window.confirm` fallback. */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (ctx === null) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return ctx
}
