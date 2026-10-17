import './sections.css'

export function PullQuote({ text, tone }: { text: string; tone: 'green' | 'red' }) {
  return (
    <blockquote className="d-pullquote">
      <p className="d-heading d-pullquote-text">
        <span className={`d-pullquote-mark d-pullquote-mark--${tone}`}>{text}</span>
      </p>
    </blockquote>
  )
}
