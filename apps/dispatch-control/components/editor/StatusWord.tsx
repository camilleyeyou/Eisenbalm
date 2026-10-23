import { STATUS_WORDS, type StatusWord as StatusWordName } from '@/lib/nomenclature'

type Marker = (typeof STATUS_WORDS)[StatusWordName]['marker']

/**
 * Shape marker so colour is never the only signal.
 * fill 'cobalt' (Stations) or 'status' (StepList, uses the word's colour).
 */
export function StatusMarker({
  marker,
  size = 22,
  fill = 'status',
  colorVar,
}: {
  marker: Marker
  size?: 22 | 30 | 8
  fill?: 'cobalt' | 'status'
  colorVar?: string
}) {
  const color = fill === 'cobalt' ? 'var(--color-cobalt)' : `var(${colorVar ?? '--color-ink-soft'})`
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const, className: 'shrink-0' }
  switch (marker) {
    case 'check':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill={color} />
          <path d="M6 12l4 4 8-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="square" />
        </svg>
      )
    case 'ring':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10.5" fill="#fff" stroke={color} strokeWidth="3" />
          <circle cx="12" cy="12" r="5" fill={color} />
        </svg>
      )
    case 'hollow':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11" fill="none" stroke="rgba(85,81,74,.3)" strokeWidth="2" />
        </svg>
      )
    case 'exclamation':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="12" fill="var(--color-problem)" />
          <path d="M12 6v8" stroke="#fff" strokeWidth="3" strokeLinecap="square" />
          <circle cx="12" cy="18" r="1.8" fill="#fff" />
        </svg>
      )
    case 'line':
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="2" fill={color} />
        </svg>
      )
  }
}

export default function StatusWord({
  word,
  text,
  className,
  hideMarker,
}: {
  word: StatusWordName
  text?: string
  className?: string
  hideMarker?: boolean
}) {
  const def = STATUS_WORDS[word]
  return (
    <span
      className={`inline-flex items-center gap-2 font-[family-name:var(--font-ui)] text-[15px] ${className ?? ''}`}
      style={{ color: `var(${def.colorVar})` }}
    >
      {hideMarker ? null : <StatusMarker marker={def.marker} size={8} colorVar={def.colorVar} />}
      <span className={def.bold ? 'font-semibold' : ''}>{text ?? word}</span>
    </span>
  )
}
