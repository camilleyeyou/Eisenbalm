import Link from 'next/link'
import { SitePage } from '@/components/dispatch/SitePage'

export default function NotFound() {
  return (
    <SitePage title="This page does not exist." tone="yellow" narrow>
      <p className="d-body d-page-copy">
        Try the <Link href="/archive" className="d-link">archive</Link>.
      </p>
    </SitePage>
  )
}
