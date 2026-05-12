/**
 * Dynamic sitemap. Next.js App Router built-in convention.
 * Outputs: /sitemap.xml
 *
 * Inclusion rules (UI-SPEC §Sitemap):
 *   - All /issue/[slug] from published weeklyIssues (priority 0.9)
 *   - All /charities/[slug] from every charity doc (priority 0.7)
 *   - Static pages: /, /archive, /charities, /about, /shop (priorities below)
 *
 * Exclusion: /api/, drafts, in-review — implicit: QUERY_ARCHIVE filters
 * on status == "published" and QUERY_ALL_CHARITIES returns approved charities.
 */
import type { MetadataRoute } from 'next'
import { sanityClient } from '@/lib/sanity/client'
import {
  QUERY_ALL_CHARITIES,
  QUERY_ARCHIVE,
} from '@/lib/sanity/queries'
import type { ArchiveIssue, CharityListItem } from '@/lib/sanity/types'
import { getSiteUrl } from '@/lib/site'

export const revalidate = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const now = new Date()

  // Guard: during CI builds or preview deployments without Sanity credentials,
  // return only the static entries so the build never fails on a missing projectId.
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  if (!projectId) {
    return [
      { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
      { url: `${base}/archive`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
      { url: `${base}/charities`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
      { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
      { url: `${base}/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    ]
  }

  const [issues, charities] = await Promise.all([
    sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE),
    sanityClient.fetch<CharityListItem[]>(QUERY_ALL_CHARITIES),
  ])

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/archive`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${base}/charities`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${base}/shop`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]

  const issueEntries: MetadataRoute.Sitemap = (issues ?? []).map((issue) => ({
    url: `${base}/issue/${issue.slug}`,
    lastModified: issue.publishDate ? new Date(issue.publishDate) : now,
    changeFrequency: 'yearly',
    priority: 0.9,
  }))

  const charityEntries: MetadataRoute.Sitemap = (charities ?? []).map((c) => ({
    url: `${base}/charities/${c.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticEntries, ...issueEntries, ...charityEntries]
}
