/**
 * Sanity image URL builder.
 * Per CONTEXT.md D-03: @sanity/image-url + next/image for optimization.
 *
 * Phase 2 uses this for:
 *   - <ShopShell> product imagery (if Andrew adds product images later)
 *   - <CharityCard> optional charity logo display
 * Phase 9 will use it for agent avatars (agentProfile.avatar).
 */
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { sanityClient } from './client'

const builder = imageUrlBuilder(sanityClient)

/**
 * Build a Sanity image URL.
 * Usage:
 *   <img src={urlFor(charity.image).width(800).url()} alt={charity.name} />
 */
export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}
