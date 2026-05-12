/**
 * Server component for embedding JSON-LD structured data.
 *
 * Usage:
 *   <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', ... }} />
 *
 * Safety: JSON.stringify with a replacer that escapes "</" sequences to
 * prevent script-tag breakout (the only realistic injection vector inside
 * a <script type="application/ld+json"> body).
 */

type JsonLdData = Record<string, unknown> | Array<Record<string, unknown>>

function safeJsonLdString(data: JsonLdData): string {
  // Escape "<" → "<" so a malicious payload cannot close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      // dangerouslySetInnerHTML is required: <script> children must be a
      // string, not React children. Content is JSON-only and pre-escaped
      // by safeJsonLdString.
      dangerouslySetInnerHTML={{ __html: safeJsonLdString(data) }}
    />
  )
}
