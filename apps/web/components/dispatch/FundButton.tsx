import Link from 'next/link'
import './commerce.css'

export function FundButton({ label }: { label: string }) {
  return (
    <div className="d-fund">
      <Link href="/shop" className="d-pill d-pill--accent d-fund-btn">
        {label}
      </Link>
    </div>
  )
}
