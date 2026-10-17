import './top.css'
import { TICKER_CONSTANT_LINE } from '@/lib/dispatch/copy'

const TEXT = ['paper', 'green', 'yellow'] as const
const DOT = ['green', 'blue', 'red', 'yellow'] as const

export function Ticker({ lines }: { lines: string[] }) {
  const items = [...lines, TICKER_CONSTANT_LINE]
  return (
    <div className="d-ticker" aria-hidden="true">
      <div className="d-ticker-track">
        {[0, 1].map((set) => (
          <ul key={set} className={set ? 'd-ticker-set d-ticker-set--dup' : 'd-ticker-set'}>
            {items.map((t, i) => (
              <li key={i} className="d-ticker-item">
                <span className={`d-dot d-dot--${DOT[i % 4]}`} />
                <span className={`d-ticker-text d-ticker-text--${TEXT[i % 3]}`}>{t}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
