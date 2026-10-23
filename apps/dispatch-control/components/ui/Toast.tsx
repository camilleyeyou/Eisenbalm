'use client'
/**
 * quick 261023-1i8 — one branded toast layer so every data-changing click
 * tells the editor it worked (or didn't).
 *
 * Mirrors ConfirmDialog.tsx's createContext pattern, EXCEPT `useToast()` never
 * throws outside a provider: it returns stable no-ops, so bare-render tests
 * (and any screen rendered without the root layout) stay silent.
 *
 * Mounted once in app/layout.tsx. z-order: `z-[80]` — above ConfirmDialog
 * (`z-[70]`) and the command palette (`z-[75]`).
 *
 * Max 3 visible (oldest dropped). done/info 5 s, problem 9 s. Hover or focus
 * pauses a toast's timer. Identical tone+title within 1.5 s is ignored.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'done' | 'problem' | 'info'
export interface ToastInput {
  title: string
  detail?: string
  duration?: number
}
export interface ToastApi {
  done: (title: string, detail?: string) => void
  problem: (title: string, detail?: string) => void
  info: (title: string, detail?: string) => void
}

interface ToastRecord {
  id: number
  tone: ToastTone
  title: string
  detail?: string
  createdAt: number
  duration: number
}

const MAX_VISIBLE = 3
const DEDUP_MS = 1500
const DURATION: Record<ToastTone, number> = { done: 5000, info: 5000, problem: 9000 }

const NOOP_API: ToastApi = Object.freeze({
  done: () => {},
  problem: () => {},
  info: () => {},
})

const ToastContext = createContext<ToastApi | null>(null)

const BAR: Record<ToastTone, string> = {
  done: 'bg-[color:var(--color-done)]',
  problem: 'bg-[color:var(--color-problem)]',
  info: 'bg-[color:var(--color-cobalt)]',
}

function ToastItem({ toast, onRemove }: { toast: ToastRecord; onRemove: (id: number) => void }) {
  const remaining = useRef(toast.duration)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    startedAt.current = Date.now()
    timer.current = setTimeout(() => onRemove(toast.id), Math.max(0, remaining.current))
  }, [onRemove, toast.id])

  const pause = useCallback(() => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    remaining.current -= Date.now() - startedAt.current
  }, [])

  useEffect(() => {
    start()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [start])

  return (
    <div
      data-testid="toast"
      role={toast.tone === 'problem' ? 'alert' : 'status'}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      className="toast-enter pointer-events-auto relative flex items-start gap-3 overflow-hidden border-2 border-[color:var(--color-ink)] bg-[color:var(--color-card)] py-[14px] pl-5 pr-2 shadow-[0_6px_20px_rgba(23,20,14,0.18)]"
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[6px] ${BAR[toast.tone]}`} />
      <div className="min-w-0 flex-1">
        <p className="font-[family-name:var(--font-ui)] text-[17px] font-semibold text-[color:var(--color-ink)]">
          {toast.title}
        </p>
        {toast.detail && (
          <p className="mt-1 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-ink-soft)]">
            {toast.detail}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onRemove(toast.id)}
        className="editor-focus flex h-11 w-11 shrink-0 items-center justify-center font-[family-name:var(--font-ui)] text-[22px] leading-none text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const nextId = useRef(1)
  const recent = useRef<Map<string, number>>(new Map())

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((tone: ToastTone, title: string, detail?: string) => {
    const now = Date.now()
    const key = `${tone}|${title}`
    const last = recent.current.get(key)
    if (last !== undefined && now - last < DEDUP_MS) return
    recent.current.set(key, now)
    const record: ToastRecord = {
      id: nextId.current++,
      tone,
      title,
      detail,
      createdAt: now,
      duration: DURATION[tone],
    }
    setToasts((prev) => [...prev, record].slice(-MAX_VISIBLE))
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      done: (title, detail) => push('done', title, detail),
      problem: (title, detail) => push('problem', title, detail),
      info: (title, detail) => push('info', title, detail),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex w-[min(560px,calc(100%-32px))] -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Never throws: outside a provider this returns stable silent no-ops. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_API
}
