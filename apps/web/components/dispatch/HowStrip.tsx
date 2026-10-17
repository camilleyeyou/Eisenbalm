import './top.css'
import { HOW_EYEBROW, HOW_STEPS } from '@/lib/dispatch/copy'

export function HowStrip() {
  return (
    <section id="how" aria-labelledby="how-title" className="d-how">
      <div className="d-container">
        <h2 id="how-title" className="d-eyebrow">
          {HOW_EYEBROW}
        </h2>
        <ol className="d-how-steps">
          {HOW_STEPS.map((s, i) => (
            <li key={i} className="d-how-step">
              <span className={`d-how-disc d-how-disc--${i + 1}`} aria-hidden="true">
                {i + 1}
              </span>
              <p className="d-body">
                <strong>{s.lead}</strong>
                {s.rest}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
